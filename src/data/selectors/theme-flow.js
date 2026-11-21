// What the 테마 screen and the chat's money_flow tool both read: the sector period bars (1일·1주 from the rotation artifact,
// longer windows from the screener's ETF rows, each beside SPY over the same window), a sector or theme ETF's name, the
// rotation's close session, and a theme's members with their published screener rows. The screen draws them; the tool
// writes them as lines. Loaded by the lazy 테마 route and the chat chunk, never at boot.
import { finiteNumber as finite } from '../../domain/shared/number.js';
import { isoDay } from '../../domain/shared/session-date.js';

export const SECTOR_PERIODS = Object.freeze([['1d', '1일', 'ret1d'], ['1w', '1주', 'ret5d'], ['1m', '1개월', 'ret1m'], ['3m', '3개월', 'ret3m'], ['6m', '6개월', 'ret6m'], ['12m', '12개월', 'ret12m']]);
const periodOf = (mode) => SECTOR_PERIODS.find(([key]) => key === mode) || null;
const symbolOf = (item) => String(item?.symbol || item?.id || '');

/** The items of one board scope: 'sectors' (the 11 SPDR sectors), 'subsectors' or 'all'. */
export function viewItems(items, view) {
  if (view === 'all') return items;
  return items.filter((item) => String(item?.view || 'sectors') === view);
}

/** The rotation artifact's completed US session (the 1일·1주 bars' close), or ''. */
export function usCloseSession(root) {
  return isoDay(String(root?._serverDataMeta?.rotationHistory?.latestCompletedSession || '')) || '';
}

/** The bars' window: the asked one when it is a period, else 1주 when the rotation artifact carries it, else 1개월, else 1일. */
export function sectorPeriodMode(items, screenerRows, requested = null) {
  if (periodOf(requested)) return requested;
  if (items.some((item) => finite(item?.weeklyPct) != null)) return '1w';
  return items.some((item) => finite(screenerRows.get(symbolOf(item).toUpperCase())?.ret1m) != null) ? '1m' : '1d';
}

/** One item's return over the window: 1일·1주 from the rotation artifact, the longer windows from its screener ETF row. */
export function sectorPeriodValue(item, screenerRows, mode) {
  if (mode === '1d') return finite(item?.pct);
  if (mode === '1w') return finite(item?.weeklyPct);
  return finite(screenerRows.get(symbolOf(item).toUpperCase())?.[periodOf(mode)?.[2]]);
}

/**
 * The bars in order (largest return first, no value last), each with its gap to SPY over the same window. SPY counts only
 * when its screener row closed on the rotation's session (`close`).
 */
export function rankSectorPeriod(items, screenerRows, mode, { close = '' } = {}) {
  const period = periodOf(mode);
  const spyRow = screenerRows.get('SPY');
  const spySame = spyRow && (!close || String(spyRow.factorSessionDate || '').slice(0, 10) === close);
  const spy = spySame && period ? finite(spyRow[{ '1d': 'ret1d', '1w': 'ret5d' }[mode] || period[2]]) : null;
  const rows = items.map((item) => {
    const pct = sectorPeriodValue(item, screenerRows, mode);
    return { symbol: symbolOf(item), item, pct, vsSpy: pct != null && spy != null ? pct - spy : null };
  }).filter((row) => row.symbol).sort((a, b) => {
    if (a.pct == null && b.pct == null) return a.symbol.localeCompare(b.symbol);
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return b.pct - a.pct;
  });
  return { period, spy, rows };
}

export function themeDefinitionOf(root, item) {
  const symbol = String(item?.symbol || item?.id || '').trim().toUpperCase();
  const catalog = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  return catalog.find((entry) => (
    String(entry?.id || '').trim() === String(item?.id || '').trim()
    || String(entry?.etf || '').trim().toUpperCase() === symbol
    || String(entry?.compositeBase || '').trim().toUpperCase() === symbol
  )) || null;
}

export function themeItemLabel(root, item) {
  const theme = themeDefinitionOf(root, item);
  return String(theme?.nameKr || theme?.name || item?.label || item?.symbol || item?.id || '').trim();
}

// The members of a theme with their published screener rows: Korea from KR_THEME_MAP codes, the US from THEME_MAP
// sub-theme tickers and leaders.
export function themeMembersFor(root, store, market, themeId) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const bySymbol = root?.__aioRowsBySym?.rows === rows ? root.__aioRowsBySym.map : new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  if (root) root.__aioRowsBySym = { rows, map: bySymbol };
  if (market === 'KR') {
    return (root?.KR_THEME_MAP?.[themeId] || []).map((member) => {
      const code = String(member?.code || '');
      const row = bySymbol.get(`${code}.KS`) || bySymbol.get(`${code}.KQ`) || null;
      return { sym: row ? String(row.sym).toUpperCase() : `${code}.KS`, label: root?.KR_STOCK_DB?.[code]?.name || row?.name || code, row };
    });
  }
  const theme = (root?.THEME_MAP || []).find((item) => item?.id === themeId);
  const symbols = [...new Set([...(theme?.subThemes || []).flatMap((sub) => sub?.tickers || []), ...(theme?.leaders || [])].map((sym) => String(sym).toUpperCase()))];
  return symbols.map((sym) => ({ sym, label: sym, row: bySymbol.get(sym) || null }));
}
