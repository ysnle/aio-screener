// Exchange closures and short sessions a reader should know before they arrive. The calendar already decides them
// (market-calendar.js); this turns the next few local dates of each market into rows and one short sentence, so a
// holiday explains why the basis close does not move and an early close is known the day before.
import { MARKET_HOLIDAY_NAMES, dateInTimezone, resolveMarketCalendarSession } from './market-calendar.js';

const MARKETS = Object.freeze([
  Object.freeze({ market: 'US', calendarKey: 'NYSE', label: '미국', timezone: 'America/New_York' }),
  Object.freeze({ market: 'KR', calendarKey: 'KRX', label: '한국', timezone: 'Asia/Seoul' }),
]);
const addDays = (iso, count) => new Date(Date.parse(`${iso}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
const monthDay = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** [{ market, label, date, kind: 'holiday' | 'early-close', name, close }] for each market's local today and the `days - 1` dates after it. */
export function sessionNotices(nowMs = Date.now(), { days = 4 } = {}) {
  const rows = [];
  for (const { market, calendarKey, label, timezone } of MARKETS) {
    const start = dateInTimezone(nowMs, timezone);
    if (!start) continue;
    for (let offset = 0; offset < days; offset += 1) {
      const date = addDays(start, offset);
      const day = resolveMarketCalendarSession({ market, date });
      if (day.status === 'closed' && day.reason === 'holiday') rows.push({ market, label, date, kind: 'holiday', name: MARKET_HOLIDAY_NAMES[calendarKey]?.[date] || null, close: null });
      else if (day.status === 'open' && day.halfDay) rows.push({ market, label, date, kind: 'early-close', name: null, close: day.close });
    }
  }
  return rows;
}

/** "미국 11/26 휴장(추수감사절)·11/27 조기 마감(현지 13:00)" — markets joined by ", "; '' when there is nothing to say. */
export function sessionNoticeText(notices = []) {
  const byMarket = new Map();
  for (const row of notices) {
    const said = row.kind === 'holiday' ? `${monthDay(row.date)} 휴장${row.name ? `(${row.name})` : ''}` : `${monthDay(row.date)} 조기 마감(현지 ${row.close})`;
    byMarket.set(row.label, [...(byMarket.get(row.label) || []), said]);
  }
  return [...byMarket].map(([label, parts]) => `${label} ${parts.join('·')}`).join(', ');
}
