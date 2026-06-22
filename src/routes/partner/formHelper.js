const prisma = require('../../config/prisma');

const FORM_SELECT = {
  id: true,
  programId: true,
  formDesign: true,
  submittedDesign: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const findFormByProgramId = (programId) =>
  prisma.programForm.findUnique({ where: { programId }, select: FORM_SELECT });

const upsertFormDraft = (programId, formDesign) =>
  prisma.programForm.upsert({
    where: { programId },
    create: { programId, formDesign, status: 'DRAFT' },
    update: { formDesign, status: 'DRAFT' },
    select: FORM_SELECT,
  });

const submitForm = (programId, formDesign) =>
  prisma.programForm.upsert({
    where: { programId },
    create: { programId, formDesign, submittedDesign: formDesign, status: 'SUBMITTED' },
    update: { submittedDesign: formDesign, status: 'SUBMITTED' },
    select: FORM_SELECT,
  });

const updateSubmittedForm = (programId, submittedDesign) =>
  prisma.programForm.update({
    where: { programId },
    data: { submittedDesign, formDesign: submittedDesign },
    select: FORM_SELECT,
  });

const deleteFormByProgramId = (programId) =>
  prisma.programForm.delete({ where: { programId }, select: FORM_SELECT });

const reopenFormForEdit = (programId) =>
  prisma.programForm.update({
    where: { programId },
    data: { status: 'DRAFT' },
    select: FORM_SELECT,
  });

module.exports = {
  findFormByProgramId,
  upsertFormDraft,
  submitForm,
  updateSubmittedForm,
  deleteFormByProgramId,
  reopenFormForEdit,
};
