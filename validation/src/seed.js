/**
 * Populates the database with realistic sample data.
 *
 *   npm run seed          # wipes the collections, then reseeds
 *
 * Everything goes through the Mongoose models, so the same validation,
 * hooks and password hashing the API uses apply here too.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/database');
const { User, Employee, Attendance, Leave, Payroll } = require('./models');

// One password for every demo account, so the login screen can offer
// one-click sign-in. Strong enough to pass the registration validator.
const DEMO_PASSWORD = 'Dayflow@123';

const PEOPLE = [
  {
    employeeId: 'ADM-001', role: 'admin',
    firstName: 'Rajesh', lastName: 'Menon', gender: 'male',
    email: 'rajesh@dayflow.com', phone: '9876500001',
    dateOfBirth: '1985-02-14', dateOfJoining: '2020-04-01',
    department: 'operations', designation: 'Operations Director',
    address: '14 Residency Road, Bengaluru',
    salary: { basic: 145000, allowances: 18000, deductions: 6200 },
  },
  {
    employeeId: 'HR-001', role: 'hr',
    firstName: 'Priya', lastName: 'Sharma', gender: 'female',
    email: 'priya@dayflow.com', phone: '9876500002',
    dateOfBirth: '1992-03-20', dateOfJoining: '2022-06-01',
    department: 'hr', designation: 'HR Officer',
    address: '7 Koramangala 5th Block, Bengaluru',
    salary: { basic: 78000, allowances: 9000, deductions: 3100 },
  },
  {
    employeeId: 'EMP-101', role: 'employee',
    firstName: 'Aditi', lastName: 'Rao', gender: 'female',
    email: 'aditi@dayflow.com', phone: '9876500003',
    dateOfBirth: '1998-05-10', dateOfJoining: '2024-01-15',
    department: 'engineering', designation: 'Software Engineer',
    address: '221B Indiranagar, Bengaluru',
    salary: { basic: 72000, allowances: 8000, deductions: 2900 },
  },
  {
    employeeId: 'EMP-102', role: 'employee',
    firstName: 'Karthik', lastName: 'Iyer', gender: 'male',
    email: 'karthik@dayflow.com', phone: '9876500004',
    dateOfBirth: '1996-11-02', dateOfJoining: '2023-03-06',
    department: 'engineering', designation: 'Senior Software Engineer',
    address: '38 HSR Layout, Bengaluru',
    salary: { basic: 105000, allowances: 12000, deductions: 4400 },
  },
  {
    employeeId: 'EMP-103', role: 'employee',
    firstName: 'Meera', lastName: 'Nair', gender: 'female',
    email: 'meera@dayflow.com', phone: '9876500005',
    dateOfBirth: '1999-07-25', dateOfJoining: '2025-02-10',
    department: 'marketing', designation: 'Marketing Associate',
    address: '5 Jayanagar 4th Block, Bengaluru',
    salary: { basic: 54000, allowances: 6000, deductions: 2100 },
  },
  {
    employeeId: 'EMP-104', role: 'employee',
    firstName: 'Arjun', lastName: 'Desai', gender: 'male',
    email: 'arjun@dayflow.com', phone: '9876500006',
    dateOfBirth: '1994-09-18', dateOfJoining: '2023-08-21',
    department: 'sales', designation: 'Account Executive',
    address: '90 Whitefield, Bengaluru',
    salary: { basic: 68000, allowances: 14000, deductions: 3300 },
  },
  {
    employeeId: 'EMP-105', role: 'employee',
    firstName: 'Sneha', lastName: 'Kulkarni', gender: 'female',
    email: 'sneha@dayflow.com', phone: '9876500007',
    dateOfBirth: '1997-01-30', dateOfJoining: '2024-11-04',
    department: 'finance', designation: 'Financial Analyst',
    address: '12 Malleshwaram, Bengaluru',
    salary: { basic: 82000, allowances: 7500, deductions: 3600 },
  },
];

const midnight = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

// Deterministic pseudo-random so reseeding produces the same demo data
let seedValue = 42;
function rand() {
  seedValue = (seedValue * 1103515245 + 12345) % 2147483648;
  return seedValue / 2147483648;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function seed() {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    Payroll.deleteMany({}),
  ]);

  console.log('Creating users and employee records...');
  const employees = [];

  for (const p of PEOPLE) {
    const user = await User.create({
      name: `${p.firstName} ${p.lastName}`,
      employeeId: p.employeeId,
      email: p.email,
      password: DEMO_PASSWORD, // hashed by the model's pre-save hook
      role: p.role,
      isEmailVerified: true,
    });

    const employee = await Employee.create({
      user: user._id,
      employeeId: p.employeeId,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      dateOfJoining: p.dateOfJoining,
      department: p.department,
      designation: p.designation,
      address: p.address,
    });

    await Payroll.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      basicSalary: p.salary.basic,
      allowances: p.salary.allowances,
      deductions: p.salary.deductions,
      effectiveFrom: p.dateOfJoining,
      bankDetails: { bankName: 'HDFC Bank', ifscCode: 'HDFC0001234' },
    });

    employees.push(employee);
  }

  // Engineering reports to the senior engineer; everyone else to the director
  const director = employees.find((e) => e.employeeId === 'ADM-001');
  const senior = employees.find((e) => e.employeeId === 'EMP-102');
  for (const e of employees) {
    if (e.employeeId === 'ADM-001') continue;
    e.reportingManager = e.department === 'engineering' && e.employeeId !== 'EMP-102'
      ? senior._id
      : director._id;
    await e.save();
  }

  console.log('Generating attendance for the last 30 days...');
  const today = midnight(new Date());
  let attendanceCount = 0;

  for (const employee of employees) {
    const joined = midnight(employee.dateOfJoining);

    for (let back = 30; back >= 1; back--) {
      const date = addDays(today, -back);
      if (isWeekend(date) || date < joined) continue;

      const roll = rand();
      let status = 'present';
      let checkIn = null;
      let checkOut = null;

      if (roll < 0.06) {
        status = 'absent';
      } else if (roll < 0.12) {
        // Half day — leaves around lunchtime
        status = 'present'; // the model reclassifies this to half-day
        checkIn = pick(['09:00', '09:15', '09:30']);
        checkOut = pick(['12:00', '12:30', '13:00']);
      } else {
        checkIn = pick(['08:45', '09:00', '09:10', '09:25', '09:40']);
        checkOut = pick(['17:45', '18:00', '18:20', '18:45', '19:00']);
      }

      await Attendance.create({
        employee: employee._id,
        employeeId: employee.employeeId,
        date,
        checkIn,
        checkOut,
        status,
      });
      attendanceCount++;
    }
  }

  // Today's check-ins, so the admin dashboard has live numbers to show.
  // EMP-101 is deliberately left out — that's the demo employee account, and
  // leaving the day open lets you press "Check in" during a walkthrough.
  for (const employee of employees) {
    if (employee.employeeId === 'EMP-101') continue;
    await Attendance.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      date: today,
      checkIn: pick(['08:45', '09:00', '09:12', '09:30']),
      status: 'present',
    });
    attendanceCount++;
  }

  console.log('Creating leave requests...');
  const byId = (id) => employees.find((e) => e.employeeId === id);

  const leaveSpecs = [
    // Pending — these populate the admin approvals queue
    { emp: 'EMP-101', type: 'paid', start: addDays(today, 6), end: addDays(today, 8),
      remarks: 'Family wedding out of town', status: 'pending' },
    { emp: 'EMP-103', type: 'sick', start: addDays(today, 2), end: addDays(today, 2),
      remarks: 'Dental surgery appointment', status: 'pending' },
    { emp: 'EMP-104', type: 'unpaid', start: addDays(today, 12), end: addDays(today, 16),
      remarks: 'Extended personal travel', status: 'pending' },
    // Already decided
    { emp: 'EMP-102', type: 'sick', start: addDays(today, -12), end: addDays(today, -11),
      remarks: 'Viral fever, doctor advised rest', status: 'approved',
      comments: 'Approved. Get well soon.' },
    { emp: 'EMP-105', type: 'paid', start: addDays(today, -6), end: addDays(today, -5),
      remarks: 'Short personal break', status: 'approved', comments: 'Approved.' },
    { emp: 'EMP-104', type: 'paid', start: addDays(today, -20), end: addDays(today, -14),
      remarks: 'Long vacation request', status: 'rejected',
      comments: 'Rejected — clashes with the quarter-end sales push.' },
  ];

  const hrUser = await User.findOne({ employeeId: 'HR-001' });

  for (const spec of leaveSpecs) {
    const employee = byId(spec.emp);

    const leave = await Leave.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      leaveType: spec.type,
      startDate: midnight(spec.start),
      endDate: midnight(spec.end),
      remarks: spec.remarks,
      status: spec.status,
      ...(spec.status !== 'pending' && {
        reviewedBy: hrUser._id,
        reviewComments: spec.comments,
        reviewedAt: addDays(spec.start, -2),
      }),
    });

    // Approved leave must agree with the attendance and balance records,
    // exactly as the approval endpoint would leave things.
    if (spec.status === 'approved') {
      if (leave.leaveType !== 'unpaid') {
        employee.leaveBalance[leave.leaveType] -= leave.totalDays;
        await employee.save();
      }

      let cursor = midnight(leave.startDate);
      const end = midnight(leave.endDate);
      while (cursor <= end) {
        if (!isWeekend(cursor)) {
          await Attendance.findOneAndUpdate(
            { employee: employee._id, date: new Date(cursor) },
            {
              $set: {
                employeeId: employee.employeeId,
                status: 'leave',
                checkIn: null,
                checkOut: null,
                workingHours: 0,
                remarks: `${leave.leaveType} leave`,
              },
            },
            { upsert: true }
          );
        }
        cursor = addDays(cursor, 1);
      }
    }
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`  ${employees.length} employees`);
  console.log(`  ${attendanceCount} attendance records`);
  console.log(`  ${leaveSpecs.length} leave requests`);
  console.log(`  ${employees.length} payroll records`);
  console.log('─────────────────────────────────────────────');
  console.log('\n  Log in with any of these (same password):\n');
  console.log(`  Password for all accounts: ${DEMO_PASSWORD}\n`);
  for (const p of PEOPLE) {
    console.log(`  ${p.role.padEnd(9)} ${p.email.padEnd(24)} ${p.employeeId}`);
  }
  console.log();

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('\nSeed failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
