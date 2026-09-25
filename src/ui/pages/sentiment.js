import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { deriveSentimentSummary } from '../../domain/sentiment/metrics.js';
import { deriveSentimentViewModel, putCallNeedlePosition } from '../../domain/sentiment/narrative.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';
import { subscribeToSlice } from '../../state/memoize.js';
import { renderSentimentSummaryProjection } from '../projections/sentiment-summary.js';

const SENTIMENT_CANVAS_IDS = Object.freeze([
  'vix-term-chart', 'vix-chart', 'naaim-chart', 'ii-chart', 'hy-chart',
  'aaii-chart', 'pc-chart', 'news-sentiment-chart'
]);

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatNumber(value, digits = 1, suffix = '') {
  const number = finite(value);
  return number == null ? '—' : `${number.toFixed(digits)}${suffix}`;
}

function badgePresentation(summary) {
  const band = summary?.fearGreed;
  if (summary?.blocked || !band || band.blocked) return { text: '심리: 판정 보류', className: 'status-pill sp-neutral' };
  if (band.label === '극단 탐욕' || band.label === '탐욕') return { text: `심리: ${band.label}`, className: 'status-pill sp-risk-on' };
  if (band.label === '극단 공포' || band.label === '공포') return { text: `심리: ${band.label}`, className: 'status-pill sp-risk-off' };
  return { text: `심리: ${band.label}`, className: 'status-pill sp-neutral' };
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

// Hidden cross-page score sinks still need the canonical state immediately;
// the full sentiment route renderer remains responsible for the active page.
// RM-01 (2026-07-19): home-fg-score is excluded here — js/aio-data.js:16609 is a live legacy
// writer for that id (home page hero), so writing it from sentiment's cross-page projection is a
// contested double-write (F-09/route-owners.json openItems). fg-score-big/fg-score-val/
// fg-rating-text/vix-term-regime-text remain native-only: they live on the sentiment page itself
// and no active legacy code writes them (the only other candidate, index.html's
// _generateSentimentAnalysis/_updateSentimentActionGuides, only reads them and has zero callers).
function setAttribute(element, name, value) {
  if (!element) return;
  if (value == null || value === '') element.removeAttribute(name);
  else element.setAttribute(name, String(value));
}

function annotate(element, evidence) {
  if (!element) return;
  setAttribute(element, 'data-aio-evidence-id', evidence?.evidenceId);
  setAttribute(element, 'data-aio-allowed-use', evidence?.allowedUse);
  setAttribute(element, 'data-source-kind', evidence?.sourceKind);
  setAttribute(element, 'data-operational-use', evidence?.allowedUse === 'decision' ? 'decision' : evidence?.allowedUse === 'none' ? 'blocked' : 'reference-only');
}

function setMetric(documentRef, selector, value, evidence, digits = 1, suffix = '') {
  const element = documentRef?.querySelector?.(selector);
  if (!element) return;
  element.textContent = formatNumber(value, digits, suffix);
  annotate(element, evidence);
}

function drawFallback(canvas, values, label) {
  if (!canvas) return false;
  const finiteValues = (values || []).map(finite).filter((value) => value !== null);
  canvas.dataset.sourceKind = finiteValues.length ? 'legacy-projection' : 'unavailable';
  canvas.dataset.operationalUse = finiteValues.length ? 'reference-only' : 'blocked';
  canvas.dataset.aioRenderer = 'sentiment';
  if (!finiteValues.length) {
    canvas.title = `${label} 관측 시계열 미수신 — 차트 판정 보류`;
    return false;
  }
  const width = Math.max(260, canvas.clientWidth || 300);
  const height = Math.max(80, canvas.clientHeight || 120);
  const dpr = canvas.ownerDocument?.defaultView?.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext?.('2d');
  if (!context) return false;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const span = max === min ? 1 : max - min;
  const pad = { left: 24, right: 8, top: 12, bottom: 18 };
  const plotWidth = Math.max(1, width - pad.left - pad.right);
  const plotHeight = Math.max(1, height - pad.top - pad.bottom);
  context.strokeStyle = 'rgba(148,163,184,0.24)';
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = pad.top + (plotHeight * index) / 3;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
  }
  context.strokeStyle = '#ffa31a';
  context.lineWidth = 1.8;
  context.beginPath();
  finiteValues.forEach((value, index) => {
    const x = pad.left + (finiteValues.length === 1 ? plotWidth / 2 : (index / (finiteValues.length - 1)) * plotWidth);
    const y = pad.top + ((max - value) / span) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = 'rgba(226,232,240,0.72)';
  context.font = '10px JetBrains Mono, monospace';
  context.fillText(label, pad.left, 10);
  return true;
}

function createChart({ canvas, values, labels, chartFactory, charts, bag, label }) {
  if (!canvas) return;
  const validValues = (values || []).map(finite).filter((value) => value !== null);
  const existing = charts.get(canvas.id);
  if (!validValues.length) {
    existing?.destroy?.();
    charts.delete(canvas.id);
    drawFallback(canvas, [], label);
    return;
  }
  if (existing) {
    if (!existing.data || !Array.isArray(existing.data.datasets) || !existing.data.datasets[0]) {
      try { existing.destroy?.(); } catch (_) {}
      charts.delete(canvas.id);
      drawFallback(canvas, validValues, label);
      return;
    }
    existing.data.labels = labels;
    existing.data.datasets[0].data = validValues;
    existing.update?.('none');
    return;
  }
  const ChartConstructor = typeof chartFactory === 'function' ? chartFactory() : chartFactory;
  if (typeof ChartConstructor !== 'function') {
    drawFallback(canvas, validValues, label);
    return;
  }
  let chart;
  try {
    chart = new ChartConstructor(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label, data: validValues, borderColor: '#ffa31a', borderWidth: 1.8, pointRadius: 0, tension: 0.25, fill: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  } catch (_) {
    drawFallback(canvas, validValues, label);
    return;
  }
  charts.set(canvas.id, chart);
  bag.add(() => {
    if (charts.get(canvas.id) !== chart) return;
    try { chart.destroy?.(); } catch (_) {}
    charts.delete(canvas.id);
  });
}

function renderNeedle(documentRef, score) {
  const needle = documentRef?.getElementById('fg-needle');
  const normalized = finite(score);
  if (!needle) return;
  if (normalized == null) {
    needle.removeAttribute('x2');
    needle.removeAttribute('y2');
    needle.hidden = true;
    needle.setAttribute('aria-hidden', 'true');
    return;
  }
  needle.hidden = false;
  needle.removeAttribute('aria-hidden');
  const angle = Math.PI - (Math.max(0, Math.min(100, normalized)) / 100) * Math.PI;
  needle.setAttribute('x2', String(120 + Math.cos(angle) * 80));
  needle.setAttribute('y2', String(120 - Math.sin(angle) * 80));
}

function renderCanvasStates(documentRef, state, chartFactory, charts, bag) {
  const history = Array.isArray(state.vixHistory) ? state.vixHistory.slice(-30) : [];
  createChart({
    canvas: documentRef?.getElementById('vix-chart'),
    values: history.map((point) => point?.value),
    labels: history.map((point) => String(point?.date || '').slice(5).replace('-', '/')),
    chartFactory, charts, bag, label: 'VIX'
  });
  const termValues = [state.vix9d, state.vix, state.vix3m, state.vix6m];
  createChart({
    canvas: documentRef?.getElementById('vix-term-chart'),
    values: termValues,
    labels: ['VIX9D', 'VIX', 'VIX3M', 'VIX6M'],
    chartFactory, charts, bag, label: 'VIX 기간구조'
  });
  SENTIMENT_CANVAS_IDS.filter((id) => !['vix-chart', 'vix-term-chart'].includes(id)).forEach((id) => {
    const canvas = documentRef?.getElementById(id);
    if (!canvas) return;
    canvas.dataset.sourceKind = 'unavailable';
    canvas.dataset.operationalUse = 'blocked';
    canvas.dataset.aioRenderer = 'sentiment';
    canvas.title = `${canvas.getAttribute('aria-label') || id} 관측 시계열 미수신 — 차트 판정 보류`;
  });
}

function renderSentiment(documentRef, state, evidenceStore, chartFactory, charts, bag) {
  const sentiment = state || {};
  const summary = deriveSentimentSummary(sentiment);
  renderSentimentSummaryProjection(documentRef, summary);
  const getEvidence = (metric) => evidenceStore?.get?.(metric) || null;
  const viewModel = deriveSentimentViewModel({
    values: sentiment,
    evidenceByMetric: { fearGreed: getEvidence('fearGreed'), vix: getEvidence('vix'), putCall: getEvidence('putCall') },
    revision: state?.revision || null,
    now: sentiment?.now || null
  });
  const badge = documentRef?.getElementById('sent-overall-badge');
  const presentation = badgePresentation(summary);
  if (badge) {
    badge.textContent = presentation.text;
    badge.className = presentation.className;
    badge.dataset.aioArchitectureState = summary.blocked ? 'blocked' : 'observed';
    annotate(badge, getEvidence('fearGreed'));
  }
  const root = documentRef?.getElementById('page-sentiment');
  if (root) root.dataset.aioArchitectureState = summary.blocked ? 'blocked' : 'observed';

  const fg = summary.fearGreed;
  setText(documentRef, 'fg-h1', fg.blocked ? '판정 보류' : `${fg.label} 구간`);
  setText(documentRef, 'fg-score-big', formatNumber(fg.score, 0));
  setText(documentRef, 'fg-score-val', formatNumber(fg.score, 0));
  setText(documentRef, 'fg-rating-text', fg.label);
  const fgLiveBadge = setText(documentRef, 'fg-live-badge', getEvidence('fearGreed')?.allowedUse === 'decision' ? '● 현재 관측' : '● 참고값 · 판정 제외');
  annotate(fgLiveBadge, getEvidence('fearGreed'));
  renderNeedle(documentRef, fg.score);

  setMetric(documentRef, '[data-live-price="^VIX9D"]', sentiment.vix9d, getEvidence('vix9d'));
  const vixElement = setMetric(documentRef, '#vix-live-val', sentiment.vix, getEvidence('vix'), 1);
  setText(documentRef, 'vix-live-label', getEvidence('vix')?.allowedUse === 'decision' ? '현재 관측' : '참고값');
  setMetric(documentRef, '[data-live-price="^VIX3M"]', sentiment.vix3m, getEvidence('vix3m'));
  setMetric(documentRef, '[data-live-price="^VIX6M"]', sentiment.vix6m, getEvidence('vix6m'));
  const skew = sentiment.skew || {};
  const skewValue = setText(documentRef, 'sent-skew-value', formatNumber(skew.value, 2));
  const skewMeta = setText(documentRef, 'sent-skew-meta', finite(skew.value) == null
    ? '현재 원천 미수신 · 판정 보류'
    : `${String(skew.observedAt || '관측일 미확인').replace('T', ' ').replace(/\.000Z$|Z$/, ' UTC')} · ${skew.source || '출처 미확인'} · 참고용`);
  // LC-63: 변화량도 본값과 같은 read model에서 나온다 — 본값/비교값 어느 하나가 부적격이면
  // 변화량도 함께 보류한다(별도 legacy quote sink가 결측 옆에 변화량을 남기던 경로 퇴역).
  const skewChange = setText(documentRef, 'sent-skew-change',
    finite(skew.value) == null
      ? '변화량 보류 — 본값 미수신'
      : skew.directionValue == null
        ? `변화량 보류 — ${skew.directionReason === 'quote-change-missing' ? '비교값 미수신' : '비교 근거 미확인'}`
        : skew.directionCompatible === false
          ? '변화량 보류 — 비교 기준 미상'
          : `전일 대비 ${skew.directionValue >= 0 ? '+' : ''}${formatNumber(skew.directionValue, 2)}%`);
  [skewValue, skewMeta, skewChange].forEach((element) => {
    if (!element) return;
    element.dataset.aioSentimentSkewRenderer = 'native';
    element.setAttribute('data-metric-id', skew.metricId || 'market.volatility.skew');
    element.setAttribute('data-instrument-id', skew.instrumentId || '^SKEW');
    element.setAttribute('data-unit', skew.unit || 'index');
    element.setAttribute('data-observed-at', skew.observedAt || '');
    element.setAttribute('data-revision', skew.revisionId || '');
    element.setAttribute('data-source-kind', skew.sourceKind || 'unavailable');
    element.setAttribute('data-source-label', skew.source || 'unavailable');
    element.setAttribute('data-operational-use', 'reference-only');
  });
  if (vixElement) annotate(vixElement, getEvidence('vix'));
  setText(documentRef, 'vix-term-regime-text', summary.vixTermStructure.regime);
  const regime = documentRef?.getElementById('vix-term-regime');
  annotate(regime, getEvidence('vix'));

  const hyEvidence = getEvidence('hySpread');
  const hyValue = setText(documentRef, 'hy-live-val', formatNumber(sentiment.hySpread, 0, 'bp'));
  const hyDate = setText(documentRef, 'hy-live-date', sentiment.hySpreadDate || (hyEvidence?.observedAt ? String(hyEvidence.observedAt).slice(0, 10) : 'FRED 관측값 수신 대기'));
  const hyBadge = setText(documentRef, 'hy-live-badge', hyEvidence?.allowedUse === 'decision' ? 'FRED 현재 관측' : '판정 보류');
  const hySignal = setText(documentRef, 'hy-signal-badge', finite(sentiment.hySpread) == null ? '현재 OAS 미수신' : sentiment.hySpread > 400 ? '주의' : '참고');
  [hyValue, hyDate, hyBadge, hySignal].forEach((element) => annotate(element, hyEvidence));

  const aaiiBearEvidence = getEvidence('aaiiBear');
  const aaiiBullEvidence = getEvidence('aaiiBull');
  const aaiiBear = setText(documentRef, 'aaii-bear-val', formatNumber(sentiment.aaiiBear, 1, '%'));
  const aaiiBull = setText(documentRef, 'aaii-bull-val', formatNumber(sentiment.aaiiBull, 1, '%'));
  annotate(aaiiBear, aaiiBearEvidence);
  annotate(aaiiBull, aaiiBullEvidence);
  setText(documentRef, 'aaii-date-label', aaiiBearEvidence?.observedAt ? `AAII 주간 · ${String(aaiiBearEvidence.observedAt).slice(0, 10)} · 현재 판정 제외` : 'AAII 주간 · 현재 공식 원천 미수신 · 판단 제외');

  const pcEvidence = getEvidence('putCall');
  const pcMetric = viewModel.metrics.find((row) => row.metricId === 'putCall');
  const pcScore = setText(documentRef, 'pc-score-big', formatNumber(pcMetric?.value, 2));
  const pcPosition = setText(documentRef, 'pc-needle-pos', putCallNeedlePosition(pcMetric?.value));
  const pcBadge = setText(documentRef, 'pc-live-badge', pcEvidence?.allowedUse === 'decision' ? '● 현재 관측' : '● 참고값 · 판정 제외');
  [pcScore, pcPosition, pcBadge].forEach((element) => annotate(element, pcEvidence));

  const analysis = documentRef?.getElementById('sent-analysis-text');
  if (analysis) {
    const lines = viewModel.narratives.map((row) => row.text).filter(Boolean);
    const next = lines.length ? lines.join(' ') : '심리 지표 수신 대기...';
    if (analysis.textContent !== next) analysis.textContent = next;
    analysis.dataset.aioSentimentNarrativeRenderer = 'native';
    analysis.dataset.aioSentimentRevision = viewModel.revision;
    analysis.dataset.sourceKind = viewModel.narratives.every((row) => row.status === 'withheld') ? 'unavailable' : 'sentiment-view-model';
    analysis.dataset.operationalUse = 'reference-only';
  }

  // W01-B: sent-analysis-text is owned here from one ViewModel revision.
  // The legacy writer and its deferred timers were retired in the same change.
  renderCanvasStates(documentRef, sentiment, chartFactory, charts, bag);
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
