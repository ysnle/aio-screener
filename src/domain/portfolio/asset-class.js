// v58.55 개편 v2 (3g) 채권 완충: which holdings are bond funds, the bond share of the book and how the bond part moved
// against the stock part. The map is static and versioned: exact listed tickers of widely held US bond ETFs, each with
// the issuer's own fund name and its bond type. Nothing is inferred from a name, sector or price; a ticker that is not
// listed here is not a bond fund for this reading. KRX-listed bond ETFs are added only by exact 6-digit code once they
// appear in the app's Korean registry (js/aio-kr-data.js KR_STOCK_DB holds no bond ETF as of this version).
import { STRESS_MIN_WEEKS } from './stress-sensitivity.js';
import { buildCloseSeries } from '../market/close-series.js';
import { listingCurrency as sharedListingCurrency } from './fx.js';

export const ASSET_CLASS_MAP_VERSION = '2026-10-20.v1';

// kind: treasury (US government) · tips (inflation-protected government) · aggregate (government + mortgage + corporate)
// · corporate (investment grade) · high-yield · muni · em (emerging-market sovereign, USD).
const BOND = (name, kind) => Object.freeze({ assetClass: 'bond', name, kind });
export const BOND_ETF_MAP = Object.freeze({
  TLT: BOND('iShares 20+ Year Treasury Bond ETF', 'treasury'),
  TLH: BOND('iShares 10-20 Year Treasury Bond ETF', 'treasury'),
  IEF: BOND('iShares 7-10 Year Treasury Bond ETF', 'treasury'),
  IEI: BOND('iShares 3-7 Year Treasury Bond ETF', 'treasury'),
  SHY: BOND('iShares 1-3 Year Treasury Bond ETF', 'treasury'),
  SHV: BOND('iShares Short Treasury Bond ETF', 'treasury'),
  GOVT: BOND('iShares U.S. Treasury Bond ETF', 'treasury'),
  VGLT: BOND('Vanguard Long-Term Treasury ETF', 'treasury'),
  EDV: BOND('Vanguard Extended Duration Treasury ETF', 'treasury'),
  VGIT: BOND('Vanguard Intermediate-Term Treasury ETF', 'treasury'),
  VGSH: BOND('Vanguard Short-Term Treasury ETF', 'treasury'),
  SPTL: BOND('SPDR Portfolio Long Term Treasury ETF', 'treasury'),
  SPTI: BOND('SPDR Portfolio Intermediate Term Treasury ETF', 'treasury'),
  SPTS: BOND('SPDR Portfolio Short Term Treasury ETF', 'treasury'),
  SCHR: BOND('Schwab Intermediate-Term U.S. Treasury ETF', 'treasury'),
  SCHO: BOND('Schwab Short-Term U.S. Treasury ETF', 'treasury'),
  BIL: BOND('SPDR Bloomberg 1-3 Month T-Bill ETF', 'treasury'),
  SGOV: BOND('iShares 0-3 Month Treasury Bond ETF', 'treasury'),
  TIP: BOND('iShares TIPS Bond ETF', 'tips'),
  SCHP: BOND('Schwab U.S. TIPS ETF', 'tips'),
  VTIP: BOND('Vanguard Short-Term Inflation-Protected Securities ETF', 'tips'),
  STIP: BOND('iShares 0-5 Year TIPS Bond ETF', 'tips'),
  BND: BOND('Vanguard Total Bond Market ETF', 'aggregate'),
  AGG: BOND('iShares Core U.S. Aggregate Bond ETF', 'aggregate'),
  SCHZ: BOND('Schwab U.S. Aggregate Bond ETF', 'aggregate'),
  LQD: BOND('iShares iBoxx $ Investment Grade Corporate Bond ETF', 'corporate'),
  VCIT: BOND('Vanguard Intermediate-Term Corporate Bond ETF', 'corporate'),
  VCSH: BOND('Vanguard Short-Term Corporate Bond ETF', 'corporate'),
  HYG: BOND('iShares iBoxx $ High Yield Corporate Bond ETF', 'high-yield'),
  JNK: BOND('SPDR Bloomberg High Yield Bond ETF', 'high-yield'),
  MUB: BOND('iShares National Muni Bond ETF', 'muni'),
  EMB: BOND('iShares J.P. Morgan USD Emerging Markets Bond ETF', 'em')
});

