import { attachScrollCue } from './scroll-cue.js';
import { openLayer } from '../behaviors/layers.js';
const CARD_GRIDS = '#fund-rpt-fin-grid,#pf-hero-stats,#fund-valuation-cards';
const LAYOUTS = '#fund-qual-grid,#fund-qual-charts,#rrg-quadrant-cards';
const SCROLL_CUE_BOXES = '.page .aio-table-scroll,#screener-results-table .scr-registry-header';
const TAB_FOR_ROUTE = Object.freeze({ home: 'today', briefing: 'today', 'market-news': 'today', signal: 'market', breadth: 'market', sentiment: 'market', screener: 'screener', ticker: 'stock', technical: 'stock', fundamental: 'stock' });
const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"][tabindex],[tabindex]:not([tabindex="-1"])';

export function installResponsiveShell(root, doc) {
  const sidebar = doc.querySelector('.sidebar');
  const main = doc.querySelector('.main');
  const toggle = doc.getElementById('sidebar-toggle-btn');
  if (!sidebar || !main || !toggle || !root.matchMedia || !root.MutationObserver || !root.requestAnimationFrame) return () => {};
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
  // The drawer and the narrow AI panel are layers with their own backdrop: Escape, Tab and the close on Back come from
  // behaviors/layers.js.
  let releaseDrawer = () => {}, releaseAi = () => {};
  const setOpen = (value, restoreFocus = true) => {
    const wasOpened = opened;
    opened = compact.matches && value;
    if (opened !== wasOpened) { releaseDrawer(); releaseDrawer = opened ? openLayer({ root: sidebar, inert: false, focus: false, onDismiss: () => setOpen(false), onNavigate: () => setOpen(false, false) }) : () => {}; }
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
    if (event.target.closest?.('#aio-tabbar [data-tab][aria-current="page"]')) { event.preventDefault(); event.stopImmediatePropagation(); root._aioScrollContentTop?.(); return; }
    if (opened && event.target.closest?.('.sidebar [data-action="showPage"],.sidebar [data-action="openGlossary"],.sidebar [data-action="openKbdHelp"],.sidebar a[href^="#"]')) { setOpen(false, false); if (!event.target.closest?.('[data-action="openKbdHelp"]')) toggle.focus(); }
  };
  const onKey = (event) => {
    if (event.key === 'Escape' && event.defaultPrevented) return; // a layer above took it (behaviors/layers.js)
    if (event.key === 'Escape' && !opened && ai?.classList.contains('open') && ai.contains(doc.activeElement)) { event.preventDefault(); ai.querySelector('.ai-ph-close')?.click(); return; }
  };
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
      active?.focus({preventScroll:true});
    });
    doc.querySelectorAll(SCROLL_CUE_BOXES).forEach((box) => attachScrollCue(box, { root }));
  };
  let scheduled = false, disposed = false, frame = null;
  const observer = new root.MutationObserver(() => {
    if (scheduled) return; scheduled = true;
    frame = root.requestAnimationFrame(() => { scheduled = false; if (!disposed) decorate(); });
  });
  observer.observe(doc.getElementById('main-content') || main, { childList: true, subtree: true });
  let aiWasModal = false;
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
    if (!!modal !== aiWasModal) { releaseAi(); releaseAi = modal ? openLayer({ root: ai, inert: false, focus: false, onDismiss: () => ai.querySelector('.ai-ph-close')?.click() }) : () => {}; }
    aiWasModal = !!modal;
  };
  const aiObserver = new root.MutationObserver(onAi);
  if (ai) aiObserver.observe(ai, { attributes: true, attributeFilter: ['class'] });
  const onMode = () => { setOpen(false); refreshViewport(); onAi(); };
  const markTab = (event) => {
    if (!tabbar) return;
    const route = event?.detail?.routeId || doc.querySelector('.page.active')?.id?.replace(/^page-/, '') || 'home';
    const tab = TAB_FOR_ROUTE[route] || 'more';
    tabbar.querySelectorAll('[data-tab]').forEach((item) => { if (item.dataset.tab === tab) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current'); });
  };
  const onLateEscape = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || opened || !ai?.classList.contains('open')) return;
    const target = doc.activeElement;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"], [aria-modal="true"], dialog[open]') || [...doc.querySelectorAll('[aria-modal="true"], dialog[open]')].some((el) => el.getClientRects().length)) return;
    event.preventDefault(); ai.querySelector('.ai-ph-close')?.click();
  };
  doc.addEventListener('click', onClick, true); doc.addEventListener('keydown', onKey); root.addEventListener('keydown', onLateEscape); root.addEventListener('aio:workerHealth', routeLine);
  compact.addEventListener('change', onMode); aiOverlay.addEventListener('change', onAi);
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
    compact.removeEventListener('change', onMode); aiOverlay.removeEventListener('change', onAi);
    doc.removeEventListener('aio:navigationCommitted', markTab);
    releaseDrawer(); releaseAi();
    root.removeEventListener('resize', refreshViewport); root.visualViewport?.removeEventListener('resize', refreshViewport);
    root.visualViewport?.removeEventListener('scroll', refreshViewport);
    doc.documentElement.style.removeProperty('--aio-visual-height'); doc.documentElement.style.removeProperty('--aio-visual-top');
  };
}
