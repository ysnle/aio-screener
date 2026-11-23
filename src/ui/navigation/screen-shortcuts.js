import { ROUTE_HUBS } from './route-hubs.js';

export const SCREEN_SHORTCUTS = Object.freeze(ROUTE_HUBS.slice(0, 9).map((hub, index) => {
  const first = hub.routes.find((route) => route.tab !== false) || hub.routes[0];
  return Object.freeze({ key: String(index + 1), route: first.id, label: hub.label });
}));

export const SHELL_KEY_BINDINGS = Object.freeze([
  Object.freeze({ key: 'k', mod: 'ctrl', action: 'command-search', label: '명령 검색 (종목, 화면, 용어)', inInput: true }),
  Object.freeze({ key: 'k', mod: 'meta', action: 'command-search', label: '명령 검색 (Mac)', inInput: true }),
  Object.freeze({ key: '/', mod: '', action: 'table-filter', label: '표에서 찾기, 표가 없는 화면은 명령 검색', inInput: false }),
  Object.freeze({ key: '?', mod: 'shift', action: 'help', label: '단축키 보기', inInput: false }),
  Object.freeze({ key: 'Escape', mod: '', action: 'close', label: '닫기', inInput: true }),
  Object.freeze({ key: 'r', mod: '', action: 'refresh', label: '시세 새로고침', inInput: false }),
  ...SCREEN_SHORTCUTS.map((entry) => Object.freeze({ key: entry.key, mod: '', action: `screen:${entry.route}`, label: entry.label, inInput: false }))
]);

export function screenShortcutRoute(key) {
  return SCREEN_SHORTCUTS.find((entry) => entry.key === String(key))?.route || null;
}

export function renderScreenShortcutRows(documentRef) {
  const host = documentRef?.getElementById?.('kbd-screen-rows');
  if (!host) return false;
  host.replaceChildren(...SCREEN_SHORTCUTS.map((entry) => {
    const row = documentRef.createElement('div');
    row.className = 'kbd-row';
    const key = documentRef.createElement('span');
    key.className = 'kbd-key';
    key.textContent = entry.key;
    const desc = documentRef.createElement('span');
    desc.className = 'kbd-desc';
    desc.textContent = entry.label;
    row.append(key, desc);
    return row;
  }));
  return true;
}

export function createKeyboardHelp({ root = globalThis, documentRef = root?.document } = {}) {
  const modal = () => documentRef.getElementById('kbd-shortcuts-modal');
  function close() {
    const m = modal();
    if (!m) return;
    m.classList.remove('active');
    if (m._aioTrapCleanup) { m._aioTrapCleanup(); m._aioTrapCleanup = null; }
    const previousFocus = m._aioPreviousFocus;
    m._aioPreviousFocus = null;
    if (previousFocus && documentRef.contains(previousFocus) && !previousFocus.disabled) { try { previousFocus.focus(); } catch (_) { /* detached */ } }
  }
  function open() {
    const m = modal();
    if (!m) return;
    m._aioPreviousFocus = root._aioFocusOrigin?.() || null;
    if (m._aioTrapCleanup) m._aioTrapCleanup();
    m.classList.add('active');
    m._aioTrapCleanup = typeof root._aioModalTrap === 'function' ? root._aioModalTrap(m, close) : null;
    const first = m.querySelector('button');
    if (first) first.focus();
  }
  const isOpen = () => Boolean(modal()?.classList.contains('active'));
  return { open, close, isOpen };
}

export function handleShortcutKey(event, { root = globalThis, documentRef = root?.document, help } = {}) {
  const target = event.target || {};
  const tag = String(target.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target.isContentEditable);
  if (event.isComposing || event.keyCode === 229) return null; // a Korean syllable still composing owns its keys
  const openCommandSearch = (request) => (typeof root._aioOpenCommandSearch === 'function' && root._aioOpenCommandSearch(request) ? 'command-search' : null);
  if ((event.ctrlKey || event.metaKey) && !event.altKey && String(event.key).toLowerCase() === 'k') {
    event.preventDefault();
    return openCommandSearch({});
  }
  // The open command search is a modal dialog: its own keys (arrows, Enter, Esc) and typing stay with it.
  if (typeof root._aioCommandSearchIsOpen === 'function' && root._aioCommandSearchIsOpen()) return null;
  if (event.key === 'Escape') {
    if (event.defaultPrevented) return null; // the top layer closed itself (behaviors/layers.js)
    help.close();
    if (typeof root._aioGlossaryIsOpen === 'function' && root._aioGlossaryIsOpen()) { root._aioCloseGlossary(); return 'glossary'; }
    const aiPanel = documentRef.getElementById('ai-panel');
    if (aiPanel && aiPanel.classList.contains('open') && typeof root.toggleAIPanel === 'function') { root.toggleAIPanel(); return 'ai-panel'; }
    return 'escape';
  }
  if (isInput) return null;
  if (event.key === '/' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const filter = documentRef.querySelector('.page.active #scr-text-search');
    if (filter && filter.offsetParent !== null) { filter.focus(); return 'table-filter'; }
    return openCommandSearch({});
  }
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault();
    if (help.isOpen()) help.close(); else help.open();
    return 'help';
  }
  const route = screenShortcutRoute(event.key);
  if (route && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (typeof root.showPage === 'function') root.showPage(route, null);
    return route;
  }
  if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (typeof root.fetchLiveQuotes === 'function') root.fetchLiveQuotes();
    return 'refresh';
  }
  return null;
}

export function installScreenShortcuts({ root = globalThis, documentRef = root?.document } = {}) {
  if (root) root.AIO_SCREEN_SHORTCUT_ROUTE = screenShortcutRoute;
  if (root && documentRef?.addEventListener && !root._aioShortcutKeysBound) {
    root._aioShortcutKeysBound = true;
    const help = createKeyboardHelp({ root, documentRef });
    root.openKbdHelp = help.open; // data-action on the sidebar 단축키 보기 button
    root.closeKbdHelp = help.close; // data-action / data-close-on-outside on the modal
    documentRef.addEventListener('keydown', (event) => handleShortcutKey(event, { root, documentRef, help }));
  }
  return renderScreenShortcutRows(documentRef);
}
