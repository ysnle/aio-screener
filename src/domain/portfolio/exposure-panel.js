// ADR-0003 S4: the 익스포저 · 집중도 panel's reading — sector shares, the top-three share, the weighted quant rank, the mean
// pairwise correlation and the warnings — computed here from the panel's base-currency rows; the panel only renders it.
// The lines are RULES.portfolio (the same sector line the 점검 criteria and the sector card state).
//
// An ETF (screener index/sector 'ETF', the rule the native 점검 uses for topIsEtf) is many companies and a holding without
// a screener sector is unclassified — neither is a sector. SPY 40 + QQQ 25 once read 'ETF 섹터 65% 집중', the opposite of
// the 점검 card on the same screen. Both stay on the list, named, but only real sectors are counted and warned on. A
// sector ETF keeps its sector (instrument type and sector exposure are separate axes).
import { RULES } from '../rules/thresholds.js';
import { sectorBand } from './concentration-bands.js';

const BANDS = RULES.portfolio;
const isEtf = (row) => !!row.stock && (row.stock.index === 'ETF' || row.stock.sector === 'ETF');
const kindOf = (row) => (row.stock?.sector && row.stock.sector !== 'ETF' ? 'sector' : isEtf(row) ? 'etf' : 'none');

/** Mean of the finite off-diagonal cells of a correlation matrix, else of pearson() over every pair of return series. */
function meanPairwiseCorrelation({ matrix = null, returnsMap = null, pearson = null }) {
  let sum = 0; let count = 0;
  if (Array.isArray(matrix)) {
    for (let a = 0; a < matrix.length; a++) for (let b = a + 1; b < matrix.length; b++) {
      const c = matrix[a]?.[b];
      if (typeof c === 'number' && Number.isFinite(c)) { sum += c; count++; }
    }
  } else if (typeof pearson === 'function') {
    const keys = Object.keys(returnsMap || {});
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
      const c = pearson(returnsMap[keys[a]], returnsMap[keys[b]]);
      if (c != null) { sum += c; count++; }
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * @param {{ rows: Array<{sym:string, value:number, stock:object|null}>, total: number, posSum: number,
 *   corrMatrix?: number[][]|null, returnsMap?: object|null, pearson?: Function|null, sectorLabel?: (s:string)=>string }} input
 *   rows carry base-currency values; total is the panel's denominator (total assets with cash when known, else posSum).
 */
export function deriveExposurePanel({ rows = [], total, posSum, corrMatrix = null, returnsMap = null, pearson = null, sectorLabel = (s) => s } = {}) {
  const weighted = rows.map((row) => ({ ...row, w: row.value / total }));
  const bySector = new Map();
  for (const row of weighted) {
    const kind = kindOf(row);
    const name = kind === 'etf' ? 'ETF(여러 업종 묶음)' : kind === 'none' ? '미분류' : sectorLabel(row.stock.sector);
    const entry = bySector.get(name) || { name, kind, share: 0 };
    entry.share += row.w;
    entry.kind = kind;
    bySector.set(name, entry);
  }
  const sectors = [...bySector.values()].sort((a, b) => b.share - a.share)
    .map((entry) => ({ ...entry, band: entry.kind === 'sector' ? sectorBand(entry.share * 100) : null }));
  const realSectors = sectors.filter((entry) => entry.kind === 'sector');
  const top3Rows = weighted.slice().sort((a, b) => b.w - a.w).slice(0, 3);
  const top3 = top3Rows.reduce((sum, row) => sum + row.w, 0);
  const top3Etf = top3Rows.filter(isEtf).length;
  const top3Over = top3 * 100 > BANDS.top3Over;
  // The rank average is over the ranked holdings only; its coverage of the holdings is printed beside it.
  const ranked = weighted.filter((row) => row.stock && typeof row.stock.rank === 'number');
  const rankWeight = ranked.reduce((sum, row) => sum + row.w, 0);
  const avgRank = rankWeight > 0 ? Math.round(ranked.reduce((sum, row) => sum + row.stock.rank * row.w, 0) / rankWeight) : null;
  const rankCoverage = posSum > 0 ? Math.round(ranked.reduce((sum, row) => sum + (row.value || 0), 0) / posSum * 100) : null;
  // From the risk panel's own matrix when it is passed — its KR–US cells are weekly (non-synchronous closes
  // understate daily co-movement), so a daily average here read lower than the matrix beside it.
  const avgCorr = meanPairwiseCorrelation({ matrix: corrMatrix, returnsMap, pearson });
  const corrOver = avgCorr != null && avgCorr > BANDS.corrOver;
  const warnings = [];
  const lead = realSectors[0];
  if (lead && lead.band === 'over') warnings.push(`${lead.name} 섹터 ${Math.round(lead.share * 100)}% 집중(>${BANDS.sectorOver}%)`);
  if (top3Over) warnings.push(`상위 3종목 ${Math.round(top3 * 100)}% 집중(>${BANDS.top3Over}%${top3Etf ? `, ETF ${top3Etf}개 포함` : ''})`);
  if (corrOver) warnings.push(`평균 상관 ${avgCorr.toFixed(2)} — 분산효과 약함(>${BANDS.corrOver.toFixed(2)})`);
  return {
    sectors, sectorCount: realSectors.length, holdings: weighted.length,
    top3, top3Over, avgRank, rankCoverage, avgCorr, warnings,
    clearNote: '집중도·상관 한도 내'
  };
}
