const router = require('express').Router();
const customerController = require('./customer/customer.controller');
const addressController = require('./customer/address.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateCreateCustomer, validateUpdateCustomer } = require('./customer/customer.validation');
const { validateCreateAddress, validateUpdateAddress } = require('./customer/address.validation');

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

// Address routes nested under customer
router
  .route('/:customerId/addresses')
  .post(validateCreateAddress, addressController.createAddress)
  .get(addressController.getAddresses);

router
  .route('/:customerId/addresses/:addressId')
  .get(addressController.getAddress)
  .patch(validateUpdateAddress, addressController.updateAddress)
  .delete(addressController.deleteAddress);

module.exports = router;
