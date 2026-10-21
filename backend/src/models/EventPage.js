const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, default: 'hackathon' },
  event: { type: mongoose.Schema.Types.Mixed, required: true },
  revision: { type: Number, default: 1 },
  formSlug: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('EventPage', schema);
