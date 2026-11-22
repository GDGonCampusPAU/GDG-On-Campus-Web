// A whole hall shares one public IP: one visitor must not be able to lock the others out.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.TRUST_PROXY_HOPS = '1';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mail = require('../src/services/emailService');
mail.sendEmail = async () => {};
mail.sendRegistrationOtpEmail = mail.sendHackathonOtpEmail = mail.sendPasswordResetOtpEmail = async () => {};
const app = require('../src/app');
const User = require('../src/models/User');
const Participant = require('../src/modules/participantAuth/models/Participant');
const { ensureHackathonPage } = require('../src/services/eventPageService');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { generateToken } = require('../src/utils/jwt');

const PASSWORD = 'right-password';
let repl;
let hall;
let network = 0;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await ensureHackathonPage();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const name of ['admin', 'second']) {
    await User.create({ fullName: name, email: `${name}@pau.edu.tr`, passwordHash, role: 'ADMIN', isEmailVerified: true });
  }
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
// every test gets its own hall IP, so counters do not leak between tests
beforeEach(() => {
  network += 1;
  hall = `198.51.100.${network}`;
});

const send = (method, url, { body, token, ip = hall } = {}) => {
  const req = request(app)[method](`/api/v1${url}`).set('X-Forwarded-For', ip);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};
const login = (email, password = PASSWORD, options = {}) => send('post', '/auth/login', { body: { email, password }, ...options });
const repeat = async (count, call) => {
  const statuses = [];
  while (statuses.length < count) {
    const done = statuses.length;
    const batch = await Promise.all(Array.from({ length: Math.min(20, count - done) }, (_, i) => call(done + i)));
    statuses.push(...batch.map(res => res.status));
  }
  return statuses;
};
const codeFor = email => send('post', '/participant-auth/email/send-otp', { body: { email } });

test('wrong logins for other accounts do not lock an admin out', async () => {
  await repeat(80, i => login(`nobody${i % 3}@gmail.com`, 'wrong'));
  assert.equal((await login('admin@pau.edu.tr')).status, 200);
});

test('password guessing on one account still stops at 30, only for that account and IP', async () => {
  const statuses = await repeat(40, () => login('admin@pau.edu.tr', 'wrong'));
  assert.equal(statuses.filter(status => status === 401).length, 30);
  assert.equal(statuses.filter(status => status === 429).length, 10);
  assert.equal((await login('second@pau.edu.tr')).status, 200);
  assert.equal((await login('admin@pau.edu.tr', PASSWORD, { ip: '203.0.113.200' })).status, 200);
});

test('changing case or padding of the e-mail gives no extra guesses', async () => {
  await repeat(30, i => login([' admin@pau.edu.tr', 'ADMIN@pau.edu.tr', 'Admin@PAU.edu.tr '][i % 3], 'wrong'));
  assert.equal((await login('admin@pau.edu.tr', 'wrong')).status, 429);
});

test('successful logins do not use up the limit', async () => {
  const statuses = await repeat(40, () => login('second@pau.edu.tr'));
  assert.deepEqual([...new Set(statuses)], [200]);
});

test('an exhausted general limit does not block login', async () => {
  await repeat(230, () => send('get', '/content/public'));
  assert.equal((await send('get', '/content/public')).status, 429);
  assert.equal((await login('admin@pau.edu.tr')).status, 200);
});

test('signed-in people have their own general limit', async () => {
  const admin = await User.findOne({ email: 'admin@pau.edu.tr' });
  const person = await Participant.create({ email: `signed${network}@example.com`, emailVerifiedAt: new Date() });
  await repeat(230, () => send('get', '/content/public'));
  assert.equal((await send('get', '/auth/me', { token: generateToken({ id: admin._id, role: 'ADMIN' }) })).status, 200);
  const mine = await send('get', '/forms/public/hackathon-katilim/my-submission', { token: issueToken(person, 'EMAIL_OTP').token });
  assert.equal(mine.status, 200);
});

test('a forged token does not escape the limit of its IP', async () => {
  await repeat(230, () => send('get', '/content/public'));
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: String(new mongoose.Types.ObjectId()) })).toString('base64url');
  assert.equal((await send('get', '/content/public', { token: `${header}.${payload}.sahte` })).status, 429);
});

test('the pages needed before sign-in load after the general limit is used up', async () => {
  await repeat(230, () => send('get', '/content/public'));
  assert.equal((await send('get', '/event-page/hackathon')).status, 200);
  assert.equal((await send('get', '/forms/public/hackathon-katilim')).status, 200);
});

test('more than 15 participants can sign in from one hall', async () => {
  for (let i = 0; i < 40; i += 1) {
    const email = `person${network}x${i}@example.com`;
    assert.equal((await codeFor(email)).status, 200, `send ${i}`);
    const verify = await send('post', '/participant-auth/email/verify', { body: { email, code: '000000' } });
    assert.equal(verify.status, 400, `verify ${i}`);
  }
});

test('codes for unknown addresses stay capped, known participants still get theirs', async () => {
  const email = `known${network}@example.com`;
  await Participant.create({ email, emailVerifiedAt: new Date() });
  const statuses = await repeat(105, i => codeFor(`flood${network}x${i}@example.com`));
  assert.equal(statuses.filter(status => status === 200).length, 100);
  assert.equal(statuses.filter(status => status === 429).length, 5);
  assert.equal((await codeFor(email)).status, 200);
});

test('code guessing is capped per address without affecting others', async () => {
  const verify = email => send('post', '/participant-auth/email/verify', { body: { email, code: '123456' } });
  const statuses = await repeat(20, () => verify('victim@example.com'));
  assert.equal(statuses.filter(status => status === 400).length, 15);
  assert.equal((await verify('other@example.com')).status, 400);
});

test('team mail endpoints stay capped without blocking login or participants', async () => {
  const statuses = await repeat(35, () => send('post', '/auth/forgot-password', { body: { email: 'nobody@pau.edu.tr' } }));
  assert.equal(statuses.filter(status => status === 429).length, 5);
  assert.equal((await login('admin@pau.edu.tr')).status, 200);
  assert.equal((await codeFor(`after${network}@example.com`)).status, 200);
});

test('team code checks are capped per address', async () => {
  const check = (url, extra = {}) => send('post', `/auth/${url}`, { body: { email: 'victim@gmail.com', code: '000000', ...extra } });
  await repeat(30, () => check('verify-email'));
  assert.equal((await check('register', { fullName: 'Saldırgan', password: 'long-enough-password' })).status, 429);
  assert.equal((await check('reset-password', { newPassword: 'long-enough-password' })).status, 429);
});

test('sign-in bodies are small: a large one is refused before it is processed', async () => {
  assert.equal((await login('admin@pau.edu.tr', 'x'.repeat(20 * 1024))).status, 413);
});
