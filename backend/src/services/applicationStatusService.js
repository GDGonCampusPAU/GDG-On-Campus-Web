const { sendApplicationStatusEmail } = require('./emailService');
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
  const teamName = answersMap.get('teamName') || '';
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
    lastNotifiedAt: doc.lastNotifiedAt || null
  };

  const now = new Date();
  doc.status = status;
  doc.statusNote = trimmedNote;
  doc.reviewedBy = reviewerId || null;
  doc.reviewedAt = now;
  if (shouldNotify) {
    doc.lastNotifiedStatus = status;
    doc.lastNotifiedAt = now;
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

module.exports = {
  APPLICATION_STATUSES,
  buildStatusFilter,
  combineFilters,
  resolveFormApplicant,
  updateApplicationDecision
};

