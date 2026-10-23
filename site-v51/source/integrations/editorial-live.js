/* Public copy is read from the MED JITA Craft collection.
 * Only records marked Revisado are returned by the server. */
(() => {
  'use strict';
  let lastRead = 0;
  let pending = null;
  async function refresh(force = false) {
    if (pending) return pending;
    if (!force && Date.now() - lastRead < 30000) return;
    lastRead = Date.now();
    pending = (async () => {
      try {
        // This site is owner-private: keep the same-origin login session on API reads.
        const response = await fetch('/api/editorial', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.ok || !data.items || typeof data.items !== 'object') return;
        document.querySelectorAll('[data-editorial-key]').forEach(el => {
          const value = data.items[el.dataset.editorialKey];
          if (typeof value === 'string' && value.length > 0) el.textContent = value;
        });
      } catch (_) { /* Keep bundled copy available offline. */ }
      finally { pending = null; }
    })();
    return pending;
  }
  window.MED_JITA_EDITORIAL_REFRESH = () => refresh(true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => refresh(true), { once: true });
  else refresh(true);
  window.addEventListener('pageshow', () => refresh());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  // Pick up Craft edits without requiring the user to reload an open tab.
  window.setInterval(() => {
    if (!document.hidden) refresh();
  }, 60000);
})();
