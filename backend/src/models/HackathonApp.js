const mongoose = require('mongoose');

const hackathonAppSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: [true, 'Takım adı zorunludur.'],
      trim: true,
      maxlength: [100, 'Takım adı en fazla 100 karakter olabilir.']
    },
    leaderName: {
      type: String,
      required: [true, 'Takım lideri adı ve soyadı zorunludur.'],
      trim: true,
      maxlength: [100, 'Lider adı en fazla 100 karakter olabilir.']
    },
    leaderEmail: {
      type: String,
      required: [true, 'Takım lideri e-posta adresi zorunludur.'],
      trim: true,
      lowercase: true
    },
    leaderPhone: {
      type: String,
      required: [true, 'Takım lideri telefon numarası zorunludur.'],
      trim: true
    },
    memberCount: {
      type: Number,
      required: [true, 'Takım üye sayısı zorunludur.'],
      min: [1, 'Takım üye sayısı en az 1 olmalıdır.'],
      max: [5, 'Takım üye sayısı en fazla 5 olabilir.']
    },
    projectIdea: {
      type: String,
      required: [true, 'Proje fikri/özeti zorunludur.'],
      trim: true
    },
    resumeUrl: {
      type: String,
      trim: true,
      default: null
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

// Index for searching applications
hackathonAppSchema.index({ appliedAt: -1 });
hackathonAppSchema.index({ teamName: 'text', leaderName: 'text', leaderEmail: 'text' });

const HackathonApp = mongoose.model('HackathonApp', hackathonAppSchema);

module.exports = HackathonApp;

