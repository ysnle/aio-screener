import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { selectEntityState } from '../../state/selectors/entity.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { deriveSecReport } from '../../domain/fundamental/sec-report.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function renderTickerHero(documentRef, state) {
  const id = state?.id || null;
  const quote = state?.quote || {};
  const price = finite(quote.value);
  const pct = finite(quote.pct);
  setText(documentRef, 'ticker-hero-name', id || '—');
  setText(documentRef, 'ticker-hero-fullname', id ? (state?.name || id) : '종목을 검색하세요');
  setText(documentRef, 'ticker-hero-price', price == null ? '—' : `$${price.toFixed(2)}`);
  const change = setText(documentRef, 'ticker-hero-chg', pct == null ? '—' : `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(2)}%`);
  if (change) change.className = `ticker-chg-big ${pct == null ? '' : pct >= 0 ? 'up' : 'down'}`;
}

function renderTickerSecondarySymbols(documentRef, state) {
  const symbol = state?.id || '—';
  ['ticker-candle-symbol', 'ticker-entry-symbol'].forEach((id) => {
    const element = setText(documentRef, id, symbol);
    if (!element) return;
    element.dataset.aioTickerSymbolRenderer = 'native';
    element.setAttribute('data-source-kind', state?.id ? 'entity-state' : 'unavailable');
    element.setAttribute('data-source-label', state?.id ? 'normalized entity state' : 'entity unavailable');
    element.setAttribute('data-operational-use', 'reference-only');
  });
}

function tickerElement(documentRef, id) {
  return documentRef?.querySelector?.(`[id="${id}"]`) || null;
}

function renderTickerActivity(documentRef, root, state, portfolioState) {
  const id = state?.id || null;
  const quote = state?.quote || {};
  const live = id ? root?._liveData?.[id] || {} : {};
  const price = finite(quote.value) ?? finite(live.price) ?? finite(live.regularMarketPrice);
  const holding = (Array.isArray(portfolioState?.holdings) ? portfolioState.holdings : [])
    .find((item) => String(item?.symbol || '').toUpperCase() === String(id || '').toUpperCase());
  const shares = finite(holding?.shares);
  const avgCost = finite(holding?.avgCost);
  const pnl = price != null && shares != null && avgCost != null ? (price - avgCost) * shares : null;
  const pnlPct = pnl != null && avgCost > 0 ? (price - avgCost) / avgCost * 100 : null;
  const valueNode = tickerElement(documentRef, 'ticker-hero-value');
  const pnlNode = tickerElement(documentRef, 'ticker-hero-pnl');
  const hasPosition = !!holding && shares != null && avgCost != null;
  if (valueNode) {
    valueNode.textContent = !hasPosition ? '내 포트폴리오 외 종목' : pnl == null
      ? '손익 계산 대기'
      : `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}${pnlPct == null ? '' : ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}`;
    valueNode.dataset.aioTickerPnlRenderer = 'native';
    valueNode.setAttribute('data-source-kind', pnl == null ? 'unavailable' : 'portfolio-state');
    valueNode.setAttribute('data-source-label', pnl == null ? 'portfolio position or quote unavailable' : 'portfolio-state+entity-quote');
    valueNode.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlNode) {
    pnlNode.className = `pnl${pnl != null ? ' pos' : ''}`;
    pnlNode.dataset.aioTickerPnlRenderer = 'native';
    pnlNode.setAttribute('data-source-kind', pnl == null ? 'unavailable' : 'portfolio-state');
    pnlNode.setAttribute('data-source-label', pnl == null ? 'portfolio P&L unavailable' : 'portfolio-state+entity-quote');
    pnlNode.setAttribute('data-operational-use', 'reference-only');
  }
  const extensionNode = tickerElement(documentRef, 'ticker-hero-ext');
  if (extensionNode) {
    const extPrice = finite(live.extPrice ?? live.postMarketPrice);
    const extPct = finite(live.extPct ?? live.postMarketChangePercent);
    const session = live.extSession === 'pre' || live.extSession === 'after' ? live.extSession : (typeof root?._getUsSession === 'function' ? root._getUsSession() : 'open');
    const visible = (session === 'pre' || session === 'after') && extPrice != null;
    extensionNode.textContent = visible
      ? `${session === 'pre' ? 'Pre' : 'After'} $${extPrice.toFixed(2)}${extPct == null ? '' : ` (${extPct >= 0 ? '+' : ''}${extPct.toFixed(2)}%)`}`
      : '';
    extensionNode.style.display = visible ? '' : 'none';
    extensionNode.dataset.aioTickerExtensionRenderer = 'native';
    extensionNode.setAttribute('data-source-kind', visible ? 'live' : 'unavailable');
    extensionNode.setAttribute('data-source-label', visible ? 'live:extended-session' : 'extended-session unavailable');
    extensionNode.setAttribute('data-operational-use', 'reference-only');
  }
}

