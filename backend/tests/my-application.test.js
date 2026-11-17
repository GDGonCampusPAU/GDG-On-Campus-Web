// "Başvurum" page: own application status/answers and team management.
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
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { MAX_TEAM_SIZE } = require('../src/services/teamService');

let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), HackathonTeam.init(), Participant.init(), ParticipantOtp.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  sent.length = 0;
  await Promise.all([Form, FormResponse, HackathonTeam, Participant, ParticipantOtp].map(model => model.deleteMany({})));
  await Form.create({ title: 'Hackathon', slug: 'hack', status: 'PUBLISHED',
    fields: [
      { fieldId: 'fullName', label: 'Ad soyad', type: 'text', required: true },
      { fieldId: 'email', label: 'E-posta', type: 'email', required: true },
      { fieldId: 'team', label: 'Katılım', type: 'team', required: true }
    ],
    settings: { verificationRequired: true, verificationMethods: ['EMAIL_OTP'], allowMultipleSubmissions: false } });
});

/** Registers a verified participant; returns helpers bound to their token. */
const person = async (name, team = { mode: 'solo' }) => {
  const email = `${name.toLocaleLowerCase('tr-TR').replace(/\s+/g, '.')}@example.com`;
  const doc = await Participant.create({ email, emailVerifiedAt: new Date() });
  const token = issueToken(doc, 'EMAIL_OTP').token;
  const auth = call => call.set('Authorization', `Bearer ${token}`);
  const submitted = await auth(request(app).post('/api/v1/forms/public/hack/submit')).send({ fullName: name, email, team });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const base = '/api/v1/forms/public/hack/my-application';
  return {
    id: String(doc._id), email, token, submitted: submitted.body,
    view: async () => (await auth(request(app).get(base))).body.data,
    post: (path, body = {}) => auth(request(app).post(`${base}${path}`)).send(body),
    put: (answers) => auth(request(app).put(base)).send({ answers })
  };
};
const responseOf = p => FormResponse.findOne({ verifiedEmail: p.email }).lean();
const teamAnswer = async p => (await responseOf(p)).answers.find(a => a.fieldId === 'team').value;

test('requires a verified participant who has applied', async () => {
  assert.equal((await request(app).get('/api/v1/forms/public/hack/my-application')).status, 401);
  const stranger = await Participant.create({ email: 'stranger@example.com', emailVerifiedAt: new Date() });
  const res = await request(app).get('/api/v1/forms/public/hack/my-application').set('Authorization', `Bearer ${issueToken(stranger, 'EMAIL_OTP').token}`);
  assert.equal(res.status, 404);
});

test('shows admin decision and own answers; the team answer is not editable data', async () => {
  const ayse = await person('Ayşe Yılmaz');
  let view = await ayse.view();
  assert.equal(view.status, 'PENDING');
  assert.equal(view.statusNote, '');
  assert.deepEqual(view.answers, { fullName: 'Ayşe Yılmaz', email: ayse.email });
  assert.equal(view.team, null);

  await FormResponse.updateOne({ verifiedEmail: ayse.email }, { status: 'APPROVED', statusNote: 'Hoş geldin!' });
  view = await ayse.view();
  assert.equal(view.status, 'APPROVED');
  assert.equal(view.statusNote, 'Hoş geldin!');
});

test('captain sees code, members and requests; requester sees only the team name and can withdraw', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Kod Kurtları' });
  const code = kaptan.submitted.team.code;
  const ali = await person('Ali Veli');

  const joined = await ali.post('/team/join', { code: code.toLowerCase() });
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  assert.deepEqual(joined.body.data.team, { name: 'Kod Kurtları', role: 'MEMBER', status: 'PENDING', size: 2, maxSize: MAX_TEAM_SIZE });
  assert.match(await teamAnswer(ali), /kaptan onayı bekleniyor/);

  const captainView = await kaptan.view();
  assert.equal(captainView.team.code, code);
  assert.deepEqual(captainView.team.members.map(m => [m.name, m.captain, m.isMe]), [['Kaptan Kişi', true, true]]);
  assert.deepEqual(captainView.team.requests.map(r => [r.name, r.adminStatus]), [['Ali Veli', 'PENDING']]);

  const withdrawn = await ali.post('/team/withdraw');
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.data.team, null);
  assert.equal(await teamAnswer(ali), 'Bireysel katılım');
  assert.equal((await responseOf(ali)).teamName, '');
  assert.deepEqual((await kaptan.view()).team.requests, []);
  assert.equal((await ali.post('/team/withdraw')).status, 409);
});

