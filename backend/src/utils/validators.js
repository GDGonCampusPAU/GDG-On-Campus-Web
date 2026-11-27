// Allowed email domains: Gmail and Pamukkale University
const PAU_OR_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|pau\.edu\.tr|posta\.pau\.edu\.tr)$/i;
const GENERAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates if an email is a valid PAU or Gmail address
 * @param {string} email
 * @returns {boolean}
 */
const isValidPauOrGmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return PAU_OR_GMAIL_REGEX.test(email.trim());
};

/**
 * Validates any standard email address
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return GENERAL_EMAIL_REGEX.test(email.trim());
};

/**
 * Validates registration input
 * @param {Object} data
 * @returns {Array<string>} list of validation error messages
 */
const validateRegisterInput = (data) => {
  const errors = [];
  const { fullName, email, password } = data || {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Ad ve soyad en az 2 karakter olmalıdır.');
  }

  if (!email || typeof email !== 'string' || !isValidPauOrGmail(email)) {
    errors.push('E-posta adresi geçerli bir Pamukkale Üniversitesi (@pau.edu.tr / @posta.pau.edu.tr) veya Gmail adresi olmalıdır.');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Şifre en az 8 karakter uzunluğunda olmalıdır.');
  }

  return errors;
};

/**
 * Validates login input
 * @param {Object} data
 * @returns {Array<string>} list of validation error messages
 */
const validateLoginInput = (data) => {
  const errors = [];
  const { email, password } = data || {};

  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    errors.push('Geçerli bir e-posta adresi giriniz.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Şifre alanı zorunludur.');
  }

  return errors;
};

/**
 * Validates content creation/update input
 * @param {Object} data
 * @returns {Array<string>} list of validation error messages
 */
const validateContentInput = (data, isUpdate = false) => {
  const errors = [];
  const { title, description, type } = data || {};

  if (!isUpdate || title !== undefined) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push('İçerik başlığı zorunludur.');
    }
  }

  if (!isUpdate || description !== undefined) {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      errors.push('İçerik açıklaması zorunludur.');
    }
  }

  if (!isUpdate || type !== undefined) {
    if (!type || !['EVENT', 'ANNOUNCEMENT'].includes(type)) {
      errors.push('İçerik türü yalnızca EVENT veya ANNOUNCEMENT olabilir.');
    }
  }

  return errors;
};

module.exports = {
  isValidPauOrGmail,
  isValidEmail,
  validateRegisterInput,
  validateLoginInput,
  validateContentInput
};

