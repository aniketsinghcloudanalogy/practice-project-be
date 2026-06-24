const router = require('express').Router();

const quoteController = require('./quote/quote.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  uploadQuotePdfs,
  validateCreateQuote,
  validateAddQuoteFiles,
  validateQuoteIdParam,
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

module.exports = router;
