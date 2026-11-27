// Canlı verinin YEREL kopyasıyla çalışan backend (yalnız bu bilgisayar, 127.0.0.1:5010).
//
// - Veritabanı: bellek-içi MongoDB 7, veriler GDG_KOPYA_DIR/db içinde kalıcı. Boşsa dump.archive.gz yüklenir.
// - Hiç mail gitmez: Brevo ayarları silinir, emailService'in her fonksiyonu yakalanır (bkz. /__yerel__/mail).
// - Hiçbir istek dışarı çıkmaz: no-outbound.cjs (node --require) localhost dışını engeller, GitHub → sahte GitHub.
// - /__yerel__/* uç noktaları cli.mjs içindir: kişi listesi, tarayıcıya konacak oturumlar, yakalanan mailler.
//   Yalnız 127.0.0.1'de dinlenir; canlı sunucuda bu dosya hiç çalışmaz.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DATA = process.env.GDG_KOPYA_DIR;
if (!DATA) throw new Error('GDG_KOPYA_DIR yok: bu dosyayı cli.mjs başlatır.');
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.GDG_KOPYA_API_PORT || 5010);
const MONGO_PORT = Number(process.env.GDG_KOPYA_MONGO_PORT || 27099);
const UPLOAD_URL = process.env.PROJECT_UPLOAD_URL;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'canli-kopya-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'canli-kopya-participant-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_EXPIRES_IN = '12h';
process.env.CLIENT_URLS = ['4173', '4174'].flatMap(p => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]).join(',');
process.env.UPLOAD_DIR = path.join(DATA, 'uploads');
for (const key of Object.keys(process.env)) if (key.startsWith('BREVO_')) delete process.env[key];
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GITHUB_TOKEN;
fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// --- Mailler gönderilmez, burada toplanır --------------------------------------------------------
const mail = require(path.join(ROOT, 'backend/src/services/emailService'));
const codes = new Map();
const outbox = [];
for (const [name, fn] of Object.entries(mail)) {
  if (typeof fn !== 'function') continue;
  mail[name] = async (...args) => {
    const msg = args[0] || {};
    const to = msg.to || msg.email || (Array.isArray(msg.recipients) ? msg.recipients.join(',') : '?');
    const code = msg.code || String(msg.textContent || msg.htmlContent || '').match(/\b\d{6}\b/)?.[0] || null;
    if (code && typeof to === 'string') codes.set(to.toLowerCase(), code);
    outbox.push({ at: new Date().toISOString(), fn: name, to, subject: msg.subject || '', code });
    console.log(`[mail YAKALANDI, gönderilmedi] ${name} → ${to}${code ? ` · kod ${code}` : ''}`);
    return { success: true, captured: true };
  };
}

const app = require(path.join(ROOT, 'backend/src/app'));
const User = require(path.join(ROOT, 'backend/src/models/User'));
const Form = require(path.join(ROOT, 'backend/src/models/Form'));
const HackathonTeam = require(path.join(ROOT, 'backend/src/models/HackathonTeam'));
const FormResponse = require(path.join(ROOT, 'backend/src/models/FormResponse'));
const Participant = require(path.join(ROOT, 'backend/src/modules/participantAuth/models/Participant'));
const ProjectSubmission = require(path.join(ROOT, 'backend/src/modules/projectUpload/models/ProjectSubmission'));
const JudgingConfig = require(path.join(ROOT, 'backend/src/modules/jury/models/JudgingConfig'));
const Juror = require(path.join(ROOT, 'backend/src/modules/jury/models/Juror'));
const { generateToken } = require(path.join(ROOT, 'backend/src/utils/jwt'));
const { issueToken } = require(path.join(ROOT, 'backend/src/modules/participantAuth/services/tokenService'));
const jurorAdmin = require(path.join(ROOT, 'backend/src/modules/jury/services/jurorAdminService'));
const projectUpload = require(path.join(ROOT, 'backend/src/modules/projectUpload/services/projectUploadService'));

const LOCAL_ADMIN = { email: 'yerel-admin@pau.edu.tr', password: 'yerel-admin-sifre' };
const FORM_SLUG = 'hackathon-katilim';

