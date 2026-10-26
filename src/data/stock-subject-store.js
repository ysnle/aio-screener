// First-users F15 (runs 1-3): the 종목 screen's company for this tab's session, so a reload or Back on 차트 keeps it.
// UI modules may not touch storage (architecture contract); src/ui/navigation/route-hubs.js reads and writes through here.
const SUBJECT_KEY = 'aio_stock_subject';

export function readSavedStockSubject(root = globalThis) {
  try {
    const saved = JSON.parse(root?.sessionStorage?.getItem(SUBJECT_KEY) || 'null');
    return saved && /^[A-Z0-9.-]{1,12}$/.test(saved.symbol) ? { symbol: saved.symbol, name: String(saved.name || '') } : null;
  } catch (_) { return null; }
}

export function saveStockSubject(root = globalThis, subject = null) {
  try { root?.sessionStorage?.setItem(SUBJECT_KEY, JSON.stringify({ symbol: subject?.symbol || '', name: subject?.name || '' })); } catch (_) { /* storage blocked */ }
}
