// Test-only process: never imports .env or connects to the development database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'e2e-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'e2e-participant-secret-never-use-in-production';
process.env.CLIENT_URLS = 'http://127.0.0.1:4173,http://127.0.0.1:4174';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gdg-e2e-uploads-'));
delete process.env.BREVO_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;
const express = require('../backend/node_modules/express');
const mongoose = require('../backend/node_modules/mongoose');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { MongoMemoryReplSet } = require('../backend/node_modules/mongodb-memory-server');
const mail = require('../backend/src/services/emailService');
const codes = new Map();
mail.sendEmail = async message => { codes.set(message.to, message.textContent.match(/\d{6}/)[0]); };
mail.sendRegistrationOtpEmail = mail.sendHackathonOtpEmail = async message => { codes.set(message.email, message.code); };
const app = require('../backend/src/app');
const User = require('../backend/src/models/User');
const Response = require('../backend/src/models/FormResponse');
let replica, server;
async function start() {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(replica.getUri());
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  await require('../backend/src/services/eventPageService').ensureHackathonPage();
  await User.create({ fullName: 'E2E Admin', email: 'admin@pau.edu.tr', role: 'ADMIN', isEmailVerified: true,
    passwordHash: await bcrypt.hash('e2e-admin-password', 4) });
  const harness = express();
  harness.get('/__test__/otp', (req, res) => res.json({ code: codes.get(req.query.email) }));
  harness.get('/__test__/state', async (_req, res) => res.json({ responses: await Response.countDocuments() }));
  harness.use(app);
  server = harness.listen(5010, '127.0.0.1');
}
async function stop(code = 0) {
  server?.close();
  await mongoose.disconnect();
  if (replica) await replica.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  process.exit(code);
}
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
start().catch(error => { console.error(error); void stop(1); });
