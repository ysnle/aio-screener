export const SCREENER_MODEL_VERSION = 'screener.v1';

export function deriveScreenerRanking({ rows = [], inputVersion = 'unknown' } = {}) {
  const ranked = (Array.isArray(rows) ? rows : []).map((row, index) => ({ ...row, rank: Number.isFinite(Number(row?.score)) ? index + 1 : null })).sort((a, b) => (Number(b.score) || -Infinity) - (Number(a.score) || -Infinity));
  return Object.freeze({ modelVersion: SCREENER_MODEL_VERSION, inputVersion, status: ranked.length ? 'current' : 'unavailable', rows: ranked.map((row, index) => ({ ...row, rank: row.rank || index + 1 })) });
}
