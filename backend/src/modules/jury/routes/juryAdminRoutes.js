const express = require('express');
const auth = require('../../../middleware/authMiddleware');
const { requireRoles } = require('../../../middleware/roleMiddleware');
const { staffLimiter } = require('../middleware/limits');
const { noStore } = require('../controllers/respond');
const controller = require('../controllers/juryAdminController');

const router = express.Router();
router.use(noStore, auth, requireRoles('ORGANIZER', 'ADMIN'), staffLimiter);

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

module.exports = router;
