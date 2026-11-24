// Admin-controlled participant permissions on a registration form.
// Stored on form.settings; a missing value (forms created before these settings) means enabled.
const Form = require('../models/Form');
const EventPage = require('../models/EventPage');

const failure = (status, message) => Object.assign(new Error(message), { status });

const REASON_MAX = 120;
const ENDING_MAX = 200;

/** The sentence the registration page shows while registration is closed. */
const closedMessage = (reason, ending) =>
  `İlginiz için teşekkür ederiz, ${reason} için kaydınızı yapamıyoruz. ${ending}`.trim();

/** @returns {{ teamChanges: boolean, answerEditing: boolean, registration: boolean, closedReason: string, closedEnding: string }} */
const permissionsOf = (form) => {
  const settings = form?.settings || {};
  return {
    teamChanges: settings.teamChangesEnabled !== false,
    answerEditing: settings.answerEditingEnabled !== false,
    registration: settings.registrationEnabled !== false,
    closedReason: settings.registrationClosedReason || '',
    closedEnding: settings.registrationClosedEnding || ''
  };
};

/** What the public registration page needs: is it open, and if not, what to say. */
const registrationOf = (form) => {
  const { registration, closedReason, closedEnding } = permissionsOf(form);
  return registration ? { open: true, message: '' } : { open: false, message: closedMessage(closedReason, closedEnding) };
};

const ADMIN_ONLY_MESSAGE = 'Etkinlik kayıtlarını açma, kapatma ve sınırlarını değiştirme yalnızca ADMIN yetkisindedir.';

/** Registration of the published event is ADMIN-only on every path; other forms stay with the staff. */
const mayChangeRegistration = async (user, form) => user?.role === 'ADMIN' || !(await EventPage.exists({ formSlug: form.slug }));

const timeOf = value => (value ? new Date(value).getTime() : null);

/**
 * Whether a PUT /forms/:id body changes who can register. Sending the stored values back is no change.
 * Of the settings only the success message is content; every other one is guarded.
 */
const changesRegistration = (form, body) => {
  const { status, slug, startDate, endDate, maxSubmissions, settings } = body;
  if (status !== undefined && status !== form.status) return true;
  if (slug && slug !== form.slug) return true;
  if (startDate !== undefined && timeOf(startDate) !== timeOf(form.startDate)) return true;
  if (endDate !== undefined && timeOf(endDate) !== timeOf(form.endDate)) return true;
  if (maxSubmissions !== undefined && (maxSubmissions ? Number(maxSubmissions) : null) !== (form.maxSubmissions ?? null)) return true;
  if (settings === undefined) return false;
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) return true;
  const stored = form.toObject().settings || {};
  return Object.entries(settings).some(([key, value]) => key !== 'successMessage' && JSON.stringify(value) !== JSON.stringify(stored[key]));
};

const findForm = async (id) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw failure(404, 'Form bulunamadı.');
  const form = await Form.findById(id);
  if (!form) throw failure(404, 'Form bulunamadı.');
  return form;
};

const getPermissions = async (id) => permissionsOf(await findForm(id));

const text = (value, label, max) => {
  if (typeof value !== 'string') throw failure(400, `${label} yazılmalıdır.`);
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) throw failure(400, `${label} en az 2 karakter olmalıdır.`);
  if (clean.length > max) throw failure(400, `${label} en fazla ${max} karakter olabilir.`);
  return clean;
};

/**
 * Partial update: only the permissions sent are changed. Closing registration needs both texts.
 * Saved without touching updatedAt: it is the form's schema version, and bumping it would make
 * everyone who is filling the form right now get "Form güncellendi" on submit.
 */
const updatePermissions = async (id, body) => {
  const $set = {};
  for (const [key, setting] of [['teamChanges', 'teamChangesEnabled'], ['answerEditing', 'answerEditingEnabled'], ['registration', 'registrationEnabled']]) {
    if (body?.[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') throw failure(400, `${key} alanı true veya false olmalıdır.`);
    $set[`settings.${setting}`] = body[key];
  }
  if (!Object.keys($set).length) throw failure(400, 'Değiştirilecek bir izin gönderilmedi (teamChanges, answerEditing, registration).');
  if (body.registration === false) {
    $set['settings.registrationClosedReason'] = text(body.closedReason, 'Kayıtların kapanma nedeni', REASON_MAX);
    $set['settings.registrationClosedEnding'] = text(body.closedEnding, 'Kapanış cümlesi', ENDING_MAX);
  }
  const form = await findForm(id);
  await Form.updateOne({ _id: form._id }, { $set }, { timestamps: false, runValidators: true });
  return getPermissions(id);
};

module.exports = { permissionsOf, registrationOf, closedMessage, getPermissions, updatePermissions, ADMIN_ONLY_MESSAGE, mayChangeRegistration, changesRegistration };
