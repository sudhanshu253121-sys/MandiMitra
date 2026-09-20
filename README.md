# MandiMitra (मंडी मित्र) 🌾

> **An Intelligent Agricultural Procurement Scheduling & IoT Weighbridge Integration Platform**
> Developed for the Smart India Hackathon (SIH) e-Governance & Agriculture Track.

---

## 🌟 Overview

**MandiMitra** modernizes the traditional Agricultural Produce Market Committee (APMC) grain procurement system. Long, multi-day physical queues at mandi gates result in grain moisture loss, distress sales, and bottlenecked weighbridges. 

MandiMitra solves this by providing:
1. **Dynamic Slot Scheduling:** Farmers book scheduled delivery windows based on real-time APMC daily capacity.
2. **End-to-End Live Stepper:** Transparency from gate arrival, moisture testing, and automated weighbridge logging to Direct Benefit Transfer (DBT) payment release.
3. **IoT Weighbridge Integration:** Direct telemetry from weighbridge sensors ("Kanta") eliminates human tampering.
4. **Mandi Clerk Control Desk:** Authorize passes, place defective/high-moisture produce on hold, and monitor live throughput.
5. **Kisan Sahayak (AI Bot Assist):** Instant guidance for Minimum Support Prices (MSP), moisture thresholds, and land documentation.

---

## 🎨 Technology Stack

### 1. Frontend (Mobile-First Prototype)
- **Structure:** Semantic HTML5 with accessible tags and clean single-page section routing.
- **Styling:** Custom Vanilla CSS with a curated palette of **Deep Forest Green** (`#1B4332`), **Executive Navy Blue** (`#0F1E36`), and **Soft Ivory/White** (`#FFFFFF`), featuring glassmorphism, micro-animations, and fluid responsive grids.
- **Interactivity:** Vanilla JavaScript (ES6+) with zero external frontend runtime dependencies. Handles interactive calendar slot picking, stepper state machine, clerk queue table actions, and offline-resilient API communication.

### 2. Backend (REST API)
- **Framework:** Python FastAPI (`fastapi`, `uvicorn`).
- **ORM & Database:** SQLAlchemy with declarative models.
  - Configured for **PostgreSQL** (`postgresql://postgres:postgres@localhost:5432/mandimitra`).
  - Automatically falls back to **SQLite** (`sqlite:///./mandimitra.db`) if PostgreSQL is unconfigured, allowing instant zero-setup execution.
- **Data Validation:** Pydantic v2 schemas (`SlotRequest`, `IoTWeightUpdate`, etc.).
- **Security & IoT:** CORS enabled for all origins; Hardware authentication key check for weighbridge telemetry.

---

## 📁 Project Architecture

```
d:\Collage\SIH\
├── backend\
│   ├── __init__.py
│   ├── database.py         # SQLAlchemy engine, session maker & PostgreSQL/SQLite support
│   ├── models.py           # MandiCenter & SlotBooking ORM models
│   ├── schemas.py          # Pydantic validation schemas
│   ├── main.py             # FastAPI endpoints (capacity checks, IoT updates, static serving)
│   ├── requirements.txt    # Python dependencies
│   └── test_api.py         # Automated API test suite
├── frontend\
│   ├── index.html          # Single-Page UI with 3 distinct view sections & modals
│   ├── styles.css          # Design system, stepper, calendar & mobile-first styling
│   └── app.js              # SPA router, calendar picker, stepper manager, API bridge
├── start_mandimitra.bat    # 1-Click launcher for Windows
└── README.md               # Project documentation
```

---

## 🚀 Quick Start Guide

### Step 1: Install Python Dependencies
Open PowerShell or Command Prompt in the project folder:
```powershell
pip install -r backend/requirements.txt
```

