// Opening and closing registration is ADMIN-only on every path that can do it.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Form = require('../src/models/Form');
const EventPage = require('../src/models/EventPage');
const { ensureHackathonPage } = require('../src/services/eventPageService');
const { generateToken } = require('../src/utils/jwt');

let repl;
let admin;
let organizer;
let form;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), EventPage.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  await Promise.all([User, Form, EventPage].map(model => model.deleteMany({})));
  const token = async role => {
    const user = await User.create({ fullName: role, email: `${role.toLowerCase()}@pau.edu.tr`, passwordHash: 'x', role, isEmailVerified: true });
    return generateToken({ id: user._id, role });
  };
  [admin, organizer] = [await token('ADMIN'), await token('ORGANIZER')];
  await ensureHackathonPage();
  form = await Form.findOne({ slug: 'hackathon-katilim' });
});

const call = (method, url, body, token = organizer) => request(app)[method](`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body);
const stored = () => Form.findById(form._id).lean();

const WAYS_TO_CLOSE = {
  status: { status: 'CLOSED' },
  'empty status': { status: '' },
  'registration setting': { settings: { registrationEnabled: false } },
  'team change setting': { settings: { teamChangesEnabled: false } },
  'answer editing setting': { settings: { answerEditingEnabled: false } },
  'closed reason': { settings: { registrationClosedReason: 'iptal oldu' } },
  'verification methods': { settings: { verificationMethods: ['GOOGLE'] } },
  'past end date': { endDate: '2020-01-01T00:00:00Z' },
  'future start date': { startDate: '2099-01-01T00:00:00Z' },
  quota: { maxSubmissions: 1 },
  slug: { slug: 'baska-adres' },
};
for (const [name, body] of Object.entries(WAYS_TO_CLOSE)) {
  test(`ORGANIZER cannot change registration through PUT /forms/:id (${name})`, async () => {
    const before = await stored();
    const res = await call('put', `/forms/${form._id}`, { title: 'Yan değişiklik', ...body });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.deepEqual(await stored(), before);
  });
}

test('ORGANIZER cannot close registration through the status endpoint', async () => {
  assert.equal((await call('patch', `/forms/${form._id}/status`, { status: 'CLOSED' })).status, 403);
  assert.equal((await stored()).status, 'PUBLISHED');
});

test('ORGANIZER cannot delete the event form, also an old one without eventKey', async () => {
  await Form.updateOne({ _id: form._id }, { $set: { eventKey: null } });
  assert.equal((await call('delete', `/forms/${form._id}`)).status, 403);
  assert.ok(await stored());
});

test('ORGANIZER cannot close registration by publishing the event page', async () => {
  const page = await EventPage.findById('hackathon').lean();
  const event = structuredClone(page.event);
  event.register.status = event.register.status === 'open' ? 'closed' : 'open';
  assert.equal((await call('put', '/event-page/hackathon', { event, revision: page.revision })).status, 403);
  assert.equal((await EventPage.findById('hackathon')).revision, page.revision);
  assert.equal((await stored()).status, 'PUBLISHED');
});

test('an ORGANIZER publish does not reopen what an ADMIN closed', async () => {
  assert.equal((await call('patch', `/forms/${form._id}/status`, { status: 'CLOSED' }, admin)).status, 200);
  const page = await EventPage.findById('hackathon').lean();
  const event = { ...page.event, name: 'Yeni ad' };
  assert.equal((await call('put', '/event-page/hackathon', { event, revision: page.revision })).status, 200);
  assert.equal((await stored()).status, 'CLOSED');
});

test('ORGANIZER can still edit content of the event form', async () => {
  const current = await stored();
  const body = { title: 'Yeni başlık', description: 'Açıklama', status: current.status, slug: current.slug, maxSubmissions: current.maxSubmissions,
    startDate: current.startDate, endDate: current.endDate, settings: { ...current.settings, successMessage: 'Teşekkürler' } };
  const res = await call('put', `/forms/${form._id}`, body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await stored()).settings.successMessage, 'Teşekkürler');
});

test('ORGANIZER keeps full control of forms that are not the event form', async () => {
  const other = await Form.create({ title: 'Anket', slug: 'anket', status: 'PUBLISHED', fields: [] });
  assert.equal((await call('put', `/forms/${other._id}`, { maxSubmissions: 5 })).status, 200);
  assert.equal((await call('patch', `/forms/${other._id}/status`, { status: 'CLOSED' })).status, 200);
});

test('ADMIN can still use every path', async () => {
  assert.equal((await call('put', `/forms/${form._id}`, { maxSubmissions: 80 }, admin)).status, 200);
  assert.equal((await call('patch', `/forms/${form._id}/status`, { status: 'CLOSED' }, admin)).status, 200);
  const page = await EventPage.findById('hackathon').lean();
  const event = structuredClone(page.event);
  event.register.status = 'open';
  assert.equal((await call('put', '/event-page/hackathon', { event, revision: page.revision }, admin)).status, 200);
  assert.equal((await stored()).status, 'PUBLISHED');
});
