// Revizyon: participant voting (anonymous, once per team, not one's own), final = jury 70% + participants 30%,
// awards among the top 5 of the final ranking.
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
const Participant = require('../src/modules/participantAuth/models/Participant');
const JudgingConfig = require('../src/modules/jury/models/JudgingConfig');
const Juror = require('../src/modules/jury/models/Juror');
const Scorecard = require('../src/modules/jury/models/Scorecard');
const ParticipantVote = require('../src/modules/jury/models/ParticipantVote');
const JuryAuditLog = require('../src/modules/jury/models/JuryAuditLog');
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../src/modules/jury/defaults');
const { computeResults } = require('../src/modules/jury/services/computeResults');
const { init } = require('../src/modules/jury');
const { issueToken } = require('../src/modules/participantAuth/services/tokenService');
const { generateToken } = require('../src/utils/jwt');

let repl, admin, form, teams, people;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), HackathonTeam.init(), Participant.init(), init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const participant = async (email) => {
  const doc = await Participant.create({ email, emailVerifiedAt: new Date() });
  return { id: doc._id, token: issueToken(doc, 'EMAIL_OTP').token };
};

beforeEach(async () => {
  await Promise.all([User, Form, HackathonTeam, Participant, JudgingConfig, Juror, Scorecard, ParticipantVote, JuryAuditLog].map(m => m.deleteMany({})));
  const user = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'x', role: 'ADMIN', isEmailVerified: true });
  admin = generateToken({ id: user._id, role: 'ADMIN' });
  form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', status: 'PUBLISHED', fields: [] });
  people = {
    alfaCaptain: await participant('alfa@example.com'), alfaPending: await participant('alfa2@example.com'),
    betaCaptain: await participant('beta@example.com'), gamaCaptain: await participant('gama@example.com'),
    outsider: await participant('seyirci@example.com'), outTeam: await participant('dis@example.com')
  };
  const team = (name, code, captain, members = []) => HackathonTeam.create({ form: form._id, name, nameKey: name.toLocaleLowerCase('tr-TR'), code,
    captain: { participant: captain.id, email: `${code}@x.com` }, members: members.map(([p, status]) => ({ participant: p.id, email: `${code}m@x.com`, status })) });
  teams = {
    alfa: await team('Alfa', 'AAAAAA', people.alfaCaptain, [[people.alfaPending, 'PENDING']]),
    beta: await team('Beta', 'BBBBBB', people.betaCaptain),
    gama: await team('Gama', 'CCCCCC', people.gamaCaptain),
    // A team that is not competing: its members cannot vote.
    dis: await team('Dış', 'DDDDDD', people.outTeam)
  };
  const admin_ = (method, path, body) => request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${admin}`).send(body);
  const { revision, criteria, categories } = (await admin_('get', '/config')).body.data;
  await admin_('put', '/config', { revision, criteria, categories, entries: [teams.alfa, teams.beta, teams.gama].map((t, i) => ({ team: String(t._id), order: i + 1 })) });
  await request(app).put(`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${admin}`).send({ projectEvaluation: true });
});

const jury = (method, path, body) => request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${admin}`).send(body);
const voteApi = (who) => ({
  state: async () => (await request(app).get('/api/v1/forms/public/hackathon-katilim/my-application/vote').set('Authorization', `Bearer ${who.token}`)).body,
  cast: (team, value = 4) => request(app).post('/api/v1/forms/public/hackathon-katilim/my-application/vote').set('Authorization', `Bearer ${who.token}`)
    .send({ team: String(team._id), scores: Object.fromEntries(DEFAULT_CRITERIA.map(({ key }) => [key, value])) })
});

test('only members of other competing teams vote, once, only for the team on stage', async () => {
  const before = (await voteApi(people.betaCaptain).state()).data;
  assert.equal(before.reason, 'NO_VOTING');
  assert.equal(before.eligible, true);
  assert.equal(before.criteria.length, 7);

  assert.equal((await jury('post', '/live/start', { team: String(teams.alfa._id) })).status, 200);
  const state = (await voteApi(people.betaCaptain).state()).data;
  assert.deepEqual([state.canVote, state.current.teamName], [true, 'Alfa']);

  // Own team, not competing, pending member, outsider: no vote.
  assert.equal((await voteApi(people.alfaCaptain).state()).data.reason, 'OWN_TEAM');
  assert.equal((await voteApi(people.alfaCaptain).cast(teams.alfa)).status, 403);
  const why = { outsider: 'NO_TEAM', outTeam: 'NOT_COMPETING', alfaPending: 'PENDING' };
  for (const [name, expected] of Object.entries(why)) {
    assert.equal((await voteApi(people[name]).state()).data.notEligible, expected, name);
  }
  for (const who of [people.outsider, people.outTeam, people.alfaPending]) {
    assert.equal((await voteApi(who).state()).data.reason, 'NOT_ELIGIBLE');
    assert.equal((await voteApi(who).cast(teams.alfa)).status, 403);
  }
  // Only the team on stage.
  assert.equal((await voteApi(people.betaCaptain).cast(teams.gama)).status, 409);

  // Every criterion 1-5.
  const partial = await request(app).post('/api/v1/forms/public/hackathon-katilim/my-application/vote')
    .set('Authorization', `Bearer ${people.betaCaptain.token}`).send({ team: String(teams.alfa._id), scores: { technical: 5 } });
  assert.equal(partial.status, 400);

  assert.equal((await voteApi(people.betaCaptain).cast(teams.alfa, 5)).status, 200);
  const again = await voteApi(people.betaCaptain).cast(teams.alfa, 1);
  assert.equal(again.status, 409);
  assert.match(again.body.message, /zaten oy verdin/);
  assert.equal((await voteApi(people.betaCaptain).state()).data.reason, 'VOTED');
  assert.equal((await jury('get', '/live')).body.data.participantVotes, 1);

  // After the end: closed for participants too.
  await jury('post', '/live/end', { force: true });
  assert.equal((await voteApi(people.gamaCaptain).cast(teams.alfa)).status, 409);
});

