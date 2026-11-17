const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-content-forms-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Content = require('../src/models/Content');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const EventPage = require('../src/models/EventPage');
const { generateToken } = require('../src/utils/jwt');
const Participant = require('../src/modules/participantAuth/models/Participant');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');

const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const validPdf = Buffer.from('%PDF-1.7\n%Test Document\n');

let repl, adminToken, organizerToken, memberToken;

const clearUploads = async () => {
  for (const folder of ['public', 'private']) {
    const dir = path.join(process.env.UPLOAD_DIR, folder);
    for (const file of await fs.readdir(dir)) {
      await fs.unlink(path.join(dir, file));
    }
  }
};

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Content.init(), Form.init(), FormResponse.init(), EventPage.init()]);
});

after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([User, Content, Form, FormResponse, EventPage].map(model => model.deleteMany({})));
  await clearUploads();
  const [admin, organizer, member] = await User.create([
    { fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'hash', role: 'ADMIN', isEmailVerified: true },
    { fullName: 'Organizer', email: 'org@pau.edu.tr', passwordHash: 'hash', role: 'ORGANIZER', isEmailVerified: true },
    { fullName: 'Member', email: 'member@pau.edu.tr', passwordHash: 'hash', role: 'MEMBER', isEmailVerified: true }
  ]);
  adminToken = generateToken({ id: admin._id, role: admin.role });
  organizerToken = generateToken({ id: organizer._id, role: organizer.role });
  memberToken = generateToken({ id: member._id, role: member.role });
});

