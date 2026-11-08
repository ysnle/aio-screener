export const AI_MACRO_FX_ENGINE_VERSION = 'macro-fx-transmission.v1';

function validEdge(edge) {
  const kind = String(edge?.sourceKind || '').trim().toUpperCase();
  return edge && edge.source && edge.target && edge.evidenceId && edge.asOf && kind && !['REFERENCE', 'UNTRUSTED', 'UNKNOWN', 'UNAVAILABLE'].includes(kind);
}

function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function strictNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export function buildMacroFxTransmission({ macro = {}, fx = {}, target = {}, edges = [] } = {}) {
  const macroValues = record(macro);
  const fxValues = record(fx);
  const verifiedEdges = (Array.isArray(edges) ? edges : []).filter(validEdge).map((edge) => Object.freeze({
    source: edge.source, target: edge.target, direction: edge.direction || 'unknown', strength: strictNumber(edge.strength), asOf: edge.asOf, sourceKind: edge.sourceKind, evidenceId: edge.evidenceId
  }));
  const status = verifiedEdges.length ? 'supported' : Object.keys(macroValues).length || Object.keys(fxValues).length ? 'partial' : 'insufficient';
  return Object.freeze({
    schemaVersion: AI_MACRO_FX_ENGINE_VERSION,
    status,
    target: Object.freeze({ symbol: target?.symbol || null, market: target?.market || null }),
    macro: Object.freeze({ ...macroValues }),
    fx: Object.freeze({ ...fxValues }),
    transmissionEdges: Object.freeze(verifiedEdges),
    evidenceIds: Object.freeze(verifiedEdges.map((edge) => edge.evidenceId)),
    conclusion: status === 'supported' ? '출처·시점·근거 ID가 있는 매크로/FX 전달 경로만 조건부로 제시합니다.' : status === 'partial' ? '매크로/FX 관측값은 근거 행(evidenceId)으로 인용할 수 있습니다. 관측값 사이의 전달 경로(원인과 결과)는 검증된 연결이 없어 조건부 해석으로만 씁니다.' : '매크로/FX 근거가 없어 전달 경로를 만들지 않습니다.'
  });
}
