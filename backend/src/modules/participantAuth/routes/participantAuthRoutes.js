const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/participantAuthController');
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Çok fazla doğrulama isteği. Daha sonra tekrar deneyiniz.' } }));
router.post('/email/send-otp', controller.sendOtp);
router.post('/email/verify', controller.verifyEmail);
router.post('/google', controller.google);
module.exports = router;
