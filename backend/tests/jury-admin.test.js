// Staff endpoints of the jury system.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
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
const { DEFAULT_CRITERIA } = require('../src/modules/jury/defaults');
const { init } = require('../src/modules/jury');
const { generateToken } = require('../src/utils/jwt');

let repl, admin, organizer, member, pending, form, teamA, teamB;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), HackathonTeam.init(), init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const makeTeam = (formId, name, code, members = []) => HackathonTeam.create({ form: formId, name, nameKey: name.toLocaleLowerCase('tr-TR'), code,
  captain: { participant: new mongoose.Types.ObjectId(), email: `${code.toLowerCase()}@example.com` },
  members: members.map((status, i) => ({ participant: new mongoose.Types.ObjectId(), email: `${code.toLowerCase()}${i}@example.com`, status })) });

beforeEach(async () => {
  await Promise.all([User, Form, HackathonTeam, JudgingConfig, Juror, Scorecard].map(model => model.deleteMany({})));
  const staff = async role => {
    const user = await User.create({ fullName: `${role} Kişi`, email: `${role.toLowerCase()}@pau.edu.tr`, passwordHash: 'x', role, isEmailVerified: true });
    return generateToken({ id: user._id, role });
  };
  [admin, organizer, member, pending] = await Promise.all(['ADMIN', 'ORGANIZER', 'MEMBER', 'PENDING'].map(staff));
  form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', status: 'PUBLISHED', fields: [] });
  teamA = await makeTeam(form._id, 'Çılgın Kodcular', 'AAAAAA', ['APPROVED', 'PENDING']);
  teamB = await makeTeam(form._id, 'Işık Hızı', 'BBBBBB');
});

const call = (method, path, body, token = organizer) => {
  const req = request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};
