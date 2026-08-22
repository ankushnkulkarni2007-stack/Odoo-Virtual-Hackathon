const jwt = require('jsonwebtoken');
const { User, Employee } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Roles that count as "Admin / HR Officer" in the spec's user classes.
 * Anything not in this list is a regular Employee with self-service access only.
 */
const MANAGER_ROLES = ['admin', 'hr'];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly rather than signing tokens with a predictable fallback
    throw new Error('JWT_SECRET is not set. Add it to your .env file.');
  }
  return secret;
}

/** Sign a login token. Called from authController after a successful login. */
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, employeeId: user.employeeId },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

/**
 * Verifies the Bearer token and attaches the live User document to req.user.
 *
 * We re-read the user from the database on every request rather than trusting
 * the token's payload, so a deactivated account or a role change takes effect
 * immediately instead of when the old token happens to expire.
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Not authenticated. Send a Bearer token.');
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token';
    throw new ApiError(401, message);
  }

  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'The account for this token no longer exists');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

  req.user = user;
  next();
});

/**
 * Route guard by role. Use after `protect`.
 *   router.post('/', protect, authorize('admin', 'hr'), handler)
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `This action requires one of: ${roles.join(', ')}`));
    }
    next();
  };

/** True for Admin/HR — used inside controllers for "own record vs all records" branching. */
const isManager = (user) => !!user && MANAGER_ROLES.includes(user.role);

/**
 * Resolves which Employee record a request is allowed to act on.
 *
 * This is the single place that answers "can this caller touch this employee?",
 * so attendance, leave, and payroll all enforce the rule identically:
 *   - Admin/HR may target any employee, via the employeeId in the request.
 *   - An employee may only ever target their own record, whatever they send.
 *
 * @param {object} req            the request (needs req.user)
 * @param {string} requestedEmpId employeeId from the body or params, may be undefined
 * @returns {Promise<Employee>}   the Employee document the caller may act on
 */
async function resolveEmployee(req, requestedEmpId) {
  // Express returns an ARRAY for a repeated query param (?employeeId=A&employeeId=B),
  // which would blow up on .toUpperCase() below as an unhandled 500.
  if (requestedEmpId != null && typeof requestedEmpId !== 'string') {
    throw new ApiError(400, 'employeeId must be a single value');
  }

  const targetId = isManager(req.user)
    ? (requestedEmpId || req.user.employeeId)
    : req.user.employeeId; // employees are pinned to themselves

  // An employee who names someone else is refused outright rather than
  // silently redirected to their own record.
  if (!isManager(req.user) && requestedEmpId && requestedEmpId.toUpperCase() !== req.user.employeeId) {
    throw new ApiError(403, 'You can only access your own records');
  }

  const employee = await Employee.findOne({ employeeId: targetId.toUpperCase() });
  if (!employee) {
    throw new ApiError(404, `No employee record found for ${targetId}`);
  }
  return employee;
}

module.exports = {
  protect,
  authorize,
  isManager,
  resolveEmployee,
  signToken,
  MANAGER_ROLES,
};
