export const STORAGE_SCHEMA_VERSION = 2;

export function createMigrationRegistry({ migrations = {} } = {}) {
  function migrate(value, fromVersion, toVersion = STORAGE_SCHEMA_VERSION) {
    if (!Number.isInteger(fromVersion) || !Number.isInteger(toVersion) || fromVersion < 1 || toVersion < fromVersion) throw new Error('STORAGE_MIGRATION_VERSION_INVALID');
    let current = value;
    for (let version = Number(fromVersion) + 1; version <= toVersion; version += 1) {
      const step = migrations[version];
      if (typeof step !== 'function') throw new Error(`STORAGE_MIGRATION_STEP_MISSING:${version}`);
      current = step(current);
    }
    return current;
  }
  return Object.freeze({ migrate, versions: Object.keys(migrations).map(Number).sort((a, b) => a - b) });
}

export const portfolioMigrations = createMigrationRegistry({ migrations: {
  2: (value) => ({ ...(value || {}), holdings: Array.isArray(value?.holdings) ? value.holdings : [], privacy: value?.privacy || 'opt-in' })
} });