const restore = () => new Promise((resolve, reject) => {
  const dump = path.join(DATA, 'dump.archive.gz');
  if (!fs.existsSync(dump)) return reject(new Error(`Döküm yok: ${dump}. Önce "veri-cek" çalıştır.`));
  console.log('[kopya] canlı verinin dökümü yükleniyor…');
  const child = spawn('docker', ['run', '--rm', '-i', '--network', 'host', 'mongo:8.0', 'mongorestore', '--quiet', '--archive', '--gzip',
    '--nsExclude', 'admin.*', '--uri', `mongodb://127.0.0.1:${MONGO_PORT}/?replicaSet=rs0&directConnection=true`], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.on('error', reject);
  child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`mongorestore çıkış kodu ${code}`))));
  child.stdin.end(fs.readFileSync(dump));
});

// --- cli.mjs uç noktaları ----------------------------------------------------------------------
const harness = express();
harness.use('/__yerel__', express.json());
const wrap = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
const fail = (status, message) => Object.assign(new Error(message), { status });
const hackathonForm = async () => Form.findOne({ slug: FORM_SLUG });
const userView = user => ({ id: String(user._id), fullName: user.fullName, email: user.email, role: user.role });
const staffSession = async (email) => {
  const user = await User.findOne(email ? { email: email.toLowerCase() } : { email: LOCAL_ADMIN.email });
  if (!user) throw fail(404, `Kullanıcı yok: ${email}`);
  if (!['ADMIN', 'ORGANIZER'].includes(user.role)) throw fail(400, `${user.email} yönetici değil (${user.role}).`);
  const token = generateToken({ id: user._id, role: user.role, email: user.email, tokenVersion: user.tokenVersion || 0 });
  return { token, user: userView(user) };
};
const participantByEmail = async (email) => {
  const participant = await Participant.findOne({ email: String(email || '').toLowerCase().trim() });
  if (!participant) throw fail(404, `Katılımcı yok: ${email}. "kisiler" ile listele.`);
  return participant;
};

harness.get('/__yerel__/otp', (req, res) => res.json({ code: codes.get(String(req.query.email || '').toLowerCase()) || null }));
harness.get('/__yerel__/mail', (_req, res) => res.json(outbox.slice(-100)));

harness.get('/__yerel__/kisiler', wrap(async (req) => {
  const q = String(req.query.q || '').toLocaleLowerCase('tr-TR');
  const form = await hackathonForm();
  const [staff, teams, participants, responses, config, uploads, jurors] = await Promise.all([
    User.find({ role: { $in: ['ADMIN', 'ORGANIZER'] } }).select('fullName email role').lean(),
    HackathonTeam.find(form ? { form: form._id } : {}).lean(),
    Participant.find().select('email fullName').lean(),
    FormResponse.find(form ? { form: form._id } : {}).select('participant answers').lean(),
    JudgingConfig.findById(JudgingConfig.CONFIG_ID).select('entries').lean(),
    ProjectSubmission.find().select('team repoUrl projectName').lean(),
    Juror.find().select('name active').lean()
  ]);
  const competing = new Set((config?.entries || []).map(e => String(e.team)));
  const linkOf = new Map(uploads.map(u => [String(u.team), u]));
  const memberOf = new Map();
  for (const team of teams) {
    memberOf.set(String(team.captain.participant), { team, role: 'kaptan' });
    for (const m of team.members) memberOf.set(String(m.participant), { team, role: m.status === 'APPROVED' ? 'üye' : `üye (${m.status.toLowerCase()})` });
  }
  const applied = new Set(responses.map(r => String(r.participant)));
  const match = (...values) => !q || values.some(v => String(v || '').toLocaleLowerCase('tr-TR').includes(q));
  return {
    staff: staff.filter(u => match(u.email, u.fullName, u.role)).map(userView),
    jurors: jurors.filter(j => match(j.name)).map(j => ({ name: j.name, active: j.active !== false })),
    teams: teams.filter(t => match(t.name, t.code)).map(t => ({ name: t.name, code: t.code, competing: competing.has(String(t._id)),
      link: linkOf.get(String(t._id))?.repoUrl || '', projectName: linkOf.get(String(t._id))?.projectName || '',
      members: 1 + t.members.filter(m => m.status === 'APPROVED').length })),
    participants: participants.filter(p => {
      const m = memberOf.get(String(p._id));
      return match(p.email, p.fullName, m?.team.name);
    }).map(p => {
      const m = memberOf.get(String(p._id));
      return { email: p.email, fullName: p.fullName || '', applied: applied.has(String(p._id)), team: m?.team.name || '', role: m?.role || '',
        competing: m ? competing.has(String(m.team._id)) : false };
    }).sort((a, b) => (Number(!a.team) - Number(!b.team)) || a.team.localeCompare(b.team, 'tr') || a.email.localeCompare(b.email))
  };
}));

