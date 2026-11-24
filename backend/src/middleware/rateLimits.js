// A whole hall shares one public IP, so a limit that everyone has to pass must not be keyed by IP
// alone: one visitor would use it up for all the others.
//   - signed-in people are counted per person,
//   - password and code checks per account + IP,
//   - an IP-wide ceiling stays only where a request costs an e-mail.
const { createHash } = require('node:crypto');
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('../utils/jwt');
const participantTokens = require('../modules/participantAuth/services/tokenService');
const Participant = require('../modules/participantAuth/models/Participant');
const otpService = require('../modules/participantAuth/services/otpService');

const LIMITS = {
  anonymous: 200,
  signedIn: 600,
  login: 30,
  teamCode: 30,
  teamMail: 30,
  participantCode: 15,
  participantMail: 100,
  google: 300
};

/** @param {Partial<import('express-rate-limit').Options>} options @param {string} message */
const limiter = (options, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message },
  ...options
});

/** @returns {string | null} who signed the bearer token; null without a valid signature */
const signedIdentity = req => {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return null;
  try {
    /** @type {any} */
    const claims = verifyToken(token);
    if (claims.id && claims.type !== 'participant') return `team:${claims.id}:${claims.tokenVersion ?? 0}`;
  } catch { /* not a team token */ }
  try {
    return `participant:${participantTokens.verifyToken(token).sub}`;
  } catch {
    return null;
  }
};

// The same normalization as the controllers, so case or padding cannot open a second bucket.
// Hashed: the key stays short however long the submitted value is.
const accountKey = req => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  return `${ipKeyGenerator(req.ip || '')}|${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
};

const general = limiter({
  limit: req => (signedIdentity(req) ? LIMITS.signedIn : LIMITS.anonymous),
  keyGenerator: req => signedIdentity(req) || ipKeyGenerator(req.ip || ''),
  skip: req => Boolean(req.ownLimit)
}, 'Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyiniz.');

const AUTH_MESSAGE = 'Çok fazla kimlik doğrulama denemesi. Lütfen bir süre sonra tekrar deneyiniz.';
const login = limiter({ limit: LIMITS.login, keyGenerator: accountKey, skipSuccessfulRequests: true }, AUTH_MESSAGE);
const teamCode = limiter({ limit: LIMITS.teamCode, keyGenerator: accountKey, skipSuccessfulRequests: true }, AUTH_MESSAGE);
const teamMail = limiter({ limit: LIMITS.teamMail }, AUTH_MESSAGE);
/** Registration without a code sends a mail; with a code it is a code check. @type {import('express').RequestHandler} */
const register = (req, res, next) => (req.body?.code ? teamCode : teamMail)(req, res, next);

const PARTICIPANT_MESSAGE = 'Çok fazla doğrulama isteği. Daha sonra tekrar deneyiniz.';
const participantCode = limiter({ limit: LIMITS.participantCode, keyGenerator: accountKey, skipSuccessfulRequests: true }, PARTICIPANT_MESSAGE);
// The ceiling protects the mail quota against made-up addresses. People who verified before are not
// counted (the 60 s cooldown per address still applies), so such a flood cannot lock the hall out.
// Nobody may learn from the answer who they are: no RateLimit headers, the same body for everyone,
// and over the ceiling their mail goes out without being awaited.
const mailLimited = (_req, res) => res.status(429).json({
  success: false,
  code: 'MAIL_LIMITED',
  message: 'Şu an çok fazla kod isteniyor. Adresin daha önce doğrulandıysa kod yine gönderildi; gelmezse biraz sonra tekrar dene.'
});
const participantMailCeiling = limiter({ limit: LIMITS.participantMail, standardHeaders: false, handler: mailLimited }, PARTICIPANT_MESSAGE);
/** @type {import('express').RequestHandler} */
const participantMail = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' && req.body.email.length <= 254 ? req.body.email.trim().toLowerCase() : '';
    if (!(await Participant.exists({ email }))) return await participantMailCeiling(req, res, next);
    const used = await participantMailCeiling.getKey(ipKeyGenerator(req.ip || ''));
    if ((used?.totalHits ?? 0) < LIMITS.participantMail) return next();
    otpService.sendOtp(email).catch(() => { /* cooldown or mail failure: the answer must not differ */ });
    return mailLimited(req, res);
  } catch (error) {
    next(error);
  }
};
const google = limiter({ limit: LIMITS.google, skipSuccessfulRequests: true }, PARTICIPANT_MESSAGE);

const SIGN_IN_PATHS = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/send-otp', '/api/v1/auth/verify-email',
  '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password', '/api/v1/participant-auth/email/send-otp',
  '/api/v1/participant-auth/email/verify', '/api/v1/participant-auth/google'];
// Read before sign-in by the sign-in form and the staff screens; each is an indexed lookup.
const SIGN_IN_READS = ['/api/v1/event-page/hackathon', '/api/v1/forms/public/:slugOrId'];

/**
 * Must run before `general`. These requests leave the shared bucket: the POST routes carry their own
 * limiter inside their router, so a path that does not match here only falls back to the general limit.
 * Their bodies are read with a small size cap, because it happens before any limit.
 * @param {import('express').Express} app
 */
const mountSignIn = app => {
  const markOwnLimit = (req, _res, next) => {
    req.ownLimit = true;
    next();
  };
  app.post(SIGN_IN_PATHS, express.json({ limit: '16kb' }), express.urlencoded({ extended: true, limit: '16kb' }), markOwnLimit);
  app.get(SIGN_IN_READS, markOwnLimit);
};

module.exports = { LIMITS, mountSignIn, general, login, teamCode, teamMail, register, participantCode, participantMail, google };
