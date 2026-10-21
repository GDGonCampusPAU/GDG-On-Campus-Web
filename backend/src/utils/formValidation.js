const safePattern = pattern => {
  if (typeof pattern !== 'string' || pattern.length > 128 || /[()|]|\\[1-9]/.test(pattern)) return false;
  // Restrict unbounded repetitions to one; nested groups and alternation are not supported.
  if ((pattern.match(/(?<!\\)[*+]/g) || []).length > 1 || /\{\d+,\}/.test(pattern)) return false;
  try { new RegExp(pattern); return true; } catch { return false; }
};
const answerError = (field, value) => {
  const empty = value == null || value === '' || (typeof value === 'string' && !value.trim()) || (field.type === 'checkbox' && Array.isArray(value) && value.length === 0);
  if (empty) return field.required ? 'zorunludur' : '';
  if (field.type === 'checkbox') return Array.isArray(value) && value.every(item => typeof item === 'string' && field.options.includes(item)) && new Set(value).size === value.length ? '' : 'geçerli seçeneklerden oluşmalıdır';
  if (field.type === 'number') {
    if (!['string', 'number'].includes(typeof value) || !Number.isFinite(Number(value))) return 'sayısal olmalıdır';
    const number = Number(value);
    if (field.validation?.min != null && number < field.validation.min) return `en az ${field.validation.min} olmalıdır`;
    if (field.validation?.max != null && number > field.validation.max) return `en fazla ${field.validation.max} olmalıdır`;
    return '';
  }
  if (typeof value !== 'string' || value.length > 10000) return 'geçerli bir metin olmalıdır (en fazla 10000 karakter)';
  if (['select', 'radio'].includes(field.type) && !field.options.includes(value)) return 'listedeki seçeneklerden biri olmalıdır';
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'geçerli bir e-posta olmalıdır';
  if (field.type === 'phone' && !/^\+?\d{10,14}$/.test(value.replace(/[\s().-]/g, ''))) return 'geçerli bir telefon olmalıdır';
  if (field.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return 'geçerli bir tarih olmalıdır';
  }
  if (field.validation?.regex && (!safePattern(field.validation.regex) || value.length > 1000 || !new RegExp(field.validation.regex).test(value))) return 'belirtilen biçime uymalıdır';
  return '';
};
module.exports = { safePattern, answerError };
