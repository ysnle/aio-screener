// The next reports of the market's leading names: the companies of the market-mover list (market-movers.js, the list
// 시장 상태's week calls 주도주 목록) with a US report in the earnings calendar inside the next LEADER_EARNINGS_SESSIONS
// US sessions. Two readers: 오늘's 다음 일정 (items shaped like buildMarketStory().week's) and the opening's AI fact lines.
// The calendar's `earnings` rows hold the current week with results; `upcoming` maps a symbol to its next date beyond it
// ("YYYY-MM-DD|hour"). A row with a result, or whose report time has passed, is not next. No row, no item.
// nextEarnings is the one finder of a company's next report; the stock page's earnings line reads it too.
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
/** A report's day and session as the schedule prints it: '12/9(수) 장 마감 후'. */
export const whenText = (row) => `${dayText(row.date)}${SESSION_WORDS[row.hour] ? ` ${SESSION_WORDS[row.hour]}` : ''}`;

/**
 * The leaders' next reports, earliest first: [{ symbol, name, date, hour }] (`name` the Korean name the list carries).
 * @param {object|null} calendar earnings-calendar.json
 * @param {{ nowMs?: number, sessions?: number }} [options]
 */
export function leaderEarnings(calendar, { nowMs = Date.now(), sessions = LEADER_EARNINGS_SESSIONS } = {}) {
  const out = [];
  for (const leader of LEADERS) {
    const next = nextEarnings(calendar, leader.sym, { nowMs, sessions });
    if (next) out.push({ symbol: leader.sym, name: leader.nameKo || leader.sym, ...next });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
}

/**
 * One company's next report in the calendar: { date, hour } (hour a SESSION_WORDS key or null), or null. `sessions`
 * bounds how many US sessions ahead it may be (Infinity: any future date the calendar carries).
 * @param {object|null} calendar earnings-calendar.json
 * @param {string} symbol
 * @param {{ nowMs?: number, sessions?: number }} [options]
 */
export function nextEarnings(calendar, symbol, { nowMs = Date.now(), sessions = Infinity } = {}) {
  const sym = String(symbol || '').toUpperCase();
  const today = dateInTimezone(nowMs, 'America/New_York');
  if (!sym || !today) return null;
  const rows = Array.isArray(calendar?.earnings) ? calendar.earnings : [];
  const upcoming = calendar?.upcoming && typeof calendar.upcoming === 'object' ? calendar.upcoming : {};
  const own = rows.filter((row) => String(row?.symbol || '').toUpperCase() === sym);
  const [date, hour] = String(upcoming[sym] || '').split('|');
  const next = [...own, ...(date ? [{ symbol: sym, date, hour: hour || null }] : [])]
    .filter((row) => isIsoDay(String(row.date || '')) && reportedNumber(row.epsActual) == null && reportedNumber(row.revenueActual) == null)
    // A date with a reported row is that report, whichever list also carries it.
    .filter((row) => !own.some((done) => done.date === row.date && (reportedNumber(done.epsActual) != null || reportedNumber(done.revenueActual) != null)))
    .filter((row) => earningsFilterMs(row) > nowMs && (row.date <= today || sessions === Infinity || countOpenSessionsBetween(today, row.date, 'US') <= sessions))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { date: next.date, hour: SESSION_WORDS[next.hour] ? next.hour : null } : null;
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
