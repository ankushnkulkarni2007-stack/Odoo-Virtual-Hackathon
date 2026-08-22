const { body } = require('express-validator');

// Reusable strong password validator
const strongPassword = body('password')
  .isString()
  .withMessage('Password is required')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/[a-z]/)
  .withMessage('Password must contain at least one lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain at least one uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain at least one number')
  .matches(/[^A-Za-z0-9]/)
  .withMessage('Password must contain at least one special character');

// Sign Up: Employee ID, Email, Password, Role (Employee / HR)
const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, and . \' -'),

  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .matches(/^[A-Z]{2,5}-?\d{3,6}$/)
    .withMessage('Employee ID must look like EMP-001 or EMP001'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail(),

  strongPassword,

  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  // Spec: role is Employee or HR at signup
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['employee', 'hr'])
    .withMessage('Role must be either employee or hr'),
];

// Sign In: Email and Password
const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

module.exports = { registerValidator, loginValidator, strongPassword };