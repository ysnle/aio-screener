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
