const bcrypt = require('bcryptjs');

const SALT = 12;

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword
};