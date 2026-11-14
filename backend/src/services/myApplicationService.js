// A verified participant's own application and team ("Başvurum" page).
// Every team action runs in a transaction and keeps three things in sync:
// the HackathonTeam document, the participant's FormResponse team fields and the
// human-readable team answer staff see in the list / CSV.
const mongoose = require('mongoose');
const FormResponse = require('../models/FormResponse');
const HackathonTeam = require('../models/HackathonTeam');
const { answerError } = require('../utils/formValidation');
const { MAX_TEAM_SIZE, normalizeCode, teamStatusSummary, teamAnswerError, applyTeamChoice } = require('./teamService');
const otpService = require('../modules/participantAuth/services/otpService');

const failure = (status, message) => Object.assign(new Error(message), { status });

/** Runs fn in a transaction and returns its result. */
const inTransaction = async (fn) => {
  let result;
  await mongoose.connection.transaction(async (session) => { result = await fn(session); });
  return result;
};

const teamFieldIdOf = form => (form.fields || []).find(field => field.type === 'team')?.fieldId;

const findResponse = (form, participant, session = null) => FormResponse.findOne({
  form: form._id, $or: [{ participant: participant._id }, { verifiedEmail: participant.email }]
}).sort({ submittedAt: -1 }).session(session);

const requireResponse = async (form, participant, session = null) => {
  const response = await findResponse(form, participant, session);
  if (!response) throw failure(404, 'Bu etkinliğe henüz başvurmadın.');
  return response;
};

/** @returns {Promise<null | { team: any, role: 'CAPTAIN' | 'MEMBER', status: string }>} */
const findMembership = async (form, participantId, session = null) => {
  const team = await HackathonTeam.findOne({ form: form._id,
    $or: [{ 'captain.participant': participantId }, { 'members.participant': participantId }] }).session(session);
  if (!team) return null;
  if (String(team.captain.participant) === String(participantId)) return { team, role: 'CAPTAIN', status: 'APPROVED' };
  const member = team.members.find(m => String(m.participant) === String(participantId));
  return { team, role: 'MEMBER', status: member.status };
};

/** Mirrors the participant's team state onto their response (staff list, CSV, e-mails). */
const syncResponse = async ({ form, responseId, team = null, role = null, status = null, session }) => {
  if (!responseId) return;
  const fieldId = teamFieldIdOf(form);
  const $set = { team: team?._id ?? null, teamName: team?.name ?? '', teamRole: team ? role : null, teamStatus: team ? status : null };
  if (fieldId) $set['answers.$[team].value'] = teamStatusSummary(team, role, status);
  await FormResponse.updateOne({ _id: responseId }, { $set }, { session, ...(fieldId ? { arrayFilters: [{ 'team.fieldId': fieldId }] } : {}) });
};

// Team-mates only ever see a name, never an e-mail address.
const displayName = (response) => {
  const value = response?.answers?.find(answer => answer.fieldId === 'fullName')?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : 'İsimsiz katılımcı';
};

const teamView = async (participant, membership) => {
  if (!membership) return null;
  const { team, role, status } = membership;
  const size = 1 + team.members.length;
  const base = { name: team.name, role, status, size, maxSize: MAX_TEAM_SIZE };
  // A pending requester only learns the team they asked to join.
  if (role === 'MEMBER' && status !== 'APPROVED') return base;

  const ids = [team.captain.response, ...team.members.map(member => member.response)].filter(Boolean);
  const responses = await FormResponse.find({ _id: { $in: ids } }).select('answers status').lean();
  const byId = new Map(responses.map(response => [String(response._id), response]));
  const person = (entry, captain = false) => {
    const response = byId.get(String(entry.response));
    return { id: String(entry.participant), name: displayName(response), adminStatus: response?.status || 'PENDING', captain,
      isMe: String(entry.participant) === String(participant._id) };
  };
  return {
    ...base,
    code: team.code,
    members: [person(team.captain, true), ...team.members.filter(m => m.status === 'APPROVED').map(m => person(m))],
    ...(role === 'CAPTAIN' ? { requests: team.members.filter(m => m.status === 'PENDING').map(m => person(m)) } : {})
  };
};

/** Everything the "Başvurum" page needs. Answers are the participant's own; the team field is excluded. */
const getApplication = async (form, participant) => {
  const response = await requireResponse(form, participant);
  const teamFieldId = teamFieldIdOf(form);
  const answers = Object.fromEntries((response.answers || [])
    .filter(answer => answer.fieldId !== teamFieldId)
    .map(answer => [answer.fieldId, answer.value]));
  return {
    status: response.status || 'PENDING',
    statusNote: response.status && response.status !== 'PENDING' ? response.statusNote || '' : '',
    submittedAt: response.submittedAt,
    email: participant.email,
    answers,
    team: await teamView(participant, await findMembership(form, participant._id))
  };
};

