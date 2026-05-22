const jwt = require('jsonwebtoken');
const config = require('../config');

const generateAccessToken = (payload) => {
  if (!config.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }

  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessExpiresIn
  });
};

const verifyAccessToken = (token) => {
  if (!config.jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }

  return jwt.verify(token, config.jwtAccessSecret);
};

module.exports = {
  generateAccessToken,
  verifyAccessToken
};