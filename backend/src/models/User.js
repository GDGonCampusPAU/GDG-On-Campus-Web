const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const PAU_OR_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(gmail\.com|pau\.edu\.tr|posta\.pau\.edu\.tr)$/i;

// Permission Schema (True/False access rights)
const permissionSchema = new mongoose.Schema(
  {
    canManageHackathon: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManageForms: { type: Boolean, default: false },
    canManageContent: { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Ad ve soyad alanı zorunludur.'],
      trim: true,
      minlength: [2, 'Ad ve soyad en az 2 karakter olmalıdır.'],
      maxlength: [100, 'Ad ve soyad en fazla 100 karakter olabilir.']
    },
    email: {
      type: String,
      required: [true, 'E-posta adresi zorunludur.'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value) {
          return PAU_OR_GMAIL_REGEX.test(value);
        },
        message: 'Lütfen geçerli bir Pamukkale Üniversitesi (@pau.edu.tr / @posta.pau.edu.tr) veya Gmail adresi giriniz.'
      }
    },
    passwordHash: {
      type: String,
      required: [true, 'Şifre alanı zorunludur.']
    },
    role: {
      type: String,
      enum: {
        values: ['PENDING', 'MEMBER', 'ORGANIZER', 'ADMIN'],
        message: 'Geçersiz rol tipi: {VALUE}'
      },
      default: 'PENDING'
    },
    permissions: {
      type: permissionSchema,
      default: () => ({})
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
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

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  return userObject;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
