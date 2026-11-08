// 오늘's 다음 일정, the hero's second column: the verdict is now, this is next. It is an index of 시장 상태's week list,
// not a copy — the dated items of buildMarketStory().week in its order, at most three, each with its why. The verdict
// column's link opens the full list. Daily watch items (credit, oil) stay on 시장 상태; they are conditions, not dates.
import { readMarketStory } from './market-story.js';
import { el } from './dom.js';

export const HOME_AHEAD_LIMIT = 3;

/** The dated items of the week list, as the one-line labels 오늘 shows. */
export function homeAheadItems(week, limit = HOME_AHEAD_LIMIT) {
  return (Array.isArray(week) ? week : [])
    .filter((item) => item && item.kind !== 'daily' && item.date && item.when)
    .slice(0, limit)
    .map((item) => ({ kind: item.kind, when: item.when, title: item.kind === 'earnings' && item.names ? `${item.names} 실적` : item.title, why: item.why || '' }));
}

export function renderHomeAhead({ documentRef: doc, root, interpretation }) {
  const host = doc?.getElementById('home-ahead');
  if (!host) return null;
  const { key, build } = readMarketStory(root, interpretation, () => renderHomeAhead({ documentRef: doc, root, interpretation }));
  if (host.dataset.signature === key) return host;
  host.dataset.signature = key;
  const story = build();
  const items = story.available ? homeAheadItems(story.week) : [];
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
