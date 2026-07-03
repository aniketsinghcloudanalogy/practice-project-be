const router = require('express').Router();

const quoteController = require('./quote/quote.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  uploadQuotePdfs,
  validateCreateQuote,
  validateAddQuoteFiles,
  validateQuoteIdParam,
  validateQuoteFileIdParam,
  validateLineItemIdParam,
} = require('./quote/quote.validation');

router.use(protect);

router
  .route('/')
  .post(uploadQuotePdfs, validateCreateQuote, quoteController.createQuote)
  .get(quoteController.getQuotes);

router
  .route('/:quoteId')
  .get(validateQuoteIdParam, quoteController.getQuoteDetail);

router
  .route('/:quoteId/files')
  .post(
    validateQuoteIdParam,
    uploadQuotePdfs,
    validateAddQuoteFiles,
    quoteController.addFilesToQuote
  );

router
  .route('/:quoteId/files/:quoteFileId/verify')
  .patch(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    quoteController.verifyQuoteFile
  );

router
  .route('/:quoteId/files/:quoteFileId/line-items')
  .post(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    quoteController.createLineItem
  )
  .get(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    quoteController.getLineItemsByFile
  );

router
  .route('/:quoteId/files/:quoteFileId/profitability-items')
  .get(validateQuoteIdParam, validateQuoteFileIdParam, quoteController.getProfitabilityLineItems);

router
  .route('/:quoteId/files/:quoteFileId/profitability-items/bulk')
  .patch(validateQuoteIdParam, validateQuoteFileIdParam, quoteController.bulkUpdateProfitabilityLineItems)
  .delete(validateQuoteIdParam, validateQuoteFileIdParam, quoteController.bulkDeleteProfitabilityLineItems);

router
  .route('/:quoteId/files/:quoteFileId/profitability-items/:itemId')
  .delete(validateQuoteIdParam, validateQuoteFileIdParam, quoteController.deleteProfitabilityLineItem);

router
  .route('/:quoteId/files/:quoteFileId/line-items/bulk')
  .patch(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    quoteController.bulkUpdateLineItems
  )
  .delete(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    quoteController.bulkDeleteLineItems
  );

router
  .route('/:quoteId/files/:quoteFileId/line-items/:lineItemId')
  .patch(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    validateLineItemIdParam,
    quoteController.updateLineItem
  )
  .delete(
    validateQuoteIdParam,
    validateQuoteFileIdParam,
    validateLineItemIdParam,
    quoteController.deleteLineItem
  );

module.exports = router;
