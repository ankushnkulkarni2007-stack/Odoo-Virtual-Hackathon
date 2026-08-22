const { body } = require('express-validator');

const ATTENDANCE_STATUSES = ['present', 'absent', 'half-day', 'leave'];

// Employee checking in for the day
const checkInValidator = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (new Date(value) > today) {
        throw new Error('Attendance date cannot be in the future');
      }
      return true;
    }),

  body('checkIn')
    .notEmpty()
    .withMessage('Check-in time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Check-in time must be in HH:MM (24-hour) format'),
];

// Employee checking out
const checkOutValidator = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),

  body('checkIn')
    .notEmpty()
    .withMessage('Check-in time is required for comparison')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Check-in time must be in HH:MM (24-hour) format'),

  body('checkOut')
    .notEmpty()
    .withMessage('Check-out time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Check-out time must be in HH:MM (24-hour) format')
    .custom((value, { req }) => {
      if (req.body.checkIn && value <= req.body.checkIn) {
        throw new Error('Check-out time must be after check-in time');
      }
      return true;
    }),
];

// Admin/HR manually setting attendance status (Present/Absent/Half-day/Leave)
const attendanceStatusValidator = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),

  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .toLowerCase()
    .isIn(ATTENDANCE_STATUSES)
    .withMessage(`Status must be one of: ${ATTENDANCE_STATUSES.join(', ')}`),
];

module.exports = {
  checkInValidator,
  checkOutValidator,
  attendanceStatusValidator,
  ATTENDANCE_STATUSES,
};