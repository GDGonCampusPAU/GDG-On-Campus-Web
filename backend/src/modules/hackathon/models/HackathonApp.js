const mongoose = require('mongoose');

const hackathonAppSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
      trim: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: false
    },
    mailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationToken',
      required: false
    },
    motivation: {
      type: String,
      required: false,
      trim: true
    },
    // Keep old reference-based records readable while matching the existing API payload.
    teamName: { type: String, trim: true, required: function () { return !this.teamId; } },
    leaderName: { type: String, trim: true, required: function () { return !this.teamId; } },
    leaderEmail: { type: String, lowercase: true, trim: true, required: function () { return !this.teamId; } },
    leaderPhone: { type: String, trim: true, required: function () { return !this.teamId; } },
    memberCount: { type: Number, min: 1, max: 5, validate: Number.isInteger },
    projectIdea: { type: String, trim: true },
    resumeUrl: { type: String, default: null },
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