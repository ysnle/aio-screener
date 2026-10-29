// v58.80 (first-users F29): one watchlist store. The screener star wrote its own 'aio_watchlist' array while 포트폴리오
// 관심 종목 kept named lists in 'aio_watchlists', so a starred stock never showed in the lists ("리스트 0개"). The star now
// reads every named list and adds to the chosen list (the first one, or a new "관심 종목" list); un-starring removes the
// symbol from every list. The old array is folded into the lists once and removed.
export const WATCHLISTS_KEY = 'aio_watchlists';
export const ACTIVE_WATCHLIST_KEY = 'aio_watchlist_active';
export const LEGACY_STAR_KEY = 'aio_watchlist';

function readLists(storage) {
  let lists = [];
  try { lists = JSON.parse(storage?.getItem(WATCHLISTS_KEY) || '[]'); } catch (_) { lists = []; }
  return Array.isArray(lists) ? lists.filter((list) => list && typeof list === 'object') : [];
}

function writeLists(storage, lists) {
  try { storage?.setItem(WATCHLISTS_KEY, JSON.stringify(lists)); return true; } catch (_) { return false; }
}

function targetList(storage, lists, now) {
  let active = '';
  try { active = storage?.getItem(ACTIVE_WATCHLIST_KEY) || ''; } catch (_) { active = ''; }
  let list = lists.find((item) => item.id === active) || lists[0];
  if (!list) {
    list = { id: `wl_${now}`, name: '관심 종목', tickers: [], createdAt: now };
    lists.push(list);
  }
  if (!Array.isArray(list.tickers)) list.tickers = [];
  return list;
}

function foldLegacyStars(storage, now) {
  let legacy = null;
  try { legacy = storage?.getItem(LEGACY_STAR_KEY); } catch (_) { return; }
  if (legacy == null) return;
  let symbols = [];
  try { symbols = JSON.parse(legacy || '[]'); } catch (_) { symbols = []; }
  const lists = readLists(storage);
  const held = new Set(lists.flatMap((list) => (list.tickers || []).map((t) => t?.sym)));
  const fresh = (Array.isArray(symbols) ? symbols : []).filter((sym) => typeof sym === 'string' && sym && !held.has(sym));
  if (fresh.length) {
    const list = targetList(storage, lists, now);
    fresh.forEach((sym) => list.tickers.push({ sym, note: '', addedAt: now }));
    if (!writeLists(storage, lists)) return;
  }
  try { storage.removeItem(LEGACY_STAR_KEY); } catch (_) {}
}

// v59.42: the 포트폴리오 관심 종목 lists (js/aio-workspace.js getWatchlists/saveWatchlists) read and write here too, so this
// is the one writer. That copy hid a list with no tickers array and deleted it on its next save, and it never folded
// the old star array; such a list is kept here with an empty tickers array.
export function readWatchlists(storage, now = Date.now()) {
  foldLegacyStars(storage, now);
  return readLists(storage).map((list) => (Array.isArray(list.tickers) ? list : { ...list, tickers: [] }));
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
