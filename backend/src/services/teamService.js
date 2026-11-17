const { randomInt } = require('node:crypto');
const HackathonTeam = require('../models/HackathonTeam');

/** Captain + approved + pending members. Matches the "en fazla 4 kişilik ekip" rule. */
const MAX_TEAM_SIZE = 4;
// No 0/O, 1/I/L: codes are read aloud and typed from chat messages.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-Z0-9]{6}$/;

const failure = (status, message) => Object.assign(new Error(message), { status });
const nameKeyOf = name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
const normalizeCode = code => (typeof code === 'string' ? code.trim().toUpperCase() : '');
const generateCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const sizeOf = team => 1 + team.members.filter(member => member.status !== 'REJECTED').length;

/**
 * Validates the answer of a `team` field.
 * Shape: { mode: 'solo' } | { mode: 'create', name } | { mode: 'join', code }
 * @returns {string} Turkish error suffix ('' when valid), same contract as answerError.
 */
const teamAnswerError = (value) => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return 'geçerli bir takım seçimi olmalıdır';
  if (value.mode === 'solo') return '';
  if (value.mode === 'create') {
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    return name.length >= 2 && name.length <= 40 ? '' : 'için 2-40 karakterlik bir takım adı girilmelidir';
  }
  if (value.mode === 'join') return CODE_PATTERN.test(normalizeCode(value.code)) ? '' : 'için 6 karakterlik takım kodu girilmelidir';
  return 'geçerli bir takım seçimi olmalıdır';
};

/**
 * Creates or joins a team inside the submission transaction.
 * @returns {Promise<null | { team: any, role: 'CAPTAIN' | 'MEMBER', status: 'APPROVED' | 'PENDING' }>}
 */
const applyTeamChoice = async ({ session, form, participant, value }) => {
  if (!value || value.mode === 'solo') return null;
  if (!participant) throw failure(401, 'Takım işlemleri için e-posta doğrulaması gereklidir.');
  const already = await HackathonTeam.exists({ form: form._id, $or: [{ 'captain.participant': participant._id }, { 'members.participant': participant._id }] }).session(session);
  if (already) throw failure(409, 'Bu etkinlikte zaten bir takımdasın.');

  if (value.mode === 'create') {
    const name = value.name.trim().replace(/\s+/g, ' ');
    if (await HackathonTeam.exists({ form: form._id, nameKey: nameKeyOf(name) }).session(session)) {
      throw failure(400, 'Bu takım adı alınmış. Başka bir ad dene.');
    }
    // Code collisions are astronomically rare (31^6), but never hand out a duplicate.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      if (await HackathonTeam.exists({ code }).session(session)) continue;
      const [team] = await HackathonTeam.create([{ form: form._id, name, nameKey: nameKeyOf(name), code,
        captain: { participant: participant._id, email: participant.email } }], { session });
      return { team, role: 'CAPTAIN', status: 'APPROVED' };
    }
    throw failure(503, 'Takım kodu üretilemedi. Lütfen tekrar dene.');
  }

  const code = normalizeCode(value.code);
  const team = await HackathonTeam.findOne({ form: form._id, code }).session(session);
  if (!team) throw failure(400, 'Bu kodla bir takım bulunamadı. Kodu kaptanından kontrol et.');
  if (sizeOf(team) >= MAX_TEAM_SIZE) throw failure(400, `Bu takım dolu (en fazla ${MAX_TEAM_SIZE} kişi).`);
  team.members.push({ participant: participant._id, email: participant.email, status: 'PENDING' });
  await team.save({ session });
  return { team, role: 'MEMBER', status: 'PENDING' };
};

/**
 * Human-readable team answer stored on the response (staff list, CSV export, e-mails).
 * @param {any} team @param {'CAPTAIN' | 'MEMBER' | null} role @param {string | null} status
 */
const teamStatusSummary = (team, role, status) => {
  if (!team) return 'Bireysel katılım';
  if (role === 'CAPTAIN') return `Takım kurdu: ${team.name} (kod ${team.code})`;
  return status === 'APPROVED'
    ? `Takım üyesi: ${team.name} (kod ${team.code})`
    : `Takıma katılma isteği: ${team.name} (kod ${team.code}, kaptan onayı bekleniyor)`;
};

/** Answer summary right after submission. */
const teamSummary = (value, result) => (result ? teamStatusSummary(result.team, result.role, result.status) : teamStatusSummary(null, null, null));

/** Public view for a participant entering a code; never exposes member e-mails. */
const lookupTeam = async ({ form, code }) => {
  const normalized = normalizeCode(code);
  if (!CODE_PATTERN.test(normalized)) return null;
  const team = await HackathonTeam.findOne({ form: form._id, code: normalized }).lean();
  if (!team) return null;
  const size = sizeOf(team);
  return { name: team.name, size, maxSize: MAX_TEAM_SIZE, full: size >= MAX_TEAM_SIZE };
};

module.exports = { MAX_TEAM_SIZE, CODE_ALPHABET, normalizeCode, generateCode, teamAnswerError, applyTeamChoice, teamSummary, teamStatusSummary, lookupTeam };
