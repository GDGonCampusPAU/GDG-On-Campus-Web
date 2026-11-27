// Teams with a project link compete without being added by hand; a team an organizer removed stays removed.
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
const ProjectSubmission = require('../src/modules/projectUpload/models/ProjectSubmission');
const JudgingConfig = require('../src/modules/jury/models/JudgingConfig');
const { addUploadedTeams } = require('../src/modules/jury/services/autoEntries');
const { init } = require('../src/modules/jury');
const { generateToken } = require('../src/utils/jwt');

let repl, admin, form, teams;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User.init(), Form.init(), HackathonTeam.init(), ProjectSubmission.init(), init()]);
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

beforeEach(async () => {
  await Promise.all([User, Form, HackathonTeam, ProjectSubmission, JudgingConfig].map(m => m.deleteMany({})));
  const user = await User.create({ fullName: 'Admin', email: 'admin@pau.edu.tr', passwordHash: 'x', role: 'ADMIN', isEmailVerified: true });
  admin = generateToken({ id: user._id, role: 'ADMIN' });
  form = await Form.create({ title: 'Hackathon', slug: 'hackathon-katilim', status: 'PUBLISHED', fields: [] });
  const make = (name, code) => HackathonTeam.create({ form: form._id, name, nameKey: name.toLocaleLowerCase('tr-TR'), code,
    captain: { participant: new mongoose.Types.ObjectId(), email: `${code}@x.com` } });
  teams = { alfa: await make('Alfa', 'AAAAAA'), beta: await make('Beta', 'BBBBBB'), gama: await make('Gama', 'CCCCCC'), linksiz: await make('Linksiz', 'DDDDDD') };
});

const upload = (team, minute) => ProjectSubmission.collection.insertOne({ form: form._id, team: team._id, repoUrl: `https://github.com/x/${team.code}`,
  repoKey: `x/${team.code.toLowerCase()}`, projectName: '', updatedBy: { participant: new mongoose.Types.ObjectId(), name: 'Üye' }, history: [],
  createdAt: new Date(Date.UTC(2026, 10, 27, 12, minute)), updatedAt: new Date() });
const jury = (method, path, body) => request(app)[method](`/api/v1/jury-admin${path}`).set('Authorization', `Bearer ${admin}`).send(body);
const names = async () => (await JudgingConfig.findById(JudgingConfig.CONFIG_ID).lean()).entries.map(e => e.teamName);

test('opening the jury setup adds every team with a link, in upload order; teams without a link are not added', async () => {
  await upload(teams.gama, 1);
  await upload(teams.alfa, 5);
  const config = (await jury('get', '/config')).body.data;
  assert.deepEqual(config.entries.map(e => e.teamName), ['Gama', 'Alfa']);
  assert.deepEqual(config.entries.map(e => e.order), [1, 2]);
  // Nothing new: no new revision (an open editor is not disturbed).
  const again = (await jury('get', '/config')).body.data;
  assert.equal(again.revision, config.revision);
});

test('a later upload joins at the end; a team removed by hand does not come back; adding it by hand clears that', async () => {
  await upload(teams.alfa, 1);
  const first = (await jury('get', '/config')).body.data;
  await upload(teams.beta, 2);
  assert.equal(await addUploadedTeams([teams.beta._id]), 1);
  assert.deepEqual(await names(), ['Alfa', 'Beta']);

  // The organizer removes Beta.
  const current = (await jury('get', '/config')).body.data;
  assert.ok(current.revision > first.revision);
  const removed = await jury('put', '/config', { revision: current.revision, criteria: current.criteria, categories: current.categories,
    entries: current.entries.filter(e => e.teamName !== 'Beta').map(({ team, order }) => ({ team, order })) });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(await addUploadedTeams(), 0);
  assert.deepEqual((await jury('get', '/config')).body.data.entries.map(e => e.teamName), ['Alfa']);

  // Added again by hand: back, and it stays.
  const now = (await jury('get', '/config')).body.data;
  const back = await jury('put', '/config', { revision: now.revision, criteria: now.criteria, categories: now.categories,
    entries: [...now.entries.map(({ team, order }) => ({ team, order })), { team: String(teams.beta._id), order: 2 }] });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.deepEqual((await JudgingConfig.findById(JudgingConfig.CONFIG_ID).lean()).excludedTeams, []);
});

test('opening evaluation picks up the teams with a link before fixing the order; the lock stops automatic adds', async () => {
  await upload(teams.beta, 3);
  await upload(teams.alfa, 4);
  const opened = await request(app).put(`/api/v1/forms/${form._id}/permissions`).set('Authorization', `Bearer ${admin}`).send({ projectEvaluation: true });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  const live = (await jury('get', '/live')).body.data;
  assert.deepEqual(live.order.map(e => e.teamName), ['Beta', 'Alfa']);

  assert.equal((await jury('put', '/lock', { locked: true })).status, 200);
  await upload(teams.gama, 9);
  assert.equal(await addUploadedTeams(), 0);
  assert.deepEqual(await names(), ['Beta', 'Alfa']);
});
