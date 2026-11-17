const express = require('express');
const auth = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const maintenance = require('../services/maintenanceService');

const router = express.Router();
router.use(auth, requireRoles('ADMIN'));

router.get('/', (req, res) => res.json({ success: true, data: maintenance.status() }));

router.put('/', async (req, res, next) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') return res.status(400).json({ success: false, message: 'active alanı true veya false olmalıdır.' });
    res.json({ success: true, data: active ? await maintenance.enable(req.user) : maintenance.disable() });
  } catch (error) { next(error); }
});

module.exports = router;
