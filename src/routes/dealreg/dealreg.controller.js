const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const {
  parsePayload, openClientPage, detectLoginPage,
  showLoadingOverlay, updateLoadingOverlay, removeLoadingOverlay,
  showPasswordModal, showTerminationOverlay, showFormPanel,
  scrapeFields, matchFields, fillForm,
} = require('./helpers');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Get partner email from DB
async function getPartnerEmail(partnerId) {
  const partner = await prisma.partner.findUnique({
    where: { id: Number(partnerId) },
    select: { email: true },
  });
  return partner?.email || null;
}

// Scrape the page and ask AI to match fields
async function runFillFlow(page, fields, fieldCount) {
  const scrapedFields = await scrapeFields(page);
  if (!scrapedFields.length) return null;

  const mappings = await matchFields(fields, scrapedFields, fieldCount);
  if (!mappings?.length) return null;

  return { scrapedFields, mappings };
}

// Wait until user clicks "Fill & Submit" in the browser panel, then close browser
async function waitForSubmitAndClose(browser, page) {
  // browserUI.js sets window.__dr_submitted__ = true when user submits
  await page.waitForFunction(() => window.__dr_submitted__ === true, {
    timeout: 300000, // 5 min max wait
    polling: 500,
  });
  await page.waitForTimeout(1200); // let the page's own form submission settle
  await browser.close();
}

// Handle login loop — shows password modal, waits for login, retries up to 2 times
async function handleLogin(browser, page, partnerEmail, res) {
  await showPasswordModal(page, partnerEmail, false);

  let wrongAttempts = 0;
  let currentUrl = page.url();

  while (true) {
    // Wait for either a URL change or a POST response (login attempt)
    await Promise.race([
      page.waitForURL((url) => url.href !== currentUrl, { waitUntil: 'networkidle', timeout: 120000 }),
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.status() !== 0,
        { timeout: 120000 }
      ).then(() => page.waitForLoadState('networkidle').catch(() => {})),
    ]).catch(() => {});

    await page.waitForTimeout(1500); // let page settle after login attempt

    const stillOnLogin = await detectLoginPage(page);
    if (!stillOnLogin) break; // login succeeded

    // Login failed
    currentUrl = page.url();
    wrongAttempts++;

    if (wrongAttempts >= 2) {
      // Too many wrong attempts — show termination screen and close
      await showTerminationOverlay(page);
      await page.waitForTimeout(3500);
      await browser.close();
      return res.status(401).json({ success: false, message: 'Incorrect password 2 times. Process terminated.' });
    }

    // Show retry modal
    await showPasswordModal(page, partnerEmail, true);
  }

  return null; // null means login succeeded
}

// Fill form and show review panel, then wait for user to submit
async function fillAndShowPanel(browser, page, fields, fieldCount, res) {
  await showLoadingOverlay(page, 'Scanning form fields...');

  const result = await runFillFlow(page, fields, fieldCount);
  if (!result) {
    await browser.close();
    return res.status(422).json({ success: false, message: 'No matching fields found.' });
  }

  await updateLoadingOverlay(page, `Filling ${result.mappings.length} fields...`);
  await fillForm(page, result.mappings);
  await removeLoadingOverlay(page);
  await showFormPanel(page, result.mappings, result.scrapedFields);
  await waitForSubmitAndClose(browser, page);

  return res.json({ success: true, submitted: true, fieldsMapped: result.mappings.length });
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

// POST /dealreg/submit
// Main entry point — detects if login is needed, then fills the form
const submitToClient = async (req, res, next) => {
  const { response, programId, clientUrl, partnerId } = req.body;
  if (!response || !programId) return next(new ApiError(400, 'response and programId required'));
  if (!clientUrl) return next(new ApiError(400, 'clientUrl required'));

  try {
    const { fields, fieldCount } = parsePayload(response, programId);
    const partnerEmail = partnerId ? await getPartnerEmail(partnerId) : null;

    // Step 1: Open headless browser just to check if login is required
    const { browser: detectBrowser, page: detectPage } = await openClientPage(clientUrl, { headless: true });
    const needsLogin = await detectLoginPage(detectPage);
    await detectBrowser.close();

    if (needsLogin) {
      // No email saved — tell frontend to call openLoginBrowser instead
      if (!partnerEmail) {
        return res.status(200).json({ success: false, needsCredentials: true });
      }

      // Has email — open visible browser and handle login
      const { browser, page } = await openClientPage(clientUrl, { headless: false });
      try {
        const loginError = await handleLogin(browser, page, partnerEmail, res);
        if (loginError) return; // response already sent inside handleLogin

        return await fillAndShowPanel(browser, page, fields, fieldCount, res);
      } catch (err) {
        await browser.close().catch(() => {});
        throw err;
      }
    }

    // No login needed — open visible browser, scrape and fill directly
    const { browser: visBrowser, page: visiblePage } = await openClientPage(clientUrl, { headless: false });
    return await fillAndShowPanel(visBrowser, visiblePage, fields, fieldCount, res);
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, err.message));
  }
};

// POST /dealreg/open-login-browser
// Called when partner has no email saved — user logs in manually
const openLoginBrowser = async (req, res, next) => {
  const { response, programId, clientUrl, partnerId } = req.body;
  if (!response || !programId) return next(new ApiError(400, 'response and programId required'));
  if (!clientUrl) return next(new ApiError(400, 'clientUrl required'));

  try {
    const { fields, fieldCount } = parsePayload(response, programId);
    const partnerEmail = partnerId ? await getPartnerEmail(partnerId) : null;

    const { browser, page } = await openClientPage(clientUrl, { headless: false });

    const loginError = await handleLogin(browser, page, partnerEmail, res);
    if (loginError) return; // response already sent inside handleLogin

    return await fillAndShowPanel(browser, page, fields, fieldCount, res);
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(500, err.message));
  }
};

module.exports = { submitToClient, openLoginBrowser };
