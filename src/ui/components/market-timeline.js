// 2026-10-19 cadence redesign: the briefing's 시간대별 시황. The 24h macro read above stays as it is; this section lists
// the six-hour KST slots (06·12·18·24시) — the one in progress first, then each sealed slot, newest open and the rest
// folded — so a slot the reader missed is still there after the next one lands. No data, no section.
import { buildMarketTimelineView } from '../../domain/market/market-timeline.js';
import { moveHeadlineRows } from '../../domain/briefing/news-picks.js';
import { fixKoreanTerms } from '../../domain/briefing/headline-terms.js';
import { selectNewsItems } from '../../state/selectors/news.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { asOfChip } from './section-frame.js';

// v58.75 (persona review): "왜 움직였나" — beside the stocks and themes 오늘 names as the session's movers, the headline
// that named the company the same day (src/domain/briefing/news-picks.js), with its time; the publisher sits in the hover.
// Shared by 오늘 (matched rows only) and 브리핑 (every mover, '관련 보도 없음' when none). One owner for both lists.
// v58.75 review: symbol → company name, rebuilt when SCREENER_DB arrives or changes — an empty map cached before the
// universe loaded kept name matching off for the whole session.
export function symbolNames(root) {
  const db = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : null;
  if (root?._aioSymNamesFor === db && root?._aioSymNames) return root._aioSymNames;
  const names = Object.fromEntries((db || []).filter((row) => row?.sym && row?.name).map((row) => [row.sym, row.name]));
  if (root) { root._aioSymNames = names; root._aioSymNamesFor = db; }
  return names;
}

export function moveNewsRows(root, store, flow) {
  if (!flow?.available || !flow.themes?.available) return [];
  const timeline = root?._serverMarketTimeline || {};
  const news = [...selectNewsItems(store?.getState?.() || {}), ...(Array.isArray(root?._serverNewsIntraday) ? root._serverNewsIntraday : []),
    ...(timeline.current?.headlines || []), ...(Array.isArray(timeline.slots) ? timeline.slots : []).flatMap((slot) => slot?.headlines || [])];
  const names = symbolNames(root);
  return moveHeadlineRows(flow.themes, { session: flow.session, news, telegram: Array.isArray(root?.AIO_TELEGRAM_CURRENT_ITEMS) ? root.AIO_TELEGRAM_CURRENT_ITEMS : [], names });
}

const kstStamp = (ms) => {
  const d = new Date(ms + 9 * 3600000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/** One list of mover rows; `showMissing` keeps a mover without a headline as '관련 보도 없음'. Returns the list or null. */
export function moveNewsList(doc, root, rows, { showMissing = false, max = 8, listClass = 'market-slot-news', timeClass = 'market-slot-news-time', titleClass = 'market-slot-news-title' } = {}) {
  const shown = rows.filter((row) => showMissing || row.headline).slice(0, max);
  if (!shown.length) return null;
  const list = el(doc, 'ul', null, listClass);
  for (const row of shown) {
    const item = el(doc, 'li');
    const move = `${row.label} ${signedText(row.move, 1, '%')}`;
    item.append(el(doc, 'span', move, timeClass));
    const hit = row.headline;
    if (!hit) {
      item.append(el(doc, 'span', '같은 날 관련 보도 없음', titleClass));
      list.append(item);
      continue;
    }
    const isChannel = hit.kind === 'telegram';
    let text = isChannel ? hit.text : '';
    if (!isChannel) {
      try { text = typeof root?.getDisplayTitle === 'function' ? root.getDisplayTitle(hit.row) : ''; } catch (_) { text = ''; }
      if (!/[가-힣]/.test(text) && /[가-힣]/.test(hit.row.titleKo || hit.row.ko_title || '')) text = hit.row.titleKo || hit.row.ko_title;
      text = fixKoreanTerms(hit.row.title, text || hit.row.title || '');
    }
    const member = row.kind === 'theme' && row.symbol ? `구성 종목 ${row.symbol}${Number.isFinite(row.memberMove) ? ` ${signedText(row.memberMove, 1, '%')}` : ''}, ` : '';
    const href = safeUrl(isChannel ? hit.row.url : hit.row.link || hit.row.url);
    const title = el(doc, href ? 'a' : 'span', `${kstStamp(hit.publishedMs)} ${member}${isChannel ? '채널 글, ' : ''}${text}`, titleClass);
    if (href) { title.href = href; title.target = '_blank'; title.rel = 'noopener noreferrer'; }
    title.title = isChannel ? `텔레그램 공개 채널 @${hit.row.channel || ''}, 앱이 확인한 사실이 아닙니다` : [hit.row.source, hit.row.title].filter(Boolean).join(', ');
    item.append(title);
    list.append(item);
  }
  return list;
}

// v58.53 개편 v2: the slot styles moved from an injected <style> into src/ui/styles/v2-today.css (12px floor, soft cards).

// v59.51 (content audit): 브리핑 says what the close means and 뉴스 what was said, so the six-hour slots live on 뉴스 as one
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
  const heading = el(doc, 'summary', '시간대별 시황 ', 'briefing-h2');
  heading.id = 'news-timeline-title';
  heading.append(asOfChip(doc, '하루 4회차', '한국 시간 06·12·18·24시 회차, 지난 회차 보관'));
  const rows = el(doc, 'div');
  rows.id = 'news-timeline-rows';
  section.append(heading, rows);
  anchor.before(section);
  return section;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return /^https?:$/i.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch (_) {
    return '';
  }
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
    // Sources stay off the screen text (owner 2026-10-06): publisher and original title live in the hover.
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
    summary.append(el(doc, 'span', slot.summarySource === 'ai' ? 'AI 요약' : '자동 요약', 'market-slot-tag'), doc.createTextNode(` ${slot.summary}`));
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
  // v58.53: a re-render keeps the slots the reader opened or closed; only a first paint opens the newest one.
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
