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
  return age == null || age < -1 || age > policy.maxAgeDays;
}