/**
 * Updates every answer except the team (managed on the page) and files (kept as uploaded).
 * Any change sends the application back to the admin: status returns to PENDING.
 */
const updateApplication = async (form, participant, raw) => {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) throw failure(400, 'Yanıtlar bir nesne olmalıdır.');
  await inTransaction(async (session) => {
    const response = await requireResponse(form, participant, session);
    const existing = new Map((response.answers || []).map(answer => /** @type {[string, unknown]} */ ([answer.fieldId, answer.value])));
    const errors = [];
    const answers = (form.fields || []).map((field) => {
      if (field.type === 'team' || field.type === 'file') return { fieldId: field.fieldId, label: field.label, value: existing.get(field.fieldId) ?? null };
      // The verified address cannot be changed from here.
      const value = field.fieldId === 'email' ? participant.email : raw[field.fieldId];
      const message = answerError(field, value);
      if (message) errors.push(`'${field.label}' ${message}.`);
      return { fieldId: field.fieldId, label: field.label, value: value ?? null };
    });
    if (errors.length) throw failure(400, errors.join(' '));
    Object.assign(response, { answers, schemaVersion: form.updatedAt, status: 'PENDING', statusNote: '',
      reviewedBy: null, reviewedAt: null, lastNotifiedStatus: null, editedAt: new Date() });
    await response.save({ session });
  });
  return getApplication(form, participant);
};

/** Shared shape of team actions: load response + membership in a transaction, act, return fresh view. */
const teamAction = async (form, participant, act) => {
  await inTransaction(async (session) => {
    const response = await requireResponse(form, participant, session);
    const membership = await findMembership(form, participant._id, session);
    await act({ session, response, membership });
  });
  return getApplication(form, participant);
};

const requireCaptain = (membership) => {
  if (membership?.role !== 'CAPTAIN') throw failure(403, 'Bu işlemi yalnız takım kaptanı yapabilir.');
  return membership.team;
};
const memberEntry = (team, participantId, status) => {
  const member = team.members.find(m => String(m.participant) === String(participantId) && m.status === status);
  if (!member) throw failure(404, status === 'PENDING' ? 'Bu katılma isteği artık yok.' : 'Bu kişi takımda değil.');
  return member;
};
const dropMember = async (team, participantId, session) => {
  team.members = team.members.filter(m => String(m.participant) !== String(participantId));
  await team.save({ session });
};

const joinTeam = (form, participant, code) => teamAction(form, participant, async ({ session, response, membership }) => {
  if (membership) throw failure(409, membership.status === 'PENDING' ? 'Zaten bir takıma katılma isteğin var.' : 'Zaten bir takımdasın.');
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9]{6}$/.test(normalized)) throw failure(400, 'Takım kodu 6 harf ve rakamdan oluşur.');
  const team = await HackathonTeam.findOne({ form: form._id, code: normalized }).session(session);
  if (!team) throw failure(400, 'Bu kodla bir takım bulunamadı. Kodu kaptanından kontrol et.');
  if (1 + team.members.length >= MAX_TEAM_SIZE) throw failure(400, `Bu takım dolu (en fazla ${MAX_TEAM_SIZE} kişi).`);
  team.members.push({ participant: participant._id, email: participant.email, response: response._id, status: 'PENDING' });
  await team.save({ session });
  await syncResponse({ form, responseId: response._id, team, role: 'MEMBER', status: 'PENDING', session });
});

/** A participant without a team founds one from the page and becomes its captain. */
const createTeam = async (form, participant, name) => {
  const value = { mode: 'create', name: typeof name === 'string' ? name : '' };
  if (teamAnswerError(value)) throw failure(400, 'Takım adı 2-40 karakter olmalıdır.');
  try {
    return await teamAction(form, participant, async ({ session, response, membership }) => {
      if (membership) throw failure(409, membership.status === 'PENDING' ? 'Önce bekleyen katılma isteğini geri çekmelisin.' : 'Zaten bir takımdasın.');
      const { team } = await applyTeamChoice({ session, form, participant, value });
      team.captain.response = response._id;
      await team.save({ session });
      await syncResponse({ form, responseId: response._id, team, role: 'CAPTAIN', status: 'APPROVED', session });
    });
  } catch (error) {
    // Another participant took the same name concurrently.
    if (error?.code === 11000 && error.keyPattern?.nameKey) throw failure(400, 'Bu takım adı alınmış. Başka bir ad dene.');
    throw error;
  }
};

const withdrawRequest = (form, participant) => teamAction(form, participant, async ({ session, response, membership }) => {
  if (membership?.role !== 'MEMBER' || membership.status !== 'PENDING') throw failure(409, 'Geri çekilecek bir katılma isteğin yok.');
  await dropMember(membership.team, participant._id, session);
  await syncResponse({ form, responseId: response._id, session });
});

