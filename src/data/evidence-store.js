import { createEvidence, validateEvidence } from './contracts/evidence.js';

export function createEvidenceStore() {
  const entries = new Map();

  function ingest(input) {
    const evidence = createEvidence(input);
    const validation = validateEvidence(evidence);
    if (!validation.ok) throw new Error(`EVIDENCE_INVALID:${validation.errors.join(',')}`);
    entries.set(evidence.metric, evidence);
    return evidence;
  }

  function get(metric) {
    return entries.get(metric) || null;
  }

  function snapshot() {
    return Object.fromEntries(entries.entries());
  }

  function clear() {
    entries.clear();
  }

  return Object.freeze({ ingest, get, snapshot, clear });
}
