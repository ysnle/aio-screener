export const WATCHLISTS_KEY = 'aio_watchlists';
export const ACTIVE_WATCHLIST_KEY = 'aio_watchlist_active';
export const LEGACY_STAR_KEY = 'aio_watchlist';

function readLists(storage) {
  let lists = [];
  try { lists = JSON.parse(storage?.getItem(WATCHLISTS_KEY) || '[]'); } catch (_) { lists = []; }
  return Array.isArray(lists) ? lists.filter((list) => list && typeof list === 'object' && !Array.isArray(list)).map((list) => (Array.isArray(list.tickers) ? list : { ...list, tickers: [] })) : [];
}

// A write counts only when a storage took it and reads it back: with no storage (or an adapter that drops the write)
// the toggle used to report ok while nothing was kept.
function writeLists(storage, lists) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const text = JSON.stringify(lists);
  try {
    storage.setItem(WATCHLISTS_KEY, text);
    return typeof storage.getItem !== 'function' || storage.getItem(WATCHLISTS_KEY) === text;
  } catch (_) { return false; }
}

export function readActiveWatchlistId(storage) {
  try { return storage?.getItem(ACTIVE_WATCHLIST_KEY) || ''; } catch (_) { return ''; }
}

// False when the write was refused (the backup restore reports it).
export function writeActiveWatchlistId(storage, id) {
  try { storage.setItem(ACTIVE_WATCHLIST_KEY, id); return true; } catch (_) { return false; }
}

/**
 * The list an add goes to when the reader did not pick one: the active list, else the first, else a new "관심 종목" list
 * (pushed onto `lists`). One rule for the screener star and the stock page's 관심 종목 추가, which kept
 * two copies of it.
 */
export function ensureTargetList(lists, activeId, now = Date.now()) {
  let list = lists.find((item) => item.id === activeId) || lists[0];
  if (!list) {
    list = { id: `wl_${now}`, name: '관심 종목', tickers: [], createdAt: now };
    lists.push(list);
  }
  if (!Array.isArray(list.tickers)) list.tickers = [];
  return list;
}

const targetList = (storage, lists, now) => ensureTargetList(lists, readActiveWatchlistId(storage), now);

function foldLegacyStars(storage, now) {
  let legacy = null;
  try { legacy = storage?.getItem(LEGACY_STAR_KEY); } catch (_) { return; }
  if (legacy == null) return;
  let symbols = null;
  try { symbols = JSON.parse(legacy || '[]'); } catch (_) { symbols = null; }
  if (!Array.isArray(symbols)) return;
  const lists = readLists(storage);
  const held = new Set(lists.flatMap((list) => list.tickers.map((t) => t?.sym)));
  const fresh = symbols.filter((sym) => typeof sym === 'string' && sym && !held.has(sym));
  if (fresh.length) {
    const list = targetList(storage, lists, now);
    fresh.forEach((sym) => list.tickers.push({ sym, note: '', addedAt: now }));
    if (!writeLists(storage, lists)) return;
  }
  try { storage.removeItem(LEGACY_STAR_KEY); } catch (_) {}
}

export function readWatchlists(storage, now = Date.now()) {
  foldLegacyStars(storage, now);
  return readLists(storage);
}

export function writeWatchlists(storage, lists) {
  return writeLists(storage, Array.isArray(lists) ? lists.filter((list) => list && typeof list === 'object') : []);
}

export function readWatchlistSymbols(storage, now = Date.now()) {
  foldLegacyStars(storage, now);
  const out = [];
  readLists(storage).forEach((list) => (list.tickers || []).forEach((t) => { if (t?.sym && !out.includes(t.sym)) out.push(t.sym); }));
  return out;
}

export function toggleWatchlistSymbol(storage, sym, now = Date.now()) {
  if (!sym) return { ok: false, watchlist: readWatchlistSymbols(storage, now) };
  foldLegacyStars(storage, now);
  const lists = readLists(storage);
  let removed = false;
  lists.forEach((list) => {
    const before = (list.tickers || []).length;
    list.tickers = (list.tickers || []).filter((t) => t?.sym !== sym);
    removed = removed || list.tickers.length < before;
  });
  let listName = null;
  if (!removed) {
    const list = targetList(storage, lists, now);
    list.tickers.push({ sym, note: '', addedAt: now });
    listName = list.name || '관심 종목';
  }
  const ok = writeLists(storage, lists);
  return { ok, added: !removed, listName, watchlist: readWatchlistSymbols(storage, now) };
}
