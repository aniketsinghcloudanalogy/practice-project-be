const router = require('express').Router();
const opportunityController = require('./opportunity/opportunity.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateCreateOpportunity, validateUpdateOpportunity } = require('./opportunity/opportunity.validation');

router.use(protect);

router
  .route('/')
  .post(validateCreateOpportunity, opportunityController.createOpportunity)
  .get(opportunityController.getOpportunities);

router
  .route('/:opportunityId')
  .get(opportunityController.getOpportunity)
  .patch(validateUpdateOpportunity, opportunityController.updateOpportunity)
  .delete(opportunityController.deleteOpportunity);

module.exports = router;
