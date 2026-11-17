const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-challenger-m2-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Form = require('../../src/models/Form');
const Content = require('../../src/models/Content');
const HackathonApp = require('../../src/modules/hackathon/models/HackathonApp');
const { generateToken } = require('../../src/utils/jwt');

const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let repl;
let adminUser;
let adminToken;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User, Form, Content, HackathonApp].map(m => m.init()));
});

after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([User, Form, Content, HackathonApp].map(m => m.deleteMany({})));
  const publicDir = path.join(process.env.UPLOAD_DIR, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  for (const name of await fs.readdir(publicDir)) {
    await fs.unlink(path.join(publicDir, name));
  }
  adminUser = await User.create({
    fullName: 'Challenger Admin',
    email: 'admin-challenger-m2@pau.edu.tr',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: 'ADMIN',
    isEmailVerified: true
  });
  adminToken = generateToken({ id: adminUser._id, role: adminUser.role });
});

// =========================================================================
// CHALLENGE 1: MALICIOUS URL & PATH TRAVERSAL INJECTION
// =========================================================================

test('[CHALLENGE-URL-1] Reject javascript:, data:, vbscript:, file: URLs in POST /api/v1/content', async () => {
  const maliciousUrls = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(document.cookie)',
    'javascript:/*--></title></style></textarea></script><svg/onload=alert(1)>',
    'data:text/html,<script>alert(1)</script>',
    'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox("pwnd")',
    'VBSCRIPT:alert(1)',
    'file:///etc/passwd',
    'file:///c:/windows/system32/cmd.exe',
    'blob:https://example.com/uuid-payload',
    'about:blank'
  ];

  for (const badUrl of maliciousUrls) {
    // Challenge coverImageUrl
    const resCover = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Malicious URL Test',
        description: 'Test description sufficiently long',
        type: 'EVENT',
        coverImageUrl: badUrl
      });
    assert.equal(resCover.status, 400, `Expected 400 for malicious coverImageUrl: ${badUrl}, got ${resCover.status}`);
    assert.match(resCover.body.message, /geçersiz/i);

    // Challenge bevyLink
    const resBevy = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Malicious Bevy Test',
        description: 'Test description sufficiently long',
        type: 'EVENT',
        bevyLink: badUrl
      });
    assert.equal(resBevy.status, 400, `Expected 400 for malicious bevyLink: ${badUrl}, got ${resBevy.status}`);
    assert.match(resBevy.body.message, /geçersiz/i);
  }
});

test('[CHALLENGE-URL-2] Reject directory traversal in /uploads/public/... paths in POST and PUT /api/v1/content', async () => {
  const traversalPaths = [
    '/uploads/public/../../etc/passwd',
    '/uploads/public/../../../secret.env',
    '/uploads/public/..\\..\\windows\\win.ini',
    '/uploads/public/subdir/../hidden'
  ];

  for (const badPath of traversalPaths) {
    const resPost = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Traversal Test',
        description: 'Test description sufficiently long',
        type: 'EVENT',
        coverImageUrl: badPath
      });
    assert.equal(resPost.status, 400, `Expected 400 for traversal path ${badPath}, got ${resPost.status}`);

    const resPostBevy = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Traversal Bevy Test',
        description: 'Test description sufficiently long',
        type: 'EVENT',
        bevyLink: badPath
      });
    assert.equal(resPostBevy.status, 400, `Expected 400 for traversal bevy ${badPath}, got ${resPostBevy.status}`);
  }

  // Create valid content first
  const valid = await Content.create({
    title: 'Valid Initial Content',
    description: 'Initial valid description',
    type: 'EVENT'
  });

  for (const badPath of traversalPaths) {
    const resPut = await request(app)
      .put(`/api/v1/content/${valid._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coverImageUrl: badPath
      });
    assert.equal(resPut.status, 400, `Expected 400 for traversal PUT ${badPath}, got ${resPut.status}`);

    const resPutBevy = await request(app)
      .put(`/api/v1/content/${valid._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bevyLink: badPath
      });
    assert.equal(resPutBevy.status, 400, `Expected 400 for traversal PUT bevy ${badPath}, got ${resPutBevy.status}`);
  }
});

