const router = require('express').Router();

const pdfController = require('./pdf/pdf.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  uploadPdf,
  validateUploadedPdf,
  validateTablePayload,
  validateRowPayload,
  validateBulkRowPayload,
  validateBulkDeleteRowPayload,
} = require('./pdf/pdf.validation');

router.use(protect);

router
  .route('/')
  .get(pdfController.getUserPdfs);

router
  .route('/merged-data')
  .get(pdfController.getMergedExtractedData);

router
  .route('/tables')
  .get(pdfController.getPdfTables)
  .post(validateTablePayload, pdfController.createPdfTable);

router
  .route('/tables/:tableId')
  .get(pdfController.getPdf)
  .patch(validateTablePayload, pdfController.updatePdfTable)
  .put(validateTablePayload, pdfController.replacePdfTable)
  .delete(pdfController.deletePdfTable);

router
  .route('/tables/:tableId/rows')
  .post(validateRowPayload, pdfController.createPdfTableRow)
  .delete(pdfController.clearPdfTableRows);

router
  .route('/tables/:tableId/rows/bulk')
  .patch(validateBulkRowPayload, pdfController.bulkUpdatePdfTableRows)
  .delete(validateBulkDeleteRowPayload, pdfController.bulkDeletePdfTableRows);

router
  .route('/tables/:tableId/rows/:rowId')
  .patch(validateRowPayload, pdfController.updatePdfTableRow)
  .delete(pdfController.deletePdfTableRow);

router
  .route('/upload')
  .post(uploadPdf, validateUploadedPdf, pdfController.uploadPdf);

module.exports = router;
