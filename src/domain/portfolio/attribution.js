import { SECTOR_ETF } from '../entity/stock-read.js';
import { readNumber as finite } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));
const dateOf = (value) => (hasLeadingIsoDay(String(value || '')) ? String(value).slice(0, 10) : null);

// FX return of converting `from` into `base` over the window, from the USD/KRW close series.
export function fxReturnInto(from, base, usdkrwReturnPct) {
  const f = String(from || '').toUpperCase();
  const b = String(base || '').toUpperCase();
  if (!f || !b || f === b) return 0;
  const usdkrw = finite(usdkrwReturnPct);
  if (usdkrw == null) return null;
  if (f === 'USD' && b === 'KRW') return usdkrw / 100;
  if (f === 'KRW' && b === 'USD') return 1 / (1 + usdkrw / 100) - 1;
  return null;
}

export function buildAttribution({ holdings = [], cash = null, baseCurrency = null, rowFor = () => null, marketReturnFor = () => null, usdkrwReturnPct = null, usdkrwAsOf, holdingsValue: wholeHoldingsValue = null } = {}) {
  const parts = [];
  const skipped = [];
  const sectorBasisHeld = [];
  for (const holding of holdings) {
    const value = finite(holding?.value);
    if (!(value > 0)) continue;
    const row = rowFor(holding.symbol);
    const r = readRowNumber(row, 'ret3m', 'calculation');
    const market = marketReturnFor(holding.symbol);
    const m = finite(market?.ret3m);
    const from = holding.convertedFrom || null;
    const fx = from ? fxReturnInto(from, baseCurrency, usdkrwReturnPct) : 0;
    if (r == null || m == null || fx == null) { skipped.push({ symbol: holding.symbol, value, reason: r == null ? 'no-return' : m == null ? 'no-market' : 'no-fx' }); continue; }
    const rBasis = dateOf(row?.factorSessionDate || row?.asOf);
    const mBasis = dateOf(market?.asOf);
    if (!rBasis || !mBasis || rBasis !== mBasis) { skipped.push({ symbol: holding.symbol, value, reason: 'basis-mismatch', rBasis, mBasis }); continue; }
    if (from && usdkrwAsOf !== undefined && dateOf(usdkrwAsOf) !== rBasis) { skipped.push({ symbol: holding.symbol, value, reason: 'fx-basis-mismatch', rBasis, fxBasis: dateOf(usdkrwAsOf) }); continue; }
    const etf = isKr(holding.symbol) ? null : SECTOR_ETF[row?.sector] || null;
    const sectorRow = etf ? rowFor(etf) : null;
    const sectorAligned = !!sectorRow && dateOf(sectorRow.factorSessionDate || sectorRow.asOf) === rBasis;
    const sectorReturn = readRowNumber(sectorRow, 'ret3m', 'calculation');
    if (etf && sectorReturn != null && !sectorAligned) sectorBasisHeld.push({ symbol: holding.symbol, etf, sBasis: dateOf(sectorRow.factorSessionDate || sectorRow.asOf), rBasis });
    const s = etf && sectorAligned ? sectorReturn : null;
    const local = r / 100;
    const base = (1 + local) * (1 + fx) - 1;
    parts.push({ symbol: holding.symbol, value, start: base > -1 ? value / (1 + base) : value, r: local, m: m / 100, s: s == null ? m / 100 : s / 100, sectorKnown: s != null, base, fx, converted: !!from, marketLabel: market.label, basis: rBasis || mBasis });
  }
  const invested = parts.reduce((sum, part) => sum + part.value, 0);
  const holdingsValue = Math.max(holdings.reduce((t, h) => t + (finite(h?.value) > 0 ? Number(h.value) : 0), 0), finite(wholeHoldingsValue) || 0);
  const declaredCash = finite(cash) != null && cash > 0 ? Number(cash) : 0;
  const cashValue = holdingsValue > 0 ? declaredCash * invested / holdingsValue : declaredCash;
  // Cash earns 0% here, so its start value is its value today.
  const denominator = parts.reduce((sum, part) => sum + part.start, 0) + cashValue;
  if (!(invested > 0) || parts.length === 0) return { available: false, skipped };
  const sum = (fn) => parts.reduce((total, part) => total + part.start / denominator * fn(part), 0);
  const market = sum((part) => part.m);
  const sector = sum((part) => part.s - part.m);
  const stock = sum((part) => part.r - part.s);
  const fx = sum((part) => part.base - part.r);
  const total = market + sector + stock + fx;
  // The cash share shown is today's; the cash effect uses the start-of-window share the weights above use.
  const cashShare = cashValue / (invested + cashValue);
  const blended = parts.reduce((t, part) => t + part.start * part.m, 0) / (denominator - cashValue);
  const cashEffect = -(cashValue / denominator) * blended;
  const pct = (value) => Math.round(value * 10000) / 100;
  const labels = [...new Set(parts.map((part) => part.marketLabel).filter(Boolean))];
  const contributors = parts.map((part) => ({ symbol: part.symbol, stockPct: pct(part.start / denominator * (part.r - part.s)) }))
    .sort((a, b) => Math.abs(b.stockPct) - Math.abs(a.stockPct));
  return {
    available: true,
    window: (() => { const dates = [...new Set(parts.map((part) => part.basis).filter(Boolean))].sort(); return dates.length ? `3개월(63거래일, ${dates.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join('·')} 종가까지)` : '3개월(63거래일)'; })(),
    totalPct: pct(total),
    blendedPct: pct(blended),
    blendedLabel: labels.length > 1 ? `같은 비중의 ${labels.join('·')} 혼합` : labels[0] || '지수',
    excessPct: pct(total - blended),
    components: [
      { id: 'market', label: '지수', pct: pct(market) },
      { id: 'sector', label: '섹터', pct: pct(sector) },
      { id: 'stock', label: '종목 선택', pct: pct(stock) },
      { id: 'fx', label: '환율', pct: pct(fx) }
    ],
    // R − B decomposition (sums to excessPct up to rounding).
    excess: [
      { id: 'sector', label: '섹터', pct: pct(sector) },
      { id: 'stock', label: '종목 선택', pct: pct(stock) },
      { id: 'fx', label: '환율', pct: pct(fx) },
      { id: 'cash', label: '현금', pct: pct(cashEffect) }
    ],
    cashSharePct: pct(cashShare),
    cashDeclared: finite(cash) != null,
    coveredPct: holdingsValue > 0 ? Math.round(invested / holdingsValue * 1000) / 10 : null,
    sectorMappedPct: Math.round(parts.filter((part) => part.sectorKnown).reduce((t, part) => t + part.value, 0) / invested * 1000) / 10,
    fxAsOf: usdkrwAsOf ? dateOf(usdkrwAsOf) : null,
    fxHoldingsPct: Math.round(parts.filter((part) => part.converted).reduce((t, part) => t + part.value, 0) / invested * 1000) / 10,
    topStock: contributors.slice(0, 3),
    sectorBasisHeld,
    skipped
  };
}
