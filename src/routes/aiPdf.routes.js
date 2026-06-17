const router = require('express').Router();

const aiPdfController = require('./aiPdf/aiPdf.controller');
const { protect } = require('../middlewares/auth.middleware');
const { uploadPdf, validateUploadedPdf } = require('./aiPdf/aiPdf.validation');

router.use(protect);

// Upload + extract
router.route('/extract').post(uploadPdf, validateUploadedPdf, aiPdfController.extract);

// Read — list all uploads
router.route('/').get(aiPdfController.getUploads);

// Read — single upload with all tables + rows
router.route('/:uploadId').get(aiPdfController.getUploadDetail);

module.exports = router;