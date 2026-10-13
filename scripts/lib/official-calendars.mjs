// P1731/P1732/P1733 (owner 2026-10-13: automate the hand-kept schedule and rate strings).
// Pure helpers for public-data/macro-calendar.json and data.json policyRates. No network, file or clock access here:
// the producer (scripts/fetch-data.mjs writeMacroCalendar) injects the fetched page, the previous artifact and now.
//
// - FOMC: parsed from the Federal Reserve's official meeting calendar page. The page structure can change, so the
//   parser fails closed: a year is published only with exactly 8 two-day meetings and 4 SEP meetings; otherwise the
//   previous parsed meetings are kept and fomcStatus says why.
// - ISM PMI: rule-derived (the official ISM calendar is login-gated). Manufacturing = first US business day,
//   Services = third; January shifts both by one business day (ISM's own January exception, e.g. the December 2025
//   manufacturing report came out Monday 2026-01-05, the second business day). Business days skip US federal
//   holidays, not NYSE-only closures (ISM publishes on Good Friday).
// - Fed policy rate: derived from the FRED target-range series already collected (DFEDTARL/DFEDTARU).

export const FOMC_CALENDAR_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
export const FOMC_RECHECK_MS = 12 * 60 * 60 * 1000;
export const FOMC_MEETINGS_PER_YEAR = 8;
export const FOMC_SEP_MEETINGS_PER_YEAR = 4;
export const FED_POLICY_RATE_SOURCE = 'FRED DFEDTARL/DFEDTARU';
export const FED_POLICY_RATE_MAX_AGE_DAYS = 5;
export const ISM_RULE_BASIS = 'ISM release rule: manufacturing 1st, services 3rd US business day (January: 2nd/4th); federal holidays skipped';

const DAY_MS = 86400000;
const MONTHS = Object.freeze({
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12
});

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
function validIso(y, m, d) {
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? isoOf(y, m, d) : null;
}
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : null);
const decode = (text) => String(text || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();

// ── FOMC ────────────────────────────────────────────────────────────────────
// Returns { years: { 'YYYY': [{ startDate, date, sep, label }] }, skipped: [{ year, month, text }] }.
// `date` is the second (decision) day. Rows that are not a scheduled two-day meeting (notation votes, unscheduled
// calls) are skipped and listed, never guessed into a meeting.
export function parseFomcCalendarHtml(html) {
  const source = String(html || '');
  const headingRe = /<h4[^>]*>\s*(?:<a[^>]*>)?\s*(\d{4})\s+FOMC\s+Meetings\s*(?:<\/a>)?\s*<\/h4>/gi;
  const headings = [];
  let m;
  while ((m = headingRe.exec(source))) headings.push({ year: Number(m[1]), start: m.index + m[0].length, at: m.index });
  const years = {};
  const skipped = [];
  headings.forEach((heading, index) => {
    const segment = source.slice(heading.start, index + 1 < headings.length ? headings[index + 1].at : source.length);
    const rowRe = /fomc-meeting__month[^>]*>\s*(?:<strong>)?\s*([^<]+?)\s*(?:<\/strong>)?\s*<\/div>[\s\S]*?fomc-meeting__date[^>]*>\s*([^<]+?)\s*</gi;
    const meetings = [];
    let row;
    while ((row = rowRe.exec(segment))) {
      const monthText = decode(row[1]);
      const dateText = decode(row[2]);
      const months = monthText.toLowerCase().split('/').map((part) => MONTHS[part.trim()]);
      const days = dateText.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*(\*)?$/);
      if (!days || !months.length || months.some((value) => !value) || months.length > 2) {
        skipped.push({ year: heading.year, month: monthText, text: dateText });
        continue;
      }
      const startMonth = months[0];
      const endMonth = months[months.length - 1];
      const startDate = validIso(heading.year, startMonth, Number(days[1]));
      const date = validIso(heading.year, endMonth, Number(days[2]));
      const span = startDate && date ? (Date.parse(date) - Date.parse(startDate)) / DAY_MS : NaN;
      if (!startDate || !date || !(span >= 1 && span <= 3)) {
        skipped.push({ year: heading.year, month: monthText, text: dateText });
        continue;
      }
      meetings.push({ startDate, date, sep: !!days[3], label: `${monthText} ${dateText}` });
    }
    if (meetings.length || !years[heading.year]) years[heading.year] = meetings;
  });
  return { years, skipped };
}

