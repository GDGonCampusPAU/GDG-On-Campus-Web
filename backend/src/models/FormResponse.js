const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    fieldId: {
      type: String,
      required: [true, 'Alan kimliği zorunludur.']
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
      required: [true, 'Alan kimliği zorunludur.']
    },
    originalName: {
      type: String,
      required: [true, 'Orijinal dosya adı zorunludur.']
    },
    filename: {
      type: String,
      required: [true, 'Dosya adı zorunludur.']
    },
    url: {
      type: String,
      required: [true, 'Dosya URL adresi zorunludur.']
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
    formSlug: {
      type: String,
      required: [true, 'Form URL adresi (slug) zorunludur.'],
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

formResponseSchema.index({ form: 1, submittedAt: -1 });

const FormResponse = mongoose.model('FormResponse', formResponseSchema);
module.exports = FormResponse;