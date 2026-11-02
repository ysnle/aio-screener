// v57.54: number keys 1..8 open the eight screens in menu order. The help modal and the key handler
// (both below since roadmap 11; they were in js/aio-ui.js) read this table, which is derived from ROUTE_HUBS — the same table that draws the
// menu — so the listed names, their order and what each key does cannot drift apart again (the old
// modal listed 시그널/매크로/뉴스/테마·트렌드 while the keys opened other routes).
import { ROUTE_HUBS } from './route-hubs.js';

export const SCREEN_SHORTCUTS = Object.freeze(ROUTE_HUBS.slice(0, 9).map((hub, index) => {
  const first = hub.routes.find((route) => route.tab !== false) || hub.routes[0];
  return Object.freeze({ key: String(index + 1), route: first.id, label: hub.label });
}));

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

// Roadmap item 11 (legacy decomposition, shell): the ? help modal (openKbdHelp / closeKbdHelp) and the document keydown
// handler moved here from js/aio-ui.js, beside the screen table they read. Behaviour is unchanged:
//   Escape  — closes the help modal, then the glossary if it shows, else the AI panel
//   Ctrl/⌘K — focuses the active screen's search box; with none on screen, opens 용어 사전 (works inside inputs)
//   ?       — toggles the help modal; 1..8 — the screens in menu order; R — refreshes live quotes (not Ctrl/⌘R)
// The other keys are ignored while typing in an input, textarea, select or contenteditable.
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
    const active = documentRef.activeElement;
    m._aioPreviousFocus = active && active !== documentRef.body ? active : null;
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
  if (event.key === 'Escape') {
    help.close();
    if (typeof root._aioGlossaryIsOpen === 'function' && root._aioGlossaryIsOpen()) { root._aioCloseGlossary(); return 'glossary'; }
    const aiPanel = documentRef.getElementById('ai-panel');
    if (aiPanel && aiPanel.classList.contains('open') && typeof root.toggleAIPanel === 'function') { root.toggleAIPanel(); return 'ai-panel'; }
    return 'escape';
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    // P1315: .search-bar never existed. Owner 2026-10-25: only an on-screen search box takes focus; run-3 I#21: with none,
    // 용어 사전, as the help row promises.
    const search = (documentRef.querySelector('.page.active') || documentRef).querySelector('#scr-text-search, #ticker-direct-search, #guide-search-input');
    if (search && search.offsetParent !== null) { search.focus(); return 'search'; }
    if (typeof root.openGlossary === 'function') {
      root.openGlossary();
      root.setTimeout(() => { const field = documentRef.getElementById('glossary-search'); if (field) field.focus(); }, 60);
      return 'glossary-open';
    }
    return null;
  }
  if (isInput) return null;
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
  // v59.42: plain R only — Ctrl/Cmd+R is the browser's page reload and must not be swallowed.
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
