const express = require('express');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const handleValidation = require('../middlewares/handleValidation');
const authController = require('../controllers/authController');

const router = express.Router();

// Sign Up
router.post('/register', registerValidator, handleValidation, authController.register);

// Sign In
router.post('/login', loginValidator, handleValidation, authController.login);

module.exports = router;
