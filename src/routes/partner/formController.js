const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const {
  findFormByProgramId,
  upsertFormDraft,
  submitForm,
  updateSubmittedForm,
  deleteFormByProgramId,
  reopenFormForEdit,
} = require('./formHelper');
const prisma = require('../../config/prisma');

const validateProgramExists = async (programId) => {
  const program = await prisma.partnerProgram.findUnique({
    where: { id: programId },
    select: { id: true, partnerId: true },
  });
  if (!program) throw new ApiError(404, 'Program not found');
  return program;
};

// GET /forms/:programId
const getForm = async (req, res) => {
  try {
    if (!req.programId) {
      throw new ApiError(400, 'Program ID is required');
    }
    await validateProgramExists(req.programId);
    const form = await findFormByProgramId(req.programId);
    return res.status(200).json(new ApiResponse(200, 'Form fetched', form ?? null));
  } catch (error) {
    console.error('[getForm] Error:', error.message, error.code || '');
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/:programId/save
const saveDraft = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const form = await upsertFormDraft(req.programId, req.body.formDesign);
    return res.status(200).json(new ApiResponse(200, 'Draft saved', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/:programId/submit
const submitProgramForm = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const form = await submitForm(req.programId, req.body.formDesign);
    return res.status(200).json(new ApiResponse(200, 'Form submitted', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// PATCH /forms/:programId
const editSubmittedForm = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const existing = await findFormByProgramId(req.programId);
    if (!existing) throw new ApiError(404, 'Form not found');
    const form = await updateSubmittedForm(req.programId, req.body.formDesign);
    return res.status(200).json(new ApiResponse(200, 'Form updated', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// DELETE /forms/:programId
const deleteProgramForm = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const existing = await findFormByProgramId(req.programId);
    if (!existing) throw new ApiError(404, 'Form not found');
    const form = await deleteFormByProgramId(req.programId);
    return res.status(200).json(new ApiResponse(200, 'Form deleted', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/:programId/reopen
const reopenForm = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const existing = await findFormByProgramId(req.programId);
    if (!existing) throw new ApiError(404, 'Form not found');
    const form = await reopenFormForEdit(req.programId);
    return res.status(200).json(new ApiResponse(200, 'Form reopened for editing', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = { getForm, saveDraft, submitProgramForm, editSubmittedForm, deleteProgramForm, reopenForm };
