// Juror endpoints: link auth, own card only, submit rules, lock and reset protection.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const JudgingConfig = require('../src/modules/jury/models/JudgingConfig');
const Juror = require('../src/modules/jury/models/Juror');
const Scorecard = require('../src/modules/jury/models/Scorecard');
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../src/modules/jury/defaults');
const { issueToken } = require('../src/modules/jury/services/tokenService');
const { init } = require('../src/modules/jury');

let repl, alice, bob, teamA, teamB;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await init();
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const addJuror = async (name, active = true) => {
  const { token, tokenHash } = issueToken();
  const juror = await Juror.create({ name, tokenHash, active });
  const as = method => path => request(app)[method](`/api/v1/jury${path}`).set('Authorization', `Bearer ${token}`);
  return { id: String(juror._id), token, get: as('get'), put: as('put') };
};
beforeEach(async () => {
  await Promise.all([JudgingConfig, Juror, Scorecard].map(model => model.deleteMany({})));
  teamA = String(new mongoose.Types.ObjectId());
  teamB = String(new mongoose.Types.ObjectId());
  await JudgingConfig.create({ criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES, entries: [
    { team: teamB, teamName: 'İkinci Takım', order: 2 },
    { team: teamA, teamName: 'Çılgın Kodcular', order: 1, projectName: 'Proje A', repoUrl: 'https://example.com/repo' }
  ] });
  [alice, bob] = await Promise.all([addJuror('Ayşe'), addJuror('Burak')]);
});

const scores = (value = 4, skip = []) => DEFAULT_CRITERIA.filter(({ key }) => !skip.includes(key)).map(({ key }) => ({ criterion: key, value, comment: '' }));
const body = (changes = {}) => ({ scores: scores(), nominations: [], generalComment: '', submit: false, round: 1, version: 0, ...changes });
const save = (juror, team, changes) => juror.put(`/entries/${team}/scorecard`).send(body(changes));
const card = (juror, team) => Scorecard.findOne({ juror: juror.id, team }).lean();

test('missing, malformed, unknown, inactive and revoked tokens get 401', async () => {
  const inactive = await addJuror('Pasif', false);
  const headers = [undefined, 'Bearer kisa', `Bearer ${issueToken().token}`, `Bearer ${inactive.token}`, `Basic ${alice.token}`];
  for (const header of headers) {
    const call = request(app).get('/api/v1/jury/me');
    if (header) call.set('Authorization', header);
    const res = await call;
    assert.equal(res.status, 401, header);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'JURY_LINK_INVALID');
  }
  await Juror.updateOne({ _id: alice.id }, { tokenHash: issueToken().tokenHash });
  assert.equal((await alice.get('/me')).status, 401);
});

test('an inactive juror cannot write either', async () => {
  await Juror.updateOne({ _id: alice.id }, { active: false });
  assert.equal((await save(alice, teamA)).status, 401);
  assert.equal(await Scorecard.countDocuments(), 0);
});

test('me returns the setup in presentation order and records lastSeenAt', async () => {
  await JudgingConfig.updateOne({}, { $set: { 'categories.1.active': false } });
  const res = await alice.get('/me');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  const { data } = res.body;
  assert.deepEqual(data.juror, { id: alice.id, name: 'Ayşe' });
  assert.equal(data.locked, false);
  assert.equal(data.criteria.length, 7);
  assert.deepEqual(data.categories.map(category => category.key), ['campusHero', 'demoGod', 'pilot', 'dreamTeam']);
  assert.deepEqual(data.entries.map(entry => [entry.team, entry.status]), [[teamA, 'NONE'], [teamB, 'NONE']]);
  assert.ok((await Juror.findById(alice.id)).lastSeenAt);
});

test('responses never contain the token or its hash', async () => {
  const text = JSON.stringify((await alice.get('/me')).body);
  assert.ok(!text.includes('tokenHash'));
  assert.ok(!text.includes(alice.token));
});

test('a juror sees only their own cards and statuses', async () => {
  assert.equal((await save(bob, teamA, { submit: true, generalComment: 'Burak gizli yorum' })).status, 200);
  const me = (await alice.get('/me')).body.data;
  assert.ok(me.entries.every(entry => entry.status === 'NONE'));
  const view = await alice.get(`/entries/${teamA}`);
  assert.equal(view.body.data.scorecard, null);
  assert.ok(!JSON.stringify(view.body).includes('Burak'));
  assert.equal((await bob.get('/me')).body.data.entries[0].status, 'SUBMITTED');
});

test('a juror can only ever write their own card', async () => {
  await save(bob, teamA, { scores: scores(5), submit: true });
  const res = await save(alice, teamA, { scores: scores(1), juror: bob.id, submit: true });
  assert.equal(res.status, 200);
  assert.ok((await card(bob, teamA)).scores.every(score => score.value === 5));
  assert.ok((await card(alice, teamA)).scores.every(score => score.value === 1));
});

test('teams without any link or project name can still be scored and submitted', async () => {
  const { entry } = (await alice.get(`/entries/${teamB}`)).body.data;
  assert.deepEqual([entry.projectName, entry.repoUrl, entry.demoUrl, entry.presentationUrl], ['', '', '', '']);
  assert.equal((await save(alice, teamB, { submit: true })).status, 200);
});

test('a draft may be incomplete and is stored with every criterion', async () => {
  const res = await save(alice, teamA, { scores: [{ criterion: 'demo', value: 3, comment: 'Akıcıydı ' }] });
  assert.equal(res.status, 200);
  const { scorecard } = res.body.data;
  assert.equal(scorecard.status, 'DRAFT');
  assert.equal(scorecard.version, 1);
  assert.equal(scorecard.scores.length, 7);
  assert.deepEqual(scorecard.scores.find(score => score.criterion === 'demo'), { criterion: 'demo', value: 3, comment: 'Akıcıydı ' });
  assert.equal((await alice.get('/me')).body.data.entries[0].status, 'DRAFT');
});

