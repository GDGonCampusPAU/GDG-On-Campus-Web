const { sendApplicationStatusEmail, sendWhatsappInviteEmail } = require('./emailService');
const FormResponse = require('../models/FormResponse');
const { isValidEmail } = require('../utils/validators');

const APPLICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const buildStatusFilter = (status) => {
  if (!status) return null;
  if (status === 'PENDING') {
    return { $or: [{ status: 'PENDING' }, { status: { $exists: false } }] };
  }
  return { status };
};

const combineFilters = (...clauses) => {
  const valid = clauses.filter(Boolean);
  if (valid.length === 0) return {};
  if (valid.length === 1) return valid[0];
  return { $and: valid };
};

const resolveFormApplicant = (response) => {
  const answersMap = new Map((response.answers || []).map((answer) => [answer.fieldId, answer.value]));
  const candidateEmails = [
    response.verifiedEmail,
    answersMap.get('email'),
    answersMap.get('leaderEmail')
  ];
  const email = candidateEmails.find((value) => typeof value === 'string' && isValidEmail(value.trim()))?.trim().toLowerCase() || null;
  const fullName = answersMap.get('fullName') || answersMap.get('leaderName') || '';
  const teamName = answersMap.get('teamName') || response.teamName || '';
  return {
    email,
    recipientName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : email || 'Katılımcı',
    teamName: typeof teamName === 'string' ? teamName.trim() : ''
  };
};

const updateApplicationDecision = async ({
  doc,
  reviewerId,
  status,
  note = '',
  notify,
  recipientEmail,
  recipientName,
  teamName = '',
  eventTitle = 'PAU Hackathon 2026'
}) => {
  if (!APPLICATION_STATUSES.includes(status)) {
    throw Object.assign(new Error('Geçersiz başvuru durumu (PENDING, APPROVED, REJECTED olmalıdır).'), { status: 400 });
  }
  if (note != null && typeof note !== 'string') {
    throw Object.assign(new Error('Değerlendirme notu metin olmalıdır.'), { status: 400 });
  }
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  if (trimmedNote.length > 1000) {
    throw Object.assign(new Error('Değerlendirme notu en fazla 1000 karakter olabilir.'), { status: 400 });
  }
  if (notify !== undefined && typeof notify !== 'boolean') {
    throw Object.assign(new Error('Bildirim tercihi boolean olmalıdır.'), { status: 400 });
  }

  const shouldNotify = notify !== undefined ? notify : status !== 'PENDING';
  if (shouldNotify && status === 'PENDING') {
    throw Object.assign(new Error('Beklemede durumu için onay/red bildirim e-postası gönderilemez.'), { status: 400 });
  }
  if (shouldNotify && (!recipientEmail || !isValidEmail(recipientEmail))) {
    throw Object.assign(new Error('Katılımcının geçerli bir e-posta adresi bulunamadığı için bildirim gönderilemedi.'), { status: 400 });
  }

  const previous = {
    status: doc.status || 'PENDING',
    statusNote: doc.statusNote || '',
    reviewedBy: doc.reviewedBy || null,
    reviewedAt: doc.reviewedAt || null,
    lastNotifiedStatus: doc.lastNotifiedStatus || null,
    lastNotifiedAt: doc.lastNotifiedAt || null,
    whatsappInvitedAt: doc.whatsappInvitedAt || null
  };

  const now = new Date();
  doc.status = status;
  doc.statusNote = trimmedNote;
  doc.reviewedBy = reviewerId || null;
  doc.reviewedAt = now;
  if (shouldNotify) {
    doc.lastNotifiedStatus = status;
    doc.lastNotifiedAt = now;
    // Onay e-postası zaten WhatsApp davet bağlantısını içerir; ikinci kez toplu davet gitmesini önle.
    if (status === 'APPROVED' && !doc.whatsappInvitedAt) {
      doc.whatsappInvitedAt = now;
    }
  }

  await doc.save();

  if (shouldNotify) {
    try {
      await sendApplicationStatusEmail({
        email: recipientEmail,
        recipientName,
        teamName,
        eventTitle,
        status,
        note: trimmedNote
      });
    } catch (error) {
      Object.assign(doc, previous);
      await doc.save().catch(() => {});
      throw error;
    }
  }

  return {
    application: doc,
    emailSent: shouldNotify
  };
};

/** @param {import('mongoose').Types.ObjectId | string} formId */
const whatsappPendingFilter = (formId) => ({
  form: formId,
  status: /** @type {const} */ ('APPROVED'),
  $or: [{ whatsappInvitedAt: null }, { whatsappInvitedAt: { $exists: false } }]
});

/**
 * Send individual WhatsApp channel invitation emails only to APPROVED form responses
 * that have not received a WhatsApp invite yet (`whatsappInvitedAt` is unset/null).
 * @param {{ formId: import('mongoose').Types.ObjectId | string, responseId?: string | null, eventTitle?: string }} params
 */
const sendWhatsappInvitesForForm = async ({ formId, responseId = null, eventTitle = 'Pamukkale Hackathon' }) => {
  if (responseId) {
    const target = await FormResponse.findOne({ _id: responseId, form: formId });
    if (!target) {
      throw Object.assign(new Error('Başvuru yanıtı bulunamadı.'), { status: 404 });
    }
    if (target.status !== 'APPROVED') {
      throw Object.assign(new Error('WhatsApp daveti yalnızca onaylanmış başvurulara gönderilebilir.'), { status: 400 });
    }
    if (target.whatsappInvitedAt) {
      throw Object.assign(new Error('Bu katılımcıya WhatsApp daveti daha önce gönderilmiş.'), { status: 409 });
    }

    const { email, recipientName, teamName } = resolveFormApplicant(target);
    if (!email) {
      throw Object.assign(new Error('Katılımcının geçerli bir e-posta adresi bulunamadı.'), { status: 400 });
    }

    await sendWhatsappInviteEmail({ email, recipientName, teamName, eventTitle });
    target.whatsappInvitedAt = new Date();
    await target.save();

    return {
      totalPending: 1,
      sentCount: 1,
      skippedCount: 0,
      failedCount: 0,
      skipped: [],
      failed: [],
      updatedId: target._id
    };
  }

  const pendingDocs = await FormResponse.find(whatsappPendingFilter(formId)).sort({ submittedAt: 1 });
  const sentEmails = new Set();
  let sentCount = 0;
  const skipped = [];
  const failed = [];

  for (const doc of pendingDocs) {
    const { email, recipientName, teamName } = resolveFormApplicant(doc);
    if (!email) {
      skipped.push({ id: String(doc._id), reason: 'Geçerli e-posta bulunamadı.' });
      continue;
    }
    if (sentEmails.has(email)) {
      doc.whatsappInvitedAt = new Date();
      await doc.save();
      skipped.push({ id: String(doc._id), email, reason: 'Aynı e-posta adresine bu oturumda davet gönderildi.' });
      continue;
    }

    try {
      await sendWhatsappInviteEmail({ email, recipientName, teamName, eventTitle });
      doc.whatsappInvitedAt = new Date();
      await doc.save();
      sentEmails.add(email);
      sentCount += 1;
    } catch (error) {
      failed.push({ id: String(doc._id), email, error: error.message });
    }
  }

  return {
    totalPending: pendingDocs.length,
    sentCount,
    skippedCount: skipped.length,
    failedCount: failed.length,
    skipped,
    failed
  };
};

module.exports = {
  APPLICATION_STATUSES,
  whatsappPendingFilter,
  buildStatusFilter,
  combineFilters,
  resolveFormApplicant,
  updateApplicationDecision,
  sendWhatsappInvitesForForm
};

