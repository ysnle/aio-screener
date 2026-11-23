import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderHomeRegime } from '../components/home-regime.js';
import { renderDailyLoop } from '../components/daily-loop.js';
import { renderKoreaParticipation } from '../components/korea-participation.js';
import { alignInput, buildCloseSeries, closeBasis, isUsable } from '../../domain/briefing/market-read.js';
import { fearGreedBand } from '../../domain/market/sentiment/metrics.js';
import { renderKnowledgeArrival, clearKnowledgeArrival } from '../components/knowledge-arrival.js';
import { renderHomeVix } from '../components/home-vix.js';
import { readNumber as finite } from '../../domain/shared/number.js';
import { renderScreenReading } from '../components/screen-reading.js';

let regimeBoardModule = null;
export function loadRegimeBoard() {
  return (regimeBoardModule ||= import('../components/market-regime.js').catch((error) => { regimeBoardModule = null; throw error; }));
}

const FEAR_GREED_COLOR = Object.freeze({ '극단 공포': 'var(--color-text-error)', '공포': 'var(--color-text-warning)', '중립': 'var(--color-text-secondary)', '탐욕': 'var(--color-text-success)', '극단 탐욕': 'var(--color-text-success)' });
function renderHomeFearGreed({ documentRef, sentimentValues, fgClose = null, fgStale = false }) {
  const element = documentRef?.getElementById('home-fg-score');
  if (!element) return;
  const score = fgStale ? null : fgClose ? finite(fgClose.value) : finite(sentimentValues?.fearGreed);
  const band = score == null ? null : fearGreedBand(score);
  const known = band && !band.blocked;
  const label = documentRef?.getElementById('home-fg-label');
  if (label) label.textContent = known ? band.label : fgStale ? '오래됨' : '미수신';
  element.textContent = known ? String(Math.round(score)) : '—';
  element.style.color = known ? FEAR_GREED_COLOR[band.label] : 'var(--color-text-secondary)';
  element.dataset.aioHomeFearGreedRenderer = 'native';
  element.setAttribute('data-source-kind', !known ? 'unavailable' : fgClose ? 'completed-close-history' : (sentimentValues?.fearGreedSourceKind || 'legacy-runtime'));
  element.setAttribute('data-source-label', !known ? 'sentiment unavailable' : fgClose ? 'completed-close history' : (sentimentValues?.fearGreedSource || 'sentiment state'));
  element.setAttribute('data-operational-use', 'reference-only');
  const observedAt = fgClose ? fgClose.date : sentimentValues?.fearGreedObservedAt;
  if (observedAt) element.setAttribute('data-observed-at', observedAt);
  else element.removeAttribute('data-observed-at');
}

function render({ root, documentRef, store, route, renderRegimePage }) {
  const technical = selectTechnical(store.getState());
  const signal = selectSignal(store.getState());
  const home = selectHomeSummary(store.getState());
  const sentimentValues = selectSentimentValues(store.getState());
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    // Reference quotes remain useful even when the decision score is blocked.
    // Reuse the shared writer when snapshot hydration completes after first paint.
    root?.AIO?.applyLiveDataToDom?.({ pageId: route });
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureSlice = 'analysis';
    page.dataset.aioArchitectureStatus = (route === 'home' ? home?.status : route === 'signal' ? signal?.status : technical?.status) || 'unavailable';
    if (route === 'home') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioHomeRenderer = 'native';
      const homeRegime = renderHomeRegime({ documentRef, root, store });
      renderDailyLoop({ documentRef, root, store, regime: homeRegime });
      const history = root?._aioHistory || [];
      const basis = closeBasis(history);
      const fgClose = buildCloseSeries(history, 'fg', { through: basis }).at(-1) || null;
      renderHomeFearGreed({ documentRef, sentimentValues, fgClose, fgStale: !!fgClose && !isUsable(alignInput(fgClose.date, basis)) });
      renderHomeVix({ documentRef, root });
    }
    if (route === 'signal') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioSignalRenderer = 'native';
      renderRegimePage?.({ documentRef, root, store });
      renderScreenReading({ documentRef, root, screen: 'signal' }); // the AI reading under the hero
      renderKoreaParticipation({ documentRef, root, store });
    }
  }
}

export function createAnalysisPage({ root = globalThis, documentRef, store, route = 'home', renderRegimePage = null } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ root, documentRef, store, route, renderRegimePage });
      renderNow();
      bag.add(subscribeToSlices(store, ['analysis', 'sentiment', 'marketSnapshot'], renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      eventTarget?.addEventListener?.('aio:refresh:done', renderNow);
      eventTarget?.addEventListener?.('aio:serverDataLoaded', renderNow);
      eventTarget?.addEventListener?.('aio:historyLoaded', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:serverDataLoaded', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:historyLoaded', renderNow));
      // The refresh scheduler announces on window; the document registration above stays.
      if (typeof root?.addEventListener === 'function' && root !== eventTarget) {
        root.addEventListener('aio:refresh:done', renderNow);
        bag.add(() => root.removeEventListener?.('aio:refresh:done', renderNow));
      }
      const page = documentRef?.getElementById(`page-${route}`);
      renderKnowledgeArrival({ documentRef, root, routeId: route });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: route }));
      let suppliedMaterialBridge = page?.querySelector?.(`[data-aio-supplied-material-route="${route}"]`) || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: route,
          heading: route === 'home' ? '홈, 시장 확인과 거시 시차' : route === 'signal' ? '시장 상태, 확인 증거와 리스크 과정' : '기술, 가격 우선과 다중 시계열'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      const homeFearGreed = route === 'home' ? documentRef?.getElementById('home-fg-score') : null;
      if (homeFearGreed) homeFearGreed.dataset.aioHomeFearGreedRenderer = 'native';
      bag.add(() => {
        if (homeFearGreed?.dataset.aioHomeFearGreedRenderer === 'native') delete homeFearGreed.dataset.aioHomeFearGreedRenderer;
        if (page?.dataset.aioArchitectureSlice === 'analysis') delete page.dataset.aioArchitectureSlice;
        if (route === 'signal' && page?.dataset.aioSignalRenderer === 'native') {
          delete page.dataset.aioSignalRenderer;
          delete page.dataset.aioArchitectureRenderer;
        }
        if (route === 'home' && page?.dataset.aioHomeRenderer === 'native') {
          delete page.dataset.aioHomeRenderer;
          delete page.dataset.aioArchitectureRenderer;
        }
      });
      return () => bag.dispose();
    }
  };
}
