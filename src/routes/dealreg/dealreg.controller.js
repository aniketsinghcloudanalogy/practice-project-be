const ApiError = require('../../utils/ApiError');
const { parsePayload, openClientPage, scrapeFields, matchFields, fillForm } = require('./helpers');

// POST /api/dealreg/submit
const submitToClient = async (req, res, next) => {
  const { response, programId, clientUrl } = req.body;

  if (!response || !programId) return next(new ApiError(400, 'response and programId required'));
  if (!clientUrl) return next(new ApiError(400, 'clientUrl required'));

  try {
    // 1. Clean admin data
    const { fields, fieldCount } = parsePayload(response, programId);

    // 2. Open client page + scrape fields at same time
    const { page } = await openClientPage(clientUrl);
    const scrapedFields = await scrapeFields(page);

    if (!scrapedFields.length) throw new ApiError(422, 'No form fields found');

    // 3. AI matches fields
    const mappings = await matchFields(fields, scrapedFields, fieldCount);

    // 4. Fill form (NO submit) - browser stays open
    await fillForm(page, mappings);

    res.json({ success: true, message: 'Form filled - verify and submit manually' });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, err.message));
  }
};

module.exports = { submitToClient };
