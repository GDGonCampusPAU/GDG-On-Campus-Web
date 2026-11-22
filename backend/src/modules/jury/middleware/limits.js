// The jury routes do not use the general limit (200 requests / 15 min per IP): the whole hall
// shares one Wi-Fi IP, and autosave plus the results refresh would exhaust it during scoring.
//   1. a high ceiling per IP,
//   2. a limit per juror / per staff user once they are authenticated,
//   3. a strict limit on failed token checks only, so it can never block a valid juror.
const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { ip: 6000, juror: 900, staff: 2000, invalidToken: 30 };
const PATHS = ['/api/v1/jury', '/api/v1/jury-admin'];

/**
 * @param {number} limit
 * @param {Partial<import('express-rate-limit').Options>} [options]
 */
const limiter = (limit, options = {}) => rateLimit({
  windowMs: WINDOW_MS,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
  ...options
});

const ipLimiter = limiter(LIMITS.ip);
// Remembers that this request really matched a jury mount. Comparing path strings in `skip`
// instead would have to repeat Express' own matching rules (case, slashes, encoding).
const markJuryRequest = (req, _res, next) => {
  req.juryRequest = true;
  next();
};

const jurorLimiter = limiter(LIMITS.juror, { keyGenerator: req => String(req.juror._id) });
const staffLimiter = limiter(LIMITS.staff, { keyGenerator: req => String(req.user._id) });
const invalidTokenLimiter = limiter(LIMITS.invalidToken, {
  message: { success: false, code: 'RATE_LIMITED', message: 'Çok fazla geçersiz jüri linki denemesi yapıldı. Organizasyon ekibiyle iletişime geçin.' }
});

module.exports = { LIMITS, PATHS, ipLimiter, markJuryRequest, jurorLimiter, staffLimiter, invalidTokenLimiter };
