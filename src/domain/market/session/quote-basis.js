// The previous close a quote's daily change is measured from, so a shown value and its shown change come from one
// session. Korean listings: the previous completed KRX close in the producer history (indices) or the reconciled
// screener change of that same session (stocks); with neither, the change is withheld. US indices: the history close
// before the quote's New York session when only weekend days lie between; otherwise the provider's pair stays.
import { isoDay } from '../../shared/session-date.js';
import { readNumber } from '../../shared/number.js';
import { sessionDateInMarket } from './session-time.js';
import { countOpenSessionsBetween } from './market-calendar.js';
import { isProvisionalHistoryValue } from './history-session.js';

export const KR_INDEX_HISTORY_FIELD = Object.freeze({ '^KS11': 'kospi', '^KQ11': 'kosdaq' });
export const US_INDEX_HISTORY_FIELD = Object.freeze({ '^VIX': 'vix', '^GSPC': 'spx', '^IXIC': 'nasdaq', '^NDX': 'ndx', '^DJI': 'dow', '^RUT': 'rut' });
const KR_STOCK = /\.K[SQ]$/;
const DAY_MS = 86400000;
// A history loaded before the previous session closed (a tab kept open overnight) carries an older close under a
// current-looking row date, so only a history loaded within six hours is a basis.
const HISTORY_MAX_AGE_MS = 6 * 3600000;
const INDEX_AGREE = 0.0005;
const STOCK_AGREE_PCT = 0.15;

/** The calendar date in `market` of a timestamp (ISO text, epoch ms or epoch seconds), else null. */
export function marketDay(stamp, market) {
  const ms = typeof stamp === 'number' ? (stamp > 0 && stamp < 1e12 ? stamp * 1000 : stamp) : Date.parse(stamp || '');
  return Number.isFinite(ms) && ms > 0 ? sessionDateInMarket(new Date(ms).toISOString(), market) : null;
}

const metaOf = (row, field) => row?.fieldMeta?.[field] || {};
const isCurrentSession = (meta) => meta.observationRelation === 'current-session' || meta.valueBasis === 'current-session';
const historyFresh = (loadedAt, now) => { const at = readNumber(loadedAt); return at == null || !(now - at > HISTORY_MAX_AGE_MS); };
const quoteStamp = (q) => q._atomicObservedAt || q.observedAt || q.regularMarketTime;
const providerPrevOf = (q) => { const prev = Number(q.regularMarketPreviousClose || q.chartPreviousClose); return prev > 0 ? prev : null; };
const hasNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Latest history close of a KR `field` in a KRX session before `session`; the history must reach the day before it, so
 *  a missing session is a closed market day and not a producer run still to come. */