test('submit needs every criterion and names the missing ones', async () => {
  const res = await save(alice, teamA, { scores: scores(4, ['demo', 'ux']), submit: true });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'SCORES_MISSING');
  assert.match(res.body.message, /Demo ve sunum/);
  assert.match(res.body.message, /Kullanıcı deneyimi/);
  const empty = await save(alice, teamA, { scores: scores(null), submit: true });
  assert.equal(empty.status, 400);
  assert.equal(await Scorecard.countDocuments(), 0);
});

test('a submitted card can be submitted again with changes', async () => {
  await save(alice, teamA, { submit: true });
  const res = await save(alice, teamA, { scores: scores(2), submit: true, version: 1 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.scorecard.status, 'SUBMITTED');
  assert.ok(res.body.data.scorecard.submittedAt);
  assert.ok((await card(alice, teamA)).scores.every(score => score.value === 2));
});

test('autosave cannot change a submitted card', async () => {
  await save(alice, teamA, { submit: true });
  for (const version of [0, 1]) {
    const res = await save(alice, teamA, { scores: scores(1), version });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'SCORECARD_SUBMITTED');
  }
  const stored = await card(alice, teamA);
  assert.equal(stored.status, 'SUBMITTED');
  assert.ok(stored.scores.every(score => score.value === 4));
});

test('an outdated version cannot overwrite a newer save', async () => {
  await save(alice, teamA, { scores: scores(3) });
  const res = await save(alice, teamA, { scores: scores(1) });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'SCORECARD_CONFLICT');
  assert.ok((await card(alice, teamA)).scores.every(score => score.value === 3));
});

test('simultaneous first saves of one card create exactly one document', async () => {
  const results = await Promise.all([1, 2, 3, 4, 5].map(value => save(alice, teamA, { scores: scores(value) })));
  assert.deepEqual(results.map(res => res.status).sort(), [200, 409, 409, 409, 409]);
  assert.equal(await Scorecard.countDocuments(), 1);
});

test('many jurors saving at the same moment all succeed', async () => {
  const jurors = await Promise.all(Array.from({ length: 12 }, (_, i) => addJuror(`Jüri ${i}`)));
  const results = await Promise.all(jurors.flatMap(juror => [save(juror, teamA), save(juror, teamB)]));
  assert.deepEqual(results.map(res => res.status), Array(24).fill(200));
  assert.equal(await Scorecard.countDocuments(), 24);
});

test('while locked every write is refused and reading still works', async () => {
  await save(alice, teamA);
  await JudgingConfig.updateOne({}, { locked: true });
  for (const submit of [false, true]) {
    const res = await save(alice, teamA, { scores: scores(1), submit, version: 1 });
    assert.equal(res.status, 423);
    assert.equal(res.body.code, 'JURY_LOCKED');
  }
  const view = await alice.get(`/entries/${teamA}`);
  assert.equal(view.body.data.locked, true);
  assert.ok(view.body.data.scorecard.scores.every(score => score.value === 4));
});

test('a save from before a reset is refused', async () => {
  await JudgingConfig.updateOne({}, { round: 2 });
  const res = await save(alice, teamA, { submit: true });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'JURY_RESET');
  assert.equal(await Scorecard.countDocuments(), 0);
});

test('teams that are not entries give 404', async () => {
  for (const team of [String(new mongoose.Types.ObjectId()), 'bozuk-id']) {
    assert.equal((await alice.get(`/entries/${team}`)).status, 404);
    assert.equal((await save(alice, team)).status, 404);
  }
});

test('unknown keys are rejected', async () => {
  for (const changes of [{ scores: [{ criterion: 'luck', value: 3 }] }, { nominations: ['yok'] }]) {
    const res = await save(alice, teamA, changes);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'UNKNOWN_KEY');
  }
});

test('a nomination for a deactivated category does not break saving', async () => {
  await save(alice, teamA, { nominations: ['wow'] });
  await JudgingConfig.updateOne({}, { $set: { 'categories.1.active': false } });
  assert.equal((await save(alice, teamA, { nominations: ['wow'], submit: true, version: 1 })).status, 200);
});

test('scores must be integers 1-5; types, duplicates and lengths are checked', async () => {
  const one = score => ({ scores: [{ criterion: 'demo', ...score }] });
  const cases = [
    ...[0, 6, 2.5, '4', true, [3]].map(value => one({ value })),
    one({ value: 3, comment: 'x'.repeat(1001) }),
    one({ value: 3, comment: { $ne: null } }),
    { scores: [{ criterion: 'demo', value: 3 }, { criterion: 'demo', value: 4 }] },
    { scores: [{ criterion: { $gt: '' }, value: 3 }] },
    { scores: 'hepsi 5' },
    { generalComment: 'x'.repeat(2001) },
    { nominations: ['wow', 'wow'] },
    { nominations: [{ $ne: null }] },
    { submit: 'true' },
    { round: '1' },
    { version: -1 }
  ];
  for (const changes of cases) assert.equal((await save(alice, teamA, changes)).status, 400, JSON.stringify(changes).slice(0, 100));
  assert.equal(await Scorecard.countDocuments(), 0);
  const edge = await save(alice, teamA, { ...one({ value: 5, comment: 'x'.repeat(1000) }), generalComment: 'y'.repeat(2000) });
  assert.equal(edge.status, 200);
});
