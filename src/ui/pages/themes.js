import { createResourceBag } from '../../app/lifecycle.js';
import { selectSelectedThemeDetail, selectThemesItems } from '../../state/selectors/themes.js';
import {
  AI_INFERENCE_EFFICIENCY_REFERENCE,
  AI_DEAL_ECOSYSTEM_EDGES,
  AI_DEAL_ECOSYSTEM_NODES,
  selectAiInferenceProxies
} from '../../domain/ai/inference-efficiency.js';

const QUADRANTS = Object.freeze([
  { key: 'Leading', label: '선도 Leading', sub: '비중 유지', note: '상대강도·모멘텀 모두 우위' },
  { key: 'Improving', label: '개선 Improving', sub: '진입 후보', note: '상대모멘텀 개선 중' },
  { key: 'Weakening', label: '약화 Weakening', sub: '익절 검토', note: '상대강도 대비 모멘텀 둔화' },
  { key: 'Lagging', label: '후행 Lagging', sub: '회피', note: '상대강도·모멘텀 모두 열위' }
]);

function finite(value) {
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
      && (finite(item?.rsRatio) != null || finite(item?.rsMomentum) != null)) counts[quadrant] += 1;
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
  context.fillStyle = '#22754c'; context.fillText('선도 Leading', width * 3 / 4, 22);
  context.fillStyle = '#211d16'; context.fillText('개선 Improving', width / 4, 22);
  context.fillStyle = '#211d16'; context.fillText('약화 Weakening', width * 3 / 4, height - 14);
  context.fillStyle = '#b13a30'; context.fillText('후행 Lagging', width / 4, height - 14);
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
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), 'sectors');
  const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || '');
    if (Object.prototype.hasOwnProperty.call(counts, quadrant)
      && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) counts[quadrant] += 1;
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total < 6) {
    pill.className = 'status-pill sp-neutral';
    pill.textContent = `사이클 판정 보류 · RRG 근거 ${total}/11`;
    return;
  }
  const riskOn = counts.Leading + counts.Improving >= counts.Weakening + counts.Lagging;
  pill.className = `status-pill ${riskOn ? 'sp-risk-on' : 'sp-risk-off'}`;
  pill.textContent = riskOn ? 'RRG 전환 우세 · 성장 주도' : 'RRG 전환 약세 · 방어 주도';
}

function renderThemePerformanceNarrative({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('sector-perf-analysis');
  if (!host) return;
  host.dataset.aioThemePerformanceRenderer = 'native';
  const rows = viewItems(selectThemesItems(store?.getState?.() || {}), 'sectors')
    .map((item) => ({ label: String(item?.label || item?.symbol || ''), pct: finite(item?.pct) }))
    .filter((row) => row.label && row.pct != null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length < 2) {
    host.textContent = '섹터 성과 요약 보류 · 정규화된 섹터 등락률이 2개 이상 수신되면 표시합니다.';
    host.style.color = 'var(--text-muted)';
    return;
  }
  const leaders = rows.slice(0, 2).map((row) => `${row.label} ${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`).join(' · ');
  const laggards = rows.slice(-2).reverse().map((row) => `${row.label} ${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`).join(' · ');
  host.textContent = `정규화 섹터 성과 · 강세 ${leaders} · 약세 ${laggards} · 단일 수익률만으로 비중을 결정하지 않습니다.`;
  host.style.color = 'var(--text-secondary)';
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

function createChip(documentRef, item, root, onThemeDetail) {
  const detailId = resolveThemeDetailId(root, item);
  const chip = documentRef.createElement(detailId ? 'button' : 'span');
  const pct = finite(item?.pct);
  const symbol = String(item?.symbol || item?.id || '');
  chip.dataset.themeSymbol = symbol;
  chip.textContent = `${symbol} ${String(item?.label || symbol)} ${pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}`;
  chip.style.cssText = `font-size:12px;border:1px solid var(--border-subtle);border-radius:6px;padding:4px 10px;background:var(--bg-elevated);color:var(--text-primary);font-variant-numeric:tabular-nums;${detailId ? 'cursor:pointer;text-align:left;' : ''}`;
  if (detailId) {
    chip.type = 'button';
    chip.dataset.action = 'showThemeDetail';
    chip.dataset.arg = detailId;
    chip.dataset.passEl = '1';
    chip.setAttribute('aria-label', `${String(item?.label || symbol)} 테마 상세 열기`);
    chip.title = '테마 상세 열기';
    chip.addEventListener('click', () => onThemeDetail?.(detailId));
  }
  if (pct != null) chip.style.color = pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
  return chip;
}

function renderThemes({ documentRef, root, store, route, onThemeDetail }) {
  if (route !== 'themes') return;
  const container = documentRef?.getElementById('rrg-quadrant-cards');
  if (!container) return;
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const groups = new Map(QUADRANTS.map((quadrant) => [quadrant.key, []]));
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || 'unknown');
    if (groups.has(quadrant) && (finite(item?.rsRatio) != null || finite(item?.rsMomentum) != null)) {
      groups.get(quadrant).push(item);
    }
  });
  groups.forEach((group) => group.sort((a, b) => (finite(b?.pct) ?? -Infinity) - (finite(a?.pct) ?? -Infinity)));
  const classifiedCount = [...groups.values()].reduce((count, group) => count + group.length, 0);
  container.replaceChildren();
  if (!classifiedCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = 'RRG 판정 보류 · SPY 대비 상대가격 히스토리 20개 이상 필요';
    empty.style.cssText = 'grid-column:span 2;text-align:center;padding:20px;color:var(--text-dim);font-size:12px;';
    container.appendChild(empty);
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
    if (group.length) group.forEach((item) => chips.appendChild(createChip(documentRef, item, root, onThemeDetail)));
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
  const leading = (groups.get('Leading') || []).map((item) => item.label || item.symbol).join('·') || '없음';
  const improving = (groups.get('Improving') || []).map((item) => item.label || item.symbol).join('·') || '없음';
  const read = documentRef.getElementById('rrg-rotation-read');
  if (read) read.textContent = `선도 사분면: ${leading}. 개선 사분면: ${improving}. 차트는 별도 레거시 secondary surface입니다.`;
}

