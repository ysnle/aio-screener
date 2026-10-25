// v58.75 (persona review): the 테마 시나리오 view (stage × theme table, cards, detail read, strength map and the teach
// helpers) moved out of theme-playbook.js so only themes.js — a lazy route — loads it; the boot set keeps
// themePlaybookForRoot alone (ai-answer-visuals.js reads it at boot).
// P1743 (owner 2026-10-13): "테마 시나리오" on 테마 — every US and KR theme read by one rule (src/domain/scenarios/
// theme-playbook.js), so a sector rally, a pullback inside a long uptrend or a bottleneck theme is never a hand-written
// note. One visual (the momentum map: 6-month trend × 1-month move, coloured by the macro wind), a short reading (where
// strength moved and which combinations stand out), then folded per-stage cards with each theme's choices, opportunity
// cost, evidence lines, structural hypothesis and what would break it. Stock selection stays on 테마 상세 and 스크리너.
import { THEME_STATES } from '../../domain/scenarios/analogs.js';
import { relativeBand, rrgRecentReading } from '../../domain/themes/recent-check.js';
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { RRG_QUADRANT_WORDS, RRG_RATIO_SESSIONS, RRG_MOMENTUM_LAG } from '../../domain/themes/rrg.js';
import { WIND_LABELS } from '../../domain/scenarios/exposures.js';
import { CHOICES } from '../../domain/market/macro-crossroads.js';
import { stageChoiceText, LEAD_CONFIRM_MET, ABOVE50_FLOOR } from '../../domain/scenarios/theme-playbook.js';

const CREDIT_CONDITION = '신용 안정';
const CHOICE_TEXT_OF = (state) => stageChoiceText(state);
function stageChoiceTable(doc, stage, list) {
  const wrap = el(doc, 'div', null, 'tp-stage-choices');
  const texts = Object.entries(CHOICE_TEXT_OF(stage));
  if (!texts.length) return wrap;
  wrap.append(el(doc, 'h4', '이 단계의 대응별 득실', 'xr-h4'));
  const table = el(doc, 'div', null, 'xr-choices');
  for (const [key, text] of texts) {
    const line = el(doc, 'div', null, 'xr-choice');
    const favored = list.filter((row) => row.favored.includes(key)).length;
    if (favored) line.dataset.favored = 'true';
    line.append(el(doc, 'span', CHOICES[key], 'xr-choice-name'), el(doc, 'span', text, 'xr-choice-text'));
    if (favored) line.append(el(doc, 'span', favored === list.length ? '비용이 작은 쪽' : `비용이 작은 쪽, ${favored}개 테마`, 'xr-choice-flag'));
    table.append(line);
  }
  wrap.append(table);
  return wrap;
}
import { MACRO_HISTORY, SCENARIO_STATE, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { refreshScenarioArtifacts } from './macro-crossroads.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { themePlaybookForRoot } from './theme-playbook.js';
import { setResearchHandoff } from '../../app/research-handoff.js';
import { el } from './dom.js';
import { closeChipText, frameHead, markFrame, setAsOf } from './section-frame.js';
import { openThemeDetail } from '../navigation/theme-detail.js';
import { NOTE_TITLES, researchForTheme } from '../../domain/knowledge/theme-research-links.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { signedText } from '../../domain/shared/number.js';
import { themeCriteria, memberRoles, roleExamples, themeScenarioSplit } from '../../domain/scenarios/theme-criteria.js';
import { CONSENSUS_KEY, requestConsensusEstimates } from '../../data/consensus-estimates.js';

const SVG = 'http://www.w3.org/2000/svg';
const pct = (value) => (value == null ? '—' : `${signedText(value, 1)}%`);
const mkt = (row) => (row.market === 'KR' ? '한국' : '미국'); // v57.54: '국내' read as ambiguous on a US-first screen
function svg(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}


// Two drawings of the same map: the wide one (640 × 360) and a narrow one (320 × 300, fewer labels) shown when the
// section is under 600px wide (container query in regime-quality.css), so labels never render below 12px.
// v57.79: `labels` is the most labels a drawing carries (farthest from the centre first); the rest stay on hover/tap.
const MAP_SIZES = Object.freeze({ wide: { W: 640, H: 360, pad: 40, font: 13, labels: 12 }, narrow: { W: 320, H: 300, pad: 30, font: 13.5, labels: 6 } });
// v58.78 (owner 2026-10-25, "못 보는 수준"): one or two extreme themes (크립토 -44%) set a symmetric scale that squeezed the
// other forty into a flat band. The axis now spans the 85th-percentile distance (x1.4, at least 5%p); a theme beyond it is
// pinned at the edge as a hollow marker whose label carries its real value.
export function robustSpan(values) {
  const abs = values.filter(Number.isFinite).map((value) => Math.abs(value)).sort((a, b) => a - b);
  if (!abs.length) return 5;
  const q = abs[Math.floor((abs.length - 1) * 0.85)];
  return Math.max(5, Math.min(abs.at(-1) * 1.1, q * 1.4));
}
const shortLabel = (label) => { const head = String(label || '').split('/')[0].trim(); return head.length > 9 ? `${head.slice(0, 8)}…` : head; };
// Rough rendered width: Hangul is about one em, Latin, digits and spaces about 0.6 em.
const isHangul = (ch) => { const c = ch.codePointAt(0); return (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3131 && c <= 0x318e) || (c >= 0xac00 && c <= 0xd7a3); };
const textWidth = (text, font) => [...text].reduce((sum, ch) => sum + (isHangul(ch) ? font : font * 0.62), 0);

// v57.81: the map plots what the stage is read from — the gap to the index over the same window when it is known.
const mapX = (row) => row.relative?.trend ?? row.ret6m ?? row.ret3m;
const mapY = (row) => row.relative?.recent ?? row.ret1m;

/** Momentum map: x = long trend (6-month, KR 3-month), y = 1-month, both against the index; colour = wind under the lead branch. */
function momentumMap(doc, themes, size = 'wide', onPick = null) {
  const { W, H, pad, font, labels: maxLabels } = MAP_SIZES[size];
  const points = themes.filter((row) => mapY(row) != null && mapX(row) != null);
  const xs = points.map(mapX), ys = points.map(mapY);
  const sx = robustSpan(xs), sy = robustSpan(ys);
  const clip = (value, span) => Math.max(-span * 0.97, Math.min(span * 0.97, value));
  const X = (value) => pad + (clip(value, sx) + sx) / (2 * sx) * (W - 2 * pad), Y = (value) => H - pad - (clip(value, sy) + sy) / (2 * sy) * (H - 2 * pad);
  const market = points[0]?.market === 'KR' ? 'KR' : 'US';
  const box = svg(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: `tp-map is-${size}`, role: 'img', 'aria-label': `${market === 'KR' ? '한국' : '미국'} 테마 ${points.length}개의 긴 추세와 최근 1개월 움직임 지도` });
  box.append(svg(doc, 'line', { x1: X(0), x2: X(0), y1: pad / 2, y2: H - pad / 2, class: 'tp-axis' }), svg(doc, 'line', { x1: pad / 2, x2: W - pad / 2, y1: Y(0), y2: Y(0), class: 'tp-axis' }));
  const corner = (text, x, y, anchor) => { const t = svg(doc, 'text', { x, y, 'text-anchor': anchor, class: 'tp-quad' }); t.textContent = text; box.append(t); };
  corner('주도 지속', W - pad / 2, pad / 2 + 4, 'end'); corner('추세 속 조정', W - pad / 2, H - pad / 2 - 2, 'end');
  corner('반등 시도', pad / 2, pad / 2 + 4, 'start'); corner('약세 지속', pad / 2, H - pad / 2 - 2, 'start');
  const axisLabel = svg(doc, 'text', { x: W / 2, y: H - 4, 'text-anchor': 'middle', class: 'tp-axis-label' }); axisLabel.textContent = `긴 추세${points.some((row) => row.relative) ? ', 지수 대비' : ''} (${market === 'KR' ? '3개월' : '6개월'}) →`; box.append(axisLabel);
  const yLabel = svg(doc, 'text', { x: 12, y: H / 2, 'text-anchor': 'middle', class: 'tp-axis-label', transform: `rotate(-90 12 ${H / 2})` }); yLabel.textContent = points.some((row) => row.relative) ? '1개월, 지수 대비 →' : '최근 1개월 →'; box.append(yLabel);
  // v57.79 (375 review): labels covered markers and each other. Only the themes farthest from the centre are labelled
  // (both axes scaled to the drawing), a label never sits on any marker, another label, a quadrant caption or an axis
  // title, and every point keeps its hover title; a tap prints the same line under the map.
  const marks = [];
  const describe = (row) => `[${mkt(row)}] ${row.label}: ${row.stateLabel.split(' (')[0]}, 1개월 ${pct(row.ret1m)}, 긴 추세 ${pct(row.ret6m ?? row.ret3m)}${row.relative ? ` (${row.relative.name} 대비 ${pct(row.relative.recent)}p, ${pct(row.relative.trend)}p)` : ''}${row.ret5d != null ? `, 5거래일 ${pct(row.ret5d)}` : ''}, ${WIND_LABELS[row.wind.lead]}`;
  const located = points.map((row) => {
    const x = X(mapX(row)), y = Y(mapY(row));
    const clipped = Math.abs(mapX(row)) > sx * 0.97 || Math.abs(mapY(row)) > sy * 0.97;
    const mark = svg(doc, 'circle', { cx: x, cy: y, r: 6, class: `tp-dot is-${row.wind.lead}${clipped ? ' is-clipped' : ''}` });
    const title = svg(doc, 'title'); title.textContent = describe(row);
    mark.append(title); box.append(mark);
    if (onPick) mark.addEventListener('click', () => onPick(describe(row)));
    marks.push({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 });
    // Pinned themes are labelled first (a large finite lead keeps the sort comparator a number).
    return { row, x, y, clipped, distance: (clipped ? 1e6 : 0) + Math.hypot(mapX(row) / sx, mapY(row) / sy) };
  });
  const unit = (row) => (row.relative ? 'p' : '');
  const pinned = (row) => (Math.abs(mapX(row)) > sx * 0.97 ? `${shortLabel(row.label)} 긴 추세 ${pct(mapX(row))}${unit(row)}` : `${shortLabel(row.label)} 1개월 ${pct(mapY(row))}${unit(row)}`);
  const wanted = located.sort((a, b) => b.distance - a.distance).map(({ row, x, y, clipped }) => ({ x, y, text: clipped ? pinned(row) : shortLabel(row.label) }));
  const placed = [
    { x0: W - pad / 2 - font * 7, x1: W, y0: 0, y1: pad / 2 + 8 }, { x0: W - pad / 2 - font * 8.5, x1: W, y0: H - pad / 2 - font - 4, y1: H },
    { x0: 0, x1: pad / 2 + font * 7, y0: 0, y1: pad / 2 + 8 }, { x0: 0, x1: pad / 2 + font * 7, y0: H - pad / 2 - font - 4, y1: H },
    { x0: W / 2 - font * 9, x1: W / 2 + font * 9, y0: H - font - 6, y1: H }, { x0: 0, x1: 20, y0: H / 2 - font * 4, y1: H / 2 + font * 4 }
  ];
  const hits = (a) => placed.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) || marks.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
  let count = 0;
  for (const label of wanted) {
    if (count >= maxLabels) break;
    const w = textWidth(label.text, font) + 4, h = font + 5;
    // Next to the marker first; then farther out with a thin leader line back to it.
    const near = [[label.x + 8, label.y + 4, 'start'], [label.x - 8, label.y + 4, 'end'], [label.x, label.y - 10, 'middle'], [label.x, label.y + 18, 'middle']];
    const far = [[label.x + 10, label.y - 14, 'start'], [label.x + 10, label.y + 20, 'start'], [label.x + 22, label.y - 12, 'start'], [label.x - 22, label.y - 12, 'end'], [label.x + 22, label.y + 20, 'start'], [label.x - 22, label.y + 20, 'end'], [label.x, label.y - 26, 'middle'], [label.x, label.y + 34, 'middle'], [label.x + 34, label.y - 30, 'start'], [label.x + 34, label.y + 36, 'start'], [label.x - 34, label.y - 30, 'end'], [label.x - 34, label.y + 36, 'end']];
    for (const [tx, ty, anchor, leader] of [...near, ...far.map((option) => [...option, true])]) {
      const x0 = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2;
      const rect = { x0, x1: x0 + w, y0: ty - h + 3, y1: ty + 3 };
      if (rect.x0 < 0 || rect.x1 > W || rect.y0 < 0 || rect.y1 > H || hits(rect)) continue;
      placed.push(rect);
      count += 1;
      if (leader) box.append(svg(doc, 'line', { x1: label.x, y1: label.y, x2: Math.min(Math.max(label.x, rect.x0), rect.x1), y2: Math.min(Math.max(label.y, rect.y0), rect.y1), class: 'tp-leader' }));
      const t = svg(doc, 'text', { x: tx, y: ty, 'text-anchor': anchor, class: 'tp-label' }); t.textContent = label.text; box.append(t);
      break;
    }
  }
  return box;
}

