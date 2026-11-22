// Links and voiding are ADMIN-only, and every staff action on the jury system is recorded.
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
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../src/modules/jury/defaults');
const { issueToken } = require('../src/modules/jury/services/tokenService');
const { init } = require('../src/modules/jury');
const { generateToken } = require('../src/utils/jwt');

let repl;
let admin;
let organizer;
let forgedRole;
let alice;
let bob;
let team;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await init();
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

beforeEach(async () => {
  await Promise.all([User, Form, HackathonTeam, JudgingConfig, Juror, Scorecard].map(model => model.deleteMany({})));
  await mongoose.connection.collection('juryauditlogs').deleteMany({});
  const adminUser = await User.create({ fullName: 'Ada Admin', email: 'admin@pau.edu.tr', passwordHash: 'x', role: 'ADMIN', isEmailVerified: true });
  const organizerUser = await User.create({ fullName: 'Oya Organizatör', email: 'organizer@pau.edu.tr', passwordHash: 'x', role: 'ORGANIZER', isEmailVerified: true });
  admin = generateToken({ id: adminUser._id, role: 'ADMIN' });
  organizer = generateToken({ id: organizerUser._id, role: 'ORGANIZER' });
  forgedRole = generateToken({ id: organizerUser._id, role: 'ADMIN' }); // role must come from the database
  const form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', fields: [] });
  team = await HackathonTeam.create({ form: form._id, name: 'Kod Kervanı', nameKey: 'kod kervanı', code: 'AUTHAA',
    captain: { participant: new mongoose.Types.ObjectId(), email: 'kaptan@example.com' } });
  await JudgingConfig.create({ criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES, entries: [{ team: team._id, teamName: team.name, order: 1 }] });
  const juror = async name => {
    const { token, tokenHash } = issueToken();
    const doc = await Juror.create({ name, tokenHash });
    return { id: String(doc._id), token };
  };
  [alice, bob] = [await juror('Ayşe'), await juror('Burak')];
});

const call = (method, path, body, token = admin) => {
  const req = request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};
const asJuror = (juror, method, path, body) => {
  const req = request(app)[method](`/api/v1/jury${path}`).set('Authorization', `Bearer ${juror.token}`);
  return body === undefined ? req : req.send(body);
};
const save = (juror, { value = 4, submit = true, version = 0 } = {}) => asJuror(juror, 'put', `/entries/${team._id}/scorecard`, {
  submit, round: 1, version, nominations: submit ? ['wow'] : [], generalComment: 'Yorum',
  scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value, comment: '' }))
});
const voidCard = (juror, body = { reason: 'Yanlış takım puanlandı', version: 1 }, token = admin) =>
  call('post', `/jurors/${juror.id}/scorecards/${team._id}/void`, body, token);
const log = async (token = admin) => (await call('get', '/log', undefined, token)).body.data.items;
const cardOf = juror => Scorecard.findOne({ juror: juror.id }).lean();

test('an ORGANIZER cannot create a link', async () => {
  for (const token of [organizer, forgedRole]) {
    const res = await call('post', '/jurors', { name: 'Sahte Jüri' }, token);
    assert.equal(res.status, 403);
    assert.equal(res.body.data, undefined);
  }
  assert.equal(await Juror.countDocuments(), 2);
});

test('an ORGANIZER cannot renew a link, so cannot score as a juror', async () => {
  for (const token of [organizer, forgedRole]) {
    const res = await call('post', `/jurors/${alice.id}/regenerate`, undefined, token);
    assert.equal(res.status, 403);
    assert.equal(res.body.data, undefined);
  }
  assert.equal((await asJuror(alice, 'get', '/me')).status, 200);
});

test('creating and renewing a link records who, whom and when, never the token', async () => {
  const created = await call('post', '/jurors', { name: 'Ceren' });
  assert.equal(created.status, 201);
  const renewed = await call('post', `/jurors/${alice.id}/regenerate`);
  assert.equal(renewed.status, 200);

  const items = await log(organizer);
  assert.deepEqual(items.map(item => [item.action, item.target]), [['LINK_REGENERATED', 'Ayşe'], ['JUROR_CREATED', 'Ceren']]);
  assert.deepEqual([items[0].actor.name, items[0].actor.email, items[0].actor.role], ['Ada Admin', 'admin@pau.edu.tr', 'ADMIN']);
  assert.ok(items[0].at);
  const raw = JSON.stringify(await mongoose.connection.collection('juryauditlogs').find().toArray());
  for (const secret of [created.body.data.token, renewed.body.data.token, 'tokenHash']) assert.ok(!raw.includes(secret));
});

