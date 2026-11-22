const Juror = require('../models/Juror');
const { TOKEN_PATTERN, hashToken } = require('../services/tokenService');
const { invalidTokenLimiter } = require('./limits');

const rejectToken = (req, res, next) => invalidTokenLimiter(req, res, error => {
  if (error) return next(error);
  res.status(401).json({
    success: false,
    code: 'JURY_LINK_INVALID',
    message: 'Bu jüri linki geçersiz, organizasyon ekibiyle iletişime geçin.'
  });
});

/**
 * Finds the active juror behind `Authorization: Bearer <token>` and records when they were last seen.
 * @type {import('express').RequestHandler}
 */
const jurorAuth = async (req, res, next) => {
  try {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || !TOKEN_PATTERN.test(token)) return await rejectToken(req, res, next);
    const juror = await Juror.findOneAndUpdate(
      { tokenHash: hashToken(token), active: true },
      { $set: { lastSeenAt: new Date() } },
      { returnDocument: 'after', timestamps: false }
    );
    if (!juror) return await rejectToken(req, res, next);
    req.juror = juror;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = jurorAuth;
