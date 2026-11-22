// One refetch rule for FRED observation series (v59.70 data audit R3; shared since v60.46). macro-history.mjs used it
// alone while fred.mjs refetched every series on every 30-minute cycle; both lanes now ask seriesFetchDue.
//
// A series is due when it has no usable last fetch, when its last fetch is older than the interval of its frequency,
// or, for a series with an official release calendar (macro-calendar.json `schedules`), throughout the release watch:
// from the release day's print time (08:30 America/New_York) for RELEASE_WATCH_HOURS, every run fetches it, as before
// the throttle. So a new print arrives on the first run after FRED posts it. A calendar the run could not read makes
// the series due (fail open), never held for its full interval.
import { isIsoDay } from '../../src/domain/shared/session-date.js';

export const SERIES_MIN_AGE_HOURS = Object.freeze({ daily: 3, weekly: 12, monthly: 12, quarterly: 12, 'sep-release': 12 });
// BLS/BEA/Census print at 08:30 ET; FRED posts them within minutes, and the FOMC decision (14:00 ET) falls inside the watch.
export const RELEASE_PRINT_ET = '08:30';
export const RELEASE_WATCH_HOURS = 12;
export const SERIES_RELEASE_CALENDAR = Object.freeze({
  CPIAUCSL: 'us-cpi', CPILFESL: 'us-cpi', CPIAUCNS: 'us-cpi', CPILFENS: 'us-cpi', CUSR0000SAH1: 'us-cpi', CUSR0000SASL2RS: 'us-cpi',
  PCEPI: 'us-pce', PCEPILFE: 'us-pce',
  UNRATE: 'us-nfp', PAYEMS: 'us-nfp', CES0500000003: 'us-nfp',
  RSAFS: 'us-retail',
  DFEDTARU: 'us-fed-rate', DFEDTARL: 'us-fed-rate', FEDTARMDLR: 'us-fomc'
});

const HOUR = 3600000;

function nyWallInstant(date, hhmm) {
  if (!isIsoDay(date)) return NaN;
  const target = Date.parse(`${date}T${hhmm}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    guess -= Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`) - target;
  }
  return guess;
}

// The latest release instant of `calendarId` at or before nowMs (release day 08:30 America/New_York), or NaN.
export function latestReleaseDueMs(schedules, calendarId, nowMs) {
  const dates = Array.isArray(schedules?.[calendarId]) ? schedules[calendarId] : [];
  let latest = NaN;
  for (const date of dates) {
    const due = nyWallInstant(date, RELEASE_PRINT_ET);
    if (Number.isFinite(due) && due <= nowMs && !(due <= latest)) latest = due;
  }
  return latest;
}

/** Whether a series ({ id, frequency }) last fetched at lastFetchedMs should be fetched this run. */
export function seriesFetchDue(spec, lastFetchedMs, { nowMs = Date.now(), schedules = null } = {}) {
  if (!Number.isFinite(lastFetchedMs) || lastFetchedMs > nowMs) return true;
  if (nowMs - lastFetchedMs >= (SERIES_MIN_AGE_HOURS[spec.frequency] ?? 3) * HOUR) return true;
  const calendarId = SERIES_RELEASE_CALENDAR[spec.id];
  if (!calendarId) return false;
  if (!Array.isArray(schedules?.[calendarId])) return true;
  const releaseMs = latestReleaseDueMs(schedules, calendarId, nowMs);
  return Number.isFinite(releaseMs) && (lastFetchedMs < releaseMs || nowMs - releaseMs < RELEASE_WATCH_HOURS * HOUR);
}
