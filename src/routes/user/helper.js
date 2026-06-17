const prisma = require('../../config/prisma');
const { CONTACT_SELECT } = require('../contactus/helper');

const SUPER_ADMIN_EMAIL_DOMAIN = 'maildrop.cc';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  password: true,
  image: true,
  role: true,
  isAdmin: true,
  isActive: true,
  authProvider: true,
  providerAccountId: true,
  organizationId: true,
  organizationName: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
      isActive: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

const getEmailDomain = (email) => email.split('@')[1]?.trim().toLowerCase() || '';

const getOrganizationNameFromDomain = (domain) => {
  const firstPart = domain.split('.')[0] || domain;
  return firstPart
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || domain;
};

const resolveUserAccessForEmail = async (tx, email) => {
  const domain = getEmailDomain(email);

  if (domain === SUPER_ADMIN_EMAIL_DOMAIN) {
    return {
      role: 'SUPER_ADMIN',
      isAdmin: true,
      isActive: true,
      organizationId: null,
      organizationName: null,
    };
  }

  const organizationName = getOrganizationNameFromDomain(domain);
  const organization = await tx.organization.upsert({
    where: { domain },
    update: {
      name: organizationName,
      isActive: true,
    },
    create: {
      name: organizationName,
      domain,
      isActive: true,
    },
  });

  const organizationUserCount = await tx.user.count({
    where: { organizationId: organization.id },
  });
  const isFirstOrganizationUser = organizationUserCount === 0;

  return {
    role: isFirstOrganizationUser ? 'USER' : 'ADMIN',
    isAdmin: !isFirstOrganizationUser,
    isActive: isFirstOrganizationUser,
    organizationId: organization.id,
    organizationName: organization.name,
  };
};

const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: USER_SELECT,
  });
};

const findUserByProviderAccount = (authProvider, providerAccountId) => {
  return prisma.user.findFirst({
    where: {
      authProvider,
      providerAccountId,
    },
    select: USER_SELECT,
  });
};

const findUserById = (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
};

const findUserByIdWithContacts = (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      contacts: {
        orderBy: {
          createdAt: 'desc',
        },
        select: CONTACT_SELECT,
      },
    },
  });
};

const findUserContactsByUserId = (userId) => {
  return prisma.userContact.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
};

const createUser = (data) => {
  return prisma.user.create({
    data,
    select: USER_SELECT,
  });
};

const createUserWithResolvedAccess = (data) => {
  return prisma.$transaction(async (tx) => {
    const access = await resolveUserAccessForEmail(tx, data.email);
      
    return tx.user.create({
      data: {
        ...data,
        ...access,
      },
      select: USER_SELECT,
    });
  });
};

const updateUser = (id, data) => {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });
};

const createRefreshToken = ({ userId, token, expiresAt }) => {
  return prisma.refreshToken.create({
    data: {
      user: { connect: { id: userId } },
      token,
      expiresAt,
    },
  });
};

const findRefreshTokenByToken = (token) => {
  return prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });
};

const findActiveRefreshTokenByUserId = (userId) => {
  return prisma.refreshToken.findFirst({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
};

const revokeRefreshToken = (token) => {
  return prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data: { revoked: true },
  });
};

const revokeAllRefreshTokensForUser = (userId) => {
  return prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
};

const updateUserActiveStatus = (userId, isActive) => {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: USER_SELECT,
  });
};

const findAdminsByRole = (role) => {
  return prisma.user.findMany({
    where: { role },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

const findAllUsers = (includeSuperAdmin = false) => {
  return prisma.user.findMany({
    where: includeSuperAdmin ? {} : { role: { in: ['USER', 'ADMIN'] } },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

module.exports = {
  USER_SELECT,
  SUPER_ADMIN_EMAIL_DOMAIN,
  findUserByEmail,
  findUserByProviderAccount,
  findUserById,
  findUserByIdWithContacts,
  findUserContactsByUserId,
  createUser,
  createUserWithResolvedAccess,
  updateUser,
  createRefreshToken,
  findRefreshTokenByToken,
  findActiveRefreshTokenByUserId,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  updateUserActiveStatus,
  findAdminsByRole,
  findAllUsers,
};
