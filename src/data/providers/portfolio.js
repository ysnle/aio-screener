export function createPortfolioProvider({ read = () => ({}) } = {}) {
  const positive = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  return Object.freeze({
    readCurrent() {
      // W02-A/P1143: the Vault-backed runtime reader already owns holdings, cash,
      // read state, and live-quote merging. A second stored fallback list could
      // resurrect a deliberately emptied portfolio and made "missing" and
      // "explicitly empty" indistinguishable, so the read result is the only source.
      const runtime = read() || {};
      const sourceHoldings = Array.isArray(runtime.holdings) ? runtime.holdings : [];
      const holdings = sourceHoldings.map((row) => {
        const symbol = String(row?.symbol || row?.ticker || row?.sym || '').toUpperCase();
        return {
          ...row,
          symbol,
          price: positive(row?.price),
          value: positive(row?.value),
          dailyPct: row?.dailyPct ?? null,
          fetchedAt: row?.fetchedAt || null,
          revision: row?.revision || null,
          changeBasis: row?.changeBasis || 'unknown',
          source: row?.source || 'portfolio-runtime'
        };
      }).filter((row) => row.symbol);
      const readState = ['loading', 'locked', 'ready', 'failed'].includes(runtime.readState) ? runtime.readState : 'ready';
      return Object.freeze({
        holdings,
        holdingsKnown: runtime.holdingsKnown === true || Array.isArray(runtime.holdings),
        cash: runtime.cash ?? null,
        cashKnown: runtime.cashKnown === true || runtime.cash != null,
        readState,
        totals: runtime.totals ?? null,
        privacy: runtime.privacy || 'opt-in',
        status: runtime.status || (holdings.length ? 'current' : 'empty'),
        updatedAt: runtime.updatedAt || null
      });
    }
  });
}
