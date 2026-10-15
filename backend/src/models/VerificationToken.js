const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    email: {
      type: String,
      required: [true, 'E-posta adresi zorunludur.'],
      lowercase: true,
      trim: true,
      index: true
    },
    verificationMethod: {
      type: String,
      enum: {
        values: ['OTP_CODE', 'MAGIC_LINK'],
        message: 'Geçersiz doğrulama yöntemi: {VALUE}'
      },
      required: true,
      default: 'OTP_CODE'
    },
    verificationStatus: {
      type: Boolean,
      default: false
    },
    code: {
      type: String,
      required: [true, 'Doğrulama kodu zorunludur.'],
      trim: true
    },
    purpose: {
      type: String,
      required: [true, 'Kullanım amacı zorunludur.'],
      enum: {
        values: ['HACKATHON_APPLY', 'REGISTER', 'LOGIN_2FA'],
        message: 'Geçersiz kullanım amacı: {VALUE}'
      }
    },
    expiresAt: {
      type: Date,
      required: [true, 'Bitiş süresi zorunludur.'],
      index: { expires: 0 } 
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);
module.exports = VerificationToken;