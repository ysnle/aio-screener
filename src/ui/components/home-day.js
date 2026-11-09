// v59.67 (owner 2026-11-03, phase 5): 홈's 오늘의 핵심 — the short version of 브리핑's 24-hour account. The three most
// material stories, one line each, the day's top headlines, and the stocks that moved the most by the ledger's own ranking (a mega-cap's pull on the
// S&P 500 counts as much as a small name's surprise). The same model as 브리핑 (src/domain/briefing/day-account.js), so
// the two screens cannot disagree on what mattered.
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market-day/one-session.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';
import { frameHead } from './section-frame.js';
import { pickImportantNews } from '../../domain/briefing/news-picks.js';
import { groupNewsStories } from '../../domain/news/stories.js';
import { usThenKorea } from '../../domain/market/session-time.js';
import { MARKET_DAY } from '../../data/artifact-registry.js';

const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

/** The day's material stock moves, ledger order, each once. */
export function keyStocks(day, limit = 8) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const seen = new Set();
  // v59.70 (screen review 33): US listings lead, Korean ones follow; a third market's line is not one of 오늘's names.
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

/** The top stories of 뉴스's own 중요 뉴스 (same model, grouping and pick), so the two screens name the same news. */
function homeHeadlines(root, store, limit = 3) {
  const items = store?.getState?.()?.news?.items;
  if (!Array.isArray(items) || !items.length || typeof root?.AIO?.buildNewsSurfaceModel !== 'function') return [];
  const model = root.AIO.buildNewsSurfaceModel('market-news', items, { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'score', nowMs: Date.now() });
  const picked = pickImportantNews(groupNewsStories(model?.eligibleItems || model?.items || []), limit);
  return picked.map((item) => {
    // v59.70 (owner D6): the producer's Korean title first (news translation runs in the producer, not the browser).
    const shown = /[가-힣].*[가-힣]/.test(item.titleKo || '') ? item.titleKo : typeof root.getDisplayTitle === 'function' ? root.getDisplayTitle(item) : '';
    return { title: shown || item.title || '', original: shown && shown !== item.title ? item.title : null };
  }).filter((row) => row.title);
}

export function renderHomeDay({ documentRef: doc, root, store = null }) {
  const section = doc?.getElementById('home-day');
  if (!section) return;
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderHomeDay({ documentRef: doc, root, store }); }).catch(() => {});
  const account = buildDayAccount(oneSessionDay(day, root?._aioHistory)); // v59.70 (re-review 7·8)
  section.hidden = !account.available;
  if (!account.available) return;
  // The news loads after the ledger on a cold start, so the headlines are part of the key.
  const headlines = homeHeadlines(root, store);
  const narrLine = homeNarrativeLine(day.narratives);
  const key = [day.generatedAt, narrLine || '', ...headlines.map((row) => row.title)].join('|');
  if (section.dataset.renderKey === key) return;
  section.dataset.renderKey = key;
  const head = frameHead(doc, { title: '오늘의 핵심', titleId: 'home-day-title', asOf: account.coverage.session ? `${account.md(account.coverage.session)} 마감` : '' });
  const list = el(doc, 'ol', null, 'home-day__stories');
  const shown = account.stories.slice(0, 3);
  for (const story of shown) {
    const item = el(doc, 'li', null, `home-day__story is-${story.rank}`);
    const head = el(doc, 'span', null, 'home-day__story-head');
    head.append(el(doc, 'b', story.title, 'home-day__title'), storyWeight(doc, story));
    item.append(head, el(doc, 'span', story.line, 'home-day__line'));
    list.append(item);
  }
  const parts = [head, list];
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
    row.setAttribute('aria-label', '크게 움직인 종목');
    row.append(el(doc, 'span', '크게 움직인 종목', 'home-day__stocks-label'));
    for (const stock of stocks) {
      const chip = el(doc, 'button', null, `home-day__stock ${stock.change >= 0 ? 'is-up' : 'is-down'}`);
      chip.type = 'button';
      chip.dataset.action = 'aioOpenMarketChart';
      chip.dataset.arg = stock.sym;
      chip.title = `${stock.label}${Number.isFinite(stock.indexBp) && Math.abs(stock.indexBp) >= 5 ? `, S&P 500에 ${signedText(stock.indexBp, 0, 'bp')}` : ''}`;
      // v59.71 (owner 11/07 '거래량'): a move on twice the usual turnover says so on the chip; the ratio is always in the title.
      if (stock.rvol != null) chip.title += `, 거래량 평소(20일 평균)의 ${stock.rvol.toFixed(1)}배`;
      chip.append(el(doc, 'b', stock.sym), el(doc, 'span', signedText(stock.change, 1, '%')), ...(stock.rvol >= 2 ? [el(doc, 'span', `거래량 ${stock.rvol.toFixed(1)}배`, 'home-day__stock-vol')] : []));
      row.append(chip);
    }
    parts.push(row);
  }
  const links = el(doc, 'div', null, 'home-day__links');
  for (const [text, route] of [[`지난 24시간 전체 ${account.stories.length + account.more.length}건 → 브리핑`, 'briefing'], ...(narrLine ? [['이야기와 시나리오 → 시장 상태', 'signal']] : []), ['뉴스 전체 → 뉴스', 'market-news']]) {
    const link = el(doc, 'button', text, 'flow-next-link');
    link.type = 'button';
    link.dataset.action = 'showPage';
    link.dataset.arg = route;
    links.append(link);
  }
  parts.push(links);
  section.replaceChildren(...parts);
}
