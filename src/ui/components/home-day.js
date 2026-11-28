// v59.67 (owner 2026-11-03, phase 5): 홈's 오늘의 핵심 — the short version of 브리핑's 24-hour account. The three most
// material stories, one line each, the day's top headlines, and the stocks that moved the most by the ledger's own ranking (a mega-cap's pull on the
// S&P 500 counts as much as a small name's surprise). The same model as 브리핑 (src/domain/briefing/day-account.js), so
// the two screens cannot disagree on what mattered.
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market/day/one-session.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';
import { frameHead } from './section-frame.js';
import { leadLinkedNews, pickImportantNews, rollingNewsPool } from '../../domain/briefing/news-picks.js';
import { groupNewsStories, selectIntradayNews } from '../../domain/news/stories.js';
import { usThenKorea } from '../../domain/market/session/session-time.js';
import { MARKET_DAY } from '../../data/artifact-registry.js';
import { dayCause, CAUSE_WORDS } from '../../domain/market/day/day-cause.js';

const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

/** A lead story's top linked report, as written (the original title on hover). `source-headline` marks the words as the
 *  outlet's, not the site's (the rendered-copy lint reads the site's own copy and skips headline nodes). */
export function reportLine(doc, report, className, tag = 'span') {
  const line = el(doc, tag, `관련 보도: ${report.title}`, `${className} source-headline`);
  if (report.original) line.title = report.original;
  return line;
}

/** One cause verdict (domain/market/day/day-cause.js): the result and its reason as a tag, the figures (a headline: its
 *  title as written), and the alternative a held release points to. */
export function causeRow(doc, row, tag = 'li') {
  const item = el(doc, tag, null, 'day-cause__row');
  const chip = el(doc, 'span', `${CAUSE_WORDS.result[row.result]} · ${CAUSE_WORDS.reason[row.reason] || ''}`, `sx-chip sx-chip--sm ${row.result === 'attributed' ? 'sx-chip--neutral' : 'sx-chip--warn'}`);
  const text = row.kind === 'headline' ? el(doc, 'span', row.title, 'source-headline') : el(doc, 'span', row.said.text);
  item.append(chip, ' ', text);
  if (row.alternative) item.append(el(doc, 'span', ` · ${CAUSE_WORDS.alternative} ${row.alternative.said.text}`));
  return item;
}

/** The day's material stock moves, ledger order, each once. */
export function keyStocks(day, limit = 8) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const seen = new Set();
  // US listings lead, Korean ones follow; a third market's line is not one of 오늘's names.
  return usThenKorea(facts.filter((fact) => fact.kind === 'stock-move' && (['lead', 'major'].includes(fact.rank) || Math.abs(fact.indexBp || 0) >= 8)),
    (fact) => String(fact.subjects?.[0] || ''), (a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.materiality || 0) - (a.materiality || 0))
    .filter((fact) => { const sym = fact.subjects?.[0]; if (!sym || seen.has(sym)) return false; seen.add(sym); return true; })
    .slice(0, limit).map((fact) => ({ sym: fact.subjects[0], label: fact.label, change: fact.change, indexBp: fact.indexBp ?? null, rvol: Number.isFinite(fact.rvol) ? fact.rvol : null }));
}

// v59.71 (owner 11/07 '한 줄 추가'): the stories the market is relaying, counts only (market-day `narratives`, the same
// artifact as 시장 상태's 시장이 말하는 이야기). Whether the indicators back them is the scenario engine's call, so the line
// carries attention and points to 시장 상태 rather than repeating a verdict here.
const NARR_TREND = Object.freeze({ rising: '늘어남', fading: '줄어듦', steady: '비슷함', new: '새로 등장' });
export function homeNarrativeLine(narratives, limit = 2) {
  const stories = (Array.isArray(narratives?.stories) ? narratives.stories : []).filter((row) => row?.label && row.telegramCount > 0).slice(0, limit);
  if (!stories.length) return null;
  const hours = narratives.windowHours || 72;
  return `많이 오가는 이야기 · ${stories.map((row, i) => `${row.label} ${i === 0 ? `${hours}시간 ` : ''}${row.telegramCount}건${NARR_TREND[row.trend] ? `(24시간 ${NARR_TREND[row.trend]})` : ''}`).join(', ')}`;
}

// One article's identity across the raw feed and the grouped model: its link, else its original title.
const articleKey = (item) => String(item?.link || item?.url || item?.title || '').trim();

/**
 * The top stories of 뉴스's own 중요 뉴스 (same model, pool, grouping and pick), so the two screens name the same news.
 * A story another block of 오늘 already lists (`shownElsewhere`, 내 종목 뉴스) is left out before the pick, so the
 * pick still fills its slots with the next topics instead of repeating that article. The
 * pool rolls past the 08:00 cut (rollingNewsPool) and a story the ledger `day` ties to a lead move comes first.
 */