function legend(doc) {
  const row = el(doc, 'div', null, 'tp-legend');
  for (const key of ['tail', 'head', 'mixed', 'none']) { const item = el(doc, 'span', null, 'tp-legend-item'); item.append(el(doc, 'span', null, `tp-swatch is-${key}`), doc.createTextNode(WIND_LABELS[key])); row.append(item); }
  // v58.79 (layout over captions): the hollow circle is a legend key of its own, not a sentence; the scenario basis is
  // the legend's hover.
  const clipped = el(doc, 'span', null, 'tp-legend-item');
  clipped.append(el(doc, 'span', null, 'tp-swatch is-clipped'), doc.createTextNode('축 범위 밖'));
  clipped.title = '속이 빈 원은 축 범위 밖, 이름 옆이 실제 값';
  row.append(clipped);
  row.title = '색은 중심 시나리오 기준의 거시 영향';
  return row;
}

// The sector most of a theme's priced members belong to (at least half of them), for the screener handoff. KR members
// also carry one member ticker so the screener opens its Korean listing (screener.js reads a KRX ticker as KR).
function screenerSectorFor(root, store) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const bySymbol = new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  return (theme) => {
    const symbols = theme.market === 'KR'
      ? (root?.KR_THEME_MAP?.[theme.id] || []).flatMap((member) => [`${member?.code}.KS`, `${member?.code}.KQ`])
      : (root?.THEME_MAP || []).find((item) => item.id === theme.id)?.subThemes?.flatMap((sub) => sub?.tickers || []) || [];
    const members = [...new Set(symbols.map((sym) => String(sym).toUpperCase()))].map((sym) => bySymbol.get(sym)).filter((row) => row?.sector);
    if (members.length < 3) return null;
    const counts = new Map();
    for (const row of members) counts.set(row.sector, (counts.get(row.sector) || 0) + 1);
    const [sector, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (count * 2 < members.length) return null;
    return theme.market === 'KR' ? { sector, ticker: String(members.find((row) => row.sector === sector).sym) } : { sector };
  };
}

