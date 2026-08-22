const mongoose = require('mongoose');

/**
 * Payroll model (Spec 3.6).
 * Read-only for employees; only Admin may create or update a record.
 *
 * Each salary revision is a NEW document with its own effectiveFrom date
 * rather than an edit in place, so you keep full salary history and can
 * answer "what was this person earning in March?" — which is exactly what
 * the future "salary slips" enhancement will need.
 */
const payrollSchema = new mongoose.Schema(
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

    basicSalary: {
      type: Number,
      required: [true, 'Basic salary is required'],
      min: [1, 'Basic salary must be a positive number'],
    },
    allowances: {
      type: Number,
      default: 0,
      min: [0, 'Allowances cannot be negative'],
    },
    deductions: {
      type: Number,
      default: 0,
      min: [0, 'Deductions cannot be negative'],
    },

    effectiveFrom: {
      type: Date,
      required: [true, 'Effective date is required'],
    },

    // Only one record per employee should be current at a time
    isCurrent: {
      type: Boolean,
      default: true,
    },

    bankDetails: {
      accountNumber: { type: String, trim: true, select: false },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        select: false,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code'],
      },
      bankName: { type: String, trim: true },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Fetching an employee's current salary is the hottest query here
payrollSchema.index({ employee: 1, isCurrent: 1 });
payrollSchema.index({ employee: 1, effectiveFrom: -1 });

payrollSchema.virtual('grossSalary').get(function () {
  return (this.basicSalary || 0) + (this.allowances || 0);
});

payrollSchema.virtual('netSalary').get(function () {
  return (this.basicSalary || 0) + (this.allowances || 0) - (this.deductions || 0);
});

payrollSchema.set('toJSON', { virtuals: true });
payrollSchema.set('toObject', { virtuals: true });

/**
 * Cross-field rule: deductions can't swallow more than the employee earns.
 *
 * Skipped when any individual amount is itself invalid (negative or missing) —
 * this hook runs BEFORE the field validators, so without the guard a negative
 * basicSalary would surface as a confusing "deductions too high" error instead
 * of the real "salary must be positive" one.
 */
payrollSchema.pre('validate', function () {
  const basic = this.basicSalary;
  const allowances = this.allowances || 0;
  const deductions = this.deductions || 0;

  if (typeof basic !== 'number' || basic <= 0) return;
  if (allowances < 0 || deductions < 0) return;

  if (deductions > basic + allowances) {
    this.invalidate('deductions', 'Deductions cannot exceed basic salary plus allowances');
  }
});

/**
 * When a new salary record is marked current, retire the previous one.
 * This keeps "one current record per employee" true without a transaction.
 */
payrollSchema.pre('save', async function () {
  if (this.isNew && this.isCurrent) {
    await this.constructor.updateMany(
      { employee: this.employee, isCurrent: true, _id: { $ne: this._id } },
      { $set: { isCurrent: false } }
    );
  }
});

module.exports = mongoose.model('Payroll', payrollSchema);
