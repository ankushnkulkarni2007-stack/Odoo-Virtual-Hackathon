# Dayflow - Human Resource Management System

A complete HRMS: Express + MongoDB backend with a browser UI, covering
authentication, employee records, attendance, leave workflows and payroll.

## Quick start

```bash
npm install
cp .env.example .env     # set MONGO_URI (or leave the DB_* defaults)
npm run seed             # load sample data
npm start                # then open http://localhost:4000
```

The UI is served by the same Express app at `http://localhost:4000`, so there
is no separate frontend to run and no CORS to configure.

### Demo accounts

`npm run seed` creates 7 employees with 30 days of attendance, leave requests
in every state, and payroll records. All accounts use the password
**`Dayflow@123`**, and the login screen has one-click buttons for these three:

| Role | Email | Sees |
|---|---|---|
| Admin | rajesh@dayflow.com | Everything, including salary changes |
| HR | priya@dayflow.com | Everything except salary changes |
| Employee | aditi@dayflow.com | Only their own records |

`EMP-101` (Aditi) is left un-checked-in for the current day, so you can press
**Check in** during a walkthrough.

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with auto-reload |
| `npm run seed` | Wipe and reload sample data |
| `npm run test:models` | Schema rules — no database needed |
| `npm run test:api` | Full API flow against MongoDB (uses a `_test` database) |

## Project Structure

```
dayflow-project/
├── public/
│   └── index.html                    # The whole web UI (single file)
├── src/
│   ├── config/
│   │   └── database.js               # MongoDB connection
│   ├── models/                       # Mongoose schemas
│   │   ├── User.js                   # Login accounts, password hashing
│   │   ├── Employee.js               # HR records, leave balance
│   │   ├── Attendance.js             # One doc per employee per day
│   │   ├── Leave.js                  # Requests + approval decisions
│   │   ├── Payroll.js                # Versioned salary records
│   │   └── index.js                  # Barrel export
│   ├── middlewares/
│   │   ├── auth.js                   # JWT verify, role guards, ownership
│   │   └── handleValidation.js       # Validation error formatter
│   ├── validators/                   # express-validator rule sets
│   │   ├── authValidator.js
│   │   ├── employeeValidator.js
│   │   ├── attendanceValidator.js
│   │   ├── leaveValidator.js
│   │   ├── profileValidator.js
│   │   └── payrollValidator.js
│   ├── controllers/                  # Business logic, wired to the models
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── attendanceController.js
│   │   ├── leaveController.js
│   │   └── payrollController.js
│   ├── routes/                       # Endpoint definitions + guards
│   ├── utils/
│   │   ├── asyncHandler.js           # Forwards async errors to Express
│   │   └── ApiError.js               # Error with an HTTP status
│   ├── seed.js                       # Sample data
│   └── app.js                        # Express setup, static UI, error handler
├── server.js                         # Entry point
├── test-models.js                    # Schema tests (no DB)
├── test-api.js                       # Integration tests (needs MongoDB)
├── API_GUIDE.md                      # Relationships + permission model
└── README.md
```

Request flow:

```
Request → protect (JWT) → authorize (role) → validator → handleValidation → controller → model → MongoDB
```

## 📚 API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Employees (`/api/employees`)
- `POST /api/employees` - Create employee (Admin)
- `GET /api/employees` - Get all employees (Admin)
- `GET /api/employees/:id` - Get employee by ID
- `PATCH /api/employees/:id/self` - Update own profile (Employee)
- `PATCH /api/employees/:id/admin` - Update employee profile (Admin)

### Attendance (`/api/attendance`)
- `POST /api/attendance/check-in` - Employee check-in
- `POST /api/attendance/check-out` - Employee check-out
- `PUT /api/attendance/status` - Set attendance status (Admin/HR)
- `GET /api/attendance` - Get attendance records

### Leave (`/api/leave`)
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave` - Get leave requests
- `GET /api/leave/:id` - Get leave request by ID
- `PATCH /api/leave/:id/decision` - Approve/reject leave (Admin/HR)

### Payroll (`/api/payroll`)
- `GET /api/payroll` - Get payroll data
- `GET /api/payroll/:employeeId` - Get payroll by employee ID
- `PUT /api/payroll/:employeeId` - Update salary (Admin only)

## ✅ Validation Rules

### Authentication
- **Password**: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- **Email**: Valid email format
- **Employee ID**: Format like EMP-001 or EMP001
- **Role**: Only 'employee' or 'hr' at signup

### Employee
- **Name**: 2-50 characters, letters and spaces only
- **Phone**: 10-digit Indian format (6-9 first digit)
- **Date of Birth**: ISO format, employee must be 18+
- **Salary**: Positive number required

### Attendance
- **Check-in/Check-out**: HH:MM format (24-hour)
- **Check-out**: Must be after check-in time
- **Status**: present, absent, half-day, or leave

### Leave
- **Leave Type**: paid, sick, or unpaid
- **Start Date**: Cannot be in the past
- **End Date**: Must be ≥ start date
- **Remarks**: 5-300 characters

### Profile
- **Employee Updates**: Can only edit address, phone, profile picture
- **Admin Updates**: Can edit all fields (all optional)

### Payroll
- **Salary**: Positive number
- **Deductions**: Cannot exceed basic salary + allowances

## Usage examples

Every endpoint except register/login requires a Bearer token.

```bash
# 1. Log in and capture the token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aditi@dayflow.com","password":"Dayflow@123"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")

# 2. Check in
curl -X POST http://localhost:4000/api/attendance/check-in \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"employeeId":"EMP-101","date":"'$(date +%F)'","checkIn":"09:00"}'

# 3. Apply for leave
curl -X POST http://localhost:4000/api/leave/apply \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"employeeId":"EMP-101","leaveType":"sick","startDate":"2026-09-01",
       "endDate":"2026-09-03","remarks":"Medical appointment"}'
```

## Notes

- Validation runs **before** controllers, so invalid data never reaches the database.
- The models validate independently as a second line of defence — a bad write
  through any path is still rejected.
- Every failure returns the same `{ success, message, errors[] }` shape.
- Email sending is the one piece still stubbed: registration generates a
  verification token but does not mail it. Set `REQUIRE_EMAIL_VERIFICATION=true`
  in `.env` once SMTP is wired up.

See `API_GUIDE.md` for the User→Employee relationship and the full permission model.
