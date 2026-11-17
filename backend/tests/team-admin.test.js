// Staff team tools and the "rejected applicant leaves the team" rule.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const emailService = require('../src/services/emailService');
emailService.sendEmail = async () => {};
const app = require('../src/app');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const HackathonTeam = require('../src/models/HackathonTeam');
const Participant = require('../src/modules/participantAuth/models/Participant');
const User = require('../src/models/User');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { generateToken } = require('../src/utils/jwt');

let repl, form, staff, member;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), HackathonTeam.init(), Participant.init(), User.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  await Promise.all([Form, FormResponse, HackathonTeam, Participant, User].map(model => model.deleteMany({})));
  form = await Form.create({ title: 'Hackathon', slug: 'hack', status: 'PUBLISHED',
    fields: [{ fieldId: 'fullName', label: 'Ad soyad', type: 'text', required: true }, { fieldId: 'team', label: 'Katılım', type: 'team', required: true }],
    settings: { verificationRequired: true, verificationMethods: ['EMAIL_OTP'], allowMultipleSubmissions: false } });
  const organizer = await User.create({ fullName: 'Org', email: 'org@pau.edu.tr', passwordHash: 'x', role: 'ORGANIZER', isEmailVerified: true });
  const plain = await User.create({ fullName: 'Üye', email: 'uye@pau.edu.tr', passwordHash: 'x', role: 'MEMBER', isEmailVerified: true });
  staff = generateToken({ id: organizer._id, role: 'ORGANIZER' });
  member = generateToken({ id: plain._id, role: 'MEMBER' });
});

const person = async (name, team = { mode: 'solo' }) => {
  const email = `${name.toLocaleLowerCase('tr-TR').replace(/\s+/g, '.')}@example.com`;
  const doc = await Participant.create({ email, emailVerifiedAt: new Date() });
  const token = issueToken(doc, 'EMAIL_OTP').token;
  const res = await request(app).post('/api/v1/forms/public/hack/submit').set('Authorization', `Bearer ${token}`).send({ fullName: name, team });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const mine = '/api/v1/forms/public/hack/my-application';
  return { id: String(doc._id), email, responseId: res.body.responseId, code: res.body.team?.code,
    post: (path, body = {}) => request(app).post(`${mine}${path}`).set('Authorization', `Bearer ${token}`).send(body),
    view: async () => (await request(app).get(mine).set('Authorization', `Bearer ${token}`)).body.data };
};
const asStaff = (method, path, body) => request(app)[method](`/api/v1/forms/${form._id}${path}`).set('Authorization', `Bearer ${staff}`).send(body);
const decide = (p, status) => asStaff('patch', `/responses/${p.responseId}/status`, { status, notify: false });
/** Captain + approved member + pending requester. */
const team = async () => {
  const kaptan = await person('Kaptan Kişi', { mode: 'create', name: 'Ekip' });
  const ali = await person('Ali Veli');
  const can = await person('Can Demir');
  await ali.post('/team/join', { code: kaptan.code });
  await kaptan.post(`/team/requests/${ali.id}/approve`);
  await can.post('/team/join', { code: kaptan.code });
  const teamId = String((await HackathonTeam.findOne({ name: 'Ekip' }))._id);
  return { kaptan, ali, can, teamId };
};

test('only staff can list teams; the list shows people, e-mails, requests and readiness', async () => {
  const { kaptan } = await team();
  assert.equal((await request(app).get(`/api/v1/forms/${form._id}/teams`)).status, 401);
  assert.equal((await request(app).get(`/api/v1/forms/${form._id}/teams`).set('Authorization', `Bearer ${member}`)).status, 403);

  let list = (await asStaff('get', '/teams')).body.data;
  assert.equal(list.length, 1);
  assert.equal(list[0].code, kaptan.code);
  assert.equal(list[0].size, 3);
  assert.deepEqual(list[0].members.map(m => [m.name, m.email, m.captain]), [['Kaptan Kişi', 'kaptan.kişi@example.com', true], ['Ali Veli', 'ali.veli@example.com', false]]);
  assert.deepEqual(list[0].requests.map(r => r.name), ['Can Demir']);
  assert.equal(list[0].allApproved, false);

  await FormResponse.updateMany({}, { status: 'APPROVED' });
  list = (await asStaff('get', '/teams')).body.data;
  assert.equal(list[0].allApproved, true);
});

