const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  criterion: { type: String, required: true },
  value: { type: Number, default: null, min: 1, max: 5, validate: value => value === null || Number.isInteger(value) },
  comment: { type: String, default: '', maxlength: 1000 }
}, { _id: false });

/** One juror's scores for one team. Only SUBMITTED cards count in the results. */
const scorecardSchema = new mongoose.Schema({
  juror: { type: mongoose.Schema.Types.ObjectId, ref: 'Juror', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonTeam', required: true },
  scores: { type: [scoreSchema], default: [] },
  nominations: { type: [String], default: [] },
  generalComment: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED'], default: 'DRAFT' },
  submittedAt: { type: Date, default: null },
  // Increases on every save; a second tab or an old device cannot overwrite newer scores.
  version: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

scorecardSchema.index({ juror: 1, team: 1 }, { unique: true });

module.exports = mongoose.model('Scorecard', scorecardSchema);
