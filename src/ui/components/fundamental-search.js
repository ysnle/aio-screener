export function createFundamentalSearch({ documentRef = globalThis.document, root = globalThis } = {}) {
  return function fundamentalSearch(requested) {
    const ticker = String(requested || root._aioFundRequestedSymbol || root._aioLastOpenedSymbol || '').trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) return;
    root._fundAnalysisData = null;
    // The selection is published so the native entity slice projects this issuer's SEC row.
    root._currentTickerId = ticker;
    root._currentTickerName = ticker;
    try { documentRef.dispatchEvent(new root.CustomEvent('aio:entityChanged', { detail: { id: ticker, source: 'fundamental-search' } })); } catch (_) { /* no listener */ }
  };
}
