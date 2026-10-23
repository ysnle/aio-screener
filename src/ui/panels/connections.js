import { describeSharedConnection } from '../../domain/connections/shared.js';

export function installConnectionPanel(root, documentRef) {
  if (!documentRef?.getElementById) return () => {};
  // P1607: the native panel owns its markup and lifecycle, keeping the static shell bounded.
  // P1630: operator status and budget notes are details on demand. P1653: web search is automatic (owner 2026-10-12) —
  // the AI decides when existing evidence is not enough, so there is no user toggle.
  // v58.56 (re-audit #26): the model line now opens the sidebar's 연결·보안 설정 fold; the older shell kept it under the header.
  // v58.68: the card is operator-only and the fold is gone; the model line carries its own id.
  const anchor = documentRef.getElementById?.('llm-connection-anchor') || documentRef.querySelector?.('.llm-panel-header + .llm-key-row');
  const panel = documentRef.createElement?.('div');
  if (anchor && panel) {
    panel.className = 'cnp-panel'; // src/ui/styles/connection-panel.css
    panel.innerHTML = '<details><summary>연결 상태</summary><div id="shared-connection-status" role="status" aria-live="polite">공용 AI · 연결 확인 전</div><div id="shared-data-status">공용 수집 자료 · 로드 확인 전</div><button data-action="_aioCheckSharedConnection" class="llm-key-save">공용 연결 확인</button><div class="cnp-note">공용 AI 예산 $20/월 · 기존 근거 우선<br>개인 검색 API 키는 필요하지 않습니다.</div></details>';
    anchor.insertAdjacentElement('afterend', panel);
  }
  let disposed = false;
  const render = () => {
    if (disposed) return;
    const ai = documentRef.getElementById('shared-connection-status');
    const data = documentRef.getElementById('shared-data-status');
    const state = root._aioLastClaudeRouteState;
    if (ai) ai.textContent = state?.health ? describeSharedConnection(state.health, state.ok || state.reason === 'AUTH_FAILED').label : state ? '공용 AI 연결 확인 실패 · 잠시 후 다시 확인' : '공용 AI · 연결 확인 전';
    if (data) data.textContent = root._serverDataMeta?.loadedAt ? '공용 수집 자료 로드됨 · 항목별 출처·관측일 확인' : '공용 수집 자료 · 로드 확인 전';
  };
  const events = ['aio:workerHealth', 'aio:serverDataLoaded'];
  for (const event of events) root.addEventListener?.(event, render);
  const previous = root._aioCheckSharedConnection;
  const check = async () => {
    if (disposed) return;
    const ai = documentRef.getElementById('shared-connection-status');
    if (ai) ai.textContent = '공용 AI 연결 확인 중';
    try { await root._aioEnsureClaudeRoute?.(); } catch { /* Render the last verified state. */ }
    render();
  };
  root._aioCheckSharedConnection = check;
  render();
  return () => {
    disposed = true;
    panel?.remove();
    for (const event of events) root.removeEventListener?.(event, render);
    if (root._aioCheckSharedConnection === check) root._aioCheckSharedConnection = previous;
  };
}
