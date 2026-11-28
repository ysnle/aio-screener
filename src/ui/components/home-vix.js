// Legacy unification (2026-10-26, roadmap item 11, screen 오늘): the home VIX card moved here from js/aio-data.js
// (_aioRenderHomeVix). Output and colours are unchanged. The home page (src/ui/pages/analysis.js) paints it on every
// render; window._aioRenderHomeVix stays for the legacy snapshot apply and home refresh (src/app/compatibility-globals.js).
import { vixBand } from '../../domain/market/sentiment/narrative.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { volatilityState } from '../../domain/market/sentiment/volatility-state.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';

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
  // Theme tokens, not the retired neon palette. One VIX band (aio-core _vixBand 18/25/32).
  // The one band (narrative.vixBand on RULES.volatility); this card kept its own 32/25/18 copy.
  const V = RULES.volatility;
  valueEl.style.color = vp == null ? 'var(--color-text-secondary)' : (vp >= V.highAt ? 'var(--color-text-error)' : vp >= V.stressAt ? 'var(--color-text-warning)' : vp >= V.calmBelow ? 'var(--color-text-secondary)' : 'var(--color-text-success)');
  if (statusEl) {
    // The last completed session's S&P 500 move against the range the session before implied (a tag; the numbers are in
    // the title and on 투자 심리).
    const range = volatilityState(root._aioHistory || [])?.range || null;
    statusEl.textContent = vp == null ? '—' : `${vixBand(vp).label}${range ? ` · ${shortDate(range.date)} S&P 500 ${range.label}` : ''}`;
    statusEl.title = range ? `${shortDate(range.date)} S&P 500 ${signedText(range.move, 1, '%')}, ${shortDate(range.priorDate)} VIX ${range.priorVix.toFixed(2)} 기준 하루 1표준편차 ±${range.sd.toFixed(1)}%` : '';
  }
}
