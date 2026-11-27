const router = require('express').Router();
const EventPage = require('../models/EventPage');
const Form = require('../models/Form');
const { savePage } = require('../services/eventPageService');
const auth = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
router.get('/hackathon', async (_req, res, next) => {
  try {
    const page = await EventPage.findById('hackathon').lean();
    if (!page) return res.status(503).json({ message: 'Etkinlik henüz hazırlanmadı.' });
    const { normalizeEventPayload } = await import('../../../shared/eventContent.mjs');
    const form = await Form.findOne({ slug: page.formSlug }).select('_id').lean();
    res.set('Cache-Control', 'no-cache').json({ success: true, data: { ...page, event: normalizeEventPayload(page.event), formId: form?._id } });
  } catch (error) { next(error); }
});
router.put('/hackathon', auth, requireRoles('ADMIN', 'ORGANIZER'), async (req, res, next) => {
  try { res.json({ success: true, data: await savePage(req.body.event, req.body.revision, req.user._id, { mayChangeRegistration: req.user.role === 'ADMIN' }) }); }
  catch (error) { next(error); }
});
module.exports = router;
