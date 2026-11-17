// Participant-facing "Başvurum" endpoints. formParticipantMiddleware has loaded the form
// (req.submissionForm) and, when a Bearer token was sent, the participant (req.participant).
const service = require('../services/myApplicationService');
const { permissionsOf } = require('../services/formPermissionsService');

const LOCKED = {
  team: 'Takım değişiklikleri şu an kapalı. Takım bilgilerini yalnızca görüntüleyebilirsin.',
  answers: 'Başvuru bilgilerini düzenleme şu an kapalı. Bilgilerini yalnızca görüntüleyebilirsin.'
};

/**
 * Wraps a service call: 401 without a verified participant, 403 when the admin has closed the
 * permission this action needs ('team' | 'answers'), otherwise { success, data }.
 * The permission is checked before the service runs, so a locked action sends no e-mail code either.
 */
const action = (fn, needs = null) => async (req, res, next) => {
  try {
    if (!req.participant) {
      return res.status(401).json({ success: false, message: 'Bu işlem için e-posta adresini yeniden doğrula.' });
    }
    const permissions = permissionsOf(req.submissionForm);
    if ((needs === 'team' && !permissions.teamChanges) || (needs === 'answers' && !permissions.answerEditing)) {
      return res.status(403).json({ success: false, message: LOCKED[needs], code: needs === 'team' ? 'TEAM_CHANGES_LOCKED' : 'ANSWER_EDITING_LOCKED' });
    }
    const data = await fn(req.submissionForm, req.participant, req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyApplication: action((form, participant) => service.getApplication(form, participant)),
  updateMyApplication: action((form, participant, req) => service.updateApplication(form, participant, req.body?.answers), 'answers'),
  joinTeam: action((form, participant, req) => service.joinTeam(form, participant, req.body?.code), 'team'),
  createTeam: action((form, participant, req) => service.createTeam(form, participant, req.body?.name), 'team'),
  sendTransferCode: action((form, participant) => service.sendTransferCode(form, participant), 'team'),
  transferCaptaincy: action((form, participant, req) => service.transferCaptaincy(form, participant, req.body?.participantId, req.body?.code), 'team'),
  withdrawRequest: action((form, participant) => service.withdrawRequest(form, participant), 'team'),
  leaveTeam: action((form, participant) => service.leaveTeam(form, participant), 'team'),
  // Kept open while team changes are locked: new registrants can still send join requests
  // from the registration form, and captains must be able to answer them.
  approveRequest: action((form, participant, req) => service.approveRequest(form, participant, req.params.participantId)),
  rejectRequest: action((form, participant, req) => service.rejectRequest(form, participant, req.params.participantId)),
  removeMember: action((form, participant, req) => service.removeMember(form, participant, req.params.participantId), 'team'),
  sendDisbandCode: action((form, participant) => service.sendDisbandCode(form, participant), 'team'),
  disbandTeam: action((form, participant, req) => service.disbandTeam(form, participant, req.body?.code), 'team')
};
