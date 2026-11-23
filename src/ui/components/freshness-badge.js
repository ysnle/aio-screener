import { readArtifactFreshness } from '../../data/freshness.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { stampDay } from '../../domain/shared/session-date.js';

export const FRESHNESS_STATES = Object.freeze(['current', 'late', 'stale', 'unknown']);

// freshness: the reader's object; market: which basis session to show; degraded: the record's 참고 flag.
export function freshnessBadge(doc, freshness, { market = 'US', degraded = false } = {}) {
  const state = FRESHNESS_STATES.includes(freshness?.state) ? freshness.state : 'unknown';
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
