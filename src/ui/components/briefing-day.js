import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market/day/one-session.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';
import { asOfChip } from './section-frame.js';
import { EVENT_BRIEFS, MARKET_DAY, INDEX_LONGRUN } from '../../data/artifact-registry.js';

const MORE_ON_FACE = 3;

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
  const briefs = root?.[EVENT_BRIEFS.key] || null;
  if (root && !briefs) refreshSharedArtifact(root, EVENT_BRIEFS).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  const longrun = root?.[INDEX_LONGRUN.key] || null;
  if (root && !longrun) refreshSharedArtifact(root, INDEX_LONGRUN).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  const account = buildDayAccount(oneSessionDay(day, root?._aioHistory), { briefs, history: root?._aioHistory || null, longrun });
  section.hidden = !account.available;
  if (!account.available) return;
  const key = `${day.generatedAt}|${briefs?.generatedAt || ''}|${longrun?.generatedAt || ''}|${root?._aioHistory?.at?.(-1)?.date || ''}`;
  if (section.dataset.renderKey === key) return;
  section.dataset.renderKey = key;
  // the section carries its own session — the same label 오늘's 오늘의 핵심 prints (buildDayAccount
  // asOf) — since the page subtitle names the index close, which can be a session later than these movers.
  const title = doc.getElementById('briefing-day-title');
  let chip = section.querySelector(':scope > .aio-asof');
  if (account.asOf && title) {
    if (!chip) { chip = asOfChip(doc, account.asOf); title.after(chip); }
    chip.textContent = account.asOf;
  } else chip?.remove();
  const opening = doc.getElementById('briefing-day-opening');
  if (opening) opening.textContent = account.opening;
  doc.getElementById('briefing-day-stories')?.replaceChildren(...account.stories.map((story) => storyItem(doc, story)));
  const folds = [];
  // Analysis, so on the face: the largest few of the smaller stories (account.more is in materiality order).
  if (account.more.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const story of account.more.slice(0, MORE_ON_FACE)) list.append(el(doc, 'li', `${story.title}: ${[story.line, ...story.why].filter(Boolean).join(' ')}`));
    folds.push(el(doc, 'h3', '그 밖에 움직인 것', 'briefing-day-more-title'), list);
  }
  if (account.reported.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const row of account.reported) list.append(el(doc, 'li', `${String(row.label || '').includes('(') ? `${row.label} ${row.sym}` : `${row.label}(${row.sym})`} ${signedText(row.change, 1, '%')}${row.headline ? `, ${row.headline}` : ''}`));
    folds.push(fold(doc, `실적 발표 뒤 움직임 ${account.reported.length}건`, [list]));
  }
  if (account.unexplained.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const row of account.unexplained) list.append(el(doc, 'li', `${String(row.label || '').includes('(') ? `${row.label} ${row.sym}` : `${row.label}(${row.sym})`} ${signedText(row.change, 1, '%')}${row.rvol != null ? `, 거래량 ${row.rvol.toFixed(1)}배` : ''}`));
    folds.push(fold(doc, `이유가 확인되지 않은 큰 움직임 ${account.unexplained.length}건`, [el(doc, 'p', '관련 보도나 같이 움직인 업종·가격이 없는 움직임입니다. 원인이 나오기 전까지는 추측하지 않습니다.', 'briefing-day-note'), list]));
  }
  const { facts, lead, major, noise } = account.coverage;
  folds.push(el(doc, 'p', `확인한 발표·기사 ${facts}건 가운데 핵심 ${lead}건, 주요 ${major}건`, 'briefing-day-coverage'));
  doc.getElementById('briefing-day-folds')?.replaceChildren(...folds);
}
