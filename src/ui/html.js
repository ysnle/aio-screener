// The one HTML escape for native string-template renderers (ADR-0003). Same output as the legacy escHtml
// (js/aio-data.js) plus ' → &#39;, so a value is safe in either attribute quote. No emoji or pictographs on screen
// (owner 2026-10-06); the arrows ↔ ↗ ↙ ▶ ◀ stay.
const PICTOGRAPH_RE = /(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])(?:️|⃣|‍\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])*[  ]?/gu;
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Drops emoji and pictographs, keeping the arrows the screens use. */
export function stripPictographs(value) {
  return String(value).replace(PICTOGRAPH_RE, (match) => (/^[↔↗↙▶◀]/u.test(match) ? match : ''));
}

/** Text → HTML-safe text for a template string; null and undefined are empty. */
export function escapeHtml(value) {
  return value == null ? '' : stripPictographs(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
