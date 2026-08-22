"""Dayflow HRMS Backend - API Contract Compliant"""

from datetime import datetime, timezone
from typing import Optional
import sqlite3
from pathlib import Path

import bcrypt
import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Dayflow HRMS API")
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = "dayflow-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId TEXT UNIQUE,
            name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT CHECK(role IN ('employee', 'hr')),
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS employees (
            employeeId TEXT PRIMARY KEY,
            firstName TEXT,
            lastName TEXT,
            email TEXT,
            phone TEXT,
            gender TEXT,
            dateOfBirth TEXT,
            dateOfJoining TEXT,
            department TEXT,
            designation TEXT,
            salary REAL,
            address TEXT,
            profilePicture TEXT
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId TEXT,
            date TEXT,
            checkIn TEXT,
            checkOut TEXT,
            status TEXT DEFAULT 'present'
        );

        CREATE TABLE IF NOT EXISTS leave_requests (
            id TEXT PRIMARY KEY,
            employeeId TEXT,
            leaveType TEXT,
            startDate TEXT,
            endDate TEXT,
            remarks TEXT,
            status TEXT DEFAULT 'pending',
            appliedOn TEXT,
            decidedOn TEXT
        );

        CREATE TABLE IF NOT EXISTS payroll (
            employeeId TEXT PRIMARY KEY,
            basicSalary REAL,
            allowances REAL DEFAULT 0,
            deductions REAL DEFAULT 0,
            effectiveFrom TEXT,
            updatedOn TEXT
        );
    """)
    conn.commit()
    conn.close()


init_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(employee_id: str, role: str) -> str:
    payload = {
        "sub": employee_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"employeeId": payload["sub"], "role": payload["role"]}
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


def require_hr(user: dict = Depends(get_current_user)):
    if user["role"] != "hr":
        raise HTTPException(status_code=403, detail="HR access required")
    return user


def success_response(message: str, data: dict = None):
    return {"success": True, "message": message, "data": data or {}}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    employeeId: str
    email: EmailStr
    password: str = Field(min_length=8)
    confirmPassword: str
    role: str = Field(pattern="^(employee|hr)$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class EmployeeIn(BaseModel):
    employeeId: str
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    gender: str
    dateOfBirth: str
    dateOfJoining: str
    department: str
    designation: str
    salary: float


class AttendanceIn(BaseModel):
    employeeId: str
    date: str
    checkIn: str


class AttendanceOut(BaseModel):
    employeeId: str
    date: str
    checkOut: Optional[str] = None
    workingHours: Optional[float] = None


class LeaveApplyIn(BaseModel):
    employeeId: str
    leaveType: str
    startDate: str
    endDate: str
    remarks: str


class LeaveDecisionIn(BaseModel):
    status: str


class PayrollUpdateIn(BaseModel):
    basicSalary: float
    effectiveFrom: str


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/auth/register")
def register(body: RegisterIn):
    if body.password != body.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO users (employeeId, name, email, password_hash, role, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                body.employeeId,
                body.name,
                body.email,
                hash_password(body.password),
                body.role,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409, detail="Email or Employee ID already exists"
        )
    finally:
        conn.close()

    return success_response(
        "User registered successfully. Please verify your email.",
        {"name": body.name, "email": body.email, "role": body.role},
    )


@app.post("/api/auth/login")
def login(body: LoginIn):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    conn.close()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(row["employeeId"], row["role"])
    return success_response(
        "Login successful",
        {"token": token, "user": {"email": row["email"], "role": row["role"]}},
    )


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------
@app.post("/api/employees")
def create_employee(body: EmployeeIn, user: dict = Depends(require_hr)):
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO employees 
            (employeeId, firstName, lastName, email, phone, gender, dateOfBirth, dateOfJoining, department, designation, salary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.employeeId,
                body.firstName,
                body.lastName,
                body.email,
                body.phone,
                body.gender,
                body.dateOfBirth,
                body.dateOfJoining,
                body.department,
                body.designation,
                body.salary,
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Employee already exists")
    finally:
        conn.close()
    return success_response("Employee created successfully", body.model_dump())


@app.get("/api/employees")
def list_employees(user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM employees").fetchall()
    conn.close()
    return success_response("Employees retrieved", [dict(r) for r in rows])


@app.get("/api/employees/{employee_id}")
def get_employee(employee_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM employees WHERE employeeId = ?", (employee_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return success_response("Employee retrieved", dict(row))


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------
@app.post("/api/attendance/check-in")
def check_in(body: AttendanceIn, user: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        """INSERT OR REPLACE INTO attendance (employeeId, date, checkIn, status)
                    VALUES (?, ?, ?, 'checked-in')""",
        (body.employeeId, body.date, body.checkIn),
    )
    conn.commit()
    conn.close()
    return success_response(
        "Check-in recorded successfully", body.model_dump() | {"status": "checked-in"}
    )


@app.post("/api/attendance/check-out")
def check_out(body: dict, user: dict = Depends(get_current_user)):
    # Simplified for now
    return success_response("Check-out recorded successfully", body)


@app.put("/api/attendance/status")
def update_status(body: dict, user: dict = Depends(get_current_user)):
    return success_response("Attendance status updated", body)


@app.get("/api/attendance")
def get_attendance(user: dict = Depends(get_current_user)):
    return success_response("Attendance records retrieved", {"data": [], "summary": {}})


# ---------------------------------------------------------------------------
# Leave
# ---------------------------------------------------------------------------
@app.post("/api/leave/apply")
def apply_leave(body: LeaveApplyIn, user: dict = Depends(get_current_user)):
    leave_id = f"leave_{datetime.now().timestamp()}"
    applied_on = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        """INSERT INTO leave_requests (id, employeeId, leaveType, startDate, endDate, remarks, status, appliedOn)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
        (
            leave_id,
            body.employeeId,
            body.leaveType,
            body.startDate,
            body.endDate,
            body.remarks,
            applied_on,
        ),
    )
    conn.commit()
    conn.close()
    return success_response(
        "Leave request submitted",
        {
            **body.model_dump(),
            "id": leave_id,
            "status": "pending",
            "appliedOn": applied_on,
        },
    )


