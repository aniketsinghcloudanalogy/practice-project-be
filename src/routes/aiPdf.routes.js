const router = require('express').Router();

const aiPdfController = require('./aiPdf/aiPdf.controller');
const { protect } = require('../middlewares/auth.middleware');
<<<<<<< HEAD
const {
	uploadPdf,
	validateUploadedPdf,
	validateSyncPayload,
	validateUploadIdParam,
} = require('./aiPdf/aiPdf.validation');

router.use(protect);

// Upload + extract
router.route('/extract').post(uploadPdf, validateUploadedPdf, aiPdfController.extract);

// Read — list all uploads
router.route('/').get(aiPdfController.getUploads);

// Read — single upload with all tables + rows
router
	.route('/:uploadId')
	.get(validateUploadIdParam, aiPdfController.getUploadDetail)
	.delete(validateUploadIdParam, aiPdfController.deleteUpload);

// Sync all table changes for an upload
router
	.route('/:uploadId/sync')
	.put(validateUploadIdParam, validateSyncPayload, aiPdfController.syncUpload);

module.exports = router;
=======
const { uploadPdf, validateUploadedPdf } = require('./aiPdf/aiPdf.validation');

router.use(protect);

router.route('/extract').post(uploadPdf, validateUploadedPdf, aiPdfController.extract);

module.exports = router;
>>>>>>> 7b4a63e (added upload api routes)