// v58.75 (persona review, teach-and-check A-4~6): the members of a theme with their published screener rows, and the
// six criteria, member roles and conditional scenarios read from them (src/domain/scenarios/theme-criteria.js). The
// consensus and earnings-calendar artifacts load on the themes route only, after its first paint.
export const EARNINGS_CALENDAR = Object.freeze({ key: '_aioEarningsCalendarArtifact', url: './public-data/earnings-calendar.json', schemas: ['earnings-calendar.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 512 * 1024 });
export function themeMembersFor(root, store, market, themeId) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const bySymbol = root?.__aioRowsBySym?.rows === rows ? root.__aioRowsBySym.map : new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  if (root) root.__aioRowsBySym = { rows, map: bySymbol };
  if (market === 'KR') {
    return (root?.KR_THEME_MAP?.[themeId] || []).map((member) => {
      const code = String(member?.code || '');
      const row = bySymbol.get(`${code}.KS`) || bySymbol.get(`${code}.KQ`) || null;
      return { sym: row ? String(row.sym).toUpperCase() : `${code}.KS`, label: root?.KR_STOCK_DB?.[code]?.name || row?.name || code, row };
    });
  }
  const theme = (root?.THEME_MAP || []).find((item) => item?.id === themeId);
  const symbols = [...new Set([...(theme?.subThemes || []).flatMap((sub) => sub?.tickers || []), ...(theme?.leaders || [])].map((sym) => String(sym).toUpperCase()))];
  return symbols.map((sym) => ({ sym, label: sym, row: bySymbol.get(sym) || null }));
}
export function themeTeachFor({ root, store, market = 'US', themeId, playbook = root?.__aioThemePlaybook, interpretation = null } = {}) {
  const row = playbook?.themes?.find((item) => item.market === market && item.id === themeId) || null;
  if (!row) return null;
  let mi = interpretation;
  if (!mi) { try { mi = marketInterpretation(root, { store }); } catch (_) { mi = {}; } }
  const crossroads = mi?.crossroads || null;
  const members = themeMembersFor(root, store, market, themeId);
  const measured = members.filter((member) => member.row);
  const benchmark = playbook?.benchmarks?.[market] || null;
  const consensus = root?.[CONSENSUS_KEY] || null, calendar = market === 'US' ? root?.[EARNINGS_CALENDAR.key] || null : null;
  const after = benchmark?.asOf || null;
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId) || null;
  const criteria = themeCriteria({ row, members: measured, benchmark, consensus, calendar, regime: mi?.regime || null, lead, after });
  const roles = memberRoles(measured, { consensus, calendar, after });
  return { row, members, measured, criteria, roles, examples: roleExamples(measured, roles.roles), split: themeScenarioSplit(row.tags || [], crossroads), crossroads, regime: mi?.regime || null, lead, consensus, calendar, after };
}
/** 조건부 시나리오: the crossroads branches under which this theme's exposure turns favourable or burdensome. */
export function scenarioSplitText(split) {
  if (!split || (!split.favorable.length && !split.unfavorable.length)) return '';
  return `조건부 시나리오: ${split.favorable.length ? `유리해지는 경우 — ${split.favorable.join(', ')}` : '뚜렷하게 유리해지는 시나리오 없음'}; ${split.unfavorable.length ? `불리해지는 경우 — ${split.unfavorable.join(', ')}` : '뚜렷하게 불리해지는 시나리오 없음'}.`;
}
function loadTeachArtifacts(root, repaint) {
  const view = root?.setTimeout ? root : globalThis;
  view.setTimeout(() => {
    requestConsensusEstimates(root, repaint);
    refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) repaint(); }).catch(() => {});
  }, 1500);
}

// v58.75 (persona review): the last ten recorded sessions of a theme's stage (scenario-state.json themeHistory), the live
// stage standing in for its own close date. A day without a record stays an empty cell, never a guessed stage.
const stageName = (state) => (THEME_STATES[state] ? THEME_STATES[state].split(' (')[0] : '판정 보류');
const STRIP_DAYS = 10;
// v58.79 (owner 2026-10-25): the record before 10/12 is recomputed from closes (theme-stage-history.json), so the run is
// counted over the whole record and the 1-month line spans about three months; the "최근 바뀜" window stays short.
export const RUN_DAYS = 120;
export const SPARK_DAYS = 60;
export function stageHistoryOf(history, row, limit = STRIP_DAYS) {
  const key = `${row.market}:${row.id}`;
  const days = (Array.isArray(history) ? history : []).filter((day) => day?.date && (!row.basis || day.date < row.basis))
    .map((day) => ({ date: day.date, state: Array.isArray(day.themes?.[key]) ? day.themes[key][1] ?? null : undefined, ret1m: Array.isArray(day.themes?.[key]) ? day.themes[key][0] : null, recomputed: day.recomputed === true }));
  if (row.basis) days.push({ date: row.basis, state: row.state ?? null, ret1m: row.ret1m, live: true });
  return days.slice(-limit);
}
/** Hover note when part of the run was recomputed rather than recorded. */
export function recomputedNote(days) {
  const first = (Array.isArray(days) ? days : []).find((day) => !day.recomputed && !day.live && day.state !== undefined);
  return days.some((day) => day.recomputed) ? `${first ? `${first.date.slice(5).replace('-', '/')} 이전` : '이 기간'}은 지금 규칙으로 종가에서 소급 계산한 단계입니다(신용·중심 시나리오 조건은 그날 값으로 다시 보지 않음).` : '';
}
/** The most recent session before the latest whose stage differs (within the strip), or null. */
export function recentStageChange(days) {
  const known = days.filter((day) => day.state !== undefined);
  const now = known.at(-1);
  if (!now) return null;
  for (let i = known.length - 2; i >= Math.max(0, known.length - 4); i -= 1) if (known[i].state !== now.state) return { from: known[i].state, date: known[i].date, to: now.state, latest: i === known.length - 2 };
  return null;
}
/** v58.78: the current stage, how many recorded sessions it has held, and the stage before it (within the strip). */
export function stageRun(days) {
  const known = (Array.isArray(days) ? days : []).filter((day) => day.state !== undefined);
  const now = known.at(-1);
  if (!now) return null;
  let sessions = 0, from = null;
  for (let i = known.length - 1; i >= 0; i -= 1) { if (known[i].state === now.state) sessions += 1; else { from = { state: known[i].state, date: known[i].date }; break; } }
  return { state: now.state, sessions, from, atLeast: !from };
}
// v58.78 (owner 2026-10-25, "10거래일 단계는 왜 저렇게"): seven stage colours in ten 9px cells could not be read. The cell
// says the run in words and a small line draws the theme's 1-month return over the same sessions.
function stageFlowCell(doc, days, change) {
  const cell = el(doc, 'td', null, 'tp-row-flow');
  const run = stageRun(days);
  if (!run) { cell.textContent = '기록 없음'; return cell; }
  const text = run.from ? `${run.sessions}거래일째, '${stageName(run.from.state)}'에서` : `${run.sessions}거래일 이상 유지`;
  cell.append(el(doc, 'span', text, 'tp-flow-text'));
  const note = recomputedNote(days);
  if (note) cell.title = note;
  if (change) cell.append(el(doc, 'span', '최근 바뀜', 'tp-flow-chip'));
  return cell;
}
function returnSpark(doc, days) {
  const cell = el(doc, 'td', null, 'tp-row-spark');
  const points = days.map((day, index) => [index, day.ret1m]).filter(([, value]) => Number.isFinite(value));
  if (points.length < 2) { cell.textContent = '—'; return cell; }
  const W = 84, H = 24, values = points.map(([, value]) => value);
  const min = Math.min(...values, 0), max = Math.max(...values, 0), span = max - min || 1;
  const x = (index) => 2 + index / Math.max(1, days.length - 1) * (W - 4), y = (value) => 2 + (1 - (value - min) / span) * (H - 4);
  const first = values[0], last = values.at(-1);
  const box = svg(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: 'tp-spark', 'aria-hidden': 'true', focusable: 'false' });
  box.append(svg(doc, 'line', { x1: 0, x2: W, y1: y(0), y2: y(0), class: 'tp-spark-zero' }));
  box.append(svg(doc, 'polyline', { points: points.map(([index, value]) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' '), class: `tp-spark-line ${last >= first ? 'is-up' : 'is-down'}` }));
  cell.append(box, el(doc, 'span', `${pct(first)} → ${pct(last)}`, 'tp-spark-text'));
  cell.title = `최근 ${days.length}거래일의 1개월 수익률: ${pct(first)}에서 ${pct(last)}`;
  return cell;
}
const shortMd = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

