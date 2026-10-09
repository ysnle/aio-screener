import { createResourceBag } from '../../app/lifecycle.js';
import { selectSelectedThemeDetail, selectThemesItems } from '../../state/selectors/themes.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { renderThemeStrength } from '../components/theme-strength.js';
import {
  AI_INFERENCE_EFFICIENCY_REFERENCE,
  AI_INFERENCE_ARCHITECTURE_REFERENCE,
  AI_INFRASTRUCTURE_REFERENCE_LENSES,
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE,
  AI_DEAL_ECOSYSTEM_EDGES,
  AI_DEAL_ECOSYSTEM_NODES,
  selectAiInferenceProxies
} from '../../domain/ai/inference-efficiency.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { rotationFlow, themeDetailFlow } from '../../domain/market/page-flow.js';
import { krThemeArtifactRead } from '../../domain/themes/kr-themes.js';
import { buildGroupStrength } from '../../domain/themes/group-strength.js';
import { benchmarkReturns } from '../components/theme-strength.js';
import { readMarketRegime } from '../components/market-regime.js';
import { renderNextSteps } from '../components/page-flow.js';

const QUADRANTS = Object.freeze([
  { key: 'Leading', label: '선도', sub: '상대강도 우위', note: '상대강도·모멘텀 모두 우위' },
  { key: 'Improving', label: '개선', sub: '개선 관찰', note: '상대모멘텀 개선 중' },
  { key: 'Weakening', label: '약화', sub: '둔화 관찰', note: '상대강도 대비 모멘텀 둔화' },
  { key: 'Lagging', label: '후행', sub: '상대 약세', note: '상대강도·모멘텀 모두 열위' }
]);

function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function activeView(root) {
  const value = String(root?._rrgViewMode || 'sectors');
  return value === 'subsectors' || value === 'all' ? value : 'sectors';
}

function viewItems(items, view) {
  if (view === 'all') return items;
  return items.filter((item) => String(item?.view || 'sectors') === view);
}

function renderRRGStatus({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const status = documentRef?.getElementById('rrg-chart-status');
  if (!status) return;
  status.dataset.aioRrgStatusRenderer = 'native';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || '');
    if (Object.prototype.hasOwnProperty.call(counts, quadrant)
      && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) counts[quadrant] += 1;
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!total) {
    status.textContent = items.length
      ? 'RRG 판정 보류 · 상대강도·모멘텀 증거 부족'
      : 'RRG 데이터 수신 대기 · 정규화된 시세 증거를 기다리는 중';
    status.style.color = 'var(--text-muted)';
    return;
  }
  const healthRatio = (counts.Leading + counts.Improving) / total;
  const health = healthRatio >= 0.6 ? '건강한 로테이션' : healthRatio <= 0.3 ? '약세 주도' : '혼재 (방향 탐색 중)';
  status.textContent = `선도:${counts.Leading} 개선:${counts.Improving} 약화:${counts.Weakening} 후행:${counts.Lagging} · ${health}`;
  status.style.color = healthRatio >= 0.6 ? 'var(--data-green)' : healthRatio <= 0.3 ? 'var(--data-red)' : 'var(--text-dim)';
}

function renderRRGCanvas({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const canvas = documentRef?.getElementById('rrg-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  canvas.dataset.aioRrgChartRenderer = 'native';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const validItems = items.filter((item) => finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null);
  const containerWidth = canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 900;
  const width = Math.max(300, containerWidth || 900);
  const height = Math.max(180, Math.min(520, Math.round(width * 0.52)));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const centerX = width / 2;
  const centerY = height / 2;
  context.clearRect(0, 0, width, height);
  context.fillStyle = 'rgba(34,117,76,0.08)'; context.fillRect(centerX, 0, width / 2, centerY);
  context.fillStyle = 'rgba(33,29,22,0.08)'; context.fillRect(0, 0, centerX, centerY);
  context.fillStyle = 'rgba(33,29,22,0.06)'; context.fillRect(centerX, centerY, width / 2, height / 2);
  context.fillStyle = 'rgba(177,58,48,0.06)'; context.fillRect(0, centerY, centerX, height / 2);
  context.strokeStyle = 'rgba(33,29,22,0.10)';
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath(); context.moveTo(centerX, 0); context.lineTo(centerX, height); context.stroke();
  context.beginPath(); context.moveTo(0, centerY); context.lineTo(width, centerY); context.stroke();
  context.setLineDash([]);
  context.font = '11px Inter, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = '#8a8271';
  context.fillText('RS-Ratio →', centerX, height - 8);
  context.save();
  context.translate(16, centerY);
  context.rotate(-Math.PI / 2);
  context.fillText('RS-Momentum ↑', 0, 0);
  context.restore();
  context.font = 'bold 12px Inter, sans-serif';
  context.globalAlpha = 0.75;
  context.fillStyle = '#22754c'; context.fillText('선도 · 강도↑ 모멘텀↑', width * 3 / 4, 22);
  context.fillStyle = '#211d16'; context.fillText('개선 · 강도↓ 모멘텀↑', width / 4, 22);
  context.fillStyle = '#211d16'; context.fillText('약화 · 강도↑ 모멘텀↓', width * 3 / 4, height - 14);
  context.fillStyle = '#b13a30'; context.fillText('후행 · 강도↓ 모멘텀↓', width / 4, height - 14);
  context.globalAlpha = 1;
  if (!validItems.length) {
    context.fillStyle = '#8a8271';
    context.font = '12px Inter, sans-serif';
    context.fillText('정규화된 상대강도·모멘텀 데이터 수신 대기', centerX, centerY);
    return;
  }
  const colors = { Leading: '#22754c', Improving: '#211d16', Weakening: '#a06a12', Lagging: '#b13a30' };
  validItems.forEach((item) => {
    const xNorm = Math.max(-0.95, Math.min(0.95, (item.rsRatio - 100) / 3.5));
    const yNorm = Math.max(-0.95, Math.min(0.95, (item.rsMomentum - 100) / 3.5));
    const x = Math.max(25, Math.min(width - 25, centerX + xNorm * (width / 2 - 40)));
    const y = Math.max(25, Math.min(height - 25, centerY - yNorm * (height / 2 - 40)));
    const color = colors[item.quadrant] || '#8a8271';
    context.beginPath();
    context.arc(x, y, 14, 0, Math.PI * 2);
    context.fillStyle = item.quadrant === 'Lagging' ? 'rgba(177,58,48,0.3)' : 'rgba(33,29,22,0.18)';
    context.fill();
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.stroke();
    context.font = 'bold 11px system-ui';
    context.fillStyle = color;
    context.fillText(String(item.symbol || item.id || ''), x, y - 9);
    if (activeView(root) !== 'all') {
      context.font = '11px system-ui';
      context.fillStyle = '#8a8271';
      context.fillText(String(item.label || ''), x, y + 14);
    }
  });
}

function renderThemeCyclePill({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const pill = documentRef?.getElementById('theme-cycle-pill');
  if (!pill) return;
  pill.dataset.aioThemeCycleRenderer = 'native';
  // P1449/R631: the denominator must be the RENDERED view's population, not a hard-coded
  // sector set. The cards switch between sectors / sub-themes / all items; a pill still
  // reporting the 11-sector denominator while dozens of sub-theme chips render above is the
  // same "summary on another scope" defect P1149 fixed elsewhere.
  const view = activeView(root);
  const viewLabel = { sectors: '섹터', subsectors: '하위 테마', all: '전체 관측' }[view] || '섹터';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), view);
  const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || '');
    if (Object.prototype.hasOwnProperty.call(counts, quadrant)
      && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) counts[quadrant] += 1;
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total < 6) {
    pill.className = 'status-pill sp-neutral';
    pill.textContent = `RRG 관측 보류 · 근거 ${total}개(${viewLabel} 관측 ${items.length}개 중 ${finite(items.length) != null ? `집계 ${total}` : '—'})`;
    return;
  }
  const riskOn = counts.Leading + counts.Improving >= counts.Weakening + counts.Lagging;
  pill.className = `status-pill ${riskOn ? 'sp-risk-on' : 'sp-risk-off'}`;
  // P1352: quadrant counts describe relative strength, not sector identity or the business cycle.
  pill.textContent = `${viewLabel} 상대강도 · 선도·개선 ${counts.Leading + counts.Improving}/${total} · 약화·후행 ${counts.Weakening + counts.Lagging}/${total}`;
}

