// v59.44 (X bookmarks 10/30): the screener's cash conditions (FCF margin, capex ÷ revenue) read the SEC fiscal history,
// loaded only when one of them is chosen (fiscal-read.js is a lazy chunk; the history is about 0.5 MB). The map sits on
// root._aioScreenerCash so the boot-set screener reads it without importing this chunk.
import { requestFiscalHistory, issuerSic } from './fiscal-read.js';
import { parseFiscalHistory } from '../../domain/fundamental/fiscal-read.js';
import { cashMetrics } from '../../domain/fundamental/cash-metrics.js';

export function requestCashMetrics(root, onReady) {
  const build = () => {
    const history = root?._aioSecFiscalHistory;
    // The read ended without a history (failed or not published): the screener ends its wait and says why.
    if (!history) { onReady?.(); return; }
    if (root._aioScreenerCash?.source === history) return;
    const map = new Map();
    for (const [symbol, text] of Object.entries(history)) {
      // The issuer's SEC SIC code (fiscal-read.js issuerSic) decides the financials exclusion.
      const sic = Number.parseInt(issuerSic(root, symbol) ?? '', 10);
      const metrics = cashMetrics(parseFiscalHistory(text), { sic: Number.isFinite(sic) ? sic : null, symbol });
      if (metrics) map.set(symbol.toUpperCase(), metrics);
    }
    root._aioScreenerCash = { source: history, map };
    onReady?.();
  };
  if (root?._aioSecFiscalHistory) build(); else requestFiscalHistory(root, build, 'screener-cash');
}
