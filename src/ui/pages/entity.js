import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { parseKnowledgeTargetContext } from '../../app/knowledge-route-state.js';
import { selectEntityState } from '../../state/selectors/entity.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { deriveSecReport } from '../../domain/fundamental/sec-report.js';
import { canonicalEpochMs } from '../../domain/chart/contract.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { setStockSubject } from '../navigation/route-hubs.js';
import { renderStockRead } from '../components/stock-read.js';
import { renderFiscalRead } from '../components/fiscal-read.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const TICKER_CHART_RANGES = Object.freeze({
  '1m': Object.freeze({ key: '1m', label: '1개월', days: 30 }),
  '3m': Object.freeze({ key: '3m', label: '3개월', days: 90 }),
  '6m': Object.freeze({ key: '6m', label: '6개월', days: 180 }),
  '1y': Object.freeze({ key: '1y', label: '1년', days: 365 })
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectTickerChartWindow(history = [], requestedRange = '1m') {
  const range = TICKER_CHART_RANGES[requestedRange] || TICKER_CHART_RANGES['1m'];
  const ordered = (Array.isArray(history) ? history : [])
    .map((row) => ({ ...row, epochMs: canonicalEpochMs(row?.epochMs ?? row?.time ?? row?.date ?? row?.timestamp) }))
    .filter((row) => row.epochMs != null && finite(row.close) != null)
    .sort((left, right) => left.epochMs - right.epochMs);
  const endEpochMs = ordered.at(-1)?.epochMs ?? null;
  const startEpochMs = endEpochMs == null ? null : endEpochMs - range.days * DAY_MS;
  const rows = endEpochMs == null ? [] : ordered.filter((row) => row.epochMs >= startEpochMs);
  return Object.freeze({
    range: range.key,
    label: range.label,
    days: range.days,
    rows: Object.freeze(rows),
    rowCount: rows.length,
    startEpochMs: rows[0]?.epochMs ?? null,
    endEpochMs: rows.at(-1)?.epochMs ?? null
  });
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function formatMoney(value, currency, { maximumFractionDigits = 2 } = {}) {
  const amount = finite(value);
  if (amount == null) return '—';
  const code = String(currency || '').trim().toUpperCase();
  if (!code) return `${amount.toLocaleString('en-US', { maximumFractionDigits })} · 통화 미확인`;
  try {
    return new Intl.NumberFormat(code === 'KRW' ? 'ko-KR' : 'en-US', {
      style: 'currency', currency: code, maximumFractionDigits: code === 'KRW' ? 0 : maximumFractionDigits
    }).format(amount);
  } catch (_) {
    return `${code} ${amount.toLocaleString('en-US', { maximumFractionDigits })}`;
  }
}

function renderTickerHero(documentRef, state, root) {
  const requestedId = String(root?._currentTickerId || '').trim().toUpperCase() || null;
  const id = state?.id || requestedId;
  const quote = state?.quote || {};
  const price = finite(quote.value);
  const pct = finite(quote.pct);
  // P1317: Korean users recognise a KRX listing by its name, not its code — lead with the name.
  const krName = /\.(KS|KQ)$/.test(String(id || '')) && state?.name && state.name !== id ? state.name : null;
  setText(documentRef, 'ticker-hero-name', krName || id || '종목 분석');
  setText(documentRef, 'ticker-hero-fullname', id
    ? (krName ? id : (state?.name || (state?.id ? id : `${root?._currentTickerName || id} · 시세 수신 대기`)))
    : '종목을 검색하세요');
  // P1317: a KRX listing (.KS/.KQ) trades only in KRW — the venue, not a guess, fixes the quote currency.
  setText(documentRef, 'ticker-hero-price', formatMoney(price, quote.currency || (/\.(KS|KQ)$/.test(String(id || '')) ? 'KRW' : null)));
  const change = setText(documentRef, 'ticker-hero-chg', pct == null ? '—' : `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(2)}%`);
  if (change) change.className = `ticker-chg-big ${pct == null ? '' : pct >= 0 ? 'up' : 'down'}`;
  // P1317/N27: showPage titles the route from the stale hero before this render runs, so the tab,
  // history and bookmarks kept "종목 선택 대기" (or the previous symbol). The owner of the hero owns the title.
  if (id && documentRef && documentRef.getElementById?.('page-ticker')?.classList?.contains('active')) {
    const label = state?.name && state.name !== id ? `${state.name} (${id})` : id;
    documentRef.title = `${label}${price == null ? '' : ` ${formatMoney(price, quote.currency || (/\.(KS|KQ)$/.test(String(id)) ? 'KRW' : null))}`} · AIO Screener`;
  }
}

function renderTickerSecondarySymbols(documentRef, state, root) {
  const symbol = state?.id || String(root?._currentTickerId || '').trim().toUpperCase() || '—';
  // P1405: display continuity only (the 차트 · 기술 chart opens on it). The AI context scope stays
  // _currentTickerId, which the router clears outside entity routes.
  if (state?.id && root) setStockSubject({ root, documentRef, symbol: state.id, name: state.name && state.name !== state.id ? state.name : '' });
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
  const currency = quote.currency || live.currency || live.quoteEnvelope?.currency || null;
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
    valueNode.textContent = !hasPosition ? '보유 종목 아님' : pnl == null
      ? '손익 계산 대기'
      : `${pnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(pnl), currency, { maximumFractionDigits: 0 })}${pnlPct == null ? '' : ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}`;
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
    const session = live.extSession === 'pre' || live.extSession === 'after' ? live.extSession : (typeof root?._getUsSession === 'function' ? root._getUsSession() : 'unknown');
    const visible = (session === 'pre' || session === 'after') && extPrice != null;
    extensionNode.textContent = visible
      ? `${session === 'pre' ? 'Pre' : 'After'} ${formatMoney(extPrice, currency)}${extPct == null ? '' : ` (${extPct >= 0 ? '+' : ''}${extPct.toFixed(2)}%)`}`
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
  // P1505: with no symbol the page showed an empty price block, chart circle and factor panel; it now shows the
  // search only (CSS on .is-empty), which is the one action available.
  documentRef.getElementById?.('page-ticker')?.classList.toggle('is-empty', !hasSelection);
  if (!hasSelection) {
    if (breadcrumb) { breadcrumb.textContent = '종목 선택 대기'; breadcrumb.setAttribute('aria-label', '종목 선택 대기'); }
    if (backButton) { backButton.textContent = '← 돌아가기'; backButton.setAttribute('aria-label', '← 돌아가기'); }
    return;
  }
  const origins = { screener: '스크리너', themes: '테마 분석', portfolio: '포트폴리오', fundamental: '재무 공시', technical: '차트', 'market-news': '시장 뉴스', briefing: '오늘의 브리핑', masters: '대가의 포트폴리오', home: '대시보드' };
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

function formatTickerChartDate(epochMs) {
  return epochMs == null ? '—' : new Date(epochMs).toISOString().slice(0, 10);
}

function renderTickerControls(documentRef, page, activeTab = 'overview', requestedRange = '1m', state = null) {
  if (!page) return;
  const tab = activeTab === 'chart' ? 'chart' : 'overview';
  const range = TICKER_CHART_RANGES[requestedRange] ? requestedRange : '1m';
  page.dataset.activeTickerTab = tab;
  page.dataset.activeTickerRange = range;
  page.querySelectorAll?.('[data-ticker-tab]').forEach((button) => {
    const selected = button.getAttribute('data-ticker-tab') === tab;
    button.classList?.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  // P1449 (검토판·가격 기간): a range tab is clickable only when the available history can actually
  // span it. Being available decides the truth — the 1M/3M/6M/1Y tabs all showing the same few
  // observations read as "선택 기간 ≠ 확보 기간", which is exactly what the review caught.
  const ordered = (Array.isArray(state?.history) ? state.history : [])
    .map((row) => finite(canonicalEpochMs(row?.epochMs ?? row?.time ?? row?.date ?? row?.timestamp)))
    .filter((value) => value != null)
    .sort((left, right) => left - right);
  const availableDays = ordered.length >= 2 ? Math.round((ordered.at(-1) - ordered[0]) / DAY_MS) : 0;
  page.querySelectorAll?.('[data-ticker-range]').forEach((button) => {
    const key = button.getAttribute('data-ticker-range');
    const selected = key === range;
    button.classList?.toggle('active', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const tooShort = TICKER_CHART_RANGES[key] && availableDays > 0 && TICKER_CHART_RANGES[key].days > availableDays;
    if (tooShort) {
      button.setAttribute('disabled', 'disabled');
      button.setAttribute('aria-disabled', 'true');
      button.title = `확보된 가격 이력이 ${availableDays}일분입니다 — ${TICKER_CHART_RANGES[key].label} 관측 요구(${TICKER_CHART_RANGES[key].days}일)를 채우지 못해 비활성화했습니다(선택 기간과 확보 기간을 구분합니다).`;
    } else {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-disabled');
      button.title = '';
    }
  });
  const overview = documentRef?.getElementById('tab-overview');
  const chart = documentRef?.getElementById('tab-chart');
  if (overview) overview.style.display = tab === 'overview' ? '' : 'none';
  if (chart) chart.style.display = tab === 'chart' ? '' : 'none';
}

function renderTickerChart({ root, page, state, charts, requestedRange = '1m' }) {
  const canvas = page?.querySelector?.('#ticker-price-chart');
  if (!canvas) return;
  const range = TICKER_CHART_RANGES[requestedRange] ? requestedRange : '1m';
  // Codex browser audit H28: the summary said "이력 미수신 · 차트 보류" while the chart tab drew the same stock's
  // daily bars. When the entity history is too short, the summary uses those completed daily bars.
  const symbol = String(state?.id || '').toUpperCase();
  const ownHistory = Array.isArray(state?.history) ? state.history : [];
  const dailyBars = root?._technicalOHLCV?.[symbol] || root?._tickerHistory?.[symbol] || [];
  const historySource = ownHistory.length >= 2 ? ownHistory : (Array.isArray(dailyBars) ? dailyBars : []);
  const view = selectTickerChartWindow(historySource, range);
  const rows = view.rows;
  const ChartConstructor = root?.Chart;
  const unavailable = rows.length < 2 || typeof ChartConstructor !== 'function';
  const signature = `${range}|${rows.map((row) => `${row.epochMs}:${row.close}`).join('|')}`;
  const periodLabel = TICKER_CHART_RANGES[range].label;
  const periodMeta = unavailable
    ? `${state?.id || '종목'} ${periodLabel} 가격 이력을 아직 받지 못했습니다 — 차트 탭의 일봉이 열리면 이곳에도 같은 이력이 그려집니다`
    // P1255 (07:M04 계열 잔여 D4): 차트는 close 계열(배당 미조정)이다 — "수익률"과 섞이지 않도록
    // 가격 기준을 메타에 함께 말한다(분할 반영 여부는 공급자 관례에 의존, 미검증).
    : `${periodLabel} · ${view.rowCount}개 관측 · ${formatTickerChartDate(view.startEpochMs)} ~ ${formatTickerChartDate(view.endEpochMs)} · 가격 기준 close(배당 미조정 price return · 분할 반영 여부 미검증)`;
  canvas.dataset.aioTickerChartRenderer = 'native';
  canvas.dataset.sourceKind = unavailable ? 'unavailable' : 'native-runtime';
  canvas.dataset.sourceLabel = unavailable ? 'entity-history-unavailable' : 'native:entity-history';
  canvas.dataset.operationalUse = 'reference-only';
  canvas.dataset.tickerChartRange = range;
  canvas.dataset.tickerChartRowCount = String(view.rowCount);
  canvas.dataset.tickerChartStart = formatTickerChartDate(view.startEpochMs);
  canvas.dataset.tickerChartEnd = formatTickerChartDate(view.endEpochMs);
  canvas.setAttribute('aria-label', periodMeta);
  canvas.setAttribute('title', periodMeta);
  const meta = page.querySelector?.('#ticker-chart-meta');
  if (meta) meta.textContent = periodMeta;
  const loading = page.querySelector('#ticker-chart-loading');
  // P1591 (S02): without a price history the 380px frame and period buttons stay empty and repeat the same
  // sentence; the box collapses to one line and the buttons hide until rows arrive.
  const box = canvas.parentElement;
  const tabs = page.querySelector?.('#ticker-chart-period-tabs');
  if (box) box.style.height = unavailable ? '44px' : '380px';
  if (tabs) tabs.hidden = unavailable;
  if (unavailable) {
    charts.destroy('ticker-price-chart');
    if (meta) meta.textContent = '';
    if (loading) {
      loading.style.display = 'flex';
      loading.textContent = periodMeta;
    }
    return;
  }
  if (charts.get('ticker-price-chart')?.signature === signature) return;
  charts.destroy('ticker-price-chart');
  try {
    const labels = rows.map((row) => formatTickerChartDate(row.epochMs));
    const prices = rows.map((row) => finite(row.close));
    const isUp = prices.at(-1) >= prices[0];
    const chart = new ChartConstructor(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: state?.id || '가격', data: prices, borderColor: isUp ? '#22754c' : '#b13a30', backgroundColor: isUp ? 'rgba(34,117,76,0.14)' : 'rgba(177,58,48,0.14)', borderWidth: 1.6, pointRadius: 0, tension: 0.2, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } }, y: { ticks: { maxTicksLimit: 4 } } } }
    });
    charts.set('ticker-price-chart', { chart, signature, canvas });
    if (loading) loading.style.display = 'none';
  } catch (_) {
    charts.destroy('ticker-price-chart');
    if (loading) { loading.style.display = 'flex'; loading.textContent = `${state?.id || '종목'} ${periodLabel} 차트 런타임 실패 · 차트 보류`; }
  }
}

