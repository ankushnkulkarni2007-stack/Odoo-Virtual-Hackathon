const mongoose = require('mongoose');
const { Leave, Attendance, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { isManager, resolveEmployee } = require('../middlewares/auth');

/**
 * POST /api/leave/apply  (Spec 3.5.1)
 * Rejects overlapping requests and insufficient balance before creating.
 */
const apply = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req, req.body.employeeId);
  const { leaveType, startDate, endDate, remarks } = req.body;

  const clash = await Leave.hasOverlap(employee._id, startDate, endDate);
  if (clash) {
    throw new ApiError(409, 'You already have a pending or approved leave overlapping these dates');
  }

  const leave = new Leave({
    employee: employee._id,
    employeeId: employee.employeeId,
    leaveType,
    startDate,
    endDate,
    remarks,
  });
  await leave.validate(); // computes totalDays before the balance check below

  // Unpaid leave doesn't draw on a balance
  if (leaveType !== 'unpaid') {
    const available = employee.leaveBalance[leaveType] ?? 0;
    if (leave.totalDays > available) {
      throw new ApiError(
        400,
        `Insufficient ${leaveType} leave balance: ${leave.totalDays} day(s) requested, ${available} available`
      );
    }
  }

  await leave.save();

  res.status(201).json({ success: true, message: 'Leave request submitted', data: leave });
});

/**
 * GET /api/leave  (Spec 3.5.2)
 * Employees see their own requests; Admin/HR see all, filterable by status.
 */
