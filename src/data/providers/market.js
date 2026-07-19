export function createMarketProvider({ read = () => ({}) } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({
        quotes: value.quotes && typeof value.quotes === 'object' ? { ...value.quotes } : {},
        metrics: value.metrics && typeof value.metrics === 'object' ? { ...value.metrics } : {},
        updatedAt: value.updatedAt || new Date().toISOString()
      });
    }
  });
}