function renderFundamentalStatus(documentRef, state) {
  const element = documentRef?.getElementById('fund-data-status');
  if (!element) return;
  const fundamentals = state?.fundamentals;
  const available = !!fundamentals && typeof fundamentals === 'object'
    && Array.isArray(fundamentals.coverage) && fundamentals.coverage.length > 0;
  const observedAt = fundamentals?.observedAt || fundamentals?.filedAt || null;
  const unselected = !String(state?.id || '').trim(); // P1365: no selection ≠ SEC 미수신.
  element.textContent = available ? `● SEC 연간 공시 · ${observedAt ? `기준 ${String(observedAt).slice(0, 10)}` : '기준일 미수신'}` : unselected ? '○ 종목 선택 전' : '○ SEC 데이터 미수신';
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
    : !String(state?.id || '').trim() ? '종목 선택 전 · 선택 기업의 SEC 연간 재무 해석 없음' : 'SEC 연간 재무 데이터 수신 대기 · 해석 보류';
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
    source.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:10px;line-height:1.35;';
    card.appendChild(source);
    grid.appendChild(card);
  }
}

function formatSecMetric(metric) {
  if (metric?.value == null) return '—';
  // P1591: compact units like the fiscal reading ($215.9B), not raw dollars; the exact value stays in the tooltip.
  const compact = (v) => { const a = Math.abs(v); return a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a.toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  if (metric.unit === 'currency') return `${metric.value < 0 ? '-' : ''}$${compact(metric.value)}`;
  if (metric.unit === 'shares') return `${compact(metric.value)}주`;
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

// P1449: the arrival note for a learning link — user vocabulary only (ROIC·CAPEX·FCF 본 labels);
// a metric this page does not present keeps the note hidden instead of leaking a raw id.
const FUNDAMENTAL_METRIC_LABELS = Object.freeze({
  // P1593 (F98): the column links send these ids; without them the arrival line stayed hidden.
  fcf_roic: '번 돈이 현금으로 남는지(잉여현금흐름)와 투입한 자본 대비 얼마나 버는지(ROIC)',
  dcf_expectations: '지금 주가가 가정하는 성장과 마진(역산 DCF) — 아래 매출·이익률 추이와 비교',
  roe: 'ROE(자본 효율)',
  revenue: '매출',
  margin: '순이익률',
  pe: 'PER(밸류에이션)',
  pb: 'PBR',
  ocf: '영업현금흐름',
  capex: '설비투자(CAPEX)',
  fcf: '잉여현금흐름(FCF)',
  roic: 'ROIC(투하자본 수익률)',
  debt: '부채',
  shares: '주식 수'
});
function renderFundamentalArrival(documentRef, { metric, question, symbol, fromRoute, timeframe = null, returnContext = null, root = null }) {
  const note = documentRef?.getElementById('fund-arrival-question');
  if (!note) return;
  note.querySelector?.('.fund-arrival-return')?.remove?.();
  const metricLabel = metric ? FUNDAMENTAL_METRIC_LABELS[String(metric).toLowerCase()] || null : null;
  const text = metricLabel || question;
  if (!text) { note.hidden = true; return; }
  const period = { TTM_3Y: '최근 12개월과 3년', '5Y': '5년', '3Y_5Y': '3~5년' }[String(timeframe || '')] || null;
  note.textContent = `${fromRoute ? `${fromRoute} 링크에서 넘어온 확인 대상: ` : '이 화면으로 건너온 확인 대상: '}${text}${period ? ` · 볼 기간 ${period}` : ''}${symbol ? ` · 대상 종목 ${symbol}(아래 보고에서 함께 확인)` : ' · 종목을 선택해 아래 보고에서 함께 확인하세요'}${metricLabel && question ? ` — ${question}` : ''}`;
  if (returnContext?.route) {
    const back = documentRef.createElement('button');
    back.type = 'button';
    back.className = 'aio-btn-table fund-arrival-return';
    back.style.marginLeft = '8px';
    back.textContent = '읽던 이야기로 돌아가기';
    back.addEventListener('click', () => { if (typeof root?.history?.back === 'function') root.history.back(); else root?.showPage?.(returnContext.route); });
    note.appendChild(back);
  }
  note.hidden = false;
}

function renderFundamentalReport(documentRef, page, state) {
  const report = deriveSecReport(state?.fundamentals);
  // P1365: no selected issuer is not an SEC receipt failure; the watchlist below carries SEC rows.
  const unselected = !String(state?.id || '').trim();
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
    // P1591 (S08): the reader line says which report and how old it is; filing ledger details
    // (acceptance time, accession, point-in-time count) move to the tooltip.
    meta.textContent = report.status === 'current'
      ? `${report.form || '연간 보고서'} · 회계연도 말 ${report.observedAt || '—'} · 제출 ${report.filedAt || '—'}${report.freshness?.ageDays != null ? ` · 회계연도 말로부터 ${report.freshness.ageDays}일` : ''}${report.freshness?.state && report.freshness.state !== 'current' ? ' · 최신 연간 보고서 아님' : ''}`
      : unselected ? '선택한 종목 없음 · 티커를 입력하거나 관심종목을 선택하면 해당 기업의 SEC 연간 보고서를 표시합니다'
        : 'SEC 연간 보고서를 아직 받지 못했습니다 · 값이 없는 항목은 추정하지 않습니다';
    if (report.status === 'current') meta.title = [report.filingMetadata?.acceptedAt ? `접수 ${report.filingMetadata.acceptedAt}` : null, report.accession ? `접수번호 ${report.accession}` : null, report.pointInTime?.observationCount ? `시점 기록(PIT) ${report.pointInTime.observationCount}건 (${report.pointInTime.status})` : null].filter(Boolean).join(' · ');
  }
  if (coverage) coverage.textContent = report.status === 'current'
    ? `관측 항목 ${report.coverage.length}개 · ${report.source} · ${report.freshness?.state === 'current' ? '현재 참고 가능' : '과거 참고 전용'}`
    : unselected ? '선택 기업 없음' : '관측 항목 없음';
  if (!grid) return;
  grid.replaceChildren();
  if (report.metrics.length === 0) {
    const empty = documentRef.createElement('div');
    empty.textContent = unselected ? '종목을 선택하면 핵심 재무 지표가 표시됩니다.' : '공식 SEC annual fact가 수신되면 핵심 재무 지표가 표시됩니다.';
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
function render({ root, documentRef, store, route, charts, activeTickerTab = 'overview', tickerChartRange = '1m' }) {
  const state = selectEntityState(store.getState());
  const portfolioState = selectPortfolioState(store.getState());
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
    routeNode.dataset.aioArchitectureRoute = route;
    routeNode.dataset.aioArchitectureSlice = 'entity';
    routeNode.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    if (route === 'ticker' || route === 'fundamental') routeNode.dataset.aioArchitectureRenderer = 'native';
  }
  if (route === 'ticker') {
    renderTickerHero(documentRef, state, root);
    renderTickerSecondarySymbols(documentRef, state, root);
    renderTickerActivity(documentRef, root, state, portfolioState);
    renderTickerNavigation(documentRef, state, root);
    renderTickerControls(documentRef, routeNode, activeTickerTab, tickerChartRange, state);
    renderTickerChart({ root, page: routeNode, state, charts, requestedRange: tickerChartRange });
    renderStockRead({ documentRef, root, symbol: state?.id || root?._currentTickerId || '' }); // P1434
  }
  if (route === 'fundamental') {
    // P1430: 재무 공시 is the same company as 요약 · 차트.
    if (state?.id) setStockSubject({ root, documentRef, symbol: state.id, name: state.name && state.name !== state.id ? state.name : '' });
    // P1449 (검토판 9): a learning link (ROIC · CAPEX · FCF) that arrives must say what it
    // came to check and on which company — the route opened is not the same as the question
    // continuing. One-shot consume; unknown metrics show nothing rather than dev vocabulary.
    const handoff = consumeResearchHandoff({ root, routeId: 'fundamental' });
    const knowledge = parseKnowledgeTargetContext({ root });
    const arrivingTicker = handoff?.context?.ticker || null;
    if (arrivingTicker) setStockSubject({ root, documentRef, symbol: arrivingTicker });
    renderFundamentalArrival(documentRef, {
      metric: handoff?.context?.metric || knowledge?.metric || null,
      question: handoff?.context?.question || null,
      symbol: state?.id || arrivingTicker || null,
      fromRoute: handoff?.fromRoute || (knowledge ? '리서치 라이브러리' : null),
      timeframe: knowledge?.timeframe || null,
      returnContext: knowledge?.returnContext || null,
      root
    });
    renderFundamentalStatus(documentRef, state);
    renderFundamentalSummary(documentRef, state);
    renderFundamentalWatchlist(documentRef, state);
    renderFundamentalReport(documentRef, routeNode, state);
    renderFiscalRead({ documentRef, root, state }); // P1436
  }
}

export function createEntityPage({ root = globalThis, documentRef, store, route = 'ticker' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 520 });
      bag.add(charts.dispose);
      let activeTickerTab = 'overview';
      let tickerChartRange = '1m';
      const renderNow = () => render({ root, documentRef, store, route, charts, activeTickerTab, tickerChartRange });
      renderNow();
      bag.add(subscribeToSlices(store, ['entity', 'portfolio'], renderNow));
      const eventTarget = documentRef || globalThis;
      const refresh = () => renderNow();
      const onPageShown = (event) => {
        const detail = event?.detail;
        const shownRoute = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
        if (route === 'ticker' && shownRoute === 'ticker') refresh();
      };
      // P1430: 재무 공시 opened from 요약 · 차트 loads the company those tabs show (the legacy search owns
      // the input and the full report). Leaving the entity routes clears the selection, so the subject
      // (display continuity) re-requests it on mount unless that company's report was already requested.
      if (route === 'fundamental') {
        const subject = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
        // P1593 (F107/E04): compare against the company actually loaded, not the last one ever requested — leaving
        // the entity routes clears the selection, and the old guard then left '종목 선택 전' beside the same ticker.
        const loaded = String(selectEntityState(store.getState())?.id || '').trim().toUpperCase();
        if (subject && loaded !== subject && typeof root?._aioFundSearchFill === 'function') {
          root._aioFundRequestedSymbol = subject;
          const timer = setTimeout(() => root._aioFundSearchFill(subject), 0);
          bag.add(() => clearTimeout(timer));
        }
      }
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
        const onTickerControlClick = (event) => {
          const tabButton = event?.target?.closest?.('[data-ticker-tab]');
          const rangeButton = event?.target?.closest?.('[data-ticker-range]');
          if (!tabButton && !rangeButton) return;
          if (tabButton) activeTickerTab = tabButton.getAttribute('data-ticker-tab') === 'chart' ? 'chart' : 'overview';
          if (rangeButton) {
            const requested = rangeButton.getAttribute('data-ticker-range');
            if (TICKER_CHART_RANGES[requested]) tickerChartRange = requested;
            activeTickerTab = 'chart';
          }
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          refresh();
        };
        const onTickerControlKeydown = (event) => {
          const tabButton = event?.target?.closest?.('[data-ticker-tab]');
          if (!tabButton || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event?.key)) return;
          const tabs = [...page?.querySelectorAll?.('[data-ticker-tab]') || []];
          if (!tabs.length) return;
          const current = Math.max(0, tabs.indexOf(tabButton));
          const next = event.key === 'Home' ? 0
            : event.key === 'End' ? tabs.length - 1
              : event.key === 'ArrowRight' ? (current + 1) % tabs.length
                : (current - 1 + tabs.length) % tabs.length;
          event.preventDefault?.();
          activeTickerTab = tabs[next]?.getAttribute('data-ticker-tab') === 'chart' ? 'chart' : 'overview';
          refresh();
          tabs[next]?.focus?.();
        };
        const resetTickerView = () => {
          activeTickerTab = 'overview';
          tickerChartRange = '1m';
          refresh();
        };
        eventTarget?.addEventListener?.('click', onTickerControlClick, true);
        eventTarget?.addEventListener?.('keydown', onTickerControlKeydown, true);
        eventTarget?.addEventListener?.('aio:tickerViewReset', resetTickerView);
        bag.add(() => eventTarget?.removeEventListener?.('click', onTickerControlClick, true));
        bag.add(() => eventTarget?.removeEventListener?.('keydown', onTickerControlKeydown, true));
        bag.add(() => eventTarget?.removeEventListener?.('aio:tickerViewReset', resetTickerView));
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
          if (page?.dataset.activeTickerTab) delete page.dataset.activeTickerTab;
          if (page?.dataset.activeTickerRange) delete page.dataset.activeTickerRange;
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
