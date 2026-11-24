const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const limits = require('../middleware/rateLimits');

// Public routes
router.post('/send-otp', limits.teamMail, authController.sendRegisterOtp);
router.post('/register', limits.register, authController.register);
router.post('/verify-email', limits.teamCode, authController.verifyEmail);
router.post('/login', limits.login, authController.login);
router.post('/forgot-password', limits.teamMail, authController.forgotPassword);
router.post('/reset-password', limits.teamCode, authController.resetPassword);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
