// Staff endpoints for registration teams (ORGANIZER / ADMIN; auth + role checked by formRoutes).
const Form = require('../models/Form');
const teamAdmin = require('../services/teamAdminService');

const withForm = (fn) => async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form bulunamadı.' });
    await fn(form, req);
    // Every action answers with the fresh team list so the page re-renders from one source.
    return res.status(200).json({ success: true, data: await teamAdmin.listTeams(form) });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTeams: withForm(async () => {}),
  removeMember: withForm((form, req) => teamAdmin.removeFromTeam(form, req.params.teamId, req.params.participantId)),
  setCaptain: withForm((form, req) => teamAdmin.setCaptain(form, req.params.teamId, req.body?.participantId)),
  disband: withForm((form, req) => teamAdmin.disband(form, req.params.teamId))
};
