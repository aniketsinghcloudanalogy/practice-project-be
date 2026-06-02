const prisma = require('../../config/prisma');

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  primaryContact: true,
  secondaryContact: true,
  subject: true,
  message: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
};

const createContact = (data) => {
  return prisma.contact.create({
    data,
    select: CONTACT_SELECT,
  });
};

const findContactById = (id) => {
  return prisma.contact.findUnique({
    where: { id },
    select: CONTACT_SELECT,
  });
};

const findAllContacts = () => {
  return prisma.contact.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    select: CONTACT_SELECT,
  });
};

const findContactsByUserId = (userId) => {
  return prisma.contact.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    select: CONTACT_SELECT,
  });
};

module.exports = {
  CONTACT_SELECT,
  createContact,
  findContactById,
  findAllContacts,
  findContactsByUserId,
};