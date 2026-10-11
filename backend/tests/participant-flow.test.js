const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
process.env.NODE_ENV = 'test';
delete process.env.BREVO_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;
process.env.JWT_EXPIRES_IN = '2h';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_EXPIRES_IN = '1h';
process.env.PARTICIPANT_OTP_MAX_ATTEMPTS = '2';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const Participant = require('../src/modules/participantAuth/models/Participant');
const Otp = require('../src/modules/participantAuth/models/ParticipantOtp');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const googleService = require('../src/modules/participantAuth/services/googleService');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');
const emailService = require('../src/services/emailService');
const base = '/api/v1/participant-auth';
let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), Participant.init(), Otp.init(), User.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  await Promise.all([Form, FormResponse, Participant, Otp, User].map(model => model.deleteMany({})));
});
const makeForm = (settings = {}, extra = {}) => Form.create({ title: 'Test etkinliği', slug: 'test', status: 'PUBLISHED',
  fields: [{ fieldId: 'count', label: 'Sayı', type: 'number', required: true }], settings, ...extra });
const makeParticipant = async (email = 'person@example.com', method = 'EMAIL_OTP') => {
  const participant = await Participant.create({ email, emailVerifiedAt: new Date() });
  return { ...issueToken(participant, method), participant };
};
const submit = (token, body = { count: 2 }) => {
  const call = request(app).post('/api/v1/forms/public/test/submit');
  if (token) call.set('Authorization', `Bearer ${token}`);
  return call.send(body);
};
const seedOtp = async (email, code, extra = {}) => Otp.create({ email,
  codeHash: createHmac('sha256', process.env.PARTICIPANT_JWT_SECRET).update(`${email}:${code}`).digest('hex'),
  expiresAt: new Date(Date.now() + 60000), resendAfter: new Date(Date.now() + 60000), ...extra });