function renderThemePerformanceNarrative({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('sector-perf-analysis');
  if (!host) return;
  host.dataset.aioThemePerformanceRenderer = 'native';
  // Codex review 2026-10-05: the bars switched to 1주 while this summary kept the 1-day returns. Both read
  // the same selected period now.
  const mode = root?._sectorPerfMode === '1w' ? '1w' : '1d';
  const periodLabel = mode === '1w' ? '1주' : '1일';
  const rows = viewItems(selectThemesItems(store?.getState?.() || {}), 'sectors')
    .map((item) => ({ label: String(item?.label || item?.symbol || ''), pct: finite(mode === '1w' ? item?.weeklyPct : item?.pct) }))
    .filter((row) => row.label && row.pct != null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length < 2) {
    host.textContent = `섹터 ${periodLabel} 성과 요약 보류 · 비교할 섹터 등락률이 2개 이상 필요합니다.`;
    host.style.color = 'var(--text-muted)';
    return;
  }
  const leaders = rows.slice(0, 2).map((row) => `${row.label} ${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`).join(' · ');
  const laggards = rows.slice(-2).reverse().map((row) => `${row.label} ${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`).join(' · ');
  host.textContent = `섹터 ETF ${periodLabel} 가격 성과 · 강세 ${leaders} · 약세 ${laggards}. 가격 성과는 자금 유입량과 같지 않습니다.`;
  host.style.color = 'var(--text-secondary)';
}

// P1444: KR themes from the published screener rows; the summary states what is actually covered.
function renderKrThemeArtifact({ documentRef, root, store }) {
  const host = documentRef?.getElementById('kr-themes-artifact-read');
  if (!host) return;
  const themeMap = root?.KR_THEME_MAP && typeof root.KR_THEME_MAP === 'object' ? root.KR_THEME_MAP : null;
  if (!themeMap) { host.hidden = true; return; }
  const read = krThemeArtifactRead({ themeMap, rows: store?.getState?.()?.screener?.rows || [] });
  const summary = documentRef.getElementById('kr-themes-summary');
  if (summary) summary.textContent = `한국 시장 — 국내 테마 (KRX ${read.totalThemes}개 중 ${read.coveredThemes}개 테마를 완료 종가로 비교)`;
  host.dataset.aioKrThemeArtifactRenderer = 'native';
  host.hidden = false;
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  host.replaceChildren(el('h2', '국내 테마 흐름', 'briefing-h2'), el('p', read.read, 'flow-lead'));
  const max = Math.max(1, ...read.usable.map((theme) => Math.abs(theme.ret1m)));
  for (const theme of read.usable.slice(0, 12)) {
    const line = el('div', null, 'stock-read-bars');
    const item = el('div', null, 'stock-read-bar-row');
    const bar = el('div', null, `stock-read-bar is-stock ${theme.ret1m >= 0 ? 'is-up' : 'is-down'}`);
    bar.style.width = `${Math.max(2, Math.abs(theme.ret1m) / max * 100).toFixed(1)}%`;
    item.append(bar, el('span', `1개월 ${theme.ret1m >= 0 ? '+' : ''}${theme.ret1m.toFixed(1)}% · 3개월 ${theme.ret3m == null ? '—' : `${theme.ret3m >= 0 ? '+' : ''}${theme.ret3m.toFixed(1)}%`}${theme.above50Pct != null ? ` · 50일선 위 ${theme.above50Pct}%` : ''} · ${theme.covered}/${theme.members}종목`, 'stock-read-bar-value'));
    line.append(el('span', theme.label, 'stock-read-bar-label'), item);
    host.append(line);
  }
  host.append(el('p', '위 흐름은 완료 종가 기준입니다. 장중 실시간 등락은 아래 접힌 칸에서 국내 시세가 들어올 때만 계산됩니다.', 'theme-strength-basis'));
}

function renderThemePerformanceBars({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('sector-perf-bars');
  if (!host) return;
  host.dataset.aioThemePerformanceBarsRenderer = 'native';
  const view = root?._sectorPerfView === 'all' ? 'all' : 'sectors';
  const mode = root?._sectorPerfMode === '1w' ? '1w' : '1d';
  const rows = viewItems(selectThemesItems(store?.getState?.() || {}), view)
    .map((item) => ({
      symbol: String(item?.symbol || item?.id || ''),
      label: String(item?.label || item?.symbol || item?.id || ''),
      pct: finite(mode === '1w' ? item?.weeklyPct : item?.pct),
      quadrant: String(item?.quadrant || 'neutral')
    }))
    .filter((row) => row.symbol)
    .sort((a, b) => {
      if (a.pct == null && b.pct == null) return a.symbol.localeCompare(b.symbol);
      if (a.pct == null) return 1;
      if (b.pct == null) return -1;
      return b.pct - a.pct;
    });
  host.replaceChildren();
  if (!rows.length) {
    const empty = documentRef.createElement('div');
    empty.textContent = '섹터 성과 데이터 수신 대기';
    empty.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);font-size:12px;';
    host.appendChild(empty);
    return;
  }
  const maxAbs = Math.max(0.5, ...rows.map((row) => Math.abs(row.pct ?? 0)));
  const colors = { Leading: 'var(--data-green)', Improving: 'var(--data-cyan)', Weakening: 'var(--data-amber)', Lagging: 'var(--data-red)' };
  rows.forEach((row) => {
    const line = documentRef.createElement('div');
    line.dataset.themePerformanceRow = row.symbol;
    line.style.cssText = 'display:flex;align-items:center;gap:3px;min-height:20px;';
    const symbol = documentRef.createElement('span');
    symbol.textContent = row.symbol;
    symbol.style.cssText = 'width:35px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:right;';
    const label = documentRef.createElement('span');
    label.textContent = row.label;
    label.style.cssText = 'width:70px;font-size:10px;color:var(--text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const track = documentRef.createElement('span');
    track.style.cssText = 'flex:1;display:flex;align-items:center;position:relative;min-width:40px;height:12px;';
    const zero = documentRef.createElement('span');
    zero.style.cssText = 'position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(33,29,22,0.1);';
    track.appendChild(zero);
    if (row.pct != null) {
      const bar = documentRef.createElement('span');
      const width = `${Math.abs(row.pct) / maxAbs * 45}%`;
      const color = row.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      bar.style.cssText = row.pct >= 0
        ? `margin-left:50%;height:12px;width:${width};background:${color};border-radius:0 3px 3px 0;min-width:2px;`
        : `margin-left:calc(50% - ${width});height:12px;width:${width};background:${color};border-radius:3px 0 0 3px;min-width:2px;`;
      track.appendChild(bar);
    }
    const value = documentRef.createElement('span');
    value.textContent = row.pct == null ? '—' : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`;
    value.style.cssText = `width:62px;text-align:right;font-size:12px;font-weight:700;font-family:var(--font-mono);color:${row.pct == null ? 'var(--text-muted)' : row.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)'};flex-shrink:0;`;
    const badge = documentRef.createElement('span');
    badge.textContent = row.pct == null ? '대기' : ({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' }[row.quadrant] || '중립');
    badge.style.cssText = `width:36px;text-align:center;flex-shrink:0;font-size:10px;color:${row.pct == null ? 'var(--text-muted)' : colors[row.quadrant] || 'var(--text-muted)'};`;
    line.append(symbol, label, track, value, badge);
    host.appendChild(line);
  });
}

function resolveThemeDetailId(root, item) {
  const symbol = String(item?.symbol || item?.id || '').trim().toUpperCase();
  const catalog = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  const theme = catalog.find((entry) => (
    String(entry?.id || '').trim() === String(item?.id || '').trim()
    || String(entry?.etf || '').trim().toUpperCase() === symbol
    || String(entry?.compositeBase || '').trim().toUpperCase() === symbol
  ));
  return theme?.id ? String(theme.id) : null;
}

function createChip(documentRef, item, root) {
  const detailId = resolveThemeDetailId(root, item);
  const chip = documentRef.createElement(detailId ? 'button' : 'span');
  const pct = finite(item?.pct);
  const symbol = String(item?.symbol || item?.id || '');
  chip.dataset.themeSymbol = symbol;
  // LC-54: 상세 제공 여부를 데이터 계약으로 드러낸다 — 읽기 전용 칩과 상세 버튼이
  // 같은 외형이면 사용자가 눌러도 아무 일도 없는 이유를 알 수 없다.
  chip.dataset.detailAvailability = detailId ? 'available' : 'summary-only';
  // P1505: the quadrant says where a sector stands on relative strength; the period return is a separate number.
  // Only the return is coloured, so a lagging sector that rose today no longer reads as a green chip in 후행.
  chip.textContent = `${symbol} ${String(item?.label || symbol)}`;
  if (pct != null) {
    const change = documentRef.createElement('span');
    change.textContent = ` ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
    change.style.color = pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
    chip.append(change);
  }
  chip.style.cssText = `font-size:12px;border:1px ${detailId ? 'solid' : 'dashed'} var(--border-subtle);border-radius:6px;padding:4px 10px;background:var(--bg-elevated);color:var(--text-primary);font-variant-numeric:tabular-nums;${detailId ? 'cursor:pointer;text-align:left;' : 'opacity:0.85;'}`;
  if (detailId) {
    chip.type = 'button';
    chip.dataset.action = 'showThemeDetail';
    chip.dataset.arg = detailId;
    chip.dataset.passEl = '1';
    chip.setAttribute('aria-label', `${String(item?.label || symbol)} 테마 상세 열기`);
    chip.title = '테마 상세 열기';
  } else {
    // Codex browser audit H23: the leading sector (e.g. XLK) ended the "which sector → why → which company" path.
    // A summary-only sector now takes the reader to the sub-theme ranking, where its themes and names are listed.
    chip.setAttribute('role', 'button');
    chip.tabIndex = 0;
    chip.style.cursor = 'pointer';
    chip.setAttribute('aria-label', `${String(item?.label || symbol)} — 상세 패널 없음, 하위 테마 순위로 이동`);
    chip.title = '이 업종 자체의 상세 패널은 없습니다 — 눌러서 아래 하위 테마 순위에서 관련 테마와 대표 종목을 확인합니다.';
    const jump = () => documentRef.getElementById('theme-strength-board')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    chip.addEventListener('click', jump);
    chip.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump(); } });
  }
  return chip;
}

function renderThemes({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const container = documentRef?.getElementById('rrg-quadrant-cards');
  if (!container) return;
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const groups = new Map(QUADRANTS.map((quadrant) => [quadrant.key, []]));
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || 'unknown');
    if (groups.has(quadrant) && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) {
      groups.get(quadrant).push(item);
    }
  });
  groups.forEach((group) => group.sort((a, b) => (finite(b?.pct) ?? -Infinity) - (finite(a?.pct) ?? -Infinity)));
  const classifiedCount = [...groups.values()].reduce((count, group) => count + group.length, 0);
  container.replaceChildren();
  // LC-54: 한 눈에 상세 제공/요약 전용 범위를 말한다 — 점선 칩은 상세가 없다.
  const detailCount = items.filter((item) => resolveThemeDetailId(root, item)).length;
  const legend = documentRef.createElement('div');
  legend.dataset.themeDetailLegend = 'true';
  // Codex browser audit H22: the quadrant and the chip return answer different windows; the legend says which.
  legend.textContent = `사분면 = SPY 대비 상대가격의 수준과 최근 변화(완료 종가, 30거래일 이상) · 칩 옆 % = 위에서 고른 기간의 수익률 — 그래서 후행 사분면 종목이 이번 기간에는 올랐을 수 있습니다. 상세 제공 ${detailCount}개 · 점선 칩 ${Math.max(0, items.length - detailCount)}개는 하위 테마 순위로 연결됩니다.`;
  legend.style.cssText = 'grid-column:1/-1;font-size:11px;color:var(--text-muted);padding:2px 0 6px;';
  container.appendChild(legend);
  const appendUnclassified = () => {
    const pending = items.filter((item) => !groups.has(String(item?.quadrant || 'unknown')) || finite(item?.rsRatio) == null || finite(item?.rsMomentum) == null);
    if (!pending.length) return;
    const catalog = documentRef.createElement('section');
    catalog.style.cssText = 'grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;padding:12px 0;';
    catalog.setAttribute('aria-label', '회전 지표 미수신 테마 목록');
    pending.forEach((item) => catalog.appendChild(createChip(documentRef, item, root)));
    container.appendChild(catalog);
  };
  if (!classifiedCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = 'RRG 판정 보류 · SPY 대비 상대가격 히스토리 20개 이상 필요';
    empty.style.cssText = 'grid-column:span 2;text-align:center;padding:20px;color:var(--text-dim);font-size:12px;';
    container.appendChild(empty);
    appendUnclassified();
    const read = documentRef.getElementById('rrg-rotation-read');
    if (read) read.textContent = '상대강도·모멘텀 시계열 미수신 — 정적 사분면 시드로 대체하지 않습니다.';
    return;
  }

  QUADRANTS.forEach((quadrant) => {
    const card = documentRef.createElement('section');
    card.dataset.themeQuadrant = quadrant.key;
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:20px 24px;';
    const heading = documentRef.createElement('div');
    heading.textContent = `${quadrant.label} · ${quadrant.sub}`;
    heading.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;';
    card.appendChild(heading);
    const chips = documentRef.createElement('div');
    chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    const group = groups.get(quadrant.key) || [];
    if (group.length) group.forEach((item) => chips.appendChild(createChip(documentRef, item, root)));
    else {
      const empty = documentRef.createElement('span');
      empty.textContent = '해당 섹터 없음';
      empty.style.cssText = 'font-size:12px;color:var(--text-dim);';
      chips.appendChild(empty);
    }
    card.appendChild(chips);
    const note = documentRef.createElement('div');
    note.textContent = quadrant.note;
    note.style.cssText = 'font-size:12px;color:var(--text-dim);margin-top:10px;';
    card.appendChild(note);
    container.appendChild(card);
  });
  appendUnclassified();
  // P1431: one reading of all four quadrants, tied to the 시장 상태 breadth axis.
  const flow = rotationFlow({ groups: Object.fromEntries(groups), regime: readMarketRegime(root) });
  const read = documentRef.getElementById('rrg-rotation-read');
  if (read) read.textContent = flow.read;
  renderNextSteps(documentRef, documentRef.getElementById('themes-next'), flow.next);
}

function renderThemeDetailSummary({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-summary');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const title = documentRef.createElement('div');
  title.textContent = detail.label;
  title.style.cssText = 'font-size:14px;font-weight:900;color:var(--text-primary);';
  const meta = documentRef.createElement('span');
  meta.textContent = detail.etf ? ` · ${detail.etf}` : ' · 커스텀 합산';
  meta.style.cssText = 'font-size:11px;font-family:var(--font-mono);font-weight:700;color:var(--text-muted);';
  title.appendChild(meta);

  const performance = documentRef.createElement('span');
  const pct = typeof detail.pct === 'number' && Number.isFinite(detail.pct) ? detail.pct : null;
  performance.textContent = pct == null ? '판정 보류 — 시세 대기' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  performance.style.cssText = `font-size:13px;font-family:var(--font-mono);font-weight:900;color:${pct == null ? 'var(--text-muted)' : pct >= 0 ? 'var(--data-green)' : 'var(--data-red)'};`;

  const header = documentRef.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px;';
  header.append(title, performance);

  const leaders = documentRef.createElement('div');
  leaders.textContent = `대표 리더: ${(detail.leaderHighlight.length ? detail.leaderHighlight : detail.leaders.slice(0, 4)).join(' · ') || '구성 데이터 대기'}`;
  leaders.style.cssText = 'font-size:11px;line-height:1.6;color:var(--text-secondary);';

  const provenance = documentRef.createElement('div');
  const membership = detail.membershipPolicy || {};
  const membershipAsOf = membership.observedAt ? `구성 기준 ${String(membership.observedAt).slice(0, 10)}` : '구성 기준일 미검증';
  provenance.textContent = `${detail.source === 'quote-missing' ? '시세 근거 미확보' : '시세 관측'} · AIO 참고 테마 분류 · ${membershipAsOf}`;
  provenance.title = `시세 출처: ${detail.source} · 구성 출처: ${membership.source || 'AIO curated taxonomy'}`;
  provenance.style.cssText = 'font-size:12px;line-height:1.5;color:var(--text-muted);';
  provenance.setAttribute('data-source-kind', membership.sourceKind || 'REFERENCE');
  provenance.setAttribute('data-operational-use', membership.allowedUse === 'decision' ? 'decision' : 'reference-only');
  if (membership.observedAt) provenance.setAttribute('data-observed-at', membership.observedAt);

  host.replaceChildren(header, leaders, provenance);
  // P1440: the theme's own flow from the published screener medians — readable even when live quotes
  // for the constituents have not arrived (the legacy panel below then reads 시세 대기).
  const rows = store?.getState?.()?.screener?.rows || [];
  const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey: 'ret3m', benchmark: benchmarkReturns(root?._aioHistory || []) });
  const flow = themeDetailFlow({ themeId: detail.id, groups: model.groups, etf: detail.etf || null, rotation: root?._serverDataMeta?.rotationHistory?.items || {} });
  if (flow.rows.length) {
    const box = documentRef.createElement('div');
    box.className = 'theme-detail-flow';
    if (flow.read) { const p = documentRef.createElement('p'); p.className = 'flow-lead'; p.textContent = flow.read; box.append(p); }
    const max = Math.max(1, ...flow.rows.map((group) => Math.abs(group.ret3m ?? 0)));
    for (const group of flow.rows) {
      const line = documentRef.createElement('div');
      line.className = 'stock-read-bars';
      const name = documentRef.createElement('span');
      name.className = 'stock-read-bar-label';
      name.textContent = group.name;
      const item = documentRef.createElement('div');
      item.className = 'stock-read-bar-row';
      const bar = documentRef.createElement('div');
      bar.className = `stock-read-bar is-stock ${(group.ret3m ?? 0) >= 0 ? 'is-up' : 'is-down'}`;
      bar.style.width = `${Math.max(2, Math.abs(group.ret3m ?? 0) / max * 100).toFixed(1)}%`;
      const value = documentRef.createElement('span');
      value.className = 'stock-read-bar-value';
      const dir = { improving: '개선', steady: '유지', weakening: '약화' }[group.direction] || '';
      value.textContent = `3개월 ${group.ret3m == null ? '—' : `${group.ret3m >= 0 ? '+' : ''}${group.ret3m.toFixed(1)}%`} · 1개월 ${group.ret1m == null ? '—' : `${group.ret1m >= 0 ? '+' : ''}${group.ret1m.toFixed(1)}%`}${group.above50Pct != null ? ` · 50일선 위 ${group.above50Pct}%` : ''}${dir ? ` · ${dir}` : ''}`;
      item.append(bar, value);
      line.append(name, item);
      box.append(line);
    }
    host.append(box);
  }
  host.hidden = false;
}

function detailQuote(detail, symbol) {
  const quote = detail?.quotes?.[symbol];
  if (!quote || typeof quote !== 'object') return null;
  const price = finite(quote.price);
  const pct = finite(quote.pct);
  const currency = quote.currency ? String(quote.currency).trim().toUpperCase() : null;
  return price == null && pct == null ? null : { price, pct, currency };
}

function formatQuotePrice(value, currency) {
  if (value == null) return '가격 대기';
  const code = String(currency || '').trim().toUpperCase();
  if (!code) return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} · 통화 미확인`;
  try {
    return new Intl.NumberFormat(code === 'KRW' ? 'ko-KR' : 'en-US', {
      style: 'currency', currency: code, maximumFractionDigits: code === 'KRW' ? 0 : 2
    }).format(value);
  } catch (_) {
    return `${code} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

function compositeDetailPct(detail, subTheme) {
  if (subTheme?.etf) {
    const etfQuote = detailQuote(detail, subTheme.etf);
    if (finite(etfQuote?.pct) != null) return etfQuote.pct;
  }
  const weighted = Object.entries(subTheme?.weights || {})
    .map(([symbol, weight]) => ({ quote: detailQuote(detail, symbol), weight: Number(weight) }))
    .filter((row) => finite(row.quote?.pct) != null && Number.isFinite(row.weight) && row.weight > 0);
  if (weighted.length) {
    const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight > 0) return weighted.reduce((sum, row) => sum + row.quote.pct * row.weight, 0) / totalWeight;
  }
  const pcts = (subTheme?.tickers || [])
    .map((symbol) => detailQuote(detail, symbol)?.pct)
    .filter((value) => finite(value) != null);
  return pcts.length ? pcts.reduce((sum, value) => sum + value, 0) / pcts.length : null;
}

function renderThemeDetailComposition({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-composition');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }

  const heading = documentRef.createElement('div');
  heading.textContent = '구성·브레드스';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 6px;';

  const breadth = documentRef.createElement('div');
  const breadthValue = finite(detail.breadth);
  breadth.textContent = breadthValue == null
    ? '브레드스: 시세 대기 — 충분한 구성종목 가격이 확인되면 계산됩니다.'
    : `상승 종목 비율(전일 대비): ${breadthValue}% · ${detail.leaders.length}종목 기준`;
  breadth.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.6;margin-bottom:8px;';

  const subThemes = documentRef.createElement('div');
  subThemes.style.cssText = 'display:grid;gap:6px;';
  (detail.subThemes || []).forEach((subTheme) => {
    const card = documentRef.createElement('section');
    card.style.cssText = 'background:var(--surface-1);border:1px solid var(--surface-4);border-radius:3px;padding:8px;';
    const title = documentRef.createElement('div');
    title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;';
    const name = documentRef.createElement('span');
    name.textContent = subTheme.name || '세부 테마';
    name.style.cssText = 'font-size:12px;font-weight:700;color:var(--text-primary);';
    if (subTheme.etf) {
      const etfLabel = documentRef.createElement('span');
      etfLabel.textContent = ` · ${subTheme.etf}`;
      etfLabel.style.cssText = 'font-size:10px;font-family:var(--font-mono);font-weight:700;color:var(--text-muted);';
      name.appendChild(etfLabel);
    }
    const pct = compositeDetailPct(detail, subTheme);
    const performance = documentRef.createElement('span');
    performance.textContent = pct == null ? '시세 대기' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
    performance.style.cssText = `font-size:11px;font-family:var(--font-mono);font-weight:800;color:${pct == null ? 'var(--text-muted)' : pct >= 0 ? 'var(--data-green)' : 'var(--data-red)'};`;
    title.append(name, performance);
    card.appendChild(title);

    const tickers = documentRef.createElement('div');
    tickers.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
    (subTheme.tickers || []).forEach((symbol) => {
      const quote = detailQuote(detail, symbol);
      const chip = documentRef.createElement('span');
      chip.textContent = `${symbol}${quote?.pct == null ? '' : ` ${quote.pct >= 0 ? '+' : ''}${quote.pct.toFixed(1)}%`}`;
      chip.dataset.action = 'showTicker';
      chip.dataset.arg = symbol;
      chip.title = `${symbol} 분석`;
      chip.style.cssText = 'font-size:10px;font-family:var(--font-mono);color:var(--text-secondary);background:var(--surface-2);padding:2px 6px;border-radius:3px;cursor:pointer;';
      tickers.appendChild(chip);
    });
    if (!tickers.childElementCount) {
      const empty = documentRef.createElement('span');
      empty.textContent = '구성종목 없음';
      empty.style.cssText = 'font-size:10px;color:var(--text-muted);';
      tickers.appendChild(empty);
    }
    card.appendChild(tickers);
    subThemes.appendChild(card);
  });

  if (!subThemes.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '세부 테마 구성 데이터가 없습니다.';
    empty.style.cssText = 'font-size:11px;color:var(--text-muted);';
    subThemes.appendChild(empty);
  }
  host.replaceChildren(heading, breadth, subThemes);
  host.hidden = false;
}

function renderThemeDetailLeaders({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-leaders');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }

  const heading = documentRef.createElement('div');
  heading.textContent = `대장주 상세 · ${detail.leaders.length}종목`;
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 6px;';
  const cards = documentRef.createElement('div');
  cards.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;';
  (detail.leaders || []).forEach((symbol) => {
    const quote = detailQuote(detail, symbol);
    const card = documentRef.createElement('button');
    card.type = 'button';
    card.dataset.action = 'showTicker';
    card.dataset.arg = symbol;
    card.title = `${symbol} 상세 분석`;
    card.style.cssText = 'text-align:left;background:var(--surface-2);border:1px solid var(--surface-5);border-radius:3px;padding:7px 8px;cursor:pointer;color:var(--text-primary);';
    const ticker = documentRef.createElement('span');
    ticker.textContent = symbol;
    ticker.style.cssText = 'display:block;font-size:12px;font-weight:800;font-family:var(--font-mono);color:var(--accent);';
    const price = documentRef.createElement('span');
    price.textContent = formatQuotePrice(quote?.price, quote?.currency);
    price.style.cssText = 'display:block;font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);margin-top:2px;';
    const pct = documentRef.createElement('span');
    pct.textContent = quote?.pct == null ? '등락률 대기' : `${quote.pct >= 0 ? '+' : ''}${quote.pct.toFixed(2)}%`;
    pct.style.cssText = `display:block;font-size:11px;font-family:var(--font-mono);font-weight:800;color:${quote?.pct == null ? 'var(--text-muted)' : quote.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)'};margin-top:2px;`;
    card.append(ticker, price, pct);
    cards.appendChild(card);
  });
  if (!cards.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '대장주 구성 데이터가 없습니다.';
    empty.style.cssText = 'font-size:11px;color:var(--text-muted);';
    cards.appendChild(empty);
  }
  host.replaceChildren(heading, cards);
  host.hidden = false;
}

function renderThemeDetailTemperature({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-temperature');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  // LC-38: this panel only observes ONE day's ETF change. It used to expand that single number into
  // time-series momentum, flow, cause and action claims ("모멘텀이 살아있다", "차익실현/로테이션
  // 매도", "구조적 훼손"). Each band now names the day window it actually measured; the other claim
  // types require their own evidence.
  heading.textContent = '테마 당일 등락 구간';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  const pct = finite(detail.pct);
  if (pct == null) body.textContent = '시세 대기 — 구성종목 가격이 확인되면 당일 등락을 표시합니다.';
  else if (pct >= 3) body.textContent = '당일 +3% 이상 — 관측된 당일 등락 구간입니다. 과열·추세 지속은 별도 기간 근거가 필요합니다.';
  else if (pct >= 1) body.textContent = '당일 +1% 이상 — 관측된 당일 등락 구간입니다. 시계열 모멘텀·자금 유입은 별도 근거가 필요합니다.';
  else if (pct >= 0) body.textContent = '당일 보합 — 관측된 당일 등락 구간입니다. 방향은 추가 가격·거래량으로 확인합니다.';
  else if (pct >= -2) body.textContent = '당일 하락 — 관측된 당일 등락 구간입니다. 원인(수급·로테이션)은 별도 근거가 필요합니다.';
  else body.textContent = '당일 -2% 이하 — 관측된 당일 등락 구간입니다. 시계열 하락·구조 훼손은 별도 기간 근거가 필요합니다.';
  body.style.cssText = `font-size:11px;line-height:1.7;color:${pct == null ? 'var(--text-muted)' : pct >= 0 ? 'var(--text-secondary)' : 'var(--data-amber)'};`;
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailSpread({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-spread');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '종목 간 퍼포먼스 격차';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const rows = (detail.leaders || [])
    .map((symbol) => ({ symbol, pct: detailQuote(detail, symbol)?.pct }))
    .filter((row) => finite(row.pct) != null)
    .sort((a, b) => b.pct - a.pct);
  const body = documentRef.createElement('div');
  body.style.cssText = 'font-size:11px;line-height:1.7;color:var(--text-secondary);';
  if (rows.length < 2) {
    body.textContent = '시세 대기 — 최소 두 종목의 등락률이 확인되면 격차를 계산합니다.';
  } else {
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    // LC-38: a narrow day-level spread is not evidence that every constituent reacted to one
    // catalyst, nor a reason to prefer the ETF. State the measured dispersion only.
    const level = spread > 5 ? '매우 큼 — 구성종목 간 당일 등락 차가 큽니다.' : spread > 2 ? '보통 — 테마 전반의 움직임과 개별 종목 차이를 함께 확인하세요.' : '좁음 — 구성종목의 당일 등락이 비슷합니다.';
    body.textContent = `등락 편차 ${spread.toFixed(1)}%p (${level})`;
    const leaders = documentRef.createElement('div');
    leaders.textContent = `최강 ${rows[0].symbol} ${rows[0].pct >= 0 ? '+' : ''}${rows[0].pct.toFixed(2)}% · 최약 ${rows[rows.length - 1].symbol} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}%`;
    leaders.style.cssText = 'color:var(--text-muted);margin-top:2px;';
    body.appendChild(leaders);
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailBreadthHealth({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-breadth-health');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  // LC-28: the up-ratio is an observed PRICE participation measure. The retired wording claimed a
  // buyer and a fund flow the screen never measured; the label now names only the price participation.
  heading.textContent = '가격 상승 참여 폭 (당일)';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  const breadth = finite(detail.breadth);
  // LC-36: the up-ratio is computed over the 리더 목록 중 가격이 확인된 종목만이다. 그 분모를 값
  // 옆에 표시해, 화면의 14행(리더 목록)과 실제 비율의 n이 다를 수 있음을 드러낸다.
  const leaderList = Array.isArray(detail.leaders) ? detail.leaders : [];
  const priceEligible = leaderList.filter((symbol) => finite(detailQuote(detail, symbol)?.pct) != null).length;
  const basis = breadth == null ? '' : ` (가격 적격 ${priceEligible}/${leaderList.length})`;
  if (breadth == null) body.textContent = '시세 대기 — 충분한 구성종목 가격이 확인되면 당일 가격 참여 폭을 계산합니다.';
  else if (breadth >= 70) body.textContent = `상승 종목 ${breadth}%${basis} · 당일 가격 참여 폭 우수 — 관측된 당일 가격 참여이며 자금 유입·거래 주체의 증거가 아닙니다.`;
  else if (breadth >= 50) body.textContent = `상승 종목 ${breadth}%${basis} · 당일 가격 참여 폭 보통 — 일부 종목 중심인지 선별이 필요합니다.`;
  else body.textContent = `상승 종목 ${breadth}%${basis} · 당일 가격 참여 폭 취약 — 관측된 당일 가격 참여이며 추세 단정이 아닙니다.`;
  body.style.cssText = `font-size:11px;line-height:1.7;color:${breadth == null ? 'var(--text-muted)' : breadth >= 70 ? 'var(--data-green)' : breadth >= 50 ? 'var(--text-secondary)' : 'var(--data-amber)'};`;
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailSubthemeGap({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-subtheme-gap');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '서브테마 간 퍼포먼스 격차';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  body.style.cssText = 'font-size:11px;line-height:1.7;color:var(--text-secondary);';
  const rows = (detail.subThemes || [])
    .map((subTheme) => ({ name: subTheme.name || '서브테마', pct: compositeDetailPct(detail, subTheme) }))
    .filter((row) => finite(row.pct) != null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length < 2 || rows[0].name === rows[rows.length - 1].name) {
    body.textContent = '시세 대기 — 최소 두 서브테마의 등락률이 확인되면 격차를 계산합니다.';
  } else {
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    // LC-37: max−min of day returns is price dispersion, not observed fund rotation.
    const read = spread > 1
      ? '서브테마 간 당일 가격 반응 격차가 큽니다. 자금 순환 여부는 별도 수급 근거가 필요합니다.'
      : '서브테마 간 당일 반응은 유사합니다. 개별 종목 차이를 함께 확인하세요.';
    body.textContent = `서브테마 격차 ${spread.toFixed(1)}%p · 최강 ${rows[0].name} ${rows[0].pct >= 0 ? '+' : ''}${rows[0].pct.toFixed(2)}% · 최약 ${rows[rows.length - 1].name} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}% — ${read}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailBenchmark({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-benchmark');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = 'ETF·기준자산 벤치마크 비교';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  body.style.cssText = 'font-size:11px;line-height:1.7;color:var(--text-secondary);';
  const themePct = finite(detail.pct);
  // Codex browser audit H25: when the theme's own return IS its representative ETF (반도체 = SMH), "SMH 대비
  // +0.00%p · 유사" compared SMH with itself. The comparison then moves to the broad market (SPY); without a
  // SPY quote it says why it is skipped instead of producing an empty "유사" verdict.
  const ownSymbol = detail.etf || detail.compositeBase || null;
  const ownPct = ownSymbol ? finite(detailQuote(detail, ownSymbol)?.pct) : null;
  const selfCompare = Boolean(ownSymbol && themePct != null && ownPct != null && Math.abs(themePct - ownPct) < 0.005);
  const marketPct = finite(detailQuote(detail, 'SPY')?.pct ?? root?._liveData?.SPY?.pct ?? root?._liveData?.SPY?.changePercent);
  const benchmarkSymbol = selfCompare ? (marketPct != null ? 'SPY' : null) : ownSymbol;
  const benchmarkPct = selfCompare ? marketPct : ownPct;
  if (selfCompare && benchmarkPct == null) {
    body.textContent = `이 테마의 수익률은 대표 ETF ${ownSymbol} 자체라 같은 ETF와는 비교하지 않습니다. 시장(SPY) 등락이 확인되면 시장 대비로 비교합니다.`;
  } else if (!benchmarkSymbol || themePct == null || benchmarkPct == null) {
    body.textContent = '시세 대기 — 테마와 벤치마크의 등락률이 확인되면 비교합니다.';
  } else {
    const diff = themePct - benchmarkPct;
    const direction = diff > 0.5 ? '상회' : diff < -0.5 ? '하회' : '유사';
    const context = direction === '상회' ? '구성 테마의 상대 모멘텀이 우세합니다.' : direction === '하회' ? '벤치마크 대비 상대 약세를 확인하세요.' : '테마와 벤치마크가 유사하게 움직였습니다.';
    body.textContent = `${selfCompare ? `${ownSymbol}(테마 대표 ETF)의 시장(SPY) ` : `${benchmarkSymbol} `}대비 ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p · 테마 ${themePct >= 0 ? '+' : ''}${themePct.toFixed(2)}% / 벤치마크 ${benchmarkPct >= 0 ? '+' : ''}${benchmarkPct.toFixed(2)}% · ${direction} — ${context}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailInsights({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-insights');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '테마 맞춤 인사이트';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  body.style.cssText = 'display:grid;gap:4px;font-size:11px;line-height:1.7;color:var(--text-secondary);';
  const insight = detail.insight || {};
  const rows = [
    ['매크로 조건', insight.macro],
    ['역설', insight.paradox],
    ['연쇄 효과', insight.chainEffect],
    ['센티멘트 함정', insight.sentiment]
  ].filter(([, value]) => value);
  (insight.breakSignals || []).forEach((value, index) => rows.push([`깨지는 신호 ${index + 1}`, value]));
  if (!rows.length) {
    // Codex browser audit H26: a permanent "데이터 대기" card for themes without an authored insight read as a
    // pending load. No authored insight → the section is not shown.
    host.replaceChildren();
    host.hidden = true;
    return;
  } else {
    rows.forEach(([label, value]) => {
      const row = documentRef.createElement('div');
      const labelNode = documentRef.createElement('b');
      labelNode.textContent = `${label}: `;
      row.append(labelNode, documentRef.createTextNode(value));
      body.appendChild(row);
    });
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderAiInfrastructureLens({ documentRef, root, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('ai-infra-efficiency-lens');
  if (!host) return;
  const proxies = selectAiInferenceProxies(root?._liveData || {});
  host.replaceChildren();
  host.dataset.aioAiInfrastructureRenderer = 'native';
  host.setAttribute('data-source-kind', AI_INFERENCE_EFFICIENCY_REFERENCE.sourceKind);
  host.setAttribute('data-operational-use', AI_INFERENCE_EFFICIENCY_REFERENCE.operationalUse);

  const header = documentRef.createElement('div');
  header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;';
  const title = documentRef.createElement('div');
  title.textContent = 'AI 추론 효율 · 메모리 벽 × 특화도';
  title.style.cssText = 'font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--text-primary);';
  const badge = documentRef.createElement('span');
  const liveCount = proxies.filter((item) => item.pct != null).length;
  badge.textContent = liveCount ? `참고용 · 공개 지표 ${liveCount}/${proxies.length}개 수신` : '참고용 · 지표 수신 대기';
  badge.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-muted);';
  header.append(title, badge);
  host.appendChild(header);

  const intro = documentRef.createElement('div');
  intro.textContent = '다음 AI 경쟁의 단위를 단일 칩 승자가 아니라 workload stage별 비용·지연·전력으로 재정의합니다. 아래 업체·구조·거래선은 자료에서 추출한 연구 지도이며 현재 매출·밸류에이션·성능 순위가 아닙니다.';
  intro.style.cssText = 'font-size:12px;line-height:1.7;color:var(--text-secondary);margin-bottom:12px;';
  host.appendChild(intro);

  const architectureTitle = documentRef.createElement('div');
  architectureTitle.textContent = 'Jalapeño / AI 추론 시스템 아키텍처 · REFERENCE';
  architectureTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(architectureTitle);
  const architectureGrid = documentRef.createElement('div');
  architectureGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-bottom:8px;';
  AI_INFERENCE_ARCHITECTURE_REFERENCE.layers.forEach((layer) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'min-height:78px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const label = documentRef.createElement('div');
    label.textContent = layer.label;
    label.style.cssText = 'font-size:10px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const focus = documentRef.createElement('div');
    focus.textContent = layer.focus;
    focus.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-muted);';
    card.append(label, focus);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    architectureGrid.appendChild(card);
  });
  host.appendChild(architectureGrid);
  const architectureMeta = documentRef.createElement('div');
  architectureMeta.textContent = `목표: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.objective} · 시계열: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.timeSeriesChecks.map((item) => `${item.window}=${item.metrics}`).join(' | ')}`;
  architectureMeta.style.cssText = 'font-size:10px;line-height:1.6;color:var(--data-cyan);border-bottom:1px solid var(--border-subtle);padding-bottom:10px;margin-bottom:12px;';
  architectureMeta.setAttribute('data-source-kind', 'REFERENCE');
  architectureMeta.setAttribute('data-operational-use', 'reference-only');
  host.appendChild(architectureMeta);

  const topGrid = documentRef.createElement('div');
  topGrid.style.cssText = 'display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-bottom:14px;';
  const axes = documentRef.createElement('div');
  const axesTitle = documentRef.createElement('div');
  axesTitle.textContent = '구조 축';
  axesTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  axes.appendChild(axesTitle);
  AI_INFERENCE_EFFICIENCY_REFERENCE.axes.forEach((axis) => {
    const row = documentRef.createElement('div');
    row.style.cssText = 'border:1px solid var(--border-subtle);border-radius:4px;background:var(--bg-card);padding:8px;margin-bottom:6px;';
    const label = documentRef.createElement('div');
    label.textContent = axis.label;
    label.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const range = documentRef.createElement('div');
    range.textContent = `${axis.low}  ←  ${axis.high}`;
    range.style.cssText = 'font-size:10px;font-family:var(--font-mono);color:var(--data-cyan);';
    const question = documentRef.createElement('div');
    question.textContent = axis.question;
    question.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:4px;';
    row.append(label, range, question);
    axes.appendChild(row);
  });
  const workloads = documentRef.createElement('div');
  const workloadsTitle = documentRef.createElement('div');
  workloadsTitle.textContent = 'workload fit';
  workloadsTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  workloads.appendChild(workloadsTitle);
  AI_INFERENCE_EFFICIENCY_REFERENCE.workloads.forEach((workload) => {
    const row = documentRef.createElement('div');
    row.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:7px 0;';
    const label = documentRef.createElement('div');
    label.textContent = `${workload.label} · ${workload.metric}`;
    label.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-primary);';
    const fit = documentRef.createElement('div');
    fit.textContent = workload.fit;
    fit.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    row.append(label, fit);
    workloads.appendChild(row);
  });
  topGrid.append(axes, workloads);
  host.appendChild(topGrid);

  const entityTitle = documentRef.createElement('div');
  entityTitle.textContent = '추론 하드웨어 reference map';
  entityTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(entityTitle);
  const entities = documentRef.createElement('div');
  entities.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:14px;';
  AI_INFERENCE_EFFICIENCY_REFERENCE.entities.forEach((entity) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const name = documentRef.createElement('div');
    name.textContent = entity.label;
    name.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);';
    const detail = documentRef.createElement('div');
    detail.textContent = `${entity.memory} · ${entity.specialization}`;
    detail.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:4px;';
    const fit = documentRef.createElement('div');
    fit.textContent = `${entity.fit} · ${entity.status}`;
    fit.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(name, detail, fit);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    entities.appendChild(card);
  });
  host.appendChild(entities);

  const proxyTitle = documentRef.createElement('div');
  proxyTitle.textContent = '현재 시장 프록시 (구조 노출의 참고값, 판단 근거 아님)';
  proxyTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(proxyTitle);
  const proxyRow = documentRef.createElement('div');
  proxyRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;';
  proxies.forEach((item) => {
    const chip = documentRef.createElement('span');
    chip.textContent = item.pct == null ? item.symbol : `${item.symbol} ${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`;
    chip.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:3px;padding:4px 7px;';
    chip.setAttribute('data-source-kind', item.sourceKind);
    chip.setAttribute('data-operational-use', item.pct == null ? 'blocked' : 'reference-only');
    chip.title = item.pct == null ? `${item.label} 현재 시세 미수신` : `${item.label} 등락률은 구조적 승자 판정이 아님`;
    proxyRow.appendChild(chip);
  });
  host.appendChild(proxyRow);

  const mapTitle = documentRef.createElement('div');
  mapTitle.textContent = 'AI 거래의 순환 구조 · Bloomberg 도식의 역할/엣지 해석';
  mapTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(mapTitle);
  const map = documentRef.createElement('div');
  map.style.cssText = 'display:grid;grid-template-columns:1.05fr 1fr;gap:14px;margin-bottom:10px;';
  const nodes = documentRef.createElement('div');
  nodes.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;';
  AI_DEAL_ECOSYSTEM_NODES.forEach((node) => {
    const chip = documentRef.createElement('span');
    chip.textContent = node.label;
    chip.title = node.role;
    chip.style.cssText = 'font-size:10px;color:var(--text-secondary);background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:3px;padding:3px 5px;';
    chip.setAttribute('data-source-kind', 'REFERENCE');
    chip.setAttribute('data-operational-use', 'reference-only');
    nodes.appendChild(chip);
  });
  const edges = documentRef.createElement('div');
  AI_DEAL_ECOSYSTEM_EDGES.forEach((edge) => {
    const row = documentRef.createElement('div');
    row.textContent = `${edge.kind.toUpperCase()} · ${edge.label}`;
    row.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);padding:3px 0;';
    row.setAttribute('data-source-kind', 'REFERENCE');
    row.setAttribute('data-operational-use', 'reference-only');
    edges.appendChild(row);
  });
  map.append(nodes, edges);
  host.appendChild(map);

  const lensTitle = documentRef.createElement('div');
  lensTitle.textContent = '추가 검증 렌즈 · 자료 통합 (REFERENCE)';
  lensTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(lensTitle);
  const lensGrid = documentRef.createElement('div');
  lensGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px;';
  AI_INFRASTRUCTURE_REFERENCE_LENSES.forEach((lens) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const label = documentRef.createElement('div');
    label.textContent = lens.label;
    label.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const thesis = documentRef.createElement('div');
    thesis.textContent = lens.thesis;
    thesis.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-secondary);';
    const observe = documentRef.createElement('div');
    observe.textContent = `관측: ${lens.observe}`;
    observe.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:4px;';
    const invalidation = documentRef.createElement('div');
    invalidation.textContent = `무효화: ${lens.invalidation}`;
    invalidation.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(label, thesis, observe, invalidation);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    lensGrid.appendChild(card);
  });
  host.appendChild(lensGrid);

  const supplyTitle = documentRef.createElement('div');
  supplyTitle.textContent = '가속기 밸류체인 역할 map · 첨부 표 해석';
  supplyTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(supplyTitle);
  const supplyGrid = documentRef.createElement('div');
  supplyGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-bottom:10px;';
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE.forEach((item) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:4px;padding:7px;';
    const label = documentRef.createElement('div');
    label.textContent = item.label;
    label.style.cssText = 'font-size:10px;font-weight:800;color:var(--text-primary);';
    const roles = documentRef.createElement('div');
    roles.textContent = item.roles;
    roles.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:3px;';
    const question = documentRef.createElement('div');
    question.textContent = item.question;
    question.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(label, roles, question);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    supplyGrid.appendChild(card);
  });
  host.appendChild(supplyGrid);
  const note = documentRef.createElement('div');
  note.textContent = '도식·첨부 표의 업체명·원 크기·화살표·사양은 역할과 검증 질문을 만드는 REFERENCE입니다. 현재 시가총액·계약·투자금액·공급사 매출·성능 순위를 의미하지 않으며, qualification·공시·현금흐름 확인 전 종목 점수에 편입하지 않습니다.';
  note.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);border-top:1px solid var(--border-subtle);padding-top:8px;';
  note.setAttribute('data-source-kind', 'REFERENCE');
  note.setAttribute('data-operational-use', 'reference-only');
  host.appendChild(note);
}

export function createThemesPage({ root = globalThis, documentRef, store, route = 'themes' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
        routeId: route,
        heading: route === 'theme-detail' ? '테마 상세 · AI 수요·운영·현금 전환' : '테마 · AI 가치사슬·qualification·운영 검증'
      });
      page.appendChild(suppliedMaterialBridge);
      bag.add(() => suppliedMaterialBridge.remove());
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureSlice = 'themes';
      if (route === 'themes') {
        page.dataset.aioArchitectureRenderer = 'native';
        const container = documentRef.getElementById('rrg-quadrant-cards');
        const rrgStatusHost = documentRef.getElementById('rrg-chart-status');
        const rrgCanvasHost = documentRef.getElementById('rrg-canvas');
        const cyclePillHost = documentRef.getElementById('theme-cycle-pill');
         const performanceNarrativeHost = documentRef.getElementById('sector-perf-analysis');
         const performanceBarsHost = documentRef.getElementById('sector-perf-bars');
         const detailPanel = documentRef.getElementById('theme-detail-panel');
         const detailHost = documentRef.getElementById('theme-detail-native-summary');
        const compositionHost = documentRef.getElementById('theme-detail-native-composition');
        const leaderHost = documentRef.getElementById('theme-detail-native-leaders');
        const temperatureHost = documentRef.getElementById('theme-detail-native-temperature');
        const spreadHost = documentRef.getElementById('theme-detail-native-spread');
        const breadthHealthHost = documentRef.getElementById('theme-detail-native-breadth-health');
        const subthemeGapHost = documentRef.getElementById('theme-detail-native-subtheme-gap');
        const benchmarkHost = documentRef.getElementById('theme-detail-native-benchmark');
        const insightsHost = documentRef.getElementById('theme-detail-native-insights');
         const requestThemeDetail = (themeId) => {
           const id = String(themeId || '').trim();
           if (!id) return;
           root._currentThemeId = id;
           if (typeof root.showThemeDetail === 'function') {
             root.showThemeDetail(id);
             return;
           }
           eventTarget?.dispatchEvent?.(new CustomEvent('aio:themeDetailShown', { detail: { themeId: id } }));
         };
        if (container) container.dataset.aioThemesRenderer = 'native';
        if (rrgStatusHost) rrgStatusHost.dataset.aioRrgStatusRenderer = 'native';
        if (rrgCanvasHost) rrgCanvasHost.dataset.aioRrgChartRenderer = 'native';
        if (cyclePillHost) cyclePillHost.dataset.aioThemeCycleRenderer = 'native';
         if (performanceNarrativeHost) performanceNarrativeHost.dataset.aioThemePerformanceRenderer = 'native';
         if (performanceBarsHost) performanceBarsHost.dataset.aioThemePerformanceBarsRenderer = 'native';
         if (detailPanel) detailPanel.dataset.aioThemeDetailPanelRenderer = 'native';
        const renderNow = () => {
           renderThemes({ documentRef, root, store, route });
          renderRRGStatus({ documentRef, root, store, route });
          renderRRGCanvas({ documentRef, root, store, route });
          renderThemeCyclePill({ documentRef, root, store, route });
           renderThemePerformanceNarrative({ documentRef, root, store, route });
           renderThemePerformanceBars({ documentRef, root, store, route });
           renderKrThemeArtifact({ documentRef, root, store });
          renderThemeDetailSummary({ documentRef, root, store });
          renderThemeDetailComposition({ documentRef, root, store });
          renderThemeDetailLeaders({ documentRef, root, store });
          renderThemeDetailTemperature({ documentRef, root, store });
          renderThemeDetailSpread({ documentRef, root, store });
          renderThemeDetailBreadthHealth({ documentRef, root, store });
           renderThemeDetailSubthemeGap({ documentRef, root, store });
           renderThemeDetailBenchmark({ documentRef, root, store });
           renderThemeDetailInsights({ documentRef, root, store });
           renderAiInfrastructureLens({ documentRef, root, route });
           renderThemeStrength({ documentRef, root, store }); // P1417
         };
        renderNow();
        const unsubscribe = store && subscribeToSlices(store, ['themes', 'screener'], renderNow);
        if (unsubscribe) bag.add(unsubscribe);
        const eventTarget = documentRef || root;
        ['aio:themesViewChanged', 'aio:themesHistoryLoaded', 'aio:historyLoaded', 'aio:refresh:done', 'aio:liveQuotes', 'aio:sectorPerfChanged'].forEach((eventName) => {
          eventTarget?.addEventListener?.(eventName, renderNow);
          bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
        });
        // P1417: history.json announces itself on window (js/aio-data.js), not on document.
        const windowTarget = root && root !== eventTarget ? root : null;
        if (windowTarget?.addEventListener) {
          windowTarget.addEventListener('aio:historyLoaded', renderNow);
          bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', renderNow));
        }
        const onThemeDetailShown = (event) => {
          // P800: the native detail surfaces consume the normalized store selection;
          // the legacy event payload remains a compatibility notification only.
          if (detailPanel) {
            detailPanel.style.display = 'block';
            if (event?.detail?.themeId) detailPanel.dataset.currentTheme = String(event.detail.themeId);
          }
          // The architecture listener synchronously refreshes the store before this
          // compatibility event reaches the mounted page. The store subscription is
          // the sole detail renderer; this listener owns visibility only.
        };
        const onThemeDetailClosed = () => {
          if (detailPanel) {
            detailPanel.style.display = 'none';
            delete detailPanel.dataset.currentTheme;
          }
          if (detailHost) {
            detailHost.replaceChildren();
            detailHost.hidden = true;
          }
          if (compositionHost) {
            compositionHost.replaceChildren();
            compositionHost.hidden = true;
          }
          if (leaderHost) {
            leaderHost.replaceChildren();
            leaderHost.hidden = true;
          }
          if (temperatureHost) {
            temperatureHost.replaceChildren();
            temperatureHost.hidden = true;
          }
          if (spreadHost) {
            spreadHost.replaceChildren();
            spreadHost.hidden = true;
          }
          if (breadthHealthHost) {
            breadthHealthHost.replaceChildren();
            breadthHealthHost.hidden = true;
          }
          subthemeGapHost?.replaceChildren();
          if (subthemeGapHost) subthemeGapHost.hidden = true;
          benchmarkHost?.replaceChildren();
          if (benchmarkHost) benchmarkHost.hidden = true;
          insightsHost?.replaceChildren();
          if (insightsHost) insightsHost.hidden = true;
        };
        eventTarget?.addEventListener?.('aio:themeDetailShown', onThemeDetailShown);
        eventTarget?.addEventListener?.('aio:themeDetailClosed', onThemeDetailClosed);
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailShown', onThemeDetailShown));
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailClosed', onThemeDetailClosed));
        const pendingThemeId = String(root?._aioOpenThemeDetailOnThemes || '').trim();
        if (pendingThemeId) {
          delete root._aioOpenThemeDetailOnThemes;
          queueMicrotask(() => requestThemeDetail(pendingThemeId));
        }
        bag.add(() => {
          if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
          if (container?.dataset.aioThemesRenderer === 'native') delete container.dataset.aioThemesRenderer;
          if (rrgStatusHost?.dataset.aioRrgStatusRenderer === 'native') delete rrgStatusHost.dataset.aioRrgStatusRenderer;
          if (rrgCanvasHost?.dataset.aioRrgChartRenderer === 'native') delete rrgCanvasHost.dataset.aioRrgChartRenderer;
          if (cyclePillHost?.dataset.aioThemeCycleRenderer === 'native') delete cyclePillHost.dataset.aioThemeCycleRenderer;
            if (performanceNarrativeHost?.dataset.aioThemePerformanceRenderer === 'native') delete performanceNarrativeHost.dataset.aioThemePerformanceRenderer;
            if (performanceBarsHost?.dataset.aioThemePerformanceBarsRenderer === 'native') delete performanceBarsHost.dataset.aioThemePerformanceBarsRenderer;
           if (detailPanel?.dataset.aioThemeDetailPanelRenderer === 'native') {
             detailPanel.style.display = 'none';
             delete detailPanel.dataset.aioThemeDetailPanelRenderer;
             delete detailPanel.dataset.currentTheme;
           }
          if (detailHost) {
            detailHost.replaceChildren();
            detailHost.hidden = true;
          }
          if (compositionHost) {
            compositionHost.replaceChildren();
            compositionHost.hidden = true;
          }
          if (leaderHost) {
            leaderHost.replaceChildren();
            leaderHost.hidden = true;
          }
          if (temperatureHost) {
            temperatureHost.replaceChildren();
            temperatureHost.hidden = true;
          }
          if (spreadHost) {
            spreadHost.replaceChildren();
            spreadHost.hidden = true;
          }
          if (breadthHealthHost) {
            breadthHealthHost.replaceChildren();
            breadthHealthHost.hidden = true;
          }
        });
      }
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'themes') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
