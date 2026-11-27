// Admin-controlled participant permissions: team changes and answer editing on "Başvurum".
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const emailService = require('../src/services/emailService');
const sent = [];
emailService.sendEmail = async (message) => { sent.push(message); };
const app = require('../src/app');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const HackathonTeam = require('../src/models/HackathonTeam');
const Participant = require('../src/modules/participantAuth/models/Participant');
const ParticipantOtp = require('../src/modules/participantAuth/models/ParticipantOtp');
const User = require('../src/models/User');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { generateToken } = require('../src/utils/jwt');

const OPEN = { teamChanges: true, answerEditing: true, projectUpload: true, projectUploadClosedAt: null, projectEvaluation: false, registration: true, closedReason: '', closedEnding: '' };
const perms = (over = {}) => ({ ...OPEN, ...over });

let repl, form, admin, organizer;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), HackathonTeam.init(), Participant.init(), ParticipantOtp.init(), User.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  sent.length = 0;
  await Promise.all([Form, FormResponse, HackathonTeam, Participant, ParticipantOtp, User].map(model => model.deleteMany({})));
  form = await Form.create({ title: 'Hackathon', slug: 'hack', status: 'PUBLISHED',
    fields: [
      { fieldId: 'fullName', label: 'Ad soyad', type: 'text', required: true },
      { fieldId: 'email', label: 'E-posta', type: 'email', required: true },
      { fieldId: 'team', label: 'Katılım', type: 'team', required: true }
    ],
    settings: { verificationRequired: true, verificationMethods: ['EMAIL_OTP'], allowMultipleSubmissions: false } });
  const a = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'x', role: 'ADMIN', isEmailVerified: true });
  const o = await User.create({ fullName: 'Org', email: 'org@pau.edu.tr', passwordHash: 'x', role: 'ORGANIZER', isEmailVerified: true });
  admin = generateToken({ id: a._id, role: 'ADMIN' });
  organizer = generateToken({ id: o._id, role: 'ORGANIZER' });
});

const permissionsCall = (token, method = 'get', body) =>
  request(app)[method](`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${token}`).send(body);

const person = async (name, team = { mode: 'solo' }) => {
  const email = `${name.toLocaleLowerCase('tr-TR').replace(/\s+/g, '.')}@example.com`;
  const doc = await Participant.create({ email, emailVerifiedAt: new Date() });
  const token = issueToken(doc, 'EMAIL_OTP').token;
  const auth = call => call.set('Authorization', `Bearer ${token}`);
  const submitted = await auth(request(app).post('/api/v1/forms/public/hack/submit')).send({ fullName: name, email, team });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const base = '/api/v1/forms/public/hack/my-application';
  return {
    id: String(doc._id), email, submitted: submitted.body,
    view: async () => (await auth(request(app).get(base))).body.data,
    post: (path, body = {}) => auth(request(app).post(`${base}${path}`)).send(body),
    put: (answers) => auth(request(app).put(base)).send({ answers })
  };
};

test('both permissions are open by default, also for forms saved before the settings existed', async () => {
  assert.deepEqual((await permissionsCall(admin)).body.data, OPEN);
  await Form.collection.updateOne({ _id: form._id }, { $unset: { 'settings.teamChangesEnabled': '', 'settings.answerEditingEnabled': '', 'settings.registrationEnabled': '' } });
  assert.deepEqual((await permissionsCall(admin)).body.data, OPEN);
  const ayse = await person('Ayşe Yılmaz');
  assert.deepEqual((await ayse.view()).permissions, OPEN);
});

test('only admins read or change permissions; bad input is rejected and partial updates keep the rest', async () => {
  assert.equal((await request(app).get(`/api/v1/forms/${form._id}/permissions`)).status, 401);
  assert.equal((await permissionsCall(organizer)).status, 403);
  assert.equal((await permissionsCall(organizer, 'put', { teamChanges: false })).status, 403);
  assert.equal((await permissionsCall(admin, 'put', { teamChanges: 'no' })).status, 400);
  assert.equal((await permissionsCall(admin, 'put', {})).status, 400);
  assert.equal((await request(app).get('/api/v1/forms/000000000000000000000000/permissions').set('Authorization', `Bearer ${admin}`)).status, 404);

  const res = await permissionsCall(admin, 'put', { teamChanges: false });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, perms({ teamChanges: false }));
  assert.deepEqual((await permissionsCall(admin, 'put', { answerEditing: false })).body.data, perms({ teamChanges: false, answerEditing: false }));
  assert.deepEqual((await permissionsCall(admin, 'put', { teamChanges: true })).body.data, perms({ answerEditing: false }));
});