export const BOND_KIND_LABEL = Object.freeze({ treasury: '미 국채', tips: '물가연동 국채', aggregate: '종합 채권', corporate: '투자등급 회사채', 'high-yield': '하이일드 회사채', muni: '지방채', em: '신흥국 국채' });
// Government-backed kinds are the ones that have tended to cushion equity falls; credit (high-yield above all) has
// tended to fall with stocks. The card names the split instead of calling every bond fund a cushion.
const GOVERNMENT_KINDS = new Set(['treasury', 'tips']);

export function assetClassOf(symbol) {
  const key = String(symbol || '').trim().toUpperCase();
  return BOND_ETF_MAP[key] || null;
}

const STEP = 5; // weekly steps from the end of the common dates, the same grid as stress-sensitivity.js

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { const dx = xs[i] - mx; const dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

// v59.45 (PASS22): the shared listing rule (fx.js) — this copy read every non-Korean suffix (.T, .L, .HK) as a dollar
// listing and translated it with the USD/KRW close. Only USD and KRW listings can be translated here; any other
// listing currency (or an unknown one) holds the correlation below.
const listingCurrency = sharedListingCurrency;
const MAX_FX_LAG_DAYS = 4; // the same as-of tolerance as stress-sensitivity.js
function usdkrwAsOf(history) {
  const points = buildCloseSeries(Array.isArray(history) ? history : [], 'usdkrw').filter((p) => p?.date && p.value > 0);
  return (date) => {
    let lo = 0; let hi = points.length - 1; let hit = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (points[mid].date <= date) { hit = points[mid]; lo = mid + 1; } else hi = mid - 1; }
    return hit && (Date.parse(date) - Date.parse(hit.date)) <= MAX_FX_LAG_DAYS * 86400000 ? hit.value : null;
  };
}

/**
 * Weekly correlation of the bond part against the stock part, each weighted by today's values inside its own part.
 * v58.55 review: closes are in each listing's own currency, so a holding listed in another currency than the book's base
 * is translated with the app's USD/KRW close on the same dates (the base-currency return a holder actually saw — a KRW
 * book's TLT includes the won move). Mixed listing currencies without a declared base are not correlated at all.
 */
