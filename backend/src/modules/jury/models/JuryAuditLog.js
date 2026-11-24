const mongoose = require('mongoose');

const ACTIONS = ['JUROR_CREATED', 'LINK_REGENERATED', 'JUROR_RENAMED', 'JUROR_ACTIVATED', 'JUROR_DEACTIVATED',
  'CONFIG_UPDATED', 'LOCKED', 'UNLOCKED', 'SCORECARDS_RESET', 'SCORECARD_VOIDED'];

/** Append-only: the module has no route or function that edits or deletes an entry, reset keeps them. */
const auditSchema = new mongoose.Schema({
  action: { type: String, enum: ACTIONS, required: true, immutable: true },
  // A copy, so the entry stays readable when the account is renamed or removed.
  actor: {
    type: new mongoose.Schema({
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      role: { type: String, required: true }
    }, { _id: false }),
    required: true,
    immutable: true
  },
  target: { type: String, default: '', immutable: true },
  details: { type: mongoose.Schema.Types.Mixed, default: () => ({}), immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false });

module.exports = mongoose.model('JuryAuditLog', auditSchema);
