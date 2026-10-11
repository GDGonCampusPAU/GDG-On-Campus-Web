const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { uploadFormFiles } = require('../middleware/uploadMiddleware');

// ==========================================
// Public Endpoints (Anket/Form Doldurma)
// ==========================================
router.get('/public/:slugOrId', formController.getPublicForm);
router.post('/public/:slugOrId/submit', uploadFormFiles.any(), formController.submitFormResponse);

// ==========================================
// Protected Endpoints (Admin & Organizatör)
// ==========================================
router.use(authMiddleware);
router.use(requireRoles('ORGANIZER', 'ADMIN'));

router.post('/', formController.createForm);
router.get('/', formController.getAllForms);
router.get('/:id', formController.getFormById);
router.put('/:id', formController.updateForm);
router.patch('/:id/status', formController.updateFormStatus);
router.delete('/:id', formController.deleteForm);

// Responses & Export
router.get('/:id/responses', formController.getFormResponses);
router.get('/:id/responses/export', formController.exportFormResponses);

module.exports = router;

