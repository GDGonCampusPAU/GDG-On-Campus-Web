// Project upload: the "Proje Yükleme" handoff token and the internal API the upload site calls.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const UPLOAD_SECRET = 'test-project-upload-secret-at-least-32-chars';
const INTERNAL_KEY = 'test-internal-key-for-the-upload-site-backend';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const emailService = require('../src/services/emailService');
emailService.sendEmail = async () => {};
const app = require('../src/app');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const HackathonTeam = require('../src/models/HackathonTeam');
const EventPage = require('../src/models/EventPage');
const Participant = require('../src/modules/participantAuth/models/Participant');
const ProjectSubmission = require('../src/modules/projectUpload/models/ProjectSubmission');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { parseRepoUrl } = require('../src/modules/projectUpload/services/repoUrl');

let repl, form;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), HackathonTeam.init(), Participant.init(), ProjectSubmission.init(), EventPage.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  process.env.PROJECT_UPLOAD_URL = 'https://proje.example.com/';
  process.env.PROJECT_UPLOAD_SECRET = UPLOAD_SECRET;
  process.env.PROJECT_UPLOAD_INTERNAL_KEY = INTERNAL_KEY;
  await Promise.all([Form, FormResponse, HackathonTeam, Participant, ProjectSubmission, EventPage].map(model => model.deleteMany({})));
  form = await Form.create({ title: 'Hackathon', slug: 'hack', status: 'PUBLISHED',
    fields: [
      { fieldId: 'fullName', label: 'Ad soyad', type: 'text', required: true },
      { fieldId: 'email', label: 'E-posta', type: 'email', required: true },
      { fieldId: 'team', label: 'Takım', type: 'team', required: true }
    ],
    settings: { verificationRequired: true, verificationMethods: ['EMAIL_OTP'], allowMultipleSubmissions: false } });
  await EventPage.create({ _id: 'hackathon', event: { startsAt: '2026-11-27T09:00:00+03:00' }, formSlug: 'hack' });
});

const person = async (name, team) => {
  const email = `${name.toLocaleLowerCase('tr-TR').replace(/\s+/g, '.')}@example.com`;
  const doc = await Participant.create({ email, emailVerifiedAt: new Date() });
  const token = issueToken(doc, 'EMAIL_OTP').token;
  const auth = call => call.set('Authorization', `Bearer ${token}`);
  const submitted = await auth(request(app).post('/api/v1/forms/public/hack/submit')).send({ fullName: name, email, team });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const base = '/api/v1/forms/public/hack/my-application';
  return { id: String(doc._id), post: (path, body = {}) => auth(request(app).post(`${base}${path}`)).send(body) };
};

/** A captain with an approved member and a pending requester. */
const team = async (name = 'Kod Kurtları') => {
  const captain = await person(`${name} Kaptan`, { mode: 'create', name });
  const doc = await HackathonTeam.findOne({ name });
  const member = await person(`${name} Üye`, { mode: 'join', code: doc.code });
  assert.equal((await captain.post(`/team/requests/${member.id}/approve`)).status, 200);
  const pending = await person(`${name} Bekleyen`, { mode: 'join', code: doc.code });
  return { captain, member, pending, id: String(doc._id) };
};

const internal = (method, path, body, key = INTERNAL_KEY) => {
  const call = request(app)[method](`/api/v1/internal/project-upload${path}`);
  if (key !== null) call.set('X-Internal-Key', key);
  return body ? call.send(body) : call;
};
const state = (teamId, participant) => internal('get', `/teams/${teamId}/state?participant=${participant}`);
const save = (teamId, participant, repoUrl) => internal('put', `/teams/${teamId}/submission`, { participant, repoUrl });

test('repo links are normalized to github.com/owner/repo and anything else is refused', () => {
  const ok = parseRepoUrl('  github.com/Kod-Kurtlari/hack.app.git/ ');
  assert.deepEqual(ok, { owner: 'Kod-Kurtlari', repo: 'hack.app', url: 'https://github.com/Kod-Kurtlari/hack.app', key: 'kod-kurtlari/hack.app' });
  assert.equal(parseRepoUrl('https://www.github.com/a/b/tree/main/src?x=1#y').url, 'https://github.com/a/b');
  for (const bad of ['', 'https://gitlab.com/a/b', 'https://github.com/a', 'https://github.com/-a/b', 'ftp://github.com/a/b',
    'https://github.com.evil.com/a/b', 'https://github.com/a/..', 'javascript:alert(1)', 42, null]) {
    assert.equal(parseRepoUrl(bad), null, String(bad));
  }
});

test('handoff: only approved team members get a 24-hour token for the upload site, in the URL fragment', async () => {
  const t = await team();
  const solo = await person('Yalnız Kurt', { mode: 'solo' });
  const noTeam = await solo.post('/project-upload');
  assert.equal(noTeam.status, 409);
  assert.match(noTeam.body.message, /önce bir takımda/);
  assert.equal((await t.pending.post('/project-upload')).status, 409);

  for (const who of [t.captain, t.member]) {
    const res = await who.post('/project-upload');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [base, token] = res.body.data.url.split('#t=');
    assert.equal(base, 'https://proje.example.com/');
    const payload = jwt.verify(token, UPLOAD_SECRET, { audience: 'project-upload', issuer: 'gdg-pau' });
    assert.equal(payload.sub, who.id);
    assert.equal(payload.team, t.id);
    assert.equal(payload.teamName, 'Kod Kurtları');
    assert.equal(payload.exp - payload.iat, 24 * 60 * 60);
    assert.equal(Date.parse(res.body.data.expiresAt), payload.exp * 1000);
  }
  // Signed with its own secret, never the participant or staff one.
  const token = (await t.captain.post('/project-upload')).body.data.url.split('#t=')[1];
  assert.throws(() => jwt.verify(token, process.env.PARTICIPANT_JWT_SECRET));
});

