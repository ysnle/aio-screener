export function createSentimentProvider({ read = () => ({}), now = () => Date.now() } = {}) {
  return Object.freeze({
    readCurrent() {
      const value = read() || {};
      return Object.freeze({
        ...value,
        now: value.now || new Date(now()).toISOString()
      });
    }
  });
}
