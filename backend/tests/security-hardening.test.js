// Regression tests for the security-hardening pass:
// account enumeration, password-reset rate limiting, client-supplied resume URLs,
// anonymous form uploads, legacy token revocation and request body size.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-hardening-'));
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// authController destructures the reset mailer at require time, so mocks go in before app.
const mail = require('../src/services/emailService');
const sent = [];
mail.sendRegistrationOtpEmail = mail.sendHackathonOtpEmail = mail.sendPasswordResetOtpEmail = async (message) => {
  sent.push(message);
};
const app = require('../src/app');
const User = require('../src/models/User');
const VerificationToken = require('../src/models/VerificationToken');
const HackathonApp = require('../src/modules/hackathon/models/HackathonApp');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const Participant = require('../src/modules/participantAuth/models/Participant');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { generateToken } = require('../src/utils/jwt');

const PASSWORD = 'safe-test-password';
const validPdf = Buffer.from('%PDF-1.7\n%Test Document\n');
const privateFiles = () => fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'));
let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), VerificationToken.init(), HackathonApp.init(), Form.init(), FormResponse.init(), Participant.init()]);
});
after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});
beforeEach(async () => {
  sent.length = 0;
  await Promise.all([User, VerificationToken, HackathonApp, Form, FormResponse, Participant].map(model => model.deleteMany({})));
});
const makeUser = async (email, overrides = {}) => User.create({
  fullName: 'Kayıtlı Kişi', email, passwordHash: await bcrypt.hash(PASSWORD, 4),
  role: 'MEMBER', isEmailVerified: true, ...overrides
});
const post = (url, body) => request(app).post(url).send(body);

test('forgot-password answers identically for registered and unknown e-mails, even inside the cooldown', async () => {
  await makeUser('known@pau.edu.tr');
  const known = await post('/api/v1/auth/forgot-password', { email: 'known@pau.edu.tr' });
  const unknown = await post('/api/v1/auth/forgot-password', { email: 'nobody@pau.edu.tr' });
  assert.equal(known.status, 200);
  assert.deepEqual(unknown.status, known.status);
  assert.equal(unknown.body.message, known.body.message);
  assert.deepEqual(sent.map(m => m.email), ['known@pau.edu.tr'], 'only the real account receives a mail');

  // A second request within the 60 s cooldown used to return 429 only for real accounts.
  const repeat = await post('/api/v1/auth/forgot-password', { email: 'known@pau.edu.tr' });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.message, known.body.message);
});

test('reset-password, verify-email and register reject unknown/verified accounts exactly like a wrong code', async () => {
  await makeUser('known@pau.edu.tr');
  await makeUser('pending@gmail.com', { isEmailVerified: false, role: 'PENDING' });
  await VerificationToken.generateOtp('pending@gmail.com', 'REGISTER', 10);

  const wrongCode = await post('/api/v1/auth/reset-password', { email: 'known@pau.edu.tr', code: '000000', newPassword: 'another-password' });
  const unknownReset = await post('/api/v1/auth/reset-password', { email: 'nobody@pau.edu.tr', code: '000000', newPassword: 'another-password' });
  assert.equal(wrongCode.status, 400);
  assert.equal(unknownReset.status, wrongCode.status);
  assert.equal(unknownReset.body.message, wrongCode.body.message);

  const wrongVerify = await post('/api/v1/auth/verify-email', { email: 'pending@gmail.com', code: '000000' });
  const unknownVerify = await post('/api/v1/auth/verify-email', { email: 'nobody@gmail.com', code: '000000' });
  const verifiedVerify = await post('/api/v1/auth/verify-email', { email: 'known@pau.edu.tr', code: '000000' });
  for (const res of [unknownVerify, verifiedVerify]) {
    assert.equal(res.status, wrongVerify.status);
    assert.equal(res.body.message, wrongVerify.body.message);
  }

  const registerVerified = await post('/api/v1/auth/register', { fullName: 'Saldırgan', email: 'known@pau.edu.tr', password: 'attacker-password', code: '123456' });
  assert.equal(registerVerified.status, 400);
  assert.equal(registerVerified.body.message, wrongVerify.body.message);
  const stored = await User.findOne({ email: 'known@pau.edu.tr' }).select('+passwordHash');
  assert.equal(await bcrypt.compare(PASSWORD, stored.passwordHash), true, 'existing password must be untouched');
});

