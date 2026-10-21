const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: [true, 'Takım adı zorunludur.'],
      trim: true,
      maxlength: [100, 'Takım adı en fazla 100 karakter olabilir.']
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Takım kaptanı ID zorunludur.']
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;