const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mail = require('../src/services/emailService');
let code;
let deliveryFails = false;
mail.sendRegistrationOtpEmail = mail.sendHackathonOtpEmail = async (message) => {
  code = message.code;
  if (deliveryFails) throw new Error('provider unavailable');
};
const app = require('../src/app');
const User = require('../src/models/User');
const Otp = require('../src/models/VerificationToken');
const HackathonApp = require('../src/models/HackathonApp');
const { generateToken } = require('../src/utils/jwt');
let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Otp.init(), HackathonApp.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  code = undefined; deliveryFails = false;
  await Promise.all([User, Otp, HackathonApp].map(model => model.deleteMany({})));
});
const account = { fullName: 'Test User', email: 'test@gmail.com', password: 'safe-test-password' };
const identity = async (role) => {
  const user = await User.create({ fullName: role, email: `${role.toLowerCase()}@pau.edu.tr`,
    passwordHash: await bcrypt.hash(account.password, 4), role, isEmailVerified: true });
  return { user, token: generateToken({ id: user._id, role }) };
};
test('team registration verifies email, waits for ADMIN approval and can then log in', async () => {
  assert.equal((await request(app).post('/api/v1/auth/register').send(account)).status, 200);
  assert.match(code, /^\d{6}$/);
  const registration = await request(app).post('/api/v1/auth/register').send({ ...account, code });
  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  assert.equal(registration.body.user.role, 'PENDING');
  assert.equal((await request(app).post('/api/v1/auth/login').send(account)).status, 403);
  const { token } = await identity('ADMIN');
  const pending = await request(app).get('/api/v1/users?role=PENDING').set('Authorization', `Bearer ${token}`);
  assert.equal(pending.status, 200);
  assert.equal(pending.body.data.length, 1);
  const approval = await request(app).patch(`/api/v1/users/${registration.body.user.id}/role`)
    .set('Authorization', `Bearer ${token}`).send({ role: 'ORGANIZER' });
  assert.equal(approval.status, 200);
  const login = await request(app).post('/api/v1/auth/login').send(account);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'ORGANIZER');
  assert.equal(login.body.user.passwordHash, undefined);
});
test('OTP is hashed, purpose scoped, single use and safe under concurrent consumption', async () => {
  const issued = await Otp.generateOtp(account.email, 'REGISTER', 10);
  const stored = await Otp.findOne().select('+codeHash').lean();
  assert.equal(stored.code, undefined);
  assert.match(stored.codeHash, /^[a-f\d]{64}$/);
  assert.equal((await Otp.verifyOtp(account.email, issued, 'HACKATHON_APPLY')).success, false);
  const checks = await Promise.all(Array.from({ length: 3 }, () => Otp.verifyOtp(account.email, issued, 'REGISTER')));
  assert.equal(checks.filter(result => result.success).length, 1);
  assert.equal((await Otp.verifyOtp(account.email, issued, 'REGISTER')).success, false);
});
test('OTP expiry, attempt cap and resend cooldown are enforced', async () => {
  const issued = await Otp.generateOtp(account.email, 'REGISTER', 10);
  await assert.rejects(Otp.generateOtp(account.email, 'REGISTER', 10), error => error.status === 429);
  for (let i = 0; i < 5; i++) await Otp.verifyOtp(account.email, '000000', 'REGISTER');
  assert.equal((await Otp.verifyOtp(account.email, issued, 'REGISTER')).success, false);
  await Otp.updateOne({}, { attempts: 0, expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await Otp.verifyOtp(account.email, issued, 'REGISTER')).success, false);
});
test('mail failure invalidates the challenge and production cannot simulate delivery', async () => {
  deliveryFails = true;
  assert.equal((await request(app).post('/api/v1/auth/send-otp').send(account)).status, 502);
  assert.equal(await Otp.countDocuments(), 0);
  deliveryFails = false;
  process.env.NODE_ENV = 'production';
  try { assert.equal((await request(app).post('/api/v1/auth/send-otp').send(account)).status, 503); }
  finally { process.env.NODE_ENV = 'test'; }
});
test('user approval rejects anonymous, organizer and self-demotion of the last ADMIN', async () => {
  const admin = await identity('ADMIN');
  const organizer = await identity('ORGANIZER');
  assert.equal((await request(app).get('/api/v1/users')).status, 401);
  assert.equal((await request(app).patch(`/api/v1/users/${admin.user.id}/role`)
    .set('Authorization', `Bearer ${organizer.token}`).send({ role: 'ADMIN' })).status, 403);
  assert.equal((await request(app).patch(`/api/v1/users/${admin.user.id}/role`)
    .set('Authorization', `Bearer ${admin.token}`).send({ role: 'MEMBER' })).status, 400);
});
test('legacy hackathon verification and submission still work', async () => {
  const application = { teamName: 'Test Team', leaderName: 'Test Leader', leaderEmail: 'leader@example.com',
    leaderPhone: '+905551112233', memberCount: 2, projectIdea: 'A sufficiently detailed project idea' };
  assert.equal((await request(app).post('/api/v1/hackathon/send-verification').send(application)).status, 200);
  assert.equal((await request(app).post('/api/v1/hackathon/apply').send({ ...application, code })).status, 201);
  assert.equal(await HackathonApp.countDocuments(), 1);
});
test('seed creates a verified admin and is idempotent without exposing or replacing its password', async () => {
  const { ensureAdmin } = require('../src/services/seedAdminService');
  process.env.DEFAULT_ADMIN_PASSWORD = 'unique-seed-password-for-tests';
  try {
    const first = await ensureAdmin();
    assert.equal(first.isEmailVerified, true);
    assert.equal(first.role, 'ADMIN');
    const second = await ensureAdmin();
    assert.equal(String(first._id), String(second._id));
    assert.equal(second.passwordHash, first.passwordHash);
  } finally { delete process.env.DEFAULT_ADMIN_PASSWORD; }
});
