const prisma = require('../../config/prisma');

const USER_CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  primaryContact: true,
  secondaryContact: true,
  company: true,
  notes: true,
  contactType: true,
  isPrimaryBillingContact: true,
  isPrimaryShippingContact: true,
  userId: true,
  customerId: true,
  createdAt: true,
  updatedAt: true,
};

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
};

const createContact = async (userId, data) => {
  const { isPrimaryBillingContact, isPrimaryShippingContact, customerId } = data;

  // If setting as primary billing, unset others for this customer/user
  if (isPrimaryBillingContact && customerId) {
    await prisma.userContact.updateMany({
      where: { userId, customerId, isPrimaryBillingContact: true },
      data: { isPrimaryBillingContact: false },
    });
  }
  if (isPrimaryShippingContact && customerId) {
    await prisma.userContact.updateMany({
      where: { userId, customerId, isPrimaryShippingContact: true },
      data: { isPrimaryShippingContact: false },
    });
  }

  return prisma.userContact.create({
    data: { ...data, userId },
    select: USER_CONTACT_SELECT,
  });
};

const findContactsByUserId = (userId) => {
  return prisma.userContact.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
};

const findContactByIdAndUserId = (id, userId) => {
  return prisma.userContact.findFirst({
    where: {
      id,
      userId,
    },
    select: USER_CONTACT_SELECT,
  });
};

const updateContact = async (id, userId, data) => {
  const existing = await prisma.userContact.findFirst({ where: { id, userId }, select: { customerId: true } });
  const customerId = existing?.customerId;

  if (data.isPrimaryBillingContact && customerId) {
    await prisma.userContact.updateMany({
      where: { userId, customerId, isPrimaryBillingContact: true, id: { not: id } },
      data: { isPrimaryBillingContact: false },
    });
  }
  if (data.isPrimaryShippingContact && customerId) {
    await prisma.userContact.updateMany({
      where: { userId, customerId, isPrimaryShippingContact: true, id: { not: id } },
      data: { isPrimaryShippingContact: false },
    });
  }

  return prisma.userContact.updateMany({ where: { id, userId }, data });
};

const deleteContact = (id, userId) => {
  return prisma.userContact.deleteMany({
    where: {
      id,
      userId,
    },
  });
};

module.exports = {
  USER_CONTACT_SELECT,
  createContact,
  findContactsByUserId,
  findContactByIdAndUserId,
  updateContact,
  deleteContact,
};
