const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const formModel = require('./helper');
const {
  findFormByProgramId,
  upsertFormDraft: upsertProgramFormDraft,
  submitProgramForm: submitProgramFormHelper,
  updateSubmittedForm,
  deleteFormByProgramId,
  reopenProgramForm,
} = require('./helper');
const prisma = require('../../config/prisma');

// When a partner_program form is submitted, create the PartnerProgram record
const handlePartnerProgramSubmission = async (formData) => {
  const data = formData.finalData || formData.draftData;
  if (!data) return;

  const partnerName = data.partnerName;
  if (!partnerName) return;

  // Find or create the partner
  let partner = await prisma.partner.findFirst({
    where: { partnerName: { equals: partnerName, mode: 'insensitive' } },
    select: { id: true, partnerName: true },
  });

  if (!partner) {
    partner = await prisma.partner.create({
      data: {
        partnerName,
        email: data.email || null,
        url: data.url || null,
      },
      select: { id: true, partnerName: true },
    });
  }

  const programName = data.partnerProgramName
    ? `${partnerName}  ${data.partnerProgramName}`
    : partnerName;

  // Create the partner program
  const program = await prisma.partnerProgram.create({
    data: {
      partnerProgramName: programName,
      description: data.description || null,
      partnerId: partner.id,
    },
    select: {
      id: true,
      partnerProgramName: true,
      description: true,
      verificationStep: true,
      partnerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { ...program, partner: { id: partner.id, partnerName: partner.partnerName } };
};

// Access control check for editing forms
const checkEditAccess = (form, user) => {
  if (!user) return; // anonymous drafts — no restriction
  if (user.role === 'SUPER_ADMIN') return; // super admin can always edit

  if (form.creatorId && form.creatorId !== user.id) {
    throw new ApiError(403, 'You do not have edit access to this form');
  }

  if (form.status === 'SUBMITTED') {
    throw new ApiError(403, 'Form is submitted. Ask super admin to grant edit access.');
  }
};

// POST /forms/draft — save a new draft
const saveDraft = async (req, res) => {
  try {
    const { formType, draftData, email, sessionId } = req.body;
    const userId = req.user?.id || null;

    const draft = await formModel.createDraft({
      formType,
      draftData,
      userId,
      email,
      sessionId,
    });

    return res.status(201).json(
      new ApiResponse(201, 'Draft saved successfully', draft)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// PATCH /forms/:id/draft — update existing draft
const updateDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { draftData } = req.body;

    const existing = await formModel.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Form submission not found');
    }

    checkEditAccess(existing, req.user);

    const updated = await formModel.updateDraft(id, draftData);

    return res.status(200).json(
      new ApiResponse(200, 'Draft updated successfully', updated)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/:id/submit — submit an existing draft
const submitDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalData } = req.body;

    const existing = await formModel.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Form submission not found');
    }

    checkEditAccess(existing, req.user);

    const submitted = await formModel.submitForm(id, finalData || existing.draftData);

    // Auto-create partner program if formType is partner_program
    let program = null;
    if (existing.formType === 'partner_program') {
      try {
        program = await handlePartnerProgramSubmission(submitted);
      } catch (err) {
        console.error('[submitDraft] Partner program creation failed:', err.message);
      }
    }

    return res.status(200).json(
      new ApiResponse(200, 'Form submitted successfully', { ...submitted, program })
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/submit — create and submit in one step (no prior draft)
const directSubmit = async (req, res) => {
  try {
    const { formType, finalData, email, sessionId } = req.body;
    const userId = req.user?.id || null;

    const submitted = await formModel.createAndSubmit({
      formType,
      finalData,
      userId,
      email,
      sessionId,
    });

    // Auto-create partner program if formType is partner_program
    let program = null;
    if (formType === 'partner_program') {
      try {
        program = await handlePartnerProgramSubmission(submitted);
      } catch (err) {
        console.error('[directSubmit] Partner program creation failed:', err.message);
      }
    }

    return res.status(201).json(
      new ApiResponse(201, 'Form submitted successfully', { ...submitted, program })
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// POST /forms/:id/reopen — reopen a submitted form (SUPER_ADMIN only)
const reopenForm = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await formModel.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Form not found');
    }

    if (existing.status === 'DRAFT') {
      throw new ApiError(400, 'Form is already in draft status');
    }

    const reopened = await formModel.reopenForm(id);

    return res.status(200).json(
      new ApiResponse(200, 'Form reopened for editing', reopened)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// GET /forms/:id — get a single form submission
const getFormById = async (req, res) => {
  try {
    const { id } = req.params;

    const form = await formModel.findById(id);
    if (!form) {
      throw new ApiError(404, 'Form submission not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Form fetched successfully', form)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// GET /forms/draft?sessionId=xxx&formType=yyy — get existing draft by session
const getDraft = async (req, res) => {
  try {
    const { sessionId, formType } = req.query;

    if (!sessionId || !formType) {
      throw new ApiError(400, 'sessionId and formType are required');
    }

    const draft = await formModel.findBySessionId(sessionId, formType);

    return res.status(200).json(
      new ApiResponse(200, 'Draft fetched successfully', draft ?? null)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// GET /forms/my — get all submissions for logged-in user
const getMyForms = async (req, res) => {
  try {
    const userId = req.user.id;
    const { formType } = req.query;

    const forms = await formModel.findByUserId(userId, formType);

    return res.status(200).json(
      new ApiResponse(200, 'Forms fetched successfully', forms)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// GET /forms — list all (admin)
const listForms = async (req, res) => {
  try {
    const { formType, status, email } = req.query;

    const forms = await formModel.findAll({ formType, status, email });

    return res.status(200).json(
      new ApiResponse(200, 'Forms fetched successfully', forms)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// DELETE /forms/:id
const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await formModel.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Form submission not found');
    }

    const deleted = await formModel.deleteById(id);

    return res.status(200).json(
      new ApiResponse(200, 'Form deleted successfully', deleted)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

// --- ProgramForm Controllers ---

const validateProgramExists = async (programId) => {
  const program = await prisma.partnerProgram.findUnique({
    where: { id: programId },
    select: { id: true, partnerId: true },
  });
  if (!program) throw new ApiError(404, 'Program not found');
  return program;
};

const getProgramForm = async (req, res) => {
  try {
    if (!req.programId) throw new ApiError(400, 'Program ID is required');
    await validateProgramExists(req.programId);
    const form = await findFormByProgramId(req.programId);
    return res.status(200).json(new ApiResponse(200, 'Form fetched', form ?? null));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const saveProgramFormDraft = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const form = await upsertProgramFormDraft(req.programId, req.body.formDesign);
    return res.status(200).json(new ApiResponse(200, 'Draft saved', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const submitProgramForm = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const form = await submitProgramFormHelper(req.programId, req.body.formDesign);
    return res.status(200).json(new ApiResponse(200, 'Form submitted', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

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

const reopenProgramFormController = async (req, res) => {
  try {
    await validateProgramExists(req.programId);
    const existing = await findFormByProgramId(req.programId);
    if (!existing) throw new ApiError(404, 'Form not found');
    const form = await reopenProgramForm(req.programId);
    return res.status(200).json(new ApiResponse(200, 'Form reopened for editing', form));
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  saveDraft,
  updateDraft,
  submitDraft,
  directSubmit,
  reopenForm,
  getFormById,
  getDraft,
  getMyForms,
  listForms,
  deleteForm,
  // ProgramForm exports
  getProgramForm,
  saveProgramFormDraft,
  submitProgramForm,
  editSubmittedForm,
  deleteProgramForm,
  reopenProgramFormController,
};
