const express = require('express');
const router = express.Router();
const hackathonController = require('../controllers/hackathonController');
const authMiddleware = require('../../../middleware/authMiddleware');
const { requireRoles } = require('../../../middleware/roleMiddleware');

// Legacy applications, staff only (ORGANIZER / ADMIN). The old public endpoints
// (POST /send-verification, POST /apply) are gone on purpose: they bypassed the admin
// "Kayıtlar" permission and the auth rate limit. New registrations use /api/v1/forms.
router.get(
  '/applications',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  hackathonController.getApplications
);

router.patch(
  '/applications/:id/status',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  hackathonController.updateApplicationStatus
);

router.get(
  '/applications/export',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  hackathonController.exportApplications
);

module.exports = router;
