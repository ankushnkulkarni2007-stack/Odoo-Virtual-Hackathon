const express = require('express');
const { employeeValidator } = require('../validators/employeeValidator');
const { employeeProfileUpdateValidator, adminProfileUpdateValidator } = require('../validators/profileValidator');
const handleValidation = require('../middlewares/handleValidation');
const employeeController = require('../controllers/employeeController');

const router = express.Router();

// Create a new employee (Admin only)
router.post('/', employeeValidator, handleValidation, employeeController.create);

// Get all employees (Admin only)
router.get('/', employeeController.getAll);

// Get employee by ID
router.get('/:id', employeeController.getById);

// Employee updates their own profile (address, phone, profile picture only)
router.patch('/:id/self', employeeProfileUpdateValidator, handleValidation, employeeController.updateSelf);

// Admin updates employee profile (all fields)
router.patch('/:id/admin', adminProfileUpdateValidator, handleValidation, employeeController.updateByAdmin);

module.exports = router;
