// This file is injected into the Chromium browser page via page.addScriptTag()
// It runs inside the browser (not Node.js), so no require() — just plain JS

// Store credentials outside the IIFE so re-injection doesn't reset them
if (!window.__dr_creds__) window.__dr_creds__ = { user: '', pass: '' };

window.DR = (() => {
  const MAX_Z   = 2147483647;
  const FONT    = 'system-ui,-apple-system,sans-serif';
  const creds   = window.__dr_creds__;

  // ─── Styles ────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('__dr_styles__')) return; // already injected
    const style = document.createElement('style');
    style.id = '__dr_styles__';
    style.textContent = `
      @keyframes dr-spin    { to { transform: rotate(360deg) } }
      @keyframes dr-fadein  { from { opacity: 0 } to { opacity: 1 } }
      @keyframes dr-popin   { from { opacity: 0; transform: scale(0.93) } to { opacity: 1; transform: scale(1) } }
      @keyframes dr-slidein { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      #__dr_form_panel__ { scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
    `;
    document.head.appendChild(style);
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  // Set input value in a way that works with React/Vue controlled inputs
  function setNative(el, val) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter ? setter.call(el, val) : (el.value = val);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ─── Loading Overlay ───────────────────────────────────────────────────────

  function showOverlay(msg) {
    if (document.getElementById('__dr_overlay__')) return;
    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = '__dr_overlay__';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: MAX_Z,
      background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', fontFamily: FONT, animation: 'dr-fadein 0.2s ease forwards',
    });
    overlay.innerHTML = `
      <div style="width:48px;height:48px;border-radius:50%;border:4px solid rgba(255,255,255,0.2);border-top-color:#fff;animation:dr-spin 0.8s linear infinite"></div>
      <p id="__dr_overlay_msg__" style="color:#fff;font-size:15px;font-weight:600;margin:0;text-align:center;max-width:320px;line-height:1.5">${msg}</p>
    `;
    document.body.appendChild(overlay);
  }

  function updateOverlay(msg) {
    const el = document.getElementById('__dr_overlay_msg__');
    if (el) el.textContent = msg;
  }

  function hideOverlay() {
    document.getElementById('__dr_overlay__')?.remove();
  }

  // ─── Password Modal ────────────────────────────────────────────────────────

  function showPasswordModal(emailHint, isRetry) {
    injectStyles();

    // Update stored credentials
    if (isRetry) creds.pass = '';
    if (!isRetry && emailHint) creds.user = emailHint;

    // Remove any existing panel before showing a new one
    document.getElementById('__dr_cred_panel__')?.remove();

    const panel = document.createElement('div');
    panel.id = '__dr_cred_panel__';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '28px', right: '28px', zIndex: MAX_Z,
      background: '#fff', borderRadius: '14px', padding: '20px 18px 16px', width: '280px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      fontFamily: FONT, animation: 'dr-slidein 0.25s ease forwards',
      border: isRetry ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0',
    });

    panel.innerHTML = `
      <p style="margin:0 0 ${isRetry ? 4 : 12}px;font-size:14px;font-weight:700;color:#0f172a">
        ${isRetry ? '⚠️ Wrong password — try again' : '🔑 Enter Password'}
      </p>
      ${isRetry ? '<p style="margin:0 0 10px;font-size:12px;color:#ef4444;font-weight:500">1 attempt remaining</p>' : ''}
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f8fafc;border-radius:8px;margin-bottom:12px;border:1px solid #e2e8f0">
        <span style="font-size:13px;color:#64748b">📧</span>
        <span style="font-size:13px;color:#475569;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${creds.user || 'No email'}</span>
      </div>
      <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">Password</label>
      <input id="__dr_p__" type="password" placeholder="Enter password"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:12px;font-family:${FONT}"
      />
      <button id="__dr_submit__"
        style="width:100%;padding:9px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT}"
      >Submit</button>
    `;

    document.body.appendChild(panel);

    const passwordInput = document.getElementById('__dr_p__');
    const submitBtn     = document.getElementById('__dr_submit__');

    // Auto-fill the email field on the login page
    if (creds.user) {
      for (const inp of document.querySelectorAll('input')) {
        if (inp.closest('#__dr_cred_panel__')) continue;
        if (inp.type === 'hidden' || inp.offsetParent === null) continue;
        const attrs = [inp.type, inp.name, inp.id, inp.placeholder, inp.getAttribute('autocomplete') || ''].join(' ').toLowerCase();
        if (inp.type === 'email' || attrs.match(/user|email|login/)) { setNative(inp, creds.user); break; }
      }
    }

    submitBtn.onmouseenter = () => submitBtn.style.background = '#1d4ed8';
    submitBtn.onmouseleave = () => submitBtn.style.background = '#2563eb';
    setTimeout(() => passwordInput.focus(), 60);

    function doSubmit() {
      const password = passwordInput.value;
      if (!password) return;

      // Fill the password field on the actual login form
      for (const inp of document.querySelectorAll('input')) {
        if (inp.closest('#__dr_cred_panel__')) continue;
        if (inp.type === 'password' && inp.offsetParent !== null) { setNative(inp, password); break; }
      }

      panel.remove();

      // Click the login form's submit button
      const loginSubmit =
        document.querySelector('button[type="submit"]') ||
        document.querySelector('input[type="submit"]')  ||
        document.querySelector('form button:not([type="button"])');
      if (loginSubmit) loginSubmit.click();
      else document.querySelector('form')?.submit();
    }

    submitBtn.onclick = doSubmit;
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSubmit(); });
  }

  // ─── Form Review Panel ─────────────────────────────────────────────────────

  function showFormPanel(fields) {
    injectStyles();
    if (document.getElementById('__dr_form_toggle__')) return; // already shown

    const fieldLabels = fields.map((f, i) => f.label || f.name || f.placeholder || `Field ${i + 1}`);
    const rows = []; // tracks each row: { wrap, sel, _valueEl, fieldIndex }

    // ── Toggle button (bottom-right) ──
    const toggle = document.createElement('button');
    toggle.id = '__dr_form_toggle__';
    Object.assign(toggle.style, {
      position: 'fixed', bottom: '28px', right: '28px', zIndex: MAX_Z,
      background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px',
      padding: '10px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      fontFamily: FONT, boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
      display: 'flex', alignItems: 'center', gap: '6px',
    });
    toggle.innerHTML = '📋 <span id="__dr_toggle_lbl__">Review Form</span>';
    toggle.onmouseenter = () => toggle.style.background = '#1d4ed8';
    toggle.onmouseleave = () => toggle.style.background = '#2563eb';
    document.body.appendChild(toggle);

    // ── Panel ──
    const panel = document.createElement('div');
    panel.id = '__dr_form_panel__';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '76px', right: '28px', zIndex: MAX_Z,
      background: '#fff', borderRadius: '14px', width: '420px', maxHeight: '68vh',
      display: 'none', flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1.5px solid #e2e8f0', fontFamily: FONT,
    });

    // Header
    const headerCount = document.createElement('span');
    headerCount.style.cssText = 'font-size:12px;color:#64748b';
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: '0',
    });
    header.innerHTML = '<span style="font-size:14px;font-weight:700;color:#0f172a">Form Fields</span>';
    header.appendChild(headerCount);
    panel.appendChild(header);

    // Error banner (hidden by default)
    const errBanner = document.createElement('div');
    Object.assign(errBanner.style, {
      display: 'none', margin: '8px 12px 0', padding: '8px 12px',
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
      fontSize: '12px', color: '#dc2626', lineHeight: '1.6', flexShrink: '0',
    });
    panel.appendChild(errBanner);

    // Scrollable rows area
    const body = document.createElement('div');
    Object.assign(body.style, { overflowY: 'auto', flex: '1', padding: '8px 12px 4px' });
    panel.appendChild(body);

    // Update the "N fields" count in the header
    function updateCount() {
      headerCount.textContent = `${rows.length} field${rows.length !== 1 ? 's' : ''}`;
    }

    // Hide already-selected fields from other rows' dropdowns
    function syncDropdowns() {
      const usedIndices = new Set(rows.map(r => r.fieldIndex));
      rows.forEach(r => {
        Array.from(r.sel.options).forEach(o => {
          if (o.value === '') return; // keep placeholder visible
          const idx = Number(o.value);
          o.hidden = usedIndices.has(idx) && idx !== r.fieldIndex;
        });
      });
    }

    // Build the value input for a field (text input or select dropdown)
    function buildValueInput(f) {
      if (f && (f.tag === 'select' || f.type === 'radio') && f.options?.length) {
        const sel = document.createElement('select');
        sel.style.cssText = `flex:1;min-width:0;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:13px;font-family:${FONT};background:#fff;box-sizing:border-box`;
        sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Select...' }));
        f.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.text;
          if (opt.value === f.value) o.selected = true;
          sel.appendChild(o);
        });
        return sel;
      }

      const input = document.createElement('input');
      input.type        = f?.type === 'password' ? 'password' : f?.type === 'number' ? 'number' : 'text';
      input.placeholder = f?.placeholder || 'Enter value';
      input.value       = f?.value || '';
      input.style.cssText = `flex:1;min-width:0;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:13px;font-family:${FONT};box-sizing:border-box`;
      input.onfocus = () => input.style.borderColor = '#2563eb';
      input.onblur  = () => input.style.borderColor = '#e2e8f0';
      return input;
    }

    // Add a row to the panel
    // fieldIndex = number → pre-select that field; null → blank "Select field…" row
    // locked = true → AI-filled row, cannot be deleted or changed
    function addRow(fieldIndex, locked) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:7px';

      // Field selector dropdown
      const sel = document.createElement('select');
      sel.style.cssText = `width:140px;flex-shrink:0;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:${FONT};background:#fff;box-sizing:border-box`;
      const placeholder = Object.assign(document.createElement('option'), { value: '', textContent: 'Select field…', disabled: true });
      sel.appendChild(placeholder);
      fieldLabels.forEach((lbl, idx) => {
        sel.appendChild(Object.assign(document.createElement('option'), { value: idx, textContent: lbl }));
      });

      const isBlank = fieldIndex == null;
      sel.value = isBlank ? '' : String(fieldIndex);
      if (isBlank) placeholder.selected = true;
      if (locked) sel.disabled = true;

      let valueEl = buildValueInput(isBlank ? null : fields[fieldIndex]);

      // Track this row's data
      const entry = { wrap, sel, _valueEl: valueEl, fieldIndex: isBlank ? null : fieldIndex };
      Object.defineProperty(entry, 'valueEl', { get() { return this._valueEl; } });

      // When user picks a different field, swap the value input
      sel.onchange = () => {
        const newIdx = sel.value === '' ? null : Number(sel.value);
        entry.fieldIndex = newIdx;
        const newValueEl = buildValueInput(newIdx != null ? fields[newIdx] : null);
        wrap.replaceChild(newValueEl, valueEl);
        valueEl = newValueEl;
        entry._valueEl = newValueEl;
        syncDropdowns();
      };

      // Delete button
      const del = document.createElement('button');
      del.textContent = '✕';
      if (locked) {
        // AI-filled rows cannot be deleted
        del.style.cssText = `flex-shrink:0;width:28px;height:28px;border:none;border-radius:6px;background:#f1f5f9;color:#cbd5e1;font-size:13px;cursor:not-allowed;display:flex;align-items:center;justify-content:center`;
      } else {
        del.style.cssText = `flex-shrink:0;width:28px;height:28px;border:none;border-radius:6px;background:#fee2e2;color:#ef4444;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center`;
        del.onmouseenter = () => del.style.background = '#fecaca';
        del.onmouseleave = () => del.style.background = '#fee2e2';
        del.onclick = () => {
          wrap.remove();
          rows.splice(rows.findIndex(r => r.wrap === wrap), 1);
          updateCount();
          syncDropdowns();
        };
      }

      wrap.append(sel, valueEl, del);
      body.appendChild(wrap);
      rows.push(entry);
      updateCount();
      syncDropdowns();
    }

    // Pre-populate rows for AI-matched fields (locked)
    fields.forEach((f, i) => { if (f.value) addRow(i, true); });

    // ── Footer ──
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:8px 12px 12px;border-top:1px solid #f1f5f9;flex-shrink:0;display:flex;gap:8px';

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Field';
    addBtn.style.cssText = `flex:1;padding:8px;border:1.5px dashed #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;font-size:12px;font-weight:600;cursor:pointer;font-family:${FONT}`;
    addBtn.onmouseenter = () => addBtn.style.background = '#f1f5f9';
    addBtn.onmouseleave = () => addBtn.style.background = '#f8fafc';
    addBtn.onclick = () => addRow(null, false); // blank unlocked row

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Fill & Submit';
    submitBtn.style.cssText = `flex:1;padding:8px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:${FONT}`;
    submitBtn.onmouseenter = () => submitBtn.style.background = '#1d4ed8';
    submitBtn.onmouseleave = () => submitBtn.style.background = '#2563eb';

    footer.append(addBtn, submitBtn);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    // Toggle panel open/close
    let panelOpen = false;
    toggle.onclick = () => {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? 'flex' : 'none';
      document.getElementById('__dr_toggle_lbl__').textContent = panelOpen ? 'Close' : 'Review Form';
    };

    // Fill & Submit button
    submitBtn.onclick = () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const missing = [];
      const toFill  = [];

      // Check if any required field has no row at all
      const coveredIndices = new Set(rows.map(r => r.fieldIndex).filter(i => i != null));
      fields.forEach((f, i) => {
        if (f.required && !coveredIndices.has(i)) missing.push(fieldLabels[i] + ' *');
      });

      // Validate each row
      rows.forEach(({ valueEl, fieldIndex }) => {
        if (fieldIndex == null) return; // blank unselected row — skip
        const f   = fields[fieldIndex];
        const val = (valueEl.value || '').toString().trim();

        if (f.required && !val) {
          missing.push(fieldLabels[fieldIndex] + ' *');
          valueEl.style.borderColor = '#ef4444';
          return;
        }
        valueEl.style.borderColor = '#e2e8f0';
        if (val) toFill.push({ ...f, value: val });
      });

      // Show errors if any required fields are missing
      if (missing.length) {
        errBanner.style.display = 'block';
        errBanner.innerHTML = `<strong>Required fields missing:</strong><br>${[...new Set(missing)].map(m => `• ${m}`).join('<br>')}`;
        return;
      }
      errBanner.style.display = 'none';

      // Fill each field on the actual page
      toFill.forEach(({ selector, value, tag, type, name }) => {
        const el = selector ? document.querySelector(selector) : name ? document.querySelector(`[name="${name}"]`) : null;
        if (!el) return;

        if (tag === 'select') {
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (type === 'radio') {
          const rb = document.querySelector(`[name="${el.name}"][value="${value}"]`);
          if (rb) { rb.checked = true; rb.dispatchEvent(new Event('change', { bubbles: true })); }
        } else if (type === 'checkbox') {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          nativeSetter ? nativeSetter.call(el, value) : (el.value = value);
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Hide the panel and toggle button
      panel.style.display = 'none';
      toggle.style.display = 'none';

      // Click the page's own submit button
      const formSubmit =
        document.querySelector('form button[type="submit"]') ||
        document.querySelector('form input[type="submit"]')  ||
        document.querySelector('form button:not([type="button"])');
      if (formSubmit) formSubmit.click();
      else document.querySelector('form')?.submit();

      // Signal the backend (Node.js) that the form was submitted
      window.__dr_submitted__ = true;
    };
  }

  // ─── Termination Overlay ───────────────────────────────────────────────────

  function showTerminated() {
    injectStyles();
    document.getElementById('__dr_cred_panel__')?.remove();

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: MAX_Z,
      background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, animation: 'dr-fadein 0.25s ease forwards',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#fff', borderRadius: '16px', padding: '40px 48px',
      textAlign: 'center', maxWidth: '380px', width: '90%',
      boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'dr-popin 0.3s ease forwards',
    });
    card.innerHTML = `
      <div style="width:58px;height:58px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 18px">🔒</div>
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">Too Many Failed Attempts</p>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
        Incorrect password entered 2 times.<br>This window will close automatically.
      </p>
      <div style="height:4px;border-radius:4px;background:#f1f5f9;overflow:hidden">
        <div id="__dr_bar__" style="height:4px;border-radius:4px;background:#ef4444;width:100%;transition:width 3.2s linear"></div>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animate the countdown bar
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('__dr_bar__').style.width = '0%';
    }));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return { showOverlay, updateOverlay, hideOverlay, showPasswordModal, showFormPanel, showTerminated };
})();
