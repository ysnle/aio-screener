// v59.65 (owner 2026-11-03, phase 3): 브리핑's 지난 24시간 section. The face carries the opening line (both markets, with the
// equal-weight index read against the index) and the lead/major stories, each one sentence of what moved and one of why;
// the reports behind a story, the smaller stories and the big moves nothing explains open in folds.
import { MARKET_DAY, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market-day/one-session.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';

function fold(doc, summary, children, className = 'sx-disclosure briefing-day-fold') {
  const node = el(doc, 'details', null, className);
  node.append(el(doc, 'summary', summary), ...children);
  return node;
}

function storyItem(doc, story) {
  const item = el(doc, 'li', null, `briefing-day-story is-${story.rank}`);
  item.dataset.story = story.id;
  const head = el(doc, 'div', null, 'briefing-day-story__head');
  head.append(el(doc, 'h3', story.title, 'briefing-day-story__title'), storyWeight(doc, story));
  item.append(head, el(doc, 'p', [story.line, ...story.why].filter(Boolean).join(' '), 'briefing-day-story__line'));
  if (story.evidence.length) {
    const list = el(doc, 'ul', null, 'briefing-day-evidence');
    for (const report of story.evidence) {
      const row = el(doc, 'li', report.title);
      if (report.original) row.title = report.original;
      list.append(row);
    }
    item.append(fold(doc, `관련 보도 ${story.evidence.length}건`, [list], 'briefing-day-evidence-fold'));
  }
  return item;
}

export function renderBriefingDay({ documentRef: doc, root }) {
  const section = doc?.getElementById('briefing-day');
  if (!section) return;
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  const account = buildDayAccount(oneSessionDay(day, root?._aioHistory)); // v59.70 (re-review 7·8)
  section.hidden = !account.available;
  if (!account.available) return;
  const key = `${day.generatedAt}`;
  if (section.dataset.renderKey === key) return;
  section.dataset.renderKey = key;
  // v59.68: the page subtitle names the close once; the section heads carry no date of their own.
  const opening = doc.getElementById('briefing-day-opening');
  if (opening) opening.textContent = account.opening;
  doc.getElementById('briefing-day-stories')?.replaceChildren(...account.stories.map((story) => storyItem(doc, story)));
  const folds = [];
  if (account.more.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const story of account.more) list.append(el(doc, 'li', `${story.title}: ${[story.line, ...story.why].filter(Boolean).join(' ')}`));
    folds.push(fold(doc, `그 밖에 움직인 것 ${account.more.length}건`, [list]));
  }
  if (account.unexplained.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const row of account.unexplained) list.append(el(doc, 'li', `${String(row.label || '').includes('(') ? `${row.label} ${row.sym}` : `${row.label}(${row.sym})`} ${signedText(row.change, 1, '%')}${row.rvol != null ? `, 거래량 ${row.rvol.toFixed(1)}배` : ''}`)); // v59.71: unexplained moves carry their turnover
    folds.push(fold(doc, `이유가 확인되지 않은 큰 움직임 ${account.unexplained.length}건`, [el(doc, 'p', '관련 보도나 같이 움직인 업종·가격이 없는 움직임입니다. 원인이 나오기 전까지는 추측하지 않습니다.', 'briefing-day-note'), list]));
  }
  const { facts, lead, major, noise } = account.coverage;
  folds.push(el(doc, 'p', `${facts}건 · 핵심 ${lead} · 주요 ${major}`, 'briefing-day-coverage'));
  doc.getElementById('briefing-day-folds')?.replaceChildren(...folds);
}