function renderThemeDetailSummary({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-summary');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
  provenance.textContent = `canonical theme-detail · ${detail.source === 'quote-missing' ? '시세 reference-only' : `시세 source: ${detail.source}`} · ${membership.source || 'AIO curated taxonomy'} · ${membershipAsOf} · 참고 분류`;
  provenance.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);';
  provenance.setAttribute('data-source-kind', membership.sourceKind || 'REFERENCE');
  provenance.setAttribute('data-operational-use', membership.allowedUse === 'decision' ? 'decision' : 'reference-only');
  if (membership.observedAt) provenance.setAttribute('data-observed-at', membership.observedAt);

  host.replaceChildren(header, leaders, provenance);
  host.hidden = false;
}

function detailQuote(detail, symbol) {
  const quote = detail?.quotes?.[symbol];
  if (!quote || typeof quote !== 'object') return null;
  const price = finite(quote.price);
  const pct = finite(quote.pct);
  return price == null && pct == null ? null : { price, pct };
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

function renderThemeDetailComposition({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-composition');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
    : `브레드스(양봉비율): ${breadthValue}% · ${detail.leaders.length}종목 기준`;
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

function renderThemeDetailLeaders({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-leaders');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
    price.textContent = quote?.price == null ? '가격 대기' : `$${quote.price.toFixed(2)}`;
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

function renderThemeDetailTemperature({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-temperature');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '테마 온도 진단';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  const pct = finite(detail.pct);
  if (pct == null) body.textContent = '시세 대기 — 구성종목 가격이 확인되면 테마 모멘텀을 판정합니다.';
  else if (pct >= 3) body.textContent = '매우 강세 — 시장 전체에서 주목받는 테마입니다. 단기 과열 가능성도 확인하세요.';
  else if (pct >= 1) body.textContent = '강세 — 모멘텀이 살아있습니다. 자금 유입 가능성과 추세 지속 여부를 함께 확인하세요.';
  else if (pct >= 0) body.textContent = '보합 — 방향성을 탐색 중입니다. 추가 가격·거래량 확인이 필요합니다.';
  else if (pct >= -2) body.textContent = '약세 — 차익실현 또는 로테이션 매도 가능성이 있습니다. 일시 조정인지 확인하세요.';
  else body.textContent = '급락 — 테마 모멘텀이 약합니다. 구조적 훼손 여부를 확인하기 전 추격을 피하세요.';
  body.style.cssText = `font-size:11px;line-height:1.7;color:${pct == null ? 'var(--text-muted)' : pct >= 0 ? 'var(--text-secondary)' : 'var(--data-amber)'};`;
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailSpread({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-spread');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
    const level = spread > 5 ? '매우 큼 — 승자와 패자가 뚜렷해 종목 선별이 중요합니다.' : spread > 2 ? '보통 — 테마 전반의 움직임과 개별 종목 차이를 함께 확인하세요.' : '좁음 — 테마 전체가 같은 재료에 반응하고 있어 ETF 접근도 참고할 수 있습니다.';
    body.textContent = `등락 편차 ${spread.toFixed(1)}%p (${level})`;
    const leaders = documentRef.createElement('div');
    leaders.textContent = `최강 ${rows[0].symbol} ${rows[0].pct >= 0 ? '+' : ''}${rows[0].pct.toFixed(2)}% · 최약 ${rows[rows.length - 1].symbol} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}%`;
    leaders.style.cssText = 'color:var(--text-muted);margin-top:2px;';
    body.appendChild(leaders);
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailBreadthHealth({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-breadth-health');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '브레드스 기반 건강도';
  heading.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-secondary);margin:8px 0 4px;';
  const body = documentRef.createElement('div');
  const breadth = finite(detail.breadth);
  if (breadth == null) body.textContent = '시세 대기 — 충분한 구성종목 가격이 확인되면 테마 건강도를 판정합니다.';
  else if (breadth >= 70) body.textContent = `상승 종목 ${breadth}% · 테마 건강도 우수 — 광범위한 매수세가 테마를 지지하고 있습니다.`;
  else if (breadth >= 50) body.textContent = `상승 종목 ${breadth}% · 테마 건강도 보통 — 일부 종목 중심인지 선별이 필요합니다.`;
  else body.textContent = `상승 종목 ${breadth}% · 테마 건강도 취약 — 모멘텀 약화와 추격 매수 위험을 확인하세요.`;
  body.style.cssText = `font-size:11px;line-height:1.7;color:${breadth == null ? 'var(--text-muted)' : breadth >= 70 ? 'var(--data-green)' : breadth >= 50 ? 'var(--text-secondary)' : 'var(--data-amber)'};`;
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailSubthemeGap({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-subtheme-gap');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
    const read = spread > 1
      ? '서브테마 내에서도 자금이 순환하고 있어 선별이 필요합니다.'
      : '서브테마 간 반응은 유사해 개별 종목 차이를 함께 확인하세요.';
    body.textContent = `서브테마 격차 ${spread.toFixed(1)}%p · 최강 ${rows[0].name} ${rows[0].pct >= 0 ? '+' : ''}${rows[0].pct.toFixed(2)}% · 최약 ${rows[rows.length - 1].name} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}% — ${read}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailBenchmarkLegacyCopy({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-benchmark');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
  const benchmarkSymbol = detail.etf || detail.compositeBase || null;
  const themePct = finite(detail.pct);
  const benchmarkPct = benchmarkSymbol ? finite(detailQuote(detail, benchmarkSymbol)?.pct) : null;
  if (!benchmarkSymbol || themePct == null || benchmarkPct == null) {
    body.textContent = '시세 대기 — 테마와 벤치마크의 등락률이 확인되면 비교합니다.';
  } else {
    const diff = themePct - benchmarkPct;
    const direction = diff > 0.5 ? '상회' : diff < -0.5 ? '하회' : '유사';
    const context = direction === '상회' ? '구성 테마의 상대 모멘텀이 우세합니다.' : direction === '하회' ? '벤치마크 대비 상대 약세를 확인하세요.' : '테마와 벤치마크가 유사하게 움직였습니다.';
    body.textContent = `${benchmarkSymbol} 대비 ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p · 테마 ${themePct >= 0 ? '+' : ''}${themePct.toFixed(2)}% / 벤치마크 ${benchmarkPct >= 0 ? '+' : ''}${benchmarkPct.toFixed(2)}% · ${direction} — ${context}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailBenchmark({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-benchmark');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
  const benchmarkSymbol = detail.etf || detail.compositeBase || null;
  const themePct = finite(detail.pct);
  const benchmarkPct = benchmarkSymbol ? finite(detailQuote(detail, benchmarkSymbol)?.pct) : null;
  if (!benchmarkSymbol || themePct == null || benchmarkPct == null) {
    body.textContent = '시세 대기 — 테마와 벤치마크의 등락률이 확인되면 비교합니다.';
  } else {
    const diff = themePct - benchmarkPct;
    const direction = diff > 0.5 ? '상회' : diff < -0.5 ? '하회' : '유사';
    const context = direction === '상회' ? '구성 테마의 상대 모멘텀이 우세합니다.' : direction === '하회' ? '벤치마크 대비 상대 약세를 확인하세요.' : '테마와 벤치마크가 유사하게 움직였습니다.';
    body.textContent = `${benchmarkSymbol} 대비 ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%p · 테마 ${themePct >= 0 ? '+' : ''}${themePct.toFixed(2)}% / 벤치마크 ${benchmarkPct >= 0 ? '+' : ''}${benchmarkPct.toFixed(2)}% · ${direction} — ${context}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

function renderThemeDetailInsights({ documentRef, root, store, themeId = null, detailOverride = null }) {
  const host = documentRef?.getElementById('theme-detail-native-insights');
  if (!host) return;
  const detail = detailOverride || selectSelectedThemeDetail(store?.getState?.() || {});
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
    const empty = documentRef.createElement('div');
    empty.textContent = '테마 인사이트 데이터 대기';
    empty.style.color = 'var(--text-muted)';
    body.appendChild(empty);
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
  badge.textContent = liveCount ? `REFERENCE · 공개 프록시 ${liveCount}/${proxies.length}개 수신` : 'REFERENCE · 현재 프록시 수신 대기';
  badge.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-muted);';
  header.append(title, badge);
  host.appendChild(header);

  const intro = documentRef.createElement('div');
  intro.textContent = '다음 AI 경쟁의 단위를 단일 칩 승자가 아니라 workload stage별 비용·지연·전력으로 재정의합니다. 아래 업체·구조·거래선은 자료에서 추출한 연구 지도이며 현재 매출·밸류에이션·성능 순위가 아닙니다.';
  intro.style.cssText = 'font-size:12px;line-height:1.7;color:var(--text-secondary);margin-bottom:12px;';
  host.appendChild(intro);

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
    chip.textContent = `${item.symbol} ${item.pct == null ? '—' : `${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`}`;
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
  const note = documentRef.createElement('div');
  note.textContent = '도식의 원 크기·화살표는 2026-06-08 기준 Bloomberg 참고 이미지의 시각적 관계를 보존한 것이며, 현재 시가총액·계약·투자금액·지배관계를 의미하지 않습니다.';
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
         let activeThemeDetail = null;
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
           renderThemes({ documentRef, root, store, route, onThemeDetail: requestThemeDetail });
          renderRRGStatus({ documentRef, root, store, route });
          renderRRGCanvas({ documentRef, root, store, route });
          renderThemeCyclePill({ documentRef, root, store, route });
           renderThemePerformanceNarrative({ documentRef, root, store, route });
           renderThemePerformanceBars({ documentRef, root, store, route });
          renderThemeDetailSummary({ documentRef, root, store, detailOverride: activeThemeDetail });
          renderThemeDetailComposition({ documentRef, root, store, detailOverride: activeThemeDetail });
          renderThemeDetailLeaders({ documentRef, root, store, detailOverride: activeThemeDetail });
          renderThemeDetailTemperature({ documentRef, root, store, detailOverride: activeThemeDetail });
          renderThemeDetailSpread({ documentRef, root, store, detailOverride: activeThemeDetail });
          renderThemeDetailBreadthHealth({ documentRef, root, store, detailOverride: activeThemeDetail });
           renderThemeDetailSubthemeGap({ documentRef, root, store, detailOverride: activeThemeDetail });
           renderThemeDetailBenchmark({ documentRef, root, store, detailOverride: activeThemeDetail });
           renderThemeDetailInsights({ documentRef, root, store, detailOverride: activeThemeDetail });
           renderAiInfrastructureLens({ documentRef, root, route });
         };
        renderNow();
        const unsubscribe = store?.subscribe?.(renderNow);
        if (unsubscribe) bag.add(unsubscribe);
        const eventTarget = documentRef || root;
        ['aio:themesViewChanged', 'aio:themesHistoryLoaded', 'aio:historyLoaded', 'aio:refresh:done', 'aio:liveQuotes', 'aio:sectorPerfChanged'].forEach((eventName) => {
          eventTarget?.addEventListener?.(eventName, renderNow);
          bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
        });
        const onThemeDetailShown = (event) => {
          // P800: the native detail surfaces consume the normalized store selection;
          // the legacy event payload remains a compatibility notification only.
          activeThemeDetail = selectSelectedThemeDetail(store?.getState?.() || {});
          if (detailPanel) {
            detailPanel.style.display = 'block';
            if (event?.detail?.themeId) detailPanel.dataset.currentTheme = String(event.detail.themeId);
          }
          renderThemeDetailSummary({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailComposition({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailLeaders({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailTemperature({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailSpread({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailBreadthHealth({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailSubthemeGap({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailBenchmark({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
          renderThemeDetailInsights({
            documentRef,
            root,
            store,
            themeId: event?.detail?.themeId,
            detailOverride: activeThemeDetail
          });
        };
        const onThemeDetailClosed = () => {
          activeThemeDetail = null;
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
          activeThemeDetail = null;
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
