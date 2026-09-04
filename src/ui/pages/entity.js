import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { selectEntityState } from '../../state/selectors/entity.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { deriveSecReport } from '../../domain/fundamental/sec-report.js';
import { canonicalEpochMs } from '../../domain/chart/contract.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function renderTickerHero(documentRef, state, root) {
  const requestedId = String(root?._currentTickerId || '').trim().toUpperCase() || null;
  const id = state?.id || requestedId;
  const quote = state?.quote || {};
  const price = finite(quote.value);
  const pct = finite(quote.pct);
  setText(documentRef, 'ticker-hero-name', id || '—');
  setText(documentRef, 'ticker-hero-fullname', id
    ? (state?.name || (state?.id ? id : `${root?._currentTickerName || id} · 시세 수신 대기`))
    : '종목을 검색하세요');
  setText(documentRef, 'ticker-hero-price', price == null ? '—' : `$${price.toFixed(2)}`);
  const change = setText(documentRef, 'ticker-hero-chg', pct == null ? '—' : `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(2)}%`);
  if (change) change.className = `ticker-chg-big ${pct == null ? '' : pct >= 0 ? 'up' : 'down'}`;
}

function renderTickerSecondarySymbols(documentRef, state, root) {
  const symbol = state?.id || String(root?._currentTickerId || '').trim().toUpperCase() || '—';
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

function renderTickerNavigation(documentRef, state, root) {
  const breadcrumb = tickerElement(documentRef, 'ticker-breadcrumb-main');
  const backButton = tickerElement(documentRef, 'ticker-back-btn-main');
  const hasSelection = !!state?.id || !!String(root?._currentTickerId || '').trim();
  const fundamentalLink = tickerElement(documentRef, 'ticker-fundamental-link');
  if (fundamentalLink) {
    const symbol = String(state?.id || root?._currentTickerId || '').trim();
    fundamentalLink.disabled = !symbol;
    fundamentalLink.textContent = symbol ? `${symbol} SEC 재무 보기` : '종목 선택 후 SEC 재무 보기';
    fundamentalLink.setAttribute('aria-label', fundamentalLink.textContent);
  }
  if (!hasSelection) {
    if (breadcrumb) { breadcrumb.textContent = '종목 선택 대기'; breadcrumb.setAttribute('aria-label', '종목 선택 대기'); }
    if (backButton) { backButton.textContent = '← 돌아가기'; backButton.setAttribute('aria-label', '← 돌아가기'); }
    return;
  }
  const origins = { screener: '스크리너', themes: '테마 분석', portfolio: '포트폴리오', fundamental: '기업 분석', technical: '기술 분석', 'market-news': '시장 뉴스', briefing: '오늘의 브리핑', masters: '대가의 포트폴리오', home: '대시보드' };
  const requestedOrigin = root?.AIO?.state?.tickerReturnRoute;
  const origin = Object.hasOwn(origins, requestedOrigin) ? requestedOrigin : 'fundamental';
  const label = origins[origin];
  if (breadcrumb) {
    breadcrumb.textContent = label;
    breadcrumb.setAttribute('aria-label', label);
    breadcrumb.setAttribute('data-action', 'showPage');
    breadcrumb.setAttribute('data-arg', origin);
    breadcrumb.setAttribute('role', 'button');
    breadcrumb.setAttribute('tabindex', '0');
  }
  if (backButton) {
    backButton.textContent = `← ${label}`;
    backButton.setAttribute('aria-label', `← ${label}`);
    backButton.setAttribute('data-action', 'showPage');
    backButton.setAttribute('data-arg', origin);
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
  const signature = rows.map((row) => `${canonicalEpochMs(row.epochMs ?? row.time) ?? row.time}:${row.close}`).join('|');
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
  if (metric?.observedAt) element.setAttribute('data-observed-at', metric.observedAt);
  else element.removeAttribute('data-observed-at');
  if (color) element.style.color = color;
  const meta = documentRef?.getElementById(`${id}-meta`);
  if (meta) {
    const asOf = metric?.observedAt ? String(metric.observedAt).replace('T', ' ').replace(/\.000Z$|Z$/, ' UTC') : '기준일 미수신';
    meta.textContent = `${asOf} · ${metric?.source || '출처 미수신'} · 참고용`;
    meta.setAttribute('data-source-kind', sourceKind);
    meta.setAttribute('data-operational-use', 'reference-only');
    if (metric?.observedAt) meta.setAttribute('data-observed-at', metric.observedAt);
    else meta.removeAttribute('data-observed-at');
  }
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
  const observedAt = fundamentals?.observedAt || fundamentals?.filedAt || null;
  element.textContent = available ? `● SEC 연간 공시 · ${observedAt ? `기준 ${String(observedAt).slice(0, 10)}` : '기준일 미수신'}` : '○ SEC 데이터 미수신';
  element.className = 'freshness-badge fb-static';
  element.setAttribute('data-source-kind', available ? (fundamentals.sourceTier || 'official-regulator') : 'unavailable');
  element.setAttribute('data-source-label', available ? (fundamentals.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  if (observedAt) element.setAttribute('data-observed-at', observedAt);
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

function formatSecWatchlistValue(value, { percent = false } = {}) {
  const number = finite(value);
  if (number == null) return '—';
  if (percent) return `${number.toFixed(1)}%`;
  const absolute = Math.abs(number);
  const sign = number < 0 ? '-' : '';
  if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(1)}T`;
  if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(1)}B`;
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(1)}M`;
  return `${sign}$${absolute.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function appendSecWatchlistMetric(documentRef, container, labelText, valueText) {
  const metric = documentRef.createElement('div');
  metric.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-secondary);';
  const label = documentRef.createElement('span');
  label.textContent = labelText;
  const value = documentRef.createElement('strong');
  value.textContent = valueText;
  value.style.cssText = 'color:var(--text-primary);font-family:var(--font-mono);text-align:right;';
  metric.append(label, value);
  container.appendChild(metric);
}

function renderFundamentalWatchlist(documentRef, state) {
  const grid = documentRef?.getElementById('fund-cards-grid');
  if (!grid) return;
  const rows = Array.isArray(state?.fundamentalsWatchlist) ? state.fundamentalsWatchlist : [];
  const meta = state?.fundamentalsMeta || {};
  grid.replaceChildren();
  grid.dataset.aioFundamentalWatchlistRenderer = 'native';
  grid.setAttribute('data-source-kind', rows.length ? (meta.sourceTier || 'official-regulator') : 'unavailable');
  grid.setAttribute('data-source-label', rows.length ? (meta.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals-summary.json');
  grid.setAttribute('data-operational-use', 'reference-only');
  if (meta.generatedAt) grid.setAttribute('data-fetched-at', meta.generatedAt);
  else grid.removeAttribute('data-fetched-at');
  if (!rows.length) {
    const empty = documentRef.createElement('div');
    empty.textContent = '공식 SEC 연간 공시 투영을 수신하지 못해 관심종목 비교를 표시하지 않습니다.';
    empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:11px;';
    grid.appendChild(empty);
    return;
  }
  const notice = documentRef.createElement('div');
  const generatedMs = Date.parse(meta.generatedAt || '');
  const ageHours = Number.isFinite(generatedMs) ? Math.max(0, (Date.now() - generatedMs) / 3600000) : null;
  const projectionState = ageHours == null ? '투영 확인시각 미수신' : ageHours <= 48 ? '자동 투영 확인 정상' : '자동 투영 확인 지연 · 참고 전용';
  const coverageText = Number.isFinite(meta.stored) && Number.isFinite(meta.eligible)
    ? ` · ${meta.stored}/${meta.eligible}개 SEC 대상 보유`
    : '';
  notice.textContent = `SEC EDGAR companyfacts · ${projectionState}${meta.generatedAt ? ` · 확인 ${String(meta.generatedAt).replace('T', ' ').slice(0, 16)}Z` : ''}${coverageText} · 연간 공시와 시세는 서로 다른 시계로 분리`;
  notice.style.cssText = `grid-column:1/-1;padding:9px 10px;border-left:2px solid ${ageHours != null && ageHours <= 48 ? 'var(--data-green)' : 'var(--data-amber)'};background:var(--surface-2);color:var(--text-secondary);font-size:10px;line-height:1.5;`;
  grid.appendChild(notice);
  for (const row of rows) {
    const symbol = String(row.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const card = documentRef.createElement('button');
    card.type = 'button';
    card.className = 'fund-ticker-card';
    card.setAttribute('data-aio-entity-symbol', symbol);
    card.setAttribute('data-source-kind', row.sourceTier || 'official-regulator');
    card.setAttribute('data-source-label', row.source || meta.source || 'SEC EDGAR companyfacts');
    card.setAttribute('data-operational-use', 'reference-only');
    card.setAttribute('data-decision-eligible', 'false');
    if (row.observedAt) card.setAttribute('data-observed-at', row.observedAt);
    card.style.cssText = 'appearance:none;width:100%;background:var(--bg-card);border-radius:4px;padding:14px;border:1px solid var(--border);cursor:pointer;text-align:left;color:inherit;';

    const heading = documentRef.createElement('div');
    heading.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;';
    const identity = documentRef.createElement('div');
    const symbolNode = documentRef.createElement('div');
    symbolNode.textContent = symbol;
    symbolNode.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-primary);';
    const name = documentRef.createElement('div');
    name.textContent = row.entityName || symbol;
    name.style.cssText = 'font-size:10px;color:var(--text-muted);line-height:1.35;margin-top:2px;';
    identity.append(symbolNode, name);
    const period = documentRef.createElement('span');
    period.textContent = `${row.periodType || 'FY'} · ${row.observedAt || '기준일 미상'}`;
    period.style.cssText = 'font-size:10px;color:var(--text-muted);white-space:nowrap;';
    heading.append(identity, period);
    card.appendChild(heading);

    const metrics = documentRef.createElement('div');
    metrics.style.cssText = 'display:grid;gap:5px;';
    appendSecWatchlistMetric(documentRef, metrics, '매출', formatSecWatchlistValue(row.revenue));
    appendSecWatchlistMetric(documentRef, metrics, '순이익', formatSecWatchlistValue(row.netIncome));
    appendSecWatchlistMetric(documentRef, metrics, '매출 성장', formatSecWatchlistValue(row.revGrowth, { percent: true }));
    appendSecWatchlistMetric(documentRef, metrics, '순이익률', formatSecWatchlistValue(row.margin, { percent: true }));
    appendSecWatchlistMetric(documentRef, metrics, 'ROE', formatSecWatchlistValue(row.roe, { percent: true }));
    card.appendChild(metrics);

    const source = documentRef.createElement('div');
    source.textContent = `SEC ${row.form || 'annual filing'} · 제출 ${row.filedAt || '미상'} · 추정치 없음`;
    source.style.cssText = 'font-size:9px;color:var(--text-muted);margin-top:10px;line-height:1.35;';
    card.appendChild(source);
    grid.appendChild(card);
  }
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
      : 'SEC EDGAR 연간 데이터 및 PIT 기준시점 수신 대기 · 값이 없는 항목은 추정하지 않습니다';
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
    renderTickerHero(documentRef, state, root);
    renderTickerSecondarySymbols(documentRef, state, root);
    renderTickerActivity(documentRef, root, state, portfolioState);
    renderTickerNavigation(documentRef, state, root);
    renderTickerChart({ root, page: routeNode, state, charts });
  }
  if (route === 'options') renderOptions(documentRef, state);
  if (route === 'fundamental') {
    renderFundamentalStatus(documentRef, state);
    renderFundamentalSummary(documentRef, state);
    renderFundamentalWatchlist(documentRef, state);
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
      const onPageShown = (event) => {
        const detail = event?.detail;
        const shownRoute = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
        if (route === 'ticker' && shownRoute === 'ticker') refresh();
      };
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:sentimentUpdated', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, refresh);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, refresh));
      });
      eventTarget?.addEventListener?.('aio:pageShown', onPageShown);
      bag.add(() => eventTarget?.removeEventListener?.('aio:pageShown', onPageShown));
      const page = documentRef?.getElementById(`page-${route}`);
      let suppliedMaterialBridge = page?.querySelector?.(`[data-aio-supplied-material-route="${route}"]`) || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: route,
          heading: route === 'ticker' ? '종목 · AI 경제성·자본·13F 맥락' : route === 'fundamental' ? '펀더멘털 · 매출 전환·소프트웨어·Physical AI' : '옵션 · 이벤트·시장 리스크 정렬'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      if (route === 'ticker') {
        const onRelatedThemeClick = (event) => {
          const trigger = event?.target?.closest?.('[data-action="showThemeDetail"][data-arg]');
          if (!trigger) return;
          const themeId = String(trigger.getAttribute('data-arg') || '').trim();
          if (!themeId) return;
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          if (typeof root?.showThemeDetail === 'function') {
            root.showThemeDetail(themeId);
            return;
          }
          root._currentThemeId = themeId;
          root._aioOpenThemeDetailOnThemes = themeId;
          const navigate = typeof root?.showPage === 'function'
            ? root.showPage.bind(root)
            : typeof root?.AIO_ARCH?.router?.transition === 'function'
              ? root.AIO_ARCH.router.transition.bind(root.AIO_ARCH.router)
              : typeof root?.__AIO_ARCH_RUNTIME__?.router?.transition === 'function'
                ? root.__AIO_ARCH_RUNTIME__.router.transition.bind(root.__AIO_ARCH_RUNTIME__.router)
                : null;
          if (navigate) {
            navigate(typeof root?.showPage === 'function' ? 'theme-detail' : 'themes', { source: 'ticker-related-theme', themeId });
          }
          eventTarget?.dispatchEvent?.(new CustomEvent('aio:themeDetailShown', { detail: { themeId } }));
        };
        eventTarget?.addEventListener?.('click', onRelatedThemeClick, true);
        bag.add(() => eventTarget?.removeEventListener?.('click', onRelatedThemeClick, true));
      }
      if (route === 'fundamental') {
        const onFundamentalCardClick = (event) => {
          const trigger = event?.target?.closest?.('[data-aio-entity-symbol]');
          if (!trigger) return;
          const symbol = String(trigger.getAttribute('data-aio-entity-symbol') || '').trim().toUpperCase();
          if (!symbol) return;
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          root._currentTickerId = symbol;
          eventTarget?.dispatchEvent?.(new CustomEvent('aio:entityChanged', { detail: { symbol, source: 'sec-watchlist' } }));
        };
        eventTarget?.addEventListener?.('click', onFundamentalCardClick, true);
        bag.add(() => eventTarget?.removeEventListener?.('click', onFundamentalCardClick, true));
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
          const watchlist = documentRef?.getElementById('fund-cards-grid');
          if (watchlist?.dataset.aioFundamentalWatchlistRenderer === 'native') {
            delete watchlist.dataset.aioFundamentalWatchlistRenderer;
            delete watchlist.dataset.sourceKind;
            delete watchlist.dataset.sourceLabel;
            delete watchlist.dataset.operationalUse;
            delete watchlist.dataset.fetchedAt;
          }
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
