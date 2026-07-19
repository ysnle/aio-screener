export function createThemesProvider({ read = () => ({}) } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({
        items: Array.isArray(value.items) ? value.items.slice() : [],
        selectedId: value.selectedId || null,
        updatedAt: value.updatedAt || new Date().toISOString()
      });
    }
  });
}
