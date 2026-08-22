const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User model — handles authentication only (Spec 3.1).
 * The HR/personal details live on the Employee model, which links back here.
 * Keeping login credentials separate from profile data means you can disable
 * an account without touching the employment record.
 */
const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,5}-?\d{3,6}$/, 'Employee ID must look like EMP-001'],
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never return the hash in queries unless explicitly asked with .select('+password')
      select: false,
    },

    // Spec 2: Admin / HR Officer vs Employee.
    // 'hr' and 'admin' both get management privileges; only these two roles
    // may approve leave, edit any profile, or touch payroll.
    role: {
      type: String,
      enum: {
        values: ['admin', 'hr', 'employee'],
        message: 'Role must be admin, hr, or employee',
      },
      default: 'employee',
    },

    // Spec 3.1.1: "Email verification is required."
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

// Link back to the full HR record
userSchema.virtual('employee', {
  ref: 'Employee',
  localField: 'employeeId',
  foreignField: 'employeeId',
  justOne: true,
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Convenience flag used by route guards
userSchema.virtual('isManager').get(function () {
  return this.role === 'admin' || this.role === 'hr';
});

/**
 * Replace this.password with its bcrypt hash.
 * Exposed as a method (rather than inlined in the hook) so password-reset
 * flows can reuse it, and so it can be unit-tested without a database.
 */
userSchema.methods.hashPassword = async function () {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return this.password;
};

/**
 * Hash the password before saving.
 * Only runs when the password actually changed, so updating a name
 * doesn't re-hash (and thereby break) the existing password.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  await this.hashPassword();
});

/**
 * Compare a plaintext login attempt against the stored hash.
 * Usage in authController:
 *   const user = await User.findOne({ email }).select('+password');
 *   const ok = await user.comparePassword(req.body.password);
 */
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
