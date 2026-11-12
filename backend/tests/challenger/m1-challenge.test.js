const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
process.env.UPLOAD_DIR = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'gdg-challenger-m1-'));

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Form = require('../../src/models/Form');
const FormResponse = require('../../src/models/FormResponse');
const VerificationToken = require('../../src/models/VerificationToken');
const emailService = require('../../src/services/emailService');
const { generateToken } = require('../../src/utils/jwt');

let repl;
let adminUser;
let adminToken;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
  await Promise.all([User, Form, FormResponse, VerificationToken].map(m => m.init()));
});

after(async () => {
  await mongoose.disconnect();
  if (repl) await repl.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([User, Form, FormResponse, VerificationToken].map(m => m.deleteMany({})));
  adminUser = await User.create({
    fullName: 'Empirical Challenger Admin',
    email: 'admin-challenger@pau.edu.tr',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: 'ADMIN',
    isEmailVerified: true,
    tokenVersion: 0
  });
  adminToken = generateToken({ id: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion });
});

// ============================================================================
// CHALLENGE 1: Email HTML/Phishing Escaping & CRLF Header Injection
// ============================================================================
test('CHALLENGE 1.1: HTML tags (<script>, <a href="...">, <b>, <img>) in fullName and teamName are strictly escaped', async () => {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.BREVO_API_KEY;
  const capturedRequests = [];

  process.env.BREVO_API_KEY = 'mock-challenger-brevo-key';
  globalThis.fetch = async (_url, init) => {
    capturedRequests.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ messageId: 'msg-challenge' }) };
  };

  try {
    // Attack payloads
    const scriptPayload = '<script>alert("xss")</script>';
    const linkPayload = '<a href="https://malicious-phish.ru/login">Giriş Yap</a>';
    const tagPayload = '<b>Bold Attacker</b>';
    const attrBreakout = '"><script src="//evil.com/evil.js"></script>';
    const imgPayload = '<img src="x" onerror="stealCredentials()">';

    // 1. sendRegistrationOtpEmail with attack payload
    await emailService.sendRegistrationOtpEmail({
      email: 'victim1@pau.edu.tr',
      fullName: `${scriptPayload} ${linkPayload} ${tagPayload}`,
      code: '123456'
    });

    // 2. sendHackathonOtpEmail with attack payload in leaderName and teamName
    await emailService.sendHackathonOtpEmail({
      email: 'victim2@example.com',
      leaderName: imgPayload,
      teamName: attrBreakout,
      code: '654321'
    });

    // 3. sendPasswordResetOtpEmail with attack payload
    await emailService.sendPasswordResetOtpEmail({
      email: 'victim3@pau.edu.tr',
      fullName: '<script>evil()</script>',
      code: '789012'
    });

    assert.equal(capturedRequests.length, 3, 'All 3 emails must have been dispatched');

    // Verify Email 1 (Registration)
    const req1Html = capturedRequests[0].htmlContent;
    assert.doesNotMatch(req1Html, /<script>/i, 'Raw <script> tag must not appear in HTML');
    assert.doesNotMatch(req1Html, /<\/script>/i, 'Raw </script> tag must not appear in HTML');
    assert.doesNotMatch(req1Html, /<a\s+href=/i, 'Raw <a href=> link must not appear in HTML');
    assert.doesNotMatch(req1Html, /<b>Bold/i, 'Raw <b> tag from fullName must not appear in HTML');

    // Check for double escaping flaw:
    // If double escaped, &lt; becomes &amp;lt;. Single escape should produce &lt;script&gt;
    const isDoubleEscaped = req1Html.includes('&amp;lt;script&amp;gt;');
    if (isDoubleEscaped) {
      assert.fail('DOUBLE ESCAPING DETECTED: fullName was escaped twice, turning &lt; into &amp;lt;');
    }
    assert.match(req1Html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/, 'Entities must be properly single-escaped');

    // Verify Email 2 (Hackathon)
    const req2Html = capturedRequests[1].htmlContent;
    assert.doesNotMatch(req2Html, /<img\s+src=/i, 'Raw <img> tag must not appear in HTML');
    assert.doesNotMatch(req2Html, /<script\s+src=/i, 'Attribute breakout <script> must not appear in HTML');
    assert.match(req2Html, /&lt;img src=&quot;x&quot; onerror=&quot;stealCredentials\(\)&quot;&gt;/, 'Img tag must be escaped');
    assert.match(req2Html, /&quot;&gt;&lt;script src=&quot;\/\/evil\.com\/evil\.js&quot;&gt;&lt;\/script&gt;/, 'Breakout payload must be escaped');

    // Verify Email 3 (Password Reset)
    const req3Html = capturedRequests[2].htmlContent;
    assert.doesNotMatch(req3Html, /<script>/i, 'Raw <script> must not appear in reset email');
    assert.match(req3Html, /&lt;script&gt;evil\(\)&lt;\/script&gt;/, 'Reset email greeting must be escaped');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = prevKey;
  }
});

