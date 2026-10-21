const VerificationToken = require('../models/VerificationToken');
const email = require('./emailService');
const sendTeamOtp = async ({ email: address, purpose, ...details }) => {
  if (process.env.NODE_ENV === 'production' && (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY === 'your_brevo_api_key_here')) {
    throw Object.assign(new Error('E-posta servisi yapılandırılmamış.'), { status: 503 });
  }
  const code = await VerificationToken.generateOtp(address, purpose, 10);
  try {
    const send = purpose === 'REGISTER' ? email.sendRegistrationOtpEmail : email.sendHackathonOtpEmail;
    await send({ email: address, code, ...details });
  } catch {
    await VerificationToken.invalidateOtp(address, purpose, code);
    throw Object.assign(new Error('Doğrulama e-postası gönderilemedi.'), { status: 502 });
  }
};
module.exports = { sendTeamOtp };
