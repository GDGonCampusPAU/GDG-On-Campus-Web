const { randomInt, createHmac } = require('node:crypto');
const ParticipantOtp = require('../models/ParticipantOtp');
const { getConfig } = require('../config');
const emailService = require('../../../services/emailService');
const failure = (status, message) => Object.assign(new Error(message), { status });
const hash = (email, code) => createHmac('sha256', getConfig().secret).update(`${email}:${code}`).digest('hex');

const sendOtp = async (email) => {
  const config = getConfig();
  if (process.env.NODE_ENV === 'production' && (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY === 'your_brevo_api_key_here')) {
    throw failure(503, 'E-posta servisi yapılandırılmamış.');
  }
  const now = new Date();
  const code = String(randomInt(100000, 1000000));
  const codeHash = hash(email, code);
  // Conditional upsert + unique email serializes concurrent sends and enforces cooldown.
  try {
    await ParticipantOtp.findOneAndUpdate({ email, resendAfter: { $lte: now } }, { $set: {
      codeHash, attempts: 0, createdAt: now,
      expiresAt: new Date(now.getTime() + config.otpTtlMinutes * 60000),
      resendAfter: new Date(now.getTime() + config.otpCooldownSeconds * 1000)
    } }, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code === 11000) throw failure(429, 'Yeni kod istemeden önce bekleyiniz.');
    throw error;
  }
  try {
    await emailService.sendEmail({ to: email, subject: 'Etkinlik kaydı e-posta doğrulaması',
      textContent: `Doğrulama kodunuz: ${code}. ${config.otpTtlMinutes} dakika geçerlidir.`,
      htmlContent: `<p>Etkinlik kaydı doğrulama kodunuz: <strong>${code}</strong></p><p>${config.otpTtlMinutes} dakika geçerlidir.</p>` });
  } catch (error) {
    await ParticipantOtp.deleteOne({ email, codeHash });
    throw failure(502, 'Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyiniz.');
  }
  return { expiresInSeconds: config.otpTtlMinutes * 60, resendAfterSeconds: config.otpCooldownSeconds };
};
const verifyOtp = async (email, code) => {
  const now = new Date();
  const max = getConfig().otpMaxAttempts;
  // A correct code is consumed in one atomic operation; concurrent replays cannot succeed.
  const consumed = await ParticipantOtp.findOneAndDelete({ email, codeHash: hash(email, code),
    expiresAt: { $gt: now }, attempts: { $lt: max } });
  if (consumed) return;
  await ParticipantOtp.updateOne({ email, expiresAt: { $gt: now }, attempts: { $lt: max } }, { $inc: { attempts: 1 } });
  throw failure(400, 'Kod hatalı, süresi dolmuş veya deneme hakkı bitmiş.');
};
module.exports = { sendOtp, verifyOtp, failure };
