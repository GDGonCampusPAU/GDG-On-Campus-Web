const mongoose = require('mongoose');
const Juror = require('../models/Juror');
const Scorecard = require('../models/Scorecard');
const { record } = require('./auditService');
const { loadConfig } = require('./configService');
const { issueToken } = require('./tokenService');
const { juryError } = require('./juryError');
const { isId, parseJurorName } = require('./validation');

const notFound = () => juryError(404, 'Jüri bulunamadı.', 'JUROR_NOT_FOUND');
// Built field by field: a freshly created document still carries tokenHash.
const jurorView = juror => ({ id: String(juror._id), name: juror.name, active: juror.active, lastSeenAt: juror.lastSeenAt ?? null });

const listJurors = async () => {
  const config = await loadConfig();
  const [jurors, cards] = await Promise.all([
    Juror.find().sort({ createdAt: 1 }).lean(),
    Scorecard.find({ team: { $in: config.entries.map(entry => entry.team) } }).select('juror status').lean()
  ]);
  const count = (juror, status) => cards.filter(card => card.status === status && String(card.juror) === String(juror._id)).length;
  return jurors.map(juror => ({
    ...jurorView(juror),
    submittedCount: count(juror, 'SUBMITTED'),
    draftCount: count(juror, 'DRAFT'),
    entryCount: config.entries.length
  }));
};

/** ADMIN only, checked by the route. @param {unknown} name @param {any} user */
const createJuror = async (name, user) => {
  const parsed = parseJurorName(name);
  const { token, tokenHash } = issueToken();
  /** @type {any} */
  let juror;
  await mongoose.connection.transaction(async session => {
    [juror] = await Juror.create([{ name: parsed, tokenHash }], { session });
    await record(session, user, 'JUROR_CREATED', { target: parsed, details: { juror: String(juror._id) } });
  });
  return { juror: jurorView(juror), token };
};

/** ADMIN only, checked by the route. The old link stops working immediately. @param {unknown} id @param {any} user */
const regenerateToken = async (id, user) => {
  if (!isId(id)) throw notFound();
  const { token, tokenHash } = issueToken();
  /** @type {any} */
  let juror;
  await mongoose.connection.transaction(async session => {
    juror = await Juror.findByIdAndUpdate(id, { $set: { tokenHash } }, { session, returnDocument: 'after' }).lean();
    if (!juror) throw notFound();
    await record(session, user, 'LINK_REGENERATED', { target: juror.name, details: { juror: String(juror._id) } });
  });
  return { juror: jurorView(juror), token };
};

/** @param {unknown} id @param {any} body @param {any} user */
const updateJuror = async (id, body, user) => {
  if (!isId(id)) throw notFound();
  /** @type {{ name?: string, active?: boolean }} */
  const changes = {};
  if (body.name !== undefined) changes.name = parseJurorName(body.name);
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw juryError(400, 'active alanı true veya false olmalıdır.', 'INVALID_INPUT');
    changes.active = body.active;
  }
  if (!Object.keys(changes).length) throw juryError(400, 'Değiştirilecek name veya active alanı gerekli.', 'INVALID_INPUT');
  /** @type {any} */
  let juror;
  await mongoose.connection.transaction(async session => {
    juror = await Juror.findById(id).session(session);
    if (!juror) throw notFound();
    if (changes.name !== undefined && changes.name !== juror.name) {
      await record(session, user, 'JUROR_RENAMED', { target: changes.name, details: { from: juror.name, to: changes.name } });
      juror.name = changes.name;
    }
    if (changes.active !== undefined && changes.active !== juror.active) {
      await record(session, user, changes.active ? 'JUROR_ACTIVATED' : 'JUROR_DEACTIVATED', { target: juror.name, details: { juror: String(juror._id) } });
      juror.active = changes.active;
    }
    await juror.save({ session });
  });
  return jurorView(juror);
};

module.exports = { listJurors, createJuror, regenerateToken, updateJuror };
