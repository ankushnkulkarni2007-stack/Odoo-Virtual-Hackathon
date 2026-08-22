const express = require('express');
const { employeeValidator } = require('../validators/employeeValidator');
const {
  employeeProfileUpdateValidator,
  adminProfileUpdateValidator,
} = require('../validators/profileValidator');
const handleValidation = require('../middlewares/handleValidation');
const { protect, authorize } = require('../middlewares/auth');
const employeeController = require('../controllers/employeeController');

const router = express.Router();

// Every employee route requires a logged-in user
router.use(protect);

// Admin/HR only
router.post(
  '/',
  authorize('admin', 'hr'),
  employeeValidator,
  handleValidation,
  employeeController.create
);
router.get('/', authorize('admin', 'hr'), employeeController.getAll);

// Employees may read their own profile; the controller enforces that
router.get('/:id', employeeController.getById);

// Employee self-service: address, phone, profile picture only
router.patch(
  '/:id/self',
  employeeProfileUpdateValidator,
  handleValidation,
  employeeController.updateSelf
);

// Admin/HR: any field
router.patch(
  '/:id/admin',
  authorize('admin', 'hr'),
  adminProfileUpdateValidator,
  handleValidation,
  employeeController.updateByAdmin
);

module.exports = router;
