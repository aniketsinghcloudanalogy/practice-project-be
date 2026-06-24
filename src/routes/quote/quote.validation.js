const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');

const upload = require('../../config/multer');
const ApiError = require('../../utils/ApiError');

const removeUploadedFiles = (files = []) => {
  files.forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

const uploadQuotePdfs = (req, res, next) => {
  upload.fields([
    { name: 'pdf', maxCount: 10 },
    { name: 'pdfs', maxCount: 10 },
  ])(req, res, (error) => {
    if (!error) {
      const singleFiles = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
      const multiFiles = Array.isArray(req.files?.pdfs) ? req.files.pdfs : [];
      req.quoteFiles = [...singleFiles, ...multiFiles];
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'PDF file size must not exceed 1MB'));
    }

    if (error.message === 'Only PDF files are allowed') {
      return next(new ApiError(400, 'Only PDF files are allowed'));
    }

    return next(new ApiError(400, error.message || 'PDF upload failed'));
  });
};

const createQuoteSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(255, 'name must be at most 255 characters'),
});

const validateCreateQuote = (req, res, next) => {
  const files = req.quoteFiles || [];

  if (!Array.isArray(files) || files.length === 0) {
    return next(new ApiError(400, 'At least one PDF file is required'));
  }

  for (const file of files) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isPdf =
      ext === '.pdf' &&
      (file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf');

    if (!isPdf) {
      removeUploadedFiles(files);
      return next(new ApiError(400, 'Only PDF files are allowed'));
    }
  }

  const parsed = createQuoteSchema.safeParse(req.body || {});

  if (!parsed.success) {
    removeUploadedFiles(files);
    const firstIssue = parsed.error.issues[0];
    return next(new ApiError(400, firstIssue?.message || 'Validation failed'));
  }

  req.body = parsed.data;
  return next();
};

const validateAddQuoteFiles = (req, res, next) => {
  const files = req.quoteFiles || [];

  if (!Array.isArray(files) || files.length === 0) {
    return next(new ApiError(400, 'At least one PDF file is required'));
  }

  for (const file of files) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isPdf =
      ext === '.pdf' &&
      (file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf');

    if (!isPdf) {
      removeUploadedFiles(files);
      return next(new ApiError(400, 'Only PDF files are allowed'));
    }
  }

  return next();
};

const validateQuoteIdParam = (req, res, next) => {
  const { quoteId } = req.params;

  if (!quoteId || typeof quoteId !== 'string' || quoteId.trim().length === 0) {
    return next(new ApiError(400, 'Invalid quote id'));
  }

  return next();
};

module.exports = {
  uploadQuotePdfs,
  validateCreateQuote,
  validateAddQuoteFiles,
  validateQuoteIdParam,
};
