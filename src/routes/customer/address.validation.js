const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const addressSchema = z.object({
  addressLine: z.string().trim().min(1, 'Address line is required'),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  zipCode: z.string().trim().min(1, 'Zip code is required'),
  country: z.string().trim().min(1, 'Country is required'),
  type: z.enum(['SHIPPING', 'BILLING', 'BOTH']),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

const updateAddressSchema = addressSchema.partial().refine(
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
  validateCreateAddress: validate(addressSchema),
  validateUpdateAddress: validate(updateAddressSchema),
};
