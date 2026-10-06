// P1466 (review 2026-10-04, "성과 원인 분해"): where the book's 3-month return came from, on the
// current composition. For each holding with weight w (base-currency value ÷ invested + cash):
//   지수     w × m           its market's return (US: SPY adjusted; KR: KOSPI/KOSDAQ price index)
//   섹터     w × (s − m)     its US sector ETF against the market (KR and unmapped: 0, stated)
//   종목 선택 w × (r − s)     the stock against its sector (or market)
//   환율     w × (r_base − r) the currency move for a holding converted into the base currency
// Book return R = 지수 + 섹터 + 종목 + 환율. Against the same-weight blended index fully invested
// (B = Σ w m ÷ Σ w), R − B = 섹터 + 종목 + 환율 + 현금, where 현금 = −(cash share) × B.
// The identity holds exactly; every component is from completed closes. It is current-composition
// arithmetic (what today's weights would have earned), not the account's realized history.
import { SECTOR_ETF } from '../entity/stock-read.js';

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));

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

export function buildAttribution({ holdings = [], cash = null, baseCurrency = null, rowFor = () => null, marketReturnFor = () => null, usdkrwReturnPct = null } = {}) {
  const parts = [];
  const skipped = [];
  for (const holding of holdings) {
    const value = finite(holding?.value);
    if (!(value > 0)) continue;
    const row = rowFor(holding.symbol);
    const r = finite(row?.ret3m);
    const market = marketReturnFor(holding.symbol);
    const m = finite(market?.ret3m);
    const from = holding.convertedFrom || null;
    const fx = from ? fxReturnInto(from, baseCurrency, usdkrwReturnPct) : 0;
    if (r == null || m == null || fx == null) { skipped.push({ symbol: holding.symbol, value, reason: r == null ? 'no-return' : m == null ? 'no-market' : 'no-fx' }); continue; }
    const etf = isKr(holding.symbol) ? null : SECTOR_ETF[row?.sector] || null;
    const s = etf ? finite(rowFor(etf)?.ret3m) : null;
    const local = r / 100;
    const base = (1 + local) * (1 + fx) - 1;
    parts.push({ symbol: holding.symbol, value, r: local, m: m / 100, s: s == null ? m / 100 : s / 100, sectorKnown: s != null, base, fx, converted: !!from, marketLabel: market.label });
  }
  const invested = parts.reduce((sum, part) => sum + part.value, 0);
  const cashValue = finite(cash) != null && cash > 0 ? Number(cash) : 0;
  const denominator = invested + cashValue;
  if (!(invested > 0) || parts.length === 0) return { available: false, skipped };
  const sum = (fn) => parts.reduce((total, part) => total + part.value / denominator * fn(part), 0);
  const market = sum((part) => part.m);
  const sector = sum((part) => part.s - part.m);
  const stock = sum((part) => part.r - part.s);
  const fx = sum((part) => part.base - part.r);
  const total = market + sector + stock + fx;
  const cashShare = cashValue / denominator;
  const blended = parts.reduce((t, part) => t + part.value * part.m, 0) / invested;
  const cashEffect = -cashShare * blended;
  const pct = (value) => Math.round(value * 10000) / 100;
  const holdingsValue = holdings.reduce((t, h) => t + (finite(h?.value) > 0 ? Number(h.value) : 0), 0);
  const labels = [...new Set(parts.map((part) => part.marketLabel).filter(Boolean))];
  const contributors = parts.map((part) => ({ symbol: part.symbol, stockPct: pct(part.value / denominator * (part.r - part.s)) }))
    .sort((a, b) => Math.abs(b.stockPct) - Math.abs(a.stockPct));
  return {
    available: true,
    window: '3개월(63거래일)',
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
    fxHoldingsPct: Math.round(parts.filter((part) => part.converted).reduce((t, part) => t + part.value, 0) / invested * 1000) / 10,
    topStock: contributors.slice(0, 3),
    skipped
  };
}
