// Roadmap item 11 (legacy decomposition, shell): the unified refresh progress surface — the floating
// #aio-refresh-progress-layer and the topbar 새로고침 button text — moved here from js/aio-ui.js
// (bindAioRefreshProgressSurface). It listens to the scheduler events src/app/refresh-scheduler.js emits
// (aio:refresh:start / progress / done). Each event carries the whole run state (keys, done, total, results), so a
// render from any one event is complete and an event that fired before this module loaded is not needed.
// v50.31: the floating panel shows only for a run the reader started (forceRefresh); background runs (boot, page entry)
// are reported quietly by the topbar button text ("갱신 N/M"). The data-status chip is updateDataStatus's alone.
// Layout and colours live in src/ui/styles/legacy-ui.css; `layer.style.display` stays a property (T802 reads it).
// globalRefresh (the topbar 새로고침 button, js/aio-ui.js) moved here too, so #topbar-refresh-btn has one writer module.

export const REFRESH_TASK_LABELS = Object.freeze({
  quotes: '시세',
  news: '뉴스',
  sentiment: '심리',
  breadth: '시장폭',
  fred: 'FRED',
  technicals: '기술지표',
  vixHistory: 'VIX 히스토리',
  hySpread: 'HY 스프레드',
  maUpdate: 'MA 갱신',
  krDynamic: 'KR 동적 데이터'
});

export function refreshTaskStatus(key, detail, byKey) {
  const row = byKey[key];
  if (row) {
    if (row.ok && !row.skipped) return '완료';
    if (row.skipped) return '스킵';
    return '확인 필요';
  }
  if (detail.currentKey === key && detail.phase === 'running') return '진행 중';
  return '대기';
}

const STATUS_TONE = { 완료: 'ok', '진행 중': 'run', 스킵: 'skip', '확인 필요': 'fail' };

function ensureLayer(documentRef) {
  let layer = documentRef.getElementById('aio-refresh-progress-layer');
  if (layer) return layer;
  layer = documentRef.createElement('div');
  layer.id = 'aio-refresh-progress-layer';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');
  layer.style.display = 'none';
  layer.innerHTML = '<div class="lu-rp-head"><div id="aio-refresh-progress-title">전체 데이터 최신화</div><div id="aio-refresh-progress-count">0/0</div></div><div class="lu-rp-track"><div id="aio-refresh-progress-bar"></div></div><div id="aio-refresh-progress-current">대기 중</div><div id="aio-refresh-progress-list"></div>';
  documentRef.body.appendChild(layer);
  return layer;
}

