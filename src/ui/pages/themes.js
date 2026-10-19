import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { chartPalette } from '../components/color-theme.js';
import { selectSelectedThemeDetail, selectThemesItems } from '../../state/selectors/themes.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { renderThemeStrength } from '../components/theme-strength.js';
import { renderThemePlaybook, renderThemeDetailPlaybook } from '../components/theme-playbook.js'; // P1743
import { renderSectorMap } from '../components/sector-map.js';
import { renderIndexEarnings } from '../components/index-earnings.js';
import { renderAiInfrastructureLens } from '../components/ai-infrastructure-lens.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { rotationFlow, themeDetailFlow } from '../../domain/market/page-flow.js';
import { krThemeArtifactRead } from '../../domain/themes/kr-themes.js';
import { buildGroupStrength } from '../../domain/themes/group-strength.js';
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { rrgAxisDomain, RRG_DEFINITION, RRG_QUADRANT_READS, RRG_QUADRANT_WORDS } from '../../domain/themes/rrg.js';
import { rrgRecentReading, RRG_NEUTRAL_BAND } from '../../domain/themes/recent-check.js';
import { benchmarkReturns, basisOf } from '../components/theme-strength.js';
import { readMarketRegime } from '../components/market-regime.js';
import { renderNextSteps } from '../components/page-flow.js';

// v57.76: plain-Korean quadrant notes (no 모멘텀 jargon). 100 is the sector's own 100-session average relative price.
// v57.81 (audit): the notes name both windows and no longer say "계속 강해지는 중 / 나아지는 중" — the vertical axis
// compares with about 50 sessions ago, so a sector can sit in 선도 while its last week fell hard (the chip then says so).
// A point within the neutral band around 100 on either axis is 경계 and stays out of the four verdicts.
const QUADRANTS = Object.freeze([
  ...['Leading', 'Improving', 'Weakening', 'Lagging'].map((key) => ({ key, label: RRG_QUADRANT_WORDS[key], note: RRG_QUADRANT_READS[key] })),
  // v57.84 (owner decision 3-3): the band is each sector's own typical 5-session move on that axis, with hysteresis.
  { key: 'Border', label: '기준선 부근', note: `두 축 중 하나가 100에 그 섹터의 평소 5거래일 움직임만큼 가까워 사분면을 정하지 않음(움직임 기록이 없으면 ±${RRG_NEUTRAL_BAND}). 한 번 정한 사분면은 반대쪽으로 그 폭의 절반을 넘어야 바뀜`, optional: true }
]);

// v57.81: the banded zone and the five-session relative-strength check of one item, from the session-checked artifact row.
function readingOf(root, item) {
  const symbol = String(item?.symbol || item?.id || '');
  const produced = symbol ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, symbol, Date.now()) : null;
  // v57.84: the produced 20-session trail sizes the band and carries hysteresis (recent-check.js rrgZone).
  return rrgRecentReading({ ...item, trail: produced?.trail || item?.trail || null }, produced?.relativeStrength || null);
}
function zoneKey(root, item) {
  const reading = readingOf(root, item);
  return reading?.border ? 'Border' : String(reading?.quadrant || item?.quadrant || '');
}

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

