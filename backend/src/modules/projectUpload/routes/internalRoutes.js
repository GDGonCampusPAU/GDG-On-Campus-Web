// Internal API for the project upload site's backend (mounted at /api/v1/internal/project-upload).
// The upload site has already verified the participant's handoff token; it passes the team and
// participant from that token, and this backend checks membership and the admin switch every time.
const router = require('express').Router();
const internalKey = require('../middleware/internalKey');
const service = require('../services/projectUploadService');

router.use(internalKey);

/** Like the other module responders, but the error code travels too so the upload site can branch on it. */
const respond = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) {
    const e = /** @type {any} */ (error);
    if (e?.status && e.status < 500) return res.status(e.status).json({ success: false, message: e.message, code: e.code });
    return next(error);
  }
};

router.get('/teams/:teamId/state', respond(req => service.teamState(req.params.teamId, req.query.participant)));
router.put('/teams/:teamId/submission', respond(req => service.saveRepo(req.params.teamId, req.body?.participant, req.body?.repoUrl, req.body?.projectName)));

module.exports = router;
