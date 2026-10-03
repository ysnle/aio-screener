import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { normalizeChartBar } from '../../domain/chart/contract.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderRegimePage, renderHomeRegime, readMarketRegime } from '../components/market-regime.js';
import { installStockChart } from '../components/stock-chart.js';

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
  if (label) label.textContent = score == null ? '미수신' : score <= 25 ? '극단적 공포' : score <= 45 ? '공포' : score <= 55 ? '중립' : score <= 75 ? '탐욕' : '극단적 탐욕';
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

function renderTechnicalCandleMeta({ documentRef, technical }) {
  const title = documentRef?.getElementById('tech-candle-title');
  const meta = documentRef?.getElementById('tech-candle-meta');
  if (!title || !meta) return;
  const symbol = String(technical?.symbol || 'SPY').trim().toUpperCase() || 'SPY';
  const rows = (Array.isArray(technical?.ohlcv) ? technical.ohlcv : [])
    .filter((row) => row && row.time && finite(row.close) != null);
  const last = rows.at(-1);
  title.textContent = `${symbol} 일봉 캔들 · 이동평균`;
  meta.textContent = last
    ? `${last.time} 종가 ${finite(last.close).toFixed(2)} · 최근 ${Math.min(90, rows.length)}거래일`
    : '차트 데이터 수신 대기 · 네이티브 분석 입력 미수신';
  for (const element of [title, meta]) {
    element.dataset.aioTechnicalCandleMetaRenderer = 'native';
    element.setAttribute('data-source-kind', last ? 'legacy-runtime' : 'unavailable');
    element.setAttribute('data-operational-use', 'reference-only');
  }
}

function renderTechnicalCharts({ root, page, technical, charts }) {
  const priceCanvas = page?.querySelector('#tech-candle-chart');
  const volumeCanvas = page?.querySelector('#tech-candle-volume');
  if (!priceCanvas && !volumeCanvas) return;
  const rows = (Array.isArray(technical?.ohlcv) ? technical.ohlcv : [])
    .map(normalizeChartBar)
    .filter((row) => row && row.time && finite(row.close) != null)
    .slice(-90);
  const ChartConstructor = root?.Chart;
  const unavailable = rows.length < 2 || typeof ChartConstructor !== 'function';
  const signature = rows.map((row) => `${row.time}:${row.open}:${row.high}:${row.low}:${row.close}:${row.volume}`).join('|');
  const mark = (canvas, label) => {
    if (!canvas) return;
    canvas.dataset.aioTechnicalChartRenderer = 'native';
    canvas.dataset.sourceKind = unavailable ? 'unavailable' : 'native-runtime';
    canvas.dataset.sourceLabel = unavailable ? 'technical-history-unavailable' : 'native:technical-ohlcv';
    canvas.dataset.operationalUse = 'reference-only';
    canvas.setAttribute('title', label);
    canvas.__rendered = 'native';
  };
  if (unavailable) {
    charts.destroy('tech-candle-chart');
    charts.destroy('tech-candle-volume');
    mark(priceCanvas, '기술적 OHLCV 이력 미수신 · 차트 보류');
    mark(volumeCanvas, '거래량 이력 미수신 · 차트 보류');
    return;
  }
  if (charts.get('tech-candle-chart')?.signature === signature) {
    mark(priceCanvas, '기술적 OHLCV · native runtime');
    mark(volumeCanvas, '거래량 · native runtime');
    return;
  }
  charts.destroy('tech-candle-chart');
  charts.destroy('tech-candle-volume');
  try {
    const labels = rows.map((row) => String(row.time).slice(5));
    const closes = rows.map((row) => finite(row.close));
    const volume = rows.map((row) => finite(row.volume) || 0);
    const colors = rows.map((row) => finite(row.close) >= finite(row.open) ? 'rgba(34,117,76,0.82)' : 'rgba(177,58,48,0.82)');
    const priceChart = new ChartConstructor(priceCanvas, {
      type: 'line',
      data: { labels, datasets: [{ label: '종가', data: closes, borderColor: '#4aa3df', backgroundColor: 'rgba(74,163,223,0.12)', borderWidth: 1.8, pointRadius: 0, tension: 0.15, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4 } } } }
    });
    const volumeChart = volumeCanvas ? new ChartConstructor(volumeCanvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: '거래량', data: volume, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    }) : null;
    charts.set('tech-candle-chart', { chart: priceChart, signature });
    if (volumeChart) charts.set('tech-candle-volume', { chart: volumeChart, signature });
    mark(priceCanvas, '기술적 OHLCV · native runtime');
    mark(volumeCanvas, '거래량 · native runtime');
  } catch (_) {
    charts.destroy('tech-candle-chart');
    charts.destroy('tech-candle-volume');
    mark(priceCanvas, '기술적 차트 런타임 실패 · 차트 보류');
    mark(volumeCanvas, '거래량 차트 런타임 실패 · 차트 보류');
  }
}

