const Form = require('../../../models/Form');
const Participant = require('../models/Participant');
const { verifyToken } = require('../services/tokenService');
const { failure } = require('../services/otpService');
const formParticipantMiddleware = async (req, res, next) => {
  try {
    const value = req.params.slugOrId;
    const query = /^[a-f\d]{24}$/i.test(value) ? { $or: [{ slug: value }, { _id: value }] } : { slug: value };
    const form = await Form.findOne(query);
    if (!form) throw failure(404, 'Form bulunamadı.');
    req.submissionForm = form;
    const required = form.settings.verificationRequired || form.settings.requireAuth || !form.settings.allowMultipleSubmissions;
    const header = req.headers.authorization;
    if (!header) {
      if (required) throw failure(401, 'Formu doldurmak için Google veya e-posta doğrulaması gereklidir.');
      return next();
    }
    let payload;
    try {
      if (!/^Bearer \S+$/.test(header)) throw new Error();
      payload = verifyToken(header.slice(7));
    } catch { throw failure(401, 'Katılımcı oturumu geçersiz veya süresi dolmuş. Yeniden doğrulayınız.'); }
    if (required && !form.settings.verificationMethods.includes(payload.method)) {
      throw failure(403, 'Bu form seçilen doğrulama yöntemini kabul etmiyor.');
    }
    const participant = await Participant.findById(payload.sub);
    if (!participant) throw failure(401, 'Katılımcı bulunamadı.');
    req.participant = participant;
    req.participantVerification = payload;
    next();
  } catch (error) { next(error); }
};
module.exports = formParticipantMiddleware;
