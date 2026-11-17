const { OAuth2Client } = require('google-auth-library');
const { getConfig } = require('../config');
const { failure } = require('./otpService');
const client = new OAuth2Client();
const verifyGoogle = async (idToken) => {
  const { googleClientId } = getConfig();
  if (!googleClientId) throw failure(503, 'Google girişi yapılandırılmamış.');
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw failure(401, 'Google kimlik bilgisi geçersiz veya süresi dolmuş.');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw failure(401, 'Google hesabının e-postası doğrulanmamış.');
  }
  // Google is authoritative for Gmail and verified Workspace domains only.
  if (!payload.email.toLowerCase().endsWith('@gmail.com') && !payload.hd) {
    throw failure(403, 'Bu Google hesabı için e-posta koduyla doğrulama kullanınız.');
  }
  return { email: payload.email.toLowerCase().trim(), fullName: (payload.name || '').slice(0, 100), googleSubject: payload.sub };
};
module.exports = { verifyGoogle };
