// Participant voting (revizyon §3). While the jury votes for the team on stage, members of the other
// competing teams vote on "Başvurum" with the same criteria (1-5 each). Anonymous, one vote per person
// per team, never for their own team. The team's participant score is the weighted average of the votes
// (computeResults.js) and counts 30% of the final score.
const mongoose = require('mongoose');
const JudgingConfig = require('../models/JudgingConfig');
const ParticipantVote = require('../models/ParticipantVote');
const { loadConfig } = require('./configService');
const live = require('./liveService');
const { internals } = require('../../../services/myApplicationService');

/** @param {number} status @param {string} message @param {string} code */
const failure = (status, message, code) => Object.assign(new Error(message), { status, code });

/**
 * The participant's own competing team. `detail` says why there is none:
 * NO_TEAM (no team), PENDING (join request not approved yet), NOT_COMPETING (team not in "Yarışan takımlar").
 * @returns {Promise<{ entry: any, detail: 'NO_TEAM' | 'PENDING' | 'NOT_COMPETING' | null }>}
 */
const membershipOf = async (form, config, participantId) => {
  const membership = await internals.findMembership(form, participantId);
  if (!membership) return { entry: null, detail: 'NO_TEAM' };
  if (membership.status !== 'APPROVED') return { entry: null, detail: 'PENDING' };
  const entry = (config.entries || []).find(item => live.same(item.team, membership.team._id)) || null;
  return { entry, detail: entry ? null : 'NOT_COMPETING' };
};
const ownEntry = async (form, config, participantId) => (await membershipOf(form, config, participantId)).entry;

/**
 * What the vote card on "Başvurum" shows. `canVote` only when everything allows a vote right now.
 * reason: EVALUATION_CLOSED | LOCKED | NOT_ELIGIBLE | NO_VOTING | OWN_TEAM | VOTED | null; notEligible: why not eligible.
 */
const voteState = async (form, participant) => {
  const [config, open] = await Promise.all([loadConfig(), live.evaluationOpen()]);
  const { entry: own, detail } = await membershipOf(form, config, participant._id);
  const current = live.currentEntry(config);
  const ordered = live.orderedEntries(config);
  const voted = current ? Boolean(await ParticipantVote.exists({ team: current.team, participant: participant._id })) : false;
  let reason = null;
  if (!open) reason = 'EVALUATION_CLOSED';
  else if (config.locked) reason = 'LOCKED';
  else if (!own) reason = 'NOT_ELIGIBLE';
  else if (!current) reason = 'NO_VOTING';
  else if (live.same(current.team, own.team)) reason = 'OWN_TEAM';
  else if (voted) reason = 'VOTED';
  return {
    open,
    eligible: Boolean(own),
    // Why not eligible (shown on the card): NO_TEAM | PENDING | NOT_COMPETING | null
    notEligible: detail,
    canVote: reason === null,
    reason,
    voted,
    current: current ? { team: String(current.team), teamName: current.teamName, position: ordered.findIndex(e => live.same(e.team, current.team)) + 1 } : null,
    criteria: open ? config.criteria.map(({ key, label, description }) => ({ key, label, description })) : []
  };
};

/** Records one vote for the team on stage. Every rule is checked again inside the transaction. */
const castVote = async (form, participant, body) => {
  const team = String(body?.team ?? '');
  const given = body?.scores;
  if (!/^[a-f\d]{24}$/i.test(team) || !given || typeof given !== 'object' || Array.isArray(given)) {
    throw failure(400, 'Geçersiz oy.', 'INVALID_VOTE');
  }
  const open = await live.evaluationOpen();
  if (!open) throw failure(409, 'Proje değerlendirme şu an açık değil.', 'EVALUATION_CLOSED');
  await loadConfig();
  await mongoose.connection.transaction(async session => {
    // $inc writeSeq: serializes the vote with "Oylamayı bitir", so no vote lands after the end.
    const config = await JudgingConfig.findOneAndUpdate({ _id: JudgingConfig.CONFIG_ID }, { $inc: { writeSeq: 1 } },
      { session, returnDocument: 'after', timestamps: false }).lean();
    if (config.locked) throw failure(423, 'Puanlama kilitlendi; oy verilemez.', 'LOCKED');
    const current = live.currentEntry(config);
    if (!current || !live.same(current.team, team)) throw failure(409, 'Bu takımın oylaması kapandı ya da henüz açılmadı.', 'VOTING_NOT_OPEN');
    const own = await ownEntry(form, config, participant._id);
    if (!own) throw failure(403, 'Yalnız yarışan takımların üyeleri oy verebilir.', 'NOT_ELIGIBLE');
    if (live.same(own.team, team)) throw failure(403, 'Kendi takımına oy veremezsin.', 'OWN_TEAM');

    const scores = config.criteria.map(({ key, label }) => {
      const value = given[key];
      if (!Number.isInteger(value) || value < 1 || value > 5) throw failure(400, `${label} için 1-5 arası bir puan ver.`, 'SCORES_MISSING');
      return { criterion: key, value };
    });
    try {
      await ParticipantVote.create([{ team: current.team, participant: participant._id, round: config.round, scores }], { session });
    } catch (error) {
      if (/** @type {any} */ (error)?.code === 11000) throw failure(409, 'Bu takıma zaten oy verdin.', 'ALREADY_VOTED');
      throw error;
    }
  });
  return voteState(form, participant);
};

/** Number of participant votes per team (admin screens). @returns {Promise<Map<string, number>>} */
const voteCounts = async () => {
  const rows = await ParticipantVote.aggregate([{ $group: { _id: '$team', count: { $sum: 1 } } }]);
  return new Map(rows.map(row => [String(row._id), row.count]));
};

module.exports = { voteState, castVote, voteCounts };
