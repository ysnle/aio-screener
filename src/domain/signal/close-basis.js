// P1328/R670: the market-environment score is a reference description, so it is computed
// on the latest completed US regular session — "직전 미국장 종가 기준" — instead of being
// blank whenever the US market is closed (i.e. every Korean daytime session).
//
// Decision-grade evidence keeps priority. A value that is not decision-grade may still
// enter the reference score only when its observation is at least as recent as the basis:
//   - quote inputs (index, volatility, rates, dollar, oil): observed at or after the latest
//     completed regular close (Treasury yields end ~15:00 ET, so they get a 65-minute window);
//   - daily published inputs (F&G, put/call, HY spread, breadth): dated no earlier than the
//     session before it, because these series publish after the close with a one-day lag.
// Anything older, undated or non-finite stays out, so the score never mixes in stale days.
import { latestCompletedUsSession } from '../../ai/time/market-session.js';

export const CLOSE_BASIS_QUOTE_KEYS = Object.freeze(['vix', 'vvix', 'dxy', 'tnx', 'oilPrice', 'spxPrice']);
export const CLOSE_BASIS_DAILY_KEYS = Object.freeze(['fg', 'pcr', 'hyBp', 'breadth200']);

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.000)?)?Z?)?$/;

function nyDate(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** The basis every close-basis input is judged against, or null when the calendar is unknown. */
export function resolveCloseBasis(nowMs = Date.now()) {
  const session = latestCompletedUsSession(nowMs);
  return session;
}

/**
 * @returns {{ ok: boolean, asOf: string|null, reason: string }}
 */
export function evaluateCloseBasisInput({ key, value, observedAt, basis, nowMs = Date.now() } = {}) {
  if (!basis) return { ok: false, asOf: null, reason: 'calendar-unknown' };
  if (!Number.isFinite(Number(value)) || value === null || value === '') return { ok: false, asOf: null, reason: 'value-missing' };
  const raw = observedAt == null ? '' : String(observedAt).trim();
  const dateOnly = raw.match(DATE_ONLY);
  const observedMs = dateOnly ? Date.parse(`${dateOnly[1]}T12:00:00Z`) : Date.parse(raw);
  if (!raw || !Number.isFinite(observedMs)) return { ok: false, asOf: null, reason: 'observed-at-missing' };
  if (observedMs > nowMs + 60000) return { ok: false, asOf: null, reason: 'observed-in-future' };
  const asOf = dateOnly ? dateOnly[1] : nyDate(observedMs);
  if (CLOSE_BASIS_QUOTE_KEYS.includes(key)) {
    if (dateOnly) return { ok: asOf >= basis.date, asOf, reason: asOf >= basis.date ? 'session-close' : 'older-than-basis' };
    const windowMs = (key === 'tnx' ? 65 : 5) * 60000;
    const ok = observedMs >= basis.closeMs - windowMs;
    return { ok, asOf, reason: ok ? 'session-close' : 'older-than-basis' };
  }
  if (CLOSE_BASIS_DAILY_KEYS.includes(key)) {
    const ok = asOf >= basis.previousDate;
    return { ok, asOf, reason: ok ? 'latest-publication' : 'older-than-basis' };
  }
  return { ok: false, asOf, reason: 'not-a-close-basis-input' };
}

/** Korean label for the basis, e.g. "9/28 미국 정규장 종가 기준". */
export function describeCloseBasis(basis) {
  if (!basis?.date) return '';
  const [, month, day] = basis.date.split('-').map(Number);
  return basis.inSession ? `미국 장중 · ${month}/${day} 종가 이후 값 기준` : `${month}/${day} 미국 정규장 종가 기준`;
}
