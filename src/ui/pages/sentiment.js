import { createResourceBag, createChartRegistry, coalesceMicrotask } from '../../app/lifecycle.js';
import { renderSentimentBoard } from '../components/sentiment-board.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { subscribeToSlice } from '../../state/memoize.js';
import { clearKnowledgeArrival, renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { renderMarketTemperature } from '../components/market-temperature.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';
import { requestResearchReference } from '../../data/research-reference.js';
import { paintResearchSection } from '../components/research-reference.js';

// The page is the sentiment board (../components/sentiment-board.js): the shared 심리 verdict, indicator rows and charts.
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
      // per-market price temperature (KOSPI·KOSDAQ·S&P·Nasdaq·Nikkei) under the US sentiment charts.
      renderMarketTemperature({ documentRef, root: documentRef?.defaultView || globalThis, anchor: documentRef?.getElementById('sentiment-chart-grid')?.closest('section') || null });
      bag.add(() => documentRef?.getElementById('sentiment-temperature')?.remove());
      // Researched fund flows and positioning (weekly, hand-checked, each row dated) under the price temperature: who is
      // putting money in or taking it out, beside the survey and price readings of mood. Never part of the 심리 verdict.
      let flows = null;
      const paintFlows = () => { flows = paintResearchSection(documentRef, documentRef?.defaultView || globalThis, { id: 'sentiment-research-flows', title: '자금 흐름과 포지션', groups: ['fund-flows'],
        anchor: documentRef?.getElementById('sentiment-temperature') || documentRef?.getElementById('sentiment-chart-grid')?.closest('section') || null }); };
      paintFlows();
      requestResearchReference(documentRef?.defaultView || globalThis, () => { if (active) paintFlows(); });
      bag.add(() => flows?.remove());
      // Research documents (N chapter, formerly the options route) land here with what to check.
      renderKnowledgeArrival({ documentRef, root: documentRef?.defaultView || globalThis, routeId: 'sentiment' });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: 'sentiment' }));
      // The self-computed sentiment composite reads the FRED spreads (HY, IG) from the same
      // artifact the macro routes load, so its component count does not depend on navigation order.
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
