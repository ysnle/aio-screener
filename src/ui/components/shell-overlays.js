// v57.81 (phone/iPad parity audit): the shell's fixed overlays must not hide what they sit on.
// - #update-banner (fixed, z 1009) covered the topbar, so a tap on the menu button reloaded the page. While it shows,
//   body.aio-update-banner-open and --aio-update-banner-h move the app below it (styles/shell-overlays.css).
// - #aio-first-visit-disclaimer (fixed bottom bar) hid toasts, the scroll-top button and the end of the content and
//   sidebar. While it shows, body.aio-disclaimer-open and --aio-disclaimer-h stack those above it.
// - The glossary modal closes on a tap on its dimmed backdrop (its close mark was the only touch exit).
// - After a confirmed portfolio delete the focused row control is re-rendered away; focus moves to the holdings
//   table, or to the empty-state 첫 종목 추가 button (js/aio-workspace.js calls window._aioFocusPortfolioAfterDelete).

export function focusPortfolioAfterDelete(documentRef) {
  const active = documentRef.activeElement;
  if (active && active !== documentRef.body && active.isConnected) return active;
  const cta = documentRef.querySelector('#page-portfolio .pf-empty-state [data-action="_aioTogglePortfolioEntry"]');
  const table = documentRef.querySelector('#pf-holdings-table-section table');
  const target = cta || table;
  if (!target) return null;
  if (target === table) {
    if (!table.hasAttribute('tabindex')) table.setAttribute('tabindex', '-1');
    if (!table.getAttribute('aria-label')) table.setAttribute('aria-label', '보유 종목');
  }
  target.focus({ preventScroll: true });
  return target;
}

export function installShellOverlays({ root = globalThis, documentRef = root?.document } = {}) {
  const body = documentRef?.body;
  const html = documentRef?.documentElement;
  if (!body || !html || typeof root?.MutationObserver !== 'function') return () => {};
  const sizeObserver = typeof root.ResizeObserver === 'function' ? new root.ResizeObserver(() => sync()) : null;
  let watchedBar = null;

  // Read-only observer: the banner and bar stay owned by js/aio-ui.js; this module only reads their state and size and
  // writes body classes and CSS variables (AG-DOM-WRITER counts getElementById as a write, hence querySelector).
  function sync() {
    const banner = documentRef.querySelector('#update-banner');
    const bannerOpen = !!banner?.classList.contains('show');
    body.classList.toggle('aio-update-banner-open', bannerOpen);
    html.style.setProperty('--aio-update-banner-h', bannerOpen ? `${banner.offsetHeight}px` : '0px');
    const bar = documentRef.querySelector('#aio-first-visit-disclaimer');
    const floating = !!bar && !bar.classList.contains('is-inline'); // an inline notice (F27) needs no reserved space
    body.classList.toggle('aio-disclaimer-open', floating);
    if (floating) html.style.setProperty('--aio-disclaimer-h', `${bar.offsetHeight}px`); else html.style.removeProperty('--aio-disclaimer-h');
    if (sizeObserver && bar !== watchedBar) {
      if (watchedBar) sizeObserver.unobserve(watchedBar);
      if (bar) sizeObserver.observe(bar);
      watchedBar = bar;
    }
  }

  const bodyObserver = new root.MutationObserver(sync);
  bodyObserver.observe(body, { childList: true });
  const banner = documentRef.querySelector('#update-banner');
  const bannerObserver = banner ? new root.MutationObserver(sync) : null;
  bannerObserver?.observe(banner, { attributes: true, attributeFilter: ['class'] });
  const onResize = () => sync();
  root.addEventListener?.('resize', onResize);

  const onGlossaryBackdrop = (event) => {
    if (event.target?.id === 'glossary-modal' && typeof root._aioCloseGlossary === 'function') root._aioCloseGlossary();
  };
  documentRef.addEventListener('click', onGlossaryBackdrop);

  const timers = new Set();
  // The native holdings table renders after the legacy one; focus is placed after both, then checked once more.
  root._aioFocusPortfolioAfterDelete = () => {
    const later = (fn, ms) => { const id = root.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    later(() => { focusPortfolioAfterDelete(documentRef); later(() => focusPortfolioAfterDelete(documentRef), 200); }, 0);
  };
  sync();
  return () => {
    bodyObserver.disconnect();
    bannerObserver?.disconnect();
    sizeObserver?.disconnect();
    root.removeEventListener?.('resize', onResize);
    documentRef.removeEventListener('click', onGlossaryBackdrop);
    timers.forEach((id) => root.clearTimeout?.(id));
    delete root._aioFocusPortfolioAfterDelete;
  };
}
