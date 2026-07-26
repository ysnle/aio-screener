import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';

function finite(value) {
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
function scoreColor(score) {
  if (score >= 65) return 'var(--data-green)';
  if (score >= 50) return 'var(--data-amber)';
  if (score >= 35) return '#57513f';
  return 'var(--data-red)';
}

function setText(documentRef, id, value, color = null) {
  const element = documentRef?.getElementById(id);
  if (!element) return;
  element.textContent = value;
  if (color) element.style.color = color;
}

function setBar(documentRef, id, width, color) {
  const element = documentRef?.getElementById(id);
  if (!element) return;
  element.style.width = `${Math.max(0, Math.min(100, Number(width) || 0))}%`;
  element.style.background = color;
}

function renderSignalDecision({ documentRef, signal }) {
  const presentation = signal?.presentation;
  if (!presentation?.modelVersion) {
    setText(documentRef, 'score-gauge-val', '—', 'var(--text-muted)');
    setText(documentRef, 'score-decision-badge', '판정 보류 — 입력 대기', 'var(--text-muted)');
    setText(documentRef, 'score-decision-sub', '시장 환경 입력 수신 후 판정을 표시합니다.', 'var(--text-muted)');
    return;
  }
  const scoreColor = presentation.status === 'blocked'
    ? 'var(--text-muted)'
    : presentation.action === 'WATCH'
      ? 'var(--data-green)'
      : presentation.action === 'REDUCE'
        ? 'var(--data-red)'
        : 'var(--data-amber)';
  setText(documentRef, 'score-gauge-val', presentation.displayScore, scoreColor);
  setText(documentRef, 'score-decision-badge', presentation.decision, scoreColor);
  setText(documentRef, 'score-decision-sub', presentation.description, 'var(--text-secondary)');
}

function renderHomeSummary({ documentRef, signal }) {
  const presentation = signal?.presentation;
  if (!presentation?.modelVersion) {
    setText(documentRef, 'home-hero-total', '—', 'var(--text-muted)');
    setText(documentRef, 'home-hero-headline', '판정 보류 — 입력 대기', 'var(--text-muted)');
    setText(documentRef, 'home-hero-desc', '시장 환경 입력 수신 후 판정을 표시합니다.', 'var(--text-muted)');
    setText(documentRef, 'home-trading-signal', '판정 보류 — 입력 대기', 'var(--text-muted)');
    return;
  }
  const color = presentation.status === 'blocked'
    ? 'var(--text-muted)'
    : presentation.action === 'WATCH'
      ? 'var(--data-green)'
      : presentation.action === 'REDUCE'
        ? 'var(--data-red)'
        : 'var(--data-amber)';
  setText(documentRef, 'home-hero-total', presentation.displayScore, color);
  setText(documentRef, 'home-hero-headline', presentation.decision, color);
  setText(documentRef, 'home-hero-desc', presentation.description, 'var(--text-secondary)');
  setText(documentRef, 'home-trading-signal', presentation.decision, color);
}

function renderHomeFearGreed({ documentRef, sentimentValues }) {
  const element = documentRef?.getElementById('home-fg-score');
  if (!element) return;
  const score = finite(sentimentValues?.fearGreed);
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

function renderTechnicalHealth({ documentRef, technical }) {
  const health = technical?.health;
  if (!health?.available) {
    setText(documentRef, 'health-score-display', '—', 'var(--text-muted)');
    setText(documentRef, 'health-grade-display', '판정 보류', 'var(--text-muted)');
    setText(documentRef, 'health-regime-display', '필수 현재값 미수신', 'var(--text-muted)');
    setText(documentRef, 'tech-health-pill', '시장 건강도 판정 보류');
    setBar(documentRef, 'hc-spy-bar', 50, 'var(--border-strong)');
    setBar(documentRef, 'hc-qqq-bar', 50, 'var(--border-strong)');
    setBar(documentRef, 'hc-vix-bar', 0, 'var(--border-strong)');
    setBar(documentRef, 'ind-pressure-fill', 0, 'var(--border-strong)');
    setBar(documentRef, 'ind-buyrisk-fill', 0, 'var(--border-strong)');
    setBar(documentRef, 'ind-trend-fill', 50, 'var(--border-strong)');
    const interpretation = documentRef?.getElementById('health-interpretation');
    if (interpretation) {
      interpretation.replaceChildren();
      const title = documentRef.createElement('div');
      title.className = 'dc-title';
      title.textContent = '시장 건강도 판정 보류';
      const body = documentRef.createElement('div');
      body.style.cssText = 'font-size:12px;color:var(--text-muted);line-height:1.7;';
      body.textContent = `필수 현재 입력 미수신: ${(health?.missing || []).join(', ') || '시장 건강도 입력'}. 결측값을 0%·중립값으로 대체하지 않습니다.`;
      interpretation.append(title, body);
    }
    return;
  }

  const color = scoreColor(health.score);
  setText(documentRef, 'health-score-display', health.score, color);
  setText(documentRef, 'health-grade-display', health.grade, color);
  setText(documentRef, 'health-regime-display', health.regime, color);
  setText(documentRef, 'tech-health-pill', `${health.grade} ${health.regime}`);
  setBar(documentRef, 'hc-spy-bar', health.bars.spy, health.inputs.spyPct >= 0 ? 'var(--data-green)' : 'var(--data-red)');
  setBar(documentRef, 'hc-qqq-bar', health.bars.qqq, health.inputs.qqqPct >= 0 ? 'var(--data-green)' : 'var(--data-red)');
  setBar(documentRef, 'hc-vix-bar', health.bars.vix, health.inputs.vix < 20 ? 'var(--data-green)' : health.inputs.vix < 25 ? 'var(--data-amber)' : 'var(--data-red)');
  setBar(documentRef, 'ind-pressure-fill', health.bars.pressure, health.inputs.vix < 20 ? 'var(--data-green)' : health.inputs.vix < 25 ? 'var(--data-amber)' : 'var(--data-red)');
  setBar(documentRef, 'ind-buyrisk-fill', health.bars.buyRisk, health.bars.buyRisk > 60 ? 'var(--data-green)' : health.bars.buyRisk > 40 ? 'var(--data-amber)' : 'var(--data-red)');
  setBar(documentRef, 'ind-trend-fill', health.bars.trend, health.bars.trend >= 70 ? 'var(--data-cyan)' : health.bars.trend >= 50 ? 'var(--data-amber)' : 'var(--data-red)');
  const interpretation = documentRef?.getElementById('health-interpretation');
  if (!interpretation) return;
  interpretation.replaceChildren();
  const title = documentRef.createElement('div');
  title.className = 'dc-title';
  title.textContent = '시장 건강 진단 결과';
  const body = documentRef.createElement('div');
  body.style.cssText = 'font-size:12px;color:var(--text-secondary);line-height:1.7;';
  const evidence = health.details.length ? ` · ${health.details.join(' · ')}` : '';
  const strategy = health.score >= 65
    ? '전략: 기술 환경은 우호적입니다. 단독 매수 신호가 아니며 종합 시그널과 시장폭 확산 확인 후 분할 접근.'
    : health.score >= 40
      ? '전략: 선별적 매매. 섹터 로테이션과 종합 시그널을 확인하고 포지션 사이즈 축소를 고려합니다.'
      : '전략: 방어적 자세. 현금비중 확대와 타이트한 손절을 우선합니다.';
  body.textContent = `점수 ${health.score}/100 (${health.grade}) — ${health.regime}${evidence}\n\n${strategy}`;
  interpretation.append(title, body);
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

function render({ documentRef, store, route }) {
  const technical = selectTechnical(store.getState());
  const signal = selectSignal(store.getState());
  const home = selectHomeSummary(store.getState());
  const sentimentValues = selectSentimentValues(store.getState());
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureSlice = 'analysis';
    page.dataset.aioArchitectureStatus = (route === 'home' ? home?.status : route === 'signal' ? signal?.status : technical?.status) || 'unavailable';
    if (route === 'technical') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioTechnicalRenderer = 'native';
      renderTechnicalHealth({ documentRef, technical });
      renderTechnicalCandleMeta({ documentRef, technical });
    }
    if (route === 'home') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioHomeRenderer = 'native';
      renderHomeSummary({ documentRef, signal });
      renderHomeFearGreed({ documentRef, sentimentValues });
      renderHomeQuality({ documentRef, home });
    }
    if (route === 'signal') {
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioSignalRenderer = 'native';
      renderSignalDecision({ documentRef, signal });
    }
  }
}

export function createAnalysisPage({ documentRef, store, route = 'home' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store, route });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      eventTarget?.addEventListener?.('aio:refresh:done', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', renderNow));
      const page = documentRef?.getElementById(`page-${route}`);
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
