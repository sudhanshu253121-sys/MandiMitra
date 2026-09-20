/**
 * MandiMitra - Agricultural Procurement Scheduling Platform
 * Smart India Hackathon Prototype Logic (Vanilla JS)
 */

(function () {
  'use strict';

  // API Configuration (Backend FastAPI Endpoint)
  const API_BASE_URL = 'http://127.0.0.1:8000';
  let isApiOnline = false;

  // Local state for seamless offline fallback
  let state = {
    currentUser: {
      name: 'Rameshwar Prasad',
      role: 'Farmer',
      mobile: '9876543210',
      aadhaar: '9021 4412 8890',
      khasra: 'HR-KAR-2026-KH-492'
    },
    activeToken: 'MM-2026-8812',
    activeBooking: null,       // populated after slot is confirmed
    activeStep: 1, // 1: Booked, 2: Reached, 3: Quality, 4: Weighed, 5: Paid
    selectedMandiId: 1,
    selectedDate: new Date().toISOString().split('T')[0],
    selectedSlot: '10:00 - 12:00',
    todayQueue: [
      {
        token_id: 'MM-2026-8812',
        farmer_name: 'Rameshwar Prasad',
        farmer_mobile: '9876543210',
        crop_type: 'Wheat (Sharbati)',
        estimated_quintals: 45.0,
        status: 'WEIGHED',
        final_weight: 46.2,
        hold_reason: null
      },
      {
        token_id: 'MM-2026-8813',
        farmer_name: 'Balvinder Singh',
        farmer_mobile: '9823114455',
        crop_type: 'Paddy (Basmati)',
        estimated_quintals: 70.0,
        status: 'QUALITY_CHECK',
        final_weight: null,
        hold_reason: null
      },
      {
        token_id: 'MM-2026-8814',
        farmer_name: 'Suresh Patel',
        farmer_mobile: '9198761234',
        crop_type: 'Mustard (Sarson)',
        estimated_quintals: 30.0,
        status: 'ON_HOLD',
        final_weight: null,
        hold_reason: 'High moisture detected (14.2% > 12.0% limit)'
      },
      {
        token_id: 'MM-2026-8815',
        farmer_name: 'Devendra Meena',
        farmer_mobile: '9456789123',
        crop_type: 'Wheat (Lokwan)',
        estimated_quintals: 60.0,
        status: 'REACHED_CENTER',
        final_weight: null,
        hold_reason: null
      },
      {
        token_id: 'MM-2026-8816',
        farmer_name: 'Harpal Kaur',
        farmer_mobile: '9765432109',
        crop_type: 'Wheat (HD-2967)',
        estimated_quintals: 50.0,
        status: 'SLOT_BOOKED',
        final_weight: null,
        hold_reason: null
      }
    ],
    mandiData: {
      1: { name: 'Karnal APMC Grain Yard (Main)', capacity: 1500, booked: 255 },
      2: { name: 'Indore Krishi Upaj Mandi', capacity: 1500, booked: 420 },
      3: { name: 'Nashik Lasalgaon APMC', capacity: 1500, booked: 490 },
      4: { name: 'Bathinda Wheat Hub Mandi', capacity: 1500, booked: 200 }
    }
  };

  // DOM Elements Cache
  const navBtns = document.querySelectorAll('.view-nav-btn');
  const viewSections = document.querySelectorAll('.view-section');
  const roleTabs = document.querySelectorAll('.role-tab');
  const farmerContainer = document.getElementById('form-farmer-container');
  const clerkContainer = document.getElementById('form-clerk-container');
  const toastContainer = document.getElementById('toast-container');

  // Modals
  const modalBot = document.getElementById('modal-bot-assist');
  const btnOpenBot = document.getElementById('btn-bot-assist');
  const btnCloseBot = document.getElementById('btn-close-bot');
  const botChatHistory = document.getElementById('bot-chat-history');
  const botUserInput = document.getElementById('bot-user-input');
  const btnSendBot = document.getElementById('btn-send-bot');
  const promptChips = document.querySelectorAll('.prompt-chip');

  const modalHold = document.getElementById('modal-hold-action');
  const btnCloseHold = document.getElementById('btn-close-hold');
  const btnCancelHold = document.getElementById('btn-cancel-hold');
  const btnConfirmHold = document.getElementById('btn-confirm-hold');
  const holdTokenLabel = document.getElementById('hold-token-label');
  const holdReasonSelect = document.getElementById('hold-reason-select');
  let currentHoldTargetToken = null;

  /* =============================================================
     INITIALIZATION & HEALTH CHECK
     ============================================================= */
  function init() {
    setupNavigation();
    setupAuthRoleSwitch();
    setupAuthSubModeSwitch();
    setupQuickDemoFill();
    setupPasswordToggles();
    setupPasswordStrengthAndValidation();
    setupForms();
    setupSmartSlotBooking();
    setupCapacityWatcher();
    setupStepper();
    setupClerkQueue();
    setupBotAssist();
    setupFileUpload();
    setupLogout();
    setupProfileDropdown();
    checkBackendHealth();

    // Always start at auth view — role-based routing handled after login
    switchView('view-auth');
    setNavForRole(null); // hide role-specific nav until logged in

    // Hide profile pill until user logs in
    const pillWrapper = document.getElementById('user-pill-wrapper');
    if (pillWrapper) pillWrapper.style.display = 'none';
  }

  async function checkBackendHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
      if (res.ok) {
        isApiOnline = true;
        console.log('[MandiMitra] FastAPI Backend is ONLINE at', API_BASE_URL);
        syncWithBackend();
      }
    } catch (e) {
      isApiOnline = false;
      console.log('[MandiMitra] Backend offline. Running in high-fidelity standalone demo mode.');
    }
  }

  async function syncWithBackend() {
    if (!isApiOnline) return;
    try {
      // Sync Mandi Centers
      const centersRes = await fetch(`${API_BASE_URL}/mandi-centers`);
      if (centersRes.ok) {
        const centers = await centersRes.json();
        centers.forEach(c => {
          if (state.mandiData[c.id]) {
            state.mandiData[c.id].capacity = c.daily_capacity_quintals;
            state.mandiData[c.id].booked = c.booked_quintals_today;
          }
        });
        updateCapacityDisplay();
      }

      // Sync Today's Queue
      const queueRes = await fetch(`${API_BASE_URL}/slots/today`);
      if (queueRes.ok) {
        state.todayQueue = await queueRes.json();
        renderQueueTable();
        updateQueueStats();
      }
    } catch (err) {
      console.warn('Sync error:', err);
    }
  }

  /* =============================================================
     VIEW SWITCHING & ROUTING
     ============================================================= */
  function setupNavigation() {
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.target;
        switchView(targetView);
      });
    });

    document.getElementById('nav-brand-click')?.addEventListener('click', () => {
      switchView('view-auth');
    });
  }

  function switchView(viewId) {
    viewSections.forEach(section => {
      section.classList.remove('active');
      if (section.id === viewId) {
        section.classList.add('active');
      }
    });

    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === viewId);
    });

    window.location.hash = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =============================================================
     AUTH & ROLE SWITCHING (PAGE 1)
     ============================================================= */
  function setupAuthRoleSwitch() {
    roleTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        roleTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        if (tab.id === 'tab-farmer') {
          farmerContainer.classList.add('active');
          clerkContainer.classList.remove('active');
        } else {
          farmerContainer.classList.remove('active');
          clerkContainer.classList.add('active');
        }
      });
    });
  }

  function switchFarmerSubMode(mode) {
    const btnLogin = document.getElementById('btn-mode-farmer-login');
    const btnReg = document.getElementById('btn-mode-farmer-reg');
    const viewLogin = document.getElementById('view-farmer-login');
    const viewReg = document.getElementById('view-farmer-reg');

    if (mode === 'login') {
      btnLogin?.classList.add('active');
      btnReg?.classList.remove('active');
      viewLogin?.classList.add('active');
      viewReg?.classList.remove('active');
    } else {
      btnLogin?.classList.remove('active');
      btnReg?.classList.add('active');
      viewLogin?.classList.remove('active');
      viewReg?.classList.add('active');
    }
  }

  function switchClerkSubMode(mode) {
    const btnLogin = document.getElementById('btn-mode-clerk-login');
    const btnReg = document.getElementById('btn-mode-clerk-reg');
    const viewLogin = document.getElementById('view-clerk-login');
    const viewReg = document.getElementById('view-clerk-reg');

    if (mode === 'login') {
      btnLogin?.classList.add('active');
      btnReg?.classList.remove('active');
      viewLogin?.classList.add('active');
      viewReg?.classList.remove('active');
    } else {
      btnLogin?.classList.remove('active');
      btnReg?.classList.add('active');
      viewLogin?.classList.remove('active');
      viewReg?.classList.add('active');
    }
  }

  function setupAuthSubModeSwitch() {
    document.getElementById('btn-mode-farmer-login')?.addEventListener('click', () => switchFarmerSubMode('login'));
    document.getElementById('btn-mode-farmer-reg')?.addEventListener('click', () => switchFarmerSubMode('register'));
    document.getElementById('link-goto-farmer-reg')?.addEventListener('click', () => switchFarmerSubMode('register'));
    document.getElementById('link-goto-farmer-login')?.addEventListener('click', () => switchFarmerSubMode('login'));

    document.getElementById('btn-mode-clerk-login')?.addEventListener('click', () => switchClerkSubMode('login'));
    document.getElementById('btn-mode-clerk-reg')?.addEventListener('click', () => switchClerkSubMode('register'));
    document.getElementById('link-goto-clerk-reg')?.addEventListener('click', () => switchClerkSubMode('register'));
    document.getElementById('link-goto-clerk-login')?.addEventListener('click', () => switchClerkSubMode('login'));
  }

  function setupQuickDemoFill() {
    document.getElementById('btn-quick-fill-farmer')?.addEventListener('click', () => {
      const idInput = document.getElementById('farmer-login-id');
      const passInput = document.getElementById('farmer-login-pass');
      if (idInput) idInput.value = '9876543210';
      if (passInput) passInput.value = 'Password@123';
      showToast('Filled Demo Farmer: 9876543210 / Password@123', 'info');
    });

    document.getElementById('btn-quick-fill-clerk')?.addEventListener('click', () => {
      const idInput = document.getElementById('clerk-id');
      const passInput = document.getElementById('clerk-pass');
      if (idInput) idInput.value = 'CLK-KAR-104';
      if (passInput) passInput.value = 'Password@123';
      showToast('Filled Demo Mandi Clerk: CLK-KAR-104 / Password@123', 'info');
    });
  }

  function setupPasswordToggles() {
    document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const openIcon = btn.querySelector('.eye-open');
        const closedIcon = btn.querySelector('.eye-closed');
        if (openIcon && closedIcon) {
          openIcon.style.display = isPassword ? 'none' : 'block';
          closedIcon.style.display = isPassword ? 'block' : 'none';
        }
      });
    });
  }

  function evaluatePasswordStrength(pwd) {
    if (!pwd) return { score: 0, text: 'Password Strength', class: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score === 1) return { score: 1, text: 'Weak (Min 6 chars)', class: 'strength-weak' };
    if (score === 2) return { score: 2, text: 'Fair (Add upper/lower)', class: 'strength-fair' };
    if (score === 3) return { score: 3, text: 'Good (Add numbers & symbols)', class: 'strength-good' };
    return { score: 4, text: 'Strong & Secure ✓', class: 'strength-strong' };
  }

  function setupPasswordStrengthAndValidation() {
    // Farmer Password Strength
    const farmerPass = document.getElementById('farmer-reg-pass');
    const farmerStrengthWrap = document.getElementById('farmer-strength-wrap');
    const farmerStrengthLabel = document.getElementById('farmer-strength-label');
    const farmerConfirm = document.getElementById('farmer-reg-confirm');
    const farmerConfirmMsg = document.getElementById('msg-farmer-confirm');
    const farmerMobile = document.getElementById('farmer-mobile');
    const farmerPhoneMsg = document.getElementById('msg-farmer-phone');

    if (farmerPass && farmerStrengthWrap && farmerStrengthLabel) {
      farmerPass.addEventListener('input', () => {
        const res = evaluatePasswordStrength(farmerPass.value);
        farmerStrengthWrap.className = 'pwd-strength-container ' + res.class;
        farmerStrengthLabel.textContent = res.text;
        checkFarmerMatch();
      });
    }

    function checkFarmerMatch() {
      if (!farmerConfirm || !farmerConfirmMsg) return;
      const pass = farmerPass ? farmerPass.value : '';
      const conf = farmerConfirm.value;
      if (!conf) {
        farmerConfirmMsg.textContent = '';
        farmerConfirmMsg.className = 'field-validation-msg';
        return;
      }
      if (pass === conf) {
        farmerConfirmMsg.textContent = '✓ Passwords match';
        farmerConfirmMsg.className = 'field-validation-msg valid';
      } else {
        farmerConfirmMsg.textContent = '✗ Passwords do not match';
        farmerConfirmMsg.className = 'field-validation-msg invalid';
      }
    }

    if (farmerConfirm) {
      farmerConfirm.addEventListener('input', checkFarmerMatch);
    }

    if (farmerMobile && farmerPhoneMsg) {
      farmerMobile.addEventListener('input', () => {
        const clean = farmerMobile.value.replace(/\D/g, '');
        if (!clean) {
          farmerPhoneMsg.textContent = '';
        } else if (clean.length === 10) {
          farmerPhoneMsg.textContent = '✓ Valid 10-digit mobile number';
          farmerPhoneMsg.className = 'field-validation-msg valid';
        } else {
          farmerPhoneMsg.textContent = `${clean.length}/10 digits entered`;
          farmerPhoneMsg.className = 'field-validation-msg invalid';
        }
      });
    }

    // Clerk Validation
    const clerkPass = document.getElementById('clerk-reg-pass');
    const clerkStrengthWrap = document.getElementById('clerk-strength-wrap');
    const clerkStrengthLabel = document.getElementById('clerk-strength-label');
    const clerkConfirm = document.getElementById('clerk-reg-confirm');
    const clerkConfirmMsg = document.getElementById('msg-clerk-confirm');
    const clerkEmail = document.getElementById('clerk-reg-email');
    const clerkEmailMsg = document.getElementById('msg-clerk-email');

    if (clerkPass && clerkStrengthWrap && clerkStrengthLabel) {
      clerkPass.addEventListener('input', () => {
        const res = evaluatePasswordStrength(clerkPass.value);
        clerkStrengthWrap.className = 'pwd-strength-container ' + res.class;
        clerkStrengthLabel.textContent = res.text;
        checkClerkMatch();
      });
    }

    function checkClerkMatch() {
      if (!clerkConfirm || !clerkConfirmMsg) return;
      const pass = clerkPass ? clerkPass.value : '';
      const conf = clerkConfirm.value;
      if (!conf) {
        clerkConfirmMsg.textContent = '';
        clerkConfirmMsg.className = 'field-validation-msg';
        return;
      }
      if (pass === conf) {
        clerkConfirmMsg.textContent = '✓ Passwords match';
        clerkConfirmMsg.className = 'field-validation-msg valid';
      } else {
        clerkConfirmMsg.textContent = '✗ Passwords do not match';
        clerkConfirmMsg.className = 'field-validation-msg invalid';
      }
    }

    if (clerkConfirm) {
      clerkConfirm.addEventListener('input', checkClerkMatch);
    }

    if (clerkEmail && clerkEmailMsg) {
      clerkEmail.addEventListener('input', () => {
        const email = clerkEmail.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
          clerkEmailMsg.textContent = '';
        } else if (emailRegex.test(email)) {
          clerkEmailMsg.textContent = '✓ Valid official email format';
          clerkEmailMsg.className = 'field-validation-msg valid';
        } else {
          clerkEmailMsg.textContent = 'Please enter a valid official email address';
          clerkEmailMsg.className = 'field-validation-msg invalid';
        }
      });
    }
  }

  function applyFarmerAuthSuccess(userData, token) {
    const name = userData.full_name || 'Farmer';
    state.currentUser = {
      name: name,
      role: 'Farmer',
      mobile: userData.phone || userData.identifier || '9876543210',
      aadhaar: userData.aadhaar || '9021 4412 8890',
      khasra: userData.khasra_no || 'HR-KAR-2026-KH-492',
      region: userData.region_location || 'Karnal, Haryana',
      farm_size: userData.farm_size || 4.5
    };

    if (token) {
      try { localStorage.setItem('mandimitra_token', token); } catch(e){}
    }

    // Update UI Pills
    document.getElementById('display-user-name').textContent = name;
    document.getElementById('display-user-role').textContent = 'Farmer (किसान)';
    document.getElementById('avatar-initials').textContent = getInitials(name);
    document.getElementById('farmer-hero-title').textContent = `Namaste, ${name.split(' ')[0]} Ji`;

    // Lock navigation to Farmer view only
    setNavForRole('farmer');
    showLogoutBtn(true);

    // Show profile pill now that user is authenticated
    const pillWrapper = document.getElementById('user-pill-wrapper');
    if (pillWrapper) pillWrapper.style.display = '';

    // Pre-fill ID card with farmer identity
    prefillFarmerIdCard();

    showToast(`Welcome ${name}! Kisan session authenticated.`, 'success');
    setTimeout(() => switchView('view-farmer'), 400);
  }

  function applyClerkAuthSuccess(userData, token, centerName) {
    const name = userData.full_name || userData.employee_id || userData.identifier || 'APMC Officer';
    state.currentUser = {
      name: name,
      role: 'Mandi Clerk',
      center: centerName || userData.department_station || 'Karnal APMC Grain Yard (Main)',
      employee_id: userData.employee_id || userData.identifier
    };

    if (token) {
      try { localStorage.setItem('mandimitra_token', token); } catch(e){}
    }

    document.getElementById('display-user-name').textContent = name;
    document.getElementById('display-user-role').textContent = 'APMC Officer';
    document.getElementById('avatar-initials').textContent = 'CLK';

    // Lock navigation to Clerk view only
    setNavForRole('clerk');
    showLogoutBtn(true);

    // Show profile pill now that clerk is authenticated
    const pillWrapperClerk = document.getElementById('user-pill-wrapper');
    if (pillWrapperClerk) pillWrapperClerk.style.display = '';

    showToast(`Welcome ${name} - ${state.currentUser.center}`, 'success');
    setTimeout(() => switchView('view-clerk'), 400);
  }

  function setupForms() {
    // 1. Farmer Login Form
    const farmerLoginForm = document.getElementById('form-farmer-login');
    if (farmerLoginForm) {
      farmerLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('farmer-login-id').value.trim();
        const pass = document.getElementById('farmer-login-pass').value.trim();

        if (!ident || !pass) {
          showToast('Please enter your mobile/email and password', 'error');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-farmer-login');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Authenticating...'; }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'farmer', identifier: ident, password: pass })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            applyFarmerAuthSuccess(data.user, data.access_token);
          } else {
            showToast(data.detail || 'Invalid login credentials', 'error');
          }
        } catch (err) {
          // Graceful fallback if backend offline
          console.warn('Backend login fallback:', err);
          applyFarmerAuthSuccess({
            full_name: 'Rameshwar Prasad',
            phone: ident,
            identifier: ident
          }, null);
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Sign In to Farmer Portal</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
          }
        }
      });
    }

    // 2. Farmer Registration Form
    const farmerRegForm = document.getElementById('form-farmer-reg');
    if (farmerRegForm) {
      farmerRegForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('farmer-name').value.trim();
        const mobile = document.getElementById('farmer-mobile').value.trim();
        const pass = document.getElementById('farmer-reg-pass').value.trim();
        const confirm = document.getElementById('farmer-reg-confirm').value.trim();
        const region = document.getElementById('farmer-region').value.trim();
        const farmSize = parseFloat(document.getElementById('farmer-farm-size').value) || 0;
        const aadhaar = document.getElementById('farmer-aadhaar').value.trim();
        const khasra = document.getElementById('farmer-khasra').value.trim();
        const consent = document.getElementById('farmer-consent').checked;

        if (!name || !mobile || !region || !farmSize || !aadhaar || !khasra) {
          showToast('Please complete all mandatory fields (*)', 'error');
          return;
        }
        if (mobile.replace(/\D/g, '').length !== 10) {
          showToast('Please enter a valid 10-digit mobile number', 'error');
          return;
        }
        if (pass.length < 6) {
          showToast('Password must be at least 6 characters long', 'error');
          return;
        }
        if (pass !== confirm) {
          showToast('Passwords do not match. Please re-check.', 'error');
          return;
        }
        if (!consent) {
          showToast('Please accept the declaration consent', 'error');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-farmer');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Registering Kisan Account...'; }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'farmer',
              full_name: name,
              phone: mobile,
              password: pass,
              region_location: region,
              farm_size: farmSize,
              aadhaar: aadhaar,
              khasra_no: khasra
            })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            applyFarmerAuthSuccess(data.user, data.access_token);
          } else {
            showToast(data.detail || 'Registration error. Please check your details.', 'error');
          }
        } catch (err) {
          console.warn('Backend reg fallback:', err);
          applyFarmerAuthSuccess({
            full_name: name,
            phone: mobile,
            region_location: region,
            farm_size: farmSize,
            aadhaar: aadhaar,
            khasra_no: khasra
          }, null);
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Register & Create Kisan Account</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
          }
        }
      });
    }

    // 3. Mandi Clerk Login Form
    const clerkLoginForm = document.getElementById('form-clerk-auth');
    if (clerkLoginForm) {
      clerkLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clerkId = document.getElementById('clerk-id').value.trim();
        const pass = document.getElementById('clerk-pass').value.trim();
        const centerSelect = document.getElementById('clerk-center');
        const centerName = centerSelect ? centerSelect.options[centerSelect.selectedIndex].text : 'Karnal APMC Grain Yard (Main)';

        if (!clerkId || !pass) {
          showToast('Please provide your Employee ID and Password', 'error');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-clerk');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Verifying Credentials...'; }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'clerk', identifier: clerkId, password: pass })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            applyClerkAuthSuccess(data.user, data.access_token, centerName);
          } else {
            showToast(data.detail || 'Invalid Clerk credentials', 'error');
          }
        } catch (err) {
          console.warn('Backend clerk login fallback:', err);
          applyClerkAuthSuccess({
            full_name: clerkId,
            employee_id: clerkId
          }, null, centerName);
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Sign In as Mandi Clerk</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
          }
        }
      });
    }

    // 4. Mandi Clerk Registration Form
    const clerkRegForm = document.getElementById('form-clerk-reg');
    if (clerkRegForm) {
      clerkRegForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('clerk-reg-name').value.trim();
        const email = document.getElementById('clerk-reg-email').value.trim();
        const empId = document.getElementById('clerk-reg-empid').value.trim();
        const stationSelect = document.getElementById('clerk-reg-station');
        const stationName = stationSelect ? stationSelect.options[stationSelect.selectedIndex].text : '';
        const pass = document.getElementById('clerk-reg-pass').value.trim();
        const confirm = document.getElementById('clerk-reg-confirm').value.trim();

        if (!name || !email || !empId) {
          showToast('Please complete all official fields (*)', 'error');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showToast('Please provide a valid official email address', 'error');
          return;
        }
        if (pass.length < 6) {
          showToast('Password must be at least 6 characters long', 'error');
          return;
        }
        if (pass !== confirm) {
          showToast('Passwords do not match', 'error');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-clerk-reg');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Registering Official...'; }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'clerk',
              full_name: name,
              email: email,
              employee_id: empId,
              department_station: stationName,
              password: pass
            })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            applyClerkAuthSuccess(data.user, data.access_token, stationName);
          } else {
            showToast(data.detail || 'Clerk registration error', 'error');
          }
        } catch (err) {
          console.warn('Backend clerk reg fallback:', err);
          applyClerkAuthSuccess({
            full_name: name,
            email: email,
            employee_id: empId,
            department_station: stationName
          }, null, stationName);
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Register Official Account</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
          }
        }
      });
    }

    // 5. Slot Booking Form Submit
    const bookingForm = document.getElementById('form-slot-booking');
    if (bookingForm) {
      bookingForm.addEventListener('submit', handleSlotBooking);
    }
  }

  function setupFileUpload() {
    const fileInput = document.getElementById('farmer-doc');
    const statusText = document.getElementById('drop-status-text');

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        statusText.innerHTML = `✅ <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
        statusText.style.color = '#2D6A4F';
      }
    });
  }

  /* =============================================================
     FARMER DASHBOARD: LIVE STEPPER (PAGE 2)
     ============================================================= */
  const stepMessages = {
    1: {
      headline: 'Stage 1: Slot Confirmed & QR Pass Issued',
      desc: 'Your designated time window is locked. Please bring your QR Token Pass and Original Land Record document to the APMC Gate Entry.'
    },
    2: {
      headline: 'Stage 2: Arrival at APMC Yard Gate Verified',
      desc: 'Gate sensor verified vehicle entry. Proceed to Inspection Bay 3 for electronic moisture and grain impurity testing.'
    },
    3: {
      headline: 'Stage 3: Grain Quality & Moisture Inspection',
      desc: 'Quality inspector is testing moisture percentage. Permissible standard for MSP clearance is <= 12.0%.'
    },
    4: {
      headline: 'Stage 4: Automated Digital Weighbridge (Kanta #2)',
      desc: 'Vehicle has entered the digital weighbridge. Gross weight calculation is streaming from IoT sensors. Direct DBT clearance will trigger after tare subtraction.'
    },
    5: {
      headline: 'Stage 5: Payment Disbursed via Direct Benefit Transfer (DBT)',
      desc: 'Procurement completed! Total settlement credit has been triggered directly to your Aadhaar-seeded Bank Account.'
    }
  };

  function setupStepper() {
    updateStepperDisplay(state.activeStep);

    document.getElementById('btn-refresh-tracker')?.addEventListener('click', async () => {
      showToast('Syncing with APMC Live Gate & Weighbridge sensors...', 'info');
      
      if (isApiOnline) {
        try {
          const res = await fetch(`${API_BASE_URL}/slots/${state.activeToken}`);
          if (res.ok) {
            const data = await res.json();
            mapBackendStatusToStep(data.status);
            showToast(`Status updated: ${data.status}`, 'success');
            return;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      // Offline simulation rotation
      state.activeStep = (state.activeStep % 5) + 1;
      updateStepperDisplay(state.activeStep);
      showToast(`Simulated status progressed to Step ${state.activeStep}`, 'success');
    });

    document.getElementById('btn-view-slip')?.addEventListener('click', () => {
      alert(`MANDI MITRA E-PROCUREMENT SLIP\n-------------------------------\nToken ID: ${state.activeToken}\nFarmer: ${state.currentUser.name}\nCrop: Wheat (Sharbati)\nEst Qty: 45.0 Quintals\nStatus: ${stepMessages[state.activeStep].headline}`);
    });
  }

  function mapBackendStatusToStep(statusStr) {
    switch (statusStr) {
      case 'SLOT_BOOKED': updateStepperDisplay(1); break;
      case 'REACHED_CENTER': updateStepperDisplay(2); break;
      case 'QUALITY_CHECK': updateStepperDisplay(3); break;
      case 'WEIGHED': updateStepperDisplay(4); break;
      case 'PAYMENT_SENT': updateStepperDisplay(5); break;
      default: updateStepperDisplay(1);
    }
  }

  function updateStepperDisplay(currentStep) {
    state.activeStep = currentStep;

    const stepDefaultTimes = {
      1: '10:15 AM',
      2: '11:30 AM',
      3: '12:10 PM',
      4: '01:45 PM',
      5: '02:30 PM'
    };

    // Emoji icon per stage shown in the callout banner
    const stepIcons = { 1: '📅', 2: '🚜', 3: '🔬', 4: '⚖️', 5: '💳' };

    for (let i = 1; i <= 5; i++) {
      const node = document.getElementById(`step-${i}`);
      const line = document.getElementById(`line-${i}`);
      const timeEl = document.getElementById(`time-step-${i}`);

      if (!node) continue;
      // Clear all possible status classes before applying the correct one
      node.classList.remove('completed', 'active', 'is-active', 'pending');

      if (i < currentStep) {
        // All steps before active → completed (green checkmark)
        node.classList.add('completed');
        if (line) line.className = 'step-line completed';
        if (timeEl) timeEl.textContent = stepDefaultTimes[i];
      } else if (i === currentStep) {
        // Exactly the active step → in_progress (pulsing active node)
        node.classList.add('active', 'is-active');
        if (line) line.className = 'step-line active';
        if (timeEl) timeEl.textContent = 'In Progress';
      } else {
        // All steps after active → pending (gray)
        node.classList.add('pending');
        if (line) line.className = 'step-line';
        if (timeEl) timeEl.textContent = 'Pending';
      }
    }

    // Sync the detail callout banner to the current active step
    const info = stepMessages[currentStep] || stepMessages[1];
    const headlineEl = document.getElementById('callout-headline');
    const descEl = document.getElementById('callout-desc');
    const iconEl = document.querySelector('.callout-icon-box');
    if (headlineEl) headlineEl.textContent = info.headline;
    if (descEl) descEl.textContent = info.desc;
    if (iconEl) iconEl.textContent = stepIcons[currentStep] || '📅';
  }

  /* =============================================================
     FARMER DASHBOARD: CAPACITY WATCHER & BOOKING
     ============================================================= */
  function setupCapacityWatcher() {
    const mandiSelect = document.getElementById('book-mandi-select');
    const cropSelect = document.getElementById('book-crop');
    const qtyInput = document.getElementById('book-qty');
    const estHint = document.getElementById('est-value-hint');

    mandiSelect.addEventListener('change', () => {
      state.selectedMandiId = parseInt(mandiSelect.value);
      updateCapacityDisplay();
    });

    function calculateEstMSP() {
      const qty = parseFloat(qtyInput.value) || 0;
      const msp = parseFloat(cropSelect.selectedOptions[0]?.dataset?.msp) || 2441;
      const total = qty * msp;
      if (estHint) estHint.textContent = `Est. MSP Settlement: ~ ₹${total.toLocaleString('en-IN')}`;
      const cropMspHint = document.getElementById('crop-msp-hint');
      if (cropMspHint) cropMspHint.textContent = `Govt. MSP: ₹${msp.toLocaleString('en-IN')}/Qtl`;
    }

    cropSelect.addEventListener('change', calculateEstMSP);
    qtyInput.addEventListener('input', calculateEstMSP);

    calculateEstMSP();
    updateCapacityDisplay();
  }

  function updateCapacityDisplay() {
    const data = state.mandiData[state.selectedMandiId] || state.mandiData[1];
    const mandiNameEl = document.getElementById('mandi-alert-name');
    const badgeEl = document.getElementById('capacity-badge-text');
    const fillEl = document.getElementById('capacity-fill');
    const detailEl = document.getElementById('capacity-detail-text');

    const remaining = Math.max(0, data.capacity - data.booked);
    const pct = Math.min(100, Math.round((data.booked / data.capacity) * 100));

    mandiNameEl.textContent = data.name;
    badgeEl.textContent = `Available Quota: ${remaining.toFixed(0)} / ${data.capacity} Qtl`;
    fillEl.style.width = `${pct}%`;

    if (pct >= 90) {
      fillEl.style.background = '#EF4444';
      badgeEl.style.backgroundColor = '#FEE2E2';
      badgeEl.style.color = '#991B1B';
    } else if (pct >= 70) {
      fillEl.style.background = '#F59E0B';
      badgeEl.style.backgroundColor = '#FEF3C7';
      badgeEl.style.color = '#B45309';
    } else {
      fillEl.style.background = 'linear-gradient(90deg, #52B788 0%, #2D6A4F 100%)';
      badgeEl.style.backgroundColor = '#DCFCE7';
      badgeEl.style.color = '#166534';
    }

    detailEl.textContent = `Daily limit: ${data.capacity} Quintals. Booked today: ${data.booked} Quintals (${pct}% utilization).`;
  }

  /* =============================================================
     SMART SLOT BOOKING: INTERACTIVE DATE TABS & 2-HOUR SLOTS
     Theme: KisanSeva / MandiMitra Green (#15803d)
     ============================================================= */
  function setupSmartSlotBooking() {
    const dateTabsBar = document.getElementById('date-tabs-bar');
    const timeSlotsGrid = document.getElementById('time-slots-grid');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const selectedDateHidden = document.getElementById('selected-booking-date');
    const selectedSlotHidden = document.getElementById('selected-booking-slot');

    if (!dateTabsBar || !timeSlotsGrid) return;

    // Generate dynamic date list starting from today (Next 7 days)
    const today = new Date();
    const daysCount = 7;
    const dates = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];

      dates.push({
        iso: iso,
        dayLabel: i === 0 ? 'TODAY' : (i === 1 ? 'TOMORROW' : dayNames[d.getDay()]),
        dayNum: String(d.getDate()).padStart(2, '0'),
        month: monthNames[d.getMonth()],
        openSlots: i === 2 ? 3 : (i === 5 ? 2 : 5)
      });
    }

    if (!state.selectedDate) {
      state.selectedDate = dates[0].iso;
    }
    if (!state.selectedSlot) {
      state.selectedSlot = '10:00 - 12:00';
    }

    // 2-Hour Time Windows
    const slotWindows = [
      { id: 's1', time: '08:00 - 10:00', maxThroughput: 300, maxVehicles: 15 },
      { id: 's2', time: '10:00 - 12:00', maxThroughput: 300, maxVehicles: 15 },
      { id: 's3', time: '12:00 - 14:00', maxThroughput: 300, maxVehicles: 15 },
      { id: 's4', time: '14:00 - 16:00', maxThroughput: 300, maxVehicles: 15 },
      { id: 's5', time: '16:00 - 18:00', maxThroughput: 300, maxVehicles: 15 }
    ];

    // Compute slot distribution dynamically based on selected date
    function getSlotsForDate(dateIso) {
      const dayNum = parseInt(dateIso.split('-')[2], 10) || 1;

      return slotWindows.map((sw, idx) => {
        // Deterministic realistic slot variation
        const isFull = (dayNum % 3 === 0 && idx === 1) || (dayNum % 2 === 1 && idx === 3);
        let usedThroughput = 0;
        let usedVehicles = 0;

        if (isFull) {
          usedThroughput = sw.maxThroughput;
          usedVehicles = sw.maxVehicles;
        } else if (idx === 0) {
          usedThroughput = 0;
          usedVehicles = 0;
        } else if (idx === 1) {
          usedThroughput = 120;
          usedVehicles = 6;
        } else if (idx === 2) {
          usedThroughput = 180;
          usedVehicles = 9;
        } else {
          usedThroughput = Math.min(260, (dayNum * 35) % sw.maxThroughput);
          usedVehicles = Math.min(13, Math.round(usedThroughput / 20));
        }

        const freeThroughput = Math.max(0, sw.maxThroughput - usedThroughput);

        return {
          ...sw,
          usedThroughput,
          freeThroughput,
          usedVehicles,
          isFull: isFull || freeThroughput <= 0
        };
      });
    }

    // 1. Render Date Tabs
    function renderDateTabs() {
      dateTabsBar.innerHTML = '';
      dates.forEach(d => {
        const isSelected = d.iso === state.selectedDate;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `date-tab ${isSelected ? 'active' : ''}`;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.dataset.date = d.iso;

        tab.innerHTML = `
          <span class="tab-day">${d.dayLabel}</span>
          <span class="tab-num">${d.dayNum}</span>
          <span class="tab-month">${d.month}</span>
          <span class="tab-badge">${d.openSlots} Open</span>
        `;

        tab.addEventListener('click', () => {
          state.selectedDate = d.iso;
          if (selectedDateHidden) selectedDateHidden.value = d.iso;
          renderDateTabs();
          renderTimeSlots();
          updateFormPreview();
        });

        dateTabsBar.appendChild(tab);
      });
    }

    // 2. Render 2-Hour Time Slot Grid
    function renderTimeSlots() {
      timeSlotsGrid.innerHTML = '';
      const slots = getSlotsForDate(state.selectedDate);

      // If active selection is full on this date, default to first available slot
      const currentSelectedObj = slots.find(s => s.time === state.selectedSlot);
      if (!currentSelectedObj || currentSelectedObj.isFull) {
        const firstAvail = slots.find(s => !s.isFull);
        if (firstAvail) {
          state.selectedSlot = firstAvail.time;
          if (selectedSlotHidden) selectedSlotHidden.value = firstAvail.time;
        }
      }

      slots.forEach(slot => {
        const isSelected = slot.time === state.selectedSlot && !slot.isFull;
        const pctUsed = Math.min(100, Math.round((slot.usedThroughput / slot.maxThroughput) * 100));

        const card = document.createElement('div');
        card.className = `slot-card ${slot.isFull ? 'is-full' : ''} ${isSelected ? 'selected' : ''}`;
        card.dataset.slotTime = slot.time;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', slot.isFull ? '-1' : '0');

        card.innerHTML = `
          <div class="slot-card-header">
            <div class="slot-time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="slot-clock-icon">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span><strong>${slot.time}</strong></span>
            </div>
            <span class="slot-status-badge ${slot.isFull ? 'badge-red' : 'badge-green'}">
              ${slot.isFull ? 'SLOT FULL' : `${slot.freeThroughput}q Free`}
            </span>
          </div>

          <div class="slot-progress-track">
            <div class="slot-progress-bar" style="width: ${pctUsed}%;"></div>
          </div>

          <div class="slot-indicators-row">
            <span>Throughput Cap: <strong>${slot.usedThroughput}/${slot.maxThroughput} q</strong></span>
            <span>Vehicles: <strong>${slot.usedVehicles}/${slot.maxVehicles}</strong></span>
          </div>
        `;

        if (!slot.isFull) {
          card.addEventListener('click', () => {
            state.selectedSlot = slot.time;
            if (selectedSlotHidden) selectedSlotHidden.value = slot.time;
            document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            updateFormPreview();
          });
        } else {
          card.addEventListener('click', () => {
            showToast('Selected 2-hour window has reached maximum throughput quota. Please select another slot.', 'error');
          });
        }

        timeSlotsGrid.appendChild(card);
      });
    }

    function updateFormPreview() {
      if (selectedDateHidden) selectedDateHidden.value = state.selectedDate;
      if (selectedSlotHidden) selectedSlotHidden.value = state.selectedSlot;
      if (selectedDateDisplay) {
        selectedDateDisplay.textContent = `${state.selectedDate} • ${state.selectedSlot || '08:00 - 10:00'} (Express Entry)`;
      }
    }

    // Initial render
    renderDateTabs();
    renderTimeSlots();
    updateFormPreview();
  }

  /* =============================================================
     DYNAMIC CAPACITY CHECK & SLOT BOOKING
     ============================================================= */
  async function handleSlotBooking(e) {
    e.preventDefault();

    const crop = document.getElementById('book-crop').value;
    const qty = parseFloat(document.getElementById('book-qty').value);
    const mandiId = parseInt(document.getElementById('book-mandi-select').value);
    const bookingDate = state.selectedDate;

    if (!qty || qty <= 0) {
      showToast('Please specify a valid quantity in Quintals', 'error');
      return;
    }

    const mandiInfo = state.mandiData[mandiId];
    const availableQuota = mandiInfo.capacity - mandiInfo.booked;

    // Client-side quick check
    if (qty > availableQuota) {
      showToast(`Capacity Exceeded! Selected mandi only has ${availableQuota} Quintals remaining on this date.`, 'error');
      return;
    }

    const payload = {
      farmer_id: state.currentUser.aadhaar || 'IND-AADH-9021',
      farmer_name: state.currentUser.name || 'Rameshwar Prasad',
      farmer_mobile: state.currentUser.mobile || '9876543210',
      mandi_id: mandiId,
      booking_date: bookingDate,
      crop_type: crop,
      estimated_quintals: qty
    };

    let confirmedToken = null;

    if (isApiOnline) {
      try {
        const res = await fetch(`${API_BASE_URL}/book-slot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          showToast(errData.detail || 'Booking failed due to capacity constraints.', 'error');
          return;
        }

        const data = await res.json();
        confirmedToken = data.token_id;
      } catch (err) {
        console.warn('API error, falling back to local simulation:', err);
      }
    }

    // Local simulation fallback
    if (!confirmedToken) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      confirmedToken = `MM-2026-${rand}`;
    }

    // Update active token and local records
    state.activeToken = confirmedToken;
    document.getElementById('active-token-id').textContent = confirmedToken;
    document.getElementById('active-token-crop').textContent = `${crop} • ${qty} Quintals`;

    // Deduct capacity
    mandiInfo.booked += qty;
    updateCapacityDisplay();

    // Add to Clerk Queue
    const newSlot = {
      token_id: confirmedToken,
      farmer_name: state.currentUser.name,
      farmer_mobile: state.currentUser.mobile,
      crop_type: crop,
      estimated_quintals: qty,
      status: 'SLOT_BOOKED',
      final_weight: null,
      hold_reason: null
    };
    state.todayQueue.unshift(newSlot);
    renderQueueTable();
    updateQueueStats();

    // Reset Stepper to Step 1
    updateStepperDisplay(1);

    // Populate & reveal Farmer ID Card
    const mandiSelect = document.getElementById('book-mandi-select');
    const mandiName = mandiSelect.options[mandiSelect.selectedIndex].text.split(' -')[0];
    const msp = parseFloat(document.getElementById('book-crop').selectedOptions[0].dataset.msp) || 2275;

    // Persist booking info to state so dropdown can read it later
    const selectedSlotTime = state.selectedSlot || '10:00 - 12:00';
    state.activeBooking = {
      crop,
      qty,
      mandi:    mandiName,
      date:     bookingDate,
      slot:     selectedSlotTime,
      mspTotal: qty * msp
    };

    populateFarmerIdCard({
      token:    confirmedToken,
      crop,
      qty,
      mandi:    mandiName,
      date:     `${bookingDate} (${selectedSlotTime})`,
      slot:     selectedSlotTime,
      mspTotal: qty * msp
    });

    showToast(`🎉 Slot Booked! Token: ${confirmedToken}. Scheduled for ${bookingDate} at ${selectedSlotTime}.`, 'success');

    // Scroll to ID card
    setTimeout(() => {
      document.getElementById('farmer-id-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  }

  /* =============================================================
     CLERK DASHBOARD: QUEUE & ACTIONS (PAGE 3)
     ============================================================= */
  function setupClerkQueue() {
    renderQueueTable();
    updateQueueStats();

    // Search filter
    const searchInput = document.getElementById('queue-search');
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      renderQueueTable(query);
    });

    // Hold Action Modal
    btnCloseHold?.addEventListener('click', () => modalHold.classList.remove('active'));
    btnCancelHold?.addEventListener('click', () => modalHold.classList.remove('active'));
    btnConfirmHold?.addEventListener('click', confirmHoldAction);

    // IoT Simulation Button
    document.getElementById('btn-clerk-iot-sim')?.addEventListener('click', simulateIoTWeighbridge);
  }

  function renderQueueTable(query = '') {
    const tbody = document.getElementById('queue-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = state.todayQueue.filter(item => {
      if (!query) return true;
      return item.token_id.toLowerCase().includes(query) ||
             item.farmer_name.toLowerCase().includes(query) ||
             item.crop_type.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #94A3B8;">No procurement entries match your search.</td></tr>`;
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      const statusTagClass = getStatusBadgeClass(item.status);
      const isHold = item.status === 'ON_HOLD';

      tr.innerHTML = `
        <td><span class="token-pill-badge">${item.token_id}</span></td>
        <td>
          <span class="farmer-col-name">${item.farmer_name}</span>
          <span class="farmer-col-phone">+91 ${item.farmer_mobile || '98XXXXXXXX'}</span>
        </td>
        <td>${item.crop_type}</td>
        <td><strong>${item.final_weight ? item.final_weight + ' (Final)' : item.estimated_quintals}</strong></td>
        <td>
          <span class="status-tag ${statusTagClass}">
            ${formatStatusLabel(item.status)}
          </span>
        </td>
        <td>
          ${item.hold_reason ? `<span class="reason-text">⚠️ ${item.hold_reason}</span>` : '<span style="color:#94A3B8;">—</span>'}
        </td>
        <td class="text-right">
          <div class="action-btn-group">
            <button type="button" class="btn-pass" data-token="${item.token_id}" title="Advance to next step">
              ${getNextActionLabel(item.status)}
            </button>
            <button type="button" class="btn-hold" data-token="${item.token_id}" title="Hold for quality defect">
              ${isHold ? 'Release' : 'Hold'}
            </button>
          </div>
        </td>
      `;

      // Event listeners
      const passBtn = tr.querySelector('.btn-pass');
      const holdBtn = tr.querySelector('.btn-hold');

      passBtn.addEventListener('click', () => handlePassSlot(item.token_id));
      holdBtn.addEventListener('click', () => openHoldModal(item.token_id, isHold));

      tbody.appendChild(tr);
    });
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'SLOT_BOOKED': return 'booked';
      case 'REACHED_CENTER': return 'reached';
      case 'QUALITY_CHECK': return 'quality';
      case 'WEIGHED': return 'weighed';
      case 'ON_HOLD': return 'hold';
      case 'PAYMENT_SENT': return 'weighed';
      default: return 'booked';
    }
  }

  function formatStatusLabel(status) {
    switch (status) {
      case 'SLOT_BOOKED': return 'Booked';
      case 'REACHED_CENTER': return 'At Center';
      case 'QUALITY_CHECK': return 'Quality Insp.';
      case 'WEIGHED': return 'Weighed (कांटा)';
      case 'ON_HOLD': return 'On Hold';
      case 'PAYMENT_SENT': return 'Disbursed';
      default: return status;
    }
  }

  function getNextActionLabel(status) {
    switch (status) {
      case 'SLOT_BOOKED': return 'Pass Gate';
      case 'REACHED_CENTER': return 'Pass Quality';
      case 'QUALITY_CHECK': return 'Pass Weigh';
      case 'WEIGHED': return 'Pay DBT';
      case 'ON_HOLD': return 'Re-Check';
      case 'PAYMENT_SENT': return 'Done';
      default: return 'Pass';
    }
  }

  async function handlePassSlot(tokenId) {
    const item = state.todayQueue.find(q => q.token_id === tokenId);
    if (!item) return;

    let nextStatus = 'REACHED_CENTER';
    if (item.status === 'SLOT_BOOKED') nextStatus = 'REACHED_CENTER';
    else if (item.status === 'REACHED_CENTER') nextStatus = 'QUALITY_CHECK';
    else if (item.status === 'QUALITY_CHECK') nextStatus = 'WEIGHED';
    else if (item.status === 'WEIGHED') nextStatus = 'PAYMENT_SENT';
    else if (item.status === 'ON_HOLD') nextStatus = 'QUALITY_CHECK';

    if (isApiOnline) {
      try {
        await fetch(`${API_BASE_URL}/slots/${tokenId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus, reason: null })
        });
      } catch (err) {
        console.warn(err);
      }
    }

    item.status = nextStatus;
    item.hold_reason = null;

    // If this is the active farmer token, update stepper
    if (tokenId === state.activeToken) {
      mapBackendStatusToStep(nextStatus);
    }

    renderQueueTable();
    updateQueueStats();
    showToast(`Token ${tokenId} advanced to ${formatStatusLabel(nextStatus)}`, 'success');
  }

  function openHoldModal(tokenId, isCurrentlyOnHold) {
    const item = state.todayQueue.find(q => q.token_id === tokenId);
    if (!item) return;

    if (isCurrentlyOnHold) {
      // Toggle back to active
      item.status = 'QUALITY_CHECK';
      item.hold_reason = null;
      renderQueueTable();
      updateQueueStats();
      showToast(`Token ${tokenId} released from hold. Back to inspection.`, 'success');
      return;
    }

    currentHoldTargetToken = tokenId;
    holdTokenLabel.textContent = tokenId;
    modalHold.classList.add('active');
  }

  async function confirmHoldAction() {
    if (!currentHoldTargetToken) return;
    const reason = holdReasonSelect.value;
    const item = state.todayQueue.find(q => q.token_id === currentHoldTargetToken);

    if (item) {
      item.status = 'ON_HOLD';
      item.hold_reason = reason;

      if (isApiOnline) {
        try {
          await fetch(`${API_BASE_URL}/slots/${currentHoldTargetToken}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ON_HOLD', reason: reason })
          });
        } catch (e) {
          console.warn(e);
        }
      }

      renderQueueTable();
      updateQueueStats();
      showToast(`Token ${currentHoldTargetToken} placed ON HOLD: ${reason}`, 'error');
    }

    modalHold.classList.remove('active');
    currentHoldTargetToken = null;
  }

  function updateQueueStats() {
    const total = state.todayQueue.length;
    const checkedIn = state.todayQueue.filter(q => ['REACHED_CENTER', 'QUALITY_CHECK', 'WEIGHED', 'PAYMENT_SENT'].includes(q.status)).length;
    const onHold = state.todayQueue.filter(q => q.status === 'ON_HOLD').length;
    const weighedSum = state.todayQueue
      .filter(q => ['WEIGHED', 'PAYMENT_SENT'].includes(q.status))
      .reduce((acc, curr) => acc + (curr.final_weight || curr.estimated_quintals), 0);

    document.getElementById('stat-total-slots').textContent = `${total} Slots`;
    document.getElementById('stat-checked-in').textContent = `${checkedIn} Farmers`;
    document.getElementById('stat-on-hold').textContent = `${onHold} Held`;
    document.getElementById('stat-weighed-count').textContent = `${weighedSum.toFixed(1)} Qtl`;
  }

  /* =============================================================
     SIMULATE IOT WEIGHBRIDGE UPDATE (ROUTE 2)
     ============================================================= */
  async function simulateIoTWeighbridge() {
    // Pick the first non-weighed slot or the active token
    const candidate = state.todayQueue.find(q => q.status !== 'WEIGHED' && q.status !== 'PAYMENT_SENT') || state.todayQueue[0];
    if (!candidate) {
      showToast('No active slots available for weighbridge simulation.', 'info');
      return;
    }

    const recordedWeight = candidate.estimated_quintals + (Math.random() * 2 - 0.8).toFixed(1) * 1;
    const secretKey = 'KANTA_SECRET_2026';

    showToast(`⚖️ IoT Sensor: Transmitting gross weighbridge data for ${candidate.token_id}...`, 'info');

    let success = false;
    if (isApiOnline) {
      try {
        const res = await fetch(`${API_BASE_URL}/iot/weigh-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_id: candidate.token_id,
            weight_quintals: recordedWeight,
            secret_key: secretKey
          })
        });
        if (res.ok) {
          success = true;
        }
      } catch (e) {
        console.warn('IoT API ping failed, fallback to simulation:', e);
      }
    }

    candidate.status = 'WEIGHED';
    candidate.final_weight = parseFloat(recordedWeight.toFixed(1));
    candidate.hold_reason = null;

    if (candidate.token_id === state.activeToken) {
      updateStepperDisplay(4);
    }

    renderQueueTable();
    updateQueueStats();

    showToast(`✅ IoT Kanta Ping Verified! Token ${candidate.token_id} weighed: ${candidate.final_weight} Quintals.`, 'success');
  }

  /* =============================================================
     BOT ASSIST (KISAN SAHAYAK AI MODAL & VOICE ASSISTANT)
     ============================================================= */
  const botKnowledgeBase = [
    {
      keywords: ['pm kisan', 'pm-kisan', 'samman nidhi', 'pmkisan', '6000', 'installment', 'किस्त', 'सम्मान निधि', 'योजना'],
      reply: '🏛️ <strong>PM Kisan Samman Nidhi Yojana (पीएम किसान):</strong><br>• <strong>Financial Benefit:</strong> ₹6,000 per year provided in 3 equal installments of ₹2,000 directly into Aadhaar-linked bank accounts via DBT.<br>• <strong>Eligibility:</strong> All landholding farmer families across India.<br>• <strong>e-KYC Mandatory:</strong> Complete OTP-based eKYC on pmkisan.gov.in or biometric eKYC at CSC centers.<br>• <strong>Helpline:</strong> 155261 / 1800115526 (Toll Free).'
    },
    {
      keywords: ['fasal bima', 'pmfby', 'insurance', 'crop insurance', 'फसल बीमा', 'नुकसान', 'बीमा', 'claim', 'compensation'],
      reply: '🛡️ <strong>Pradhan Mantri Fasal Bima Yojana (PMFBY - फसल बीमा):</strong><br>• <strong>Comprehensive Coverage:</strong> Protects against non-preventable natural risks (drought, flood, unseasonal rains, pest attacks, post-harvest losses).<br>• <strong>Low Farmer Premium:</strong> Only <strong>1.5%</strong> for Rabi crops, <strong>2.0%</strong> for Kharif crops, and <strong>5.0%</strong> for commercial/horticultural crops.<br>• <strong>Claim Reporting:</strong> Intimate crop damage within <strong>72 hours</strong> on the Crop Insurance App or call Toll-Free <strong>14447</strong>.'
    },
    {
      keywords: ['kcc', 'credit card', 'loan', 'kisan card', 'कर्ज', 'ऋण', 'केसीसी', 'interest rate', 'credit'],
      reply: '💳 <strong>Kisan Credit Card (KCC - किसान क्रेडिट कार्ड):</strong><br>• <strong>Subsidized Interest:</strong> Nominal 7% base interest rate with an additional 3% prompt repayment incentive, making the effective interest rate only <strong>4.0% per annum</strong>!<br>• <strong>Collateral-Free Limit:</strong> Up to ₹1,60,000 without collateral security (extendable to ₹3,00,000 with simple hypothecation).<br>• <strong>Covers:</strong> Crop cultivation inputs, post-harvest expenses, farm asset maintenance, and allied activities (dairy/fisheries). Apply at any commercial, cooperative, or RRB branch.'
    },
    {
      keywords: ['sell', 'selling', 'dbt', 'payment', 'paisa', 'bank', 'बिक्री', 'बेचना', 'भुगतान', 'पैसा', 'खाता', 'direct payment'],
      reply: '💰 <strong>Transparent Mandi Selling & Direct Bank Payment:</strong><br>• <strong>Step 1 (Slot Booking):</strong> Book your preferred mandi date on MandiMitra to bypass long physical queues.<br>• <strong>Step 2 (Arrival & Moisture Test):</strong> Reach gate with QR Pass. Grains tested for moisture (< 12.0%).<br>• <strong>Step 3 (IoT Kanta Weighbridge):</strong> Tamper-proof digital weight transmitted straight to the cloud server.<br>• <strong>Step 4 (DBT Clearance):</strong> MSP payment credited straight into your Aadhaar-linked bank account within <strong>24 to 48 hours</strong> with instant SMS receipt.'
    },
    {
      keywords: ['kusum', 'solar', 'pump', 'सोलर', 'सोलर पंप', 'कुसुम', 'बिजली'],
      reply: '☀️ <strong>PM KUSUM Yojana (सोलर पंप योजना):</strong><br>• <strong>60% Total Subsidy:</strong> 30% Central Govt + 30% State Govt subsidy for installing standalone solar agriculture pumps (3 HP to 10 HP).<br>• <strong>Farmer Share:</strong> Farmers only contribute 10% to 40% (bank loans available for farmer share).<br>• <strong>Benefits:</strong> Zero electricity bills, uninterrupted daytime irrigation, and option to sell surplus solar power back to DISCOM for extra income.'
    },
    {
      keywords: ['soil', 'soil health', 'nano urea', 'fertilizer', 'dap', 'मिट्टी', 'मृदा', 'यूरिया', 'खाद', 'उर्वरक'],
      reply: '🧪 <strong>Soil Health Card & IFFCO Nano Urea Guidelines:</strong><br>• <strong>Soil Testing:</strong> Tests 12 parameters (N, P, K, S, Zinc, Iron, pH, EC) every 2 years to prescribe customized fertilizer doses, saving up to 20-25% input costs.<br>• <strong>Nano Urea (Liquid):</strong> 1 bottle (500 ml) equals 1 whole bag (45 kg) of conventional urea. Spray at active tillering/branching stage (2-4 ml per liter water).<br>• <strong>Advantage:</strong> 80%+ nitrogen use efficiency, zero soil toxicity, and higher crop yields.'
    },
    {
      keywords: ['disease', 'pest', 'rust', 'keeda', 'karnal bunt', 'fungus', 'रोग', 'कीड़ा', 'बीमारी', 'सुंडी', 'कीटनाशक', 'रतुआ'],
      reply: '🐛 <strong>Crop Disease & Pest Management:</strong><br>• <strong>Wheat Yellow/Brown Rust (पीला रतुआ):</strong> Spray Propiconazole 25% EC (Tilt) @ 200 ml in 200 liters of water per acre upon first notice.<br>• <strong>Paddy Stem Borer & Leaf Folder:</strong> Use Cartap Hydrochloride 4G or Chlorantraniliprole (Coragen) as recommended.<br>• <strong>Mustard Aphid (माहू):</strong> Spray Dimethoate 30% EC (Rogor) @ 250-300 ml/acre or Neem oil (1500 ppm).<br>• <strong>Biological Control:</strong> Seed treatment with Trichoderma viride (5g/kg seed) prevents root rot and wilt.'
    },
    {
      keywords: ['msp', 'rate', 'wheat', 'price', 'गेहूं', 'दाम', 'धान', 'सरसों'],
      reply: '🌾 <strong>Current Minimum Support Prices (MSP) for 2026:</strong><br>• Wheat (गेहूं): <strong>₹2,275</strong> / Quintal<br>• Paddy (Basmati धान): <strong>₹2,320</strong> / Quintal<br>• Mustard (सरसों): <strong>₹5,650</strong> / Quintal<br>• Gram (चना): <strong>₹5,440</strong> / Quintal<br>All payments are guaranteed under PM-AASHA and credited within 48 hours of weighbridge clearance.'
    },
    {
      keywords: ['moisture', 'humidity', 'limit', 'नमी', 'quality', 'faq', 'सुखाना'],
      reply: '💧 <strong>Grain Quality & Moisture Parameters:</strong><br>• Maximum permissible moisture limit for Wheat & Paddy is <strong>12.0%</strong>.<br>• Lots with 12.1% to 14.0% may face temporary holding for shade drying.<br>• Foreign matter / chaff must not exceed <strong>2.0%</strong>.'
    },
    {
      keywords: ['khasra', 'document', 'land', 'paper', 'bhoomi', 'कागजात', 'खसरा', 'खतौनी'],
      reply: '📑 <strong>Required Procurement Documents:</strong><br>1. Active State Land Record ID (Khasra/Khatauni No.)<br>2. Aadhaar Card linked with bank account (for DBT payment)<br>3. MandiMitra Digital QR Token Pass<br>4. Pattadar passbook or crop sowing certificate (Girdawari).'
    },
    {
      keywords: ['iot', 'kanta', 'weigh', 'sensor', 'कांटा', 'तोल', 'वजन'],
      reply: '⚖️ <strong>Automated IoT Weighbridge System:</strong><br>MandiMitra connects directly to certified digital weighbridges via industrial telemetry. The moment your tractor rolls on the weighbridge platform, gross weight and tare weight are computed digitally, eliminating all human tampering.'
    },
    {
      keywords: ['enam', 'e-nam', 'online mandi', 'national market', 'ई-नाम'],
      reply: '🌐 <strong>e-NAM (राष्ट्रीय कृषि बाजार):</strong><br>• Unified pan-India electronic trading portal integrating over 1,400 APMC mandis.<br>• Allows farmers to showcase their assayed crop quality and receive online competitive bids from verified buyers across India, eliminating local trader cartels.<br>• 100% online escrow payment settlement directly to the farmer\'s bank account.'
    },
    {
      keywords: ['machine', 'tractor', 'rotavator', 'smam', 'यंत्र', 'उपकरण', 'सब्सिडी यंत्र', 'कृषि यंत्र'],
      reply: '🚜 <strong>Agricultural Machinery Subsidy (SMAM Portal):</strong><br>• <strong>40% to 50% Subsidy</strong> on purchasing Super Seeders, Rotavators, Happy Seeders, Straw Reapers, Laser Land Levelers, and Tractors.<br>• <strong>Custom Hiring Centres (CHC):</strong> Up to 80% financial assistance (up to ₹10 Lakh) for groups/FPOs to establish machinery banks.<br>• Apply online with Khasra & Aadhaar at your State Agriculture DBT Mechanization portal.'
    },
    {
      keywords: ['storage', 'store', 'godown', 'bhandaran', 'भंडारण', 'सहेज', 'अनाज सुरक्षा', 'वेयरहाउस'],
      reply: '🏬 <strong>Scientific Grain Storage & WDRA Warehouse Loans:</strong><br>• Ensure grain moisture is strictly below <strong>12.0%</strong> before bagging; sun-dry on clean tarpaulins.<br>• Store in clean, fumigated gunny bags elevated 15 cm above ground on wooden pallets away from walls.<br>• Deposit harvested grain in WDRA-accredited warehouses to obtain Electronic Negotiable Warehouse Receipts (e-NWR) and get low-interest post-harvest loans without selling under distress.'
    },
    {
      keywords: ['helpline', 'contact', 'call', 'complaint', 'number', 'मदद', 'सहायता', 'फोन', 'कॉल'],
      reply: '📞 <strong>National Farmer Support Helplines:</strong><br>• <strong>Kisan Call Centre (KCC):</strong> <strong>1800-180-1551</strong> (Toll-Free, 6:00 AM – 10:00 PM, available in 22 regional languages).<br>• <strong>PMFBY Crop Insurance:</strong> <strong>14447</strong><br>• <strong>PM-Kisan Help Desk:</strong> <strong>155261 / 011-24300606</strong><br>• <strong>MandiMitra APMC Desk:</strong> Available 24x7 via this Bot or at your local APMC Mandi yard computer kiosk.'
    }
  ];

  // Voice Assistant Global State
  let isVoiceAudioEnabled = true;
  let voiceLang = 'hi-IN'; // 'hi-IN' | 'en-IN'
  let recognitionInstance = null;
  let isListening = false;
  let activeUtterance = null;
  let currentSpeakingButton = null;

  function setupBotAssist() {
    btnOpenBot?.addEventListener('click', () => modalBot.classList.add('active'));
    btnCloseBot?.addEventListener('click', () => {
      modalBot.classList.remove('active');
      stopListening();
      stopSpeechAudio();
    });

    // Voice Audio On/Off Toggle
    const btnAudioToggle = document.getElementById('btn-toggle-bot-audio');
    btnAudioToggle?.addEventListener('click', () => {
      isVoiceAudioEnabled = !isVoiceAudioEnabled;
      btnAudioToggle.classList.toggle('active', isVoiceAudioEnabled);
      btnAudioToggle.classList.toggle('muted', !isVoiceAudioEnabled);
      const icon = btnAudioToggle.querySelector('.audio-icon');
      const label = btnAudioToggle.querySelector('.audio-label');
      if (icon) icon.textContent = isVoiceAudioEnabled ? '🔊' : '🔇';
      if (label) label.textContent = isVoiceAudioEnabled ? 'Voice On' : 'Voice Off';
      if (!isVoiceAudioEnabled) stopSpeechAudio();
      showToast(isVoiceAudioEnabled ? 'Bot Voice Audio: Enabled 🔊' : 'Bot Voice Audio: Muted 🔇', 'info');
    });

    // Voice Language Switcher
    const btnLangToggle = document.getElementById('btn-bot-lang-toggle');
    const langLabel = document.getElementById('bot-lang-label');
    btnLangToggle?.addEventListener('click', () => {
      if (voiceLang === 'hi-IN') {
        voiceLang = 'en-IN';
        if (langLabel) langLabel.textContent = 'English';
        showToast('Voice Language set to: English 🌐', 'info');
      } else {
        voiceLang = 'hi-IN';
        if (langLabel) langLabel.textContent = 'हिन्दी';
        showToast('Voice Language set to: हिन्दी (Hindi) 🌐', 'info');
      }
      if (isListening) {
        stopListening();
        startListening();
      }
    });

    // Microphone Click Handler
    const btnMic = document.getElementById('btn-voice-mic');
    btnMic?.addEventListener('click', toggleListening);

    // Cancel Voice Button
    const btnVoiceCancel = document.getElementById('btn-voice-cancel');
    btnVoiceCancel?.addEventListener('click', stopListening);

    // Wire Quick Prompt Chips dynamically
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (botUserInput) botUserInput.value = query;
        handleBotSubmit();
      });
    });

    btnSendBot?.addEventListener('click', handleBotSubmit);
    botUserInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleBotSubmit();
    });
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('⚠️ Speech recognition is not supported in this browser. Please type your query.', 'error');
      return;
    }

    try {
      stopSpeechAudio();
      recognitionInstance = new SpeechRecognition();
      recognitionInstance.lang = voiceLang;
      recognitionInstance.interimResults = true;
      recognitionInstance.continuous = false;
      recognitionInstance.maxAlternatives = 1;

      const btnMic = document.getElementById('btn-voice-mic');
      const statusBar = document.getElementById('voice-status-bar');
      const statusText = document.getElementById('voice-status-text');

      recognitionInstance.onstart = () => {
        isListening = true;
        btnMic?.classList.add('listening');
        if (statusBar) statusBar.style.display = 'flex';
        if (statusText) {
          statusText.textContent = voiceLang === 'hi-IN'
            ? 'Listening... बोलिए, हम सुन रहे हैं...'
            : 'Listening... Speak your question now...';
        }
      };

      recognitionInstance.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (botUserInput) botUserInput.value = transcript;
      };

      recognitionInstance.onspeechend = () => {
        stopListening();
        setTimeout(() => {
          if (botUserInput && botUserInput.value.trim()) {
            handleBotSubmit();
          }
        }, 300);
      };

      recognitionInstance.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        stopListening();
        if (event.error === 'not-allowed') {
          showToast('⚠️ Microphone permission blocked. Please allow microphone access.', 'error');
        } else if (event.error !== 'no-speech') {
          showToast(`⚠️ Voice input note: ${event.error}`, 'info');
        }
      };

      recognitionInstance.onend = () => {
        isListening = false;
        btnMic?.classList.remove('listening');
        if (statusBar) statusBar.style.display = 'none';
      };

      recognitionInstance.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      stopListening();
    }
  }

  function stopListening() {
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch(e){}
      recognitionInstance = null;
    }
    isListening = false;
    const btnMic = document.getElementById('btn-voice-mic');
    const statusBar = document.getElementById('voice-status-bar');
    btnMic?.classList.remove('listening');
    if (statusBar) statusBar.style.display = 'none';
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function stopSpeechAudio() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentSpeakingButton) {
      currentSpeakingButton.classList.remove('speaking');
      currentSpeakingButton.innerHTML = '🔊 Listen / सुनें';
      currentSpeakingButton = null;
    }
  }

  function speakText(htmlContent, buttonEl = null) {
    if (!('speechSynthesis' in window)) return;

    stopSpeechAudio();

    const plainText = stripHtml(htmlContent);
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = voiceLang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Match best voice for Hindi or English if available in browser
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const match = voices.find(v => v.lang && v.lang.startsWith(voiceLang.slice(0, 2)));
      if (match) utterance.voice = match;
    }

    if (buttonEl) {
      currentSpeakingButton = buttonEl;
      buttonEl.classList.add('speaking');
      buttonEl.innerHTML = '⏹ Stop / रोकें';
    }

    utterance.onend = () => {
      if (buttonEl) {
        buttonEl.classList.remove('speaking');
        buttonEl.innerHTML = '🔊 Listen / सुनें';
        currentSpeakingButton = null;
      }
    };

    utterance.onerror = () => {
      if (buttonEl) {
        buttonEl.classList.remove('speaking');
        buttonEl.innerHTML = '🔊 Listen / सुनें';
        currentSpeakingButton = null;
      }
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function handleBotSubmit() {
    const text = botUserInput.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    botUserInput.value = '';

    // Thinking delay
    setTimeout(() => {
      const lower = text.toLowerCase();
      let match = botKnowledgeBase.find(item => item.keywords.some(k => lower.includes(k)));

      let responseText = match
        ? match.reply
        : `Namaste! I understand you are asking: <em>"${text}"</em>.<br>For specific queries regarding your APMC yard slot, grain quality check, or payment clearance, please keep your <strong>Khasra Number</strong> and <strong>Token ID (${state.activeToken || 'MM-2026-8812'})</strong> ready for the Mandi Helpdesk. You can also call the Kisan Call Centre at <strong>1800-180-1551</strong>.`;

      appendChatMessage('bot', responseText);

      // Auto-read aloud if voice audio is on
      if (isVoiceAudioEnabled) {
        const lastBubble = botChatHistory.lastElementChild;
        const listenBtn = lastBubble?.querySelector('.btn-speak-reply');
        speakText(responseText, listenBtn);
      }
    }, 400);
  }

  function appendChatMessage(sender, htmlContent) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    if (sender === 'bot') {
      bubble.innerHTML = htmlContent + `
        <div>
          <button type="button" class="btn-speak-reply" aria-label="Listen to answer">🔊 Listen / सुनें</button>
        </div>
      `;
      const speakBtn = bubble.querySelector('.btn-speak-reply');
      speakBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (speakBtn.classList.contains('speaking')) {
          stopSpeechAudio();
        } else {
          speakText(htmlContent, speakBtn);
        }
      });
    } else {
      bubble.innerHTML = htmlContent;
    }

    botChatHistory.appendChild(bubble);
    botChatHistory.scrollTop = botChatHistory.scrollHeight;
  }

  /* =============================================================
     TOAST UTILITY
     ============================================================= */
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = msg;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function getInitials(name) {
    if (!name) return 'KM';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  /* =============================================================
     FARMER ID CARD HELPERS
     ============================================================= */

  /** Fill farmer identity section when farmer logs in */
  function prefillFarmerIdCard() {
    const u = state.currentUser;
    const el = (id) => document.getElementById(id);

    el('idcard-avatar-initials').textContent = getInitials(u.name || 'KM');
    el('idcard-farmer-name').textContent     = u.name    || '—';
    el('idcard-mobile').textContent          = u.mobile  ? `+91 ${u.mobile}` : '—';
    el('idcard-aadhaar').textContent         = u.aadhaar || '—';
    el('idcard-khasra').textContent          = u.khasra  || '—';

    // Keep card hidden until a token is booked
    el('farmer-id-card').style.display = 'none';

    // Sync the header dropdown with farmer identity
    updateProfileDropdown();
  }

  /** Populate token + booking fields and reveal the ID card */
  function populateFarmerIdCard({ token, crop, qty, mandi, date, mspTotal }) {
    const el = (id) => document.getElementById(id);

    // Token section
    el('idcard-token-id').textContent = token;
    el('idcard-crop').textContent     = crop;
    el('idcard-qty').textContent      = `${qty} Quintals`;
    el('idcard-mandi').textContent    = mandi;
    el('idcard-date').textContent     = date;
    el('idcard-msp').textContent      = `~ ₹${mspTotal.toLocaleString('en-IN')}`;
    el('idcard-status').innerHTML     = `<span class="status-tag booked">Slot Confirmed ✓</span>`;

    // Issue timestamp
    const now = new Date();
    el('idcard-issued-at').textContent =
      `Issued: ${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    // Reveal with animation
    const card = el('farmer-id-card');
    card.style.display = '';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    requestAnimationFrame(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });

    // Wire Print button
    el('btn-print-id-card')?.addEventListener('click', () => window.print(), { once: true });

    // Sync the header dropdown with new token data
    updateProfileDropdown();
  }

  /* =============================================================
     PROFILE DROPDOWN (Header pill click)
     ============================================================= */

  function setupProfileDropdown() {
    const pill    = document.getElementById('user-profile-pill');
    const wrapper = document.getElementById('user-pill-wrapper');
    const dropdown = document.getElementById('profile-dropdown');
    if (!pill || !dropdown) return;

    // Toggle open/close
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.toggle('open');
      dropdown.classList.toggle('open', isOpen);
      pill.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) updateProfileDropdown();
    });

    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pill.click();
      }
      if (e.key === 'Escape') closeProfileDropdown();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) closeProfileDropdown();
    });
  }

  function closeProfileDropdown() {
    const wrapper  = document.getElementById('user-pill-wrapper');
    const dropdown = document.getElementById('profile-dropdown');
    const pill     = document.getElementById('user-profile-pill');
    wrapper?.classList.remove('open');
    dropdown?.classList.remove('open');
    pill?.setAttribute('aria-expanded', 'false');
  }

  /** Populate the profile dropdown with current state */
  function updateProfileDropdown() {
    const u  = state.currentUser;
    const el = (id) => document.getElementById(id);
    if (!el('pd-name')) return;

    const initials = getInitials(u.name || 'KM');

    // Header
    const pill = document.getElementById('user-profile-pill');
    if (pill) pill.setAttribute('title', u.name ? `${u.name} (${u.role || 'Farmer'})` : 'View Profile');

    el('pd-avatar').textContent = initials;
    el('pd-name').textContent   = u.name || 'Kisan Mitra';
    el('pd-role').textContent   = u.role === 'Mandi Clerk'
      ? `APMC Officer — ${u.center || ''}`
      : 'Farmer (किसान)';

    // Show/hide farmer & land section for non-clerk
    const farmerSec = el('pd-farmer-section');
    const landSec   = el('pd-land-section');
    if (farmerSec) farmerSec.style.display = u.role === 'Mandi Clerk' ? 'none' : '';
    if (landSec)   landSec.style.display   = u.role === 'Mandi Clerk' ? 'none' : '';

    // Farmer identity and land fields
    if (u.role !== 'Mandi Clerk') {
      el('pd-mobile').textContent  = u.mobile  ? `+91 ${u.mobile}` : '—';
      el('pd-aadhaar').textContent = u.aadhaar || '—';
      if (el('pd-kisan-id')) {
        el('pd-kisan-id').textContent = u.aadhaar ? `IND-AADH-${u.aadhaar.replace(/\D/g, '').slice(-4) || '9021'}` : 'IND-AADH-9021';
      }

      // Dynamic Land Details
      if (el('pd-khasra')) {
        el('pd-khasra').textContent = u.khasra || 'HR-KAR-2026-KH-492';
      }
      if (el('pd-land-size')) {
        const acres = parseFloat(u.farm_size || 4.5) || 4.5;
        const ha = (acres * 0.404686).toFixed(2);
        el('pd-land-size').textContent = `${acres} Acres (${ha} Ha)`;
      }
      if (el('pd-land-region')) {
        el('pd-land-region').textContent = u.region || 'Karnal, Haryana';
      }
      if (el('pd-land-crop')) {
        el('pd-land-crop').textContent = state.activeBooking ? `${state.activeBooking.crop}` : 'Wheat (Sharbati) / Rabi';
      }
      if (el('pd-land-type')) {
        el('pd-land-type').textContent = 'Alluvial • Canal & Tube Well';
      }
      if (el('pd-land-status')) {
        el('pd-land-status').innerHTML = 'Bhoomi / Bhulekh Linked ✓';
      }
    }

    // Token section — check if there's an active booking
    const hasToken = !!(state.activeToken && state.activeBooking);
    const tokenSec   = el('pd-token-section');
    const noTokenMsg = el('pd-no-token');

    if (tokenSec)   tokenSec.style.display   = hasToken ? '' : 'none';
    if (noTokenMsg) noTokenMsg.style.display  = hasToken ? 'none' : '';

    if (hasToken) {
      const b = state.activeBooking;
      el('pd-token-id').textContent = state.activeToken;
      el('pd-crop').textContent     = b.crop   || '—';
      el('pd-qty').textContent      = b.qty    ? `${b.qty} Quintals` : '—';
      el('pd-mandi').textContent    = b.mandi  || '—';
      el('pd-date').textContent     = b.date   || '—';
      el('pd-msp').textContent      = b.mspTotal ? `~ ₹${b.mspTotal.toLocaleString('en-IN')}` : '—';
      el('pd-status').innerHTML     = `<span class="status-tag booked">Slot Confirmed ✓</span>`;
    }
  }

  /* =============================================================
     ROLE-BASED NAV LOCKING & LOGOUT
     ============================================================= */

  /**
   * setNavForRole — shows/hides nav buttons depending on who is logged in.
   * role: 'farmer' | 'clerk' | null (not logged in)
   */
  function setNavForRole(role) {
    const navFarmer = document.getElementById('nav-view-farmer');
    const navClerk  = document.getElementById('nav-view-clerk');
    const navAuth   = document.getElementById('nav-view-auth');

    if (role === 'farmer') {
      // Show: Auth (back) + Farmer. Hide: Clerk.
      navAuth.style.display   = '';
      navFarmer.style.display = '';
      navClerk.style.display  = 'none';
    } else if (role === 'clerk') {
      // Show: Auth (back) + Clerk. Hide: Farmer.
      navAuth.style.display   = '';
      navFarmer.style.display = 'none';
      navClerk.style.display  = '';
    } else {
      // Not logged in — hide both role pages from nav
      navAuth.style.display   = '';
      navFarmer.style.display = 'none';
      navClerk.style.display  = 'none';
    }
  }

  /** Show or hide the logout button in the header */
  function showLogoutBtn(visible) {
    const btn = document.getElementById('btn-logout');
    if (btn) btn.style.display = visible ? '' : 'none';
  }

  /** Wire up the logout button */
  function setupLogout() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;

    btn.style.display = 'none'; // hidden until login

    btn.addEventListener('click', () => {
      // Reset state
      state.currentUser  = { name: 'Kisan Mitra', role: 'Farmer' };
      state.activeBooking = null;

      // Clear token
      try { localStorage.removeItem('mandimitra_token'); } catch(e){}

      // Reset header pill
      document.getElementById('display-user-name').textContent = 'Kisan Mitra';
      document.getElementById('display-user-role').textContent = 'Farmer';
      document.getElementById('avatar-initials').textContent = 'KM';

      // Reset all auth forms
      document.getElementById('form-farmer-login')?.reset();
      document.getElementById('form-farmer-reg')?.reset();
      document.getElementById('form-clerk-auth')?.reset();
      document.getElementById('form-clerk-reg')?.reset();

      // Reset validation indicators
      const farmerStrengthWrap = document.getElementById('farmer-strength-wrap');
      if (farmerStrengthWrap) farmerStrengthWrap.className = 'pwd-strength-container';
      const farmerStrengthLabel = document.getElementById('farmer-strength-label');
      if (farmerStrengthLabel) farmerStrengthLabel.textContent = 'Password Strength';
      const msgFarmerConfirm = document.getElementById('msg-farmer-confirm');
      if (msgFarmerConfirm) { msgFarmerConfirm.textContent = ''; msgFarmerConfirm.className = 'field-validation-msg'; }
      const msgFarmerPhone = document.getElementById('msg-farmer-phone');
      if (msgFarmerPhone) { msgFarmerPhone.textContent = ''; msgFarmerPhone.className = 'field-validation-msg'; }

      const clerkStrengthWrap = document.getElementById('clerk-strength-wrap');
      if (clerkStrengthWrap) clerkStrengthWrap.className = 'pwd-strength-container';
      const clerkStrengthLabel = document.getElementById('clerk-strength-label');
      if (clerkStrengthLabel) clerkStrengthLabel.textContent = 'Password Strength';
      const msgClerkConfirm = document.getElementById('msg-clerk-confirm');
      if (msgClerkConfirm) { msgClerkConfirm.textContent = ''; msgClerkConfirm.className = 'field-validation-msg'; }
      const msgClerkEmail = document.getElementById('msg-clerk-email');
      if (msgClerkEmail) { msgClerkEmail.textContent = ''; msgClerkEmail.className = 'field-validation-msg'; }

      // Hide ID card
      const idCard = document.getElementById('farmer-id-card');
      if (idCard) idCard.style.display = 'none';

      // Close dropdown, hide logout, hide pill, unlock nav
      closeProfileDropdown();
      showLogoutBtn(false);
      setNavForRole(null);

      // Hide profile pill on logout
      const pillWrapper = document.getElementById('user-pill-wrapper');
      if (pillWrapper) pillWrapper.style.display = 'none';

      showToast('You have been logged out successfully.', 'info');
      switchView('view-auth');
    });
  }

  // Self Start
  document.addEventListener('DOMContentLoaded', init);
})();
