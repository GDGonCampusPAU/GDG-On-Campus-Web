process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-application-status-32-chars!';
process.env.PARTICIPANT_JWT_SECRET = 'participant-secret-app-status-32-chars!!';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const EventPage = require('../src/models/EventPage');
const HackathonApp = require('../src/modules/hackathon/models/HackathonApp');
const { ensureHackathonPage } = require('../src/services/eventPageService');
const { generateToken } = require('../src/utils/jwt');
const {
  DEFAULT_HACKATHON_WHATSAPP_URL,
  escapeHtml,
  getEmailProfile,
  sendApplicationStatusEmail,
  sendWhatsappInviteEmail
} = require('../src/services/emailService');

let replica;
let organizer;
let organizerToken;
let memberToken;
let hackathonForm;

test.before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(replica.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  organizer = await User.create({
    fullName: 'Organizer Reviewer',
    email: 'organizer-review@pau.edu.tr',
    passwordHash: 'hashed-password-placeholder',
    role: 'ORGANIZER',
    isEmailVerified: true
  });
  const member = await User.create({
    fullName: 'Regular Member',
    email: 'member-review@gmail.com',
    passwordHash: 'hashed-password-placeholder',
    role: 'MEMBER',
    isEmailVerified: true
  });

  organizerToken = generateToken({ id: organizer._id, role: organizer.role, email: organizer.email });
  memberToken = generateToken({ id: member._id, role: member.role, email: member.email });

  await ensureHackathonPage();
  const page = await EventPage.findById('hackathon');
  hackathonForm = await Form.findOne({ slug: page.formSlug });
});

