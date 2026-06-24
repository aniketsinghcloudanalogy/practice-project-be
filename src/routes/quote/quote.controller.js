const asyncHandler = require('../../utils/asyncHandler');
const quoteModel = require('./helper');
const ApiResponse = require('../../utils/ApiResponse');

const createQuote = asyncHandler(async (req, res) => {
  const result = await quoteModel.createQuoteWithUploads({
    userId: req.user.id,
    name: req.body.name,
    files: req.quoteFiles ?? [],
  });

  return res.status(201).json(
    new ApiResponse(201, 'Quote created successfully', {
      quote: result.quote,
      files: result.files,
      lineItemCount: result.lineItemCount,
    })
  );
});

const addFilesToQuote = asyncHandler(async (req, res) => {
  const result = await quoteModel.addFilesToExistingQuote({
    quoteId: req.params.quoteId,
    userId: req.user.id,
    files: req.quoteFiles ?? [],
  });

  return res.status(201).json(
    new ApiResponse(201, 'Files added to quote successfully', {
      quote: result.quote,
      files: result.files,
      lineItemCount: result.lineItemCount,
    })
  );
});

const getQuotes = asyncHandler(async (req, res) => {
  const quotes = await quoteModel.getQuotesByUserId(req.user.id);

  return res.status(200).json(
    new ApiResponse(200, 'Quotes fetched successfully', { quotes })
  );
});

const getQuoteDetail = asyncHandler(async (req, res) => {
  const detail = await quoteModel.getQuoteDetailById(req.params.quoteId, req.user.id);

  return res.status(200).json(
    new ApiResponse(200, 'Quote fetched successfully', detail)
  );
});

module.exports = {
  createQuote,
  addFilesToQuote,
  getQuotes,
  getQuoteDetail
};