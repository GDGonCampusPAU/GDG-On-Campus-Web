const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-roadmap-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Form = require('../../src/models/Form');
const FormResponse = require('../../src/models/FormResponse');
const Content = require('../../src/models/Content');
const VerificationToken = require('../../src/models/VerificationToken');
const HackathonApp = require('../../src/modules/hackathon/models/HackathonApp');
const emailService = require('../../src/services/emailService');
const { generateToken } = require('../../src/utils/jwt');

const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let repl, adminToken;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User, Form, FormResponse, Content, VerificationToken, HackathonApp].map(m => m.init()));
});

after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([User, Form, FormResponse, Content, VerificationToken, HackathonApp].map(m => m.deleteMany({})));
  const publicDir = path.join(process.env.UPLOAD_DIR, 'public');
  for (const name of await fs.readdir(publicDir)) await fs.unlink(path.join(publicDir, name));
  const admin = await User.create({
    fullName: 'Roadmap Admin',
    email: 'admin@pau.edu.tr',
    passwordHash: 'hash',
    role: 'ADMIN',
    isEmailVerified: true
  });
  adminToken = generateToken({ id: admin._id, role: admin.role });
});

test('[P0.1] FormResponse defines partial unique index on (form, singleSubmissionKey) and blocks raw duplicate insert', async () => {
  await FormResponse.init();
  const indexes = await FormResponse.collection.indexes();
  const partialUnique = indexes.find(
    idx => idx.key?.form === 1 && idx.key?.singleSubmissionKey === 1 && idx.unique === true && idx.partialFilterExpression
  );
  assert.ok(partialUnique, 'Missing partial unique index on { form: 1, singleSubmissionKey: 1 }');

  const form = await Form.create({ title: 'Single Submit', slug: 'single-submit', status: 'PUBLISHED', fields: [] });
  await FormResponse.create({ form: form._id, formSlug: form.slug, singleSubmissionKey: 'key-1', answers: [] });
  await assert.rejects(
    FormResponse.collection.insertOne({ form: form._id, formSlug: form.slug, singleSubmissionKey: 'key-1', answers: [] }),
    err => err.code === 11000
  );
});

test('[P0.2] emailService escapes HTML/phishing payloads inside OTP greeting and teamName', async () => {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.BREVO_API_KEY;
  const captured = [];
  process.env.BREVO_API_KEY = 'roadmap-test-brevo-key';
  globalThis.fetch = async (_url, init) => {
    captured.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ messageId: 'msg-1' }) };
  };

  try {
    await emailService.sendRegistrationOtpEmail({
      email: 'target@pau.edu.tr',
      fullName: '<a href="https://phish.example">Buraya Tıkla</a>',
      code: '123456'
    });
    await emailService.sendHackathonOtpEmail({
      email: 'target@example.com',
      leaderName: '<img src=x onerror=alert(1)>',
      teamName: '<script>alert("xss")</script>',
      code: '654321'
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = prevKey;
  }

  assert.equal(captured.length, 2);
  assert.doesNotMatch(captured[0].htmlContent, /<a\s+href="https:\/\/phish\.example"/i);
  assert.doesNotMatch(captured[1].htmlContent, /<script>|<img\s+src=x/i);
});

test('[P1.2] Content update and delete remove replaced local public images and reject javascript: URLs / non-string fields', async () => {
  const badUrl = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'XSS URL', description: 'Uzun açıklama metni', type: 'EVENT', coverImageUrl: 'javascript:alert(1)' });
  assert.equal(badUrl.status, 400);

  const nonString = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Tip Hatası', description: 'Uzun açıklama metni', type: 'EVENT', bevyLink: { url: 'bad' } });
  assert.equal(nonString.status, 400);

  const publicDir = path.join(process.env.UPLOAD_DIR, 'public');
  const created = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${adminToken}`)
    .field('title', 'Birinci Görsel').field('description', 'Açıklama yeterince uzun').field('type', 'EVENT')
    .attach('coverImage', validPng, 'first.png');
  assert.equal(created.status, 201);
  assert.equal((await fs.readdir(publicDir)).length, 1);

  const updated = await request(app).put(`/api/v1/content/${created.body.data._id}`).set('Authorization', `Bearer ${adminToken}`)
    .attach('coverImage', validPng, 'second.png');
  assert.equal(updated.status, 200);
  assert.equal((await fs.readdir(publicDir)).length, 1);

  const deleted = await request(app).delete(`/api/v1/content/${created.body.data._id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleted.status, 200);
  assert.equal((await fs.readdir(publicDir)).length, 0);
});

test('[P1.4] Legacy hackathon CSV export honors the ?search= filter', async () => {
  await HackathonApp.create([
    { teamName: 'Alpha Rockets', leaderName: 'Ali', leaderEmail: 'ali@example.com', leaderPhone: '+905551112233', memberCount: 3, projectIdea: 'Yapay zeka projesi açıklaması' },
    { teamName: 'Beta Ninjas', leaderName: 'Veli', leaderEmail: 'veli@example.com', leaderPhone: '+905554445566', memberCount: 2, projectIdea: 'Mobil uygulama projesi fikri' }
  ]);
  const res = await request(app).get('/api/v1/hackathon/applications/export?search=Alpha')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Alpha Rockets/);
  assert.doesNotMatch(res.text, /Beta Ninjas/);
});

test('[P1.5] GET /users returns full pagination envelope and /verify-email does not burn OTP for missing user', async () => {
  const usersRes = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(usersRes.status, 200);
  assert.equal(typeof usersRes.body.pagination.totalItems, 'number');
  assert.equal(typeof usersRes.body.pagination.limit, 'number');
  assert.equal(typeof usersRes.body.pagination.hasNextPage, 'boolean');
  assert.equal(typeof usersRes.body.pagination.hasPrevPage, 'boolean');

  const code = await VerificationToken.generateOtp('ghost@gmail.com', 'REGISTER', 10);
  const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email: 'ghost@gmail.com', code });
  assert.equal(verifyRes.status, 400);
  assert.equal(await VerificationToken.countDocuments({ email: 'ghost@gmail.com', purpose: 'REGISTER' }), 1);
});

