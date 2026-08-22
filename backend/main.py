"""
Dayflow HRMS - Backend API
FastAPI + SQLite (stdlib sqlite3, no ORM)

Milestone 1: database schema, JWT authentication, profile CRUD.
"""

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# 1. APP CONFIG
# ---------------------------------------------------------------------------
app = FastAPI(title="Dayflow HRMS API")

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"

# TODO: set DAYFLOW_JWT_SECRET as an env var before any real deployment.
JWT_SECRET = os.getenv("DAYFLOW_JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; lock down for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# 2. DATABASE
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee'
        CHECK (role IN ('admin', 'hr_officer', 'employee')),
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    department TEXT,
    job_title TEXT,
    hire_date TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT NOT NULL DEFAULT 'present'
        CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
    UNIQUE (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    basic_salary REAL NOT NULL DEFAULT 0,
    allowances REAL NOT NULL DEFAULT 0,
    deductions REAL NOT NULL DEFAULT 0,
    net_salary REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'paid')),
    created_at TEXT NOT NULL,
    UNIQUE (user_id, month),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
    ON attendance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_user
    ON leave_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status
    ON leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_payroll_user_month
    ON payroll (user_id, month);
"""


def get_db_connection() -> sqlite3.Connection:
    """Open a fresh SQLite connection with foreign keys enforced."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create all Dayflow tables and indexes if they do not exist."""
    conn = get_db_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


init_db()


def utcnow_iso() -> str:
    """Current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# 3. PASSWORD HASHING
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# 4. JWT TOKENS
# ---------------------------------------------------------------------------
def create_access_token(user_id: int, role: str) -> str:
    """Build a signed JWT carrying the user id and role."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> sqlite3.Row:
    """Decode the bearer token and load the matching user row."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None

    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (int(payload["sub"]),),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return row


def require_admin(
    current_user: sqlite3.Row = Depends(get_current_user),
) -> sqlite3.Row:
    """Allow only admin / HR officer accounts through."""
    if current_user["role"] not in ("admin", "hr_officer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ---------------------------------------------------------------------------
# 5. MODELS
# ---------------------------------------------------------------------------
class SignUpIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    # TODO: remove client-supplied role before production.
    role: str = Field(default="employee")


class SignInIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[str] = None
    created_at: str


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)
    department: Optional[str] = Field(default=None, max_length=100)
    job_title: Optional[str] = Field(default=None, max_length=100)
    hire_date: Optional[str] = Field(default=None, max_length=10)


PROFILE_FIELDS = (
    "first_name",
    "last_name",
    "phone",
    "department",
    "job_title",
    "hire_date",
)


def row_to_user(row: sqlite3.Row) -> dict:
    """Convert a users row into a safe public dict (no password hash)."""
    data = dict(row)
    data.pop("password_hash", None)
    return data


# ---------------------------------------------------------------------------
# 6. HEALTH CHECK
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Dayflow HRMS backend is running."}


# ---------------------------------------------------------------------------
# 7. AUTH ENDPOINTS
# ---------------------------------------------------------------------------
@app.post("/api/auth/signup", response_model=AuthOut, status_code=201)
def signup(payload: SignUpIn):
    if payload.role not in ("admin", "employee"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be 'admin' or 'employee'",
        )

    email = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO users (
                email, password_hash, role,
                first_name, last_name, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                email,
                hash_password(payload.password),
                payload.role,
                payload.first_name.strip(),
                payload.last_name.strip(),
                utcnow_iso(),
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (new_id,),
        ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        ) from None
    finally:
        conn.close()

    return {
        "access_token": create_access_token(row["id"], row["role"]),
        "token_type": "bearer",
        "user": row_to_user(row),
    }


@app.post("/api/auth/signin", response_model=AuthOut)
def signin(payload: SignInIn):
    email = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    finally:
        conn.close()

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return {
        "access_token": create_access_token(row["id"], row["role"]),
        "token_type": "bearer",
        "user": row_to_user(row),
    }


# ---------------------------------------------------------------------------
# 8. PROFILE ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/api/profile", response_model=UserOut)
def get_profile(current_user: sqlite3.Row = Depends(get_current_user)):
    return row_to_user(current_user)


@app.put("/api/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    current_user: sqlite3.Row = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)
    updates = {k: v for k, v in updates.items() if k in PROFILE_FIELDS}

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided",
        )

    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [current_user["id"]]

    conn = get_db_connection()
    try:
        conn.execute(
            f"UPDATE users SET {assignments} WHERE id = ?",
            values,
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
    finally:
        conn.close()

    return row_to_user(row)
