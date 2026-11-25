// The producers' reader for the freshness ledgers on disk: the same grade the screens draw their badges from
// (ledgerFileState), for a producer that reads another workflow's published file.
import { readFileSync } from 'node:fs';
import { ARTIFACT_FRESHNESS, freshnessLedgerPath, ledgerFileState } from '../../src/data/contracts/artifact-freshness.js';

const REPO = new URL('../../', import.meta.url);

/** 'current' | 'late' | 'stale' | 'blocked' | 'unknown' for one public-data file name at `now`. */
export function publishedFileState(file, { now = Date.now(), root = REPO } = {}) {
  const workflow = ARTIFACT_FRESHNESS[file]?.workflow;
  if (!workflow) return 'unknown';
  let ledger = null;
  try { ledger = JSON.parse(readFileSync(new URL(freshnessLedgerPath(workflow), root), 'utf8')); } catch (_) { ledger = null; }
  return ledgerFileState(file, ledger, now);
}
