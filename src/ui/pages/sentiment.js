import { createResourceBag, createChartRegistry, coalesceMicrotask } from '../../app/lifecycle.js';
import { renderSentimentBoard } from '../components/sentiment-board.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { subscribeToSlice } from '../../state/memoize.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';

// P1396: the page is the five-card sentiment board (../components/sentiment-board.js).
// P1412 (Codex structural review): the board's inputs come from one adapter, collectMarketInputs
// (components/briefing-read.js), aligned by alignMarketInputs — the store slice is a change signal
// only, so the render takes no store values it would ignore. Triggers in one tick (store, document
// and its window mirror) coalesce into one render.
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
      // P1586: the self-computed sentiment composite reads the FRED spreads (HY, IG) from the same
      // artifact the macro routes load, so its component count does not depend on navigation order.
      const win = documentRef?.defaultView || globalThis;
      if (!win._aioMacroHistory && typeof (win.fetch || globalThis.fetch) === 'function') {
        loadJsonArtifact((win.fetch || globalThis.fetch).bind(win), './public-data/macro-history.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 })
          .then((payload) => { if (payload?.schemaVersion === 'macro-history.v1') win._aioMacroHistory = payload; if (active) render(); })
          .catch(() => {});
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
