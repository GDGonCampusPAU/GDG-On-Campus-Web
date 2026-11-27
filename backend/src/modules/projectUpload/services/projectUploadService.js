// Project upload (proje.gdgocpamukkale.com).
//
// The participant opens the upload site from "Başvurum": this backend signs a 24-hour handoff token
// that names the participant and their team. The upload site keeps that token as its session and,
// for every read and change, asks this backend through the internal API (internalRoutes.js) whether
// the person is still an approved member and whether uploading is open. The team's link is stored
// here (ProjectSubmission), next to the team, so the jury tools can read it directly.
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Form = require('../../../models/Form');
const FormResponse = require('../../../models/FormResponse');
const HackathonTeam = require('../../../models/HackathonTeam');
const EventPage = require('../../../models/EventPage');
const ProjectSubmission = require('../models/ProjectSubmission');
const { HISTORY_MAX } = require('../models/ProjectSubmission');
const { permissionsOf } = require('../../../services/formPermissionsService');
const { internals } = require('../../../services/myApplicationService');
const { parseRepoUrl } = require('./repoUrl');

const ISSUER = 'gdg-pau';
const AUDIENCE = 'project-upload';
const TOKEN_TTL = '24h';
const SHOWN_HISTORY = 10;

/** @param {number} status @param {string} message @param {string} code */
const failure = (status, message, code) => Object.assign(new Error(message), { status, code });

const isId = (value) => /^[a-f\d]{24}$/i.test(String(value));

/** Upload site address and signing secret; both are required for the feature to work. */
const config = () => {
  const url = (process.env.PROJECT_UPLOAD_URL || '').trim().replace(/\/+$/, '');
  const secret = process.env.PROJECT_UPLOAD_SECRET || '';
  if (!url || secret.length < 32) {
    throw failure(503, 'Proje yükleme şu an kullanılamıyor. Organizasyon ekibine haber ver.', 'PROJECT_UPLOAD_UNAVAILABLE');
  }
  return { url, secret };
};

/** The name team-mates see for this person (their registration answer), never the e-mail. */
const nameIn = async (team, participantId) => {
  const entry = String(team.captain.participant) === String(participantId)
    ? team.captain
    : team.members.find(member => String(member.participant) === String(participantId));
  if (!entry?.response) return 'İsimsiz katılımcı';
  return internals.displayName(await FormResponse.findById(entry.response).select('answers').lean());
};

const isApprovedMember = (team, participantId) =>
  String(team.captain.participant) === String(participantId) ||
  team.members.some(member => String(member.participant) === String(participantId) && member.status === 'APPROVED');

/**
 * Signs the token the "Proje Yükleme" button sends to the upload site.
 * Only approved team members get one; closed uploading still lets them in to read.
 */
const issueHandoff = async (form, participant) => {
  const { url, secret } = config();
  const membership = await internals.findMembership(form, participant._id);
  if (!membership) throw failure(409, 'Proje yüklemek için önce bir takımda olmalısın.', 'NO_TEAM');
  if (membership.status !== 'APPROVED') throw failure(409, 'Takım kaptanın katılma isteğini onaylayınca proje yükleyebilirsin.', 'TEAM_PENDING');
  const { team } = membership;
  const token = jwt.sign(
    { type: 'project-upload', team: String(team._id), form: String(form._id), teamName: team.name },
    secret,
    { algorithm: 'HS256', subject: String(participant._id), audience: AUDIENCE, issuer: ISSUER, expiresIn: TOKEN_TTL }
  );
  const { exp } = /** @type {{ exp: number }} */ (jwt.decode(token));
  // The token rides in the fragment: browsers never send it to a server, a log or a Referer header.
  return { url: `${url}/#t=${token}`, expiresAt: new Date(exp * 1000).toISOString() };
};

const submissionView = (doc) => doc && {
  repoUrl: doc.repoUrl,
  projectName: doc.projectName || '',
  updatedBy: doc.updatedBy?.name || '',
  updatedAt: doc.updatedAt,
  history: (doc.history || []).slice(-SHOWN_HISTORY).reverse().map(item => ({ repoUrl: item.repoUrl, projectName: item.projectName || '', by: item.by?.name || '', at: item.at }))
};

const eventStartsAt = async () => {
  const page = await EventPage.findById('hackathon').select('event.startsAt').lean();
  const value = /** @type {any} */ (page)?.event?.startsAt;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
};