test('email OTP issues a participant token; replay fails and hash is never returned', async () => {
  await seedOtp('person@example.com', '123456');
  const result = await request(app).post(`${base}/email/verify`).send({ email: ' Person@Example.com ', code: '123456' });
  assert.equal(result.status, 200);
  assert.equal(result.body.participant.email, 'person@example.com');
  const payload = jwt.decode(result.body.token);
  assert.equal(payload.exp - payload.iat, 3600);
  assert.equal(payload.type, 'participant');
  assert.equal(await Otp.countDocuments(), 0);
  const replay = await request(app).post(`${base}/email/verify`).send({ email: 'person@example.com', code: '123456' });
  assert.equal(replay.status, 400);
});
test('concurrent correct OTP requests consume a code once', async () => {
  await seedOtp('person@example.com', '123456');
  const results = await Promise.all(Array.from({ length: 3 }, () => request(app).post(`${base}/email/verify`).send({ email: 'person@example.com', code: '123456' })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
});
test('OTP expiry, attempt limit and cooldown are enforced', async () => {
  await seedOtp('person@example.com', '123456');
  const call = code => request(app).post(`${base}/email/verify`).send({ email: 'person@example.com', code });
  assert.equal((await call('000000')).status, 400);
  assert.equal((await call('000000')).status, 400);
  assert.equal((await call('123456')).status, 400);
  assert.equal((await request(app).post(`${base}/email/send-otp`).send({ email: 'person@example.com' })).status, 429);
  await Otp.updateOne({}, { attempts: 0, expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await call('123456')).status, 400);
});
test('sending stores a hash and reports configurable timings', async () => {
  process.env.PARTICIPANT_OTP_TTL_MINUTES = '3';
  const result = await request(app).post(`${base}/email/send-otp`).send({ email: 'person@example.com' });
  assert.equal(result.status, 200);
  assert.equal(result.body.expiresInSeconds, 180);
  const stored = await Otp.findOne();
  assert.match(stored.codeHash, /^[a-f\d]{64}$/);
  assert.equal(result.body.code, undefined);
  delete process.env.PARTICIPANT_OTP_TTL_MINUTES;
});
test('invalid email/code is rejected and production cannot simulate delivery', async () => {
  assert.equal((await request(app).post(`${base}/email/send-otp`).send({ email: {} })).status, 400);
  assert.equal((await request(app).post(`${base}/email/verify`).send({ email: 'a@example.com', code: 123456 })).status, 400);
  process.env.NODE_ENV = 'production';
  try { assert.equal((await request(app).post(`${base}/email/send-otp`).send({ email: 'a@example.com' })).status, 503); }
  finally { process.env.NODE_ENV = 'test'; }
});
test('missing, forged and expired tokens fail before upload; valid identity is stored', async () => {
  await makeForm();
  assert.equal((await submit()).status, 401);
  assert.equal((await submit('forged')).status, 401);
  const { participant, token } = await makeParticipant();
  const expired = jwt.sign({ type: 'participant', method: 'EMAIL_OTP', verifiedAt: new Date().toISOString() }, process.env.PARTICIPANT_JWT_SECRET,
    { subject: String(participant._id), audience: 'form-participant', issuer: 'gdg-pau', expiresIn: -1 });
  assert.equal((await submit(expired)).status, 401);
  const unauthorizedFile = await request(app).post('/api/v1/forms/public/test/submit').attach('cv', Buffer.from('test'), 'test.pdf');
  assert.equal(unauthorizedFile.status, 401);
  const accepted = await submit(token, { count: 2, verifiedEmail: 'attacker@example.com' });
  assert.equal(accepted.status, 201);
  const response = await FormResponse.findById(accepted.body.responseId);
  assert.equal(response.verifiedEmail, participant.email);
  assert.equal(String(response.participant), String(participant._id));
  assert.equal(response.verificationMethod, 'EMAIL_OTP');
  assert.equal((await Form.findOne()).submissionCount, 1);
});
test('participant and team tokens cannot cross authentication boundaries', async () => {
  await makeForm();
  const { token } = await makeParticipant();
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
  const team = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'test', role: 'ADMIN', isEmailVerified: true });
  const teamToken = generateToken({ id: team._id, role: team.role });
  const teamPayload = jwt.decode(teamToken);
  assert.equal(teamPayload.exp - teamPayload.iat, 7200);
  assert.equal((await submit(teamToken)).status, 401);
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${teamToken}`)).status, 200);
});
test('verification method restrictions and legacy requireAuth are enforced', async () => {
  await makeForm({ verificationMethods: ['GOOGLE'] });
  const { token } = await makeParticipant();
  assert.equal((await submit(token)).status, 403);
  await Form.updateOne({}, { 'settings.verificationRequired': false, 'settings.requireAuth': true });
  assert.equal((await submit()).status, 401);
});
test('explicit anonymous forms remain available; single entry still requires identity', async () => {
  await makeForm({ verificationRequired: false, allowMultipleSubmissions: true });
  assert.equal((await submit()).status, 201);
  assert.equal((await FormResponse.findOne()).verifiedEmail, null);
  await Form.updateOne({}, { 'settings.allowMultipleSubmissions': false });
  assert.equal((await submit()).status, 401);
});
test('concurrent repeat submissions produce one response and one counter increment', async () => {
  await makeForm({ allowMultipleSubmissions: false });
  const { token } = await makeParticipant();
  const results = await Promise.all(Array.from({ length: 4 }, () => submit(token)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 3);
  assert.equal(await FormResponse.countDocuments(), 1);
  assert.equal((await Form.findOne()).submissionCount, 1);
});
test('concurrent capacity is enforced without counter/response drift', async () => {
  await makeForm({}, { maxSubmissions: 1 });
  const { token } = await makeParticipant();
  const results = await Promise.all(Array.from({ length: 4 }, () => submit(token)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 403).length, 3);
  assert.equal(await FormResponse.countDocuments(), 1);
  assert.equal((await Form.findOne()).submissionCount, 1);
});
test('closed form and invalid answers cannot create responses or change count', async () => {
  await makeForm();
  const { token } = await makeParticipant();
  assert.equal((await submit(token, {})).status, 400);
  await Form.updateOne({}, { status: 'CLOSED' });
  assert.equal((await submit(token)).status, 403);
  assert.equal(await FormResponse.countDocuments(), 0);
  assert.equal((await Form.findOne()).submissionCount, 0);
});
test('Google disabled/invalid credentials fail; verified adapter issues GOOGLE token', async () => {
  assert.equal((await request(app).post(`${base}/google`).send({ idToken: 'invalid' })).status, 503);
  assert.equal((await request(app).post(`${base}/google`).send({})).status, 400);
  const original = googleService.verifyGoogle;
  googleService.verifyGoogle = async () => ({ email: 'person@gmail.com', googleSubject: 'google-subject', fullName: 'Google Person' });
  try {
    const result = await request(app).post(`${base}/google`).send({ idToken: 'test-adapter-only' });
    assert.equal(result.status, 200);
    assert.equal(result.body.verificationMethod, 'GOOGLE');
    await makeForm({ verificationMethods: ['GOOGLE'] });
    assert.equal((await submit(result.body.token)).status, 201);
  } finally { googleService.verifyGoogle = original; }
});
test('participant duration is configurable and invalid settings fail', async () => {
  process.env.PARTICIPANT_JWT_EXPIRES_IN = '15m';
  try {
    const { token } = await makeParticipant();
    const payload = jwt.decode(token);
    assert.equal(payload.exp - payload.iat, 900);
    process.env.PARTICIPANT_JWT_EXPIRES_IN = 'invalid';
    assert.throws(() => issueToken({ _id: 'abc' }, 'EMAIL_OTP'));
  } finally { process.env.PARTICIPANT_JWT_EXPIRES_IN = '1h'; }
});

test('mail delivery failure removes its code and does not report success', async () => {
  const original = emailService.sendEmail;
  emailService.sendEmail = async () => { throw new Error('test provider failure'); };
  try {
    const result = await request(app).post(`${base}/email/send-otp`).send({ email: 'person@example.com' });
    assert.equal(result.status, 502);
    assert.equal(await Otp.countDocuments(), 0);
  } finally { emailService.sendEmail = original; }
});
test('public schema advertises verification defaults even for legacy records', async () => {
  await Form.collection.insertOne({ title: 'Legacy', slug: 'test', status: 'PUBLISHED', fields: [],
    settings: { allowMultipleSubmissions: true }, createdAt: new Date(), updatedAt: new Date() });
  const result = await request(app).get('/api/v1/forms/public/test');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.settings.verificationRequired, true);
  assert.deepEqual(result.body.data.settings.verificationMethods, ['GOOGLE', 'EMAIL_OTP']);
  assert.equal((await submit()).status, 401);
});
test('invalid verification settings rejected; partial form updates retain restrictions', async () => {
  const team = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'test', role: 'ADMIN', isEmailVerified: true });
  const token = generateToken({ id: team._id, role: team.role });
  const invalid = await request(app).post('/api/v1/forms').set('Authorization', `Bearer ${token}`).send({ title: 'Invalid', settings: { verificationMethods: ['UNKNOWN'] } });
  assert.equal(invalid.status, 400);
  const form = await makeForm({ verificationMethods: ['GOOGLE'], allowMultipleSubmissions: false });
  const updated = await request(app).put(`/api/v1/forms/${form._id}`).set('Authorization', `Bearer ${token}`).send({ settings: { successMessage: 'Teşekkürler' } });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.data.settings.verificationMethods, ['GOOGLE']);
  assert.equal(updated.body.data.settings.allowMultipleSubmissions, false);
});