// v58.75 (persona review): RRG (ETF ÷ SPY, about 50 sessions) and the stage (member median over 6 months / 1 month against
// the equal-weight S&P 500) answer different questions. Where they point opposite ways the screen says why, as a fact.
const RRG_UP = new Set(['leading', 'fading']);
function rrgZoneOf(root, themeId) {
  const etf = (root?.THEME_MAP || []).find((theme) => theme?.id === themeId)?.etf || null;
  if (!etf) return null;
  const produced = selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now());
  const reading = produced ? rrgRecentReading(produced, produced.relativeStrength || null) : null;
  return reading ? { etf, zone: reading.border ? 'Border' : reading.quadrant } : null;
}
function rrgStageConflict(root, row) {
  if (row.market !== 'US' || !row.state) return null;
  const rrg = rrgZoneOf(root, row.id);
  if (!rrg || rrg.zone === 'Border') return null;
  const conflict = (rrg.zone === 'Leading' && !RRG_UP.has(row.state)) || ((rrg.zone === 'Lagging' || rrg.zone === 'Weakening') && RRG_UP.has(row.state));
  return conflict ? { ...rrg, word: RRG_QUADRANT_WORDS[rrg.zone], stage: stageName(row.state) } : null;
}
const rrgBasisText = (benchName = 'S&P 500 동일가중') => `기준이 달라 다를 수 있습니다: RRG는 대표 ETF의 SPY 대비 상대가격을 최근 ${RRG_RATIO_SESSIONS}거래일 평균·${RRG_MOMENTUM_LAG}거래일 전과 비교하고, 단계는 구성 종목 수익률 중앙값의 6개월·1개월(한국 3개월·1개월)을 같은 기간 ${benchName}(한국 코스피)와 비교합니다`;

// v58.75 (persona review): the card body opens under its table row. What every theme in a stage shares (definition, the
// four choices) is printed once in the stage header; the card keeps only what is this theme's own.
function themeCard(doc, root, row, screenerSector = null, { change = null, teach = null } = {}) {
  const card = el(doc, 'div', null, 'tp-card');
  card.dataset.theme = `${row.market}:${row.id}`;
  // v58.79 (layout over captions): the row above already shows the stage, 1주, 1개월 and the long trend; the card's first
  // line keeps what the row lacks (3개월, the theme's character) and the full stage sentence is its hover.
  const facts = el(doc, 'p', [row.ret3m != null ? `3개월 ${pct(row.ret3m)}` : null, row.tagLabels.length ? `성격: ${row.tagLabels.join(', ')}` : null].filter(Boolean).join(', ') || row.stateLabel, 'xr-basis');
  facts.title = [row.stateLabel, row.ret5d != null ? `5거래일 ${pct(row.ret5d)}` : null, row.ret6m != null ? `6개월 ${pct(row.ret6m)}` : null].filter(Boolean).join(', ');
  card.append(facts);
  if (change) card.append(el(doc, 'p', `최근 단계 변화: ${shortMd(change.date)} '${stageName(change.from)}' → 지금 '${stageName(change.to)}'.`, 'xr-reading'));
  const conflict = rrgStageConflict(root, row);
  // v58.79: one short fact; why the two measures can differ is the line's hover (and the table's RRG fold).
  if (conflict) { const line = el(doc, 'p', `RRG ${conflict.etf} '${conflict.word}', 단계 '${conflict.stage}'`, 'xr-reading tp-rrg-fact'); line.title = rrgBasisText(row.relative?.name); card.append(line); }
  if (row.heavyweightNote) card.append(el(doc, 'p', row.heavyweightNote, 'xr-reading'));
  card.append(el(doc, 'p', `거시 영향: ${row.windText}.`, 'xr-reading'));
  // v58.75 (persona review, A-4·6): the expert-criteria count and the branches that would turn the wind either way.
  if (teach?.criteria) card.append(el(doc, 'p', `전문가 기준: ${teach.criteria.headline}.`, 'xr-reading'));
  const split = scenarioSplitText(teach?.split);
  if (split) card.append(el(doc, 'p', split, 'xr-reading'));
  const evidence = el(doc, 'ul', null, 'xr-evidence');
  // v57.79: the positioning caveat is the same for every theme, so it is said once in the section's basis line.
  // v58.74 (text audit): the credit condition is one market-wide value; it is said once in the section basis line.
  // v58.75 (persona review): each condition's definition was repeated in every card (15 times for 긴 추세 앞섬); the card
  // keeps the condition name and its result, the definitions sit once in 판정 규칙.
  const own = row.basisText.filter((text) => !text.startsWith(CREDIT_CONDITION)).map((text) => text.replace(/ \([^)]*\)/, ''));
  evidence.append(el(doc, 'li', !row.state ? '조건: 단계가 보류돼 조건을 세지 않습니다.' : `조건: ${row.fit}${own.length ? ` — ${own.join(', ')}` : ''}`), el(doc, 'li', `과거 빈도: ${row.past}`));
  card.append(el(doc, 'h4', '판단 근거', 'xr-h4'), evidence);
  if (row.thesis) {
    card.append(el(doc, 'h4', '핵심 논리와 점검 신호', 'xr-h4'), el(doc, 'p', `${row.thesis}. 논리가 깨지는 신호: ${row.breaks.join(', ')}.`, 'xr-reading'));
  }
  // v58.74 (text audit): the four choice texts are the same for every card in a stage, so the stage fold states them once;
  // the card keeps the side whose cost is smaller and why (and a 분할 line that differs from the stage text).
  if (!row.state) { card.append(el(doc, 'p', '단계가 정해지면 대응별 득실을 표시합니다.', 'xr-reading')); return themeCardTail(doc, root, row, card, screenerSector); }
  const stageChoices = CHOICE_TEXT_OF(row.state);
  const ownChoices = Object.entries(row.choices).filter(([key, text]) => stageChoices[key] !== text);
  if (ownChoices.length) card.append(el(doc, 'h4', '이 테마의 대응별 득실', 'xr-h4'));
  const table = el(doc, 'div', null, 'xr-choices');
  for (const [key, text] of ownChoices) {
    const line = el(doc, 'div', null, 'xr-choice');
    if (row.favored.includes(key)) line.dataset.favored = 'true';
    line.append(el(doc, 'span', CHOICES[key], 'xr-choice-name'), el(doc, 'span', text, 'xr-choice-text'));
    if (row.favored.includes(key)) line.append(el(doc, 'span', '비용이 작은 쪽', 'xr-choice-flag'));
    table.append(line);
  }
  if (ownChoices.length) card.append(table);
  card.append(el(doc, 'p', `비용이 작은 쪽: ${row.favored.map((key) => CHOICES[key]).join(', ') || '보류'} — ${row.favoredWhy}`, 'xr-reading'));
  return themeCardTail(doc, root, row, card, screenerSector);
}

