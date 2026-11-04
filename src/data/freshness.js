// v59.70: the screens' reader for the producer freshness ledgers (schema: src/data/contracts/artifact-freshness.js).
// A freshness badge draws from readArtifactFreshness(file) and nothing else, so the screen and the watchdog
// (scripts/ci-external-pipeline-check.mjs, the same freshnessState) grade an artifact the same way.
import { ARTIFACT_FRESHNESS, FRESHNESS_SCHEMA, freshnessLedgerPath, freshnessState } from './contracts/artifact-freshness.js';
import { refreshSharedArtifact } from './shared-artifacts.js';

const LEDGER_WORKFLOWS = Object.freeze([...new Set(Object.values(ARTIFACT_FRESHNESS)
  .filter((entry) => entry.ledger !== false).map((entry) => entry.workflow))]);

const ledgerSpec = (workflow) => ({
  key: `_aioFreshness_${workflow.replace(/\W+/g, '_')}`,
  url: `./${freshnessLedgerPath(workflow)}`,
  schemas: [FRESHNESS_SCHEMA],
  maxAgeMs: 15 * 60 * 1000,
  maxBytes: 64 * 1024,
});

/** Loads (or keeps, inside 15 minutes and the server-data generation) every workflow ledger. A failed load keeps the last copy. */
export function loadFreshnessLedgers(root = globalThis) {
  return Promise.all(LEDGER_WORKFLOWS.map((workflow) => refreshSharedArtifact(root, ledgerSpec(workflow))));
}

/**
 * { state, producedAt, checkedAt, basisSession, workflow, producer, blockedBy } for one public-data file name.
 * state: 'current' | 'late' | 'stale' | 'unknown'; 'blocked' when the refresh path waits on a missing secret.
 * Without a ledger row (not loaded yet, or a ledger: false artifact) the state is 'unknown' and the caller may fall back to
 * the artifact's own clock.
 */
export function readArtifactFreshness(file, { root = globalThis, now = Date.now() } = {}) {
  const spec = ARTIFACT_FRESHNESS[file];
  if (!spec) return { state: 'unknown', producedAt: null, checkedAt: null, basisSession: null, workflow: null, producer: null, blockedBy: null };
  const row = spec.ledger === false ? null : root?.[ledgerSpec(spec.workflow).key]?.artifacts?.[file] || null;
  const graded = row ? freshnessState(row, now) : 'unknown';
  return {
    state: spec.blockedBy && graded !== 'current' ? 'blocked' : graded,
    producedAt: row?.producedAt || null,
    checkedAt: row?.checkedAt || null,
    basisSession: row?.basisSession || null,
    workflow: spec.workflow,
    producer: spec.producer,
    blockedBy: spec.blockedBy || null,
  };
}
