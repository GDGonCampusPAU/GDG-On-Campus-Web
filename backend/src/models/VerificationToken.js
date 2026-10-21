const mongoose = require('mongoose');
const { randomInt, createHmac } = require('node:crypto');
const { getTeamConfig } = require('../utils/jwt');

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
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    resendAfter: { type: Date, required: true },
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

// Old plaintext records are never accepted; the partial index allows their TTL cleanup.
verificationTokenSchema.index({ email: 1, purpose: 1 }, {
  unique: true, partialFilterExpression: { codeHash: { $type: 'string' } }
});
const hash = (email, purpose, code) => createHmac('sha256', getTeamConfig().secret)
  .update(`${purpose}:${email}:${code}`).digest('hex');
verificationTokenSchema.statics.generateOtp = async function (email, purpose, ttlMinutes = 10) {
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  try {
    await this.findOneAndUpdate({ email, purpose, codeHash: { $type: 'string' }, resendAfter: { $lte: now } }, {
      $set: { codeHash: hash(email, purpose, code), attempts: 0, verificationStatus: false,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60000),
        resendAfter: new Date(now.getTime() + 60000), createdAt: now }
    }, { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code === 11000) throw Object.assign(new Error('Yeni kod istemeden önce 60 saniye bekleyiniz.'), { status: 429 });
    throw error;
  }
  return code;
};
verificationTokenSchema.statics.verifyOtp = async function (email, code, purpose) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { success: false, message: 'Kod 6 haneli olmalıdır.' };
  const filter = { email, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  const consumed = await this.findOneAndDelete({ ...filter, codeHash: hash(email, purpose, code) });
  if (consumed) return { success: true };
  await this.updateOne(filter, { $inc: { attempts: 1 } });
  return { success: false, message: 'Kod hatalı, süresi dolmuş veya deneme hakkı bitmiş.' };
};
verificationTokenSchema.statics.invalidateOtp = function (email, purpose, code) {
  return this.deleteOne({ email, purpose, codeHash: hash(email, purpose, code) });
};

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);
module.exports = VerificationToken;
