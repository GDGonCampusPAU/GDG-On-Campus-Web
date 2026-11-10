const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VerificationToken = require('../models/VerificationToken');
const { generateToken } = require('../utils/jwt');
const { validateRegisterInput, validateLoginInput, isValidPauOrGmail } = require('../utils/validators');
const { sendTeamOtp } = require('../services/teamOtpService');
const { sendPasswordResetOtpEmail } = require('../services/emailService');

/**
 * @desc    Send 2FA / Verification code to email before or during registration
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
const sendRegisterOtp = async (req, res, next) => {
  try {
    const { email, fullName } = req.body;
    if (fullName != null && typeof fullName !== 'string') return res.status(400).json({ message: 'Ad soyad metin olmalıdır.' });

    if (!email || !isValidPauOrGmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen geçerli bir Pamukkale Üniversitesi (@pau.edu.tr / @posta.pau.edu.tr) veya Gmail adresi giriniz.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if an already verified user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: 'Bu e-posta adresi ile zaten kayıtlı ve doğrulanmış bir hesap bulunmaktadır.'
      });
    }

    // Generate 6-digit OTP code (10 min TTL)
    await sendTeamOtp({
      email: normalizedEmail, purpose: 'REGISTER',
      fullName: fullName ? fullName.trim() : 'Core Team Adayı'
      });

    return res.status(200).json({
      success: true,
      message: '6 haneli doğrulama kodu e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol ediniz.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register a new user with email verification code
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password, code } = req.body;

    // Validate form inputs
    const errors = validateRegisterInput({ fullName, email, password });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' ')
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if an already verified user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: 'Bu e-posta adresi ile kayıtlı bir hesap zaten bulunmaktadır.'
      });
    }

    // If code is not provided, send OTP and ask user to submit code
    if (!code) {
      await sendTeamOtp({
        email: normalizedEmail, purpose: 'REGISTER',
        fullName: fullName.trim()
      });

      return res.status(200).json({
        success: true,
        requiresVerification: true,
        message: 'Kayıt işlemini tamamlamak için e-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz.'
      });
    }

    // Verify OTP code
    const verification = await VerificationToken.verifyOtp(normalizedEmail, code, 'REGISTER');
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let user;
    if (existingUser && !existingUser.isEmailVerified) {
      // Update existing unverified user
      existingUser.fullName = fullName.trim();
      existingUser.passwordHash = passwordHash;
      existingUser.isEmailVerified = true;
      existingUser.role = 'PENDING';
      user = await existingUser.save();
    } else {
      // Create new user with verified email and PENDING role
      user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'PENDING',
        isEmailVerified: true
      });
    }

    return res.status(201).json({
      success: true,
      message: 'E-posta adresiniz başarıyla doğrulandı ve kayıt başvurunuz alındı. Hesabınız Core Team yönetici onayını beklemektedir.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email with 6-digit code for existing pending user
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (typeof email !== 'string' || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'E-posta adresi ve 6 haneli doğrulama kodu zorunludur.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'E-posta adresiniz zaten doğrulanmış.'
      });
    }

    const verification = await VerificationToken.verifyOtp(normalizedEmail, code, 'REGISTER');
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    user.isEmailVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'E-posta adresiniz başarıyla doğrulandı.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user & return JWT token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = validateLoginInput({ email, password });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' ')
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +tokenVersion');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta adresi veya şifre.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta adresi veya şifre.'
      });
    }

    // 1. Check if email was verified
    if (!user.isEmailVerified) {
      // Send fresh OTP so user can verify easily
      await sendTeamOtp({
        email: normalizedEmail, purpose: 'REGISTER',
        fullName: user.fullName
      });

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'E-posta adresiniz henüz doğrulanmamış. Yeni bir doğrulama kodu e-postanıza gönderildi.'
      });
    }

    // 2. Check if account is still PENDING admin approval
    if (user.role === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Account awaiting admin approval (Hesabınız yönetici onayını beklemektedir).'
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user._id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send password reset OTP code
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Lütfen geçerli bir e-posta adresi giriniz.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!isValidPauOrGmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen geçerli bir Pamukkale Üniversitesi (@pau.edu.tr / @posta.pau.edu.tr) veya Gmail adresi giriniz.'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.'
      });
    }

    const code = await VerificationToken.generateOtp(normalizedEmail, 'PASSWORD_RESET', 10);
    try {
      await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        fullName: user.fullName,
        code
      });
    } catch {
      await VerificationToken.invalidateOtp(normalizedEmail, 'PASSWORD_RESET', code);
      throw Object.assign(new Error('Şifre sıfırlama e-postası gönderilemedi.'), { status: 502 });
    }

    return res.status(200).json({
      success: true,
      message: 'Şifre sıfırlama kodu e-posta adresinize gönderildi.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password using OTP code
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword, password } = req.body;
    const targetPassword = newPassword || password;

    if (!email || typeof email !== 'string' || !code || typeof code !== 'string' || !targetPassword || typeof targetPassword !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'E-posta, 6 haneli doğrulama kodu ve yeni şifre zorunludur.'
      });
    }

    if (targetPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Yeni şifre en az 8 karakter olmalıdır.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+tokenVersion');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı.'
      });
    }

    const verification = await VerificationToken.verifyOtp(normalizedEmail, code, 'PASSWORD_RESET');
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(targetPassword, salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user profile
 * @route   GET /api/v1/auth/me
 * @access  Private (Authenticated)
 */
const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendRegisterOtp,
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  getMe
};
