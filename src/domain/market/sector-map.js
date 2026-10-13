// 2026-10-13 (owner: "finviz maps 같은 S&P 500 지도"): the S&P 500 members AIO collects, grouped by sector,
// each tile sized by market value and coloured by its return over one completed period. Pure: rows in, layout
// and reading out. Market value = valuation close × shares outstanding, both already published per row for P/E
// (no raw current price is republished — P715). A member without shares or a return is counted, not drawn.
import { sectorLabel } from '../screener/screener-read.js';

export const SECTOR_MAP_VERSION = 'sector-map.v1';

// Colour steps per window (|return| thresholds for the 1st/2nd/3rd shade). Longer windows move more, so the
// same shade means a comparable "how unusual" across tabs rather than the same raw percent.
export const SECTOR_MAP_PERIODS = Object.freeze({
  ret1d: Object.freeze({ label: '1일', steps: [0.5, 1.5, 3] }),
  ret5d: Object.freeze({ label: '1주', steps: [1, 3, 6] }),
  ret1m: Object.freeze({ label: '1개월', steps: [2, 6, 12] }),
  ret3m: Object.freeze({ label: '3개월', steps: [4, 12, 25] })
});

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);

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
const GICS_KO = Object.freeze({ 'Information Technology': '기술', Communication: '통신', 'Communication Services': '통신', 'Consumer Discretionary': '경기소비재',
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
      const ret = finite(row?.[key]);
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
      const close = finite(row._valuationPePrice ?? row.pePrice);
      const shares = finite(row._valuationSharesOutstanding ?? row.valuationSharesOutstanding);
      let value = close != null && shares != null && close > 0 && shares > 0 ? close * shares : null;
      // A share count in the wrong unit or class (one stock at 20조 달러) shows up as a turnover no listed stock has.
      const turnover = value ? finite(row.dollarVolume30d) / value : null;
      if (value != null && turnover != null && (turnover < 0.0002 || turnover > 0.2)) value = null;
      if (value == null) { noValue += 1; missing.push(row); continue; }
      const ret = finite(row[key]);
      if (ret == null) noReturn += 1;
      priced.push({ sym: String(row.sym || row.symbol).toUpperCase(), name: row.name || '', sector: row.sector, label: sectorLabel(row.sector), value, ret, basis: row.factorSessionDate || null, collected: true });
    }
    missingNames = missing.sort((a, b) => (finite(b.dollarVolume30d) || 0) - (finite(a.dollarVolume30d) || 0)).slice(0, 4).map((row) => String(row.sym || row.symbol).toUpperCase());
  }
  const available = Object.fromEntries(Object.keys(SECTOR_MAP_PERIODS).map((id) => [id, list.some((row) => finite(row[id]) != null)]));
  if (priced.length < 20) {
    return { available: false, version: SECTOR_MAP_VERSION, period: key, periods: available, reason: `시가총액을 계산할 수 있는 구성 종목이 ${priced.length}개라 지도를 그리지 않습니다.` };
  }
  const total = priced.reduce((sum, item) => sum + item.value, 0);
  const bySector = new Map();
  for (const item of priced) {
    if (!bySector.has(item.sector)) bySector.set(item.sector, []);
    bySector.get(item.sector).push(item);
  }
  const weighted = (list) => {
    const withRet = list.filter((item) => item.ret != null);
    const w = withRet.reduce((sum, item) => sum + item.value, 0);
    return w > 0 ? withRet.reduce((sum, item) => sum + item.value * item.ret, 0) / w : null;
  };
  const sectors = [...bySector.entries()].map(([sector, list]) => ({
    sector,
    label: list[0]?.label || sectorLabel(sector),
    value: list.reduce((sum, item) => sum + item.value, 0),
    count: list.length,
    up: list.filter((item) => item.ret > 0).length,
    down: list.filter((item) => item.ret < 0).length,
    ret: weighted(list),
    members: list.sort((a, b) => b.value - a.value)
  })).sort((a, b) => b.value - a.value);
  const dates = [...new Set(priced.map((item) => item.basis).filter(Boolean))].sort();
  const basis = dates.at(-1) || null;
  const all = weighted(priced);
  const ranked = sectors.filter((row) => row.ret != null).sort((a, b) => b.ret - a.ret);
  const top10 = [...priced].sort((a, b) => b.value - a.value).slice(0, 10);
  const top10Share = top10.reduce((sum, item) => sum + item.value, 0) / total;
  const top10Ret = weighted(top10);
  const restRet = weighted(priced.filter((item) => !top10.includes(item)));
  const upCount = priced.filter((item) => item.ret > 0).length;
  const withRet = priced.filter((item) => item.ret != null).length;
  const signed = (value) => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(Math.abs(value) < 10 ? 2 : 1)}%`);
  const sectorsUp = ranked.filter((row) => row.ret > 0).length;
  const leadSentence = all == null
    ? `${spec.label} 수익률이 아직 발행되지 않아 크기(시가총액)만 그립니다.`
    : `시가총액 가중 ${signed(all)} · ${withRet}종목 중 ${upCount}개 상승 · ${ranked.length}개 섹터 중 ${sectorsUp}개 상승.`;
  const spread = ranked.length >= 2 ? `가장 강한 섹터는 ${ranked[0].label}(${signed(ranked[0].ret)}), 가장 약한 섹터는 ${ranked.at(-1).label}(${signed(ranked.at(-1).ret)})입니다.` : '';
  // The point a finviz map makes at a glance: is the index carried by its largest names or by the many?
  const concentration = top10Ret != null && restRet != null
    ? `시가총액 상위 10종목이 지도 면적의 ${Math.round(top10Share * 100)}%이고 ${signed(top10Ret)}, 나머지는 ${signed(restRet)} — ${Math.abs(top10Ret - restRet) < (spec.steps[0]) ? '대형주와 나머지가 비슷하게 움직였습니다.' : top10Ret > restRet ? '지수는 소수 대형주가 끌었습니다.' : '대형주보다 나머지 종목이 강했습니다.'}`
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
    total,
    sectors,
    weightedReturn: all,
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
