import { createVersionedRepository } from './repository.js';

export function createPrivacyVault({ storage, key = 'portfolio', version = 1, validate = () => true, consent = () => false } = {}) {
  const repository = createVersionedRepository({ storage, key: `vault:${key}`, version, validate });
  function read(fallback = null) {
    return consent() ? repository.read(fallback) : fallback;
  }
  function write(value) {
    return consent() ? repository.write(value) : false;
  }
  return Object.freeze({ read, write, remove: () => repository.remove(), migrateStored: repository.migrateStored, version });
}