function themeCardTail(doc, root, row, card, screenerSector) {
  const explore = el(doc, 'div', null, 'xr-explore');
  explore.append(el(doc, 'span', '종목은 직접 보기:', 'xr-explore-label'));
  const link = (label, onClick) => { const b = el(doc, 'button', `${label} →`, 'flow-next-link'); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  if (typeof (row.market === 'KR' ? root?.openKrThemeDetail : root?.showThemeDetail) === 'function') {
    const detail = link('테마 상세, 구성 종목', () => openThemeDetail(root, row.id, { market: row.market }));
    if (row.market !== 'KR') detail.dataset.themeId = row.id; // the 테마 page places the US detail panel right after this section (themes.js trigger rule)
    explore.append(detail);
  }
  if (row.market === 'KR') explore.append(link('한국 테마 흐름', () => {
    // The KR theme read sits inside a fold that starts closed: open it before scrolling to it.
    const target = doc.getElementById('kr-themes-artifact-read');
    const fold = doc.getElementById('kr-integrated-themes') || target?.closest?.('details');
    if (fold) fold.open = true;
    target?.scrollIntoView?.({ block: 'start' });
  }));
  // The screener opens on the theme's dominant sector (the same typed handoff the sector rotation uses).
  // v58.75 (persona review, D-6): a US theme opens the screener searched by its name, which lists the theme's curated
  // members (screener mergeThemeAliases); a KR theme keeps the sector start (the alias list holds US themes only).
  const themeName = row.market === 'US' ? (root?.THEME_MAP || []).find((item) => item?.id === row.id)?.nameKr || row.label : null;
  const sector = themeName ? null : screenerSector?.(row) || null;
  const screener = link(themeName ? `스크리너에서 ${themeName} 종목 보기` : '스크리너', () => {
    if (themeName) setResearchHandoff({ root, routeId: 'screener', context: { q: themeName }, label: `${mkt(row)} ${row.label}` });
    else if (sector) setResearchHandoff({ root, routeId: 'screener', context: sector, label: `${mkt(row)} ${row.label}` });
    root?.showPage?.('screener');
  });
  if (sector) screener.title = `${row.label} 구성 종목이 가장 많은 섹터(${sector.sector})부터 엽니다`;
  explore.append(screener);
  card.append(explore);
  return card;
}

// v58.75 (persona review, teach-and-check A-1): the conclusion line at the top of 테마 — which themes are strong, weak and
// changing (the stage over 6개월·1개월, with 1개월 and the 50-day share as participation), then the market state and the
// lead scenario the stages sit under. Facts only; the stage rule is the one this section states. It is painted with the
// playbook so the scenario-state arrival (stage history) repaints both.
const shortTitle = (title) => String(title || '').split(' — ')[0];
function renderThemeStrengthMap(doc, root, playbook, interpretation) {
  const hero = doc.getElementById('themes-verdict')?.querySelector?.('.v2-themes-hero');
  if (!hero) return;
  let box = hero.querySelector('#themes-strength-map');
  if (!playbook?.available) { box?.remove(); return; }
  if (!box) { box = el(doc, 'div', null, 'thp-strength-map'); box.id = 'themes-strength-map'; hero.append(box); }
  const rows = playbook.themes;
  const name = (row) => `${row.market === 'KR' ? '한국 ' : ''}${row.label}`;
  const fact = (row) => `${name(row)}(1개월 ${pct(row.ret1m)}${row.above50 != null ? `, 50일선 위 ${row.above50}%` : ''})`;
  const us = rows.filter((row) => row.market === 'US');
  const strong = us.filter((row) => row.state === 'leading').sort((a, b) => (b.ret1m ?? -1e9) - (a.ret1m ?? -1e9)).slice(0, 3);
  const weak = us.filter((row) => row.state === 'weak').sort((a, b) => (a.ret1m ?? 1e9) - (b.ret1m ?? 1e9)).slice(0, 3);
  const history = root?.[SCENARIO_STATE.key]?.themeHistory || [];
  const usFirst = (row) => (row.market === 'US' ? 0 : 1);
  const changing = rows.map((row) => ({ row, change: recentStageChange(stageHistoryOf(history, row)) })).filter((item) => item.change)
    .sort((a, b) => Number(b.change.latest) - Number(a.change.latest) || usFirst(a.row) - usFirst(b.row)).slice(0, 3);
  // v58.79 (layout over captions): the "지금 강한 쪽: … 약한 쪽: … 바뀌는 중: …" sentence became three short columns —
  // the column titles say what each list is, each row is a name and its number (50일선 위 in the row's hover).
  const column = (title, rows, empty, stacked = false) => {
    const col = el(doc, 'div', null, `thp-col${stacked ? ' is-stacked' : ''}`);
    col.append(el(doc, 'h3', title, 'thp-col-title'));
    if (!rows.length) { col.append(el(doc, 'p', empty, 'thp-col-empty')); return col; }
    const list = el(doc, 'ul', null, 'thp-col-list');
    for (const [label, value, tone, hover] of rows) {
      const li = el(doc, 'li');
      li.append(el(doc, 'span', label, 'thp-col-name'), el(doc, 'span', value, `thp-col-value${tone ? ` ${tone}` : ''}`));
      if (hover) li.title = hover;
      list.append(li);
    }
    col.append(list);
    return col;
  };
  const retRow = (row) => [name(row), pct(row.ret1m), row.ret1m == null ? '' : row.ret1m >= 0 ? 'is-up' : 'is-down', fact(row)];
  const cols = el(doc, 'div', null, 'thp-cols');
  cols.append(
    column('강한 쪽, 1개월', strong.map(retRow), '주도 단계 테마 없음'),
    column('약한 쪽, 1개월', weak.map(retRow), '약세 지속 단계 테마 없음'),
    column('바뀌는 중', changing.map(({ row, change }) => [name(row), `${stageName(change.from)} → ${stageName(change.to)}`, '', `${shortMd(change.date)}에 바뀜`]), '최근 3거래일 단계 변화 없음', true));
  const parts = [cols];
  const regime = interpretation?.regime, crossroads = interpretation?.crossroads;
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId) || null;
  if (regime?.overall || lead) {
    const counts = regime?.counts;
    const tail = rows.filter((row) => row.wind?.lead === 'tail').length, head = rows.filter((row) => row.wind?.lead === 'head').length;
    parts.push(el(doc, 'p', `전체 시황: ${regime?.overall ? `시장 상태 '${regime.overall}'${counts ? `(양호 ${counts.favorable}·중립 ${counts.neutral}·부담 ${counts.burden})` : ''}` : '시장 상태 미확인'}${lead ? `, 선두 시나리오 '${shortTitle(lead.title)}' — 이 시나리오에서 테마 ${rows.length}개 중 ${WIND_LABELS.tail} ${tail}개, ${WIND_LABELS.head} ${head}개` : ''}.`, 'thp-strength-line'));
  }
  // v58.79 (layout over captions): the basis sentence became the box's hover; the 테마 시나리오 section's 기준과 판정 규칙 fold
  // spells the same stage rule for a reader without a pointer.
  box.title = `${playbook.asOfText || '확정 종가'}, 단계 = 구성 종목 수익률 중앙값의 6개월(한국 3개월)·1개월을 ${playbook.benchmarks?.US?.name || 'S&P 500 동일가중'}(한국 코스피)와 비교, 50일선 위 = 참여 폭. 강한 쪽·약한 쪽은 미국 테마, 바뀌는 중은 최근 3거래일 기록.`;
  box.replaceChildren(...parts);
}

