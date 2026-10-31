// 2026-10-13 (owner: "finviz maps 같은 S&P 500 지도"): the S&P 500 members AIO collects, grouped by sector,
// each tile sized by market value and coloured by its return over one completed period. Pure: rows in, layout
// and reading out. Market value = valuation close × shares outstanding, both already published per row for P/E
// (no raw current price is republished — P715). A member without shares or a return is counted, not drawn.
import { sectorLabel } from '../screener/screener-read.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';

// v59.46 boundary contract: screener row numbers are read through the readiness contract, not row[key].
const read = (row, key) => readRowNumber(row, key, 'calculation');

export const SECTOR_MAP_VERSION = 'sector-map.v1';

// Colour steps per window (|return| thresholds for the 1st/2nd/3rd shade). Longer windows move more, so the
// same shade means a comparable "how unusual" across tabs rather than the same raw percent.
export const SECTOR_MAP_PERIODS = Object.freeze({
  ret1d: Object.freeze({ label: '1일', steps: [0.5, 1.5, 3] }),
  ret5d: Object.freeze({ label: '1주', steps: [1, 3, 6] }),
  ret1m: Object.freeze({ label: '1개월', steps: [2, 6, 12] }),
  ret3m: Object.freeze({ label: '3개월', steps: [4, 12, 25] })
});

const sumValue = (list) => list.reduce((sum, item) => sum + item.value, 0);

