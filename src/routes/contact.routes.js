const router = require('express').Router();

const contactController = require('./contact/contact.controller');


const {
    validateContact,
} = require('./contact/contact.validation');

router.post('/', validateContact, contactController.createContact);

module.exports = router;