export function bindRefreshProgress({ root = globalThis, documentRef = root.document } = {}) {
  if (!documentRef || root._aioRefreshProgressBound) return;
  root._aioRefreshProgressBound = true;
  let lastKeys = [];

  function render(detail) {
    detail = detail || {};
    if (Array.isArray(detail.keys) && detail.keys.length) lastKeys = detail.keys.slice();
    const total = detail.total || lastKeys.length || 0;
    const done = detail.done || 0;
    const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    const active = detail.type !== 'done';
    const userRun = detail.forceRefresh === true;
    const layer = ensureLayer(documentRef);
    const btn = documentRef.getElementById('topbar-refresh-btn');
    const title = documentRef.getElementById('aio-refresh-progress-title');
    const count = documentRef.getElementById('aio-refresh-progress-count');
    const bar = documentRef.getElementById('aio-refresh-progress-bar');
    const current = documentRef.getElementById('aio-refresh-progress-current');
    const list = documentRef.getElementById('aio-refresh-progress-list');
    const failed = (detail.results || []).filter((r) => r && !r.ok && !r.skipped).length;

    if (userRun) layer.style.display = 'block';
    if (title) title.textContent = active ? '전체 데이터 최신화 중' : (failed ? '최신화 완료 - 확인 필요' : '최신화 완료');
    if (count) count.textContent = `${done}/${total}`;
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.classList.toggle('lu-rp-bar-warn', Boolean(failed));
    }
    if (current) {
      current.textContent = active
        ? `${detail.currentLabel || REFRESH_TASK_LABELS[detail.currentKey] || detail.currentKey || '데이터'} 수신 중`
        : (failed ? `${failed}개 소스 확인 필요` : '모든 요청이 정리되었습니다');
    }
    if (btn) {
      btn.disabled = active;
      btn.textContent = active ? `갱신 ${done}/${total}` : (failed ? '확인 필요' : '완료');
    }
    if (list) {
      const byKey = {};
      (detail.results || []).forEach((r) => { if (r && r.key) byKey[r.key] = r; });
      list.innerHTML = '';
      (lastKeys.length ? lastKeys : Object.keys(byKey)).forEach((key) => {
        const text = refreshTaskStatus(key, detail, byKey);
        const row = documentRef.createElement('div');
        row.className = 'lu-rp-row';
        const name = documentRef.createElement('span');
        name.textContent = REFRESH_TASK_LABELS[key] || key;
        const state = documentRef.createElement('span');
        state.textContent = text;
        state.className = 'lu-rp-state';
        state.dataset.tone = STATUS_TONE[text] || 'wait';
        row.appendChild(name);
        row.appendChild(state);
        list.appendChild(row);
      });
    }
    if (!active) {
      root.setTimeout(() => {
        const latest = root.AIO && root.AIO.getRefreshState ? root.AIO.getRefreshState() : null;
        if (!latest || latest.runId === detail.runId) {
          layer.style.display = 'none';
          if (btn) { btn.disabled = false; btn.textContent = '새로고침'; }
        }
      }, failed ? 6000 : 2500);
    }
  }

  ['aio:refresh:start', 'aio:refresh:progress', 'aio:refresh:done'].forEach((type) => {
    root.addEventListener(type, (event) => render(event.detail));
  });
}

// The topbar 새로고침 button (data-action="_aioGlobalRefresh" → root.globalRefresh): one forced scheduler run. The legacy
// fallback that fetched quotes, sentiment and news one by one is gone — AIO.forceRefreshAllData (js/aio-data.js) and
// AIO.runScheduledRefresh (src/app/refresh-scheduler.js) are always installed.
// T696 (js/aio-tests.js) reads the installed function's source for the two scheduler entry points, so the closure itself
// names them.
export function createGlobalRefresh({ root = globalThis, documentRef = root.document } = {}) {
  return async function globalRefresh() {
    const btn = documentRef.getElementById('topbar-refresh-btn');
    const aio = root.AIO;
    if (!aio || (typeof aio.forceRefreshAllData !== 'function' && typeof aio.runScheduledRefresh !== 'function')) return null;
    if (btn) { btn.textContent = '갱신 준비'; btn.disabled = true; }
    try {
      const result = typeof aio.forceRefreshAllData === 'function'
        ? await aio.forceRefreshAllData()
        : await aio.runScheduledRefresh({ forceRefresh: true });
      const activePage = documentRef.querySelector('.page.active');
      const activeId = activePage ? activePage.id.replace('page-', '') : (typeof root.prevPage !== 'undefined' ? root.prevPage : 'home');
      if (activeId === 'signal' && typeof root.initSignalDashboard === 'function') root.initSignalDashboard();
      if (btn) {
        const warn = Boolean(result && result.status === 'warn');
        btn.textContent = warn ? '확인 필요' : '완료';
        btn.disabled = false;
        root.setTimeout(() => { btn.textContent = '새로고침'; }, warn ? 6000 : 2500);
      }
      return result;
    } catch (e) {
      if (typeof root._aioLog === 'function') root._aioLog('warn', 'fetch', `globalRefresh scheduler error: ${(e && e.message) || e}`);
      if (typeof root.showDataError === 'function') root.showDataError('새로고침', '전체 새로고침 중 오류 - 일부 데이터가 갱신되지 않았을 수 있습니다', 'warn');
      if (btn) { btn.textContent = '새로고침'; btn.disabled = false; }
      return null;
    }
  };
}
