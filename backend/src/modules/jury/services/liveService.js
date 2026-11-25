// Live presentation session on stage ("Proje değerlendirme" permission on the panel's İzinler page).
//
//   1. Opening evaluation shuffles the competing teams (config.entries) into a random presentation order.
//   2. An organizer starts voting for the team on stage: jurors may now score only that team.
//   3. Ending the voting needs every active juror's submitted card; a missing vote blocks it unless the
//      organizer confirms (force). The team is then closed: its cards are frozen for good.
//   4. Next team, and so on. Participants see the order and whose turn it is on "Başvurum".
//
// While evaluation is closed the jury works as before (free scoring until the lock), except that a
// closed team stays frozen. That is also the fallback if the live flow fails on stage.
const crypto = require('crypto');
const mongoose = require('mongoose');
const Form = require('../../../models/Form');
const JudgingConfig = require('../models/JudgingConfig');
const Juror = require('../models/Juror');
const Scorecard = require('../models/Scorecard');
const { loadConfig } = require('./configService');
const { record } = require('./auditService');
const { juryError } = require('./juryError');
const { isId } = require('./validation');

const { CONFIG_ID } = JudgingConfig;
const FORM_SLUG = 'hackathon-katilim';

/** @param {unknown} a @param {unknown} b */
const same = (a, b) => a != null && b != null && String(a) === String(b);

/** Is "Proje değerlendirme" open on the hackathon form? Missing form or setting = closed. */
const evaluationOpen = async () => {
  const form = await Form.findOne({ slug: FORM_SLUG }).select('settings.projectEvaluationEnabled').lean();
  return /** @type {any} */ (form)?.settings?.projectEvaluationEnabled === true;
};

const liveOf = (config) => ({ order: [], current: null, startedAt: null, closed: [], ...(config?.live || {}) });

/**
 * The presentation order: the shuffled order first, then entries added later (by their manual order).
 * Teams removed from the entries drop out. @returns {any[]} entries in presentation order
 */
const orderedEntries = (config) => {
  const live = liveOf(config);
  const entries = config?.entries || [];
  const byTeam = new Map(entries.map(entry => [String(entry.team), entry]));
  const listed = live.order.map(id => byTeam.get(String(id))).filter(Boolean);
  const listedIds = new Set(listed.map(entry => String(entry.team)));
  const rest = entries.filter(entry => !listedIds.has(String(entry.team))).sort((a, b) => a.order - b.order);
  return [...listed, ...rest];
};

/** CLOSED | VOTING | WAITING for one team. */
const stateOf = (config, teamId) => {
  const live = liveOf(config);
  if (live.closed.some(id => same(id, teamId))) return 'CLOSED';
  if (same(live.current, teamId)) return 'VOTING';
  return 'WAITING';
};

/** The current team only if it is still an entry (an entry can be removed in the setup meanwhile). */
const currentEntry = (config) => {
  const { current } = liveOf(config);
  return current ? (config.entries || []).find(entry => same(entry.team, current)) || null : null;
};

/**
 * May a juror write this team's card now? A closed team never; with evaluation open only the team being
 * voted; otherwise (evaluation closed) any team, as the jury worked before.
 */
const writable = (config, teamId, open) => {
  const state = stateOf(config, teamId);
  if (state === 'CLOSED') return false;
  return open ? state === 'VOTING' && Boolean(currentEntry(config)) : true;
};

/** Why a write was refused, for the juror's screen. */
const refusal = (config, teamId) => stateOf(config, teamId) === 'CLOSED'
  ? juryError(423, 'Bu takımın oylaması kapandı; puanlar değiştirilemez.', 'VOTING_CLOSED')
  : juryError(423, 'Bu takım için oylama şu an açık değil. Organizasyon oylamayı başlatınca puanlayabilirsin.', 'VOTING_NOT_OPEN');

const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Called when evaluation is opened: fixes a random order once. Reopening evaluation keeps the order. */
const ensureOrder = async (user) => {
  const config = await loadConfig();
  if (liveOf(config).order.length) return;
  const order = shuffled((config.entries || []).map(entry => entry.team));
  await mongoose.connection.transaction(async session => {
    const res = await JudgingConfig.updateOne({ _id: CONFIG_ID, $or: [{ 'live.order': { $size: 0 } }, { 'live.order': { $exists: false } }] },
      { $set: { 'live.order': order } }, { session, timestamps: false });
    if (res.modifiedCount && user) await record(session, user, 'LIVE_ORDER_SHUFFLED', { details: { teams: order.length } });
  });
};