function renderTickerChart({ root, page, state, charts }) {
  const canvas = page?.querySelector?.('#ticker-price-chart');
  if (!canvas) return;
  const rows = (Array.isArray(state?.history) ? state.history : [])
    .filter((row) => row?.time && finite(row.close) != null)
    .slice(-365);
  const ChartConstructor = root?.Chart;
  const unavailable = rows.length < 2 || typeof ChartConstructor !== 'function';
  const signature = rows.map((row) => `${row.time}:${row.close}`).join('|');
  canvas.dataset.aioTickerChartRenderer = 'native';
  canvas.dataset.sourceKind = unavailable ? 'unavailable' : 'native-runtime';
  canvas.dataset.sourceLabel = unavailable ? 'entity-history-unavailable' : 'native:entity-history';
  canvas.dataset.operationalUse = 'reference-only';
  const loading = page.querySelector('#ticker-chart-loading');
  if (unavailable) {
    charts.destroy('ticker-price-chart');
    if (loading) {
      loading.style.display = 'flex';
      loading.textContent = `${state?.id || '종목'} 관측 가격 이력 미수신 · 차트 보류`;
    }
    return;
  }
  if (charts.get('ticker-price-chart')?.signature === signature) return;
  charts.destroy('ticker-price-chart');
  try {
    const labels = rows.map((row) => String(row.time).slice(5));
    const prices = rows.map((row) => finite(row.close));
    const isUp = prices.at(-1) >= prices[0];
    const chart = new ChartConstructor(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: state?.id || '가격', data: prices, borderColor: isUp ? '#22754c' : '#b13a30', backgroundColor: isUp ? 'rgba(34,117,76,0.14)' : 'rgba(177,58,48,0.14)', borderWidth: 1.6, pointRadius: 0, tension: 0.2, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4 } } } }
    });
    charts.set('ticker-price-chart', { chart, signature });
    if (loading) loading.style.display = 'none';
  } catch (_) {
    charts.destroy('ticker-price-chart');
    if (loading) { loading.style.display = 'flex'; loading.textContent = `${state?.id || '종목'} 차트 런타임 실패 · 차트 보류`; }
  }
}

function formatOptionMetric(metric) {
  const value = finite(metric?.value);
  return value == null ? '—' : value.toFixed(2);
}

function renderOptionMetric(documentRef, id, metric, color = null) {
  const element = setText(documentRef, id, formatOptionMetric(metric));
  if (!element) return;
  const sourceKind = metric?.sourceKind || 'unavailable';
  element.setAttribute('data-source-kind', sourceKind);
  element.setAttribute('data-source-label', metric?.source || 'unavailable');
  element.setAttribute('data-operational-use', 'reference-only');
  if (color) element.style.color = color;
}

function renderOptions(documentRef, state) {
  const options = state?.options || {};
  const pcr = finite(options.pcr?.value);
  const pcrColor = pcr == null
    ? 'var(--text-muted)'
    : pcr >= 1.2 ? 'var(--data-red)' : pcr >= 0.9 ? 'var(--data-amber)' : 'var(--data-green)';
  renderOptionMetric(documentRef, 'opt-vix-val-secondary', options.vix);
  renderOptionMetric(documentRef, 'opt-pcr-val-secondary', options.pcr, pcrColor);
  renderOptionMetric(documentRef, 'opt-skew-val-secondary', options.skew);
}

