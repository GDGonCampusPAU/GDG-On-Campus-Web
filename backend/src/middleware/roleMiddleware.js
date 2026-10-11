/**
 * Role-Based Access Control Middleware
 *
 * Ensures:
 * 1. User is authenticated (req.user is present).
 * 2. If req.user.role === 'PENDING', responds with 403 Forbidden ("Account awaiting admin approval").
 * 3. If specific roles are supplied, verifies req.user.role is included.
 *
 * @param  {...string} allowedRoles Optional list of roles, e.g. 'ORGANIZER', 'ADMIN'
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme gerekli. Lütfen giriş yapınız.'
      });
    }

    // Check if the user is still pending approval
    if (req.user.role === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Account awaiting admin approval (Hesabınız yönetici onayını bekliyor).'
      });
    }

    // If specific roles are defined, ensure user's role is in the list
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Erişim engellendi: Bu işlem için gerekli yetkiye sahip değilsiniz.'
      });
    }

    next();
  };
};

module.exports = {
  requireRoles
};

