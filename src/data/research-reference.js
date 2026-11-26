// One owner for the hand-researched reference artifact, shared by 매크로's credit chapter, 테마's AI chain, 투자 심리 and
// the stock page. The shared artifact layer joins concurrent requests; this adds the repaint each reader needs when the
// copy arrives or the request fails (a failure is its own state, never read as an empty file).
import { refreshSharedArtifact, sharedArtifactState } from './shared-artifacts.js';
import { RESEARCH_REFERENCE } from './artifact-registry.js';
import { researchReference } from '../domain/research/reference.js';

const KEY = RESEARCH_REFERENCE.key;

/** Loads (or reuses) the artifact; onChange runs when a new copy replaced the old one or the load state moved. */
export function requestResearchReference(root, onChange) {
  const before = sharedArtifactState(root, KEY);
  return refreshSharedArtifact(root, RESEARCH_REFERENCE)
    .then(({ changed }) => changed, () => false)
    .then((changed) => { if (changed || sharedArtifactState(root, KEY) !== before) onChange?.(); });
}

/** The read model of the copy in hand for the given groups (and, for the stock page, one ticker). */
export const researchReferenceView = (root, { groups, entity = null, nowMs = Date.now() } = {}) =>
  researchReference(root?.[KEY] || null, { nowMs, groups, entity, loadState: sharedArtifactState(root, KEY) === 'failed' ? 'failed' : 'loading' });
