// P1449 (검토판 9 · P1215 계승): 화면 이동은 "열리는 것"과 "조사 맥락이 이어지는 것"이 별개다.
// 링크가 종목·질문·섹터를 명시해 옮길 때는 같은 선택(target route)에서 1회 소비하는 handoff로
// 전달한다 — 암묵적 전역 상태(이전 검색어, 이전 뷰)가 다음 화면의 답변이 되지 않게.
// R630(직접 경로는 명시된 handoff로만 종목을 시드한다) / P1216(사유는 사용자 문서로) 준수.

const HANDOFF_KEY = '_aioResearchHandoff';

export function setResearchHandoff({ root = globalThis, routeId = null, context = {}, label = null, fromRoute = null } = {}) {
  if (!root || !routeId) return false;
  const clean = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (value == null || value === '') continue;
    clean[key] = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  }
  root[HANDOFF_KEY] = Object.freeze({ routeId: String(routeId), context: Object.freeze(clean), label: label || null, fromRoute: fromRoute || null, at: Date.now() });
  return true;
}

// Same-route one-shot consume. Different-route handoffs are left for their own route.
export function consumeResearchHandoff({ root = globalThis, routeId = null } = {}) {
  const handoff = root?.[HANDOFF_KEY];
  if (!handoff || handoff.routeId !== routeId) return null;
  delete root[HANDOFF_KEY];
  return handoff;
}
