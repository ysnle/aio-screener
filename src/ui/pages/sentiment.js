import { createResourceBag } from '../../app/lifecycle.js';
import { deriveSentimentSummary } from '../../domain/sentiment/metrics.js';

export function createSentimentPage({ documentRef, evidenceStore, store } = {}) {
  return {
    route: 'sentiment',
    mount() {
      const bag = createResourceBag();
      const root = documentRef?.getElementById('page-sentiment');
      const badge = documentRef?.getElementById('sent-overall-badge');
      if (root) root.dataset.aioArchitectureRoute = 'sentiment';

      const render = () => {
        const state = store?.getState?.() || {};
        const summary = deriveSentimentSummary(state.sentiment || {});
        const fgEvidence = evidenceStore?.get('fearGreed');
        if (badge) {
          badge.dataset.aioArchitectureState = summary.blocked ? 'blocked' : 'observed';
          if (fgEvidence) {
            badge.dataset.aioEvidenceId = fgEvidence.evidenceId;
            badge.dataset.aioAllowedUse = fgEvidence.allowedUse;
          }
        }
      };
      const unsubscribe = store?.subscribe?.(render);
      if (unsubscribe) bag.add(unsubscribe);
      render();
      return () => {
        bag.dispose();
        if (root?.dataset.aioArchitectureRoute === 'sentiment') delete root.dataset.aioArchitectureRoute;
      };
    }
  };
}
