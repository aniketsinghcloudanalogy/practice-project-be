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
  userId: true,
  createdAt: true,
  updatedAt: true,
};

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
};

const createContact = (userId, data) => {
  return prisma.userContact.upsert({
    where: {
      user_contact_user_email_unique: { userId, email: data.email },
    },
    create: { ...data, userId },
    update: data,
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

const updateContact = (id, userId, data) => {
  return prisma.userContact.updateMany({
    where: {
      id,
      userId,
    },
    data,
  });
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
