// v59.70 (ui-states): one look for "how current is this file" (aio-freshness.v1). The badge reads only the state and the
// basis session ('11/3 종가'); times stay in the reader, never on the face. A record the producer lowered to reference use
// (allowedUseDegradedBy) is marked 참고 beside the state. Look: src/ui/styles/ui-states.css (.aio-fresh).
import { readArtifactFreshness } from '../../data/freshness.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { stampDay } from '../../domain/shared/session-date.js';

export const FRESHNESS_STATES = Object.freeze(['current', 'late', 'stale', 'unknown']);

// freshness: the reader's object; market: which basis session to show; degraded: the record's 참고 flag.
export function freshnessBadge(doc, freshness, { market = 'US', degraded = false } = {}) {
  const state = FRESHNESS_STATES.includes(freshness?.state) ? freshness.state : 'unknown';
  // The ledger stores the basis as an ISO day (artifactBasisSession); the face reads '11/3 종가'.
  const raw = String(freshness?.basisSession?.[market] || '').trim();
  const day = stampDay(raw);
  const basis = day ? `${shortDate(day)} 종가` : raw;
  if (!basis && !degraded) return null;
  const badge = doc.createElement('span');
  badge.className = `aio-asof aio-fresh is-${state}${degraded ? ' is-reference' : ''}`;
  badge.dataset.freshness = state;
  if (degraded) {
    const mark = doc.createElement('b');
    mark.className = 'aio-fresh__ref';
    mark.textContent = '참고';
    badge.append(mark);
  }
  if (basis) badge.append(doc.createTextNode(basis));
  return badge;
}

export function artifactFreshnessBadge(doc, file, options = {}) {
  return freshnessBadge(doc, readArtifactFreshness(file), options);
}
