// 종목 머리 아래 두 줄: the last session's move with the report that named the company that day (the same pick 오늘 and
// 브리핑 use), and the themes that list the stock, each opening its theme. Nothing is drawn for a line without data.
import { el } from './dom.js';
import { companyMoveRow, moveNewsList } from './market-timeline.js';
import { stockThemes, themeCatalogFor } from '../../domain/entity/primary-theme.js';
import { openThemeDetail } from '../navigation/theme-detail.js';
import { themeMarketOf } from '../../domain/scenarios/theme-stage.js';

export function renderTickerContext(doc, host, { root, store, symbol, name = '', row = null, rows = [] } = {}) {
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
  const themes = sym ? stockThemes(themeCatalogFor(sym, { themeMap: root?.THEME_MAP, krThemeMap: root?.KR_THEME_MAP, rows }), sym).slice(0, 3) : [];
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
