/**
 * Schema smoke test for the models. Run with: node test-models.js
 *
 * This validates documents WITHOUT needing a running MongoDB — it exercises
 * every field validator, pre('validate') hook, and virtual. The two things it
 * cannot cover offline are the unique indexes (enforced by the database) and
 * Payroll's pre('save') hook that retires the previous salary record.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Employee, Attendance, Leave, Payroll } = require('./src/models');

let pass = 0;
let fail = 0;

function check(label, condition) {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`);
  condition ? pass++ : fail++;
}

// Assert a document FAILS validation, optionally matching an error message
async function expectInvalid(label, doc, snippet) {
  try {
    await doc.validate();
    console.log(`  FAIL  ${label} (expected a validation error, got none)`);
    fail++;
  } catch (err) {
    const message = err.message || '';
    const ok = !snippet || message.includes(snippet);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` (got: ${message})`}`);
    ok ? pass++ : fail++;
  }
}

// Assert a document PASSES validation
async function expectValid(label, doc) {
  try {
    await doc.validate();
    console.log(`  PASS  ${label}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${label} (unexpected error: ${err.message})`);
    fail++;
  }
}

const oid = () => new mongoose.Types.ObjectId();

(async () => {
  const empRef = oid();

  console.log('\n--- User ---');
  const user = new User({
    employeeId: 'EMP-101',
    name: 'Aditi Rao',
    email: 'aditi@company.com',
    password: 'Str0ng!Pass',
    role: 'employee',
  });
  await expectValid('valid user passes validation', user);
  check('employeeId uppercased', user.employeeId === 'EMP-101');
  check('email lowercased', user.email === 'aditi@company.com');
  check('isManager false for employee', user.isManager === false);
  check('defaults to unverified email', user.isEmailVerified === false);

  const hrUser = new User({
    employeeId: 'hr-001', name: 'Priya HR', email: 'Priya@Company.com',
    password: 'Str0ng!Pass', role: 'hr',
  });
  await expectValid('hr user valid', hrUser);
  check('isManager true for hr', hrUser.isManager === true);
  check('lowercase employeeId normalised to HR-001', hrUser.employeeId === 'HR-001');
  check('mixed-case email normalised', hrUser.email === 'priya@company.com');

  await expectInvalid('bad role rejected', new User({
    employeeId: 'EMP-777', name: 'Bad Role', email: 'x@y.com',
    password: 'Str0ng!Pass', role: 'ceo',
  }), 'Role must be');
  await expectInvalid('malformed employeeId rejected', new User({
    employeeId: 'nope', name: 'Bad Id', email: 'x@y.com', password: 'Str0ng!Pass',
  }), 'EMP-001');
  await expectInvalid('missing email rejected', new User({
    employeeId: 'EMP-778', name: 'No Email', password: 'Str0ng!Pass',
  }), 'Email is required');

  // Password hashing — the pre('save') hook delegates to hashPassword(),
  // so testing the method covers the hashing path without needing a database.
  await user.hashPassword();
  check('password is hashed, not plaintext', user.password !== 'Str0ng!Pass');
  check('hash is bcrypt format', /^\$2[aby]\$/.test(user.password));
  check('comparePassword accepts correct password', await user.comparePassword('Str0ng!Pass'));
  check('comparePassword rejects wrong password', !(await user.comparePassword('wrong')));
  check('two users with same password get different hashes', await (async () => {
    const other = new User({
      employeeId: 'EMP-200', name: 'Same Pass', email: 'sp@company.com', password: 'Str0ng!Pass',
    });
    await other.hashPassword();
    return other.password !== user.password; // salted, so hashes must differ
  })());
  check('pre-save hook is registered', User.schema.s.hooks._pres.get('save').length > 0);
  check('password field hidden by default select', User.schema.path('password').options.select === false);

  console.log('\n--- Employee ---');
  const emp = new Employee({
    user: oid(), employeeId: 'EMP-101', firstName: 'Aditi', lastName: 'Rao',
    email: 'aditi@company.com', phone: '9876543210', gender: 'female',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'engineering', designation: 'Software Engineer',
  });
  await expectValid('valid employee passes validation', emp);
  check('fullName virtual works', emp.fullName === 'Aditi Rao');
  check('age virtual computes correctly', emp.age === 28);
  check('default leave balance set', emp.leaveBalance.paid === 12 && emp.leaveBalance.sick === 8);
  check('defaults to active employment', emp.employmentStatus === 'active');

  await expectInvalid('under-18 DOB rejected', new Employee({
    user: oid(), employeeId: 'EMP-102', firstName: 'Kid', lastName: 'Young',
    email: 'kid@company.com', phone: '9876543211', gender: 'male',
    dateOfBirth: '2015-01-01', dateOfJoining: '2024-01-15',
    department: 'engineering', designation: 'Intern',
  }), 'at least 18');
  await expectInvalid('joining before birth rejected', new Employee({
    user: oid(), employeeId: 'EMP-103', firstName: 'Time', lastName: 'Travel',
    email: 'tt@company.com', phone: '9876543212', gender: 'other',
    dateOfBirth: '1998-05-10', dateOfJoining: '1990-01-01',
    department: 'sales', designation: 'Rep',
  }), 'before date of birth');
  await expectInvalid('future joining date rejected', new Employee({
    user: oid(), employeeId: 'EMP-105', firstName: 'Future', lastName: 'Hire',
    email: 'fh@company.com', phone: '9876543213', gender: 'male',
    dateOfBirth: '1998-05-10', dateOfJoining: '2030-01-01',
    department: 'sales', designation: 'Rep',
  }), 'cannot be in the future');
  await expectInvalid('bad phone rejected', new Employee({
    user: oid(), employeeId: 'EMP-104', firstName: 'Bad', lastName: 'Phone',
    email: 'bp@company.com', phone: '12345', gender: 'male',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'sales', designation: 'Rep',
  }), 'valid 10-digit');
  await expectInvalid('invalid department rejected', new Employee({
    user: oid(), employeeId: 'EMP-106', firstName: 'Wrong', lastName: 'Dept',
    email: 'wd@company.com', phone: '9876543214', gender: 'male',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'astrology', designation: 'Seer',
  }), 'valid department');

  console.log('\n--- Attendance ---');
  const att = new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-20',
    checkIn: '09:00', checkOut: '18:00', status: 'present',
  });
  await expectValid('valid attendance passes validation', att);
  check('working hours computed (9)', att.workingHours === 9);
  check('date normalised to midnight', att.date.getHours() === 0);

  const partial = new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-22',
    checkIn: '09:30', checkOut: '13:15', status: 'present',
  });
  await expectValid('fractional hours valid', partial);
  check('fractional hours computed (3.75)', partial.workingHours === 3.75);
  check('short day auto-classified half-day', partial.status === 'half-day');

  const openDay = new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-23', checkIn: '09:00',
  });
  await expectValid('check-in without check-out valid', openDay);
  check('open day has 0 working hours', openDay.workingHours === 0);

  await expectInvalid('checkout before checkin rejected', new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-19',
    checkIn: '18:00', checkOut: '09:00', status: 'present',
  }), 'after check-in');
  await expectInvalid('malformed time rejected', new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-18', checkIn: '25:99',
  }), 'HH:MM');
  await expectInvalid('invalid status rejected', new Attendance({
    employee: empRef, employeeId: 'EMP-101', date: '2026-08-17', status: 'vacation',
  }), 'Status must be');

  console.log('\n--- Leave ---');
  const leave = new Leave({
    employee: empRef, employeeId: 'EMP-101', leaveType: 'sick',
    startDate: '2026-09-01', endDate: '2026-09-03', remarks: 'Fever and cold',
  });
  await expectValid('valid leave passes validation', leave);
  check('totalDays inclusive (3)', leave.totalDays === 3);
  check('single-day leave counts as 1', await (async () => {
    const l = new Leave({
      employee: empRef, employeeId: 'EMP-101', leaveType: 'paid',
      startDate: '2026-09-10', endDate: '2026-09-10', remarks: 'Personal errand',
    });
    await l.validate();
    return l.totalDays === 1;
  })());
  check('defaults to pending', leave.status === 'pending');
  check('leaveType lowercased', new Leave({ leaveType: 'SICK' }).leaveType === 'sick');

  await expectInvalid('end before start rejected', new Leave({
    employee: empRef, employeeId: 'EMP-101', leaveType: 'paid',
    startDate: '2026-09-10', endDate: '2026-09-05', remarks: 'Vacation trip',
  }), 'before start date');
  await expectInvalid('short remarks rejected', new Leave({
    employee: empRef, employeeId: 'EMP-101', leaveType: 'paid',
    startDate: '2026-09-01', endDate: '2026-09-02', remarks: 'no',
  }), 'at least 5 characters');
  await expectInvalid('invalid leave type rejected', new Leave({
    employee: empRef, employeeId: 'EMP-101', leaveType: 'sabbatical',
    startDate: '2026-09-01', endDate: '2026-09-02', remarks: 'Long break',
  }), 'paid, sick, or unpaid');
  check('hasOverlap static is available', typeof Leave.hasOverlap === 'function');

  console.log('\n--- Payroll ---');
  const pay = new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: 30000,
    allowances: 2000, deductions: 500, effectiveFrom: '2026-01-01',
  });
  await expectValid('valid payroll passes validation', pay);
  check('grossSalary virtual (32000)', pay.grossSalary === 32000);
  check('netSalary virtual (31500)', pay.netSalary === 31500);
  check('defaults to current record', pay.isCurrent === true);

  await expectInvalid('deductions over gross rejected', new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: 30000,
    allowances: 2000, deductions: 50000, effectiveFrom: '2026-02-01',
  }), 'cannot exceed');
  await expectInvalid('negative salary rejected', new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: -5000,
    effectiveFrom: '2026-02-01',
  }), 'positive number');
  await expectInvalid('negative deductions rejected', new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: 30000,
    deductions: -100, effectiveFrom: '2026-02-01',
  }), 'cannot be negative');
  await expectInvalid('bad IFSC rejected', new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: 30000,
    effectiveFrom: '2026-02-01', bankDetails: { ifscCode: 'BADCODE' },
  }), 'valid IFSC');
  await expectValid('valid IFSC accepted', new Payroll({
    employee: empRef, employeeId: 'EMP-101', basicSalary: 30000,
    effectiveFrom: '2026-02-01', bankDetails: { ifscCode: 'HDFC0001234' },
  }));
  check('bank account hidden by default select',
    Payroll.schema.path('bankDetails.accountNumber').options.select === false);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
