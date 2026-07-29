import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { derivePortfolioSurface } from '../../domain/portfolio/surface.js';

// RM-01 (2026-07-19): this module used to fully repaint pf-total-value/pf-total-pnl/etc. and
// replaceChildren() the pf-positions-tbody table with a 5-column row, while legacy
// (js/aio-ui.js liveEls + an inline index.html script at :12742/:12928-:12952) kept writing the
// same ids/table with the real column set. That is the highest-severity contested container in
// F-03/route-owners.json: whichever writer runs last wins the race, and native losing means the
// table silently shrinks. P780 transfers only the independently owned pf-analysis-status
// readiness text. P810 adds a bounded native hero projection for total value and total P/L;
// P830 transfers the Vault-backed nine-column holdings table. Prices, risk, AI workbench,
// and chart surfaces remain separately legacy-owned.
function renderPortfolioStatus(documentRef, state) {
  const element = documentRef?.getElementById('pf-analysis-status');
  if (!element) return;
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const current = state?.status === 'current' && holdings.length > 0;
  element.textContent = current
    ? `리스크 계산 입력 수신 · ${holdings.length}개 포지션`
    : state?.status === 'empty' ? '포트폴리오 등록 후 자동 계산됩니다.' : '포트폴리오 데이터 수신 대기';
  element.setAttribute('data-source-kind', current ? 'portfolio-state' : 'unavailable');
  element.setAttribute('data-source-label', current ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  element.setAttribute('data-operational-use', 'reference-only');
  if (state?.updatedAt) element.setAttribute('data-observed-at', state.updatedAt);
  else element.removeAttribute('data-observed-at');
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value) {
  return value == null ? '—' : `$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function renderPortfolioHero(documentRef, state) {
  const valueElement = documentRef?.getElementById('pf-total-value');
  const pnlElement = documentRef?.getElementById('pf-total-pnl');
  if (!valueElement && !pnlElement) return;
  const totals = state?.totals && typeof state.totals === 'object' ? state.totals : {};
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const holdingValue = holdings.reduce((sum, holding) => sum + (finite(holding?.value) ?? 0), 0);
  const cash = finite(state?.cash) ?? 0;
  const totalValue = finite(totals.totalAssets ?? totals.totalValue ?? totals.value) ?? (holdingValue + cash || null);
  const holdingCost = holdings.reduce((sum, holding) => {
    const shares = finite(holding?.shares);
    const avgCost = finite(holding?.avgCost);
    return sum + (shares != null && avgCost != null ? shares * avgCost : 0);
  }, 0);
  const totalPnl = finite(totals.totalPnl ?? totals.pnl ?? totals.profitLoss) ?? (holdingValue - holdingCost || null);
  if (valueElement) {
    valueElement.textContent = formatMoney(totalValue);
    valueElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    valueElement.setAttribute('data-source-kind', totalValue == null ? 'unavailable' : 'portfolio-state');
    valueElement.setAttribute('data-source-label', totalValue == null ? 'portfolio-value-unavailable' : 'native-portfolio-totals');
    valueElement.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlElement) {
    pnlElement.textContent = totalPnl == null ? '—' : `${totalPnl >= 0 ? '+' : '-'}${formatMoney(totalPnl)}`;
    pnlElement.style.color = totalPnl == null ? 'var(--text-dim)' : totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
    pnlElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    pnlElement.setAttribute('data-source-kind', totalPnl == null ? 'unavailable' : 'portfolio-state');
    pnlElement.setAttribute('data-source-label', totalPnl == null ? 'portfolio-pnl-unavailable' : 'native-portfolio-totals');
    pnlElement.setAttribute('data-operational-use', 'reference-only');
  }
}

function formatSurfaceMoney(value) {
  if (value == null) return '—';
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function markSurfaceElement(element, value, sourceKind, sourceLabel, observedAt) {
  if (!element) return;
  element.dataset.aioPortfolioSurfaceRenderer = 'native';
  element.dataset.sourceKind = value == null ? 'unavailable' : sourceKind;
  element.dataset.sourceLabel = value == null ? 'portfolio-surface-unavailable' : sourceLabel;
  element.dataset.operationalUse = 'reference-only';
  if (observedAt) element.dataset.observedAt = observedAt;
  else delete element.dataset.observedAt;
}

function setSurfaceText(documentRef, id, text, value, surface, color = null) {
  const element = documentRef?.getElementById(id);
  if (!element) return;
  element.textContent = text;
  if (color) element.style.color = color;
  markSurfaceElement(element, value, surface.sourceKind, surface.sourceLabel, surface.observedAt);
}

function sectorLabel(name) {
  const labels = {
    Technology: '테크', Healthcare: '헬스', 'Financial Services': '금융', Financials: '금융',
    'Consumer Cyclical': '임의소비', Energy: '에너지', Industrials: '산업재',
    'Consumer Defensive': '필수소비', 'Communication Services': '통신', Utilities: '유틸',
    'Real Estate': '리츠', 'Basic Materials': '소재', CASH: '현금', Unclassified: '미분류'
  };
  return labels[name] || name;
}

function renderPortfolioSurface(documentRef, page, root, state) {
  if (!page) return;
  const liveData = root?._liveData || {};
  const vix = finite(liveData?.['^VIX']?.price);
  const surface = derivePortfolioSurface({ state, liveData, vix });
  page.dataset.aioPortfolioSurface = 'native';
  page.dataset.aioPortfolioSurfaceModel = surface.modelVersion;
  setSurfaceText(documentRef, 'pf-holding-count', surface.holdingCount ? `${surface.holdingCount} 종목` : '—', surface.holdingCount || null, surface);
  setSurfaceText(documentRef, 'pf-total-pnl-pct', surface.totalPnlPct == null ? '—' : `${surface.totalPnlPct >= 0 ? '+' : ''}${surface.totalPnlPct.toFixed(1)}%`, surface.totalPnlPct, surface, surface.totalPnl == null ? 'var(--text-dim)' : surface.totalPnl >= 0 ? 'var(--green)' : 'var(--red)');
  setSurfaceText(documentRef, 'pf-daily-chg', formatSurfaceMoney(surface.dailyChange), surface.dailyChange, surface, surface.dailyChange == null ? 'var(--text-dim)' : surface.dailyChange >= 0 ? 'var(--green)' : 'var(--red)');
  setSurfaceText(documentRef, 'pf-daily-pct', surface.dailyPct == null ? '—' : `${surface.dailyPct >= 0 ? '+' : ''}${surface.dailyPct.toFixed(2)}% today`, surface.dailyPct, surface, surface.dailyChange == null ? 'var(--text-dim)' : surface.dailyChange >= 0 ? 'var(--green)' : 'var(--red)');
  setSurfaceText(documentRef, 'pf-cash-hero', formatSurfaceMoney(surface.cash), surface.cash, surface);
  setSurfaceText(documentRef, 'pf-cash-pct-hero', surface.cashPct == null ? '—' : `${surface.cashPct.toFixed(1)}%`, surface.cashPct, surface);
  const rule = surface.exposureCap == null ? 'VIX 확인 중' : `VIX ${surface.vix.toFixed(1)} · 최대 ${surface.exposureCap}%`;
  setSurfaceText(documentRef, 'pf-exposure-rule', rule, surface.exposureCap, surface);
  const current = surface.exposurePct == null ? '현재 노출 —' : `현재 노출 ${surface.exposurePct.toFixed(1)}%${surface.exposureExceeded ? ' · 축소 필요' : ''}`;
  setSurfaceText(documentRef, 'pf-exposure-current', current, surface.exposurePct, surface, surface.exposureExceeded ? 'var(--data-red)' : 'var(--text-dim)');

  const sectorElement = documentRef?.getElementById('pf-sector-breakdown');
  if (sectorElement) {
    sectorElement.replaceChildren();
    sectorElement.dataset.aioPortfolioSurfaceRenderer = 'native';
    sectorElement.dataset.sourceKind = surface.sectorBreakdown.length ? surface.sourceKind : 'unavailable';
    sectorElement.dataset.sourceLabel = surface.sectorBreakdown.length ? surface.sourceLabel : 'portfolio-sector-unavailable';
    sectorElement.dataset.operationalUse = 'reference-only';
    if (surface.sectorBreakdown.length) {
      for (const sector of surface.sectorBreakdown) {
        const row = documentRef.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px;';
        const label = documentRef.createElement('span');
        label.textContent = sectorLabel(sector.name);
        label.style.cssText = 'width:56px;font-size:11px;color:var(--text-secondary);text-align:right;flex-shrink:0;font-weight:600;';
        const track = documentRef.createElement('div');
        track.style.cssText = 'flex:1;height:14px;background:var(--surface-3);border-radius:4px;overflow:hidden;';
        const bar = documentRef.createElement('div');
        bar.style.cssText = `height:100%;width:${Math.max(0, Math.min(100, sector.pct))}%;background:var(--text-secondary);border-radius:4px;`;
        track.appendChild(bar);
        const pct = documentRef.createElement('span');
        pct.textContent = `${sector.pct.toFixed(0)}%`;
        pct.style.cssText = 'width:42px;font-size:12px;font-family:var(--font-mono);color:var(--text-secondary);font-weight:700;text-align:right;';
        row.append(label, track, pct);
        sectorElement.appendChild(row);
      }
    } else {
      const empty = documentRef.createElement('div');
      empty.textContent = '포트폴리오 데이터 수신을 기다리는 중입니다';
      empty.style.cssText = 'font-size:12px;color:var(--text-muted);padding:4px 0;';
      sectorElement.appendChild(empty);
    }
  }
}

function tableCell(documentRef, headerId, value, style = '') {
  const cell = documentRef.createElement('td');
  cell.setAttribute('headers', headerId);
  cell.style.cssText = style;
  cell.textContent = value;
  return cell;
}

function renderPortfolioTable(documentRef, page, state) {
  const tbody = page?.querySelector?.('#pf-positions-tbody');
  if (!tbody) return;
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const rows = holdings.map((holding) => {
    const symbol = String(holding?.symbol || '').toUpperCase();
    const shares = finite(holding?.shares);
    const avgCost = finite(holding?.avgCost);
    const price = finite(holding?.price);
    const value = finite(holding?.value) ?? (price != null && shares != null ? price * shares : null);
    const costValue = avgCost != null && shares != null ? avgCost * shares : null;
    const pnl = value != null && costValue != null ? value - costValue : null;
    const pnlPct = pnl != null && costValue > 0 ? pnl / costValue * 100 : null;
    return { holding, symbol, shares, avgCost, price, value, costValue, pnl, pnlPct };
  });
  const totalValue = rows.reduce((sum, row) => sum + (row.value != null ? row.value : 0), 0);
  tbody.replaceChildren();
  tbody.dataset.aioPortfolioTableRenderer = 'native';
  tbody.setAttribute('data-source-kind', rows.length ? 'portfolio-state' : 'unavailable');
  tbody.setAttribute('data-source-label', rows.length ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  tbody.setAttribute('data-operational-use', 'reference-only');
  if (!rows.length) {
    const row = documentRef.createElement('tr');
    row.className = 'pf-empty-state';
    const cell = documentRef.createElement('td');
    cell.colSpan = 9;
    cell.style.cssText = 'padding:28px 16px;text-align:center;color:var(--text-muted);font-size:12px;line-height:1.8;';
    const heading = documentRef.createElement('div');
    heading.textContent = '포트폴리오가 비어 있습니다';
    heading.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;';
    const body = documentRef.createElement('div');
    body.textContent = '티커 · 수량 · 매수 단가를 입력하면 보유 현황과 리스크 분석이 시작됩니다.';
    const addButton = documentRef.createElement('button');
    addButton.className = 'aio-btn-table primary';
    addButton.setAttribute('data-action', '_aioTogglePortfolioEntry');
    addButton.style.cssText = 'margin-top:10px;min-height:36px;padding:7px 16px;';
    addButton.textContent = '첫 종목 추가';
    const privacy = documentRef.createElement('div');
    privacy.textContent = '데이터는 브라우저에만 저장되며 서버로 전송되지 않습니다. PIN 설정 후 저장 시 AES-256 암호화.';
    privacy.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:6px;';
    cell.append(heading, body, addButton, privacy);
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  rows.forEach((rowData) => {
    const { holding, symbol, shares, avgCost, price, value, pnl, pnlPct } = rowData;
    const row = documentRef.createElement('tr');
    row.style.cssText = 'border-bottom:1px solid var(--border);cursor:pointer;';
    row.setAttribute('data-action', 'showTicker');
    row.setAttribute('data-arg', symbol);
    const tickerCell = documentRef.createElement('td');
    tickerCell.setAttribute('headers', 'pf-th-ticker');
    tickerCell.style.cssText = 'padding:8px 10px;font-size:12px;';
    const ticker = documentRef.createElement('b');
    ticker.textContent = symbol;
    ticker.style.color = 'var(--text-primary)';
    tickerCell.appendChild(ticker);
    if (holding?.memo) {
      const memo = documentRef.createElement('div');
      memo.textContent = String(holding.memo);
      memo.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px;';
      tickerCell.appendChild(memo);
    }
    row.appendChild(tickerCell);
    row.appendChild(tableCell(documentRef, 'pf-th-qty', shares == null ? '—' : String(shares), 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;'));
    row.appendChild(tableCell(documentRef, 'pf-th-cost', avgCost == null ? '—' : `$${avgCost.toFixed(2)}`, 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;'));
    row.appendChild(tableCell(documentRef, 'pf-th-price', price == null ? '—' : `$${price.toFixed(2)}`, 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;color:var(--text-primary);'));
    const pnlCell = tableCell(documentRef, 'pf-th-pnl', pnl == null ? '—' : `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;font-weight:700;');
    pnlCell.style.color = pnl == null ? 'var(--text-muted)' : pnl >= 0 ? 'var(--green)' : 'var(--red)';
    row.appendChild(pnlCell);
    const pctCell = tableCell(documentRef, 'pf-th-pct', pnlPct == null ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`, 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;font-weight:700;');
    pctCell.style.color = pnlPct == null ? 'var(--text-muted)' : pnlPct >= 0 ? 'var(--green)' : 'var(--red)';
    row.appendChild(pctCell);
    const targetCell = tableCell(documentRef, 'pf-th-target', finite(holding?.target) == null ? '미설정' : `$${finite(holding.target).toFixed(2)}`, 'text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;');
    if (finite(holding?.target) != null && price != null && price > 0) {
      const upside = (finite(holding.target) - price) / price * 100;
      const upsideNode = documentRef.createElement('div');
      upsideNode.textContent = `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`;
      upsideNode.style.cssText = `font-size:10px;color:${upside >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600;`;
      targetCell.appendChild(upsideNode);
    }
    row.appendChild(targetCell);
    row.appendChild(tableCell(documentRef, 'pf-th-weight', totalValue > 0 && value != null ? `${(value / totalValue * 100).toFixed(1)}%` : '—', 'text-align:center;padding:8px 6px;font-size:11px;font-weight:700;'));
    const manageCell = documentRef.createElement('td');
    manageCell.setAttribute('headers', 'pf-th-manage');
    manageCell.style.cssText = 'text-align:center;padding:8px 6px;white-space:nowrap;';
    [['차트', '_aioTechnicalTicker'], ['수정', '_aioEditPosition'], ['삭제', '_aioRemovePosition']].forEach(([label, action]) => {
      const button = documentRef.createElement('button');
      button.setAttribute('data-action', action);
      button.setAttribute('data-arg', symbol);
      button.setAttribute('data-stop', '1');
      button.setAttribute('aria-label', `${symbol} ${label}`);
      button.title = label;
      button.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;';
      button.textContent = label;
      manageCell.appendChild(button);
    });
    row.appendChild(manageCell);
    tbody.appendChild(row);
  });
}

function renderPortfolioChart({ root, page, state, charts }) {
  const canvas = page?.querySelector?.('#pf-position-donut');
  if (!canvas) return;
  const holdings = (Array.isArray(state?.holdings) ? state.holdings : []).map((holding) => {
    const shares = finite(holding?.shares);
    const price = finite(holding?.price);
    return { symbol: String(holding?.symbol || '').toUpperCase(), value: shares != null && price != null && price > 0 ? shares * price : null };
  }).filter((item) => item.symbol && item.value != null && item.value > 0);
  const total = holdings.reduce((sum, item) => sum + item.value, 0);
  const ChartConstructor = root?.Chart;
  const unavailable = !holdings.length || !(total > 0) || typeof ChartConstructor !== 'function';
  const signature = holdings.map((item) => `${item.symbol}:${item.value}`).join('|');
  canvas.dataset.aioPortfolioChartRenderer = 'native';
  canvas.dataset.sourceKind = unavailable ? 'unavailable' : 'portfolio-state';
  canvas.dataset.sourceLabel = unavailable ? 'portfolio-chart-input-unavailable' : 'native:portfolio-state';
  canvas.dataset.operationalUse = 'reference-only';
  const loading = page.querySelector('#pf-donut-legend');
  if (unavailable) {
    charts.destroy('pf-position-donut');
    if (loading) loading.textContent = '포트폴리오 시세 수신 대기 · 차트 보류';
    return;
  }
  if (charts.get('pf-position-donut')?.signature === signature) return;
  charts.destroy('pf-position-donut');
  try {
    const colors = ['#211d16', '#57513f', '#8a8271', '#6f695e', '#a29a89', '#3d3830', '#b8b0a0'];
    const chart = new ChartConstructor(canvas, {
      type: 'doughnut',
      data: { labels: holdings.map((item) => item.symbol), datasets: [{ data: holdings.map((item) => item.value), backgroundColor: holdings.map((_, index) => colors[index % colors.length]), borderColor: '#fbf9f5', borderWidth: 1 }] },
      options: { responsive: false, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.label}: ${(context.parsed / total * 100).toFixed(1)}%` } } } }
    });
    charts.set('pf-position-donut', { chart, signature });
    if (loading) loading.textContent = holdings.slice(0, 8).map((item) => `${item.symbol} ${(item.value / total * 100).toFixed(1)}%`).join(' · ');
  } catch (_) {
    charts.destroy('pf-position-donut');
    if (loading) loading.textContent = '포트폴리오 차트 런타임 실패 · 차트 보류';
  }
}

