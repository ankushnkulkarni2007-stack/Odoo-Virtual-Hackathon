const { User, Employee, Payroll } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { isManager } = require('../middlewares/auth');

/**
 * Fields an employee is allowed to change on their own record (Spec 3.3.2).
 * The validator rejects anything else, and this list is the second line of
 * defence so a validator change can't silently widen write access.
 */
const SELF_EDITABLE = ['address', 'phone', 'profilePicture'];

const ADMIN_EDITABLE = [
  'firstName', 'lastName', 'email', 'phone', 'address', 'gender',
  'dateOfBirth', 'dateOfJoining', 'department', 'designation',
  'profilePicture', 'reportingManager', 'employmentStatus',
];

function pick(source, allowed) {
  return allowed.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});
}

/**
 * POST /api/employees   (Admin/HR only)
 *
 * ── How Employee.user gets set ──────────────────────────────────────────
 * The spec has users self-register (3.1.1), which creates a User with an
 * employeeId. This endpoint then completes their HR record and links the two
 * by that employeeId.
 *
 * `user` is deliberately NOT accepted from the request body — it is resolved
 * server-side. If a client could pass an arbitrary ObjectId, it could attach
 * an HR record to someone else's login account.
 *
 * If the person hasn't signed up yet, the request fails with a clear 404
 * rather than creating an orphan record that can never be logged into.
 */
const create = asyncHandler(async (req, res) => {
  const employeeId = req.body.employeeId.toUpperCase();

  const account = await User.findOne({ employeeId });
  if (!account) {
    throw new ApiError(
      404,
      `No account found for ${employeeId}. The employee must sign up first, then create their record here.`
    );
  }

  if (await Employee.exists({ employeeId })) {
    throw new ApiError(409, `An employee record already exists for ${employeeId}`);
  }
  if (await Employee.exists({ email: req.body.email.toLowerCase() })) {
    throw new ApiError(409, 'Another employee record already uses this email address');
  }

  const employee = await Employee.create({
    ...pick(req.body, [...ADMIN_EDITABLE, 'employeeId']),
    employeeId,
    user: account._id, // resolved from the account, never from the client
  });

  // The validator accepts `salary` on creation; store it as the employee's
  // first payroll record so salary history starts from day one.
  if (req.body.salary !== undefined) {
    await Payroll.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      basicSalary: req.body.salary,
      effectiveFrom: employee.dateOfJoining,
      updatedBy: req.user._id,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: employee,
  });
});

/**
 * GET /api/employees   (Admin/HR only)
 * Supports pagination plus the filters the admin dashboard needs.
 */
const getAll = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.status) filter.employmentStatus = req.query.status;
  if (req.query.search) {
    // Escape regex metacharacters so a search for "a.b" isn't treated as a pattern
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { employeeId: rx }, { email: rx }];
  }

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reportingManager', 'firstName lastName employeeId'),
    Employee.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: 'Employees retrieved',
    data: employees,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * GET /api/employees/:id
 * `:id` accepts either a Mongo ObjectId or an employeeId like EMP-101,
 * so the frontend can link to a profile without knowing the internal id.
 */
const getById = asyncHandler(async (req, res) => {
  const employee = await findByIdOrEmployeeId(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  // Employees may only read their own profile (Spec 3.3.1)
  if (!isManager(req.user) && employee.employeeId !== req.user.employeeId) {
    throw new ApiError(403, 'You can only view your own profile');
  }

  res.status(200).json({ success: true, message: 'Employee retrieved', data: employee });
});

/**
 * PATCH /api/employees/:id/self
 * Address, phone and profile picture only — enforced twice, by the validator
 * and by the SELF_EDITABLE whitelist here.
 */
const updateSelf = asyncHandler(async (req, res) => {
  const employee = await findByIdOrEmployeeId(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  if (employee.employeeId !== req.user.employeeId) {
    throw new ApiError(403, 'You can only edit your own profile');
  }

  const updates = pick(req.body, SELF_EDITABLE);
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, `Provide at least one of: ${SELF_EDITABLE.join(', ')}`);
  }

  Object.assign(employee, updates);
  await employee.save(); // .save() so schema validators and hooks run

  res.status(200).json({ success: true, message: 'Profile updated successfully', data: employee });
});

/**
 * PATCH /api/employees/:id/admin   (Admin/HR only)
 * Salary is intentionally absent — it moves through the payroll endpoint so
 * every change is versioned with an effective date.
 */
const updateByAdmin = asyncHandler(async (req, res) => {
  const employee = await findByIdOrEmployeeId(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  // The admin validator still accepts `salary`, but salary changes belong on
  // the payroll endpoint where they get an effective date and a history entry.
  // Say so rather than accepting the request and silently ignoring the field.
  if (req.body.salary !== undefined) {
    throw new ApiError(400, 'Update salary via PUT /api/payroll/:employeeId so the change is versioned', [
      { field: 'salary', message: 'Not editable here — use the payroll endpoint' },
    ]);
  }

  const updates = pick(req.body, ADMIN_EDITABLE);
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No editable fields were provided');
  }

  if (updates.email) {
    const clash = await Employee.findOne({
      email: updates.email.toLowerCase(),
      _id: { $ne: employee._id },
    });
    if (clash) throw new ApiError(409, 'Another employee already uses this email address');
  }

  Object.assign(employee, updates);
  await employee.save();

  res.status(200).json({ success: true, message: 'Employee updated successfully', data: employee });
});

// Accept either an ObjectId or an employeeId string in the :id slot
function findByIdOrEmployeeId(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  return isObjectId
    ? Employee.findById(id)
    : Employee.findOne({ employeeId: id.toUpperCase() });
}

module.exports = { create, getAll, getById, updateSelf, updateByAdmin };
