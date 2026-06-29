const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const contactTypeSchema = z.enum(['PRIMARY', 'SECONDARY'], {
  message: 'Contact type must be PRIMARY or SECONDARY',
});

const contactsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name must be at most 50 characters long'),

  lastName: z
    .string()
    .trim()
    .max(50, 'Last name must be at most 50 characters long')
    .optional()
    .nullable(),

  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .toLowerCase(),

  primaryContact: z
    .string()
    .trim()
    .min(10, 'Primary contact must be at least 10 digits')
    .max(15, 'Primary contact must be at most 15 digits'),

  contactType: contactTypeSchema.default('PRIMARY'),

  isPrimaryBillingContact: z.boolean().optional().default(false),
  isPrimaryShippingContact: z.boolean().optional().default(false),

  customerId: z.string().optional().nullable(),
});

const updateContactsSchema = contactsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required'
);

const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];

      return next(
        new ApiError(
          400,
          firstIssue?.message || 'Validation failed'
        )
      );
    }

    req.body = result.data;
    return next();
  };
};

module.exports = {
  contactsSchema,
  updateContactsSchema,
  validate,
  validateCreateContact: validate(contactsSchema),
  validateUpdateContact: validate(updateContactsSchema),
};
