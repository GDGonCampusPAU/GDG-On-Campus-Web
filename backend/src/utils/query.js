const literalSearch = value => new RegExp(String(value).trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
// Characters that start a formula, with the full-width forms Excel also accepts.
const FORMULA_START = /^[\s\u0000-\u001f"]*[=+@＝＋－＠-]/;
// A file is split at `,`, `;` or tabs depending on the reader's regional settings, so a cell can also
// begin after any of them inside a value. Matching whole runs keeps this linear on long answers.
const SEPARATOR_RUN = /([,;\s\u0000-\u001f"]+)([=+@＝＋－＠-]?)/g;

const escapeCsvCell = value => {
  if (value == null) value = '';
  else if (Array.isArray(value)) value = value.join(', ');
  else if (typeof value === 'object') value = JSON.stringify(value);
  const raw = String(value);
  let text = raw.replace(SEPARATOR_RUN, (match, run, lead) => (lead ? run.replace(/[,;\t\r\n]/g, "$&'") + lead : match));
  if (FORMULA_START.test(raw) || /^[\t\r\n]/.test(raw)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
module.exports = { literalSearch, escapeCsvCell };