test.after(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test.beforeEach(async () => {
  await FormResponse.deleteMany({});
  await HackathonApp.deleteMany({});
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
  delete process.env.BREVO_SENDER_NAME;
  delete process.env.BREVO_REPLY_TO;
  delete process.env.BREVO_APPLICATION_SENDER_EMAIL;
  delete process.env.BREVO_APPLICATION_SENDER_NAME;
  delete process.env.BREVO_APPLICATION_REPLY_TO;
});

test('emailService resolves default and applicationStatus sender / reply-to profiles and sends escaped Brevo payload', async () => {
  process.env.BREVO_API_KEY = 'xkeysib-test-secret';
  process.env.BREVO_SENDER_EMAIL = 'noreply@gdgpau.org';
  process.env.BREVO_SENDER_NAME = 'GDG PAU System';
  process.env.BREVO_REPLY_TO = 'gdgocpau@gmail.com';
  process.env.BREVO_APPLICATION_SENDER_EMAIL = 'hackathon@gdgpau.org';

  assert.deepEqual(getEmailProfile('default'), {
    senderEmail: 'noreply@gdgpau.org',
    senderName: 'GDG PAU System',
    replyTo: 'gdgocpau@gmail.com'
  });
  assert.deepEqual(getEmailProfile('applicationStatus'), {
    senderEmail: 'hackathon@gdgpau.org',
    senderName: 'GDG PAU System',
    replyTo: 'gdgocpau@gmail.com'
  });

  const captured = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    captured.push({ url, init, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 201,
      json: async () => ({ messageId: '<msg-123>' })
    };
  };

  try {
    const result = await sendApplicationStatusEmail({
      email: 'team@example.com',
      recipientName: 'Ayşe <script>alert(1)</script>',
      teamName: 'Takım "Alpha"\r\nBcc: evil@evil.com',
      eventTitle: 'PAU Hackathon 2026',
      status: 'APPROVED',
      note: 'Tebrikler!\nStand saat 09:00\'da açılıyor <img src=x>'
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, '<msg-123>');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(captured[0].init.headers['api-key'], 'xkeysib-test-secret');
    assert.deepEqual(captured[0].body.sender, { name: 'GDG PAU System', email: 'hackathon@gdgpau.org' });
    assert.deepEqual(captured[0].body.replyTo, { email: 'gdgocpau@gmail.com' });
    assert.ok(!captured[0].body.htmlContent.includes('<script>'));
    assert.ok(!captured[0].body.htmlContent.includes('<img src=x>'));
    assert.ok(captured[0].body.htmlContent.includes('&lt;script&gt;'));
    assert.ok(captured[0].body.htmlContent.includes(escapeHtml(DEFAULT_HACKATHON_WHATSAPP_URL)));
    assert.ok(captured[0].body.textContent.includes(DEFAULT_HACKATHON_WHATSAPP_URL));
    assert.ok(!captured[0].body.subject.includes('\n'));

    await sendApplicationStatusEmail({
      email: 'rejected@example.com',
      recipientName: 'Veli',
      eventTitle: 'Pamukkale Hackathon',
      status: 'REJECTED'
    });
    assert.ok(!captured[1].body.htmlContent.includes('chat.whatsapp.com'));

    await sendWhatsappInviteEmail({
      email: 'invite@example.com',
      recipientName: 'Zeynep <Admin>',
      teamName: 'Takım Beta',
      eventTitle: 'Pamukkale Hackathon'
    });
    assert.equal(captured[2].body.to[0].email, 'invite@example.com');
    assert.ok(captured[2].body.htmlContent.includes('&lt;Admin&gt;'));
    assert.ok(captured[2].body.htmlContent.includes(escapeHtml(DEFAULT_HACKATHON_WHATSAPP_URL)));
    assert.ok(captured[2].body.textContent.includes(DEFAULT_HACKATHON_WHATSAPP_URL));
  } finally {
    global.fetch = originalFetch;
  }
});

test('FormResponse status workflow: RBAC, IDOR check, status updates, filtering, CSV export, and rollback on email failure', async () => {
  const r1 = await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'ayse@example.com',
    answers: [
      { fieldId: 'fullName', label: 'Ad soyad', value: 'Ayşe Yılmaz' },
      { fieldId: 'teamName', label: 'Takım adı', value: 'Yıldız Ekibi' }
    ]
  });
  const r2 = await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'mehmet@example.com',
    answers: [
      { fieldId: 'fullName', label: 'Ad soyad', value: 'Mehmet Demir' }
    ]
  });
  // Simulate a pre-existing DB document without physical `status` field
  await FormResponse.collection.updateOne({ _id: r2._id }, { $unset: { status: '' } });

  // RBAC enforcement
  const unauth = await request(app)
    .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r1._id}/status`)
    .send({ status: 'APPROVED' });
  assert.equal(unauth.status, 401);

  const forbidden = await request(app)
    .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r1._id}/status`)
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ status: 'APPROVED' });
  assert.equal(forbidden.status, 403);

  // Cross-form IDOR protection
  const otherForm = await Form.create({ title: 'Diğer Form', slug: 'diger-form', status: 'DRAFT' });
  const crossForm = await request(app)
    .patch(`/api/v1/forms/${otherForm._id}/responses/${r1._id}/status`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ status: 'APPROVED' });
  assert.equal(crossForm.status, 404);

  // Invalid inputs
  const invalidStatus = await request(app)
    .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r1._id}/status`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ status: 'UNKNOWN' });
  assert.equal(invalidStatus.status, 400);

  const notifyPending = await request(app)
    .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r1._id}/status`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ status: 'PENDING', notify: true });
  assert.equal(notifyPending.status, 400);

  // Approve r1 with simulated Brevo email delivery
  const sentPayloads = [];
  process.env.BREVO_API_KEY = 'xkeysib-live-mock';
  process.env.BREVO_SENDER_EMAIL = 'noreply@gdgpau.org';
  process.env.BREVO_REPLY_TO = 'gdgocpau@gmail.com';
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    sentPayloads.push(JSON.parse(init.body));
    return { ok: true, status: 201, json: async () => ({ messageId: 'ok-1' }) };
  };

  try {
    const approveRes = await request(app)
      .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r1._id}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'APPROVED', note: 'Finalist olarak seçildiniz.' });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.emailSent, true);
    assert.equal(approveRes.body.data.status, 'APPROVED');
    assert.equal(approveRes.body.data.statusNote, 'Finalist olarak seçildiniz.');
    assert.equal(approveRes.body.data.lastNotifiedStatus, 'APPROVED');
    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].to[0].email, 'ayse@example.com');
    assert.ok(sentPayloads[0].subject.includes('PAU Hackathon 2026'));
    assert.ok(sentPayloads[0].htmlContent.includes('Finalist olarak seçildiniz.'));
  } finally {
    global.fetch = originalFetch;
  }

  // Filtering & combined search + status on GET /responses (including legacy unset status under PENDING)
  const pendingList = await request(app)
    .get(`/api/v1/forms/${hackathonForm._id}/responses?status=PENDING`)
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(pendingList.status, 200);
  assert.equal(pendingList.body.data.length, 1);
  assert.equal(pendingList.body.data[0].verifiedEmail, 'mehmet@example.com');
  assert.equal(pendingList.body.data[0].status, 'PENDING');

  const approvedSearch = await request(app)
    .get(`/api/v1/forms/${hackathonForm._id}/responses?status=APPROVED&search=Ay%C5%9Fe`)
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(approvedSearch.status, 200);
  assert.equal(approvedSearch.body.data.length, 1);
  assert.equal(approvedSearch.body.data[0].verifiedEmail, 'ayse@example.com');

  // CSV export filtered by status includes status & note columns
  const csvRes = await request(app)
    .get(`/api/v1/forms/${hackathonForm._id}/responses/export?status=APPROVED`)
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.text, /Başvuru Durumu/);
  assert.match(csvRes.text, /ayse@example\.com/);
  assert.match(csvRes.text, /APPROVED/);
  assert.match(csvRes.text, /Finalist olarak seçildiniz\./);
  assert.doesNotMatch(csvRes.text, /mehmet@example\.com/);

  // Rollback verification when Brevo rejects / errors
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'Brevo outage' })
  });
  try {
    const failReject = await request(app)
      .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r2._id}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'REJECTED', note: 'Kontenjan dolu' });

    assert.equal(failReject.status, 502);
    const unchanged = await FormResponse.findById(r2._id).lean();
    assert.equal(unchanged.status, 'PENDING');
    assert.equal(unchanged.statusNote, '');
  } finally {
    global.fetch = originalFetch;
  }

  // notify: false skips Brevo and persists status directly
  const silentReject = await request(app)
    .patch(`/api/v1/forms/${hackathonForm._id}/responses/${r2._id}/status`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ status: 'REJECTED', note: 'İç not', notify: false });
  assert.equal(silentReject.status, 200);
  assert.equal(silentReject.body.emailSent, false);
  assert.equal(silentReject.body.data.status, 'REJECTED');
  assert.equal(silentReject.body.data.lastNotifiedAt, null);
});

