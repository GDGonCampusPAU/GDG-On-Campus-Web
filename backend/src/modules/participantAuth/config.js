const jwt = require('jsonwebtoken');
const positiveInteger = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} pozitif tam sayı olmalıdır.`);
  return value;
};
const getConfig = () => {
  const secret = process.env.PARTICIPANT_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_key_here') throw new Error('PARTICIPANT_JWT_SECRET veya gerçek JWT_SECRET ayarlanmalıdır.');
  if (process.env.NODE_ENV === 'production' && secret.length < 32) throw new Error('Katılımcı JWT anahtarı en az 32 karakter olmalıdır.');
  const expiresIn = process.env.PARTICIPANT_JWT_EXPIRES_IN || '1h';
  // Fail at startup for invalid duration strings, rather than after consuming an OTP.
  if (!/^\d+(?:ms|s|m|h|d|w)$/.test(expiresIn)) throw new Error('PARTICIPANT_JWT_EXPIRES_IN örneğin 15m veya 1h olmalıdır.');
  const probe = jwt.decode(jwt.sign({ type: 'participant' }, secret, { expiresIn }));
  if (probe.exp <= probe.iat) throw new Error('Katılımcı token süresi en az 1 saniye olmalıdır.');
  return {
    secret, expiresIn,
    otpTtlMinutes: positiveInteger('PARTICIPANT_OTP_TTL_MINUTES', 10),
    otpCooldownSeconds: positiveInteger('PARTICIPANT_OTP_COOLDOWN_SECONDS', 60),
    otpMaxAttempts: positiveInteger('PARTICIPANT_OTP_MAX_ATTEMPTS', 5),
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  };
};
module.exports = { getConfig };
