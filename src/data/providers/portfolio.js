export function createPortfolioProvider({ read = () => ({}), repository = null } = {}) {
  return Object.freeze({
    readCurrent() {
      const stored = repository?.read?.(null) || {};
      const runtime = read() || {};
      const runtimeBySymbol = new Map((runtime.holdings || []).map((row) => [String(row?.symbol || '').toUpperCase(), row]));
      const sourceHoldings = Array.isArray(stored.holdings) && stored.holdings.length ? stored.holdings : runtime.holdings || [];
      const holdings = sourceHoldings.map((row) => {
        const symbol = String(row?.symbol || row?.ticker || row?.sym || '').toUpperCase();
        const live = runtimeBySymbol.get(symbol) || {};
        return {
          ...row,
          symbol,
          price: live.price ?? row.price ?? null,
          dailyPct: live.dailyPct ?? row.dailyPct ?? null,
          quoteObservedAt: live.quoteObservedAt || null,
          fetchedAt: live.fetchedAt || null,
          revision: live.revision || null,
          changeBasis: live.changeBasis || 'unknown',
          source: live.source || row.source || 'portfolio-vault'
        };
      }).filter((row) => row.symbol);
      return Object.freeze({
        holdings,
        cash: stored.cash ?? runtime.cash,
        totals: stored.totals ?? runtime.totals,
        privacy: stored.privacy || runtime.privacy,
        status: holdings.length ? 'current' : stored.status || runtime.status || 'empty',
        updatedAt: runtime.updatedAt || stored.updatedAt || null
      });
    }
  });
}
