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

const ensureCustomerBelongsToUser = async (tx, userId, customerId) => {
  if (!customerId) return null;

  return tx.customer.findFirst({
    where: { id: customerId, userId, isDeleted: false },
    select: { id: true },
  });
};

const normalizeCustomerContactDefaults = async (
  tx,
  userId,
  customerId,
  options = {},
) => {
  if (!customerId) return;

  const contacts = await tx.userContact.findMany({
    where: { userId, customerId },
    select: {
      id: true,
      isPrimaryBillingContact: true,
      isPrimaryShippingContact: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (contacts.length === 0) return;

  const pickDefault = (flag, preferContactId, avoidContactId) => {
    const flagged = contacts.filter((contact) => contact[flag]);
    const preferredFlagged = flagged.find((contact) => contact.id === preferContactId);

    if (preferredFlagged) return preferredFlagged.id;
    if (flagged.length > 0) return flagged[0].id;

    const preferred = contacts.find((contact) => contact.id === preferContactId);
    if (preferred) return preferred.id;

    const replacement = contacts.find((contact) => contact.id !== avoidContactId);
    return replacement?.id ?? contacts[0].id;
  };

  const billingDefaultId = pickDefault(
    'isPrimaryBillingContact',
    options.preferBillingContactId,
    options.avoidBillingContactId,
  );
  const shippingDefaultId = pickDefault(
    'isPrimaryShippingContact',
    options.preferShippingContactId,
    options.avoidShippingContactId,
  );

  await tx.userContact.updateMany({
    where: { userId, customerId },
    data: { isPrimaryBillingContact: false, isPrimaryShippingContact: false },
  });

  await tx.userContact.update({
    where: { id: billingDefaultId },
    data: { isPrimaryBillingContact: true },
  });

  await tx.userContact.update({
    where: { id: shippingDefaultId },
    data: { isPrimaryShippingContact: true },
  });
};

const normalizeCustomerContactDefaultsById = (userId, customerId, options = {}) => {
  if (!customerId) return Promise.resolve();

  return prisma.$transaction((tx) =>
    normalizeCustomerContactDefaults(tx, userId, customerId, options)
  );
};

const normalizeAllCustomerContactDefaultsForUser = async (userId) => {
  const groups = await prisma.userContact.findMany({
    where: { userId, customerId: { not: null } },
    distinct: ['customerId'],
    select: { customerId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      await normalizeCustomerContactDefaults(tx, userId, group.customerId);
    }
  });
};

const createContact = async (userId, data) => {
  return prisma.$transaction(async (tx) => {
    const { customerId } = data;

    if (customerId) {
      const customer = await ensureCustomerBelongsToUser(tx, userId, customerId);
      if (!customer) return null;
    }

    const existing = customerId
      ? await tx.userContact.findMany({
        where: { userId, customerId },
        select: { isPrimaryBillingContact: true, isPrimaryShippingContact: true },
      })
      : [];

    const hasBillingDefault = existing.some((contact) => contact.isPrimaryBillingContact);
    const hasShippingDefault = existing.some((contact) => contact.isPrimaryShippingContact);
    const contactData = {
      ...data,
      userId,
      isPrimaryBillingContact: customerId
        ? data.isPrimaryBillingContact === true || !hasBillingDefault
        : data.isPrimaryBillingContact === true,
      isPrimaryShippingContact: customerId
        ? data.isPrimaryShippingContact === true || !hasShippingDefault
        : data.isPrimaryShippingContact === true,
    };

    if (contactData.isPrimaryBillingContact && customerId) {
      await tx.userContact.updateMany({
        where: { userId, customerId, isPrimaryBillingContact: true },
        data: { isPrimaryBillingContact: false },
      });
    }

    if (contactData.isPrimaryShippingContact && customerId) {
      await tx.userContact.updateMany({
        where: { userId, customerId, isPrimaryShippingContact: true },
        data: { isPrimaryShippingContact: false },
      });
    }

    const contact = await tx.userContact.create({
      data: contactData,
      select: USER_CONTACT_SELECT,
    });

    if (customerId) {
      await normalizeCustomerContactDefaults(tx, userId, customerId, {
        preferBillingContactId: contact.isPrimaryBillingContact ? contact.id : undefined,
        preferShippingContactId: contact.isPrimaryShippingContact ? contact.id : undefined,
      });
    }

    return tx.userContact.findUnique({
      where: { id: contact.id },
      select: USER_CONTACT_SELECT,
    });
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

const updateContact = async (id, userId, data, options = {}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.userContact.findFirst({
      where: { id, userId },
      select: { customerId: true },
    });

    if (!existing) return { count: 0 };
    if (
      options.customerId !== undefined
      && existing.customerId !== options.customerId
    ) {
      return { count: 0 };
    }

    const originalCustomerId = existing.customerId;
    const nextCustomerId = Object.prototype.hasOwnProperty.call(data, 'customerId')
      ? data.customerId
      : originalCustomerId;

    if (nextCustomerId) {
      const customer = await ensureCustomerBelongsToUser(tx, userId, nextCustomerId);
      if (!customer) return { count: 0 };
    }

    if (data.isPrimaryBillingContact === true && nextCustomerId) {
      await tx.userContact.updateMany({
        where: { userId, customerId: nextCustomerId, isPrimaryBillingContact: true, id: { not: id } },
        data: { isPrimaryBillingContact: false },
      });
    }

    if (data.isPrimaryShippingContact === true && nextCustomerId) {
      await tx.userContact.updateMany({
        where: { userId, customerId: nextCustomerId, isPrimaryShippingContact: true, id: { not: id } },
        data: { isPrimaryShippingContact: false },
      });
    }

    const result = await tx.userContact.updateMany({ where: { id, userId }, data });

    if (originalCustomerId) {
      await normalizeCustomerContactDefaults(tx, userId, originalCustomerId, {
        avoidBillingContactId: data.isPrimaryBillingContact === false ? id : undefined,
        avoidShippingContactId: data.isPrimaryShippingContact === false ? id : undefined,
      });
    }

    if (nextCustomerId && nextCustomerId !== originalCustomerId) {
      await normalizeCustomerContactDefaults(tx, userId, nextCustomerId, {
        preferBillingContactId: data.isPrimaryBillingContact === true ? id : undefined,
        preferShippingContactId: data.isPrimaryShippingContact === true ? id : undefined,
      });
    }

    return result;
  });
};

const deleteContact = async (id, userId, options = {}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.userContact.findFirst({
      where: { id, userId },
      select: { customerId: true },
    });

    if (!existing) return { count: 0 };
    if (
      options.customerId !== undefined
      && existing.customerId !== options.customerId
    ) {
      return { count: 0 };
    }

    const result = await tx.userContact.deleteMany({
      where: { id, userId },
    });

    if (existing.customerId) {
      await normalizeCustomerContactDefaults(tx, userId, existing.customerId);
    }

    return result;
  });
};

module.exports = {
  USER_CONTACT_SELECT,
  createContact,
  findContactsByUserId,
  findContactByIdAndUserId,
  updateContact,
  deleteContact,
  normalizeCustomerContactDefaultsById,
  normalizeAllCustomerContactDefaultsForUser,
};
