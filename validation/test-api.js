/**
 * End-to-end integration test against a REAL MongoDB.
 *
 *   node test-api.js
 *
 * Uses the MONGO_URI / DB_* values from your .env but appends "_test" to the
 * database name, so your development data is never touched. The test database
 * is dropped at the start of each run.
 */
require('dotenv').config();

const mongoose = require('mongoose');

// Point at a throwaway database BEFORE anything reads the config
const baseName = process.env.DB_NAME || 'dayflow';
process.env.DB_NAME = `${baseName}_test`;
if (process.env.MONGO_URI) {
  process.env.MONGO_URI = process.env.MONGO_URI.replace(/\/([^/?]+)(\?|$)/, `/${baseName}_test$2`);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';

const app = require('./src/app');
const connectDB = require('./src/config/database');
const { User, Employee, Attendance, Leave, Payroll } = require('./src/models');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
    fail++;
  }
}

let baseUrl;
let server;

async function api(method, path, { body, token } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

const get = (p, o) => api('GET', p, o);
const post = (p, b, o) => api('POST', p, { body: b, ...o });
const patch = (p, b, o) => api('PATCH', p, { body: b, ...o });
const put = (p, b, o) => api('PUT', p, { body: b, ...o });

(async () => {
  await connectDB();
  await mongoose.connection.dropDatabase();
  console.log(`Using test database: ${mongoose.connection.name}\n`);

  // Indexes are what enforce uniqueness — build them before testing those rules
  await Promise.all(
    [User, Employee, Attendance, Leave, Payroll].map((m) => m.init())
  );

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://localhost:${server.address().port}`;

  // ─────────────────────────────────────────────── Auth
  console.log('--- Registration & login ---');

  const hrSignup = await post('/api/auth/register', {
    name: 'Priya Sharma', employeeId: 'HR-001', email: 'priya@company.com',
    password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', role: 'hr',
  });
  check('HR registers', hrSignup.status === 201, JSON.stringify(hrSignup.body));

  const empSignup = await post('/api/auth/register', {
    name: 'Aditi Rao', employeeId: 'EMP-101', email: 'aditi@company.com',
    password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', role: 'employee',
  });
  check('Employee registers', empSignup.status === 201);

  const dupe = await post('/api/auth/register', {
    name: 'Copy Cat', employeeId: 'EMP-999', email: 'aditi@company.com',
    password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', role: 'employee',
  });
  check('duplicate email rejected (409)', dupe.status === 409, `got ${dupe.status}`);

  const persistedUsers = await User.countDocuments();
  check('users actually persisted to MongoDB', persistedUsers === 2, `found ${persistedUsers}`);

  const storedUser = await User.findOne({ employeeId: 'EMP-101' }).select('+password');
  check('password stored hashed, not plaintext', storedUser.password !== 'Str0ng!Pass');

  const badLogin = await post('/api/auth/login', {
    email: 'aditi@company.com', password: 'WrongPass1!',
  });
  check('wrong password rejected (401)', badLogin.status === 401);

  const hrLogin = await post('/api/auth/login', {
    email: 'priya@company.com', password: 'Str0ng!Pass',
  });
  const hrToken = hrLogin.body?.data?.token;
  check('HR logs in and receives a token', !!hrToken);

  const empLogin = await post('/api/auth/login', {
    email: 'aditi@company.com', password: 'Str0ng!Pass',
  });
  const empToken = empLogin.body?.data?.token;
  check('employee logs in', !!empToken);
  check('login reports no HR record yet', empLogin.body?.data?.user?.hasEmployeeRecord === false);

  const noAuth = await get('/api/employees');
  check('protected route rejects missing token (401)', noAuth.status === 401);

  const badToken = await get('/api/employees', { token: 'garbage.token.here' });
  check('protected route rejects bad token (401)', badToken.status === 401);

  // ─────────────────────────────────────────────── Employee creation
  console.log('\n--- Employee records (User -> Employee link) ---');

  const orphan = await post('/api/employees', {
    employeeId: 'EMP-404', firstName: 'Ghost', lastName: 'User',
    email: 'ghost@company.com', phone: '9876543299', gender: 'other',
    dateOfBirth: '1995-01-01', dateOfJoining: '2024-01-01',
    department: 'sales', designation: 'Rep', salary: 30000,
  }, { token: hrToken });
  check('employee with no account rejected (404)', orphan.status === 404, `got ${orphan.status}`);

  const created = await post('/api/employees', {
    employeeId: 'EMP-101', firstName: 'Aditi', lastName: 'Rao',
    email: 'aditi@company.com', phone: '9876543210', gender: 'female',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'engineering', designation: 'Software Engineer', salary: 60000,
  }, { token: hrToken });
  check('HR creates employee record (201)', created.status === 201, JSON.stringify(created.body));

  const empDoc = await Employee.findOne({ employeeId: 'EMP-101' });
  check('employee PERSISTED to MongoDB', !!empDoc);
  check('Employee.user auto-linked to the User account',
    empDoc && String(empDoc.user) === String(storedUser._id),
    empDoc ? `user=${empDoc.user}` : 'no doc');

  const initialPay = await Payroll.findOne({ employeeId: 'EMP-101', isCurrent: true });
  check('initial salary stored as a payroll record', initialPay?.basicSalary === 60000);

  const dupeEmp = await post('/api/employees', {
    employeeId: 'EMP-101', firstName: 'Aditi', lastName: 'Rao',
    email: 'aditi2@company.com', phone: '9876543210', gender: 'female',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'engineering', designation: 'Software Engineer', salary: 60000,
  }, { token: hrToken });
  check('duplicate employee record rejected (409)', dupeEmp.status === 409);

  // Give HR its own record so HR can use employee-scoped endpoints too
  await post('/api/employees', {
    employeeId: 'HR-001', firstName: 'Priya', lastName: 'Sharma',
    email: 'priya@company.com', phone: '9876500001', gender: 'female',
    dateOfBirth: '1992-03-20', dateOfJoining: '2022-06-01',
    department: 'hr', designation: 'HR Officer', salary: 70000,
  }, { token: hrToken });

  const listed = await get('/api/employees', { token: hrToken });
  check('GET /api/employees returns real data', Array.isArray(listed.body?.data) && listed.body.data.length === 2,
    `got ${listed.body?.data?.length} records`);
  check('pagination metadata present', listed.body?.pagination?.total === 2);

  const empListAttempt = await get('/api/employees', { token: empToken });
  check('employee cannot list all employees (403)', empListAttempt.status === 403);

  const ownProfile = await get('/api/employees/EMP-101', { token: empToken });
  check('employee reads own profile by employeeId', ownProfile.status === 200);
  check('fullName virtual serialised', ownProfile.body?.data?.fullName === 'Aditi Rao');

  const otherProfile = await get('/api/employees/HR-001', { token: empToken });
  check('employee cannot read another profile (403)', otherProfile.status === 403);

  const searched = await get('/api/employees?search=Aditi', { token: hrToken });
  check('search filter works', searched.body?.data?.length === 1);

  const byDept = await get('/api/employees?department=engineering', { token: hrToken });
  check('department filter works', byDept.body?.data?.length === 1);

  // ─────────────────────────────────────────────── Profile updates
  console.log('\n--- Profile updates ---');

  const selfEdit = await patch('/api/employees/EMP-101/self', {
    phone: '9998887776', address: '221B Baker Street, Mumbai',
  }, { token: empToken });
  check('employee updates own profile', selfEdit.status === 200, JSON.stringify(selfEdit.body));

  const reread = await Employee.findOne({ employeeId: 'EMP-101' });
  check('profile change PERSISTED', reread.phone === '9998887776');

  const salaryHack = await patch('/api/employees/EMP-101/self', {
    phone: '9998887776', salary: 999999,
  }, { token: empToken });
  check('employee cannot edit salary (400)', salaryHack.status === 400);

  const editOther = await patch('/api/employees/HR-001/self', {
    phone: '9998887770',
  }, { token: empToken });
  check("employee cannot edit another's profile (403)", editOther.status === 403);

  const adminEdit = await patch('/api/employees/EMP-101/admin', {
    designation: 'Senior Software Engineer', department: 'engineering',
  }, { token: hrToken });
  check('HR updates designation', adminEdit.status === 200);
  check('designation change PERSISTED',
    (await Employee.findOne({ employeeId: 'EMP-101' })).designation === 'Senior Software Engineer');

  // ─────────────────────────────────────────────── Attendance
  console.log('\n--- Attendance ---');

  const ci = await post('/api/attendance/check-in', {
    employeeId: 'EMP-101', date: '2026-08-20', checkIn: '09:00',
  }, { token: empToken });
  check('check-in recorded (201)', ci.status === 201, JSON.stringify(ci.body));
  check('attendance PERSISTED', (await Attendance.countDocuments({ employeeId: 'EMP-101' })) === 1);

  const ciAgain = await post('/api/attendance/check-in', {
    employeeId: 'EMP-101', date: '2026-08-20', checkIn: '09:30',
  }, { token: empToken });
  check('double check-in rejected (409)', ciAgain.status === 409);

  const co = await post('/api/attendance/check-out', {
    employeeId: 'EMP-101', date: '2026-08-20', checkOut: '18:00',
  }, { token: empToken });
  check('check-out recorded', co.status === 200);
  check('working hours computed by model (9)', co.body?.data?.workingHours === 9);

  const coNoCheckIn = await post('/api/attendance/check-out', {
    employeeId: 'EMP-101', date: '2026-08-25', checkOut: '18:00',
  }, { token: empToken });
  check('check-out without check-in rejected (400)', coNoCheckIn.status === 400);

  const spoof = await post('/api/attendance/check-in', {
    employeeId: 'HR-001', date: '2026-08-21', checkIn: '09:00',
  }, { token: empToken });
  check("employee cannot check in as someone else (403)", spoof.status === 403);

  const halfDay = await post('/api/attendance/check-in', {
    employeeId: 'EMP-101', date: '2026-08-21', checkIn: '09:00',
  }, { token: empToken });
  check('second day check-in works', halfDay.status === 201);
  const shortOut = await post('/api/attendance/check-out', {
    employeeId: 'EMP-101', date: '2026-08-21', checkOut: '11:00',
  }, { token: empToken });
  check('short day auto-marked half-day', shortOut.body?.data?.status === 'half-day');

  const markAbsent = await put('/api/attendance/status', {
    employeeId: 'EMP-101', date: '2026-08-19', status: 'absent',
  }, { token: hrToken });
  check('HR marks a day absent', markAbsent.status === 200);

  const empMarking = await put('/api/attendance/status', {
    employeeId: 'EMP-101', date: '2026-08-18', status: 'present',
  }, { token: empToken });
  check('employee cannot set attendance status (403)', empMarking.status === 403);

  const myAtt = await get('/api/attendance', { token: empToken });
  check('employee sees own attendance', myAtt.body?.data?.length === 3, `got ${myAtt.body?.data?.length}`);
  check('summary computed', myAtt.body?.summary?.present === 1 && myAtt.body?.summary?.absent === 1,
    JSON.stringify(myAtt.body?.summary));

  const ranged = await get('/api/attendance?startDate=2026-08-20&endDate=2026-08-21', { token: empToken });
  check('date range filter works', ranged.body?.data?.length === 2);

  // ─────────────────────────────────────────────── Leave
  console.log('\n--- Leave ---');

  const applied = await post('/api/leave/apply', {
    employeeId: 'EMP-101', leaveType: 'sick',
    startDate: '2026-09-01', endDate: '2026-09-03', remarks: 'Fever and cold',
  }, { token: empToken });
  check('leave applied (201)', applied.status === 201, JSON.stringify(applied.body));
  const leaveId = applied.body?.data?._id;
  check('leave PERSISTED', (await Leave.countDocuments()) === 1);
  check('totalDays computed (3)', applied.body?.data?.totalDays === 3);

  const overlap = await post('/api/leave/apply', {
    employeeId: 'EMP-101', leaveType: 'paid',
    startDate: '2026-09-02', endDate: '2026-09-05', remarks: 'Overlapping trip',
  }, { token: empToken });
  check('overlapping leave rejected (409)', overlap.status === 409, `got ${overlap.status}`);

  const tooMuch = await post('/api/leave/apply', {
    employeeId: 'EMP-101', leaveType: 'sick',
    startDate: '2026-10-01', endDate: '2026-10-31', remarks: 'Very long illness',
  }, { token: empToken });
  check('leave beyond balance rejected (400)', tooMuch.status === 400, `got ${tooMuch.status}`);

  const empDecide = await patch(`/api/leave/${leaveId}/decision`, {
    status: 'approved',
  }, { token: empToken });
  check('employee cannot approve own leave (403)', empDecide.status === 403);

  const balanceBefore = (await Employee.findOne({ employeeId: 'EMP-101' })).leaveBalance.sick;

  const approved = await patch(`/api/leave/${leaveId}/decision`, {
    status: 'approved', comments: 'Get well soon',
  }, { token: hrToken });
  check('HR approves leave', approved.status === 200, JSON.stringify(approved.body));

  const afterEmp = await Employee.findOne({ employeeId: 'EMP-101' });
  check('leave balance deducted (8 -> 5)',
    afterEmp.leaveBalance.sick === balanceBefore - 3,
    `${balanceBefore} -> ${afterEmp.leaveBalance.sick}`);

  const leaveDays = await Attendance.countDocuments({ employeeId: 'EMP-101', status: 'leave' });
  check('approved leave written onto attendance (3 days)', leaveDays === 3, `got ${leaveDays}`);

  const decideTwice = await patch(`/api/leave/${leaveId}/decision`, {
    status: 'rejected',
  }, { token: hrToken });
  check('cannot decide an already-decided request (409)', decideTwice.status === 409);

  const allLeave = await get('/api/leave', { token: hrToken });
  check('HR sees all leave requests', allLeave.body?.data?.length === 1);
  check('leave summary computed', allLeave.body?.summary?.approved === 1);

  // ─────────────────────────────────────────────── Payroll
  console.log('\n--- Payroll ---');

  const myPay = await get('/api/payroll', { token: empToken });
  check('employee reads own payroll', myPay.status === 200);
  check('netSalary virtual returned', myPay.body?.data?.netSalary === 60000);

  const othersPay = await get('/api/payroll/HR-001', { token: empToken });
  check("employee cannot read another's payroll (403)", othersPay.status === 403);

  const hrRaise = await put('/api/payroll/EMP-101', {
    basicSalary: 75000, allowances: 5000, deductions: 2000, effectiveFrom: '2026-09-01',
  }, { token: hrToken });
  check('HR cannot change salary — admin only (403)', hrRaise.status === 403, `got ${hrRaise.status}`);

  // Promote Priya to admin to exercise the payroll write path
  await User.updateOne({ employeeId: 'HR-001' }, { role: 'admin' });
  const adminLogin = await post('/api/auth/login', {
    email: 'priya@company.com', password: 'Str0ng!Pass',
  });
  const adminToken = adminLogin.body?.data?.token;

  const raise = await put('/api/payroll/EMP-101', {
    basicSalary: 75000, allowances: 5000, deductions: 2000, effectiveFrom: '2026-09-01',
  }, { token: adminToken });
  check('admin updates salary', raise.status === 200, JSON.stringify(raise.body));
  check('gross computed (80000)', raise.body?.data?.grossSalary === 80000);
  check('net computed (78000)', raise.body?.data?.netSalary === 78000);

  const history = await Payroll.find({ employeeId: 'EMP-101' });
  check('salary history retained (2 records)', history.length === 2, `got ${history.length}`);
  const current = history.filter((h) => h.isCurrent);
  check('exactly one current record', current.length === 1, `got ${current.length}`);
  check('current record is the new salary', current[0]?.basicSalary === 75000);

  const badRaise = await put('/api/payroll/EMP-101', {
    basicSalary: 75000, allowances: 5000, deductions: 999999, effectiveFrom: '2026-10-01',
  }, { token: adminToken });
  check('deductions over gross rejected (400)', badRaise.status === 400);

  // ─────────────────────────────────────────────── Regressions
  // Each of these covers a bug found while reviewing the controllers.
  console.log('\n--- Regression checks ---');

  // The leave approval above must have actually written to the database,
  // not just returned 200. (A saved-document retry used to silently no-op.)
  const persistedLeave = await Leave.findById(leaveId);
  check('approved leave PERSISTED as approved', persistedLeave?.status === 'approved',
    `stored status = ${persistedLeave?.status}`);
  check('reviewedBy PERSISTED', !!persistedLeave?.reviewedBy);
  check('review comments PERSISTED', persistedLeave?.reviewComments === 'Get well soon');
  check('decision response reflects stored state', approved.body?.data?.status === 'approved');

  // A check-out earlier than the stored check-in is a validation error (400),
  // not an unhandled crash (500). The client sends no checkIn here, so only
  // the model can catch it.
  await post('/api/attendance/check-in', {
    employeeId: 'EMP-101', date: '2026-08-24', checkIn: '14:00',
  }, { token: empToken });
  const badOut = await post('/api/attendance/check-out', {
    employeeId: 'EMP-101', date: '2026-08-24', checkOut: '08:00',
  }, { token: empToken });
  check('checkout before stored checkin -> 400 not 500', badOut.status === 400,
    `got ${badOut.status}: ${badOut.body?.message}`);
  check('400 names the offending field', badOut.body?.errors?.[0]?.field === 'checkOut');

  // aggregate() does not apply schema setters, so an uppercase filter used to
  // return rows with an all-zero summary.
  const upper = await get('/api/leave?leaveType=Sick', { token: hrToken });
  check('uppercase leaveType filter returns rows', upper.body?.data?.length === 1,
    `got ${upper.body?.data?.length}`);
  check('summary agrees with rows (not all zero)', upper.body?.summary?.approved === 1,
    JSON.stringify(upper.body?.summary));

  // Express yields an array for a repeated query param
  const repeated = await get('/api/attendance?employeeId=EMP-101&employeeId=HR-001', { token: hrToken });
  check('repeated query param -> 400 not 500', repeated.status === 400, `got ${repeated.status}`);

  // An unparseable date must be an error, not an empty result set
  const badDate = await get('/api/attendance?startDate=not-a-date', { token: empToken });
  check('invalid date -> 400 not empty 200', badDate.status === 400, `got ${badDate.status}`);

  // Admin patching salary is refused with a pointer to the payroll endpoint
  const salaryOnProfile = await patch('/api/employees/EMP-101/admin', {
    salary: 123456,
  }, { token: adminToken });
  check('salary via profile PATCH refused (400)', salaryOnProfile.status === 400);
  check('unchanged salary after refusal',
    (await Payroll.findOne({ employeeId: 'EMP-101', isCurrent: true })).basicSalary === 75000);

  // ─────────────────────────────────────────────── Done
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('Failed:\n  - ' + failures.join('\n  - '));
  console.log();

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('\nTest run crashed:', err);
  if (server) server.close();
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
