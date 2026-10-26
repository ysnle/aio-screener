// Legacy unification (2026-10-26, roadmap item 11, screen 오늘): the home VIX card moved here from js/aio-data.js
// (_aioRenderHomeVix). Output and colours are unchanged. The home page (src/ui/pages/analysis.js) paints it on every
// render; window._aioRenderHomeVix stays for the legacy snapshot apply and home refresh (src/app/compatibility-globals.js).

// VIX is never 0: a 0 is a missing quote.
const positive = (v) => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function renderHomeVix({ documentRef = globalThis.document, root = globalThis, quote } = {}) {
  const valueEl = documentRef?.getElementById?.('home-vix-value');
  const statusEl = documentRef?.getElementById?.('home-vix-status');
  if (!valueEl) return;
  const q = quote || root._liveData?.['^VIX'] || {};
  const vp = positive(q.price) != null ? positive(q.price) : positive(root.DATA_SNAPSHOT?.vix);
  valueEl.textContent = root._aioSafeFixed ? root._aioSafeFixed(vp, 2, '—') : (vp == null ? '—' : String(Math.round(vp * 100) / 100));
  // P1499: theme tokens, not the retired neon palette. P1367: one VIX band (aio-core _vixBand 18/25/32).
  valueEl.style.color = vp == null ? 'var(--text-muted)' : (vp >= 32 ? 'var(--data-red)' : vp >= 25 ? 'var(--data-amber)' : vp >= 18 ? 'var(--text-secondary)' : 'var(--data-green)');
  if (statusEl) statusEl.textContent = vp == null ? '—' : (vp >= 32 ? '고변동 구간' : vp >= 25 ? '변동성 경계 구간' : vp >= 18 ? '통상 범위' : '저변동 구간');
}
