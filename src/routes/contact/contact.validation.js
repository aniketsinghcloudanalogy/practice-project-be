const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const contactSchema = z.object({
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

  secondaryContact: z
    .string()
    .trim()
    .max(15, 'Secondary contact must be at most 15 digits')
    .optional()
    .nullable(),

  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters long')
    .max(100, 'Subject must be at most 100 characters long'),

  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters long')
    .max(1000, 'Message must be at most 1000 characters long'),
});

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
  contactSchema,
  validate,
  validateContact: validate(contactSchema),
};
