const mongoose = require('mongoose');

/**
 * Leave model (Spec 3.5).
 * Covers the employee's request and the Admin/HR decision on it.
 */
const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    employeeId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Spec 3.5.1: Paid, Sick, Unpaid
    leaveType: {
      type: String,
      required: [true, 'Leave type is required'],
      enum: {
        values: ['paid', 'sick', 'unpaid'],
        message: 'Leave type must be paid, sick, or unpaid',
      },
      lowercase: true,
    },

    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // Inclusive day count, filled in by the pre-validate hook
    totalDays: {
      type: Number,
      min: 1,
    },

    remarks: {
      type: String,
      required: [true, 'Remarks are required'],
      trim: true,
      minlength: [5, 'Remarks must be at least 5 characters'],
      maxlength: [300, 'Remarks cannot exceed 300 characters'],
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: 'Status must be pending, approved, or rejected',
      },
      default: 'pending',
    },

    // ---- Admin / HR decision (Spec 3.5.2) ----
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewComments: {
      type: String,
      trim: true,
      maxlength: [300, 'Comments cannot exceed 300 characters'],
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Admin dashboard: pending requests first, newest first
leaveSchema.index({ status: 1, createdAt: -1 });
// Employee's own leave history, and overlap checks
leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });

leaveSchema.pre('validate', function () {
  if (this.startDate && this.endDate) {
    if (this.endDate < this.startDate) {
      this.invalidate('endDate', 'End date cannot be before start date');
      return;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(this.startDate).setHours(0, 0, 0, 0);
    const end = new Date(this.endDate).setHours(0, 0, 0, 0);
    this.totalDays = Math.round((end - start) / msPerDay) + 1;
  }
});

/**
 * Does this request overlap an existing pending/approved leave?
 * Call this in the controller before saving — the DB can't express
 * "no overlapping ranges" as an index.
 *
 *   const clash = await Leave.hasOverlap(employeeObjectId, startDate, endDate);
 *   if (clash) return res.status(409).json({ ... });
 */
leaveSchema.statics.hasOverlap = function (employeeId, startDate, endDate, excludeId = null) {
  const query = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: new Date(endDate) },
    endDate: { $gte: new Date(startDate) },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return this.exists(query);
};

module.exports = mongoose.model('Leave', leaveSchema);