function renderFundamentalStatus(documentRef, state) {
  const element = documentRef?.getElementById('fund-data-status');
  if (!element) return;
  const fundamentals = state?.fundamentals;
  const available = !!fundamentals && typeof fundamentals === 'object'
    && Array.isArray(fundamentals.coverage) && fundamentals.coverage.length > 0;
  element.textContent = available ? '● SEC 연간 데이터' : '○ SEC 데이터 미수신';
  element.className = `freshness-badge ${available ? 'fb-live' : 'fb-static'}`;
  element.setAttribute('data-source-kind', available ? (fundamentals.sourceTier || 'official-regulator') : 'unavailable');
  element.setAttribute('data-source-label', available ? (fundamentals.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  if (fundamentals?.observedAt) element.setAttribute('data-observed-at', fundamentals.observedAt);
  else element.removeAttribute('data-observed-at');
}

function formatFundamentalNumber(value) {
  const number = finite(value);
  return number == null ? null : number.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function renderFundamentalSummary(documentRef, state) {
  const element = documentRef?.getElementById('fund-analysis-text');
  if (!element) return;
  const fundamentals = state?.fundamentals;
  const coverage = Array.isArray(fundamentals?.coverage)
    ? fundamentals.coverage.filter((field) => typeof field === 'string')
    : [];
  const available = coverage.length > 0;
  const facts = [];
  if (coverage.includes('revenue')) {
    const revenue = formatFundamentalNumber(fundamentals?.revenue);
    if (revenue != null) facts.push(`매출 ${revenue}`);
  }
  if (coverage.includes('netIncome')) {
    const netIncome = formatFundamentalNumber(fundamentals?.netIncome);
    if (netIncome != null) facts.push(`순이익 ${netIncome}`);
  }
  if (coverage.includes('margin')) {
    const margin = formatFundamentalNumber(fundamentals?.margin);
    if (margin != null) facts.push(`마진 ${margin}%`);
  }
  if (coverage.includes('pe')) {
    const pe = formatFundamentalNumber(fundamentals?.pe);
    if (pe != null) facts.push(`P/E ${pe}`);
  }
  const period = fundamentals?.periodType || 'FY';
  const observedAt = fundamentals?.observedAt || '기준일 미상';
  element.textContent = available
    ? `SEC ${period} 데이터 ${coverage.length}개 항목 확인 · 기준일 ${observedAt}${facts.length ? ` · ${facts.join(' · ')}` : ''}`
    : 'SEC 연간 재무 데이터 수신 대기 · 해석 보류';
  element.dataset.aioFundamentalSummaryRenderer = 'native';
  element.setAttribute('data-source-kind', available ? (fundamentals.sourceTier || 'official-regulator') : 'unavailable');
  element.setAttribute('data-source-label', available ? (fundamentals.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  if (available && fundamentals?.observedAt) element.setAttribute('data-observed-at', fundamentals.observedAt);
  else element.removeAttribute('data-observed-at');
}

function formatSecMetric(metric) {
  if (metric?.value == null) return '—';
  if (metric.unit === 'currency') return `$${Math.abs(metric.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}${metric.value < 0 ? ' (negative)' : ''}`;
  if (metric.unit === 'shares') return metric.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (metric.unit === 'percent') return `${metric.value.toFixed(1)}%`;
  return `${metric.value.toFixed(2)}x`;
}

function markSecReportElement(element, report) {
  if (!element) return;
  element.dataset.aioSecReportRenderer = 'native';
  element.setAttribute('data-source-kind', report.status === 'current' ? report.sourceKind : 'unavailable');
  element.setAttribute('data-source-label', report.status === 'current' ? report.source : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  element.setAttribute('data-freshness-state', report.freshness?.state || 'unknown');
  element.setAttribute('data-decision-eligible', report.decisionEligible === true ? 'true' : 'false');
  if (report.observedAt) element.setAttribute('data-observed-at', report.observedAt);
  else element.removeAttribute('data-observed-at');
}

function renderFundamentalReport(documentRef, page, state) {
  const report = deriveSecReport(state?.fundamentals);
  if (page) {
    page.dataset.aioFundamentalReportRenderer = 'native';
    page.dataset.aioSecReportModel = report.modelVersion;
  }
  const container = documentRef?.getElementById('fund-native-sec-report');
  const title = documentRef?.getElementById('fund-native-sec-title');
  const meta = documentRef?.getElementById('fund-native-sec-meta');
  const coverage = documentRef?.getElementById('fund-native-sec-coverage');
  const grid = documentRef?.getElementById('fund-native-sec-grid');
  markSecReportElement(container, report);
  markSecReportElement(title, report);
  markSecReportElement(meta, report);
  markSecReportElement(coverage, report);
  markSecReportElement(grid, report);
  if (title) title.textContent = report.entityName || report.symbol ? `SEC 기본 보고 · ${report.entityName || report.symbol}` : 'SEC 기본 보고';
  if (meta) {
    meta.textContent = report.status === 'current'
      ? `${report.form || 'Annual filing'} · 기준일 ${report.observedAt || '—'} · 신선도 ${report.freshness?.state || 'unknown'}${report.freshness?.ageDays != null ? ` (${report.freshness.ageDays}일)` : ''} · 제출일 ${report.filedAt || '—'}${report.filingMetadata?.acceptedAt ? ` · 접수 ${report.filingMetadata.acceptedAt}` : ''}${report.accession ? ` · ${report.accession}` : ''}${report.pointInTime?.observationCount ? ` · PIT ${report.pointInTime.observationCount}건 (${report.pointInTime.status})` : ''}`
      : 'SEC EDGAR 연간 데이터 수신 대기 · 값이 없는 항목은 추정하지 않습니다';
  }
  if (coverage) coverage.textContent = report.status === 'current'
    ? `관측 항목 ${report.coverage.length}개 · ${report.source} · ${report.freshness?.state === 'current' ? '현재 참고 가능' : '과거 참고 전용'}`
    : '관측 항목 없음';
  if (!grid) return;
  grid.replaceChildren();
  if (report.metrics.length === 0) {
    const empty = documentRef.createElement('div');
    empty.textContent = '공식 SEC annual fact가 수신되면 핵심 재무 지표가 표시됩니다.';
    empty.style.cssText = 'grid-column:1/-1;color:var(--text-muted);font-size:12px;padding:8px 0;';
    grid.appendChild(empty);
    return;
  }
  for (const metric of report.metrics) {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--surface-2);border:1px solid var(--border-subtle);border-radius:4px;padding:9px 10px;min-width:0;';
    const label = documentRef.createElement('div');
    label.textContent = metric.label;
    label.style.cssText = 'font-size:10px;color:var(--text-muted);margin-bottom:4px;';
    const value = documentRef.createElement('div');
    value.textContent = formatSecMetric(metric);
    value.style.cssText = 'font-size:14px;font-family:var(--font-mono);font-weight:700;color:var(--text-primary);overflow-wrap:anywhere;';
    card.append(label, value);
    grid.appendChild(card);
  }
}

// RM-01 (2026-07-19): every id this module used to write (ticker-m-*,
// fund-analysis-text, opt-pcr-val-secondary, ticker-candle-symbol, ticker-entry-symbol) has a
// live legacy writer in js/aio-core.js/aio-data.js or an inline index.html script
// (route-owners.json legacyWriterEvidence). P777 transfers only the ticker hero
// name/fullname/price/change primary surface; P817 transfers ticker candle/entry symbol labels.
// P778 transfers only the three options replacement-metric values; P779 transfers only the
// SEC annual-data availability/source badge on fundamental. P815 transfers only the bounded
// SEC-derived summary line; options-chain, report sections, charts, and AI narrative remain
// legacy-owned.
function render({ root, documentRef, store, route, charts }) {
  const state = selectEntityState(store.getState());
  const portfolioState = selectPortfolioState(store.getState());
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
    routeNode.dataset.aioArchitectureRoute = route;
    routeNode.dataset.aioArchitectureSlice = 'entity';
    routeNode.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    if (route === 'ticker' || route === 'options' || route === 'fundamental') routeNode.dataset.aioArchitectureRenderer = 'native';
  }
  if (route === 'ticker') {
    renderTickerHero(documentRef, state);
    renderTickerSecondarySymbols(documentRef, state);
    renderTickerActivity(documentRef, root, state, portfolioState);
    renderTickerChart({ root, page: routeNode, state, charts });
  }
  if (route === 'options') renderOptions(documentRef, state);
  if (route === 'fundamental') {
    renderFundamentalStatus(documentRef, state);
    renderFundamentalSummary(documentRef, state);
    renderFundamentalReport(documentRef, routeNode, state);
  }
}

export function createEntityPage({ root = globalThis, documentRef, store, route = 'ticker' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 520 });
      bag.add(charts.dispose);
      const renderNow = () => render({ root, documentRef, store, route, charts });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      const refresh = () => renderNow();
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:sentimentUpdated', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, refresh);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, refresh));
      });
      if (route === 'fundamental') {
        const summary = documentRef?.getElementById('fund-analysis-text');
        if (summary) summary.dataset.aioFundamentalSummaryRenderer = 'native';
        bag.add(() => {
          if (summary?.dataset.aioFundamentalSummaryRenderer === 'native') delete summary.dataset.aioFundamentalSummaryRenderer;
        });
        const report = documentRef?.getElementById('page-fundamental');
        bag.add(() => {
          if (report?.dataset.aioFundamentalReportRenderer === 'native') delete report.dataset.aioFundamentalReportRenderer;
          if (report?.dataset.aioSecReportModel) delete report.dataset.aioSecReportModel;
          report?.querySelectorAll?.('[data-aio-sec-report-renderer="native"]')?.forEach((element) => {
            delete element.dataset.aioSecReportRenderer;
            delete element.dataset.sourceKind;
            delete element.dataset.sourceLabel;
            delete element.dataset.operationalUse;
            delete element.dataset.observedAt;
          });
        });
      }
      if (route === 'ticker') {
        const page = documentRef?.getElementById('page-ticker');
        if (page) page.dataset.aioTickerChartRenderer = 'native';
        ['ticker-candle-symbol', 'ticker-entry-symbol', 'ticker-hero-ext', 'ticker-hero-pnl', 'ticker-hero-value'].forEach((id) => {
          const element = documentRef?.getElementById(id);
          if (!element) return;
          if (id === 'ticker-hero-ext') element.dataset.aioTickerExtensionRenderer = 'native';
          else if (id === 'ticker-hero-pnl' || id === 'ticker-hero-value') element.dataset.aioTickerPnlRenderer = 'native';
          else element.dataset.aioTickerSymbolRenderer = 'native';
          bag.add(() => {
            if (element?.dataset.aioTickerSymbolRenderer === 'native') delete element.dataset.aioTickerSymbolRenderer;
            if (element?.dataset.aioTickerExtensionRenderer === 'native') delete element.dataset.aioTickerExtensionRenderer;
            if (element?.dataset.aioTickerPnlRenderer === 'native') delete element.dataset.aioTickerPnlRenderer;
          });
        });
        bag.add(() => {
          if (page?.dataset.aioTickerChartRenderer === 'native') delete page.dataset.aioTickerChartRenderer;
          const canvas = documentRef?.getElementById('ticker-price-chart');
          if (canvas?.dataset.aioTickerChartRenderer === 'native') {
            delete canvas.dataset.aioTickerChartRenderer;
            delete canvas.dataset.sourceKind;
            delete canvas.dataset.sourceLabel;
            delete canvas.dataset.operationalUse;
          }
        });
      }
      const routeNode = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (routeNode?.dataset.aioArchitectureRenderer === 'native') delete routeNode.dataset.aioArchitectureRenderer;
        if (routeNode?.dataset.aioArchitectureRoute === route) delete routeNode.dataset.aioArchitectureRoute;
        if (routeNode?.dataset.aioArchitectureSlice === 'entity') delete routeNode.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
