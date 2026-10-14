const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Başlık alanı zorunludur.'],
      trim: true,
      maxlength: [200, 'Başlık en fazla 200 karakter olabilir.']
    },
    description: {
      type: String,
      required: [true, 'Açıklama alanı zorunludur.'],
      trim: true
    },
    coverImageUrl: {
      type: String,
      trim: true,
      default: null
    },
    bevyLink: {
      type: String,
      trim: true,
      default: null
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    type: {
      type: String,
      required: [true, 'İçerik türü zorunludur (EVENT veya ANNOUNCEMENT).'],
      enum: {
        values: ['EVENT', 'ANNOUNCEMENT'],
        message: 'İçerik türü yalnızca EVENT veya ANNOUNCEMENT olabilir.'
      },
      index: true
    },
    eventDate: {
      type: Date,
      default: null
    },
    createdAt: {
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

// Helpful index for querying featured contents and public listing
contentSchema.index({ type: 1, createdAt: -1 });
contentSchema.index({ isFeatured: 1, createdAt: -1 });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;

