const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
  }

  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
  }

  if (err.code === 'P2002') {
    message = 'Resource already exists';
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message
  });
};

module.exports = errorHandler;