test('Legacy HackathonApp status workflow updates status, sends email, filters list & CSV export', async () => {
  const legacyApp = await HackathonApp.create({
    teamName: 'Legacy Phoenix',
    leaderName: 'Can Kaya',
    leaderEmail: 'can@example.com',
    leaderPhone: '+905551112233',
    memberCount: 3,
    projectIdea: 'Solar monitor'
  });

  const sent = [];
  process.env.BREVO_API_KEY = 'xkeysib-legacy-test';
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 201, json: async () => ({ messageId: 'legacy-1' }) };
  };

  try {
    const res = await request(app)
      .patch(`/api/v1/hackathon/applications/${legacyApp._id}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'APPROVED', note: 'Hoş geldiniz' });

    assert.equal(res.status, 200);
    assert.equal(res.body.emailSent, true);
    assert.equal(res.body.data.status, 'APPROVED');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].email, 'can@example.com');
  } finally {
    global.fetch = originalFetch;
  }

  const listApproved = await request(app)
    .get('/api/v1/hackathon/applications?status=APPROVED')
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(listApproved.status, 200);
  assert.equal(listApproved.body.data.length, 1);
  assert.equal(listApproved.body.data[0].teamName, 'Legacy Phoenix');

  const listRejected = await request(app)
    .get('/api/v1/hackathon/applications?status=REJECTED')
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(listRejected.status, 200);
  assert.equal(listRejected.body.data.length, 0);

  const exportCsv = await request(app)
    .get('/api/v1/hackathon/applications/export?status=APPROVED')
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(exportCsv.status, 200);
  assert.match(exportCsv.text, /Legacy Phoenix/);
  assert.match(exportCsv.text, /APPROVED/);
});

test('WhatsApp invite endpoint sends individual emails only to uninvited APPROVED applicants and prevents duplicates', async () => {
  const approved1 = await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'bir@example.com',
    status: 'APPROVED',
    answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Birinci Kişi' }]
  });
  const approved2 = await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'iki@example.com',
    status: 'APPROVED',
    answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'İkinci Kişi' }]
  });
  await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'bekleyen@example.com',
    status: 'PENDING',
    answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Bekleyen Kişi' }]
  });
  await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'red@example.com',
    status: 'REJECTED',
    answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Reddedilen Kişi' }]
  });
  const alreadyInvited = await FormResponse.create({
    form: hackathonForm._id,
    formSlug: hackathonForm.slug,
    verifiedEmail: 'eski@example.com',
    status: 'APPROVED',
    whatsappInvitedAt: new Date('2026-11-20T10:00:00Z'),
    answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Önceden Davetli' }]
  });

  // RBAC check
  assert.equal((await request(app).post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)).status, 401);
  assert.equal((await request(app).post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`).set('Authorization', `Bearer ${memberToken}`)).status, 403);

  const listBefore = await request(app)
    .get(`/api/v1/forms/${hackathonForm._id}/responses`)
    .set('Authorization', `Bearer ${organizerToken}`);
  assert.equal(listBefore.status, 200);
  assert.equal(listBefore.body.whatsappPending, 2);

  // Simulate partial failure: 1st succeeds, 2nd fails -> 1st is marked invited, 2nd stays pending
  process.env.BREVO_API_KEY = 'xkeysib-wp-test';
  const sentPayloads = [];
  const originalFetch = global.fetch;
  let attempt = 0;
  global.fetch = async (url, init) => {
    attempt += 1;
    const body = JSON.parse(init.body);
    if (attempt === 2) {
      return { ok: false, status: 500, json: async () => ({ message: 'Temporary error' }) };
    }
    sentPayloads.push(body);
    return { ok: true, status: 201, json: async () => ({ messageId: `wp-${attempt}` }) };
  };

  try {
    const partialRes = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({});
    assert.equal(partialRes.status, 200);
    assert.equal(partialRes.body.data.sentCount, 1);
    assert.equal(partialRes.body.data.failedCount, 1);
    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].to.length, 1);
    assert.equal(sentPayloads[0].to[0].email, 'bir@example.com');
    assert.ok(sentPayloads[0].htmlContent.includes(escapeHtml(DEFAULT_HACKATHON_WHATSAPP_URL)));
    assert.ok(sentPayloads[0].textContent.includes(DEFAULT_HACKATHON_WHATSAPP_URL));

    // Retry sends ONLY to approved2 (not approved1, not alreadyInvited, not pending/rejected)
    const retryRes = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({});
    assert.equal(retryRes.status, 200);
    assert.equal(retryRes.body.data.sentCount, 1);
    assert.equal(retryRes.body.data.failedCount, 0);
    assert.equal(sentPayloads.length, 2);
    assert.equal(sentPayloads[1].to[0].email, 'iki@example.com');

    // Third run sends 0 emails
    const emptyRes = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({});
    assert.equal(emptyRes.status, 200);
    assert.equal(emptyRes.body.data.totalPending, 0);
    assert.equal(emptyRes.body.data.sentCount, 0);
    assert.equal(sentPayloads.length, 2);

    // Newly approving a pending applicant with notify: true sends approval email WITH WP link & sets whatsappInvitedAt
    const pendingDoc = await FormResponse.findOne({ verifiedEmail: 'bekleyen@example.com' });
    const approveNew = await request(app)
      .patch(`/api/v1/forms/${hackathonForm._id}/responses/${pendingDoc._id}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'APPROVED' });
    assert.equal(approveNew.status, 200);
    assert.ok(approveNew.body.data.whatsappInvitedAt);
    assert.equal(sentPayloads.length, 3);
    assert.equal(sentPayloads[2].to[0].email, 'bekleyen@example.com');
    assert.ok(sentPayloads[2].htmlContent.includes(escapeHtml(DEFAULT_HACKATHON_WHATSAPP_URL)));
    assert.ok(sentPayloads[2].textContent.includes(DEFAULT_HACKATHON_WHATSAPP_URL));

    // Batch invite still has 0 pending!
    const afterApprove = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({});
    assert.equal(afterApprove.body.data.totalPending, 0);
    assert.equal(sentPayloads.length, 3);

    // Individual invite on already-invited response is rejected with 409
    const dupRes = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ responseId: String(alreadyInvited._id) });
    assert.equal(dupRes.status, 409);

    // Silent approval (notify: false) leaves whatsappInvitedAt null, then single responseId invite sends only to them
    const silent = await FormResponse.create({
      form: hackathonForm._id,
      formSlug: hackathonForm.slug,
      verifiedEmail: 'sessiz@example.com',
      status: 'APPROVED',
      answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Sessiz Onay' }]
    });
    const singleRes = await request(app)
      .post(`/api/v1/forms/${hackathonForm._id}/responses/whatsapp-invite`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ responseId: String(silent._id) });
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.body.data.sentCount, 1);
    assert.equal(sentPayloads.length, 4);
    assert.equal(sentPayloads[3].to[0].email, 'sessiz@example.com');

    assert.ok((await FormResponse.findById(approved1._id)).whatsappInvitedAt);
    assert.ok((await FormResponse.findById(approved2._id)).whatsappInvitedAt);
  } finally {
    global.fetch = originalFetch;
  }
});