function validateFomcYear(year, meetings) {
  if (!Array.isArray(meetings)) return `${year}-missing`;
  if (meetings.length !== FOMC_MEETINGS_PER_YEAR) return `${year}-meeting-count:${meetings.length}`;
  const sepCount = meetings.filter((meeting) => meeting.sep).length;
  if (sepCount !== FOMC_SEP_MEETINGS_PER_YEAR) return `${year}-sep-count:${sepCount}`;
  for (let i = 0; i < meetings.length; i++) {
    if (!meetings[i].date.startsWith(`${year}-`)) return `${year}-date-outside-year:${meetings[i].date}`;
    if (i && meetings[i].date <= meetings[i - 1].date) return `${year}-not-ascending:${meetings[i].date}`;
  }
  return null;
}

// The current year must parse to exactly 8 meetings (4 with SEP); the next year is optional (the Fed posts it
// mid-year) but, when its panel exists, must pass the same test. Any anomaly fails the whole parse closed.
export function selectFomcMeetings(parsed, nowMs = Date.now()) {
  const currentYear = new Date(nowMs).getUTCFullYear();
  const years = parsed?.years || {};
  const currentReason = validateFomcYear(currentYear, years[currentYear]);
  if (currentReason) return { ok: false, reason: currentReason, events: [], years: [] };
  const published = [currentYear];
  if (years[currentYear + 1] !== undefined) {
    const nextReason = validateFomcYear(currentYear + 1, years[currentYear + 1]);
    if (nextReason) return { ok: false, reason: nextReason, events: [], years: [] };
    published.push(currentYear + 1);
  }
  const events = published.flatMap((year) => years[year].map((meeting) => ({
    calendarId: 'us-fomc', date: meeting.date, startDate: meeting.startDate, source: 'fed-official', sep: meeting.sep
  })));
  return { ok: true, reason: null, events, years: published };
}

// 12-hour recheck gate + last-known-good retention. `fetchHtml(url)` is called only when the previous check is older
// than FOMC_RECHECK_MS (or absent). A failed fetch/parse keeps the previous fed-official events and records the reason.
export async function resolveFomcSchedule({ previous = null, fetchHtml, nowMs = Date.now() } = {}) {
  const prevMeta = previous?.meta || {};
  const prevEvents = (Array.isArray(previous?.events) ? previous.events : []).filter((event) => event?.source === 'fed-official' && isoDate(event.date));
  const lastCheck = Date.parse(prevMeta.fomcCheckedAt || '');
  if (prevEvents.length && Number.isFinite(lastCheck) && nowMs - lastCheck >= 0 && nowMs - lastCheck < FOMC_RECHECK_MS) {
    return {
      fetched: false, events: prevEvents,
      meta: { fomcFetchedAt: prevMeta.fomcFetchedAt || null, fomcCheckedAt: prevMeta.fomcCheckedAt, fomcStatus: prevMeta.fomcStatus || 'ok', fomcReason: prevMeta.fomcReason || null, fomcYears: Array.isArray(prevMeta.fomcYears) ? prevMeta.fomcYears : [], fomcSourceUrl: FOMC_CALENDAR_URL }
    };
  }
  const checkedAt = new Date(nowMs).toISOString();
  let reason;
  try {
    if (typeof fetchHtml !== 'function') throw new Error('fetch-unavailable');
    const html = await fetchHtml(FOMC_CALENDAR_URL);
    if (!/Summary of Economic Projections/i.test(String(html || ''))) throw new Error('sep-footnote-missing');
    const selected = selectFomcMeetings(parseFomcCalendarHtml(html), nowMs);
    if (selected.ok) {
      return {
        fetched: true, events: selected.events,
        meta: { fomcFetchedAt: checkedAt, fomcCheckedAt: checkedAt, fomcStatus: 'ok', fomcReason: null, fomcYears: selected.years, fomcSourceUrl: FOMC_CALENDAR_URL }
      };
    }
    reason = `parse-rejected:${selected.reason}`;
  } catch (error) {
    reason = `fetch-failed:${error?.message || String(error)}`;
  }
  return {
    fetched: true, events: prevEvents,
    meta: { fomcFetchedAt: prevMeta.fomcFetchedAt || null, fomcCheckedAt: checkedAt, fomcStatus: prevEvents.length ? 'stale' : 'unavailable', fomcReason: reason, fomcYears: prevEvents.length && Array.isArray(prevMeta.fomcYears) ? prevMeta.fomcYears : [], fomcSourceUrl: FOMC_CALENDAR_URL }
  };
}

