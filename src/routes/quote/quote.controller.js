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
      extractedRowCount: result.lineItemCount,
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
      extractedRowCount: result.lineItemCount,
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

const verifyQuoteFile = asyncHandler(async (req, res) => {
  const result = await quoteModel.verifyQuoteFileById({
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Quote file verified successfully', result)
  );
});

const createLineItem = asyncHandler(async (req, res) => {
  const result = await quoteModel.createLineItem({
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
    data: req.body,
  });

  return res.status(201).json(
    new ApiResponse(201, 'Line item created successfully', result)
  );
});




const getLineItemsByFile = asyncHandler(async (req, res) => {
  const result = await quoteModel.getLineItemsByQuoteFileId({
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Line items fetched successfully', result)
  );
});

const updateLineItem = asyncHandler(async (req, res) => {
  const result = await quoteModel.updateLineItem({
    lineItemId: req.params.lineItemId,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
    data: req.body,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Line item updated successfully', result)
  );
});

const deleteLineItem = asyncHandler(async (req, res) => {
  const result = await quoteModel.deleteLineItem({
    lineItemId: req.params.lineItemId,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Line item deleted successfully', result)
  );
});

const bulkDeleteLineItems = asyncHandler(async (req, res) => {
  const result = await quoteModel.bulkDeleteLineItems({
    lineItemIds: req.body.lineItemIds,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Line items deleted successfully', result)
  );
});

const bulkUpdateLineItems = asyncHandler(async (req, res) => {
  const result = await quoteModel.bulkUpdateLineItems({
    lineItemIds: req.body.lineItemIds,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
    data: req.body.data,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Line items updated successfully', result)
  );
});

const getProfitabilityLineItems = asyncHandler(async (req, res) => {
  const result = await quoteModel.getProfitabilityLineItems({
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });
  return res.status(200).json(new ApiResponse(200, 'Profitability line items fetched', result));
});

const bulkUpdateProfitabilityLineItems = asyncHandler(async (req, res) => {
  const result = await quoteModel.bulkUpdateProfitabilityLineItems({
    lineItemIds: req.body.lineItemIds,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
    data: req.body.data,
  });
  return res.status(200).json(new ApiResponse(200, 'Profitability line items updated', result));
});

const bulkDeleteProfitabilityLineItems = asyncHandler(async (req, res) => {
  const result = await quoteModel.bulkDeleteProfitabilityLineItems({
    lineItemIds: req.body.lineItemIds,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });
  return res.status(200).json(new ApiResponse(200, 'Profitability line items deleted', result));
});

const deleteProfitabilityLineItem = asyncHandler(async (req, res) => {
  const result = await quoteModel.deleteProfitabilityLineItem({
    itemId: req.params.itemId,
    quoteId: req.params.quoteId,
    quoteFileId: req.params.quoteFileId,
    userId: req.user.id,
  });
  return res.status(200).json(new ApiResponse(200, 'Profitability line item deleted', result));
});

module.exports = {
  createQuote,
  addFilesToQuote,
  getQuotes,
  getQuoteDetail,
  verifyQuoteFile,
  createLineItem,
  getLineItemsByFile,
  updateLineItem,
  deleteLineItem,
  bulkDeleteLineItems,
  bulkUpdateLineItems,
  getProfitabilityLineItems,
  bulkUpdateProfitabilityLineItems,
  bulkDeleteProfitabilityLineItems,
  deleteProfitabilityLineItem,
};