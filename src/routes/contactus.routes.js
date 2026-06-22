const router = require('express').Router();
const contactusController = require('./contactus/contactus.controller');
const { validateContactus } = require('./contactus/contactus.validation');

router.post('/', validateContactus, contactusController.createContact);

module.exports = router;