const getRequests = asyncHandler(async (req, res) => {
  const filter = {};

  if (isManager(req.user)) {
    if (req.query.employeeId) {
      const employee = await resolveEmployee(req, req.query.employeeId);
      filter.employee = employee._id;
    }
  } else {
    const employee = await resolveEmployee(req);
    filter.employee = employee._id;
  }

  // Lowercased here on purpose: .find() applies the schema's `lowercase`
  // setter, but .aggregate() does NOT cast its pipeline. Without this,
  // ?leaveType=Paid would return matching rows with an all-zero summary.
  if (req.query.status) filter.status = String(req.query.status).toLowerCase();
  if (req.query.leaveType) filter.leaveType = String(req.query.leaveType).toLowerCase();

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const [requests, total, counts] = await Promise.all([
    Leave.find(filter)
      // Pending first so the approvals queue is actionable at a glance
      .sort({ status: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('employee', 'firstName lastName employeeId department')
      .populate('reviewedBy', 'name role'),
    Leave.countDocuments(filter),
    Leave.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const summary = { pending: 0, approved: 0, rejected: 0, totalRequests: total };
  for (const row of counts) summary[row._id] = row.count;

  res.status(200).json({
    success: true,
    message: 'Leave requests retrieved',
    data: requests,
    summary,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/leave/:id */
const getById = asyncHandler(async (req, res) => {
  const leave = await Leave.findById(req.params.id)
    .populate('employee', 'firstName lastName employeeId department')
    .populate('reviewedBy', 'name role');

  if (!leave) throw new ApiError(404, 'Leave request not found');

  if (!isManager(req.user) && leave.employeeId !== req.user.employeeId) {
    throw new ApiError(403, 'You can only view your own leave requests');
  }

  res.status(200).json({ success: true, message: 'Leave request retrieved', data: leave });
});

/**
 * PATCH /api/leave/:id/decision  (Admin/HR only, Spec 3.5.2)
 *
 * On approval this both deducts the leave balance and writes 'leave' onto the
 * affected attendance days, which is what "changes reflect immediately in
 * employee records" means in practice. Those two writes plus the status update
 * run in a transaction where the deployment supports one, so a mid-way failure
 * can't leave a balance deducted against a still-pending request.
 */
const makeDecision = asyncHandler(async (req, res) => {
  const { status, comments } = req.body;

  const leave = await Leave.findById(req.params.id).populate('employee');
  if (!leave) throw new ApiError(404, 'Leave request not found');

  if (leave.status !== 'pending') {
    throw new ApiError(409, `This request was already ${leave.status}`);
  }

  const employee = leave.employee;
  if (!employee) throw new ApiError(404, 'The employee for this request no longer exists');

  if (status === 'approved' && leave.leaveType !== 'unpaid') {
    const available = employee.leaveBalance[leave.leaveType] ?? 0;
    if (leave.totalDays > available) {
      throw new ApiError(
        400,
        `Cannot approve: employee has ${available} ${leave.leaveType} day(s) left but requested ${leave.totalDays}`
      );
    }
  }

  // Computed once, before any write, so the block below can be re-run safely.
  const balanceAfterApproval =
    leave.leaveType === 'unpaid' ? null : employee.leaveBalance[leave.leaveType] - leave.totalDays;

  /**
   * Every write here is an absolute, atomic update rather than a document
   * .save(). That matters because this block can run more than once:
   * withTransaction retries its callback on transient errors, and the
   * standalone fallback below re-runs it after an aborted attempt.
   *
   * Mongoose clears a document's modified paths after a successful save, so
   * re-saving the same in-memory document a second time would write nothing —
   * the request would report success while the row stayed 'pending'. Absolute
   * updates are immune to that, and to double-deducting the balance.
   */
  const applyDecision = async (session) => {
    const opts = session ? { session } : {};

    // The status guard makes this a no-op if another admin decided it first
    const result = await Leave.updateOne(
      { _id: leave._id, status: 'pending' },
      {
        $set: {
          status,
          reviewedBy: req.user._id,
          reviewComments: comments,
          reviewedAt: new Date(),
        },
      },
      opts
    );

    if (result.matchedCount === 0) {
      throw new ApiError(409, 'This request was decided by someone else a moment ago');
    }

    if (status === 'approved') {
      if (balanceAfterApproval !== null) {
        await Employee.updateOne(
          { _id: employee._id },
          { $set: { [`leaveBalance.${leave.leaveType}`]: balanceAfterApproval } },
          opts
        );
      }
      await markAttendanceAsLeave(leave, opts);
    }
  };

  // Transactions require a replica set. A standalone mongod — the usual local
  // dev setup — rejects them with IllegalOperation (code 20), and only that
  // specific failure justifies retrying without a transaction. Any other error
  // is a real failure and must propagate.
  let session = null;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => applyDecision(session));
  } catch (err) {
    if (session) {
      await session.endSession().catch(() => {});
      session = null;
    }

    const noReplicaSet =
      err.code === 20 ||
      err.codeName === 'IllegalOperation' ||
      /Transaction numbers are only allowed on a replica set member or mongos/i.test(
        err.message || ''
      );

    if (!noReplicaSet) throw err;
    await applyDecision(null);
  } finally {
    if (session) await session.endSession().catch(() => {});
  }

  // Re-read so the response reflects what is actually stored, not the
  // pre-update copy held in memory.
  const saved = await Leave.findById(leave._id)
    .populate('employee', 'firstName lastName employeeId department')
    .populate('reviewedBy', 'name role');

  res.status(200).json({
    success: true,
    message: `Leave request ${status}`,
    data: saved,
  });
});

/**
 * Writes status 'leave' onto every day the approved request covers, so the
 * attendance view agrees with the leave record. Existing days are updated,
 * missing ones are inserted — done as one bulk write per range.
 */
async function markAttendanceAsLeave(leave, opts = {}) {
  const operations = [];
  const cursor = new Date(leave.startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(leave.endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    operations.push({
      updateOne: {
        filter: { employee: leave.employee._id || leave.employee, date: new Date(cursor) },
        update: {
          $set: {
            status: 'leave',
            checkIn: null,
            checkOut: null,
            workingHours: 0,
            employeeId: leave.employeeId,
            remarks: `${leave.leaveType} leave`,
          },
        },
        upsert: true,
      },
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (operations.length) await Attendance.bulkWrite(operations, opts);
}

module.exports = { apply, getRequests, getById, makeDecision };
