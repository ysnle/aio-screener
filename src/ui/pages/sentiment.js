import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { renderSentimentBoard } from '../components/sentiment-board.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { subscribeToSlice } from '../../state/memoize.js';

// P1396: the page is the five-card sentiment board (../components/sentiment-board.js).
function renderSentiment(documentRef) {
  const model = renderSentimentBoard({ documentRef, root: documentRef?.defaultView || globalThis });
  const page = documentRef?.getElementById('page-sentiment');
  if (page) page.dataset.aioArchitectureState = model?.asOf ? 'observed' : 'blocked';
  return model;
}

export function createSentimentPage({ documentRef, evidenceStore, store, chartFactory } = {}) {
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
          heading: '심리 · 포지셔닝과 시장 내부 확인'
        });
        root.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
        root.dataset.aioArchitectureRoute = 'sentiment';
        root.dataset.aioArchitectureRenderer = 'native';
      }
      const render = () => renderSentiment(documentRef, selectSentimentValues(store?.getState?.() || {}), evidenceStore, chartFactory, charts, bag);
      // RM-02: subscribe to the sentiment slice reference, not every dispatch — a
      // portfolio/screener/news/etc. dispatch leaves state.sentiment's reference
      // unchanged (every reducer is spread-based), so it no longer triggers a
      // sentiment re-render/chart redraw it has no data for.
      if (store) {
        bag.add(subscribeToSlice(store, (state) => state.sentiment, render));
      } else {
        render();
      }
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
