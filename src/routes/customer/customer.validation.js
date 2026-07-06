const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(30, 'Name must be at most 100 characters'),

  currency: z
    .string()
    .trim()
    .max(10, 'Currency must be at most 10 characters')
    .optional()
    .nullable(),

  website: z
    .string('Invalid website URL')
    .trim()
    .optional()
    .nullable(),

  industry: z
    .string()
    .trim()
    .max(60, 'Industry must be at most 100 characters')
    .optional()
    .nullable(),

  profileImage: z
    .string()
    .trim()
    .url('Invalid profile image URL')
    .optional()
    .nullable(),

  organization: z
    .string()
    .trim()
    .max(100, 'Organization must be at most 100 characters')
    .optional()
    .nullable(),
});

const updateCustomerSchema = customerSchema.partial().refine(
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
  validateCreateCustomer: validate(customerSchema),
  validateUpdateCustomer: validate(updateCustomerSchema),
};
