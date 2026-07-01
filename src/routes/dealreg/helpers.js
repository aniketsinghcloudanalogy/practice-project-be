const path = require('path');
const { chromium } = require('playwright');
const groqClient = require('../../utils/groq');

const BROWSER_UI = path.join(__dirname, 'browserUI.js');

// ─── Payload ─────────────────────────────────────────────────────────────────

// Parse the AI response payload into a clean { label: value } map
function parsePayload(response, programId) {
  const raw = Array.isArray(response) ? response[0] : response;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const suffix = `_${programId}`;
  const fieldCount = Object.keys(data).length;

  const fields = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (!val || val === '--None--' || val.trim() === '') continue;

    // Clean up the key: remove "u_" prefix and "_programId" suffix
    let label = key;
    if (label.startsWith('u_')) label = label.slice(2);
    if (label.endsWith(suffix)) label = label.slice(0, -suffix.length);
    fields[label.replace(/_/g, ' ').trim()] = val;
  }

  return { fields, fieldCount };
}

// ─── Browser ──────────────────────────────────────────────────────────────────

// Launch Chromium and navigate to the client URL
async function openClientPage(clientUrl, { headless = false } = {}) {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  await page.goto(clientUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('input, select, textarea', { timeout: 5000 }).catch(() => {});
  return { browser, page };
}

// Inject browserUI.js into the page (safe to call multiple times — script guards itself)
async function injectUI(page) {
  await page.addScriptTag({ path: BROWSER_UI });
}

// ─── Login Detection ──────────────────────────────────────────────────────────

// Returns true if the current page looks like a login page
async function detectLoginPage(page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    let hasPassword = false;
    let hasUsername = false;
    let visibleCount = 0;

    for (const input of inputs) {
      if (input.type === 'hidden' || input.offsetParent === null) continue;
      visibleCount++;

      const type = (input.getAttribute('type') || '').toLowerCase();
      const attrs = [input.name, input.id, input.placeholder, input.getAttribute('autocomplete')]
        .join(' ').toLowerCase();

      if (type === 'password') hasPassword = true;
      if (type === 'text' || type === 'email' || attrs.match(/user|email|login/)) hasUsername = true;
    }

    // Simple form with password + username = login page
    if (hasPassword && hasUsername && visibleCount <= 5) return true;

    // Also check page text for login keywords
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const keywords = ['sign in', 'log in', 'login', 'enter your credentials', 'username', 'forgot password'];
    return hasPassword && keywords.filter(k => bodyText.includes(k)).length >= 2;
  });
}

// ─── UI Overlays ──────────────────────────────────────────────────────────────

async function showLoadingOverlay(page, text) {
  await injectUI(page);
  await page.evaluate((msg) => DR.showOverlay(msg), text);
}

async function updateLoadingOverlay(page, text) {
  await page.evaluate((msg) => DR.updateOverlay(msg), text).catch(() => {});
}

async function removeLoadingOverlay(page) {
  await page.evaluate(() => DR.hideOverlay()).catch(() => {});
}

async function showPasswordModal(page, email, isRetry) {
  await injectUI(page);
  await page.evaluate(
    ({ hint, retry }) => DR.showPasswordModal(hint, retry),
    { hint: email || null, retry: !!isRetry }
  );
}

async function showTerminationOverlay(page) {
  await injectUI(page);
  await page.evaluate(() => DR.showTerminated());
}

// Show the form review panel with AI-matched fields
async function showFormPanel(page, mappings, scrapedForms) {
  // Merge scraped field metadata with AI-matched values
  const allFields = scrapedForms.flatMap(f => f.fields);
  const enriched = allFields
    .filter(f => f.tag !== 'hidden')
    .map(f => {
      const match = mappings.find(m => m.selector === (f.id ? `#${f.id}` : `[name='${f.name}']`));
      return { ...f, value: match?.value || '' };
    });

  await injectUI(page);
  await page.evaluate((fields) => DR.showFormPanel(fields), enriched);
}

// ─── Field Scraping ───────────────────────────────────────────────────────────

