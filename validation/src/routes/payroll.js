const express = require('express');
const { updateSalaryValidator } = require('../validators/payrollValidator');
const handleValidation = require('../middlewares/handleValidation');
const { protect, authorize } = require('../middlewares/auth');
const payrollController = require('../controllers/payrollController');

const router = express.Router();

router.use(protect);

// Read: employees see their own, Admin/HR see all (Spec 3.6.1)
router.get('/', payrollController.getPayroll);
router.get('/:employeeId', payrollController.getByEmployeeId);

// Write: Admin only (Spec 3.6.2 assigns salary control to Admin).
// Add 'hr' to the authorize call if HR should be able to change salaries too.
router.put(
  '/:employeeId',
  authorize('admin'),
  updateSalaryValidator,
  handleValidation,
  payrollController.updateSalary
);

module.exports = router;
