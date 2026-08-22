const { body } = require('express-validator');

function calculateAge(dob) {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const employeeValidator = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .matches(/^[A-Z]{2,5}-?\d{3,6}$/)
    .withMessage('Employee ID must look like EMP-001 or EMP001'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 30 })
    .withMessage('First name must be between 2 and 30 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 30 })
    .withMessage('Last name must be between 1 and 30 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit phone number'),

  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('Date of birth cannot be in the future');
      }
      if (calculateAge(value) < 18) {
        throw new Error('Employee must be at least 18 years old');
      }
      if (calculateAge(value) > 75) {
        throw new Error('Enter a valid date of birth');
      }
      return true;
    }),

  body('dateOfJoining')
    .notEmpty()
    .withMessage('Date of joining is required')
    .isISO8601()
    .withMessage('Date of joining must be a valid date (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const joining = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (joining > today) {
        throw new Error('Date of joining cannot be in the future');
      }
      if (req.body.dateOfBirth && joining < new Date(req.body.dateOfBirth)) {
        throw new Error('Date of joining cannot be before date of birth');
      }
      return true;
    }),

  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required')
    .isIn(['engineering', 'hr', 'sales', 'marketing', 'finance', 'operations', 'support'])
    .withMessage('Select a valid department'),

  body('designation')
    .trim()
    .notEmpty()
    .withMessage('Designation is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Designation must be between 2 and 50 characters'),

  body('salary')
    .notEmpty()
    .withMessage('Salary is required')
    .isFloat({ gt: 0 })
    .withMessage('Salary must be a positive number'),
];

module.exports = { employeeValidator, calculateAge };