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
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (addresses.length === 0) return;

  const canHoldShipping = (a) => a.type === 'SHIPPING' || a.type === 'BOTH';
  const canHoldBilling  = (a) => a.type === 'BILLING'  || a.type === 'BOTH';

  const pickDefault = (flag, preferAddressId, avoidAddressId) => {
    const isShippingFlag = flag === 'isDefaultShipping';
    const canHold = isShippingFlag ? canHoldShipping : canHoldBilling;

    // 1. Explicit prefer — only if that address can actually hold this flag
    const preferred = addresses.find((a) => a.id === preferAddressId && canHold(a));
    if (preferred) return preferred.id;

    // 2. Already flagged as default and eligible — keep it (most recently updated first)
    const flagged = addresses.filter((a) => a[flag] && a.id !== avoidAddressId && canHold(a));
    if (flagged.length > 0) return flagged[0].id;

    // 3. No valid default — promote most recently updated eligible address
    const fallback = addresses.find((a) => a.id !== avoidAddressId && canHold(a));
    // Last resort: any address (covers single-address scenario with mixed types)
    return fallback?.id ?? addresses.find((a) => a.id !== avoidAddressId)?.id ?? addresses[0].id;
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

    // Step 1: create record with all flags false — normalize will assign defaults
    const address = await tx.address.create({
      data: { ...rest, type, userId, customerId, isDefaultShipping: false, isDefaultBilling: false },
      select: ADDRESS_SELECT,
    });

    // Step 2: normalize — prefer newly created address if frontend requested default,
    // normalize will also handle first-address case (no existing default → promote new one)
   const wantsShipping = type === 'SHIPPING' && isDefaultShipping === true;
const wantsBilling  = type === 'BILLING' && isDefaultBilling === true;

    await normalizeCustomerAddressDefaults(tx, userId, customerId, {
      preferShippingAddressId: wantsShipping ? address.id : undefined,
      preferBillingAddressId:  wantsBilling  ? address.id : undefined,
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
    // Type-guard: BILLING can't be shipping default, SHIPPING can't be billing default
    const nextIsDefaultShipping = nextType === 'BILLING'  ? false : isDefaultShipping;
    const nextIsDefaultBilling  = nextType === 'SHIPPING' ? false : isDefaultBilling;

    // Step 1: apply field updates only (no default flags yet — normalize handles that)
    await tx.address.update({
      where: { id },
      data: {
        ...rest,
        ...(nextIsDefaultShipping !== undefined && { isDefaultShipping: nextIsDefaultShipping }),
        ...(nextIsDefaultBilling  !== undefined && { isDefaultBilling:  nextIsDefaultBilling  }),
      },
    });

    // Step 2: normalize — single source of truth for defaults
    await normalizeCustomerAddressDefaults(tx, userId, customerId, {
      preferShippingAddressId: nextIsDefaultShipping === true  ? id : undefined,
      preferBillingAddressId:  nextIsDefaultBilling  === true  ? id : undefined,
      avoidShippingAddressId:  nextIsDefaultShipping === false ? id : undefined,
      avoidBillingAddressId:   nextIsDefaultBilling  === false ? id : undefined,
    });

    return tx.address.findUnique({
      where: { id },
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