test('closed team changes: members can only read; captains only answer requests; other team actions are refused and send no code', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Kod Kurtları' });
  const code = kaptan.submitted.team.code;
  const uye = await person('Üye Kişi', { mode: 'join', code });
  const bekleyen = await person('Bekleyen Kişi', { mode: 'join', code });
  const yalniz = await person('Yalnız Kişi');
  assert.equal((await kaptan.post(`/team/requests/${uye.id}/approve`)).status, 200);

  await permissionsCall(admin, 'put', { teamChanges: false });
  const before = await HackathonTeam.findOne({}).lean();
  sent.length = 0;

  const view = await kaptan.view();
  assert.equal(view.team.name, 'Kod Kurtları');
  assert.equal(view.team.members.length, 2);
  assert.equal(view.team.requests.length, 1);
  assert.deepEqual(view.permissions, perms({ teamChanges: false }));

  const refused = [
    kaptan.post(`/team/members/${uye.id}/remove`), kaptan.post('/team/transfer/code'),
    kaptan.post('/team/transfer', { participantId: uye.id, code: '123456' }),
    kaptan.post('/team/disband/code'), kaptan.post('/team/disband', { code: '123456' }),
    uye.post('/team/leave'), bekleyen.post('/team/withdraw'),
    yalniz.post('/team/create', { name: 'Yeni Takım' }), yalniz.post('/team/join', { code })
  ];
  for (const res of await Promise.all(refused)) {
    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.equal(res.body.code, 'TEAM_CHANGES_LOCKED');
  }
  assert.equal(sent.length, 0, 'locked actions must not e-mail a confirmation code');
  assert.deepEqual(await HackathonTeam.findOne({}).lean(), before);
  assert.equal(await HackathonTeam.countDocuments(), 1);

  // Answer editing is a separate permission and stays open.
  assert.equal((await uye.put({ fullName: 'Üye Yeni Ad' })).status, 200);

  // Captains still answer join requests while locked.
  const approved = await kaptan.post(`/team/requests/${bekleyen.id}/approve`);
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.team.members.length, 3);
  const ikinci = await person('İkinci Bekleyen', { mode: 'join', code });
  assert.equal((await kaptan.post(`/team/requests/${ikinci.id}/reject`)).status, 200);

  await permissionsCall(admin, 'put', { teamChanges: true });
  assert.equal((await uye.post('/team/leave')).status, 200);
});

test('closed team changes: new registrants still create teams or send join requests from the registration form', async () => {
  await permissionsCall(admin, 'put', { teamChanges: false });
  const kaptan = await person('Yeni Kaptan', { mode: 'create', name: 'Geç Gelenler' });
  assert.equal(kaptan.submitted.team.role, 'CAPTAIN');
  const katilan = await person('Yeni Katılan', { mode: 'join', code: kaptan.submitted.team.code });
  assert.equal(katilan.submitted.team.status, 'PENDING');
  assert.equal((await kaptan.view()).team.requests.length, 1);
  assert.equal((await kaptan.post(`/team/requests/${katilan.id}/approve`)).status, 200);
  assert.equal((await katilan.view()).team.status, 'APPROVED');
});

test('closed answer editing: answers are readable but updates are refused and nothing changes', async () => {
  const ayse = await person('Ayşe Yılmaz');
  await FormResponse.updateOne({ verifiedEmail: ayse.email }, { status: 'APPROVED' });
  await permissionsCall(admin, 'put', { answerEditing: false });

  const view = await ayse.view();
  assert.deepEqual(view.answers, { fullName: 'Ayşe Yılmaz', email: ayse.email });
  assert.deepEqual(view.permissions, perms({ answerEditing: false }));

  const res = await ayse.put({ fullName: 'Başka Ad' });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ANSWER_EDITING_LOCKED');
  const stored = await FormResponse.findOne({ verifiedEmail: ayse.email }).lean();
  assert.equal(stored.answers.find(a => a.fieldId === 'fullName').value, 'Ayşe Yılmaz');
  assert.equal(stored.status, 'APPROVED');

  // Team changes are a separate permission and stay open.
  assert.equal((await ayse.post('/team/create', { name: 'Açık Takım' })).status, 200);
});

