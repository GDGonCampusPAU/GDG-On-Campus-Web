// Live presentation session: "Proje değerlendirme" permission, random order, one team voted at a time.
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
const HackathonTeam = require('../src/models/HackathonTeam');
const JudgingConfig = require('../src/modules/jury/models/JudgingConfig');
const Juror = require('../src/modules/jury/models/Juror');
const Scorecard = require('../src/modules/jury/models/Scorecard');
const JuryAuditLog = require('../src/modules/jury/models/JuryAuditLog');
const ProjectSubmission = require('../src/modules/projectUpload/models/ProjectSubmission');
const { DEFAULT_CRITERIA } = require('../src/modules/jury/defaults');
const { init } = require('../src/modules/jury');
const { generateToken } = require('../src/utils/jwt');

let repl, admin, organizer, form, teams;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), HackathonTeam.init(), ProjectSubmission.init(), init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const makeTeam = (name, code) => HackathonTeam.create({ form: form._id, name, nameKey: name.toLocaleLowerCase('tr-TR'), code,
  captain: { participant: new mongoose.Types.ObjectId(), email: `${code.toLowerCase()}@example.com` } });

beforeEach(async () => {
  await Promise.all([User, Form, HackathonTeam, JudgingConfig, Juror, Scorecard, JuryAuditLog, ProjectSubmission].map(model => model.deleteMany({})));
  const staff = async role => {
    const user = await User.create({ fullName: `${role} Kişi`, email: `${role.toLowerCase()}@pau.edu.tr`, passwordHash: 'x', role, isEmailVerified: true });
    return generateToken({ id: user._id, role });
  };
  [admin, organizer] = await Promise.all(['ADMIN', 'ORGANIZER'].map(staff));
  form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', status: 'PUBLISHED', fields: [] });
  teams = [await makeTeam('Alfa', 'AAAAAA'), await makeTeam('Beta', 'BBBBBB'), await makeTeam('Gama', 'CCCCCC')];
});

const call = (method, path, body, token = organizer) => {
  const req = request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};
