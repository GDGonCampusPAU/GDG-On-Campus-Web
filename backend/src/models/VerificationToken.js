const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      trim: true
    },
    purpose: {
      type: String,
      required: true,
      enum: ['REGISTER', 'LOGIN_2FA', 'HACKATHON_APPLY', 'FORM_SUBMIT'],
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      required: true,
      // MongoDB TTL Index: automatically deletes document when expiresAt is reached
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

/**
 * Generate and store a new 6-digit OTP code for an email and purpose
 * Replaces any existing token for the same email and purpose
 */
verificationTokenSchema.statics.generateOtp = async function (email, purpose, ttlMinutes = 10) {
  const normalizedEmail = email.toLowerCase().trim();

  // Generate cryptographically suitable 6-digit numeric string
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Remove existing tokens for this email & purpose
  await this.deleteMany({ email: normalizedEmail, purpose });

  // Create new verification token
  const token = await this.create({
    email: normalizedEmail,
    code,
    purpose,
    expiresAt
  });

  return token.code;
};

/**
 * Verify an OTP code for an email and purpose
 * Checks expiration, attempts limit, and validity
 */
verificationTokenSchema.statics.verifyOtp = async function (email, inputCode, purpose) {
  const normalizedEmail = email.toLowerCase().trim();
  const token = await this.findOne({ email: normalizedEmail, purpose });

  if (!token) {
    return {
      success: false,
      message: 'Doğrulama kodu bulunamadı veya süresi dolmuş. Lütfen yeni bir kod isteyiniz.'
    };
  }

  // Check expiration manually as safety fallback
  if (new Date() > token.expiresAt) {
    await this.deleteOne({ _id: token._id });
    return {
      success: false,
      message: 'Doğrulama kodunun geçerlilik süresi (10 dakika) doldu. Lütfen tekrar kod isteyiniz.'
    };
  }

  // Brute force protection: max 5 failed attempts
  if (token.attempts >= 5) {
    await this.deleteOne({ _id: token._id });
    return {
      success: false,
      message: 'Çok fazla hatalı kod denemesi yapıldı. Güvenlik nedeniyle lütfen yeni bir kod talep ediniz.'
    };
  }

  if (token.code !== inputCode.toString().trim()) {
    token.attempts += 1;
    await token.save();
    return {
      success: false,
      message: `Hatalı doğrulama kodu. Kalan deneme hakkı: ${5 - token.attempts}`
    };
  }

  // Code is valid! Consume/delete the token to prevent reuse
  await this.deleteOne({ _id: token._id });

  return {
    success: true,
    message: 'E-posta doğrulama başarılı.'
  };
};

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

module.exports = VerificationToken;
