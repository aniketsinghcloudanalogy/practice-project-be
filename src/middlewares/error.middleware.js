const { env } = require('../config/index');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';


  if (err.name === "TokenExpiredHandler") {
    message = "Token expired"

  }
  if (err.name === "JsonWebTokenError") {
    message = "Invalid Token"

  }
  if (err.name === "P2002") {
    message = "Resource Already Exists"

  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && env === 'production' ? 'Internal Server Error' : message
  });
};

module.exports = errorHandler;