/** A new random order; only before any team has been voted (ADMIN). */
const reshuffle = async (user) => {
  const config = await loadConfig();
  const live = liveOf(config);
  if (live.current || live.closed.length) throw juryError(409, 'Oylama başladıktan sonra sıra değiştirilemez.', 'LIVE_STARTED');
  const order = shuffled((config.entries || []).map(entry => entry.team));
  await mongoose.connection.transaction(async session => {
    const res = await JudgingConfig.updateOne({ _id: CONFIG_ID, 'live.current': null, 'live.closed': { $size: 0 } },
      { $set: { 'live.order': order } }, { session, timestamps: false });
    if (!res.matchedCount) throw juryError(409, 'Oylama başladıktan sonra sıra değiştirilemez.', 'LIVE_STARTED');
    await record(session, user, 'LIVE_ORDER_SHUFFLED', { details: { teams: order.length } });
  });
  return adminView();
};

const requireOpen = async () => {
  if (!(await evaluationOpen())) {
    throw juryError(409, 'Proje değerlendirme kapalı. Önce Core Team panelindeki İzinler sayfasından açın.', 'EVALUATION_CLOSED');
  }
};

/** Starts voting for the team on stage. One team at a time; a closed team must be reopened first. */
const start = async (teamId, user) => {
  if (!isId(teamId)) throw juryError(400, 'Geçerli bir takım seçin.', 'INVALID_INPUT');
  await requireOpen();
  await loadConfig();
  let name = '';
  await mongoose.connection.transaction(async session => {
    // $inc writeSeq: conflicts with a juror save in flight instead of slipping past it.
    const config = await JudgingConfig.findOneAndUpdate({ _id: CONFIG_ID }, { $inc: { writeSeq: 1 } }, { session, returnDocument: 'after', timestamps: false }).lean();
    if (config.locked) throw juryError(423, 'Puanlama kilitli. Önce kilidi açın.', 'JURY_LOCKED');
    const entry = (config.entries || []).find(e => same(e.team, teamId));
    if (!entry) throw juryError(404, 'Bu takım yarışan takımlar arasında değil.', 'ENTRY_NOT_FOUND');
    if (currentEntry(config)) throw juryError(409, `Şu an ${currentEntry(config).teamName} oylanıyor. Önce o oylamayı bitirin.`, 'VOTING_IN_PROGRESS');
    if (stateOf(config, teamId) === 'CLOSED') throw juryError(409, 'Bu takımın oylaması kapandı. Yeniden oylatmak için önce yeniden açın.', 'VOTING_CLOSED');
    await JudgingConfig.updateOne({ _id: CONFIG_ID }, { $set: { 'live.current': entry.team, 'live.startedAt': new Date(), updatedBy: user._id } }, { session, timestamps: false });
    await record(session, user, 'LIVE_VOTING_STARTED', { target: String(entry.team), details: { team: entry.teamName } });
    name = entry.teamName;
  });
  return { ...(await adminView()), started: name };
};

/** Who has and has not submitted a card for this team (active jurors only). */
const votesFor = async (teamId) => {
  const [jurors, cards] = await Promise.all([
    Juror.find({}).select('name active').sort({ createdAt: 1 }).lean(),
    teamId ? Scorecard.find({ team: teamId }).select('juror status voidedAt').lean() : []
  ]);
  const byJuror = new Map(cards.map(card => /** @type {[string, any]} */ ([String(card.juror), card])));
  return jurors.map(juror => {
    const card = byJuror.get(String(juror._id));
    return { id: String(juror._id), name: juror.name, active: juror.active, status: card?.status ?? 'NONE' };
  });
};

/**
 * Ends the current voting. Blocked while an active juror has not submitted, unless `force` (the organizer
 * confirmed, e.g. a juror left the hall); the missing names go to the log either way.
 */
