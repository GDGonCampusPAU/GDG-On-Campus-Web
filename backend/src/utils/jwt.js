const jwt = require('jsonwebtoken');

const getTeamConfig = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_key_here' || secret.length < 32) {
    throw new Error('JWT_SECRET en az 32 karakterlik gerçek bir anahtar olmalıdır.');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  if (!/^\d+(?:s|m|h|d|w)$/.test(expiresIn) || parseInt(expiresIn, 10) < 1) {
    throw new Error('JWT_EXPIRES_IN örneğin 30m veya 7d olmalıdır.');
  }
  return { secret, expiresIn };
};

/**
 * Generate a JWT token for a given user payload
 * @param {Object} payload - { id, role, email }
 * @returns {string} Signed JWT token
 */
const generateToken = (payload) => {
  const { secret, expiresIn } = getTeamConfig();
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn
  });
};

/**
 * Verify a given JWT token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, getTeamConfig().secret, { algorithms: ['HS256'] });
};

module.exports = {
  getTeamConfig,
  generateToken,
  verifyToken
};

