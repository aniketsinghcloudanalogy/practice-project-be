require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = 'anmolvishw@maildrop.cc';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Super admin already exists, skipping.');
    return;
  }

  const password = await bcrypt.hash('Anmol@123', 12);

  await prisma.user.create({
    data: {
      name: 'Anmol_Super_Admin',
      email,
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
      authProvider: 'CREDENTIALS',
    },
  });

  console.log('Super admin seeded successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
