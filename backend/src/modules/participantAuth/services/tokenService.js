const jwt = require('jsonwebtoken');
const { getConfig } = require('../config');
const ISSUER = 'gdg-pau';
const AUDIENCE = 'form-participant';
const issueToken = (participant, method) => {
  const { secret, expiresIn } = getConfig();
  const verifiedAt = new Date().toISOString();
  const token = jwt.sign({ type: 'participant', method, verifiedAt }, secret, {
    algorithm: 'HS256', subject: String(participant._id), audience: AUDIENCE, issuer: ISSUER, expiresIn
  });
  const { exp } = jwt.decode(token);
  return { token, tokenType: 'Bearer', expiresAt: new Date(exp * 1000).toISOString(),
    participant: { id: participant._id, email: participant.email, fullName: participant.fullName },
    verificationMethod: method };
};
const verifyToken = (token) => {
  const payload = jwt.verify(token, getConfig().secret, { algorithms: ['HS256'], audience: AUDIENCE, issuer: ISSUER });
  if (payload.type !== 'participant' || !['GOOGLE', 'EMAIL_OTP'].includes(payload.method) ||
      !/^[a-f\d]{24}$/i.test(payload.sub) || !Number.isFinite(Date.parse(payload.verifiedAt))) {
    throw new Error('Geçersiz katılımcı kimliği.');
  }
  return payload;
};
module.exports = { issueToken, verifyToken };