test('staff team tools keep working while participant team changes are closed', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Kod Kurtları' });
  const uye = await person('Üye Kişi', { mode: 'join', code: kaptan.submitted.team.code });
  await kaptan.post(`/team/requests/${uye.id}/approve`);
  await permissionsCall(admin, 'put', { teamChanges: false });
  const team = await HackathonTeam.findOne({});
  const res = await request(app).post(`/api/v1/forms/${form._id}/teams/${team._id}/members/${uye.id}/remove`).set('Authorization', `Bearer ${organizer}`);
  assert.equal(res.status, 200);
  assert.equal((await HackathonTeam.findById(team._id)).members.length, 0);
});

const publicForm = async () => (await request(app).get('/api/v1/forms/public/hack')).body.data;

test('closing registration needs a reason and an ending; the public form shows the composed message', async () => {
  for (const body of [{ registration: false }, { registration: false, closedReason: 'kontenjan dolduğu' },
    { registration: false, closedReason: ' ', closedEnding: 'Görüşmek üzere!' }, { registration: false, closedReason: 'x'.repeat(121), closedEnding: 'Görüşmek üzere!' }]) {
    assert.equal((await permissionsCall(admin, 'put', body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await publicForm()).registration, { open: true, message: '' });

  const res = await permissionsCall(admin, 'put', { registration: false, closedReason: '  kontenjan   dolduğu ', closedEnding: 'Bir sonraki etkinlikte görüşmek üzere!' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.data, perms({ registration: false, closedReason: 'kontenjan dolduğu', closedEnding: 'Bir sonraki etkinlikte görüşmek üzere!' }));
  assert.deepEqual((await publicForm()).registration, { open: false,
    message: 'İlginiz için teşekkür ederiz, kontenjan dolduğu için kaydınızı yapamıyoruz. Bir sonraki etkinlikte görüşmek üzere!' });

  // Opening keeps the texts so the next close starts from them.
  const reopened = await permissionsCall(admin, 'put', { registration: true });
  assert.deepEqual(reopened.body.data, perms({ closedReason: 'kontenjan dolduğu', closedEnding: 'Bir sonraki etkinlikte görüşmek üzere!' }));
  assert.deepEqual((await publicForm()).registration, { open: true, message: '' });
});

test('closed registration refuses new applications but applicants keep their page', async () => {
  const ayse = await person('Ayşe Yılmaz');
  await permissionsCall(admin, 'put', { registration: false, closedReason: 'kontenjan dolduğu', closedEnding: 'Görüşmek üzere!' });

  const doc = await Participant.create({ email: 'yeni@example.com', emailVerifiedAt: new Date() });
  const res = await request(app).post('/api/v1/forms/public/hack/submit').set('Authorization', `Bearer ${issueToken(doc, 'EMAIL_OTP').token}`)
    .send({ fullName: 'Yeni Kişi', email: 'yeni@example.com', team: { mode: 'solo' } });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'REGISTRATION_CLOSED');
  assert.match(res.body.message, /kontenjan dolduğu için kaydınızı yapamıyoruz/);
  assert.equal(await FormResponse.countDocuments(), 1);

  const view = await ayse.view();
  assert.equal(view.answers.fullName, 'Ayşe Yılmaz');
  assert.equal((await ayse.put({ fullName: 'Ayşe Yeni' })).status, 200);
});

test('changing permissions does not change the form version, so people filling the form are not interrupted', async () => {
  const version = (await publicForm()).schemaVersion;
  await permissionsCall(admin, 'put', { teamChanges: false });
  await permissionsCall(admin, 'put', { registration: false, closedReason: 'bakım', closedEnding: 'Yakında döneceğiz.' });
  await permissionsCall(admin, 'put', { registration: true, answerEditing: false });
  assert.equal((await publicForm()).schemaVersion, version);
});