export function stockBondCorrelation({ historyMap = {}, commonDates = [], bondWeights = {}, stockWeights = {}, baseCurrency = null, history = [] } = {}) {
  const dates = [...(Array.isArray(commonDates) ? commonDates : [])].sort();
  const base = String(baseCurrency || '').toUpperCase() || null;
  const currencies = new Set([...Object.keys(bondWeights), ...Object.keys(stockWeights)].map(listingCurrency));
  if ([...currencies].some((c) => c !== 'USD' && c !== 'KRW')) return { available: false, reason: 'currency-unsupported' };
  if (!base && currencies.size > 1) return { available: false, reason: 'currency-mixed' };
  const translate = base && [...currencies].some((c) => c !== base);
  const fxAt = translate ? usdkrwAsOf(history) : null;
  if (translate && !dates.some((d) => fxAt(d) != null)) return { available: false, reason: 'fx-missing' };
  const usable = (weights) => Object.entries(weights).filter(([sym, w]) => w > 0 && historyMap?.[sym]);
  const bonds = usable(bondWeights); const stocks = usable(stockWeights);
  const share = (all, used) => { const total = Object.values(all).reduce((s, w) => s + w, 0); return total > 0 ? used.reduce((s, [, w]) => s + w, 0) / total : 0; };
  if (!bonds.length || !stocks.length || share(bondWeights, bonds) < 0.8 || share(stockWeights, stocks) < 0.8) return { available: false, reason: 'history-uncovered' };
  const marks = [];
  for (let k = dates.length - 1; k >= 0; k -= STEP) marks.unshift(dates[k]);
  const sleeve = (items, a, b) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let ret = 0;
    for (const [sym, w] of items) {
      const pa = historyMap[sym][a]; const pb = historyMap[sym][b];
      if (!(pa > 0) || !(pb > 0)) return null;
      let growth = pb / pa;
      const local = listingCurrency(sym);
      if (translate && local !== base) {
        const fa = fxAt(a); const fb = fxAt(b); // KRW per USD
        if (!(fa > 0) || !(fb > 0)) return null;
        growth *= base === 'KRW' ? fb / fa : fa / fb;
      }
      ret += (w / total) * (growth - 1);
    }
    return ret * 100;
  };
  const xs = []; const ys = [];
  for (let i = 1; i < marks.length; i += 1) {
    const s = sleeve(stocks, marks[i - 1], marks[i]); const b = sleeve(bonds, marks[i - 1], marks[i]);
    if (s != null && b != null) { xs.push(s); ys.push(b); }
  }
  if (xs.length < STRESS_MIN_WEEKS) return { available: false, reason: 'weeks-insufficient', weeks: xs.length };
  const r = pearson(xs, ys);
  if (r == null) return { available: false, reason: 'no-variation', weeks: xs.length };
  // The weeks the stock part fell: the bond part's mean move in those weeks, the plain reading of 완충.
  const down = xs.map((x, i) => [x, ys[i]]).filter(([x]) => x < 0);
  const downBondMean = down.length ? down.reduce((s, [, y]) => s + y, 0) / down.length : null;
  const downStockMean = down.length ? down.reduce((s, [x]) => s + x, 0) / down.length : null;
  return { available: true, r, weeks: xs.length, from: marks[0], to: marks[marks.length - 1], downWeeks: down.length, downBondMean, downStockMean, translatedTo: translate ? base : null };
}

/**
 * Bond share of the stored holdings (base-currency values) and, with price records, the stock–bond correlation.
 * @param {{ rows: Array<{symbol:string,value:number}>, stressInput?: {historyMap:object, commonDates:string[]}, baseCurrency?: string|null, history?: object[] }} input
 */
export function bondCushion({ rows = [], stressInput = null, baseCurrency = null, history = [] } = {}) {
  const held = (Array.isArray(rows) ? rows : []).filter((row) => Number(row?.value) > 0);
  const total = held.reduce((s, row) => s + Number(row.value), 0);
  if (!held.length || !(total > 0)) return { available: false };
  const bonds = []; const stockWeights = {}; const bondWeights = {};
  for (const row of held) {
    const symbol = String(row.symbol || '').toUpperCase();
    const info = assetClassOf(symbol);
    const w = Number(row.value) / total;
    // v59.45 (PASS22): lots of one ticker add up (the last lot used to overwrite the correlation weight).
    if (info) { bonds.push({ symbol, ...info, pct: w * 100 }); bondWeights[symbol] = (bondWeights[symbol] || 0) + w; } else stockWeights[symbol] = (stockWeights[symbol] || 0) + w;
  }
  bonds.sort((a, b) => b.pct - a.pct);
  const bondPct = bonds.reduce((s, row) => s + row.pct, 0);
  const governmentPct = bonds.filter((row) => GOVERNMENT_KINDS.has(row.kind)).reduce((s, row) => s + row.pct, 0);
  const highYieldPct = bonds.filter((row) => row.kind === 'high-yield').reduce((s, row) => s + row.pct, 0);
  let correlation = { available: false, reason: bonds.length && Object.keys(stockWeights).length ? 'history-pending' : 'one-sided' };
  if (bonds.length && Object.keys(stockWeights).length && stressInput?.historyMap && Array.isArray(stressInput.commonDates)) {
    correlation = stockBondCorrelation({ historyMap: stressInput.historyMap, commonDates: stressInput.commonDates, bondWeights, stockWeights, baseCurrency, history });
  }
  return { available: true, version: ASSET_CLASS_MAP_VERSION, holdings: held.length, bondPct, governmentPct, highYieldPct, bonds, correlation };
}
