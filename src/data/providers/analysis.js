export function createAnalysisProvider({ read = () => ({}) } = {}) {
  return Object.freeze({ readCurrent() { return Object.freeze({ ...(read() || {}) }); } });
}
