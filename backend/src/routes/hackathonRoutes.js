const express = require('express');
const router = express.Router();
const hackathonController = require('../controllers/hackathonController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { uploadResume } = require('../middleware/uploadMiddleware');

// Public hackathon application endpoint
router.post(
  '/apply',
  uploadResume.single('resume'),
  hackathonController.applyHackathon
);

// Protected endpoints (Requires ORGANIZER or ADMIN)
router.get(
  '/applications',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  hackathonController.getApplications
);

router.get(
  '/applications/export',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  hackathonController.exportApplications
);

module.exports = router;

