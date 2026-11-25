// One owner for the investor-flow artifact, shared by 시장 상태's flow card and the 한국 tab's session link. The shared
// artifact layer already joins concurrent requests; this adds the one thing both readers need beside the copy: a repaint
// when the copy arrives or the request fails (a failure is its own state, never read as 수집 전).
import { refreshSharedArtifact, sharedArtifactState } from './shared-artifacts.js';
import { KR_INVESTOR_FLOWS } from './artifact-registry.js';
import { buildKrInvestorFlowView } from '../domain/market/korea/kr-investor-flows.js';

const KEY = KR_INVESTOR_FLOWS.key;

/** Loads (or reuses) the artifact; onChange runs when a new copy replaced the old one or the load state moved. */
export function requestKrInvestorFlows(root, onChange) {
  const before = sharedArtifactState(root, KEY);
  return refreshSharedArtifact(root, KR_INVESTOR_FLOWS)
    .then(({ changed }) => changed, () => false)
    .then((changed) => { if (changed || sharedArtifactState(root, KEY) !== before) onChange?.(); });
}

/** The read model of the copy in hand (buildKrInvestorFlowView), with the load state the copy's absence means. */
export const krInvestorFlowView = (root, nowMs = Date.now()) =>
  buildKrInvestorFlowView(root?.[KEY] || null, { nowMs, loadState: sharedArtifactState(root, KEY) });
