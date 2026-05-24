const prisma = require('../../config/prisma');

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  password: true,
  image: true,
  role: true,
  authProvider: true,
  providerAccountId: true,
  createdAt: true,
  updatedAt: true
};

const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: USER_SELECT
  });
};

const findUserByProviderAccount = (authProvider, providerAccountId) => {
  return prisma.user.findFirst({
    where: {
      authProvider,
      providerAccountId
    },
    select: USER_SELECT
  });
};

const findUserById = (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT
  });
};

const createUser = (data) => {
  return prisma.user.create({
    data,
    select: USER_SELECT
  });
};

const updateUser = (id, data) => {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT
  });
};

module.exports = {
  USER_SELECT,
  findUserByEmail,
  findUserByProviderAccount,
  findUserById,
  createUser,
  updateUser
};