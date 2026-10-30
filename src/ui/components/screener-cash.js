// v59.44 (X bookmarks 10/30): the screener's cash conditions (FCF margin, capex ÷ revenue) read the SEC fiscal history,
// loaded only when one of them is chosen (fiscal-read.js is a lazy chunk; the history is about 0.5 MB). The map sits on
// root._aioScreenerCash so the boot-set screener reads it without importing this chunk.
import { requestFiscalHistory, parseFiscalHistory } from './fiscal-read.js';
import { cashMetrics } from '../../domain/fundamental/cash-metrics.js';

export function requestCashMetrics(root, onReady) {
  const build = () => {
    const history = root?._aioSecFiscalHistory;
    if (!history || root._aioScreenerCash?.source === history) return;
    const map = new Map();
    for (const [symbol, text] of Object.entries(history)) {
      // issuerSic is "3674|Semiconductors & Related Devices"; the code decides the financials exclusion.
      const sic = Number.parseInt(String(root?._aioSecIssuerSic?.[symbol] ?? '').split('|')[0], 10);
      const metrics = cashMetrics(parseFiscalHistory(text), { sic: Number.isFinite(sic) ? sic : null });
      if (metrics) map.set(symbol.toUpperCase(), metrics);
    }
    root._aioScreenerCash = { source: history, map };
    onReady?.();
  };
  if (root?._aioSecFiscalHistory) build(); else requestFiscalHistory(root, build, 'screener-cash');
}