export function homeHeadlines(root, store, limit = 3, shownElsewhere = [], day = null) {
  const items = store?.getState?.()?.news?.items;
  if (!Array.isArray(items) || !items.length || typeof root?.AIO?.buildNewsSurfaceModel !== 'function') return [];
  const nowMs = Date.now();
  const model = root.AIO.buildNewsSurfaceModel('market-news', items, { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'score', nowMs });
  const taken = new Set((Array.isArray(shownElsewhere) ? shownElsewhere : []).map(articleKey).filter(Boolean));
  const later = selectIntradayNews(root?._serverNewsIntraday, { cycleEndMs: Date.parse(root?._serverDataMeta?.newsCycleEnd || ''), canonical: items, nowMs });
  const stories = groupNewsStories(rollingNewsPool(model?.eligibleItems || model?.items || [], later))
    .filter((story) => !(story.storyArticles || [story]).some((article) => taken.has(articleKey(article))));
  const picked = pickImportantNews(stories, limit, { linked: day ? leadLinkedNews(day) : null });
  return picked.map((item) => {
    // The producer's Korean title first (news translation runs in the producer, not the browser).
    const shown = /[가-힣].*[가-힣]/.test(item.titleKo || '') ? item.titleKo : typeof root.getDisplayTitle === 'function' ? root.getDisplayTitle(item) : '';
    return { title: shown || item.title || '', original: shown && shown !== item.title ? item.title : null };
  }).filter((row) => row.title);
}

export function renderHomeDay({ documentRef: doc, root, store = null, shownElsewhere = [] }) {
  const section = doc?.getElementById('home-day');
  if (!section) return;
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderHomeDay({ documentRef: doc, root, store, shownElsewhere }); }).catch(() => {});
  const account = buildDayAccount(oneSessionDay(day, root?._aioHistory)); // v59.70 (re-review 7·8)
  section.hidden = !account.available;
  if (!account.available) return;
  // The news loads after the ledger on a cold start, so the headlines are part of the key.
  const headlines = homeHeadlines(root, store, 3, shownElsewhere, day);
  const narrLine = homeNarrativeLine(day.narratives);
  const key = [day.generatedAt, narrLine || '', ...headlines.map((row) => row.title)].join('|');
  if (section.dataset.renderKey === key) return;
  section.dataset.renderKey = key;
  const head = frameHead(doc, { title: '오늘의 핵심', titleId: 'home-day-title', asOf: account.asOf });
  const list = el(doc, 'ol', null, 'home-day__stories');
  const shown = account.stories.slice(0, 3);
  for (const story of shown) {
    const item = el(doc, 'li', null, `home-day__story is-${story.rank}`);
    const head = el(doc, 'span', null, 'home-day__story-head');
    head.append(el(doc, 'b', story.title, 'home-day__title'), storyWeight(doc, story));
    item.append(head, el(doc, 'span', story.line, 'home-day__line'));
    if (story.report) item.append(reportLine(doc, story.report, 'home-day__report'));
    list.append(item);
  }
  const parts = [head, list];
  // A release of the session beside the yields' reaction, with whether the move is put on it.
  for (const row of dayCause(oneSessionDay(day, root?._aioHistory)).candidates.filter((item) => item.kind === 'release')) {
    const line = causeRow(doc, row, 'p');
    line.prepend(el(doc, 'b', `${CAUSE_WORDS.release} `));
    line.classList.add('home-day__narr');
    parts.push(line);
  }
  if (narrLine) parts.push(el(doc, 'p', narrLine, 'home-day__narr'));
  if (headlines.length) {
    const news = el(doc, 'ul', null, 'home-day__news');
    news.setAttribute('aria-label', '주요 뉴스');
    for (const row of headlines) {
      const item = el(doc, 'li', row.title, 'home-day__headline');
      if (row.original) item.title = row.original;
      news.append(item);
    }
    parts.push(news);
  }
  const stocks = keyStocks(day);
  if (stocks.length) {
    const row = el(doc, 'div', null, 'home-day__stocks');
    row.setAttribute('role', 'group');
    // The row is the ledger's material stock moves — large for the stock itself or for the
    // S&P 500 (AAPL +1.9% pulled the index 0.16%p on a +4.7% day) — so it is named for that, not "크게 움직인".
    row.setAttribute('aria-label', '주요 종목');
    row.append(el(doc, 'span', '주요 종목', 'home-day__stocks-label'));
    for (const stock of stocks) {
      const direction = directionOf(stock.change, 1);
      const chip = el(doc, 'button', null, `home-day__stock${direction === 'up' ? ' is-up' : direction === 'down' ? ' is-down' : ''}`);
      chip.type = 'button';
      chip.dataset.action = 'aioOpenMarketChart';
      chip.dataset.arg = stock.sym;
      chip.title = `${stock.label}${Number.isFinite(stock.indexBp) && Math.abs(stock.indexBp) >= 5 ? `, S&P 500 기여 ${signedText(stock.indexBp / 100, 2, '%p')}` : ''}`;
      // v59.71 (owner 11/07 '거래량'): a move on twice the usual turnover says so on the chip; the ratio is always in the title.
      if (stock.rvol != null) chip.title += `, 거래량 평소(20일 평균)의 ${stock.rvol.toFixed(1)}배`;
      chip.append(el(doc, 'b', stock.sym), el(doc, 'span', signedText(stock.change, 1, '%')), ...(stock.rvol >= 2 ? [el(doc, 'span', `거래량 ${stock.rvol.toFixed(1)}배`, 'home-day__stock-vol')] : []));
      row.append(chip);
    }
    parts.push(row);
  }
  const links = el(doc, 'div', null, 'home-day__links');
  for (const [text, route, view] of [[`지난 24시간 전체 ${account.stories.length + account.more.length}건 → 브리핑`, 'briefing'], ...(narrLine ? [['이야기와 시나리오 → 시장 상태', 'signal', 'story']] : []), ['뉴스 전체 → 뉴스', 'market-news']]) {
    const link = el(doc, 'button', text, 'flow-next-link');
    link.type = 'button';
    link.dataset.action = 'showPage';
    link.dataset.arg = route;
    if (view) link.dataset.view = view;
    links.append(link);
  }
  parts.push(links);
  section.replaceChildren(...parts);
}
