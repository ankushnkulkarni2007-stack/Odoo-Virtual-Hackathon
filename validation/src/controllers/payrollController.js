const { Payroll } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { isManager, resolveEmployee } = require('../middlewares/auth');

/**
 * GET /api/payroll  (Spec 3.6.1 / 3.6.2)
 * Employees get their own current salary, read-only.
 * Admin/HR get the current record for every employee.
 */
const getPayroll = asyncHandler(async (req, res) => {
  if (!isManager(req.user)) {
    const employee = await resolveEmployee(req);
    const record = await Payroll.findOne({ employee: employee._id, isCurrent: true });
    if (!record) throw new ApiError(404, 'No payroll record has been set up for you yet');

    return res.status(200).json({
      success: true,
      message: 'Payroll data retrieved',
      data: record,
    });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const [records, total] = await Promise.all([
    Payroll.find({ isCurrent: true })
      .sort({ employeeId: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'firstName lastName employeeId department designation'),
    Payroll.countDocuments({ isCurrent: true }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Payroll data retrieved',
    data: records,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * GET /api/payroll/:employeeId
 * Current salary plus, for Admin/HR, the full revision history.
 * resolveEmployee refuses an employee asking for someone else's record.
 */
const getByEmployeeId = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.params.employeeId);

  const current = await Payroll.findOne({ employee: employee._id, isCurrent: true });
  if (!current) throw new ApiError(404, `No payroll record found for ${employee.employeeId}`);

  const history = isManager(req.user)
    ? await Payroll.find({ employee: employee._id }).sort({ effectiveFrom: -1 })
    : undefined;

  res.status(200).json({
    success: true,
    message: 'Payroll data retrieved',
    data: {
      employeeId: employee.employeeId,
      basicSalary: current.basicSalary,
      allowances: current.allowances,
      deductions: current.deductions,
      grossSalary: current.grossSalary,
      netSalary: current.netSalary,
      effectiveFrom: current.effectiveFrom,
      ...(history && { history }),
    },
  });
});

/**
 * PUT /api/payroll/:employeeId  (Admin only, Spec 3.6.2)
 *
 * Creates a NEW payroll record rather than editing the existing one; the
 * model's pre-save hook retires the previous record. That keeps a full salary
 * history, which is what the planned salary-slip feature will need.
 */
const updateSalary = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.params.employeeId);
  const { basicSalary, allowances, deductions, effectiveFrom, bankDetails } = req.body;

  const record = await Payroll.create({
    employee: employee._id,
    employeeId: employee.employeeId,
    basicSalary,
    allowances,
    deductions,
    effectiveFrom,
    bankDetails,
    isCurrent: true,
    updatedBy: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: 'Salary structure updated',
    data: {
      employeeId: employee.employeeId,
      basicSalary: record.basicSalary,
      allowances: record.allowances,
      deductions: record.deductions,
      grossSalary: record.grossSalary,
      netSalary: record.netSalary,
      effectiveFrom: record.effectiveFrom,
    },
  });
});

module.exports = { getPayroll, getByEmployeeId, updateSalary };
