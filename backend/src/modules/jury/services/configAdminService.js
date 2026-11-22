// Staff side of the judging setup: criteria, categories, competing teams, lock and reset.
const mongoose = require('mongoose');
const EventPage = require('../../../models/EventPage');
const Form = require('../../../models/Form');
const HackathonTeam = require('../../../models/HackathonTeam');
const { FORM_SLUG } = require('../../../services/eventPageService');
const JudgingConfig = require('../models/JudgingConfig');
const Scorecard = require('../models/Scorecard');
const { loadConfig } = require('./configService');
const { record, configChanges } = require('./auditService');
const { juryError } = require('./juryError');
const { parseConfig } = require('./validation');

const { CONFIG_ID } = JudgingConfig;
const RESET_CONFIRMATION = 'SIFIRLA';

/** Registration teams of the published event (teams of other or deleted forms are not offered). */
const eventForm = async () => {
  const page = await EventPage.findById('hackathon').select('formSlug').lean();
  return Form.findOne({ slug: page?.formSlug || FORM_SLUG }).select('_id').lean();
};

const getConfig = async () => {
  const config = await loadConfig();
  const [teams, cards] = await Promise.all([
    HackathonTeam.find({ _id: { $in: config.entries.map(entry => entry.team) } }).select('_id').lean(),
    Scorecard.find().select('team').lean()
  ]);
  const existing = new Set(teams.map(team => String(team._id)));
  return {
    revision: config.revision,
    locked: config.locked,
    round: config.round,
    criteria: config.criteria,
    categories: [...config.categories].sort((a, b) => a.priority - b.priority),
    entries: [...config.entries].sort((a, b) => a.order - b.order).map(entry => ({
      ...entry,
      team: String(entry.team),
      teamMissing: !existing.has(String(entry.team)),
      scorecardCount: cards.filter(card => String(card.team) === String(entry.team)).length
    })),
    scorecardCount: cards.length
  };
};

const listTeams = async () => {
  const form = await eventForm();
  if (!form) return [];
  const teams = await HackathonTeam.find({ form: form._id }).lean();
  return teams
    .map(team => ({ id: String(team._id), name: team.name, code: team.code, memberCount: 1 + team.members.filter(member => member.status === 'APPROVED').length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
};

/** @param {any} body @param {any} user */
const saveConfig = async (body, user) => {
  const input = parseConfig(body);
  await loadConfig();
  const form = await eventForm();
  await mongoose.connection.transaction(async session => {
    const config = await JudgingConfig.findById(CONFIG_ID).session(session);
    // Every setting here shapes the result, so a lock freezes all of them (ADMIN included).
    if (config?.locked) throw juryError(423, 'Puanlama kilitliyken jüri ayarları değiştirilemez.', 'CONFIG_LOCKED');
    if (!config || config.revision !== input.revision) {
      throw juryError(409, 'Jüri ayarları başka bir oturumda güncellendi. Güncel hâli yükleyip tekrar deneyin.', 'CONFIG_CONFLICT');
    }

    const cards = await Scorecard.find().select('team').session(session).lean();
    if (cards.length) {
      // Old cards would lose a score or miss the new criterion, so the key set is frozen.
      const before = new Set(config.criteria.map(criterion => criterion.key));
      if (input.criteria.length !== before.size || input.criteria.some(criterion => !before.has(criterion.key))) {
        throw juryError(409, 'Puan kartı varken kriter eklenemez, silinemez ve anahtarı değiştirilemez.', 'CRITERIA_FROZEN');
      }
      const keys = new Set(input.categories.map(category => category.key));
      if (config.categories.some(category => !keys.has(category.key))) {
        throw juryError(409, 'Puan kartı varken kategori silinemez; pasifleştirebilirsiniz.', 'CATEGORY_IN_USE');
      }
    }

    const teams = await HackathonTeam.find({ _id: { $in: [...input.entries.map(entry => entry.team), ...config.entries.map(entry => entry.team)] } })
      .select('name form').session(session).lean();
    const teamById = new Map(teams.map(team => [String(team._id), team]));
    const previous = new Map(config.entries.map(entry => [String(entry.team), entry]));
    const kept = new Set(input.entries.map(entry => entry.team));

    // A dissolved team cannot be added again, so removing it would hide its scores for good.
    for (const [id, entry] of previous) {
      if (!kept.has(id) && !teamById.has(id) && cards.some(card => String(card.team) === id)) {
        throw juryError(409, `"${entry.teamName}" takımı dağıtılmış ve puanları var; listeden çıkarılamaz.`, 'ENTRY_HAS_SCORES');
      }
    }

    const entries = input.entries.map(entry => {
      const team = teamById.get(entry.team);
      const old = previous.get(entry.team);
      if (!old && (!team || String(team.form) !== String(form?._id))) {
        throw juryError(400, 'Eklenmek istenen takım bu etkinlikte bulunamadı.', 'TEAM_NOT_FOUND');
      }
      return { ...entry, teamName: team?.name ?? old.teamName };
    });

    const changes = configChanges(config.toObject(), { criteria: input.criteria, categories: input.categories, entries });
    if (changes) await record(session, user, 'CONFIG_UPDATED', { details: { changes } });
    config.set({ criteria: input.criteria, categories: input.categories, entries, revision: config.revision + 1, updatedBy: user._id });
    await config.save({ session });
  });
  return getConfig();
};

/** @param {unknown} locked @param {any} user */
const setLock = async (locked, user) => {
  if (typeof locked !== 'boolean') throw juryError(400, 'locked alanı true veya false olmalıdır.', 'INVALID_INPUT');
  await loadConfig();
  await mongoose.connection.transaction(async session => {
    const before = await JudgingConfig.findById(CONFIG_ID).session(session).lean();
    if (before.locked === locked) return;
    // Not a revision bump: locking must not break a config edit that is open on another screen.
    await JudgingConfig.updateOne({ _id: CONFIG_ID }, { $set: { locked, updatedBy: user._id } }, { session });
    await record(session, user, locked ? 'LOCKED' : 'UNLOCKED');
  });
  return getConfig();
};

/**
 * Deletes every scorecard (rehearsal data) and starts a new round, which makes drafts still
 * sitting on juror devices unsendable. ADMIN only, checked by the route.
 * @param {unknown} confirmation @param {any} user
 */
const resetScorecards = async (confirmation, user) => {
  if (confirmation !== RESET_CONFIRMATION) throw juryError(400, `Onay için ${RESET_CONFIRMATION} yazılmalıdır.`, 'CONFIRMATION_REQUIRED');
  await loadConfig();
  let deleted = 0;
  await mongoose.connection.transaction(async session => {
    const config = await JudgingConfig.findOneAndUpdate({ _id: CONFIG_ID }, { $inc: { round: 1 }, $set: { updatedBy: user._id } }, { session, returnDocument: 'after' }).lean();
    if (config?.locked) throw juryError(423, 'Puanlama kilitliyken puan kartları sıfırlanamaz.', 'CONFIG_LOCKED');
    deleted = (await Scorecard.deleteMany({}, { session })).deletedCount;
    await record(session, user, 'SCORECARDS_RESET', { details: { deleted, round: config?.round } });
  });
  console.warn(`[Jüri] ${deleted} puan kartı sıfırlandı (kullanıcı ${user._id}).`);
  return { deleted, config: await getConfig() };
};

module.exports = { getConfig, listTeams, saveConfig, setLock, resetScorecards };
