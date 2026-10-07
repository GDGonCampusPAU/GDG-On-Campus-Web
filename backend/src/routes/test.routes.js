const express = require('express');
const { healthCheck } = require('../controllers/test.controller');

const router = express.Router();

router.get('/', healthCheck);

module.exports = router;
