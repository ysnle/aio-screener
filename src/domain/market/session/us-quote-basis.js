// A US index quote's change is measured from the history close before the quote's own New York session, so value and
// change share one session; a disagreeing provider previous close is replaced by it. Without a history basis (a holiday
// gap, a history short of the previous trading day, an old load) the provider pair stays. Not yet called by the quote
// applier, which still holds the Korean check this belongs beside.
import { isoDay } from '../../shared/session-date.js';
import { readNumber } from '../../shared/number.js';
import { sessionDateInMarket } from './session-time.js';

const nyDate = (iso) => sessionDateInMarket(iso, 'US');

export const US_INDEX_HISTORY_FIELD = Object.freeze({ '^VIX': 'vix', '^GSPC': 'spx', '^IXIC': 'nasdaq', '^NDX': 'ndx', '^DJI': 'dow', '^RUT': 'rut' });
const AGREE = 0.0005;
const HISTORY_MAX_AGE_MS = 6 * 3600000;
const DAY_MS = 86400000;

/** The latest completed close of `field` before `session`, when only weekend days lie between them; else null. */
export function usHistoryBasis(field, session, history = []) {
  if (!field || !isoDay(session)) return null;
  let best = null;
  for (const row of Array.isArray(history) ? history : []) {
    const value = Number(row?.[field]);
    if (!(value > 0)) continue;
    const meta = row.fieldMeta?.[field] || {};
    if (meta.observationRelation === 'carried-forward' || meta.observationRelation === 'current-session' || meta.valueBasis === 'current-session') continue;
    const day = isoDay(meta.sessionDate) || (meta.observedAt ? nyDate(meta.observedAt) : null);
    if (day && day < session && (!best || day > best.date)) best = { date: day, close: value };
  }
  if (!best) return null;
  for (let at = Date.parse(`${best.date}T12:00:00Z`) + DAY_MS; at < Date.parse(`${session}T12:00:00Z`); at += DAY_MS) {
    const weekday = new Date(at).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return null;
  }
  return best;
}

/**
 * One quote: null for a symbol without a history field or without a basis, else { status, pct, prevClose, basisDate,
 * providerPrev, quote } — `quote` re-based on the history close when the provider's previous close disagrees. `now`
 * (ms) is the caller's clock and is required with a `loadedAt`.
 */
export function verifyUsQuoteChange(q, price, providerPct, { history = [], loadedAt = null, now } = {}) {
  const field = US_INDEX_HISTORY_FIELD[String(q?.symbol || '').toUpperCase()];
  if (!field || !(Number(price) > 0)) return null;
  const loaded = readNumber(loadedAt);
  if (loaded != null && !(readNumber(now) != null && now - loaded <= HISTORY_MAX_AGE_MS)) return null;
  const stamp = q._atomicObservedAt || q.observedAt || q.regularMarketTime;
  const ms = typeof stamp === 'number' ? (stamp < 1e12 ? stamp * 1000 : stamp) : Date.parse(stamp || '');
  const session = Number.isFinite(ms) && ms > 0 ? nyDate(new Date(ms).toISOString()) : null;
  const basis = session ? usHistoryBasis(field, session, history) : null;
  if (!basis) return null;
  const providerPrev = Number(q.regularMarketPreviousClose || q.chartPreviousClose) > 0 ? Number(q.regularMarketPreviousClose || q.chartPreviousClose) : null;
  const agrees = providerPrev != null && Math.abs(providerPrev / basis.close - 1) <= AGREE;
  const hasPct = typeof providerPct === 'number' && Number.isFinite(providerPct);
  const prevClose = agrees ? providerPrev : basis.close;
  const pct = agrees && hasPct ? providerPct : (Number(price) / basis.close - 1) * 100;
  return { status: agrees ? 'agree' : 'corrected', session, basisDate: basis.date, providerPrev, prevClose, pct,
    quote: agrees ? q : { ...q, regularMarketPreviousClose: prevClose, chartPreviousClose: prevClose, regularMarketChange: Number(price) - prevClose, regularMarketChangePercent: pct, changeBasis: 'history-previous-close' } };
}