function render({ root, documentRef, store, route, charts }) {
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
      page.dataset.aioTechnicalChartRenderer = 'native';
      renderTechnicalHealth({ documentRef, root });
      renderTechnicalCandleMeta({ documentRef, technical });
      renderTechnicalCharts({ root, page, technical, charts });
      installStockChart({ documentRef, root }); // P1397: idempotent (installs once per form)
    }
    if (route === 'home') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioHomeRenderer = 'native';
      renderHomeRegime({ documentRef, root });
      renderHomeFearGreed({ documentRef, sentimentValues });
      renderHomeQuality({ documentRef, home });
    }
    if (route === 'signal') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioSignalRenderer = 'native';
      renderRegimePage({ documentRef, root });
    }
  }
}

export function createAnalysisPage({ root = globalThis, documentRef, store, route = 'home' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 480 });
      bag.add(charts.dispose);
      const renderNow = () => render({ root, documentRef, store, route, charts });
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
      const technicalCandleMeta = route === 'technical'
        ? [documentRef?.getElementById('tech-candle-title'), documentRef?.getElementById('tech-candle-meta')]
        : [];
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
      technicalCandleMeta.forEach((element) => {
        if (element) element.dataset.aioTechnicalCandleMetaRenderer = 'native';
      });
      bag.add(() => {
        if (route === 'technical') {
          [documentRef?.getElementById('tech-candle-chart'), documentRef?.getElementById('tech-candle-volume')].forEach((canvas) => {
            if (canvas?.dataset.aioTechnicalChartRenderer === 'native') delete canvas.dataset.aioTechnicalChartRenderer;
            if (canvas) { delete canvas.dataset.sourceKind; delete canvas.dataset.sourceLabel; delete canvas.dataset.operationalUse; delete canvas.__rendered; }
          });
        }
        if (homeFearGreed?.dataset.aioHomeFearGreedRenderer === 'native') delete homeFearGreed.dataset.aioHomeFearGreedRenderer;
        homeQuality.forEach((element) => {
          if (element?.dataset.aioHomeQualityRenderer === 'native') delete element.dataset.aioHomeQualityRenderer;
          if (element) {
            element.removeAttribute('data-source-kind');
            element.removeAttribute('data-operational-use');
          }
        });
        technicalCandleMeta.forEach((element) => {
          if (element?.dataset.aioTechnicalCandleMetaRenderer === 'native') delete element.dataset.aioTechnicalCandleMetaRenderer;
          if (element) {
            element.removeAttribute('data-source-kind');
            element.removeAttribute('data-operational-use');
          }
        });
        if (page?.dataset.aioArchitectureSlice === 'analysis') delete page.dataset.aioArchitectureSlice;
        if (route === 'technical' && page?.dataset.aioTechnicalRenderer === 'native') {
          delete page.dataset.aioTechnicalRenderer;
          if (page.dataset.aioTechnicalChartRenderer === 'native') delete page.dataset.aioTechnicalChartRenderer;
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
