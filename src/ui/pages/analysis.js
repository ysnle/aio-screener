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

// v59.75: the stock chart is a route-only chunk. Like createLazyPage (v57.55 S1-F14), a failed load (GitHub Pages 429, a
// chunk missing after a deploy) is retried twice with a growing pause; after that the section says so instead of
// keeping an empty canvas and 판정 대기. Only the import is caught: an error inside installStockChart still surfaces.
// The 시장 상태 board is the signal route's own code (src/app/bootstrap.js loads it with that route). The import edge stays
// in this lazy chunk: from the boot entry it re-split the shared chunks and added ~8 KB to the boot module set.
let regimeBoardModule = null;
export function loadRegimeBoard() {
  return (regimeBoardModule ||= import('../components/market-regime.js').catch((error) => { regimeBoardModule = null; throw error; }));
}

// Owner 2026-11-19: the stock chart and the 차트 tab's 시장 상태 one-line summary left this slice — the chart is the
// analysis slot on 기술적 분석 (src/ui/pages/charts.js), and `technical` is a derived view of that route.


// RM-01 (2026-07-19): home and technical secondary/chart surfaces remain compatibility
// boundaries. P785 transferred the technical market-health primary surface, P786 transferred
// the signal score/decision hero, and P787 transfers only the home score/decision summary.
// RSI/MACD/Weinstein/MTF/chart/narrative and home detail surfaces remain compatibility
// boundaries. P820 transferred the home Fear & Greed score and P821 transfers the quality
// meter as a fail-closed surface because the legacy implementation was incorrectly reusing
// the trading score under a different title. P822 transfers only the technical chart title/
// metadata; the canvas and indicator calculations remain compatibility-owned.
function setText(documentRef, id, value, color = null) {
  const element = documentRef?.getElementById(id);
  if (!element) return;
  element.textContent = value;
  if (color) element.style.color = color;
}

// P1392: the score hero, adjustment rows and home score summary were retired; the 시장 상태 board is rendered by
// ../components/market-regime.js, which the signal route's loader hands in (renderRegimePage), and the home hero by
// ../components/home-regime.js. A static import of the board put its whole tree (axis rows, radar, crossroads, guide,
// deep dives) in 오늘 and 차트 as well.

// T09/T11 (expert review 2026-10-13): the home score was the intraday value beside a close-based '전일 대비', its label
// banded the rounded value while the colour banded the raw one ('극단적 공포' vs the sentiment card's '극단 공포'), and
// greed used a hard-coded #b1f1cb (1.3:1 on ivory). The score is now the completed-close value (fgClose, computed by the
// caller from the shared series), banded once by fearGreedBand, coloured with theme tokens.
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
      // v57.78 perf: one market-input read per home render; the daily loop reuses the regime home just computed.
      const homeRegime = renderHomeRegime({ documentRef, root, store });
      renderDailyLoop({ documentRef, root, store, regime: homeRegime }); // P1432
      const history = root?._aioHistory || [];
      const basis = closeBasis(history);
      const fgClose = buildCloseSeries(history, 'fg', { through: basis }).at(-1) || null;
      // T09 + review: the close value counts only when it is aligned with the basis (same rule as the sentiment card);
      // a stalled F&G series shows as held, not as today's score.
      renderHomeFearGreed({ documentRef, sentimentValues, fgClose, fgStale: !!fgClose && !isUsable(alignInput(fgClose.date, basis)) });
      renderHomeVix({ documentRef, root }); // v58.91: moved from js/aio-data.js _aioRenderHomeVix
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
      // v57.50 I05: a research document that links here (#signal?metric=… / #technical?metric=…) names what the reader
      // came to check; the note leaves with the route.
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
