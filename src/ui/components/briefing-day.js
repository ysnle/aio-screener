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
  // A lead story's top linked report stands on the face under the move, as written; the rest stay folded.
  if (story.report) {
    const line = el(doc, 'p', `관련 보도: ${story.report.title}`, 'briefing-day-story__report');
    if (story.report.original) line.title = story.report.original;
    item.append(line);
  }
  const folded = story.report ? story.evidence.slice(1) : story.evidence;
  if (folded.length) {
    const list = el(doc, 'ul', null, 'briefing-day-evidence');
    for (const report of folded) {
      const row = el(doc, 'li', report.title);
      if (report.original) row.title = report.original;
      list.append(row);
    }
    item.append(fold(doc, `${story.report ? '다른 보도' : '관련 보도'} ${folded.length}건`, [list], 'briefing-day-evidence-fold'));
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
  const nameOf = (row) => (String(row.label || '').includes('(') ? `${row.label} ${row.sym}` : `${row.label}(${row.sym})`);
  // Analysis, so on the face: the largest few of the smaller stories (account.more is in materiality order), then the
  // large moves no report or price explains, told as moves. The ledger's bookkeeping ("이유가
  // 확인되지 않은 큰 움직임 N건", how many facts it read) is not drawn.
  const others = [...account.more.slice(0, MORE_ON_FACE).map((story) => `${story.title}: ${[story.line, ...story.why].filter(Boolean).join(' ')}`),
    ...account.unexplained.map((row) => `${nameOf(row)} ${signedText(row.change, 1, '%')}${row.rvol != null ? `, 거래량 ${row.rvol.toFixed(1)}배` : ''}`)];
  if (others.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const text of others) list.append(el(doc, 'li', text));
    folds.push(el(doc, 'h3', '그 밖에 움직인 것', 'briefing-day-more-title'), list);
  }
  if (account.reported.length) {
    const list = el(doc, 'ul', null, 'briefing-day-more');
    for (const row of account.reported) list.append(el(doc, 'li', `${nameOf(row)} ${signedText(row.change, 1, '%')}${row.headline ? `, ${row.headline}` : ''}`));
    folds.push(fold(doc, `실적 발표 뒤 움직임 ${account.reported.length}건`, [list]));
  }
  doc.getElementById('briefing-day-folds')?.replaceChildren(...folds);
}
