const router = require('express').Router();

const aiPdfController = require('./aiPdf/aiPdf.controller');
const { protect } = require('../middlewares/auth.middleware');
const { uploadPdf, validateUploadedPdf } = require('./aiPdf/aiPdf.validation');

router.use(protect);

router.route('/extract').post(uploadPdf, validateUploadedPdf, aiPdfController.extract);

module.exports = router;
