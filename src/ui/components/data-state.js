// v59.70 (ui-states): one loading / empty / error look for every data card. A card hands its host element and one of
// three states; the host gets aria-busy while loading and its children are replaced by a skeleton, one line, or one
// line plus 다시 시도. The look lives in src/ui/styles/ui-states.css (.aio-state). A loading state that is still on screen
// after `timeoutMs` (default 20 s, 0 = never) turns into the error state with the same retry.
export const DATA_STATES = Object.freeze(['loading', 'empty', 'error']);

const DEFAULT_TEXT = Object.freeze({ empty: '표시할 자료가 없습니다', error: '불러오지 못했습니다' });
export const DATA_STATE_TIMEOUT_MS = 20000;

export function dataState(doc, { state = 'loading', text = '', onRetry = null, lines = 3 } = {}) {
  const kind = DATA_STATES.includes(state) ? state : 'loading';
  const box = doc.createElement('div');
  box.className = `aio-state is-${kind}`;
  box.dataset.state = kind;
  if (kind === 'loading') {
    box.setAttribute('aria-hidden', 'true');
    const count = Math.max(1, Math.min(6, Number(lines) || 3));
    for (let i = 0; i < count; i += 1) {
      const bar = doc.createElement('span');
      bar.className = 'aio-state__bar';
      box.append(bar);
    }
    return box;
  }
  box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  const line = doc.createElement('span');
  line.className = 'aio-state__text';
  line.textContent = text || DEFAULT_TEXT[kind];
  box.append(line);
  if (kind === 'error' && typeof onRetry === 'function') {
    const retry = doc.createElement('button');
    retry.type = 'button';
    retry.className = 'sx-btn aio-state__retry';
    retry.textContent = '다시 시도';
    retry.addEventListener('click', onRetry);
    box.append(retry);
  }
  return box;
}

// Replaces the host's content with the state and returns the state element.
export function renderDataState(host, options = {}) {
  if (!host?.ownerDocument) return null;
  const box = dataState(host.ownerDocument, options);
  if (box.dataset.state === 'loading') host.setAttribute('aria-busy', 'true');
  else host.removeAttribute('aria-busy');
  host.replaceChildren(box);
  const timeoutMs = options.timeoutMs ?? DATA_STATE_TIMEOUT_MS;
  const view = host.ownerDocument.defaultView;
  if (box.dataset.state === 'loading' && timeoutMs > 0 && view?.setTimeout) {
    view.setTimeout(() => {
      // Only the same skeleton, still shown: a renderer that drew content (or another state) in the meantime wins.
      if (box.isConnected && box.parentNode === host) renderDataState(host, { state: 'error', text: options.timeoutText || '', onRetry: options.onRetry || null });
    }, timeoutMs);
  }
  return box;
}

// The basis line of a close-based card before history.json is in: waiting, or (after a failed load) not received.
export const HISTORY_WAIT_TEXT = Object.freeze({ loading: '종가 기록을 불러오는 중입니다.', failed: '종가 기록을 받지 못했습니다.', empty: '종가 기록이 없습니다.' });
export function historyWaitText(root) {
  return HISTORY_WAIT_TEXT[root?.__aioHistoryLoadState] || HISTORY_WAIT_TEXT.loading;
}
// The same for a line that waits on data.json's official releases (매크로).
export const SERVER_DATA_WAIT_TEXT = Object.freeze({ loading: '공식 발표 자료를 불러오는 중입니다.', failed: '공식 발표 자료를 받지 못했습니다.', empty: '공식 발표 자료가 없습니다.' });
export function serverDataWaitText(root) {
  return SERVER_DATA_WAIT_TEXT[root?.__aioServerDataLoadState] || SERVER_DATA_WAIT_TEXT.loading;
}