// Tarayıcıya konacak oturum: hangi sayfa açılacak, hangi depolamaya ne yazılacak.
harness.post('/__yerel__/oturum', wrap(async (req) => {
  const { tur, kim } = req.body || {};
  if (tur === 'admin') {
    const session = await staffSession(kim);
    return {
      label: `${session.user.fullName} (${session.user.role})`,
      storage: [
        { origin: 'http://127.0.0.1:4174', localStorage: { 'gdg-pau-session': JSON.stringify(session) } },
        { origin: 'http://127.0.0.1:4173', sessionStorage: { 'hackathon-admin-unlocked': JSON.stringify(session) } }
      ],
      pages: [{ url: 'http://127.0.0.1:4174/' }, { url: 'http://127.0.0.1:4173/admin/juri' }]
    };
  }
  if (tur === 'katilimci') {
    const participant = await participantByEmail(kim);
    const identity = issueToken(participant, 'EMAIL_OTP');
    identity.participant.id = String(identity.participant.id);
    return {
      label: participant.email,
      storage: [{ origin: 'http://127.0.0.1:4173', localStorage: {
        'hackaton:register-identity': JSON.stringify({ savedAt: Date.now(), identity }) } }],
      // Başvurum, doğrulanmış kimliği sayfa geçişinin durumundan (history.state.usr) okur.
      pages: [{ url: 'http://127.0.0.1:4173/basvurum', historyState: { identity } }]
    };
  }
  if (tur === 'yukleme') {
    const participant = await participantByEmail(kim);
    const form = await hackathonForm();
    if (!UPLOAD_URL) throw fail(500, 'PROJECT_UPLOAD_URL yok.');
    const handoff = await projectUpload.issueHandoff(form, participant);
    return { label: `${participant.email} · proje yükleme`, storage: [], pages: [{ url: handoff.url }] };
  }
  if (tur === 'juri') {
    const admin = await User.findOne({ email: LOCAL_ADMIN.email });
    const name = String(kim || '').trim();
    let juror = name ? await Juror.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }) : null;
    // Jüri linkinin kendisi saklanmaz (yalnız özeti): bu yerel kopyada yenisi üretilir, eski yerel link geçersizleşir.
    const issued = juror
      ? await jurorAdmin.regenerateToken(String(juror._id), admin)
      : await jurorAdmin.createJuror(name || `Yerel Jüri ${new Date().toLocaleTimeString('tr-TR')}`, admin);
    return { label: `Jüri: ${issued.juror?.name || name}`, storage: [], pages: [{ url: `http://127.0.0.1:4173/juri/${issued.token}` }] };
  }
  throw fail(400, `Bilinmeyen tür: ${tur}`);
}));
harness.use(app);

// --- Başlat --------------------------------------------------------------------------------------
let replica, server;
async function start() {
  fs.mkdirSync(path.join(DATA, 'db'), { recursive: true });
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, name: 'rs0' }, binary: { version: '7.0.24' },
    instanceOpts: [{ port: MONGO_PORT, dbPath: path.join(DATA, 'db'), storageEngine: 'wiredTiger' }] });
  await mongoose.connect(replica.getUri('gdg_pau'));
  if (!(await mongoose.connection.db.collection('participants').estimatedDocumentCount())) await restore();
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  await require(path.join(ROOT, 'backend/src/modules/jury')).init();
  if (!(await User.exists({ email: LOCAL_ADMIN.email }))) {
    await User.create({ fullName: 'Yerel Admin', email: LOCAL_ADMIN.email, role: 'ADMIN', isEmailVerified: true,
      passwordHash: await bcrypt.hash(LOCAL_ADMIN.password, 4) });
  }
  server = harness.listen(PORT, '127.0.0.1', async () => {
    const db = mongoose.connection.db;
    const counts = {};
    for (const c of await db.listCollections().toArray()) counts[c.name] = await db.collection(c.name).estimatedDocumentCount();
    console.log(`[kopya] hazır · katılımcı ${counts.participants ?? 0} · başvuru ${counts.formresponses ?? 0} · takım ${counts.hackathonteams ?? 0} · proje linki ${counts.projectsubmissions ?? 0}`);
  });
}
async function stop(code = 0) {
  server?.close();
  await mongoose.disconnect().catch(() => {});
  if (replica) await replica.stop({ doCleanup: false, force: false }).catch(() => {});
  process.exit(code);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
start().catch(error => { console.error('[kopya] başlatılamadı:', error.message); void stop(1); });
