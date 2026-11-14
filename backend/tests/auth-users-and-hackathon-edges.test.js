const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-auth-hack-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mail = require('../src/services/emailService');

const originalRegMail = mail.sendRegistrationOtpEmail;
const originalHackMail = mail.sendHackathonOtpEmail;
let lastCode;
mail.sendRegistrationOtpEmail = mail.sendHackathonOtpEmail = async (message) => {
  lastCode = message.code;
  return { success: true };
};

const app = require('../src/app');
const User = require('../src/models/User');
const VerificationToken = require('../src/models/VerificationToken');
const HackathonApp = require('../src/modules/hackathon/models/HackathonApp');
const Form = require('../src/models/Form');
const { generateToken } = require('../src/utils/jwt');

const validPdf = Buffer.from('%PDF-1.7\n%Legacy Resume\n');
let repl;

const makeUser = async ({ email, role, isEmailVerified = true, fullName = role, password = 'safe-password-1' }) => {
  const user = await User.create({
    fullName,
    email,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    isEmailVerified
  });
  return { user, token: generateToken({ id: user._id, role: user.role, email: user.email }) };
};

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), VerificationToken.init(), HackathonApp.init(), Form.init()]);
});

after(async () => {
  mail.sendRegistrationOtpEmail = originalRegMail;
  mail.sendHackathonOtpEmail = originalHackMail;
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  lastCode = undefined;
  await Promise.all([User, VerificationToken, HackathonApp, Form].map(model => model.deleteMany({})));
  const privateDir = path.join(process.env.UPLOAD_DIR, 'private');
  for (const name of await fs.readdir(privateDir)) await fs.unlink(path.join(privateDir, name));
});

