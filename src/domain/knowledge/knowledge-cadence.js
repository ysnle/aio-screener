// P1477 (knowledge review 2026-10-04): one short freshness window for everything made long-lived facts
// (a company's role, a physical principle) look stale and buried the rows that do age. Each kind of
// knowledge has its own refresh rule; staleness is judged against that rule.
export const KNOWLEDGE_CADENCE = Object.freeze({
  principle: { label: '기본 개념·물리 원리', rule: '내용 변경이나 오류 발견 시 갱신', maxAgeDays: null },
  'company-role': { label: '기업 역할·제품군', rule: '공식 자료가 바뀔 때 갱신 · 1년마다 재확인', maxAgeDays: 365 },
  'production-status': { label: '제품 세대·양산 상태', rule: '공식 발표 기준 · 90일마다 재확인', maxAgeDays: 90 },
  observation: { label: '실적·시장 수치', rule: '관측일·발표일을 함께 표시 · 정기 갱신', maxAgeDays: 45 }
});

const dayMs = 86400000;
export function ageDays(asOf, now = Date.now()) {
  const t = Date.parse(asOf || '');
  return Number.isFinite(t) ? Math.floor((now - t) / dayMs) : null;
}

export function isOverdue(kind, asOf, now = Date.now()) {
  const policy = KNOWLEDGE_CADENCE[kind];
  if (!policy?.maxAgeDays) return false;
  const age = ageDays(asOf, now);
  return age == null || age > policy.maxAgeDays;
}

// Player/product registry rows: roles and product families are company-role facts; a product's
// production status (RAMP/MATURE/RESEARCH) ages faster.
export function registryCadenceSummary(currentness, now = Date.now()) {
  const players = currentness?.players || [];
  const products = currentness?.products || [];
  const roleOverdue = [...players, ...products].filter((row) => isOverdue('company-role', row.asOf, now)).length;
  const statusOverdue = products.filter((row) => row.productionStatus && isOverdue('production-status', row.asOf, now)).length;
  return {
    roleRows: players.length + products.length,
    roleOverdue,
    statusRows: products.filter((row) => row.productionStatus).length,
    statusOverdue,
    text: `${KNOWLEDGE_CADENCE['company-role'].label}: ${KNOWLEDGE_CADENCE['company-role'].rule} — 재확인 기한 초과 ${roleOverdue}행 · ${KNOWLEDGE_CADENCE['production-status'].label}: ${KNOWLEDGE_CADENCE['production-status'].rule} — 기한 초과 ${statusOverdue}행 · 실적·생산량·출하 같은 현재 수치는 이 지도에서 주장하지 않습니다.`
  };
}
