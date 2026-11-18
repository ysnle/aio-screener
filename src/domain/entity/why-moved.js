// v59.70 (PLAN S13 ①): the 종목 가격 section's one line — why this stock moved on the latest session, read from the same
// 24-hour account as 브리핑 and 오늘 (buildDayAccount over market-day.json), so the three screens tell one story. A stock
// the ledger did not count as a material move gets no line; a counted move without a same-day report says so.
import { buildDayAccount } from '../briefing/day-account.js';
import { signedText } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';

const pct = (value) => signedText(value, 1, '%');
const korean = (text) => /[가-힣]/.test(String(text || ''));
const OPINION = /짐\s*크라머|Jim Cramer|Motley Fool|모틀리 풀|Should You \b(?:Buy|Sell)\b|사야 할까|팔아야 할까/i;
const NY_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const newYorkDay = (iso) => { const ms = Date.parse(iso || ''); return Number.isFinite(ms) ? NY_DAY.format(ms) : ''; };
const previousDay = (day) => new Date(Date.parse(`${day}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const shortDate = (date) => (hasLeadingIsoDay(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

/**
 * Pure: market-day.v1 + symbol → { date, change, text, kind, theme } or null. `theme` = the stock's primary theme
 * (primary-theme.js), the same one the market line and the theme link on the page name. Without its own story the line names the primary theme's move that day when it went the same way; a story about
 * another group (the one that claimed the stock in the day account) is named with the primary theme beside it.
 */
export function whyMovedLine(day, symbol, account = null, { theme = null } = {}) {
  const sym = String(symbol || '').toUpperCase();
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const move = facts.filter((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!sym || !move || !Number.isFinite(move.change)) return null;
  const read = account || buildDayAccount(day);
  const stories = [...(read.stories || []), ...(read.more || [])];
  const own = stories.find((story) => new RegExp(`:${sym.replace(/[.^$]/g, '\\$&')}(?::|$)`).test(story.id || ''));
  const group = own ? null : stories.find((story) => (story.related || []).some((row) => row.sym === sym));
  const lead = `${shortDate(move.date)} ${pct(move.change)}`;
  const report = (story) => {
    // "같은 날 보도" quoted a Saturday 11/7 Jim Cramer column. A report explains the move
    // only when it was out by that session (its New York date is the move day or the day before); opinion columns never.
    for (const item of story?.evidence || []) {
      if (!korean(item.title) || OPINION.test(`${item.title} ${item.original || ''}`)) continue;
      const on = newYorkDay(item.at) || (hasLeadingIsoDay(item.date) ? item.date.slice(0, 10) : '');
      if (on === move.date) return { title: item.title, word: '같은 날 보도' };
      if (on && on === previousDay(move.date)) return { title: item.title, word: '전날 보도' };
    }
    return null;
  };
  if (own) {
    const why = report(own);
    // An earnings story's line already carries the price move; the lead keeps only the date.
    const text = own.kind === 'earnings' ? `${shortDate(move.date)} — ${own.title}, ${own.line}` : `${lead} — ${own.line}`;
    return { date: move.date, change: move.change, kind: own.kind, text: `${text}${why ? ` ${why.word}: ${why.title}` : ''}` };
  }
  const primary = theme?.id ? facts.find((fact) => fact.kind === 'group-move' && fact.group === `theme:${theme.id}` && fact.date === move.date && (fact.members || []).includes(sym)
    && Number.isFinite(fact.change) && Math.sign(fact.change) === Math.sign(move.change)) : null;
  if (primary) return { date: move.date, change: move.change, kind: 'group', theme: theme.id, text: `${lead} — ${theme.label} ${primary.change >= 0 ? '상승' : '하락'}과 함께 움직였습니다(업종 중간값 ${pct(primary.change)}).` };
  // The group's own move (its median), without the list of other names.
  const median = String(group?.line || '').split(',')[0].replace(/\.$/, '');
  const groupTheme = /^story:group:theme:([^:]+):/.exec(group?.id || '')?.[1] || null;
  const beside = theme?.label && groupTheme && groupTheme !== theme.id ? ` 이 종목의 테마는 '${theme.label}'이고, ${group.title.replace(/\s*(상승|하락)$/, '')}에도 속합니다.` : '';
  if (group) return { date: move.date, change: move.change, kind: 'group', theme: groupTheme, text: `${lead} — ${group.title}과 함께 움직였습니다${median ? `(${median})` : ''}.${beside}` };
  return { date: move.date, change: move.change, kind: 'unexplained', text: `${lead} — 같은 날 이름이 나온 보도가 없습니다.` };
}
