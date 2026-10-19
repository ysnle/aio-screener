import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderRegimePage, renderHomeRegime, readMarketRegime } from '../components/market-regime.js';
import { installStockChart } from '../components/stock-chart.js';
import { renderDailyLoop } from '../components/daily-loop.js';
import { renderKoreaParticipation } from '../components/korea-participation.js';
import { renderKrIndexTrends } from '../components/kr-index-trend.js';
import { alignInput, buildCloseSeries, closeBasis, isUsable } from '../../domain/briefing/market-read.js';
import { fearGreedBand } from '../../domain/sentiment/metrics.js';
import { renderKnowledgeArrival, clearKnowledgeArrival } from '../components/knowledge-arrival.js';

function finite(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

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

// P1392: the score hero, adjustment rows and home score summary were retired; the 시장 상태
// board and the home regime card are rendered by ../components/market-regime.js.

// T09/T11 (expert review 2026-10-13): the home score was the intraday value beside a close-based '전일 대비', its label
// banded the rounded value while the colour banded the raw one ('극단적 공포' vs the sentiment card's '극단 공포'), and
// greed used a hard-coded #86efac (1.3:1 on ivory). The score is now the completed-close value (fgClose, computed by the
// caller from the shared series), banded once by fearGreedBand, coloured with theme tokens.
const FEAR_GREED_COLOR = Object.freeze({ '극단 공포': 'var(--data-red)', '공포': 'var(--data-amber)', '중립': 'var(--text-muted)', '탐욕': 'var(--data-green)', '극단 탐욕': 'var(--data-green)' });
function renderHomeFearGreed({ documentRef, sentimentValues, fgClose = null, fgStale = false }) {
  const element = documentRef?.getElementById('home-fg-score');
  if (!element) return;
  const score = fgStale ? null : fgClose ? finite(fgClose.value) : finite(sentimentValues?.fearGreed);
  const band = score == null ? null : fearGreedBand(score);
  const known = band && !band.blocked;
  const label = documentRef?.getElementById('home-fg-label');
  if (label) label.textContent = known ? band.label : fgStale ? '오래됨' : '미수신';
  element.textContent = known ? String(Math.round(score)) : '—';
  element.style.color = known ? FEAR_GREED_COLOR[band.label] : 'var(--text-muted)';
  element.dataset.aioHomeFearGreedRenderer = 'native';
  element.setAttribute('data-source-kind', !known ? 'unavailable' : fgClose ? 'completed-close-history' : (sentimentValues?.fearGreedSourceKind || 'legacy-runtime'));
  element.setAttribute('data-source-label', !known ? 'sentiment unavailable' : fgClose ? 'completed-close history' : (sentimentValues?.fearGreedSource || 'sentiment state'));
  element.setAttribute('data-operational-use', 'reference-only');
  const observedAt = fgClose ? fgClose.date : sentimentValues?.fearGreedObservedAt;
  if (observedAt) element.setAttribute('data-observed-at', observedAt);
  else element.removeAttribute('data-observed-at');
}

// P1420 (owner decision 2026-10-02 extended): the technical page's 0-100 market-health score added
// and subtracted points for the day's SPY/QQQ move — the same kind of composite the 시장 상태 screen
// retired. The page now shows that screen's six-axis judgement (one source of truth) and leads with
// the stock chart. The legacy health writer stays fenced by the native renderer marker.
function renderTechnicalHealth({ documentRef, root }) {
  const regime = readMarketRegime(root, () => renderTechnicalHealth({ documentRef, root }));
  const overall = documentRef?.getElementById('tech-regime-overall');
  if (overall) { overall.textContent = regime.available ? regime.overall : '판정 대기'; overall.dataset.overall = regime.overall || ''; }
  const basis = documentRef?.getElementById('tech-regime-basis');
  if (basis) {
    const [, month, day] = String(regime.asOf || '').split('-').map(Number);
    const counts = regime.counts || {};
    basis.textContent = regime.available ? `${month}/${day} 미국 종가 기준 · 양호 ${counts.favorable ?? 0} · 중립 ${counts.neutral ?? 0} · 부담 ${counts.burden ?? 0}${counts.unknown ? ` · 확인 불가 ${counts.unknown}` : ''}` : '종가 기록을 불러오는 중입니다.';
  }
  const chips = documentRef?.getElementById('tech-regime-chips');
  if (chips) {
    // 2026-10-14 audit #4: the sentence above counts the six US axes, so the Korea FX reference (원·엔) is not a
    // seventh chip — it follows them as one muted reference line, outside the tally.
    const axes = regime.axes || [];
    const reference = axes.find((row) => row.id === 'korea');
    const referenceNode = reference ? documentRef.createElement('div') : null;
    if (referenceNode) {
      referenceNode.className = 'regime-chip-reference';
      referenceNode.title = '한국 참고 — 위 양호·중립·부담 합계에 넣지 않습니다';
      referenceNode.textContent = `참고 · 환율(원·엔) ${reference.stateLabel || '확인 불가'}`;
    }
    chips.replaceChildren(...axes.filter((row) => row.id !== 'korea').map((row) => {
      const chip = documentRef.createElement('div');
      chip.className = 'regime-chip';
      chip.dataset.state = row.state;
      const label = documentRef.createElement('span');
      label.className = 'regime-chip-label';
      label.textContent = row.title;
      const state = documentRef.createElement('span');
      state.className = `regime-state is-${row.state}`;
      state.textContent = row.stateLabel;
      chip.append(label, state);
      return chip;
    }), ...(referenceNode ? [referenceNode] : []));
  }
  documentRef?.getElementById('tech-regime-summary')?.setAttribute('data-aio-tech-regime-renderer', 'native');
}

function render({ root, documentRef, store, route }) {
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
    if (route === 'technical') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioTechnicalRenderer = 'native';
      renderTechnicalHealth({ documentRef, root });
      installStockChart({ documentRef, root }); // P1397: idempotent (installs once per #stock-chart-section, v57.76)
      renderKrIndexTrends({ documentRef, root }); // v57.77: 한국 지수 추세 cards (completed KRX closes; redraws only on a new close)
    }
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
    }
    if (route === 'signal') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioSignalRenderer = 'native';
      renderRegimePage({ documentRef, root, store });
      renderKoreaParticipation({ documentRef, root, store });
    }
  }
}

