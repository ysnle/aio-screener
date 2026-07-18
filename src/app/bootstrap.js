import { createClock } from '../platform/clock.js';
import { createStore } from '../state/store.js';
import { createEvidenceStore } from '../data/evidence-store.js';
import { applyFreshness } from '../data/quality/freshness.js';
import { buildEvidenceContext } from '../ai/context-builder.js';
import { deriveSentimentSummary } from '../domain/sentiment/metrics.js';
import { createRouteRegistry } from './router.js';
import { createLifecycleRouter } from './router.js';
import { createLegacyObserverPage } from '../ui/pages/legacy-observer.js';
import { createSentimentPage } from '../ui/pages/sentiment.js';
import { createLegacyFacade, exposeArchitecture } from '../legacy/compatibility-facade.js';
import { ROUTE_IDS } from './routes.js';

export const ARCHITECTURE_VERSION = 'AR-01~06.v1';

function reducer(state, action) {
  if (action.type === 'legacy/sentiment') return { ...state, sentiment: { ...action.payload } };
  return state;
}

export function createAIOArchitecture({ root = globalThis, documentRef = root.document, now = () => Date.now() } = {}) {
  const clock = createClock(now);
  const evidenceStore = createEvidenceStore();
  const store = createStore({ initialState: { sentiment: {}, route: null }, reducer });
  const eventTarget = documentRef || root;
  const legacy = createLegacyFacade(root, eventTarget);

  function syncLegacySentiment() {
    const raw = legacy.readSentiment();
    const sentiment = { ...raw };
    const observedAt = raw.now;
    const fields = [
      ['fearGreed', raw.fearGreed, 'score'],
      ['vix9d', raw.vix9d, 'index'],
      ['vix', raw.vix, 'index'],
      ['vix3m', raw.vix3m, 'index'],
      ['vix6m', raw.vix6m, 'index']
    ];
    for (const [metric, value, unit] of fields) {
      const status = value == null ? 'missing' : 'live';
      const entry = applyFreshness({
        metric,
        value,
        unit,
        sourceKind: value == null ? 'unavailable' : 'legacy-projection',
        source: value == null ? 'legacy-projection' : 'legacy-runtime',
        observedAt: value == null ? null : observedAt,
        fetchedAt: observedAt,
        lastSuccessfulAt: value == null ? null : observedAt,
        status
      }, { now: clock.now(), maxAgeMs: 120_000 });
      if (entry.status === 'missing') continue;
      evidenceStore.ingest(entry);
    }
    store.dispatch({ type: 'legacy/sentiment', payload: sentiment });
    return sentiment;
  }

  const modules = Object.fromEntries(ROUTE_IDS.map((route) => [route, createLegacyObserverPage(route, { documentRef })]));
  modules.sentiment = createSentimentPage({ documentRef, evidenceStore, store });
  const router = createLifecycleRouter({ root: eventTarget, registry: createRouteRegistry({ modules }), context: { store, evidenceStore, legacy, clock } });

  function start() {
    syncLegacySentiment();
    const stopQuotes = legacy.on('aio:liveQuotes', syncLegacySentiment);
    const stopShown = legacy.on('aio:pageShown', (event) => {
      const detail = event?.detail;
      const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
      if (route) store.dispatch({ type: 'route/changed', payload: route });
    });
    router.start();
    return () => {
      stopQuotes();
      stopShown();
      router.dispose();
      evidenceStore.clear();
    };
  }

  const api = {
    version: ARCHITECTURE_VERSION,
    start,
    router,
    getState: () => store.getState(),
    getEvidence: (metric) => metric ? evidenceStore.get(metric) : evidenceStore.snapshot(),
    getSentimentSummary: () => deriveSentimentSummary(store.getState().sentiment),
    getAIContext: (metrics = ['fearGreed', 'vix']) => buildEvidenceContext({ evidenceStore, metrics })
  };
  exposeArchitecture(root, api);
  return Object.freeze({ ...api, store, evidenceStore });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const boot = () => {
    if (window.__AIO_ARCH_RUNTIME__) return;
    try {
      const runtime = createAIOArchitecture({ root: window, documentRef: document });
      window.__AIO_ARCH_RUNTIME__ = runtime.start();
    } catch (error) {
      document.documentElement.dataset.aioArchitectureFallback = 'legacy';
      console.warn('[AIO] architecture bootstrap deferred to legacy shell', error?.message || error);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
