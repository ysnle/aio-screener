// Theme screens: the RRG (relative rotation) view, its status and trail tabs, and the verdict view sync.
import { chartPalette } from '../../components/color-theme.js';
import { selectThemesItems } from '../../../state/selectors/themes.js';
import { selectProducedRotation } from '../../../domain/themes/produced-rotation.js';
import { rrgAxisDomain, rrgQuadrantOf, RRG_BORDER_LABEL, RRG_BORDER_WORD, RRG_DEFINITION, RRG_QUADRANT_READS, RRG_QUADRANT_WORDS } from '../../../domain/themes/rrg.js';
import { sessionChipText } from '../../components/session-lag.js';
import { rrgRecentReading, RRG_NEUTRAL_BAND } from '../../../domain/themes/recent-check.js';
import { finiteNumber as finite } from '../../../domain/shared/number.js';
import { setAsOf } from '../../components/section-frame.js';
import { isoDay, stampDay } from '../../../domain/shared/session-date.js';
import { NEAR_HIGH_TAB } from './sectors.js';

// v57.76: plain-Korean quadrant notes (no 모멘텀 jargon). 100 is the sector's own 100-session average relative price.
// v57.81 (audit): the notes name both windows and no longer say "계속 강해지는 중 / 나아지는 중" — the vertical axis
// compares with about 50 sessions ago, so a sector can sit in 선도 while its last week fell hard (the chip then says so).
// A point within the neutral band around 100 on either axis is 경계 and stays out of the four verdicts.
export const QUADRANTS = Object.freeze([
  ...['Leading', 'Improving', 'Weakening', 'Lagging'].map((key) => ({ key, label: RRG_QUADRANT_WORDS[key], note: RRG_QUADRANT_READS[key] })),
  // v57.84 (owner decision 3-3): the band is each sector's own typical 5-session move on that axis, with hysteresis.
  { key: 'Border', label: RRG_BORDER_LABEL, note: `두 축 중 하나가 100에 그 섹터의 평소 5거래일 움직임만큼 가까워 사분면을 정하지 않음(움직임 기록이 없으면 ±${RRG_NEUTRAL_BAND}). 한 번 정한 사분면은 반대쪽으로 그 폭의 절반을 넘어야 바뀜. 속이 빈 점은 놓인 구역과 판정이 다른 섹터로, 이름 옆에 판정을 적음`, optional: true }
]);

// v59.70: the screen reads the previous session's artifact (flagged lagging) until the refresh lands, never session ticks.
export const RRG_LAG = Object.freeze({ lagSessions: 1 });
// v57.81: the banded zone and the five-session relative-strength check of one item, from the session-checked artifact row.
export function readingOf(root, item) {
  const symbol = String(item?.symbol || item?.id || '');
  const produced = symbol ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, symbol, Date.now(), RRG_LAG) : null;
  // v57.84: the produced 20-session trail sizes the band and carries hysteresis (recent-check.js rrgZone).
  return rrgRecentReading({ ...item, trail: produced?.trail || item?.trail || null }, produced?.relativeStrength || null);
}
export function zoneKey(root, item) {
  const reading = readingOf(root, item);
  return reading?.border ? 'Border' : String(reading?.quadrant || item?.quadrant || '');
}


export function activeView(root) {
  const value = String(root?._rrgViewMode || 'sectors');
  return value === 'subsectors' || value === 'all' ? value : 'sectors';
}

export function viewItems(items, view) {
  if (view === 'all') return items;
  return items.filter((item) => String(item?.view || 'sectors') === view);
}

