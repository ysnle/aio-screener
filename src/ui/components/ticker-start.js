// v59.55 (flow review, owner 2026-11-01 "동의함"): with no company chosen, 종목 showed a search box and the principles fold.
// The start block offers places to begin from data the app already holds — your holdings and watchlist, and the
// screener's top passed rows — so the first tap is a name, not a guess. No new source; every group hides when empty, and
// the static example chips stay as the fallback. (The last company opened is not a group: route-hubs.js reopens it, so
// the screen is empty only when there is none.)
import { screenerRowsForRoot } from '../../data/selectors/interpretation.js';
import { topRankedPicks } from '../../domain/screener/top-pick-gate.js';
import { el } from './dom.js';

const symbolOf = (row) => String(row?.sym || row?.symbol || '').trim().toUpperCase();

// The company name beside the symbol, unless the name is the symbol itself. A case-insensitive test dropped 'Lyft' (LYFT).
export const chipLabel = (symbol, name) => (name && name !== symbol ? `${symbol} ${name}` : symbol);

function chip(doc, symbol, name) {
  const button = el(doc, 'button', chipLabel(symbol, name), 'q-chip sh-clickable');
  button.type = 'button';
  button.dataset.action = 'showTicker';
  button.dataset.arg = symbol;
  return button;
}

function group(doc, title, chips) {
  const box = el(doc, 'div', null, 'ticker-start-group');
  const row = el(doc, 'div', null, 'sh-wrap-row');
  row.append(...chips);
  box.append(el(doc, 'h3', title, 'ticker-start-title'), row);
  return box;
}

export function buildTickerStart({ holdings = [], watchlist = [], rows = [], limit = 5 } = {}) {
  const names = new Map(rows.map((row) => [symbolOf(row), String(row?.name || row?.nameKr || '')]));
  const mine = [...new Set([...holdings.map(symbolOf), ...watchlist.map((symbol) => String(symbol || '').toUpperCase())].filter(Boolean))];
  // Ranks are percentiles within each market; the list is the US one (US leads, AGENTS). v60.50: a row under its 200-day
  // line or in a five-session break is not offered here (top-pick-gate.js); it stays in the screener list.
  const top = topRankedPicks(rows, { market: 'US', limit });
  return {
    mine: mine.slice(0, 8).map((symbol) => ({ symbol, name: names.get(symbol) || '' })),
    top: top.map((symbol) => ({ symbol, name: names.get(symbol) || '' }))
  };
}

export function renderTickerStart({ documentRef: doc, root, portfolioState = null, show = true }) {
  const host = doc?.getElementById?.('ticker-start');
  if (!host) return;
  if (!show) { host.hidden = true; return; }
  let watchlist = [];
  try { watchlist = root?._aioWatchlistGet?.() || []; } catch (_) { watchlist = []; }
  const model = buildTickerStart({
    holdings: Array.isArray(portfolioState?.holdings) ? portfolioState.holdings : [],
    watchlist: Array.isArray(watchlist) ? watchlist : [],
    rows: screenerRowsForRoot(root)
  });
  const groups = [];
  if (model.mine.length) groups.push(group(doc, '내 종목', model.mine.map((row) => chip(doc, row.symbol, row.name))));
  if (model.top.length) {
    // The screener opens on 시총 큰 순, so '순위 상위' read as its first rows; the group names its own column.
    const box = group(doc, '스크리너 백분위 상위, 미국', model.top.map((row) => chip(doc, row.symbol, row.name)));
    const more = el(doc, 'button', '스크리너에서 전체 순위 →', 'flow-next-link');
    more.type = 'button';
    more.dataset.action = 'showPage';
    more.dataset.arg = 'screener';
    box.append(more);
    groups.push(box);
  }
  host.replaceChildren(...groups);
  host.hidden = !groups.length;
}
