// The next reports of the market's leading names: the companies of the market-mover list (market-movers.js, the list
// 시장 상태's week calls 주도주 목록) with a US report in the earnings calendar inside the next LEADER_EARNINGS_SESSIONS
// US sessions. Two readers: 오늘's 다음 일정 (items shaped like buildMarketStory().week's) and the opening's AI fact lines.
// The calendar's `earnings` rows hold the current week with results; `upcoming` maps a symbol to its next date beyond it
// ("YYYY-MM-DD|hour"). A row with a result, or whose report time has passed, is not next. No row, no item.
import { MARKET_MOVERS } from './market-movers.js';
import { earningsFilterMs, reportedNumber } from './schedule.js';
import { countOpenSessionsBetween, dateInTimezone } from '../market/session/market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { isIsoDay } from '../shared/session-date.js';

export const LEADER_EARNINGS_SESSIONS = 10;
export const LEADER_EARNINGS_PREFIX = '다음 주도주 실적: ';
const LEADERS = MARKET_MOVERS.filter((row) => row.market !== 'KR');
const SESSION_WORDS = Object.freeze({ bmo: '장 전', amc: '장 마감 후', dmh: '장중' });
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dayText = (date) => `${shortDate(date)}(${DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]})`;
const whenText = (row) => `${dayText(row.date)}${SESSION_WORDS[row.hour] ? ` ${SESSION_WORDS[row.hour]}` : ''}`;

/**
 * The leaders' next reports, earliest first: [{ symbol, name, date, hour }] (`name` the Korean name the list carries).
 * @param {object|null} calendar earnings-calendar.json
 * @param {{ nowMs?: number, sessions?: number }} [options]
 */
export function leaderEarnings(calendar, { nowMs = Date.now(), sessions = LEADER_EARNINGS_SESSIONS } = {}) {
  const today = dateInTimezone(nowMs, 'America/New_York');
  if (!today) return [];
  const rows = Array.isArray(calendar?.earnings) ? calendar.earnings : [];
  const upcoming = calendar?.upcoming && typeof calendar.upcoming === 'object' ? calendar.upcoming : {};
  const out = [];
  for (const leader of LEADERS) {
    const own = rows.filter((row) => String(row?.symbol || '').toUpperCase() === leader.sym);
    const [date, hour] = String(upcoming[leader.sym] || '').split('|');
    const candidates = [...own, ...(date ? [{ symbol: leader.sym, date, hour: hour || null }] : [])]
      .filter((row) => isIsoDay(String(row.date || '')) && reportedNumber(row.epsActual) == null && reportedNumber(row.revenueActual) == null)
      // A date with a reported row is that report, whichever list also carries it.
      .filter((row) => !own.some((done) => done.date === row.date && (reportedNumber(done.epsActual) != null || reportedNumber(done.revenueActual) != null)))
      .filter((row) => earningsFilterMs(row) > nowMs && (row.date <= today || countOpenSessionsBetween(today, row.date, 'US') <= sessions))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = candidates[0];
    if (next) out.push({ symbol: leader.sym, name: leader.nameKo || leader.sym, date: next.date, hour: SESSION_WORDS[next.hour] ? next.hour : null });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
}

/**
 * 오늘's 다음 일정 items: one per report session (the same date and hour join), shaped like the week list's earnings
 * items ({ kind, date, when, names, title, why }) plus `symbols`.
 */
export function leaderAheadItems(calendar, options = {}) {
  const sessions = new Map();
  for (const row of leaderEarnings(calendar, options)) {
    const key = `${row.date}|${row.hour || ''}`;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(row);
  }
  return [...sessions.values()].map((rows) => {
    const names = rows.map((row) => row.name).join(' · ');
    return { kind: 'earnings', date: rows[0].date, when: whenText(rows[0]), names, title: `${names} 실적`, symbols: rows.map((row) => row.symbol),
      why: '주도주 실적이라 결과가 같은 업종과 지수의 다음 방향에 바로 들어옵니다.' };
  });
}

/** The opening's AI fact line: one line naming each leader's next report, or none. */
export function leaderEarningsFactLines(calendar, options = {}) {
  const rows = leaderEarnings(calendar, options);
  return rows.length ? [`${LEADER_EARNINGS_PREFIX}${rows.map((row) => `${row.name}(${row.symbol}) ${whenText(row)}`).join(' · ')}`] : [];
}
