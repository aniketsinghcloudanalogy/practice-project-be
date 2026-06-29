const prisma = require('../../config/prisma');

const CUSTOMER_SELECT = {
  id: true,
  userId: true,
  name: true,
  currency: true,
  website: true,
  industry: true,
  profileImage: true,
  organization: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  addresses: {
    where: { isDeleted: false },
    select: {
      id: true,
      addressLine: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      type: true,
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  },
  contacts: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      primaryContact: true,
      secondaryContact: true,
    },
    take: 1,
    orderBy: { createdAt: 'asc' },
  },
};

const createCustomer = (userId, data) => {
  return prisma.customer.create({
    data: { ...data, userId },
    select: CUSTOMER_SELECT,
  });
};

const findCustomersByUserId = (userId) => {
  return prisma.customer.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: CUSTOMER_SELECT,
  });
};

const findCustomerByIdAndUserId = (id, userId) => {
  return prisma.customer.findFirst({
    where: { id, userId, isDeleted: false },
    select: CUSTOMER_SELECT,
  });
};

const updateCustomer = (id, userId, data) => {
  return prisma.customer.updateMany({
    where: { id, userId, isDeleted: false },
    data,
  });
};

// Soft delete
const deleteCustomer = (id, userId) => {
  return prisma.customer.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true },
  });
};

module.exports = {
  CUSTOMER_SELECT,
  createCustomer,
  findCustomersByUserId,
  findCustomerByIdAndUserId,
  updateCustomer,
  deleteCustomer,
};