test('send-otp and register without code look the same for verified accounts but send no mail', async () => {
  await makeUser('known@pau.edu.tr');
  const knownOtp = await post('/api/v1/auth/send-otp', { email: 'known@pau.edu.tr' });
  const freshOtp = await post('/api/v1/auth/send-otp', { email: 'fresh@pau.edu.tr' });
  assert.equal(knownOtp.status, 200);
  assert.equal(freshOtp.status, 200);
  assert.equal(knownOtp.body.message, freshOtp.body.message);

  const knownRegister = await post('/api/v1/auth/register', { fullName: 'Biri', email: 'known@pau.edu.tr', password: PASSWORD });
  const freshRegister = await post('/api/v1/auth/register', { fullName: 'Biri', email: 'other@pau.edu.tr', password: PASSWORD });
  assert.equal(knownRegister.status, freshRegister.status);
  assert.deepEqual(knownRegister.body, freshRegister.body);
  assert.deepEqual(sent.map(m => m.email), ['fresh@pau.edu.tr', 'other@pau.edu.tr']);
});

test('hackathon apply ignores a client-supplied resumeUrl', async () => {
  const fields = {
    teamName: 'Takım', leaderName: 'Lider Adı', leaderEmail: 'lead@example.com', leaderPhone: '+905551112233',
    memberCount: '3', projectIdea: 'Yeterince uzun ve açıklayıcı bir proje fikri'
  };
  await post('/api/v1/hackathon/send-verification', { leaderEmail: fields.leaderEmail });
  const code = sent.at(-1).code;
  const res = await post('/api/v1/hackathon/apply', { ...fields, code, resumeUrl: 'https://phishing.example/cv.pdf' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((await HackathonApp.findById(res.body.data.applicationId)).resumeUrl, null);
});

test('forms with file fields reject anonymous submissions before anything is written to disk', async () => {
  const fileForm = await Form.create({ title: 'Dosyalı', slug: 'dosyali', status: 'PUBLISHED',
    fields: [{ fieldId: 'cv', label: 'CV', type: 'file', required: true }],
    settings: { verificationRequired: false, allowMultipleSubmissions: true } });
  const anonymous = await request(app).post(`/api/v1/forms/public/${fileForm.slug}/submit`).attach('cv', validPdf, 'cv.pdf');
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await privateFiles(), []);
  assert.equal(await FormResponse.countDocuments(), 0);

  const participant = await Participant.create({ email: 'person@example.com', emailVerifiedAt: new Date() });
  const verified = await request(app).post(`/api/v1/forms/public/${fileForm.slug}/submit`)
    .set('Authorization', `Bearer ${issueToken(participant, 'EMAIL_OTP').token}`).attach('cv', validPdf, 'cv.pdf');
  assert.equal(verified.status, 201, JSON.stringify(verified.body));

  // Forms without file fields keep allowing anonymous answers when configured to.
  const textForm = await Form.create({ title: 'Anket', slug: 'anket', status: 'PUBLISHED',
    fields: [{ fieldId: 'note', label: 'Not', type: 'text', required: true }],
    settings: { verificationRequired: false, allowMultipleSubmissions: true } });
  assert.equal((await post(`/api/v1/forms/public/${textForm.slug}/submit`, { note: 'merhaba' })).status, 201);
});

test('tokens without tokenVersion are revoked by a password reset', async () => {
  const user = await makeUser('admin@pau.edu.tr', { role: 'ADMIN' });
  const legacyToken = generateToken({ id: user._id, role: 'ADMIN' }); // no tokenVersion claim
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${legacyToken}`)).status, 200);

  await post('/api/v1/auth/forgot-password', { email: 'admin@pau.edu.tr' });
  const reset = await post('/api/v1/auth/reset-password', { email: 'admin@pau.edu.tr', code: sent.at(-1).code, newPassword: 'brand-new-password' });
  assert.equal(reset.status, 200);
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${legacyToken}`)).status, 401);
});

test('JSON bodies above 1 MB are rejected with 413', async () => {
  const res = await post('/api/v1/auth/login', { email: 'a@gmail.com', password: 'x'.repeat(1.1 * 1024 * 1024) });
  assert.equal(res.status, 413);
  assert.equal(res.body.success, false);
});

// Keep last: the auth limiter is shared per process and would starve the tests above.
test('forgot-password and reset-password share the strict auth rate limit', async () => {
  let last;
  for (let i = 0; i < 31; i += 1) last = await post('/api/v1/auth/forgot-password', { email: 'nobody@pau.edu.tr' });
  assert.equal(last.status, 429);
  const reset = await post('/api/v1/auth/reset-password', { email: 'nobody@pau.edu.tr', code: '000000', newPassword: 'another-password' });
  assert.equal(reset.status, 429);
});