// ── US federal holidays / ISM rule ──────────────────────────────────────────
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}
function observedIso(year, month, day) {
  const t = Date.UTC(year, month - 1, day);
  const dow = new Date(t).getUTCDay();
  const shifted = new Date(t + (dow === 6 ? -DAY_MS : dow === 0 ? DAY_MS : 0));
  return shifted.toISOString().slice(0, 10);
}
export function usFederalHolidays(year) {
  return new Set([
    observedIso(year, 1, 1), observedIso(year + 1, 1, 1),
    isoOf(year, 1, nthWeekday(year, 1, 1, 3)), isoOf(year, 2, nthWeekday(year, 2, 1, 3)),
    isoOf(year, 5, nthWeekday(year, 5, 1, -1)), observedIso(year, 6, 19), observedIso(year, 7, 4),
    isoOf(year, 9, nthWeekday(year, 9, 1, 1)), isoOf(year, 10, nthWeekday(year, 10, 1, 2)),
    observedIso(year, 11, 11), isoOf(year, 11, nthWeekday(year, 11, 4, 4)), observedIso(year, 12, 25)
  ]);
}
export function nthUsBusinessDay(year, month, n) {
  const holidays = usFederalHolidays(year);
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const iso = validIso(year, month, day);
    if (!iso) break;
    const dow = new Date(Date.parse(iso)).getUTCDay();
    if (dow === 0 || dow === 6 || holidays.has(iso)) continue;
    if (++count === n) return iso;
  }
  return null;
}
// Release months from fromMs's month through toMs's month. referenceMonth = the data month the report covers.
export function buildIsmRuleEvents({ fromMs, toMs } = {}) {
  const from = new Date(fromMs);
  const to = new Date(toMs);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) return [];
  const events = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1;
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth() + 1)) {
    const shift = m === 1 ? 1 : 0;
    const referenceMonth = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
    const mfg = nthUsBusinessDay(y, m, 1 + shift);
    const svc = nthUsBusinessDay(y, m, 3 + shift);
    if (mfg) events.push({ calendarId: 'us-ism-mfg', date: mfg, referenceMonth, source: 'ism-rule', rule: m === 1 ? 'second-business-day' : 'first-business-day' });
    if (svc) events.push({ calendarId: 'us-ism-svc', date: svc, referenceMonth, source: 'ism-rule', rule: m === 1 ? 'fourth-business-day' : 'third-business-day' });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return events;
}

