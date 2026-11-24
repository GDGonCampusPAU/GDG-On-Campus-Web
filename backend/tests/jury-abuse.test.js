// Abuse of the jury system: shared-IP floods, edits after the lock, hostile text in the export.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.TRUST_PROXY_HOPS = '1';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
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
let server;
let base;
let admin;
let organizer;
let jurorToken;
let teams;
let hall;
let network = 0;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await init();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  server.closeAllConnections();
  server.close();
  await mongoose.disconnect();
  if (repl) await repl.stop();
});

/** Uses keep-alive fetch: thousands of one-off sockets would exhaust the ports of a test machine. */
const call = async (url, { method = 'GET', token, body, rawBody, ip = hall } = {}) => {
  const res = await fetch(`${base}${url}`, { method, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { 'X-Forwarded-For': ip, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* CSV */ }
  return { status: res.status, data };
};
const flood = async (count, make) => {
  const statuses = {};
  for (let done = 0; done < count; done += 50) {
    const batch = await Promise.all(Array.from({ length: Math.min(50, count - done) }, make));
    for (const { status } of batch) statuses[status] = (statuses[status] || 0) + 1;
  }
  return statuses;
};

beforeEach(async () => {
  network += 1;
  hall = `198.51.100.${network}`;
  await Promise.all([User, Form, HackathonTeam, JudgingConfig, Juror, Scorecard].map(model => model.deleteMany({})));
  const staff = async role => {
    const user = await User.create({ fullName: role, email: `${role.toLowerCase()}@pau.edu.tr`, passwordHash: 'x', role, isEmailVerified: true });
    return generateToken({ id: user._id, role });
  };
  [admin, organizer] = [await staff('ADMIN'), await staff('ORGANIZER')];
  const form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', fields: [] });
  teams = [];
  for (const [i, name] of ['Takim,=1+1,', 'Takim;=1+1;'].entries()) {
    teams.push(await HackathonTeam.create({ form: form._id, name, nameKey: name.toLowerCase(), code: `ABUS${i}${i}`,
      captain: { participant: new mongoose.Types.ObjectId(), email: `abuse${i}@example.com` } }));
  }
  await JudgingConfig.create({ criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES,
    entries: teams.map((team, i) => ({ team: team._id, teamName: team.name, order: i + 1 })) });
  const issued = issueToken();
  await Juror.create({ name: 'Jüri', tokenHash: issued.tokenHash });
  jurorToken = issued.token;
});

const submit = (team, first, rest, comment = '') => call(`/jury/entries/${team._id}/scorecard`, { method: 'PUT', token: jurorToken, body: {
  submit: true, round: 1, version: 0, nominations: [], generalComment: '',
  scores: DEFAULT_CRITERIA.map(({ key }, i) => ({ criterion: key, value: i ? rest : first, comment: i ? '' : comment }))
} });
const everyoneWorks = async () => {
  assert.equal((await call('/jury/me', { token: jurorToken })).status, 200, 'juror');
  assert.equal((await call('/jury-admin/results', { token: organizer })).status, 200, 'organizer');
  assert.equal((await submit(teams[0], 4, 4)).status, 200, 'juror save');
};

test('6500 requests without a token from the hall block nobody', async () => {
  const statuses = await flood(6500, () => call('/jury-admin/config'));
  assert.ok(!statuses[200]);
  await everyoneWorks();
});

test('6500 forged juror links from the hall block nobody', async () => {
  const statuses = await flood(6500, () => call('/jury/me', { token: issueToken().token }));
  assert.ok(!statuses[200]);
  await everyoneWorks();
});

test('6500 forged staff tokens from the hall block nobody', async () => {
  const forged = `${organizer.split('.').slice(0, 2).join('.')}.sahte`;
  const statuses = await flood(6500, () => call('/jury-admin/results', { token: forged }));
  assert.ok(!statuses[200]);
  await everyoneWorks();
});

test('failed attempts are still limited, as an invalid link rather than as a blocked juror', async () => {
  const bad = () => call('/jury/me', { token: issueToken().token });
  await flood(30, bad);
  const limited = await bad();
  assert.equal(limited.status, 429);
  assert.equal(limited.data.code, 'JURY_LINK_INVALID');
  await flood(30, () => call('/jury-admin/config'));
  assert.equal((await call('/jury-admin/config')).status, 429);
  await everyoneWorks();
});

test('bodies of unauthenticated jury requests are never parsed', async () => {
  for (const url of ['/jury-admin/config', `/jury/entries/${teams[0]._id}/scorecard`]) {
    assert.equal((await call(url, { method: 'PUT', rawBody: '{ bozuk json' })).status, 401, url);
  }
});

test('unknown paths under the jury mounts need credentials and stay contained', async () => {
  assert.equal((await call('/jury/yok', { token: jurorToken })).status, 404);
  assert.equal((await call('/jury-admin/yok', { token: organizer })).status, 404);
  assert.equal((await call('/jury/yok')).status, 401);
});

test('a lock freezes every setting that shapes the result', async () => {
  await submit(teams[0], 5, 2);
  await submit(teams[1], 1, 4);
  const { data: { data: config } } = await call('/jury-admin/config', { token: organizer });
  const ranking = async () => JSON.stringify((await call('/jury-admin/results', { token: organizer })).data.data.ranking);
  const before = await ranking();
  await call('/jury-admin/lock', { method: 'PUT', token: organizer, body: { locked: true } });

  const attacks = {
    weights: { criteria: config.criteria.map((item, i) => ({ ...item, weight: i ? 1 : 94 })) },
    'removed team': { entries: config.entries.slice(1) },
    'team order': { entries: config.entries.map((entry, i) => ({ ...entry, order: 2 - i })) },
    'category criteria': { categories: config.categories.map(category => ({ ...category, criterionKeys: [] })) },
    'category active': { categories: config.categories.map(category => ({ ...category, active: false })) },
    'project name': { entries: config.entries.map(entry => ({ ...entry, projectName: 'Değişti' })) },
  };
  for (const [name, change] of Object.entries(attacks)) {
    for (const token of [organizer, admin]) {
      const res = await call('/jury-admin/config', { method: 'PUT', token, body: { ...config, ...change } });
      assert.equal(res.status, 423, name);
      assert.equal(res.data.code, 'CONFIG_LOCKED', name);
    }
  }
  assert.equal((await JudgingConfig.findById('hackathon')).revision, config.revision);
  assert.equal(await ranking(), before);
});

test('a reset is refused while locked', async () => {
  await submit(teams[0], 4, 4);
  await call('/jury-admin/lock', { method: 'PUT', token: admin, body: { locked: true } });
  assert.equal((await call('/jury-admin/scorecards/reset', { method: 'POST', token: admin, body: { confirm: 'SIFIRLA' } })).status, 423);
  assert.equal(await Scorecard.countDocuments(), 1);
});

test('no config change lands after a lock has been confirmed', async () => {
  const { data: { data: config } } = await call('/jury-admin/config', { token: organizer });
  const saves = Array.from({ length: 8 }, (_, i) => call('/jury-admin/config', { method: 'PUT', token: organizer,
    body: { ...config, entries: config.entries.map(entry => ({ ...entry, projectName: `Deneme ${i}` })) } }));
  let atLock;
  const lock = call('/jury-admin/lock', { method: 'PUT', token: admin, body: { locked: true } }).then(async res => {
    assert.equal(res.status, 200);
    atLock = JSON.stringify((await JudgingConfig.findById('hackathon').lean()).entries);
  });
  await Promise.all(saves);
  await lock;
  assert.equal(JSON.stringify((await JudgingConfig.findById('hackathon').lean()).entries), atLock);
});

/** Splits like a spreadsheet: a quote opens a quoted part only at the start of a cell. */
const cellsOf = (text, delimiter) => {
  const cells = [];
  let cell = '';
  let quoted = false;
  let atStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (atStart && char === '"') {
      quoted = true;
      atStart = false;
    } else if (char === delimiter || char === '\r' || char === '\n') {
      cells.push(cell);
      cell = '';
      atStart = true;
    } else {
      cell += char;
      atStart = false;
    }
  }
  cells.push(cell);
  return cells;
};

test('the results CSV has no formula cell, whichever delimiter opens it', async () => {
  await submit(teams[0], 4, 4, 'iyi,=HYPERLINK("http://kotu"),');
  await submit(teams[1], 3, 3, 'satır\n@SUM(1)');
  const { data } = await call('/jury-admin/results.csv', { token: organizer });
  for (const delimiter of [',', ';', '\t']) {
    assert.deepEqual(cellsOf(data.replace(/^﻿/, ''), delimiter).filter(cell => /^\s*[=+@-]/.test(cell)), [], `delimiter ${JSON.stringify(delimiter)}`);
  }
});
