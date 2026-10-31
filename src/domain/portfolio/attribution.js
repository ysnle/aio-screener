// P1466 (review 2026-10-04, "성과 원인 분해"): where the book's 3-month return came from, on the
// current composition. For each holding with weight w (base-currency value ÷ invested + cash):
//   지수     w × m           its market's return (US: SPY adjusted; KR: KOSPI/KOSDAQ price index)
//   섹터     w × (s − m)     its US sector ETF against the market (KR and unmapped: 0, stated)
//   종목 선택 w × (r − s)     the stock against its sector (or market)
//   환율     w × (r_base − r) the currency move for a holding converted into the base currency
// Book return R = 지수 + 섹터 + 종목 + 환율. Against the same-weight blended index fully invested
// (B = Σ w m ÷ Σ w), R − B = 섹터 + 종목 + 환율 + 현금, where 현금 = -(cash share) × B.
// The identity holds exactly; every component is from completed closes. It is current-composition
// arithmetic (what today's weights would have earned), not the account's realized history.
import { SECTOR_ETF } from '../entity/stock-read.js';
import { readNumber as finite } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';

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

// v57.48 expert review #10: `holdingsValue` is the whole book's base-currency holdings (screener-unknown
// names included). With names held out, the cash is scaled to the covered sleeve (cash × covered ÷ whole),
// so the cash share is the account's (24.8%), not cash ÷ (covered + cash) (30.9%); the identity is unchanged.
// #22: `usdkrwAsOf` is the USD/KRW close the FX return ends on. A converted holding whose close differs
// from it would mix two windows — its FX effect is held (the holding is held out), not assumed aligned.
export function buildAttribution({ holdings = [], cash = null, baseCurrency = null, rowFor = () => null, marketReturnFor = () => null, usdkrwReturnPct = null, usdkrwAsOf, holdingsValue: wholeHoldingsValue = null } = {}) {
  const parts = [];
  const skipped = [];
  const sectorBasisHeld = [];
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
    // X08 (2026-10-13): a 63-session window only means something when the stock and its index end on the same
    // close. When both closes are dated and differ, the gap is a calendar artifact, not selection — hold it out.
    const rBasis = dateOf(row?.factorSessionDate || row?.asOf);
    const mBasis = dateOf(market?.asOf);
    // P1681: an undated side cannot be shown to end on the same close either — hold it out instead of assuming it does.
    if (!rBasis || !mBasis || rBasis !== mBasis) { skipped.push({ symbol: holding.symbol, value, reason: 'basis-mismatch', rBasis, mBasis }); continue; }
    if (from && usdkrwAsOf !== undefined && dateOf(usdkrwAsOf) !== rBasis) { skipped.push({ symbol: holding.symbol, value, reason: 'fx-basis-mismatch', rBasis, fxBasis: dateOf(usdkrwAsOf) }); continue; }
    const etf = isKr(holding.symbol) ? null : SECTOR_ETF[row?.sector] || null;
    // v59.45 (ALL-PIPELINES P3-PF-01): the sector ETF's 3-month return must end on the stock's close too. An XLK row from
    // 9/1 beside AAPL and SPY on 10/23 split +45%p into 섹터 and -40%p into 종목 선택 with nothing skipped. An undated or
    // differently dated sector row leaves that holding's sector effect inside 종목 선택 (sectorMappedPct), named in
    // sectorBasisHeld.
    const sectorRow = etf ? rowFor(etf) : null;
    const sectorAligned = !!sectorRow && dateOf(sectorRow.factorSessionDate || sectorRow.asOf) === rBasis;
    if (etf && sectorRow && finite(sectorRow.ret3m) != null && !sectorAligned) sectorBasisHeld.push({ symbol: holding.symbol, etf, sBasis: dateOf(sectorRow.factorSessionDate || sectorRow.asOf), rBasis });
    const s = etf && sectorAligned ? finite(sectorRow.ret3m) : null;
    const local = r / 100;
    const base = (1 + local) * (1 + fx) - 1;
    // Portfolio audit 2026-10-17: the weight is the holding's value at the start of the window (today's value ÷ its 3-month
    // base-currency growth). Today's value over-weighted the winners — A +100% beside B 0% read +50%, while the same
    // quantities went 150 → 200 (+33.3%).
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
