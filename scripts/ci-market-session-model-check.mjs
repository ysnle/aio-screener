// v59.59 (formal inventory D1, 2026-11-02): calendar-aware exhaustive sweep of the producer's market-session classifier
// (scripts/build-market-snapshot.mjs deriveMarketSession). ci-market-snapshot-contract-check already walks two ordinary
// weeks with a weekday-only oracle; the 16 session failures behind P2098/P2159/P2162 were each the next calendar boundary.
// This sweep takes its oracle from the exchange calendars (src/domain/market/market-calendar.js) instead: a print is in
// session only between that day's registered open and close, and otherwise the provider holds the latest registered
// completed close. Windows: 11-16..11-30 (KRX 수능 10:00-16:30, US Thanksgiving, the 11-27 13:00 half day),
// 12-21..01-06 (US Christmas Eve half day and holiday, KRX year-end closure, New Year, KRX 01-04 10:00 open) and
// 2027-02-04..02-13 (설날 weekday holidays). Every 10 minutes, for each instrument and each provider hint the producer can
// pass (REGULAR, CLOSED on a completed close, none).
//
// Invariants:
//   S1 live      — a print taken inside the registered session is CURRENT_SESSION or DELAYED_IN_SESSION.
//   S2 completed — the latest registered completed close is MARKET_CLOSED or PREVIOUS_CLOSE_EXPECTED.
//   S3 stuck     — during a session, a feed stuck on the previous open day's intraday print (same minute) is
//                  STALE_UNEXPECTED, never accepted as a close (v59.60 review: a day-agnostic guard accepted it).
// The history gate (ci-history-field-time-contract-check) compares a row with previousValue for S1 labels and with the
// value for S2 labels, so a print in the wrong set blocks refresh-data or writes the wrong close.
//
// KNOWN pins findings this check reported on the current code that are not fixed yet; the gate fails on any mismatch
// outside KNOWN and on a KNOWN entry that no longer occurs (then delete it). Self-check: each VARIANT removes one
// calendar guard and must produce mismatches outside KNOWN. When covered code changes: re-read this header against it,
// update the oracle and variants, run, then `--sync` (commit the covered change first).
// Out of scope: FX/futures/commodities (weekday oracle in scripts/lib/market-session-sweep.mjs), ^VIX/^TNX/^IRX
// extended hours, Tokyo/Hong Kong (no holiday calendar by design), PRE/POST provider hints, quoteQuality.
import * as snapshot from './build-market-snapshot.mjs';
import * as calendar from '../src/domain/market/market-calendar.js';
import { importVariant, verifyCoverage } from './lib/model-check-kit.mjs';

const GATE = 'market-session-model';
const MODULE = 'scripts/build-market-snapshot.mjs';
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };
const IN = new Set(['CURRENT_SESSION', 'DELAYED_IN_SESSION']);
const DONE = new Set(['MARKET_CLOSED', 'PREVIOUS_CLOSE_EXPECTED']);
const MIN = 60000;

