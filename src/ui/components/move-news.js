// "왜 움직였나": a move beside the report that named the company the same session (src/domain/briefing/news-picks.js),
// with its time; the publisher sits in the hover. One definition for every screen that prints a move with its report:
// 오늘 and 브리핑 (the session's movers), 종목 (the header move) and 포트폴리오 (a held stock's move).
import { headlineForCompany, moveHeadlineRows } from '../../domain/briefing/news-picks.js';
import { fixKoreanTerms } from '../../domain/briefing/headline-terms.js';
import { selectNewsItems } from '../../state/selectors/news.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';

// Symbol → company name, rebuilt when SCREENER_DB arrives or changes — an empty map cached before the
// universe loaded kept name matching off for the whole session.
export function symbolNames(root) {
  const db = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : null;
  if (root?._aioSymNamesFor === db && root?._aioSymNames) return root._aioSymNames;
  const names = Object.fromEntries((db || []).filter((row) => row?.sym && row?.name).map((row) => [row.sym, row.name]));
  if (root) { root._aioSymNames = names; root._aioSymNamesFor = db; }
  return names;
}

// Every report a session's move can be matched against: the news store, the intraday feed and the six-hour slots.
function sessionReports(root, store) {
  const timeline = root?._serverMarketTimeline || {};
  return {
    news: [...selectNewsItems(store?.getState?.() || {}), ...(Array.isArray(root?._serverNewsIntraday) ? root._serverNewsIntraday : []),
      ...(timeline.current?.headlines || []), ...(Array.isArray(timeline.slots) ? timeline.slots : []).flatMap((slot) => slot?.headlines || [])],
    telegram: Array.isArray(root?.AIO_TELEGRAM_CURRENT_ITEMS) ? root.AIO_TELEGRAM_CURRENT_ITEMS : [], signals: root?.AIO_TELEGRAM_SIGNALS || []
  };
}
const aliasesOf = (root) => (sym) => [root?.AIO_TICKER_NAME_REGISTRY?.entries?.[sym]?.kr];

export function moveNewsRows(root, store, flow) {
  if (!flow?.available || !flow.themes?.available) return [];
  return moveHeadlineRows(flow.themes, { session: flow.session, ...sessionReports(root, store), names: symbolNames(root), aliasesOf: aliasesOf(root) });
}

/** One company's move on `session` as a mover row (moveNewsList draws it), with the report that named it or null. */
export function companyMoveRow(root, store, { symbol, name = '', move, session }) {
  const headline = headlineForCompany({ symbol, name: name || symbolNames(root)[symbol] || '', move, aliases: aliasesOf(root)(symbol) }, { session, ...sessionReports(root, store) });
  return { kind: 'stock', label: `${Number(String(session).slice(5, 7))}/${Number(String(session).slice(8, 10))}`, move, symbol, headline };
}

const kstStamp = (ms) => {
  const d = new Date(ms + 9 * 3600000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/** An http(s) link without credentials, else ''. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return /^https?:$/i.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch (_) {
    return '';
  }
}

/**
 * One list of mover rows; `showMissing` keeps a mover without a report about its move (reportAboutMove), followed by
 * `missingText` when one is given. Returns the list or null.
 */
export function moveNewsList(doc, root, rows, { showMissing = false, missingText = '', max = 8, listClass = 'market-slot-news', timeClass = 'market-slot-news-time', titleClass = 'market-slot-news-title' } = {}) {
  const shown = rows.filter((row) => showMissing || row.headline).slice(0, max);
  if (!shown.length) return null;
  const list = el(doc, 'ul', null, listClass);
  for (const row of shown) {
    const item = el(doc, 'li');
    const move = `${row.label} ${signedText(row.move, 1, '%')}`;
    item.append(el(doc, 'span', move, timeClass));
    const hit = row.headline;
    if (!hit) {
      if (missingText) item.append(el(doc, 'span', missingText, titleClass));
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
    const title = el(doc, href ? 'a' : 'span', `${kstStamp(hit.publishedMs)} ${member}${text}`, titleClass);
    if (href) { title.href = href; title.target = '_blank'; title.rel = 'noopener noreferrer'; }
    title.title = isChannel ? `텔레그램 공개 채널 @${hit.row.channel || ''}, 앱이 확인한 사실이 아닙니다` : [hit.row.source, hit.row.title].filter(Boolean).join(', ');
    item.append(title);
    list.append(item);
  }
  return list;
}
