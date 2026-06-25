const router = require('express').Router();
const customerController = require('./customer/customer.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateCreateCustomer, validateUpdateCustomer } = require('./customer/customer.validation');

router.use(protect);

router
  .route('/')
  .post(validateCreateCustomer, customerController.createCustomer)
  .get(customerController.getCustomers);

router
  .route('/:customerId')
  .get(customerController.getCustomer)
  .patch(validateUpdateCustomer, customerController.updateCustomer)
  .delete(customerController.deleteCustomer);

module.exports = router;
