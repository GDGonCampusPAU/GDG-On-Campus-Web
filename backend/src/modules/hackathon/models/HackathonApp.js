const mongoose = require('mongoose');

const hackathonAppSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Ad ve soyad alanı zorunludur.'],
      trim: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Takım ID alanı zorunludur.']
    },
    mailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationToken',
      required: [true, 'Mail doğrulama ID alanı zorunludur.']
    },
    motivation: {
      type: String,
      required: [true, 'Katılım nedeni (motivasyon) zorunludur.'],
      trim: true
    },
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

const HackathonApp = mongoose.model('HackathonApp', hackathonAppSchema);
module.exports = HackathonApp;