test('[CHALLENGE-URL-3] Accept legitimate HTTP, HTTPS, and clean /uploads/public/ paths', async () => {
  const validUrls = [
    'https://gdg.community.dev/events/details/developer-group-pamukkale-university/',
    'http://events.google.com/io',
    '/uploads/public/event-photo-2026.png',
    '/uploads/public/subfolder_image.jpg'
  ];

  for (const goodUrl of validUrls) {
    const resPost = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Valid Content ' + Math.random().toString(36).slice(2, 7),
        description: 'A valid description for legitimate URL verification',
        type: 'EVENT',
        bevyLink: goodUrl,
        coverImageUrl: goodUrl
      });
    assert.equal(resPost.status, 201, `Expected 201 for valid URL ${goodUrl}, got ${resPost.status}: ${JSON.stringify(resPost.body)}`);
  }
});

// =========================================================================
// CHALLENGE 2: TYPE SAFETY & NON-STRING INJECTION RESILIENCE
// =========================================================================

test('[CHALLENGE-TYPE-1] contentController rejects non-string types with 400 (never crashes with 500)', async () => {
  const badTypes = [
    12345,
    true,
    false,
    { injection: 'attempt' },
    ['array', 'value'],
    0
  ];

  const stringFields = ['title', 'description', 'bevyLink', 'type', 'category', 'slug', 'coverImageUrl'];

  for (const field of stringFields) {
    for (const val of badTypes) {
      // In POST
      const body = {
        title: 'Base Title',
        description: 'Base Description for testing',
        type: 'EVENT'
      };
      body[field] = val;

      const resPost = await request(app)
        .post('/api/v1/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      assert.notEqual(resPost.status, 500, `CRASH 500 detected on POST /api/v1/content with ${field}=${JSON.stringify(val)}`);
      assert.equal(resPost.status, 400, `Expected 400 on POST with ${field}=${JSON.stringify(val)}, got ${resPost.status}`);
      assert.equal(resPost.body.success, false);
    }
  }

  // Create valid content to test PUT
  const item = await Content.create({
    title: 'Item for PUT Testing',
    description: 'Initial valid item description',
    type: 'EVENT'
  });

  for (const field of stringFields) {
    for (const val of badTypes) {
      const updateBody = {};
      updateBody[field] = val;

      const resPut = await request(app)
        .put(`/api/v1/content/${item._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBody);

      assert.notEqual(resPut.status, 500, `CRASH 500 detected on PUT /api/v1/content/:id with ${field}=${JSON.stringify(val)}`);
      assert.equal(resPut.status, 400, `Expected 400 on PUT with ${field}=${JSON.stringify(val)}, got ${resPut.status}`);
      assert.equal(resPut.body.success, false);
    }
  }
});

test('[CHALLENGE-TYPE-2] formController rejects non-string types with 400 (never crashes with 500)', async () => {
  const badTypes = [
    999,
    true,
    false,
    { objectKey: 'val' },
    [1, 2, 3]
  ];

  const stringFields = ['title', 'description', 'slug', 'status', 'category', 'bannerImageUrl'];

  for (const field of stringFields) {
    for (const val of badTypes) {
      const formBody = {
        title: 'Form Type Test',
        description: 'Desc',
        fields: []
      };
      formBody[field] = val;

      const resPost = await request(app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(formBody);

      assert.notEqual(resPost.status, 500, `CRASH 500 on POST /api/v1/forms with ${field}=${JSON.stringify(val)}`);
      assert.equal(resPost.status, 400, `Expected 400 on POST /api/v1/forms with ${field}=${JSON.stringify(val)}, got ${resPost.status}`);
    }
  }

  const existingForm = await Form.create({
    title: 'Valid Form for PUT',
    slug: 'valid-form-for-put',
    status: 'DRAFT',
    fields: []
  });

  for (const field of stringFields) {
    for (const val of badTypes) {
      const updateBody = {};
      updateBody[field] = val;

      const resPut = await request(app)
        .put(`/api/v1/forms/${existingForm._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBody);

      assert.notEqual(resPut.status, 500, `CRASH 500 on PUT /api/v1/forms/:id with ${field}=${JSON.stringify(val)}`);
      assert.equal(resPut.status, 400, `Expected 400 on PUT /api/v1/forms/:id with ${field}=${JSON.stringify(val)}, got ${resPut.status}`);
    }
  }
});

// =========================================================================
// CHALLENGE 3: HACKATHON EXPORT SEARCH FILTER ACCURACY & ISOLATION
// =========================================================================

test('[CHALLENGE-SEARCH-1] Hackathon CSV export filters by teamName, leaderName, leaderEmail without leaking unmatched records', async () => {
  await HackathonApp.create([
    {
      teamName: 'CyberTitans',
      leaderName: 'Alice InChains',
      leaderEmail: 'alice@cybertitans.io',
      leaderPhone: '+905551110001',
      memberCount: 4,
      projectIdea: 'Cyber security platform for cloud workloads'
    },
    {
      teamName: 'DevWizards',
      leaderName: 'Bob Dylan',
      leaderEmail: 'bob@wizards.net',
      leaderPhone: '+905551110002',
      memberCount: 3,
      projectIdea: 'AI code assistant in Turkish'
    },
    {
      teamName: 'KernelPanic',
      leaderName: 'Charlie Root',
      leaderEmail: 'charlie@kernel.org',
      leaderPhone: '+905551110003',
      memberCount: 2,
      projectIdea: 'Low level OS debugging tools'
    }
  ]);

  // 1. Search by teamName (CyberTitans)
  const res1 = await request(app)
    .get('/api/v1/hackathon/applications/export?search=CyberTitans')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res1.status, 200);
  assert.match(res1.text, /CyberTitans/);
  assert.match(res1.text, /alice@cybertitans\.io/);
  assert.doesNotMatch(res1.text, /DevWizards/);
  assert.doesNotMatch(res1.text, /bob@wizards\.net/);
  assert.doesNotMatch(res1.text, /KernelPanic/);
  assert.doesNotMatch(res1.text, /charlie@kernel\.org/);

  // 2. Search by leaderName (Bob Dylan)
  const res2 = await request(app)
    .get('/api/v1/hackathon/applications/export?search=Dylan')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res2.status, 200);
  assert.match(res2.text, /DevWizards/);
  assert.match(res2.text, /Bob Dylan/);
  assert.doesNotMatch(res2.text, /CyberTitans/);
  assert.doesNotMatch(res2.text, /KernelPanic/);

  // 3. Search by leaderEmail (kernel.org)
  const res3 = await request(app)
    .get('/api/v1/hackathon/applications/export?search=kernel.org')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res3.status, 200);
  assert.match(res3.text, /KernelPanic/);
  assert.match(res3.text, /charlie@kernel\.org/);
  assert.doesNotMatch(res3.text, /CyberTitans/);
  assert.doesNotMatch(res3.text, /DevWizards/);

  // 4. Case-insensitive search (cybertitans)
  const res4 = await request(app)
    .get('/api/v1/hackathon/applications/export?search=cybertitans')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res4.status, 200);
  assert.match(res4.text, /CyberTitans/);
  assert.doesNotMatch(res4.text, /DevWizards/);

  // 5. Literal search immunity against regex metacharacters (Cyber.*)
  const resRegex = await request(app)
    .get('/api/v1/hackathon/applications/export?search=Cyber.*')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resRegex.status, 200);
  // Should NOT match anything because no team has literal '.*'
  assert.doesNotMatch(resRegex.text, /CyberTitans/);
  assert.doesNotMatch(resRegex.text, /DevWizards/);
  assert.doesNotMatch(resRegex.text, /KernelPanic/);

  // 6. Non-existent search returns zero data rows (only CSV header)
  const resEmpty = await request(app)
    .get('/api/v1/hackathon/applications/export?search=Ghost404NotFound')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resEmpty.status, 200);
  assert.match(resEmpty.text, /"ID","Takım Adı","Lider Adı"/);
  assert.doesNotMatch(resEmpty.text, /CyberTitans/);
  assert.doesNotMatch(resEmpty.text, /DevWizards/);
  assert.doesNotMatch(resEmpty.text, /KernelPanic/);
  // Header line only
  const lines = resEmpty.text.trim().split('\r\n');
  assert.equal(lines.length, 1, `Expected only header line, got: ${lines.length}`);
});

