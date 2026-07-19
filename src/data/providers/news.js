export function createNewsProvider({ read = () => [], now = () => Date.now() } = {}) {
  return Object.freeze({
    readCurrent() {
      const items = read();
      return Object.freeze({
        items: Array.isArray(items) ? items.slice() : [],
        updatedAt: new Date(now()).toISOString()
      });
    }
  });
}
