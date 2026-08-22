const { body, param } = require('express-validator');

// Admin updates employee salary structure
// Employee payroll access is read-only
const updateSalaryValidator = [
  param('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),

  body('basicSalary')
    .notEmpty()
    .withMessage('Basic salary is required')
    .isFloat({ gt: 0 })
    .withMessage('Basic salary must be a positive number'),

  body('allowances')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Allowances cannot be negative'),

  body('deductions')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Deductions cannot be negative'),

  body('effectiveFrom')
    .notEmpty()
    .withMessage('Effective date is required')
    .isISO8601()
    .withMessage('Effective date must be a valid date (YYYY-MM-DD)'),

  // Sanity check: deductions shouldn't exceed basic + allowances
  body('deductions')
    .custom((value, { req }) => {
      if (value === undefined) return true;
      const gross = Number(req.body.basicSalary || 0) + Number(req.body.allowances || 0);
      if (Number(value) > gross) {
        throw new Error('Deductions cannot exceed basic salary plus allowances');
      }
      return true;
    }),
];

module.exports = { updateSalaryValidator };
