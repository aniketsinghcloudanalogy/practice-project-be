const router = require('express').Router();
const userController = require('./user/user.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { validateSignup, validateLogin, validateOAuth } = require('./user/user.validation');

router.post('/signup', validateSignup, userController.signup);
router.post('/login', validateLogin, userController.login);
router.post('/logout', protect, userController.logout);
router.post('/refresh', userController.refresh);
router.post('/oauth', validateOAuth, userController.oauth);
router.get('/me', protect, userController.me);
router.get('/me/contacts', protect, userController.getMyContacts);

// Admin activation/deactivation routes (only SUPER_ADMIN)
router.post('/admins/:adminId/activate', protect, authorize('SUPER_ADMIN'), userController.activateAdmin);
router.post('/admins/:adminId/deactivate', protect, authorize('SUPER_ADMIN'), userController.deactivateAdmin);
router.get('/admins', protect, authorize('SUPER_ADMIN'), userController.listAdmins);

// List all users (ADMIN + SUPER_ADMIN)
router.get('/list', protect, authorize('ADMIN', 'SUPER_ADMIN'), userController.listUsers);

// Toggle any user active/inactive (ADMIN + SUPER_ADMIN)
router.patch('/:userId/active', protect, authorize('ADMIN', 'SUPER_ADMIN'), userController.toggleUserActive);

// Lightweight directory (id/name/email only) for any authenticated user —
// used to populate organizer/participant pickers in the scheduler, etc.
router.get('/directory', protect, userController.listUserDirectory);


module.exports = router;