// ── macro-calendar.json payload ─────────────────────────────────────────────
// `schedules` stays the consumer contract (calendarId -> sorted ISO dates, merged by src/data/macro-calendar.js).
// `events` carries per-date provenance for the new sources. A FRED release that failed this run keeps the previous
// artifact's dates (listed in `failed`). Returns null when there is nothing to publish.
export function buildMacroCalendarPayload({ nowMs = Date.now(), fredSchedules = {}, fredFailed = [], fredFailureReason = null, previous = null, fomc = null, ismEvents = [] } = {}) {
  const schedules = { ...fredSchedules };
  const retained = [];
  for (const calendarId of fredFailed) {
    const kept = previous?.schedules?.[calendarId];
    if (Array.isArray(kept) && kept.length && !schedules[calendarId]) { schedules[calendarId] = kept; retained.push(calendarId); }
  }
  const fomcEvents = Array.isArray(fomc?.events) ? fomc.events : [];
  const events = [...fomcEvents, ...(Array.isArray(ismEvents) ? ismEvents : [])].sort((a, b) => a.date.localeCompare(b.date) || a.calendarId.localeCompare(b.calendarId));
  const datesOf = (calendarId) => [...new Set(events.filter((event) => event.calendarId === calendarId).map((event) => event.date))].sort();
  if (fomcEvents.length) {
    schedules['us-fomc'] = datesOf('us-fomc');
    schedules['us-fed-rate'] = schedules['us-fomc'];
  }
  for (const calendarId of ['us-ism-mfg', 'us-ism-svc']) {
    const dates = datesOf(calendarId);
    if (dates.length) schedules[calendarId] = dates;
  }
  if (!Object.keys(schedules).length) return null;
  const fomcMeta = fomc?.meta || { fomcFetchedAt: null, fomcCheckedAt: null, fomcStatus: 'unavailable', fomcReason: 'not-attempted', fomcYears: [], fomcSourceUrl: FOMC_CALENDAR_URL };
  return {
    schemaVersion: 'macro-calendar.v1',
    generatedAt: new Date(nowMs).toISOString(),
    source: 'FRED release dates (St. Louis Fed); Federal Reserve FOMC meeting calendar; ISM release rule',
    sourceKind: 'T1_OFFICIAL',
    status: fredFailed.length || fomcMeta.fomcStatus !== 'ok' ? 'partial' : 'ok',
    failed: [...fredFailed],
    retained,
    fredFailureReason,
    schedules,
    events,
    meta: { ...fomcMeta, ismBasis: ISM_RULE_BASIS }
  };
}

// ── Fed policy rate (P1732) ─────────────────────────────────────────────────
// current only when both bounds are finite, observed on the same date, exactly 25bp apart and no older than
// FED_POLICY_RATE_MAX_AGE_DAYS; anything else is published as stale with the reason (consumers then show the
// previous reference with its date instead of a current-looking value).
export function deriveFedPolicyRate(macro = {}, nowMs = Date.now()) {
  const num = (value) => (value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null));
  const lower = num(macro?.fedTargetLower);
  const upper = num(macro?.fedTargetUpper);
  const asOfLower = isoDate(macro?._asOf_fedTargetLower);
  const asOfUpper = isoDate(macro?._asOf_fedTargetUpper);
  const asOf = asOfLower && asOfUpper ? (asOfLower < asOfUpper ? asOfLower : asOfUpper) : (asOfUpper || asOfLower || null);
  let reason = null;
  if (lower == null || upper == null) reason = 'missing-bound';
  else if (!asOfLower || !asOfUpper) reason = 'missing-observation-date';
  else if (asOfLower !== asOfUpper) reason = `observation-date-mismatch:${asOfLower}/${asOfUpper}`;
  else if (Math.abs(upper - lower - 0.25) > 1e-9) reason = `range-width-unexpected:${lower}-${upper}`;
  else if ((nowMs - Date.parse(`${asOf}T00:00:00Z`)) / DAY_MS > FED_POLICY_RATE_MAX_AGE_DAYS) reason = `older-than-${FED_POLICY_RATE_MAX_AGE_DAYS}d`;
  return { lower, upper, asOf, source: FED_POLICY_RATE_SOURCE, status: reason ? 'stale' : 'current', reason };
}
