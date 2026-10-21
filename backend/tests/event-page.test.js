const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const Form = require('../src/models/Form');
const Response = require('../src/models/FormResponse');
const User = require('../src/models/User');
const Participant = require('../src/modules/participantAuth/models/Participant');
const Otp = require('../src/modules/participantAuth/models/ParticipantOtp');
const Page = require('../src/models/EventPage');
const { ensureHackathonPage } = require('../src/services/eventPageService');
const { generateToken } = require('../src/utils/jwt');
const email = require('../src/services/emailService');
const originalMail = email.sendEmail;
let code, repl, staffToken;
email.sendEmail = async message => { code = message.textContent.match(/\d{6}/)[0]; };
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form, Response, User, Participant, Otp, Page].map(model => model.init()));
});
after(async () => { email.sendEmail = originalMail; await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  await Promise.all([Form, Response, User, Participant, Otp, Page].map(model => model.deleteMany({})));
  const staff = await User.create({ fullName: 'Staff', email: 'staff@pau.edu.tr', passwordHash: 'test', role: 'ADMIN', isEmailVerified: true });
  staffToken = generateToken({ id: staff._id, role: staff.role });
  await ensureHackathonPage();
});
test('published registration schema accepts verified submissions visible in staff list and export', async () => {
  const page = (await request(app).get('/api/v1/event-page/hackathon')).body.data;
  assert.ok(page.formId);
  const send = await request(app).post('/api/v1/participant-auth/email/send-otp').send({ email: 'participant@example.com' });
  assert.equal(send.status, 200);
  const verified = await request(app).post('/api/v1/participant-auth/email/verify').send({ email: 'participant@example.com', code });
  assert.equal(verified.status, 200);
  const values = {};
  for (const field of page.event.register.steps.flatMap(step => step.fields)) {
    values[field.id] = field.kind === 'email' ? 'participant@example.com' : field.kind === 'tel' ? '+905551112233' : field.kind === 'select' ? field.options[0].value : field.kind === 'checkbox' ? [field.options[0].value] : 'Participant Test';
  }
  const submitted = await request(app).post(`/api/v1/forms/public/${page.formSlug}/submit`)
    .set('Authorization', `Bearer ${verified.body.token}`).send(values);
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const list = await request(app).get(`/api/v1/forms/${page.formId}/responses?search=Participant%20Test`).set('Authorization', `Bearer ${staffToken}`);
  assert.equal(list.status, 200); assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0]._id, submitted.body.responseId);
  const csv = await request(app).get(`/api/v1/forms/${page.formId}/responses/export`).set('Authorization', `Bearer ${staffToken}`);
  assert.match(csv.text, /participant@example.com/);
  const repeated = await request(app).post(`/api/v1/forms/public/${page.formSlug}/submit`).set('Authorization', `Bearer ${verified.body.token}`).send(values);
  assert.equal(repeated.status, 409);
  await ensureHackathonPage();
  assert.equal((await Form.findById(page.formId)).submissionCount, 1);
});
test('only staff can publish; event and form update together with revision conflict protection', async () => {
  const page = (await request(app).get('/api/v1/event-page/hackathon')).body.data;
  const event = structuredClone(page.event); event.name = 'Published name'; event.register.status = 'closed';
  event.register.steps[0].fields[0].label = 'Updated question';
  assert.equal((await request(app).put('/api/v1/event-page/hackathon').send({ event, revision: 1 })).status, 401);
  const published = await request(app).put('/api/v1/event-page/hackathon').set('Authorization', `Bearer ${staffToken}`).send({ event, revision: 1 });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal((await Form.findById(page.formId)).status, 'CLOSED');
  assert.equal((await Form.findById(page.formId)).fields[0].label, 'Updated question');
  assert.equal((await request(app).get('/api/v1/event-page/hackathon')).body.data.event.name, 'Published name');
  assert.equal((await request(app).put('/api/v1/event-page/hackathon').set('Authorization', `Bearer ${staffToken}`).send({ event, revision: 1 })).status, 409);
  event.socials[0].url = 'javascript:alert(1)';
  assert.equal((await request(app).put('/api/v1/event-page/hackathon').set('Authorization', `Bearer ${staffToken}`).send({ event, revision: 2 })).status, 400);
  assert.equal((await Page.findById('hackathon')).revision, 2);
});
