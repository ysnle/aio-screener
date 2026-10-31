// v59.49: exhaustive time sweep for the producer's market-session classifier (scripts/build-market-snapshot.mjs).
// The history gate (ci-history-field-time-contract-check.mjs) compares the history row with the snapshot's value when
// the session is a completed close and with previousValue when it is in session, so every print must land in the right
// one of those two sets. Example fixtures caught one boundary at a time (VIX GTH, TNX pre-open, Friday 17:00 ET); the
// live failures that remained were the next boundaries (RUT's 16:30 close stamp after the open, 9 runs; the Sunday
// 17:00/18:00 ET reopen, 9 runs). This walks two weeks — one with the 11-01 DST change — every 10 minutes and derives,
// from the venue schedule alone, which print a provider holds and which set it belongs to.
import { resolveMarketCalendarSession } from '../../src/domain/market/market-calendar.js';

const IN_SESSION = new Set(['CURRENT_SESSION', 'DELAYED_IN_SESSION']);
const COMPLETED = new Set(['MARKET_CLOSED', 'PREVIOUS_CLOSE_EXPECTED']);
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const MIN = 60000;

function ny(ms) {
  const p = Object.fromEntries(NY.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { weekday: p.weekday, date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
// The UTC instant of a New York wall-clock minute on `date` (DST aware: start at UTC-5 and correct once).
function nyInstant(date, minute) {
  let guess = Date.parse(`${date}T00:00:00Z`) + (minute + 300) * MIN;
  const seen = ny(guess);
  const drift = (seen.date === date ? seen.minute : seen.minute + (seen.date > date ? 1440 : -1440)) - minute;
  return guess - drift * MIN;
}
const usOpen = (date) => resolveMarketCalendarSession({ market: 'US', date }).status === 'open';

// Cash index: regular 09:30-16:00 ET, a feed `delay` minutes behind, the final print stamped `stamp` minutes after 16:00.
function cashCase(nowMs, { delay, stamp }) {
  const now = ny(nowMs);
  const open = 570;
  const close = 960;
  if (usOpen(now.date) && now.minute >= open + delay && now.minute < close) return { observedMs: nowMs - delay * MIN, expect: IN_SESSION };
  if (usOpen(now.date) && now.minute >= close && now.minute < close + Math.max(delay, stamp) + 1) return null; // final print in flight
  // Out of session: the latest final print, today's when the close has passed, otherwise the previous open day's.
  let date = now.date;
  if (!(usOpen(date) && now.minute >= close)) {
    for (let i = 1; i <= 10; i += 1) {
      date = ny(nyInstant(now.date, 720) - i * 86400000).date;
      if (usOpen(date)) break;
    }
  }
  return { observedMs: nyInstant(date, close + stamp), expect: COMPLETED };
}

// FX and CME futures: closed Fri 17:00 ET to the Sunday reopen; a Mon-Thu 17:00-18:00 ET break is skipped (not a weekly close).
function continuousCase(nowMs, { reopen }) {
  const now = ny(nowMs);
  const fridayClose = 17 * 60;
  const weekend = (now.weekday === 'Fri' && now.minute >= fridayClose) || now.weekday === 'Sat' || (now.weekday === 'Sun' && now.minute < reopen);
  if (weekend) {
    let date = now.date;
    for (let i = 0; i <= 3 && ny(nyInstant(date, 720)).weekday !== 'Fri'; i += 1) date = ny(nyInstant(now.date, 720) - (i + 1) * 86400000).date;
    return { observedMs: nyInstant(date, fridayClose - 1), expect: COMPLETED };
  }
  if (now.weekday !== 'Sun' && now.minute >= 17 * 60 && now.minute < 18 * 60) return null;
  if (now.weekday === 'Sun' && now.minute < reopen + 1) return null; // first print in flight
  return { observedMs: nowMs - MIN, expect: IN_SESSION };
}

export const SWEEP_INSTRUMENTS = Object.freeze([
  { id: '^GSPC', kind: 'cash', delay: 0, stamp: 47 },
  { id: '^IXIC', kind: 'cash', delay: 0, stamp: 0 },
  { id: '^DJI', kind: 'cash', delay: 0, stamp: 0 },
  { id: '^RUT', kind: 'cash', delay: 15, stamp: 30 },
  { id: 'KRW=X', kind: 'continuous', reopen: 17 * 60 },
  { id: 'CL=F', kind: 'continuous', reopen: 18 * 60 },
  { id: 'GC=F', kind: 'continuous', reopen: 18 * 60 },
  { id: 'DX-Y.NYB', kind: 'continuous', reopen: 18 * 60 }
]);

/** Sweep [startIso, endIso) every `stepMinutes`; returns the mismatches (instrument, now, print, got, expected set). */
export function sweepMarketSessions(deriveMarketSession, { startIso = '2026-10-24T00:00:00Z', endIso = '2026-11-08T00:00:00Z', stepMinutes = 10, instruments = SWEEP_INSTRUMENTS } = {}) {
  const mismatches = [];
  let checked = 0;
  for (let nowMs = Date.parse(startIso); nowMs < Date.parse(endIso); nowMs += stepMinutes * MIN) {
    for (const instrument of instruments) {
      const sample = instrument.kind === 'cash' ? cashCase(nowMs, instrument) : continuousCase(nowMs, instrument);
      if (!sample) continue;
      checked += 1;
      const got = deriveMarketSession({ instrumentId: instrument.id, observedAt: new Date(sample.observedMs).toISOString(), providerSession: 'REGULAR', now: nowMs });
      if (!sample.expect.has(got)) mismatches.push({ id: instrument.id, now: new Date(nowMs).toISOString(), observedAt: new Date(sample.observedMs).toISOString(), got, expected: [...sample.expect].join('|') });
    }
  }
  return { checked, mismatches };
}
