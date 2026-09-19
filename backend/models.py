from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class MandiCenter(Base):
    __tablename__ = "mandi_centers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    daily_capacity_quintals = Column(Float, nullable=False, default=500.0)
    is_kanta_active = Column(Boolean, default=True)  # Hardware weighbridge connectivity
    location = Column(String(100), default="Sector 4 APMC Mandi")

    # Relationship to booked slots
    bookings = relationship("SlotBooking", back_populates="mandi_center", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MandiCenter(id={self.id}, name='{self.name}', capacity={self.daily_capacity_quintals} Qtl)>"


class SlotBooking(Base):
    __tablename__ = "slot_bookings"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String(50), unique=True, index=True, nullable=False)
    farmer_id = Column(String(50), nullable=False, index=True)
    farmer_name = Column(String(100), nullable=False, default="Farmer")
    farmer_mobile = Column(String(15), nullable=True)
    crop_type = Column(String(50), nullable=False, default="Wheat")
    estimated_quintals = Column(Float, nullable=False, default=20.0)
    mandi_id = Column(Integer, ForeignKey("mandi_centers.id"), nullable=False)
    booking_date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    status = Column(
        String(30), 
        nullable=False, 
        default="SLOT_BOOKED"
    )  # Stages: SLOT_BOOKED, REACHED_CENTER, QUALITY_CHECK, ON_HOLD, WEIGHED, PAYMENT_SENT
    hold_reason = Column(String(255), nullable=True)
    final_weight = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to Mandi Center
    mandi_center = relationship("MandiCenter", back_populates="bookings")

    def __repr__(self):
        return f"<SlotBooking(token={self.token_id}, farmer={self.farmer_name}, status={self.status}, qty={self.estimated_quintals})>"


class AuthUser(Base):
    __tablename__ = "auth_users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False, index=True)  # 'farmer' or 'clerk'
    full_name = Column(String(100), nullable=False)
    identifier = Column(String(100), unique=True, index=True, nullable=False)  # Phone for farmer, email/emp_id for clerk
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    employee_id = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    region_location = Column(String(100), nullable=True)
    farm_size = Column(Float, nullable=True)
    department_station = Column(String(100), nullable=True)
    aadhaar = Column(String(20), nullable=True)
    khasra_no = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<AuthUser(id={self.id}, name='{self.full_name}', role='{self.role}', identifier='{self.identifier}')>"
