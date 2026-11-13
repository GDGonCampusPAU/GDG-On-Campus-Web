const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'gdg-challenger-m5-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const HackathonApp = require('../../src/modules/hackathon/models/HackathonApp');
const { generateToken } = require('../../src/utils/jwt');
const { ensureAdmin } = require('../../src/services/seedAdminService');
const { FORM_SLUG } = require('../../src/services/eventPageService');

let repl;
let adminUser;
let adminToken;
const projectRoot = path.resolve(__dirname, '../../../');

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User, HackathonApp].map(m => m.init()));
});

after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([User, HackathonApp].map(m => m.deleteMany({})));
  adminUser = await User.create({
    fullName: 'Challenger Admin',
    email: 'admin@pau.edu.tr',
    passwordHash: 'hash',
    role: 'ADMIN',
    isApproved: true,
    isEmailVerified: true,
  });
  adminToken = generateToken({ id: adminUser._id, role: adminUser.role });
});

// ==============================================================================
// 1. Tooling & Script Robustness (F18)
// ==============================================================================

test('[CHALLENGE F18.1] scripts/dev.mjs syntax and process tree termination logic', async () => {
  const devScriptPath = path.join(projectRoot, 'scripts/dev.mjs');
  assert.ok(fsSync.existsSync(devScriptPath), 'scripts/dev.mjs must exist');
  const content = await fs.readFile(devScriptPath, 'utf8');

  // Must detect Windows vs POSIX
  assert.match(content, /process\.platform === 'win32' \? 'npm\.cmd' : 'npm'/);
  assert.match(content, /shell: process\.platform === 'win32'/);
  assert.match(content, /taskkill \/pid \${child\.pid} \/T \/F/);
  assert.match(content, /process\.kill\(-child\.pid, 'SIGTERM'\)/);
  assert.match(content, /let stopping = false/);
});

test('[CHALLENGE F18.2] check-layout.mjs properly constructs cross-platform grep args and root cwd', async () => {
  const scriptPath = path.join(projectRoot, 'frontend/hackaton/scripts/check-layout.mjs');
  assert.ok(fsSync.existsSync(scriptPath), 'check-layout.mjs must exist');
  const content = await fs.readFile(scriptPath, 'utf8');

  assert.match(content, /process\.platform === 'win32' \? 'npm\.cmd' : 'npm'/);
  // With shell: true the space-separated grep must be quoted on every platform, or sh splits it and Playwright finds no tests.
  assert.match(content, /const grepArg = '"responsive layout"'/);
  assert.match(content, /shell: true/);

  // Validate root path resolution
  const packageJsonPath = path.join(projectRoot, 'package.json');
  assert.ok(fsSync.existsSync(packageJsonPath), 'Target root must contain package.json');
});

// ==============================================================================
// 2. Legacy CSV Export Search Robustness & ReDoS Immunity (F19 Polish)
// ==============================================================================

