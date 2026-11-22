const express = require('express');
const jurorAuth = require('../middleware/jurorAuth');
const { jurorLimiter } = require('../middleware/limits');
const { noStore } = require('../controllers/respond');
const controller = require('../controllers/juryController');

const router = express.Router();
router.use(noStore, jurorAuth, jurorLimiter);

router.get('/me', controller.getMe);
router.get('/entries/:teamId', controller.getEntry);
router.put('/entries/:teamId/scorecard', controller.saveScorecard);

module.exports = router;
