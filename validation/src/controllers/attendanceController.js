const { Attendance } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { isManager, resolveEmployee } = require('../middlewares/auth');

/**
 * Midnight of the given date, matching how the model stores it.
 *
 * Rejects an unparseable date rather than letting it through: Mongoose casts
 * an Invalid Date to null, which would turn a typo'd date filter into an
 * empty result set and a zeroed summary — a wrong answer instead of an error.
 */
function dayStart(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `Invalid date: ${value}`);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * POST /api/attendance/check-in  (Spec 3.4.1)
 * One check-in per employee per day — the model's unique index is the real
 * guarantee, this lookup just turns it into a friendly message.
 */
const checkIn = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.body.employeeId);
  const date = dayStart(req.body.date);

  const existing = await Attendance.findOne({ employee: employee._id, date });
  if (existing && existing.checkIn) {
    throw new ApiError(409, `Already checked in at ${existing.checkIn} on this date`);
  }

  // A record may already exist if HR pre-marked the day (e.g. as 'leave')
  const record = existing || new Attendance({
    employee: employee._id,
    employeeId: employee.employeeId,
    date,
  });

  record.checkIn = req.body.checkIn;
  record.status = 'present';
  await record.save();

  res.status(201).json({ success: true, message: 'Check-in recorded', data: record });
});

/**
 * POST /api/attendance/check-out
 * Working hours and the half-day reclassification are computed by the model,
 * so there is exactly one copy of that logic.
 */
const checkOut = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.body.employeeId);
  const date = dayStart(req.body.date);

  const record = await Attendance.findOne({ employee: employee._id, date });
  if (!record || !record.checkIn) {
    throw new ApiError(400, 'No check-in found for this date. Check in first.');
  }
  if (record.checkOut) {
    throw new ApiError(409, `Already checked out at ${record.checkOut} on this date`);
  }

  record.checkOut = req.body.checkOut;
  await record.save(); // pre-validate hook rejects a check-out before check-in

  res.status(200).json({
    success: true,
    message: 'Check-out recorded',
    data: record,
  });
});

/**
 * PUT /api/attendance/status  (Admin/HR only, Spec 3.4.1)
 * Upserts the day's record so HR can mark someone absent without them
 * ever having checked in.
 */
const setStatus = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.body.employeeId);
  const date = dayStart(req.body.date);

  let record = await Attendance.findOne({ employee: employee._id, date });
  if (!record) {
    record = new Attendance({
      employee: employee._id,
      employeeId: employee.employeeId,
      date,
    });
  }

  record.status = req.body.status;
  record.markedBy = req.user._id;
  if (req.body.remarks) record.remarks = req.body.remarks;

  // Clearing the times keeps the record honest when a day is overridden
  // to absent or leave after a stray check-in.
  if (['absent', 'leave'].includes(record.status)) {
    record.checkIn = null;
    record.checkOut = null;
    record.workingHours = 0;
  }

  await record.save();

  res.status(200).json({ success: true, message: 'Attendance status updated', data: record });
});

/**
 * GET /api/attendance  (Spec 3.4.2)
 * Employees see only their own records; Admin/HR see everyone's unless they
 * filter to a specific employeeId. Supports the daily and weekly views.
 */
const getRecords = asyncHandler(async (req, res) => {
  const filter = {};

  if (isManager(req.user)) {
    if (req.query.employeeId) {
      const employee = await resolveEmployee(req, req.query.employeeId);
      filter.employee = employee._id;
    }
  } else {
    // Non-managers are pinned to their own record regardless of query params
    const employee = await resolveEmployee(req);
    filter.employee = employee._id;
  }

  if (req.query.startDate || req.query.endDate) {
    filter.date = {};
    if (req.query.startDate) filter.date.$gte = dayStart(req.query.startDate);
    if (req.query.endDate) filter.date.$lte = dayStart(req.query.endDate);
  }
  // Lowercased for the same reason as the leave filter: aggregate() doesn't
  // cast its pipeline, so an uppercase value would skew the summary.
  if (req.query.status) filter.status = String(req.query.status).toLowerCase();

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 31));

  const [records, total, statusCounts] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'firstName lastName employeeId department'),
    Attendance.countDocuments(filter),
    // Summary is computed over the whole filtered range, not just this page
    Attendance.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 }, hours: { $sum: '$workingHours' } } },
    ]),
  ]);

  const summary = { present: 0, absent: 0, 'half-day': 0, leave: 0, totalHours: 0 };
  for (const row of statusCounts) {
    summary[row._id] = row.count;
    summary.totalHours += row.hours || 0;
  }
  summary.totalHours = Number(summary.totalHours.toFixed(2));

  res.status(200).json({
    success: true,
    message: 'Attendance records retrieved',
    data: records,
    summary,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

module.exports = { checkIn, checkOut, setStatus, getRecords };
