export const AI_SECTOR_ENGINE_VERSION = 'sector-decomposition.v1';

function finite(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

export function buildSectorDecomposition({ sector = null, constituents = [], observedAt = null, source = null } = {}) {
  const rows = (Array.isArray(constituents) ? constituents : []).map((row) => ({
    symbol: row?.symbol || row?.ticker || null,
    returnPct: finite(row?.returnPct ?? row?.changePct ?? row?.return),
    weight: finite(row?.weight),
    source: row?.source || source || null,
    asOf: row?.asOf || row?.observedAt || observedAt || null,
    evidenceId: row?.evidenceId || null
  })).filter((row) => row.symbol && row.returnPct !== null);
  const advances = rows.filter((row) => row.returnPct > 0).length;
  const declines = rows.filter((row) => row.returnPct < 0).length;
  const unchanged = rows.length - advances - declines;
  const averageReturnPct = rows.length ? rows.reduce((sum, row) => sum + row.returnPct, 0) / rows.length : null;
  const ranked = [...rows].sort((a, b) => b.returnPct - a.returnPct);
  const status = !rows.length ? 'insufficient' : rows.length < 3 ? 'partial' : 'ready';
  return Object.freeze({
    schemaVersion: AI_SECTOR_ENGINE_VERSION,
    status,
    sector: sector || null,
    observedAt: observedAt || rows.find((row) => row.asOf)?.asOf || null,
    source: source || rows.find((row) => row.source)?.source || null,
    breadth: Object.freeze({ total: rows.length, advances, declines, unchanged, advanceRatio: rows.length ? advances / rows.length : null }),
    averageReturnPct,
    leaders: Object.freeze(ranked.slice(0, 3)),
    laggards: Object.freeze(ranked.slice(-3).reverse()),
    evidenceIds: Object.freeze(rows.map((row) => row.evidenceId).filter(Boolean)),
    conclusion: status === 'insufficient' ? '섹터 구성종목 근거가 부족해 분해 결과를 만들 수 없습니다.' : status === 'partial' ? '구성종목 일부만 확인되어 섹터 breadth는 부분 결과입니다.' : '구성종목 수익률과 breadth를 근거로 섹터 내부 분산을 계산했습니다.'
  });
}
