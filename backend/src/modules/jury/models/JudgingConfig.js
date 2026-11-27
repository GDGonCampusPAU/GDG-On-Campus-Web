const mongoose = require('mongoose');

const CONFIG_ID = 'hackathon';

const criterionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 300 },
  weight: { type: Number, required: true, min: 1, max: 100 }
}, { _id: false });

const categorySchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true, maxlength: 60 },
  icon: { type: String, default: '', maxlength: 16 },
  criterionKeys: { type: [String], default: [] },
  priority: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true }
}, { _id: false });

const entrySchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonTeam', required: true },
  // Copy of the team name: a team can be dissolved, its scores and results must stay readable.
  teamName: { type: String, required: true },
  order: { type: Number, required: true, min: 1 },
  projectName: { type: String, default: '', maxlength: 120 },
  repoUrl: { type: String, default: '', maxlength: 500 },
  demoUrl: { type: String, default: '', maxlength: 500 },
  presentationUrl: { type: String, default: '', maxlength: 500 }
}, { _id: false });

/**
 * Live presentation session ("Proje değerlendirme" permission). `order` is the random presentation order of
 * the entries, fixed when evaluation is first opened. While evaluation is open jurors may only score
 * `current`; a team in `closed` stays frozen for good unless an ADMIN reopens it.
 */
const liveSchema = new mongoose.Schema({
  order: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  current: { type: mongoose.Schema.Types.ObjectId, default: null },
  startedAt: { type: Date, default: null },
  closed: { type: [mongoose.Schema.Types.ObjectId], default: [] }
}, { _id: false });

/** Single document (`_id: 'hackathon'`) holding the whole judging setup. */
const configSchema = new mongoose.Schema({
  _id: { type: String, default: CONFIG_ID },
  criteria: { type: [criterionSchema], default: [] },
  categories: { type: [categorySchema], default: [] },
  entries: { type: [entrySchema], default: [] },
  // Teams an organizer removed from the entries: not added back automatically when they have a
  // project link (autoEntries.js). Adding one by hand takes it off this list.
  excludedTeams: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  locked: { type: Boolean, default: false },
  live: { type: liveSchema, default: () => ({}) },
  revision: { type: Number, default: 1 },
  // Increases on every score reset, so a device cannot re-send scores from before the reset.
  round: { type: Number, default: 1 },
  // Every scorecard write bumps this inside its transaction. That makes it conflict with a
  // simultaneous lock, config change or reset instead of slipping past it.
  writeSeq: { type: Number, default: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('JudgingConfig', configSchema);
module.exports.CONFIG_ID = CONFIG_ID;
