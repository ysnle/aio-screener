// The one rule for how often a refresh task runs by the market clock. src/app/refresh-scheduler.js reads it for its
// timers, for a tab returning to view, for page entry and for its stale report; the 새로고침 button and other explicit
// requests do not ask it and run at any hour. The data-plane Worker (worker/data-plane.js quotePublishDue) reads the same
// 'quotes' interval for its /quotes publication, so browser polling and the fast plane share one clock. A trading day in a year the calendar does not register counts as a trading day, so an
// unregistered year keeps refreshing instead of going quiet.
import { dateInTimezone, nyParts, resolveMarketCalendarSession } from '../domain/market/session/market-calendar.js';

export const CLOSED_QUOTE_INTERVAL_MS = 30 * 60 * 1000;
const KR_AFTER_CLOSE_MIN = 30; // the closing auction and the published close settle within 30 minutes of 15:30
const KST_OFFSET_MS = 9 * 3600000;
const minuteOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Which sessions are open at `nowMs`: US from the 04:00 ET pre-market to the 20:00 ET after-hours close, KR regular hours. */
export function openSessions(nowMs = Date.now()) {
  const ny = nyParts(nowMs);
  const usDay = resolveMarketCalendarSession({ market: 'US', date: ny.date });
  const krDay = resolveMarketCalendarSession({ market: 'KR', date: dateInTimezone(nowMs, 'Asia/Seoul') });
  const krMinute = Math.floor(((nowMs + KST_OFFSET_MS) % 86400000) / 60000);
  const krOpen = minuteOf(krDay.open || '09:00');
  const krClose = minuteOf(krDay.close || '15:30');
  const krDayOpen = krDay.status !== 'closed';
  return Object.freeze({
    us: usDay.status !== 'closed' && ny.minute >= 240 && ny.minute < 1200,
    kr: krDayOpen && krMinute >= krOpen && krMinute < krClose,
    krAfterClose: krDayOpen && krMinute >= krClose && krMinute < krClose + KR_AFTER_CLOSE_MIN
  });
}

/**
 * How old a task's last run may get at `nowMs` before it runs again: its own interval while its session is open. With
 * every market closed quotes stretch to 30 minutes (crypto, late prints); the KR batch and the market snapshot re-read
 * have nothing new to fetch, so one run lasts until their session opens (Infinity). Every other task keeps its interval.
 * The scheduler reads this one number for its timers, for page entry and for what it reports as stale.
 */
export function refreshIntervalMs(key, baseMs, nowMs = Date.now()) {
  if (key !== 'quotes' && key !== 'krDynamic' && key !== 'marketSnapshot') return baseMs;
  const open = openSessions(nowMs);
  if (key === 'krDynamic') return open.kr || open.krAfterClose ? baseMs : Infinity;
  if (open.us || open.kr) return baseMs;
  return key === 'quotes' ? Math.max(baseMs, CLOSED_QUOTE_INTERVAL_MS) : Infinity;
}
