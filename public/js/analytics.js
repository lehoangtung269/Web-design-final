/* Baseline metrics + lightweight AB assignment */
(function () {
  'use strict';

  function getVariant(testName) {
    const key = 'ab_' + testName;
    let variant = localStorage.getItem(key);
    if (!variant) {
      variant = Math.random() < 0.5 ? 'A' : 'B';
      localStorage.setItem(key, variant);
    }
    return variant;
  }

  function track(eventName, payload) {
    const data = Object.assign(
      {
        event: eventName,
        ts: Date.now(),
        path: window.location.pathname,
      },
      payload || {}
    );

    window.__uxMetrics = window.__uxMetrics || [];
    window.__uxMetrics.push(data);
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(data);
    }
    if (window.location.hostname === 'localhost') {
      console.log('[UX-METRIC]', data);
    }
  }

  window.DatSanAnalytics = {
    getVariant: getVariant,
    track: track,
  };

  track('page_view', { referrer: document.referrer || null });
})();