const fmt = (timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ZONES = { US: fmt('America/New_York'), KR: fmt('Asia/Seoul') };
function local(market, ms) {
  const p = Object.fromEntries(ZONES[market].formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
// The UTC instant of a wall-clock minute on `date` in the market's zone (DST aware: guess, then correct).
function instant(market, date, minute) {
  let guess = Date.parse(`${date}T00:00:00Z`) + (minute - (market === 'KR' ? 540 : -300)) * MIN;
  for (let i = 0; i < 3; i += 1) {
    const seen = local(market, guess);
    guess -= ((seen.date === date ? seen.minute : seen.minute + (seen.date > date ? 1440 : -1440)) - minute) * MIN;
  }
  return guess;
}
const hhmm = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
function session(market, date) {
  const day = calendar.resolveMarketCalendarSession({ market, date });
  return day.status === 'open' ? { open: hhmm(day.open), close: hhmm(day.close) } : null;
}

// What the provider holds at `nowMs`: a live print `delay` minutes behind inside the session, otherwise the latest
// completed close stamped `stamp` minutes after the registered close. Minutes while the final print is in flight are skipped.
function sample(market, nowMs, { delay, stamp }) {
  const now = local(market, nowMs);
  const today = session(market, now.date);
  if (today && now.minute >= today.open + delay && now.minute < today.close) return { observedMs: nowMs - delay * MIN, live: true, scene: 'session' };
  if (today && now.minute >= today.close && now.minute < today.close + Math.max(delay, stamp) + 1) return null;
  // Before the delayed feed's first print of the day (^RUT 09:30-09:45 ET) it still holds the previous completed close.
  let date = now.date;
  let last = today && now.minute >= today.close ? today : null;
  for (let i = 0; !last && i < 12; i += 1) {
    date = local(market, instant(market, date, 720) - 86400000).date;
    last = session(market, date);
  }
  // The scene names the calendar situation, so a pinned finding masks only the situation it was found in.
  const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay() % 6 !== 0;
  let holidaySince = false;
  for (let day = now.date; day > date; day = local(market, instant(market, day, 720) - 86400000).date) holidaySince ||= weekday(day) && !session(market, day);
  const scene = today && now.minute >= today.open && now.minute < today.open + delay ? 'before-first-delayed-print'
    : (market === 'US' && last.close !== 960) || holidaySince ? 'short-or-holiday' : 'closed';
  return { observedMs: instant(market, date, last.close + stamp), live: false, scene };
}

// The same wall-clock minute on the previous open day, when it was inside that day's session (a feed stuck mid-session).
function stuckPrint(market, nowMs) {
  const now = local(market, nowMs);
  let date = now.date;
  for (let i = 0; i < 12; i += 1) {
    date = local(market, instant(market, date, 720) - 86400000).date;
    const day = session(market, date);
    if (day) return now.minute >= day.open && now.minute < day.close - 5 ? instant(market, date, now.minute) : null;
  }
  return null;
}

const INSTRUMENTS = [
  { id: '^GSPC', market: 'US', delay: 0, stamp: 47 },
  { id: '^IXIC', market: 'US', delay: 0, stamp: 0 },
  { id: '^DJI', market: 'US', delay: 0, stamp: 0 },
  { id: '^RUT', market: 'US', delay: 15, stamp: 30 },
  { id: 'SOXX', market: 'US', delay: 0, stamp: 0 },
  // Both KRX indices arrive 20 minutes late (snapshot 11-02 00:21Z held 00:01Z); the Friday 10-30 close was stamped 20:05 KST.
  { id: '^KS11', market: 'KR', delay: 20, stamp: 0 },
  { id: '^KQ11', market: 'KR', delay: 20, stamp: 275 }
];
const WINDOWS = [['2026-11-16T00:00:00Z', '2026-12-01T00:00:00Z'], ['2026-12-21T00:00:00Z', '2027-01-07T00:00:00Z'], ['2027-02-04T00:00:00Z', '2027-02-14T00:00:00Z']];

// Findings fixed in v59.60 (first run 2026-11-02): SMH ignored the NYSE calendar on half days and holidays; both KRX
// indices (20 minutes late) read the previous close as STALE_UNEXPECTED from the open after a weekend; on 수능 the previous
// day's 15:30 close fell inside the moved 10:00-16:30 window. Add a row here only for a finding that cannot be fixed yet.
const KNOWN = [];
const knownKey = (row) => `${row.id}|${row.invariant}|${row.scene}`;

const VARIANTS = [
  { label: 'KRX 변경 개장 시간 무시', replacements: [
    ["const openMinutes = asia ? asia.open : krToday?.status === 'open' ? hhmm(krToday.open) : isKorea", 'const openMinutes = asia ? asia.open : isKorea'],
    ["const closeMinutes = asia ? asia.close : krToday?.status === 'open' ? hhmm(krToday.close) : isKorea", 'const closeMinutes = asia ? asia.close : isKorea']
  ] },
  // (Ignoring the weekday KRX holiday is no longer observable here: the previous completed close is accepted either way.)
  { label: '관측일의 KRX 시간 대신 오늘 시간 사용', replacements: [["const krObserved = isKorea && observedDate !== dateInTimezone(nowMs, zone) ? resolveMarketCalendarSession({ market: 'KR', date: observedDate }) : krToday;", 'const krObserved = krToday;']] },
  { label: 'KRX 지연 개장 직전 종가 허용 제거', replacements: [['return ageMs <= DAY_MS || observedAtOrAfterLastKrSessionClose(symbol, observedMs, nowMs);', 'return ageMs <= DAY_MS;']] },
  { label: '다른 날 관측을 날짜만으로 직전 종가 취급(v59.60 리뷰 전)', replacements: [["if (observedLocal && isWeekday(observedLocal.weekday) && observedMinute != null && observedMinute >= ownOpen && observedMinute < ownClose) {", "if (observedDate === dateInTimezone(nowMs, zone) && observedLocal && isWeekday(observedLocal.weekday) && observedMinute != null && observedMinute >= ownOpen && observedMinute < ownClose) {"]] },
  { label: 'SOXX 달력 확정 종가 제거', replacements: [["if (symbol === 'SOXX') return 'MARKET_CLOSED';", '']] },
  { label: '개장 직후 지연 지수 종가 분기 제거', replacements: [["if (last.inSession) return 'PREVIOUS_CLOSE_EXPECTED';", '']] }
];

function sweep(derive, stepMinutes = 10) {
  const found = new Map();
  let checked = 0;
  for (const [from, to] of WINDOWS) {
    for (let nowMs = Date.parse(from); nowMs < Date.parse(to); nowMs += stepMinutes * MIN) {
      for (const instrument of INSTRUMENTS) {
        const print = sample(instrument.market, nowMs, instrument);
        if (!print) continue;
        for (const provider of print.live ? ['REGULAR', null] : ['REGULAR', 'CLOSED', null]) {
          checked += 1;
          const got = derive({ instrumentId: instrument.id, observedAt: new Date(print.observedMs).toISOString(), providerSession: provider, now: nowMs });
          if ((print.live ? IN : DONE).has(got)) continue;
          const row = { id: instrument.id, invariant: print.live ? 'S1' : 'S2', scene: print.scene };
          const key = knownKey(row);
          if (!found.has(key)) found.set(key, { ...row, provider: provider || 'none', got, now: new Date(nowMs).toISOString(), observedAt: new Date(print.observedMs).toISOString(), count: 0 });
          found.get(key).count += 1;
        }
        if (print.live) {
          const stuck = stuckPrint(instrument.market, nowMs);
          if (stuck == null) continue;
          checked += 1;
          const got = derive({ instrumentId: instrument.id, observedAt: new Date(stuck).toISOString(), providerSession: 'REGULAR', now: nowMs });
          if (got === 'STALE_UNEXPECTED') continue;
          const key = knownKey({ id: instrument.id, invariant: 'S3', scene: 'session' });
          if (!found.has(key)) found.set(key, { id: instrument.id, invariant: 'S3', scene: 'session', provider: 'REGULAR', got, now: new Date(nowMs).toISOString(), observedAt: new Date(stuck).toISOString(), count: 0 });
          found.get(key).count += 1;
        }
      }
    }
  }
  return { checked, found };
}

const current = sweep(snapshot.deriveMarketSession);
if (current.checked < 100000) fail(`only ${current.checked} prints checked — the windows or the calendar shrank`);
const known = new Set(KNOWN.map(knownKey));
const unexpected = [...current.found.values()].filter((row) => !known.has(knownKey(row)));
if (unexpected.length) fail(`prints classified outside the calendar session (shortest first example each):\n  ${unexpected.map((row) => JSON.stringify(row)).join('\n  ')}`);
const gone = KNOWN.filter((row) => !current.found.has(knownKey(row)));
if (gone.length) fail(`KNOWN finding no longer occurs — delete it from KNOWN: ${gone.map(knownKey).join(', ')}`);

const variants = [];
for (const variant of VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  const result = sweep(mod.deriveMarketSession, 30); // 30-minute steps still land on 09:30 ET and the 10:00 KST moved open
  const broke = [...result.found.values()].filter((row) => !known.has(knownKey(row)));
  if (!broke.length) fail(`variant "${variant.label}" broke nothing: the sweep lost the power to fail`);
  variants.push({ label: variant.label, broke: [...new Set(broke.map((row) => `${row.invariant}:${row.id}`))] });
}

const exposeScheduled = await importVariant(MODULE, [['function scheduledSession(', 'export function scheduledSession(']], 'coverage');
const drift = verifyCoverage(GATE, [
  { module: MODULE, name: 'deriveMarketSession', fn: snapshot.deriveMarketSession },
  { module: MODULE, name: 'scheduledSession', fn: exposeScheduled.scheduledSession },
  { module: 'src/domain/market/market-calendar.js', name: 'isLatestUsRegularClose', fn: calendar.isLatestUsRegularClose },
  { module: 'src/domain/market/market-calendar.js', name: 'latestCompletedUsSession', fn: calendar.latestCompletedUsSession },
  { module: 'src/domain/market/market-calendar.js', name: 'latestCompletedKrSession', fn: calendar.latestCompletedKrSession }
], { sync: process.argv.includes('--sync') });
if (drift.length) fail(`covered code changed — re-read the oracle in this file's header against it, update it, then rerun with --sync:\n  ${drift.join('\n  ')}`);

console.log(JSON.stringify({ ok: true, gate: GATE, checked: current.checked, known: [...current.found.values()].map(({ id, invariant, scene, count }) => ({ id, invariant, scene, count })), variants }));
