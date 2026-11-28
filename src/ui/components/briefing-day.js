// 브리핑's 움직인 것 section: the last session's stories as a timeline. The face carries the opening line (both markets,
// with the equal-weight index read against the index) and the lead/major stories — the rank and weight on the left, the
// title, what moved in small type and why on an indented line; the largest of the smaller stories follow, smaller, under
// 그 밖에 움직인 것; the reports behind a story and the after-report moves open in folds.
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market/day/one-session.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';
import { reportLine, causeRow } from './home-day.js';
import { dayCause, CAUSE_WORDS } from '../../domain/market/day/day-cause.js';
import { BRIEFING_REPORT_WORDS as W } from '../../domain/content/briefing-report-words.js';
import { EVENT_BRIEFS, MARKET_DAY, INDEX_LONGRUN } from '../../data/artifact-registry.js';

const MORE_ON_FACE = 3;

function fold(doc, summary, children, className = 'sx-disclosure briefing-day-fold') {
  const node = el(doc, 'details', null, className);
  node.append(el(doc, 'summary', summary), ...children);
  return node;
}

function storyItem(doc, story) {
  const item = el(doc, 'li', null, `br-timeline__item is-${story.rank}`);
  item.dataset.story = story.id;
  const when = el(doc, 'div', null, 'br-timeline__when');
  when.append(el(doc, 'span', W.rank[story.rank] || '', 'br-timeline__rank'), storyWeight(doc, story));
  const body = el(doc, 'div', null, 'br-timeline__body');
  body.append(el(doc, 'h3', story.title, 'br-timeline__title'));
  if (story.line) body.append(el(doc, 'p', story.line, 'br-timeline__context'));
  if (story.why.length) body.append(el(doc, 'p', `→ ${story.why.join(' ')}`, 'br-timeline__why'));
  item.append(when, body);
  // A lead story's top linked report stands on the face under the move, as written; the rest stay folded.
  if (story.report) body.append(reportLine(doc, story.report, 'br-timeline__report', 'p'));
  const folded = story.report ? story.evidence.slice(1) : story.evidence;
  if (folded.length) {
    const list = el(doc, 'ul', null, 'briefing-day-evidence');
    for (const report of folded) {
      const row = el(doc, 'li', report.title);
      if (report.original) row.title = report.original;
      list.append(row);
    }
    body.append(fold(doc, `${story.report ? '다른 보도' : '관련 보도'} ${folded.length}건`, [list], 'briefing-day-evidence-fold'));
  }
  return item;
}

export function renderBriefingDay({ documentRef: doc, root }) {
  const section = doc?.getElementById('briefing-day');
  if (!section) return;
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  // The event briefs tell which big moves were a company's own report (TEAM 11/6); they arrive on their own.
  const briefs = root?.[EVENT_BRIEFS.key] || null;
  if (root && !briefs) refreshSharedArtifact(root, EVENT_BRIEFS).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  // The closes and the long-run tables rank the leading index's move in the opening line (day-account rankSaid).
  const longrun = root?.[INDEX_LONGRUN.key] || null;
  if (root && !longrun) refreshSharedArtifact(root, INDEX_LONGRUN).then(({ changed }) => { if (changed) renderBriefingDay({ documentRef: doc, root }); }).catch(() => {});
  const sessionDay = oneSessionDay(day, root?._aioHistory);
  const account = buildDayAccount(sessionDay, { briefs, history: root?._aioHistory || null, longrun }); // v59.70 (re-review 7·8)
  section.hidden = !account.available;
  if (!account.available) return;
  const key = `${day.generatedAt}|${briefs?.generatedAt || ''}|${longrun?.generatedAt || ''}|${root?._aioHistory?.at?.(-1)?.date || ''}`;
  if (section.dataset.renderKey === key) return;
  section.dataset.renderKey = key;
  // the section carries its own session — the same label 오늘's 오늘의 핵심 prints (buildDayAccount
  // asOf) — since the kicker names the index close, which can be a session later than these movers.
  const title = doc.getElementById('briefing-day-title');
  let chip = section.querySelector('.br-section__note');
  if (account.asOf && title) {
    if (!chip) { chip = el(doc, 'span', null, 'br-section__note'); title.after(chip); }
    chip.textContent = account.asOf;
  } else chip?.remove();
  const opening = doc.getElementById('briefing-day-opening');
  if (opening) opening.textContent = account.opening;
  doc.getElementById('briefing-day-stories')?.replaceChildren(...account.stories.map((story) => storyItem(doc, story)));
  const folds = [];
  // The cause verdicts the stories do not already show: each release with the yields, a theme that was one sub-theme's
  // move, and the headlines held or excluded as causes (with why).
  const causes = dayCause(sessionDay).candidates.filter((row) => row.kind === 'release' || row.reason === 'part-only' || (row.kind === 'headline' && row.result !== 'attributed' && row.title));
  if (causes.length) {
    const list = el(doc, 'ul', null, 'br-day__more-list');
    list.append(...causes.map((row) => causeRow(doc, row)));
    folds.push(el(doc, 'h3', CAUSE_WORDS.label, 'br-day__more-title'), list);
  }
  const nameOf = (row) => (String(row.label || '').includes('(') ? `${row.label} ${row.sym}` : `${row.label}(${row.sym})`);
  // Analysis, so on the face: the largest few of the smaller stories (account.more is in materiality order), then the
  // large moves no report or price explains, told as moves. The ledger's bookkeeping ("이유가
  // 확인되지 않은 큰 움직임 N건", how many facts it read) is not drawn.
  const others = [...account.more.slice(0, MORE_ON_FACE).map((story) => `${story.title}: ${[story.line, ...story.why].filter(Boolean).join(' ')}`),
    ...account.unexplained.map((row) => `${nameOf(row)} ${signedText(row.change, 1, '%')}${row.rvol != null ? `, 거래량 ${row.rvol.toFixed(1)}배` : ''}`)];
  if (others.length) {
    const list = el(doc, 'ul', null, 'br-day__more-list');
    for (const text of others) list.append(el(doc, 'li', text));
    folds.push(el(doc, 'h3', W.sections.more, 'br-day__more-title'), list);
  }
  if (account.reported.length) {
    const list = el(doc, 'ul', null, 'br-day__more-list');
    for (const row of account.reported) list.append(el(doc, 'li', `${nameOf(row)} ${signedText(row.change, 1, '%')}${row.headline ? `, ${row.headline}` : ''}`));
    folds.push(fold(doc, `실적 발표 뒤 움직임 ${account.reported.length}건`, [list]));
  }
  doc.getElementById('briefing-day-folds')?.replaceChildren(...folds);
}