const leaveTeam = (form, participant) => teamAction(form, participant, async ({ session, response, membership }) => {
  if (membership?.role === 'CAPTAIN') throw failure(409, 'Kaptan takımdan ayrılamaz; takımı dağıtabilirsin.');
  if (membership?.role !== 'MEMBER' || membership.status !== 'APPROVED') throw failure(409, 'Ayrılacağın bir takım yok.');
  await dropMember(membership.team, participant._id, session);
  await syncResponse({ form, responseId: response._id, session });
});

const decideRequest = (form, participant, memberId, approve) => teamAction(form, participant, async ({ session, membership }) => {
  const team = requireCaptain(membership);
  const member = memberEntry(team, memberId, 'PENDING');
  if (approve) {
    member.status = 'APPROVED';
    member.decidedAt = new Date();
    await team.save({ session });
    await syncResponse({ form, responseId: member.response, team, role: 'MEMBER', status: 'APPROVED', session });
  } else {
    await dropMember(team, memberId, session);
    await syncResponse({ form, responseId: member.response, session });
  }
});

const removeMember = (form, participant, memberId) => teamAction(form, participant, async ({ session, membership }) => {
  const team = requireCaptain(membership);
  const member = memberEntry(team, memberId, 'APPROVED');
  await dropMember(team, memberId, session);
  await syncResponse({ form, responseId: member.response, session });
});

/** Step 1 of a captaincy transfer: e-mail a confirmation code to the current captain. */
const sendTransferCode = async (form, participant) => {
  await requireResponse(form, participant);
  requireCaptain(await findMembership(form, participant._id));
  return otpService.sendOtp(participant.email, { subject: 'Kaptanlık devri onayı', purpose: 'Kaptanlık devri' });
};

/** Step 2: the chosen approved member becomes captain; the old captain stays as an approved member. */
const transferCaptaincy = async (form, participant, memberId, code) => {
  const membership = await findMembership(form, participant._id);
  memberEntry(requireCaptain(membership), memberId, 'APPROVED');
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw failure(400, 'Doğrulama kodu 6 haneli olmalıdır.');
  await otpService.verifyOtp(participant.email, code);
  return teamAction(form, participant, async ({ session, membership: current }) => {
    await makeCaptain({ form, team: requireCaptain(current), memberId, session });
  });
};

/** The approved member becomes captain; the previous captain stays as an approved member. */
const makeCaptain = async ({ form, team, memberId, session }) => {
  const member = memberEntry(team, memberId, 'APPROVED');
  const oldCaptain = { participant: team.captain.participant, email: team.captain.email, response: team.captain.response };
  team.captain = { participant: member.participant, email: member.email, response: member.response };
  team.members = team.members
    .filter(m => String(m.participant) !== String(memberId))
    .concat({ ...oldCaptain, status: 'APPROVED', requestedAt: new Date(), decidedAt: new Date() });
  await team.save({ session });
  await syncResponse({ form, responseId: member.response, team, role: 'CAPTAIN', status: 'APPROVED', session });
  await syncResponse({ form, responseId: oldCaptain.response, team, role: 'MEMBER', status: 'APPROVED', session });
};

/** Deletes the team; captain, members and pending requesters all become individual participants. */
const dissolveTeam = async ({ form, team, session }) => {
  for (const entry of [team.captain, ...team.members]) await syncResponse({ form, responseId: entry.response, session });
  await HackathonTeam.deleteOne({ _id: team._id }, { session });
};

/** Step 1 of disbanding: e-mail a confirmation code to the captain. */
const sendDisbandCode = async (form, participant) => {
  await requireResponse(form, participant);
  requireCaptain(await findMembership(form, participant._id));
  return otpService.sendOtp(participant.email, { subject: 'Takımı dağıtma onayı', purpose: 'Takımı dağıtma' });
};

/** Step 2: verify the code, then dissolve the team; everyone becomes an individual participant. */
const disbandTeam = async (form, participant, code) => {
  // Check the role before consuming the code, so a non-captain cannot burn it.
  requireCaptain(await findMembership(form, participant._id));
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw failure(400, 'Doğrulama kodu 6 haneli olmalıdır.');
  await otpService.verifyOtp(participant.email, code);
  return teamAction(form, participant, async ({ session, membership }) => {
    await dissolveTeam({ form, team: requireCaptain(membership), session });
  });
};

module.exports = {
  // Shared with the staff team tools (teamAdminService).
  internals: { inTransaction, findMembership, syncResponse, displayName, dropMember, memberEntry, makeCaptain, dissolveTeam },
  getApplication, updateApplication, joinTeam, createTeam, withdrawRequest, leaveTeam,
  sendTransferCode, transferCaptaincy,
  approveRequest: (form, participant, memberId) => decideRequest(form, participant, memberId, true),
  rejectRequest: (form, participant, memberId) => decideRequest(form, participant, memberId, false),
  removeMember, sendDisbandCode, disbandTeam
};
