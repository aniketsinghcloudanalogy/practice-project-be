const prisma = require('../../config/prisma');

const OPPORTUNITY_SELECT = {
  id: true,
  userId: true,
  customerId: true,
  opportunityId: true,
  syncedQuote: true,
  organization: true,
  title: true,
  amount: true,
  pdfUrl: true,
  description: true,
  closeDate: true,
  expectedPrice: true,
  addShipment: true,
  rfqRfiNumber: true,
  periodOfPerformanceStartDate: true,
  periodOfPerformanceEndDate: true,
  probability: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const createOpportunity = (userId, data) => {
  return prisma.opportunity.create({
    data: { ...data, userId },
    select: OPPORTUNITY_SELECT,
  });
};

const findOpportunitiesByUserId = (userId) => {
  return prisma.opportunity.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: OPPORTUNITY_SELECT,
  });
};

const findOpportunitiesByCustomerId = (customerId, userId) => {
  return prisma.opportunity.findMany({
    where: { customerId, userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: OPPORTUNITY_SELECT,
  });
};

const findOpportunityByIdAndUserId = (id, userId) => {
  return prisma.opportunity.findFirst({
    where: { id, userId, isDeleted: false },
    select: OPPORTUNITY_SELECT,
  });
};

const updateOpportunity = (id, userId, data) => {
  return prisma.opportunity.updateMany({
    where: { id, userId, isDeleted: false },
    data,
  });
};

// Soft delete
const deleteOpportunity = (id, userId) => {
  return prisma.opportunity.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true },
  });
};

module.exports = {
  OPPORTUNITY_SELECT,
  createOpportunity,
  findOpportunitiesByUserId,
  findOpportunitiesByCustomerId,
  findOpportunityByIdAndUserId,
  updateOpportunity,
  deleteOpportunity,
};
