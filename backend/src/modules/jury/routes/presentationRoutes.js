// Public presentation order for the participants' "Başvurum" page (GET /api/v1/presentation).
// Team names only. A hall full of people polls it from a few campus IPs, so it has its own generous
// per-IP ceiling instead of the shared limit, and the service memoizes the answer for 2 seconds.
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const live = require('../services/liveService');

const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10000, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(req.ip || ''),
  message: { success: false, message: 'Çok fazla istek gönderildi. Biraz sonra tekrar deneyin.' } }));
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await live.publicView() });
  } catch (error) { next(error); }
});

module.exports = router;
