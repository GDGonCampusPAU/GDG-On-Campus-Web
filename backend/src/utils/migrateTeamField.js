// Replaces the legacy team questions (teamName / teamRole / teammates) of the published
// hackathon page with the single `team` field from shared/hackathon-event.json.
// Usage: npm run migrate:team-field --workspace backend            (dry run)
//        npm run migrate:team-field --workspace backend -- --apply (writes)
// Safe to re-run: pages that already have a `team` field are left alone.
require('dotenv').config();
const mongoose = require('mongoose');
const EventPage = require('../models/EventPage');
const { savePage } = require('../services/eventPageService');
const base = require('../../../shared/hackathon-event.json');

const LEGACY = ['teamName', 'teamRole', 'teammates'];
const teamField = base.register.steps.flatMap(step => step.fields).find(field => field.kind === 'team');

/** @returns {{ event: any, changed: boolean, reason: string }} */
const migrateEvent = (event) => {
  const steps = event.register.steps;
  if (steps.some(step => step.fields.some(field => field.kind === 'team'))) return { event, changed: false, reason: 'zaten bir takım alanı var' };
  const index = steps.findIndex(step => step.fields.some(field => LEGACY.includes(field.id)));
  if (index === -1) return { event, changed: false, reason: 'eski takım alanları bulunamadı' };
  const fields = steps[index].fields;
  const first = fields.findIndex(field => LEGACY.includes(field.id));
  const kept = fields.filter(field => !LEGACY.includes(field.id));
  const nextFields = [...kept.slice(0, first), structuredClone(teamField), ...kept.slice(first)];
  const nextSteps = steps.map((step, i) => (i === index ? { ...step, fields: nextFields } : step));
  return { event: { ...event, register: { ...event.register, steps: nextSteps } }, changed: true, reason: `"${steps[index].title}" adımında ${fields.length - kept.length} eski alan → 1 takım alanı` };
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gdg_pau');
  try {
    const page = await EventPage.findById('hackathon').lean();
    if (!page) return console.log('[migrate] Etkinlik sayfası yok; sunucu ilk açılışta yeni şablonla oluşturur.');
    const { event, changed, reason } = migrateEvent(page.event);
    console.log(`[migrate] ${reason}.`);
    if (!changed) return;
    if (!apply) return console.log('[migrate] Deneme modu: değişiklik yazılmadı. Uygulamak için --apply ekleyin.');
    const saved = await savePage(event, page.revision, null);
    console.log(`[migrate] Yayınlandı (sürüm ${page.revision} → ${saved?.revision}); başvuru formu da güncellendi.`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error) => { console.error('[migrate] Hata:', error.message); process.exitCode = 1; });
}

module.exports = { migrateEvent };
