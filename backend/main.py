import os
import uuid
import hashlib
import hmac
import base64
import json
import time
import secrets
from datetime import datetime, date
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import engine, Base, get_db
from .models import MandiCenter, SlotBooking, AuthUser
from .schemas import (
    SlotRequest, SlotResponse, IoTWeightUpdate, StatusUpdateRequest, MandiCenterSchema,
    AuthRegisterRequest, AuthLoginRequest, AuthResponse, AuthUserResponse
)

# Initialize database schema tables
Base.metadata.create_all(bind=engine)

# Secret key required for IoT weighbridge hardware integration
IOT_SECRET_KEY = os.getenv("IOT_SECRET_KEY", "KANTA_SECRET_2026")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "MANDIMITRA_JWT_SECRET_2026")

def hash_password(password: str, salt: Optional[str] = None):
    """Hash password using PBKDF2 with SHA-256 and unique cryptographic salt."""
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    """Safely verify password against stored PBKDF2 hash using constant-time comparison."""
    test_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(test_hash, pwd_hash)

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def b64url_decode(s: str) -> bytes:
    padding = '=' * (4 - (len(s) % 4)) if len(s) % 4 != 0 else ''
    return base64.urlsafe_b64decode(s + padding)

def create_jwt_token(payload: dict, expires_in_sec: int = 86400 * 7) -> str:
    """Generate tamper-proof HMAC-SHA256 JSON Web Token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload_copy = dict(payload)
    payload_copy["exp"] = int(time.time()) + expires_in_sec
    payload_copy["iat"] = int(time.time())
    
    header_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = b64url_encode(json.dumps(payload_copy, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(AUTH_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = b64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify and decode HMAC-SHA256 JWT."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(AUTH_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        actual_sig = b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload_json = b64url_decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None

def seed_sample_data(db: Session):
    """Seed sample Mandi Centers, preliminary slots, and demo accounts if DB is empty."""
    if db.query(MandiCenter).count() == 0:
        centers = [
            MandiCenter(id=1, name="Karnal APMC Grain Yard (Main)", daily_capacity_quintals=600.0, is_kanta_active=True, location="Karnal, Haryana"),
            MandiCenter(id=2, name="Indore Krishi Upaj Mandi", daily_capacity_quintals=850.0, is_kanta_active=True, location="Indore, Madhya Pradesh"),
            MandiCenter(id=3, name="Nashik Lasalgaon APMC", daily_capacity_quintals=500.0, is_kanta_active=True, location="Nashik, Maharashtra"),
            MandiCenter(id=4, name="Bathinda Wheat Hub Mandi", daily_capacity_quintals=750.0, is_kanta_active=False, location="Bathinda, Punjab")
        ]
        db.add_all(centers)
        db.commit()

        # Seed realistic today's queue for clerk preview
        today_str = date.today().isoformat()
        sample_slots = [
            SlotBooking(
                token_id="MM-2026-8812",
                farmer_id="IND-AADH-9021",
                farmer_name="Rameshwar Prasad",
                farmer_mobile="9876543210",
                crop_type="Wheat (Sharbati)",
                estimated_quintals=45.0,
                mandi_id=1,
                booking_date=today_str,
                status="WEIGHED",
                final_weight=46.2,
                created_at=datetime.utcnow()
            ),
            SlotBooking(
                token_id="MM-2026-8813",
                farmer_id="IND-AADH-4532",
                farmer_name="Balvinder Singh",
                farmer_mobile="9823114455",
                crop_type="Paddy (Basmati)",
                estimated_quintals=70.0,
                mandi_id=1,
                booking_date=today_str,
                status="QUALITY_CHECK",
                created_at=datetime.utcnow()
            ),
            SlotBooking(
                token_id="MM-2026-8814",
                farmer_id="IND-AADH-7819",
                farmer_name="Suresh Patel",
                farmer_mobile="9198761234",
                crop_type="Mustard (Sarson)",
                estimated_quintals=30.0,
                mandi_id=1,
                booking_date=today_str,
                status="ON_HOLD",
                hold_reason="High moisture level detected (14.2% > 12.0% limit)",
                created_at=datetime.utcnow()
            ),
            SlotBooking(
                token_id="MM-2026-8815",
                farmer_id="IND-AADH-3390",
                farmer_name="Devendra Meena",
                farmer_mobile="9456789123",
                crop_type="Wheat (Lokwan)",
                estimated_quintals=60.0,
                mandi_id=1,
                booking_date=today_str,
                status="REACHED_CENTER",
                created_at=datetime.utcnow()
            ),
            SlotBooking(
                token_id="MM-2026-8816",
                farmer_id="IND-AADH-5512",
                farmer_name="Harpal Kaur",
                farmer_mobile="9765432109",
                crop_type="Wheat (HD-2967)",
                estimated_quintals=50.0,
                mandi_id=1,
                booking_date=today_str,
                status="SLOT_BOOKED",
                created_at=datetime.utcnow()
            )
        ]
        db.add_all(sample_slots)
        db.commit()

    # Seed demo users if no auth users exist
    if db.query(AuthUser).count() == 0:
        demo_farmer_hash, demo_farmer_salt = hash_password("Password@123")
        demo_clerk_hash, demo_clerk_salt = hash_password("Password@123")

        demo_users = [
            AuthUser(
                role="farmer",
                full_name="Rameshwar Prasad",
                identifier="9876543210",
                phone="9876543210",
                password_hash=demo_farmer_hash,
                salt=demo_farmer_salt,
                region_location="Karnal, Haryana",
                farm_size=4.5,
                aadhaar="9021 4412 8890",
                khasra_no="HR-KAR-2026-KH-492",
                created_at=datetime.utcnow()
            ),
            AuthUser(
                role="clerk",
                full_name="Rajesh Sharma",
                identifier="CLK-KAR-104",
                employee_id="CLK-KAR-104",
                email="clerk.karnal@apmc.gov.in",
                department_station="Karnal APMC Grain Yard (Main)",
                region_location="Karnal, Haryana",
                password_hash=demo_clerk_hash,
                salt=demo_clerk_salt,
                created_at=datetime.utcnow()
            )
        ]
        db.add_all(demo_users)
        db.commit()

# Seed database immediately upon initialization
with Session(bind=engine) as init_db:
    seed_sample_data(init_db)

app = FastAPI(
    title="MandiMitra API",
    description="Agricultural Procurement Scheduling & IoT Weighbridge Integration API for Smart India Hackathon",
    version="1.0.0"
)

# Configure CORS to allow all origins (as requested)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")

@app.get("/portal", tags=["Portal"])
def get_portal():
    """Redirect to the MandiMitra frontend web application prototype."""
    return RedirectResponse(url="/frontend/index.html")

@app.get("/", tags=["Health"])
def health_check():
    """Root endpoint to verify MandiMitra server status."""
    return {
        "app": "MandiMitra Agricultural Procurement API",
        "status": "Online",
        "portal_url": "http://127.0.0.1:8000/portal",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


# =====================================================================
# AUTHENTICATION ROUTES (DUAL-ROLE: FARMER & MANDI CLERK)
# =====================================================================

@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
def register_user(payload: AuthRegisterRequest, db: Session = Depends(get_db)):
    """
    Dual-role registration endpoint for Farmer and Mandi Clerk.
    Validates mandatory role-specific attributes, encrypts password with PBKDF2-HMAC-SHA256,
    persists the user in the database, and issues an access JWT token.
    """
    req_role = payload.role.strip().lower()
    if req_role not in ["farmer", "clerk"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role specified. Role must be 'farmer' or 'clerk'."
        )

    # Determine primary unique identifier
    if req_role == "farmer":
        if not payload.phone or len(payload.phone.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid 10-digit mobile number is required for Farmer registration."
            )
        identifier = payload.phone.strip()
    else:
        # Clerk registration
        emp_id = (payload.employee_id or "").strip()
        email = (payload.email or "").strip()
        if not emp_id and not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Official Email or Employee ID is required for Clerk registration."
            )
        identifier = emp_id if emp_id else email

    # Check for existing account
    existing = db.query(AuthUser).filter(
        (AuthUser.identifier == identifier) |
        (AuthUser.phone == payload.phone if payload.phone else False) |
        (AuthUser.email == payload.email if payload.email else False) |
        (AuthUser.employee_id == payload.employee_id if payload.employee_id else False)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with this { 'phone number' if req_role == 'farmer' else 'Employee ID / Email' } already exists. Please sign in instead."
        )

    # Password strength check
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # Secure Hash & Salt
    pwd_hash, salt = hash_password(payload.password)

    new_user = AuthUser(
        role=req_role,
        full_name=payload.full_name.strip(),
        identifier=identifier,
        phone=payload.phone.strip() if payload.phone else None,
        email=payload.email.strip() if payload.email else None,
        employee_id=payload.employee_id.strip() if payload.employee_id else None,
        password_hash=pwd_hash,
        salt=salt,
        region_location=payload.region_location.strip() if payload.region_location else None,
        farm_size=payload.farm_size,
        department_station=payload.department_station.strip() if payload.department_station else None,
        aadhaar=payload.aadhaar.strip() if payload.aadhaar else None,
        khasra_no=payload.khasra_no.strip() if payload.khasra_no else None,
        created_at=datetime.utcnow()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue JWT token
    token = create_jwt_token({
        "sub": new_user.identifier,
        "role": new_user.role,
        "id": new_user.id,
        "name": new_user.full_name
    })

    return AuthResponse(
        status="success",
        access_token=token,
        token_type="bearer",
        role=new_user.role,
        user=AuthUserResponse(
            id=new_user.id,
            role=new_user.role,
            full_name=new_user.full_name,
            identifier=new_user.identifier,
            phone=new_user.phone,
            email=new_user.email,
            employee_id=new_user.employee_id,
            region_location=new_user.region_location,
            farm_size=new_user.farm_size,
            department_station=new_user.department_station,
            aadhaar=new_user.aadhaar,
            khasra_no=new_user.khasra_no
        ),
        message=f"Registration successful! Welcome to MandiMitra, {new_user.full_name}."
    )


@app.post("/api/auth/login", response_model=AuthResponse, tags=["Authentication"])
def login_user(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    """
    Dual-role login endpoint for Farmer and Mandi Clerk.
    Verifies user credentials, role conformity, and returns a signed JWT token with user profile.
    """
    req_role = payload.role.strip().lower()
    ident = payload.identifier.strip()

    # Query matching user by role and either identifier, phone, employee_id, or email
    user = db.query(AuthUser).filter(
        AuthUser.role == req_role,
        (
            (AuthUser.identifier == ident) |
            (AuthUser.phone == ident) |
            (AuthUser.employee_id == ident) |
            (AuthUser.email == ident)
        )
    ).first()

    if not user or not verify_password(payload.password, user.password_hash, user.salt):
        role_label = "Farmer" if req_role == "farmer" else "Mandi Clerk"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {role_label} credentials. Please check your { 'Phone Number' if req_role == 'farmer' else 'Employee ID / Email' } and password."
        )

    # Issue JWT token
    token = create_jwt_token({
        "sub": user.identifier,
        "role": user.role,
        "id": user.id,
        "name": user.full_name
    })

    return AuthResponse(
        status="success",
        access_token=token,
        token_type="bearer",
        role=user.role,
        user=AuthUserResponse(
            id=user.id,
            role=user.role,
            full_name=user.full_name,
            identifier=user.identifier,
            phone=user.phone,
            email=user.email,
            employee_id=user.employee_id,
            region_location=user.region_location,
            farm_size=user.farm_size,
            department_station=user.department_station,
            aadhaar=user.aadhaar,
            khasra_no=user.khasra_no
        ),
        message=f"Welcome back, {user.full_name}!"
    )


@app.get("/api/auth/me", response_model=AuthUserResponse, tags=["Authentication"])
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """
    Validate session token and return the currently authenticated user's profile.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or invalid format (Bearer token required)."
        )

    token = authorization.split(" ")[1]
    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token expired or invalid signature. Please log in again."
        )

    user = db.query(AuthUser).filter(AuthUser.id == payload.get("id")).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account no longer exists."
        )

    return AuthUserResponse(
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        identifier=user.identifier,
        phone=user.phone,
        email=user.email,
        employee_id=user.employee_id,
        region_location=user.region_location,
        farm_size=user.farm_size,
        department_station=user.department_station,
        aadhaar=user.aadhaar,
        khasra_no=user.khasra_no
    )


