const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.CLIENT_URLS = 'http://localhost:5173,http://localhost:5174';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-files-test-'));
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Form = require('../src/models/Form');
const Response = require('../src/models/FormResponse');
const Content = require('../src/models/Content');
const { generateToken } = require('../src/utils/jwt');
let repl, token;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), Response.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true }); });
beforeEach(async () => {
  await Promise.all([User, Form, Response].map(model => model.deleteMany({})));
  const user = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'test', role: 'ADMIN', isEmailVerified: true });
  token = generateToken({ id: user._id, role: user.role });
  for (const name of await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))) await fs.unlink(path.join(process.env.UPLOAD_DIR, 'private', name));
});
const makeForm = fields => Form.create({ title: 'Test', slug: 'test', status: 'PUBLISHED', fields,
  settings: { verificationRequired: false, allowMultipleSubmissions: true } });
const submit = () => request(app).post('/api/v1/forms/public/test/submit');
test('CORS permits both frontends, supports preflight and rejects other origins', async () => {
  for (const origin of ['http://localhost:5173', 'http://localhost:5174']) {
    const result = await request(app).options('/api/v1/forms/public/test/submit').set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Authorization,Content-Type');
    assert.equal(result.status, 204);
    assert.equal(result.headers['access-control-allow-origin'], origin);
  }
  assert.equal((await request(app).get('/health').set('Origin', 'https://attacker.example')).status, 403);
  assert.equal((await request(app).get('/ready')).status, 200);
});
test('legacy published cover images stay public without exposing unrelated uploads', async () => {
  await fs.writeFile(path.join(process.env.UPLOAD_DIR, 'legacy-cover.png'), Buffer.from('legacy image'));
  await fs.writeFile(path.join(process.env.UPLOAD_DIR, 'private-resume.pdf'), Buffer.from('private document'));
  await Content.create({ title: 'Legacy content', description: 'Published image', type: 'EVENT', coverImageUrl: 'http://localhost:5000/uploads/legacy-cover.png' });
  assert.equal((await request(app).get('/uploads/legacy-cover.png')).status, 200);
  assert.equal((await request(app).get('/uploads/private-resume.pdf')).status, 401);
});
test('private file submission downloads only with staff auth and invalid files are removed', async () => {
  await makeForm([{ fieldId: 'cv', label: 'CV', type: 'file', required: true }]);
  const uploaded = await submit().attach('cv', Buffer.from('%PDF-1.7\nTest PDF'), 'resume.pdf');
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  const saved = await Response.findById(uploaded.body.responseId);
  const url = saved.uploadedFiles[0].url;
  assert.equal((await request(app).get(url)).status, 401);
  assert.equal((await request(app).get(url).set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal((await request(app).get(`/uploads/${saved.uploadedFiles[0].filename}`)).status, 401);
  const count = (await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length;
  assert.equal((await submit().attach('cv', Buffer.from('executable'), 'fake.pdf')).status, 400);
  assert.equal((await submit().attach('cv', Buffer.from('%PDF-1.7'), 'bad.pdf.exe')).status, 400);
  assert.equal((await submit().attach('unknown', Buffer.from('%PDF-1.7'), 'cv.pdf')).status, 400);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length, count);
});
test('invalid answer types, options, phone, date and number boundaries do not write data', async () => {
  await makeForm([
    { fieldId: 'choice', label: 'Choice', type: 'select', options: ['yes'], required: true },
    { fieldId: 'many', label: 'Many', type: 'checkbox', options: ['a'], required: true },
    { fieldId: 'phone', label: 'Phone', type: 'phone' }, { fieldId: 'date', label: 'Date', type: 'date' },
    { fieldId: 'email', label: 'Email', type: 'email' },
    { fieldId: 'number', label: 'Number', type: 'number', validation: { min: 1, max: 5 } }
  ]);
  const good = { choice: 'yes', many: ['a'], phone: '+905551112233', date: '2026-10-21', email: 'test@example.com', number: 3 };
  for (const patch of [{ choice: 'no' }, { many: 'a' }, { many: ['b'] }, { phone: 'hello' }, { date: '2026-02-30' }, { email: {} }, { number: [] }, { number: 'Infinity' }]) {
    assert.equal((await submit().send({ ...good, ...patch })).status, 400, JSON.stringify(patch));
  }
  assert.equal(await Response.countDocuments(), 0);
  assert.equal((await Form.findOne()).submissionCount, 0);
  assert.equal((await submit().send(good)).status, 201);
});
test('form schema rejects duplicate ids, invalid regex and invalid status transitions', async () => {
  await assert.rejects(makeForm([{ fieldId: 'same', label: 'A' }, { fieldId: 'same', label: 'B' }]));
  await assert.rejects(makeForm([{ fieldId: 'field', label: 'A', validation: { regex: '(a+)+$' } }]));
  const form = await makeForm([]);
  assert.equal((await request(app).patch(`/api/v1/forms/${form.id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'WRONG' })).status, 400);
  assert.equal((await Form.findById(form.id)).status, 'PUBLISHED');
});
test('export preserves deleted question labels and neutralizes formulas; searches are literal', async () => {
  const form = await makeForm([{ fieldId: 'old', label: 'Original question', type: 'text' }]);
  assert.equal((await submit().send({ old: '=1+2' })).status, 201);
  form.fields = [{ fieldId: 'new', label: 'New question', type: 'text' }]; await form.save();
  const csv = await request(app).get(`/api/v1/forms/${form.id}/responses/export`).set('Authorization', `Bearer ${token}`);
  assert.match(csv.text, /Original question/);
  assert.match(csv.text, /'=1\+2/);
  const json = await request(app).get(`/api/v1/forms/${form.id}/responses/export?format=json`).set('Authorization', `Bearer ${token}`);
  assert.equal(json.body.length, 1);
  assert.equal(json.body[0].answers[0].label, 'Original question');
  assert.equal((await request(app).get('/api/v1/forms?search=%5B').set('Authorization', `Bearer ${token}`)).status, 200);
});
test('deleting a form rolls back on failure and then removes its responses', async () => {
  const form = await makeForm([]); await submit().send({});
  const original = Response.deleteMany;
  Response.deleteMany = () => { throw new Error('injected failure'); };
  try { assert.equal((await request(app).delete(`/api/v1/forms/${form.id}`).set('Authorization', `Bearer ${token}`)).status, 500); }
  finally { Response.deleteMany = original; }
  assert.ok(await Form.findById(form.id)); assert.equal(await Response.countDocuments(), 1);
  assert.equal((await request(app).delete(`/api/v1/forms/${form.id}`).set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal(await Response.countDocuments(), 0);
});
