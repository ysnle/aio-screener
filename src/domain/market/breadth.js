// Fable-advisor design (2026-07-21, P746 breadth-stage-summary follow-up, second consult). The
// The client receives today's AIO-universe breadth plus, after the screener producer has completed,
// a durable daily AIO-universe history in public-data/history.json. The caller may therefore pass a
// same-universe historical delta; a device-persisted one-cycle delta remains a fallback. This is
// still not official exchange A/D data and must not be called McClellan or an exchange-wide breadth
// stage. The model classifies participation LEVEL and DIRECTION only, and never fabricates either
// when the required same-universe observations are absent.
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
