const { body } = require('express-validator');

// Employees can only edit address, phone, and profile picture
// Everything else is locked from the employee side
const employeeProfileUpdateValidator = [
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit phone number'),

  body('profilePicture')
    .optional()
    .trim()
    .isURL()
    .withMessage('Profile picture must be a valid URL')
    .matches(/\.(jpg|jpeg|png|webp)$/i)
    .withMessage('Profile picture must be a jpg, jpeg, png, or webp image'),

  // Reject anything the employee isn't allowed to touch
  body(['salary', 'role', 'department', 'employeeId', 'dateOfJoining'])
    .custom((value, { req, path }) => {
      if (req.body[path] !== undefined) {
        throw new Error(`Employees are not permitted to edit '${path}'`);
      }
      return true;
    }),
];

// Admin can edit all fields (PATCH - all fields are optional)
const adminProfileUpdateValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('First name must be between 2 and 30 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Last name must be between 1 and 30 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit phone number'),

  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('department')
    .optional()
    .isIn(['engineering', 'hr', 'sales', 'marketing', 'finance', 'operations', 'support'])
    .withMessage('Select a valid department'),

  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Designation must be between 2 and 50 characters'),

  body('salary')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Salary must be a positive number'),
];

module.exports = { employeeProfileUpdateValidator, adminProfileUpdateValidator };