export function createAnalysisPage({ root = globalThis, documentRef, store, route = 'home' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ root, documentRef, store, route });
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
      const page = documentRef?.getElementById(`page-${route}`);
      // v57.50 I05: a research document that links here (#signal?metric=… / #technical?metric=…) names what the reader
      // came to check; the note leaves with the route.
      renderKnowledgeArrival({ documentRef, root, routeId: route });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: route }));
      let suppliedMaterialBridge = page?.querySelector?.(`[data-aio-supplied-material-route="${route}"]`) || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: route,
          heading: route === 'home' ? '홈 · 시장 확인과 거시 시차' : route === 'signal' ? '시장 상태 · 확인 증거와 리스크 과정' : '기술 · 가격 우선과 다중 시계열'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      const homeFearGreed = route === 'home' ? documentRef?.getElementById('home-fg-score') : null;
      if (homeFearGreed) homeFearGreed.dataset.aioHomeFearGreedRenderer = 'native';
      bag.add(() => {
        if (homeFearGreed?.dataset.aioHomeFearGreedRenderer === 'native') delete homeFearGreed.dataset.aioHomeFearGreedRenderer;
        if (page?.dataset.aioArchitectureSlice === 'analysis') delete page.dataset.aioArchitectureSlice;
        if (route === 'technical' && page?.dataset.aioTechnicalRenderer === 'native') {
          delete page.dataset.aioTechnicalRenderer;
          delete page.dataset.aioArchitectureRenderer;
        }
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
