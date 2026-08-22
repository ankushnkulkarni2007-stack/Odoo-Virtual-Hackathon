const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors from express-validator
 * Drop this in after any validator chain.
 * If express-validator found problems, it responds with 400 and a clean
 * list of { field, message } instead of letting the request continue.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
}

module.exports = handleValidation;
