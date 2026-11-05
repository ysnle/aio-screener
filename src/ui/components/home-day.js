// v59.67 (owner 2026-11-03, phase 5): 홈's 오늘의 핵심 — the short version of 브리핑's 24-hour account. The three most
// material stories, one line each, the day's top headlines, and the stocks that moved the most by the ledger's own ranking (a mega-cap's pull on the
// S&P 500 counts as much as a small name's surprise). The same model as 브리핑 (src/domain/briefing/day-account.js), so
// the two screens cannot disagree on what mattered.
import { MARKET_DAY, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';
import { storyWeight } from './story-weight.js';
import { frameHead } from './section-frame.js';
import { pickImportantNews } from '../../domain/briefing/news-picks.js';
import { groupNewsStories } from '../../domain/news/stories.js';
import { listingMarketOfSymbol } from '../../domain/market/session-time.js';

const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

/** The day's material stock moves, ledger order, each once. */
export function keyStocks(day, limit = 8) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const seen = new Set();
  // v59.70 (screen review 33): US listings lead, Korean ones follow (US first, AGENTS); a third market's line (285A.T) is not
  // one of 오늘's names.
  const market = (sym) => ({ US: 0, KR: 1 })[listingMarketOfSymbol(sym)] ?? 2;
  return facts.filter((fact) => fact.kind === 'stock-move' && market(String(fact.subjects?.[0] || '')) < 2 && (['lead', 'major'].includes(fact.rank) || Math.abs(fact.indexBp || 0) >= 8))
    .sort((a, b) => market(a.subjects[0]) - market(b.subjects[0]) || (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.materiality || 0) - (a.materiality || 0))
    .filter((fact) => { const sym = fact.subjects?.[0]; if (!sym || seen.has(sym)) return false; seen.add(sym); return true; })
    .slice(0, limit).map((fact) => ({ sym: fact.subjects[0], label: fact.label, change: fact.change, indexBp: fact.indexBp ?? null }));
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
  const account = buildDayAccount(day);
  section.hidden = !account.available;
  if (!account.available) return;
  // The news loads after the ledger on a cold start, so the headlines are part of the key.
  const headlines = homeHeadlines(root, store);
  const key = [day.generatedAt, ...headlines.map((row) => row.title)].join('|');
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
      chip.append(el(doc, 'b', stock.sym), el(doc, 'span', signedText(stock.change, 1, '%')));
      row.append(chip);
    }
    parts.push(row);
  }
  const links = el(doc, 'div', null, 'home-day__links');
  for (const [text, route] of [[`지난 24시간 전체 ${account.stories.length + account.more.length}건 → 브리핑`, 'briefing'], ['뉴스 전체 → 뉴스', 'market-news']]) {
    const link = el(doc, 'button', text, 'flow-next-link');
    link.type = 'button';
    link.dataset.action = 'showPage';
    link.dataset.arg = route;
    links.append(link);
  }
  parts.push(links);
  section.replaceChildren(...parts);
}
