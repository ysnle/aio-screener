// The one rule for which price basis the chat may state for a listing right now. The product is close-based:
// once a listing's regular session has closed, a quote observed at that close is the confirmed close and is stated as
// "YYYY-MM-DD 종가" — it needs no two-minute age and no second source, because nothing newer can exist. Only a claim
// about an intraday price, while the session is open, needs a quote under two minutes old that a second source
// confirmed. A real conflict between sources, or a defective quote, blocks either way. A Korean listing is judged on
// the KRX session, every other listing on the NYSE session.
import { currentCalendarContext, dateInTimezone, latestCompletedSession } from '../../domain/market/session/market-calendar.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { readNumber, signedText } from '../../domain/shared/number.js';

export const QUOTE_BASIS_VERSION = 'chat-quote-basis.v1';
export const INTRADAY_MAX_AGE_MS = 2 * 60 * 1000;
// A closing quote is stamped at the bell: the last trade up to five minutes before it, or the closing print the
// provider publishes up to an hour after it (KRX closing auction, delayed feeds). A later stamp is not read as the close.
const CLOSE_STAMP_BEFORE_MS = 5 * 60 * 1000;
const CLOSE_STAMP_AFTER_MS = 60 * 60 * 1000;

const MARKETS = Object.freeze({
  US: Object.freeze({ timezone: 'America/New_York', zone: '뉴욕', name: '미국' }),
  KR: Object.freeze({ timezone: 'Asia/Seoul', zone: '한국', name: '한국' })
});
const MINUTE_FORMATTERS = new Map();
function minuteIn(ms, timezone) {
  let formatter = MINUTE_FORMATTERS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    MINUTE_FORMATTERS.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}
const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minuteOf = (hhmm) => Number(String(hhmm).slice(0, 2)) * 60 + Number(String(hhmm).slice(3, 5));

export const quoteMarket = (symbol) => (/\.K[SQ]$/i.test(String(symbol || '')) ? 'KR' : 'US');

/** true while the listing's regular session is trading, false when it is not, null for an unregistered calendar year. */
export function regularSessionOpen(market, nowMs) {
  const context = currentCalendarContext(market, nowMs);
  if (!context || context.session.status === 'unknown') return null;
  if (context.session.status !== 'open') return false;
  const minute = minuteIn(nowMs, MARKETS[market].timezone);
  return minute >= minuteOf(context.session.open) && minute < minuteOf(context.session.close);
}

// The truth gate (js/aio-core.js AIO_DATA_TRUTH_GATE) mixes two questions in one issue list. Age is answered here by
// the session rule, a cross-source mismatch is a conflict, and every other issue (price range, % move, source) is a defect.
const AGE_ISSUE = /^(stale_quote|missing_timestamp)/;
const CONFLICT_ISSUE = /^cross_source_mismatch/;
function truthFindings(truth) {
  const issues = Array.isArray(truth?.issues) ? truth.issues.map(String) : [];
  const cross = truth?.crossSource || null;
  const conflict = cross?.status === 'mismatch' || (Array.isArray(cross?.blockingMismatches) && cross.blockingMismatches.length > 0) || issues.some((issue) => CONFLICT_ISSUE.test(issue));
  return { conflict, defects: issues.filter((issue) => !AGE_ISSUE.test(issue) && !CONFLICT_ISSUE.test(issue)) };
}

/**
 * The basis decision for one listing.
 * @param {{ symbol: string, price?: number|null, observedAt?: string|null, integrityBlockers?: string[], truth?: object|null, now?: number }} input
 *   integrityBlockers: the quote evidence row's own defects (envelope, source, currency, unit).
 * @returns {{ schemaVersion: string, symbol: string, market: 'US'|'KR', basis: 'close'|'intraday'|'unavailable',
 *   status: 'usable'|'refresh_required'|'blocked', sessionDate: string|null, observedAt: string|null, ageMs: number|null,
 *   label: string, reason: string|null, needsLookup: boolean, needsCrossCheck: boolean }}
 */
