// Legacy unification (2026-10-26, roadmap item 11, screen 오늘): the home VIX card moved here from js/aio-data.js
// (_aioRenderHomeVix). Output and colours are unchanged. The home page (src/ui/pages/analysis.js) paints it on every
// render; window._aioRenderHomeVix stays for the legacy snapshot apply and home refresh (src/app/compatibility-globals.js).

import { vixBand } from '../../domain/market/sentiment/narrative.js';
import { RULES } from '../../domain/rules/thresholds.js';

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
  // The one band (narrative.vixBand on RULES.volatility); this card kept its own 32/25/18 copy.
  const V = RULES.volatility;
  valueEl.style.color = vp == null ? 'var(--text-muted)' : (vp >= V.highAt ? 'var(--data-red)' : vp >= V.stressAt ? 'var(--data-amber)' : vp >= V.calmBelow ? 'var(--text-secondary)' : 'var(--data-green)');
  if (statusEl) statusEl.textContent = vp == null ? '—' : vixBand(vp).label;
}
