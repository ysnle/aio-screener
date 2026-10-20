import { createStorageGateway } from '../src/platform/storage.js';

// v58.51: the versioned repository, migration registry and privacy vault under src/storage/ had no product caller and were
// removed (the portfolio vault is covered by ci-portfolio-vault-e2e.mjs). This gate keeps the live storage gateway contract.
const values = new Map();
const storage = createStorageGateway({ storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }, prefix: 'fixture' });
if (!storage.set('roundtrip', 'value') || storage.get('roundtrip') !== 'value' || !values.has('fixture:roundtrip')) throw new Error('STORAGE_GATEWAY_ROUNDTRIP_FAILED');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage denied'); } });
  const denied = createStorageGateway();
  if (denied.get('x', 'fallback') !== 'fallback' || denied.set('x', 'y') !== false) throw new Error('DENIED_STORAGE_DID_NOT_DEGRADE');
} finally {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else delete globalThis.localStorage;
}
console.log(JSON.stringify({ ok: true, gatewayRoundtrip: true, deniedStorageDegrades: true }));
