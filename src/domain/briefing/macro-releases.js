// v59.44 (owner 2026-10-29, news by weight): the official monthly releases that came out in the last two days — PCE,
// CPI, the jobs report, retail sales — read from the same macro board 거시 shows (src/domain/macro/indicators.js), so
// 오늘 can lead with them beside the FOMC brief. Observed values only; no consensus is compared (none is published here).
import { buildMacroBoard, MACRO_GROUPS } from '../macro/indicators.js';

const DAY = 86400000;
export const MACRO_RELEASE_TITLES = Object.freeze({ 'us-pce': 'PCE 물가', 'us-cpi': '소비자물가(CPI)', 'us-nfp': '고용보고서', 'us-retail': '소매판매' });
// Board items carry their release dates but not the calendar id; the registry has it.
const RELEASE_OF = Object.freeze(Object.fromEntries(MACRO_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.release || null]))));

const kstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

/** Releases whose publication day (the board's `release.last`) is within `days` of now (KST), newest first. */
export function recentMacroReleases(input, { nowMs = Date.now(), days = 2 } = {}) {
  const board = buildMacroBoard(input);
  if (!board.available) return [];
  const today = kstDay(nowMs);
  const earliest = kstDay(nowMs - days * DAY);
  const byRelease = new Map();
  for (const item of board.groups.flatMap((group) => group.items)) {
    const id = RELEASE_OF[item.id];
    const day = item.release?.last;
    if (!MACRO_RELEASE_TITLES[id] || item.status !== 'observed' || !day || day < earliest || day > today) continue;
    const scheduled = (Array.isArray(input?.schedules?.[id]) ? input.schedules[id] : []).filter((date) => date > day).sort()[0] || null;
    const row = byRelease.get(id) || { id, title: MACRO_RELEASE_TITLES[id], date: day, period: item.asOf, next: item.release.next || scheduled, items: [] };
    row.items.push({ label: item.label, valueText: item.valueText, deltaText: item.deltaText || null, targetText: item.targetText || null });
    byRelease.set(id, row);
  }
  // A release the official calendar says is out (08:30 ET, taken as 13:45Z) but the board does not hold yet is still
  // listed — 'pending' — so a release day is never silent while the producer catches up (owner 2026-10-30).
  for (const id of Object.keys(MACRO_RELEASE_TITLES)) {
    const due = (Array.isArray(input?.schedules?.[id]) ? input.schedules[id] : []).filter((date) => date >= earliest && date <= today && Date.parse(`${date}T13:45:00Z`) <= nowMs).sort().pop();
    if (due && (!byRelease.has(id) || byRelease.get(id).date < due)) byRelease.set(id, { id, title: MACRO_RELEASE_TITLES[id], date: due, period: null, next: null, items: [], pending: true });
  }
  return [...byRelease.values()].sort((a, b) => b.date.localeCompare(a.date));
}
