// S5 (ADR-0003): the chat's [주가 추이] line reads the same screener row the 종목 page reads, through the same
// domain reading (buildStockRead). It used to download Yahoo's 3-month chart and recompute 5/20/60-bar returns, a
// 3-month "범위 위치" and its own 단기 흐름 label (js/aio-chat.js _fetchTickerTrend), so the AI's 5-day return could differ from
// the page's and its label (e.g. '단기·중기 하락 추세') could contradict the page's trend.
//
// Row order: the published screener row, then the on-demand row the 종목 page computes for a US listing outside the
// universe (src/data/on-demand-symbol.js, same formulas). No row means no line: the page shows no trend either.
import { buildStockRead } from '../../domain/entity/stock-read.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { shortDate } from '../../domain/content/date-labels.js';

const signed = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/** The [주가 추이] text for one screener-shaped row, or null when the row carries no trend facts. */
export function stockTrendLine({ symbol, row, source = 'screener' } = {}) {
  if (!row) return null;
  const read = buildStockRead({ symbol, row });
  if (!read.available) return null;
  const display = (key) => readRowNumber(row, key, 'display');
  const returns = [['ret5d', '5거래일'], ['ret1m', '1개월'], ['ret3m', '3개월']]
    .map(([key, label]) => (display(key) != null ? `${label} ${signed(display(key))}` : null)).filter(Boolean);
  const session = shortDate(read.facts.basisDate);
  const basis = `${source === 'on-demand' ? '스크리너 범위 밖이라 같은 계산식으로 요청 시 산출' : '종목 화면과 같은 스크리너 행'}${session ? `, ${session} 종가` : ''}`;
  const parts = [];
  if (read.facts.trendLabel) parts.push(`추세 ${read.facts.trendLabel}(50·200일선 기준)`);
  if (returns.length) parts.push(returns.join(', '));
  if (read.position != null) parts.push(`52주 범위 ${Math.round(read.position * 100)}% 위치${read.high != null ? `(고점 대비 ${signed(read.high)})` : ''}`);
  if (read.facts.rsi != null) parts.push(`RSI ${Math.round(read.facts.rsi)}`);
  return parts.length ? `${parts.join(' · ')} (${basis})` : null;
}

/** The row the 종목 page would read for this symbol: published screener row, else a ready on-demand row. */
export function screenRowFor(root, symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return null;
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch { rows = []; }
  const row = rows.find((item) => item?.sym === sym);
  if (row) return { row, source: 'screener' };
  const record = typeof root?._aioOnDemandSymbol === 'function' ? root._aioOnDemandSymbol(sym) : null;
  return record?.status === 'ready' && record.row ? { row: record.row, source: 'on-demand' } : null;
}

/**
 * The chat's trend line for a symbol. A US listing outside the universe is requested once from the same on-demand
 * reader the 종목 page uses (bounded by timeoutMs); a KR listing outside the universe has no line.
 */
export async function chatStockTrendLine(symbol, { root = globalThis, timeoutMs = 6000 } = {}) {
  let found = screenRowFor(root, symbol);
  if (!found && !/\.K[SQ]$/i.test(String(symbol || '')) && typeof root?._aioRequestOnDemandSymbol === 'function') {
    let timer = null;
    await Promise.race([
      Promise.resolve(root._aioRequestOnDemandSymbol(String(symbol).toUpperCase())).catch(() => null),
      new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); })
    ]);
    clearTimeout(timer);
    found = screenRowFor(root, symbol);
  }
  return found ? stockTrendLine({ symbol: String(symbol).toUpperCase(), ...found }) : null;
}
