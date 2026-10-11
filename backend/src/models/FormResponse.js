const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    fieldId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
);

const uploadedFileSchema = new mongoose.Schema(
  {
    fieldId: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const formResponseSchema = new mongoose.Schema(
  {
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      required: [true, 'Form referansı zorunludur.'],
      index: true
    },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', default: null },
    verifiedEmail: { type: String, default: null },
    verificationMethod: { type: String, enum: ['GOOGLE', 'EMAIL_OTP', null], default: null },
    verifiedAt: { type: Date, default: null },
    singleSubmissionKey: { type: String },
    formSlug: {
      type: String,
      required: true,
      index: true
    },
    answers: {
      type: [answerSchema],
      default: []
    },
    uploadedFiles: {
      type: [uploadedFileSchema],
      default: []
    },
    respondent: {
      ip: {
        type: String,
        default: null
      },
      userAgent: {
        type: String,
        default: null
      },
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    },
    submittedAt: {
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

// Only single-submission responses carry this key; anonymous/multiple responses do not.
formResponseSchema.index({ form: 1, singleSubmissionKey: 1 }, {
  unique: true, partialFilterExpression: { singleSubmissionKey: { $type: 'string' } }
});

// Indexes
formResponseSchema.index({ form: 1, submittedAt: -1 });

const FormResponse = mongoose.model('FormResponse', formResponseSchema);

module.exports = FormResponse;

