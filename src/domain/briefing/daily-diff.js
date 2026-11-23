import { deriveQuotePresentation } from '../market/session/quote-presentation.js';
import { buildMarketRegime } from './market-read.js';
import { buildCloseSeries, closeBasis } from '../market/session/close-series.js';
import { RULES } from '../rules/thresholds.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { holdingListingKey } from '../portfolio/fx.js';

const signed = (value, digits = 1, unit = '') => signedText(value, digits, unit);
// "내 종목": watchlist and holdings, with what moved and what crossed a level worth knowing.
export function buildMyNames({ symbols = [], rows = [], live = {}, holdings = [], breadthState = null } = {}) {
  // A held Korean code (005930) is named by the listing the portfolio reader resolved (005930.KS) — the key its
  // screener row and quote are published under, and the one a watchlist entry of the same stock uses.
  const held = new Set((holdings || []).map(holdingListingKey).filter(Boolean));
  const wanted = [...new Set([...held, ...(symbols || []).map((symbol) => String(symbol || '').toUpperCase())].filter(Boolean))];
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), row]));
  const names = wanted.map((symbol) => {
    const row = bySymbol.get(symbol) || null;
    const quote = live?.[symbol] || null;
    const dayPct = finite(quote?.pct ?? quote?.changePercent);
    const presentation = quote ? deriveQuotePresentation(quote, { symbol }) : null;
    const daySignalled = dayPct != null && ['current', 'delayed'].includes(presentation?.displayState) && presentation?.changeCoherent === true;
    const sma50 = readRowNumber(row, 'pctSma50', 'calculation');
    const high = finite(row?.pctFrom52wHigh);
    const rsi = readRowNumber(row, 'rsi', 'calculation');
    const notes = [];
    const ma50 = sma50 == null ? 'unknown' : sma50 < 0 ? 'below' : sma50 > 0 ? 'above' : 'on';
    if (sma50 != null) notes.push(ma50 === 'below' ? `50일선 아래(${signed(sma50, 1, '%')})` : ma50 === 'above' ? `50일선 위(${signed(sma50, 1, '%')})` : '50일선 위치(0.0%)');
    if (high != null && high > -RULES.technical.nearHighPct) notes.push(`52주 고점 근처(${signed(high, 1, '%')})`);
    else if (high != null && high <= -RULES.technical.template.nearHighPct) notes.push(`52주 고점 대비 ${signed(high, 0, '%')}`);
    if (rsi != null && rsi >= RULES.technical.rsi.overbought) notes.push(`RSI ${rsi.toFixed(0)} 과열권`);
    else if (rsi != null && rsi <= RULES.technical.rsi.oversold) notes.push(`RSI ${rsi.toFixed(0)} 과매도권`);
    const attention = (daySignalled && Math.abs(dayPct) >= RULES.largeMove.watchDayPct ? 2 : 0) + (rsi != null && (rsi >= RULES.technical.rsi.overbought || rsi <= RULES.technical.rsi.oversold) ? 1 : 0) + (sma50 != null && sma50 < 0 ? 1 : 0);
    return {
      symbol, name: row?.name || '', held: held.has(symbol), dayPct, daySignalled, ma50,
      ret1m: readRowNumber(row, 'ret1m', 'display'), notes, attention, known: !!row || dayPct != null
    };
  });
  // P26-NAMES-02: an unsignalled (stale or basis-unknown) change does not break ties either.
  const rankMove = (row) => (row.daySignalled ? Math.abs(row.dayPct ?? 0) : 0);
  names.sort((a, b) => b.attention - a.attention || rankMove(b) - rankMove(a) || a.symbol.localeCompare(b.symbol));
  // P26-NAMES-01: the 50-day position is counted over the names whose 50-day line is known; an RSI-only row is not one.
  const below = names.filter((row) => row.ma50 === 'below').length;
  const above = names.filter((row) => row.ma50 === 'above').length;
  const measured = names.filter((row) => row.ma50 !== 'unknown').length;
  const unknown = names.length - measured;
  const summary = !names.length ? null
    : measured ? `내 종목 ${names.length}개 중 ${below}개가 50일선 아래${unknown ? `(${unknown}개는 50일선 미확인)` : ''}${below && below * 2 >= measured && breadthState === 'burden' ? ' — 시장 폭이 좁아진 흐름이 내 종목에도 와 있습니다' : above * 2 > measured && breadthState === 'burden' ? ' — 시장 폭은 좁아졌지만 내 종목 대부분은 아직 50일선 위입니다' : ''}.`
      : `내 종목 ${names.length}개 — 아직 50일선 기록이 없어 위치를 읽지 못했습니다.`;
  return { names, summary };
}

const previousCache = new WeakMap();
export function previousRegime(inputs, regime, sessions = 5) {
  const history = inputs?.history;
  const macroHistory = inputs?.macroHistory;
  if (!regime?.available || !Array.isArray(history) || !history.length || !macroHistory?.series?.hyOas) return null;
  const cached = previousCache.get(history);
  if (cached && cached.macroHistory === macroHistory && cached.asOf === regime.asOf && cached.sessions === sessions) return cached.value;
  const target = buildCloseSeries(history, 'spx', { through: regime.asOf }).at(-1 - sessions)?.date;
  let value = null;
  if (target) {
    let cut = history;
    while (cut.length && closeBasis(cut) > target) cut = cut.slice(0, -1);
    const obs = (macroHistory.series.hyOas.observations || []).filter(([date, v]) => date <= target && Number.isFinite(v));
    const last = obs.at(-1), prior = obs.at(-6);
    const credit = last ? { hyBp: last[1] * 100, hyAsOf: last[0], hyDelta5Bp: prior ? (last[1] - prior[1]) * 100 : null } : {};
    // The rates axis judges the 10-year close series in `history`; the real-yield / breakeven split only feeds its reading.
    const at = (key) => (macroHistory.series[key]?.observations || []).filter(([date, v]) => date <= target && Number.isFinite(v));
    const real = at('realYield10'), bei = at('breakeven10');
    const rates = real.length > 5 && bei.length > 5 && real.at(-1)[0] === bei.at(-1)[0]
      ? { realYield10: real.at(-1)[1], realYield10Delta5: real.at(-1)[1] - real.at(-6)[1], breakeven10Delta5: bei.at(-1)[1] - bei.at(-6)[1], asOf: real.at(-1)[0], realAsOf: real.at(-1)[0], breakevenAsOf: bei.at(-1)[0] }
      : {};
    try {
      const then = buildMarketRegime({ history: cut, macroHistory, credit, rates });
      if (then.available && then.asOf === target) {
        const axes = then.axes.map((axis) => (axis.id === 'credit' && axis.state === 'favorable' ? { ...axis, partial: true } : axis));
        value = { ...then, axes, partial: axes.some((axis) => axis.partial) };
      }
    } catch (_) { value = null; }
  }
  previousCache.set(history, { macroHistory, asOf: regime.asOf, sessions, value });
  return value;
}
