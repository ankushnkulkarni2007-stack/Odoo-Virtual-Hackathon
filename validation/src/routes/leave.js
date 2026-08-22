const express = require('express');
const { applyLeaveValidator, leaveDecisionValidator } = require('../validators/leaveValidator');
const handleValidation = require('../middlewares/handleValidation');
const { protect, authorize } = require('../middlewares/auth');
const leaveController = require('../controllers/leaveController');

const router = express.Router();

router.use(protect);

router.post('/apply', applyLeaveValidator, handleValidation, leaveController.apply);

router.get('/', leaveController.getRequests);
router.get('/:id', leaveController.getById);

// Approve / reject is an Admin/HR action (Spec 3.5.2)
router.patch(
  '/:id/decision',
  authorize('admin', 'hr'),
  leaveDecisionValidator,
  handleValidation,
  leaveController.makeDecision
);

module.exports = router;