test('CHALLENGE 1.2: CRLF injection in subject and toName is stripped / neutralized', async () => {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.BREVO_API_KEY;
  const capturedRequests = [];

  process.env.BREVO_API_KEY = 'mock-challenger-brevo-key';
  globalThis.fetch = async (_url, init) => {
    capturedRequests.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ messageId: 'msg-crlf' }) };
  };

  try {
    // CRLF header injection attempt via fullName
    const injectedName = 'Attacker Name\r\nBcc: spy@evil.com\r\nSubject: Injected Header';
    await emailService.sendRegistrationOtpEmail({
      email: 'target@pau.edu.tr',
      fullName: injectedName,
      code: '999888'
    });

    // Direct sendEmail with CRLF subject and toName
    await emailService.sendEmail({
      to: 'target2@pau.edu.tr',
      toName: 'Victim\r\nCc: accomplice@evil.com',
      subject: 'Subject Line\r\nX-Spam-Injected: yes\nAnother-Header: 123',
      htmlContent: '<p>Body</p>',
      textContent: 'Body text'
    });

    assert.equal(capturedRequests.length, 2);

    // Verify Request 1
    const req1 = capturedRequests[0];
    assert.ok(req1.to[0].name, 'to.name must be present');
    assert.doesNotMatch(req1.to[0].name, /[\r\n]/, 'to.name must not contain carriage return or newline');
    assert.doesNotMatch(req1.subject, /[\r\n]/, 'subject must not contain carriage return or newline');

    // Verify Request 2
    const req2 = capturedRequests[1];
    assert.doesNotMatch(req2.to[0].name, /[\r\n]/, 'to.name must not contain CRLF');
    assert.doesNotMatch(req2.subject, /[\r\n]/, 'subject must not contain CRLF');
    assert.equal(req2.subject, 'Subject Line X-Spam-Injected: yes Another-Header: 123', 'CRLF should be replaced with space');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = prevKey;
  }
});

// ============================================================================
// CHALLENGE 2: FormResponse Partial Unique Index on { form, singleSubmissionKey }
// ============================================================================
test('CHALLENGE 2.1: Duplicate raw insertions on { form, singleSubmissionKey } are strictly rejected with E11000', async () => {
  await FormResponse.init();
  const indexes = await FormResponse.collection.indexes();
  const targetIndex = indexes.find(
    idx => idx.key?.form === 1 && idx.key?.singleSubmissionKey === 1 && idx.unique === true
  );

  assert.ok(targetIndex, 'Index on { form: 1, singleSubmissionKey: 1 } with unique: true must exist in MongoDB');
  assert.deepEqual(
    targetIndex.partialFilterExpression,
    { singleSubmissionKey: { $type: 'string' } },
    'partialFilterExpression must target singleSubmissionKey of type string'
  );

  const form1 = await Form.create({ title: 'Adversarial Form 1', slug: 'adv-form-1', status: 'PUBLISHED', fields: [] });
  const form2 = await Form.create({ title: 'Adversarial Form 2', slug: 'adv-form-2', status: 'PUBLISHED', fields: [] });

  const submissionKey = 'user:12345:verified-hash';

  // First insertion on form 1 must succeed
  const doc1 = await FormResponse.collection.insertOne({
    form: form1._id,
    formSlug: form1.slug,
    singleSubmissionKey: submissionKey,
    answers: [{ questionId: 'q1', value: 'First Answer' }]
  });
  assert.ok(doc1.acknowledged, 'First insertion must succeed');

  // Second insertion on form 1 with IDENTICAL singleSubmissionKey MUST fail with E11000
  let errCode = null;
  try {
    await FormResponse.collection.insertOne({
      form: form1._id,
      formSlug: form1.slug,
      singleSubmissionKey: submissionKey,
      answers: [{ questionId: 'q1', value: 'Duplicate Collision' }]
    });
  } catch (err) {
    errCode = err.code;
  }
  assert.equal(errCode, 11000, 'Duplicate insertion on same form must throw MongoServerError code 11000');

  // Insertion on form 2 with SAME singleSubmissionKey MUST succeed (scoped per form!)
  const docForm2 = await FormResponse.collection.insertOne({
    form: form2._id,
    formSlug: form2.slug,
    singleSubmissionKey: submissionKey,
    answers: [{ questionId: 'q1', value: 'Different Form OK' }]
  });
  assert.ok(docForm2.acknowledged, 'Same submissionKey on a DIFFERENT form must succeed');
});

