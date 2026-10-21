const mongoose = require('mongoose');
const { safePattern } = require('../utils/formValidation');

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
          'text', 'textarea', 'number', 'email', 'phone', 
          'select', 'radio', 'checkbox', 'file', 'date'
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
      regex: { type: String, default: null, validate: { validator: value => value == null || safePattern(value), message: 'Regex desteklenen güvenli biçimde olmalıdır.' } }
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
    eventKey: { type: String, default: null, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null },
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
      min: 1,
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
      verificationRequired: { type: Boolean, default: true },
      verificationMethods: {
        type: [{ type: String, enum: ['GOOGLE', 'EMAIL_OTP'] }],
        default: ['GOOGLE', 'EMAIL_OTP'],
        validate: { validator: value => Array.isArray(value) && value.length > 0,
          message: 'En az bir doğrulama yöntemi seçilmelidir.' }
      },
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

formSchema.index({ status: 1, createdAt: -1 });
formSchema.index({ category: 1, status: 1 });
formSchema.pre('validate', function () {
  const ids = this.fields.map(field => field.fieldId);
  if (ids.some(id => !/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(id)) || new Set(ids).size !== ids.length) this.invalidate('fields', 'Alan kimlikleri geçerli ve benzersiz olmalıdır.');
  for (const field of this.fields) {
    if (['select', 'radio', 'checkbox'].includes(field.type) && (!field.options.length || field.options.some(value => !value.trim()) || new Set(field.options).size !== field.options.length)) this.invalidate('fields', 'Seçenekler dolu ve benzersiz olmalıdır.');
    if (field.validation?.min != null && field.validation?.max != null && field.validation.min > field.validation.max) this.invalidate('fields', 'Minimum maksimumdan büyük olamaz.');
  }
  if (this.startDate && this.endDate && this.startDate > this.endDate) this.invalidate('endDate', 'Bitiş başlangıçtan önce olamaz.');
});

const Form = mongoose.model('Form', formSchema);
module.exports = Form;