const setup = async () => {
  const { revision, criteria, categories } = (await call('get', '/config')).body.data;
  const res = await call('put', '/config', { revision, criteria, categories, entries: teams.map((team, i) => ({ team: String(team._id), order: i + 1 })) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const juror = async (name) => (await call('post', '/jurors', { name }, admin)).body.data;
const permissions = (body) => request(app).put(`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${admin}`).send(body);
const live = async () => (await call('get', '/live')).body.data;
const presentation = async () => (await request(app).get('/api/v1/presentation')).body.data;

const vote = async (token, team, { submit = true } = {}) => {
  const me = (await request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${token}`)).body.data;
  const card = await Scorecard.findOne({ team: team._id, juror: me.juror.id });
  return request(app).put(`/api/v1/jury/entries/${team._id}/scorecard`).set('Authorization', `Bearer ${token}`).send({
    submit, nominations: [], generalComment: '', version: card?.version ?? 0, round: me.round,
    scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value: 4, comment: '' }))
  });
};
const name = (id) => teams.find(team => String(team._id) === String(id)).name;

test('evaluation is off by default; opening it fixes the order once and reopening keeps it', async () => {
  await setup();
  assert.equal((await permissions({})).status, 400);
  const before = await live();
  assert.equal(before.open, false);
  assert.deepEqual((await presentation()), { open: false, current: null, order: [] });

  assert.equal((await permissions({ projectEvaluation: true })).body.data.projectEvaluation, true);
  const opened = await live();
  assert.equal(opened.open, true);
  assert.deepEqual(opened.order.map(e => e.teamName).sort(), ['Alfa', 'Beta', 'Gama']);
  assert.deepEqual(opened.order.map(e => e.position), [1, 2, 3]);
  const order = opened.order.map(e => e.team);
  assert.ok(await JuryAuditLog.exists({ action: 'LIVE_ORDER_SHUFFLED' }));

  await permissions({ projectEvaluation: false });
  await permissions({ projectEvaluation: true });
  assert.deepEqual((await live()).order.map(e => e.team), order, 'reopening keeps the order');

  // Participants see the names and states, nothing else.
  const pub = await presentation();
  assert.equal(pub.open, true);
  assert.deepEqual(pub.order, opened.order.map(e => ({ position: e.position, name: e.teamName, state: 'WAITING' })));
});

test('the order follows the project upload time; teams without an upload follow in the manual order', async () => {
  await setup();
  const at = (minutes) => new Date(Date.UTC(2026, 10, 27, 15, minutes));
  const upload = (team, minutes) => ProjectSubmission.create({ form: form._id, team: team._id, repoUrl: `https://github.com/x/${team.name}`,
    repoKey: `x/${team.name.toLowerCase()}`, updatedBy: { participant: new mongoose.Types.ObjectId(), name: 'K' }, createdAt: at(minutes) });
  // Gama uploaded first, then Alfa; Beta has no upload.
  await upload(teams[2], 1);
  await upload(teams[0], 9);
  await permissions({ projectEvaluation: true });
  assert.deepEqual((await live()).order.map(e => e.teamName), ['Gama', 'Alfa', 'Beta']);
  // A late upload is picked up by "rebuild" before the first vote (ADMIN).
  await upload(teams[1], 0);
  assert.equal((await call('post', '/live/shuffle', {}, admin)).status, 200);
  assert.deepEqual((await live()).order.map(e => e.teamName), ['Beta', 'Gama', 'Alfa']);
});

test('on stage: jurors score only the team being voted; ending needs every active juror; a closed team is frozen', async () => {
  await setup();
  const ayse = await juror('Ayşe');
  const mehmet = await juror('Mehmet');
  await juror('Pasif Jüri').then(j => call('patch', `/jurors/${j.juror.id}`, { active: false }));
  await permissions({ projectEvaluation: true });
  const [first, second] = (await live()).order.map(e => teams.find(t => String(t._id) === e.team));

  // Nothing is open yet.
  const early = await vote(ayse.token, first);
  assert.equal(early.status, 423);
  assert.equal(early.body.code, 'VOTING_NOT_OPEN');

  const started = await call('post', '/live/start', { team: String(first._id) });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.data.current.teamName, first.name);
  assert.equal((await call('post', '/live/start', { team: String(second._id) })).body.code, 'VOTING_IN_PROGRESS');
  const pub = await presentation();
  assert.deepEqual(pub.current, { name: first.name, position: 1 });

  // The juror's list says what is open.
  const me = (await request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${ayse.token}`)).body.data;
  assert.equal(me.live.current.teamName, first.name);
  assert.deepEqual(me.entries.map(e => [e.teamName, e.live, e.writable]),
    (await live()).order.map(e => [e.teamName, e.team === String(first._id) ? 'VOTING' : 'WAITING', e.team === String(first._id)]));

  assert.equal((await vote(ayse.token, second)).body.code, 'VOTING_NOT_OPEN');
  assert.equal((await vote(ayse.token, first)).status, 200);

  // Mehmet has not voted: ending is blocked and says who is missing (the inactive juror does not count).
  const blocked = await call('post', '/live/end', {});
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, 'VOTES_MISSING');
  assert.match(blocked.body.message, /Mehmet/);
  assert.doesNotMatch(blocked.body.message, /Pasif|Ayşe/);
  const votes = (await live()).votes;
  assert.deepEqual(votes.map(v => [v.name, v.status, v.active]), [['Ayşe', 'SUBMITTED', true], ['Mehmet', 'NONE', true], ['Pasif Jüri', 'NONE', false]]);

  // A draft is not a vote.
  assert.equal((await vote(mehmet.token, first, { submit: false })).status, 200);
  assert.equal((await call('post', '/live/end', {})).body.code, 'VOTES_MISSING');
  assert.equal((await vote(mehmet.token, first)).status, 200);
  const ended = await call('post', '/live/end', {});
  assert.equal(ended.status, 200, JSON.stringify(ended.body));
  assert.equal(ended.body.data.current, null);
  assert.equal(ended.body.data.next.teamName, second.name);

  // Closed for good: no more changes, and it cannot be started again without a reopen.
  const late = await vote(ayse.token, first);
  assert.equal(late.status, 423);
  assert.equal(late.body.code, 'VOTING_CLOSED');
  assert.equal((await call('post', '/live/start', { team: String(first._id) })).body.code, 'VOTING_CLOSED');
  assert.equal((await presentation()).order.find(e => e.name === first.name).state, 'CLOSED');
  // Even with evaluation closed again (free scoring), a closed team stays frozen.
  await permissions({ projectEvaluation: false });
  assert.equal((await vote(ayse.token, first)).body.code, 'VOTING_CLOSED');
  assert.equal((await vote(ayse.token, second)).status, 200, 'free scoring for teams not yet voted');
});

test('a missing juror can be overridden with force; the log records who was missing', async () => {
  await setup();
  const ayse = await juror('Ayşe');
  await juror('Gelmeyen');
  await permissions({ projectEvaluation: true });
  const [first] = (await live()).order;
  await call('post', '/live/start', { team: first.team });
  await vote(ayse.token, teams.find(t => String(t._id) === first.team));
  const forced = await call('post', '/live/end', { force: true });
  assert.equal(forced.status, 200);
  const log = await JuryAuditLog.findOne({ action: 'LIVE_VOTING_ENDED' }).lean();
  assert.equal(log.details.forced, true);
  assert.deepEqual(log.details.missing, ['Gelmeyen']);
});

test('reopen and reshuffle are ADMIN only and guarded', async () => {
  await setup();
  await juror('Ayşe');
  await permissions({ projectEvaluation: true });
  assert.equal((await call('post', '/live/shuffle', {}, organizer)).status, 403);
  assert.equal((await call('post', '/live/shuffle', {}, admin)).status, 200);
  const [first] = (await live()).order;
  await call('post', '/live/start', { team: first.team });
  assert.equal((await call('post', '/live/shuffle', {}, admin)).body.code, 'LIVE_STARTED');
  await call('post', '/live/end', { force: true });
  assert.equal((await call('post', '/live/reopen', { team: first.team }, organizer)).status, 403);
  assert.equal((await call('post', '/live/reopen', { team: first.team }, admin)).status, 200);
  assert.equal((await live()).order.find(e => e.team === first.team).state, 'WAITING');
  assert.equal((await call('post', '/live/start', { team: first.team })).status, 200);
});

test('starting needs evaluation open and the jury unlocked; a reset starts the session over', async () => {
  await setup();
  assert.equal((await call('post', '/live/start', { team: String(teams[0]._id) })).body.code, 'EVALUATION_CLOSED');
  await permissions({ projectEvaluation: true });
  await call('put', '/lock', { locked: true });
  assert.equal((await call('post', '/live/start', { team: String(teams[0]._id) })).body.code, 'JURY_LOCKED');
  await call('put', '/lock', { locked: false }, admin);
  const [first] = (await live()).order;
  await call('post', '/live/start', { team: first.team });
  await call('post', '/live/end', { force: true });
  const order = (await live()).order.map(e => e.team);
  assert.equal((await call('post', '/scorecards/reset', { confirm: 'SIFIRLA' }, admin)).status, 200);
  const after = await live();
  assert.equal(after.current, null);
  assert.ok(after.order.every(e => e.state === 'WAITING'));
  assert.deepEqual(after.order.map(e => e.team), order, 'the order survives a rehearsal reset');
});

test('the juror sees the repo link the team added on the upload site when the setup has none', async () => {
  await setup();
  const ayse = await juror('Ayşe');
  await ProjectSubmission.create({ form: form._id, team: teams[1]._id, repoUrl: 'https://github.com/beta/proje', repoKey: 'beta/proje',
    updatedBy: { participant: new mongoose.Types.ObjectId(), name: 'Kaptan' } });
  const entry = (await request(app).get(`/api/v1/jury/entries/${teams[1]._id}`).set('Authorization', `Bearer ${ayse.token}`)).body.data.entry;
  assert.equal(entry.repoUrl, 'https://github.com/beta/proje');
  assert.equal(entry.writable, true);
  assert.equal(name(teams[1]._id), 'Beta');
});