@app.get("/mandi-centers", response_model=List[MandiCenterSchema], tags=["Mandi Centers"])
def list_mandi_centers(db: Session = Depends(get_db)):
    """List all procurement centers along with real-time capacity and Kanta connectivity status."""
    centers = db.query(MandiCenter).all()
    today_str = date.today().isoformat()
    
    result = []
    for c in centers:
        booked = db.query(func.coalesce(func.sum(SlotBooking.estimated_quintals), 0.0)).filter(
            SlotBooking.mandi_id == c.id,
            SlotBooking.booking_date == today_str,
            SlotBooking.status != "CANCELLED"
        ).scalar()
        
        schema = MandiCenterSchema(
            id=c.id,
            name=c.name,
            daily_capacity_quintals=c.daily_capacity_quintals,
            is_kanta_active=c.is_kanta_active,
            location=c.location,
            booked_quintals_today=float(booked)
        )
        result.append(schema)
    return result


@app.post("/book-slot", response_model=SlotResponse, status_code=status.HTTP_201_CREATED, tags=["Procurement Booking"])
def book_slot(request: SlotRequest, db: Session = Depends(get_db)):
    """
    Route 1: Dynamic Capacity Checking & Slot Booking.
    Before saving the booking, queries MandiCenter for daily_capacity_quintals.
    If the requested quintals exceed capacity, returns HTTP 400.
    Otherwise saves SlotBooking and returns success message with generated Token ID.
    """
    # 1. Verify Mandi Center exists
    mandi = db.query(MandiCenter).filter(MandiCenter.id == request.mandi_id).first()
    if not mandi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mandi Center with ID {request.mandi_id} not found."
        )

    # 2. Dynamic Capacity Checking
    current_booked = db.query(
        func.coalesce(func.sum(SlotBooking.estimated_quintals), 0.0)
    ).filter(
        SlotBooking.mandi_id == request.mandi_id,
        SlotBooking.booking_date == request.date,
        SlotBooking.status != "CANCELLED"
    ).scalar()

    total_projected = float(current_booked) + float(request.estimated_quintals)
    max_capacity = float(mandi.daily_capacity_quintals)

    if total_projected > max_capacity:
        remaining_capacity = max(0.0, max_capacity - float(current_booked))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Booking capacity exceeded for {mandi.name} on {request.date}. "
                f"Daily capacity: {max_capacity:.1f} Quintals. Already booked: {float(current_booked):.1f} Quintals. "
                f"Requested: {request.estimated_quintals:.1f} Quintals. Remaining: {remaining_capacity:.1f} Quintals."
            )
        )

    # 3. Generate unique Token ID (e.g. MM-2026-XXXX)
    random_suffix = uuid.uuid4().hex[:4].upper()
    token_id = f"MM-2026-{random_suffix}"

    # 4. Save new SlotBooking
    new_slot = SlotBooking(
        token_id=token_id,
        farmer_id=request.farmer_id,
        farmer_name=request.farmer_name or "Farmer",
        farmer_mobile=request.farmer_mobile,
        crop_type=request.crop_type or "Wheat",
        estimated_quintals=request.estimated_quintals,
        mandi_id=request.mandi_id,
        booking_date=request.date,
        status="SLOT_BOOKED",
        created_at=datetime.utcnow()
    )

    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    return SlotResponse(
        id=new_slot.id,
        token_id=new_slot.token_id,
        farmer_id=new_slot.farmer_id,
        farmer_name=new_slot.farmer_name,
        farmer_mobile=new_slot.farmer_mobile,
        crop_type=new_slot.crop_type,
        estimated_quintals=new_slot.estimated_quintals,
        mandi_id=new_slot.mandi_id,
        booking_date=new_slot.booking_date,
        status=new_slot.status,
        message=f"Slot confirmed successfully! Your Token ID is {new_slot.token_id}."
    )


