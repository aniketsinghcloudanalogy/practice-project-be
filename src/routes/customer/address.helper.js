const prisma = require('../../config/prisma');

const ADDRESS_SELECT = {
  id: true,
  userId: true,
  customerId: true,
  addressLine: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  type: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
  createdAt: true,
  updatedAt: true,
};

const createAddress = async (userId, customerId, data) => {
  const { isDefaultShipping, isDefaultBilling, type, ...rest } = data;

  if (isDefaultShipping) {
    await prisma.address.updateMany({ where: { userId, customerId, isDefaultShipping: true, isDeleted: false }, data: { isDefaultShipping: false } });
  }
  if (isDefaultBilling) {
    await prisma.address.updateMany({ where: { userId, customerId, isDefaultBilling: true, isDeleted: false }, data: { isDefaultBilling: false } });
  }

  return prisma.address.create({
    data: { ...rest, type, userId, customerId, isDefaultShipping: !!isDefaultShipping, isDefaultBilling: !!isDefaultBilling },
    select: ADDRESS_SELECT,
  });
};

const findAddressesByCustomer = (userId, customerId) => {
  return prisma.address.findMany({
    where: { userId, customerId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: ADDRESS_SELECT,
  });
};

const findAddressById = (id, userId, customerId) => {
  return prisma.address.findFirst({
    where: { id, userId, customerId, isDeleted: false },
    select: ADDRESS_SELECT,
  });
};

const updateAddress = async (id, userId, customerId, data) => {
  const { isDefaultShipping, isDefaultBilling, ...rest } = data;

  const existing = await prisma.address.findFirst({ where: { id, userId, customerId, isDeleted: false }, select: { id: true } });
  if (!existing) return null;

  if (isDefaultShipping) {
    await prisma.address.updateMany({ where: { userId, customerId, isDefaultShipping: true, isDeleted: false, id: { not: id } }, data: { isDefaultShipping: false } });
  }
  if (isDefaultBilling) {
    await prisma.address.updateMany({ where: { userId, customerId, isDefaultBilling: true, isDeleted: false, id: { not: id } }, data: { isDefaultBilling: false } });
  }

  return prisma.address.update({
    where: { id },
    data: {
      ...rest,
      ...(isDefaultShipping !== undefined && { isDefaultShipping }),
      ...(isDefaultBilling !== undefined && { isDefaultBilling }),
    },
    select: ADDRESS_SELECT,
  });
};

const deleteAddress = async (id, userId, customerId) => {
  const existing = await prisma.address.findFirst({ where: { id, userId, customerId, isDeleted: false }, select: { id: true } });
  if (!existing) return { count: 0 };
  await prisma.address.update({ where: { id }, data: { isDeleted: true } });
  return { count: 1 };
};

module.exports = {
  createAddress,
  findAddressesByCustomer,
  findAddressById,
  updateAddress,
  deleteAddress,
};
