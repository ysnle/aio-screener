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
