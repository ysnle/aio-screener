// v59.42 (owner audit 2026-10-28): scheduled non-economic events — elections and similar dates fixed in advance by law or
// an official body — in one registry. v58.74 kept two elections inside schedule.js and showed them only inside the
// schedule's own window, so on 10/28 the home list (3 days) could not show the 11/3 US midterm. Each entry now says:
// - atKst: when the market-relevant moment happens (polls close, the count starts), in KST;
// - leadDays: how many days before it the schedules list it, beyond their own window;
// - expiresAt: after this the entry is dropped everywhere (stale entries do not linger), and the registry check warns
//   so the row is removed;
// - source and reviewedAt: the official source and the day it was last checked. A moved date is corrected here.
// Dates are added only from an official source; none is inferred.
export const SCHEDULED_EVENTS = Object.freeze([
  Object.freeze({ id: 'il-knesset-2026', kind: 'election', atKst: '2026-10-28T05:00:00+09:00', label: '이스라엘 총선 (투표 마감, 출구조사)',
    why: '연정 구성에 따라 이란·중동 정책 기대가 바뀌어 유가 위험 프리미엄이 움직일 수 있음',
    source: 'Israel Central Elections Committee (26th Knesset, 2026-10-27)', reviewedAt: '2026-10-24', leadDays: 7, expiresAt: '2026-10-31' }),
  Object.freeze({ id: 'us-midterm-2026', kind: 'election', atKst: '2026-11-04T09:00:00+09:00', label: '미국 중간선거 (11/3, 동부 투표 마감)',
    why: '의회 다수당에 따라 재정·관세·규제 기대가 바뀌어 금리·업종별 흐름이 갈릴 수 있음. 개표는 한국 시간 11/4 오전부터, 접전 지역은 며칠 걸릴 수 있음',
    source: '2 U.S.C. 7 (U.S. general election, 2026-11-03)', reviewedAt: '2026-10-29', leadDays: 10, expiresAt: '2026-11-10', major: true })
]);

const DAY = 86400000;
const expiryMs = (event) => Date.parse(`${event.expiresAt}T23:59:59+09:00`);

/** Entries not yet expired whose lead window has opened (or that fall inside `days`). */
export function activeScheduledEvents({ nowMs = Date.now(), days = 7, registry = SCHEDULED_EVENTS } = {}) {
  return registry.filter((event) => {
    const atMs = Date.parse(event.atKst);
    if (!Number.isFinite(atMs) || nowMs > expiryMs(event) || atMs < nowMs - 6 * 3600000) return false;
    return atMs <= nowMs + Math.max(days, event.leadDays || 0) * DAY;
  });
}

/** Registry problems: missing source/review, an expiry before the event, an entry already past its expiry. */
export function scheduledEventProblems({ nowMs = Date.now(), registry = SCHEDULED_EVENTS } = {}) {
  const problems = [];
  for (const event of registry) {
    if (!event.source || !/^\d{4}-\d{2}-\d{2}$/.test(event.reviewedAt || '')) problems.push({ id: event.id, level: 'error', reason: 'source and reviewedAt required' });
    if (!Number.isFinite(Date.parse(event.atKst)) || !(expiryMs(event) >= Date.parse(event.atKst))) problems.push({ id: event.id, level: 'error', reason: 'expiresAt must be on or after the event' });
    if (nowMs > expiryMs(event)) problems.push({ id: event.id, level: 'warn', reason: `expired ${event.expiresAt}; remove the row` });
  }
  return problems;
}