test('[CHALLENGE-SEARCH-2] Hackathon JSON export honors search filter and yields exact records', async () => {
  await HackathonApp.create([
    {
      teamName: 'JSON Team 1',
      leaderName: 'Leader One',
      leaderEmail: 'one@json.org',
      leaderPhone: '+905551110001',
      memberCount: 3,
      projectIdea: 'Idea 1'
    },
    {
      teamName: 'JSON Team 2',
      leaderName: 'Leader Two',
      leaderEmail: 'two@json.org',
      leaderPhone: '+905551110002',
      memberCount: 2,
      projectIdea: 'Idea 2'
    }
  ]);

  const resJson = await request(app)
    .get('/api/v1/hackathon/applications/export?format=json&search=Team%201')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resJson.status, 200);
  assert.equal(resJson.headers['content-type'], 'application/json; charset=utf-8');

  const data = JSON.parse(resJson.text);
  assert.equal(Array.isArray(data), true);
  assert.equal(data.length, 1);
  assert.equal(data[0].teamName, 'JSON Team 1');
  assert.equal(data[0].leaderEmail, 'one@json.org');
});

// =========================================================================
// CHALLENGE 4: ORPHAN IMAGE CLEANUP ON UPDATE / DELETE
// =========================================================================

test('[CHALLENGE-CLEANUP-1] Local images unlinked on replace/delete, external URLs handled safely without error', async () => {
  const publicDir = path.join(process.env.UPLOAD_DIR, 'public');

  // 1. Create content with uploaded image
  const res1 = await request(app)
    .post('/api/v1/content')
    .set('Authorization', `Bearer ${adminToken}`)
    .field('title', 'Cleanup Test Content')
    .field('description', 'Long enough description for test')
    .field('type', 'EVENT')
    .attach('coverImage', validPng, 'initial.png');
  assert.equal(res1.status, 201);
  const contentId = res1.body.data._id;
  assert.equal((await fs.readdir(publicDir)).length, 1);

  // 2. Replace with another uploaded image
  const res2 = await request(app)
    .put(`/api/v1/content/${contentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .attach('coverImage', validPng, 'replacement.png');
  assert.equal(res2.status, 200);
  // Previous file removed, exactly 1 file left
  assert.equal((await fs.readdir(publicDir)).length, 1);

  // 3. Update with external URL (previous local image should be unlinked)
  const res3 = await request(app)
    .put(`/api/v1/content/${contentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      coverImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97'
    });
  assert.equal(res3.status, 200);
  assert.equal((await fs.readdir(publicDir)).length, 0);

  // 4. Update external URL again (no local file to delete, must not crash)
  const res4 = await request(app)
    .put(`/api/v1/content/${contentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      coverImageUrl: 'https://images.unsplash.com/photo-different'
    });
  assert.equal(res4.status, 200);

  // 5. Delete content with external URL (must not crash)
  const res5 = await request(app)
    .delete(`/api/v1/content/${contentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res5.status, 200);
});
