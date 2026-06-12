const prisma = require('../../config/prisma');

const PARTNER_SELECT = {
  id: true,
  externalId: true,
  partnerName: true,
  parentPartner: true,
  pmId: true,
  url: true,
  email: true,
  createdAt: true,
  updatedAt: true,
};

const PROGRAM_SELECT = {
  id: true,
  partnerProgramName: true,
  description: true,
  verificationStep: true,
  template: true,
  loginTemplate: true,
  loginScript: true,
  partnerId: true,
  createdAt: true,
  updatedAt: true,
};

const createPartner = (partnerData) => {
  return prisma.partner.create({
    data: partnerData,
    select: PARTNER_SELECT,
  });
};

const findPartnerByPartnerName = (partnerName) => {
  return prisma.partner.findFirst({
    where: { partnerName: { equals: partnerName, mode: 'insensitive' } },
    select: PARTNER_SELECT,
  });
};

const findPartnerById = (id) => {
  return prisma.partner.findUnique({
    where: { id },
    select: PARTNER_SELECT,
  });
};

const findAllPartnerNames = () => {
  return prisma.partner.findMany({
    select: PARTNER_SELECT,
    orderBy: { partnerName: 'asc' },
  });
};

const countPartners = () => {
  return prisma.partner.count();
};

const updatePartner = (id, partnerData) => {
  return prisma.partner.update({
    where: { id },
    data: partnerData,
    select: PARTNER_SELECT,
  });
};

const deletePartner = (id) => {
  return prisma.partner.delete({
    where: { id },
    select: PARTNER_SELECT,
  });
};

const createProgram = ({
  partnerProgramName,
  description,
  partnerId,
}) => {
  return prisma.partnerProgram.create({
    data: {
      partnerProgramName,
      description,

      partner: {
        connect: {
          id: partnerId,
        },
      },
    },
    select: PROGRAM_SELECT,
  });
};

const findProgramsByPartnerId = (partnerId) => {
  return prisma.partnerProgram.findMany({
    where: { partnerId },
    select: PROGRAM_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

const countProgramsByPartnerId = (partnerId) => {
  return prisma.partnerProgram.count({
    where: { partnerId },
  });
};

const countAllPrograms = () => {
  return prisma.partnerProgram.count();
};

const countPendingPrograms = () => {
  return prisma.partnerProgram.count({
    where: { verificationStep: false },
  });
};

const updateProgramVerification = (id, verificationStep) => {
  return prisma.partnerProgram.update({
    where: { id },
    data: { verificationStep },
    select: PROGRAM_SELECT,
  });
};

const findPartnerProgramsWithTotal = async (partnerId) => {
  const [programs, total] = await Promise.all([
    findProgramsByPartnerId(partnerId),
    countProgramsByPartnerId(partnerId),
  ]);

  return { programs, total };
};

module.exports = {
  PARTNER_SELECT,
  PROGRAM_SELECT,
  createPartner,
  findPartnerByPartnerName,
  findPartnerById,
  findAllPartnerNames,
  countPartners,
  updatePartner,
  deletePartner,
  createProgram,
  findProgramsByPartnerId,
  countProgramsByPartnerId,
  findPartnerProgramsWithTotal,
  countAllPrograms,
  countPendingPrograms,
  updateProgramVerification,
};
