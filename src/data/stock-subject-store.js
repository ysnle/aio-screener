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

// v58.80 run-5: 재무 공시's 최근 검색 (localStorage aio_fund_recent, drawn by src/ui/components/fundamental-search.js) only heard
// its own search box, so a company opened from 요약 or another screen never appeared there. Every subject change records it.
const RECENT_KEY = 'aio_fund_recent';
export function rememberRecentSymbol(root = globalThis, symbol = '') {
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return;
  try {
    const list = JSON.parse(root?.localStorage?.getItem(RECENT_KEY) || '[]');
    const next = [symbol, ...(Array.isArray(list) ? list : []).filter((item) => item !== symbol)].slice(0, 8);
    root.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (_) { /* storage blocked */ }
}

// The 재무 공시 최근 검색 list as stored, newest first (src/ui/components/fundamental-search.js draws it).
export function readRecentSymbols(root = globalThis) {
  try {
    const list = JSON.parse(root?.localStorage?.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}
