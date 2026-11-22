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
router.post('/jurors', controller.createJuror);
router.post('/jurors/:id/regenerate', controller.regenerateToken);
router.patch('/jurors/:id', controller.updateJuror);
router.put('/lock', controller.setLock);
// Irreversible, so organizers do not get it.
router.post('/scorecards/reset', requireRoles('ADMIN'), controller.resetScorecards);
router.get('/results', controller.getResults);
router.get('/results.csv', controller.exportResults);
router.use(notFound);

module.exports = router;
