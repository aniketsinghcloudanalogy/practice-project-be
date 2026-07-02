const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const opportunitySchema = z.object({
  customerId: z
    .string()
    .min(1, 'customerId is required'),

  opportunityId: z
    .string()
    .optional()
    .nullable(),

  syncedQuote: z
    .number()
    .int()
    .optional()
    .nullable(),

  organization: z
    .string()
    .trim()
    .max(80, 'Organization must be at most 80 characters')
    .optional()
    .nullable(),

  title: z
    .string()
    .trim()
    .max(150, 'Title must be at most 150 characters')
    .optional()
    .nullable(),

  amount: z
    .number()
    .nonnegative('Amount must be a positive number')
    .optional()
    .nullable(),

  pdfUrl: z
    .array(z.string().url('Each PDF URL must be a valid URL'))
    .optional()
    .default([]),

  description: z
    .string()
    .trim()
    .optional()
    .nullable(),

  closeDate: z
    .string()
    .trim()
    .optional()
    .nullable(),

  expectedPrice: z
    .number()
    .nonnegative('Expected price must be a positive number')
    .optional()
    .nullable(),

  addShipment: z
    .boolean()
    .optional()
    .default(false),

  rfqRfiNumber: z
    .string()
    .trim()
    .optional()
    .nullable(),

  periodOfPerformanceStartDate: z
    .string()
    .trim()
    .optional()
    .nullable(),

  periodOfPerformanceEndDate: z
    .string()
    .trim()
    .optional()
    .nullable(),

  probability: z
    .number()
    .int()
    .min(0, 'Probability must be between 0 and 100')
    .max(100, 'Probability must be between 0 and 100')
    .optional()
    .nullable(),
});

const updateOpportunitySchema = opportunitySchema
  .omit({ customerId: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field is required'
  );

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
  validateCreateOpportunity: validate(opportunitySchema),
  validateUpdateOpportunity: validate(updateOpportunitySchema),
};
