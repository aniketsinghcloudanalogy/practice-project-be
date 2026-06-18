const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');

const upload = require('../../config/multer');
const ApiError = require('../../utils/ApiError');

const removeUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const uploadPdf = (req, res, next) => {
  upload.single('pdf')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'PDF file size must not exceed 1MB'));
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

const syncRowSchema = z
  .object({
    id: z.string().trim().optional(),
    rowData: z.record(z.any()),
    rowIndex: z.number().int().min(0).optional(),
  })
  .strict();

const syncTableSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z.string().trim().nullable().optional(),
    columns: z.array(z.any()).default([]),
    lineItemMapping: z.record(z.string()).default({}),
    rows: z.array(syncRowSchema).default([]),
  })
  .strict();

const syncUploadSchema = z
  .object({
    tables: z.array(syncTableSchema),
  })
  .strict();

const validateSyncPayload = (req, res, next) => {
  const parsed = syncUploadSchema.safeParse(req.body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return next(new ApiError(400, `${firstIssue.path.join('.')} - ${firstIssue.message}`));
  }

  req.body = parsed.data;
  return next();
};

const validateUploadIdParam = (req, res, next) => {
  const { uploadId } = req.params;

  if (!uploadId || typeof uploadId !== 'string' || uploadId.trim().length === 0) {
    return next(new ApiError(400, 'Invalid upload id'));
  }

  return next();
};

module.exports = {
  uploadPdf,
  validateUploadedPdf,
  validateSyncPayload,
  validateUploadIdParam,
};