test('staff remove members or requests, change the captain and disband', async () => {
  const { kaptan, ali, can, teamId } = await team();
  const captainRemoval = await asStaff('post', `/teams/${teamId}/members/${kaptan.id}/remove`);
  assert.equal(captainRemoval.status, 409);

  const removedRequest = await asStaff('post', `/teams/${teamId}/members/${can.id}/remove`);
  assert.equal(removedRequest.status, 200);
  assert.deepEqual(removedRequest.body.data[0].requests, []);
  assert.equal((await can.view()).team, null);

  assert.equal((await asStaff('post', `/teams/${teamId}/captain`, { participantId: can.id })).status, 404);
  const changed = await asStaff('post', `/teams/${teamId}/captain`, { participantId: ali.id });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body.data[0].members.map(m => [m.name, m.captain]), [['Ali Veli', true], ['Kaptan Kişi', false]]);
  assert.equal((await ali.view()).team.role, 'CAPTAIN');

  const removed = await asStaff('post', `/teams/${teamId}/members/${kaptan.id}/remove`);
  assert.equal(removed.status, 200);
  assert.equal((await kaptan.view()).team, null);
  assert.equal((await FormResponse.findById(kaptan.responseId)).answers.find(a => a.fieldId === 'team').value, 'Bireysel katılım');

  const disbanded = await asStaff('delete', `/teams/${teamId}`);
  assert.equal(disbanded.status, 200);
  assert.deepEqual(disbanded.body.data, []);
  assert.equal((await ali.view()).team, null);
  assert.equal((await asStaff('delete', `/teams/${teamId}`)).status, 404);
});

test('rejected member or pending requester leaves the team; approval keeps them', async () => {
  const { ali, can } = await team();
  assert.equal((await decide(ali, 'APPROVED')).body.teamOutcome, null);
  assert.equal((await ali.view()).team.role, 'MEMBER');

  const rejectedRequest = await decide(can, 'REJECTED');
  assert.equal(rejectedRequest.body.teamOutcome, 'left');
  assert.match(rejectedRequest.body.message, /Takımından çıkarıldı/);
  assert.equal(rejectedRequest.body.data.team, null);
  assert.equal((await can.view()).team, null);

  const rejectedMember = await decide(ali, 'REJECTED');
  assert.equal(rejectedMember.body.teamOutcome, 'left');
  assert.equal((await ali.view()).team, null);
  assert.equal((await HackathonTeam.findOne({ name: 'Ekip' })).members.length, 0);
});

test('a rejected captain hands over to the longest-approved member, or the team dissolves', async () => {
  const { kaptan, ali, can } = await team();
  const dora = await person('Dora Son');
  await dora.post('/team/join', { code: kaptan.code });
  await kaptan.post(`/team/requests/${dora.id}/approve`);

  const replaced = await decide(kaptan, 'REJECTED');
  assert.equal(replaced.body.teamOutcome, 'captain-replaced');
  assert.equal((await ali.view()).team.role, 'CAPTAIN', 'Ali was approved before Dora');
  assert.equal((await kaptan.view()).team, null);
  const after = await HackathonTeam.findOne({ name: 'Ekip' }).lean();
  assert.equal(after.members.some(m => m.email === kaptan.email), false);
  assert.equal(after.members.find(m => m.email === can.email).status, 'PENDING', 'pending request survives');

  // Alone with only a pending request: rejecting the captain dissolves the team.
  const solo = await person('Yalnız Kaptan', { mode: 'create', name: 'Tek' });
  const waiting = await person('Bekleyen Kişi');
  await waiting.post('/team/join', { code: solo.code });
  const dissolved = await decide(solo, 'REJECTED');
  assert.equal(dissolved.body.teamOutcome, 'disbanded');
  assert.equal(await HackathonTeam.countDocuments({ name: 'Tek' }), 0);
  assert.equal((await waiting.view()).team, null);
});

test('staff list filters by team state, reports counts, team codes and participant edits; CSV has team columns', async () => {
  const { kaptan, ali } = await team();
  await person('Selin Bireysel');
  await decide(ali, 'APPROVED');
  const edit = await request(app).put('/api/v1/forms/public/hack/my-application')
    .set('Authorization', `Bearer ${issueToken(await Participant.findOne({ email: kaptan.email }), 'EMAIL_OTP').token}`)
    .send({ answers: { fullName: 'Kaptan Yeni' } });
  assert.equal(edit.status, 200);

  const list = async (query = '') => (await asStaff('get', `/responses${query}`)).body;
  const names = body => body.data.map(r => r.answers.find(a => a.fieldId === 'fullName').value).sort();
  const all = await list();
  assert.deepEqual(all.summary, { total: 4, PENDING: 3, APPROVED: 1, REJECTED: 0 });
  const captain = all.data.find(r => r.teamRole === 'CAPTAIN');
  assert.equal(captain.teamCode, kaptan.code);
  assert.ok(captain.editedAt, 'participant edit is visible to staff');

  assert.deepEqual(names(await list('?team=solo')), ['Selin Bireysel']);
  assert.deepEqual(names(await list('?team=captain')), ['Kaptan Yeni']);
  assert.deepEqual(names(await list('?team=pending')), ['Can Demir']);
  assert.deepEqual(names(await list('?team=team')), ['Ali Veli', 'Kaptan Yeni']);
  assert.equal((await asStaff('get', '/responses?team=bogus')).status, 400);

  const csv = (await asStaff('get', '/responses/export')).text;
  assert.match(csv, /"Takım Adı","Takım Kodu","Takımdaki Rol"/);
  assert.match(csv, new RegExp(`"Ekip","${kaptan.code}","Kaptan"`));
  assert.match(csv, new RegExp(`"Ekip","${kaptan.code}","Kaptan onayı bekliyor","Can Demir"`));
  assert.match(csv, /"","","Bireysel","Selin Bireysel"/);
});
