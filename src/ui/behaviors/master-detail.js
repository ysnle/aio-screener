// A list of fold rows beside one detail pane. Where there is room (page-views.css draws the open row's pane to the right
// of the list), one row is always open, choosing another closes the one before it across every list in the host, and
// the host is as tall as the pane. Below that width the rows stay an ordinary one-at-a-time accordion.
export const MASTER_DETAIL_QUERY = '(min-width: 1100px)';

export function installMasterDetail({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.addEventListener || !root.matchMedia) return () => {};
  const wide = root.matchMedia(MASTER_DETAIL_QUERY);
  const rowsOf = (host) => [...host.querySelectorAll(host.dataset.masterDetail || 'details')];
  const paneOf = (row) => row.querySelector(':scope > .md-pane');
  const watched = new WeakSet();
  let frame = 0;
  const syncHost = (host) => {
    if (!wide.matches || !host.getClientRects().length) { host.style.minHeight = ''; return; }
    const rows = rowsOf(host);
    if (!rows.length) return;
    const open = rows.filter((row) => row.open);
    if (!open.length) { rows[0].open = true; return; } // the toggle it fires comes back here
    const pane = paneOf(open[open.length - 1]);
    host.style.minHeight = pane ? `${Math.ceil(pane.offsetTop + pane.offsetHeight)}px` : '';
  };
  const sync = () => {
    frame = 0;
    for (const host of documentRef.querySelectorAll('[data-master-detail]')) {
      if (!watched.has(host)) { watched.add(host); observer?.observe(host, { childList: true, subtree: true }); resizes?.observe(host); }
      syncHost(host);
    }
  };
  const schedule = () => { if (!frame) frame = root.requestAnimationFrame(sync); };
  const observer = root.MutationObserver ? new root.MutationObserver(schedule) : null;
  const resizes = root.ResizeObserver ? new root.ResizeObserver(schedule) : null;
  const onToggle = (event) => {
    const row = event.target;
    const host = row?.closest?.('[data-master-detail]');
    if (!host || !row.matches?.(host.dataset.masterDetail || 'details')) return;
    if (row.open) for (const other of rowsOf(host)) if (other !== row && other.open) other.open = false;
    schedule();
  };
  // The selected row cannot be closed while the pane is beside the list: there would be nothing in the pane.
  const onClick = (event) => {
    if (!wide.matches) return;
    const summary = event.target?.closest?.('summary');
    const row = summary?.parentElement;
    const host = row?.closest?.('[data-master-detail]');
    if (host && row.open && row.matches(host.dataset.masterDetail || 'details')) event.preventDefault();
  };
  documentRef.addEventListener('toggle', onToggle, true);
  documentRef.addEventListener('click', onClick);
  documentRef.addEventListener('aio:navigationCommitted', schedule);
  documentRef.addEventListener('aio:pageViewChanged', schedule);
  wide.addEventListener?.('change', schedule);
  schedule();
  return () => {
    documentRef.removeEventListener('toggle', onToggle, true);
    documentRef.removeEventListener('click', onClick);
    documentRef.removeEventListener('aio:navigationCommitted', schedule);
    documentRef.removeEventListener('aio:pageViewChanged', schedule);
    wide.removeEventListener?.('change', schedule);
    observer?.disconnect();
    resizes?.disconnect();
  };
}
