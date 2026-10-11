// P1608: diagnostics never grant paid access or impose a per-user allowance.
// Only the explicitly configured shared Worker owns monetary admission.
export function preparePaidWebSearch({ serverKey, health, state, now = Date.now() } = {}) {
  if (!serverKey || health?.ai?.paidWebSearchEnabled !== true) throw new Error('공유 AI의 월 예산 경로가 확인되지 않아 유료 웹 검색을 사용할 수 없습니다.');
  if (!state) throw new Error('web-search-state-unavailable');
  const stats = state._aioWebSearchStats || { calls: 0, lastUsedAt: null };
  stats.calls += 1;
  stats.lastUsedAt = new Date(now).toISOString();
  state._aioWebSearchStats = stats;
}
