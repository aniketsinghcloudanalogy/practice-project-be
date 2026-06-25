const router = require('express').Router();
const { submitToClient } = require('./dealreg/dealreg.controller');

// POST /api/dealreg/submit — fill & submit on client site
router.post('/submit', submitToClient);

module.exports = router;
