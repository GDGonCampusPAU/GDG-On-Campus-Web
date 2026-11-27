// Input checks run on the raw body, before Mongoose could cast "5" to 5 or an object to a string.
const { juryError } = require('./juryError');

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;
const ID_PATTERN = /^[a-f\d]{24}$/i;
const LIMITS = { criteria: 20, categories: 30, entries: 200, comment: 1000, generalComment: 2000 };
const LINKS = { repoUrl: 'Repo linki', demoUrl: 'Demo linki', presentationUrl: 'Sunum linki' };

const invalid = message => juryError(400, message);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && ID_PATTERN.test(value);

/**
 * @param {unknown} value @param {string} label
 * @param {{ max: number, required?: boolean, trim?: boolean }} options
 * @returns {string}
 */
const text = (value, label, { max, required = false, trim = true }) => {
  if (value !== undefined && value !== null && typeof value !== 'string') throw invalid(`${label} metin olmalıdır.`);
  const given = typeof value === 'string' ? value : '';
  const result = trim ? given.trim() : given;
  if (required && !result) throw invalid(`${label} zorunludur.`);
  if (result.length > max) throw invalid(`${label} en fazla ${max} karakter olabilir.`);
  return result;
};

/** @param {unknown} value @param {string} label @param {number} max */
const list = (value, label, max) => {
  if (!Array.isArray(value) || !value.every(isObject)) throw invalid(`${label} bir nesne listesi olmalıdır.`);
  if (value.length > max) throw invalid(`${label} en fazla ${max} öğe içerebilir.`);
  return value;
};

/** @param {any[]} values @param {string} label */
const unique = (values, label) => {
  if (new Set(values).size !== values.length) throw invalid(`${label} tekrar edemez.`);
};

/** @param {unknown} value @param {string} label */
const key = (value, label) => {
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) throw invalid(`${label} anahtarı geçersiz.`);
  return value;
};

/** Links are optional, but a filled one must be http(s). @param {unknown} value @param {string} label */
const link = (value, label) => {
  const url = text(value, label, { max: 500 });
  if (url && (!/^https?:\/\/\S+$/i.test(url) || !URL.canParse(url))) throw invalid(`${label} http:// veya https:// ile başlayan geçerli bir adres olmalıdır.`);
  return url;
};

const parseJurorName = value => text(value, 'Jüri adı', { max: 80, required: true });

/** @param {any} body */
const parseVoid = body => {
  const reason = text(body.reason, 'İptal gerekçesi', { max: 500, required: true });
  if (!Number.isInteger(body.version) || body.version < 1) throw invalid('Puan kartı sürümü (version) gerekli.');
  return { reason, version: body.version };
};

/** @param {any} body */
const parseConfig = body => {
  if (!Number.isInteger(body.revision) || body.revision < 1) throw invalid('Yayın sürümü (revision) gerekli.');

  const criteria = list(body.criteria, 'Kriterler', LIMITS.criteria).map(item => {
    const label = text(item.label, 'Kriter adı', { max: 80, required: true });
    if (!Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100) throw invalid(`"${label}" ağırlığı 1-100 arası tam sayı olmalıdır.`);
    return { key: key(item.key, 'Kriter'), label, weight: item.weight, description: text(item.description, 'Kriter açıklaması', { max: 300 }) };
  });
  unique(criteria.map(item => item.key), 'Kriter anahtarları');
  if (criteria.reduce((sum, item) => sum + item.weight, 0) !== 100) throw invalid('Kriter ağırlıklarının toplamı 100 olmalıdır.');

  const criterionKeys = new Set(criteria.map(item => item.key));
  const categories = list(body.categories, 'Kategoriler', LIMITS.categories).map(item => {
    const name = text(item.name, 'Kategori adı', { max: 60, required: true });
    if (!Array.isArray(item.criterionKeys) || !item.criterionKeys.every(value => criterionKeys.has(value))) throw invalid(`"${name}" kategorisinde bilinmeyen kriter var.`);
    unique(item.criterionKeys, `"${name}" kategorisinin kriterleri`);
    if (!Number.isInteger(item.priority) || item.priority < 1) throw invalid(`"${name}" önceliği 1 veya daha büyük tam sayı olmalıdır.`);
    if (typeof item.active !== 'boolean') throw invalid(`"${name}" için active true veya false olmalıdır.`);
    return { key: key(item.key, 'Kategori'), name, icon: text(item.icon, 'Kategori ikonu', { max: 16 }),
      criterionKeys: [...item.criterionKeys], priority: item.priority, active: item.active };
  });
  unique(categories.map(item => item.key), 'Kategori anahtarları');
  unique(categories.map(item => item.priority), 'Kategori öncelikleri');

  const entries = list(body.entries, 'Yarışan takımlar', LIMITS.entries).map(item => {
    if (!isId(item.team)) throw invalid('Takım kimliği geçersiz.');
    if (!Number.isInteger(item.order) || item.order < 1) throw invalid('Sunum sırası 1 veya daha büyük tam sayı olmalıdır.');
    return {
      team: item.team.toLowerCase(),
      order: item.order,
      projectName: text(item.projectName, 'Proje adı', { max: 120 }),
      repoUrl: link(item.repoUrl, LINKS.repoUrl),
      demoUrl: link(item.demoUrl, LINKS.demoUrl),
      presentationUrl: link(item.presentationUrl, LINKS.presentationUrl)
    };
  });
  unique(entries.map(item => item.team), 'Takımlar');
  unique(entries.map(item => item.order), 'Sunum sıraları');

  return { revision: body.revision, criteria, categories, entries: entries.sort((a, b) => a.order - b.order) };
};

/**
 * Types and lengths only; keys are checked against the live config inside the transaction.
 * @param {any} body
 */
const parseScorecard = body => {
  if (typeof body.submit !== 'boolean') throw invalid('submit alanı true veya false olmalıdır.');
  if (!Number.isInteger(body.round) || body.round < 1) throw invalid('Puanlama turu (round) gerekli.');
  if (!Number.isInteger(body.version) || body.version < 0) throw invalid('Puan kartı sürümü (version) gerekli.');

  const scores = list(body.scores, 'Puanlar', LIMITS.criteria).map(item => {
    if (typeof item.criterion !== 'string') throw invalid('Kriter anahtarı gerekli.');
    const value = item.value ?? null;
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5)) throw invalid('Puan 1-5 arası tam sayı olmalıdır.');
    return { criterion: item.criterion, value, comment: text(item.comment, 'Gerekçe', { max: LIMITS.comment, trim: false }) };
  });
  unique(scores.map(item => item.criterion), 'Puanlanan kriterler');

  const { nominations } = body;
  if (!Array.isArray(nominations) || nominations.length > LIMITS.categories || !nominations.every(value => typeof value === 'string')) {
    throw invalid('Adaylıklar kategori anahtarlarından oluşan bir liste olmalıdır.');
  }
  unique(nominations, 'Adaylıklar');

  return { submit: body.submit, round: body.round, version: body.version, scores, nominations: [...nominations],
    generalComment: text(body.generalComment, 'Genel yorum', { max: LIMITS.generalComment, trim: false }) };
};

module.exports = { isId, parseConfig, parseScorecard, parseJurorName, parseVoid };
