const mongoose = require('mongoose');

/**
 * Employee model — the HR record (Spec 3.3).
 * Holds personal details, job details, documents and profile picture.
 * Salary structure lives on the Payroll model so that salary history is
 * versioned separately and can be permission-gated more tightly.
 */

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['id-proof', 'address-proof', 'resume', 'offer-letter', 'certificate', 'other'],
      default: 'other',
    },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    // Links to the User account used for login
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,5}-?\d{3,6}$/, 'Employee ID must look like EMP-001'],
    },

    // ---- Personal details ----
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [30, 'First name cannot exceed 30 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [30, 'Last name cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit phone number'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['male', 'female', 'other'],
        message: 'Gender must be male, female, or other',
      },
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: {
        validator: function (value) {
          const eighteenYearsAgo = new Date();
          eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
          return value <= eighteenYearsAgo;
        },
        message: 'Employee must be at least 18 years old',
      },
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
    profilePicture: {
      type: String,
      default: null,
    },

    // ---- Job details ----
    dateOfJoining: {
      type: Date,
      required: [true, 'Date of joining is required'],
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: 'Date of joining cannot be in the future',
      },
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: ['engineering', 'hr', 'sales', 'marketing', 'finance', 'operations', 'support'],
        message: 'Select a valid department',
      },
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
      maxlength: [50, 'Designation cannot exceed 50 characters'],
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    employmentStatus: {
      type: String,
      enum: ['active', 'on-notice', 'resigned', 'terminated'],
      default: 'active',
    },

    documents: [documentSchema],

    /**
     * Leave balance, decremented when a paid/sick leave is approved.
     * Unpaid leave never touches these counters.
     * Reset these at the start of each leave year via a scheduled job.
     */
    leaveBalance: {
      paid: { type: Number, default: 12, min: 0 },
      sick: { type: Number, default: 8, min: 0 },
    },
  },
  { timestamps: true }
);

// Full name, computed rather than stored so it can't drift out of sync
employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

employeeSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - this.dateOfBirth.getFullYear();
  const m = today.getMonth() - this.dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < this.dateOfBirth.getDate())) age--;
  return age;
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

// Common query patterns: employee list filtered by department or status
employeeSchema.index({ department: 1, employmentStatus: 1 });

// Cross-field rule the per-field validators can't express
employeeSchema.pre('validate', function () {
  if (this.dateOfBirth && this.dateOfJoining && this.dateOfJoining < this.dateOfBirth) {
    throw new Error('Date of joining cannot be before date of birth');
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