test('captain approves or rejects requests; approved members see names and admin status but never e-mails', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Yıldızlar' });
  const code = kaptan.submitted.team.code;
  const ali = await person('Ali Veli');
  const zeynep = await person('Zeynep Kaya');
  await ali.post('/team/join', { code });
  await zeynep.post('/team/join', { code });
  await FormResponse.updateOne({ verifiedEmail: kaptan.email }, { status: 'APPROVED' });

  // Only the captain decides.
  assert.equal((await ali.post(`/team/requests/${zeynep.id}/approve`)).status, 403);

  const approved = await kaptan.post(`/team/requests/${ali.id}/approve`);
  assert.equal(approved.status, 200);
  assert.deepEqual(approved.body.data.team.members.map(m => m.name), ['Kaptan Kişi', 'Ali Veli']);
  assert.match(await teamAnswer(ali), /^Takım üyesi: Yıldızlar/);

  const rejected = await kaptan.post(`/team/requests/${zeynep.id}/reject`);
  assert.equal(rejected.status, 200);
  assert.deepEqual(rejected.body.data.team.requests, []);
  assert.equal((await zeynep.view()).team, null);
  assert.equal(await teamAnswer(zeynep), 'Bireysel katılım');
  assert.equal((await kaptan.post(`/team/requests/${zeynep.id}/reject`)).status, 404);

  const memberView = await ali.view();
  assert.equal(memberView.team.role, 'MEMBER');
  assert.equal(memberView.team.requests, undefined, 'members do not see join requests');
  assert.deepEqual(memberView.team.members.map(m => [m.name, m.adminStatus]), [['Kaptan Kişi', 'APPROVED'], ['Ali Veli', 'PENDING']]);
  assert.doesNotMatch(JSON.stringify(memberView.team), /@example\.com/);
  assert.doesNotMatch(JSON.stringify((await kaptan.view()).team), /@example\.com/);
});

test('captain removes members; members leave; captain cannot leave', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Takım A' });
  const code = kaptan.submitted.team.code;
  const ali = await person('Ali Veli');
  const can = await person('Can Demir');
  for (const p of [ali, can]) { await p.post('/team/join', { code }); await kaptan.post(`/team/requests/${p.id}/approve`); }

  assert.equal((await ali.post(`/team/members/${can.id}/remove`)).status, 403);
  const removed = await kaptan.post(`/team/members/${can.id}/remove`);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.data.team.members.map(m => m.name), ['Kaptan Kişi', 'Ali Veli']);
  assert.equal((await can.view()).team, null);

  const left = await ali.post('/team/leave');
  assert.equal(left.status, 200);
  assert.equal(left.body.data.team, null);
  assert.deepEqual((await kaptan.view()).team.members.map(m => m.name), ['Kaptan Kişi']);

  const captainLeave = await kaptan.post('/team/leave');
  assert.equal(captainLeave.status, 409);
  assert.match(captainLeave.body.message, /dağıtabilirsin/);
});

test('people without a team can join from the page; full teams and double membership are refused', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Dolu' });
  const code = kaptan.submitted.team.code;
  const others = [];
  for (let i = 1; i < MAX_TEAM_SIZE; i += 1) others.push(await person(`Üye ${i}`));
  for (const p of others) assert.equal((await p.post('/team/join', { code })).status, 200);
  const late = await person('Geç Kalan');
  const full = await late.post('/team/join', { code });
  assert.equal(full.status, 400);
  assert.match(full.body.message, /dolu/);
  assert.equal((await others[0].post('/team/join', { code })).status, 409);
  assert.equal((await kaptan.post('/team/join', { code })).status, 409);
  assert.equal((await late.post('/team/join', { code: 'ZZZZZZ' })).status, 400);
});

test('disbanding needs the e-mailed code and turns everyone into individual participants', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Dağılacak' });
  const code = kaptan.submitted.team.code;
  const ali = await person('Ali Veli');
  const can = await person('Can Demir');
  await ali.post('/team/join', { code });
  await kaptan.post(`/team/requests/${ali.id}/approve`);
  await can.post('/team/join', { code });

  assert.equal((await ali.post('/team/disband/code')).status, 403);
  assert.equal((await ali.post('/team/disband', { code: '123456' })).status, 403);

  assert.equal((await kaptan.post('/team/disband/code')).status, 200);
  const mail = sent.at(-1);
  assert.equal(mail.to, kaptan.email);
  assert.match(mail.subject, /Takımı dağıtma/);
  const otp = mail.textContent.match(/\d{6}/)[0];

  const wrong = await kaptan.post('/team/disband', { code: otp === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.equal(await HackathonTeam.countDocuments(), 1);

  const done = await kaptan.post('/team/disband', { code: otp });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.data.team, null);
  assert.equal(await HackathonTeam.countDocuments(), 0);
  for (const p of [kaptan, ali, can]) {
    assert.equal((await p.view()).team, null);
    assert.equal(await teamAnswer(p), 'Bireysel katılım');
    assert.equal((await responseOf(p)).teamRole, null);
  }
});

