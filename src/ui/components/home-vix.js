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
  const V = RULES.volatility;
  valueEl.style.color = vp == null ? 'var(--color-text-secondary)' : (vp >= V.highAt ? 'var(--color-text-error)' : vp >= V.stressAt ? 'var(--color-text-warning)' : vp >= V.calmBelow ? 'var(--color-text-secondary)' : 'var(--color-text-success)');
  if (statusEl) statusEl.textContent = vp == null ? '—' : vixBand(vp).label;
}
