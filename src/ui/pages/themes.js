import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { chartPalette } from '../components/color-theme.js';
import { selectSelectedThemeDetail, selectThemesItems } from '../../state/selectors/themes.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { renderThemeStrength } from '../components/theme-strength.js';
import { renderThemePlaybook, renderThemeDetailPlaybook, themeTeachFor, scenarioSplitText, EARNINGS_CALENDAR } from '../components/theme-playbook-view.js'; // P1743; v58.75 view split out of the boot set
import { themePlaybookForRoot } from '../components/theme-playbook.js';
import { MEMBER_ROLES, macroMoves, revisionCounts, themeReasons } from '../../domain/scenarios/theme-criteria.js';
import { THEME_STATES } from '../../domain/scenarios/analogs.js';
import { headlineForCompany, sessionNewsWindow } from '../../domain/briefing/news-picks.js';
import { selectNewsItems } from '../../state/selectors/news.js';
import { renderSectorMap } from '../components/sector-map.js';
import { renderIndexEarnings } from '../components/index-earnings.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { rotationFlow, themeDetailFlow } from '../../domain/market/page-flow.js';
import { krThemeArtifactRead, krThemeLabel } from '../../domain/themes/kr-themes.js';
import { buildGroupStrength, directionLabel } from '../../domain/themes/group-strength.js';
import { buildCloseSeries } from '../../domain/market/close-series.js';
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { rrgAxisDomain, RRG_DEFINITION, RRG_QUADRANT_READS, RRG_QUADRANT_WORDS } from '../../domain/themes/rrg.js';
import { rrgRecentReading, RRG_NEUTRAL_BAND } from '../../domain/themes/recent-check.js';
import { benchmarkReturns, basisOf } from '../components/theme-strength.js';
import { readMarketRegime } from '../components/market-regime.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { renderNextSteps } from '../components/page-flow.js';
import { signedText, directionOf, finiteNumber as finite } from '../../domain/shared/number.js';
// v58.80: a change that rounds to zero is drawn in the text colour, not rising red or falling blue.
const dirColor = (value, digits = 1) => { const dir = directionOf(value, digits); return value == null ? 'var(--text-muted)' : dir === 'up' ? 'var(--dir-up)' : dir === 'down' ? 'var(--dir-down)' : 'var(--text-primary)'; };
import { withTopicParticle } from '../../domain/content/korean-particle.js';
import { refreshSharedArtifact, screenerRowsState } from '../../data/shared-artifacts.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { DATA_STATE_CHIPS } from '../../domain/content/data-state.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { asOfChip, setAsOf } from '../components/section-frame.js';
import { isoDay, stampDay, latestSessionRows } from '../../domain/shared/session-date.js';

const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
// Published screener rows by symbol (the store's rows; ETFs included), for the period bars and the member tables.
function screenerRowMap(store) {
  const rows = store?.getState?.()?.screener?.rows || [];
  return new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
}

// v57.76: plain-Korean quadrant notes (no 모멘텀 jargon). 100 is the sector's own 100-session average relative price.
// v57.81 (audit): the notes name both windows and no longer say "계속 강해지는 중 / 나아지는 중" — the vertical axis
// compares with about 50 sessions ago, so a sector can sit in 선도 while its last week fell hard (the chip then says so).
// A point within the neutral band around 100 on either axis is 경계 and stays out of the four verdicts.
const QUADRANTS = Object.freeze([
  ...['Leading', 'Improving', 'Weakening', 'Lagging'].map((key) => ({ key, label: RRG_QUADRANT_WORDS[key], note: RRG_QUADRANT_READS[key] })),
  // v57.84 (owner decision 3-3): the band is each sector's own typical 5-session move on that axis, with hysteresis.
  { key: 'Border', label: '기준선 부근', note: `두 축 중 하나가 100에 그 섹터의 평소 5거래일 움직임만큼 가까워 사분면을 정하지 않음(움직임 기록이 없으면 ±${RRG_NEUTRAL_BAND}). 한 번 정한 사분면은 반대쪽으로 그 폭의 절반을 넘어야 바뀜. 속이 빈 점은 놓인 구역과 판정이 다른 섹터로, 이름 옆에 판정을 적음`, optional: true }
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
  return isoDay(basis) || '';
}

function krCloseSession(rows = []) {
  const dates = (rows || [])
    .filter((row) => /^\d{6}\.(KS|KQ)$/i.test(String(row?.sym || row?.symbol || '')))
    .map((row) => stampDay(row?.observedAt))
    .filter(Boolean)
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
      ? '섹터 회전 판정 보류, 상대강도 기록이 부족합니다'
      : '섹터 상대강도 기록 수신 대기';
    status.style.color = 'var(--text-muted)';
    return;
  }
  // Expert review M08: no grade or risk colour from the quadrant counts. The benchmark (SPY) is cap-weighted, so a
  // few mega-caps lifting the index put most sectors below 100 without any sector "weakening" on its own.
  // v57.76: that caveat lives once, in the 사분면별 섹터 fold (rrg-method-note); the line above the chart keeps the
  // counts and the close it was measured on.
  const close = usCloseSession(root);
  // v58.79 (layout over captions): the line keeps the quadrant counts; the window and the close are the card head's
  // chip, and the tail's meaning is the line's hover (the tail control names itself).
  status.textContent = `선도 ${counts.Leading}, 개선 ${counts.Improving}, 약화 ${counts.Weakening}, 후행 ${counts.Lagging}${counts.Border ? `, 기준선 부근 ${counts.Border}` : ''}`;
  status.title = `${rrgTrailLength(root) ? `꼬리 = 최근 ${rrgTrailLength(root)}거래일 경로(작은 점이 시작), 화살표 = 오늘 위치. ` : ''}속이 빈 점 = 놓인 구역과 판정이 다른 섹터(이름 옆에 판정)`;
  setAsOf(documentRef, documentRef.querySelector?.('#page-themes .v2-themes-rrg > .aio-frame-head'), close ? `${shortSession(close)} 종가` : '완료 종가', `약 50일 상대강도, ${close ? `${shortSession(close)} 미국 종가 기준` : '완료 종가 기준'}`);
  status.style.color = 'var(--text-dim)';
}

