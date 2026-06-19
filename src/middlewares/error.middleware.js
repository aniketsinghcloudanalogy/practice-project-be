const ApiResponse = require('../utils/ApiResponse');

const errorHandler = (err, req, res, next) => {
  // Prevent sending response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message || err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // --- JWT Errors ---
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not active yet';
  }

  // --- Prisma Errors ---
  if (err.code === 'P2002') {
    statusCode = 409;
    const fields = Array.isArray(err.meta?.target) ? err.meta.target : [];
    if (fields.includes('email')) {
      message = 'Email already exists';
    } else if (fields.includes('primaryContact')) {
      message = 'Primary contact already exists';
    } else if (fields.includes('partnerName')) {
      message = 'Partner with this name already exists';
    } else {
      message = 'Resource already exists';
    }
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message = err.meta?.cause || 'Record not found';
  }

  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Related record not found (foreign key constraint failed)';
  }

  if (err.code === 'P2014') {
    statusCode = 400;
    message = 'Invalid relation: the change would violate a required relation';
  }

  if (err.code === 'P2016' || err.code === 'P2018' || err.code === 'P2021' || err.code === 'P2022') {
    statusCode = 500;
    message = 'Database error';
  }

  // --- Validation / Parsing Errors ---
  if (err.name === 'ValidationError' || err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = err.message || 'Invalid request body';
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // --- Multer (file upload) Errors ---
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File too large';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  }

  // --- Express Joi/Zod validation ---
  if (err.isJoi || err.name === 'ZodError') {
    statusCode = 400;
    const details = err.details || err.errors;
    message = Array.isArray(details)
      ? details.map((d) => d.message || d.path?.join('.')).join(', ')
      : err.message;
  }

  // --- Network / Timeout ---
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 502;
    message = 'External service unavailable';
  }

  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    statusCode = 504;
    message = 'External service timed out';
  }

  // --- Safety: hide internal messages in production ---
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  return res.status(statusCode).json(new ApiResponse(statusCode, message, null));
};

module.exports = errorHandler;
