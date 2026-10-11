const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
process.env.JWT_SECRET = 'test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { verifyGoogle } = require('../src/modules/participantAuth/services/googleService');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const original = OAuth2Client.prototype.getFederatedSignonCertsAsync;
before(() => {
  // Stub Google's key download only. Real library signature/claim verification runs.
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({ certs: { test: publicKey.export({ type: 'spki', format: 'pem' }) } });
});
after(() => { OAuth2Client.prototype.getFederatedSignonCertsAsync = original; });
const signed = (overrides = {}, key = privateKey) => jwt.sign({ sub: 'subject', email: 'person@gmail.com', email_verified: true,
  aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides }, key, { algorithm: 'RS256', keyid: 'test' });

test('Google signed identity succeeds for Gmail and Workspace', async () => {
  assert.equal((await verifyGoogle(signed())).email, 'person@gmail.com');
  assert.equal((await verifyGoogle(signed({ email: 'person@pau.edu.tr', hd: 'pau.edu.tr' }))).email, 'person@pau.edu.tr');
});
test('Google incorrect audience, issuer, expiry and signature are rejected', async () => {
  for (const payload of [ { aud: 'other-client' }, { iss: 'https://attacker.example' }, { exp: Math.floor(Date.now() / 1000) - 600 } ]) {
    await assert.rejects(verifyGoogle(signed(payload)), error => error.status === 401);
  }
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  await assert.rejects(verifyGoogle(signed({}, other.privateKey)), error => error.status === 401);
});
test('Google unverified and third party emails cannot bypass email OTP', async () => {
  await assert.rejects(verifyGoogle(signed({ email_verified: false })), error => error.status === 401);
  await assert.rejects(verifyGoogle(signed({ email: 'person@example.com' })), error => error.status === 403);
});
