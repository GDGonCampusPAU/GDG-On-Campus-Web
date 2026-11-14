const express = require('express');
const router = express.Router();
const formParticipantMiddleware = require('../modules/participantAuth/middleware/formParticipantMiddleware');
const formController = require('../controllers/formController');
const myApplication = require('../controllers/myApplicationController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { uploadFormFiles } = require('../middleware/uploadMiddleware');

// ==========================================
// Public Endpoints (Anket/Form Doldurma)
// ==========================================
router.get('/public/:slugOrId', formController.getPublicForm);
router.get('/public/:slugOrId/my-submission', formParticipantMiddleware, formController.getMySubmission);
router.get('/public/:slugOrId/teams/:code', formParticipantMiddleware, formController.lookupFormTeam);

// "Başvurum": the verified participant's own application and team.
const mine = '/public/:slugOrId/my-application';
router.get(mine, formParticipantMiddleware, myApplication.getMyApplication);
router.put(mine, formParticipantMiddleware, myApplication.updateMyApplication);
router.post(`${mine}/team/join`, formParticipantMiddleware, myApplication.joinTeam);
router.post(`${mine}/team/create`, formParticipantMiddleware, myApplication.createTeam);
router.post(`${mine}/team/transfer/code`, formParticipantMiddleware, myApplication.sendTransferCode);
router.post(`${mine}/team/transfer`, formParticipantMiddleware, myApplication.transferCaptaincy);
router.post(`${mine}/team/withdraw`, formParticipantMiddleware, myApplication.withdrawRequest);
router.post(`${mine}/team/leave`, formParticipantMiddleware, myApplication.leaveTeam);
router.post(`${mine}/team/requests/:participantId/approve`, formParticipantMiddleware, myApplication.approveRequest);
router.post(`${mine}/team/requests/:participantId/reject`, formParticipantMiddleware, myApplication.rejectRequest);
router.post(`${mine}/team/members/:participantId/remove`, formParticipantMiddleware, myApplication.removeMember);
router.post(`${mine}/team/disband/code`, formParticipantMiddleware, myApplication.sendDisbandCode);
router.post(`${mine}/team/disband`, formParticipantMiddleware, myApplication.disbandTeam);
router.post('/public/:slugOrId/submit', formParticipantMiddleware, uploadFormFiles.any(), formController.submitFormResponse);

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

// Responses, Status & Export
router.get('/:id/responses', formController.getFormResponses);
router.patch('/:id/responses/:responseId/status', formController.updateFormResponseStatus);
router.get('/:id/responses/export', formController.exportFormResponses);

module.exports = router;

