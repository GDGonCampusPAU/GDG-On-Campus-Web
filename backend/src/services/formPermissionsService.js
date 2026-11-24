// Admin-controlled participant permissions on a registration form.
// Stored on form.settings; a missing value (forms created before these settings) means enabled.
const Form = require('../models/Form');

const failure = (status, message) => Object.assign(new Error(message), { status });

const REASON_MAX = 120;
const ENDING_MAX = 200;

/** The sentence the registration page shows while registration is closed. */
const closedMessage = (reason, ending) =>
  `İlginiz için teşekkür ederiz, ${reason} için kaydınızı yapamıyoruz. ${ending}`.trim();

/** @returns {{ teamChanges: boolean, answerEditing: boolean, projectUpload: boolean, registration: boolean, closedReason: string, closedEnding: string }} */
const permissionsOf = (form) => {
  const settings = form?.settings || {};
  return {
    teamChanges: settings.teamChangesEnabled !== false,
    answerEditing: settings.answerEditingEnabled !== false,
    projectUpload: settings.projectUploadEnabled !== false,
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
  for (const [key, setting] of [['teamChanges', 'teamChangesEnabled'], ['answerEditing', 'answerEditingEnabled'], ['projectUpload', 'projectUploadEnabled'], ['registration', 'registrationEnabled']]) {
    if (body?.[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') throw failure(400, `${key} alanı true veya false olmalıdır.`);
    $set[`settings.${setting}`] = body[key];
  }
  if (!Object.keys($set).length) throw failure(400, 'Değiştirilecek bir izin gönderilmedi (teamChanges, answerEditing, projectUpload, registration).');
  if (body.registration === false) {
    $set['settings.registrationClosedReason'] = text(body.closedReason, 'Kayıtların kapanma nedeni', REASON_MAX);
    $set['settings.registrationClosedEnding'] = text(body.closedEnding, 'Kapanış cümlesi', ENDING_MAX);
  }
  const form = await findForm(id);
  await Form.updateOne({ _id: form._id }, { $set }, { timestamps: false, runValidators: true });
  return getPermissions(id);
};

module.exports = { permissionsOf, registrationOf, closedMessage, getPermissions, updatePermissions };
