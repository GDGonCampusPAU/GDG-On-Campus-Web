// Rate limits of the jury routes. Separate file: limiter counters live as long as the process.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const Juror = require('../src/modules/jury/models/Juror');
const { issueToken } = require('../src/modules/jury/services/tokenService');
const { LIMITS } = require('../src/modules/jury/middleware/limits');
const { init } = require('../src/modules/jury');

let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await init();
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

const juror = async name => {
  const { token, tokenHash } = issueToken();
  await Juror.create({ name, tokenHash });
  return () => request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${token}`);
};
/** Runs `count` requests in small batches and returns their status codes. */
const repeat = async (count, call) => {
  const statuses = [];
  while (statuses.length < count) {
    const batch = await Promise.all(Array.from({ length: Math.min(25, count - statuses.length) }, () => call()));
    statuses.push(...batch.map(res => res.status));
  }
  return statuses;
};

test('a full hall on one IP is not stopped by the general 200 limit and does not use it up', async () => {
  const me = await juror('Salon');
  assert.deepEqual([...new Set(await repeat(250, me))], [200]);
  const health = await request(app).get('/api/v1/health');
  assert.equal(health.headers['ratelimit-limit'], '200');
  assert.equal(health.headers['ratelimit-remaining'], '199');
});

test('invalid tokens are limited strictly, valid jurors on the same IP keep working', async () => {
  const me = await juror('Geçerli');
  const bad = () => request(app).get('/api/v1/jury/me').set('Authorization', `Bearer ${issueToken().token}`);
  const statuses = await repeat(LIMITS.invalidToken + 5, bad);
  assert.equal(statuses.filter(status => status === 401).length, LIMITS.invalidToken);
  assert.equal(statuses.filter(status => status === 429).length, 5);
  assert.equal((await me()).status, 200);
});

test('each juror has their own limit', async () => {
  const [busy, calm] = [await juror('Yoğun'), await juror('Sakin')];
  assert.deepEqual([...new Set(await repeat(LIMITS.juror, busy))], [200]);
  assert.equal((await busy()).status, 429);
  assert.equal((await calm()).status, 200);
});

test('look-alike and traversal paths stay under the general limit', async () => {
  for (const path of ['/api/v1/juryx', '/api/v1/jury%2Fme', '/api/v1/content/public']) {
    assert.equal((await request(app).get(path)).headers['ratelimit-limit'], '200', path);
  }
});
