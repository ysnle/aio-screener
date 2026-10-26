// v58.80 (first-users bundle 1): one owner for how far back a market figure looks and what it is called. Rules count 20
// sessions; index comparisons 21/63/126. One label names one length, measured with sessionPointBack, never in rows.
import { buildCloseSeries, closeSessionMarket, sessionPointBack } from './close-series.js';

export const MARKET_WINDOWS = Object.freeze({ day: 1, week: 5, rule: 20, month: 21, quarter: 63, half: 126 });

export const WINDOW_LABELS = Object.freeze({ 1: '1일', 5: '5거래일', 20: '20거래일', 21: '1개월', 63: '3개월', 126: '6개월' });

export const windowLabel = (sessions) => WINDOW_LABELS[sessions] || `${sessions}거래일`;

/** The close `sessions` exchange sessions before the last close of `series`, and the % change to it, or null. */
export function seriesChange(series, sessions, market = 'US') {
  const last = Array.isArray(series) ? series[series.length - 1] : null;
  const from = last ? sessionPointBack(series, sessions, market) : null;
  if (!last || !from || !(from.value > 0)) return null;
  return { from, to: last, sessions, label: windowLabel(sessions), pct: (last.value / from.value - 1) * 100 };
}

/** The same change read straight from history for one field (spx, wti, kospi …). */
export function closeChange(history, field, sessions, { through = null } = {}) {
  const market = closeSessionMarket(field) || 'US';
  return seriesChange(buildCloseSeries(history, field, { through, market }), sessions, market);
}
