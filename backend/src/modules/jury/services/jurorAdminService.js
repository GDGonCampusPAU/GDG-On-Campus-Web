const Juror = require('../models/Juror');
const Scorecard = require('../models/Scorecard');
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

/** @param {unknown} name */
const createJuror = async name => {
  const parsed = parseJurorName(name);
  const { token, tokenHash } = issueToken();
  const juror = await Juror.create({ name: parsed, tokenHash });
  return { juror: jurorView(juror), token };
};

/** The old link stops working immediately. @param {unknown} id */
const regenerateToken = async id => {
  if (!isId(id)) throw notFound();
  const { token, tokenHash } = issueToken();
  const juror = await Juror.findByIdAndUpdate(id, { $set: { tokenHash } }, { returnDocument: 'after' }).lean();
  if (!juror) throw notFound();
  return { juror: jurorView(juror), token };
};

/** @param {unknown} id @param {any} body */
const updateJuror = async (id, body) => {
  if (!isId(id)) throw notFound();
  /** @type {{ name?: string, active?: boolean }} */
  const changes = {};
  if (body.name !== undefined) changes.name = parseJurorName(body.name);
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw juryError(400, 'active alanı true veya false olmalıdır.', 'INVALID_INPUT');
    changes.active = body.active;
  }
  if (!Object.keys(changes).length) throw juryError(400, 'Değiştirilecek name veya active alanı gerekli.', 'INVALID_INPUT');
  const juror = await Juror.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  if (!juror) throw notFound();
  return jurorView(juror);
};

module.exports = { listJurors, createJuror, regenerateToken, updateJuror };
