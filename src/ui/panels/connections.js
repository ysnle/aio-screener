import { describeSharedConnection } from '../../domain/connections/shared.js';

export function installConnectionPanel(root, documentRef, { readSearchEnabled = () => true } = {}) {
  if (!documentRef?.getElementById) return () => {};
  // P1607: the native panel owns its markup and lifecycle, keeping the static shell bounded.
  // P1630: only the search toggle stays visible; operator status and budget notes are details on demand.
  const anchor = documentRef.querySelector?.('.llm-panel-header + .llm-key-row');
  const panel = documentRef.createElement?.('div');
  if (anchor && panel) {
    panel.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.5;margin:4px 0;';
    panel.innerHTML = '<label style="display:flex;align-items:center;gap:4px;margin-top:6px;cursor:pointer;"><input type="checkbox" id="aio-web-search-toggle" aria-label="필요할 때 웹검색 사용" data-on-change="_aioWebSearchToggle" checked>필요할 때 웹검색 <span id="aio-web-search-status">ON</span></label><details style="margin-top:4px;"><summary style="cursor:pointer;">연결 상태</summary><div id="shared-connection-status" role="status" aria-live="polite">공용 AI · 연결 확인 전</div><div id="shared-data-status">공용 수집 자료 · 로드 확인 전</div><button data-action="_aioCheckSharedConnection" class="llm-key-save" style="margin-top:4px;">공용 연결 확인</button><div style="font-size:10px;margin-top:3px;">공용 AI 예산 $20/월 · 기존 근거 우선<br>개인 검색 API 키는 필요하지 않습니다.</div></details>';
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
    const toggle = documentRef.getElementById('aio-web-search-toggle');
    try { if (toggle) toggle.checked = readSearchEnabled(); } catch (_) {}
    const searchStatus = documentRef.getElementById('aio-web-search-status');
    if (searchStatus && toggle) searchStatus.textContent = toggle.checked ? 'ON' : 'OFF';
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
