const fs = require('fs');
const path = require('path');
const multer = require('multer');

const upload = require('../../config/multer');
const ApiError = require('../../utils/ApiError');

const removeUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const uploadPdf = (req, res, next) => {
  upload.single('pdf')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'PDF file size must not exceed 10MB'));
    }

    if (error.message === 'Only PDF files are allowed') {
      return next(new ApiError(400, 'Only PDF files are allowed'));
    }

    return next(new ApiError(400, error.message || 'PDF upload failed'));
  });
};

const validateUploadedPdf = (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'PDF file is required'));
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const isPdf =
    ext === '.pdf' &&
    (req.file.mimetype === 'application/pdf' || req.file.mimetype === 'application/x-pdf');

  if (!isPdf) {
    removeUploadedFile(req.file.path);
    return next(new ApiError(400, 'Only PDF files are allowed'));
  }

  return next();
};

const validateExtractedData = (req, res, next) => {
  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return next(new ApiError(400, 'Request body is required'));
  }

  const allowedFields = ['extractedData'];
  const invalidField = Object.keys(body).find((field) => !allowedFields.includes(field));

  if (invalidField) {
    return next(new ApiError(400, `${invalidField} cannot be updated`));
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'extractedData')) {
    return next(new ApiError(400, 'extractedData is required'));
  }

  const { extractedData } = body;
  const isValidExtractedData =
    extractedData !== null &&
    typeof extractedData === 'object';

  if (!isValidExtractedData) {
    return next(new ApiError(400, 'extractedData must be an object or array'));
  }

  return next();
};

const validateTablePayload = (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ApiError(400, 'Request body is required'));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'title') && body.title !== null && typeof body.title !== 'string') {
    return next(new ApiError(400, 'title must be a string or null'));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'columns') && !Array.isArray(body.columns)) {
    return next(new ApiError(400, 'columns must be an array'));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'rows') && !Array.isArray(body.rows)) {
    return next(new ApiError(400, 'rows must be an array'));
  }

  return next();
};

const validateRowPayload = (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ApiError(400, 'Request body is required'));
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'rowData')) {
    return next(new ApiError(400, 'rowData is required'));
  }

  if (body.rowData === null || typeof body.rowData !== 'object' || Array.isArray(body.rowData)) {
    return next(new ApiError(400, 'rowData must be an object'));
  }

  return next();
};

const validateBulkRowPayload = (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ApiError(400, 'Request body is required'));
  }

  if (!Array.isArray(body.updates)) {
    return next(new ApiError(400, 'updates must be an array'));
  }

  if (body.updates.length === 0) {
    return next(new ApiError(400, 'updates must include at least one row'));
  }

  const invalidUpdate = body.updates.find((update) => {
    return (
      !update ||
      typeof update !== 'object' ||
      Array.isArray(update) ||
      !Object.prototype.hasOwnProperty.call(update, 'rowId') ||
      typeof update.rowId !== 'string' ||
      update.rowId.trim() === '' ||
      !Object.prototype.hasOwnProperty.call(update, 'rowData') ||
      update.rowData === null ||
      typeof update.rowData !== 'object' ||
      Array.isArray(update.rowData)
    );
  });

  if (invalidUpdate) {
    return next(new ApiError(400, 'Each update must include rowId and rowData object'));
  }

  return next();
};

const validateBulkDeleteRowPayload = (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ApiError(400, 'Request body is required'));
  }

  if (!Array.isArray(body.rowIds)) {
    return next(new ApiError(400, 'rowIds must be an array'));
  }

  if (body.rowIds.length === 0) {
    return next(new ApiError(400, 'rowIds must include at least one row'));
  }

  const invalidRowId = body.rowIds.find((rowId) => typeof rowId !== 'string' || rowId.trim() === '');

  if (invalidRowId) {
    return next(new ApiError(400, 'Each rowId must be a non-empty string'));
  }

  return next();
};

module.exports = {
  uploadPdf,
  validateUploadedPdf,
  validateExtractedData,
  validateTablePayload,
  validateRowPayload,
  validateBulkRowPayload,
  validateBulkDeleteRowPayload,
};
