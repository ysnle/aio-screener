// Fable-advisor design (2026-07-21, P746 breadth-stage-summary follow-up, second consult). The
// client only ever has TODAY'S breadth5sma/20sma/50sma (% of a universe above its own N-day SMA)
// plus, at most, a one-cycle delta against a device-persisted previous reading (caller sources
// this from js/aio-data.js:_aioGetPrevDeltaRef, a browser-storage-backed helper — deliberately not
// named literally here since this module must stay storage/DOM/fetch-free per the domain-layer
// boundary check) — there is no persisted multi-day breadth time series anywhere in this repo
// (verified: public-data/history.json carries only index/macro series, no breadth fields;
// architecture/reconciliation-status.json already lists categoryId "breadth-history" as status
// "BLOCKED"). A genuine trend-phase classification in the Weinstein sense needs historical trend,
// not a snapshot level, so this deliberately does NOT produce a "Stage" — it classifies today's
// participation LEVEL, plus an optional best-effort DIRECTION that is never fabricated when the
// one-cycle delta is unavailable (first run / cleared device storage / day-boundary reset).
export const BREADTH_PARTICIPATION_MODEL_VERSION = 'breadth-participation.v1';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {object} input
 * @param {number|null} input.sma20   % of universe above 20-day SMA (today)
 * @param {number|null} input.sma50   % of universe above 50-day SMA (today)
 * @param {number|null} input.sma20Delta  today's sma20 minus the last persisted reading, in pp (primary direction signal)
 * @param {number|null} input.sma5Delta   today's sma5 minus the last persisted reading, in pp (used only when sma20Delta is unavailable)
 */
export function classifyBreadthParticipation({ sma20 = null, sma50 = null, sma20Delta = null, sma5Delta = null } = {}) {
  const s20 = finite(sma20);
  const s50 = finite(sma50);
  if (s20 == null || s50 == null) {
    return Object.freeze({ modelVersion: BREADTH_PARTICIPATION_MODEL_VERSION, available: false, level: null, direction: null, inputs: Object.freeze({ sma20: s20, sma50: s50, sma20Delta: null, sma5Delta: null }) });
  }
  const level = (s20 >= 60 && s50 >= 55) ? 'broad'
    : (s20 <= 35 || (s20 < 50 && s50 < 45)) ? 'narrow'
    : 'neutral';
  const d20 = finite(sma20Delta);
  const d5 = finite(sma5Delta);
  const primaryDelta = d20 != null ? d20 : d5;
  const direction = primaryDelta == null ? null : primaryDelta > 2 ? 'rising' : primaryDelta < -2 ? 'falling' : 'flat';
  return Object.freeze({
    modelVersion: BREADTH_PARTICIPATION_MODEL_VERSION,
    available: true,
    level,
    direction,
    inputs: Object.freeze({ sma20: s20, sma50: s50, sma20Delta: d20, sma5Delta: d5 })
  });
}
