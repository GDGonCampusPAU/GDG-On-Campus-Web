const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VerificationToken = require('../models/VerificationToken');
const { generateToken } = require('../utils/jwt');
const { validateRegisterInput, validateLoginInput, isValidPauOrGmail } = require('../utils/validators');
const { sendTeamOtp } = require('../services/teamOtpService');

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

    const verification = await VerificationToken.verifyOtp(normalizedEmail, code, 'REGISTER');
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    if (user) {
      user.isEmailVerified = true;
      await user.save();
    }

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

    const user = await User.findOne({ email: normalizedEmail });
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
      email: user.email
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
  getMe
};
