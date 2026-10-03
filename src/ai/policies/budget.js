// P1353: paid search is separate from collected public evidence and shared text inference.
export function preparePaidWebSearch({ serverKey, state, bumpCounter, now = Date.now() } = {}) {
  if (serverKey) throw new Error('공유 AI의 월 예산 보호 때문에 유료 웹 검색을 사용할 수 없습니다. 수집 자료를 바탕으로 질문하세요.');
  if (!state) throw new Error('web-search-state-unavailable');
  const stats = state._aioWebSearchStats || { calls: 0, lastUsedAt: null };
  stats.calls += 1;
  stats.lastUsedAt = new Date(now).toISOString();
  state._aioWebSearchStats = stats;
  try { if (typeof bumpCounter === 'function') bumpCounter('claudeWebSearch'); } catch (_) {}
}