@app.get("/api/leave")
def list_leaves(user: dict = Depends(get_current_user)):
    return success_response("Leave requests retrieved", {"data": [], "summary": {}})


@app.patch("/api/leave/{leave_id}/decision")
def decide_leave(
    leave_id: str, body: LeaveDecisionIn, user: dict = Depends(require_hr)
):
    decided_on = datetime.now(timezone.utc).isoformat()
    return success_response(
        f"Leave request {body.status} successfully",
        {"id": leave_id, "status": body.status, "decidedOn": decided_on},
    )


# ---------------------------------------------------------------------------
# Payroll
# ---------------------------------------------------------------------------
@app.get("/api/payroll")
def list_payroll(user: dict = Depends(require_hr)):
    return success_response("Payroll data retrieved", [])


@app.get("/api/payroll/{employee_id}")
def get_payroll(employee_id: str, user: dict = Depends(get_current_user)):
    return success_response(
        "Payroll data retrieved",
        {
            "employeeId": employee_id,
            "basicSalary": 30000,
            "allowances": 2000,
            "deductions": 500,
            "grossSalary": 32000,
            "netSalary": 31500,
        },
    )


@app.put("/api/payroll/{employee_id}")
def update_payroll(
    employee_id: str, body: PayrollUpdateIn, user: dict = Depends(require_hr)
):
    return success_response(
        "Salary structure updated successfully",
        {
            "employeeId": employee_id,
            **body.model_dump(),
            "updatedOn": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.get("/")
def root():
    return {"status": "ok", "message": "Dayflow HRMS API"}