const RRG_TRAILS = Object.freeze([['short', '짧게', 5], ['long', '길게', 10], ['off', '끔', 0]]);
// v58.78 (owner 2026-10-25, "RRG 차트 난리"): daily tails crossed each other in the leading cluster and widened the axes, so
// the chart opens on today's positions only; a tail is the reader's choice.
const RRG_TRAIL_DEFAULT = 'off';
const rrgTrailOf = (root) => RRG_TRAILS.find(([key]) => key === (root?._aioRrgTrail || RRG_TRAIL_DEFAULT)) || RRG_TRAILS[2];
function rrgTrailLength(root) {
  return rrgTrailOf(root)[2];
}
// The tail-length control sits above the chart (built once; its pressed state follows the reader's choice).
function ensureRrgTrailTabs(documentRef, root, store, route) {
  const frame = documentRef?.getElementById('rrg-canvas-frame');
  if (!frame) return;
  let group = documentRef.getElementById('rrg-trail-tabs');
  if (!group) {
    group = documentRef.createElement('div');
    group.id = 'rrg-trail-tabs';
    group.className = 'rrg-trail-tabs';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '꼬리 길이');
    const label = documentRef.createElement('span');
    label.className = 'rrg-trail-label';
    label.textContent = '꼬리(지난 경로)';
    group.append(label);
    for (const [key, text, n] of RRG_TRAILS) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'news-sort-btn';
      button.dataset.trail = key;
      button.textContent = text;
      button.title = n ? `최근 ${n}거래일 경로를 선으로, 오늘 위치를 화살표로` : '꼬리 없이 오늘 위치만';
      button.addEventListener('click', () => { root._aioRrgTrail = key; renderRRGCanvas({ documentRef, root, store, route }); renderRRGStatus({ documentRef, root, store, route }); });
      group.append(button);
    }
    frame.insertAdjacentElement('beforebegin', group);
  }
  const current = rrgTrailOf(root)[0];
  group.querySelectorAll('button[data-trail]').forEach((button) => {
    const on = button.dataset.trail === current;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
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
  const height = Math.max(260, Math.min(520, Math.round(width * (compact ? 0.9 : 0.72))));
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
  // v58.53 개편 v2 (3f): 선도 green, 후행 amber, 개선·약화 ink — red stays for falling prices only, never a quadrant.
  const colors = { Leading: token('--data-green', '#2f7c57'), Improving: token('--text-secondary', '#544f46'), Weakening: token('--text-secondary', '#544f46'), Lagging: token('--data-amber', '#714f19') };
  const muted = token('--text-muted', '#978365');
  // v58.75 (persona review): StockCharts-style tails — each sector's last sessions from the produced 20-session trail
  // (each point on its own trailing window), drawn dashed toward an arrow at today's dot. 짧게 5, 길게 10, 끔.
  const trailLength = rrgTrailLength(root);
  ensureRrgTrailTabs(documentRef, root, store, route);
  const trails = new Map();
  if (trailLength) {
    for (const item of validItems) {
      const symbol = String(item?.symbol || item?.id || '');
      const produced = symbol ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, symbol, Date.now()) : null;
      const points = (produced?.trail || []).filter((point) => point?.sessionDate && point.sessionDate < produced.sessionDate
        && finite(point.rsRatio) != null && finite(point.rsMomentum) != null).slice(-trailLength);
      if (points.length) trails.set(item, points);
    }
  }
  // M09: axes span the plotted points (and the 100 baseline) instead of clipping at ±3.5; the tails are inside the frame too.
  const domain = rrgAxisDomain([...validItems, ...[...trails.values()].flat()]);
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
  context.font = '12px "Pretendard Variable", Pretendard, sans-serif'; // v57.91 (visual audit): desktop ticks match the page's smallest text
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
  context.font = '12px "Pretendard Variable", Pretendard, sans-serif';
  context.textAlign = 'center';
  // v57.50 D13: 100 is the sector's own 100-session average relative price, not "the same as SPY".
  // v57.76: plain-Korean axis titles; the precise definitions sit once in the 사분면별 섹터 fold.
  context.fillText(compact ? '상대강도(시장 대비) →' : '상대강도(시장 대비, 100 = 50일 평균) →', (plot.left + plot.right) / 2, height - 6);
  context.save();
  context.translate(11, (plot.top + plot.bottom) / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(compact ? '상대강도 변화 속도 ↑' : '상대강도 변화 속도(10거래일 전 대비) ↑', 0, 0);
  context.restore();
  const note = documentRef.getElementById('rrg-method-note');
  if (note) note.textContent = `이 그림은 흔히 RRG(상대 회전 그래프)라 부르는 방식입니다. ${RRG_DEFINITION.ratio}. ${RRG_DEFINITION.momentum}. ${RRG_DEFINITION.benchmarkBias}`;
  context.font = 'bold 12px "Pretendard Variable", Pretendard, sans-serif';
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
  // Tails first, so every dot and label sits on top of them.
  trails.forEach((points, item) => {
    const color = colors[zoneKey(root, item)] || muted;
    const path = [...points.map((point) => [px(point.rsRatio), py(point.rsMomentum)]), [px(item.rsRatio), py(item.rsMomentum)]];
    context.save();
    context.globalAlpha = 0.35;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1.25;
    context.lineJoin = 'round';
    context.beginPath();
    path.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
    context.beginPath(); context.arc(path[0][0], path[0][1], 2, 0, Math.PI * 2); context.fill(); // where the tail starts
    // The arrow head sits just past today's dot, pointing the way the last session moved.
    const [x0, y0] = path[path.length - 2], [x1, y1] = path[path.length - 1];
    const angle = Math.atan2(y1 - y0, x1 - x0), r = compact ? 5 : 6;
    if (Math.hypot(x1 - x0, y1 - y0) > 1) {
      context.globalAlpha = 0.9;
      context.beginPath();
      context.moveTo(x1 + Math.cos(angle) * (r + 7), y1 + Math.sin(angle) * (r + 7));
      context.lineTo(x1 + Math.cos(angle + 2.5) * (r + 1), y1 + Math.sin(angle + 2.5) * (r + 1));
      context.lineTo(x1 + Math.cos(angle - 2.5) * (r + 1), y1 + Math.sin(angle - 2.5) * (r + 1));
      context.closePath();
      context.fill();
    }
    context.restore();
  });
  // v58.78 (owner 2026-10-25): dots first, then one-line labels ("XLF 금융") placed by trying eight spots around each dot,
  // then the same spots farther out with a leader line, against every label and dot already on the canvas — the
  // two-line ticker/name stack overlapped in the crowded leading cluster.
  const radius = compact ? 5 : 6;
  // v58.80 (first-users bundle 2): XLRE and XLF sat inside the 선도 area while the text called them 개선 and 기준선 부근 —
  // the text uses the settled zone (band + hysteresis), the dot its raw position. A dot whose settled zone differs from
  // where it sits is drawn as a ring and its label names the settled word.
  const rawQuadrant = (item) => (item.rsRatio >= 100 ? (item.rsMomentum >= 100 ? 'Leading' : 'Weakening') : (item.rsMomentum >= 100 ? 'Improving' : 'Lagging'));
  const dots = validItems.map((item) => { const zone = zoneKey(root, item); return { item, zone, held: zone !== rawQuadrant(item), x: px(item.rsRatio), y: py(item.rsMomentum), color: colors[zone] || muted }; });
  for (const dot of dots) {
    context.beginPath();
    context.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    if (dot.held) {
      context.lineWidth = 2;
      context.strokeStyle = dot.color;
      context.stroke();
      context.lineWidth = 1;
      continue;
    }
    context.fillStyle = dot.color;
    context.fill();
    context.strokeStyle = palette.grid;
    context.stroke();
  }
  const boxes = dots.map((dot) => ({ x0: dot.x - radius - 1, y0: dot.y - radius - 1, x1: dot.x + radius + 1, y1: dot.y + radius + 1 }));
  const overlaps = (box) => boxes.some((other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0)
    || box.x0 < plot.left + 1 || box.x1 > plot.right - 1 || box.y0 < plot.top + 1 || box.y1 > plot.bottom - 1;
  const showNames = !compact && activeView(root) !== 'all';
  // Crowded dots (most neighbours within 40px) choose first, while the most room is left.
  const crowd = (dot) => dots.filter((other) => other !== dot && Math.hypot(other.x - dot.x, other.y - dot.y) < 40).length;
  for (const dot of [...dots].sort((a, b) => crowd(b) - crowd(a))) {
    // A phone shows the Korean sector name instead of the ticker (run-3: "XLRE, XBI 같은 영어 약자만"), except in 전체.
    const ticker = String(dot.item.symbol || dot.item.id || '');
    const symbol = compact && activeView(root) !== 'all' && dot.item.label ? String(dot.item.label) : ticker;
    const word = dot.held ? (dot.zone === 'Border' ? '경계' : RRG_QUADRANT_WORDS[dot.zone] || '') : '';
    const name = [showNames ? String(dot.item.label || '') : '', word].filter(Boolean).join(' ');
    context.font = 'bold 12px "Pretendard Variable", Pretendard, system-ui';
    const symbolWidth = context.measureText?.(symbol)?.width || symbol.length * 7;
    context.font = '12px "Pretendard Variable", Pretendard, system-ui';
    const nameWidth = name ? (context.measureText?.(name)?.width || name.length * 11) + 4 : 0;
    const w = symbolWidth + nameWidth;
    const h = 14;
    const spot = (gap) => [
      [dot.x + radius + gap, dot.y - h / 2], [dot.x - radius - gap - w, dot.y - h / 2],
      [dot.x - w / 2, dot.y - radius - gap - h], [dot.x - w / 2, dot.y + radius + gap],
      [dot.x + radius + gap - 2, dot.y - radius - gap - h + 2], [dot.x + radius + gap - 2, dot.y + radius + gap - 2],
      [dot.x - radius - gap - w + 2, dot.y - radius - gap - h + 2], [dot.x - radius - gap - w + 2, dot.y + radius + gap - 2]
    ];
    let chosen = null;
    let leader = false;
    for (const [gap, far] of [[3, false], [16, true], [30, true]]) {
      chosen = spot(gap).map(([x0, y0]) => ({ x0, y0, x1: x0 + w, y1: y0 + h })).find((box) => !overlaps(box)) || null;
      if (chosen) { leader = far; break; }
    }
    if (!chosen) { const [x0, y0] = spot(3)[0]; chosen = { x0, y0, x1: x0 + w, y1: y0 + h }; }
    boxes.push(chosen);
    if (leader) {
      context.save();
      context.globalAlpha = 0.5;
      context.strokeStyle = dot.color;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(dot.x, dot.y);
      context.lineTo(Math.min(Math.max(dot.x, chosen.x0), chosen.x1), Math.min(Math.max(dot.y, chosen.y0), chosen.y1));
      context.stroke();
      context.restore();
    }
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = 'bold 12px "Pretendard Variable", Pretendard, system-ui';
    context.fillStyle = dot.color;
    context.fillText(symbol, chosen.x0, chosen.y0 + h / 2);
    if (name) {
      context.font = '12px "Pretendard Variable", Pretendard, system-ui';
      context.fillStyle = muted;
      context.fillText(name, chosen.x0 + symbolWidth + 4, chosen.y0 + h / 2);
    }
    context.textBaseline = 'alphabetic';
  }
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
    pill.textContent = `섹터 회전 대기, ${viewLabel} ${items.length}개 중 ${total}개 판정`; // P1591 (T01)
    return;
  }
  // Expert review M08: the split is a count, not a risk-on/off grade — one neutral pill colour.
  pill.className = 'status-pill sp-neutral';
  // P1352: quadrant counts describe relative strength, not sector identity or the business cycle.
  pill.textContent = `${viewLabel} 상대강도, 선도·개선 ${counts.Leading + counts.Improving}/${total}, 약화·후행 ${counts.Weakening + counts.Lagging}/${total}${counts.Border ? `, 기준선 부근 ${counts.Border}/${total}` : ''}`;
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
  // v58.80 (first-users bundle 3): before the rows arrive "28개 중 0개" read as a final count.
  const load = (store?.getState?.()?.screener?.rows || []).length ? 'ready' : screenerRowsState(root);
  if (summary) summary.textContent = load === 'ready' ? `한국 테마 (${read.totalThemes}개 중 ${read.coveredThemes}개를 ${krClose ? `${shortSession(krClose)} ` : ''}확정 종가로 비교)` : `한국 테마 (${DATA_STATE_CHIPS[load]})`;
  host.dataset.aioKrThemeArtifactRenderer = 'native';
  host.hidden = false;
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  // v58.79 section frame: the title carries the close as its chip; the shown-rows rule and the click hint are its hover.
  const heading = el('h2', '한국 테마 흐름 ', 'briefing-h2');
  if (krClose) heading.append(asOfChip(documentRef, `${shortSession(krClose)} 종가`, `${shortSession(krClose)} 확정 종가 기준${read.usable.length > 12 ? `, 상위 6개와 하위 6개(전체 ${read.usable.length}개 중)` : ''}, 테마 이름을 누르면 구성 종목의 확정 종가 표가 열림`));
  host.replaceChildren(heading, el('p', read.read, 'flow-lead'));
  const max = Math.max(1, ...read.usable.map((theme) => Math.abs(theme.ret1m)));
  // P1591 (T09/T10): the strongest and the weakest six both show (the reading names the weak ones), and bars
  // grow from a zero line so a loss never looks like a long gain.
  const shown = read.usable.length > 12 ? [...read.usable.slice(0, 6), ...read.usable.slice(-6)] : read.usable;
  for (const theme of shown) {
    const line = el('div', null, 'stock-read-bars');
    const item = el('div', null, 'stock-read-bar-row');
    const track = el('div', null, 'stock-read-track');
    track.style.position = 'relative';
    const bar = el('div', null, `stock-read-bar is-stock ${theme.ret1m >= 0 ? 'is-up' : 'is-down'}`);
    const half = `${(Math.abs(theme.ret1m) / max * 50).toFixed(1)}%`;
    bar.classList.add('thp-strength-bar');
    bar.style.width = `max(2px, ${half})`;
    bar.style.left = theme.ret1m >= 0 ? '50%' : `calc(50% - ${half})`;
    const zero = el('span', null, 'thp-strength-zero');
    track.append(zero, bar);
    item.append(track, el('span', `1개월 ${signedText(theme.ret1m, 1)}%, 3개월 ${theme.ret3m == null ? '—' : `${signedText(theme.ret3m, 1)}%`}${theme.above50Pct != null ? `, 50일선 위 ${theme.above50Pct}%` : ''}, ${theme.covered}/${theme.members}종목`, 'stock-read-bar-value'));
    // Screen audit 2026-10-20: the Korean theme rows were not clickable, so a Korean theme's detail had no entry here.
    const label = typeof root?.openKrThemeDetail === 'function' ? el('button', theme.label, 'stock-read-bar-label theme-strength-open') : el('span', theme.label, 'stock-read-bar-label');
    if (label.tagName === 'BUTTON') {
      label.type = 'button';
      label.setAttribute('aria-label', `${theme.label} 테마 상세 열기`);
      label.addEventListener('click', () => root.openKrThemeDetail(theme.id));
    }
    line.append(label, item);
    host.append(line);
  }
  syncKrLiveBlocks(documentRef, root); // v58.75
}

const SECTOR_PERIODS = Object.freeze([['1d', '1일', 'ret1d'], ['1w', '1주', 'ret5d'], ['1m', '1개월', 'ret1m'], ['3m', '3개월', 'ret3m'], ['6m', '6개월', 'ret6m'], ['12m', '12개월', 'ret12m']]);
// The period tabs replace the static 1일·1주 pair (index.html #sector-perf-tabs) with native buttons.
function ensureSectorPeriodTabs(documentRef, root, store, route, mode) {
  const group = documentRef?.getElementById('sector-perf-tabs');
  if (!group) return;
  if (group.dataset.aioSectorPeriods !== 'native') {
    group.dataset.aioSectorPeriods = 'native';
    group.replaceChildren(...SECTOR_PERIODS.map(([key, label]) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'news-sort-btn';
      button.dataset.period = key;
      button.textContent = label;
      button.addEventListener('click', () => { root._aioSectorPeriod = key; renderThemePerformanceBars({ documentRef, root, store, route }); });
      return button;
    }));
  }
  group.querySelectorAll('button[data-period]').forEach((button) => {
    const on = button.dataset.period === mode;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

// v58.75 (persona review): outside Korean hours the live-quote KRX blocks read "시세 미수신", "수집 대기…" and "유효 테마
// 0/28". They hide while no Korean live quote covers any theme (the close-based read above is the view then); the fold
// itself stays only while a theme detail is open in it.
function krLiveThemeCount(root) {
  try { return root?.AIO?.evaluateKrThemeQuoteCoverage?.(root._liveData || {}, root.KR_THEME_MAP || {})?.validThemeCount || 0; } catch (_) { return 0; }
}
// The legacy KR detail panel is located through the native close-detail host inside it (AG-DOM-WRITER: the panel id
// belongs to js/aio-kr-data.js; this page only reads its display state).
const krDetailPanelOf = (documentRef) => documentRef?.getElementById('kr-theme-close-detail')?.closest?.('#kr-theme-detail-panel') || null;
function syncKrLiveBlocks(documentRef, root) {
  const fold = documentRef?.getElementById('kr-themes-live');
  if (!fold) return;
  const live = krLiveThemeCount(root) > 0;
  const body = documentRef.getElementById('kr-themes-live-body');
  if (body) body.hidden = !live;
  const panel = krDetailPanelOf(documentRef);
  const panelOpen = !!panel && panel.style.display !== 'none' && panel.style.display !== '';
  fold.hidden = !live && !panelOpen;
  const summary = fold.querySelector(':scope > summary');
  if (summary) summary.textContent = live ? '장중 실시간 테마 등락 보기, 국내 시세가 들어올 때만 계산' : '한국 테마 상세';
  const liveFold = documentRef.getElementById('kr-theme-live-detail-fold');
  if (liveFold && liveFold.dataset.aioLive !== String(live)) {
    liveFold.dataset.aioLive = String(live);
    liveFold.open = live;
    const label = liveFold.querySelector(':scope > summary');
    if (label) label.textContent = live ? '장중 시세 기준 상세' : '장중 시세 기준 상세 — 지금은 국내 장중 시세가 없어 위 확정 종가 표로 봅니다';
  }
}
// The Korean theme detail's completed-close member table (published screener rows), above the live-quote detail.
function renderKrCloseDetail({ documentRef, root, store, themeId }) {
  const host = documentRef?.getElementById('kr-theme-close-detail');
  const members = root?.KR_THEME_MAP?.[themeId];
  if (!host) return;
  if (!Array.isArray(members) || !members.length) { host.hidden = true; host.replaceChildren(); return; }
  const screenerRows = screenerRowMap(store);
  const list = members.map((member) => {
    const code = String(member?.code || '');
    const row = screenerRows.get(`${code}.KS`) || screenerRows.get(`${code}.KQ`) || null;
    return { sym: row ? String(row.sym).toUpperCase() : `${code}.KS`, label: root?.KR_STOCK_DB?.[code]?.name || row?.name || code, row };
  });
  const heading = documentRef.createElement('div');
  heading.className = 'thp-detail-heading';
  const covered = list.filter((member) => member.row).length;
  const krClose = krCloseSession(store?.getState?.()?.screener?.rows || []);
  heading.textContent = `${KR_THEME_LABEL_OF(themeId)}, 구성 종목 ${list.length}개 중 확정 종가 기록 ${covered}개`;
  host.replaceChildren(heading);
  if (covered) {
    const teach = themeTeachFor({ root, store, market: 'KR', themeId });
    const table = memberTable(documentRef, root, list, { onSort: () => renderKrCloseDetail({ documentRef, root, store, themeId }), ariaLabel: `한국 ${KR_THEME_LABEL_OF(themeId)} 구성 종목 표`, basisDate: krClose ? `${shortSession(krClose)} 한국 종가 기준` : null, roles: teach?.roles || null });
    const roleParts = memberRoleParts(documentRef, teach);
    host.append(...(roleParts ? [roleParts.line] : []), table.lead, table.region, table.basis, ...(roleParts ? [roleParts.fold] : []));
  } else {
    const empty = documentRef.createElement('p');
    empty.className = 'thp-detail-empty';
    empty.textContent = '구성 종목의 확정 종가 기록이 아직 없습니다.';
    host.append(empty);
  }
  host.hidden = false;
}
const KR_THEME_LABEL_OF = (themeId) => krThemeLabel(themeId).split(' / ')[0];

function renderThemePerformanceBars({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('sector-perf-bars');
  if (!host) return;
  host.dataset.aioThemePerformanceBarsRenderer = 'native';
  const view = root?._sectorPerfView === 'all' ? 'all' : 'sectors';
  // v58.75 (persona review): Koyfin/Finviz-style period tabs. 1일·1주 stay the rotation artifact's session returns
  // (dailyPct/weeklyPct); 1·3·6·12개월 are the published screener's ETF returns (ret1m…ret12m). Each bar carries its gap to
  // SPY over the same window; an ETF the screener does not carry reads '—'. No YTD field is published, so no YTD tab.
  const screenerRows = screenerRowMap(store);
  const allItems = selectThemesItems(store?.getState?.() || {});
  const hasLong = allItems.some((item) => finite(screenerRows.get(String(item?.symbol || item?.id || '').toUpperCase())?.ret1m) != null);
  // 1개월 first (the S&P 500 map right below already shows the day), the day when no screener return has arrived.
  const mode = SECTOR_PERIODS.some(([key]) => key === root?._aioSectorPeriod) ? root._aioSectorPeriod : hasLong ? '1m' : '1d';
  const period = SECTOR_PERIODS.find(([key]) => key === mode);
  ensureSectorPeriodTabs(documentRef, root, store, route, mode);
  const valueOf = (symbol, item) => {
    if (mode === '1d') return finite(item?.pct);
    if (mode === '1w') return finite(item?.weeklyPct);
    return finite(screenerRows.get(symbol.toUpperCase())?.[period[2]]);
  };
  // SPY over the same window: the screener's SPY row, only when it closed on the rotation's session.
  const spyRow = screenerRows.get('SPY');
  const close = usCloseSession(root);
  const spySame = spyRow && (!close || String(spyRow.factorSessionDate || '').slice(0, 10) === close);
  const spy = spySame ? finite(spyRow[{ '1d': 'ret1d', '1w': 'ret5d' }[mode] || period[2]]) : null;
  const rows = viewItems(allItems, view)
    .map((item) => {
      const symbol = String(item?.symbol || item?.id || '');
      const pct = valueOf(symbol, item);
      return {
        symbol,
        label: themeItemLabel(root, item),
        pct,
        vsSpy: pct != null && spy != null ? pct - spy : null,
        // v57.84: the bar badge reads the same banded zone as the scatter — a point within ±band of 100 is 경계 here too.
        quadrant: zoneKey(root, item) || 'neutral'
      };
    })
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
  if (section) section.hidden = !allItems.some((item) => finite(item?.pct) != null || finite(item?.weeklyPct) != null) && !hasLong; // any period, so a tab never hides its own way back
  const sectionLabel = section?.querySelector?.('.aio-section-label');
  if (sectionLabel) sectionLabel.textContent = '섹터 기간별 등락, SPY 대비';
  if (!rows.length) {
    const empty = documentRef.createElement('div');
    empty.textContent = '섹터 성과 데이터 수신 대기';
    empty.className = 'thp-perf-empty';
    host.appendChild(empty);
    return;
  }
  const maxAbs = Math.max(0.5, ...rows.map((row) => Math.abs(row.pct ?? 0)));
  // v58.79 (layout over captions): the section label already says "SPY 대비"; the close is the label's chip and the
  // column rule (right %p = SPY over the same period, — = no value) is the chip's hover.
  setAsOf(documentRef, section?.querySelector?.('.aio-section-hd'), close ? `${shortSession(close)} 종가` : '', `${period[1]} 수익률${close ? `, ${shortSession(close)} 미국 종가 기준` : ''}${spy != null ? `, 오른쪽 %p = 같은 기간 SPY(${signedText(spy, 2)}%) 대비` : ', SPY 같은 기간 값 대기'}, 값이 없는 섹터는 —`);
  const colors = { Leading: 'var(--data-green)', Improving: 'var(--text-secondary)', Weakening: 'var(--text-secondary)', Lagging: 'var(--data-amber)' }; // v58.53: the scatter's quadrant colours
  rows.forEach((row) => {
    const line = documentRef.createElement('div');
    line.dataset.themePerformanceRow = row.symbol;
    line.className = 'thp-perf-row';
    const symbol = documentRef.createElement('span');
    symbol.textContent = row.symbol;
    symbol.className = 'thp-perf-symbol';
    const label = documentRef.createElement('span');
    label.textContent = row.label;
    label.className = 'thp-perf-label';
    const track = documentRef.createElement('span');
    track.className = 'thp-perf-track';
    const zero = documentRef.createElement('span');
    zero.className = 'thp-perf-zero';
    track.appendChild(zero);
    if (row.pct != null) {
      const bar = documentRef.createElement('span');
      const width = `${Math.abs(row.pct) / maxAbs * 45}%`;
      bar.className = `thp-perf-bar ${row.pct >= 0 ? 'thp-perf-bar--up' : 'thp-perf-bar--down'}`;
      bar.style.marginLeft = row.pct >= 0 ? '50%' : `calc(50% - ${width})`;
      bar.style.width = width;
      track.appendChild(bar);
    }
    const value = documentRef.createElement('span');
    value.textContent = row.pct == null ? '—' : `${signedText(row.pct, mode === '1d' || mode === '1w' ? 2 : 1)}%`;
    value.className = 'thp-perf-value';
    value.style.color = dirColor(row.pct, mode === '1d' || mode === '1w' ? 2 : 1); // P2115: colour follows the printed digits
    const vsSpy = documentRef.createElement('span');
    vsSpy.textContent = row.vsSpy == null ? '' : `${signedText(row.vsSpy, 1)}%p`;
    vsSpy.className = 'thp-perf-vs';
    if (row.vsSpy != null) vsSpy.title = `${period[1]} SPY 대비 ${signedText(row.vsSpy, 2)}%p`;
    const badge = documentRef.createElement('span');
    // v58.80 first-users run-2 (F12): "선도" beside the day's worst move read as a contradiction; the badge is the ~50-session
    // rotation stage, not this period's move, so it says so.
    const quadrantWord = RRG_QUADRANT_WORDS[row.quadrant];
    badge.textContent = row.pct == null ? '대기' : (row.quadrant === 'Border' ? '기준선 부근' : quadrantWord ? `50일 ${quadrantWord}` : '중립');
    if (quadrantWord) badge.title = `약 50거래일 상대강도 회전 단계 — 위 막대(${period[1]})와 다른 기간입니다`;
    badge.className = 'thp-perf-badge';
    badge.style.color = row.pct == null ? 'var(--text-muted)' : colors[row.quadrant] || 'var(--text-muted)';
    line.append(symbol, label, track, value, vsSpy, badge);
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
    change.textContent = ` ${signedText(pct, 2)}%`;
    change.style.color = dirColor(pct, 2);
    chip.append(change);
  }
  // v57.81: a 경계 chip names the quadrants it sits between; a chip whose last five sessions of relative strength ran
  // against its quadrant says so (rrgRecentReading), so 선도 is never read as "still strengthening" during a break.
  const reading = item?.rrgReading || null;
  if (reading?.border || reading?.reversal) {
    chip.dataset.rrgReading = reading.label;
    const note = documentRef.createElement('span');
    note.textContent = `${reading.border ? `, ${reading.between} 사이` : ''}${item.recentReversal ? `, 최근 5거래일 ${item.recentReversal}` : ''}`;
    note.style.color = 'var(--text-secondary)';
    chip.append(note);
  }
  chip.className = detailId ? 'thp-chip thp-chip--detail' : 'thp-chip'; // v57.77 (a11y): the dashed border marks summary-only; opacity dropped the % below 4.5:1
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
      const reversal = reading?.reversal ? `상대강도 ${signedText(reading.check.change, 1)}% ${reading.reversal === 'fell' ? '반락' : '반등'}` : null;
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
  legend.textContent = `칩 옆 % = 1일 등락률로, 사분면(가로 50일 평균 대비, 세로 10거래일 전 대비)과 별개라 후행 섹터가 그날은 올랐을 수 있습니다. '최근 5거래일 상대강도'는 그 주 움직임이 평소 1주 움직임의 2배를 넘게 사분면과 반대일 때만 붙습니다. 실선 칩 ${detailCount}개는 테마 상세, 점선 칩 ${Math.max(0, items.length - detailCount)}개는 세부 테마 순위로 연결됩니다.`;
  legend.className = 'thp-quadrant-legend';
  if (classifiedCount) container.appendChild(legend); // P1591 (T01): no quadrant legend over an empty quadrant area
  const appendUnclassified = () => {
    const pending = items.filter((item) => !groups.has(String(item?.quadrant || 'unknown')) || String(item?.quadrant) === 'Border' || finite(item?.rsRatio) == null || finite(item?.rsMomentum) == null);
    if (!pending.length) return;
    const catalog = documentRef.createElement('section');
    catalog.className = 'thp-quadrant-catalog';
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
    if (foldSummary) foldSummary.textContent = '섹터 목록, 상대강도 판정 전';
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
    card.className = 'thp-quadrant-card';
    const heading = documentRef.createElement('div');
    heading.textContent = quadrant.label;
    heading.className = 'thp-quadrant-heading';
    const note = documentRef.createElement('div');
    note.textContent = quadrant.note;
    note.className = 'thp-quadrant-note';
    card.append(heading, note);
    const chips = documentRef.createElement('div');
    chips.className = 'thp-quadrant-chips';
    const group = groups.get(quadrant.key) || [];
    if (group.length) group.forEach((item) => chips.appendChild(createChip(documentRef, item, root)));
    else {
      const empty = documentRef.createElement('span');
      empty.textContent = '해당 섹터 없음';
      empty.className = 'thp-quadrant-empty';
      chips.appendChild(empty);
    }
    card.appendChild(chips);
    container.appendChild(card);
  });
  appendUnclassified();
  // P1431: one reading of all four quadrants, tied to the 시장 상태 breadth axis.
  let revisions = null;
  try { revisions = marketInterpretation(root, { store }).indexEarnings?.sectors || null; } catch (_) { revisions = null; }
  const flow = rotationFlow({ groups: Object.fromEntries(groups), regime: readMarketRegime(root), revisions });
  const read = documentRef.getElementById('rrg-rotation-read');
  if (read) read.textContent = flow.read;
  renderNextSteps(documentRef, documentRef.getElementById('themes-next'), flow.next);
}

// v58.75 (persona review): the theme's representative ETF against SPY over the produced 100 sessions (rotationHistory
// relativeStrength, rebased to 100 on the first session) — the line an RRG point summarises. No ETF, no chart.
const stageWord = (state) => String(THEME_STATES[state] || '').split(' (')[0];
const pctText = (value) => (finiteOrNull(value) == null ? '—' : `${signedText(value, 1)}%`);

// v58.75 (persona review, teach-and-check A-3): the ETF's sector-rotation quadrant ten sessions ago (the produced trail)
// against now — a move the trail records, not a forecast.
const RRG_MOVE_SESSIONS = 10;
function rrgMoveOf(root, themeId) {
  const etf = (root?.THEME_MAP || []).find((theme) => theme?.id === themeId)?.etf || null;
  const item = etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now()) : null;
  if (!item || finiteOrNull(item.rsRatio) == null || finiteOrNull(item.rsMomentum) == null) return null;
  const points = (Array.isArray(item.trail) ? item.trail : []).filter((point) => finiteOrNull(point?.rsRatio) != null && finiteOrNull(point?.rsMomentum) != null && (!item.sessionDate || String(point.sessionDate) < String(item.sessionDate)));
  const past = points[points.length - RRG_MOVE_SESSIONS];
  if (!past) return null;
  const quadrant = (ratio, momentum) => (ratio >= 100 ? (momentum >= 100 ? 'Leading' : 'Weakening') : momentum >= 100 ? 'Improving' : 'Lagging');
  const from = quadrant(past.rsRatio, past.rsMomentum), to = quadrant(item.rsRatio, item.rsMomentum);
  return { etf, from, to, fromWord: RRG_QUADRANT_WORDS[from], toWord: RRG_QUADRANT_WORDS[to], sessions: RRG_MOVE_SESSIONS };
}

// Same-session headlines that name a member which moved 2% or more (news-picks.js matcher: ticker or the company's own name).
function themeHeadlines(root, store, members, session) {
  const span = session ? sessionNewsWindow(session) : null;
  if (!span) return [];
  const timeline = root?._serverMarketTimeline || {};
  const news = [...selectNewsItems(store?.getState?.() || {}), ...(Array.isArray(root?._serverNewsIntraday) ? root._serverNewsIntraday : []),
    ...(timeline.current?.headlines || []), ...(Array.isArray(timeline.slots) ? timeline.slots : []).flatMap((slot) => slot?.headlines || [])];
  const telegram = Array.isArray(root?.AIO_TELEGRAM_CURRENT_ITEMS) ? root.AIO_TELEGRAM_CURRENT_ITEMS : [];
  if (!news.length && !telegram.length) return [];
  const movers = members.filter((member) => Math.abs(finiteOrNull(member.row?.ret1d) ?? 0) >= 2 && String(member.row?.factorSessionDate || '').slice(0, 10) === session)
    .sort((a, b) => Math.abs(b.row.ret1d) - Math.abs(a.row.ret1d)).slice(0, 4);
  const out = [];
  for (const member of movers) {
    const hit = headlineForCompany({ symbol: member.sym, name: member.row?.name || '' }, { news, telegram, span });
    const title = hit ? String(hit.kind === 'telegram' ? hit.text : hit.row?.titleKo || hit.row?.ko_title || hit.row?.title || '').trim() : '';
    if (title) out.push({ sym: member.sym, ret1d: member.row.ret1d, title: title.length > 90 ? `${title.slice(0, 87)}…` : title });
    if (out.length >= 2) break;
  }
  return out;
}

/** The AI-readable summary of one theme: { headline, items: [{ label, met, value, principle }], reasons, roles, scenarios }. */
function themeCriteriaSummary(root, store, themeId) {
  const raw = String(themeId || '').trim();
  if (!raw) return null;
  const [marketPart, idPart] = raw.includes(':') ? raw.split(':') : [null, raw];
  const playbook = root?.__aioThemePlaybook?.available ? root.__aioThemePlaybook : themePlaybookForRoot(root, store).playbook;
  const themes = playbook?.themes || [];
  const row = themes.find((item) => (!marketPart || item.market === marketPart.toUpperCase()) && (item.id === idPart || item.label === idPart))
    || themes.find((item) => item.label?.includes(idPart));
  if (!row) return null;
  const teach = themeTeachFor({ root, store, market: row.market, themeId: row.id, playbook });
  if (!teach?.criteria) return null;
  const reasons = themeReasons({ row, tags: row.tags || [], moves: macroMoves(root?._aioHistory || [], teach.regime), crossroads: teach.crossroads,
    revisions: revisionCounts(teach.consensus, teach.measured.map((member) => member.sym)), rrgMove: row.market === 'US' ? rrgMoveOf(root, row.id) : null }).map((item) => item.text);
  return { market: row.market, themeId: row.id, label: row.label, stage: stageWord(row.state) || '판정 보류', asOf: teach.after,
    headline: teach.criteria.headline, items: teach.criteria.items.map(({ label, met, value, principle }) => ({ label, met, value, principle })),
    reasons, roles: Object.fromEntries(Object.entries(teach.examples).map(([key, list]) => [MEMBER_ROLES[key].name, list])),
    scenarios: { favorable: teach.split.favorable, unfavorable: teach.split.unfavorable, breaks: row.breaks || [] } };
}

// v58.75 (persona review, teach-and-check A-3·4·6): '이 흐름의 이유' at the top of the theme detail and '전문가는 이렇게
// 고른다 — 테마' before its scenario read. Both fill slots renderThemeDetailSummary leaves; the criteria table is folded.
function renderThemeDetailTeach({ documentRef, root, store }) {
  const why = documentRef?.getElementById('theme-detail-native-why');
  const criteriaHost = documentRef?.getElementById('theme-detail-native-criteria');
  if (!why && !criteriaHost) return;
  const themeId = String(root?._currentThemeId || '');
  const teach = themeId ? themeTeachFor({ root, store, market: 'US', themeId }) : null;
  const make = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  if (!teach?.criteria) { for (const node of [why, criteriaHost]) if (node) { node.hidden = true; node.replaceChildren(); } return; }
  const { row, criteria } = teach;
  if (why) {
    const reasons = themeReasons({ row, tags: row.tags || [], moves: macroMoves(root?._aioHistory || [], teach.regime), crossroads: teach.crossroads,
      revisions: revisionCounts(teach.consensus, teach.measured.map((member) => member.sym)), rrgMove: rrgMoveOf(root, themeId), headlines: themeHeadlines(root, store, teach.measured, teach.after) });
    const list = make('ul', null, 'thp-why-list');
    reasons.forEach((item) => list.append(make('li', item.text)));
    // v58.79: which causes qualify is the heading's hover, not a line under the list.
    why.replaceChildren(Object.assign(make('div', '이 흐름의 이유', 'thp-detail-heading'), { title: '거시 축 이동, 이익 전망 수정, 섹터 회전 이동, 선두 시나리오, 같은 날 보도처럼 데이터로 확인되는 원인만 적습니다.' }), reasons.length ? list : make('p', '데이터로 확인되는 원인이 아직 없습니다(미확인).', 'thp-detail-empty'));
    why.hidden = false;
  }
  if (criteriaHost) {
    const fold = make('details', null, 'thp-criteria-fold');
    fold.open = !!root._aioCriteriaOpen;
    fold.addEventListener('toggle', () => { root._aioCriteriaOpen = fold.open; });
    const table = make('table', null, 'thp-criteria-table');
    const head = make('thead'), hr = make('tr');
    ['기준과 원리', '이 테마 지금', '충족'].forEach((label) => hr.append(make('th', label)));
    head.append(hr);
    const body = make('tbody');
    for (const item of criteria.items) {
      const tr = make('tr');
      const nameCell = make('td');
      nameCell.append(make('span', item.label, 'thp-criteria-name'), make('span', ` ${item.principle}`, 'thp-criteria-principle'));
      tr.append(nameCell, make('td', item.value), make('td', item.met == null ? '미확인' : item.met ? '충족' : '미충족', `thp-criteria-met is-${item.met == null ? 'unknown' : item.met ? 'met' : 'unmet'}`));
      [...tr.children].forEach((td, index) => { td.dataset.label = ['기준', '지금', '충족'][index]; });
      body.append(tr);
    }
    table.append(head, body);
    fold.append(make('summary', '기준 6개, 원리와 이 테마의 현재 값'), table);
    const confirm = criteria.items.filter((item) => item.met === false).map((item) => item.label);
    const split = scenarioSplitText(teach.split);
    criteriaHost.replaceChildren(make('div', '전문가는 이렇게 고른다 — 테마', 'thp-detail-heading'), make('p', `${row.label}: ${criteria.headline}.`, 'thp-detail-body'), fold,
      ...(split ? [make('p', `${split} 확인할 신호: ${confirm.length ? `미충족 기준(${confirm.join(', ')})이 충족으로 바뀌는지` : '충족한 기준이 유지되는지'}. 논리가 깨지는 신호는 아래 '이 테마의 시나리오'의 점검 신호입니다.`, 'thp-detail-body')] : []));
    criteriaHost.hidden = false;
  }
}

function relativeStrengthChart(documentRef, root, detail) {
  const etf = detail?.etf || null;
  const produced = etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now()) : null;
  const series = (produced?.relativeStrength || []).filter((point) => point?.sessionDate && finite(point.value) != null);
  if (series.length < 20) return null;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs = {}, text = null) => { const n = documentRef.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text != null) n.textContent = text; return n; };
  const W = 640, H = 170, padL = 40, padR = 56, padT = 12, padB = 24;
  const values = series.map((point) => point.value);
  const lo = Math.min(100, ...values), hi = Math.max(100, ...values), span = Math.max(1, hi - lo);
  const x = (i) => padL + i / (series.length - 1) * (W - padL - padR);
  const y = (v) => padT + (hi + span * 0.05 - v) / (span * 1.1) * (H - padT - padB);
  const last = series.at(-1), back20 = series.at(-21) || series[0];
  const total = last.value / series[0].value * 100 - 100, recent = last.value / back20.value * 100 - 100;
  const svg = node('svg', { viewBox: `0 0 ${W} ${H}`, class: 'thp-rel-chart', role: 'img', 'aria-label': `${etf}의 SPY 대비 상대가격 ${series.length}거래일, ${shortSession(series[0].sessionDate)} 100에서 ${shortSession(last.sessionDate)} ${last.value.toFixed(1)}` });
  svg.append(node('line', { x1: padL, x2: W - padR, y1: y(100), y2: y(100), class: 'thp-rel-base' }), node('text', { x: padL - 4, y: y(100) + 4, 'text-anchor': 'end', class: 'thp-rel-tick' }, '100'));
  for (const v of [hi, lo]) if (Math.abs(v - 100) > span * 0.12) svg.append(node('text', { x: padL - 4, y: y(v) + 4, 'text-anchor': 'end', class: 'thp-rel-tick' }, v.toFixed(0)));
  svg.append(node('polyline', { points: series.map((point, i) => `${x(i).toFixed(1)},${y(point.value).toFixed(1)}`).join(' '), class: `thp-rel-line ${last.value >= 100 ? 'is-up' : 'is-down'}` }));
  svg.append(node('circle', { cx: x(series.length - 1), cy: y(last.value), r: 3, class: `thp-rel-dot ${last.value >= 100 ? 'is-up' : 'is-down'}` }), node('text', { x: x(series.length - 1) + 6, y: y(last.value) + 4, class: 'thp-rel-tick' }, last.value.toFixed(1)));
  svg.append(node('text', { x: padL, y: H - 6, class: 'thp-rel-tick' }, shortSession(series[0].sessionDate)), node('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', class: 'thp-rel-tick' }, shortSession(last.sessionDate)));
  const box = documentRef.createElement('div');
  box.className = 'thp-rel';
  const head = documentRef.createElement('div');
  head.className = 'thp-detail-heading';
  head.textContent = `대표 ETF ${etf}, SPY 대비 상대가격 ${series.length}거래일`;
  const read = documentRef.createElement('p');
  read.className = 'thp-detail-body';
  read.textContent = `${shortSession(series[0].sessionDate)}을 100으로 놓으면 ${shortSession(last.sessionDate)} ${last.value.toFixed(1)} — ${series.length}거래일 동안 SPY보다 ${signedText(total, 1)}%, 최근 20거래일 ${signedText(recent, 1)}%. 선이 오르면 SPY보다 강했다는 뜻이며, 섹터 회전 그래프의 점은 이 선을 50거래일 평균과 견준 값입니다.`;
  box.append(head, svg, read);
  return box;
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
  title.className = 'thp-summary-title';
  const meta = documentRef.createElement('span');
  meta.textContent = detail.etf ? `, ${detail.etf}` : ', 커스텀 합산';
  meta.className = 'thp-summary-meta';
  title.appendChild(meta);

  const performance = documentRef.createElement('span');
  const pct = typeof detail.pct === 'number' && Number.isFinite(detail.pct) ? detail.pct : null;
  performance.textContent = pct == null ? '당일 등락 대기' : `${signedText(pct, 2)}%`;
  performance.className = 'thp-summary-pct';
  performance.style.color = dirColor(pct, 2);

  const header = documentRef.createElement('div');
  header.className = 'thp-summary-header';
  header.append(title, performance);

  const leaders = documentRef.createElement('div');
  leaders.textContent = `대표 종목: ${(detail.leaderHighlight.length ? detail.leaderHighlight : detail.leaders.slice(0, 4)).join(', ') || '구성 데이터 대기'}`;
  leaders.className = 'thp-summary-leaders';

  const provenance = documentRef.createElement('div');
  const membership = detail.membershipPolicy || {};
  const membershipAsOf = membership.observedAt ? `구성 기준 ${String(membership.observedAt).slice(0, 10)}(분류 검토일, 가격 기준일 아님)` : '구성 기준일 미검증';
  const themeItem = selectThemesItems(store?.getState?.() || {}).find((item) => String(item?.id || '') === String(detail.id));
  const closeOf = usCloseSession(root);
  const quoteState = detail.source === 'quote-missing' || pct == null
    ? '시세 근거 미확보'
    : themeItem?.sourceKind === 'runtime-quote' ? '실시간·지연 시세'
      : `확정 종가 기준${closeOf ? `(${shortSession(closeOf)})` : ''}`;
  provenance.textContent = `${quoteState}, AIO 참고 테마 분류, ${membershipAsOf}`;
  provenance.title = `시세 출처: ${detail.source}, 구성 출처: ${membership.source || 'AIO curated taxonomy'}`;
  provenance.className = 'thp-summary-provenance';
  provenance.setAttribute('data-source-kind', membership.sourceKind || 'REFERENCE');
  provenance.setAttribute('data-operational-use', membership.allowedUse === 'decision' ? 'decision' : 'reference-only');
  if (membership.observedAt) provenance.setAttribute('data-observed-at', membership.observedAt);

  host.replaceChildren(header, leaders, provenance);
  // v58.75 (persona review, A-3): '이 흐름의 이유' sits right under the title (renderThemeDetailTeach fills it).
  const whySlot = documentRef.createElement('div');
  whySlot.id = 'theme-detail-native-why';
  whySlot.className = 'theme-detail-native-section thp-why';
  whySlot.hidden = true;
  host.append(whySlot);
  const relative = relativeStrengthChart(documentRef, root, detail);
  if (relative) host.append(relative);
  // P1440: the theme's own flow from the published screener medians — readable even when live quotes
  // for the constituents have not arrived (the legacy panel below then reads 시세 대기).
  const rows = store?.getState?.()?.screener?.rows || [];
  const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey: 'ret3m', benchmark: benchmarkReturns(root?._aioHistory || []) });
  // P1591 (T03): the ETF's rotation state is read only through the session-checked selector, so a stale
  // quadrant never sits under a 'waiting' status; the sentence carries its close date.
  const etfRotation = detail.etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, detail.etf, Date.now()) : null;
  const stageRow = root?.__aioThemePlaybook?.themes?.find((row) => row.market === 'US' && row.id === detail.id && row.state);
  const themeName = (root?.THEME_MAP || []).find((theme) => theme?.id === detail.id)?.nameKr || detail.label || null;
  const flow = themeDetailFlow({ themeId: detail.id, themeName, groups: model.groups, etf: detail.etf || null, rotation: etfRotation ? { [detail.etf]: etfRotation } : {},
    stage: stageRow ? { state: stageRow.state, label: String(stageRow.stateLabel || '').split(' (')[0], window: '6개월' } : null });
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
      name.textContent = group.smallSample ? `${group.name}, 표본 ${group.members}종목, 참고` : group.name; // D15
      const item = documentRef.createElement('div');
      item.className = 'stock-read-bar-row';
      const bar = documentRef.createElement('div');
      bar.className = `stock-read-bar is-stock ${(group.ret3m ?? 0) >= 0 ? 'is-up' : 'is-down'}`;
      bar.style.width = `${Math.max(2, Math.abs(group.ret3m ?? 0) / max * 100).toFixed(1)}%`;
      const value = documentRef.createElement('span');
      value.className = 'stock-read-bar-value';
      const dir = directionLabel(group); // 3개월→1개월 순위 변화 (audit 19: not the playbook stage words; v58.74 names a contrary week)
      value.textContent = `3개월 ${group.ret3m == null ? '—' : `${signedText(group.ret3m, 1)}%`}, 1개월 ${group.ret1m == null ? '—' : `${signedText(group.ret1m, 1)}%`}${group.ret5d != null ? `, 5거래일 ${signedText(group.ret5d, 1)}%` : ''}${group.above50Pct != null ? `, 50일선 위 ${group.above50Pct}%` : ''}${dir ? `, ${dir}` : ''}`;
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
  // v58.75 (persona review, A-4·6): the six expert criteria and the conditional scenarios, before the theme's stage read.
  const criteriaSlot = documentRef.createElement('div');
  criteriaSlot.id = 'theme-detail-native-criteria';
  criteriaSlot.className = 'theme-detail-native-section thp-criteria';
  criteriaSlot.hidden = true;
  host.append(criteriaSlot, playbookSlot);
  if (Array.isArray(flow.next) && flow.next.length) {
    const nav = documentRef.createElement('nav');
    nav.className = 'flow-next';
    nav.id = 'theme-detail-next';
    nav.setAttribute('aria-label', '이어서 볼 곳');
    host.append(nav);
    renderNextSteps(documentRef, nav, flow.next);
  }
  // v58.75 (persona review): the three 'AI에게 묻기' chips of the legacy #page-theme-detail block (unreachable since the
  // router sends theme-detail to themes) live here, on the shared _aioAskInPanel handler, with the theme named.
  const ask = documentRef.createElement('div');
  ask.className = 'aio-ask-row thp-ask-row';
  const askLabel = documentRef.createElement('span');
  askLabel.className = 'sh-muted-text';
  askLabel.textContent = 'AI에게 묻기';
  ask.append(askLabel);
  const askName = themeName || detail.label;
  for (const [label, question] of [['성장 동력', `${askName} 테마의 성장 동력과 지금 흐름을 설명해줘`], ['경쟁 구도', `${askName} 테마의 경쟁 구도를 정리해줘`], ['위험 요소', `${askName} 테마의 위험 요소와 확인할 지표를 정리해줘`]]) {
    const chip = documentRef.createElement('button');
    chip.type = 'button';
    chip.className = 'q-chip';
    chip.dataset.action = '_aioAskInPanel';
    chip.dataset.arg = question;
    chip.textContent = label;
    ask.append(chip);
  }
  host.append(ask);
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
  if (!code) return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}, 통화 미확인`;
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
  heading.textContent = '구성 종목, 기간 수익률과 추세 위치';
  heading.className = 'thp-detail-heading thp-detail-heading--loose';

  const breadth = documentRef.createElement('div');
  const breadthValue = finite(detail.breadth);
  const closeSession = detail.quoteBasis?.kind === 'completed-close' ? detail.quoteBasis.session : null;
  breadth.textContent = breadthValue == null
    ? '상승 종목 비율: 구성 종목 가격을 아직 충분히 받지 못해 계산 전입니다.'
    : `상승 종목 비율(${closeSession ? `${shortSession(closeSession)} 종가 기준` : '전일 대비'}): ${breadthValue}%, ${detail.leaders.length}종목 기준`;
  breadth.className = 'thp-breadth-line';

  const subThemes = documentRef.createElement('div');
  subThemes.className = 'thp-subtheme-list';
  (detail.subThemes || []).forEach((subTheme) => {
    const card = documentRef.createElement('section');
    card.className = 'thp-subtheme-card';
    const title = documentRef.createElement('div');
    title.className = 'thp-subtheme-title';
    const name = documentRef.createElement('span');
    name.textContent = subTheme.name || '세부 테마';
    name.className = 'thp-subtheme-name';
    if (subTheme.etf) {
      const etfLabel = documentRef.createElement('span');
      etfLabel.textContent = `, ${subTheme.etf}`;
      etfLabel.className = 'thp-subtheme-etf';
      name.appendChild(etfLabel);
    }
    const pct = compositeDetailPct(detail, subTheme);
    const performance = documentRef.createElement('span');
    performance.textContent = pct == null ? '시세 대기' : `${signedText(pct, 2)}%`;
    performance.className = 'thp-subtheme-pct';
    performance.style.color = dirColor(pct, 2);
    title.append(name, performance);
    card.appendChild(title);

    const tickers = documentRef.createElement('div');
    tickers.className = 'thp-ticker-chips';
    (subTheme.tickers || []).forEach((symbol) => {
      const quote = detailQuote(detail, symbol);
      const chip = documentRef.createElement('span');
      chip.textContent = `${symbol}${quote?.pct == null ? '' : ` ${signedText(quote.pct, 1)}%`}`;
      chip.dataset.action = 'showTicker';
      chip.dataset.arg = symbol;
      chip.title = `${symbol} 분석`;
      chip.className = 'thp-ticker-chip';
      tickers.appendChild(chip);
    });
    if (!tickers.childElementCount) {
      const empty = documentRef.createElement('span');
      empty.textContent = '구성종목 없음';
      empty.className = 'thp-detail-empty';
      tickers.appendChild(empty);
    }
    card.appendChild(tickers);
    subThemes.appendChild(card);
  });

  if (!subThemes.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '세부 테마 구성 데이터가 없습니다.';
    empty.className = 'thp-detail-empty';
    subThemes.appendChild(empty);
  }
  // v58.75 (persona review): a Finviz-style member table (1주·1개월·3개월·6개월, 50일선·52주 고점 거리, 20일 평균 대비
  // 거래량, sortable) separates leaders from laggards; the day chips per sub-theme stay folded below it as the day view.
  const screenerRows = screenerRowMap(store);
  const seen = new Set();
  const members = (detail.subThemes || []).flatMap((subTheme) => (subTheme.tickers || []).map((symbol) => ({ sym: String(symbol).toUpperCase(), group: subTheme.name || '' })))
    .filter((member) => (seen.has(member.sym) ? false : seen.add(member.sym))).map((member) => ({ ...member, label: member.sym, row: screenerRows.get(member.sym) || null }));
  const rerender = () => { if (String(root?._currentThemeId || '') === String(detail.id)) { renderThemeDetailComposition({ documentRef, root, store }); renderThemeDetailTeach({ documentRef, root, store }); } };
  const parts = [heading];
  const teach = themeTeachFor({ root, store, market: 'US', themeId: detail.id });
  const table = members.some((member) => member.row) ? memberTable(documentRef, root, members, { onSort: rerender, showGroup: (detail.subThemes || []).length > 1, ariaLabel: `${detail.label} 구성 종목 표`, roles: teach?.roles || null }) : null;
  const roleParts = table ? memberRoleParts(documentRef, teach) : null;
  if (table) parts.push(...(roleParts ? [roleParts.line] : []), table.lead, table.region, table.basis, ...(roleParts ? [roleParts.fold] : []));
  const catalysts = themeCatalysts(documentRef, root, members.map((member) => member.sym), rerender);
  if (catalysts) parts.push(catalysts);
  const dayFold = documentRef.createElement('details');
  dayFold.className = 'thp-subtheme-fold';
  dayFold.open = !table; // without the period table the day view is the only member view
  const daySummary = documentRef.createElement('summary');
  daySummary.textContent = '세부 테마별 당일 등락';
  dayFold.append(daySummary, breadth, subThemes);
  parts.push(dayFold);
  host.replaceChildren(...parts);
  host.hidden = false;
}

// v58.75 (persona review, A-2·5): the one-line role count above the member table and, folded, how an expert picks inside a
// theme — each role's definition, its pro and con, the members that fit it now (values), and the liquidity / earnings flags.
function memberRoleParts(documentRef, teach) {
  const roles = teach?.roles;
  if (!roles?.measured) return null;
  const make = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const count = (key) => [...roles.roles.values()].filter((info) => info.role === key).length;
  const line = make('p', `역할: ${Object.entries(MEMBER_ROLES).map(([key, role]) => `${role.label} ${count(key)}`).join('·')}종목(구성 종목 중앙값 1개월 ${pctText(roles.stats.ret1m)}, 3개월 ${pctText(roles.stats.ret3m)} 기준, 나머지는 중간).`, 'thp-detail-body thp-roles-line');
  const fold = make('details', null, 'thp-roles-fold');
  fold.append(make('summary', '테마 안에서 종목 고르는 법 — 주도·후발·이탈'));
  for (const [key, role] of Object.entries(MEMBER_ROLES)) {
    const examples = teach.examples?.[key] || [];
    const p = make('p', null, 'thp-detail-body');
    p.append(make('strong', role.name), documentRef.createTextNode(` — ${role.rule}. 장점: ${role.pro} 단점: ${role.con} 지금: ${examples.length ? examples.join(', ') : '해당 종목 없음'}.`));
    fold.append(p);
  }
  const infos = [...roles.roles.entries()];
  const thin = infos.filter(([, info]) => info.thin).map(([sym]) => sym);
  const due = infos.filter(([, info]) => info.earnings).map(([sym, info]) => `${sym} ${info.earnings}`);
  fold.append(make('p', `유동성: 30일 평균 거래대금 2,000만 달러 미만 ${thin.length ? `${thin.length}종목(${thin.slice(0, 6).join(', ')}${thin.length > 6 ? ' 외' : ''}) — 사고팔 때 호가 차이로 비용이 커질 수 있습니다` : '종목 없음'}. 실적 일정: ${teach.calendar ? (due.length ? `${due.join(', ')} — 발표 전후 하루 변동이 평소보다 커질 수 있습니다` : '달력 주간에 없음') : teach.row?.market === 'KR' ? '실적 달력은 미국 종목만 있어 미확인' : '달력 미확인'}. 바닥 다지기(베이스) 구조는 종목 차트에서 확인합니다.`, 'thp-detail-body'));
  return { line, fold };
}

const MEMBER_COLUMNS = Object.freeze([['ret5d', '1주'], ['ret1m', '1개월'], ['ret3m', '3개월'], ['ret6m', '6개월'], ['pctSma50', '50일선 대비'], ['pctFrom52wHigh', '52주 고점 대비'], ['rvol20', '거래량 배수']]);
/**
 * Sortable member table from published screener rows. members: [{ sym, label, group?, row }]. The 3개월 top and bottom
 * third carry a plain flag (a rank fact, not a grade). Sort state lives on root so a repaint keeps it.
 */
function memberTable(documentRef, root, members, { onSort, showGroup = false, ariaLabel = '구성 종목 표', basisDate = null, roles = null } = {}) {
  // v58.75 (persona review, A-5): with member roles (theme-criteria.js memberRoles) the last column names the role and its
  // liquidity / earnings flags instead of the 3개월 third.
  const roleMap = roles?.measured ? roles.roles : null;
  const sort = root._aioMemberSort && MEMBER_COLUMNS.some(([key]) => key === root._aioMemberSort.key) ? root._aioMemberSort : { key: 'ret3m', dir: -1 };
  // v59.46 boundary contract (stage 2): a member's published numbers are read through the readiness contract.
  const memberValue = (member, key) => readRowNumber(member.row, key, 'display');
  const ranked = members.filter((member) => memberValue(member, 'ret3m') != null).sort((a, b) => memberValue(b, 'ret3m') - memberValue(a, 'ret3m'));
  const third = ranked.length >= 6 ? Math.floor(ranked.length / 3) : 0;
  const top = new Set(ranked.slice(0, third).map((member) => member.sym)), bottom = new Set(third ? ranked.slice(-third).map((member) => member.sym) : []);
  const sorted = [...members].sort((a, b) => {
    const va = memberValue(a, sort.key), vb = memberValue(b, sort.key);
    if (va == null && vb == null) return a.sym.localeCompare(b.sym);
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * sort.dir;
  });
  const make = (tag, text, className) => { const n = documentRef.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
  const table = make('table', null, 'thp-member-table');
  const head = make('thead'), hr = make('tr');
  const lastLabel = roleMap ? '역할' : '3개월 순위';
  const labels = ['종목', ...(showGroup ? ['세부 테마'] : []), ...MEMBER_COLUMNS.map(([, label]) => label), lastLabel];
  hr.append(make('th', '종목'));
  if (showGroup) hr.append(make('th', '세부 테마'));
  for (const [key, label] of MEMBER_COLUMNS) {
    const th = make('th');
    th.setAttribute('aria-sort', sort.key === key ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none');
    const button = make('button', `${label}${sort.key === key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}`, 'thp-member-sort');
    button.type = 'button';
    button.addEventListener('click', () => { root._aioMemberSort = { key, dir: sort.key === key ? -sort.dir : -1 }; onSort?.(); });
    th.append(button);
    hr.append(th);
  }
  hr.append(make('th', lastLabel));
  head.append(hr);
  const body = make('tbody');
  const fmt = (key, value) => (value == null ? '—' : key === 'rvol20' ? `${value.toFixed(2)}배` : `${signedText(value, 1)}%`);
  // Fifteen rows first (the sort decides which); the rest on request, so a 40-name theme does not run a screen long.
  const shown = root._aioMemberAll || sorted.length <= 18 ? sorted : sorted.slice(0, 15);
  for (const member of shown) {
    const tr = make('tr');
    const cell = make('td');
    const button = make('button', member.label, 'breadth-drill-symbol');
    button.type = 'button';
    button.dataset.action = 'showTicker';
    button.dataset.arg = member.sym;
    if (member.label !== member.sym) button.title = member.sym;
    cell.append(button);
    tr.append(cell);
    if (showGroup) tr.append(make('td', member.group || '—', 'thp-member-group'));
    for (const [key] of MEMBER_COLUMNS) {
      const value = memberValue(member, key);
      tr.append(make('td', fmt(key, value), `is-num${value == null || key === 'rvol20' || !directionOf(value) ? '' : directionOf(value) === 'up' ? ' is-up' : ' is-down'}${sort.key === key ? ' is-sorted' : ''}`));
    }
    if (roleMap) {
      const info = roleMap.get(member.sym) || {};
      const flags = [info.thin ? '거래대금 적음' : null, info.earnings ? `실적 ${info.earnings}` : null].filter(Boolean);
      tr.append(make('td', [info.role ? MEMBER_ROLES[info.role].label : '—', ...flags].join(', '), `thp-member-flag${info.role ? ` is-${info.role}` : ''}`));
    } else tr.append(make('td', top.has(member.sym) ? '상위 1/3' : bottom.has(member.sym) ? '하위 1/3' : '', top.has(member.sym) ? 'thp-member-flag is-top' : bottom.has(member.sym) ? 'thp-member-flag is-bottom' : 'thp-member-flag'));
    [...tr.children].forEach((td, index) => { td.dataset.label = labels[index]; });
    body.append(tr);
  }
  table.append(head, body);
  const region = make('div', null, 'aio-table-scroll thp-member-scroll');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', `${ariaLabel}, 가로 스크롤`);
  region.tabIndex = 0;
  region.append(table);
  const name = (member) => member.label;
  const lead = make('p', ranked.length >= 4
    ? `3개월 기준 앞선 종목 ${ranked.slice(0, 3).map((m) => `${name(m)}(${signedText(memberValue(m, 'ret3m'), 1)}%)`).join(', ')}, 뒤처진 종목 ${ranked.slice(-2).reverse().map((m) => `${name(m)}(${signedText(memberValue(m, 'ret3m'), 1)}%)`).join(', ')}. 50일선 위 ${members.filter((m) => memberValue(m, 'pctSma50') > 0).length}/${members.filter((m) => memberValue(m, 'pctSma50') != null).length}종목.`
    : '구성 종목의 기간 수익률 기록이 적어 앞선·뒤처진 종목을 나누지 않습니다.', 'thp-detail-body');
  const latestMemberSession = latestSessionRows(members, (member) => stampDay(member.row?.factorSessionDate)).basis;
  // v58.79: the close date stays; how to read the columns is its hover.
  const basis = make('p', basisDate || (latestMemberSession ? `${shortSession(latestMemberSession)} 종가 기준` : '종가 기준일 미확인'), 'thp-perf-basis');
  basis.title = `열 제목을 누르면 정렬, 거래량 배수 = 최근 거래량 ÷ 20일 평균, ${roleMap ? "역할은 아래 '테마 안에서 종목 고르는 법'의 정의" : `3개월 순위는 이 표 안에서의 위치(기록 ${ranked.length}종목)`}`;
  if (sorted.length > 18) {
    const more = make('button', root._aioMemberAll ? '정렬 순 상위 15종목만 보기' : `전체 ${sorted.length}종목 보기`, 'theme-strength-more thp-member-more');
    more.type = 'button';
    more.addEventListener('click', () => { root._aioMemberAll = !root._aioMemberAll; onSort?.(); });
    basis.append(' ', more);
  }
  return { lead, region, basis };
}

// v58.75 (persona review): what is scheduled for the theme's members — the published earnings calendar week and the
// four-week estimate revisions (consensus-estimates.json fwd.up4w / down4w). Both load once and repaint on arrival.
function themeCatalysts(documentRef, root, symbols, rerender) {
  if (!root[EARNINGS_CALENDAR.key]) refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) rerender(); }).catch(() => {});
  if (!root[CONSENSUS_KEY]) requestConsensusEstimates(root, rerender);
  const wanted = new Set(symbols.map((symbol) => String(symbol).toUpperCase()));
  const calendar = root[EARNINGS_CALENDAR.key];
  const consensus = root[CONSENSUS_KEY];
  const lines = [];
  if (Array.isArray(calendar?.earnings)) {
    const hour = { bmo: '장전', amc: '장후', dmh: '장중' };
    const due = calendar.earnings.filter((row) => wanted.has(String(row?.symbol || '').toUpperCase()) && isoDay(row?.date))
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
    const span = calendar.weekStart && calendar.weekEnd ? `${shortSession(calendar.weekStart)}~${shortSession(calendar.weekEnd)}` : '이번 달력 주간';
    lines.push(due.length ? `실적 발표 예정(${span}, 구성 종목): ${due.map((row) => `${row.symbol} ${shortSession(row.date)}${hour[row.hour] ? ` ${hour[row.hour]}` : ''}`).join(', ')}.` : `${span} 실적 발표 예정인 구성 종목은 달력에 없습니다.`);
  }
  if (consensus?.rows && typeof consensus.rows === 'object') {
    const rows = [...wanted].map((symbol) => consensus.rows[symbol]?.fwd).filter((fwd) => fwd && finiteOrNull(fwd.up4w) != null && finiteOrNull(fwd.down4w) != null);
    if (rows.length) {
      const up = rows.reduce((sum, fwd) => sum + fwd.up4w, 0), down = rows.reduce((sum, fwd) => sum + fwd.down4w, 0);
      const asOf = [...wanted].map((symbol) => String(consensus.rows[symbol]?.asOf || '').slice(0, 10)).filter(Boolean).sort().at(-1);
      lines.push(`최근 4주 구성 종목 이익 전망 수정: 상향 ${up}건, 하향 ${down}건(상향이 많은 종목 ${rows.filter((fwd) => fwd.up4w > fwd.down4w).length}, 하향이 많은 종목 ${rows.filter((fwd) => fwd.down4w > fwd.up4w).length}, 컨센서스가 있는 종목 ${rows.length}/${wanted.size}${asOf ? `, ${shortSession(asOf)} 기준` : ''}).`);
    }
  }
  if (!lines.length) return null;
  const box = documentRef.createElement('div');
  box.className = 'thp-catalysts';
  const head = documentRef.createElement('div');
  head.className = 'thp-detail-heading';
  head.textContent = '다가오는 일정과 이익 전망';
  box.append(head, ...lines.map((text) => { const p = documentRef.createElement('p'); p.className = 'thp-detail-body'; p.textContent = text; return p; }));
  return box;
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
  heading.textContent = `대표 종목 상세, ${detail.leaders.length}종목`;
  heading.className = 'thp-detail-heading thp-detail-heading--loose';
  const cards = documentRef.createElement('div');
  cards.className = 'thp-leader-grid';
  (detail.leaders || []).forEach((symbol) => {
    const quote = detailQuote(detail, symbol);
    const card = documentRef.createElement('button');
    card.type = 'button';
    card.dataset.action = 'showTicker';
    card.dataset.arg = symbol;
    card.title = `${symbol} 상세 분석`;
    card.className = 'thp-leader-card';
    const ticker = documentRef.createElement('span');
    ticker.textContent = symbol;
    ticker.className = 'thp-leader-ticker';
    const price = documentRef.createElement('span');
    price.textContent = quote?.price == null && quote?.closeBased ? `${detail.quoteBasis?.session ? `${Number(detail.quoteBasis.session.slice(5, 7))}/${Number(detail.quoteBasis.session.slice(8, 10))} ` : ''}종가 기준` : formatQuotePrice(quote?.price, quote?.currency);
    price.className = 'thp-leader-price';
    const pct = documentRef.createElement('span');
    pct.textContent = quote?.pct == null ? '등락률 대기' : `${signedText(quote.pct, 2)}%`;
    pct.className = 'thp-leader-pct';
    pct.style.color = dirColor(quote?.pct ?? null, 2);
    card.append(ticker, price, pct);
    cards.appendChild(card);
  });
  if (!cards.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '대표 종목 구성 데이터가 없습니다.';
    empty.className = 'thp-detail-empty';
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
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  const pct = finite(detail.pct);
  if (pct == null) body.textContent = '시세 대기 — 구성종목 가격이 확인되면 당일 등락을 표시합니다.';
  else if (pct >= 3) body.textContent = '당일 +3% 이상 — 관측된 당일 등락 구간입니다. 과열·추세 지속은 별도 기간 근거가 필요합니다.';
  else if (pct >= 1) body.textContent = '당일 +1% 이상 — 관측된 당일 등락 구간입니다. 시계열 모멘텀·자금 유입은 별도 근거가 필요합니다.';
  // v59.45 R1-02: the flat band is symmetric (-1% < pct < +1%); +0.9% read 보합 while -0.05% read 하락.
  else if (pct > -1) body.textContent = '당일 보합 — 관측된 당일 등락 구간입니다. 방향은 추가 가격·거래량으로 확인합니다.';
  else if (pct > -2) body.textContent = '당일 -1% 이하 — 관측된 당일 등락 구간입니다. 원인(수급·로테이션)은 별도 근거가 필요합니다.';
  else body.textContent = '당일 -2% 이하 — 관측된 당일 등락 구간입니다. 시계열 하락·구조 훼손은 별도 기간 근거가 필요합니다.';
  body.className = 'thp-detail-body';
  body.style.color = pct == null ? 'var(--text-muted)' : pct > -1 ? 'var(--text-secondary)' : 'var(--data-amber)';
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
  heading.className = 'thp-detail-heading';
  const rows = (detail.leaders || [])
    .map((symbol) => ({ symbol, pct: detailQuote(detail, symbol)?.pct }))
    .filter((row) => finite(row.pct) != null)
    .sort((a, b) => b.pct - a.pct);
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
  if (rows.length < 2) {
    body.textContent = '시세 대기 — 최소 두 종목의 등락률이 확인되면 격차를 계산합니다.';
  } else {
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    // LC-38: a narrow day-level spread is not evidence that every constituent reacted to one
    // catalyst, nor a reason to prefer the ETF. State the measured dispersion only.
    const level = spread > 5 ? '매우 큼 — 구성 종목 간 당일 등락 차가 큽니다.' : spread > 2 ? '보통 — 테마 전체 움직임과 종목별 차이가 함께 있습니다.' : '좁음 — 구성 종목의 당일 등락이 비슷합니다.';
    body.textContent = `등락 편차 ${spread.toFixed(1)}%p (${level})`;
    const leaders = documentRef.createElement('div');
    leaders.textContent = `최강 ${rows[0].symbol} ${signedText(rows[0].pct, 2)}%, 최약 ${rows[rows.length - 1].symbol} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}%`;
    leaders.className = 'thp-spread-leaders';
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
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  const breadth = finite(detail.breadth);
  // LC-36: the up-ratio is computed over the 리더 목록 중 가격이 확인된 종목만이다. 그 분모를 값
  // 옆에 표시해, 화면의 14행(리더 목록)과 실제 비율의 n이 다를 수 있음을 드러낸다.
  const leaderList = Array.isArray(detail.leaders) ? detail.leaders : [];
  const priceEligible = leaderList.filter((symbol) => finite(detailQuote(detail, symbol)?.pct) != null).length;
  const basis = breadth == null ? '' : ` (가격 적격 ${priceEligible}/${leaderList.length})`;
  if (breadth == null) body.textContent = '시세 대기 — 충분한 구성종목 가격이 확인되면 당일 가격 참여 폭을 계산합니다.';
  else if (breadth >= 70) body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 우수 — 관측된 당일 가격 참여이며 자금 유입·거래 주체의 증거가 아닙니다.`;
  else if (breadth >= 50) body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 보통 — 일부 종목 중심인지 선별이 필요합니다.`;
  else body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 취약 — 관측된 당일 가격 참여이며 추세 단정이 아닙니다.`;
  body.className = 'thp-detail-body';
  body.style.color = breadth == null ? 'var(--text-muted)' : breadth >= 70 ? 'var(--data-green)' : breadth >= 50 ? 'var(--text-secondary)' : 'var(--data-amber)';
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
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
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
      ? '세부 테마 간 당일 가격 반응 격차가 큽니다. 자금 순환 여부는 별도 수급 근거가 필요합니다.'
      : '세부 테마 간 당일 반응은 비슷했습니다.';
    body.textContent = `세부 테마 격차 ${spread.toFixed(1)}%p, 최강 ${rows[0].name} ${signedText(rows[0].pct, 2, '%')}, 최약 ${rows[rows.length - 1].name} ${signedText(rows[rows.length - 1].pct, 2, '%')} — ${read}`;
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
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
  const themePct = finite(detail.pct);
  // Codex browser audit H25: when the theme's own return IS its representative ETF (반도체 = SMH), "SMH 대비
  // +0.00%p · 유사" compared SMH with itself. The comparison then moves to the broad market (SPY); without a
  // SPY quote it says why it is skipped instead of producing an empty "유사" verdict.
  const ownSymbol = detail.etf || detail.compositeBase || null;
  const ownPct = ownSymbol ? finite(detailQuote(detail, ownSymbol)?.pct) : null;
  const selfCompare = Boolean(ownSymbol && themePct != null && ownPct != null && Math.abs(themePct - ownPct) < 0.005);
  // v58.74 (audit): on a weekend SPY has no live quote; the S&P 500 close of the detail's own session stands in.
  const spxClose = (() => { if (detail.quoteBasis?.kind !== 'completed-close' || !detail.quoteBasis.session) return null; const series = buildCloseSeries(root?._aioHistory || [], 'spx'); const at = series.findIndex((point) => point.date === detail.quoteBasis.session); return at > 0 ? (series[at].value / series[at - 1].value - 1) * 100 : null; })();
  const marketPct = finite(detailQuote(detail, 'SPY')?.pct ?? root?._liveData?.SPY?.pct ?? root?._liveData?.SPY?.changePercent ?? spxClose);
  const benchmarkSymbol = selfCompare ? (marketPct != null ? 'SPY' : null) : ownSymbol;
  const benchmarkPct = selfCompare ? marketPct : ownPct;
  if (selfCompare && benchmarkPct == null) {
    body.textContent = `이 테마의 수익률은 대표 ETF ${ownSymbol} 자체라 같은 ETF와는 비교하지 않습니다. 시장(SPY) 등락이 확인되면 시장 대비로 비교합니다.`;
  } else if (!benchmarkSymbol || themePct == null || benchmarkPct == null) {
    body.textContent = '시세 대기 — 테마와 벤치마크의 등락률이 확인되면 비교합니다.';
  } else {
    const diff = themePct - benchmarkPct;
    const direction = diff > 0.5 ? '상회' : diff < -0.5 ? '하회' : '유사';
    const context = direction === '상회' ? '당일은 시장보다 강했습니다.' : direction === '하회' ? '당일은 시장보다 약했습니다.' : '당일 시장과 비슷했습니다.';
    // v58.74 (text audit): one session is read as one session — "상대 모멘텀이 우세" claimed a trend from a day.
    body.textContent = `${selfCompare ? `${withTopicParticle(`${ownSymbol}(테마 대표 ETF)`)} 당일 시장(SPY)보다 ` : `${benchmarkSymbol} 대비 `}${signedText(diff, 2, '%p')}(테마 ${signedText(themePct, 2, '%')}, ${selfCompare ? '시장' : '벤치마크'} ${signedText(benchmarkPct, 2, '%')}) — ${context}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

// v58.75 (persona review): the five same-day panels (등락 구간, 종목 간 격차, 참여 폭, 서브테마 격차, 벤치마크) and the leader
// price cards read one session. They move, unchanged and with their ids, into one fold whose summary is the day in one line.
const DAY_HOSTS = Object.freeze(['theme-detail-native-leaders', 'theme-detail-native-temperature', 'theme-detail-native-spread', 'theme-detail-native-breadth-health', 'theme-detail-native-subtheme-gap', 'theme-detail-native-benchmark']);
export function themeDayLine(detail) {
  const pct = finite(detail?.pct);
  if (pct == null) return '당일 등락: 시세 대기';
  const priced = (detail.leaders || []).map((symbol) => ({ symbol, pct: detailQuote(detail, symbol)?.pct })).filter((row) => finite(row.pct) != null).sort((a, b) => b.pct - a.pct);
  // v59.45 R1-02: a member printed as 0.0% is not counted as rising — the count follows the printed sign (directionOf).
  const up = priced.filter((row) => directionOf(row.pct, 1) === 'up').length;
  const ends = priced.length >= 2 ? `, 최강 ${priced[0].symbol} ${signedText(priced[0].pct, 1)}%·최약 ${priced.at(-1).symbol} ${signedText(priced.at(-1).pct, 1)}%` : '';
  return `당일 ${signedText(pct, 1)}%${priced.length ? `, ${priced.length}종목 중 ${up}종목 상승(${Math.round(up / priced.length * 100)}%)` : ''}${ends}`;
}
function syncThemeDetailDayFold(documentRef, store) {
  const panel = documentRef?.getElementById('theme-detail-panel');
  const first = documentRef?.getElementById(DAY_HOSTS[0]);
  if (!panel || !first) return;
  let fold = documentRef.getElementById('theme-detail-day-fold');
  if (!fold) {
    fold = documentRef.createElement('details');
    fold.id = 'theme-detail-day-fold';
    fold.className = 'theme-detail-day-fold';
    fold.append(documentRef.createElement('summary'));
    first.insertAdjacentElement('beforebegin', fold);
  }
  for (const id of DAY_HOSTS) { const node = documentRef.getElementById(id); if (node && node.parentElement !== fold) fold.append(node); }
  const shown = DAY_HOSTS.some((id) => documentRef.getElementById(id)?.hidden === false);
  fold.hidden = !shown;
  const summary = fold.querySelector('summary');
  if (summary) summary.textContent = shown ? `${themeDayLine(selectSelectedThemeDetail(store?.getState?.() || {}))} (당일 상세)` : '당일 상세';
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
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body thp-detail-body--grid';
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
        heading: route === 'theme-detail' ? '테마 상세, AI 수요·운영·현금 전환' : '테마, AI 가치사슬·qualification·운영 검증'
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
        // replace the trigger the close handler just focused, dropping focus to <body>. Re-focus its replacement after render.
        let restoreDetailFocus = null;
        let stopCloseFollow = null; // one at a time; ends when focus moves on, on reopen, after 60s, or on unmount
        bag.add(() => stopCloseFollow?.());
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
          syncThemeDetailDayFold(documentRef, store); // v58.75
          renderThemeDetailTeach({ documentRef, root, store }); // v58.75 (persona review, A-3·4·6)
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
           renderThemeStrength({ documentRef, root, store }); // P1417
          // v59.44 (owner 2026-10-30): the AI supply chain by group opens 테마 as it does 오늘 (a lazy chunk).
          if (route === 'themes') import('../components/ai-chain-flow.js').then(({ paintThemesAiChain }) => paintThemesAiChain(documentRef, root)).catch(() => {});
           try { renderThemePlaybook({ documentRef, root, store }); renderThemeDetailPlaybook({ documentRef, root }); if (detailPanel?.style.display === 'block') renderThemeDetailTeach({ documentRef, root, store }); } catch (_) { /* the forward read never takes the themes route down */ } // P1743; v58.75 the teach block reads the playbook just built
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
        // v58.75 (persona review): the AI chat reads one theme's criteria, reasons, roles and scenarios through this global
        // ({ headline, items: [{ label, met, value, principle }], ... }). It stays after unmount — the store is the app's one.
        root._aioThemeCriteriaFor = (themeId) => { try { return themeCriteriaSummary(root, store, themeId); } catch (_) { return null; } };
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
          stopCloseFollow?.(); // a reopened detail ends the close-focus follow
          if (detailPanel) {
            detailPanel.style.display = 'block';
            if (event?.detail?.themeId) detailPanel.dataset.currentTheme = String(event.detail.themeId);
          }
          renderDetail(); // v57.61: detail renderers skip while closed, so the opening render happens here
          try { renderThemeDetailPlaybook({ documentRef, root }); renderThemeDetailTeach({ documentRef, root, store }); } catch (_) {} // P1743: needs the theme id set above
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
          // CPU throttling), so a short-lived observer on the page also retries.
          // 2026-10-19: it stopped after the first successful re-focus and after 10s, so a second replacing render (or
          // one after 10s under 4x CPU) still dropped focus to <body> (main CI, #62, #73). It now follows the focused
          // trigger: whenever that node is removed while focus sits on <body>, the current trigger for the same theme
          // takes focus. It stops once the reader moves focus elsewhere (a blur onto <body> while the trigger is still
          // mounted is the reader's own click), when a detail opens again, or after 60s.
          stopCloseFollow?.();
          let observer = null;
          let focused = documentRef.activeElement === trigger ? trigger : null;
          // A blur of a still-mounted trigger (checked after the event, since a removal may also report focusout) is
          // the reader leaving; a later replacing render must not pull focus back.
          const onFocusOut = (event) => {
            if (event.target !== focused) return;
            documentRef.defaultView?.queueMicrotask?.(() => { if (focused?.isConnected && documentRef.activeElement !== focused) stop(); });
          };
          const stop = () => { restoreDetailFocus = null; observer?.disconnect?.(); observer = null; stopCloseFollow = null; documentRef.removeEventListener?.('focusout', onFocusOut, true); };
          stopCloseFollow = stop;
          documentRef.addEventListener?.('focusout', onFocusOut, true);
          restoreDetailFocus = () => {
            if (Date.now() - closedAt > 60000) { stop(); return; }
            const active = documentRef.activeElement;
            // The panel's own close button keeps focus while hidden until something else takes it; that is not the reader moving on.
            if (active && active !== documentRef.body && !detailPanel?.contains?.(active)) {
              const id = active.dataset?.arg || active.dataset?.themeId;
              if (active === focused || (id && id === detailTriggerId && page?.contains?.(active))) { focused = active; return; }
              stop(); // focus moved to something else: the reader has gone on
              return;
            }
            if (focused && documentRef.contains(focused) && !detailPanel?.contains?.(active)) { stop(); return; } // the reader blurred a still-mounted trigger
            const next = currentDetailTrigger();
            if (!next) return;
            revealTrigger(next);
            next.setAttribute?.('aria-expanded', 'false');
            next.focus?.({ preventScroll: true });
            // v57.64: a replacement still hidden mid-render refuses focus; keep watching until focus actually lands.
            if (documentRef.activeElement === next) focused = next;
          };
          const Observer = documentRef.defaultView?.MutationObserver;
          if (Observer && page) { observer = new Observer(() => restoreDetailFocus?.()); observer.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'open', 'class'] }); }
          documentRef.defaultView?.setTimeout?.(() => { if (stopCloseFollow === stop) stop(); }, 60500);
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
          syncThemeDetailDayFold(documentRef, store);
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
        // v58.75 (persona review): every way into the Korean theme detail (artifact rows, legacy cards, other screens via
        // openKrThemeDetail) goes through window.showKrThemeDetail; while 테마 is mounted it also fills the completed-close
        // member table and keeps the (otherwise hidden) live fold visible around the open panel.
        const originalShowKr = typeof root?.showKrThemeDetail === 'function' && !root.showKrThemeDetail.__aioCloseDetail ? root.showKrThemeDetail : null;
        if (originalShowKr) {
          const wrappedShowKr = function showKrThemeDetailWithClose(themeId, ...rest) {
            const liveFold = documentRef.getElementById('kr-themes-live');
            if (liveFold) liveFold.hidden = false;
            const out = originalShowKr.call(this, themeId, ...rest);
            try { renderKrCloseDetail({ documentRef, root, store, themeId }); } catch (_) { /* the close table never blocks the live detail */ }
            return out;
          };
          wrappedShowKr.__aioCloseDetail = true;
          root.showKrThemeDetail = wrappedShowKr;
          bag.add(() => { if (root.showKrThemeDetail === wrappedShowKr) root.showKrThemeDetail = originalShowKr; });
        }
        const krPanel = krDetailPanelOf(documentRef);
        const PanelObserver = documentRef.defaultView?.MutationObserver;
        if (krPanel && typeof PanelObserver === 'function') {
          const panelObserver = new PanelObserver(() => syncKrLiveBlocks(documentRef, root));
          panelObserver.observe(krPanel, { attributes: true, attributeFilter: ['style'] });
          bag.add(() => panelObserver.disconnect());
        }
        const pendingKrThemeId = String(root?._aioOpenKrThemeDetailOnThemes || '').trim();
        if (pendingKrThemeId) {
          delete root._aioOpenKrThemeDetailOnThemes;
          // After this mount's own renders (they reset the Korean theme fold), so the opened detail stays open.
          const openTimer = root?.setTimeout?.(() => root.openKrThemeDetail?.(pendingKrThemeId, { settle: true }), 0);
          bag.add(() => root?.clearTimeout?.(openTimer));
        }
        const deepLink = themeDetailDeepLink(root?.location?.hash);
        const deepLinkId = String(deepLink?.themeId || '').trim();
        if (deepLinkId) queueMicrotask(() => requestThemeDetail(deepLinkId));
        if (deepLink?.requested && !store?.getState?.()?.themes?.selectedDetail && detailPanel) {
          deepLinkHint = documentRef.createElement('p');
          deepLinkHint.className = 'theme-detail-deep-link-hint';
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