test('every other staff change is recorded with the acting person', async () => {
  const { data: config } = (await call('get', '/config', undefined, organizer)).body;
  const criteria = config.criteria.map((item, i) => (i === 0 ? { ...item, weight: 30 } : i === 1 ? { ...item, weight: 10 } : item));
  assert.equal((await call('put', '/config', { ...config, criteria, entries: [] }, organizer)).status, 200);
  await call('patch', `/jurors/${bob.id}`, { name: 'Burak Şahin' }, organizer);
  await call('patch', `/jurors/${bob.id}`, { active: false }, organizer);
  await call('patch', `/jurors/${bob.id}`, { active: true }, organizer);
  await call('put', '/lock', { locked: true }, organizer);
  await call('put', '/lock', { locked: false }, organizer);
  await call('post', '/scorecards/reset', { confirm: 'SIFIRLA' });

  const items = (await log()).reverse();
  assert.deepEqual(items.map(item => item.action),
    ['CONFIG_UPDATED', 'JUROR_RENAMED', 'JUROR_DEACTIVATED', 'JUROR_ACTIVATED', 'LOCKED', 'UNLOCKED', 'SCORECARDS_RESET']);
  const { changes } = items[0].details;
  assert.deepEqual(changes.criteria.edited[0], { name: DEFAULT_CRITERIA[0].label, fields: { weight: [25, 30] } });
  assert.deepEqual(changes.entries.removed, ['Kod Kervanı']);
  assert.deepEqual(items[1].details, { from: 'Burak', to: 'Burak Şahin' });
  assert.deepEqual(items.slice(0, 6).map(item => item.actor.role), Array(6).fill('ORGANIZER'));
  assert.deepEqual(items[6].details, { deleted: 0, round: 2 });
});

test('requests that change nothing or fail leave no entry', async () => {
  const { data: config } = (await call('get', '/config')).body;
  await call('put', '/config', config);
  await call('put', '/lock', { locked: false });
  await call('patch', `/jurors/${bob.id}`, { active: true });
  await call('post', '/jurors', { name: '' });
  await call('post', '/jurors', { name: 'Sahte' }, organizer);
  assert.deepEqual(await log(), []);
});

test('an action that cannot be recorded does not happen', async () => {
  const JuryAuditLog = require('../src/modules/jury/models/JuryAuditLog');
  const original = JuryAuditLog.create;
  JuryAuditLog.create = async () => { throw new Error('log unavailable'); };
  try {
    assert.equal((await call('post', `/jurors/${alice.id}/regenerate`)).status, 500);
    assert.equal((await call('put', '/lock', { locked: true })).status, 500);
    assert.equal((await call('post', '/jurors', { name: 'Kayıtsız' })).status, 500);
  } finally {
    JuryAuditLog.create = original;
  }
  assert.equal((await asJuror(alice, 'get', '/me')).status, 200);
  assert.equal((await JudgingConfig.findById('hackathon')).locked, false);
  assert.equal(await Juror.countDocuments(), 2);
});

test('the log has no way to edit or delete and needs staff', async () => {
  for (const method of ['post', 'put', 'patch', 'delete']) assert.equal((await call(method, '/log', {})).status, 404, method);
  assert.equal((await asJuror(alice, 'get', '/log')).status, 404);
  assert.equal((await call('get', '/log', undefined, alice.token)).status, 401);
});

test('the log is newest first and paged', async () => {
  for (let i = 0; i < 55; i += 1) await call('patch', `/jurors/${bob.id}`, { name: `Ad ${i}` });
  const first = (await call('get', '/log')).body.data;
  assert.equal(first.items.length, 50);
  assert.equal(first.items[0].details.to, 'Ad 54');
  const second = (await call('get', `/log?before=${first.next}`)).body.data;
  assert.equal(second.items.length, 5);
  assert.equal(second.next, null);
  assert.equal((await call('get', '/log?before=bozuk')).status, 400);
});

test('the log survives a score reset', async () => {
  await save(alice);
  assert.equal((await voidCard(alice)).status, 200);
  await call('post', '/scorecards/reset', { confirm: 'SIFIRLA' });
  assert.deepEqual((await log()).map(item => item.action), ['SCORECARDS_RESET', 'SCORECARD_VOIDED']);
});

