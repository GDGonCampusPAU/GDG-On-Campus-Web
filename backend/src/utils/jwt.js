const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gdg_pau_fallback_secret_key_development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token for a given user payload
 * @param {Object} payload - { id, role, email }
 * @returns {string} Signed JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Verify a given JWT token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
};

module.exports = {
  generateToken,
  verifyToken
};

