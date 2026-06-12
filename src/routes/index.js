const router = require('express').Router();

const userRoutes = require('./user.routes');
const contactusRoutes = require('./contactus.routes');
const contactsRoutes = require('./contacts.routes');
const partnerRoutes = require('./partner.routes');

router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'API is running',
  });
});

router.use('/users', userRoutes);
router.use('/contact', contactusRoutes);
router.use('/contacts', contactsRoutes);
router.use('/partners', partnerRoutes);

module.exports = router;
