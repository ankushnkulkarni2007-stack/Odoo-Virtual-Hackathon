const express = require('express');
const { applyLeaveValidator, leaveDecisionValidator } = require('../validators/leaveValidator');
const handleValidation = require('../middlewares/handleValidation');
const leaveController = require('../controllers/leaveController');

const router = express.Router();

// Employee applies for leave
router.post('/apply', applyLeaveValidator, handleValidation, leaveController.apply);

// Get leave requests (employee - own requests, admin - all requests)
router.get('/', leaveController.getRequests);

// Get leave request by ID
router.get('/:id', leaveController.getById);

// Admin/HR approves or rejects leave request
router.patch('/:id/decision', leaveDecisionValidator, handleValidation, leaveController.makeDecision);

module.exports = router;
