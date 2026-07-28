export const AI_MACRO_FX_ENGINE_VERSION = 'macro-fx-transmission.v1';

function validEdge(edge) {
  return edge && edge.source && edge.target && edge.evidenceId && edge.asOf && edge.sourceKind !== 'REFERENCE';
}

export function buildMacroFxTransmission({ macro = {}, fx = {}, target = {}, edges = [] } = {}) {
  const verifiedEdges = (Array.isArray(edges) ? edges : []).filter(validEdge).map((edge) => ({
    source: edge.source, target: edge.target, direction: edge.direction || 'unknown', strength: Number.isFinite(Number(edge.strength)) ? Number(edge.strength) : null, asOf: edge.asOf, sourceKind: edge.sourceKind, evidenceId: edge.evidenceId
  }));
  const status = verifiedEdges.length ? 'supported' : Object.keys(macro).length || Object.keys(fx).length ? 'partial' : 'insufficient';
  return Object.freeze({
    schemaVersion: AI_MACRO_FX_ENGINE_VERSION,
    status,
    target: { symbol: target.symbol || null, market: target.market || null },
    macro: Object.freeze({ ...macro }),
    fx: Object.freeze({ ...fx }),
    transmissionEdges: Object.freeze(verifiedEdges),
    evidenceIds: Object.freeze(verifiedEdges.map((edge) => edge.evidenceId)),
    conclusion: status === 'supported' ? '출처·시점·근거 ID가 있는 매크로/FX 전달 경로만 조건부로 제시합니다.' : status === 'partial' ? '매크로/FX 관측값은 있으나 검증된 전달 경로가 부족합니다.' : '매크로/FX 근거가 없어 전달 경로를 만들지 않습니다.'
  });
}
