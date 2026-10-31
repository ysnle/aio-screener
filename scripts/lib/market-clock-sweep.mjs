// scripts/lib/market-clock-sweep.mjs — v59.50 (recurrence audit 2026-10-31)
//
// The time-boundary class (P2159 weekend chip, P2162 RUT close and Sunday reopen, P16-TIME-01 special open) was tested
// with a few example clocks per fix; v59.49 replaced the snapshot classifier's examples with a schedule sweep. This does
// the same for the shared clock functions every screen reads — latestCompletedUsSession, latestCompletedKrSession,
// marketClock().us/.kr phases and isSessionCurrent — against an oracle that converts time with Intl (not nyParts or
// kstParts) and takes each day's hours from the calendar table as data. The default window holds the US DST end
// (2026-11-01), the KRX exam-day session (2026-11-19, 10:00-16:30), Thanksgiving (11-26) and its 13:00 close (11-27).

const MINUTE = 60000;
const DAY = 86400000;

const formatters = new Map();
function wallClock(ms, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
const minuteOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const previousDay = (date) => new Date(Date.parse(`${date}T12:00:00Z`) - DAY).toISOString().slice(0, 10);

// The instant a wall time happens in a zone, found by scanning the minutes around a UTC guess (DST safe, no offsets).
const instants = new Map();
function instantOf(date, hhmm, timeZone) {
  const key = `${timeZone} ${date} ${hhmm}`;
  if (instants.has(key)) return instants.get(key);
  const target = minuteOf(hhmm);
  const base = Date.parse(`${date}T00:00:00Z`);
  let found = null;
  for (let ms = base - 15 * 3600000; ms <= base + 39 * 3600000 && found == null; ms += MINUTE) {
    const wall = wallClock(ms, timeZone);
    if (wall.date === date && wall.minute === target) found = ms;
  }
  instants.set(key, found);
  return found;
}

export function sweepMarketClocks({ calendar, clock, startIso = '2026-10-24T00:00:00Z', endIso = '2026-11-30T00:00:00Z', stepMinutes = 10 } = {}) {
  const { resolveMarketCalendarSession, latestCompletedUsSession, latestCompletedKrSession, isSessionCurrent } = calendar;
  const { marketClock } = clock;
  const zone = { US: 'America/New_York', KR: 'Asia/Seoul' };
  const day = (market, date) => resolveMarketCalendarSession({ market, date });
  const lastOpenOnOrBefore = (market, date) => {
    for (let cursor = date, i = 0; i < 14; i += 1, cursor = previousDay(cursor)) if (day(market, cursor).status === 'open') return cursor;
    return null;
  };
  // Oracle: the newest open day whose close instant is at or before now (KR: also report the 30-minute EOD grace).
  const completed = (market, nowMs) => {
    for (let cursor = wallClock(nowMs, zone[market]).date, i = 0; i < 14; i += 1, cursor = previousDay(cursor)) {
      const session = day(market, cursor);
      if (session.status !== 'open') continue;
      const closeMs = instantOf(cursor, session.close, zone[market]);
      if (closeMs <= nowMs) return { date: cursor, closeMs };
    }
    return null;
  };
  const usPhase = (nowMs) => {
    const wall = wallClock(nowMs, zone.US);
    const session = day('US', wall.date);
    if (session.status === 'closed') return 'closed';
    const open = minuteOf(session.open), close = minuteOf(session.close);
    if (wall.minute < 240) return 'overnight';
    if (wall.minute < open) return 'pre';
    if (wall.minute < close) return 'regular';
    if (wall.minute < 1200) return 'post';
    return 'overnight';
  };
  const krPhase = (nowMs) => {
    const wall = wallClock(nowMs, zone.KR);
    const session = day('KR', wall.date);
    if (session.status === 'closed') return 'closed';
    const open = minuteOf(session.open), close = minuteOf(session.close);
    if (wall.minute < open) return 'before';
    if (wall.minute < close) return 'regular';
    if (wall.minute < close + 30) return 'closing';
    return 'closed-today';
  };

  const mismatches = [];
  let checked = 0;
  const expect = (label, nowMs, got, want) => {
    checked += 1;
    if (JSON.stringify(got) !== JSON.stringify(want) && mismatches.length < 40) mismatches.push({ label, at: new Date(nowMs).toISOString(), got, want });
  };
  for (let nowMs = Date.parse(startIso); nowMs < Date.parse(endIso); nowMs += stepMinutes * MINUTE) {
    const us = completed('US', nowMs);
    const usGot = latestCompletedUsSession(nowMs, { requirePrevious: false });
    expect('latestCompletedUsSession', nowMs, usGot && { date: usGot.date, closeMs: usGot.closeMs }, us);
    const kr = completed('KR', nowMs);
    const krGot = latestCompletedKrSession(nowMs);
    expect('latestCompletedKrSession', nowMs, krGot && { date: krGot.date, closeMs: krGot.closeMs, eodConfirmed: krGot.eodConfirmed }, kr && { ...kr, eodConfirmed: nowMs >= kr.closeMs + 30 * MINUTE });
    const phases = marketClock(nowMs);
    expect('marketClock.us.phase', nowMs, phases.us.phase, usPhase(nowMs));
    expect('marketClock.kr.phase', nowMs, phases.kr.phase, krPhase(nowMs));
    // An observation dated the latest completed session is current; one from the open day before it is current only
    // within 12 hours of that close (its producer has not landed yet).
    for (const market of ['US', 'KR']) {
      const last = market === 'US' ? us : kr;
      if (!last) continue;
      expect(`isSessionCurrent.${market}.latest`, nowMs, isSessionCurrent({ market, sessionDate: last.date, now: nowMs }), true);
      const before = lastOpenOnOrBefore(market, previousDay(last.date));
      if (before) expect(`isSessionCurrent.${market}.previous`, nowMs, isSessionCurrent({ market, sessionDate: before, now: nowMs }), nowMs - last.closeMs <= 12 * 3600000);
    }
  }
  return { checked, mismatches };
}
