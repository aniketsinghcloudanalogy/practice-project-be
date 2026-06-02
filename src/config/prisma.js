require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const config = require('./index');

const createPrismaClient = () => {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: config.databaseUrl
    })
  });
};

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || createPrismaClient();

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;