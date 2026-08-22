const express = require('express');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const handleValidation = require('../middlewares/handleValidation');
const { protect } = require('../middlewares/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// Public
router.post('/register', registerValidator, handleValidation, authController.register);
router.post('/login', loginValidator, handleValidation, authController.login);
router.get('/verify-email/:token', authController.verifyEmail);

// Authenticated
router.get('/me', protect, authController.getMe);

module.exports = router;