test('send-otp validation, unverified login recovery via verify-email and /auth/me work', async () => {
  assert.equal((await request(app).post('/api/v1/auth/send-otp').send({ email: 'user@hotmail.com' })).status, 400);
  assert.equal((await request(app).post('/api/v1/auth/send-otp').send({ email: 'ok@gmail.com', fullName: { bad: 1 } })).status, 400);

  const verified = await makeUser({ email: 'verified@pau.edu.tr', role: 'MEMBER', isEmailVerified: true });
  // Verified accounts get the generic success answer (no enumeration) and no mail.
  lastCode = undefined;
  assert.equal((await request(app).post('/api/v1/auth/send-otp').send({ email: verified.user.email })).status, 200);
  assert.equal(lastCode, undefined);

  await makeUser({ email: 'recover@posta.pau.edu.tr', role: 'PENDING', isEmailVerified: false });
  const unverifiedLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: 'recover@posta.pau.edu.tr', password: 'safe-password-1' });
  assert.equal(unverifiedLogin.status, 403);
  assert.equal(unverifiedLogin.body.requiresVerification, true);
  assert.match(lastCode, /^\d{6}$/);

  const verifiedEmailRes = await request(app).post('/api/v1/auth/verify-email')
    .send({ email: 'recover@posta.pau.edu.tr', code: lastCode });
  assert.equal(verifiedEmailRes.status, 200);

  const pendingLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: 'recover@posta.pau.edu.tr', password: 'safe-password-1' });
  assert.equal(pendingLogin.status, 403);
  assert.equal(pendingLogin.body.requiresVerification, undefined);
  assert.equal(pendingLogin.body.message, 'Hesabınız yönetici onayını bekliyor.');

  const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${verified.token}`);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.email, verified.user.email);
  assert.equal(meRes.body.user.passwordHash, undefined);
});

test('RBAC boundaries across MEMBER, ORGANIZER and ADMIN routes plus /users validation rules', async () => {
  const admin = await makeUser({ email: 'admin@pau.edu.tr', role: 'ADMIN' });
  const organizer = await makeUser({ email: 'org@pau.edu.tr', role: 'ORGANIZER' });
  const member = await makeUser({ email: 'member@gmail.com', role: 'MEMBER' });
  const unverified = await makeUser({ email: 'unverified@gmail.com', role: 'PENDING', isEmailVerified: false });

  // MEMBER cannot access staff or admin routes
  for (const [method, endpoint] of [
    ['get', '/api/v1/users'],
    ['get', '/api/v1/forms'],
    ['post', '/api/v1/content'],
    ['put', '/api/v1/event-page/hackathon'],
    ['get', '/api/v1/hackathon/applications'],
    ['get', '/api/v1/files/missing.pdf']
  ]) {
    assert.equal((await request(app)[method](endpoint).set('Authorization', `Bearer ${member.token}`)).status, 403, `${method} ${endpoint}`);
  }

  // ORGANIZER cannot access /users management
  assert.equal((await request(app).get('/api/v1/users').set('Authorization', `Bearer ${organizer.token}`)).status, 403);
  assert.equal((await request(app).patch(`/api/v1/users/${member.user._id}/role`).set('Authorization', `Bearer ${organizer.token}`).send({ role: 'ADMIN' })).status, 403);

  // ADMIN validation edges on /users
  assert.equal((await request(app).get('/api/v1/users?role=INVALID').set('Authorization', `Bearer ${admin.token}`)).status, 400);
  assert.equal((await request(app).patch(`/api/v1/users/${admin.user._id}/role`).set('Authorization', `Bearer ${admin.token}`).send({ role: 'MEMBER' })).status, 400);
  assert.equal((await request(app).patch(`/api/v1/users/${unverified.user._id}/role`).set('Authorization', `Bearer ${admin.token}`).send({ role: 'MEMBER' })).status, 400);
  assert.equal((await request(app).patch('/api/v1/users/64b000000000000000000009/role').set('Authorization', `Bearer ${admin.token}`).send({ role: 'MEMBER' })).status, 404);
});

test('Legacy hackathon apply cleans attached resume on 400, stores private file and protects CSV export formulas', async () => {
  assert.equal((await request(app).post('/api/v1/hackathon/send-verification').send({ leaderEmail: 'bad-email' })).status, 400);
  assert.equal((await request(app).post('/api/v1/hackathon/send-verification').send({ leaderEmail: 'lead@example.com', teamName: 42 })).status, 400);

  // Applying without verification code while attaching a file must reject 400 AND delete temp file
  const missingCode = await request(app).post('/api/v1/hackathon/apply')
    .field('teamName', '=HYPERLINK("https://evil.example")')
    .field('leaderName', 'Lider Adı')
    .field('leaderEmail', 'lead@example.com')
    .field('leaderPhone', '+905551112233')
    .field('memberCount', '3')
    .field('projectIdea', 'Yeterince uzun ve açıklayıcı bir proje fikri')
    .attach('resume', validPdf, 'resume.pdf');
  assert.equal(missingCode.status, 400);
  assert.equal(missingCode.body.requiresVerification, true);
  assert.match(lastCode, /^\d{6}$/);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length, 0);

  const okApply = await request(app).post('/api/v1/hackathon/apply')
    .field('teamName', '=HYPERLINK("https://evil.example")')
    .field('leaderName', 'Lider Adı')
    .field('leaderEmail', 'lead@example.com')
    .field('leaderPhone', '+905551112233')
    .field('memberCount', '3')
    .field('projectIdea', 'Yeterince uzun ve açıklayıcı bir proje fikri')
    .field('code', lastCode)
    .attach('resume', validPdf, 'resume.pdf');
  assert.equal(okApply.status, 201, JSON.stringify(okApply.body));

  const saved = await HackathonApp.findOne();
  assert.match(saved.resumeUrl, /^\/api\/v1\/files\/.+\.pdf$/);

  const organizer = await makeUser({ email: 'staff@pau.edu.tr', role: 'ORGANIZER' });
  const searchList = await request(app).get('/api/v1/hackathon/applications?search=HYPERLINK')
    .set('Authorization', `Bearer ${organizer.token}`);
  assert.equal(searchList.status, 200);
  assert.equal(searchList.body.data.length, 1);

  assert.equal((await request(app).get('/api/v1/hackathon/applications/export?format=xlsx').set('Authorization', `Bearer ${organizer.token}`)).status, 400);
  const csvRes = await request(app).get('/api/v1/hackathon/applications/export')
    .set('Authorization', `Bearer ${organizer.token}`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.text, /'=HYPERLINK/);

  const jsonRes = await request(app).get('/api/v1/hackathon/applications/export?format=json')
    .set('Authorization', `Bearer ${organizer.token}`);
  assert.equal(jsonRes.status, 200);
  assert.equal(jsonRes.body.length, 1);
});

test('ENABLE_HACKATHON_MODULE=false disables all hackathon routes while keeping forms alive', async () => {
  const prevFlag = process.env.ENABLE_HACKATHON_MODULE;
  const appPath = require.resolve('../src/app');
  try {
    process.env.ENABLE_HACKATHON_MODULE = 'false';
    delete require.cache[appPath];
    const disabledApp = require('../src/app');

    for (const [method, endpoint] of [
      ['post', '/api/v1/hackathon/send-verification'],
      ['post', '/api/v1/hackathon/apply'],
      ['get', '/api/v1/hackathon/applications'],
      ['get', '/api/v1/hackathon/applications/export']
    ]) {
      const res = await request(disabledApp)[method](endpoint);
      assert.equal(res.status, 404, `${method} ${endpoint}`);
    }
    assert.equal((await request(disabledApp).get('/health')).status, 200);
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_HACKATHON_MODULE;
    else process.env.ENABLE_HACKATHON_MODULE = prevFlag;
    delete require.cache[appPath];
    require('../src/app');
  }
});