// One line at the top of the content column when a core file did not arrive (history.json: every close-based card;
// data.json: quotes and macro values), with 다시 시도. The loaders publish the failure (js/aio-data.js _aioLoadHistory,
// src/data/server-data-loader.js); a retry that succeeds removes the line and the pages redraw on their usual events.
// A file that answered with nothing is the empty state; one that has not answered within CORE_FILE_TIMEOUT_MS counts
// as failed until it arrives.
const CORE_FILES = Object.freeze([
  { key: 'history', state: '__aioHistoryLoadState', failed: 'aio:historyFailed', loaded: 'aio:historyLoaded', label: '종가 기록', object: '종가 기록을', subject: '종가 기록이', load: '_aioLoadHistory', arrived: (root) => Array.isArray(root._aioHistory) },
  { key: 'data', state: '__aioServerDataLoadState', failed: 'aio:serverDataFailed', loaded: 'aio:serverDataLoaded', label: '시세·지표 자료', object: '시세·지표 자료를', subject: '시세·지표 자료가', load: '_aioLoadServerData', arrived: (root) => !!root.__aioServerDataApplied },
]);

// 60 s, not the card default: history.json is about 3 MB and took 40 s+ on slow 3G (first-users F01), still arriving.
export const CORE_FILE_TIMEOUT_MS = 60000;
export function installLoadFailureNotice(root, doc, { timeoutMs = CORE_FILE_TIMEOUT_MS } = {}) {
  if (!root?.addEventListener || !doc) return () => {};
  let notice = null;
  const failedFiles = () => CORE_FILES.filter((file) => root[file.state] === 'failed' || root[file.state] === 'empty');
  const retry = async () => {
    const button = notice?.querySelector('.aio-state__retry');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    await Promise.all(failedFiles().map((file) => Promise.resolve().then(() => root[file.load]?.()).catch(() => null)));
    sync();
  };
  const sync = () => {
    const failed = failedFiles();
    if (!failed.length) { notice?.remove(); notice = null; return; }
    const host = doc.getElementById('main-content');
    if (!host) return;
    const empty = failed.every((file) => root[file.state] === 'empty');
    const names = failed.length > 1 ? `${failed[0].label}과 ${(empty ? failed[1].subject : failed[1].object)}` : (empty ? failed[0].subject : failed[0].object);
    const next = dataState(doc, empty ? { state: 'empty', text: `${names} 비어 있습니다` } : { state: 'error', text: `${names} 받지 못했습니다`, onRetry: retry });
    next.id = 'aio-load-failure';
    next.classList.add('aio-load-failure');
    if (notice?.isConnected) notice.replaceWith(next); else host.prepend(next);
    notice = next;
    // Lines already drawn (and the first-paint HTML) still say 불러오는 중; renderers drawing later read historyWaitText.
    const waits = new Map([[HISTORY_WAIT_TEXT.loading, historyWaitText(root)], [SERVER_DATA_WAIT_TEXT.loading, serverDataWaitText(root)]]);
    for (const node of host.querySelectorAll('.page-subtitle, .home-hero-basis, .briefing-read-headline')) {
      const now = waits.get(node.textContent.trim());
      if (now) node.textContent = now;
    }
  };
  const events = CORE_FILES.flatMap((file) => [file.failed, file.loaded]);
  for (const type of events) root.addEventListener(type, sync);
  // A request that never answers (a stalled connection) is not left as 불러오는 중 forever.
  const timer = timeoutMs > 0 ? root.setTimeout?.(() => {
    for (const file of CORE_FILES) if (!root[file.state] && !file.arrived(root)) root[file.state] = 'failed';
    sync();
  }, timeoutMs) : null;
  sync();
  return () => { if (timer) root.clearTimeout?.(timer); for (const type of events) root.removeEventListener(type, sync); notice?.remove(); };
}

// Removes a state the host still shows (a renderer about to draw real content calls this first).
export function clearDataState(host) {
  if (!host) return;
  host.removeAttribute('aria-busy');
  for (const box of host.querySelectorAll?.(':scope > .aio-state') || []) box.remove();
}
