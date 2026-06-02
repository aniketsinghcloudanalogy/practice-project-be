require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  clientUrl: process.env.CLIENT_URL || '',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
  internalAuthSecret: process.env.INTERNAL_AUTH_SECRET || '',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    to:process.env.CONTACT_RECEIVER,
  },
};