// One company listed in several share classes. The holdings file names them "ALPHABET CLASS A/C"; the alias table
// covers rows whose names differ by more than the class suffix.
const ISSUER_ALIAS = Object.freeze({ GOOG: 'GOOGL', GOOGL: 'GOOGL', FOX: 'FOXA', FOXA: 'FOXA', NWS: 'NWSA', NWSA: 'NWSA' });
export function issuerKey(item) {
  const sym = String(item?.sym || '').toUpperCase();
  if (ISSUER_ALIAS[sym]) return ISSUER_ALIAS[sym];
  const name = String(item?.name || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const classless = name.replace(/\s(CLASS|CL)\s[A-Z]$/, '');
  return classless && classless !== name ? `name:${classless}` : sym;
}

export function shadeOf(value, steps) {
  const v = finite(value);
  if (v == null) return 'na';
  const a = Math.abs(v);
  const level = a >= steps[2] ? 3 : a >= steps[1] ? 2 : a >= steps[0] ? 1 : 0;
  return level === 0 ? 'n0' : `${v > 0 ? 'u' : 'd'}${level}`;
}

// Squarified treemap (Bruls, Huizing, van Wijk 2000): rows of tiles whose worst aspect ratio is kept low.
function worst(row, side) {
  let sum = 0; let max = 0; let min = Infinity;
  for (const node of row) { sum += node.area; max = Math.max(max, node.area); min = Math.min(min, node.area); }
  const s2 = sum * sum; const w2 = side * side;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

function placeRow(row, rect, out) {
  const sum = row.reduce((total, node) => total + node.area, 0);
  if (rect.w >= rect.h) {
    const width = sum / rect.h;
    let y = rect.y;
    for (const node of row) { const h = node.area / width; out.push({ ...node.item, x: rect.x, y, w: width, h }); y += h; }
    return { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h };
  }
  const height = sum / rect.w;
  let x = rect.x;
  for (const node of row) { const w = node.area / height; out.push({ ...node.item, x, y: rect.y, w, h: height }); x += w; }
  return { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height };
}

export function squarify(items, rect) {
  const list = (items || []).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((sum, item) => sum + item.value, 0);
  if (!total || !(rect.w > 0) || !(rect.h > 0)) return [];
  const scale = (rect.w * rect.h) / total;
  const nodes = list.map((item) => ({ item, area: item.value * scale }));
  const out = [];
  let free = { ...rect };
  let row = [];
  let i = 0;
  while (i < nodes.length) {
    const side = Math.min(free.w, free.h);
    const next = nodes[i];
    if (!row.length || worst([...row, next], side) <= worst(row, side)) { row.push(next); i += 1; }
    else { free = placeRow(row, free, out); row = []; }
  }
  if (row.length) placeRow(row, free, out);
  return out;
}

/**
 * @param {object} input
 * @param {Array} input.rows canonical screener rows (sym, name, sector, index, ret*, _valuationPePrice, _valuationSharesOutstanding)
 * @param {string} [input.period] one of SECTOR_MAP_PERIODS
 * @param {string|null} [input.expectedSession] latest completed US session (YYYY-MM-DD); a different basis is a dated reference
 */
// GICS sector names as the holdings file writes them → the labels the rest of AIO uses.
export const GICS_KO = Object.freeze({ 'Information Technology': '기술', Communication: '통신', 'Communication Services': '통신', 'Consumer Discretionary': '경기소비재',
  'Consumer Staples': '필수소비재', 'Health Care': '헬스케어', Financials: '금융', Industrials: '산업재', Energy: '에너지', Utilities: '유틸리티', Materials: '소재', 'Real Estate': '부동산' });

export function buildSectorMap({ rows = [], weights = null, period = 'ret1d', expectedSession = null } = {}) {
  const key = SECTOR_MAP_PERIODS[period] ? period : 'ret1m';
  const spec = SECTOR_MAP_PERIODS[key];
  const list = Array.isArray(rows) ? rows : [];
  const bySym = new Map(list.filter((row) => row?.sym || row?.symbol).map((row) => [String(row.sym || row.symbol).toUpperCase(), row]));
  const weightRows = Array.isArray(weights?.rows) && weights.rows.length >= 450 ? weights.rows : null;
  const priced = [];
  let noValue = 0;
  let noReturn = 0;
  let missingNames = [];
  let members = 0;
  let sizeBasis;
  if (weightRows) {
    // Complete membership: every index member is drawn at its index weight; a member AIO does not collect still
    // takes its place (grey, "수익률 없음") so the map's areas stay true to the index.
    sizeBasis = 'index-weight';
    members = weightRows.length;
    for (const item of weightRows) {
      const sym = String(item.sym || '').toUpperCase();
      const row = bySym.get(sym) || null;
      const ret = read(row, key);
      if (ret == null) noReturn += 1;
      priced.push({ sym, name: row?.name || item.name || '', sector: item.sector, label: GICS_KO[item.sector] || item.sector, value: Number(item.weight), ret, basis: row?.factorSessionDate || null, collected: !!row });
    }
  } else {
    // Fallback until the weights artifact exists: valuation close × shares outstanding from the screener rows.
    sizeBasis = 'shares-times-close';
    const candidates = list.filter((row) => row && row.index === 'SP500' && row.sector && row.sector !== 'ETF');
    members = candidates.length;
    const missing = [];
    for (const row of candidates) {
      // v57.51 F10: the provider's referenceMarketCap already carries the verified share count and a loss-making
      // company's close; the raw pe-price pair is the fallback for rows built before it existed.
      const referenceBillions = finite(row.referenceMarketCap?.billions);
      const close = finite(row._valuationPePrice ?? row.pePrice);
      const shares = finite(row._valuationSharesOutstanding ?? row.valuationSharesOutstanding);
      let value = referenceBillions != null && referenceBillions > 0 ? referenceBillions * 1e9
        : close != null && shares != null && close > 0 && shares > 0 ? close * shares : null;
      // A share count in the wrong unit or class (one stock at 20조 달러) shows up as a turnover no listed stock has.
      // v59.45 (P17-MAP-01): an unrecorded turnover is unchecked, not 0 (null / value read as zero turnover and dropped
      // a valid market cap).
      const volume = read(row, 'dollarVolume30d');
      const turnover = value && volume != null ? volume / value : null;
      if (value != null && turnover != null && (turnover < 0.0002 || turnover > 0.2)) value = null;
      if (value == null) { noValue += 1; missing.push(row); continue; }
      const ret = read(row, key);
      if (ret == null) noReturn += 1;
      priced.push({ sym: String(row.sym || row.symbol).toUpperCase(), name: row.name || '', sector: row.sector, label: sectorLabel(row.sector), value, ret, basis: row.factorSessionDate || null, collected: true });
    }
    missingNames = missing.sort((a, b) => (finite(b.dollarVolume30d) || 0) - (finite(a.dollarVolume30d) || 0)).slice(0, 4).map((row) => String(row.sym || row.symbol).toUpperCase());
  }
  // P1681: a tab is enabled by the S&P 500 members' own returns, not by any row (a Korean row's ret1d says nothing here).
  const memberRows = weightRows ? weightRows.map((item) => bySym.get(String(item.sym || '').toUpperCase())).filter(Boolean) : list.filter((row) => row && row.index === 'SP500');
  const available = Object.fromEntries(Object.keys(SECTOR_MAP_PERIODS).map((id) => [id, memberRows.some((row) => finite(row[id]) != null)]));
  if (priced.length < 20) {
    // v58.80 first-users run-2: no rows yet is a load, not "0개".
    if (!list.length) return { available: false, version: SECTOR_MAP_VERSION, period: key, periods: available, reason: '구성 종목 자료를 불러오는 중입니다 — 도착하면 지도를 그립니다.' };
    return { available: false, version: SECTOR_MAP_VERSION, period: key, periods: available, reason: `시가총액을 계산할 수 있는 구성 종목이 ${priced.length}개라 지도를 그리지 않습니다.` };
  }
  // P1681: one map, one close. A member still on an older session would paint yesterday's move beside today's —
  // it keeps its area but is greyed and left out of every average, and the lead counts it.
  const dates = [...new Set(priced.map((item) => item.basis).filter(Boolean))].sort();
  const basis = dates.at(-1) || null;
  let staleCount = 0;
  for (const item of priced) {
    if (basis && item.basis && item.basis !== basis && item.ret != null) { item.staleRet = item.ret; item.ret = null; staleCount += 1; }
  }
  const total = priced.reduce((sum, item) => sum + item.value, 0);
  // Expert review M02: the areas are today's weights, but an index return weights each member by its size at the
  // START of the period. Today's weight already contains the member's own move (a stock that doubled carries twice
  // its starting weight), so averaging with it over-counts the winners — the 3개월 map read +5.91% while SPY made
  // +3.75%. The start weight is backed out per member, w₀ ∝ w_now / (1 + r). Holdings dated before the close
  // already are the 1일 window's start weights; for longer windows that one-session drift is left in.
  const holdingsAtStart = key === 'ret1d' && sizeBasis === 'index-weight' && !!weights?.asOf && !!basis && String(weights.asOf) < basis;
  for (const item of priced) item.startValue = !holdingsAtStart && item.ret != null && item.ret > -100 ? item.value / (1 + item.ret / 100) : item.value;
  const bySector = new Map();
  for (const item of priced) {
    if (!bySector.has(item.sector)) bySector.set(item.sector, []);
    bySector.get(item.sector).push(item);
  }
  const weighted = (list) => {
    const withRet = list.filter((item) => item.ret != null);
    const w = withRet.reduce((sum, item) => sum + item.startValue, 0);
    return w > 0 ? withRet.reduce((sum, item) => sum + item.startValue * item.ret, 0) / w : null;
  };
  const sectors = [...bySector.entries()].map(([sector, list]) => ({
    sector,
    label: list[0]?.label || sectorLabel(sector),
    value: list.reduce((sum, item) => sum + item.value, 0),
    count: list.length,
    // M21: the up/down counts read over the members that have a return, so the table states that denominator.
    withRet: list.filter((item) => item.ret != null).length,
    up: list.filter((item) => item.ret > 0).length,
    down: list.filter((item) => item.ret < 0).length,
    ret: weighted(list),
    members: list.sort((a, b) => b.value - a.value)
  })).sort((a, b) => b.value - a.value);
  const all = weighted(priced);
  const ranked = sectors.filter((row) => row.ret != null).sort((a, b) => b.ret - a.ret);
  // M21: share classes of one company (GOOGL·GOOG, FOXA·FOX, NWSA·NWS) are one issuer in the top-10 reading.
  const issuers = new Map();
  for (const item of priced) {
    const key = issuerKey(item);
    if (!issuers.has(key)) issuers.set(key, []);
    issuers.get(key).push(item);
  }
  const top10Groups = [...issuers.values()].sort((a, b) => sumValue(b) - sumValue(a)).slice(0, 10);
  const top10 = top10Groups.flat();
  const top10Share = sumValue(top10) / total;
  const top10Ret = weighted(top10);
  const restRet = weighted(priced.filter((item) => !top10.includes(item)));
  const upCount = priced.filter((item) => item.ret > 0).length;
  const retValues = priced.filter((item) => item.ret != null).map((item) => item.ret);
  const withRet = retValues.length;
  const equalRet = withRet ? retValues.reduce((sum, value) => sum + value, 0) / withRet : null;
  const signed = (value) => (value == null ? '—' : signedText(value, Math.abs(value) < 10 ? 2 : 1, '%'));
  const sectorsUp = ranked.filter((row) => row.ret > 0).length;
  // The index's own return over the same window (SPY's completed-close row), stated beside the map's average so a
  // gap left by uncollected members or the holdings date is visible rather than hidden.
  const benchmarkRow = bySym.get('SPY');
  const benchmark = benchmarkRow && (!basis || !benchmarkRow.factorSessionDate || benchmarkRow.factorSessionDate === basis) ? finite(benchmarkRow[key]) : null;
  const benchmarkText = benchmark != null && all != null && Math.abs(benchmark - all) >= Math.max(0.1, spec.steps[0] / 4) ? ` (지수 ETF SPY ${signed(benchmark)})` : '';
  const leadSentence = all == null
    ? `${spec.label} 수익률이 아직 발행되지 않아 크기(시가총액)만 그립니다.`
    : `지도 전체 평균(기간 시작 비중 가중) ${signed(all)}${benchmarkText}, ${withRet}종목 중 ${upCount}개 상승, ${ranked.length}개 섹터 중 ${sectorsUp}개 상승${staleCount ? `, 종가 기준일이 다른 ${staleCount}종목은 회색으로 두고 계산에서 뺐습니다` : ''}.`;
  const spread = ranked.length >= 2 ? `가장 강한 섹터는 ${ranked[0].label}(${signed(ranked[0].ret)}), 가장 약한 섹터는 ${ranked.at(-1).label}(${signed(ranked.at(-1).ret)})입니다.` : '';
  // The point a finviz map makes at a glance: did the largest companies move with the many or apart from them?
  // M02/M21: stated as a measured comparison (same start weights), with the equal-weight average beside it — a day
  // when most members rose while the index stood still is not "대형주와 나머지가 비슷".
  const gap = top10Ret != null && restRet != null ? top10Ret - restRet : null;
  const concentration = gap != null
    ? `시가총액 상위 10개 기업(지도 면적 ${Math.round(top10Share * 100)}%)은 ${signed(top10Ret)}로 나머지(${signed(restRet)})${Math.abs(gap) < spec.steps[0] ? '와 비슷했습니다' : `보다 ${Math.abs(gap).toFixed(1)}%p ${gap > 0 ? '강했습니다' : '약했습니다'}`}. 종목마다 같은 비중을 두면 평균 ${signed(equalRet)}입니다.`
    : '';
  return {
    available: true,
    version: SECTOR_MAP_VERSION,
    period: key,
    periodLabel: spec.label,
    steps: spec.steps,
    periods: available,
    basis,
    current: !!basis && (!expectedSession || basis === expectedSession),
    expectedSession,
    drawn: priced.length,
    members,
    sizeBasis,
    weightsAsOf: weightRows ? weights.asOf || null : null,
    missingNames,
    noValue,
    noReturn,
    staleCount,
    total,
    sectors,
    weightedReturn: all,
    weightBasis: 'period-start',
    equalWeightedReturn: equalRet,
    benchmarkReturn: benchmark,
    top10Issuers: top10Groups.map((group) => group.map((item) => item.sym).join('·')),
    // Without the index weights a missing mega-cap (META, GOOGL) bends the sector averages and the concentration
    // share, so the fallback names what is missing instead of making the concentration claim.
    lead: sizeBasis === 'index-weight'
      ? [leadSentence, spread, concentration].filter(Boolean).join(' ')
      : [leadSentence, spread, noValue ? `${missingNames.join('·')} 등 ${noValue}종목은 주식 수 자료가 없어 지도에서 빠졌습니다 — 이 종목들이 속한 섹터의 평균은 대표 종목이 빠진 값입니다.` : ''].filter(Boolean).join(' ')
  };
}

// Two-level layout: sectors first (by total market value), then each sector's members inside its own box, below a
// header strip when the box is tall enough to carry a label.
export function layoutSectorMap(model, width, height, { header = 18, gap = 2 } = {}) {
  if (!model?.available) return { sectors: [], tiles: [] };
  const sectorRects = squarify(model.sectors.map((sector) => ({ ...sector, value: sector.value })), { x: 0, y: 0, w: width, h: height });
  const tiles = [];
  const sectors = sectorRects.map((rect) => {
    const showHeader = rect.h >= header * 2.6 && rect.w >= 48;
    const inner = { x: rect.x + gap / 2, y: rect.y + (showHeader ? header : gap / 2), w: Math.max(0, rect.w - gap), h: Math.max(0, rect.h - (showHeader ? header : gap / 2) - gap / 2) };
    for (const tile of squarify(rect.members.map((item) => ({ ...item })), inner)) tiles.push({ ...tile, sectorLabel: rect.label });
    return { sector: rect.sector, label: rect.label, ret: rect.ret, count: rect.count, x: rect.x, y: rect.y, w: rect.w, h: rect.h, showHeader };
  });
  return { sectors, tiles };
}
