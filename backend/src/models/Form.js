const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema(
  {
    fieldId: {
      type: String,
      required: [true, 'Alan kimliği (fieldId) zorunludur.'],
      trim: true
    },
    label: {
      type: String,
      required: [true, 'Soru/alan başlığı zorunludur.'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      required: [true, 'Soru tipi zorunludur.'],
      enum: {
        values: [
          'text',
          'textarea',
          'number',
          'email',
          'phone',
          'select',
          'radio',
          'checkbox',
          'file',
          'date'
        ],
        message: 'Geçersiz soru tipi: {VALUE}'
      },
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      trim: true,
      default: ''
    },
    options: {
      type: [String],
      default: []
    },
    validation: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      regex: { type: String, default: null }
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Form başlığı zorunludur.'],
      trim: true,
      maxlength: [200, 'Form başlığı en fazla 200 karakter olabilir.']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    slug: {
      type: String,
      required: [true, 'Form URL adresi (slug) zorunludur.'],
      unique: true,
      lowercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'],
        message: 'Geçersiz form durumu: {VALUE}'
      },
      default: 'DRAFT',
      index: true
    },
    category: {
      type: String,
      trim: true,
      default: 'GENERAL',
      index: true
    },
    bannerImageUrl: {
      type: String,
      trim: true,
      default: null
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    maxSubmissions: {
      type: Number,
      default: null
    },
    submissionCount: {
      type: Number,
      default: 0
    },
    fields: {
      type: [formFieldSchema],
      default: []
    },
    settings: {
      allowMultipleSubmissions: {
        type: Boolean,
        default: true
      },
      successMessage: {
        type: String,
        default: 'Başvurunuz/yanıtınız başarıyla kaydedildi. Teşekkür ederiz!'
      },
      requireAuth: {
        type: Boolean,
        default: false
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes
formSchema.index({ status: 1, createdAt: -1 });
formSchema.index({ category: 1, status: 1 });

const Form = mongoose.model('Form', formSchema);

module.exports = Form;