// Scrape all form fields from the page
async function scrapeFields(page) {
  return page.evaluate(() => {
    const SKIP_TYPES = ['hidden', 'submit', 'button', 'reset'];

    // Try to find a label for a given input element
    function getLabel(el) {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) return lbl.textContent.trim();
      }
      const lbl = el.closest('div, .form-group, label')?.querySelector('label');
      return lbl ? lbl.textContent.trim() : '';
    }

    // Extract all usable fields from a container element
    function extractFields(container) {
      const results = [];

      container.querySelectorAll('input, select, textarea').forEach((el) => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (SKIP_TYPES.includes(type)) return;

        const tag = el.tagName.toLowerCase();
        const options = [];

        // Collect <option> values for select elements
        if (tag === 'select') {
          el.querySelectorAll('option').forEach((o) => {
            if (o.value) options.push({ value: o.value, text: o.textContent.trim() });
          });
        }

        // Group radio buttons by name
        if (type === 'radio') {
          const existing = results.find((f) => f.name === el.name);
          if (existing) {
            existing.options.push({ value: el.value, text: el.value });
            return;
          }
          options.push({ value: el.value, text: el.value });
        }

        const selector = el.id ? `#${el.id}` : el.name ? `[name='${el.name}']` : null;

        results.push({
          tag,
          type,
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          label: getLabel(el),
          options,
          required: el.required || el.getAttribute('required') !== null,
          selector,
        });
      });

      return results;
    }

    const forms = Array.from(document.querySelectorAll('form'));

    // If only one form (or no form tags), scrape the whole document
    if (forms.length <= 1) return [{ formIndex: 0, fields: extractFields(document) }];

    // Multiple forms — scrape each separately
    return forms
      .map((form, i) => ({ formIndex: i, fields: extractFields(form) }))
      .filter((f) => f.fields.length > 0);
  });
}

// ─── AI Field Matching ────────────────────────────────────────────────────────

// Ask Groq AI to match admin data fields to the scraped form fields
async function matchFields(payload, formGroups, fieldCount) {
  const prompt = `
You are given admin data and multiple forms scraped from a page.
Pick the ONE form whose fields best match the admin data labels, then map values to it.

ADMIN DATA (${fieldCount} fields):
${JSON.stringify(payload)}

FORMS ON PAGE:
${JSON.stringify(formGroups)}

RULES:
- Choose the form (by formIndex) whose field labels/names/placeholders most closely match the admin data keys.
- Match each admin field to a client field by label, placeholder, or name (fuzzy/semantic match allowed).
- SELECT: match option text, return option value.
- RADIO: return the matching option value.
- Only include fields that have a matching admin value. Skip unmatched fields.
- Selector: "#id" if id exists, else "[name='name']".
- Do NOT include fields with empty or no value.

Return JSON array only (fields from the best matching form):
[{"selector":"#id","value":"value","tag":"input"}]
`.trim();

  const content = await groqClient.chat(prompt, {
    system: 'Return only valid JSON array. No explanation.',
    maxTokens: 2000,
  });

  // Strip markdown code fences if present
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response invalid');

  return JSON.parse(clean.slice(start, end + 1));
}

// ─── Form Filling ─────────────────────────────────────────────────────────────

// Fill each mapped field on the page
async function fillForm(page, mappings) {
  for (const { selector, value, tag } of mappings) {
    if (!value || value === 'None' || value === '--None--' || value.trim() === '') continue;

    await page.evaluate(({ selector, value, tag }) => {
      const el = document.querySelector(selector);
      if (!el) return;

      if (tag === 'select') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tag === 'input') {
        const type = el.getAttribute('type') || '';
        if (type === 'radio') {
          const radio = document.querySelector(`[name="${el.name}"][value="${value}"]`);
          if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        } else if (type === 'checkbox') {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, { selector, value, tag });

    await page.waitForTimeout(120); // small delay between fields
  }
}

module.exports = {
  parsePayload,
  openClientPage,
  detectLoginPage,
  scrapeFields,
  matchFields,
  fillForm,
  showLoadingOverlay,
  updateLoadingOverlay,
  removeLoadingOverlay,
  showPasswordModal,
  showTerminationOverlay,
  showFormPanel,
};
