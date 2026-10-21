const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  resendAfter: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('ParticipantOtp', schema);
