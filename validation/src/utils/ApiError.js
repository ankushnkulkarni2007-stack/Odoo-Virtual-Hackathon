/**
 * An error with an HTTP status attached, so controllers can signal
 * "404 not found" or "403 forbidden" by throwing rather than by
 * returning a response from three nested levels down.
 *
 *   throw new ApiError(404, 'Employee not found');
 *
 * The error middleware in app.js turns these into JSON responses.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional [{ field, message }] for form-style errors
    this.isOperational = true; // distinguishes expected errors from real bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
