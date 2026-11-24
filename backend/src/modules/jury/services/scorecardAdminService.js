const mongoose = require('mongoose');
const JudgingConfig = require('../models/JudgingConfig');
const Juror = require('../models/Juror');
const Scorecard = require('../models/Scorecard');
const { record } = require('./auditService');
const { cardTotal } = require('./computeResults');
const { juryError } = require('./juryError');
const { isId, parseVoid } = require('./validation');

const notFound = () => juryError(404, 'Puan kartı bulunamadı.', 'SCORECARD_NOT_FOUND');

/**
 * Takes one submitted card out of the results (ADMIN only, checked by the route).
 * The card becomes an empty draft with a higher version, so the juror can score again but a device
 * still holding the old scores cannot send them back silently. The old scores live on in the log.
 * @param {unknown} jurorId @param {unknown} teamId @param {any} body @param {any} user
 */
const voidScorecard = async (jurorId, teamId, body, user) => {
  if (!isId(jurorId) || !isId(teamId)) throw notFound();
  const { reason, version } = parseVoid(body);
  await mongoose.connection.transaction(async session => {
    // Serialized with saves, lock and reset, like every write to a card.
    const config = await JudgingConfig.findOneAndUpdate(
      { _id: JudgingConfig.CONFIG_ID },
      { $inc: { writeSeq: 1 } },
      { session, returnDocument: 'after', timestamps: false }
    ).lean();
    if (!config) throw notFound();
    if (config.locked) throw juryError(423, 'Puanlama kilitliyken puan kartı iptal edilemez.', 'CONFIG_LOCKED');

    const card = await Scorecard.findOne({ juror: jurorId, team: teamId }).session(session);
    if (!card) throw notFound();
    if (card.status !== 'SUBMITTED') throw juryError(409, 'Yalnız gönderilmiş puan kartı iptal edilebilir.', 'SCORECARD_NOT_SUBMITTED');
    if (card.version !== version) throw juryError(409, 'Jüri bu kartı yeniden gönderdi. Güncel puanlara bakıp tekrar deneyin.', 'SCORECARD_CONFLICT');

    const juror = await Juror.findById(jurorId).session(session).lean();
    const entry = config.entries.find(item => String(item.team) === String(card.team));
    const scores = card.scores.map(score => ({ criterion: score.criterion, value: score.value ?? null, comment: score.comment }));
    await record(session, user, 'SCORECARD_VOIDED', {
      target: `${juror?.name ?? jurorId} · ${entry?.teamName ?? teamId}`,
      details: {
        reason,
        juror: String(card.juror),
        team: String(card.team),
        card: { version, scores, total: cardTotal(config.criteria, scores), nominations: [...card.nominations],
          generalComment: card.generalComment, submittedAt: card.submittedAt }
      }
    });

    card.set({
      status: 'DRAFT', submittedAt: null, voidedAt: new Date(), version: version + 1, nominations: [], generalComment: '',
      scores: config.criteria.map(({ key }) => ({ criterion: key, value: null, comment: '' }))
    });
    await card.save({ session });
  });
  return { voided: true };
};

module.exports = { voidScorecard };
