// 종목 머리 아래: the last session's move with the report that named the company that day (the same pick 오늘 and
// 브리핑 use), the line that places that move in the market's session (stock-session-tie.js), and the themes that list
// the stock, each opening its theme, and the earnings outlook beside the move (stock-earnings-tie.js). Nothing is drawn
// for a line without data.
import { el } from './dom.js';
import { companyMoveRow, moveNewsList } from './market-timeline.js';
import { stockThemes, themeCatalogFor } from '../../domain/entity/primary-theme.js';
import { stockSessionTie } from '../../domain/entity/stock-session-tie.js';
import { openThemeDetail } from '../navigation/theme-detail.js';
import { themeMarketOf } from '../../domain/scenarios/theme-stage.js';
import { latestMarketInterpretation } from '../../data/selectors/interpretation.js';
import { loadCompletedDailyBars } from '../../data/daily-chart-bars.js';
import { readMarketOpening } from './market-story.js';
import { stockEarningsTie } from '../../domain/entity/stock-earnings-tie.js';
import { requestConsensusEstimates, consensusRowFor } from '../../data/consensus-estimates.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { EARNINGS_CALENDAR } from '../../data/artifact-registry.js';

// The completed bars of the symbols the tie line read, so a repaint finds them without a second request (one per symbol
// while the page lives; the loader itself shares the request with the year line).
const barsHeld = new Map(); // symbol → bars | null while loading
const BARS_HELD_MAX = 4;

// The rebound low the opening reads, while the rebound holds (a failed rebound has no low to measure from).
function activeReboundLow(root, history, repaint) {
  if (!history.length) return null;
  const rebound = readMarketOpening(root, null, repaint)?.rebound;
  return rebound && rebound.state !== 'failed' ? rebound.low : null;
}

function heldBars(root, sym, repaint) {
  if (barsHeld.has(sym)) return barsHeld.get(sym);
  barsHeld.set(sym, null);
  while (barsHeld.size > BARS_HELD_MAX) barsHeld.delete(barsHeld.keys().next().value);
  loadCompletedDailyBars(root, sym).catch(() => ({ bars: [] })).then(({ bars }) => {
    if (!Array.isArray(bars) || !bars.length) { barsHeld.delete(sym); return; }
    barsHeld.set(sym, bars);
    repaint?.();
  });
  return null;
}

function tieLine(doc, root, { sym, row, catalog, themeId, rows, repaint }) {
  const history = latestMarketInterpretation(root)?.inputs?.history || root?._aioHistory || [];
  if (!Array.isArray(history) || !history.length) return null;
  const low = activeReboundLow(root, history, repaint);
  const tie = stockSessionTie({ symbol: sym, row, themes: catalog, themeId, rows, history, low, bars: low ? heldBars(root, sym, repaint) : null });
  return tie ? el(doc, 'p', tie.text, 'ticker-context__tie') : null;
}

// Both artifacts load lazily and repaint on arrival; a listing without a consensus row (a KRX one) draws nothing.
function earnLine(doc, root, { sym, row, repaint }) {
  if (themeMarketOf(sym) === 'KR') return null;
  requestConsensusEstimates(root, repaint);
  const estimate = consensusRowFor(root, sym);
  if (!estimate) return null;
  refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed } = {}) => { if (changed) repaint?.(); }).catch(() => {});
  const line = stockEarningsTie({ symbol: sym, row, estimate, calendar: root?.[EARNINGS_CALENDAR.key] || null });
  return line ? el(doc, 'p', line.text, 'ticker-context__earn') : null;
}

/** `repaint`: the page's own repaint, called when the bars or an artifact the tie line reads arrive. */
export function renderTickerContext(doc, host, { root, store, symbol, name = '', row = null, rows = [], repaint = null } = {}) {
  if (!doc || !host) return;
  const sym = String(symbol || '').toUpperCase();
  const nodes = [];
  const session = String(row?.factorSessionDate || '').slice(0, 10);
  const move = Number(row?.ret1d);
  if (sym && session && Number.isFinite(move)) {
    const list = moveNewsList(doc, root, [companyMoveRow(root, store, { symbol: sym, name, move, session })],
      // The move prints with or without a report; a report shows only when it is about the move.
      { showMissing: true, listClass: 'ticker-context__move', timeClass: 'ticker-context__when', titleClass: 'ticker-context__title' });
    if (list) nodes.push(list);
  }
  const catalog = sym ? themeCatalogFor(sym, { themeMap: root?.THEME_MAP, krThemeMap: root?.KR_THEME_MAP, rows }) : [];
  const themes = sym ? stockThemes(catalog, sym).slice(0, 3) : [];
  if (sym && session && Number.isFinite(move)) {
    const tie = tieLine(doc, root, { sym, row, catalog, themeId: themes[0]?.id || null, rows, repaint });
    if (tie) nodes.push(tie);
  }
  const earn = sym ? earnLine(doc, root, { sym, row, repaint }) : null;
  if (earn) nodes.push(earn);
  const canOpen = typeof (themeMarketOf(sym) === 'KR' ? root?.openKrThemeDetail : root?.showThemeDetail) === 'function';
  if (themes.length && canOpen) {
    const line = el(doc, 'p', null, 'ticker-context__themes');
    line.append(el(doc, 'span', '속한 테마', 'ticker-context__label'));
    for (const theme of themes) {
      const go = el(doc, 'button', theme.label, 'flow-next-link ticker-context__theme');
      go.type = 'button';
      go.dataset.themeId = theme.id;
      go.addEventListener('click', () => openThemeDetail(root, theme.id, { symbol: sym }));
      line.append(go);
    }
    nodes.push(line);
  }
  const key = `${sym}|${nodes.map((node) => node.textContent).join('|')}`;
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  host.replaceChildren(...nodes);
  host.hidden = !nodes.length;
}
