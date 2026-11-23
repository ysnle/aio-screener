import { createResourceBag, createChartRegistry, coalesceMicrotask } from '../../app/lifecycle.js';
import { renderSentimentBoard } from '../components/sentiment-board.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { subscribeToSlice } from '../../state/memoize.js';
import { clearKnowledgeArrival, renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { renderMarketTemperature } from '../components/market-temperature.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';

function renderSentiment(documentRef) {
  const model = renderSentimentBoard({ documentRef, root: documentRef?.defaultView || globalThis });
  const page = documentRef?.getElementById('page-sentiment');
  if (page) page.dataset.aioArchitectureState = model?.asOf ? 'observed' : 'blocked';
  return model;
}

export function createSentimentPage({ documentRef, evidenceStore, store } = {}) {
  return {
    route: 'sentiment',
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 480 });
      bag.add(charts.dispose);
      const root = documentRef?.getElementById('page-sentiment');
      if (root) {
        const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'sentiment',
          heading: '심리와 투자자 쏠림 확인'
        });
        root.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
        root.dataset.aioArchitectureRoute = 'sentiment';
        root.dataset.aioArchitectureRenderer = 'native';
      }
      let active = true;
      bag.add(() => { active = false; });
      const render = coalesceMicrotask(() => renderSentiment(documentRef), { isActive: () => active });
      // RM-02: subscribe to the sentiment slice reference, not every dispatch — a
      // portfolio/screener/news/etc. dispatch leaves state.sentiment's reference
      // unchanged (every reducer is spread-based), so it no longer triggers a
      // sentiment re-render/chart redraw it has no data for.
      if (store) {
        bag.add(subscribeToSlice(store, (state) => state.sentiment, render));
      }
      renderSentiment(documentRef);
      renderMarketTemperature({ documentRef, root: documentRef?.defaultView || globalThis, anchor: documentRef?.getElementById('sentiment-chart-grid')?.closest('section') || null });
      bag.add(() => documentRef?.getElementById('sentiment-temperature')?.remove());
      renderKnowledgeArrival({ documentRef, root: documentRef?.defaultView || globalThis, routeId: 'sentiment' });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: 'sentiment' }));
      const win = documentRef?.defaultView || globalThis;
      refreshSharedArtifact(win, MACRO_HISTORY).then(({ changed }) => { if (active && changed) render(); }); // M02
      const eventTargets = [...new Set([documentRef, documentRef?.defaultView].filter(Boolean))];
      ['aio:refresh:done', 'aio:historyLoaded', 'aio:sentimentUpdated'].forEach((eventName) => eventTargets.forEach((eventTarget) => {
        eventTarget.addEventListener?.(eventName, render);
        bag.add(() => eventTarget.removeEventListener?.(eventName, render));
      }));
      return () => {
        bag.dispose();
        if (root?.dataset.aioArchitectureRoute === 'sentiment') delete root.dataset.aioArchitectureRoute;
        if (root?.dataset.aioArchitectureRenderer === 'native') delete root.dataset.aioArchitectureRenderer;
        if (root?.dataset.aioArchitectureState) delete root.dataset.aioArchitectureState;
      };
    }
  };
}