export function krHistoryBasis(field, session, history, { loadedAt = null, now = NaN } = {}) {
  if (!field || !isoDay(session)) return null;
  let latestRow = null;
  let best = null;
  for (const row of Array.isArray(history) ? history : []) {
    if (!row) continue;
    const date = isoDay(row.date);
    if (date && (!latestRow || date > latestRow)) latestRow = date;
    const value = Number(row[field]);
    const meta = metaOf(row, field);
    if (!(value > 0) || isCurrentSession(meta)) continue;
    const day = marketDay(meta.observedAt, 'KR') || date;
    if (day && day < session && (!best || day >= best.date)) best = { date: day, close: value };
  }
  const dayBefore = new Date(Date.parse(`${session}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  if (!best || !latestRow || latestRow < dayBefore || !historyFresh(loadedAt, now)) return null;
  return best;
}

/** Latest completed KRX close of an index with its own one-session change, both from the history. */
export function krIndexCloseRead(field, history, clock = {}) {
  const rows = Array.isArray(history) ? history : [];
  let last = null;
  for (const row of rows) {
    const value = Number(row?.[field]);
    if (!(value > 0)) continue;
    const meta = metaOf(row, field);
    if (isCurrentSession(meta)) continue;
    const day = marketDay(meta.observedAt, 'KR') || isoDay(row.date);
    if (day && (!last || day >= last.date)) last = { date: day, close: value };
  }
  if (!last) return null;
  const prev = krHistoryBasis(field, last.date, rows, clock);
  return { field, date: last.date, close: last.close, prevDate: prev?.date || null, prevClose: prev?.close || null,
    pct: prev?.close > 0 ? (last.close / prev.close - 1) * 100 : null };
}

/** Verified one-session change of a KR symbol: index from the history, stock from the screener change of that same
 *  session (`ctx.screenerChange(symbol)` → { pct, sessionDate }). null when no verified basis exists. */
export function krVerifiedDayChange(symbol, session, close, ctx = {}) {
  const sym = String(symbol || '').toUpperCase();
  const field = KR_INDEX_HISTORY_FIELD[sym];
  const px = Number(close);
  if (field) {
    const ref = krHistoryBasis(field, session, ctx.history, ctx);
    return ref && px > 0 ? { pct: (px / ref.close - 1) * 100, prevClose: ref.close, basisDate: ref.date, basis: 'krx-history-previous-close' } : null;
  }
  if (!KR_STOCK.test(sym)) return null;
  const change = ctx.screenerChange?.(sym);
  if (!change || change.sessionDate !== session || !hasNumber(change.pct)) return null;
  return { pct: change.pct, prevClose: px > 0 ? px / (1 + change.pct / 100) : null, basisDate: session, basis: 'screener-reconciled-session-change' };
}

/** One KR quote: null for a non-KR or KRX-origin (Naver) quote, else the change to publish and its basis. A stock whose
 *  session the screener has not closed keeps the provider's previous close only while `ctx.health` says the KRX indices
 *  of that session agree with the history (the off-by-one is a venue calendar fault). */
export function verifyKrQuoteChange(q, price, providerPct, ctx = {}) {
  const sym = String(q?.symbol || '').toUpperCase();
  const isIndex = !!KR_INDEX_HISTORY_FIELD[sym];
  if (!isIndex && !KR_STOCK.test(sym)) return null;
  if (/^live:naver/.test(String(q._source || ''))) return null;
  const session = marketDay(quoteStamp(q), 'KR');
  const providerPrev = providerPrevOf(q);
  const hasProviderPct = hasNumber(providerPct);
  const out = { symbol: sym, session, providerPrev, providerPct: hasProviderPct ? providerPct : null,
    pct: null, prevClose: null, basis: 'kr-previous-close-unverified', basisDate: null, status: 'unverified' };
  if (!session) return out;
  const verified = krVerifiedDayChange(sym, session, price, ctx);
  if (verified) {
    const agrees = isIndex
      ? providerPrev > 0 && Math.abs(providerPrev / verified.prevClose - 1) <= INDEX_AGREE
      : hasProviderPct && Math.abs(providerPct - verified.pct) <= STOCK_AGREE_PCT;
    return { ...out, status: agrees ? 'agree' : 'corrected', basis: verified.basis, basisDate: verified.basisDate,
      pct: agrees && hasProviderPct ? providerPct : verified.pct, prevClose: agrees && providerPrev ? providerPrev : verified.prevClose };
  }
  const health = ctx.health;
  if (!isIndex && health && health.session === session && health.status === 'agree' && hasProviderPct && providerPrev) {
    return { ...out, pct: providerPct, prevClose: providerPrev, basis: 'provider-previous-close-index-checked', basisDate: health.basisDate || null, status: 'agree' };
  }
  return out;
}

/** Latest completed close of a US `field` before `session` when no open session lies between them, else null (a history
 *  that has not reached the previous trading day). */
export function usHistoryBasis(field, session, history) {
  if (!field || !isoDay(session)) return null;
  let best = null;
  for (const row of Array.isArray(history) ? history : []) {
    const value = Number(row?.[field]);
    if (!(value > 0)) continue;
    const meta = metaOf(row, field);
    if (meta.observationRelation === 'carried-forward' || isCurrentSession(meta) || isProvisionalHistoryValue(meta)) continue;
    const day = isoDay(meta.sessionDate) || marketDay(meta.observedAt, 'US');
    if (day && day < session && (!best || day > best.date)) best = { date: day, close: value };
  }
  if (!best) return null;
  // The session right after it on the exchange calendar: a weekend or a holiday between them is no missed session.
  return countOpenSessionsBetween(best.date, session, 'US') === 1 ? best : null;
}

/** One US index quote: null without a history field or a basis (the provider's pair stays), else the change to publish
 *  on the history close before the quote's own session. */
export function verifyUsQuoteChange(q, price, providerPct, { history = [], loadedAt = null, now = NaN } = {}) {
  const symbol = String(q?.symbol || '').toUpperCase();
  const field = US_INDEX_HISTORY_FIELD[symbol];
  if (!field || !(Number(price) > 0) || !historyFresh(loadedAt, now)) return null;
  const session = marketDay(quoteStamp(q), 'US');
  const basis = session ? usHistoryBasis(field, session, history) : null;
  if (!basis) return null;
  const providerPrev = providerPrevOf(q);
  const agrees = providerPrev != null && Math.abs(providerPrev / basis.close - 1) <= INDEX_AGREE;
  return { symbol, session, basisDate: basis.date, providerPrev, status: agrees ? 'agree' : 'corrected', basis: 'history-previous-close',
    prevClose: agrees ? providerPrev : basis.close, pct: agrees && hasNumber(providerPct) ? providerPct : (Number(price) / basis.close - 1) * 100 };
}
