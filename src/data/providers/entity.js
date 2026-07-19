export function createEntityProvider({ read = () => ({}) } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({
        id: value.id || null,
        quote: value.quote || null,
        fundamentals: value.fundamentals || null,
        options: value.options || null,
        updatedAt: value.updatedAt || new Date().toISOString()
      });
    }
  });
}
