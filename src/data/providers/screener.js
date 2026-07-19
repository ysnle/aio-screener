export function createScreenerProvider({ read = () => ({}) } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({ rows: Array.isArray(value) ? value : value.rows || [], filters: value.filters, revision: value.revision, status: value.status, updatedAt: value.updatedAt });
    }
  });
}