test('Content CRUD, public image upload/filtering/featured sorting and signature cleanup work', async () => {
  assert.equal((await request(app).post('/api/v1/content').send({ title: 'No Auth', description: 'Desc here ok', type: 'EVENT' })).status, 401);
  assert.equal((await request(app).post('/api/v1/content').set('Authorization', `Bearer ${memberToken}`).send({ title: 'Member Try', description: 'Desc here ok', type: 'EVENT' })).status, 403);

  const badSig = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${organizerToken}`)
    .field('title', 'Sahte PNG').field('description', 'Açıklama yeterince uzun').field('type', 'EVENT')
    .attach('coverImage', Buffer.from('not-a-png'), 'fake.png');
  assert.equal(badSig.status, 400);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'public'))).length, 0);

  const badExt = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${organizerToken}`)
    .field('title', 'SVG Reddi').field('description', 'Açıklama yeterince uzun').field('type', 'EVENT')
    .attach('coverImage', Buffer.from('<svg></svg>'), 'xss.svg');
  assert.equal(badExt.status, 400);

  const createdEvent = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${organizerToken}`)
    .field('title', 'PAU [AI] Summit').field('description', 'Yapay zeka zirvesi açıklaması').field('type', 'EVENT')
    .field('isFeatured', 'true').field('eventDate', '2026-12-20T10:00:00Z')
    .attach('coverImage', validPng, 'cover.png');
  assert.equal(createdEvent.status, 201, JSON.stringify(createdEvent.body));
  const coverPath = new URL(createdEvent.body.data.coverImageUrl).pathname;
  assert.match(coverPath, /^\/uploads\/public\/.+\.png$/);
  assert.equal((await request(app).get(coverPath)).status, 200);

  const createdAnn = await request(app).post('/api/v1/content').set('Authorization', `Bearer ${adminToken}`).send({
    title: 'Erken Duyuru', description: 'Yeterince uzun duyuru metni', type: 'ANNOUNCEMENT',
    isFeatured: true, eventDate: '2026-12-01T10:00:00Z'
  });
  assert.equal(createdAnn.status, 201);

  const featured = await request(app).get('/api/v1/content/featured?limit=1');
  assert.equal(featured.status, 200);
  assert.equal(featured.body.data.length, 1);
  assert.equal(featured.body.data[0].title, 'Erken Duyuru');

  const literalSearchRes = await request(app).get('/api/v1/content/public?type=event&search=%5BAI%5D');
  assert.equal(literalSearchRes.status, 200);
  assert.equal(literalSearchRes.body.data.length, 1);
  assert.equal(literalSearchRes.body.data[0].title, 'PAU [AI] Summit');

  const updated = await request(app).put(`/api/v1/content/${createdEvent.body.data._id}`)
    .set('Authorization', `Bearer ${organizerToken}`).send({ title: 'PAU AI Summit v2' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'PAU AI Summit v2');

  assert.equal((await request(app).put('/api/v1/content/not-an-object-id').set('Authorization', `Bearer ${organizerToken}`).send({ title: 'Xyz' })).status, 400);
  assert.equal((await request(app).delete('/api/v1/content/64b000000000000000000001').set('Authorization', `Bearer ${organizerToken}`)).status, 404);
  assert.equal((await request(app).delete(`/api/v1/content/${createdAnn.body.data._id}`).set('Authorization', `Bearer ${adminToken}`)).status, 200);
});

test('Form CRUD enforces Turkish slug deduplication, date/numeric constraints and protected delete rules', async () => {
  const f1 = await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${organizerToken}`)
    .send({ title: 'Bahar Şenliği & Çağrı', status: 'PUBLISHED' });
  const f2 = await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${organizerToken}`)
    .send({ title: 'Bahar Şenliği & Çağrı' });
  assert.equal(f1.status, 201);
  assert.equal(f1.body.data.slug, 'bahar-senligi-cagri');
  assert.equal(f2.status, 201);
  assert.equal(f2.body.data.slug, 'bahar-senligi-cagri-1');

  const conflict = await request(app).put(`/api/v1/forms/${f2.body.data._id}`).set('Authorization', `Bearer ${organizerToken}`)
    .send({ slug: f1.body.data.slug });
  assert.equal(conflict.status, 409);

  assert.equal((await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${organizerToken}`)
    .send({ title: 'Bad Dates', startDate: '2026-12-10T00:00:00Z', endDate: '2026-12-01T00:00:00Z' })).status, 400);
  assert.equal((await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${organizerToken}`)
    .send({ title: 'Bad Bounds', fields: [{ fieldId: 'age', label: 'Yaş', type: 'number', validation: { min: 10, max: 5 } }] })).status, 400);
  assert.equal((await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${organizerToken}`)
    .send({ title: 'Dup Opt', fields: [{ fieldId: 'role', label: 'Rol', type: 'radio', options: ['A', 'A'] }] })).status, 400);

  const list = await request(app).get(`/api/v1/forms?status=published&search=${encodeURIComponent(f1.body.data.slug)}`)
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.equal((await request(app).get(`/api/v1/forms/${f1.body.data._id}`).set('Authorization', `Bearer ${organizerToken}`)).status, 200);
  assert.equal((await request(app).patch(`/api/v1/forms/${f1.body.data._id}/status`).set('Authorization', `Bearer ${organizerToken}`).send({ status: 'CLOSED' })).status, 200);
  assert.equal((await request(app).patch('/api/v1/forms/64b000000000000000000001/status').set('Authorization', `Bearer ${organizerToken}`).send({ status: 'CLOSED' })).status, 404);

  const lockedForm = await Form.create({ title: 'Event Linked', slug: 'hackathon-katilim', eventKey: 'hackathon', status: 'PUBLISHED', fields: [] });
  await EventPage.create({ _id: 'hackathon', form: lockedForm._id, formSlug: lockedForm.slug, event: { name: 'H' }, revision: 1 });
  assert.equal((await request(app).delete(`/api/v1/forms/${lockedForm._id}`).set('Authorization', `Bearer ${adminToken}`)).status, 409);
});

