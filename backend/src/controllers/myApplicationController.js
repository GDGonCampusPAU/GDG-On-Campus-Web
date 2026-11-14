// Participant-facing "Başvurum" endpoints. formParticipantMiddleware has loaded the form
// (req.submissionForm) and, when a Bearer token was sent, the participant (req.participant).
const service = require('../services/myApplicationService');

/** Wraps a service call: 401 without a verified participant, otherwise { success, data }. */
const action = (fn) => async (req, res, next) => {
  try {
    if (!req.participant) {
      return res.status(401).json({ success: false, message: 'Bu işlem için e-posta adresini yeniden doğrula.' });
    }
    const data = await fn(req.submissionForm, req.participant, req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyApplication: action((form, participant) => service.getApplication(form, participant)),
  updateMyApplication: action((form, participant, req) => service.updateApplication(form, participant, req.body?.answers)),
  joinTeam: action((form, participant, req) => service.joinTeam(form, participant, req.body?.code)),
  createTeam: action((form, participant, req) => service.createTeam(form, participant, req.body?.name)),
  sendTransferCode: action((form, participant) => service.sendTransferCode(form, participant)),
  transferCaptaincy: action((form, participant, req) => service.transferCaptaincy(form, participant, req.body?.participantId, req.body?.code)),
  withdrawRequest: action((form, participant) => service.withdrawRequest(form, participant)),
  leaveTeam: action((form, participant) => service.leaveTeam(form, participant)),
  approveRequest: action((form, participant, req) => service.approveRequest(form, participant, req.params.participantId)),
  rejectRequest: action((form, participant, req) => service.rejectRequest(form, participant, req.params.participantId)),
  removeMember: action((form, participant, req) => service.removeMember(form, participant, req.params.participantId)),
  sendDisbandCode: action((form, participant) => service.sendDisbandCode(form, participant)),
  disbandTeam: action((form, participant, req) => service.disbandTeam(form, participant, req.body?.code))
};
