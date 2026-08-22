const express = require('express');
const { checkInValidator, checkOutValidator, attendanceStatusValidator } = require('../validators/attendanceValidator');
const handleValidation = require('../middlewares/handleValidation');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();

// Employee check-in
router.post('/check-in', checkInValidator, handleValidation, attendanceController.checkIn);

// Employee check-out
router.post('/check-out', checkOutValidator, handleValidation, attendanceController.checkOut);

// Admin/HR manually set attendance status (Present/Absent/Half-day/Leave)
router.put('/status', attendanceStatusValidator, handleValidation, attendanceController.setStatus);

// Get attendance records (employee - own records, admin - all records)
router.get('/', attendanceController.getRecords);

module.exports = router;
