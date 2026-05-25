const { databaseUrl, env } = require('./index');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const createPrismaClient = () => {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl
    })
  });
};


const globalForPrisma = global;

const prisma = globalForPrisma.prisma || createPrismaClient();

if (env !== 'production') {
  globalForPrisma.prisma = prisma;
}


module.exports = prisma;