function shortSession(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

function usCloseSession(root) {
  const basis = String(root?._serverDataMeta?.rotationHistory?.latestCompletedSession || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(basis) ? basis : '';
}

function krCloseSession(rows = []) {
  const dates = (rows || [])
    .filter((row) => /^\d{6}\.(KS|KQ)$/i.test(String(row?.sym || row?.symbol || '')))
    .map((row) => String(row?.observedAt || '').slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return dates.length ? dates[dates.length - 1] : '';
}

function renderRRGStatus({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const status = documentRef?.getElementById('rrg-chart-status');
  if (!status) return;
  status.dataset.aioRrgStatusRenderer = 'native';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0, Border: 0 };
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || '');
    if (Object.prototype.hasOwnProperty.call(counts, quadrant) && quadrant !== 'Border'
      && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) counts[zoneKey(root, item)] += 1;
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!total) {
    status.textContent = items.length
      ? '섹터 회전 판정 보류 · 상대강도 기록이 부족합니다'
      : '섹터 상대강도 기록 수신 대기';
    status.style.color = 'var(--text-muted)';
    return;
  }
  // Expert review M08: no grade or risk colour from the quadrant counts. The benchmark (SPY) is cap-weighted, so a
  // few mega-caps lifting the index put most sectors below 100 without any sector "weakening" on its own.
  // v57.76: that caveat lives once, in the 사분면별 섹터 fold (rrg-method-note); the line above the chart keeps the
  // counts and the close it was measured on.
  const close = usCloseSession(root);
  status.textContent = `선도 ${counts.Leading} · 개선 ${counts.Improving} · 약화 ${counts.Weakening} · 후행 ${counts.Lagging}${counts.Border ? ` · 기준선 부근 ${counts.Border}` : ''} · 약 50일 상대강도 · ${close ? `${shortSession(close)} 미국 종가 기준` : '완료 종가 기준'}`;
  status.style.color = 'var(--text-dim)';
}

function renderRRGCanvas({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const canvas = documentRef?.getElementById('rrg-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  canvas.dataset.aioRrgChartRenderer = 'native';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const validItems = items.filter((item) => finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null);
  // v57.76: the scatter is the section's visual. Its height follows the frame width (taller ratio on a phone so the
  // eleven dots do not crowd), and the backing store follows devicePixelRatio so text stays sharp. Drawing below is in
  // CSS pixels; a hidden frame (no judged sector) falls back to a desktop size.
  const frameWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  const width = frameWidth > 0 ? Math.round(frameWidth) : 900;
  const compact = width < 520;
  const height = Math.max(260, Math.min(520, Math.round(width * (compact ? 0.9 : 0.55))));
  const ratio = Math.max(1, Math.min(3, Number(root?.devicePixelRatio) || 1));
  const backingWidth = Math.round(width * ratio);
  const backingHeight = Math.round(height * ratio);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  if (canvas.style) canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform?.(ratio, 0, 0, ratio, 0, 0);
  const palette = chartPalette(root);
  // Expert review M19: the point colours are the legend's own CSS tokens, so the 개선 dot matches its legend entry
  // and every colour follows the dark theme (the old hard-coded ink vanished on the dark canvas).
  let style = null;
  try { style = root.getComputedStyle(documentRef.body); } catch (_) { style = null; }
  const token = (key, fallback) => style?.getPropertyValue?.(key)?.trim() || fallback;
  const colors = { Leading: token('--data-green', '#22754c'), Improving: token('--data-cyan', '#211d16'), Weakening: token('--data-amber', '#7a5000'), Lagging: token('--data-red', '#b13a30') };
  const muted = token('--text-muted', '#8a8271');
  // M09: axes span the plotted points (and the 100 baseline) instead of clipping at ±3.5.
  const domain = rrgAxisDomain(validItems);
  const plot = { left: compact ? 40 : 46, right: width - (compact ? 10 : 14), top: 24, bottom: height - (compact ? 36 : 40) };
  const px = (value) => plot.left + (value - domain.x.min) / (domain.x.max - domain.x.min) * (plot.right - plot.left);
  const py = (value) => plot.bottom - (value - domain.y.min) / (domain.y.max - domain.y.min) * (plot.bottom - plot.top);
  const baseX = px(100);
  const baseY = py(100);
  context.clearRect(0, 0, width, height);
  const shade = (color, x0, y0, x1, y1) => { context.globalAlpha = 0.07; context.fillStyle = color; context.fillRect(x0, y0, x1 - x0, y1 - y0); context.globalAlpha = 1; };
  shade(colors.Leading, baseX, plot.top, plot.right, baseY);
  shade(colors.Improving, plot.left, plot.top, baseX, baseY);
  shade(colors.Weakening, baseX, baseY, plot.right, plot.bottom);
  shade(colors.Lagging, plot.left, baseY, baseX, plot.bottom);
  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  context.font = compact ? '10px Inter, sans-serif' : '12px Inter, sans-serif'; // v57.91 (visual audit): desktop ticks match the page's smallest text
  context.fillStyle = palette.text;
  context.textAlign = 'center';
  // On a phone, every other x tick is labelled so neighbouring values do not overlap.
  const xLabelEvery = compact && domain.x.ticks.length > 6 ? 2 : 1;
  domain.x.ticks.forEach((tick, index) => {
    const x = px(tick);
    context.beginPath(); context.moveTo(x, plot.bottom); context.lineTo(x, plot.bottom + 4); context.stroke();
    if (index % xLabelEvery === 0) context.fillText(String(tick), x, plot.bottom + 15);
  });
  context.textAlign = 'right';
  for (const tick of domain.y.ticks) {
    const y = py(tick);
    context.beginPath(); context.moveTo(plot.left - 4, y); context.lineTo(plot.left, y); context.stroke();
    context.fillText(String(tick), plot.left - 6, y + 3);
  }
  context.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
  context.setLineDash([4, 4]);
  context.beginPath(); context.moveTo(baseX, plot.top); context.lineTo(baseX, plot.bottom); context.stroke();
  context.beginPath(); context.moveTo(plot.left, baseY); context.lineTo(plot.right, baseY); context.stroke();
  context.setLineDash([]);
  context.font = '11px Inter, sans-serif';
  context.textAlign = 'center';
  // v57.50 D13: 100 is the sector's own 100-session average relative price, not "the same as SPY".
  // v57.76: plain-Korean axis titles; the precise definitions sit once in the 사분면별 섹터 fold.
  context.fillText(compact ? '상대강도(시장 대비) →' : '상대강도(시장 대비 · 100 = 50일 평균) →', (plot.left + plot.right) / 2, height - 6);
  context.save();
  context.translate(11, (plot.top + plot.bottom) / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(compact ? '상대강도 변화 속도 ↑' : '상대강도 변화 속도(10거래일 전 대비) ↑', 0, 0);
  context.restore();
  const note = documentRef.getElementById('rrg-method-note');
  if (note) note.textContent = `이 그림은 흔히 RRG(상대 회전 그래프)라 부르는 방식입니다. ${RRG_DEFINITION.ratio}. ${RRG_DEFINITION.momentum}. ${RRG_DEFINITION.benchmarkBias}`;
  context.font = 'bold 12px Inter, sans-serif';
  context.textAlign = 'right'; context.fillStyle = colors.Leading; context.fillText('선도', plot.right - 6, plot.top + 14);
  context.fillStyle = colors.Weakening; context.fillText('약화', plot.right - 6, plot.bottom - 6);
  context.textAlign = 'left'; context.fillStyle = colors.Improving; context.fillText('개선', plot.left + 6, plot.top + 14);
  context.fillStyle = colors.Lagging; context.fillText('후행', plot.left + 6, plot.bottom - 6);
  context.textAlign = 'center';
  if (!validItems.length) {
    context.fillStyle = muted;
    context.font = '12px Inter, sans-serif';
    context.fillText('상대강도 기록 수신 대기', (plot.left + plot.right) / 2, (plot.top + plot.bottom) / 2);
    return;
  }
  const placed = [];
  // v57.76: a label is kept inside the canvas (a dot at the right edge used to cut its ticker in half on a phone).
  const inside = (text, x) => {
    const half = (context.measureText?.(text)?.width || text.length * 6) / 2;
    return Math.min(Math.max(x, half + 2), width - half - 2);
  };
  validItems.forEach((item) => {
    const x = px(item.rsRatio);
    const y = py(item.rsMomentum);
    const color = colors[zoneKey(root, item)] || muted; // v57.84: the settled zone's colour (경계 muted), as in the cards
    context.beginPath();
    context.arc(x, y, compact ? 5 : 6, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = palette.grid;
    context.stroke();
    // v57.91 (visual audit, XLC/XLK overlap): collisions use measured widths and include the name lines; a crowded
    // label flips below its dot before stacking further away.
    const symbol = String(item.symbol || item.id || '');
    context.font = 'bold 11px system-ui';
    const symbolWidth = context.measureText?.(symbol)?.width || symbol.length * 7;
    const hits = (ly, lw) => placed.some((spot) => Math.abs(spot.x - x) < (spot.w + lw) / 2 + 4 && Math.abs(spot.y - ly) < 13);
    const labelY = [y - 9, y + 20, y - 22, y + 33, y - 35, y - 48].find((ly) => !hits(ly, symbolWidth)) ?? y - 48;
    placed.push({ x, y: labelY, w: symbolWidth });
    context.fillStyle = color;
    context.fillText(symbol, inside(symbol, x), labelY);
    // The Korean name under the dot is a desktop extra; on a phone it overlapped the neighbouring tickers.
    if (!compact && activeView(root) !== 'all' && labelY === y - 9) {
      const name = String(item.label || '');
      context.font = '10px system-ui';
      const nameWidth = context.measureText?.(name)?.width || name.length * 10;
      if (!hits(y + 16, nameWidth)) {
        placed.push({ x, y: y + 16, w: nameWidth });
        context.fillStyle = muted;
        context.fillText(name, inside(name, x), y + 16);
      }
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
  const viewLabel = { sectors: '섹터', subsectors: '세부 업종', all: '전체' }[view] || '섹터';
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), view);
  const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0, Border: 0 };
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || '');
    if (Object.prototype.hasOwnProperty.call(counts, quadrant) && quadrant !== 'Border'
      && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) counts[zoneKey(root, item)] += 1;
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  // v57.54 audit (2): with nothing judged the verdict line below is the one status line; the pill would repeat it.
  pill.hidden = total === 0;
  if (total < 6) {
    pill.className = 'status-pill sp-neutral';
    pill.textContent = `섹터 회전 대기 · ${viewLabel} ${items.length}개 중 ${total}개 판정`; // P1591 (T01)
    return;
  }
  // Expert review M08: the split is a count, not a risk-on/off grade — one neutral pill colour.
  pill.className = 'status-pill sp-neutral';
  // P1352: quadrant counts describe relative strength, not sector identity or the business cycle.
  pill.textContent = `${viewLabel} 상대강도 · 선도·개선 ${counts.Leading + counts.Improving}/${total} · 약화·후행 ${counts.Weakening + counts.Lagging}/${total}${counts.Border ? ` · 기준선 부근 ${counts.Border}/${total}` : ''}`;
}

// v57.76: the 섹터 흐름 분석 box (sector-perf-analysis) and its writer are retired — it repeated the 섹터 회전 판정
// sentence and the 1일·1주 bars right above it.

// P1444: KR themes from the published screener rows; the summary states what is actually covered.
function renderKrThemeArtifact({ documentRef, root, store }) {
  const host = documentRef?.getElementById('kr-themes-artifact-read');
  if (!host) return;
  const themeMap = root?.KR_THEME_MAP && typeof root.KR_THEME_MAP === 'object' ? root.KR_THEME_MAP : null;
  if (!themeMap) { host.hidden = true; return; }
  const read = krThemeArtifactRead({ themeMap, rows: store?.getState?.()?.screener?.rows || [] });
  const krClose = krCloseSession(store?.getState?.()?.screener?.rows || []);
  const summary = documentRef.getElementById('kr-themes-summary');
  if (summary) summary.textContent = `한국 테마 (${read.totalThemes}개 중 ${read.coveredThemes}개를 ${krClose ? `${shortSession(krClose)} ` : ''}확정 종가로 비교)`;
  host.dataset.aioKrThemeArtifactRenderer = 'native';
  host.hidden = false;
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  host.replaceChildren(el('h2', '한국 테마 흐름', 'briefing-h2'), el('p', read.read, 'flow-lead'));
  const max = Math.max(1, ...read.usable.map((theme) => Math.abs(theme.ret1m)));
  // P1591 (T09/T10): the strongest and the weakest six both show (the reading names the weak ones), and bars
  // grow from a zero line so a loss never looks like a long gain.
  const shown = read.usable.length > 12 ? [...read.usable.slice(0, 6), ...read.usable.slice(-6)] : read.usable;
  if (read.usable.length > 12) host.append(el('p', `상위 6개와 하위 6개 · 전체 ${read.usable.length}개 중`, 'theme-strength-basis'));
  for (const theme of shown) {
    const line = el('div', null, 'stock-read-bars');
    const item = el('div', null, 'stock-read-bar-row');
    const track = el('div', null, 'stock-read-track');
    track.style.position = 'relative';
    const bar = el('div', null, `stock-read-bar is-stock ${theme.ret1m >= 0 ? 'is-up' : 'is-down'}`);
    const half = `${(Math.abs(theme.ret1m) / max * 50).toFixed(1)}%`;
    bar.style.cssText = `position:absolute;top:0;width:max(2px, ${half});${theme.ret1m >= 0 ? 'left:50%' : `left:calc(50% - ${half})`};`;
    const zero = el('span'); zero.style.cssText = 'position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--border);';
    track.append(zero, bar);
    item.append(track, el('span', `1개월 ${theme.ret1m >= 0 ? '+' : ''}${theme.ret1m.toFixed(1)}% · 3개월 ${theme.ret3m == null ? '—' : `${theme.ret3m >= 0 ? '+' : ''}${theme.ret3m.toFixed(1)}%`}${theme.above50Pct != null ? ` · 50일선 위 ${theme.above50Pct}%` : ''} · ${theme.covered}/${theme.members}종목`, 'stock-read-bar-value'));
    line.append(el('span', theme.label, 'stock-read-bar-label'), item);
    host.append(line);
  }
  host.append(el('p', `위 흐름은 ${krClose ? `${shortSession(krClose)} ` : ''}확정 종가 기준입니다. 장중 실시간 등락은 아래 접힌 칸에서 국내 시세가 들어올 때만 계산됩니다.`, 'theme-strength-basis'));
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
      label: themeItemLabel(root, item),
      pct: finite(mode === '1w' ? item?.weeklyPct : item?.pct),
      // v57.84: the bar badge reads the same banded zone as the scatter — a point within ±band of 100 is 경계 here too.
      quadrant: zoneKey(root, item) || 'neutral'
    }))
    .filter((row) => row.symbol)
    .sort((a, b) => {
      if (a.pct == null && b.pct == null) return a.symbol.localeCompare(b.symbol);
      if (a.pct == null) return 1;
      if (b.pct == null) return -1;
      return b.pct - a.pct;
    });
  host.replaceChildren();
  // v57.54 audit (2): eleven "— 대기" rows are not a reading; with no completed-close return at all the section hides.
  const section = host.closest('.aio-section');
  if (section) section.hidden = !selectThemesItems(store?.getState?.() || {}).some((item) => finite(item?.pct) != null || finite(item?.weeklyPct) != null); // either period, so a tab never hides its own way back
  if (!rows.length) {
    const empty = documentRef.createElement('div');
    empty.textContent = '섹터 성과 데이터 수신 대기';
    empty.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);font-size:12px;';
    host.appendChild(empty);
    return;
  }
  const maxAbs = Math.max(0.5, ...rows.map((row) => Math.abs(row.pct ?? 0)));
  const close = usCloseSession(root);
  if (close) {
    const basisLine = documentRef.createElement('div');
    basisLine.textContent = `${shortSession(close)} 미국 종가 기준 · 값이 없는 섹터는 대기`;
    basisLine.style.cssText = 'font-size:11px;color:var(--text-muted);padding:0 2px 4px;';
    host.appendChild(basisLine);
  }
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
    label.style.cssText = 'width:70px;font-size:11px;color:var(--text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const track = documentRef.createElement('span');
    track.style.cssText = 'flex:1;display:flex;align-items:center;position:relative;min-width:40px;height:12px;';
    const zero = documentRef.createElement('span');
    zero.style.cssText = 'position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border);';
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
    badge.textContent = row.pct == null ? '대기' : (row.quadrant === 'Border' ? '기준선 부근' : RRG_QUADRANT_WORDS[row.quadrant] || '중립');
    badge.style.cssText = `width:68px;padding-left:6px;white-space:nowrap;flex-shrink:0;font-size:11px;color:${row.pct == null ? 'var(--text-muted)' : colors[row.quadrant] || 'var(--text-muted)'};`;
    line.append(symbol, label, track, value, badge);
    host.appendChild(line);
  });
}