function render({ root, documentRef, store, charts }) {
  const state = selectPortfolioState(store.getState());
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureSlice = 'portfolio';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    page.dataset.aioArchitectureRenderer = 'native';
  }
  renderPortfolioSurface(documentRef, page, root, state);
  renderPortfolioHero(documentRef, state);
  renderPortfolioStatus(documentRef, state);
  renderPortfolioTable(documentRef, page, state);
  renderPortfolioChart({ root, page, state, charts });
}

export function createPortfolioPage({ root = globalThis, documentRef, store } = {}) {
  return {
    route: 'portfolio',
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 260 });
      bag.add(charts.dispose);
      const renderNow = () => render({ root, documentRef, store, charts });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      const page = documentRef?.getElementById('page-portfolio');
      const table = page?.querySelector?.('#pf-positions-tbody');
      if (page) page.dataset.aioPortfolioSurface = 'native';
      if (page) page.dataset.aioPortfolioChartRenderer = 'native';
      if (table) table.dataset.aioPortfolioTableRenderer = 'native';
      ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
        const element = documentRef?.getElementById(id);
        if (element) element.setAttribute('data-aio-portfolio-hero-renderer', 'native');
      });
      bag.add(() => {
        if (table?.dataset.aioPortfolioTableRenderer === 'native') delete table.dataset.aioPortfolioTableRenderer;
        const chartCanvas = documentRef?.getElementById('pf-position-donut');
        if (chartCanvas?.dataset.aioPortfolioChartRenderer === 'native') {
          delete chartCanvas.dataset.aioPortfolioChartRenderer;
          delete chartCanvas.dataset.sourceKind;
          delete chartCanvas.dataset.sourceLabel;
          delete chartCanvas.dataset.operationalUse;
        }
        ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
          const element = documentRef?.getElementById(id);
          if (element?.dataset.aioPortfolioHeroRenderer === 'native') delete element.dataset.aioPortfolioHeroRenderer;
        });
        if (page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
        if (page?.dataset.aioPortfolioSurface === 'native') delete page.dataset.aioPortfolioSurface;
        if (page?.dataset.aioPortfolioChartRenderer === 'native') delete page.dataset.aioPortfolioChartRenderer;
        if (page?.dataset.aioPortfolioSurfaceModel) delete page.dataset.aioPortfolioSurfaceModel;
        page?.querySelectorAll?.('[data-aio-portfolio-surface-renderer="native"], [data-aioPortfolioSurfaceRenderer="native"]')?.forEach((element) => {
          delete element.dataset.aioPortfolioSurfaceRenderer;
          delete element.dataset.sourceKind;
          delete element.dataset.sourceLabel;
          delete element.dataset.operationalUse;
          delete element.dataset.observedAt;
        });
      });
      return () => bag.dispose();
    }
  };
}
