export function createMarketProvider({ read = () => ({}) } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({
        quotes: value.quotes && typeof value.quotes === 'object' ? { ...value.quotes } : {},
        metrics: value.metrics && typeof value.metrics === 'object' ? { ...value.metrics } : {},
        updatedAt: value.updatedAt || null,
        observationStart: value.observationStart || null,
        observationEnd: value.observationEnd || null
      });
    }
  });
}
