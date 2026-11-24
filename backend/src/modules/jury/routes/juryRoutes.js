const express = require('express');
const jurorAuth = require('../middleware/jurorAuth');
const { jurorLimiter } = require('../middleware/limits');
const { parseBody, notFound } = require('../middleware/body');
const { noStore } = require('../controllers/respond');
const controller = require('../controllers/juryController');

const router = express.Router();
router.use(noStore, jurorAuth, jurorLimiter, parseBody);

router.get('/me', controller.getMe);
router.get('/entries/:teamId', controller.getEntry);
router.put('/entries/:teamId/scorecard', controller.saveScorecard);
router.use(notFound);

module.exports = router;
