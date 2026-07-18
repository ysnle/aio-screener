export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** A conservative renderer boundary for new modules. */
export function createSanitizer({ sanitize } = {}) {
  const clean = typeof sanitize === 'function' ? sanitize : escapeHtml;
  return Object.freeze({
    text: (value) => escapeHtml(value),
    html: (value) => clean(String(value ?? ''), { USE_PROFILES: { html: true } })
  });
}
