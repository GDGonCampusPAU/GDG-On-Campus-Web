const mongoose = require('mongoose');

/** A jury member has no account: they sign in with a personal link, stored only as a hash. */
const jurorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  tokenHash: { type: String, required: true, unique: true, select: false },
  active: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Juror', jurorSchema);
