const router = require('express').Router();
const partnerController = require('./partner/partner.controller');
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

router.post('/addpartner', ...superAdmin, validateAddPartner, partnerController.addPartner);
router.post('/addprogram', ...superAdmin, validateAddProgram, partnerController.addProgram);
router.get('/names', ...superAdmin, partnerController.getPartnerNames);
router.get('/count', ...superAdmin, partnerController.getPartnerCount);
router.get('/stats', ...superAdmin, partnerController.getPartnerStats);
router.get('/programs', ...superAdmin, validatePartnerProgramsQuery, partnerController.getPartnerPrograms);

router.patch('/programs/:programId/verification', ...superAdmin, validateProgramIdParam, partnerController.toggleVerificationStep);

router.patch('/partners/:partnerId', ...superAdmin, validatePartnerIdParam, validateUpdatePartner, partnerController.updatePartnerById);
router.delete('/partners/:partnerId', ...superAdmin, validatePartnerIdParam, partnerController.deletePartnerById);

module.exports = router;
