const router = require('express').Router();
const formsController = require('./forms/forms.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const {
  validateDraft,
  validateUpdateDraft,
  validateSubmit,
  validateDirectSubmit,
} = require('./forms/forms.validation');

// Public routes (no auth required — supports anonymous drafts)
router.post('/draft', validateDraft, formsController.saveDraft);
router.patch('/:id/draft', validateUpdateDraft, formsController.updateDraft);
router.post('/:id/submit', validateSubmit, formsController.submitDraft);
router.post('/submit', validateDirectSubmit, formsController.directSubmit);
router.get('/draft', formsController.getDraft);

// Authenticated routes
router.get('/my', protect, formsController.getMyForms);
router.get('/:id', protect, formsController.getFormById);

// Super Admin routes
router.post('/:id/reopen', protect, authorize('SUPER_ADMIN'), formsController.reopenForm);

// Admin routes
router.get('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), formsController.listForms);
router.delete('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), formsController.deleteForm);

module.exports = router;
