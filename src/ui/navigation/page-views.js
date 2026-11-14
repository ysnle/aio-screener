// One route, several views. A long screen (시장 상태, 매크로) is cut into views a reader switches between with the tab row
// under the page title. Which section belongs to which view is written once, in page-views.css; this module only moves
// `data-view` on the page, keeps the tab row in step, and opens the folds whose view replaced their folding. The page
// element keeps its view while other routes are open, so coming back lands where the reader left; the address carries
// it as ?view= (src/app/router.js). A link that means one view names it in data-view (onLink below).

export function viewNames(page) {
  return [...(page?.querySelectorAll?.(':scope > .page-views > [data-view]') || [])].map((tab) => tab.dataset.view);
}

export function installPageViews({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.addEventListener) return () => {};
  // A fold that is the whole content of its view opens with the view and is no longer a control.
  const openFolds = (page) => {
    for (const fold of page.querySelectorAll('details[data-view-open]')) {
      const summary = fold.querySelector(':scope > summary');
      if (summary) summary.tabIndex = -1;
      fold.open = true; // also while hidden: a renderer may reveal it after this runs
    }
  };
  const show = (page, view, { byReader = false } = {}) => {
    if (!page || !viewNames(page).includes(view)) return false;
    const changed = page.dataset.view !== view;
    page.dataset.view = view;
    for (const tab of page.querySelectorAll(':scope > .page-views > [data-view]')) {
      const on = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(on));
      tab.classList.toggle('is-active', on);
      tab.tabIndex = on ? 0 : -1;
      tab.setAttribute('aria-controls', page.id);
    }
    openFolds(page);
    if (changed) documentRef.dispatchEvent(new root.CustomEvent('aio:pageViewChanged', { detail: { page: page.id, view, byReader } }));
    return true;
  };
  // The view that shows a node: the style sheet is the only list of members, so each view is tried against it.
  const showViewOf = (node) => {
    const page = node?.closest?.('.page[data-view]');
    if (!page) return false;
    let section = node;
    while (section.parentElement && section.parentElement !== page) section = section.parentElement;
    const wasHidden = section.hidden;
    section.hidden = false;
    const before = page.dataset.view;
    const found = viewNames(page).find((view) => { page.dataset.view = view; return root.getComputedStyle(section).display !== 'none'; });
    page.dataset.view = before;
    section.hidden = wasHidden;
    return found ? show(page, found) : false;
  };
  const onClick = (event) => {
    const tab = event.target?.closest?.('.page-views > [data-view]');
    if (tab) {
      const page = tab.closest('.page');
      const row = tab.parentElement;
      // A row held at the top (sticky) means the reader is deep in the old view: the new one starts at its top.
      const held = row.getBoundingClientRect().top;
      row.style.position = 'static';
      const natural = row.getBoundingClientRect().top;
      row.style.position = '';
      let scroller = row.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight && ['auto', 'scroll'].includes(root.getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      scroller ||= documentRef.scrollingElement;
      const top = (scroller?.scrollTop || 0) + Math.min(0, natural - held);
      // Set, not adjusted: the browser re-anchors the scroll when the old view's sections disappear.
      if (show(page, tab.dataset.view, { byReader: true }) && scroller) scroller.scrollTop = top;
      return;
    }
    if (event.target?.closest?.('details[data-view-open] > summary')) event.preventDefault();
  };
  // A link that means one view of another screen names it: data-action="showPage" data-arg="fxbond" data-view="fx".
  // The view is set before the navigation runs (capture), so the screen opens on it.
  const onLink = (event) => {
    const link = event.target?.closest?.('[data-action="showPage"][data-arg][data-view]');
    if (link) show(documentRef.getElementById(`page-${link.dataset.arg}`), link.dataset.view);
  };
  const restore = () => {
    const page = documentRef.querySelector('.page.active[data-view]');
    if (page) show(page, page.dataset.view);
  };
  documentRef.addEventListener('click', onClick);
  documentRef.addEventListener('click', onLink, true);
  documentRef.addEventListener('aio:navigationCommitted', restore);
  root.addEventListener?.('aio:navigationCommitted', restore);
  root._aioShowPageView = (pageId, view) => show(documentRef.getElementById(pageId), view);
  root._aioShowViewOf = showViewOf;
  restore();
  return () => {
    documentRef.removeEventListener('click', onClick);
    documentRef.removeEventListener('click', onLink, true);
    documentRef.removeEventListener('aio:navigationCommitted', restore);
    root.removeEventListener?.('aio:navigationCommitted', restore);
    delete root._aioShowPageView;
    delete root._aioShowViewOf;
  };
}