export function decideQuoteBasis({ symbol, price = null, observedAt = null, integrityBlockers = [], truth = null, now = Date.now() } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  const market = quoteMarket(sym);
  const { timezone, zone } = MARKETS[market];
  const nowMs = Number(now);
  const observedMs = Date.parse(observedAt || '');
  const ageMs = Number.isFinite(observedMs) && Number.isFinite(nowMs) ? Math.max(0, nowMs - observedMs) : null;
  const result = (fields) => Object.freeze({ schemaVersion: QUOTE_BASIS_VERSION, symbol: sym, market, sessionDate: null, observedAt: Number.isFinite(observedMs) ? new Date(observedMs).toISOString() : null, ageMs, label: '', reason: null, needsLookup: false, needsCrossCheck: false, ...fields });
  if (!(Number(price) > 0)) return result({ basis: 'unavailable', status: 'refresh_required', reason: 'no-quote', needsLookup: true });
  const { conflict, defects } = truthFindings(truth);
  if (conflict) return result({ basis: 'unavailable', status: 'blocked', reason: 'source-conflict', needsLookup: true, needsCrossCheck: true });
  const integrity = (Array.isArray(integrityBlockers) ? integrityBlockers : []).map(String);
  if (integrity.length || defects.length) return result({ basis: 'unavailable', status: 'blocked', reason: `quote-defect:${integrity[0] || defects[0]}`, needsLookup: true });
  const open = Number.isFinite(nowMs) ? regularSessionOpen(market, nowMs) : null;
  const last = Number.isFinite(nowMs) ? latestCompletedSession(market, nowMs) : null;
  // A KRX close is final 30 minutes after the bell (closing auction and publication); until then it is still intraday.
  const closeFinal = !!last && open === false && last.eodConfirmed !== false;
  if (closeFinal && Number.isFinite(observedMs)) {
    const atClose = dateInTimezone(observedMs, timezone) === last.date && observedMs >= last.closeMs - CLOSE_STAMP_BEFORE_MS && observedMs <= last.closeMs + CLOSE_STAMP_AFTER_MS;
    if (atClose) return result({ basis: 'close', status: 'usable', sessionDate: last.date, label: `${last.date} 종가` });
    return result({ basis: 'unavailable', status: 'refresh_required', sessionDate: last.date, reason: observedMs < last.closeMs - CLOSE_STAMP_BEFORE_MS ? 'quote-before-latest-close' : 'quote-not-at-close', needsLookup: true });
  }
  // Open session, the KRX closing window or an unregistered calendar year: the intraday rule.
  const fresh = ageMs != null && ageMs <= INTRADAY_MAX_AGE_MS;
  const confirmed = /^(verified|current)$/i.test(String(truth?.status || '')) && truth?.decisionUse === true;
  const label = Number.isFinite(observedMs) ? `${dateInTimezone(observedMs, timezone)} ${clock(minuteIn(observedMs, timezone))} ${zone} 시각 장중` : '';
  if (fresh && confirmed) return result({ basis: 'intraday', status: 'usable', label });
  return result({ basis: 'intraday', status: 'refresh_required', label, reason: !fresh ? 'intraday-quote-old' : 'intraday-single-source', needsLookup: !fresh, needsCrossCheck: !confirmed });
}

const REASON_TEXT = Object.freeze({
  'no-quote': '시세 없음',
  'source-conflict': '출처 간 가격 불일치',
  'quote-before-latest-close': '가장 최근 종가보다 이전 관측',
  'quote-not-at-close': '관측 시각이 종가 시각과 다름',
  'intraday-quote-old': '장중 관측이 2분보다 오래됨',
  'intraday-single-source': '장중 시세를 두 번째 출처로 확인하지 못함'
});

/** The preflight line for one quote evidence row (js/aio-data.js getChatAnswerFreshnessAudit row). */
export function quoteBasisLine(quote = {}) {
  const sym = String(quote.ticker || quote.symbol || '').toUpperCase();
  const market = quoteMarket(sym);
  const currency = String(quote.currency || '').toUpperCase();
  const value = readNumber(quote.value);
  const price = value != null && value > 0 ? formatScreenerPrice(value, currency === 'UNKNOWN' ? null : currency) : '';
  const pct = readNumber(quote.pct);
  const change = pct != null ? `, 전일 대비 ${signedText(pct, 2, '%')}` : '';
  const reason = String(quote.basisReason || '');
  const why = REASON_TEXT[reason] || (reason.startsWith('quote-defect:') ? `시세 결함(${reason.slice(13)})` : reason || '기준 판정 없음');
  if (quote.basis === 'close' && quote.basisStatus === 'usable') {
    return `${sym}: 종가 기준 사용 가능 — ${quote.basisLabel} ${price}${change} (${MARKETS[market].name} 정규장 마감 뒤 확정 종가, 장중 시세 아님)`;
  }
  if (quote.basis === 'intraday' && quote.basisStatus === 'usable') return `${sym}: 장중 시세 사용 가능 — ${price}${change} (${quote.basisLabel} 관측)`;
  if (quote.basisStatus === 'blocked') return `${sym}: 사용 불가 — ${why}`;
  return `${sym}: ${quote.basis === 'intraday' ? '장중 시세 확인 안 됨' : '가격 기준 확인 안 됨'} — ${why}`;
}
