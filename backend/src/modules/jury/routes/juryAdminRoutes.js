const express = require('express');
const auth = require('../../../middleware/authMiddleware');
const { requireRoles } = require('../../../middleware/roleMiddleware');
const { staffGate } = require('../middleware/limits');
const { parseBody, notFound } = require('../middleware/body');
const { noStore } = require('../controllers/respond');
const controller = require('../controllers/juryAdminController');

const router = express.Router();
router.use(noStore, staffGate, auth, requireRoles('ORGANIZER', 'ADMIN'), parseBody);

router.get('/config', controller.getConfig);
router.put('/config', controller.saveConfig);
router.get('/teams', controller.listTeams);
router.get('/jurors', controller.listJurors);
// Whoever holds a link can score as that juror, so only an ADMIN hands them out.
router.post('/jurors', requireRoles('ADMIN'), controller.createJuror);
router.post('/jurors/:id/regenerate', requireRoles('ADMIN'), controller.regenerateToken);
router.post('/jurors/:id/scorecards/:teamId/void', requireRoles('ADMIN'), controller.voidScorecard);
router.patch('/jurors/:id', controller.updateJuror);
router.put('/lock', controller.setLock);
// Irreversible, so organizers do not get it.
router.post('/scorecards/reset', requireRoles('ADMIN'), controller.resetScorecards);
router.get('/log', controller.getLog);
// Live presentation session (needs "Proje değerlendirme" open on the panel's İzinler page).
router.get('/live', controller.getLive);
router.post('/live/start', controller.startVoting);
router.post('/live/end', controller.endVoting);
router.post('/live/reopen', requireRoles('ADMIN'), controller.reopenVoting);
router.post('/live/shuffle', requireRoles('ADMIN'), controller.shuffleOrder);
router.get('/results', controller.getResults);
router.get('/results.csv', controller.exportResults);
router.use(notFound);

module.exports = router;