test('only an ADMIN can void a card', async () => {
  await save(alice);
  for (const token of [organizer, forgedRole]) assert.equal((await voidCard(alice, undefined, token)).status, 403);
  assert.equal((await cardOf(alice)).status, 'SUBMITTED');
});

test('voiding needs a reason', async () => {
  await save(alice);
  for (const reason of [undefined, '', '   ', 5, { $ne: null }, 'x'.repeat(501)]) {
    assert.equal((await voidCard(alice, { reason, version: 1 })).status, 400, JSON.stringify(reason)?.slice(0, 20));
  }
  assert.equal((await cardOf(alice)).status, 'SUBMITTED');
  assert.deepEqual(await log(), []);
});

test('voiding removes exactly that card from the results and the CSV', async () => {
  await save(alice, { value: 5 });
  await save(bob, { value: 2 });
  assert.equal((await voidCard(alice)).status, 200);

  const [result] = (await call('get', '/results')).body.data.ranking;
  assert.deepEqual([result.overall, result.judgeCount], [40, 1]);
  assert.deepEqual(result.cards.map(card => card.juror.name), ['Burak']);
  assert.deepEqual(result.nominationCounts, { wow: 1 });
  assert.deepEqual(result.missingJurors, [{ name: 'Ayşe', hasDraft: true, voided: true }]);
  assert.ok(!(await call('get', '/results.csv')).text.includes('"Ayşe"'));
});

test('the record keeps the reason and the voided scores', async () => {
  await save(alice, { value: 5 });
  await voidCard(alice);
  const [entry] = await log();
  assert.equal(entry.action, 'SCORECARD_VOIDED');
  assert.equal(entry.target, 'Ayşe · Kod Kervanı');
  assert.equal(entry.details.reason, 'Yanlış takım puanlandı');
  assert.equal(entry.details.card.total, 100);
  assert.equal(entry.details.card.scores.length, 7);
  assert.deepEqual(entry.details.card.nominations, ['wow']);
});

test('the juror sees the void without the internal reason and can score again', async () => {
  await save(alice);
  await voidCard(alice);
  assert.equal((await asJuror(alice, 'get', '/me')).body.data.entries[0].status, 'DRAFT');
  const view = (await asJuror(alice, 'get', `/entries/${team._id}`)).body;
  const { scorecard } = view.data;
  assert.ok(scorecard.voidedAt);
  assert.deepEqual([scorecard.status, scorecard.version, scorecard.generalComment], ['DRAFT', 2, '']);
  assert.ok(scorecard.scores.every(score => score.value === null));
  assert.ok(!JSON.stringify(view).includes('Yanlış takım'));

  assert.ok((await save(alice, { submit: false, version: 2 })).body.data.scorecard.voidedAt);
  const again = await save(alice, { version: 3 });
  assert.equal(again.body.data.scorecard.status, 'SUBMITTED');
  assert.equal(again.body.data.scorecard.voidedAt, null);
});

test('a device still holding the old card cannot undo the void', async () => {
  await save(alice);
  await voidCard(alice);
  assert.equal((await save(alice, { version: 1 })).body.code, 'SCORECARD_CONFLICT');
  assert.equal((await cardOf(alice)).status, 'DRAFT');
});

test('only the version the admin looked at is voided', async () => {
  await save(alice);
  await save(alice, { value: 2, version: 1 });
  const res = await voidCard(alice);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'SCORECARD_CONFLICT');
  assert.equal((await cardOf(alice)).status, 'SUBMITTED');
});

test('a void and a resubmit at the same moment cannot both win', async () => {
  await save(alice);
  const [voided, resubmitted] = await Promise.all([voidCard(alice), save(alice, { value: 1, version: 1 })]);
  assert.deepEqual([voided.status, resubmitted.status].sort(), [200, 409]);
  assert.equal((await cardOf(alice)).status, voided.status === 200 ? 'DRAFT' : 'SUBMITTED');
});

test('voiding is refused for drafts, unknown cards and while locked', async () => {
  await save(alice, { submit: false });
  assert.equal((await voidCard(alice)).body.code, 'SCORECARD_NOT_SUBMITTED');
  assert.equal((await voidCard(bob)).status, 404);
  assert.equal((await call('post', `/jurors/bozuk/scorecards/${team._id}/void`, { reason: 'x', version: 1 })).status, 404);
  await save(bob);
  await call('put', '/lock', { locked: true });
  assert.equal((await voidCard(bob)).status, 423);
  assert.equal((await cardOf(bob)).status, 'SUBMITTED');
});
