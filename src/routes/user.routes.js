const router = require('express').Router();
const userController = require('./user/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateSignup, validateLogin, validateOAuth } = require('./user/user.validation');

router.post('/signup', validateSignup, userController.signup);
router.post('/login', validateLogin, userController.login);
router.post('/logout', userController.logout);
router.post('/oauth', validateOAuth, userController.oauth);
router.get('/me', protect, userController.me);

module.exports = router;
