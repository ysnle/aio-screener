// v59.70 (PLAN S13 ①): the 종목 가격 section's one line — why this stock moved on the latest session, read from the same
// 24-hour account as 브리핑 and 오늘 (buildDayAccount over market-day.json), so the three screens tell one story. A stock
// the ledger did not count as a material move gets no line; a counted move without a same-day report says so.
import { buildDayAccount } from '../briefing/day-account.js';
import { signedText } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';

const pct = (value) => signedText(value, 1, '%');
const korean = (text) => /[가-힣]/.test(String(text || ''));
const shortDate = (date) => (hasLeadingIsoDay(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

/** Pure: market-day.v1 + symbol → { date, change, text, kind } or null. */
export function whyMovedLine(day, symbol, account = null) {
  const sym = String(symbol || '').toUpperCase();
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const move = facts.filter((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!sym || !move || !Number.isFinite(move.change)) return null;
  const read = account || buildDayAccount(day);
  const stories = [...(read.stories || []), ...(read.more || [])];
  const own = stories.find((story) => new RegExp(`:${sym.replace(/[.^$]/g, '\\$&')}(?::|$)`).test(story.id || ''));
  const group = own ? null : stories.find((story) => (story.related || []).some((row) => row.sym === sym));
  const lead = `${shortDate(move.date)} ${pct(move.change)}`;
  const report = (story) => (story?.evidence || []).find((item) => korean(item.title))?.title || '';
  if (own) {
    const why = report(own);
    // An earnings story's line already carries the price move; the lead keeps only the date.
    const text = own.kind === 'earnings' ? `${shortDate(move.date)} — ${own.title}, ${own.line}` : `${lead} — ${own.line}`;
    return { date: move.date, change: move.change, kind: own.kind, text: `${text}${why ? ` 같은 날 보도: ${why}` : ''}` };
  }
  // The group's own move (its median), without the list of other names.
  const median = String(group?.line || '').split(',')[0].replace(/\.$/, '');
  if (group) return { date: move.date, change: move.change, kind: 'group', text: `${lead} — ${group.title}과 함께 움직였습니다${median ? `(${median})` : ''}.` };
  return { date: move.date, change: move.change, kind: 'unexplained', text: `${lead} — 같은 날 이름이 나온 보도가 없습니다.` };
}
