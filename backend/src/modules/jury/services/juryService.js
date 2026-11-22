// What a juror can see and do. Nothing here returns another juror's scores or any result.
const mongoose = require('mongoose');
const JudgingConfig = require('../models/JudgingConfig');
const Scorecard = require('../models/Scorecard');
const { loadConfig } = require('./configService');
const { juryError } = require('./juryError');
const { isId, parseScorecard } = require('./validation');

const notAnEntry = () => juryError(404, 'Bu takım yarışan takımlar arasında değil.', 'ENTRY_NOT_FOUND');
const findEntry = (config, teamId) => config?.entries.find(entry => String(entry.team) === String(teamId).toLowerCase());

const cardView = card => card && ({
  scores: card.scores.map(({ criterion, value, comment }) => ({ criterion, value: value ?? null, comment })),
  nominations: [...card.nominations],
  generalComment: card.generalComment,
  status: card.status,
  version: card.version,
  submittedAt: card.submittedAt
});

const overview = async juror => {
  const config = await loadConfig();
  const cards = await Scorecard.find({ juror: juror._id }).select('team status').lean();
  const statusByTeam = new Map(cards.map(card => [String(card.team), card.status]));
  return {
    juror: { id: String(juror._id), name: juror.name },
    locked: config.locked,
    round: config.round,
    criteria: config.criteria.map(({ key, label, description, weight }) => ({ key, label, description, weight })),
    categories: config.categories
      .filter(category => category.active)
      .sort((a, b) => a.priority - b.priority)
      .map(({ key, name, icon }) => ({ key, name, icon })),
    entries: [...config.entries].sort((a, b) => a.order - b.order).map(({ team, teamName, projectName, order }) => ({
      team: String(team), teamName, projectName, order, status: statusByTeam.get(String(team)) ?? 'NONE'
    }))
  };
};

const getEntry = async (juror, teamId) => {
  const config = await loadConfig();
  const entry = isId(teamId) ? findEntry(config, teamId) : null;
  if (!entry) throw notAnEntry();
  const { team, teamName, order, projectName, repoUrl, demoUrl, presentationUrl } = entry;
  const card = await Scorecard.findOne({ juror: juror._id, team }).lean();
  return {
    entry: { team: String(team), teamName, order, projectName, repoUrl, demoUrl, presentationUrl },
    locked: config.locked,
    round: config.round,
    scorecard: cardView(card)
  };
};

/**
 * Saves a draft (`submit: false`) or submits. A submitted card only changes by submitting again,
 * so autosave can never pull a juror's score out of the results.
 */
const saveScorecard = async (juror, teamId, body) => {
  if (!isId(teamId)) throw notAnEntry();
  const input = parseScorecard(body);
  /** @type {any} */
  let saved;
  await mongoose.connection.transaction(async session => {
    // Writing the config first serializes this save with lock, config edit and reset.
    const config = await JudgingConfig.findOneAndUpdate(
      { _id: JudgingConfig.CONFIG_ID },
      { $inc: { writeSeq: 1 } },
      { session, returnDocument: 'after', timestamps: false }
    ).lean();
    const entry = findEntry(config, teamId);
    if (!config || !entry) throw notAnEntry();
    if (config.locked) throw juryError(423, 'Puanlama kapatıldı; puanlar değiştirilemez.', 'JURY_LOCKED');
    if (input.round !== config.round) throw juryError(409, 'Puan kartları sıfırlandı. Sayfa güncel hâliyle yeniden yüklenecek.', 'JURY_RESET');

    const given = new Map(input.scores.map(score => [score.criterion, score]));
    if (input.scores.some(score => !config.criteria.some(criterion => criterion.key === score.criterion))) {
      throw juryError(400, 'Bilinmeyen kriter anahtarı.', 'UNKNOWN_KEY');
    }
    // An inactive category is still a known one: an older nomination must not break saving.
    if (input.nominations.some(key => !config.categories.some(category => category.key === key))) {
      throw juryError(400, 'Bilinmeyen kategori anahtarı.', 'UNKNOWN_KEY');
    }
    const scores = config.criteria.map(({ key }) => given.get(key) ?? { criterion: key, value: null, comment: '' });
    if (input.submit) {
      const missing = config.criteria.filter(({ key }) => !given.get(key)?.value).map(criterion => criterion.label);
      if (missing.length) throw juryError(400, `Eksik kriterler: ${missing.join(', ')}.`, 'SCORES_MISSING');
    }

    const card = await Scorecard.findOne({ juror: juror._id, team: entry.team }).session(session)
      ?? new Scorecard({ juror: juror._id, team: entry.team });
    if (card.status === 'SUBMITTED' && !input.submit) {
      throw juryError(409, 'Gönderilmiş kart taslağa çevrilemez; değişiklik için yeniden gönderin.', 'SCORECARD_SUBMITTED');
    }
    if (card.version !== input.version) {
      throw juryError(409, 'Bu puan kartı başka bir sekmede veya cihazda değişti.', 'SCORECARD_CONFLICT');
    }

    card.set({ scores, nominations: input.nominations, generalComment: input.generalComment, version: card.version + 1,
      ...(input.submit ? { status: 'SUBMITTED', submittedAt: new Date() } : {}) });
    await card.save({ session });
    saved = card;
  });
  return { scorecard: cardView(saved) };
};

module.exports = { overview, getEntry, saveScorecard };
