// P1618: UI-only responsive lifecycle; preferences stay in the app boundary.
import { attachScrollCue } from './scroll-cue.js';
const CARD_GRIDS = '#fund-rpt-fin-grid,#pf-hero-stats,#fund-valuation-cards'; // v59.51: #home-kpi-strip left with the home quote row merge
const LAYOUTS = '#fund-qual-grid,#fund-qual-charts,#rrg-quadrant-cards';
const SCROLL_CUE_BOXES = '.page .aio-table-scroll,#screener-results-table .scr-registry-header';
// v58.53 개편 v2 (4a/4b): the iPad-portrait/iPhone tab bar marks the screen a route belongs to; the rest is under 더보기.
const TAB_FOR_ROUTE = Object.freeze({ home: 'today', briefing: 'today', 'market-news': 'today', signal: 'market', breadth: 'market', sentiment: 'market', screener: 'screener', ticker: 'stock', technical: 'stock', fundamental: 'stock' });
const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"][tabindex],[tabindex]:not([tabindex="-1"])';

export function installResponsiveShell(root, doc) {
  const sidebar = doc.querySelector('.sidebar');
  const main = doc.querySelector('.main');
  const toggle = doc.getElementById('sidebar-toggle-btn');
  if (!sidebar || !main || !toggle || !root.matchMedia || !root.MutationObserver || !root.requestAnimationFrame) return () => {};
  // v58.54 (design 4a): the drawer is for iPad portrait and phones; iPad landscape keeps a fixed sidebar. The AI panel
  // overlays the page (modal) up to 1279, where a split beside the sidebar left the page too narrow.
  const compact = root.matchMedia('(max-width: 1023px)');
  const aiOverlay = root.matchMedia('(max-width: 1279px)');
  const app = doc.querySelector('.app');
  const ai = doc.getElementById('ai-panel');
  const tabbar = doc.getElementById('aio-tabbar');
  const moreTab = tabbar?.querySelector('[data-tab="more"]') || null;
  const previousAi = { role: ai?.getAttribute('role'), appInert: app?.inert || false };
  const backdrop = doc.createElement('button');
  backdrop.className = 'aio-navigation-backdrop'; backdrop.type = 'button';
  backdrop.setAttribute('aria-label', '메뉴 닫기'); backdrop.tabIndex = -1;
  const close = doc.createElement('button');
  close.className = 'aio-navigation-close'; close.type = 'button'; close.textContent = '메뉴 닫기 ×';
  sidebar.prepend(close); doc.body.append(backdrop);
  const previous = { role: sidebar.getAttribute('role'), id: sidebar.id, controls: toggle.getAttribute('aria-controls'), mainInert: main.inert };
  if (!sidebar.id) sidebar.id = 'aio-navigation';
  toggle.setAttribute('aria-controls', sidebar.id);
  let opened = false;
  let focusReturn = null;
  const setOpen = (value, restoreFocus = true) => {
    opened = compact.matches && value;
    doc.body.classList.toggle('aio-navigation-open', opened);
    toggle.setAttribute('aria-expanded', String(opened));
    moreTab?.setAttribute('aria-expanded', String(opened));
    if (compact.matches) {
      sidebar.inert = !opened; main.inert = opened || previous.mainInert;
      sidebar.setAttribute('aria-hidden', String(!opened));
      if (opened) {
        focusReturn = doc.activeElement; sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true'); close.focus();
      } else {
        sidebar.removeAttribute('aria-modal');
        if (previous.role) sidebar.setAttribute('role', previous.role); else sidebar.removeAttribute('role');
        if (restoreFocus && focusReturn?.isConnected) focusReturn.focus();
        focusReturn = null;
      }
      toggle.textContent = '☰';
    } else {
      sidebar.inert = false; main.inert = previous.mainInert;
      sidebar.removeAttribute('aria-hidden'); sidebar.removeAttribute('aria-modal');
      if (previous.role) sidebar.setAttribute('role', previous.role); else sidebar.removeAttribute('role');
      toggle.textContent = sidebar.classList.contains('collapsed') ? '☰' : '☰';
      toggle.setAttribute('aria-expanded', String(!sidebar.classList.contains('collapsed')));
      if (restoreFocus && focusReturn) {
        const visible = (el) => el?.isConnected && el.getClientRects().length && root.getComputedStyle(el).visibility !== 'hidden';
        const destination = visible(focusReturn) ? focusReturn : [...sidebar.querySelectorAll(FOCUSABLE)].find(visible);
        destination?.focus(); focusReturn = null;
      }
    }
  };
  const onClick = (event) => {
    if (!compact.matches) return;
    if (event.target.closest?.('#sidebar-toggle-btn, #aio-tabbar [data-tab="more"]')) {
      event.preventDefault(); event.stopImmediatePropagation(); setOpen(!opened); return;
    }
    if (event.target === backdrop || event.target === close) { setOpen(false); return; }
    // First-users run 4: tapping the current tab scrolls to the top (the floating ↑ is hidden on phones).
    if (event.target.closest?.('#aio-tabbar [data-tab][aria-current="page"]')) { event.preventDefault(); event.stopImmediatePropagation(); root._aioScrollContentTop?.(); return; }
    if (opened && event.target.closest?.('.sidebar [data-action="showPage"],.sidebar [data-action="openGlossary"],.sidebar [data-action="openKbdHelp"],.sidebar a[href^="#"]')) { setOpen(false, false); if (!event.target.closest?.('[data-action="openKbdHelp"]')) toggle.focus(); } // v58.80 (first-users bundle 5): the menu stayed over the shortcut sheet and its 닫기 tap hit 용어 사전
  };
  const onKey = (event) => {
    // v58.80 (first-users F24): the shortcut sheet promises "Esc 모달/메뉴 닫기", but on a desktop width (panel beside the page)
    // Escape from inside the open AI panel did nothing; only the narrow overlay closed.
    if (event.key === 'Escape' && !opened && ai?.classList.contains('open') && ai.contains(doc.activeElement)) { event.preventDefault(); ai.querySelector('.ai-ph-close')?.click(); return; }
    const activePanel = opened ? sidebar : aiOverlay.matches && ai?.classList.contains('open') ? ai : null;
    if (!activePanel) return;
    if (event.key === 'Escape') { event.preventDefault(); if (opened) setOpen(false); else ai.querySelector('.ai-ph-close')?.click(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...activePanel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length && root.getComputedStyle(el).visibility !== 'hidden');
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  // P1653: iOS fires visualViewport resize/scroll on every keystroke while the keyboard is open. Writing the variables
  // on <html> restyled the whole document per event, so typing in the AI panel lagged on iPhone/iPad. The values are
  // written once per frame, only when they change, and only on the two overlays that read them.
  let viewportFrame = null, lastViewport = '';
  const writeViewport = () => {
    viewportFrame = null;
    const viewport = root.visualViewport;
    const height = `${Math.round(viewport?.height || root.innerHeight)}px`, top = `${Math.round(viewport?.offsetTop || 0)}px`;
    if (`${height}|${top}` === lastViewport) return;
    lastViewport = `${height}|${top}`;
    for (const id of ['ai-panel', 'glossary-modal']) {
      const target = doc.getElementById(id);
      target?.style.setProperty('--aio-visual-height', height);
      target?.style.setProperty('--aio-visual-top', top);
    }
  };
  const refreshViewport = () => {
    if (viewportFrame === null) viewportFrame = root.requestAnimationFrame ? root.requestAnimationFrame(writeViewport) : (writeViewport(), null);
  };
  const decorate = () => {
    doc.querySelectorAll(CARD_GRIDS).forEach((el) => el.classList.add('aio-responsive-card-grid'));
    doc.querySelectorAll(LAYOUTS).forEach((el) => el.classList.add('aio-responsive-layout'));
    // Only page-level layout groups are stacked; inner metric rows keep their relationships.
    doc.querySelectorAll('.page > [style*="display:grid"],.page > .aio-section > [style*="display:grid"]').forEach((el) => {
      if (!el.matches(CARD_GRIDS) && !el.closest('[hidden]')) el.classList.add('aio-responsive-layout');
    });
    doc.querySelectorAll('.page > [style*="display:flex"],.page > .aio-section > [style*="display:flex"]').forEach((el) => el.classList.add('aio-responsive-row'));
    doc.querySelectorAll('.page table').forEach((table) => {
      let region = table.parentElement;
      if (!region || region.closest('.aio-table-scroll,.chat-table-wrap,.masters-style-scroll') || region.style.overflowX === 'auto') return;
      const active = table.contains(doc.activeElement) ? doc.activeElement : null;
      region = doc.createElement('div'); region.className = 'aio-table-scroll';
      region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${table.caption?.textContent?.trim() || '자료 표'} 가로 스크롤`); region.tabIndex = 0;
      table.before(region); region.append(table);
      active?.focus({preventScroll:true}); // P1622 moving a focused table into its scroll region must preserve focus.
    });
    // v57.81: every sideways-scrolling table, and the phone screener sort bar, shows which side has more (scroll-cue.js;
    // drawn in responsive.css).
    doc.querySelectorAll(SCROLL_CUE_BOXES).forEach((box) => attachScrollCue(box, { root }));
  };
  let scheduled = false, disposed = false, frame = null;
  const observer = new root.MutationObserver(() => {
    if (scheduled) return; scheduled = true;
    frame = root.requestAnimationFrame(() => { scheduled = false; if (!disposed) decorate(); });
  });
  observer.observe(doc.getElementById('main-content') || main, { childList: true, subtree: true });
  let aiWasModal = false;
  // First-users run 4: opening the panel checks the shared route (cached health) and names the state in the header.
  let aiWasOpen = false;
  const routeLine = () => {
    const node = doc.getElementById('ai-panel-route');
    const state = root._aioLastClaudeRouteState;
    if (!node || !state) return;
    node.textContent = state.ok ? '답변 가능' : '지금은 답변할 수 없음, 질문은 보관됩니다';
    node.dataset.state = state.ok ? 'ok' : 'down';
  };
  const onAi = () => {
    const isOpen = !!ai?.classList.contains('open');
    if (isOpen && !aiWasOpen && typeof root._aioEnsureClaudeRoute === 'function') {
      const node = doc.getElementById('ai-panel-route');
      if (node && !node.dataset.state) node.textContent = '연결 확인 중';
      Promise.resolve().then(() => root._aioEnsureClaudeRoute('')).then(routeLine, routeLine);
    }
    aiWasOpen = isOpen;
    const modal = aiOverlay.matches && ai?.classList.contains('open');
    if (app) app.inert = !!modal || previousAi.appInert;
    if (!ai) return;
    if (modal) { if (opened) setOpen(false, false); ai.setAttribute('role', 'dialog'); ai.setAttribute('aria-modal', 'true'); }
    else { ai.removeAttribute('aria-modal'); if (previousAi.role) ai.setAttribute('role', previousAi.role); else ai.removeAttribute('role'); }
    if (aiWasModal && !modal) doc.getElementById('topbar-ai-btn')?.focus();
    aiWasModal = !!modal;
  };
  const aiObserver = new root.MutationObserver(onAi);
  if (ai) aiObserver.observe(ai, { attributes: true, attributeFilter: ['class'] });
  const onMode = () => { setOpen(false); refreshViewport(); onAi(); };
  const onHash = () => { if (opened) setOpen(false, false); };
  const markTab = (event) => {
    if (!tabbar) return;
    const route = event?.detail?.routeId || doc.querySelector('.page.active')?.id?.replace(/^page-/, '') || 'home';
    const tab = TAB_FOR_ROUTE[route] || 'more';
    tabbar.querySelectorAll('[data-tab]').forEach((item) => { if (item.dataset.tab === tab) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current'); });
  };
  // v58.80 (first-users F24, run-3): Escape with focus on the page (not in the panel) still left the side panel open. On the
  // window, after every other Escape owner had its turn, an unclaimed Escape outside a text field closes it.
  const onLateEscape = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || opened || !ai?.classList.contains('open')) return;
    const target = doc.activeElement;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"], [aria-modal="true"], dialog[open]') || [...doc.querySelectorAll('[aria-modal="true"], dialog[open]')].some((el) => el.getClientRects().length)) return;
    event.preventDefault(); ai.querySelector('.ai-ph-close')?.click();
  };
  doc.addEventListener('click', onClick, true); doc.addEventListener('keydown', onKey); root.addEventListener('keydown', onLateEscape); root.addEventListener('aio:workerHealth', routeLine);
  compact.addEventListener('change', onMode); aiOverlay.addEventListener('change', onAi); root.addEventListener('hashchange', onHash);
  doc.addEventListener('aio:navigationCommitted', markTab);
  root.addEventListener('resize', refreshViewport); root.visualViewport?.addEventListener('resize', refreshViewport);
  root.visualViewport?.addEventListener('scroll', refreshViewport);
  decorate(); onMode(); markTab();
  return () => {
    disposed = true; if (frame !== null) root.cancelAnimationFrame?.(frame); if (viewportFrame !== null) root.cancelAnimationFrame?.(viewportFrame);
    observer.disconnect(); aiObserver.disconnect(); doc.querySelectorAll(SCROLL_CUE_BOXES).forEach((box) => box._aioScrollCue?.disconnect()); setOpen(false); sidebar.inert = false; main.inert = previous.mainInert;
    if (app) app.inert = previousAi.appInert;
    if (ai) { ai.removeAttribute('aria-modal'); if (previousAi.role) ai.setAttribute('role', previousAi.role); else ai.removeAttribute('role'); }
    sidebar.removeAttribute('aria-hidden'); sidebar.removeAttribute('aria-modal');
    if (previous.role) sidebar.setAttribute('role', previous.role); else sidebar.removeAttribute('role');
    if (!previous.id) sidebar.removeAttribute('id');
    if (previous.controls) toggle.setAttribute('aria-controls', previous.controls); else toggle.removeAttribute('aria-controls');
    backdrop.remove(); close.remove(); doc.removeEventListener('click', onClick, true); doc.removeEventListener('keydown', onKey); root.removeEventListener('keydown', onLateEscape); root.removeEventListener('aio:workerHealth', routeLine);
    compact.removeEventListener('change', onMode); aiOverlay.removeEventListener('change', onAi); root.removeEventListener('hashchange', onHash);
    doc.removeEventListener('aio:navigationCommitted', markTab);
    root.removeEventListener('resize', refreshViewport); root.visualViewport?.removeEventListener('resize', refreshViewport);
    root.visualViewport?.removeEventListener('scroll', refreshViewport);
    doc.documentElement.style.removeProperty('--aio-visual-height'); doc.documentElement.style.removeProperty('--aio-visual-top');
  };
}