test('Public form availability windows, ObjectId lookup, malformed payload disk cleanup and private files RBAC work', async () => {
  const form = await Form.create({
    title: 'Açık Form', slug: 'acik-form', status: 'DRAFT', maxSubmissions: 1,
    fields: [
      { fieldId: 'track', label: 'Alan', type: 'radio', required: true, options: ['Web', 'AI'] },
      { fieldId: 'cv', label: 'CV', type: 'file', required: true }
    ],
    settings: { verificationRequired: false, allowMultipleSubmissions: true }
  });

  assert.equal((await request(app).get(`/api/v1/forms/public/${form.slug}`)).status, 403);
  form.status = 'PUBLISHED';
  form.startDate = new Date(Date.now() + 3600_000);
  await form.save();
  assert.equal((await request(app).get(`/api/v1/forms/public/${form.slug}`)).status, 403);

  form.startDate = new Date(Date.now() - 7200_000);
  form.endDate = new Date(Date.now() - 3600_000);
  await form.save();
  assert.equal((await request(app).get(`/api/v1/forms/public/${form.slug}`)).status, 403);

  form.endDate = new Date(Date.now() + 7200_000);
  await form.save();
  const byId = await request(app).get(`/api/v1/forms/public/${form._id}`);
  assert.equal(byId.status, 200);
  const version = byId.body.data.schemaVersion;
  const participant = await Participant.create({ email: 'lifecycle@example.com', emailVerifiedAt: new Date() });
  const participantAuth = `Bearer ${issueToken(participant, 'EMAIL_OTP').token}`;

  assert.equal((await request(app).get('/api/v1/forms/public/olmayan-slug')).status, 404);
  assert.equal((await request(app).post(`/api/v1/forms/public/${form.slug}/submit`).send(['array-body'])).status, 400);

  const badJsonUpload = await request(app).post(`/api/v1/forms/public/${form.slug}/submit`).set('Authorization', participantAuth)
    .field('answers', '{broken-json').attach('cv', validPdf, 'cv.pdf');
  assert.equal(badJsonUpload.status, 400);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length, 0);

  const staleVersionUpload = await request(app).post(`/api/v1/forms/public/${form.slug}/submit`).set('Authorization', participantAuth)
    .field('_formVersion', '2020-01-01T00:00:00.000Z').field('track', 'Web').attach('cv', validPdf, 'cv.pdf');
  assert.equal(staleVersionUpload.status, 409);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length, 0);

  const badRadio = await request(app).post(`/api/v1/forms/public/${form.slug}/submit`).set('Authorization', participantAuth)
    .field('track', 'Mobile').attach('cv', validPdf, 'cv.pdf');
  assert.equal(badRadio.status, 400);
  assert.equal((await fs.readdir(path.join(process.env.UPLOAD_DIR, 'private'))).length, 0);

  const ok = await request(app).post(`/api/v1/forms/public/${form.slug}/submit`).set('Authorization', participantAuth)
    .field('_formVersion', version).field('track', 'AI').attach('cv', validPdf, 'cv.pdf');
  assert.equal(ok.status, 201, JSON.stringify(ok.body));

  assert.equal((await request(app).get(`/api/v1/forms/public/${form.slug}`)).status, 403);

  const saved = await FormResponse.findById(ok.body.responseId);
  const fileUrl = saved.uploadedFiles[0].url;
  assert.equal((await request(app).get(fileUrl).set('Authorization', `Bearer ${memberToken}`)).status, 403);

  const dl = await request(app).get(fileUrl).set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers['cache-control'], 'private, no-store');

  assert.equal((await request(app).get('/api/v1/files/.hidden.pdf').set('Authorization', `Bearer ${organizerToken}`)).status, 400);
  assert.equal((await request(app).get('/api/v1/files/missing-file.pdf').set('Authorization', `Bearer ${organizerToken}`)).status, 404);

  assert.equal((await request(app).get(`/api/v1/forms/${form._id}/responses/export?format=xml`).set('Authorization', `Bearer ${organizerToken}`)).status, 400);
  const jsonExport = await request(app).get(`/api/v1/forms/${form._id}/responses/export?format=json`).set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(jsonExport.status, 200);
  assert.equal(jsonExport.body.length, 1);
  assert.equal(jsonExport.body[0].answers[0].value, 'AI');
});

