const { z } = require('zod');
const ApiError = require('../../utils/ApiError');

const saveLocationSchema = z.object({
  latitude: z.number({ required_error: 'Latitude is required' }),
  longitude: z.number({ required_error: 'Longitude is required' }),
  label: z.string().trim().optional(),
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

module.exports = { validateSaveLocation: validate(saveLocationSchema) };