export function renderThemePlaybook({ documentRef: doc, root, store } = {}) {
  if (!doc) return null;
  let host = doc.getElementById('theme-playbook');
  if (!host) {
    const before = doc.getElementById('theme-strength-board');
    if (!before) return null;
    const section = el(doc, 'section', null, 'aio-section tp-section');
    section.setAttribute('aria-labelledby', 'theme-playbook-title');
    // v58.79 section frame: title + close-date chip (the basis sentence is the chip's hover and the rules fold's first line).
    const title = frameHead(doc, { title: '테마 시나리오 — 단계와 거시 영향', titleId: 'theme-playbook-title', titleClass: 'briefing-h2' });
    markFrame(section, 'themes.playbook');
    host = el(doc, 'div');
    host.id = 'theme-playbook';
    section.append(title, host);
    before.insertAdjacentElement('beforebegin', section);
  }
  if (!host.dataset.aioScenarioLoad) {
    host.dataset.aioScenarioLoad = 'on';
    const repaint = () => renderThemePlaybook({ documentRef: doc, root, store });
    refreshScenarioArtifacts(root, repaint);
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => { if (changed) repaint(); }).catch(() => {});
    loadTeachArtifacts(root, repaint); // v58.75: criteria 3·4 (estimate revisions, earnings) — after the first paint
  }
  const { crossroads, playbook } = themePlaybookForRoot(root, store);
  root.__aioThemePlaybook = playbook;
  if (!playbook.available) { renderThemeStrengthMap(doc, root, playbook, null); host.replaceChildren(el(doc, 'p', '테마 수익률(스크리너)을 받으면 모든 테마를 같은 규칙으로 읽습니다.', 'xr-basis')); return playbook; }
  const openStages = new Set([...host.querySelectorAll('.tp-stage-choices-fold[open]')].map((node) => node.dataset.stage));
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId);
  const [headline, ...restOfRotation] = playbook.rotation.text.split(/(?<=니다\.)\s+/);
  const reading = [headline, ...(restOfRotation.length ? [restOfRotation.join(' ')] : [])];
  const h = playbook.highlights;
  // v57.81 (audit): no action suggestion in the reading ("분할 접근의 부담이 비교적 작은 경우" was one), and leaders are
  // only those that pass the index-relative, confirmed stage — each named with its last five sessions.
  if (h.structuralPullbacks.length) reading.push(`긴 추세는 지수보다 앞서 있는데 최근 1개월 뒤처졌고 중심 시나리오에서 역풍이 아닌 테마: ${h.structuralPullbacks.slice(0, 6).map((row) => `${mkt(row)} ${row.label}(${pct(row.ret1m)})`).join(', ')} — 핵심 논리가 깨지는 신호가 없는지 함께 봅니다.`);
  if (h.headwindLeaders.length) reading.push(`거시 부담에도 주도하는 테마(6개월·1개월 지수 대비, 최근 5거래일 확인): ${h.headwindLeaders.slice(0, 4).map((row) => `${mkt(row)} ${row.label}${row.ret5d != null ? `(5거래일 ${pct(row.ret5d)})` : ''}`).join(', ')} — 업종 고유 동력(실적·구조 수요)이 있는지 확인이 필요합니다.`);
  if (h.tailwindLaggards.length) reading.push(`거시 수혜에도 약세인 테마: ${h.tailwindLaggards.slice(0, 4).map((row) => `${mkt(row)} ${row.label}`).join(', ')} — 업종 고유의 문제가 있는지 먼저 봅니다.`);
  const creditEntry = playbook.themes.flatMap((row) => row.basisText || []).find((text) => text.startsWith(CREDIT_CONDITION));
  const benchText = ['US', 'KR'].map((market) => playbook.benchmarks?.[market]).filter((b) => b && (b.ret1m != null || b.ret3m != null || b.ret6m != null))
    .map((b) => `${b.name} ${[b.field === 'kospi' || b.name === '코스피' ? (b.ret3m != null ? `3개월 ${pct(b.ret3m)}` : null) : (b.ret6m != null ? `6개월 ${pct(b.ret6m)}` : null), b.ret1m != null ? `1개월 ${pct(b.ret1m)}` : null].filter(Boolean).join(', ')}`).join(', ');
  const basis = el(doc, 'p', `${playbook.asOfText || `${playbook.asOf ? `${playbook.asOf} ` : ''}확정 종가`}, 테마 ${playbook.themes.length}개${playbook.rotation?.market === '한국' ? ' (미국 테마 수익률을 받기 전이라 한국만)' : ''}, ${lead ? `중심 시나리오 '${lead.title.split(' — ')[0]}' 기준` : '중심 시나리오 미정'}. 단계는 긴 추세(미국 6개월, 한국 3개월)와 1개월을 같은 기간 지수와 비교해 정합니다${benchText ? `(같은 기간 ${benchText})` : ''}.${creditEntry ? ` 신용 조건은 시장 전체에 하나라 모든 테마에 같게 적용됩니다: ${creditEntry}.` : ''}`, 'xr-basis');
  setAsOf(doc, host.parentElement?.querySelector(':scope > .aio-frame-head'), closeChipText(playbook.asOfText || (playbook.asOf ? `${playbook.asOf} 확정 종가` : '')), basis.textContent);
  const rulesFold = el(doc, 'details', null, 'tp-rules');
  rulesFold.append(el(doc, 'summary', '기준과 판정 규칙'), basis, el(doc, 'p', `단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수(미국 S&P 500 동일가중 — 기록이 없으면 S&P 500, 한국 코스피)와 비교해 정하고(1개월 ±${relativeBand('ret1m')}%p, 6개월 ±${relativeBand('ret6m')}%p 안의 차이는 앞선 것으로 보지 않음), 최근 5거래일이 평소 1주 움직임의 2배를 넘게 반대로 움직이면 1개월 판정을 보류합니다. 수혜·부담은 테마 성격이 중심 시나리오에 유리한지 불리한지로 정합니다. 확률 숫자·가격·종목 지시는 쓰지 않습니다. 레버리지·포지션 쏠림을 직접 재는 자료는 없어 가격 단서(1개월 낙폭·50일선 위 비율)로만 봅니다.`, 'xr-basis'),
    el(doc, 'p', `조건 충족 수의 조건: 긴 추세 앞섬(긴 추세 중앙값이 같은 기간 지수보다 밴드 넘게 높음), 조정이 무너지지 않음(50일선 위 종목 ${ABOVE50_FLOOR}% 이상), 중심 시나리오에서 수혜 또는 중립, 신용 안정(신용 지표 양호, 시장 전체에 하나). 추세 속 조정은 조정 깊이(1개월 지수 대비 낙폭이 그 전까지 앞선 폭의 절반 이하)를 더 봅니다. 주도 지속은 50일선 위 비율이 ${ABOVE50_FLOOR}% 이상이거나 조건 ${LEAD_CONFIRM_MET}개 이상이어야 유지됩니다.`, 'xr-basis'));
  const screenerSector = screenerSectorFor(root, store);
  const mapWrap = el(doc, 'div', null, 'tp-map-wrap');
  const pick = el(doc, 'p', null, 'tp-pick');
  pick.setAttribute('aria-live', 'polite');
  pick.hidden = true;
  const onPick = (text) => { pick.textContent = text; pick.hidden = false; };
  const mapMarket = root._aioTpMapMarket === 'KR' && playbook.themes.some((row) => row.market === 'KR') ? 'KR' : 'US';
  const mapThemes = playbook.themes.filter((row) => row.market === mapMarket);
  const marketTabs = el(doc, 'div', null, 'tp-map-tabs');
  marketTabs.setAttribute('role', 'group');
  marketTabs.setAttribute('aria-label', '지도 시장');
  for (const [value, label] of [['US', '미국'], ['KR', '한국']]) {
    const count = playbook.themes.filter((row) => row.market === value).length;
    const button = el(doc, 'button', `${label} ${count}`, `news-sort-btn${value === mapMarket ? ' active' : ''}`);
    button.type = 'button';
    button.disabled = !count;
    button.setAttribute('aria-pressed', String(value === mapMarket));
    button.addEventListener('click', () => { root._aioTpMapMarket = value; renderThemePlaybook({ documentRef: doc, root, store }); });
    marketTabs.append(button);
  }
  mapWrap.append(marketTabs, momentumMap(doc, mapThemes, 'wide', onPick), momentumMap(doc, mapThemes, 'narrow', onPick), pick);
  // v58.75 (persona review): 46 stage cards were ~78% of the screen's text — "판단 근거" 46 times, "비용 작은 쪽: 관망" on 40.
  // One stage × theme table replaces them: each stage's definition and its four choices once, a row per theme (10-session
  // stage strip, 1개월, long trend, 50-day share, wind), and the card opens under its row. Rows whose stage changed in the
  // last three recorded sessions or whose cheaper choice differs from the rest of the stage open by default.
  const history = root?.[SCENARIO_STATE.key]?.themeHistory || [];
  const toggled = root._aioTpToggled instanceof Map ? root._aioTpToggled : (root._aioTpToggled = new Map());
  const table = el(doc, 'table', null, 'tp-table');
  // v58.75 (persona review, A-4): '기준 충족' — how many of the six expert criteria the theme meets (a count, not a
  // probability); the header button sorts each stage's rows by it.
  let interpretation = null;
  try { interpretation = marketInterpretation(root, { store }); } catch (_) { interpretation = null; }
  const teachOf = new Map(playbook.themes.map((row) => [`${row.market}:${row.id}`, themeTeachFor({ root, store, market: row.market, themeId: row.id, playbook, interpretation })]));
  const criteriaSort = root._aioTpCriteriaSort === 'asc' || root._aioTpCriteriaSort === 'desc' ? root._aioTpCriteriaSort : null;
  const cols = ['테마', '단계 흐름', '1개월 수익률 추이', '1주', '1개월', '긴 추세', '50일선 위', '시나리오 영향', '기준 충족'];
  const head = el(doc, 'thead'), headRow = el(doc, 'tr');
  cols.slice(0, -1).forEach((label) => headRow.append(el(doc, 'th', label)));
  const criteriaHead = el(doc, 'th');
  criteriaHead.setAttribute('aria-sort', criteriaSort === 'desc' ? 'descending' : criteriaSort === 'asc' ? 'ascending' : 'none');
  const criteriaButton = el(doc, 'button', `기준 충족${criteriaSort === 'desc' ? ' ↓' : criteriaSort === 'asc' ? ' ↑' : ''}`, 'thp-member-sort');
  criteriaButton.type = 'button';
  criteriaButton.title = '전문가 기준 6개(다기간 상대강도, 참여 폭, 이익 전망, 촉매, 과열 아님, 시나리오 적합) 중 충족한 수 — 단계 안에서 정렬';
  criteriaButton.addEventListener('click', () => { root._aioTpCriteriaSort = criteriaSort === 'desc' ? 'asc' : criteriaSort === 'asc' ? null : 'desc'; renderThemePlaybook({ documentRef: doc, root, store }); });
  criteriaHead.append(criteriaButton);
  headRow.append(criteriaHead);
  head.append(headRow);
  table.append(head);
  const groups = [...Object.keys(THEME_STATES).map((stage) => [stage, playbook.themes.filter((row) => row.state === stage).sort((a, b) => b.ret1m - a.ret1m)]),
    // v57.88 (screen audit): a held theme (state null — e.g. 한국 원전·건설) keeps its own group with the hold reason.
    ['held', playbook.themes.filter((row) => !THEME_STATES[row.state]).sort((a, b) => (b.ret1m ?? -Infinity) - (a.ret1m ?? -Infinity))]].filter(([, list]) => list.length);
  const metOf = (row) => teachOf.get(`${row.market}:${row.id}`)?.criteria?.met ?? -1;
  if (criteriaSort) for (const [, list] of groups) list.sort((a, b) => (metOf(b) - metOf(a)) * (criteriaSort === 'desc' ? 1 : -1));
  const favoredKey = (row) => row.favored.join('+');
  let exceptions = 0;
  for (const [stage, list] of groups) {
    const body = el(doc, 'tbody', null, 'tp-stage');
    body.dataset.stage = stage;
    const stageRow = el(doc, 'tr', null, 'tp-stage-row'), stageCell = el(doc, 'th');
    stageCell.colSpan = cols.length;
    stageCell.scope = 'rowgroup';
    const counts = new Map();
    for (const row of list) counts.set(favoredKey(row), (counts.get(favoredKey(row)) || 0) + 1);
    const majority = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const choiceLine = stage === 'held' ? '' : [...counts].sort((a, b) => b[1] - a[1]).map(([key, n]) => `${key ? key.split('+').map((k) => CHOICES[k].split(' (')[0]).join('·') : '보류'} ${n}개`).join(', ');
    const definition = THEME_STATES[stage]?.match(/\((.*)\)$/)?.[1];
    stageCell.append(el(doc, 'span', `${stage === 'held' ? '판정 보류' : stageName(stage)}, ${list.length}개`, 'tp-stage-name'),
      el(doc, 'span', `${definition ? `${definition}.` : '단계 판정의 조건이 맞지 않아 보류한 테마입니다(이유는 행을 눌러 확인).'}${choiceLine ? ` 조건별 득실로 비용이 작은 쪽: ${choiceLine}.` : ''}`, 'tp-stage-note'));
    if (stage !== 'held') {
      const fold = el(doc, 'details', null, 'tp-stage-choices-fold');
      fold.dataset.stage = stage;
      fold.open = openStages.has(stage);
      fold.append(el(doc, 'summary', '이 단계의 대응별 득실'), stageChoiceTable(doc, stage, list));
      fold.querySelector('h4')?.remove(); // the summary names it
      stageCell.append(fold);
    }
    stageRow.append(stageCell);
    body.append(stageRow);
    for (const row of list) {
      const key = `${row.market}:${row.id}`;
      const days = stageHistoryOf(history, row, RUN_DAYS);
      const change = recentStageChange(days);
      const odd = list.length >= 3 && stage !== 'held' && favoredKey(row) !== majority;
      const isException = !!change || odd;
      // Open at first: a stage that changed on the latest session or a cheaper choice unlike the stage's majority (at most 4).
      const openFirst = (change?.latest || odd) && exceptions < 4;
      if (openFirst && !toggled.has(key)) exceptions += 1;
      const open = toggled.has(key) ? toggled.get(key) : openFirst;
      const tr = el(doc, 'tr', null, `tp-row${isException ? ' is-exception' : ''}`);
      tr.dataset.theme = key;
      const nameCell = el(doc, 'td');
      const toggle = el(doc, 'button', null, 'tp-row-toggle');
      toggle.type = 'button';
      toggle.append(el(doc, 'span', mkt(row), 'tp-row-market'), doc.createTextNode(` ${row.label}`));
      if (odd) toggle.append(el(doc, 'span', ' 다른 선택', 'tp-row-flag'));
      toggle.setAttribute('aria-expanded', String(open));
      const detailId = `tp-detail-${row.market}-${row.id}`.replace(/[^A-Za-z0-9_-]/g, '-');
      toggle.setAttribute('aria-controls', detailId);
      nameCell.append(toggle);
      const stageCellRow = stageFlowCell(doc, days, change);
      const drift = row.stateLabel && row.state ? row.stateLabel.split(' (')[0].split(', ').slice(1).join(', ') : '';
      if (drift) stageCellRow.append(el(doc, 'span', drift, 'tp-row-drift'));
      const trend = row.ret6m ?? row.ret3m;
      const num = (value, suffix = '') => el(doc, 'td', value == null ? '—' : `${pct(value)}${suffix}`, `is-num${value == null ? '' : value >= 0 ? ' is-up' : ' is-down'}`);
      const trendCell = num(trend);
      if (trend != null) trendCell.append(el(doc, 'span', row.ret6m != null ? ' 6개월' : ' 3개월', 'tp-row-window'));
      const breadthCell = el(doc, 'td', null, 'is-num tp-row-breadth');
      if (row.above50 == null) breadthCell.textContent = '—';
      else { const bar = el(doc, 'span', null, 'tp-breadth-bar'); const fill = el(doc, 'span', null, 'tp-breadth-fill'); fill.style.width = `${Math.max(0, Math.min(100, row.above50))}%`; bar.append(fill); breadthCell.append(el(doc, 'span', `${row.above50}%`), bar); }
      tr.append(nameCell, stageCellRow, returnSpark(doc, days.slice(-SPARK_DAYS)), num(row.ret5d), num(row.ret1m), trendCell, breadthCell,
        el(doc, 'td', null, null));
      tr.lastChild.append(el(doc, 'span', WIND_LABELS[row.wind.lead], `xr-tag is-wind-${row.wind.lead}`));
      const teach = teachOf.get(key);
      const criteriaCell = el(doc, 'td', null, 'is-num tp-row-criteria');
      if (teach?.criteria) { const dots = el(doc, 'span', null, 'tp-criteria-dots'); dots.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 6; i += 1) dots.append(el(doc, 'i', null, i < teach.criteria.met ? 'is-met' : '')); criteriaCell.append(dots, el(doc, 'span', `${teach.criteria.met}/6`)); } else criteriaCell.textContent = '—';
      if (teach?.criteria) criteriaCell.title = teach.criteria.headline;
      tr.append(criteriaCell);
      [...tr.children].forEach((cell, index) => { cell.dataset.label = cols[index]; });
      const detailRow = el(doc, 'tr', null, 'tp-detail-row');
      detailRow.id = detailId;
      detailRow.hidden = !open;
      const detailCell = el(doc, 'td');
      detailCell.colSpan = cols.length;
      detailCell.append(themeCard(doc, root, row, screenerSector, { change, teach }));
      detailRow.append(detailCell);
      toggle.addEventListener('click', () => {
        const next = detailRow.hidden;
        detailRow.hidden = !next;
        toggle.setAttribute('aria-expanded', String(next));
        toggled.set(key, next);
      });
      body.append(tr, detailRow);
    }
    table.append(body);
  }
  const tableScroll = el(doc, 'div', null, 'aio-table-scroll tp-table-scroll');
  tableScroll.setAttribute('role', 'region');
  tableScroll.setAttribute('aria-label', '테마 단계 표, 가로 스크롤');
  tableScroll.tabIndex = 0;
  tableScroll.append(table);
  const tableHelp = (`테마 이름을 누르면 근거·핵심 논리·자기만의 득실이 펼쳐집니다. 단계 흐름은 지금 단계가 이어진 거래일 수와 그 전 단계(최근 10거래일 기록 안), '바뀜'은 최근 3거래일 안에 단계가 달라진 테마입니다. 추이 선은 같은 기간 1개월 수익률의 흐름입니다. 마지막 거래일에 바뀐 테마와 '다른 선택'(같은 단계 다수와 비용이 작은 쪽이 다름)은 처음부터 펼쳐 둡니다(최대 4개).`);
  // v58.75 (persona review): where the sector rotation chart and the stage point opposite ways, one fact line says why.
  const conflicts = playbook.themes.map((row) => ({ row, conflict: rrgStageConflict(root, row) })).filter((item) => item.conflict);
  // v58.79: the list sits in one fold under the table; the fold's summary carries the count.
  let conflictLine = null;
  if (conflicts.length) {
    conflictLine = el(doc, 'details', null, 'tp-rules tp-rrg-fold');
    conflictLine.append(el(doc, 'summary', `RRG와 단계가 엇갈리는 테마 ${conflicts.length}개`),
      el(doc, 'p', `${conflicts.map(({ row, conflict }) => `${row.label}(${conflict.etf} ${conflict.word}, 단계 ${conflict.stage})`).join(', ')}. ${rrgBasisText(conflicts[0].row.relative?.name)}.`, 'xr-reading'));
  }
  // Layout review 2026-10-18: the map (capped at 760px) and its reading share one row on a wide screen, so the
  // reading no longer leaves the right half of the section empty; a narrow screen stacks them in the same order.
  const mapRow = el(doc, 'div', null, 'tp-map-row');
  const mapSide = el(doc, 'div', null, 'tp-map-side');
  mapSide.append(legend(doc), ...reading.slice(1).map((text) => el(doc, 'p', text, 'xr-reading')));
  mapRow.append(mapWrap, mapSide);
  // v58.79 (layout over captions): the table's how-to sentence became the heading's hover (the 테마 buttons and the
  // column names carry it), and the closing "세부 종목 선택은 …" caveat left — the section names no stock to pick.
  const tableHead = el(doc, 'h3', `단계 × 테마, ${playbook.themes.length}개`, 'xr-h3');
  tableHead.title = tableHelp;
  host.replaceChildren(el(doc, 'p', reading[0], 'xr-lead'), rulesFold, mapRow, tableHead, tableScroll, ...(conflictLine ? [conflictLine] : []));
  host.dataset.aioThemePlaybook = 'native';
  renderThemeStrengthMap(doc, root, playbook, interpretation);
  return playbook;
}

