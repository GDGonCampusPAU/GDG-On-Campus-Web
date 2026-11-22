// The hall shares one Wi-Fi IP, so no jury limit that a valid person has to pass is keyed by IP:
//   1. a limit per juror / per staff login,
//   2. a strict limit per IP that only failed credential checks ever reach.
// There is deliberately no IP ceiling in front of authentication. One client could use it up for
// every juror. The routers authenticate before they parse a body, so a rejected request stays cheap.
const { rateLimit } = require('express-rate-limit');
const { verifyToken } = require('../../../utils/jwt');

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { juror: 900, staff: 2000, invalidToken: 30 };

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

const jurorLimiter = limiter(LIMITS.juror, { keyGenerator: req => String(req.juror._id) });
// Only a failed check gets here, so the code still says "invalid link": the screen must not retry it.
const invalidTokenLimiter = limiter(LIMITS.invalidToken, {
  message: { success: false, code: 'JURY_LINK_INVALID', message: 'Bu jüri linki geçersiz, organizasyon ekibiyle iletişime geçin.' }
});

const staffLimiter = limiter(LIMITS.staff, { keyGenerator: req => req.staffKey });
const invalidStaffLimiter = limiter(LIMITS.invalidToken);

/**
 * Runs before authMiddleware. A correctly signed token is counted per login, everything else per IP;
 * authMiddleware then does the real check (user, role, revocation).
 * @type {import('express').RequestHandler}
 */
const staffGate = (req, res, next) => {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
  if (token) {
    try {
      /** @type {any} */
      const claims = verifyToken(token);
      if (claims.id && claims.type !== 'participant') {
        req.staffKey = `${claims.id}:${claims.tokenVersion ?? 0}`;
        return staffLimiter(req, res, next);
      }
    } catch { /* not a team token */ }
  }
  return invalidStaffLimiter(req, res, next);
};

module.exports = { LIMITS, jurorLimiter, invalidTokenLimiter, staffGate };
