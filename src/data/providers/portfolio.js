export function createPortfolioProvider({ read = () => ({}), repository = null } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = repository?.read?.(null) || read() || {};
      return Object.freeze({ holdings: value.holdings || [], cash: value.cash, totals: value.totals, privacy: value.privacy, status: value.status, updatedAt: value.updatedAt });
    }
  });
}
