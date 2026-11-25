// Who came back and who did not since the low a rebound started from: inside the theme that led the latest session, the
// sub-theme that regained the most and the one left furthest behind, the same for its most material stocks, and the two
// Korean memory names over the Korean sessions that answer the same US closes. An index that is up 5% from its low hides
// that its parts are not: a part still below the low is where the selling has not stopped. Read from the ledger's
// per-stock daily returns (market-day.json `recent`); every part is absent when its returns are.
import { RULES } from '../../rules/thresholds.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { returnBetween, medianBetween } from '../day/recent-returns.js';

const R = RULES.reboundSpread;
// The Korean memory makers the US chip rebound is compared with; listed, not inferred.
export const KOREA_MEMORY = Object.freeze([Object.freeze({ symbol: '000660.KS', label: 'SK하이닉스' }), Object.freeze({ symbol: '005930.KS', label: '삼성전자' })]);

const sinceLow = (subject, value, asOf, label) => claim({ subject, measure: 'sinceLow', asOf, figures: [{ value, unit: 'pct', basis: 'sinceLow', label }] });
const piece = (item, asOf) => say('{lab} {m}', { lab: item.label, m: sinceLow(item.subject, item.value, asOf, item.label) });
const byValue = (a, b) => b.value - a.value;

/**
 * @param {{day?: object|null, asOf: string, rebound?: object|null, index?: object|null}} input `index`: the opening's row
 *   of the leaders' index (its `episode` holds the low and the close).
 * @returns {{label: string, said: object, parts: string[], names: string[], korea: string[]}|null}
 */
export function reboundSpreadOf({ day = null, asOf, rebound = null, index = null } = {}) {
  const recent = day?.recent, low = rebound?.low?.date;
  if (!recent || !low || !(low < asOf) || day?.sessions?.us !== asOf || rebound.state === 'failed') return null;
  const facts = (Array.isArray(day.facts) ? day.facts : []).filter((fact) => fact?.date === asOf);
  const theme = facts.filter((fact) => fact.kind === 'group-move' && String(fact.id).startsWith('group:theme:') && Array.isArray(fact.parts))
    .sort((a, b) => Number(b.materiality || 0) - Number(a.materiality || 0))[0] || null;
  const parts = (theme?.parts || []).map((part) => ({ label: part.name, subject: `${theme.id}/${part.name}`, value: medianBetween(recent, part.members, 'US', low, asOf)?.value }))
    .filter((part) => Number.isFinite(part.value)).sort(byValue);
  const spread = parts.length >= 2 && parts[0].value - parts.at(-1).value >= R.gapPp ? [parts[0], parts.at(-1)] : [];
  const members = new Set(theme?.members || []);
  const names = facts.filter((fact) => fact.kind === 'stock-move' && members.has(fact.subjects?.[0]))
    .map((fact) => ({ label: fact.subjects[0], subject: `stock:${fact.subjects[0]}`, value: returnBetween(recent, fact.subjects[0], 'US', low, asOf)?.value, materiality: Number(fact.materiality || 0) }))
    .filter((name) => Number.isFinite(name.value)).sort((a, b) => b.materiality - a.materiality).slice(0, R.namesMax).sort(byValue);
  const koreaRead = KOREA_MEMORY.map((item) => ({ ...item, subject: `stock:${item.symbol}`, read: returnBetween(recent, item.symbol, 'US', low, asOf) })).filter((item) => item.read);
  const korea = koreaRead.map((item) => ({ ...item, value: item.read.value }));
  const sameSpan = korea.length && korea.every((item) => item.read.from === korea[0].read.from && item.read.to === korea[0].read.to);
  if (!spread.length && names.length < 2 && !korea.length) return null;
  const e = index?.episode;
  const whole = e?.low?.value > 0 && Number.isFinite(e.close)
    ? say('{d} 저점 뒤 {lab} {m}.', { d: shortDate(low), lab: index.label, m: sinceLow(index.id, (e.close / e.low.value - 1) * 100, asOf, index.label) })
    : say('{d} 저점 뒤.', { d: shortDate(low) });
  const said = sayJoin([
    whole,
    spread.length ? say('{theme} 안에서는 {best}로 가장 많이 되찾았고 {worst}로 가장 뒤처졌습니다.', { theme: theme.label, best: piece(spread[0], asOf), worst: piece(spread[1], asOf) }) : NOTHING,
    names.length >= 2 ? say('종목으로는 {list}.', { list: sayJoin(names.map((name) => piece(name, asOf)), ', ') }) : NOTHING,
    korea.length ? say(sameSpan ? '한국은 {list}({from} 종가부터 {to}까지).' : '한국은 {list}.', { list: sayJoin(korea.map((item) => piece(item, asOf)), ', '),
      from: sameSpan ? shortDate(korea[0].read.from) : '', to: sameSpan ? shortDate(korea[0].read.to) : '' }) : NOTHING
  ], ' ');
  return { label: '반등 뒤 갈린 곳', said, parts: spread.map((part) => part.label), names: names.map((name) => name.label), korea: korea.map((item) => item.symbol) };
}
