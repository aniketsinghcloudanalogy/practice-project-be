const prisma = require('../../config/prisma');

const LOCATION_SELECT = {
  id: true,
  userId: true,
  label: true,
  latitude: true,
  longitude: true,
  shareToken: true,
  createdAt: true,
  updatedAt: true,
};

const saveLocation = (userId, data) =>
  prisma.savedLocation.create({
    data: { userId, ...data },
    select: LOCATION_SELECT,
  });

const getLocations = (userId) =>
  prisma.savedLocation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: LOCATION_SELECT,
  });

const getLocationById = (id, userId) =>
  prisma.savedLocation.findFirst({
    where: { id, userId },
    select: LOCATION_SELECT,
  });

const getLocationByShareToken = (shareToken) =>
  prisma.savedLocation.findUnique({
    where: { shareToken },
    select: LOCATION_SELECT,
  });

const deleteLocation = (id, userId) =>
  prisma.savedLocation.deleteMany({ where: { id, userId } });

const getUsersForSharing = (currentUserId) =>
  prisma.user.findMany({
    where: { isActive: true, id: { not: currentUserId } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

const shareLocationWithUser = (locationId, sharedById, sharedToId) =>
  prisma.sharedLocation.upsert({
    where: { locationId_sharedToId: { locationId, sharedToId } },
    update: {},
    create: { locationId, sharedById, sharedToId },
  });

const getSharedWithMe = (userId) =>
  prisma.sharedLocation.findMany({
    where: { sharedToId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      sharedBy: { select: { id: true, name: true, email: true } },
      location: { select: LOCATION_SELECT },
    },
  });

module.exports = { saveLocation, getLocations, getLocationById, getLocationByShareToken, deleteLocation, getUsersForSharing, shareLocationWithUser, getSharedWithMe };
