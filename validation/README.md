# Dayflow - Human Resource Management System

A comprehensive HRMS backend built with Node.js and Express, featuring complete validation for employee management, attendance tracking, leave management, and payroll operations.

## 📋 Project Structure

```
dayflow-project/
├── src/
│   ├── middlewares/
│   │   └── handleValidation.js       # Validation error handler
│   ├── validators/
│   │   ├── authValidator.js          # Auth validation rules
│   │   ├── employeeValidator.js      # Employee validation rules
│   │   ├── attendanceValidator.js    # Attendance validation rules
│   │   ├── leaveValidator.js         # Leave validation rules
│   │   ├── profileValidator.js       # Profile validation rules
│   │   └── payrollValidator.js       # Payroll validation rules
│   ├── routes/
│   │   ├── auth.js                   # Auth routes (register, login)
│   │   ├── employees.js              # Employee CRUD routes
│   │   ├── attendance.js             # Attendance routes
│   │   ├── leave.js                  # Leave request routes
│   │   └── payroll.js                # Payroll routes
│   ├── controllers/
│   │   ├── authController.js         # Auth business logic
│   │   ├── employeeController.js     # Employee business logic
│   │   ├── attendanceController.js   # Attendance business logic
│   │   ├── leaveController.js        # Leave business logic
│   │   └── payrollController.js      # Payroll business logic
│   ├── models/
│   │   └── (your database models here)
│   └── app.js                        # Express app setup
├── server.js                         # Entry point
├── package.json
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Code editor (VS Code recommended)

### Installation

1. **Clone the repository** (or create the folder structure as shown above)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your configuration

4. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:4000`

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

## 🔧 Usage Example

### Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "employeeId": "EMP-101",
    "email": "john@company.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!",
    "role": "employee"
  }'
```

### Apply for Leave
```bash
curl -X POST http://localhost:4000/api/leave/apply \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-101",
    "leaveType": "sick",
    "startDate": "2026-09-01",
    "endDate": "2026-09-03",
    "remarks": "Medical appointment"
  }'
```

### Check-in
```bash
curl -X POST http://localhost:4000/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-101",
    "date": "2026-08-22",
    "checkIn": "09:00"
  }'
```

## 💡 Next Steps

1. **Database Integration**: Connect MongoDB or PostgreSQL to the database models
2. **Authentication**: Implement JWT token generation and verification
3. **Error Handling**: Add custom error handling for business logic errors
4. **Email Notifications**: Set up email service for notifications
5. **Testing**: Add unit and integration tests
6. **API Documentation**: Generate Swagger/OpenAPI documentation

## 📝 Notes

- All validators are independent and reusable
- The `handleValidation` middleware catches all validation errors
- Controllers contain placeholder TODO comments for business logic
- All endpoints return consistent JSON responses with `success` flag
- Validation happens **before** controllers to ensure data integrity

## 🤝 Team Collaboration

- **Validations** (your part): ✅ Complete in `src/validators/`
- **Routes**: Set up in `src/routes/`
- **Controllers**: Business logic implementation in `src/controllers/`
- **Models**: Database models in `src/models/`
- **Middleware**: Authentication, logging in `src/middlewares/`

## 📄 License

ISC

---

**Happy Coding! 🎉**
