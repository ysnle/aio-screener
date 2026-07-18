/** New code uses this gateway instead of touching Web Storage directly. */
export function createStorageGateway({ storage, prefix = 'aio' } = {}) {
  const backing = storage || (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null);
  const keyFor = (key) => `${prefix}:${String(key)}`;

  function get(key, fallback = null) {
    if (!backing) return fallback;
    try {
      const value = backing.getItem(keyFor(key));
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function set(key, value) {
    if (!backing) return false;
    try {
      backing.setItem(keyFor(key), String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(key) {
    if (!backing) return false;
    try {
      backing.removeItem(keyFor(key));
      return true;
    } catch (_) {
      return false;
    }
  }

  return Object.freeze({ get, set, remove, keyFor });
}
