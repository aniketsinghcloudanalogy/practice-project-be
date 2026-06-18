const router = require('express').Router();

const aiPdfController = require('./aiPdf/aiPdf.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
	uploadPdf,
	validateUploadedPdf,
	validateSyncPayload,
	validateUploadIdParam,
} = require('./aiPdf/aiPdf.validation');

router.use(protect);

// Upload + extract
router.route('/extract').post(uploadPdf, validateUploadedPdf, aiPdfController.extract);

// Read — available DB fields for line item mapping
router.route('/line-item-fields').get(aiPdfController.getLineItemFieldOptions);

// Read — list all uploads
router.route('/').get(aiPdfController.getUploads);

// Read — line items created for a specific upload
router.route('/:uploadId/line-items').get(validateUploadIdParam, aiPdfController.getUploadLineItems);

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