test('editing answers keeps e-mail and team, and sends the application back to the admin', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Ekip' });
  await FormResponse.updateOne({ verifiedEmail: kaptan.email }, { status: 'APPROVED', statusNote: 'Tamam', lastNotifiedStatus: 'APPROVED' });
  const before = await teamAnswer(kaptan);

  const updated = await kaptan.put({ fullName: 'Kaptan Yeni Ad', email: 'baska@example.com', team: { mode: 'solo' } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.status, 'PENDING');
  assert.equal(updated.body.data.statusNote, '');
  assert.deepEqual(updated.body.data.answers, { fullName: 'Kaptan Yeni Ad', email: kaptan.email });
  assert.equal(updated.body.data.team.name, 'Ekip', 'team is untouched');

  const saved = await responseOf(kaptan);
  assert.equal(saved.status, 'PENDING');
  assert.equal(saved.lastNotifiedStatus, null, 'a later decision e-mails again');
  assert.equal(await teamAnswer(kaptan), before);

  const invalid = await kaptan.put({ fullName: '' });
  assert.equal(invalid.status, 400);
  assert.equal((await responseOf(kaptan)).answers.find(a => a.fieldId === 'fullName').value, 'Kaptan Yeni Ad');
  assert.equal((await kaptan.put(['x'])).status, 400);
});

test('people without a team can found one from the page and become captain', async () => {
  const solo = await person('Selin Bireysel');
  assert.equal((await solo.post('/team/create', { name: 'a' })).status, 400);
  const created = await solo.post('/team/create', { name: '  Yeni   Ekip ' });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.data.team.role, 'CAPTAIN');
  assert.equal(created.body.data.team.name, 'Yeni Ekip');
  assert.match(created.body.data.team.code, /^[A-Z0-9]{6}$/);
  assert.equal(String((await HackathonTeam.findOne({ name: 'Yeni Ekip' })).captain.response), String((await responseOf(solo))._id));
  assert.match(await teamAnswer(solo), /^Takım kurdu: Yeni Ekip/);

  // Already a captain, a name clash, and a pending requester are all refused.
  assert.equal((await solo.post('/team/create', { name: 'Başka' })).status, 409);
  const other = await person('Ozan Başka');
  assert.equal((await other.post('/team/create', { name: 'YENİ EKİP' })).status, 400);
  await other.post('/team/join', { code: created.body.data.team.code });
  const pending = await other.post('/team/create', { name: 'Kendi Ekibim' });
  assert.equal(pending.status, 409);
  assert.match(pending.body.message, /geri çekmelisin/);
});

test('captaincy moves to an approved member only after the e-mailed code', async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Devir' });
  const code = kaptan.submitted.team.code;
  const ali = await person('Ali Veli');
  const can = await person('Can Demir');
  await ali.post('/team/join', { code });
  await kaptan.post(`/team/requests/${ali.id}/approve`);
  await can.post('/team/join', { code });

  assert.equal((await ali.post('/team/transfer/code')).status, 403);
  assert.equal((await kaptan.post('/team/transfer/code')).status, 200);
  const otp = sent.at(-1).textContent.match(/\d{6}/)[0];
  assert.match(sent.at(-1).subject, /Kaptanlık devri/);

  // Pending requesters cannot be made captain; a wrong code changes nothing.
  assert.equal((await kaptan.post('/team/transfer', { participantId: can.id, code: otp })).status, 404);
  const wrong = await kaptan.post('/team/transfer', { participantId: ali.id, code: otp === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.equal((await kaptan.view()).team.role, 'CAPTAIN');

  const done = await kaptan.post('/team/transfer', { participantId: ali.id, code: otp });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.data.team.role, 'MEMBER');
  assert.equal(done.body.data.team.status, 'APPROVED');
  assert.equal(done.body.data.team.requests, undefined);

  const aliView = await ali.view();
  assert.equal(aliView.team.role, 'CAPTAIN');
  assert.deepEqual(aliView.team.members.map(m => [m.name, m.captain]), [['Ali Veli', true], ['Kaptan Kişi', false]]);
  assert.deepEqual(aliView.team.requests.map(r => r.name), ['Can Demir'], 'pending requests move to the new captain');
  assert.equal((await responseOf(ali)).teamRole, 'CAPTAIN');
  assert.equal((await responseOf(kaptan)).teamRole, 'MEMBER');
  assert.match(await teamAnswer(ali), /^Takım kurdu: Devir/);
  assert.match(await teamAnswer(kaptan), /^Takım üyesi: Devir/);

  // The new captain now holds the powers; the old one does not.
  assert.equal((await kaptan.post(`/team/requests/${can.id}/approve`)).status, 403);
  assert.equal((await ali.post(`/team/requests/${can.id}/approve`)).status, 200);
});
