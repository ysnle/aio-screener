/**
 * Declared-list storage (E4/P1191 ledger, E3/P1194 FX legs; extracted in P1199).
 *
 * The classic bundle owns the *policy* of this storage and cannot give it away: the durable
 * write has to go through `safeLS` so the acknowledgement means what it says, and the
 * read has to consult the Vault runtime cache first so a declaration is visible in the same
 * turn it was made. What can move — and what was living untested in a ratcheted file — is
 * the *shape*: one rate per key, no plaintext key of their own, an encrypted value never
 * read as plaintext, and an acknowledgement that separates "memory applied" from
 * "durably persisted" instead of reporting one ok.
 *
 * The environment is injected so the acknowledgement contract is testable without a browser:
 * `getRuntimeCache`, `getAdapter`, `getLocalStorage`, `optedOut`, `secureSet`, `warn`.
 */

export const ENCRYPTED_VALUE_PREFIX = 'aio_enc::';

export function createDeclarationsStore(environment = {}) {
  const {
    getRuntimeCache = () => null,
    getAdapter = () => null,
    getLocalStorage = () => null,
    optedOut = () => false,
    secureSet = null,
    warn = () => {},
    encryptedPrefix = ENCRYPTED_VALUE_PREFIX
  } = environment || {};

  function read(key) {
    try {
      // The synchronous cache is the only view that is correct within the write turn; the
      // stored copy may still be the encrypted envelope rather than the declaration.
      if (!optedOut()) {
        const cache = getRuntimeCache();
        if (cache && cache[key] !== undefined) return JSON.parse(cache[key] || 'null');
      }
      const adapter = getAdapter();
      const storage = getLocalStorage();
      const raw = adapter ? adapter.get(key, '') : storage ? storage.getItem(key) : null;
      // An encrypted value must never be parsed as if it were the declaration.
      if (!raw || raw.indexOf(encryptedPrefix) === 0) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writePlain(key, json) {
    try {
      const adapter = getAdapter();
      const storage = getLocalStorage();
      if (adapter) adapter.set(key, json);
      else if (storage) storage.setItem(key, json);
      else return Promise.resolve({ ok: false, reason: 'storage-write-failed' });
      return Promise.resolve({ ok: true });
    } catch (_) {
      return Promise.resolve({ ok: false, reason: 'storage-write-failed' });
    }
  }

  function write(key, value) {
    const json = JSON.stringify(value == null ? null : value);
    let memoryOk = true;
    try {
      const cache = getRuntimeCache();
      if (cache) cache[key] = json;
      else memoryOk = false;
    } catch (_) {
      memoryOk = false;
    }
    const persist = (optedOut() || typeof secureSet !== 'function')
      ? writePlain(key, json)
      : secureSet(key, json).then(() => ({ ok: true })).catch((error) => {
        warn('선언 저장 확인 실패: ' + ((error && error.message) || error));
        return { ok: false, reason: 'persist-rejected' };
      });
    return persist.then((result) => ({
      // A failed durable write is not a failed change: memory applied it, the next reload
      // will not. The two facts travel separately so no caller can read one as the other.
      ok: !!memoryOk && result.ok === true,
      memoryApplied: !!memoryOk,
      reason: memoryOk ? (result.reason || null) : 'memory-write-failed'
    }));
  }

  return Object.freeze({ read, write });
}
