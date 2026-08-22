const { body, param } = require('express-validator');

const LEAVE_TYPES = ['paid', 'sick', 'unpaid'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

// Employee applies for leave
const applyLeaveValidator = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),

  body('leaveType')
    .trim()
    .notEmpty()
    .withMessage('Leave type is required')
    .toLowerCase()
    .isIn(LEAVE_TYPES)
    .withMessage(`Leave type must be one of: ${LEAVE_TYPES.join(', ')}`),

  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(value) < today) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),

  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      if (req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before start date');
      }
      return true;
    }),

  body('remarks')
    .trim()
    .notEmpty()
    .withMessage('Remarks are required')
    .isLength({ min: 5, max: 300 })
    .withMessage('Remarks must be between 5 and 300 characters'),
];

// Admin/HR approves or rejects leave request
const leaveDecisionValidator = [
  param('id')
    .notEmpty()
    .withMessage('Leave request ID is required'),

  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .toLowerCase()
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either approved or rejected'),

  body('comments')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage('Comments must be under 300 characters'),
];

module.exports = {
  applyLeaveValidator,
  leaveDecisionValidator,
  LEAVE_TYPES,
  LEAVE_STATUSES,
};
