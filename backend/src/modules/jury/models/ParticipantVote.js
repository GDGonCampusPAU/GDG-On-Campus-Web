const mongoose = require('mongoose');

/**
 * Participant vote (revizyon §3): a member of a competing team scores another team on the jury's
 * criteria, once, while that team's voting is open. Anonymous: `participant` is stored only to enforce
 * one vote per person per team and is never shown to anyone, staff included.
 */
const voteSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonTeam', required: true },
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true, select: false },
  // Scores belong to the jury round: a rehearsal reset deletes them with the scorecards.
  round: { type: Number, required: true },
  scores: {
    type: [new mongoose.Schema({ criterion: { type: String, required: true }, value: { type: Number, required: true, min: 1, max: 5 } }, { _id: false })],
    required: true
  }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

voteSchema.index({ team: 1, participant: 1 }, { unique: true });

module.exports = mongoose.model('ParticipantVote', voteSchema);
