// v40.4: the desktop sidebar toggle (#sidebar-toggle-btn, data-action="toggleSidebar") and the collapsed state restored
// at load. Moved unchanged from js/aio-chat.js (roadmap item 11, layer 1 채팅); compatibility-globals.js installs
// window.toggleSidebar and runs restoreSidebar once at boot.
import { readSidebarCollapsed, saveSidebarCollapsed } from '../../data/shell-prefs.js';

export function toggleSidebar({ documentRef = globalThis.document, root = globalThis } = {}) {
  const sb = documentRef.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.toggle('collapsed');
  const btn = documentRef.getElementById('sidebar-toggle-btn');
  const isCollapsed = sb.classList.contains('collapsed');
  if (btn) { btn.textContent = isCollapsed ? '☰' : ''; btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true'); }
  saveSidebarCollapsed(isCollapsed, root);
}

// The toggle button shows on desktop, and a sidebar left collapsed starts collapsed.
export function restoreSidebar({ documentRef = globalThis.document, root = globalThis } = {}) {
  const btn = documentRef.getElementById('sidebar-toggle-btn');
  if (btn) btn.style.display = 'inline-block';
  if (readSidebarCollapsed(root)) {
    const sb = documentRef.querySelector('.sidebar');
    if (sb) { sb.classList.add('collapsed'); if (btn) btn.textContent = '☰'; }
  }
}
