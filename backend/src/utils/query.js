const literalSearch = value => new RegExp(String(value).trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const escapeCsvCell = value => {
  if (value == null) value = '';
  else if (Array.isArray(value)) value = value.join(', ');
  else if (typeof value === 'object') value = JSON.stringify(value);
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
module.exports = { literalSearch, escapeCsvCell };
