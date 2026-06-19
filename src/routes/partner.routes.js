const router = require('express').Router();
const partnerController = require('./partner/partner.controller');
const formController = require('./partner/formController');
const { protect, authorize } = require('../middlewares/auth.middleware');
const {
  validateAddPartner,
  validateAddProgram,
  validateUpdatePartner,
  validatePartnerProgramsQuery,
  validatePartnerIdParam,
  validateProgramIdParam,
} = require('./partner/partner.validation');

const superAdmin = [protect, authorize('SUPER_ADMIN')];
const admin = [protect, authorize('ADMIN', 'SUPER_ADMIN')];

router.post('/addpartner', ...superAdmin, validateAddPartner, partnerController.addPartner);
router.post('/addprogram', ...superAdmin, validateAddProgram, partnerController.addProgram);
router.get('/names', ...admin, partnerController.getPartnerNames);
router.get('/all-with-programs', ...admin, partnerController.getAllPartnersWithPrograms);
router.get('/count', ...admin, partnerController.getPartnerCount);
router.get('/stats', ...admin, partnerController.getPartnerStats);
router.get('/programs', ...admin, validatePartnerProgramsQuery, partnerController.getPartnerPrograms);
router.get('/programs/:programId', ...admin, validateProgramIdParam, partnerController.getPartnerProgramById);

router.patch('/programs/:programId/verification', ...superAdmin, validateProgramIdParam, partnerController.toggleVerificationStep);
router.patch('/programs/:programId', ...superAdmin, validateProgramIdParam, partnerController.updateProgramController);
router.delete('/programs/:programId', ...superAdmin, validateProgramIdParam, partnerController.deleteProgramController);

router.patch('/partners/:partnerId', ...superAdmin, validatePartnerIdParam, validateUpdatePartner, partnerController.updatePartnerById);
router.delete('/partners/:partnerId', ...superAdmin, validatePartnerIdParam, partnerController.deletePartnerById);

// Program Form routes
router.get('/forms/:programId', ...admin, validateProgramIdParam, formController.getForm);
router.post('/forms/:programId/save', ...admin, validateProgramIdParam, formController.saveDraft);
router.post('/forms/:programId/submit', ...admin, validateProgramIdParam, formController.submitProgramForm);
router.patch('/forms/:programId', ...superAdmin, validateProgramIdParam, formController.editSubmittedForm);
router.delete('/forms/:programId', ...superAdmin, validateProgramIdParam, formController.deleteProgramForm);
router.post('/forms/:programId/reopen', ...superAdmin, validateProgramIdParam, formController.reopenForm);

module.exports = router;
