const router = require('express').Router();
const limits = require('../../../middleware/rateLimits');
const controller = require('../controllers/participantAuthController');
router.post('/email/send-otp', limits.participantMail, controller.sendOtp);
router.post('/email/verify', limits.participantCode, controller.verifyEmail);
router.post('/google', limits.google, controller.google);
module.exports = router;
