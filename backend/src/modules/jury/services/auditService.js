// The record of every staff change to the jury system (who, what, on whom, when).
const JuryAuditLog = require('../models/JuryAuditLog');
const { juryError } = require('./juryError');
const { isId } = require('./validation');

const PAGE_SIZE = 50;

/**
 * Written inside the transaction of the action itself: what cannot be recorded does not happen.
 * Never pass a token or a token hash.
 * @param {import('mongoose').ClientSession} session
 * @param {any} user the acting staff user
 * @param {string} action
 * @param {{ target?: string, details?: Record<string, unknown> }} [entry]
 */
const record = async (session, user, action, { target = '', details = {} } = {}) => {
  await JuryAuditLog.create([/** @type {any} */ ({
    action, target, details, actor: { id: user._id, name: user.fullName, email: user.email, role: user.role }
  })], { session });
};

/** @param {unknown} before id of the last entry the screen already has */
const listLog = async before => {
  if (before !== undefined && !isId(before)) throw juryError(400, 'before geçerli bir kayıt kimliği olmalıdır.', 'INVALID_INPUT');
  const docs = await JuryAuditLog.find(before ? { _id: { $lt: before } } : {}).sort({ _id: -1 }).limit(PAGE_SIZE + 1).lean();
  const items = docs.slice(0, PAGE_SIZE).map(({ _id, createdAt, action, actor, target, details }) => ({
    id: String(_id), at: createdAt, action, target, details, actor: { name: actor.name, email: actor.email, role: actor.role }
  }));
  return { items, next: docs.length > PAGE_SIZE ? items[items.length - 1].id : null };
};

/**
 * What changed between two lists, for the CONFIG_UPDATED entry.
 * @param {any[]} before @param {any[]} after @param {string} key identifies an item
 * @param {string} name readable name of an item @param {string[]} fields compared fields
 */
const diffList = (before, after, key, name, fields) => {
  const old = new Map(before.map(item => [String(item[key]), item]));
  const kept = new Set(after.map(item => String(item[key])));
  const edited = [];
  for (const item of after) {
    const previous = old.get(String(item[key]));
    if (!previous) continue;
    const changed = fields
      .filter(field => JSON.stringify(previous[field] ?? '') !== JSON.stringify(item[field] ?? ''))
      .map(field => [field, [previous[field] ?? '', item[field] ?? '']]);
    if (changed.length) edited.push({ name: previous[name], fields: Object.fromEntries(changed) });
  }
  return {
    added: after.filter(item => !old.has(String(item[key]))).map(item => item[name]),
    removed: before.filter(item => !kept.has(String(item[key]))).map(item => item[name]),
    edited
  };
};

/** @returns {Record<string, ReturnType<typeof diffList>> | null} null when nothing changed */
const configChanges = (before, after) => {
  const all = {
    criteria: diffList(before.criteria, after.criteria, 'key', 'label', ['key', 'label', 'description', 'weight']),
    categories: diffList(before.categories, after.categories, 'key', 'name', ['name', 'icon', 'criterionKeys', 'priority', 'active']),
    entries: diffList(before.entries, after.entries, 'team', 'teamName', ['teamName', 'order', 'projectName', 'repoUrl', 'demoUrl', 'presentationUrl'])
  };
  const changed = Object.entries(all).filter(([, diff]) => diff.added.length || diff.removed.length || diff.edited.length);
  return changed.length ? Object.fromEntries(changed) : null;
};

module.exports = { record, listLog, configChanges };
