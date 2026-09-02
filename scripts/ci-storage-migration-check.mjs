import { createStorageGateway } from '../src/platform/storage.js';
import { createVersionedRepository } from '../src/storage/repository.js';
import { createPrivacyVault } from '../src/storage/vault.js';
import { portfolioMigrations, createMigrationRegistry } from '../src/storage/migrations.js';

const values = new Map();
const storage = createStorageGateway({ storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }, prefix: 'fixture' });
const repository = createVersionedRepository({ storage, key: 'migration', version: 2, validate: (value) => !!value && Array.isArray(value.holdings), migrate: portfolioMigrations.migrate });
if (!repository.write({ holdings: [] })) throw new Error('STORAGE_WRITE_FAILED');
if (!Array.isArray(repository.read()?.holdings)) throw new Error('STORAGE_READ_FAILED');
storage.set('migration', JSON.stringify({ version: 2, data: { holdings: 'invalid' } }));
if (repository.migrateStored() !== null) throw new Error('SAME_VERSION_BYPASSED_VALIDATION');
const future = JSON.stringify({ version: 3, data: { holdings: [] } });
storage.set('migration', future);
if (repository.migrateStored() !== null || storage.get('migration') !== future) throw new Error('FUTURE_VERSION_WAS_OVERWRITTEN');
storage.set('migration', JSON.stringify({ version: 1, data: {} }));
if (repository.migrateStored()?.privacy !== 'opt-in' || !Array.isArray(repository.read()?.holdings)) throw new Error('ACTUAL_V1_MIGRATION_FAILED');
let migrationRejected = false;
try { createMigrationRegistry().migrate({}, 1, 2); } catch (_) { migrationRejected = true; }
if (!migrationRejected) throw new Error('MISSING_MIGRATION_WAS_SILENTLY_SKIPPED');
const rawValues = new Map();
const rawStorage = { getItem: key => rawValues.get(key) ?? null, setItem: (key, value) => rawValues.set(key, value), removeItem: key => rawValues.delete(key) };
const injected = createVersionedRepository({ storage: rawStorage, key: 'injected', prefix: 'test' });
if (!injected.write({ value: 0 }) || injected.read()?.value !== 0 || !rawValues.has('test:injected')) throw new Error('RAW_STORAGE_INJECTION_IGNORED');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage denied'); } });
  const denied = createStorageGateway();
  if (denied.get('x', 'fallback') !== 'fallback' || denied.set('x', 'y') !== false) throw new Error('DENIED_STORAGE_DID_NOT_DEGRADE');
} finally {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else delete globalThis.localStorage;
}
let consent = false;
const unsafeVault = createPrivacyVault({ consent: () => true });
if (unsafeVault.write({ secret: true }) || unsafeVault.status !== 'disabled-no-encrypted-repository') throw new Error('VAULT_ACCEPTED_PLAINTEXT_REPOSITORY');
let encryptedValue = null;
const secureRepository = {
  capabilities: { encryptedAtRest: true, scheme: 'fixture-aead' },
  read: (fallback = null) => encryptedValue ?? fallback,
  write: (value) => { encryptedValue = value; return true; },
  remove: () => { encryptedValue = null; return true; },
  migrateStored: () => encryptedValue
};
const vault = createPrivacyVault({ secureRepository, consent: () => consent });
if (vault.write({ secret: true })) throw new Error('VAULT_WROTE_WITHOUT_CONSENT');
consent = true;
if (!vault.write({ secret: true }) || vault.read()?.secret !== true) throw new Error('VAULT_CONSENT_FLOW_FAILED');
if (!vault.remove() || vault.read(null) !== null) throw new Error('VAULT_ROLLBACK_FAILED');
console.log(JSON.stringify({ ok: true, migrationVersion: 2, consentBoundary: true, plaintextFacadeDisabled: true }));
