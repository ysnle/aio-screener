import { createEvidence, evaluateEvidence, validateEvidence } from './contracts/evidence.js';
import { canonicalSourceTier } from './contracts/source-kind.js';

const SOURCE_PRIORITY = Object.freeze({ T1_OFFICIAL: 4, T2_LICENSED: 3, T3_PUBLIC_DELAYED: 2, T4_REFERENCE: 1 });
const RIGHTS_BLOCKED = new Set(['DENIED', 'BLOCKED', 'REVOKED']);

function time(value) {
  const numeric = typeof value === 'number' ? value : (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN);
  const parsed = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function chronology(record) {
  const values = [
    record?.rightsEffectiveAt,
    record?.collectedAt,
    record?.fetchedAt,
    record?.updatedAt,
    record?.revisionId
  ].map(time).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

// R2-03 (2026-10-31 review): an observation stamped further ahead than a normal clock difference is not newer than a
// real one; it is compared as undated, so a vix=99 stamped six hours ahead no longer blocks a vix=17 observed now.
const FUTURE_OBSERVATION_SKEW_MS = 5 * 60 * 1000;
const observedTime = (value, nowMs) => {
  const at = time(value);
  return at !== null && at - nowMs > FUTURE_OBSERVATION_SKEW_MS ? null : at;
};

function shouldReplace(current, incoming, nowMs = Date.now()) {
  if (!current) return true;
  const incomingBlocked = RIGHTS_BLOCKED.has(String(incoming.rightsId || '').toUpperCase()) || incoming.allowedUse === 'none';
  const currentBlocked = RIGHTS_BLOCKED.has(String(current.rightsId || '').toUpperCase()) || current.allowedUse === 'none';
  const currentObserved = observedTime(current.observedAt, nowMs);
  const incomingObserved = observedTime(incoming.observedAt, nowMs);
  if (currentObserved !== null || incomingObserved !== null) {
    if (currentObserved === null) return true;
    if (incomingObserved === null) {
      if (incomingBlocked && !currentBlocked) {
        const currentFetched = time(current.fetchedAt || current.collectedAt);
        const incomingFetched = time(incoming.fetchedAt || incoming.collectedAt);
        return currentFetched !== null && incomingFetched !== null && incomingFetched > currentFetched;
      }
      return false;
    }
    if (incomingObserved !== currentObserved) return incomingObserved > currentObserved;
  }
  // Rights/quality state follows collection chronology too. At the same
  // observed time, an old DENIED/REVOKED record must not overwrite a newer
  // valid value; recovery likewise needs a newer fetched/rights-effective
  // revision. Missing chronology is never treated as newer.
  const currentChronology = chronology(current);
  const incomingChronology = chronology(incoming);
  if (incomingBlocked && !currentBlocked) {
    return currentChronology !== null && incomingChronology !== null && incomingChronology > currentChronology;
  }
  if (currentBlocked && !incomingBlocked) {
    return currentChronology !== null && incomingChronology !== null && incomingChronology > currentChronology;
  }
  const currentPriority = SOURCE_PRIORITY[canonicalSourceTier(current.sourceKind)] || 0;
  const incomingPriority = SOURCE_PRIORITY[canonicalSourceTier(incoming.sourceKind)] || 0;
  if (incomingPriority !== currentPriority) return incomingPriority > currentPriority;
  const currentFetched = time(current.fetchedAt || current.collectedAt);
  const incomingFetched = time(incoming.fetchedAt || incoming.collectedAt);
  if (currentFetched !== null || incomingFetched !== null) {
    if (currentFetched === null) return true;
    if (incomingFetched === null) return false;
    if (incomingFetched !== currentFetched) return incomingFetched > currentFetched;
  }
  return incoming.revisionId !== current.revisionId;
}

export function createEvidenceStore({ now = () => Date.now() } = {}) {
  const entries = new Map();

  function ingest(input) {
    const evidence = createEvidence(input);
    const validation = validateEvidence(evidence);
    if (!validation.ok) throw new Error(`EVIDENCE_INVALID:${validation.errors.join(',')}`);
    const decisionCheck = evidence.allowedUse === 'decision' ? evaluateEvidence(evidence, { purpose: 'decision' }) : null;
    if (decisionCheck && !decisionCheck.ok) throw new Error(`EVIDENCE_DECISION_INVALID:${decisionCheck.errors.join(',')}`);
    const current = entries.get(evidence.metric) || null;
    if (shouldReplace(current, evidence, now())) entries.set(evidence.metric, evidence);
    return entries.get(evidence.metric);
  }

  function get(metric) {
    return entries.get(metric) || null;
  }

  function snapshot() {
    return Object.freeze(Object.fromEntries(entries.entries()));
  }

  function clear() {
    entries.clear();
  }

  return Object.freeze({ ingest, get, snapshot, clear });
}
