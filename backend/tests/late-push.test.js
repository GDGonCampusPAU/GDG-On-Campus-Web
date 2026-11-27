// Late-push check: the closing moment of project upload is the deadline; GitHub's push times
// (repository activity), not commit dates, decide whether a team pushed after it.
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
const HackathonTeam = require('../src/models/HackathonTeam');
const ProjectSubmission = require('../src/modules/projectUpload/models/ProjectSubmission');
const JudgingConfig = require('../src/modules/jury/models/JudgingConfig');
const { createLatePushChecker } = require('../src/modules/projectUpload/services/latePushService');
const { init } = require('../src/modules/jury');
const { generateToken } = require('../src/utils/jwt');

let repl, admin, organizer, form, teams;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), HackathonTeam.init(), ProjectSubmission.init(), init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const START = '2026-11-27T09:00:00+03:00';
const DEADLINE = new Date('2026-11-27T15:00:00Z');
const at = (iso) => new Date(iso).toISOString();

beforeEach(async () => {
  await Promise.all([User, Form, EventPage, HackathonTeam, ProjectSubmission, JudgingConfig].map(m => m.deleteMany({})));
  const staff = async role => {
    const user = await User.create({ fullName: role, email: `${role.toLowerCase()}@pau.edu.tr`, passwordHash: 'x', role, isEmailVerified: true });
    return generateToken({ id: user._id, role });
  };
  [admin, organizer] = [await staff('ADMIN'), await staff('ORGANIZER')];
  form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', status: 'PUBLISHED', fields: [] });
  await EventPage.collection.insertOne({ _id: 'hackathon', formSlug: 'hackathon-katilim', event: { startsAt: START } });
  const make = (name, code) => HackathonTeam.create({ form: form._id, name, nameKey: name.toLocaleLowerCase('tr-TR'), code,
    captain: { participant: new mongoose.Types.ObjectId(), email: `${code}@x.com` } });
  teams = { gec: await make('Geç Kalan', 'AAAAAA'), zorla: await make('Zorla İten', 'BBBBBB'), zamaninda: await make('Zamanında', 'CCCCCC'),
    linksiz: await make('Linksiz', 'DDDDDD'), silinen: await make('Silinen', 'EEEEEE'), elle: await make('Elle Girilen', 'FFFFFF') };
  const link = (team, repo) => ProjectSubmission.create({ form: form._id, team: team._id, repoUrl: `https://github.com/${repo}`, repoKey: repo.toLowerCase(),
    updatedBy: { participant: new mongoose.Types.ObjectId(), name: 'Üye' } });
  await link(teams.gec, 'gec/repo');
  await link(teams.zorla, 'zorla/repo');
  await link(teams.zamaninda, 'zaman/repo');
  await link(teams.silinen, 'silinen/repo');
  await link(teams.elle, 'yuklenen/repo');
  await JudgingConfig.collection.insertOne({ _id: JudgingConfig.CONFIG_ID, criteria: [], categories: [], locked: false, round: 1, revision: 1,
    entries: Object.values(teams).map((t, i) => ({ team: t._id, order: i + 1, repoUrl: t === teams.elle ? 'https://github.com/elle/girilen' : '' })) });
});

/** Fake GitHub activity API. */
const push = (timestamp, { type = 'push', actor = 'uye', before = 'a'.repeat(40), after = 'b'.repeat(40) } = {}) =>
  ({ id: Math.random(), activity_type: type, timestamp, actor: { login: actor }, ref: 'refs/heads/main', before, after });
const ACTIVITY = {
  'gec/repo': [push('2026-11-27T15:20:00Z'), push('2026-11-27T14:00:00Z'), push('2026-11-26T10:00:00Z', { before: '0'.repeat(40) })],
  'zorla/repo': [push('2026-11-27T15:01:00Z', { type: 'force_push' }), push('2026-11-27T12:00:00Z')],
  'zaman/repo': [push('2026-11-27T16:00:00Z', { type: 'branch_deletion' }), push('2026-11-27T14:59:59Z')],
  'elle/girilen': [push('2026-11-27T13:00:00Z')],
  'yuklenen/repo': [push('2026-11-27T18:00:00Z')]
};
const fakeFetch = (calls = []) => async (url) => {
  calls.push(url);
  const repo = /repos\/([^/]+\/[^/]+)\/activity/.exec(url)[1].toLowerCase();
  if (repo === 'silinen/repo') return new Response('{"message":"Not Found"}', { status: 404 });
  return new Response(JSON.stringify(ACTIVITY[repo] || []), { status: 200, headers: { 'content-type': 'application/json' } });
};
const close = () => request(app).put(`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${admin}`).send({ projectUpload: false });
const open = () => request(app).put(`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${admin}`).send({ projectUpload: true });

test('closing project upload records the moment; closing again keeps it; opening clears it', async () => {
  const before = Date.now();
  const closed = (await close()).body.data;
  assert.equal(closed.projectUpload, false);
  const first = Date.parse(closed.projectUploadClosedAt);
  assert.ok(first >= before && first <= Date.now());
  await new Promise(r => setTimeout(r, 15));
  assert.equal((await close()).body.data.projectUploadClosedAt, closed.projectUploadClosedAt, 'a second close does not move the deadline');
  assert.equal((await open()).body.data.projectUploadClosedAt, null);
  assert.equal((await Form.findById(form._id).lean()).settings.projectUploadClosedAt, null);
});

