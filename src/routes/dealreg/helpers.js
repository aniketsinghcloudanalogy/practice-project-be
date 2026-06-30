const { chromium } = require('playwright');
const groqClient = require('../../utils/groq');


// ====== STEP 1: Clean admin form data ======
function parsePayload(response, programId) {
  const raw = Array.isArray(response) ? response[0] : response;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  const suffix = `_${programId}`;
  const fieldCount = Object.keys(data).length;
  const fields = {};

  for (const key of Object.keys(data)) {
    const val = data[key];

    if (!val || val === '--None--' || val.trim() === '') continue;

    let label = key;

    if (label.startsWith('u_')) label = label.slice(2);
    if (label.endsWith(suffix)) label = label.slice(0, -suffix.length);

    label = label.replace(/_/g, ' ').trim();
    fields[label] = val;
  }

  return { fields, fieldCount };
}

// ====== STEP 2: Open client page in visible browser ======
async function openClientPage(clientUrl) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(clientUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('input, select, textarea', { timeout: 5000 }).catch(() => {});
  return { browser, page };
}

// ====== STEP 3: Get form fields from BEST matching form on client page ======
async function scrapeFields(page, fieldCount) {
  return page.evaluate((expectedCount) => {
    const skip = ['hidden', 'submit', 'button', 'reset'];

    function getLabel(el) {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) return lbl.textContent.trim();
      }
      const parent = el.closest('div, .form-group, label');
      if (parent) {
        const lbl = parent.querySelector('label');
        if (lbl) return lbl.textContent.trim();
      }
      return '';
    }

    function extractFields(container) {
      const results = [];
      container.querySelectorAll('input, select, textarea').forEach((el) => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (skip.includes(type)) return;

        const tag = el.tagName.toLowerCase();
        const options = [];

        if (tag === 'select') {
          el.querySelectorAll('option').forEach((o) => {
            if (o.value) options.push({ value: o.value, text: o.textContent.trim() });
          });
        }

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
    }

    // Get all <form> elements on the page
    const forms = document.querySelectorAll('form');

    if (forms.length <= 1) {
      // Single form or no form wrapper — scrape entire page
      return extractFields(document);
    }

    // Multiple forms: pick the one with field count closest to expected
    let bestFields = [];
    let bestDiff = Infinity;

    forms.forEach((form) => {
      const fields = extractFields(form);
      const diff = Math.abs(fields.length - expectedCount);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestFields = fields;
      }
    });

    return bestFields;
  }, fieldCount);
}

// ====== STEP 4: AI matches admin data → client fields ======
async function matchFields(payload, scrapedFields, fieldCount) {
  const prompt = `Match admin data to client form fields.

ADMIN DATA (${fieldCount} fields):
${JSON.stringify(payload)}

CLIENT FIELDS:
${JSON.stringify(scrapedFields)}

RULES:
- Match by label or placeholder or name.
- SELECT: match to option text, return option value.
- RADIO: return matching value.
- ONLY include fields that have a match in admin data. Skip unmatched fields completely.
- Selector: "#id" if id exists, else "[name='name']".
- Do NOT include fields with empty or no value.

Return JSON array only:
[{"selector":"#id","value":"value","tag":"input"}]`;

  const content = await groqClient.chat(prompt, {
    system: 'Return only valid JSON array. No explanation.',
    maxTokens: 2000,
  });

  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response invalid');
  return JSON.parse(clean.slice(start, end + 1));
}

// ====== STEP 5: Fill the form (skip "None" fields) ======
async function fillForm(page, mappings) {
  await page.evaluate((mappings) => {
    for (const { selector, value, tag } of mappings) {
      if (!value || value === 'None' || value === '--None--' || value.trim() === '') continue;

      const el = document.querySelector(selector);
      if (!el) continue;

      if (tag === 'select') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tag === 'input') {
        const type = el.getAttribute('type') || '';

        if (type === 'radio') {
          const radio = document.querySelector(`[name="${el.name}"][value="${value}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
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
    }
  }, mappings);
}

module.exports = { parsePayload, openClientPage, scrapeFields, matchFields, fillForm };
