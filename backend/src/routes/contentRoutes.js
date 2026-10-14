const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { uploadCoverImage } = require('../middleware/uploadMiddleware');

// Public endpoints
router.get('/public', contentController.getPublicContent);
router.get('/featured', contentController.getFeaturedContent);

// Protected endpoints (Requires ORGANIZER or ADMIN)
router.post(
  '/',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  uploadCoverImage.single('coverImage'),
  contentController.createContent
);

router.put(
  '/:id',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  uploadCoverImage.single('coverImage'),
  contentController.updateContent
);

router.delete(
  '/:id',
  authMiddleware,
  requireRoles('ORGANIZER', 'ADMIN'),
  contentController.deleteContent
);

module.exports = router;

