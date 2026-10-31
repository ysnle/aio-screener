// v59.51 (content audit 2026-10-31): 재무 공시 had a second search box, a 최근 검색 list and a folded legacy report (Yahoo
// quote, SEC submissions, FMP-era quarterly charts, "Yahoo Finance 응답 없음" provider lines) under the native 재무 흐름.
// The 종목 search on 요약 is the one search; the native entity slice (SEC projection) is the one report. What stays here is
// the selection hand-off: the company 요약 · 차트 show becomes the selected issuer, and the native slice projects its
// filing. The four exports keep their names because src/app/legacy-screen-bridges.js installs them as window globals.
import { rememberRecentSymbol } from '../../data/stock-subject-store.js';

// Kept for the bridge (root._fundRecentSearches): the list it painted is gone; a ticker is still remembered.
export function renderFundRecentSearches(ticker, { root = globalThis } = {}) {
  if (ticker) rememberRecentSymbol(root, ticker);
}

// Kept for the bridge (root._resetFundamentalReport): there is no legacy report left to clear.
export function resetFundamentalReport(_message, { root = globalThis } = {}) {
  root._fundAnalysisData = null;
}

export function fundSearchQuick(ticker, search) {
  return ticker ? search(ticker) : undefined;
}

export function createFundamentalSearch({ documentRef = globalThis.document, root = globalThis } = {}) {
  // The ticker comes from the caller (entity.js) or, for a no-argument call (a search queued before this module
  // loaded), from the symbol the 재무 route asked for. v59.51: _aioFundSearchFill and the chat's 재무 button are retired.
  return function fundamentalSearch(requested) {
    const ticker = String(requested || root._aioFundRequestedSymbol || root._aioLastOpenedSymbol || '').trim().toUpperCase();
    // P566/R257: anything that does not look like a ticker (AAPL, 005930.KS, BRK-A) is never stored or selected.
    if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) return;
    root._fundAnalysisData = null;
    // The selection is published so the native entity slice projects this issuer's SEC row.
    root._currentTickerId = ticker;
    root._currentTickerName = ticker;
    try { documentRef.dispatchEvent(new root.CustomEvent('aio:entityChanged', { detail: { id: ticker, source: 'fundamental-search' } })); } catch (_) { /* no listener */ }
  };
}
