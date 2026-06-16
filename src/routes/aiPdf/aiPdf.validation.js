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

module.exports = {
  uploadPdf,
  validateUploadedPdf,
};
