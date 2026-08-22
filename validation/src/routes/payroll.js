const express = require('express');
const { updateSalaryValidator } = require('../validators/payrollValidator');
const handleValidation = require('../middlewares/handleValidation');
const payrollController = require('../controllers/payrollController');

const router = express.Router();

// Get payroll data (employee - own payroll, admin - all payroll)
router.get('/', payrollController.getPayroll);

// Get payroll by employee ID
router.get('/:employeeId', payrollController.getByEmployeeId);

// Admin updates salary structure
router.put('/:employeeId', updateSalaryValidator, handleValidation, payrollController.updateSalary);

module.exports = router;
