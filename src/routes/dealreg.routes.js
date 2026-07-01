const router = require('express').Router();
const { submitToClient, openLoginBrowser } = require('./dealreg/dealreg.controller');

router.post('/submit', submitToClient);
router.post('/open-login-browser', openLoginBrowser);

module.exports = router;
