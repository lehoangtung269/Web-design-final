/**
 * ============================================
 *  FORM AUTO-SAVE — DatSan.vn
 *  Automatically saves form data to localStorage
 *  and restores it on page load.
 *
 *  Usage: Add data-autosave="unique-form-id" to any <form>
 * ============================================
 */
(function () {
  'use strict';

  const SAVE_INTERVAL = 2000; // Save every 2 seconds
  const PREFIX = 'datsan_autosave_';

  function getFormKey(form) {
    return PREFIX + (form.getAttribute('data-autosave') || form.id || 'default');
  }

  function saveForm(form) {
    const key = getFormKey(form);
    const data = {};

    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function (el) {
      // Skip hidden fields, file inputs, CSRF tokens, and password fields
      if (el.type === 'hidden' || el.type === 'file' || el.type === 'password') return;
      if (el.name === '_csrf') return;
      if (!el.name) return;

      if (el.type === 'checkbox') {
        if (!data[el.name]) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    });

    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      // localStorage might be full or disabled
    }
  }

  function restoreForm(form) {
    const key = getFormKey(form);
    let data;

    try {
      data = JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return;
    }

    if (!data) return;

    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function (el) {
      if (el.type === 'hidden' || el.type === 'file' || el.type === 'password') return;
      if (el.name === '_csrf') return;
      if (!el.name) return;
      if (!(el.name in data)) return;

      if (el.type === 'checkbox') {
        el.checked = Array.isArray(data[el.name]) && data[el.name].includes(el.value);
      } else if (el.type === 'radio') {
        el.checked = data[el.name] === el.value;
      } else {
        // Only restore if field is empty (don't overwrite server-provided values)
        if (!el.value || el.value === el.defaultValue) {
          el.value = data[el.name];
        }
      }
    });

    // Show restore notice
    showRestoreNotice(form);
  }

  function clearForm(form) {
    const key = getFormKey(form);
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function showRestoreNotice(form) {
    const key = getFormKey(form);
    const data = localStorage.getItem(key);
    if (!data) return;

    // Don't show notice if data is basically empty
    try {
      const parsed = JSON.parse(data);
      const hasContent = Object.values(parsed).some(function (v) {
        if (Array.isArray(v)) return v.length > 0;
        return v && v.toString().trim().length > 0;
      });
      if (!hasContent) return;
    } catch (e) { return; }

    const notice = document.createElement('div');
    notice.className = 'autosave-notice';
    notice.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">restore</span> '
      + 'Dữ liệu đã được khôi phục từ bản nháp trước đó. '
      + '<button type="button" class="autosave-clear-btn">Xóa nháp</button>';

    notice.style.cssText = 'background:#f4f0ff;border:1px solid #c4b5fd;border-radius:12px;padding:10px 16px;'
      + 'margin-bottom:16px;font-size:13px;color:#5025a5;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const clearBtn = notice.querySelector('.autosave-clear-btn');
    clearBtn.style.cssText = 'background:#6a37d3;color:white;border:none;border-radius:8px;padding:4px 12px;'
      + 'font-size:11px;font-weight:700;cursor:pointer;margin-left:auto;';

    clearBtn.addEventListener('click', function () {
      clearForm(form);
      notice.style.opacity = '0';
      notice.style.transition = 'opacity 300ms ease';
      setTimeout(function () { notice.remove(); }, 300);
      // Reset form to defaults
      form.reset();
    });

    form.insertBefore(notice, form.firstChild);
  }

  // Initialize all autosave forms
  function init() {
    var forms = document.querySelectorAll('form[data-autosave]');

    forms.forEach(function (form) {
      // Restore saved data
      restoreForm(form);

      // Auto-save periodically
      setInterval(function () {
        saveForm(form);
      }, SAVE_INTERVAL);

      // Clear on successful submit
      form.addEventListener('submit', function () {
        clearForm(form);
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
