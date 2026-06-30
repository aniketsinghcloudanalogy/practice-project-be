const prisma = require('../../config/prisma');

const FORM_SUBMISSION_SELECT = {
  id: true,
  formType: true,
  draftData: true,
  finalData: true,
  status: true,
  userId: true,
  creatorId: true,
  email: true,
  sessionId: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
};

const createDraft = (data) => {
  return prisma.formSubmission.create({
    data: {
      formType: data.formType,
      draftData: data.draftData,
      status: 'DRAFT',
      userId: data.userId || null,
      creatorId: data.userId || null,
      email: data.email || null,
      sessionId: data.sessionId || null,
    },
    select: FORM_SUBMISSION_SELECT,
  });
};

const updateDraft = (id, draftData) => {
  return prisma.formSubmission.update({
    where: { id },
    data: { draftData },
    select: FORM_SUBMISSION_SELECT,
  });
};

const submitForm = (id, finalData) => {
  return prisma.formSubmission.update({
    where: { id },
    data: {
      finalData,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
    select: FORM_SUBMISSION_SELECT,
  });
};

const createAndSubmit = (data) => {
  return prisma.formSubmission.create({
    data: {
      formType: data.formType,
      draftData: data.finalData,
      finalData: data.finalData,
      status: 'SUBMITTED',
      userId: data.userId || null,
      creatorId: data.userId || null,
      email: data.email || null,
      sessionId: data.sessionId || null,
      submittedAt: new Date(),
    },
    select: FORM_SUBMISSION_SELECT,
  });
};

const reopenForm = (id) => {
  return prisma.formSubmission.update({
    where: { id },
    data: {
      status: 'DRAFT',
      submittedAt: null,
    },
    select: FORM_SUBMISSION_SELECT,
  });
};

const findById = (id) => {
  return prisma.formSubmission.findUnique({
    where: { id },
    select: FORM_SUBMISSION_SELECT,
  });
};

const findBySessionId = (sessionId, formType) => {
  return prisma.formSubmission.findFirst({
    where: {
      sessionId,
      formType,
      status: 'DRAFT',
    },
    orderBy: { updatedAt: 'desc' },
    select: FORM_SUBMISSION_SELECT,
  });
};

const findByUserId = (userId, formType) => {
  const where = { userId };
  if (formType) where.formType = formType;

  return prisma.formSubmission.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: FORM_SUBMISSION_SELECT,
  });
};

const findAll = (filters = {}) => {
  const where = {};
  if (filters.formType) where.formType = filters.formType;
  if (filters.status) where.status = filters.status;
  if (filters.email) where.email = filters.email;

  return prisma.formSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: FORM_SUBMISSION_SELECT,
  });
};

const findByFormType = (formType) => {
  return prisma.formSubmission.findFirst({
    where: { formType },
    orderBy: { updatedAt: 'desc' },
    select: FORM_SUBMISSION_SELECT,
  });
};

const deleteById = (id) => {
  return prisma.formSubmission.delete({
    where: { id },
    select: FORM_SUBMISSION_SELECT,
  });
};

// --- ProgramForm helpers ---

const PROGRAM_FORM_SELECT = {
  id: true,
  programId: true,
  formDesign: true,
  submittedDesign: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const findFormByProgramId = (programId) =>
  prisma.programForm.findUnique({ where: { programId }, select: PROGRAM_FORM_SELECT });

const upsertFormDraft = (programId, formDesign) =>
  prisma.programForm.upsert({
    where: { programId },
    create: { programId, formDesign, status: 'DRAFT' },
    update: { formDesign, status: 'DRAFT' },
    select: PROGRAM_FORM_SELECT,
  });

const submitProgramForm = (programId, formDesign) =>
  prisma.programForm.upsert({
    where: { programId },
    create: { programId, formDesign, submittedDesign: formDesign, status: 'SUBMITTED' },
    update: { submittedDesign: formDesign, status: 'SUBMITTED' },
    select: PROGRAM_FORM_SELECT,
  });

const updateSubmittedForm = (programId, submittedDesign) =>
  prisma.programForm.update({
    where: { programId },
    data: { submittedDesign, formDesign: submittedDesign },
    select: PROGRAM_FORM_SELECT,
  });

const deleteFormByProgramId = (programId) =>
  prisma.programForm.delete({ where: { programId }, select: PROGRAM_FORM_SELECT });

const reopenProgramForm = (programId) =>
  prisma.programForm.update({
    where: { programId },
    data: { status: 'DRAFT' },
    select: PROGRAM_FORM_SELECT,
  });

module.exports = {
  FORM_SUBMISSION_SELECT,
  createDraft,
  updateDraft,
  submitForm,
  createAndSubmit,
  reopenForm,
  findById,
  findBySessionId,
  findByUserId,
  findByFormType,
  findAll,
  deleteById,
  // ProgramForm exports
  findFormByProgramId,
  upsertFormDraft,
  submitProgramForm,
  updateSubmittedForm,
  deleteFormByProgramId,
  reopenProgramForm,
};
