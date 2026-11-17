const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  fullName: { type: String, default: '', maxlength: 100 },
  googleSubject: { type: String },
  emailVerifiedAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });
schema.index({ googleSubject: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Participant', schema);
