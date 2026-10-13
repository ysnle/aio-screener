// P1654: the FRED release schedule written by the producer (public-data/macro-calendar.json) extends the hand-kept
// official schedule arrays in the legacy calendar, so CPI/NFP/PCE/retail dates keep flowing past the last manual
// entry. Those dates are only added (union), never removed.
// P1737: the producer also publishes FOMC meetings (Federal Reserve calendar page, meta.fomcStatus) and ISM PMI dates
// (release rule). A union would leave a hand-kept date behind if the Fed moved a meeting, so these replace the manual
// dates instead: FOMC for the years the producer covers, only while meta.fomcStatus is 'ok' (otherwise the manual
// dates stay, with their own expiry in the manual-reference registry); ISM for the months the producer covers.
import { refreshSharedArtifact } from './shared-artifacts.js';

export const MACRO_CALENDAR = Object.freeze({ key: '_aioMacroCalendar', url: './public-data/macro-calendar.json', schemas: ['macro-calendar.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 256 * 1024 });

const FOMC_KEYS = Object.freeze(['us-fomc', 'us-fed-rate']);
const ISM_KEYS = Object.freeze(['us-ism-mfg', 'us-ism-svc']);
const isIsoDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date));
const validDates = (dates) => (Array.isArray(dates) ? [...new Set(dates.filter(isIsoDate))].sort() : []);

export function mergeMacroSchedules(current = {}, produced = {}) {
  const merged = { ...current };
  for (const [calendarId, dates] of Object.entries(produced || {})) {
    if (!Array.isArray(dates)) continue;
    const valid = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)));
    merged[calendarId] = [...new Set([...(Array.isArray(current[calendarId]) ? current[calendarId] : []), ...valid])].sort();
  }
  return merged;
}

// Replace the manual dates whose period (year 'YYYY' or month 'YYYY-MM') the producer covers; keep the rest.
function replaceCoveredPeriods(current, produced, periodLength) {
  const periods = new Set(produced.map((date) => date.slice(0, periodLength)));
  return [...new Set([...validDates(current).filter((date) => !periods.has(date.slice(0, periodLength))), ...produced])].sort();
}

/**
 * @returns {{ schedules, producedAt: Record<string,string>, fomc: { accepted, status, fetchedAt, sep: Record<string,boolean> } }}
 */
export function mergeProducedMacroCalendar(current = {}, payload = {}) {
  const produced = payload?.schedules && typeof payload.schedules === 'object' ? payload.schedules : {};
  const generatedAt = typeof payload?.generatedAt === 'string' ? payload.generatedAt : null;
  const unionPart = Object.fromEntries(Object.entries(produced).filter(([calendarId]) => !FOMC_KEYS.includes(calendarId) && !ISM_KEYS.includes(calendarId)));
  const schedules = mergeMacroSchedules(current, unionPart);
  const producedAt = Object.fromEntries(Object.keys(unionPart).filter((calendarId) => Array.isArray(unionPart[calendarId])).map((calendarId) => [calendarId, generatedAt]));
  const meta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {};
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const fomcEvents = events.filter((event) => event?.calendarId === 'us-fomc' && event?.source === 'fed-official' && isIsoDate(event?.date));
  const fomcDates = validDates(fomcEvents.length ? fomcEvents.map((event) => event.date) : produced['us-fomc']);
  const fomcStatus = typeof meta.fomcStatus === 'string' ? meta.fomcStatus : null;
  const fomcAccepted = fomcStatus === 'ok' && fomcDates.length > 0;
  const sep = {};
  if (fomcAccepted) {
    for (const calendarId of FOMC_KEYS) {
      schedules[calendarId] = replaceCoveredPeriods(current[calendarId], fomcDates, 4);
      producedAt[calendarId] = meta.fomcFetchedAt || generatedAt;
    }
    for (const event of fomcEvents) if (typeof event.sep === 'boolean') sep[event.date] = event.sep;
  }
  for (const calendarId of ISM_KEYS) {
    const ruleDates = validDates(events.filter((event) => event?.calendarId === calendarId && event?.source === 'ism-rule').map((event) => event.date));
    const dates = ruleDates.length ? ruleDates : validDates(produced[calendarId]);
    if (!dates.length) continue;
    schedules[calendarId] = replaceCoveredPeriods(current[calendarId], dates, 7);
    producedAt[calendarId] = generatedAt;
  }
  return { schedules, producedAt, fomc: { accepted: fomcAccepted, status: fomcStatus, fetchedAt: meta.fomcFetchedAt || null, sep } };
}

export async function applyProducedMacroCalendar(root) {
  const { payload } = await refreshSharedArtifact(root, MACRO_CALENDAR);
  if (!payload?.schedules || !root.AIO_MACRO_OFFICIAL_SCHEDULES) return false;
  // Always merge into the hand-kept base, so a later artifact whose FOMC status fell back to 'stale' restores the manual dates.
  root.__aioManualMacroSchedules ||= { ...root.AIO_MACRO_OFFICIAL_SCHEDULES };
  const merged = mergeProducedMacroCalendar(root.__aioManualMacroSchedules, payload);
  root.AIO_MACRO_OFFICIAL_SCHEDULES = merged.schedules;
  root.AIO_MACRO_SCHEDULE_PRODUCED_AT = merged.producedAt;
  root.AIO_FOMC_PRODUCED = merged.fomc;
  root.AIO?.refreshMacroCalendarFromOfficialSchedule?.();
  return true;
}