test('report: late, force-pushed, on time, no link, repo gone; admin link wins; early pushes counted', async () => {
  await Form.updateOne({ _id: form._id }, { $set: { 'settings.projectUploadEnabled': false, 'settings.projectUploadClosedAt': DEADLINE } });
  const calls = [];
  const checker = createLatePushChecker({ fetch: fakeFetch(calls), token: 't' });
  const result = await checker.report();
  assert.equal(result.deadline, DEADLINE.toISOString());
  assert.equal(result.deadlineSource, 'CLOSED_AT');
  const by = Object.fromEntries(result.teams.map(t => [t.teamName, t]));
  assert.deepEqual(result.teams.map(t => t.teamName), ['Geç Kalan', 'Zorla İten', 'Zamanında', 'Linksiz', 'Silinen', 'Elle Girilen']);

  assert.equal(by['Geç Kalan'].status, 'LATE');
  assert.equal(by['Geç Kalan'].lateCount, 1);
  assert.equal(by['Geç Kalan'].latePushes[0].at, at('2026-11-27T15:20:00Z'));
  assert.equal(by['Geç Kalan'].latePushes[0].url, `https://github.com/gec/repo/compare/${'a'.repeat(12)}...${'b'.repeat(12)}`);
  assert.equal(by['Geç Kalan'].earlyCount, 1, 'push before the event start');
  assert.equal(by['Zorla İten'].status, 'LATE');
  assert.equal(by['Zorla İten'].forcedLate, true);
  assert.equal(by['Zamanında'].status, 'ON_TIME', 'a deleted branch after the deadline is not code');
  assert.equal(by['Linksiz'].status, 'NO_REPO');
  assert.equal(by['Silinen'].status, 'REPO_GONE');
  // The link typed by the admin on "Yarışan takımlar" is the one the jury sees: it is checked.
  assert.equal(by['Elle Girilen'].repoUrl, 'https://github.com/elle/girilen');
  assert.equal(by['Elle Girilen'].status, 'ON_TIME');
  assert.deepEqual(result.summary, { late: 2, forced: 1, unavailable: 1, noRepo: 1 });

  // Cached: a second run does not ask GitHub again.
  const count = calls.length;
  await checker.report();
  assert.equal(calls.length, count);
});

test('a custom deadline; no deadline while uploading is open; a bad deadline; GitHub down', async () => {
  const checker = createLatePushChecker({ fetch: fakeFetch(), token: '' });
  const openReport = await checker.report();
  assert.deepEqual([openReport.deadline, openReport.deadlineSource, openReport.uploadOpen], [null, 'NONE', true]);
  assert.ok(openReport.teams.every(t => t.status !== 'LATE'));
  assert.equal(openReport.teams.find(t => t.teamName === 'Geç Kalan').lastPushAt, at('2026-11-27T15:20:00Z'));

  const custom = await checker.report({ deadline: '2026-11-27T13:30:00Z' });
  assert.equal(custom.deadlineSource, 'CUSTOM');
  assert.equal(custom.teams.find(t => t.teamName === 'Geç Kalan').lateCount, 2);
  await assert.rejects(checker.report({ deadline: 'yarın' }), { status: 400, juryCode: 'INVALID_DEADLINE' });

  const down = createLatePushChecker({ fetch: async () => { throw new Error('ağ yok'); } });
  const result = await down.report({ deadline: DEADLINE.toISOString() });
  assert.ok(result.teams.filter(t => t.status !== 'NO_REPO').every(t => t.status === 'UNAVAILABLE'));
});

test('long histories: follows GitHub pages up to the limit and says when older pushes were not read', async () => {
  let pages = 0;
  const paged = async (url) => {
    pages += 1;
    const page = Number(new URL(url).searchParams.get('after') || 0);
    return new Response(JSON.stringify([push(`2026-11-27T16:0${page}:00Z`)]), { status: 200,
      headers: { 'content-type': 'application/json', link: `<https://api.github.com/x?after=${page + 1}>; rel="next"` } });
  };
  const checker = createLatePushChecker({ fetch: paged });
  const row = (await checker.report({ deadline: DEADLINE.toISOString() })).teams.find(t => t.teamName === 'Geç Kalan');
  assert.equal(row.lateCount, 3);
  assert.equal(row.truncated, true);
  assert.ok(pages >= 3);
});

test('route: staff only, ORGANIZER may run it', async () => {
  assert.equal((await request(app).get('/api/v1/jury-admin/late-pushes')).status, 401);
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    const res = await request(app).get('/api/v1/jury-admin/late-pushes').set('Authorization', `Bearer ${organizer}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.teams.length, 6);
    const bad = await request(app).get('/api/v1/jury-admin/late-pushes?deadline=olmaz').set('Authorization', `Bearer ${organizer}`);
    assert.deepEqual([bad.status, bad.body.code], [400, 'INVALID_DEADLINE']);
  } finally {
    globalThis.fetch = original;
  }
});