### Step 2: Launch Backend & Frontend
You can double-click `start_mandimitra.bat`, or run manually:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Then visit the application in any browser:
- **Web Application:** [http://127.0.0.1:8000/frontend/index.html](http://127.0.0.1:8000/frontend/index.html) (or simply [http://127.0.0.1:8000/portal](http://127.0.0.1:8000/portal))
- **Interactive Swagger API Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

> **Note:** The frontend can also be opened standalone directly via `file:///d:/Collage/SIH/frontend/index.html`. It automatically detects server availability and falls back to a simulated mode if the server is stopped.

---

## 🖥️ The 3 Core Views

### Page 1: Auth & Registration View (`#view-auth`)
- **Split-Screen Design:** Left side presents the government mission, APMC statistics, and benefits; right side houses clean authentication cards.
- **Role Toggle:** Seamlessly toggle between **Farmer (किसान)** and **Mandi Clerk**.
- **Farmer Registration Form:** Captures Full Name, 10-digit Mobile, 12-digit Aadhaar Number, and State Land Record ID (Khasra No.). Includes a drag-and-drop document upload and legal e-NAM declaration consent.
- **Clerk Auth Form:** Login with Employee ID, Password, and Mandi Center assignment.

### Page 2: Farmer Dashboard (`#view-farmer`)
- **Live Tracker Section:** Horizontal visual stepper showing:
  $$\text{Slot Booked} \longrightarrow \text{Reached Center} \longrightarrow \text{Quality Check} \longrightarrow \text{Weighed (कांटा)} \longrightarrow \text{Payment Sent}$$
  Features animated radar pulses on the active step, timestamps, and an e-Procurement digital slip viewer.
- **Slot Booking Section:**
  - Crop Variety selector (Wheat, Paddy, Mustard, Gram, Soybean) with live estimated MSP settlement calculator.
  - **Dynamic Capacity Alert Banner:** Real-time quota utilization bar for the selected Mandi center.
  - **Custom Interactive Calendar UI:** Color-coded dates:
    - 🟢 **Green:** Available slots (guaranteed entry within 20 mins).
    - 🟡 **Amber:** Fast-filling (70–95% capacity utilized).
    - 🔴 **Red:** Full (daily capacity ceiling reached; booking disabled).
  - Generates a unique Token ID (e.g., `MM-2026-8812`) upon confirmation.

### Page 3: Clerk Dashboard (`#view-clerk`)
- **Stats Grid:** Real-time KPI summary cards:
  - *Total Slots Today*
  - *Checked-in Farmers*
  - *On Hold (Moisture/Doc review)*
  - *Total Metric Tons Weighed*
- **Queue Table:** Live list of expected farmers today with columns: Token ID, Name & Phone, Crop, Quantity, Status tag, and Remarks.
- **Action Controls:**
  - **Pass Button:** Moves produce to the next processing stage.
  - **Hold Button:** Triggers inspection modal to flag produce with high moisture (> 12.0%) or documentation issues.
  - **IoT Weighbridge Test Button:** Simulates a live hardware weighbridge sensor pinging the backend.

### 🤖 Kisan Sahayak (Bot Assist Modal)
- Accessible anytime from the top navigation.
- Provides immediate answers in Hindi & English for 2026 MSP rates, moisture limits, required Khasra documents, and IoT weighbridge telemetry.

---

## 📡 API Reference

### 1. `POST /book-slot`
Books an agricultural procurement delivery slot with dynamic capacity enforcement.

**Request Body:**
```json
{
  "farmer_id": "IND-AADH-9021",
  "farmer_name": "Rameshwar Prasad",
  "farmer_mobile": "9876543210",
  "mandi_id": 1,
  "booking_date": "2026-09-16",
  "crop_type": "Wheat (Sharbati)",
  "estimated_quintals": 45.0
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "token_id": "MM-2026-8812",
  "farmer_id": "IND-AADH-9021",
  "farmer_name": "Rameshwar Prasad",
  "farmer_mobile": "9876543210",
  "crop_type": "Wheat (Sharbati)",
  "estimated_quintals": 45.0,
  "mandi_id": 1,
  "booking_date": "2026-09-16",
  "status": "SLOT_BOOKED",
  "message": "Slot confirmed successfully! Your Token ID is MM-2026-8812."
}
```

*If total booked quintals exceed `daily_capacity_quintals`, returns `HTTP 400 Bad Request` with exact remaining quota details.*

---

### 2. `POST /iot/weigh-update`
Receives physical weighbridge sensor measurements.

**Request Body:**
```json
{
  "token_id": "MM-2026-8812",
  "weight_quintals": 46.2,
  "secret_key": "KANTA_SECRET_2026"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Weighbridge data processed for Token MM-2026-8812.",
  "token_id": "MM-2026-8812",
  "farmer_name": "Rameshwar Prasad",
  "crop_type": "Wheat (Sharbati)",
  "recorded_weight_quintals": 46.2,
  "updated_status": "WEIGHED",
  "timestamp": "2026-09-16T10:24:35.572816"
}
```

---

### 3. Additional Endpoints
- `GET /mandi-centers`: Returns centers, capacity limits, and Kanta connectivity.
- `GET /slots/today?mandi_id=1`: Returns today's queue for the clerk table.
- `POST /slots/{token_id}/status`: Advances status or applies a hold reason.
- `GET /slots/{token_id}`: Fetches real-time status for the Farmer Live Stepper.

---

## 🧪 Automated Testing

Run the automated test suite verifying all API routes:
```powershell
python -m backend.test_api
```
All tests validate:
- Mandi Center querying
- Dynamic capacity booking (valid)
- Rejection of over-capacity requests (`HTTP 400`)
- IoT sensor authentication & status progression
- Queue retrieval for APMC clerks
#   M a n d i M i t r a  
 