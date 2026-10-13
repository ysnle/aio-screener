import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderRegimePage, renderHomeRegime, readMarketRegime } from '../components/market-regime.js';
import { installStockChart } from '../components/stock-chart.js';
import { renderDailyLoop } from '../components/daily-loop.js';
import { renderKoreaParticipation } from '../components/korea-participation.js';

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

function renderHomeFearGreed({ documentRef, sentimentValues }) {
  const element = documentRef?.getElementById('home-fg-score');
  if (!element) return;
  const score = finite(sentimentValues?.fearGreed);
  const label = documentRef?.getElementById('home-fg-label');
  if (label) label.textContent = score == null ? '미수신' : Math.round(score) < 25 ? '극단적 공포' : Math.round(score) < 45 ? '공포' : Math.round(score) <= 55 ? '중립' : Math.round(score) <= 75 ? '탐욕' : '극단적 탐욕';
  element.textContent = score == null ? '—' : String(Math.round(score));
  element.style.color = score == null
    ? 'var(--text-muted)'
    : score <= 25 ? 'var(--data-red)' : score <= 45 ? 'var(--data-amber)' : score <= 55 ? 'var(--text-muted)' : score <= 75 ? '#86efac' : 'var(--data-green)';
  element.dataset.aioHomeFearGreedRenderer = 'native';
  element.setAttribute('data-source-kind', score == null ? 'unavailable' : (sentimentValues?.fearGreedSourceKind || 'legacy-runtime'));
  element.setAttribute('data-source-label', score == null ? 'sentiment unavailable' : (sentimentValues?.fearGreedSource || 'sentiment state'));
  element.setAttribute('data-operational-use', 'reference-only');
  if (sentimentValues?.fearGreedObservedAt) element.setAttribute('data-observed-at', sentimentValues.fearGreedObservedAt);
  else element.removeAttribute('data-observed-at');
}

function renderHomeQuality({ documentRef, home }) {
  const meter = documentRef?.getElementById('home-quality-meter');
  const scoreElement = documentRef?.getElementById('home-quality-score');
  const labelElement = documentRef?.getElementById('home-quality-label');
  if (!meter || !scoreElement) return;
  const quality = home?.quality;
  const score = finite(quality?.score);
  const available = quality?.modelVersion && score != null;
  const color = !available
    ? 'var(--text-muted)'
    : score >= 75 ? 'var(--data-green)' : score >= 55 ? '#86efac' : score >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
  scoreElement.textContent = available ? String(Math.round(score)) : '—';
  scoreElement.style.color = color;
  const fill = meter.querySelector('div');
  if (fill) {
    fill.style.width = available ? `${Math.max(0, Math.min(100, score))}%` : '0%';
    fill.style.background = available ? color : 'var(--border-strong)';
  }
  if (labelElement) {
    labelElement.textContent = available ? (quality.label || '시장 품질') : '판정 보류 · 시장폭 종합 입력 대기';
    labelElement.style.color = color;
  }
  for (const element of [meter, scoreElement, labelElement]) {
    if (element) {
      element.dataset.aioHomeQualityRenderer = 'native';
      element.setAttribute('data-source-kind', available ? (quality.sourceKind || 'legacy-runtime') : 'unavailable');
      element.setAttribute('data-operational-use', 'reference-only');
    }
  }
}

// P1420 (owner decision 2026-10-02 extended): the technical page's 0-100 market-health score added
// and subtracted points for the day's SPY/QQQ move — the same kind of composite the 시장 상태 screen
// retired. The page now shows that screen's six-axis judgement (one source of truth) and leads with
// the stock chart. The legacy health writer stays fenced by the native renderer marker.
function renderTechnicalHealth({ documentRef, root }) {
  const regime = readMarketRegime(root);
  const overall = documentRef?.getElementById('tech-regime-overall');
  if (overall) { overall.textContent = regime.available ? regime.overall : '판정 대기'; overall.dataset.overall = regime.overall || ''; }
  const basis = documentRef?.getElementById('tech-regime-basis');
  if (basis) {
    const [, month, day] = String(regime.asOf || '').split('-').map(Number);
    const counts = regime.counts || {};
    basis.textContent = regime.available ? `${month}/${day} 미국 종가 기준 · 우호 ${counts.favorable ?? 0} · 중립 ${counts.neutral ?? 0} · 부담 ${counts.burden ?? 0}${counts.unknown ? ` · 확인 불가 ${counts.unknown}` : ''}` : '종가 기록을 불러오는 중입니다.';
  }
  const chips = documentRef?.getElementById('tech-regime-chips');
  if (chips) {
    chips.replaceChildren(...(regime.axes || []).map((row) => {
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
    }));
  }
  const pill = documentRef?.getElementById('tech-health-pill');
  if (pill) pill.textContent = regime.available ? `시장 상태 · ${regime.overall}` : '시장 상태 판정 대기';
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
      installStockChart({ documentRef, root }); // P1397: idempotent (installs once per form)
    }
    if (route === 'home') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioHomeRenderer = 'native';
      renderHomeRegime({ documentRef, root });
      renderDailyLoop({ documentRef, root, store }); // P1432
      renderHomeFearGreed({ documentRef, sentimentValues });
      renderHomeQuality({ documentRef, home });
    }
    if (route === 'signal') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioSignalRenderer = 'native';
      renderRegimePage({ documentRef, root });
      renderKoreaParticipation({ documentRef, root });
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
      let suppliedMaterialBridge = page?.querySelector?.(`[data-aio-supplied-material-route="${route}"]`) || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: route,
          heading: route === 'home' ? '홈 · 시장 확인과 거시 시차' : route === 'signal' ? '시그널 · 확인 증거와 리스크 과정' : '기술 · 가격 우선과 다중 시계열'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      const homeFearGreed = route === 'home' ? documentRef?.getElementById('home-fg-score') : null;
      const homeQuality = route === 'home'
        ? [
            documentRef?.getElementById('home-quality-meter'),
            documentRef?.getElementById('home-quality-score'),
            documentRef?.getElementById('home-quality-label')
          ]
        : [];
      if (homeFearGreed) homeFearGreed.dataset.aioHomeFearGreedRenderer = 'native';
      homeQuality.forEach((element) => {
        if (element) element.dataset.aioHomeQualityRenderer = 'native';
      });
      bag.add(() => {
        if (homeFearGreed?.dataset.aioHomeFearGreedRenderer === 'native') delete homeFearGreed.dataset.aioHomeFearGreedRenderer;
        homeQuality.forEach((element) => {
          if (element?.dataset.aioHomeQualityRenderer === 'native') delete element.dataset.aioHomeQualityRenderer;
          if (element) {
            element.removeAttribute('data-source-kind');
            element.removeAttribute('data-operational-use');
          }
        });
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