@app.post("/iot/weigh-update", tags=["IoT Weighbridge"])
def iot_weigh_update(payload: IoTWeightUpdate, db: Session = Depends(get_db)):
    """
    Route 2: Hardware Weighbridge Sensor Integration.
    Receives token_id and weight_quintals from the physical Kanta sensor.
    Verifies dummy secret_key and updates the booking status to 'WEIGHED'.
    """
    # 1. Verify Secret Key for Hardware Authenticity
    if payload.secret_key != IOT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid IoT sensor secret key. Weighbridge hardware authentication failed."
        )

    # 2. Find Booking by Token ID
    booking = db.query(SlotBooking).filter(SlotBooking.token_id == payload.token_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slot booking with Token ID '{payload.token_id}' not found."
        )

    # 3. Update status to WEIGHED and record final weight
    booking.final_weight = payload.weight_quintals
    booking.status = "WEIGHED"
    booking.hold_reason = None
    db.commit()
    db.refresh(booking)

    return {
        "status": "success",
        "message": f"Weighbridge data processed for Token {booking.token_id}.",
        "token_id": booking.token_id,
        "farmer_name": booking.farmer_name,
        "crop_type": booking.crop_type,
        "recorded_weight_quintals": booking.final_weight,
        "updated_status": booking.status,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/analytics/summary", tags=["Analytics"])
def get_analytics_summary(db: Session = Depends(get_db)):
    """Summary analytics for dashboard widgets and monitors."""
    today_str = date.today().isoformat()
    total_slots = db.query(SlotBooking).filter(SlotBooking.booking_date == today_str).count()
    total_quintals = db.query(func.coalesce(func.sum(SlotBooking.estimated_quintals), 0.0)).filter(
        SlotBooking.booking_date == today_str,
        SlotBooking.status != "CANCELLED"
    ).scalar()
    weighed_slots = db.query(SlotBooking).filter(
        SlotBooking.booking_date == today_str,
        SlotBooking.status.in_(["WEIGHED", "PAYMENT_SENT"])
    ).count()
    on_hold_slots = db.query(SlotBooking).filter(
        SlotBooking.booking_date == today_str,
        SlotBooking.status == "ON_HOLD"
    ).count()
    active_mandi_count = db.query(MandiCenter).filter(MandiCenter.is_kanta_active == True).count()

    return {
        "status": "success",
        "date": today_str,
        "total_slots_today": total_slots,
        "total_quintals_allocated": float(total_quintals),
        "weighed_slots": weighed_slots,
        "on_hold_slots": on_hold_slots,
        "active_kantas": active_mandi_count,
        "average_wait_minutes": 14.5,
        "avg_moisture_percentage": 10.8,
        "dbt_success_rate": "99.4%"
    }


@app.get("/api/farmer/profile/{farmer_id}", tags=["Farmer Profile"])
def get_farmer_profile(farmer_id: str, db: Session = Depends(get_db)):
    """Retrieve farmer identity, verified land records, and booking history."""
    bookings = db.query(SlotBooking).filter(
        (SlotBooking.farmer_id == farmer_id) | (SlotBooking.id == (int(farmer_id) if farmer_id.isdigit() else -1))
    ).order_by(SlotBooking.id.desc()).all()

    return {
        "farmer_id": farmer_id,
        "name": "Rameshwar Prasad",
        "mobile": "+91 9876543210",
        "aadhaar": "XXXX-XXXX-8890",
        "khasra_no": "HR-KAR-2026-KH-492",
        "district": "Karnal",
        "state": "Haryana",
        "land_area_acres": 4.5,
        "registered_crop": "Wheat (Sharbati)",
        "total_bookings": len(bookings),
        "recent_bookings": [
            {
                "token_id": b.token_id,
                "crop": b.crop_type,
                "qty": b.estimated_quintals,
                "date": b.booking_date,
                "status": b.status,
                "final_weight": b.final_weight
            } for b in bookings[:5]
        ]
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    """Return 204 No Content for favicon requests to avoid 404 logs."""
    from fastapi import Response
    return Response(status_code=204)


@app.get("/slots/today", response_model=List[SlotResponse], tags=["Clerk Queue"])
def get_today_queue(mandi_id: Optional[int] = 1, db: Session = Depends(get_db)):
    """Fetch all farmer slots expected today for the Clerk Queue dashboard."""
    today_str = date.today().isoformat()
    query = db.query(SlotBooking).filter(SlotBooking.booking_date == today_str)
    if mandi_id:
        query = query.filter(SlotBooking.mandi_id == mandi_id)
    return query.order_by(SlotBooking.id.desc()).all()


@app.post("/slots/{token_id}/status", response_model=SlotResponse, tags=["Clerk Queue"])
def update_slot_status(token_id: str, payload: StatusUpdateRequest, db: Session = Depends(get_db)):
    """Allows Clerk to update queue status (e.g. Pass, Hold due to moisture, Check In)."""
    booking = db.query(SlotBooking).filter(SlotBooking.token_id == token_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slot with Token ID '{token_id}' not found."
        )

    booking.status = payload.status
    if payload.reason:
        booking.hold_reason = payload.reason
    elif payload.status != "ON_HOLD":
        booking.hold_reason = None

    db.commit()
    db.refresh(booking)
    return booking


@app.get("/slots/{token_id}", response_model=SlotResponse, tags=["Farmer Tracker"])
def get_slot_by_token(token_id: str, db: Session = Depends(get_db)):
    """Fetch live status of a slot booking for the Farmer Live Stepper Tracker."""
    booking = db.query(SlotBooking).filter(SlotBooking.token_id == token_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Token '{token_id}' not found."
        )
    return booking