/** Inside the theme detail panel: this theme's stage, wind and choices, tied back to the full sections. */
export function renderThemeDetailPlaybook({ documentRef: doc, root } = {}) {
  const summary = doc?.getElementById('theme-detail-native-summary');
  if (!summary) return null;
  let host = doc.getElementById('theme-detail-native-playbook');
  // The theme's own read comes before "이어서 볼 곳" (themes.js leaves a placeholder ahead of that nav).
  if (!host) {
    host = el(doc, 'div', null, 'theme-detail-native-section tp-detail'); host.id = 'theme-detail-native-playbook';
    const next = doc.getElementById('theme-detail-next');
    if (next && summary.contains(next)) next.insertAdjacentElement('beforebegin', host); else summary.insertAdjacentElement('afterend', host);
  }
  const themeId = doc.getElementById('theme-detail-panel')?.dataset.currentTheme || root?._currentThemeId || null;
  const row = themeId ? root?.__aioThemePlaybook?.themes?.find((item) => item.market === 'US' && item.id === themeId) : null;
  host.hidden = !row;
  if (!row) { host.replaceChildren(); return null; }
  const link = (label, onClick) => { const b = el(doc, 'button', `${label} →`, 'flow-next-link'); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const links = el(doc, 'div', null, 'xr-explore');
  links.append(link('모든 테마 시나리오와 비교', () => doc.getElementById('theme-playbook-title')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })),
    link('거시 시나리오의 근거', () => { root?.showPage?.('macro'); setTimeout(() => doc.getElementById('macro-crossroads-title')?.scrollIntoView?.({ block: 'start' }), 60); }));
  // v58.79 (owner 2026-10-25): how this theme's businesses earn — the research library's notes and 산업 지도 domain.
  const research = researchForTheme(row.id);
  for (const id of research.notes) links.append(link(`산업 구조 읽기, ${NOTE_TITLES[id] || id}`, () => navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'frames', node: id } })));
  if (research.domain) links.append(link('산업 지도에서 보기', () => navigateKnowledgeRoute({ root, page: 'atlas', params: { mode: 'taxonomy', domain: research.domain, view: 'domain' } })));
  // v58.75 (persona review): the theme's last ten recorded stages and, when the sector rotation chart disagrees, why.
  const days = stageHistoryOf(root?.[SCENARIO_STATE.key]?.themeHistory || [], row, RUN_DAYS);
  const change = recentStageChange(days);
  const stripLine = el(doc, 'p', null, 'xr-basis tp-detail-strip');
  // v58.78: the run in words, as in the stage table (the colour strip is retired).
  const run = stageRun(days);
  stripLine.textContent = `단계 흐름: 지금 '${stageName(row.state)}'${run ? (run.from ? `, ${run.sessions}거래일째('${stageName(run.from.state)}'에서)` : `, 최근 ${run.sessions}거래일 이상 유지`) : ''}.`;
  stripLine.title = recomputedNote(days);
  const conflict = rrgStageConflict(root, row);
  host.replaceChildren(el(doc, 'h4', '이 테마의 시나리오', 'xr-h4'), stripLine,
    // v58.79: the stage is already in the line above; the returns stay and the stage's comparison basis is the hover.
    Object.assign(el(doc, 'p', [row.ret5d != null ? `5거래일 ${pct(row.ret5d)}` : null, `1개월 ${pct(row.ret1m)}`, row.ret6m != null ? `6개월 ${pct(row.ret6m)}` : null, row.fit].filter(Boolean).join(', '), 'xr-basis'), { title: row.stateLabel }),
    ...(conflict ? [Object.assign(el(doc, 'p', `RRG ${conflict.etf} '${conflict.word}', 단계 '${conflict.stage}'`, 'xr-reading tp-rrg-fact'), { title: rrgBasisText(row.relative?.name) })] : []),
    el(doc, 'p', `거시 영향: ${row.windText}. 비용이 작은 쪽: ${row.favored.map((key) => CHOICES[key]).join(', ') || '판단 보류'} — ${row.favoredWhy}`, 'xr-reading'),
    ...(row.thesis ? [el(doc, 'p', `핵심 논리: ${row.thesis}. 점검 신호: ${row.breaks.join(', ')}.`, 'xr-reading')] : []),
    el(doc, 'p', row.above50 === 0 ? '구성 종목 중 50일선 위 종목이 없어, 아래 목록은 추세가 되살아나는지 확인하는 용도로 봅니다.' : row.above50 != null ? `아래 구성 종목에서 50일선 위 종목(${row.above50}%)부터 차트·재무로 확인합니다.` : '아래 구성 종목·대표 종목은 차트·재무로 직접 확인합니다.', 'xr-caveat'), links);
  return row;
}

