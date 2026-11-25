// 오늘's 다음 일정, the hero's second column: the verdict is now, this is next. It is an index of 시장 상태's week list,
// not a copy — the dated items of buildMarketStory().week in its order, at most three, each with its why. The verdict
// column's link opens the full list. Daily watch items (credit, oil) stay on 시장 상태; they are conditions, not dates.
// Beside them, the leading names' next reports inside the next ten sessions (leader-earnings.js), which the week list's
// eight days and index-weight cut can leave out: whether a big report is coming is half of whether a move can last.
import { readMarketStory } from './market-story.js';
import { leaderAheadItems } from '../../domain/briefing/leader-earnings.js';
import { EARNINGS_CALENDAR } from '../../data/artifact-registry.js';
import { el } from './dom.js';

export const HOME_AHEAD_LIMIT = 3;
/** At most this many leader-report lines; the week's own items keep the rest of HOME_AHEAD_LIMIT + 1 lines (at least two). */
export const HOME_AHEAD_LEADER_LIMIT = 2;

const asLine = (item) => ({ kind: item.kind, when: item.when, title: item.kind === 'earnings' && item.names ? `${item.names} 실적` : item.title, why: item.why || '' });

/**
 * The dated items of the week list, as the one-line labels 오늘 shows, with the leaders' reports (`leaders`, from
 * leaderAheadItems) the week does not already name: at most HOME_AHEAD_LEADER_LIMIT of them, in date order with the rest.
 */
export function homeAheadItems(week, limit = HOME_AHEAD_LIMIT, leaders = []) {
  const dated = (Array.isArray(week) ? week : []).filter((item) => item && item.kind !== 'daily' && item.date && item.when);
  // A leader is left out when a line the week list would show without the leaders already names it.
  const named = (item) => dated.slice(0, limit).some((row) => row.kind === 'earnings' && String(row.names || row.title || '').split(' · ').some((name) => item.names.split(' · ').includes(name) || item.symbols?.includes(name)));
  const extra = (Array.isArray(leaders) ? leaders : []).filter((item) => item?.date && item.when && item.names && !named(item)).slice(0, HOME_AHEAD_LEADER_LIMIT);
  const own = dated.slice(0, extra.length ? Math.max(2, limit + 1 - extra.length) : limit);
  return [...own, ...extra].sort((a, b) => a.date.localeCompare(b.date) || (a.slot ?? 1) - (b.slot ?? 1)).map(asLine);
}

export function renderHomeAhead({ documentRef: doc, root, interpretation }) {
  const host = doc?.getElementById('home-ahead');
  if (!host) return null;
  const { key, build } = readMarketStory(root, interpretation, () => renderHomeAhead({ documentRef: doc, root, interpretation }));
  // readMarketStory has asked for the calendar; its rows are read here as they are now (a report leaves once its time passes).
  const leaders = leaderAheadItems(root?.[EARNINGS_CALENDAR.key] || null);
  const signature = `${key}|${leaders.map((item) => `${item.date}:${item.symbols.join(',')}`).join(';')}`;
  if (host.dataset.signature === signature) return host;
  host.dataset.signature = signature;
  const story = build();
  const items = story.available ? homeAheadItems(story.week, HOME_AHEAD_LIMIT, leaders) : [];
  host.hidden = !items.length;
  if (!items.length) { host.replaceChildren(); return host; }
  const list = el(doc, 'ol', null, 'home-ahead__list');
  for (const item of items) {
    const row = el(doc, 'li', null, 'home-ahead__item');
    row.dataset.kind = item.kind;
    row.append(el(doc, 'span', item.when, 'home-ahead__when'), el(doc, 'b', item.title, 'home-ahead__title'));
    // Why the date matters is the line that makes it more than a calendar; it is the same sentence 시장 상태 prints.
    if (item.why) row.append(el(doc, 'span', item.why, 'home-ahead__why'));
    list.append(row);
  }
  // No link of its own: the verdict column's 근거와 시나리오 → 시장 상태 opens the page whose first card holds this list.
  host.replaceChildren(el(doc, 'h2', '다음 일정', 'home-ahead__label'), list);
  return host;
}
