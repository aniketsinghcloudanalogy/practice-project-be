const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const emptyToNull = (val) => (val === '' || val === undefined ? null : val);

const nullableString = z.preprocess(
  emptyToNull,
  z.union([z.string().trim(), z.null()]).optional()
);

const nullableEmail = z.preprocess(
  emptyToNull,
  z.union([
    z.string().trim().email('Invalid email address'),
    z.null(),
  ]).optional()
);

const addPartnerSchema = z.object({
  partnerName: z.string().trim().min(1, 'PartnerName is required'),
  externalId: nullableString,
  parentPartner: nullableString,
  pmId: nullableString,
  url: nullableString,
  email: nullableEmail,
}).transform(({ partnerName, externalId, parentPartner, pmId, url, email }) => ({
  partnerName: partnerName,
  externalId: externalId ?? null,
  parentPartner: parentPartner ?? null,
  pmId: pmId ?? null,
  url: url ?? null,
  email: email ?? null,
}));

const addProgramSchema = z.object({
  partnerName: z.string().trim().min(1, 'partnerName is required'),
  partnerProgramName: z.string().trim().optional(),
  description: z.string().trim().optional(),
}).transform(({ partnerName, partnerProgramName, description }) => ({
  partnerName,
  partnerProgramName: partnerProgramName ?? null,
  description: description ?? null,
}));

const updatePartnerSchema = z.object({
  partnerName: z.string().trim().min(1, 'PartnerName cannot be empty').optional(),
  externalId: nullableString,
  parentPartner: nullableString,
  pmId: nullableString,
  url: nullableString,
  email: nullableEmail,
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required to update'
).transform((data) => {
  const result = {};

  if (data.partnerName !== undefined) {
    result.partnerName = data.partnerName;
  }

  if (data.externalId !== undefined) {
    result.externalId = data.externalId ?? null;
  }

  if (data.parentPartner !== undefined) {
    result.parentPartner = data.parentPartner ?? null;
  }

  if (data.pmId !== undefined) {
    result.pmId = data.pmId ?? null;
  }

  if (data.url !== undefined) {
    result.url = data.url ?? null;
  }

  if (data.email !== undefined) {
    result.email = data.email ?? null;
  }

  return result;
});

const partnerProgramsQuerySchema = z.object({
  partnerId: z.string().trim().optional(),
  partnerName: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (!data.partnerId && !data.partnerName) {
    ctx.addIssue({
      code: 'custom',
      message: 'partnerId or partnerName is required',
    });
  }

  if (data.partnerId) {
    const id = Number(data.partnerId);

    if (!Number.isInteger(id) || id <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid partner id',
      });
    }
  }
}).transform((data) => ({
  partnerId: data.partnerId ? Number(data.partnerId) : undefined,
  partnerName: data.partnerName || undefined,
}));

const validate = (schema, source = 'body') => (req, res, next) => {
  const input = source === 'query' ? req.query : req.body;
  const result = schema.safeParse(input);

  if (!result.success) {
    const firstIssue = result.error.issues[0];

    return next(
      new ApiError(
        400,
        `${firstIssue.path.join('.')} - ${firstIssue.message}`
      )
    );
  }

  if (source === 'query') {
    req.query = result.data;
  } else {
    req.body = result.data;
  }

  return next();
};

const validatePartnerIdParam = (req, res, next) => {
  const id = Number(req.params.partnerId);

  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, 'Invalid partner id'));
  }

  req.partnerId = id;
  return next();
};

const validateProgramIdParam = (req, res, next) => {
  const id = Number(req.params.programId);

  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, 'Invalid program id'));
  }

  req.programId = id;
  return next();
};

module.exports = {
  addPartnerSchema,
  addProgramSchema,
  updatePartnerSchema,
  partnerProgramsQuerySchema,
  validate,
  validateAddPartner: validate(addPartnerSchema),
  validateAddProgram: validate(addProgramSchema),
  validateUpdatePartner: validate(updatePartnerSchema),
  validatePartnerProgramsQuery: validate(partnerProgramsQuerySchema, 'query'),
  validatePartnerIdParam,
  validateProgramIdParam,
};
