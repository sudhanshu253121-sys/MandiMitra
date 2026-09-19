from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class SlotRequest(BaseModel):
    farmer_id: str = Field(..., description="Farmer Aadhar or Unique Registration ID")
    farmer_name: Optional[str] = Field(default="Kisan Bhai", description="Farmer Full Name")
    farmer_mobile: Optional[str] = Field(default=None, description="10-digit mobile number")
    mandi_id: int = Field(..., description="Mandi Center ID")
    date: str = Field(..., description="Booking date format: YYYY-MM-DD", alias="booking_date")
    crop_type: Optional[str] = Field(default="Wheat", description="Crop variety (Wheat, Paddy, Mustard, etc.)")
    estimated_quintals: float = Field(..., gt=0, description="Estimated yield quantity in Quintals")

    class Config:
        populate_by_name = True

class IoTWeightUpdate(BaseModel):
    token_id: str = Field(..., description="Booking Token ID generated upon scheduling")
    weight_quintals: float = Field(..., gt=0, description="Gross weighbridge measurement in Quintals")
    secret_key: str = Field(..., description="Hardware sensor authentication secret")

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="New status (e.g. REACHED_CENTER, QUALITY_CHECK, ON_HOLD, WEIGHED, PAYMENT_SENT)")
    reason: Optional[str] = Field(default=None, description="Reason if put ON_HOLD or special remarks")

class MandiCenterSchema(BaseModel):
    id: int
    name: str
    daily_capacity_quintals: float
    is_kanta_active: bool
    location: Optional[str]
    booked_quintals_today: Optional[float] = 0.0

    class Config:
        from_attributes = True

class SlotResponse(BaseModel):
    id: int
    token_id: str
    farmer_id: str
    farmer_name: str
    farmer_mobile: Optional[str] = None
    crop_type: str
    estimated_quintals: float
    mandi_id: int
    booking_date: str
    status: str
    hold_reason: Optional[str] = None
    final_weight: Optional[float] = None
    created_at: Optional[datetime] = None
    message: Optional[str] = "Slot booked successfully"

    class Config:
        from_attributes = True


class AuthRegisterRequest(BaseModel):
    role: str = Field(..., description="'farmer' or 'clerk'")
    full_name: str = Field(..., min_length=2, description="Full legal name")
    password: str = Field(..., min_length=6, description="Account password")
    
    # Farmer specific fields
    phone: Optional[str] = Field(default=None, description="Mobile number for farmer (e.g. 9876543210)")
    region_location: Optional[str] = Field(default=None, description="Village, District or State")
    farm_size: Optional[float] = Field(default=None, description="Farm size in acres/hectares")
    aadhaar: Optional[str] = Field(default=None, description="Aadhaar number")
    khasra_no: Optional[str] = Field(default=None, description="Land record Khasra number")

    # Clerk specific fields
    email: Optional[str] = Field(default=None, description="Official APMC Email address")
    employee_id: Optional[str] = Field(default=None, description="Government or Mandi Employee ID")
    department_station: Optional[str] = Field(default=None, description="Mandi Yard / Station name")


class AuthLoginRequest(BaseModel):
    role: str = Field(..., description="'farmer' or 'clerk'")
    identifier: str = Field(..., description="Mobile number for farmer; Official Email or Employee ID for clerk")
    password: str = Field(..., description="Account password")


class AuthUserResponse(BaseModel):
    id: int
    role: str
    full_name: str
    identifier: str
    phone: Optional[str] = None
    email: Optional[str] = None
    employee_id: Optional[str] = None
    region_location: Optional[str] = None
    farm_size: Optional[float] = None
    department_station: Optional[str] = None
    aadhaar: Optional[str] = None
    khasra_no: Optional[str] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    role: str
    user: AuthUserResponse
    message: str
