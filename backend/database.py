import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Configurable Database URL.
# Defaults to PostgreSQL, with graceful fallback to SQLite for immediate local evaluation.
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mandimitra")

try:
    # Attempt to test PostgreSQL connection if explicitly specified or configured
    if "sqlite" not in POSTGRES_URL:
        engine = create_engine(POSTGRES_URL, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            pass
    else:
        engine = create_engine(POSTGRES_URL, connect_args={"check_same_thread": False})
except Exception:
    # Graceful fallback to SQLite so developers can run immediately without configuring Postgres service
    FALLBACK_SQLITE_URL = "sqlite:///./mandimitra.db"
    print(f"[Database] PostgreSQL connection failed or unconfigured. Falling back to SQLite: {FALLBACK_SQLITE_URL}")
    engine = create_engine(FALLBACK_SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
