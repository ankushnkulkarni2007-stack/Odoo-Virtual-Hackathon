# Dayflow API — Controllers Wired to Models

## The User → Employee relationship

Two collections, linked by `employeeId`:

```
User (login)                     Employee (HR record)
├── employeeId: "EMP-101"  ◄────►├── employeeId: "EMP-101"
├── email, password (hashed)     ├── user: ObjectId → User._id
├── role: employee | hr | admin  ├── firstName, lastName, phone, address
└── isEmailVerified              ├── dateOfBirth, dateOfJoining
                                 ├── department, designation
                                 └── leaveBalance: { paid, sick }
```

**How `Employee.user` gets set — the two-step onboarding:**

1. The person signs up (`POST /api/auth/register`) with their employee ID → a **User** is created. They can log in, but have no HR record yet (`hasEmployeeRecord: false` in the login response).
2. Admin/HR creates their record (`POST /api/employees`) with the same employee ID → the controller looks up the User by `employeeId` and sets `user: account._id` itself.

`user` is **never accepted from the request body**. If a client could pass an arbitrary ObjectId, it could attach an HR record to someone else's login account. If no matching account exists, the request fails with a clear 404 rather than creating an orphan record nobody can log into.

Salary passed at creation becomes the employee's first **Payroll** record, so salary history starts on day one.

## Auth

Login returns a JWT. Send it on every other request:

```
Authorization: Bearer <token>
```

`protect` re-reads the user from the database on each request rather than trusting the token payload, so a deactivated account or role change takes effect immediately.

## Permission model

| | Employee | Admin / HR |
|---|---|---|
| Employee list | ✗ | ✓ |
| View profile | own only | anyone |
| Edit profile | address, phone, photo | all fields |
| Attendance | own records | everyone's |
| Set attendance status | ✗ | ✓ |
| Apply for leave | own | own |
| Approve/reject leave | ✗ | ✓ |
| View payroll | own (read-only) | everyone's + history |
| Change salary | ✗ | **admin only** |

`resolveEmployee()` in `middlewares/auth.js` is the single place that answers "may this caller touch this employee?" — attendance, leave, and payroll all enforce it identically. An employee who names someone else's ID is refused with 403, not silently redirected.

Salary writes are admin-only per spec 3.6.2. To let HR change salaries too, add `'hr'` to the `authorize()` call in `routes/payroll.js`.

## Endpoints

**Auth** — `POST /register`, `POST /login`, `GET /verify-email/:token`, `GET /me`

**Employees** — `POST /`, `GET /` (paginated; `?department=`, `?status=`, `?search=`), `GET /:id`, `PATCH /:id/self`, `PATCH /:id/admin`

`:id` accepts either a Mongo ObjectId or an employee ID like `EMP-101`.

**Attendance** — `POST /check-in`, `POST /check-out`, `PUT /status`, `GET /` (`?startDate=`, `?endDate=`, `?employeeId=`, `?status=`)

Returns a summary of present/absent/half-day/leave counts and total hours across the whole filtered range, not just the current page.

**Leave** — `POST /apply`, `GET /`, `GET /:id`, `PATCH /:id/decision`

**Payroll** — `GET /`, `GET /:employeeId`, `PUT /:employeeId`

## Business rules enforced in controllers

- **Double check-in** blocked; check-out requires an existing check-in.
- **Working hours** computed by the model; under 4 hours auto-reclassifies to half-day.
- **Overlapping leave** rejected via `Leave.hasOverlap()`.
- **Leave balance** checked at apply *and* again at approval (it may have changed in between). Unpaid leave doesn't draw on a balance.
- **Approving leave** deducts the balance *and* writes `status: 'leave'` onto each covered attendance day — spec 3.5.2's "changes reflect immediately in employee records". These run in a transaction on a replica set, with a sequential fallback on standalone mongod.
- **Deciding twice** is rejected with 409.
- **Salary changes** create a new Payroll record and retire the previous one, preserving history.

## Error format

Every failure — validator, Mongoose, or thrown `ApiError` — returns the same shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "checkOut", "message": "Check-out time must be after check-in time" }]
}
```

## Running the tests

```bash
npm run test:models   # schema rules, no database needed
npm run test:api      # full flow against MongoDB
```

`test:api` appends `_test` to your database name and drops it before and after, so your dev data is untouched.