const getConfig = async () => (await call('get', '/config')).body.data;
const putConfig = async changes => {
  const { revision, criteria, categories, entries } = await getConfig();
  return call('put', '/config', { revision, criteria, categories, entries, ...changes });
};
const entry = (team, order, extra = {}) => ({ team: String(team._id), order, ...extra });
const addEntries = async () => {
  const res = await putConfig({ entries: [entry(teamA, 1), entry(teamB, 2)] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const addJuror = async name => {
  const res = await call('post', '/jurors', { name }, admin);
  assert.equal(res.status, 201);
  return res.body.data;
};
const score = async (token, team, value, { submit = true, nominations = [], comment = '', generalComment = '', version = 0 } = {}) => {
  const res = await request(app).put(`/api/v1/jury/entries/${team._id}/scorecard`).set('Authorization', `Bearer ${token}`).send({
    submit, nominations, generalComment, version, round: (await JudgingConfig.findById('hackathon')).round,
    scores: DEFAULT_CRITERIA.map(({ key }, i) => ({ criterion: key, value, comment: i ? '' : comment }))
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};

const ENDPOINTS = [['get', '/config'], ['put', '/config'], ['get', '/teams'], ['get', '/jurors'], ['post', '/jurors'],
  ['post', '/jurors/000000000000000000000000/regenerate'], ['patch', '/jurors/000000000000000000000000'], ['put', '/lock'],
  ['post', '/scorecards/reset'], ['get', '/results'], ['get', '/results.csv'], ['get', '/log'],
  ['post', '/jurors/000000000000000000000000/scorecards/000000000000000000000000/void']];

test('every admin endpoint needs ORGANIZER or ADMIN', async () => {
  const { token: jurorToken } = await addJuror('Jüri');
  for (const [method, path] of ENDPOINTS) {
    assert.equal((await request(app)[method](`/api/v1/jury-admin${path}`)).status, 401, `${method} ${path} anonim`);
    assert.equal((await call(method, path, undefined, jurorToken)).status, 401, `${method} ${path} jüri linki`);
    assert.equal((await call(method, path, undefined, member)).status, 403, `${method} ${path} MEMBER`);
    assert.equal((await call(method, path, undefined, pending)).status, 403, `${method} ${path} PENDING`);
  }
});

test('a staff JWT is not a juror link', async () => {
  assert.equal((await request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${admin}`)).status, 401);
});

test('the first read seeds the spec defaults', async () => {
  const config = await getConfig();
  assert.equal(config.revision, 1);
  assert.equal(config.locked, false);
  assert.equal(config.criteria.length, 7);
  assert.deepEqual(config.categories.map(category => category.key), ['campusHero', 'wow', 'demoGod', 'pilot', 'dreamTeam']);
  assert.deepEqual(config.entries, []);
});

test('init never overwrites an edited config', async () => {
  const { criteria } = await getConfig();
  await putConfig({ criteria: criteria.map(item => (item.key === 'demo' ? { ...item, label: 'Demo' } : item)) });
  await init();
  assert.equal((await getConfig()).criteria.find(item => item.key === 'demo').label, 'Demo');
});

test('teams of this event are listed with captain plus approved members', async () => {
  const otherForm = await Form.create({ title: 'Eski', slug: 'eski', fields: [] });
  const outsider = await makeTeam(otherForm._id, 'Başka Etkinlik', 'CCCCCC');
  const { data } = (await call('get', '/teams')).body;
  assert.deepEqual(data.map(team => [team.name, team.code, team.memberCount]), [['Çılgın Kodcular', 'AAAAAA', 2], ['Işık Hızı', 'BBBBBB', 1]]);
  assert.ok(!JSON.stringify(data).includes('@'));
  const res = await putConfig({ entries: [entry(outsider, 1)] });
  assert.equal(res.status, 400);
});

test('entries are saved in order, links and project name are optional', async () => {
  const res = await putConfig({ entries: [entry(teamB, 2), entry(teamA, 1, { projectName: 'Proje', repoUrl: 'https://example.com/r', teamName: 'Sahte Ad' })] });
  assert.equal(res.status, 200);
  const [first, second] = res.body.data.entries;
  assert.equal(first.teamName, 'Çılgın Kodcular');
  assert.equal(first.repoUrl, 'https://example.com/r');
  assert.deepEqual([second.teamName, second.projectName, second.repoUrl], ['Işık Hızı', '', '']);
});

test('links must be http(s)', async () => {
  for (const repoUrl of ['javascript:alert(1)', 'ftp://example.com', '//example.com', 'github.com/x', 'https://', 'https://a b']) {
    assert.equal((await putConfig({ entries: [entry(teamA, 1, { repoUrl })] })).status, 400, repoUrl);
  }
});

test('weights must total 100 and be integers', async () => {
  const { criteria } = await getConfig();
  const change = weights => criteria.map((item, i) => ({ ...item, weight: weights[i] ?? item.weight }));
  for (const weights of [[24], [26], [25.5, 14.5], [0, 40], ['25']]) {
    assert.equal((await putConfig({ criteria: change(weights) })).status, 400, JSON.stringify(weights));
  }
  assert.equal((await putConfig({ criteria: change([30, 10]) })).status, 200);
});

test('categories are validated and can be added', async () => {
  const { categories } = await getConfig();
  const extra = { key: 'pixelPerfect', name: 'Pixel Perfect', icon: '🎨', criterionKeys: ['ux'], priority: 6, active: true };
  const bad = [{ criterionKeys: ['yok'] }, { priority: 1 }, { key: 'wow' }, { key: 'bozuk key' }, { active: 'evet' }, { name: '' }];
  for (const changes of bad) {
    assert.equal((await putConfig({ categories: [...categories, { ...extra, ...changes }] })).status, 400, JSON.stringify(changes));
  }
  assert.equal((await putConfig({ categories: [...categories, extra] })).status, 200);
});

test('duplicate teams and orders are rejected', async () => {
  assert.equal((await putConfig({ entries: [entry(teamA, 1), entry(teamA, 2)] })).status, 400);
  assert.equal((await putConfig({ entries: [entry(teamA, 1), entry(teamB, 1)] })).status, 400);
});

test('a stale revision gives 409 and changes nothing', async () => {
  const stale = await getConfig();
  await addEntries();
  const res = await call('put', '/config', { ...stale, entries: [] });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'CONFIG_CONFLICT');
  assert.equal((await getConfig()).entries.length, 2);
});

test('criteria can be added or deleted until the first scorecard exists', async () => {
  const { criteria } = await getConfig();
  const merged = criteria.slice(1).map((item, i) => (i ? item : { ...item, weight: 40 }));
  assert.equal((await putConfig({ criteria: merged })).status, 200);
});

test('with scorecards, criteria keys are frozen but text and weight can change', async () => {
  await addEntries();
  const { token } = await addJuror('Jüri');
  await score(token, teamA, 4, { submit: false });
  const { criteria } = await getConfig();
  const removed = criteria.slice(1).map((item, i) => (i ? item : { ...item, weight: 40 }));
  const renamed = criteria.map((item, i) => (i ? item : { ...item, key: 'tech' }));
  const added = [...criteria.map((item, i) => (i ? item : { ...item, weight: 20 })), { key: 'extra', label: 'Ek', weight: 5 }];
  for (const list of [removed, renamed, added]) {
    const categories = (await getConfig()).categories.map(category => ({ ...category, criterionKeys: [] }));
    const res = await putConfig({ criteria: list, categories });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CRITERIA_FROZEN');
  }
  const edited = criteria.map((item, i) => (i === 0 ? { ...item, label: 'Teknik', description: 'Yeni', weight: 30 } : i === 1 ? { ...item, weight: 10 } : item));
  assert.equal((await putConfig({ criteria: edited })).status, 200);
});

test('with scorecards, categories can be deactivated but not deleted', async () => {
  await addEntries();
  await score((await addJuror('Jüri')).token, teamA, 4);
  const { categories } = await getConfig();
  const res = await putConfig({ categories: categories.slice(1) });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'CATEGORY_IN_USE');
  assert.equal((await putConfig({ categories: categories.map(category => ({ ...category, active: false })) })).status, 200);
});

test('a dissolved team keeps its name, scores and place', async () => {
  await addEntries();
  await score((await addJuror('Jüri')).token, teamA, 5);
  await HackathonTeam.deleteOne({ _id: teamA._id });

  const config = await getConfig();
  assert.equal(config.entries[0].teamMissing, true);
  assert.equal(config.entries[0].teamName, 'Çılgın Kodcular');
  const saved = await putConfig({ entries: config.entries.map(item => ({ ...item, projectName: 'Yeni ad' })) });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.entries[0].teamName, 'Çılgın Kodcular');

  const [top] = (await call('get', '/results')).body.data.ranking;
  assert.deepEqual([top.teamName, top.overall, top.teamMissing], ['Çılgın Kodcular', 100, true]);
  const removal = await putConfig({ entries: [entry(teamB, 1)] });
  assert.equal(removal.status, 409);
  assert.equal(removal.body.code, 'ENTRY_HAS_SCORES');
});

test('a juror token is shown once and stored only as a hash', async () => {
  const { juror, token } = await addJuror('  Ayşe Yılmaz ');
  assert.equal(juror.name, 'Ayşe Yılmaz');
  assert.equal(Buffer.from(token, 'base64url').length, 24);
  assert.equal(juror.tokenHash, undefined);

  const raw = await mongoose.connection.collection('jurors').findOne({});
  assert.equal(raw.tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(raw).includes(token));
  assert.equal((await Juror.findOne().lean()).tokenHash, undefined);
  const list = JSON.stringify((await call('get', '/jurors')).body);
  assert.ok(!list.includes(token) && !list.includes(raw.tokenHash));
});

test('regenerating invalidates the old link', async () => {
  const { juror, token } = await addJuror('Burak');
  const res = await call('post', `/jurors/${juror.id}/regenerate`, undefined, admin);
  assert.equal(res.status, 200);
  const me = value => request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${value}`);
  assert.equal((await me(token)).status, 401);
  assert.equal((await me(res.body.data.token)).status, 200);
});

test('jurors can be renamed and deactivated; bad input is rejected', async () => {
  const { juror, token } = await addJuror('Can');
  assert.equal((await call('patch', `/jurors/${juror.id}`, { name: 'Can Demir' })).body.data.name, 'Can Demir');
  assert.equal((await call('patch', `/jurors/${juror.id}`, { active: false })).body.data.active, false);
  assert.equal((await request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${token}`)).status, 401);
  for (const body of [{}, { active: 'hayır' }, { name: ' ' }]) assert.equal((await call('patch', `/jurors/${juror.id}`, body)).status, 400);
  for (const body of [{}, { name: { $ne: null } }, { name: 'x'.repeat(81) }]) assert.equal((await call('post', '/jurors', body, admin)).status, 400);
  assert.equal((await call('patch', '/jurors/yok', { active: true })).status, 404);
});

test('juror list shows progress', async () => {
  await addEntries();
  const { token } = await addJuror('Deniz');
  await score(token, teamA, 3);
  await score(token, teamB, 3, { submit: false });
  const [row] = (await call('get', '/jurors')).body.data;
  assert.deepEqual([row.submittedCount, row.draftCount, row.entryCount], [1, 1, 2]);
  assert.ok(row.lastSeenAt);
});

test('locking stops jurors and does not bump the revision', async () => {
  await addEntries();
  const { token } = await addJuror('Ece');
  const before = await getConfig();
  assert.equal((await call('put', '/lock', { locked: 'true' })).status, 400);
  const locked = await call('put', '/lock', { locked: true });
  assert.equal(locked.body.data.locked, true);
  assert.equal(locked.body.data.revision, before.revision);
  const res = await request(app).put(`/api/v1/jury/entries/${teamA._id}/scorecard`).set('Authorization', `Bearer ${token}`)
    .send({ submit: false, scores: [], nominations: [], round: 1, version: 0 });
  assert.equal(res.status, 423);
  assert.equal((await call('put', '/lock', { locked: false }, admin)).body.data.locked, false);
  await score(token, teamA, 2);
});

test('nothing is written after a lock has been confirmed', async () => {
  await addEntries();
  const jurors = await Promise.all(Array.from({ length: 10 }, (_, i) => addJuror(`Jüri ${i}`)));
  let confirmedAt = Infinity;
  const saves = jurors.flatMap(({ token }) => [teamA, teamB].map(async team => {
    const res = await request(app).put(`/api/v1/jury/entries/${team._id}/scorecard`).set('Authorization', `Bearer ${token}`)
      .send({ submit: false, scores: [], nominations: [], round: 1, version: 0 });
    assert.ok([200, 423].includes(res.status), `beklenmeyen ${res.status}`);
    return res.status;
  }));
  const lock = call('put', '/lock', { locked: true }).then(async res => {
    assert.equal(res.status, 200);
    confirmedAt = await Scorecard.countDocuments();
  });
  const statuses = await Promise.all(saves);
  await lock;
  assert.equal(await Scorecard.countDocuments(), confirmedAt);
  assert.equal(statuses.filter(status => status === 200).length, confirmedAt);
});

test('only an ADMIN can reset, and only with the typed confirmation', async () => {
  await addEntries();
  await score((await addJuror('Fatma')).token, teamA, 4);
  assert.equal((await call('post', '/scorecards/reset', { confirm: 'SIFIRLA' }, organizer)).status, 403);
  for (const body of [{}, { confirm: true }, { confirm: 'sifirla' }]) assert.equal((await call('post', '/scorecards/reset', body, admin)).status, 400);
  assert.equal(await Scorecard.countDocuments(), 1);
});

test('reset deletes only scorecards and starts a new round', async () => {
  await addEntries();
  const { token } = await addJuror('Gül');
  await score(token, teamA, 4);
  await score(token, teamB, 4, { submit: false });
  const res = await call('post', '/scorecards/reset', { confirm: 'SIFIRLA' }, admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deleted, 2);
  assert.deepEqual([res.body.data.config.round, res.body.data.config.entries.length], [2, 2]);
  assert.equal(await Juror.countDocuments(), 1);
  assert.equal(await Scorecard.countDocuments(), 0);

  const stale = await request(app).put(`/api/v1/jury/entries/${teamA._id}/scorecard`).set('Authorization', `Bearer ${token}`)
    .send({ submit: false, scores: [], nominations: [], round: 1, version: 1 });
  assert.equal(stale.body.code, 'JURY_RESET');
  await score(token, teamA, 5);
});

test('results contain averages, suggestions, missing jurors and every comment', async () => {
  await addEntries();
  const one = await addJuror('Hakan');
  const two = await addJuror('İpek');
  await score(one.token, teamA, 5, { nominations: ['dreamTeam'], comment: 'Çok sağlam', generalComment: 'Harika' });
  await score(two.token, teamA, 3);
  await score(one.token, teamB, 2);
  await score(two.token, teamB, 5, { submit: false });

  const { data } = (await call('get', '/results')).body;
  const [first, second] = data.ranking;
  assert.deepEqual([first.teamName, first.overall, first.judgeCount, first.missingJurors.length], ['Çılgın Kodcular', 80, 2, 0]);
  assert.deepEqual(second.missingJurors, [{ name: 'İpek', hasDraft: true }]);
  assert.equal(second.overall, 40);
  assert.equal(first.cards[0].scores[0].comment, 'Çok sağlam');
  assert.equal(first.cards[0].generalComment, 'Harika');
  assert.equal(first.cards[0].total, 100);
  const campusHero = data.categories.find(category => category.key === 'campusHero');
  assert.deepEqual([campusHero.winner, campusHero.reason], [null, 'NO_NOMINATION']);
  assert.equal(data.categories.find(category => category.key === 'dreamTeam').winner, String(teamA._id));
});

test('CSV has a BOM, semicolons, Turkish text and no formula injection', async () => {
  await addEntries();
  const { token } = await addJuror('Şükrü Öğüt');
  await score(token, teamA, 3, { comment: '=HYPERLINK("http://kotu")', generalComment: 'satır 1\nsatır 2; devamı', nominations: ['wow'] });
  const res = await call('get', '/results.csv').buffer(true).parse((stream, done) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => done(null, Buffer.concat(chunks)));
  });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv; charset=utf-8/);
  assert.deepEqual([...res.body.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const rows = res.body.toString('utf8').slice(1).trimEnd().split('\r\n');
  assert.ok(rows[0].startsWith('"Sunum Sırası";"Takım";"Proje";"Jüri"'));
  assert.equal(rows.length, 1 + 7 + 1); // header, scored team, unscored team
  assert.ok(rows[1].includes('"Çılgın Kodcular"') && rows[1].includes('"Şükrü Öğüt"') && rows[1].includes('"Vay Be"'));
  assert.ok(rows[1].includes(`"'=HYPERLINK(""http://kotu"")"`));
  assert.ok(rows[1].includes('"satır 1\nsatır 2; devamı"'));
});
