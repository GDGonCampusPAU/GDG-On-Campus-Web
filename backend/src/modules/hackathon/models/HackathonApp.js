const mongoose = require('mongoose');

const hackathonAppSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
      trim: true
    },
    // Legacy field from the removed Team model; kept so old documents stay readable.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
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
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    statusNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    lastNotifiedStatus: {
      type: String,
      enum: ['APPROVED', 'REJECTED', null],
      default: null
    },
    lastNotifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

const HackathonApp = mongoose.model('HackathonApp', hackathonAppSchema);
module.exports = HackathonApp;