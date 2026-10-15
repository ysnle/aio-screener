// v57.81 (phone/iPad audit): returning from 종목 (#ticker/#technical) put the previous screen back at the top —
// themes 1820 -> 0 with its detail closed, news 900 -> 0, portfolio 1904 -> 0. The screener kept its own return
// position (screener.js returnView); this generalises it. Each route's #main-content scroll position is remembered
// while it is shown, and a RETURN — browser back/forward, the 종목 tab bar's "← origin" link or the 요약 back
// button — restores it after the page has rendered. A theme detail that was open is reopened first, so the
// #themes?theme= address comes back with it. Ordinary menu navigation still starts a screen at the top.

const RETURN_CONTROLS = '.aio-hub-subject-from, #ticker-back-btn-main, [data-aio-scroll-return]';
const INTENT_WINDOW_MS = 1500;
const RESTORE_LIMIT_MS = 4000;

export function installRouteScrollMemory({ root = globalThis, documentRef = root?.document, activeRoute = () => null } = {}) {
  const content = () => documentRef?.getElementById?.('main-content') || documentRef?.querySelector?.('.content');
  if (!documentRef || !content()) return () => {};
  const memory = new Map();
  let tracked = activeRoute();
  let openTheme = null;
  let returnIntentAt = 0;
  let restoring = null;

  // The legacy route switch zeroes scrollTop before the commit; its scroll event is dispatched on the next frame,
  // by when the new route is tracked, so a leaving screen keeps its last real position.
  const onScroll = () => {
    const route = activeRoute();
    if (!route || route !== tracked) return;
    const entry = memory.get(route) || {};
    memory.set(route, { ...entry, top: content()?.scrollTop || 0 });
  };
  const onThemeShown = (event) => { openTheme = String(event?.detail?.themeId || '').trim() || null; };
  const onThemeClosed = () => { if (/^#themes(?:\?|$)/.test(String(root?.location?.hash || ''))) openTheme = null; };
  const markReturn = () => { returnIntentAt = Date.now(); };
  const onClick = (event) => { if (event.target?.closest?.(RETURN_CONTROLS)) markReturn(); };

  const stopRestore = () => {
    if (!restoring) return;
    root.clearTimeout?.(restoring.timer);
    for (const type of ['wheel', 'touchstart', 'keydown']) documentRef.removeEventListener(type, stopRestore, true);
    restoring = null;
  };

  const restore = (route, entry) => {
    stopRestore();
    const started = Date.now();
    const state = { timer: null, themeAsked: false, stable: 0 };
    restoring = state;
    // Any reader input ends the restore; it never fights a scroll the reader started.
    for (const type of ['wheel', 'touchstart', 'keydown']) documentRef.addEventListener(type, stopRestore, true);
    const step = () => {
      if (restoring !== state || activeRoute() !== route || Date.now() - started > RESTORE_LIMIT_MS) { if (restoring === state) stopRestore(); return; }
      if (route === 'themes' && entry.theme && !state.themeAsked) {
        const page = documentRef.getElementById('page-themes');
        if (page?.dataset?.aioRouteModuleState !== 'ready' || typeof root.showThemeDetail !== 'function') { state.timer = root.setTimeout(step, 100); return; }
        state.themeAsked = true;
        const panel = documentRef.getElementById('theme-detail-panel');
        const shown = !!panel && panel.getClientRects().length > 0 && root.getComputedStyle?.(panel)?.display !== 'none';
        if (!shown || !/[?&]theme=/.test(String(root.location?.hash || ''))) { try { root.showThemeDetail(entry.theme); } catch (_) {} }
        state.timer = root.setTimeout(step, 150);
        return;
      }
      const node = content();
      if (!node) { stopRestore(); return; }
      if (Math.abs(node.scrollTop - entry.top) > 2) { node.scrollTop = entry.top; state.stable = 0; }
      else state.stable += 1;
      // Held for a few checks: a late render (detail placement, lazy sections) can move the page once more.
      if (state.stable >= 3) { stopRestore(); return; }
      state.timer = root.setTimeout(step, 120);
    };
    state.timer = root.setTimeout(step, 0);
  };

  const onCommit = (event) => {
    const route = event?.detail?.routeId || activeRoute();
    if (!route || route === tracked) return;
    const leaving = tracked;
    if (leaving === 'themes') memory.set('themes', { ...(memory.get('themes') || { top: 0 }), theme: openTheme });
    tracked = route;
    // popstate listeners registered before this module commit the route first; the decision waits for them.
    root.setTimeout?.(() => {
      const isReturn = Date.now() - returnIntentAt < INTENT_WINDOW_MS;
      returnIntentAt = 0;
      const entry = memory.get(route);
      if (!isReturn || !entry || activeRoute() !== route) return;
      if (entry.top > 0 || entry.theme) restore(route, entry);
    }, 0);
  };

  const node = content();
  node.addEventListener('scroll', onScroll, { passive: true });
  documentRef.addEventListener('aio:navigationCommitted', onCommit);
  documentRef.addEventListener('aio:themeDetailShown', onThemeShown);
  documentRef.addEventListener('aio:themeDetailClosed', onThemeClosed);
  documentRef.addEventListener('click', onClick, true);
  root.addEventListener?.('popstate', markReturn);
  return () => {
    stopRestore();
    node.removeEventListener('scroll', onScroll);
    documentRef.removeEventListener('aio:navigationCommitted', onCommit);
    documentRef.removeEventListener('aio:themeDetailShown', onThemeShown);
    documentRef.removeEventListener('aio:themeDetailClosed', onThemeClosed);
    documentRef.removeEventListener('click', onClick, true);
    root.removeEventListener?.('popstate', markReturn);
  };
}
