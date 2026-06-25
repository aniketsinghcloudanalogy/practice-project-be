const { chromium } = require('playwright');
const groqClient = require('../../utils/groq');


// ====== STEP 1: Clean admin form data ======
function parsePayload(response, programId) {
  // Get the raw data from request
  const raw = Array.isArray(response) ? response[0] : response;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  const suffix = `_${programId}`;
  const fieldCount = Object.keys(data).length;
  const fields = {};

  // Clean each field name, SKIP empty fields
  for (const key of Object.keys(data)) {
    const val = data[key];

    // Skip empty or --None-- fields (don't send to AI)
    if (!val || val === '--None--' || val.trim() === '') continue;

    let label = key;

    // "u_Partner_Company_Name_239" → "Partner_Company_Name_239"
    if (label.startsWith('u_')) label = label.slice(2);

    // "Partner_Company_Name_239" → "Partner_Company_Name"
    if (label.endsWith(suffix)) label = label.slice(0, -suffix.length);

    // "Partner_Company_Name" → "Partner Company Name"
    label = label.replace(/_/g, ' ').trim();

    // Only keep fields that have actual data
    fields[label] = val;
  }

  return { fields, fieldCount };
}

// ====== STEP 2: Open client page in visible browser ======
async function openClientPage(clientUrl) {
  // Launch a real Chrome browser (visible on screen)
  const browser = await chromium.launch({ headless: false });

  // Open new tab
  const page = await browser.newPage();

  // Go to client URL (like typing in address bar)
  await page.goto(clientUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for form fields to appear
  await page.waitForSelector('input, select, textarea', { timeout: 5000 }).catch(() => {});

  return { browser, page };
}

// ====== STEP 3: Get all form fields from client page ======
async function scrapeFields(page) {
  // This runs INSIDE the client's webpage
  return page.evaluate(() => {
    const skip = ['hidden', 'submit', 'button', 'reset'];
    const results = [];

    // Find label for a field
    function getLabel(el) {
      // Try: <label for="fieldId">
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) return lbl.textContent.trim();
      }
      // Try: parent div has a label
      const parent = el.closest('div, .form-group, label');
      if (parent) {
        const lbl = parent.querySelector('label');
        if (lbl) return lbl.textContent.trim();
      }
      return '';
    }

    // Loop all form elements on page
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (skip.includes(type)) return;

      const tag = el.tagName.toLowerCase();
      const options = [];

      // Get dropdown options
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

      results.push({
        tag, type,
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        label: getLabel(el),
        options,
      });
    });

    return results;
  });
}

// ====== STEP 4: AI matches admin data → client fields ======
async function matchFields(payload, scrapedFields, fieldCount) {
  // Build the prompt for AI
  const prompt = `Match admin data to client form fields.

ADMIN DATA (${fieldCount} fields):
${JSON.stringify(payload)}

CLIENT FIELDS:
${JSON.stringify(scrapedFields)}

RULES:
- Page may have multiple forms. Pick form with field count closest to ${fieldCount}.
- Match by label or placeholder or name.
- SELECT: match to option text, return option value.
- RADIO: return matching value.
- ONLY include fields that have a match in admin data. Skip unmatched fields completely.
- Selector: "#id" if id exists, else "[name='name']".
- Do NOT include fields with empty or no value.

Return JSON array only:
[{"selector":"#id","value":"value","tag":"input"}]`;

  // Send to Groq AI
  const content = await groqClient.chat(prompt, {
    system: 'Return only valid JSON array. No explanation.',
    maxTokens: 2000,
  });

  // Clean AI response and parse JSON
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response invalid');
  return JSON.parse(clean.slice(start, end + 1));
}

// ====== STEP 5: Fill the form (skip "None" fields) ======
async function fillForm(page, mappings) {
  // Fills ALL fields in one shot (fast)
  await page.evaluate((mappings) => {
    for (const { selector, value, tag } of mappings) {
      // Skip empty fields - don't touch them
      if (!value || value === 'None' || value === '--None--' || value.trim() === '') continue;

      // Find the element on page
      const el = document.querySelector(selector);
      if (!el) continue;

      if (tag === 'select') {
        // Dropdown: set value and trigger change
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tag === 'input') {
        const type = el.getAttribute('type') || '';

        if (type === 'radio') {
          // Radio: find and check the right option
          const radio = document.querySelector(`[name="${el.name}"][value="${value}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (type === 'checkbox') {
          // Checkbox: check it
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // Text/email/phone: type the value
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        // Textarea: type the value
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }, mappings);
}

module.exports = { parsePayload, openClientPage, scrapeFields, matchFields, fillForm };
