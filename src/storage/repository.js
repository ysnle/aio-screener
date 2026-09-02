import { createStorageGateway } from '../platform/storage.js';

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value) {
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch (_) { return null; }
}

export function createVersionedRepository({ storage, key, version = 1, validate = () => true, migrate = (value) => value, prefix = 'aio' } = {}) {
  if (!key) throw new Error('REPOSITORY_KEY_REQUIRED');
  const gateway = storage?.get && storage?.set ? storage : createStorageGateway({ storage, prefix });
  function read(fallback = null) {
    const envelope = decode(gateway.get(key));
    if (!envelope || envelope.version !== version || !validate(envelope.data)) return fallback;
    return envelope.data;
  }
  function write(value) {
    if (!validate(value)) return false;
    return gateway.set(key, encode({ version, data: value, updatedAt: new Date().toISOString() }));
  }
  function migrateStored() {
    const envelope = decode(gateway.get(key));
    if (!envelope || !Number.isInteger(envelope.version) || envelope.version < 1 || envelope.version > version) return null;
    if (envelope.version === version) return validate(envelope.data) ? envelope.data : null;
    const next = migrate(envelope.data, envelope.version, version);
    return write(next) ? next : null;
  }
  return Object.freeze({ read, write, remove: () => gateway.remove(key), migrateStored, key, version });
}
