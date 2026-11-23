const SIDEBAR_KEY = 'aio_sidebar_collapsed';

export function readSidebarCollapsed(root = globalThis) {
  try { return root.localStorage.getItem(SIDEBAR_KEY) === '1'; } catch (_) { return false; }
}

export function saveSidebarCollapsed(collapsed, root = globalThis) {
  try { root.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : ''); } catch (_) { /* storage blocked */ }
}