test('the lock stops participant votes; a rehearsal reset deletes them', async () => {
  await jury('post', '/live/start', { team: String(teams.alfa._id) });
  await voteApi(people.betaCaptain).cast(teams.alfa);
  await jury('put', '/lock', { locked: true });
  assert.equal((await voteApi(people.gamaCaptain).state()).data.reason, 'LOCKED');
  assert.equal((await voteApi(people.gamaCaptain).cast(teams.alfa)).status, 423);
  await jury('put', '/lock', { locked: false });
  assert.equal(await ParticipantVote.countDocuments(), 1);
  assert.equal((await jury('post', '/scorecards/reset', { confirm: 'SIFIRLA' })).status, 200);
  assert.equal(await ParticipantVote.countDocuments(), 0);
});

test('results combine jury 70% and participants 30%, and never reveal who voted', async () => {
  const juror = (await jury('post', '/jurors', { name: 'Ayşe' })).body.data;
  await jury('post', '/live/start', { team: String(teams.alfa._id) });
  const me = (await request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${juror.token}`)).body.data;
  const card = await request(app).put(`/api/v1/jury/entries/${teams.alfa._id}/scorecard`).set('Authorization', `Bearer ${juror.token}`)
    .send({ submit: true, nominations: [], generalComment: '', version: 0, round: me.round, scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value: 5 })) });
  assert.equal(card.status, 200, JSON.stringify(card.body));
  await voteApi(people.betaCaptain).cast(teams.alfa, 1);   // 20 / 100
  await voteApi(people.gamaCaptain).cast(teams.alfa, 3);   // 60 / 100 → average 40
  const results = (await jury('get', '/results')).body.data;
  const alfa = results.ranking.find(t => t.teamName === 'Alfa');
  assert.equal(alfa.overall, 100);
  assert.equal(alfa.participantScore, 40);
  assert.equal(alfa.participantCount, 2);
  assert.equal(alfa.final, 0.7 * 100 + 0.3 * 40);
  const text = JSON.stringify(results);
  for (const who of Object.values(people)) assert.ok(!text.includes(String(who.id)), 'a voter id leaked into the results');
  const csv = (await jury('get', '/results.csv')).text;
  assert.match(csv, /Nihai Puan/);
  assert.match(csv, /82/);
});

test('computeResults: ranking by final score, 50 when nobody voted, awards only among the top 5', () => {
  const config = { criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES };
  const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((team, i) => ({ team, order: i + 1 }));
  const card = (team, value, nominations = []) => ({ team, status: 'SUBMITTED', nominations, scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value })) });
  const vote = (team, value) => ({ team, scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value })) });
  // Jury: a 80, b 76 (a ahead). Participants: a 20, b 100 → final a 62, b 83.2: b first.
  const result = computeResults(config, entries,
    [card('a', 4), card('b', 3.8), card('c', 3), card('d', 3), card('e', 3), card('f', 2, ['wow'])],
    [vote('a', 1), vote('b', 5)]);
  const by = Object.fromEntries(result.ranking.map(t => [t.team, t]));
  assert.equal(result.ranking[0].team, 'b');
  assert.ok(Math.abs(by.a.final - 62) < 1e-9 && Math.abs(by.b.final - 83.2) < 1e-9);
  // No participant vote: the participant part counts as 50.
  assert.equal(by.c.participantScore, null);
  assert.equal(by.c.participantScoreUsed, 50);
  assert.ok(Math.abs(by.c.final - (0.7 * by.c.overall + 0.3 * 50)) < 1e-9);
  // f is 6th: its "wow" nomination cannot win; the jury decides.
  assert.ok(!result.awardPool.includes('f'));
  const wow = result.categories.find(c => c.key === 'wow');
  assert.deepEqual([wow.winner, wow.reason], [null, 'NO_ELIGIBLE_NOMINEE']);
});
