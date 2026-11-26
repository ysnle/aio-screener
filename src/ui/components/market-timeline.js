// 2026-10-19 cadence redesign: the briefing's 시간대별 시황. The 24h macro read above stays as it is; this section lists
// the six-hour KST slots (06·12·18·24시) — the one in progress first, then each sealed slot, newest open and the rest
// folded — so a slot the reader missed is still there after the next one lands. No data, no section.
import { buildMarketTimelineView } from '../../domain/market/story/market-timeline.js';
import { el } from './dom.js';
import { safeUrl } from './move-news.js';
import { asOfChip } from './section-frame.js';
import { dropReaderDuty } from '../../domain/content/reader-duty.js';

// 브리핑 says what the close means and 뉴스 what was said, so the six-hour slots live on 뉴스 as one
// closed fold before 전체 뉴스. The in-progress slot's headlines were the same items as 뉴스's '08:00 이후 속보' list and are
// not drawn twice; the sealed slots keep their summary, index moves and headlines.
function ensureSection(doc) {
  let section = doc.getElementById('news-timeline');
  if (section) return section;
  const page = doc.getElementById('page-market-news');
  const anchor = doc.getElementById('news-feed-card');
  if (!page || !anchor) return null;
  section = el(doc, 'details', null, 'aio-section briefing-block sx-card news-card news-timeline');
  section.id = 'news-timeline';
  section.dataset.viewOpen = ''; // the 시황 view's content (page-views.css)
  section.open = true;
  const heading = el(doc, 'summary', '시간대별 시황 ', 'briefing-h2');
  heading.id = 'news-timeline-title';
  heading.append(asOfChip(doc, '하루 4번', '한국 시간 06·12·18·24시 회차, 지난 회차 보관'));
  const rows = el(doc, 'div');
  rows.id = 'news-timeline-rows';
  section.append(heading, rows);
  anchor.before(section);
  return section;
}

function headlineList(doc, rows) {
  const list = el(doc, 'ul', null, 'market-slot-news');
  for (const row of rows) {
    const item = el(doc, 'li');
    const time = el(doc, 'time', row.time, 'market-slot-news-time');
    time.dateTime = new Date(row.publishedMs).toISOString();
    const href = safeUrl(row.link);
    const title = el(doc, href ? 'a' : 'span', `${row.unconfirmed ? '[미확인] ' : ''}${row.title}`, 'market-slot-news-title');
    if (href) { title.href = href; title.target = '_blank'; title.rel = 'noopener noreferrer'; }
    // Sources stay off the screen text: publisher and original title live in the hover.
    title.title = [row.source, row.originalTitle].filter(Boolean).join(', ');
    item.append(time, title);
    list.append(item);
  }
  return list;
}

function slotBody(doc, slot) {
  const body = el(doc, 'div', null, 'market-slot-body');
  if (slot.summary) {
    const summary = el(doc, 'p', null, 'market-slot-summary');
    summary.append(el(doc, 'span', slot.summarySource === 'ai' ? 'AI 요약' : '자동 요약', 'market-slot-tag'), doc.createTextNode(` ${dropReaderDuty(slot.summary)}`));
    body.append(summary);
  }
  if (slot.moves.length) {
    const moves = el(doc, 'ul', null, 'market-slot-moves');
    moves.setAttribute('aria-label', '직전 회차 대비 움직인 지표');
    for (const move of slot.moves) {
      const chip = el(doc, 'li', null, 'market-slot-move');
      chip.append(el(doc, 'span', move.label, 'market-slot-move-label'), el(doc, 'span', move.text, 'market-slot-move-value'));
      moves.append(chip);
    }
    body.append(moves);
  }
  if (slot.headlines.length) body.append(headlineList(doc, slot.headlines));
  else body.append(el(doc, 'p', slot.newsUnavailable ? '이 회차는 헤드라인 수집에 실패했습니다.' : '이 시간대에 수집된 주요 헤드라인이 없습니다.', 'briefing-empty'));
  const foot = [slot.sealedAt ? `${slot.sealedAt} 집계` : null, slot.late ? '지연 집계, 지표는 집계 시점 값' : null, slot.marksMissing ? '지표 기록 없음' : null].filter(Boolean).join(', ');
  if (foot) body.append(el(doc, 'p', foot, 'market-slot-foot'));
  return body;
}

export function renderMarketTimeline({ documentRef: doc, root, nowMs = Date.now() }) {
  if (!doc?.getElementById) return null;
  const view = buildMarketTimelineView(root?._serverMarketTimeline, nowMs);
  if (!view.available) {
    const existing = doc.getElementById('news-timeline');
    if (existing) existing.hidden = true;
    return view;
  }
  const section = ensureSection(doc);
  const host = doc.getElementById('news-timeline-rows');
  if (!section || !host) return null;
  section.hidden = false;
  // A re-render keeps the slots the reader opened or closed; only a first paint opens the newest one.
  const opened = new Set([...host.querySelectorAll('details.market-slot')].filter((node) => node.open).map((node) => node.dataset.slotId));
  const painted = host.querySelector('details.market-slot') != null;
  const nodes = [];
  if (view.overdue) nodes.push(el(doc, 'p', `${view.expectedEndLabel} 회차 집계가 늦어지고 있습니다. 아래는 직전까지 정리된 회차입니다.`, 'market-slot-overdue'));
  let first = true;
  for (const group of view.groups) {
    nodes.push(el(doc, 'h3', group.label, 'market-slot-day'));
    for (const slot of group.slots) {
      const details = el(doc, 'details', null, 'market-slot');
      details.dataset.slotId = slot.id;
      if (painted ? opened.has(slot.id) : first) details.open = true;
      first = false;
      const summary = el(doc, 'summary', null, 'market-slot-head');
      summary.append(el(doc, 'span', `${slot.endLabel} 회차`, 'market-slot-state'), el(doc, 'span', slot.label, 'market-slot-label'),
        el(doc, 'span', [`헤드라인 ${slot.headlines.length}건`, slot.moves[0] ? `${slot.moves[0].label} ${slot.moves[0].text}` : null].filter(Boolean).join(', '), 'market-slot-meta'));
      details.append(summary, slotBody(doc, slot));
      nodes.push(details);
    }
  }
  host.replaceChildren(...nodes);
  return view;
}
