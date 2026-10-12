// P1654: the FRED release schedule written by the producer (public-data/macro-calendar.json) extends the hand-kept
// official schedule arrays in the legacy calendar, so CPI/NFP/PCE/retail dates keep flowing past the last manual
// entry. Dates are only added (union), never removed; FOMC/BOK/ISM stay on their annual official calendars.
import { refreshSharedArtifact } from './shared-artifacts.js';

export const MACRO_CALENDAR = Object.freeze({ key: '_aioMacroCalendar', url: './public-data/macro-calendar.json', schemas: ['macro-calendar.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 256 * 1024 });

export function mergeMacroSchedules(current = {}, produced = {}) {
  const merged = { ...current };
  for (const [calendarId, dates] of Object.entries(produced || {})) {
    if (!Array.isArray(dates)) continue;
    const valid = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)));
    merged[calendarId] = [...new Set([...(Array.isArray(current[calendarId]) ? current[calendarId] : []), ...valid])].sort();
  }
  return merged;
}

export async function applyProducedMacroCalendar(root) {
  const { payload } = await refreshSharedArtifact(root, MACRO_CALENDAR);
  if (!payload?.schedules || !root.AIO_MACRO_OFFICIAL_SCHEDULES) return false;
  root.AIO_MACRO_OFFICIAL_SCHEDULES = mergeMacroSchedules(root.AIO_MACRO_OFFICIAL_SCHEDULES, payload.schedules);
  root.AIO?.refreshMacroCalendarFromOfficialSchedule?.();
  return true;
}
