const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const draftSchema = z.object({
  formType: z.string().trim().min(1, 'formType is required'),
  draftData: z.record(z.any()).refine((val) => Object.keys(val).length > 0, 'draftData cannot be empty'),
  email: z.string().trim().email('Invalid email').optional().nullable(),
  sessionId: z.string().trim().optional().nullable(),
});

const updateDraftSchema = z.object({
  draftData: z.record(z.any()).refine((val) => Object.keys(val).length > 0, 'draftData cannot be empty'),
});

const submitSchema = z.object({
  finalData: z.record(z.any()).optional().nullable(),
});

const directSubmitSchema = z.object({
  formType: z.string().trim().min(1, 'formType is required'),
  finalData: z.record(z.any()).refine((val) => Object.keys(val).length > 0, 'finalData cannot be empty'),
  email: z.string().trim().email('Invalid email').optional().nullable(),
  sessionId: z.string().trim().optional().nullable(),
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return next(new ApiError(400, firstIssue?.message || 'Validation failed'));
  }

  req.body = result.data;
  return next();
};

module.exports = {
  validateDraft: validate(draftSchema),
  validateUpdateDraft: validate(updateDraftSchema),
  validateSubmit: validate(submitSchema),
  validateDirectSubmit: validate(directSubmitSchema),
};
