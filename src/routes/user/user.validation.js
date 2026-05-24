const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, 'Password must include uppercase, lowercase, number, and symbol');

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: passwordSchema
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

const oauthSchema = z.object({
  provider: z.string().trim().min(1, 'Provider is required'),
  providerAccountId: z.string().trim().min(1, 'Provider account ID is required'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  image: z.string().trim().min(1).optional().nullable()
});

const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(new ApiError(400, firstIssue?.message || 'Validation failed'));
    }

    req.body = result.data;
    return next();
  };
};

module.exports = {
  signupSchema,
  loginSchema,
  oauthSchema,
  validate,
  validateSignup: validate(signupSchema),
  validateLogin: validate(loginSchema),
  validateOAuth: validate(oauthSchema)
};