const { createHash, randomBytes } = require('node:crypto');

// 24 random bytes are always 32 base64url characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const hashToken = token => createHash('sha256').update(token).digest('hex');

/** The plain token is returned to the admin once; only the hash is stored. */
const issueToken = () => {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

module.exports = { TOKEN_PATTERN, hashToken, issueToken };
