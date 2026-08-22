const express = require('express');
const {
  checkInValidator,
  checkOutValidator,
  attendanceStatusValidator,
} = require('../validators/attendanceValidator');
const handleValidation = require('../middlewares/handleValidation');
const { protect, authorize } = require('../middlewares/auth');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();

router.use(protect);

router.post('/check-in', checkInValidator, handleValidation, attendanceController.checkIn);
router.post('/check-out', checkOutValidator, handleValidation, attendanceController.checkOut);

// Manual status override is an Admin/HR action
router.put(
  '/status',
  authorize('admin', 'hr'),
  attendanceStatusValidator,
  handleValidation,
  attendanceController.setStatus
);

// Employees get their own records, Admin/HR get everyone's (Spec 3.4.2)
router.get('/', attendanceController.getRecords);

module.exports = router;
