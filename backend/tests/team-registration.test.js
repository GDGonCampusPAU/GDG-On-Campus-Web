// Team creation / joining through the registration form (`team` field type).
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
const FormResponse = require('../src/models/FormResponse');
const HackathonTeam = require('../src/models/HackathonTeam');
const Participant = require('../src/modules/participantAuth/models/Participant');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { CODE_ALPHABET, MAX_TEAM_SIZE } = require('../src/services/teamService');
const { resolveFormApplicant } = require('../src/services/applicationStatusService');

let repl, form;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([Form.init(), FormResponse.init(), HackathonTeam.init(), Participant.init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
beforeEach(async () => {
  await Promise.all([Form, FormResponse, HackathonTeam, Participant].map(model => model.deleteMany({})));
  form = await Form.create({ title: 'Hackathon', slug: 'hack', status: 'PUBLISHED',
    fields: [
      { fieldId: 'fullName', label: 'Ad soyad', type: 'text', required: true },
      { fieldId: 'team', label: 'Katılım şekli', type: 'team', required: true }
    ],
    settings: { verificationRequired: true, verificationMethods: ['EMAIL_OTP', 'GOOGLE'], allowMultipleSubmissions: false } });
});

let counter = 0;
const participant = async () => {
  counter += 1;
  const doc = await Participant.create({ email: `kisi${counter}@example.com`, emailVerifiedAt: new Date() });
  return issueToken(doc, 'EMAIL_OTP').token;
};
const submit = async (team, token) => request(app).post('/api/v1/forms/public/hack/submit')
  .set('Authorization', `Bearer ${token || await participant()}`).send({ fullName: 'Ayşe Yılmaz', team });
const codeChars = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

test('solo participation stores a readable answer and no team', async () => {
  const res = await submit({ mode: 'solo' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.team, null);
  const saved = await FormResponse.findById(res.body.responseId).lean();
  assert.equal(saved.answers.find(a => a.fieldId === 'team').value, 'Bireysel katılım');
  assert.equal(saved.team, null);
  assert.equal(await HackathonTeam.countDocuments(), 0);
});

test('creating a team makes the applicant captain and returns the 6-character code only to them', async () => {
  const res = await submit({ mode: 'create', name: '  Kod   Kurtları ' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.team.role, 'CAPTAIN');
  assert.equal(res.body.team.name, 'Kod Kurtları');
  assert.match(res.body.team.code, codeChars);

  const team = await HackathonTeam.findOne({ code: res.body.team.code }).lean();
  assert.equal(String(team.captain.response), res.body.responseId);
  const saved = await FormResponse.findById(res.body.responseId).lean();
  assert.equal(saved.teamName, 'Kod Kurtları');
  assert.equal(saved.teamRole, 'CAPTAIN');
  assert.equal(String(saved.team), String(team._id));
  assert.match(saved.answers.find(a => a.fieldId === 'team').value, /^Takım kurdu: Kod Kurtları \(kod [A-Z0-9]{6}\)$/);
  // Decision e-mails keep showing the team name.
  assert.equal(resolveFormApplicant(saved).teamName, 'Kod Kurtları');
});

test('team names are unique per form regardless of case, and a failed submission rolls everything back', async () => {
  assert.equal((await submit({ mode: 'create', name: 'Kod Kurtları' })).status, 201);
  const clash = await submit({ mode: 'create', name: 'KOD KURTLARI' });
  assert.equal(clash.status, 400);
  assert.match(clash.body.message, /takım adı alınmış/);
  assert.equal(await HackathonTeam.countDocuments(), 1);
  assert.equal(await FormResponse.countDocuments(), 1);
  assert.equal((await Form.findById(form._id)).submissionCount, 1, 'submission counter rolled back');
});

test('joining with a code (any case) adds a PENDING member and hides the code from them', async () => {
  const captain = await submit({ mode: 'create', name: 'Yıldızlar' });
  const res = await submit({ mode: 'join', code: ` ${captain.body.team.code.toLowerCase()} ` });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.team, { name: 'Yıldızlar', role: 'MEMBER', status: 'PENDING' });

  const team = await HackathonTeam.findOne({ code: captain.body.team.code }).lean();
  assert.equal(team.members.length, 1);
  assert.equal(team.members[0].status, 'PENDING');
  assert.equal(String(team.members[0].response), res.body.responseId);
  const saved = await FormResponse.findById(res.body.responseId).lean();
  assert.equal(saved.teamRole, 'MEMBER');
  assert.match(saved.answers.find(a => a.fieldId === 'team').value, /kaptan onayı bekleniyor/);
});

test('unknown codes and full teams are rejected without saving the application', async () => {
  const unknown = await submit({ mode: 'join', code: 'ZZZZZZ' });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body.message, /takım bulunamadı/);

  const captain = await submit({ mode: 'create', name: 'Dolu Takım' });
  for (let i = 1; i < MAX_TEAM_SIZE; i += 1) assert.equal((await submit({ mode: 'join', code: captain.body.team.code })).status, 201);
  const extra = await submit({ mode: 'join', code: captain.body.team.code });
  assert.equal(extra.status, 400);
  assert.match(extra.body.message, /dolu/);
  assert.equal((await HackathonTeam.findOne({ code: captain.body.team.code })).members.length, MAX_TEAM_SIZE - 1);
  assert.equal(await FormResponse.countDocuments(), MAX_TEAM_SIZE);
});

test('malformed or missing team answers fail validation', async () => {
  for (const team of [undefined, { mode: 'create', name: 'a' }, { mode: 'join', code: 'ABC' }, { mode: 'join', code: 'ABC-12' }, { mode: 'party' }, 'create', ['solo']]) {
    const res = await submit(team);
    assert.equal(res.status, 400, JSON.stringify({ team, body: res.body }));
  }
  assert.equal(await FormResponse.countDocuments(), 0);
  assert.equal(await HackathonTeam.countDocuments(), 0);
});

test('two people racing for the same team name: exactly one wins', async () => {
  const results = await Promise.all([submit({ mode: 'create', name: 'Aynı Ad' }), submit({ mode: 'create', name: 'aynı ad' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
  assert.equal(await HackathonTeam.countDocuments(), 1);
  assert.equal(await FormResponse.countDocuments(), 1);
});

test('code lookup shows only name and size to verified participants', async () => {
  const token = await participant();
  const captain = await submit({ mode: 'create', name: 'Gizli Ekip' });
  const lookup = code => request(app).get(`/api/v1/forms/public/hack/teams/${code}`);
  assert.equal((await lookup(captain.body.team.code)).status, 401);
  const found = await lookup(captain.body.team.code.toLowerCase()).set('Authorization', `Bearer ${token}`);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body.data, { name: 'Gizli Ekip', size: 1, maxSize: MAX_TEAM_SIZE, full: false });
  assert.doesNotMatch(JSON.stringify(found.body), /@example\.com/);
  assert.equal((await lookup('ZZZZZZ').set('Authorization', `Bearer ${token}`)).status, 404);
  assert.equal((await lookup('bad').set('Authorization', `Bearer ${token}`)).status, 404);
});
