const crypto = require('crypto');
const { User, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../middlewares/auth');

/**
 * POST /api/auth/register  (Spec 3.1.1)
 *
 * Creates the login account only. The full HR record (Employee) is created
 * afterwards by Admin/HR via POST /api/employees, which links back to this
 * account by employeeId. See the note in employeeController for why.
 */
const register = asyncHandler(async (req, res) => {
  const { name, employeeId, email, password, role } = req.body;

  const normalisedId = employeeId.toUpperCase();

  // Check both unique fields up front so the client gets a helpful message
  // rather than a raw duplicate-key error from MongoDB.
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { employeeId: normalisedId }],
  });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'employeeId';
    throw new ApiError(409, 'An account with these details already exists', [
      { field, message: `This ${field} is already registered` },
    ]);
  }

  // Spec: "Email verification is required."
  const verificationToken = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    name,
    employeeId: normalisedId,
    email,
    password, // hashed by the model's pre-save hook
    role,
    emailVerificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // TODO: email the verification link instead of returning the token.
  // Until an SMTP service is wired up, the raw token is returned in
  // development only so the flow can be tested end to end.
  const devToken = process.env.NODE_ENV === 'production' ? undefined : verificationToken;

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: {
      id: user._id,
      name: user.name,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      ...(devToken && { verificationToken: devToken }),
    },
  });
});

/**
 * POST /api/auth/login  (Spec 3.1.2)
 * Returns a JWT plus whether the HR record exists yet, so the dashboard
 * knows whether to prompt the user to have HR complete their profile.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password has select:false on the schema, so ask for it explicitly
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Same message for "no such user" and "wrong password" — telling them apart
  // would let an attacker enumerate which emails have accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect email or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact HR.');
  }

  // Off by default so the flow is demo-able; set REQUIRE_EMAIL_VERIFICATION=true
  // in .env to enforce the spec's verification requirement.
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email address before logging in');
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const employee = await Employee.findOne({ employeeId: user.employeeId }).select('_id');

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        hasEmployeeRecord: !!employee,
      },
    },
  });
});

/**
 * GET /api/auth/verify-email/:token
 * Completes the verification step started at registration.
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) throw new ApiError(400, 'Verification link is invalid or has expired');

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: 'Email verified successfully' });
});

/**
 * GET /api/auth/me
 * The current user plus their HR record, for populating the dashboard.
 */
const getMe = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ employeeId: req.user.employeeId });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        employeeId: req.user.employeeId,
        email: req.user.email,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified,
      },
      employee,
    },
  });
});

module.exports = { register, login, verifyEmail, getMe };
