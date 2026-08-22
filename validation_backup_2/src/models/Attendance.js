const mongoose = require('mongoose');

/**
 * Attendance model (Spec 3.4).
 * One document per employee per day. The compound unique index below is what
 * actually stops an employee from checking in twice on the same date —
 * enforce it here rather than trusting the controller to check first.
 */
const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // Denormalised so attendance lists can be filtered without a join
    employeeId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    /**
     * Stored as a Date normalised to midnight (see the pre-save hook), so
     * "same day" comparisons and the unique index behave predictably.
     */
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },

    // "HH:MM" 24-hour strings — simple to render, simple to compare
    checkIn: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Check-in must be in HH:MM format'],
      default: null,
    },
    checkOut: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Check-out must be in HH:MM format'],
      default: null,
    },

    // Spec 3.4.1 status types
    status: {
      type: String,
      enum: {
        values: ['present', 'absent', 'half-day', 'leave'],
        message: 'Status must be present, absent, half-day, or leave',
      },
      default: 'absent',
    },

    workingHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Set when Admin/HR overrides the status manually rather than it coming
    // from a check-in — useful for the audit trail.
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [200, 'Remarks cannot exceed 200 characters'],
    },
  },
  { timestamps: true }
);

// One attendance record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
// Supports the daily/weekly views in the dashboard
attendanceSchema.index({ date: -1 });

/**
 * Normalise the date to midnight and derive working hours from the
 * check-in/check-out pair so controllers don't each reinvent the maths.
 * Runs at validate time so an impossible check-out surfaces as a
 * validation error alongside the other field errors.
 */
attendanceSchema.pre('validate', function () {
  if (this.date) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    this.date = d;
  }

  if (this.checkIn && this.checkOut) {
    const [inH, inM] = this.checkIn.split(':').map(Number);
    const [outH, outM] = this.checkOut.split(':').map(Number);
    const minutes = outH * 60 + outM - (inH * 60 + inM);

    if (minutes <= 0) {
      throw new Error('Check-out time must be after check-in time');
    }

    this.workingHours = Number((minutes / 60).toFixed(2));

    // Auto-classify a short day as half-day unless someone set it explicitly
    if (this.status === 'present' && this.workingHours < 4) {
      this.status = 'half-day';
    }
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