const end = async (force, user) => {
  await loadConfig();
  let ended = '';
  await mongoose.connection.transaction(async session => {
    const config = await JudgingConfig.findOneAndUpdate({ _id: CONFIG_ID }, { $inc: { writeSeq: 1 } }, { session, returnDocument: 'after', timestamps: false }).lean();
    const entry = currentEntry(config);
    if (!entry) throw juryError(409, 'Şu an oylanan bir takım yok.', 'NO_VOTING');
    const jurors = await Juror.find({ active: true }).select('name').session(session).lean();
    const submitted = new Set((await Scorecard.find({ team: entry.team, status: 'SUBMITTED' }).select('juror').session(session).lean()).map(card => String(card.juror)));
    const missing = jurors.filter(juror => !submitted.has(String(juror._id))).map(juror => juror.name);
    if (missing.length && force !== true) {
      throw Object.assign(juryError(409, `Oyunu göndermeyen jüri var: ${missing.join(', ')}.`, 'VOTES_MISSING'), { missing });
    }
    await JudgingConfig.updateOne({ _id: CONFIG_ID }, {
      $set: { 'live.current': null, 'live.startedAt': null, updatedBy: user._id },
      $addToSet: { 'live.closed': entry.team }
    }, { session, timestamps: false });
    await record(session, user, 'LIVE_VOTING_ENDED', { target: String(entry.team), details: { team: entry.teamName, forced: missing.length > 0, missing } });
    ended = entry.teamName;
  });
  return { ...(await adminView()), ended };
};

/** Lets a closed team be voted again (ADMIN): mistakes on stage must be fixable. */
const reopen = async (teamId, user) => {
  if (!isId(teamId)) throw juryError(400, 'Geçerli bir takım seçin.', 'INVALID_INPUT');
  await loadConfig();
  await mongoose.connection.transaction(async session => {
    const config = await JudgingConfig.findOneAndUpdate({ _id: CONFIG_ID }, { $inc: { writeSeq: 1 } }, { session, returnDocument: 'after', timestamps: false }).lean();
    const entry = (config.entries || []).find(e => same(e.team, teamId));
    if (!entry || stateOf(config, teamId) !== 'CLOSED') throw juryError(409, 'Bu takımın oylaması kapalı değil.', 'NOT_CLOSED');
    await JudgingConfig.updateOne({ _id: CONFIG_ID }, { $pull: { 'live.closed': entry.team }, $set: { updatedBy: user._id } }, { session, timestamps: false });
    await record(session, user, 'LIVE_VOTING_REOPENED', { target: String(entry.team), details: { team: entry.teamName } });
  });
  return adminView();
};

/** The control window on /admin/juri. */
const adminView = async () => {
  const [config, open] = await Promise.all([loadConfig(), evaluationOpen()]);
  const ordered = orderedEntries(config);
  const current = currentEntry(config);
  const position = (entry) => ordered.findIndex(e => same(e.team, entry.team)) + 1;
  return {
    open,
    locked: config.locked,
    started: Boolean(current) || liveOf(config).closed.length > 0,
    order: ordered.map((entry, i) => ({ team: String(entry.team), teamName: entry.teamName, projectName: entry.projectName,
      position: i + 1, state: stateOf(config, entry.team) })),
    current: current ? { team: String(current.team), teamName: current.teamName, position: position(current), startedAt: liveOf(config).startedAt } : null,
    next: (() => { const n = ordered.find(entry => stateOf(config, entry.team) === 'WAITING'); return n ? { team: String(n.team), teamName: n.teamName, position: position(n) } : null; })(),
    votes: current ? await votesFor(current.team) : []
  };
};

/** What participants see on "Başvurum" (team names only). A short memo absorbs a hall full of pollers. */
let memo = { at: 0, value: null };
const MEMO_MS = process.env.NODE_ENV === 'test' ? 0 : 2000;
const publicView = async () => {
  if (memo.value && Date.now() - memo.at < MEMO_MS) return memo.value;
  const [config, open] = await Promise.all([loadConfig(), evaluationOpen()]);
  let value = { open: false, current: null, order: [] };
  if (open) {
    const ordered = orderedEntries(config);
    const current = currentEntry(config);
    value = {
      open: true,
      current: current ? { name: current.teamName, position: ordered.findIndex(e => same(e.team, current.team)) + 1 } : null,
      order: ordered.map((entry, i) => ({ position: i + 1, name: entry.teamName, state: stateOf(config, entry.team) }))
    };
  }
  memo = { at: Date.now(), value };
  return value;
};
const clearMemo = () => { memo = { at: 0, value: null }; };

module.exports = {
  evaluationOpen, orderedEntries, stateOf, writable, refusal, ensureOrder, reshuffle, start, end, reopen,
  adminView, publicView, clearMemo, FORM_SLUG
};
