// Maintenance mode: the admin switch and the standalone page server.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-maintenance-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdg-maintenance-'));
process.env.MAINTENANCE_DIR = stateDir;
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');

const serverScript = path.resolve(__dirname, '..', '..', 'maintenance', 'server.mjs');
const flagFile = path.join(stateDir, 'active.json');
let repl, admin, organizer;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await User.init();
});
after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  fs.rmSync(stateDir, { recursive: true, force: true });
});
beforeEach(async () => {
  await User.deleteMany({});
  fs.rmSync(flagFile, { force: true });
  const a = await User.create({ fullName: 'Ada Yönetici', email: 'ada@pau.edu.tr', passwordHash: 'x', role: 'ADMIN', isEmailVerified: true });
  const o = await User.create({ fullName: 'Org', email: 'org@pau.edu.tr', passwordHash: 'x', role: 'ORGANIZER', isEmailVerified: true });
  admin = generateToken({ id: a._id, role: 'ADMIN' });
  organizer = generateToken({ id: o._id, role: 'ORGANIZER' });
});

test('only admins can see or change maintenance mode', async () => {
  await request(app).get('/api/v1/maintenance').expect(401);
  await request(app).get('/api/v1/maintenance').set('Authorization', `Bearer ${organizer}`).expect(403);
  await request(app).put('/api/v1/maintenance').set('Authorization', `Bearer ${organizer}`).send({ active: true }).expect(403);
  assert.equal(fs.existsSync(flagFile), false);
});

test('admin turns maintenance on and off; the flag file is the state', async () => {
  const off = await request(app).get('/api/v1/maintenance').set('Authorization', `Bearer ${admin}`).expect(200);
  assert.equal(off.body.data.active, false);

  await request(app).put('/api/v1/maintenance').set('Authorization', `Bearer ${admin}`).send({ active: 'yes' }).expect(400);

  const on = await request(app).put('/api/v1/maintenance').set('Authorization', `Bearer ${admin}`).send({ active: true }).expect(200);
  assert.equal(on.body.data.active, true);
  assert.equal(on.body.data.by.name, 'Ada Yönetici');
  assert.ok(Date.parse(on.body.data.since));
  assert.equal(JSON.parse(fs.readFileSync(flagFile, 'utf8')).by.name, 'Ada Yönetici');

  // Turning it on again keeps the original start time.
  const again = await request(app).put('/api/v1/maintenance').set('Authorization', `Bearer ${admin}`).send({ active: true }).expect(200);
  assert.equal(again.body.data.since, on.body.data.since);

  const stopped = await request(app).put('/api/v1/maintenance').set('Authorization', `Bearer ${admin}`).send({ active: false }).expect(200);
  assert.equal(stopped.body.data.active, false);
  assert.equal(fs.existsSync(flagFile), false);
});

// --- standalone server -------------------------------------------------------

const freePort = () => new Promise((resolve) => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = /** @type {net.AddressInfo} */ (probe.address());
    probe.close(() => resolve(port));
  });
});
const startServer = (port) => {
  const child = spawn(process.execPath, [serverScript], {
    env: { ...process.env, MAINTENANCE_PORT: String(port), MAINTENANCE_HOST: '127.0.0.1', MAINTENANCE_RETRY_MS: '100', MAINTENANCE_YIELD_MS: '300' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  return { child, exited };
};
const waitFor = async (check, ms = 5000) => {
  const end = Date.now() + ms;
  for (;;) {
    try { const value = await check(); if (value) return value; } catch { /* not yet */ }
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

test('standalone server does not start while maintenance is off', async () => {
  const { exited } = startServer(await freePort());
  assert.equal(await exited, 0);
});

test('standalone server answers every path with the 503 page and exits when maintenance is turned off', async () => {
  fs.writeFileSync(flagFile, JSON.stringify({ since: new Date().toISOString() }));
  const port = await freePort();
  const { child, exited } = startServer(port);
  try {
    const base = `http://127.0.0.1:${port}`;
    const page = await waitFor(() => fetch(`${base}/kayit?x=1`));
    assert.equal(page.status, 503);
    assert.equal(page.headers.get('retry-after'), '120');
    assert.match(await page.text(), /Tadilattayız/);
    const font = await fetch(`${base}/fonts/GoogleSans-Bold.woff2`);
    assert.equal(font.status, 200);
    assert.equal((await fetch(`${base}/fonts/../../.env`)).status, 503);
    assert.equal(Number(fs.readFileSync(path.join(stateDir, 'server.pid'), 'utf8')), child.pid);

    // A second copy sees the running one and leaves.
    assert.equal(await startServer(port).exited, 0);

    // The Vite dev server asks for the port; it is released, then taken back while still free.
    assert.equal((await fetch(`${base}/__maintenance/yield`, { method: 'POST' })).status, 204);
    await waitFor(async () => { try { await fetch(base); return false; } catch { return true; } }, 1000);
    assert.equal((await waitFor(() => fetch(base))).status, 503);

    fs.rmSync(flagFile);
    assert.equal(await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve('still running'), 4000))]), 0);
    assert.equal(fs.existsSync(path.join(stateDir, 'server.pid')), false);
  } finally {
    child.kill();
  }
});

test('--detach leaves a server running outside the caller process tree', async () => {
  fs.writeFileSync(flagFile, JSON.stringify({ since: new Date().toISOString() }));
  const port = await freePort();
  const launcher = spawn(process.execPath, [serverScript, '--detach'], {
    env: { ...process.env, MAINTENANCE_PORT: String(port), MAINTENANCE_HOST: '127.0.0.1' }, stdio: 'ignore'
  });
  assert.equal(await new Promise(resolve => launcher.once('exit', resolve)), 0);
  const pidPath = path.join(stateDir, 'server.pid');
  const pid = await waitFor(() => fs.existsSync(pidPath) && Number(fs.readFileSync(pidPath, 'utf8')));
  try {
    assert.notEqual(pid, launcher.pid);
    assert.equal((await waitFor(() => fetch(`http://127.0.0.1:${port}/`))).status, 503);
    fs.rmSync(flagFile);
    await waitFor(() => !fs.existsSync(pidPath), 4000);
  } finally {
    try { process.kill(pid); } catch { /* exited */ }
  }
});
