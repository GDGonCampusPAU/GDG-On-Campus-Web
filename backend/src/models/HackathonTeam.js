const mongoose = require('mongoose');

/**
 * Teams created during registration. The founder is the captain; others join with the
 * 6-character code and wait for the captain's approval (status PENDING).
 * Separate from the removed legacy `Team` model so old `teams` documents are untouched.
 */
const memberSchema = new mongoose.Schema({
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  response: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse', default: null },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  requestedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date, default: null }
}, { _id: false });

const teamSchema = new mongoose.Schema({
  form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
  // Case-insensitive (Turkish) key so "Kod Kurtları" and "kod kurtları" cannot both exist.
  nameKey: { type: String, required: true },
  code: { type: String, required: true, match: /^[A-Z0-9]{6}$/ },
  captain: {
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    response: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse', default: null }
  },
  members: { type: [memberSchema], default: [] }
}, { timestamps: true, versionKey: false });

teamSchema.index({ code: 1 }, { unique: true });
teamSchema.index({ form: 1, nameKey: 1 }, { unique: true });
teamSchema.index({ form: 1, 'captain.participant': 1 });
teamSchema.index({ form: 1, 'members.participant': 1 });

module.exports = mongoose.model('HackathonTeam', teamSchema);
