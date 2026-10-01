// P1328/R670: the market-environment score is a reference description, so it is computed
// on the latest completed US regular session — "직전 미국장 종가 기준" — instead of being
// blank whenever the US market is closed (i.e. every Korean daytime session).
//
// P1345: the reference score always describes that completed close, including during
// the next session. Fetch time and a newer intraday price are not closing-price evidence.
//   - quote inputs require a closing observation on the basis date;
//   - daily published inputs (F&G, put/call, HY spread, breadth): dated no earlier than the
//     session before it, because these series publish after the close with a one-day lag.
// Anything older, undated or non-finite stays out, so the score never mixes in stale days.
import { latestCompletedUsSession, nyParts } from '../../ai/time/market-session.js';
import { isValidMarketDate } from '../market/session-time.js';

export const CLOSE_BASIS_QUOTE_KEYS = Object.freeze(['vix', 'vvix', 'dxy', 'tnx', 'oilPrice', 'spxPrice']);
export const CLOSE_BASIS_DAILY_KEYS = Object.freeze(['fg', 'pcr', 'hyBp', 'breadth200']);

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.000)?)?Z?)?$/;

/** The basis every close-basis input is judged against, or null when the calendar is unknown. */
export function resolveCloseBasis(nowMs = Date.now()) {
  return latestCompletedUsSession(nowMs);
}

/**
 * @returns {{ ok: boolean, asOf: string|null, reason: string }}
 */
export function evaluateCloseBasisInput({ key, value, observedAt, session, valueBasis, basis, nowMs = Date.now() } = {}) {
  if (!basis) return { ok: false, asOf: null, reason: 'calendar-unknown' };
  if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) || String(value).trim() === '') return { ok: false, asOf: null, reason: 'value-missing' };
  const raw = observedAt == null ? '' : String(observedAt).trim();
  if (!isValidMarketDate(raw.slice(0, 10))) return { ok: false, asOf: null, reason: 'observed-at-invalid-date' };
  const dateOnly = raw.match(DATE_ONLY);
  const observedMs = dateOnly ? Date.parse(`${dateOnly[1]}T12:00:00Z`) : Date.parse(raw);
  if (!raw || !Number.isFinite(observedMs)) return { ok: false, asOf: null, reason: 'observed-at-missing' };
  if (observedMs > nowMs + 60000) return { ok: false, asOf: null, reason: 'observed-in-future' };
  const asOf = dateOnly ? dateOnly[1] : nyParts(observedMs).date;
  if (CLOSE_BASIS_QUOTE_KEYS.includes(key)) {
    const completed = valueBasis === 'latest-completed-close' || valueBasis === 'regular-session-close';
    if (dateOnly) {
      const ok = asOf === basis.date && completed
        && (!session || ['MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED'].includes(session));
      return { ok, asOf, reason: ok ? 'session-close' : 'close-not-proven' };
    }
    const windowMs = (key === 'tnx' ? 65 : 5) * 60000;
    const nearClose = observedMs <= basis.closeMs + 5 * 60000;
    const closedSession = ['MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED'].includes(session);
    const ok = asOf === basis.date && observedMs >= basis.closeMs - windowMs
      && (completed || (closedSession && valueBasis === 'provider-current-value'))
      && (nearClose || (closedSession && (completed || valueBasis === 'provider-current-value')))
      && (!session || closedSession) && valueBasis !== 'previous-completed-close';
    return { ok, asOf, reason: ok ? 'session-close' : 'close-not-proven' };
  }
  if (CLOSE_BASIS_DAILY_KEYS.includes(key)) {
    const ok = asOf >= basis.previousDate && asOf <= basis.date;
    return { ok, asOf, reason: ok ? 'latest-publication' : 'older-than-basis' };
  }
  return { ok: false, asOf, reason: 'not-a-close-basis-input' };
}

/** Korean label for the basis, e.g. "9/28 미국 정규장 종가 기준". */
export function describeCloseBasis(basis) {
  if (!basis?.date) return '';
  const [, month, day] = basis.date.split('-').map(Number);
  return `${month}/${day} 미국 정규장 종가 기준`;
}

// P1345: inspect observation provenance before selecting, without mutating live quotes.
export function selectCloseBasisObservation({ key, candidates = [], basis, nowMs } = {}) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const session = candidate.session || candidate.marketState || candidate.observedMarketSession;
    const verdict = evaluateCloseBasisInput({ ...candidate, session, key, basis, nowMs });
    if (verdict.ok) return Object.freeze({ ...candidate, value: Number(candidate.value), session, asOf: verdict.asOf,
      status: 'session_close', allowedUse: 'close-basis', allowedUseCeiling: 'reference' });
  }
  return null;
}
