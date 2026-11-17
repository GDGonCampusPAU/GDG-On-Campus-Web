// Staff (ORGANIZER / ADMIN) view and control of registration teams.
// Uses the same transactional helpers as the participant "Başvurum" page, so the
// team document, response team fields and the staff-visible team answer stay in sync.
const FormResponse = require('../models/FormResponse');
const HackathonTeam = require('../models/HackathonTeam');
const { MAX_TEAM_SIZE } = require('./teamService');
const { internals } = require('./myApplicationService');

const { inTransaction, findMembership, syncResponse, displayName, dropMember, memberEntry, makeCaptain, dissolveTeam } = internals;
const failure = (status, message) => Object.assign(new Error(message), { status });

/** All teams of a form with every person's name, e-mail and admin decision (staff may see e-mails). */
const listTeams = async (form) => {
  const teams = await HackathonTeam.find({ form: form._id }).sort({ createdAt: -1 }).lean();
  const ids = teams.flatMap(team => [team.captain.response, ...team.members.map(member => member.response)]).filter(Boolean);
  const responses = await FormResponse.find({ _id: { $in: ids } }).select('answers status editedAt').lean();
  const byId = new Map(responses.map(response => [String(response._id), response]));
  const person = (entry, extra) => {
    const response = byId.get(String(entry.response));
    return { id: String(entry.participant), responseId: entry.response ? String(entry.response) : null, name: displayName(response),
      email: entry.email, adminStatus: response?.status || 'PENDING', edited: Boolean(response?.editedAt), ...extra };
  };
  return teams.map((team) => {
    const members = [person(team.captain, { captain: true }), ...team.members.filter(m => m.status === 'APPROVED').map(m => person(m, { captain: false }))];
    const requests = team.members.filter(m => m.status === 'PENDING').map(m => person(m, { captain: false }));
    return {
      id: String(team._id), name: team.name, code: team.code, createdAt: team.createdAt,
      size: 1 + team.members.length, maxSize: MAX_TEAM_SIZE, members, requests,
      allApproved: members.every(m => m.adminStatus === 'APPROVED')
    };
  });
};

const loadTeam = async (form, teamId, session) => {
  if (!/^[a-f\d]{24}$/i.test(String(teamId))) throw failure(404, 'Takım bulunamadı.');
  const team = await HackathonTeam.findOne({ _id: teamId, form: form._id }).session(session);
  if (!team) throw failure(404, 'Takım bulunamadı.');
  return team;
};

/** Removes an approved member or drops a pending request. The captain must be replaced first. */
const removeFromTeam = (form, teamId, participantId) => inTransaction(async (session) => {
  const team = await loadTeam(form, teamId, session);
  if (String(team.captain.participant) === String(participantId)) {
    throw failure(409, 'Kaptan takımdan çıkarılamaz; önce kaptanı değiştirin veya takımı dağıtın.');
  }
  const member = team.members.find(m => String(m.participant) === String(participantId));
  if (!member) throw failure(404, 'Bu kişi takımda değil.');
  await dropMember(team, participantId, session);
  await syncResponse({ form, responseId: member.response, session });
});

const setCaptain = (form, teamId, participantId) => inTransaction(async (session) => {
  const team = await loadTeam(form, teamId, session);
  if (String(team.captain.participant) === String(participantId)) throw failure(409, 'Bu kişi zaten kaptan.');
  memberEntry(team, participantId, 'APPROVED');
  await makeCaptain({ form, team, memberId: participantId, session });
});

const disband = (form, teamId) => inTransaction(async (session) => {
  await dissolveTeam({ form, team: await loadTeam(form, teamId, session), session });
});

/**
 * An application rejected by the admin leaves its team:
 * member or pending requester -> removed; captain -> captaincy passes to the longest-approved
 * member, or the team is dissolved when nobody else is approved.
 * @returns {Promise<null | 'left' | 'captain-replaced' | 'disbanded'>}
 */
const handleRejection = (form, response) => inTransaction(async (session) => {
  if (!response.participant) return null;
  const membership = await findMembership(form, response.participant, session);
  if (!membership) return null;
  const { team, role } = membership;
  if (role === 'MEMBER') {
    await dropMember(team, response.participant, session);
    await syncResponse({ form, responseId: response._id, session });
    return 'left';
  }
  const successor = team.members
    .filter(m => m.status === 'APPROVED')
    .sort((a, b) => new Date(a.decidedAt || a.requestedAt).getTime() - new Date(b.decidedAt || b.requestedAt).getTime())[0];
  if (!successor) {
    await dissolveTeam({ form, team, session });
    return 'disbanded';
  }
  await makeCaptain({ form, team, memberId: successor.participant, session });
  await dropMember(team, response.participant, session);
  await syncResponse({ form, responseId: response._id, session });
  return 'captain-replaced';
});

module.exports = { listTeams, removeFromTeam, setCaptain, disband, handleRejection };