test('CHALLENGE 2.2: Multiple insertions where singleSubmissionKey is null or missing DO NOT collide', async () => {
  await FormResponse.init();
  const form = await Form.create({ title: 'Anonymous Form', slug: 'anon-form', status: 'PUBLISHED', fields: [] });

  // Anonymous submissions have singleSubmissionKey: null
  const sub1 = await FormResponse.collection.insertOne({
    form: form._id,
    formSlug: form.slug,
    singleSubmissionKey: null,
    answers: [{ questionId: 'q1', value: 'Anon 1' }]
  });
  const sub2 = await FormResponse.collection.insertOne({
    form: form._id,
    formSlug: form.slug,
    singleSubmissionKey: null,
    answers: [{ questionId: 'q1', value: 'Anon 2' }]
  });
  const sub3 = await FormResponse.collection.insertOne({
    form: form._id,
    formSlug: form.slug,
    // singleSubmissionKey omitted
    answers: [{ questionId: 'q1', value: 'Anon 3' }]
  });

  assert.ok(sub1.acknowledged && sub2.acknowledged && sub3.acknowledged, 'Null and omitted keys must not collide');
  const count = await FormResponse.countDocuments({ form: form._id });
  assert.equal(count, 3, 'All 3 anonymous responses must be persisted without duplicate key errors');
});

// ============================================================================
// CHALLENGE 3: OTP Consumption on Non-Existent User
// ============================================================================
test('CHALLENGE 3.1: POST /api/v1/auth/verify-email does not consume OTP or burn attempts for non-existent user', async () => {
  const ghostEmail = 'ghost-adversarial@pau.edu.tr';
  const otpCode = await VerificationToken.generateOtp(ghostEmail, 'REGISTER', 10);

  // Initial token state verification
  const initialTokenDoc = await VerificationToken.findOne({ email: ghostEmail, purpose: 'REGISTER' });
  assert.ok(initialTokenDoc, 'VerificationToken must exist');
  assert.equal(initialTokenDoc.attempts, 0, 'Initial attempts must be 0');

  // Attempt verification with the correct code for non-existent user
  const res = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: ghostEmail, code: otpCode });

  // Same answer as a wrong code, so the endpoint cannot be used to enumerate accounts.
  assert.equal(res.status, 400, 'Must look like an invalid code');
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Kod hatalı/);

  // Check token state after the 404 verification attempt
  const tokenAfter404 = await VerificationToken.findOne({ email: ghostEmail, purpose: 'REGISTER' });
  assert.ok(tokenAfter404, 'Token document must NOT be deleted');
  assert.equal(tokenAfter404.attempts, 0, 'Attempts must NOT have been incremented on missing user');

  // Now create the user in unverified state
  const newUser = await User.create({
    fullName: 'Resurrected Ghost',
    email: ghostEmail,
    passwordHash: 'somehash',
    role: 'MEMBER',
    isEmailVerified: false
  });

  // Verify that the untouched OTP can now be successfully consumed!
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: ghostEmail, code: otpCode });

  assert.equal(verifyRes.status, 200, 'Must return 200 OK after user is registered');
  assert.equal(verifyRes.body.success, true);

  // Check user is now verified
  const refreshedUser = await User.findById(newUser._id);
  assert.equal(refreshedUser.isEmailVerified, true, 'User isEmailVerified must be true');

  // Check token is now consumed (deleted from DB)
  const consumedToken = await VerificationToken.findOne({ email: ghostEmail, purpose: 'REGISTER' });
  assert.equal(consumedToken, null, 'Token must be deleted upon successful consumption');

  // Repeated verification for an already verified user must not reveal that state either
  const reVerifyRes = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: ghostEmail, code: otpCode });
  assert.equal(reVerifyRes.status, 400);
  assert.match(reVerifyRes.body.message, /Kod hatalı/);
});