test('[CHALLENGE C8/M4.1] Legacy CSV export with adversarial regex search input', async () => {
  await HackathonApp.create([
    {
      teamName: 'Special [Regex] (Team) + ? $ ^ . *',
      leaderName: 'Alan Turing',
      leaderEmail: 'alan@turing.org',
      leaderPhone: '+905550001122',
      memberCount: 4,
      projectIdea: 'Enigma solver machine architecture',
    },
    {
      teamName: 'Standard Devs',
      leaderName: 'Grace Hopper',
      leaderEmail: 'grace@navy.mil',
      leaderPhone: '+905550003344',
      memberCount: 3,
      projectIdea: 'Compiler design and formal languages',
    },
  ]);

  // Test special regex chars: should NOT throw 500 or crash regex engine
  const specialChars = '[Regex] (Team) + ? $ ^ . *';
  const res = await request(app)
    .get(`/api/v1/hackathon/applications/export?search=${encodeURIComponent(specialChars)}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.match(res.text, /Special \[Regex\] \(Team\)/);
  assert.doesNotMatch(res.text, /Standard Devs/);

  // Test adversarial ReDoS payload: should safely return empty or 200 without hanging
  const adversarialSearch = '((((((a+)+)+)+)+)+)+$';
  const redosRes = await request(app)
    .get(`/api/v1/hackathon/applications/export?search=${encodeURIComponent(adversarialSearch)}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(redosRes.status, 200);
  assert.doesNotMatch(redosRes.text, /Alan Turing/);
});

test('[CHALLENGE C8/M4.2] Legacy CSV export with Turkish characters and case-insensitivity', async () => {
  await HackathonApp.create([
    {
      teamName: 'Yıldızlar Mühendislik Grubu',
      leaderName: 'Şükrü Çetin',
      leaderEmail: 'sukru@example.com',
      leaderPhone: '+905551234567',
      memberCount: 4,
      projectIdea: 'Özgün yapay zeka algoritması',
    },
  ]);

  // Search by Turkish uppercase leader name
  const res1 = await request(app)
    .get(`/api/v1/hackathon/applications/export?search=${encodeURIComponent('Yıldızlar')}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res1.status, 200);
  assert.match(res1.text, /Yıldızlar Mühendislik Grubu/);

  // Search by leader email
  const res2 = await request(app)
    .get(`/api/v1/hackathon/applications/export?search=${encodeURIComponent('sukru@example.com')}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res2.status, 200);
  assert.match(res2.text, /Şükrü Çetin/);
});

test('[CHALLENGE C8/M4.3] Frontend downloadHackathonApplicationsCsv parameter handling', async () => {
  const apiSrc = await fs.readFile(path.join(projectRoot, 'frontend/src/lib/api.js'), 'utf8');

  // Verify URL search param construction avoids dangling '&search=' or broken query string
  assert.match(
    apiSrc,
    /let path = `\/hackathon\/applications\/export\?format=csv\${search \? `&search=\${encodeURIComponent\(search\)}` : ''}`/
  );
});

// ==============================================================================
// 3. Production Container & Environment Configuration (F19)
// ==============================================================================

test('[CHALLENGE F19.1] Multi-stage Dockerfile targets and referenced source paths', async () => {
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  assert.ok(fsSync.existsSync(dockerfilePath), 'Dockerfile must exist');
  const dockerfile = await fs.readFile(dockerfilePath, 'utf8');

  // Verify multi-stage targets
  const requiredTargets = [
    'AS base',
    'AS backend',
    'AS panel',
    'AS hackaton',
    'AS frontend-builder',
    'AS reverse-proxy',
    'AS production',
  ];
  for (const target of requiredTargets) {
    assert.ok(dockerfile.includes(target), `Dockerfile must define stage: ${target}`);
  }

  // Verify critical files referenced in COPY exist in the repository
  const referencedPaths = [
    'backend/package.json',
    'backend/package-lock.json',
    'frontend/package.json',
    'frontend/package-lock.json',
    'frontend/hackaton/package.json',
    'frontend/hackaton/package-lock.json',
    'nginx/nginx.conf',
    'shared/hackathon-event.json',
    'shared/eventContent.mjs',
    'backend/src/server.js',
  ];
  for (const relPath of referencedPaths) {
    const absPath = path.join(projectRoot, relPath);
    assert.ok(fsSync.existsSync(absPath), `Referenced file must exist: ${relPath}`);
  }
});

test('[CHALLENGE F19.2] compose.prod.yaml service architecture and healthcheck alignment', async () => {
  const composePath = path.join(projectRoot, 'compose.prod.yaml');
  assert.ok(fsSync.existsSync(composePath), 'compose.prod.yaml must exist');
  const compose = await fs.readFile(composePath, 'utf8');

  // Verify core services
  assert.match(compose, /services:\s+mongo:/);
  assert.match(compose, /backend:/);
  assert.match(compose, /web:/);

  // Mongo replica set rs0 configuration
  assert.match(compose, /--replSet,\s*rs0/);
  assert.match(compose, /rs\.initiate/);

  // Healthchecks
  assert.match(compose, /fetch\('http:\/\/127\.0\.0\.1:5000\/ready'\)/);
  assert.match(compose, /condition:\s*service_healthy/);

  // Persistent volume
  assert.match(compose, /mongo-prod-data:/);
  assert.match(compose, /uploads/);
});

test('[CHALLENGE F19.3] Nginx reverse proxy configuration for dual frontend & backend', async () => {
  const nginxConfPath = path.join(projectRoot, 'nginx/nginx.conf');
  assert.ok(fsSync.existsSync(nginxConfPath), 'nginx/nginx.conf must exist');
  const nginxConf = await fs.readFile(nginxConfPath, 'utf8');

  // Dual port listening: 80 (hackathon) and 8080 (panel)
  assert.match(nginxConf, /listen 80;/);
  assert.match(nginxConf, /listen 8080;/);

  // Backend upstream
  assert.match(nginxConf, /upstream backend_api\s*\{\s*server backend:5000;/);

  // Proxy passes
  assert.match(nginxConf, /proxy_pass http:\/\/backend_api;/);
  assert.match(nginxConf, /location \/ready/);
  assert.match(nginxConf, /location \/health/);

  // SPA fallback
  assert.match(nginxConf, /try_files \$uri \$uri\/ \/index\.html;/);
});

test('[CHALLENGE F19.4] Environment example documentation & replica set instructions', async () => {
  const rootEnv = await fs.readFile(path.join(projectRoot, '.env.example'), 'utf8');
  const backendEnv = await fs.readFile(path.join(projectRoot, 'backend/.env.example'), 'utf8');

  for (const envText of [rootEnv, backendEnv]) {
    assert.match(envText, /replicaSet=rs0/);
    assert.match(envText, /CLIENT_URLS/);
    assert.match(envText, /Admin123456!/);
    assert.match(envText, /BREVO_API_KEY/);
    assert.match(envText, /GOOGLE_CLIENT_ID/);
  }
});

test('[CHALLENGE F19.5] seed.js alignment with server.js & password hardening', async () => {
  const seedSrc = await fs.readFile(path.join(projectRoot, 'backend/src/utils/seed.js'), 'utf8');

  // Must call ensureHackathonPage and use FORM_SLUG
  assert.match(seedSrc, /ensureHackathonPage/);
  assert.match(seedSrc, /FORM_SLUG/);
  assert.equal(FORM_SLUG, 'hackathon-katilim');

  // Must NOT contain external Unsplash image URLs
  assert.doesNotMatch(seedSrc, /images\.unsplash\.com/);

  // Clear existing admin so ensureAdmin attempts creation
  await User.deleteMany({});

  // Seed Admin rejection test: 'Admin123456!' must fail
  process.env.DEFAULT_ADMIN_PASSWORD = 'Admin123456!';
  await assert.rejects(
    () => ensureAdmin(),
    /DEFAULT_ADMIN_PASSWORD en az 12 karakterlik özel bir parola olmalıdır/
  );

  // Seed Admin rejection test: short password must fail
  process.env.DEFAULT_ADMIN_PASSWORD = 'Short1!';
  await assert.rejects(
    () => ensureAdmin(),
    /DEFAULT_ADMIN_PASSWORD en az 12 karakterlik özel bir parola olmalıdır/
  );

  // Seed Admin accepts strong password
  process.env.DEFAULT_ADMIN_PASSWORD = 'P@u_Gdg#2026!AdminSec';
  const createdAdmin = await ensureAdmin();
  assert.ok(createdAdmin);
  assert.equal(createdAdmin.email, 'admin@pau.edu.tr');
  assert.equal(createdAdmin.role, 'ADMIN');
  assert.equal(createdAdmin.isEmailVerified, true);
});
