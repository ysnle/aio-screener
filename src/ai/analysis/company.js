export const AI_COMPANY_ENGINE_VERSION = 'company-quality-valuation.v1';

function fact(value, fallback = null) {
  if (!value || typeof value !== 'object') return fallback;
  return { value: Number.isFinite(Number(value.value)) ? Number(value.value) : null, unit: value.unit || null, asOf: value.asOf || null, source: value.source || null, evidenceId: value.evidenceId || null };
}

function suppliedLabel(value, labels) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? (numeric >= 0.67 ? labels[2] : numeric >= 0.4 ? labels[1] : labels[0]) : null;
}

export function buildCompanyAssessment({ entity = {}, quality = {}, valuation = {}, facts = {} } = {}) {
  const qualityInputs = ['profitability', 'financialHealth', 'growth', 'moat'].map((key) => ({ key, value: Number.isFinite(Number(quality[key])) ? Number(quality[key]) : null })).filter((row) => row.value !== null);
  const qualityScore = qualityInputs.length ? qualityInputs.reduce((sum, row) => sum + row.value, 0) / qualityInputs.length : null;
  const valuationPercentile = Number.isFinite(Number(valuation.percentile)) ? Number(valuation.percentile) : null;
  const valuationLabel = suppliedLabel(valuationPercentile === null ? null : 1 - valuationPercentile / 100, ['비교상 고평가 가능성', '가치 판단 보류', '비교상 저평가 가능성']);
  const factRows = Object.entries(facts || {}).map(([key, value]) => ({ key, ...fact(value) })).filter((row) => row.value !== null);
  const status = !qualityInputs.length && valuationPercentile === null && !factRows.length ? 'insufficient' : 'partial';
  return Object.freeze({
    schemaVersion: AI_COMPANY_ENGINE_VERSION,
    status,
    entity: { symbol: entity.symbol || entity.ticker || null, name: entity.name || null, market: entity.market || null },
    quality: Object.freeze({ inputs: Object.freeze(qualityInputs), score: qualityScore, label: suppliedLabel(qualityScore, ['근거 부족/취약', '혼합/검토 필요', '상대적으로 양호']) }),
    valuation: Object.freeze({ percentile: valuationPercentile, label: valuationLabel, benchmark: valuation.benchmark || null }),
    facts: Object.freeze(factRows),
    evidenceIds: Object.freeze(factRows.map((row) => row.evidenceId).filter(Boolean)),
    conclusion: status === 'insufficient' ? '기업 품질·밸류에이션 입력 근거가 없어 결론을 만들지 않습니다.' : '제공된 품질·밸류에이션 입력만 요약했으며, 입력되지 않은 항목은 추정하지 않습니다.'
  });
}