// ============================================================================
// CHALLENGE 4: Standard Pagination Envelope on GET /api/v1/users
// ============================================================================
test('CHALLENGE 4.1: GET /api/v1/users returns complete 6-field pagination envelope and respects limits & filters', async () => {
  // Populate users to test multi-page calculation
  const dummyUsers = [];
  for (let i = 1; i <= 55; i++) {
    dummyUsers.push({
      fullName: `Test User ${i}`,
      email: `user${i}@pau.edu.tr`,
      passwordHash: 'hash',
      role: i % 2 === 0 ? 'MEMBER' : 'ORGANIZER',
      isEmailVerified: true
    });
  }
  await User.insertMany(dummyUsers);

  // Total users in DB = 55 + 1 (admin created in beforeEach) = 56 users
  // Limit = 50 per page -> Page 1: 50 items, Page 2: 6 items. Total pages = 2.

  // 1. Page 1 query
  const resPage1 = await request(app)
    .get('/api/v1/users?page=1')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(resPage1.status, 200);
  assert.equal(resPage1.body.success, true);
  assert.ok(Array.isArray(resPage1.body.data), 'body.data must be an array');
  assert.equal(resPage1.body.data.length, 50, 'Page 1 must contain exactly 50 items');

  const p1 = resPage1.body.pagination;
  assert.ok(p1, 'body.pagination envelope must exist');
  assert.equal(typeof p1.totalItems, 'number', 'Field 1: totalItems must be a number');
  assert.equal(typeof p1.totalPages, 'number', 'Field 2: totalPages must be a number');
  assert.equal(typeof p1.currentPage, 'number', 'Field 3: currentPage must be a number');
  assert.equal(typeof p1.limit, 'number', 'Field 4: limit must be a number');
  assert.equal(typeof p1.hasNextPage, 'boolean', 'Field 5: hasNextPage must be a boolean');
  assert.equal(typeof p1.hasPrevPage, 'boolean', 'Field 6: hasPrevPage must be a boolean');

  assert.equal(p1.totalItems, 56);
  assert.equal(p1.totalPages, 2);
  assert.equal(p1.currentPage, 1);
  assert.equal(p1.limit, 50);
  assert.equal(p1.hasNextPage, true, 'Page 1 must have next page');
  assert.equal(p1.hasPrevPage, false, 'Page 1 must NOT have prev page');

  // 2. Page 2 query
  const resPage2 = await request(app)
    .get('/api/v1/users?page=2')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(resPage2.status, 200);
  assert.equal(resPage2.body.data.length, 6, 'Page 2 must contain remaining 6 items');
  const p2 = resPage2.body.pagination;
  assert.equal(p2.currentPage, 2);
  assert.equal(p2.hasNextPage, false, 'Page 2 must NOT have next page');
  assert.equal(p2.hasPrevPage, true, 'Page 2 must have prev page');

  // 3. Edge case: Invalid / negative page number
  const resInvalidPage = await request(app)
    .get('/api/v1/users?page=-99')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resInvalidPage.status, 200);
  assert.equal(resInvalidPage.body.pagination.currentPage, 1, 'Negative page must fallback to page 1');

  // 4. Role filter envelope check
  const resFiltered = await request(app)
    .get('/api/v1/users?role=ORGANIZER')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resFiltered.status, 200);
  assert.ok(resFiltered.body.data.every(u => u.role === 'ORGANIZER'));
  assert.equal(resFiltered.body.pagination.totalItems, 28); // 28 organizers out of 55
});

// ============================================================================
// CHALLENGE 5: Password Reset Flow & Immediate Token Revocation (Issue B4)
// ============================================================================
test('CHALLENGE 5.1: Password reset flow revokes existing JWTs immediately via tokenVersion', async () => {
  const targetUser = await User.create({
    fullName: 'Token Revoke Subject',
    email: 'subject@pau.edu.tr',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: 'ADMIN',
    isEmailVerified: true,
    tokenVersion: 0
  });

  // Old valid token
  const initialJwt = generateToken({
    id: targetUser._id,
    role: targetUser.role,
    tokenVersion: targetUser.tokenVersion
  });

  // Verify initial JWT works
  const initialRes = await request(app)
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${initialJwt}`);
  assert.equal(initialRes.status, 200, 'Initial JWT should authenticate');

  // Generate password reset OTP
  const resetOtp = await VerificationToken.generateOtp('subject@pau.edu.tr', 'PASSWORD_RESET', 10);

  // Reset password
  const resetRes = await request(app)
    .post('/api/v1/auth/reset-password')
    .send({
      email: 'subject@pau.edu.tr',
      code: resetOtp,
      newPassword: 'BrandNewSecurePassword123!'
    });

  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // Crucial Security Challenge: Old JWT MUST BE REJECTED IMMEDIATELY!
  const revokedRes = await request(app)
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${initialJwt}`);
  assert.equal(revokedRes.status, 401, 'Revoked JWT with old tokenVersion must receive 401 Unauthorized');
});

// ============================================================================
// CHALLENGE 6: Deprecated Schemas & Attributes (Issue A2)
// ============================================================================
test('CHALLENGE 6.1: User.permissions is not exposed by default query & Team model deprecation notice', async () => {
  const user = await User.findOne({ email: adminUser.email });
  assert.equal(user.permissions, undefined, 'user.permissions must be excluded from default query (select: false)');

  const Team = require('../../src/models/Team');
  assert.ok(Team, 'Team model exists for backwards compatibility');
});