export function shortSession(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

export function usCloseSession(root) {
  const basis = String(root?._serverDataMeta?.rotationHistory?.latestCompletedSession || '');
  return isoDay(basis) || '';
}


export function krCloseSession(rows = []) {
  const dates = (rows || [])
    .filter((row) => /^\d{6}\.(KS|KQ)$/i.test(String(row?.sym || row?.symbol || '')))
    .map((row) => stampDay(row?.observedAt))
    .filter(Boolean)
    .sort();
  return dates.length ? dates[dates.length - 1] : '';
}

export function renderRRGStatus({ documentRef, root, store, route }) {
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
  status.textContent = `선도 ${counts.Leading}, 개선 ${counts.Improving}, 약화 ${counts.Weakening}, 후행 ${counts.Lagging}${counts.Border ? `, ${RRG_BORDER_LABEL} ${counts.Border}` : ''}`;
  status.title = `${rrgTrailLength(root) ? `꼬리 = 최근 ${rrgTrailLength(root)}거래일 경로(작은 점이 시작), 화살표 = 오늘 위치. ` : ''}속이 빈 점 = 놓인 구역과 판정이 다른 섹터(이름 옆에 판정)`;
  writeSectorCardChip(documentRef, root);
  status.style.color = 'var(--text-dim)';
}

// The card's one date chip follows what the card shows: the 고점 근처 bars read the screener's session; the period bars
// and the scatter read the rotation artifact's.
export function writeSectorCardChip(documentRef, root) {
  const head = documentRef?.querySelector?.('#page-themes .v2-themes-rrg > .aio-frame-head');
  const bars = documentRef?.getElementById?.('sector-perf-bars');
  const nearSession = bars?.dataset.metric === NEAR_HIGH_TAB[0] && root?._aioThemesVerdictView !== 'rrg' ? bars.dataset.session : '';
  if (nearSession) { setAsOf(documentRef, head, `${shortSession(nearSession)} 종가`, `S&P 500 구성 종목의 52주 종가 고점 기록, ${shortSession(nearSession)} 미국 종가`); return; }
  const close = usCloseSession(root);
  setAsOf(documentRef, head, sessionChipText(close) || '완료 종가', `약 50일 상대강도, ${close ? `${sessionChipText(close)}, 미국` : '완료 종가 기준'}`);
}

export const RRG_TRAILS = Object.freeze([['short', '짧게', 5], ['long', '길게', 10], ['off', '끔', 0]]);
// v58.78 (owner 2026-10-25, "RRG 차트 난리"): daily tails crossed each other in the leading cluster and widened the axes, so
// the chart opens on today's positions only; a tail is the reader's choice.
export const RRG_TRAIL_DEFAULT = 'off';
export const rrgTrailOf = (root) => RRG_TRAILS.find(([key]) => key === (root?._aioRrgTrail || RRG_TRAIL_DEFAULT)) || RRG_TRAILS[2];
export function rrgTrailLength(root) {
  return rrgTrailOf(root)[2];
}
// The tail-length control sits above the chart (built once; its pressed state follows the reader's choice).
export function ensureRrgTrailTabs(documentRef, root, store, route) {
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

export function renderRRGCanvas({ documentRef, root, store, route }) {
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
      const produced = symbol ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, symbol, Date.now(), RRG_LAG) : null;
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
  if (note) note.textContent = `${RRG_DEFINITION.ratio}. ${RRG_DEFINITION.momentum}. ${RRG_DEFINITION.benchmarkBias}`;
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
  const rawQuadrant = (item) => rrgQuadrantOf(item.rsRatio, item.rsMomentum);
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
    const word = dot.held ? (dot.zone === 'Border' ? RRG_BORDER_WORD : RRG_QUADRANT_WORDS[dot.zone] || '') : '';
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

// v59.51 (content audit): the quadrant-count pill in the page head (renderThemeCyclePill) is retired — the status line
// above the scatter (renderRRGStatus) prints the same counts for the same view.

// v59.51: the verdict card shows the scatter or the sector period bars; the choice is kept for the session.
export function syncVerdictView(documentRef, root) {
  const card = documentRef?.querySelector?.('#themes-verdict .v2-themes-rrg');
  if (!card) return;
  // v59.70 (theme-sector): the period bars are the default view (which sector led the day or week); the scatter is second.
  const view = root?._aioThemesVerdictView === 'rrg' ? 'rrg' : 'bars';
  card.dataset.view = view;
  documentRef.querySelectorAll('#themes-verdict-tabs [data-view]').forEach((button) => {
    const on = button.dataset.view === view;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
  });
  writeSectorCardChip(documentRef, root);
}
