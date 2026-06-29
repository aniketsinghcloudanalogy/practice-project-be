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

const normalizeCustomerAddressDefaults = async (tx, userId, customerId, options = {}) => {
  if (!customerId) return;

  const addresses = await tx.address.findMany({
    where: { userId, customerId, isDeleted: false },
    select: {
      id: true,
      isDefaultShipping: true,
      isDefaultBilling: true,
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (addresses.length === 0) return;

  const pickDefault = (flag, preferAddressId, avoidAddressId) => {
    const flagged = addresses.filter((address) => address[flag]);
    const preferredFlagged = flagged.find((address) => address.id === preferAddressId);

    if (preferredFlagged) return preferredFlagged.id;
    if (flagged.length > 0) return flagged[0].id;

    const preferred = addresses.find((address) => address.id === preferAddressId);
    if (preferred) return preferred.id;

    const replacement = addresses.find((address) => address.id !== avoidAddressId);
    return replacement?.id ?? addresses[0].id;
  };

  const shippingDefaultId = pickDefault(
    'isDefaultShipping',
    options.preferShippingAddressId,
    options.avoidShippingAddressId,
  );
  const billingDefaultId = pickDefault(
    'isDefaultBilling',
    options.preferBillingAddressId,
    options.avoidBillingAddressId,
  );

  await tx.address.updateMany({
    where: { userId, customerId, isDeleted: false },
    data: { isDefaultShipping: false, isDefaultBilling: false },
  });

  await tx.address.update({
    where: { id: shippingDefaultId },
    data: { isDefaultShipping: true },
  });

  await tx.address.update({
    where: { id: billingDefaultId },
    data: { isDefaultBilling: true },
  });
};

const normalizeCustomerAddressDefaultsById = (userId, customerId, options = {}) => {
  if (!customerId) return Promise.resolve();

  return prisma.$transaction((tx) =>
    normalizeCustomerAddressDefaults(tx, userId, customerId, options)
  );
};

const normalizeAllCustomerAddressDefaultsForUser = async (userId) => {
  const groups = await prisma.address.findMany({
    where: { userId, customerId: { not: null }, isDeleted: false },
    distinct: ['customerId'],
    select: { customerId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      await normalizeCustomerAddressDefaults(tx, userId, group.customerId);
    }
  });
};

const createAddress = async (userId, customerId, data) => {
  return prisma.$transaction(async (tx) => {
    const { isDefaultShipping, isDefaultBilling, type, ...rest } = data;

    const existing = await tx.address.findMany({
      where: { userId, customerId, isDeleted: false },
      select: { isDefaultShipping: true, isDefaultBilling: true },
    });
    const hasShippingDefault = existing.some((address) => address.isDefaultShipping);
    const hasBillingDefault = existing.some((address) => address.isDefaultBilling);
    const addressData = {
      ...rest,
      type,
      userId,
      customerId,
      isDefaultShipping: type === 'BILLING' ? false : isDefaultShipping === true || !hasShippingDefault,
      isDefaultBilling: type === 'SHIPPING' ? false : isDefaultBilling === true || !hasBillingDefault,
    };

    if (existing.length === 0) {
      addressData.isDefaultShipping = true;
      addressData.isDefaultBilling = true;
    }

    if (addressData.isDefaultShipping) {
      await tx.address.updateMany({
        where: { userId, customerId, isDefaultShipping: true, isDeleted: false },
        data: { isDefaultShipping: false },
      });
    }
    if (addressData.isDefaultBilling) {
      await tx.address.updateMany({
        where: { userId, customerId, isDefaultBilling: true, isDeleted: false },
        data: { isDefaultBilling: false },
      });
    }

    const address = await tx.address.create({
      data: addressData,
      select: ADDRESS_SELECT,
    });

    await normalizeCustomerAddressDefaults(tx, userId, customerId, {
      preferShippingAddressId: address.isDefaultShipping ? address.id : undefined,
      preferBillingAddressId: address.isDefaultBilling ? address.id : undefined,
    });

    return tx.address.findUnique({
      where: { id: address.id },
      select: ADDRESS_SELECT,
    });
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
  return prisma.$transaction(async (tx) => {
    const { isDefaultShipping, isDefaultBilling, ...rest } = data;

    const existing = await tx.address.findFirst({
      where: { id, userId, customerId, isDeleted: false },
      select: { id: true, type: true },
    });
    if (!existing) return null;

    const nextType = rest.type ?? existing.type;
    const nextIsDefaultShipping = nextType === 'BILLING' ? false : isDefaultShipping;
    const nextIsDefaultBilling = nextType === 'SHIPPING' ? false : isDefaultBilling;

    if (nextIsDefaultShipping) {
      await tx.address.updateMany({
        where: { userId, customerId, isDefaultShipping: true, isDeleted: false, id: { not: id } },
        data: { isDefaultShipping: false },
      });
    }
    if (nextIsDefaultBilling) {
      await tx.address.updateMany({
        where: { userId, customerId, isDefaultBilling: true, isDeleted: false, id: { not: id } },
        data: { isDefaultBilling: false },
      });
    }

    const address = await tx.address.update({
      where: { id },
      data: {
        ...rest,
        ...(nextIsDefaultShipping !== undefined && { isDefaultShipping: nextIsDefaultShipping }),
        ...(nextIsDefaultBilling !== undefined && { isDefaultBilling: nextIsDefaultBilling }),
      },
      select: ADDRESS_SELECT,
    });

    await normalizeCustomerAddressDefaults(tx, userId, customerId, {
      preferShippingAddressId: nextIsDefaultShipping === true ? id : undefined,
      preferBillingAddressId: nextIsDefaultBilling === true ? id : undefined,
      avoidShippingAddressId: nextIsDefaultShipping === false ? id : undefined,
      avoidBillingAddressId: nextIsDefaultBilling === false ? id : undefined,
    });

    return tx.address.findUnique({
      where: { id: address.id },
      select: ADDRESS_SELECT,
    });
  });
};

const deleteAddress = async (id, userId, customerId) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id, userId, customerId, isDeleted: false },
      select: { id: true },
    });
    if (!existing) return { count: 0 };

    await tx.address.update({
      where: { id },
      data: { isDeleted: true, isDefaultShipping: false, isDefaultBilling: false },
    });
    await normalizeCustomerAddressDefaults(tx, userId, customerId);

    return { count: 1 };
  });
};

module.exports = {
  createAddress,
  findAddressesByCustomer,
  findAddressById,
  updateAddress,
  deleteAddress,
  normalizeCustomerAddressDefaultsById,
  normalizeAllCustomerAddressDefaultsForUser,
};
