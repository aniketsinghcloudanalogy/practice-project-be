const router = require('express').Router();

const userRoutes = require('./user.routes');
const contactusRoutes = require('./contactus.routes');
const contactsRoutes = require('./contacts.routes');
const pdfRoutes = require('./pdf.routes');
const partnerRoutes = require('./partner.routes');
const formsRoutes = require('./forms.routes');
const dealregRoutes = require('./dealreg.routes');

router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'API is running',
  });
});

router.use('/users', userRoutes);
router.use('/contact', contactusRoutes);
router.use('/contacts', contactsRoutes);
router.use('/pdf', pdfRoutes);
router.use('/pdfs', pdfRoutes);
router.use('/partners', partnerRoutes);
router.use('/forms', formsRoutes);
router.use('/dealreg', dealregRoutes);

module.exports = router;