test('handoff: without the upload site configured the button says it is unavailable', async () => {
  const t = await team();
  process.env.PROJECT_UPLOAD_SECRET = 'too-short';
  const res = await t.captain.post('/project-upload');
  assert.equal(res.status, 503);
  assert.match(res.body.message, /kullanılamıyor/);
});

test('internal API: hidden without a configured key, refuses a wrong key', async () => {
  const t = await team();
  process.env.PROJECT_UPLOAD_INTERNAL_KEY = '';
  assert.equal((await state(t.id, t.captain.id)).status, 404);
  process.env.PROJECT_UPLOAD_INTERNAL_KEY = INTERNAL_KEY;
  assert.equal((await internal('get', `/teams/${t.id}/state?participant=${t.captain.id}`, null, null)).status, 401);
  assert.equal((await internal('get', `/teams/${t.id}/state?participant=${t.captain.id}`, null, 'wrong-key')).status, 401);
  assert.equal((await internal('get', '/teams/nope/state?participant=x')).status, 400);
});

test('state: members see the team, the switch and the event start; others and vanished teams are told so', async () => {
  const t = await team();
  const res = await state(t.id, t.member.id);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { member: true, reason: null, team: { id: t.id, name: 'Kod Kurtları' }, open: true,
    submission: null, eventStartsAt: '2026-11-27T09:00:00+03:00' });
  const pending = (await state(t.id, t.pending.id)).body.data;
  assert.equal(pending.member, false);
  assert.equal(pending.reason, 'NOT_MEMBER');
  const gone = (await state('000000000000000000000000', t.captain.id)).body.data;
  assert.equal(gone.member, false);
  assert.equal(gone.reason, 'TEAM_GONE');
});

test('save: any member sets the shared link, changes are recorded, the same repo cannot go to two teams', async () => {
  const t = await team();
  const first = await save(t.id, t.member.id, 'github.com/Kod-Kurtlari/hack.git');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.submission.repoUrl, 'https://github.com/Kod-Kurtlari/hack');
  assert.equal(first.body.data.submission.updatedBy, 'Kod Kurtları Üye');
  // The captain sees the same link: it belongs to the team.
  assert.equal((await state(t.id, t.captain.id)).body.data.submission.repoUrl, 'https://github.com/Kod-Kurtlari/hack');

  const changed = (await save(t.id, t.captain.id, 'https://github.com/Kod-Kurtlari/hack-v2')).body.data.submission;
  assert.equal(changed.repoUrl, 'https://github.com/Kod-Kurtlari/hack-v2');
  assert.equal(changed.updatedBy, 'Kod Kurtları Kaptan');
  assert.deepEqual(changed.history.map(h => [h.repoUrl, h.by]), [
    ['https://github.com/Kod-Kurtlari/hack-v2', 'Kod Kurtları Kaptan'],
    ['https://github.com/Kod-Kurtlari/hack', 'Kod Kurtları Üye']
  ]);
  // Saving the same link again is not a new change.
  assert.equal((await save(t.id, t.captain.id, 'github.com/kod-kurtlari/hack-v2/')).body.data.submission.history.length, 2);
  assert.equal(await ProjectSubmission.countDocuments(), 1);

  const other = await team('Yıldızlar');
  const taken = await save(other.id, other.captain.id, 'https://github.com/KOD-KURTLARI/HACK-V2');
  assert.equal(taken.status, 409);
  assert.equal(taken.body.code, 'REPO_TAKEN');
  // The repo the first team left is free again.
  assert.equal((await save(other.id, other.captain.id, 'https://github.com/kod-kurtlari/hack')).status, 200);
});

test('save: bad links, non-members, people who left and a closed upload are refused', async () => {
  const t = await team();
  const bad = await save(t.id, t.captain.id, 'https://gitlab.com/a/b');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'INVALID_REPO');
  assert.equal((await save(t.id, t.pending.id, 'https://github.com/a/b')).body.code, 'NOT_MEMBER');

  assert.equal((await t.member.post('/team/leave')).status, 200);
  const left = await save(t.id, t.member.id, 'https://github.com/a/b');
  assert.equal(left.status, 403);
  assert.equal(left.body.code, 'NOT_MEMBER');

  await save(t.id, t.captain.id, 'https://github.com/a/b');
  await Form.updateOne({ _id: form._id }, { $set: { 'settings.projectUploadEnabled': false } });
  const closed = await save(t.id, t.captain.id, 'https://github.com/a/c');
  assert.equal(closed.status, 403);
  assert.equal(closed.body.code, 'UPLOAD_CLOSED');
  // Closed only stops changes: the link and the state stay readable.
  const view = (await state(t.id, t.captain.id)).body.data;
  assert.equal(view.open, false);
  assert.equal(view.submission.repoUrl, 'https://github.com/a/b');
});

test('the upload site calls are not counted by the per-IP API limit', async () => {
  const t = await team();
  for (let i = 0; i < 210; i++) {
    const res = await state(t.id, t.captain.id);
    assert.equal(res.status, 200, `call ${i}`);
  }
});
