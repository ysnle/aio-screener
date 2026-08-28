import { createStorageGateway } from '../src/platform/storage.js';
import { createVersionedRepository } from '../src/storage/repository.js';
import { createPrivacyVault } from '../src/storage/vault.js';
import { portfolioMigrations } from '../src/storage/migrations.js';

const values = new Map();
const storage = createStorageGateway({ storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }, prefix: 'fixture' });
const repository = createVersionedRepository({ storage, key: 'migration', version: 2, validate: (value) => !!value && Array.isArray(value.holdings), migrate: portfolioMigrations.migrate });
if (!repository.write({ holdings: [] })) throw new Error('STORAGE_WRITE_FAILED');
if (!Array.isArray(repository.read()?.holdings)) throw new Error('STORAGE_READ_FAILED');
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
