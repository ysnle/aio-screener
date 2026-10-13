// v57.54: number keys 1..8 open the eight screens in menu order. The help modal and the key handler
// (js/aio-ui.js) both read this table, which is derived from ROUTE_HUBS — the same table that draws the
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

export function installScreenShortcuts({ root = globalThis, documentRef = root?.document } = {}) {
  if (root) root.AIO_SCREEN_SHORTCUT_ROUTE = screenShortcutRoute;
  return renderScreenShortcutRows(documentRef);
}
