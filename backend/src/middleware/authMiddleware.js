const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Intercepts requests, extracts Bearer Token, verifies JWT, and attaches req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme hatası: Token bulunamadı. Lütfen giriş yapınız.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme hatası: Geçersiz token formatı.'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapınız.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Geçersiz veya bozuk yetkilendirme anahtarı (Token).'
      });
    }

    // Ensure the user still exists in the database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı bulunamadı veya hesabı silinmiş.'
      });
    }

    // Attach user to the request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authMiddleware;

