const mongoose = require('mongoose');

/**
 * A team's project link (one per team). Any approved member can set or change it from the
 * project upload site; every change is kept in history so a dispute can be traced.
 */
const personSchema = new mongoose.Schema({
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  name: { type: String, default: '' }
}, { _id: false });

const historySchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  by: { type: personSchema, required: true },
  at: { type: Date, required: true }
}, { _id: false });

const HISTORY_MAX = 50;

const projectSubmissionSchema = new mongoose.Schema({
  form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonTeam', required: true },
  repoUrl: { type: String, required: true },
  // owner/repo in lower case: the same repo cannot be submitted by two teams.
  repoKey: { type: String, required: true },
  updatedBy: { type: personSchema, required: true },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

projectSubmissionSchema.index({ team: 1 }, { unique: true });
projectSubmissionSchema.index({ form: 1, repoKey: 1 }, { unique: true });

module.exports = mongoose.model('ProjectSubmission', projectSubmissionSchema);
module.exports.HISTORY_MAX = HISTORY_MAX;
