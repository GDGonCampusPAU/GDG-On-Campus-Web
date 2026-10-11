const Participant = require('../models/Participant');
const otpService = require('../services/otpService');
const googleService = require('../services/googleService');
const { issueToken } = require('../services/tokenService');
const { isValidEmail } = require('../../../utils/validators');
const normalizeEmail = (email) => {
  if (!isValidEmail(email) || email.length > 254) throw otpService.failure(400, 'Geçerli e-posta adresi giriniz.');
  return email.trim().toLowerCase();
};
const saveParticipant = async (email, extra = {}) => {
  try {
    const query = extra.googleSubject
      ? { email, $or: [{ googleSubject: { $exists: false } }, { googleSubject: extra.googleSubject }] }
      : { email };
    return await Participant.findOneAndUpdate(query, { $set: { ...extra, emailVerifiedAt: new Date() } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Email races may converge; conflicting Google subjects must not link accounts.
    const participant = await Participant.findOne({ email });
    if (!participant || (extra.googleSubject && participant.googleSubject !== extra.googleSubject)) throw error;
    return participant;
  }
};
const sendOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const timing = await otpService.sendOtp(email);
    res.json({ success: true, message: 'Doğrulama kodu gönderildi.', ...timing });
  } catch (error) { next(error); }
};
const verifyEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw otpService.failure(400, 'Kod 6 haneli metin olmalıdır.');
    await otpService.verifyOtp(email, code);
    const participant = await saveParticipant(email);
    res.json({ success: true, ...issueToken(participant, 'EMAIL_OTP') });
  } catch (error) { next(error); }
};
const google = async (req, res, next) => {
  try {
    if (typeof req.body?.idToken !== 'string' || !req.body.idToken || req.body.idToken.length > 10000) {
      throw otpService.failure(400, 'Google idToken zorunludur.');
    }
    const identity = await googleService.verifyGoogle(req.body.idToken);
    const existing = await Participant.findOne({ googleSubject: identity.googleSubject });
    if (existing && existing.email !== identity.email) throw otpService.failure(409, 'Google hesabının e-postası değişmiş; destek ile iletişime geçiniz.');
    const byEmail = await Participant.findOne({ email: identity.email });
    if (byEmail?.googleSubject && byEmail.googleSubject !== identity.googleSubject) throw otpService.failure(409, 'E-posta başka Google hesabıyla ilişkilendirilmiş.');
    const participant = await saveParticipant(identity.email, identity);
    res.json({ success: true, ...issueToken(participant, 'GOOGLE') });
  } catch (error) { next(error); }
};
module.exports = { sendOtp, verifyEmail, google };