function themeDefinitionOf(root, item) {
  const symbol = String(item?.symbol || item?.id || '').trim().toUpperCase();
  const catalog = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  return catalog.find((entry) => (
    String(entry?.id || '').trim() === String(item?.id || '').trim()
    || String(entry?.etf || '').trim().toUpperCase() === symbol
    || String(entry?.compositeBase || '').trim().toUpperCase() === symbol
  )) || null;
}

function resolveThemeDetailId(root, item) {
  const theme = themeDefinitionOf(root, item);
  return theme?.id ? String(theme.id) : null;
}

function themeItemLabel(root, item) {
  const theme = themeDefinitionOf(root, item);
  return String(theme?.nameKr || theme?.name || item?.label || item?.symbol || item?.id || '').trim();
}

function themeDetailDeepLink(hash) {
  const value = String(hash || '').replace(/^#/, '');
  if (value !== 'theme-detail' && !/^theme-detail[/?]/.test(value)) return null;
  const rest = value.slice('theme-detail'.length).replace(/^[/?]+/, '');
  const themeId = rest ? rest.split('&')[0].split('=').pop() : '';
  let decoded = themeId;
  try { decoded = decodeURIComponent(themeId); } catch (_) { decoded = themeId; }
  return { requested: true, themeId: String(decoded || '').trim() || null };
}

function createChip(documentRef, item, root) {
  const detailId = resolveThemeDetailId(root, item);
  const chip = documentRef.createElement(detailId ? 'button' : 'span');
  const pct = finite(item?.pct);
  const symbol = String(item?.symbol || item?.id || '');
  const label = themeItemLabel(root, item) || symbol;
  chip.dataset.themeSymbol = symbol;
  // LC-54: 상세 제공 여부를 데이터 계약으로 드러낸다 — 읽기 전용 칩과 상세 버튼이
  // 같은 외형이면 사용자가 눌러도 아무 일도 없는 이유를 알 수 없다.
  chip.dataset.detailAvailability = detailId ? 'available' : 'summary-only';
  // P1505: the quadrant says where a sector stands on relative strength; the period return is a separate number.
  // Only the return is coloured, so a lagging sector that rose today no longer reads as a green chip in 후행.
  chip.textContent = `${symbol} ${label}`;
  if (pct != null) {
    const change = documentRef.createElement('span');
    change.textContent = ` ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
    change.style.color = pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
    chip.append(change);
  }
  // v57.81: a 경계 chip names the quadrants it sits between; a chip whose last five sessions of relative strength ran
  // against its quadrant says so (rrgRecentReading), so 선도 is never read as "still strengthening" during a break.
  const reading = item?.rrgReading || null;
  if (reading?.border || reading?.reversal) {
    chip.dataset.rrgReading = reading.label;
    const note = documentRef.createElement('span');
    note.textContent = `${reading.border ? ` · ${reading.between} 사이` : ''}${item.recentReversal ? ` · 최근 5거래일 ${item.recentReversal}` : ''}`;
    note.style.color = 'var(--text-secondary)';
    chip.append(note);
  }
  chip.style.cssText = `font-size:12px;border:1px ${detailId ? 'solid' : 'dashed'} var(--border-subtle);border-radius:6px;padding:4px 10px;background:var(--bg-elevated);color:var(--text-primary);font-variant-numeric:tabular-nums;${detailId ? 'cursor:pointer;text-align:left;' : ''}`; // v57.77 (a11y): the dashed border marks summary-only; opacity dropped the % below 4.5:1
  if (detailId) {
    chip.type = 'button';
    chip.dataset.action = 'showThemeDetail';
    chip.dataset.arg = detailId;
    chip.dataset.passEl = '1';
    chip.setAttribute('aria-label', `${chip.textContent} — 테마 상세 열기`); // v57.77 (a11y 2.5.3): the name starts with the visible text
    chip.title = '테마 상세 열기';
  } else {
    // Codex browser audit H23: the leading sector (e.g. XLK) ended the "which sector → why → which company" path.
    // A summary-only sector now takes the reader to the sub-theme ranking, where its themes and names are listed.
    chip.setAttribute('role', 'button');
    chip.tabIndex = 0;
    chip.style.cursor = 'pointer';
    chip.setAttribute('aria-label', `${chip.textContent} — 상세 패널 없음, 세부 테마 순위로 이동`);
    chip.title = '이 업종 자체의 상세 패널은 없습니다 — 눌러서 아래 세부 테마 순위에서 관련 테마와 대표 종목을 확인합니다.';
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
    if (groups.has(quadrant) && quadrant !== 'Border' && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) {
      // v57.81: the neutral band (경계) and the five-session reversal travel with the item to the chip and the verdict line.
      const reading = readingOf(root, item);
      const reversal = reading?.reversal ? `상대강도 ${reading.check.change >= 0 ? '+' : ''}${reading.check.change.toFixed(1)}% ${reading.reversal === 'fell' ? '반락' : '반등'}` : null;
      groups.get(reading?.border ? 'Border' : (reading?.quadrant || quadrant)).push({ ...item, rrgReading: reading, recentReversal: reversal });
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
  // v57.76: the quadrant definition is the fold's method note (rrg-method-note); the legend keeps only the chip facts.
  legend.textContent = `칩 옆 % = 1일 등락률로, 사분면(가로 50일 평균 대비 · 세로 10거래일 전 대비)과 별개라 후행 섹터가 그날은 올랐을 수 있습니다. '최근 5거래일 상대강도'는 그 주 움직임이 평소 1주 움직임의 2배를 넘게 사분면과 반대일 때만 붙습니다. 실선 칩 ${detailCount}개는 테마 상세, 점선 칩 ${Math.max(0, items.length - detailCount)}개는 세부 테마 순위로 연결됩니다.`;
  legend.style.cssText = 'grid-column:1/-1;font-size:12px;color:var(--text-muted);padding:2px 0 6px;';
  if (classifiedCount) container.appendChild(legend); // P1591 (T01): no quadrant legend over an empty quadrant area
  const appendUnclassified = () => {
    const pending = items.filter((item) => !groups.has(String(item?.quadrant || 'unknown')) || String(item?.quadrant) === 'Border' || finite(item?.rsRatio) == null || finite(item?.rsMomentum) == null);
    if (!pending.length) return;
    const catalog = documentRef.createElement('section');
    catalog.style.cssText = 'grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;padding:12px 0;';
    catalog.setAttribute('aria-label', '회전 지표 미수신 테마 목록');
    pending.forEach((item) => catalog.appendChild(createChip(documentRef, item, root)));
    container.appendChild(catalog);
  };
  // v57.54 audit (2): with no sector judged, the page shows one status line (the verdict) instead of empty quadrants and
  // hides the dead view tabs. The sector chips stay as a flat row: they are the page's entry to each theme's detail.
  // v57.76: the scatter (rrg-chart-block) is the section's visual and hides with nothing to plot; the chips then sit in
  // the fold, opened once so the entry stays visible (a reader's own close is kept), and closed again once quadrants exist.
  const chartBlock = documentRef.getElementById('rrg-chart-block');
  const fold = documentRef.getElementById('rrg-quadrant-fold');
  const foldSummary = fold?.querySelector?.('summary');
  const viewTabs = documentRef.getElementById('rrg-view-tabs');
  if (!classifiedCount) {
    if (chartBlock) chartBlock.hidden = true;
    if (foldSummary) foldSummary.textContent = '섹터 목록 · 상대강도 판정 전';
    if (fold && !fold.dataset.aioAutoOpened) { fold.open = true; fold.dataset.aioAutoOpened = 'true'; }
    appendUnclassified();
    const anyJudged = viewItems(selectThemesItems(store?.getState?.() || {}), 'all')
      .some((item) => QUADRANTS.some((q) => q.key === String(item?.quadrant || '')) && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null);
    if (viewTabs) viewTabs.hidden = !anyJudged;
    const read = documentRef.getElementById('rrg-rotation-read');
    const close = usCloseSession(root);
    if (read) read.textContent = `섹터 회전은 최신 확정 종가의 상대강도 기록이 들어오면 표시합니다${close ? ` (지금 기록은 ${shortSession(close)} 종가까지)` : ''} — 그 전에는 아래 S&P 500 지도와 세부 테마 순위로 읽습니다.`;
    return;
  }
  if (chartBlock) chartBlock.hidden = false;
  if (foldSummary) foldSummary.textContent = '사분면별 섹터';
  if (fold?.dataset.aioAutoOpened) { fold.open = false; delete fold.dataset.aioAutoOpened; }
  if (viewTabs) viewTabs.hidden = false;

  QUADRANTS.forEach((quadrant) => {
    if (quadrant.optional && !(groups.get(quadrant.key) || []).length) return; // 경계 card only when something sits on the band
    const card = documentRef.createElement('section');
    card.dataset.themeQuadrant = quadrant.key;
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:14px 16px;min-width:0;';
    const heading = documentRef.createElement('div');
    heading.textContent = quadrant.label;
    heading.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);';
    const note = documentRef.createElement('div');
    note.textContent = quadrant.note;
    note.style.cssText = 'font-size:12px;color:var(--text-dim);margin:2px 0 10px;';
    card.append(heading, note);
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
  performance.textContent = pct == null ? '당일 등락 대기' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  performance.style.cssText = `font-size:13px;font-family:var(--font-mono);font-weight:900;color:${pct == null ? 'var(--text-muted)' : pct >= 0 ? 'var(--data-green)' : 'var(--data-red)'};`;

  const header = documentRef.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px;';
  header.append(title, performance);

  const leaders = documentRef.createElement('div');
  leaders.textContent = `대표 종목: ${(detail.leaderHighlight.length ? detail.leaderHighlight : detail.leaders.slice(0, 4)).join(' · ') || '구성 데이터 대기'}`;
  leaders.style.cssText = 'font-size:11px;line-height:1.6;color:var(--text-secondary);';

  const provenance = documentRef.createElement('div');
  const membership = detail.membershipPolicy || {};
  const membershipAsOf = membership.observedAt ? `구성 기준 ${String(membership.observedAt).slice(0, 10)}(분류 검토일, 가격 기준일 아님)` : '구성 기준일 미검증';
  const themeItem = selectThemesItems(store?.getState?.() || {}).find((item) => String(item?.id || '') === String(detail.id));
  const closeOf = usCloseSession(root);
  const quoteState = detail.source === 'quote-missing' || pct == null
    ? '시세 근거 미확보'
    : themeItem?.sourceKind === 'runtime-quote' ? '실시간·지연 시세'
      : `확정 종가 기준${closeOf ? `(${shortSession(closeOf)})` : ''}`;
  provenance.textContent = `${quoteState} · AIO 참고 테마 분류 · ${membershipAsOf}`;
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
  // P1591 (T03): the ETF's rotation state is read only through the session-checked selector, so a stale
  // quadrant never sits under a 'waiting' status; the sentence carries its close date.
  const etfRotation = detail.etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, detail.etf, Date.now()) : null;
  const flow = themeDetailFlow({ themeId: detail.id, groups: model.groups, etf: detail.etf || null, rotation: etfRotation ? { [detail.etf]: etfRotation } : {} });
  if (flow.rows.length) {
    const box = documentRef.createElement('div');
    box.className = 'theme-detail-flow';
    // P1681 (X03): the same stale admission as the theme table — the read is a dated reference, not today's leaders.
    const basis = basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []);
    if (flow.read) { const p = documentRef.createElement('p'); p.className = 'flow-lead'; p.textContent = basis?.stale ? `${basis.label}. ${flow.read}` : flow.read; box.append(p); }
    const max = Math.max(1, ...flow.rows.map((group) => Math.abs(group.ret3m ?? 0)));
    for (const group of flow.rows) {
      const line = documentRef.createElement('div');
      line.className = 'stock-read-bars';
      const name = documentRef.createElement('span');
      name.className = 'stock-read-bar-label';
      name.textContent = group.smallSample ? `${group.name} · 표본 ${group.members}종목 · 참고` : group.name; // D15
      const item = documentRef.createElement('div');
      item.className = 'stock-read-bar-row';
      const bar = documentRef.createElement('div');
      bar.className = `stock-read-bar is-stock ${(group.ret3m ?? 0) >= 0 ? 'is-up' : 'is-down'}`;
      bar.style.width = `${Math.max(2, Math.abs(group.ret3m ?? 0) / max * 100).toFixed(1)}%`;
      const value = documentRef.createElement('span');
      value.className = 'stock-read-bar-value';
      const dir = { improving: '최근 강해짐', steady: '큰 변화 없음', weakening: '최근 식음' }[group.direction] || ''; // 3개월→1개월 순위 변화 (audit 19: not the playbook stage words)
      value.textContent = `3개월 ${group.ret3m == null ? '—' : `${group.ret3m >= 0 ? '+' : ''}${group.ret3m.toFixed(1)}%`} · 1개월 ${group.ret1m == null ? '—' : `${group.ret1m >= 0 ? '+' : ''}${group.ret1m.toFixed(1)}%`}${group.ret5d != null ? ` · 5거래일 ${group.ret5d >= 0 ? '+' : ''}${group.ret5d.toFixed(1)}%` : ''}${group.above50Pct != null ? ` · 50일선 위 ${group.above50Pct}%` : ''}${dir ? ` · ${dir}` : ''}`;
      item.append(bar, value);
      line.append(name, item);
      box.append(line);
    }
    host.append(box);
  }
  // v57.50 (W1 request): the theme detail continues where its reading points — W1's themeDetailFlow().next
  // (screener items carry ctx.sector, consumed by the screener handoff like I01).
  // P1743 (audit 18): the theme's 시나리오 read (renderThemeDetailPlaybook fills this) sits before "이어서 볼 곳"; a stale
  // copy outside the summary (older placement) is dropped so the id stays unique.
  documentRef.getElementById('theme-detail-native-playbook')?.remove();
  const playbookSlot = documentRef.createElement('div');
  playbookSlot.id = 'theme-detail-native-playbook';
  playbookSlot.className = 'theme-detail-native-section tp-detail';
  playbookSlot.hidden = true;
  host.append(playbookSlot);
  if (Array.isArray(flow.next) && flow.next.length) {
    const nav = documentRef.createElement('nav');
    nav.className = 'flow-next';
    nav.id = 'theme-detail-next';
    nav.setAttribute('aria-label', '이어서 볼 곳');
    host.append(nav);
    renderNextSteps(documentRef, nav, flow.next);
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
  const closeSession = detail.quoteBasis?.kind === 'completed-close' ? detail.quoteBasis.session : null;
  breadth.textContent = breadthValue == null
    ? '브레드스: 시세 대기 — 충분한 구성종목 가격이 확인되면 계산됩니다.'
    : `상승 종목 비율(${closeSession ? `${shortSession(closeSession)} 종가 기준` : '전일 대비'}): ${breadthValue}% · ${detail.leaders.length}종목 기준`;
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
  heading.textContent = `대표 종목 상세 · ${detail.leaders.length}종목`;
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
    empty.textContent = '대표 종목 구성 데이터가 없습니다.';
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
    ['거시 조건', insight.macro],
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
      // v57.50 I05: what a research document sent the reader here to check, and the way back.
      renderKnowledgeArrival({ documentRef, root, routeId: route });
      if (route === 'themes') {
        page.dataset.aioArchitectureRenderer = 'native';
        const container = documentRef.getElementById('rrg-quadrant-cards');
        const rrgStatusHost = documentRef.getElementById('rrg-chart-status');
        const rrgCanvasHost = documentRef.getElementById('rrg-canvas');
        const cyclePillHost = documentRef.getElementById('theme-cycle-pill');
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
         if (performanceBarsHost) performanceBarsHost.dataset.aioThemePerformanceBarsRenderer = 'native';
         if (detailPanel) detailPanel.dataset.aioThemeDetailPanelRenderer = 'native';
        // v57.54 (CI flake, 1 in ~12 under 4x CPU): a refresh/store re-render right after the detail panel closes can
        // replace the trigger the close handler just focused, dropping focus to <body>. Re-focus it once after render.
        let restoreDetailFocus = null;
        let closeObserver = null; // one at a time; disconnected on success, after 10s, or on unmount
        bag.add(() => closeObserver?.disconnect?.());
        // v57.61 (perf): the nine detail renderers only fill hosts inside #theme-detail-panel. While the panel is
        // closed the close handler has emptied them, so they are skipped; opening the panel renders them once.
        const renderDetail = () => {
          if (detailPanel && detailPanel.style.display !== 'block') return;
          renderThemeDetailSummary({ documentRef, root, store });
          renderThemeDetailComposition({ documentRef, root, store });
          renderThemeDetailLeaders({ documentRef, root, store });
          renderThemeDetailTemperature({ documentRef, root, store });
          renderThemeDetailSpread({ documentRef, root, store });
          renderThemeDetailBreadthHealth({ documentRef, root, store });
          renderThemeDetailSubthemeGap({ documentRef, root, store });
          renderThemeDetailBenchmark({ documentRef, root, store });
          renderThemeDetailInsights({ documentRef, root, store });
        };
        // v57.61 (perf): event-driven renders coalesce into one per animation frame (one aio:liveQuotes tick used to
        // render here and again after bootstrap's syncThemes store update). Store-slice renders stay synchronous and
        // cancel a pending frame, so the store path remains the single renderer for that tick.
        let pendingFrame = null;
        const cancelScheduledRender = () => {
          if (!pendingFrame) return;
          const view = documentRef.defaultView;
          if (pendingFrame.raf != null) view?.cancelAnimationFrame?.(pendingFrame.raf);
          if (pendingFrame.timer != null) view?.clearTimeout?.(pendingFrame.timer);
          pendingFrame = null;
        };
        const renderNow = () => {
          cancelScheduledRender();
           renderThemes({ documentRef, root, store, route });
          renderRRGStatus({ documentRef, root, store, route });
          renderRRGCanvas({ documentRef, root, store, route });
          renderThemeCyclePill({ documentRef, root, store, route });
           renderThemePerformanceBars({ documentRef, root, store, route });
           renderKrThemeArtifact({ documentRef, root, store });
          renderDetail();
           renderAiInfrastructureLens({ documentRef, root, route });
           renderThemeStrength({ documentRef, root, store }); // P1417
           try { renderThemePlaybook({ documentRef, root, store }); renderThemeDetailPlaybook({ documentRef, root }); } catch (_) { /* the forward read never takes the themes route down */ } // P1743
           try { renderSectorMap({ documentRef, root, store }); } catch (_) { /* the map never takes the themes route down */ } // 2026-10-13 S&P 500 map
           try { renderIndexEarnings({ documentRef, root, store }); } catch (_) { /* the index earnings read never takes the themes route down */ } // 2026-10-19 expertise review
           restoreDetailFocus?.();
         };
        const scheduleRender = () => {
          if (pendingFrame) return;
          const view = documentRef.defaultView;
          const run = () => { if (pendingFrame) renderNow(); };
          pendingFrame = {};
          // A hidden tab never runs rAF; the timer bounds the wait so a background refresh still lands.
          if (typeof view?.requestAnimationFrame === 'function') pendingFrame.raf = view.requestAnimationFrame(run);
          pendingFrame.timer = typeof view?.setTimeout === 'function' ? view.setTimeout(run, 250) : null;
          if (pendingFrame.raf == null && pendingFrame.timer == null) { pendingFrame = null; renderNow(); }
        };
        bag.add(() => cancelScheduledRender());
        renderNow();
        // v57.76: the scatter redraws when its frame changes width (rotation, sidebar, window resize). Height changes
        // from the redraw itself are ignored, so the observer cannot loop.
        const rrgFrame = documentRef.getElementById('rrg-canvas-frame');
        const FrameObserver = documentRef.defaultView?.ResizeObserver;
        if (rrgFrame && typeof FrameObserver === 'function') {
          let lastFrameWidth = rrgFrame.clientWidth;
          const frameObserver = new FrameObserver(() => {
            const frameWidth = rrgFrame.clientWidth;
            if (!frameWidth || frameWidth === lastFrameWidth) return;
            lastFrameWidth = frameWidth;
            renderRRGCanvas({ documentRef, root, store, route });
          });
          frameObserver.observe(rrgFrame);
          bag.add(() => frameObserver.disconnect());
        }
        // v57.50 I22: a link that asked for a section (국내 테마 from the KR screener) opens and shows it once.
        const handoff = consumeResearchHandoff({ root, routeId: 'themes' });
        const anchorId = handoff?.context?.anchor ? String(handoff.context.anchor) : '';
        if (/^[a-z0-9-]+$/i.test(anchorId)) {
          const section = documentRef.getElementById(anchorId);
          const fold = section?.closest?.('details');
          if (fold) fold.open = true;
          section?.scrollIntoView?.({ block: 'start' });
        }
        const unsubscribe = store && subscribeToSlices(store, ['themes', 'screener'], renderNow);
        if (unsubscribe) bag.add(unsubscribe);
        const eventTarget = documentRef || root;
        ['aio:themesViewChanged', 'aio:themesHistoryLoaded', 'aio:historyLoaded', 'aio:refresh:done', 'aio:liveQuotes', 'aio:sectorPerfChanged', 'aio:colorThemeChanged'].forEach((eventName) => {
          eventTarget?.addEventListener?.(eventName, scheduleRender);
          bag.add(() => eventTarget?.removeEventListener?.(eventName, scheduleRender));
        });
        // P1417: history.json announces itself on window (js/aio-data.js), not on document.
        const windowTarget = root && root !== eventTarget ? root : null;
        if (windowTarget?.addEventListener) {
          windowTarget.addEventListener('aio:historyLoaded', scheduleRender);
          bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', scheduleRender));
        }
        const onThemeDetailShown = (event) => {
          // P800: the native detail surfaces consume the normalized store selection;
          // the legacy event payload remains a compatibility notification only.
          if (deepLinkHint) deepLinkHint.hidden = true;
          if (detailPanel) {
            detailPanel.style.display = 'block';
            if (event?.detail?.themeId) detailPanel.dataset.currentTheme = String(event.detail.themeId);
          }
          renderDetail(); // v57.61: detail renderers skip while closed, so the opening render happens here
          try { renderThemeDetailPlaybook({ documentRef, root }); } catch (_) {} // P1743: needs the theme id set above
          // The architecture listener synchronously refreshes the store before this
          // compatibility event reaches the mounted page. The store subscription is
          // the sole detail renderer; this listener owns visibility only.
        };
        // v57.76: a quadrant chip can sit in the 사분면별 섹터 fold, which closes itself once quadrants render; returning
        // focus opens the fold first, since a node inside a closed <details> cannot take focus.
        const revealTrigger = (node) => { const fold = node?.closest?.('details'); if (fold && !fold.open) fold.open = true; };
        const onThemeDetailClosed = () => {
          const trigger = currentDetailTrigger();
          revealTrigger(trigger);
          trigger?.setAttribute?.('aria-expanded', 'false');
          trigger?.focus?.({ preventScroll: true });
          const closedAt = Date.now();
          // v57.59: CI still lost focus when the replacing render came from a host outside renderNow (or after 3s under
          // CPU throttling), so a short-lived observer on the page also retries, for up to 10s.
          closeObserver?.disconnect?.();
          let observer = null;
          const stop = () => { restoreDetailFocus = null; observer?.disconnect?.(); observer = null; closeObserver = null; };
          restoreDetailFocus = () => {
            if (Date.now() - closedAt > 10000) { stop(); return; }
            const active = documentRef.activeElement;
            if (active && active !== documentRef.body) return;
            const next = currentDetailTrigger();
            if (!next) return;
            revealTrigger(next);
            next.setAttribute?.('aria-expanded', 'false');
            next.focus?.({ preventScroll: true });
            // v57.64: a replacement still hidden mid-render refuses focus; keep watching until focus actually lands.
            if (documentRef.activeElement === next) stop();
          };
          const Observer = documentRef.defaultView?.MutationObserver;
          if (Observer && page) { observer = closeObserver = new Observer(() => restoreDetailFocus?.()); observer.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'open', 'class'] }); }
          documentRef.defaultView?.setTimeout?.(() => { if (closeObserver === observer) stop(); }, 10500);
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
        // P1599 (T04): the detail opens right under the section the reader clicked (sector cards, sub-theme
        // ranking, CAPEX flow) instead of at the page bottom, and offers a way back to that row.
        let detailTrigger = null;
        let detailTriggerKey = null;
        let detailTriggerId = '';
        let deepLinkHint = null;
        const currentDetailTrigger = () => detailTrigger && documentRef.contains(detailTrigger) ? detailTrigger
          : [...(page?.querySelectorAll?.('[data-action="showThemeDetail"], [data-theme-id], .capex-flow-theme') || [])]
            .find((node) => !detailPanel?.contains?.(node) && JSON.stringify([node.dataset.action, node.dataset.arg, node.dataset.themeId, node.getAttribute('aria-label')]) === detailTriggerKey)
          // A re-render may refresh the label (numbers in it); the theme id alone still names the same trigger.
          || (detailTriggerId ? [...(page?.querySelectorAll?.('[data-action="showThemeDetail"], [data-theme-id]') || [])]
            .find((node) => !detailPanel?.contains?.(node) && (node.dataset.arg || node.dataset.themeId) === detailTriggerId) : null);
        const onThemeTriggerClick = (event) => {
          const trigger = event?.target?.closest?.('[data-action="showThemeDetail"], [data-theme-id], .capex-flow-theme');
          if (!trigger || !page?.contains?.(trigger) || detailPanel?.contains?.(trigger)) return;
          detailTrigger = trigger;
          detailTriggerKey = JSON.stringify([trigger.dataset.action, trigger.dataset.arg, trigger.dataset.themeId, trigger.getAttribute('aria-label')]);
          detailTriggerId = trigger.dataset.arg || trigger.dataset.themeId || '';
          trigger.setAttribute('aria-controls', 'theme-detail-panel');
          trigger.setAttribute('aria-expanded', 'true');
          // Only page-level blocks are anchors: a block inside a re-rendered host would take the panel with it.
          let anchor = trigger;
          while (anchor && anchor.parentElement !== page) anchor = anchor.parentElement;
          if (anchor && detailPanel && anchor !== detailPanel && detailPanel.parentElement === page) anchor.insertAdjacentElement('afterend', detailPanel);
        };
        documentRef?.addEventListener?.('click', onThemeTriggerClick, true);
        bag.add(() => documentRef?.removeEventListener?.('click', onThemeTriggerClick, true));
        const ensureReturnButton = () => {
          if (!detailPanel || detailPanel.querySelector('.theme-detail-return')) return;
          const back = documentRef.createElement('button');
          back.type = 'button';
          back.className = 'flow-next-link theme-detail-return';
          back.style.cssText = 'font-size:12px;margin-bottom:8px;';
          back.textContent = '← 선택한 목록으로';
          back.addEventListener('click', () => {
            const target = currentDetailTrigger() || page;
            // v57.76: a quadrant chip sits in the 사분면별 섹터 fold; the way back reopens it so the row is visible.
            const fold = target?.closest?.('details');
            if (fold && !fold.open) fold.open = true;
            target?.scrollIntoView?.({ block: 'center' });
            target?.focus?.({ preventScroll: true });
          });
          detailPanel.prepend(back);
        };
        const onDetailShownPlacement = () => {
          ensureReturnButton();
          const trigger = currentDetailTrigger(); trigger?.setAttribute?.('aria-controls', 'theme-detail-panel'); trigger?.setAttribute?.('aria-expanded', 'true');
          detailPanel?.scrollIntoView?.({ block: 'start' });
        };
        eventTarget?.addEventListener?.('aio:themeDetailShown', onDetailShownPlacement);
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailShown', onDetailShownPlacement));
        eventTarget?.addEventListener?.('aio:themeDetailShown', onThemeDetailShown);
        eventTarget?.addEventListener?.('aio:themeDetailClosed', onThemeDetailClosed);
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailShown', onThemeDetailShown));
        bag.add(() => eventTarget?.removeEventListener?.('aio:themeDetailClosed', onThemeDetailClosed));
        const pendingThemeId = String(root?._aioOpenThemeDetailOnThemes || '').trim();
        if (pendingThemeId) {
          delete root._aioOpenThemeDetailOnThemes;
          queueMicrotask(() => requestThemeDetail(pendingThemeId));
        }
        const deepLink = themeDetailDeepLink(root?.location?.hash);
        const deepLinkId = String(deepLink?.themeId || '').trim();
        if (deepLinkId) queueMicrotask(() => requestThemeDetail(deepLinkId));
        if (deepLink?.requested && !store?.getState?.()?.themes?.selectedDetail && detailPanel) {
          deepLinkHint = documentRef.createElement('p');
          deepLinkHint.className = 'theme-detail-deep-link-hint';
          deepLinkHint.style.cssText = 'font-size:12px;color:var(--text-muted);margin:0;';
          deepLinkHint.textContent = deepLinkId
            ? '주소의 테마 상세를 열지 못하면 위 섹터 카드나 세부 테마 순위에서 같은 테마를 골라 주세요.'
            : '테마 상세 — 주소에 테마가 지정되지 않았습니다. 위 섹터 카드나 세부 테마 순위에서 테마를 고르면 여기에 상세가 열립니다.';
          detailPanel.appendChild(deepLinkHint);
          detailPanel.style.display = 'block';
          bag.add(() => deepLinkHint?.remove?.());
        }
        bag.add(() => {
          if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
          if (container?.dataset.aioThemesRenderer === 'native') delete container.dataset.aioThemesRenderer;
          if (rrgStatusHost?.dataset.aioRrgStatusRenderer === 'native') delete rrgStatusHost.dataset.aioRrgStatusRenderer;
          if (rrgCanvasHost?.dataset.aioRrgChartRenderer === 'native') delete rrgCanvasHost.dataset.aioRrgChartRenderer;
          if (cyclePillHost?.dataset.aioThemeCycleRenderer === 'native') delete cyclePillHost.dataset.aioThemeCycleRenderer;
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