/** Loads the team and checks the person; a missing team or member is a normal state, not an error. */
const load = async (teamId, participantId) => {
  if (!isId(teamId) || !isId(participantId)) throw failure(400, 'Geçersiz takım veya katılımcı.', 'BAD_REQUEST');
  const team = await HackathonTeam.findById(teamId);
  if (!team) return { team: null, form: null, member: false };
  const form = await Form.findById(team.form).select('settings');
  return { team, form, member: isApprovedMember(team, participantId) };
};

/** What the upload site shows: team, whether the person may still act, whether uploading is open, the link. */
const teamState = async (teamId, participantId) => {
  const { team, form, member } = await load(teamId, participantId);
  if (!team) return { member: false, reason: 'TEAM_GONE', team: null, open: false, submission: null, eventStartsAt: await eventStartsAt() };
  const submission = member ? await ProjectSubmission.findOne({ team: team._id }).lean() : null;
  // After the deadline: pushes that reached GitHub later (GitHub's push time, latePushService.js).
  const latePush = submission ? await require('./latePushService').forTeam(submission.repoUrl) : null;
  return {
    latePush,
    member,
    reason: member ? null : 'NOT_MEMBER',
    team: { id: String(team._id), name: team.name },
    open: permissionsOf(form).projectUpload,
    submission: submissionView(submission),
    eventStartsAt: await eventStartsAt()
  };
};

const PROJECT_NAME_MIN = 2;
const PROJECT_NAME_MAX = 80;
/** @param {unknown} value */
const cleanName = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

/**
 * Sets or changes the team's link and project name. Membership and the admin switch are checked at the
 * moment of saving.
 */
const saveRepo = async (teamId, participantId, input, nameInput) => {
  const repo = parseRepoUrl(input);
  if (!repo) throw failure(400, 'Geçerli bir GitHub proje linki gir (ör. https://github.com/kullanici/proje).', 'INVALID_REPO');
  const projectName = cleanName(nameInput);
  if (projectName.length < PROJECT_NAME_MIN || projectName.length > PROJECT_NAME_MAX) {
    throw failure(400, `Proje adı ${PROJECT_NAME_MIN}-${PROJECT_NAME_MAX} karakter olmalı.`, 'INVALID_PROJECT_NAME');
  }
  const { team, form, member } = await load(teamId, participantId);
  if (!team || !member) throw failure(403, 'Bu takımın üyesi olmadığın için linki değiştiremezsin.', 'NOT_MEMBER');
  if (!permissionsOf(form).projectUpload) throw failure(403, 'Proje yükleme kapatıldı. Link artık değiştirilemez.', 'UPLOAD_CLOSED');

  const existing = await ProjectSubmission.findOne({ team: team._id });
  // GitHub names are case-insensitive: the same repo typed differently is not a new change.
  if (existing?.repoKey === repo.key && existing.projectName === projectName) return teamState(teamId, participantId);
  if (await ProjectSubmission.exists({ form: team.form, repoKey: repo.key, team: { $ne: team._id } })) {
    throw failure(409, 'Bu repo başka bir takım tarafından eklenmiş. Kendi takımınızın reposunu gir.', 'REPO_TAKEN');
  }
  const by = { participant: new mongoose.Types.ObjectId(String(participantId)), name: await nameIn(team, participantId) };
  const update = {
    $set: { form: team.form, repoUrl: repo.url, repoKey: repo.key, projectName, updatedBy: by },
    $push: { history: { $each: [{ repoUrl: repo.url, projectName, by, at: new Date() }], $slice: -HISTORY_MAX } }
  };
  const save = (upsert) => ProjectSubmission.updateOne({ team: team._id }, update, { upsert, runValidators: true });
  try {
    await save(true);
  } catch (error) {
    const e = /** @type {any} */ (error);
    if (e?.code !== 11000) throw error;
    // Same repo saved by another team at the same moment: the repoKey index decides.
    if (e.keyPattern?.repoKey) throw failure(409, 'Bu repo başka bir takım tarafından eklenmiş. Kendi takımınızın reposunu gir.', 'REPO_TAKEN');
    // Two team-mates saving the team's first link at once: the other created the document; update it.
    await save(false);
  }
  // The first link makes the team a competing team (unless an organizer removed it).
  await require('../../jury/services/autoEntries').addUploadedTeamsSafely([team._id]);
  return teamState(teamId, participantId);
};

module.exports = { issueHandoff, teamState, saveRepo, AUDIENCE, ISSUER, PROJECT_NAME_MAX };
