import { renderHomeGuide } from './market-guide.js';
import { renderStressOutcomes } from './stress-outcomes.js';
import { principleLink } from './principle-link.js';
import { AXIS_REASON_LABEL, alignInput, buildCloseSeries, hyObservation, isUsable, sessionPointBack } from '../../domain/briefing/market-read.js';
import { koreaIndexParts, requestRegimeMacroHistory, summaryLine } from './home-regime.js';
import { previousRegime } from '../../domain/briefing/daily-diff.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { regimeFlow } from '../../domain/market/story/page-flow.js';
import { renderNextSteps, openRouteSection } from './page-flow.js';
import { createTrendChart } from './trend-chart.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildRegimeAxisHistory, buildKoreaRegimeObservations } from '../../domain/market/regime/regime-scenarios.js';
import { renderRegimeRadar } from './regime-radar.js';
import { refreshScenarioArtifacts, renderMacroCrossroads } from './macro-crossroads.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';
import { historyWaitText } from './data-state.js';
import { foldSummary, indicatorRow, kindFold, markFold, rawTable, setFoldBody } from './indicator-face.js';
import { counterAxes } from '../../domain/market/regime/counter-evidence.js';

function chartPanel(doc, charts, range) {
  if (!charts.length || !range) return null;
  const panel = el(doc, 'div', null, 'regime-axis-history');
  const caption = el(doc, 'p', null, 'regime-chart-caption sr-only');
  const plot = el(doc, 'div', null, 'regime-axis-plot');
  const note = el(doc, 'p', null, 'regime-chart-note');
  let buttons = [];
  const show = selected => {
    caption.textContent = `${selected.title}, 세로축 ${selected.unit}, ${selected.series[0].date}~${selected.series.at(-1).date}`;
    plot.replaceChildren(createTrendChart(doc, { ...selected, label: `${selected.title} (${selected.unit})`, range }));
    plot.dataset.historySeries = selected.id;
    note.textContent = selected.note || '';
    note.hidden = !selected.note;
    for (const [button, item] of buttons) button.setAttribute('aria-pressed', item.id === selected.id ? 'true' : 'false');
  };
  if (charts.length > 1) {
    const selectors = el(doc, 'div', null, 'regime-chart-selectors');
    selectors.setAttribute('role', 'group'); selectors.setAttribute('aria-label', '같은 지표의 관측 차트 선택');
    buttons = charts.map(item => { const button = el(doc, 'button', item.title); button.type = 'button'; button.addEventListener('click', () => show(item)); selectors.append(button); return [button, item]; });
    panel.append(selectors);
  }
  panel.append(caption, plot, note);
  show(charts[0]);
  return panel;
}

// The three market flows (고른 상승 / 소수 종목 주도 / 동반 약세) are 시장 폭's (market-structure.js); the scenario lead
// carries one line to them.
function structureLink(doc, root, outlook) {
  const lead = (outlook?.items || []).find((item) => item.id === outlook?.leadId);
  if (!lead) return null;
  const button = el(doc, 'button', `시장 구조 '${lead.title}'에 가장 가까움 · ${lead.fit} → 시장 폭`, 'flow-next-link xr-structure-link');
  button.type = 'button';
  button.addEventListener('click', () => openRouteSection(doc, root, 'breadth', 'regime-structure'));
  return button;
}

const AXIS_WATCH = Object.freeze({ trend: 'S&P 500 가격 흐름', breadth: '오르는 종목의 넓이', volatility: '지수가 흔들리는 크기', credit: '회사채가 더 얹는 금리', rates: '국채 금리', commodities: '달러 지수와 국제 유가',
  sentiment: '공포와 낙관의 쏠림', leadership: 'AI·반도체 주도주' });
const AXIS_REFS = Object.freeze({
  sentiment: 'Baker·Wurgler 2006',
  leadership: 'Moskowitz·Grinblatt 1999',
  trend: 'Moskowitz·Ooi·Pedersen 2012, Faber 2007',
  breadth: 'Zweig 1986, 다우 이론의 확인 원칙',
  volatility: 'Whaley 2000',
  credit: 'Gilchrist·Zakrajšek 2012',
  rates: 'Campbell·Shiller 1988',
  commodities: 'Bruno·Shin 2015'
});
// The headline value(s) of each axis in the table — evidence labels from buildMarketRegime, matched by prefix.
const AXIS_FACE = Object.freeze({
  trend: ['S&P 500', '50일선 대비'], breadth: ['50일선 위', '200일선 위'], volatility: ['VIX', 'VIX / 3개월'],
  credit: ['하이일드'], rates: ['미 10년물'], commodities: ['달러 지수', 'WTI']
});
const TONE = { favorable: 'good', burden: 'warn', neutral: 'neutral', unknown: 'neutral' };

function faceValue(row) {
  if (row.watch) return row.faceValue;
  const parts = (AXIS_FACE[row.id] || []).map((prefix) => row.evidence.find(([label]) => label.startsWith(prefix))).filter(Boolean);
  const shown = parts.length ? parts : row.evidence.slice(0, 1);
  const face = (value) => {
    const [head, ...rest] = String(value).replace(/\s*\([^)]*\)/g, '').split(/ · |, /);
    const widening = row.id === 'credit' && row.state === 'burden' ? String(value).match(/20거래일 [+-]\d+bp/)?.[0] : null;
    return [head, ...(widening ? [widening] : []), ...rest.filter((part) => /^\d{1,2}\/\d{1,2}$/.test(part.trim()))].join(', ');
  };
  return shown.map(([label, value]) => `${label.replace(/\s*\(.*\)$/, '')} ${face(value)}`).join(', ');
}

// The five-session change of each axis's headline series, from the same completed closes the axis reads.
export function fiveDayChange(id, inputs, asOf) {
  const series = (field) => buildCloseSeries(inputs?.history || [], field, { through: asOf });
  const delta = (field, kind) => {
    const points = series(field);
    const last = points.at(-1), base = sessionPointBack(points, 5);
    if (!last || !base || !(base.value > 0 || kind !== 'pct')) return null;
    const value = kind === 'pct' ? (last.value / base.value - 1) * 100 : kind === 'bp' ? (last.value - base.value) * 100 : last.value - base.value;
    const unit = kind === 'pct' ? '%' : kind === 'bp' ? 'bp' : '%p';
    return signedText(value, kind === 'bp' ? 0 : 1, unit);
  };
  if (id === 'trend') return delta('spx', 'pct');
  if (id === 'breadth') return delta('breadth50', 'pt');
  if (id === 'volatility') return delta('vix', 'pct');
  if (id === 'rates') return delta('tnx', 'bp');
  if (id === 'commodities') return delta('dxy', 'pct');
  if (id === 'credit') {
    // The 5-session change of the one observation the credit axis reads (hyObservation), admitted on the same alignment.
    const obs = hyObservation({ macroHistory: inputs?.macroHistory || null, credit: inputs?.credit || null, through: asOf });
    return obs?.change5 != null && isUsable(alignInput(obs.asOf, asOf)) ? signedText(obs.change5, 0, 'bp') : null;
  }
  return null;
}

const alsoText = (d) => (d?.also || []).map((also) => `, 함께 필요: ${also.condition}`).join('');
const prevOf = (row, previous) => {
  const prev = [...(previous?.axes || []), ...(previous?.watchAxes || [])].find((axis) => axis.id === row.id);
  // A previous state rebuilt from partial inputs (prev.partial) is not shown as a flip.
  return prev && !prev.partial ? (prev.state === row.state ? `${prev.stateLabel}, 같음` : `${prev.stateLabel} → ${row.stateLabel}`) : '';
};

// an axis on the face is one row, never folded — title, state, headline value · 기준까지, then its two lines:
// the 판정 사유 row (fixed vocabulary, market-read.js AXIS_REASONS) and the nearest threshold that would change the state
// (flipDistance, the rule's own numbers; the rule sentence when the axis has no measured lever).
function axisFace(doc, row) {
  const d = row.flipDistance;
  const reason = row.evidence.find(([label]) => label === AXIS_REASON_LABEL)?.[1] || '';
  // Without a measured lever (심리, AI·반도체 집중) the line is the rule's first sentence — the condition that leaves today's
  // state; the whole rule is in the raw table.
  const flip = d ? `${d.condition}${alsoText(d)} ${row.title} → ${d.towardLabel}` : String(row.flip || '').match(/^.+?[.](?=\s|$)/)?.[0] || row.flip || '';
  const card = indicatorRow(doc, { title: row.title, stateLabel: row.verdictLabel, tone: TONE[row.state] || 'neutral', value: faceValue(row),
    distance: d?.label || '', distanceTitle: d ? `종가 기준, ${d.short}` : '', lines: [['reason', reason], ['flip', flip]] });
  card.dataset.axis = row.id;
  card.dataset.state = row.state;
  if (row.basis && row.basisStatus !== 'aligned') card.children[0].append(el(doc, 'span', row.basis, 'basis-chip is-off'));
  return card;
}

// The raw table of one axis: every evidence row but the 판정 사유 on the face, the thresholds toward each other state, the
// full rule, the observation date and the five-session comparison (the 5거래일 전 and 5일 변화 columns of the old table).
function axisRaw(doc, row, { previous, inputs, asOf }) {
  const group = el(doc, 'section', null, 'ind-raw-group');
  group.dataset.rawAxis = row.id;
  group.append(el(doc, 'h3', `${row.title} · ${row.stateLabel}`, 'ind-raw-group__title'));
  const rows = row.evidence.filter(([label]) => label !== AXIS_REASON_LABEL);
  for (const item of row.flipDistances || []) rows.push([`${item.towardLabel}까지 ${item.text}`, `${item.condition}${alsoText(item)}`]);
  rows.push(['상태가 바뀌는 조건', row.flip], ['관측일', row.basis], ['5거래일 전 판정', prevOf(row, previous)], ['5일 변화', fiveDayChange(row.id, inputs, asOf) || row.change5 || '']);
  group.append(rawTable(doc, rows, `${row.title} 관측값`));
  return group;
}

// The method fold at the foot of the page (all views): each axis's academic line and the link to its principle in the
// research library; built when first opened.
function methodBody(doc, root, axes) {
  const nodes = [el(doc, 'p', '판정 기준은 관례와 연구에서 고른 검증 전 기준선입니다. 숫자는 모두 직전 미국장 종가 기준입니다.', 'ind-method__lead')];
  for (const row of axes) {
    const box = el(doc, 'section', null, 'ind-method');
    box.append(el(doc, 'h3', `${row.title}${AXIS_WATCH[row.id] ? ` — ${AXIS_WATCH[row.id]}` : ''}`, 'ind-method__title'));
    if (AXIS_REFS[row.id]) box.append(el(doc, 'p', `학술 근거, ${AXIS_REFS[row.id]}`, 'ind-method__text'));
    const link = principleLink(doc, root, row.id, row.title);
    if (link) box.append(link);
    nodes.push(box);
  }
  nodes.push(el(doc, 'h3', '주도 영역과 자금 흐름', 'ind-method__title'), el(doc, 'p', LEAD_METHOD, 'ind-method__text'), el(doc, 'p', FLOW_METHOD, 'ind-method__text'));
  return nodes;
}

// the one chart card of the indicators — an axis picker, then the axis's dated charts (its own series picker).
function paintHistory(doc, root, history, axes) {
  const host = doc.getElementById('regime-history-host');
  if (!host) return;
  const items = axes.filter((row) => (history.axes[row.id] || []).length);
  const card = doc.getElementById('regime-history');
  if (card) card.hidden = !items.length || !history.range;
  if (!items.length || !history.range) { host.replaceChildren(); return; }
  const picker = el(doc, 'div', null, 'regime-chart-selectors regime-history-axes');
  picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', '차트로 볼 지표');
  const plot = el(doc, 'div', null, 'regime-history-plot');
  const buttons = [];
  const show = (id) => {
    plot.replaceChildren(chartPanel(doc, history.axes[id], history.range));
    plot.dataset.axis = id;
    for (const [button, row] of buttons) button.setAttribute('aria-pressed', row.id === id ? 'true' : 'false');
  };
  for (const row of items) {
    const button = el(doc, 'button', row.title);
    button.type = 'button';
    button.dataset.axis = row.id;
    button.addEventListener('click', () => { root.__aioOpenAxis = row.id; show(row.id); });
    buttons.push([button, row]);
    picker.append(button);
  }
  host.replaceChildren(picker, plot);
  show((items.find((row) => row.id === root.__aioOpenAxis) || items[0]).id);
}

function heroSide(doc, regime, previous) {
  const tally = doc.getElementById('regime-tally');
  if (tally) {
    const { favorable = 0, neutral = 0, burden = 0, unknown = 0 } = regime.counts || {};
    const names = (state) => (regime.axes || []).filter((row) => row.id !== 'korea' && row.state === state).map((row) => row.title).join(', ');
    const bar = el(doc, 'div', null, 'mk-tally__bar');
    bar.setAttribute('aria-hidden', 'true');
    for (const [state, count] of [['favorable', favorable], ['neutral', neutral], ['burden', burden], ['unknown', unknown]]) {
      for (let i = 0; i < count; i += 1) bar.append(el(doc, 'span', null, `mk-tally__seg is-${state}`));
    }
    const legend = el(doc, 'div', null, 'mk-tally__legend');
    legend.append(el(doc, 'span', `양호 ${favorable}${favorable ? `(${names('favorable').replaceAll(', ', '·')})` : ''}`, 'is-favorable'), el(doc, 'span', `중립 ${neutral}${unknown ? `, 확인 불가 ${unknown}` : ''}`, 'is-neutral'), el(doc, 'span', `부담 ${burden}${burden ? `(${names('burden').replaceAll(', ', '·')})` : ''}`, 'is-burden'));
    tally.replaceChildren(...(regime.available ? [bar, legend] : []));
  }
  const prevNode = doc.getElementById('regime-previous');
  if (prevNode) {
    if (previous) {
      const changed = previous.axes.filter((axis) => axis.id !== 'korea' && !axis.partial).map((axis) => [axis, regime.axes.find((row) => row.id === axis.id)])
        .filter(([then, now]) => now && then.state !== now.state).map(([then, now]) => `${now.title} ${then.stateLabel}→${now.stateLabel}`);
      // With a partially rebuilt axis the overall label and tally are not restated; only the comparable axes are.
      const skipped = previous.axes.filter((axis) => axis.partial).map((axis) => axis.title);
      const head = previous.partial ? `5거래일 전(${shortDate(previous.asOf)}) 대비` : `5거래일 전(${shortDate(previous.asOf)})에는 ${withDirectionParticle(summaryLine(previous))} '${previous.overall}' 판정이었습니다.`;
      prevNode.textContent = `${head}${changed.length ? ` 바뀐 지표: ${changed.join(', ')}.` : ' 지표별 판정은 그대로입니다.'}${skipped.length ? ` (${skipped.join(', ')}은 그날 입력을 모두 되살릴 수 없어 비교 제외)` : ''}`;
      prevNode.hidden = false;
    } else prevNode.hidden = true;
  }
}

// the counter line under the verdict — the axes on the other side of the count, or the neutral axis nearest
// to it (domain/market/regime/counter-evidence.js), as title, state, headline value and threshold. No sentence is built.
function paintCounterLine(doc, regime) {
  const node = doc.getElementById('regime-counter');
  if (!node) return;
  const counter = counterAxes(regime);
  if (!counter) { node.replaceChildren(); node.hidden = true; return; }
  const items = counter.items.map(({ row, distance }) => `${row.title} ${row.stateLabel}, ${faceValue(row)}${distance ? ` · ${distance.label}` : ''}`);
  node.replaceChildren(el(doc, 'span', counter.kind === 'opposite' ? '반대 근거' : '반대 쪽에 가장 가까운 지표', 'mk-hero__counter-label'), el(doc, 'span', items.join(' · '), 'mk-hero__counter-text'));
  node.hidden = false;
}

function comboAndWatch(doc, root, regime, interpretation) {
  const conflicts = doc.getElementById('regime-conflicts');
  if (conflicts) {
    // each combination's name is on the face ("주도 영역 이탈"); the numbers, counts and rule behind every one
    // sit in one raw-table fold under the list.
    const parts = (regime.conflicts || []).map((text) => String(text).split(' — '));
    conflicts.replaceChildren(...(parts.length ? parts.map(([head]) => el(doc, 'li', head)) : regime.available ? [el(doc, 'li', '지표끼리 엇갈리는 조합이 없습니다.')] : []));
    let raw = doc.getElementById('regime-conflicts-raw');
    if (!raw) { raw = kindFold(doc, 'raw-table', '엇갈리는 조합의 근거 수치'); raw.id = 'regime-conflicts-raw'; conflicts.insertAdjacentElement('afterend', raw); }
    const detailed = parts.filter((rest) => rest.length > 1);
    setFoldBody(raw, rawTable(doc, detailed.map(([head, ...rest]) => [head, rest.join(' — ')]), '엇갈리는 조합의 근거'));
    raw.hidden = !detailed.length;
  }
  watchList(doc, root, interpretation);
}

// 다음에 확인할 가격 조건: the opening's rebound conditions first when there is a rebound (`lead`, market-story.js
// renderSignalOpening, painted once the opening loads), then the axes' checks (market-read.js), then the next release.
function watchList(doc, root, interpretation, lead = []) {
  const watch = doc.getElementById('regime-watch');
  if (!watch) return;
  const items = [...lead, ...(interpretation.marketRead?.checks || [])];
  const next = interpretation.crossroads?.nextEvent;
  const release = next?.name && next?.date ? `${next.when || shortDate(next.date)} ${next.name}` : '';
  const rows = items.map((title, index) => {
    const item = el(doc, 'li', null, 'mk-watch__item');
    const text = el(doc, 'span', null, 'mk-watch__text');
    text.append(el(doc, 'b', title));
    item.append(el(doc, 'span', String(index + 1), 'mk-watch__num'), text);
    return item;
  });
  // The week list with this release sits in the 시나리오와 전망 view, so the 지금 view carries its own line.
  if (release) {
    const li = el(doc, 'li', null, 'mk-watch__item is-release');
    const link = el(doc, 'button', `다음 발표 ${release} — 결과별 시나리오와 7일 일정 → 브리핑`, 'flow-next-link');
    link.type = 'button';
    link.addEventListener('click', () => openRouteSection(doc, root, 'briefing', 'briefing-checks'));
    li.append(link);
    rows.push(li);
  }
  watch.replaceChildren(...rows);
  watch.closest?.('section')?.toggleAttribute?.('hidden', !rows.length);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function crossMap(doc, row) {
  const { x, y, xAxis, yAxis, cells } = row.map;
  const W = 248, H = 158, L = 4, T = 20, R = 244, B = 138;
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'mk-cross__map');
  svg.setAttribute('role', 'img');
  const at = cells[(y >= 0.5 ? 2 : 0) + (x >= 0.5 ? 1 : 0)];
  svg.setAttribute('aria-label', `${row.title}: 지금은 '${at}' 칸`);
  const node = (tag, attrs, text) => { const n = doc.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; svg.append(n); return n; };
  const mx = (L + R) / 2, my = (T + B) / 2;
  cells.forEach((label, i) => {
    const cx = i % 2 ? mx : L, cy = i >= 2 ? T : my;
    node('rect', { x: cx, y: cy, width: mx - L, height: my - T, class: `mk-cross__cell${label === at ? ' is-now' : ''}` });
    const right = i % 2 === 1, top = i >= 2;
    node('text', { x: right ? R - 6 : L + 6, y: top ? T + 15 : B - 7, 'text-anchor': right ? 'end' : 'start', class: 'mk-cross__cell-label' }, label);
  });
  // The vertical axis names only its top end; the arrow says the bottom is the opposite.
  node('text', { x: L, y: T - 6, class: 'mk-cross__axis is-y' }, `↑ ${yAxis[1]}`);
  node('text', { x: R, y: H - 4, 'text-anchor': 'end', class: 'mk-cross__axis' }, `${xAxis[1]} →`);
  node('text', { x: L, y: H - 4, class: 'mk-cross__axis' }, `← ${xAxis[0]}`);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  node('circle', { cx: clamp(L + x * (R - L), L + 8, R - 8), cy: clamp(B - y * (B - T), T + 22, B - 22), r: 6, class: 'mk-cross__dot' });
  return svg;
}

function paintCrossReadings(doc, root, inputs) {
  Promise.all([import('../../domain/market/regime/cross-readings.js'), import('../../data/shared-artifacts.js'), import('../../data/artifact-registry.js')]).then(([{ crossReadings }, { refreshSharedArtifact }, { MARKET_DAY }]) => {
    const paint = () => {
      const host = doc.getElementById('regime-cross-list');
      const section = doc.getElementById('regime-cross');
      if (!host || !section) return;
      const rows = crossReadings({ history: inputs?.history || root._aioHistory || [], macroHistory: root._aioMacroHistory || null, day: root[MARKET_DAY.key] || null });
      section.hidden = !rows.length;
      host.replaceChildren(...rows.map((row) => {
        const item = el(doc, 'div', null, 'mk-cross__item');
        item.dataset.pair = row.id;
        const title = el(doc, 'h3', row.title, 'mk-cross__title');
        if (row.asOf) title.append(el(doc, 'span', ` ${shortDate(row.asOf)} 기준`, 'mk-cross__asof'));
        item.append(title);
        if (row.map) item.append(crossMap(doc, row));
        item.append(el(doc, 'p', row.text, 'mk-cross__text'));
        // Record ranks behind the row (depth-readouts `more`), folded: reference numbers, not part of any verdict.
        if (row.more?.length) {
          const fold = markFold(el(doc, 'details', null, 'regime-read-more'), 'raw-table');
          fold.append(foldSummary(doc, 'raw-table', `1년 기록에서의 위치 ${row.more.length}개`),...row.more.map((entry) => el(doc, 'p', `${entry.label}: ${entry.text}`, 'mk-cross__text')));
          item.append(fold);
        }
        return item;
      }));
    };
    paint();
    if (!root[MARKET_DAY.key]) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) paint(); }).catch(() => {});
  }).catch(() => {});
}

export function renderRegimePage({ documentRef: doc, root, store = null }) {
  const page = doc?.getElementById('page-signal');
  if (!page) return null;
  const interpretation = marketInterpretation(root, { store });
  const { inputs, regime } = interpretation;
  requestRegimeMacroHistory(root, doc, 'page-signal', () => renderRegimePage({ documentRef: doc, root, store }));
  const history = buildRegimeAxisHistory(inputs, { regime, macroHistory: root._aioMacroHistory || null });
  const previous = previousRegime({ ...inputs, macroHistory: inputs?.macroHistory || root._aioMacroHistory || null }, regime);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('regime-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준, 판정 지표 6개` : historyWaitText(root));
  // F01: before the closes load, a verdict the static shell painted from today-verdict.json stays (not '판정 대기').
  const overall = regime.available || !doc.getElementById('home-hero-total')?.dataset?.firstPaint ? set('regime-overall', regime.available ? regime.overall : '판정 대기') : doc.getElementById('regime-overall');
  if (overall) { overall.dataset.overall = regime.overall || ''; overall.setAttribute('aria-label', `미국 시장 판정: ${regime.available ? regime.overall : '판정 대기'}`); }
  // The tally bar's legend carries the counts; this line stays for a held verdict (its reason) only.
  set('regime-counts', regime.available ? (regime.holdReason || (doc.getElementById('regime-tally') ? '' : summaryLine(regime))) : '');
  const breadthRow = (regime.axes || []).find((row) => row.id === 'breadth');
  set('regime-shape', !regime.leadershipBreak && breadthRow?.narrow ? '좁은 장세, 소수 종목이 지수를 받침' : '');
  // the hero's assembled sentence (heroLine / marketRead headline) and its 판정 근거 fold left the screen — the
  // AI reading under the hero reads the verdict; the face keeps the counter line (facts only) and the 5-session comparison.
  paintCounterLine(doc, regime);
  paintLeadershipLine(doc, 'regime-leaders', regime.available ? regime.leadershipVerdict : null, interpretation.flow, { flowOnFace: true });
  (sessionLean ||= import('./session-lean.js')).then((mod) => mod.paintMarketLean(doc, root, regime.available ? regime : null, doc.getElementById('regime-leaders'), () => renderRegimePage({ documentRef: doc, root, store }))).catch(() => { sessionLean = null; });
  heroSide(doc, regime, previous);
  if (regime.available) import('./market-story.js').then(({ renderMarketStory, renderSignalOpening }) => { renderSignalOpening({ documentRef: doc, root, interpretation, onWatch: (lead) => watchList(doc, root, interpretation, lead) }); renderMarketStory({ documentRef: doc, root, interpretation }); })
    .then(() => import('./market-narratives.js')).then(({ renderMarketNarratives }) => renderMarketNarratives({ documentRef: doc, root, interpretation })).catch(() => {});
  comboAndWatch(doc, root, regime, interpretation);
  const board = doc.getElementById('regime-board');
  const boardKr = doc.getElementById('regime-board-kr');
  if (board) {
    board.classList.add('regime-quality-board');
    const usAxes = regime.axes.filter((row) => row.id !== 'korea');
    board.replaceChildren(...usAxes.map((row) => axisFace(doc, row)));
    let watchBoard = doc.getElementById('regime-board-watch');
    if (!watchBoard) {
      watchBoard = el(doc, 'div', null, 'regime-board regime-quality-board');
      watchBoard.id = 'regime-board-watch';
      board.insertAdjacentElement('afterend', watchBoard);
    }
    const watchAxes = (regime.watchAxes || []).filter((row) => row.observed !== false);
    const watchHead = watchAxes.length ? el(doc, 'h3', `참고 ${watchAxes.length}개, 판정 합계 밖`, 'regime-watch-head') : null;
    watchBoard.replaceChildren(...[watchHead].filter(Boolean), ...watchAxes.map((row) => axisFace(doc, row)));
    watchBoard.hidden = !watchAxes.length;
    // one raw-table fold under both blocks holds every axis's observations (it keeps its open state across repaints).
    const shown = [...usAxes, ...watchAxes];
    let raw = doc.getElementById('regime-raw');
    if (!raw) { raw = kindFold(doc, 'raw-table', '지표별 관측값 전체'); raw.id = 'regime-raw'; watchBoard.insertAdjacentElement('afterend', raw); }
    const groups = shown.map((row) => axisRaw(doc, row, { previous, inputs, asOf: regime.asOf }));
    setFoldBody(raw, groups);
    raw.hidden = !regime.available;
    const trendRaw = groups.find((group) => group.dataset.rawAxis === 'trend');
    if (trendRaw) {
      const slot = el(doc, 'div', null, 'mk-correction-slot');
      trendRaw.append(slot);
      const fill = () => (correctionBaseRate ||= import('./correction-base-rate.js')).then(({ renderCorrectionBaseRate }) => renderCorrectionBaseRate({ documentRef: doc, root, host: slot, onLoad: () => renderRegimePage({ documentRef: doc, root, store }) })).catch(() => { correctionBaseRate = null; });
      if (raw.open) fill();
      else if (!raw.__aioCorrectionWait) { raw.__aioCorrectionWait = true; raw.addEventListener('toggle', () => { if (raw.open) renderRegimePage({ documentRef: doc, root, store }); }); }
      if (regime.available) import('./distribution-strip.js').then(({ distributionStrip, rallyAttemptStrip }) => {
        const rally = rallyAttemptStrip(doc, inputs?.history || root._aioHistory, regime.asOf);
        const strip = distributionStrip(doc, inputs?.history || root._aioHistory, regime.asOf);
        for (const part of [strip, rally].filter(Boolean)) slot.insertAdjacentElement('beforebegin', part);
      }).catch(() => {});
    }
    renderStressOutcomes({ documentRef: doc, root, host: raw.parentElement || board.parentElement });
    paintHistory(doc, root, history, shown);
    let method = doc.getElementById('regime-method');
    if (!method) {
      method = kindFold(doc, 'method', '지표별 학술 근거', () => methodBody(doc, root, shown));
      method.id = 'regime-method';
      const next = doc.getElementById('regime-next');
      if (next) next.insertAdjacentElement('beforebegin', method); else page.append(method);
    }
    if (regime.available) paintCrossReadings(doc, root, inputs);
    const radarHost = doc.getElementById('regime-radar-host');
    if (regime.available) renderRegimeRadar({ documentRef: doc, root, inputs, anchor: radarHost || board, verdicts: regime.axes });
    if (boardKr) {
      boardKr.classList.add('regime-quality-board', 'regime-quality-korea');
      const korea = buildKoreaRegimeObservations(inputs, { through: regime.asOf || null });
      const cards = korea.cards.map(item => {
        const section = el(doc, 'section', null, 'regime-axis'); section.dataset.axis = item.id; section.dataset.market = 'KR';
        section.append(el(doc, 'h3', item.title, 'regime-axis-title'), el(doc, 'p', `${item.scope}, ${item.asOf}${item.stale ? ', 지연 자료' : ''}`, 'regime-chart-caption'),
          el(doc, 'p', `${item.last.toLocaleString('en-US', { maximumFractionDigits: item.id === 'usdkrw' ? 2 : 2 })} ${item.unit}`, 'regime-korea-value'), el(doc, 'p', item.read, 'regime-read'));
        if (item.series.length > 1) { const chart = chartPanel(doc, [{ id: item.id, title: item.title, unit: item.unit, series: item.series, format: value => value.toLocaleString('en-US', { maximumFractionDigits: 0 }) }], [item.series[0].date, item.series.at(-1).date]); if (chart) section.append(chart); }
        section.append(el(doc, 'p', item.observe, 'regime-read'));
        if (item.id === 'usdkrw') {
          const reference = regime.axes.find(axis => axis.id === 'korea');
          if (reference?.evidence?.length) section.append(kindFold(doc, 'raw-table', '원·엔 연결 관측값', rawTable(doc,
            [['관측일', `미국 종가 기준에 맞춘 환율 참고, ${reference.basis || '관측일 미확인'}`], ...reference.evidence, ['상태가 바뀌는 조건', reference.flip]], '원·엔 연결 관측값')));
        }
        return section;
      });
      boardKr.replaceChildren(...cards);
      const krRender = boardKr.__aioKrRender = (boardKr.__aioKrRender || 0) + 1;
      const krFold = boardKr.closest?.('details');
      const whenOpen = (fn) => { if (!krFold || krFold.open) fn(); else krFold.addEventListener('toggle', function once() { if (!krFold.open) return; krFold.removeEventListener('toggle', once); fn(); }); };
      if (cards.length) whenOpen(() => import('../../domain/market/korea/korea-policy.js').then(({ koreaPolicyCard }) => {
        const policy = koreaPolicyCard(root.DATA_SNAPSHOT);
        if (!policy || boardKr.__aioKrRender !== krRender) return;
        const section = el(doc, 'section', null, 'regime-axis'); section.dataset.axis = 'kr-policy'; section.dataset.market = 'KR';
        section.append(el(doc, 'h3', policy.title, 'regime-axis-title'), el(doc, 'p', policy.caption, 'regime-chart-caption'), el(doc, 'p', policy.value, 'regime-korea-value'));
        for (const line of policy.lines) section.append(el(doc, 'p', line, 'regime-read'));
        boardKr.append(section);
      }).catch(() => {}));
      boardKr.hidden = !cards.length;
      const krSection = boardKr.closest?.('section.mk-korea');
      if (krSection) krSection.hidden = !cards.length; // the 한국 시장 card goes with its board
      const krSummary = doc.getElementById('regime-kr-summary');
      if (krSummary) {
        const parts = koreaIndexParts(root._aioHistory || []);
        krSummary.textContent = parts.kospi ? `${shortDate(parts.kospi.date)} 마감, ${parts.kospi.text}` : '';
        krSummary.title = '한국 정규장 확정 종가, 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않는 참고입니다';
      }
    }
  }
  root.__aioScenarioOutlook = interpretation.outlook;
  const depthAnchor = doc.getElementById('regime-depth-anchor');
  if (depthAnchor) {
    const paintDepth = () => {
      let host = depthAnchor.parentElement.querySelector(':scope > #macro-crossroads');
      if (!host) { host = el(doc, 'div', null, 'xr-section'); host.id = 'macro-crossroads'; depthAnchor.insertAdjacentElement('afterend', host); }
      renderMacroCrossroads({ documentRef: doc, root, regime, host, leadAside: () => structureLink(doc, root, root.__aioScenarioOutlook) });
      renderHomeGuide({ documentRef: doc, root, store, anchor: host });
    };
    const showsDepth = (view) => view === 'story' || view === 'all';
    const depthFold = depthAnchor.closest?.('#regime-depth-fold');
    if (depthFold) {
      if (!depthFold.__aioPaintDepth) doc.addEventListener('aio:pageViewChanged', (event) => {
        if (event.detail?.page === page.id && showsDepth(event.detail.view) && page.classList.contains('active')) depthFold.__aioPaintDepth();
      });
      depthFold.__aioPaintDepth = paintDepth;
    }
    if (showsDepth(page.dataset.view)) paintDepth();
    // The story view defers its DOM, not its data. The scenario artifacts load on every view (the AI context and
    // the lead's tie-keeping read scenario-state.json); an arrival repaints the depth only while it is on screen.
    else refreshScenarioArtifacts(root, () => { if (showsDepth(page.dataset.view) && page.classList.contains('active')) paintDepth(); });
  }
  renderNextSteps(doc, doc.getElementById('regime-next'), regimeFlow({ regime, groups: root.__aioScenarioOutlook?.rotation || {} }).next);
  const handoff = consumeResearchHandoff({ root, routeId: 'signal' });
  const anchorId = handoff?.context?.anchor ? String(handoff.context.anchor) : '';
  if (/^[a-z0-9-]+$/i.test(anchorId)) {
    const section = doc.getElementById(anchorId);
    // A link into a fold (a raw table) opens it first; the sections themselves are open.
    const fold = section?.closest?.('details') || section?.querySelector?.(':scope > details');
    if (section) root._aioShowViewOf?.(section);
    if (fold) fold.open = true;
    const heading = fold ? fold.closest('section') || fold : section?.previousElementSibling?.tagName === 'H2' ? section.previousElementSibling : section;
    heading?.scrollIntoView?.({ block: 'start' });
  }
  page.dataset.aioRegimeRenderer = 'native';
  return regime;
}

function headChip(doc, label, state, burden = false) {
  const chip = el(doc, 'span', state, 'leaders-line__state');
  if (burden) chip.classList.add('is-burden');
  const head = el(doc, 'span', null, 'leaders-line__head');
  head.append(el(doc, 'span', label, 'leaders-line__label'), chip);
  return head;
}
// the two judgement methods, shown in the page's method fold (and as each part's hover).
const LEAD_METHOD = '주도 영역 판정 방법: 반도체 ETF(SOXX)의 추세와 하루 변화, 나스닥 100의 하루 변화, 미국 종목의 최근 종가 신저가 수로 냅니다. 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않습니다.';
const FLOW_METHOD = '자금 흐름 판정 방법: 미국 섹터 ETF의 하루 등락과 같은 날 10년물 금리 변화, 공포·탐욕 지수를 봅니다. 성장(기술·통신·반도체)과 방어(필수소비재·유틸리티·헬스케어) 업종의 평균 차이가 3%p 이상이면 한쪽으로의 이동으로 봅니다.';
// the state words are the face ("주도주(AI·반도체) 이탈 · 돈의 방향 방어 업종 강세"); the numbers behind them
// and the sector and theme splits are one raw-table fold. The leaders' and the money's reading sentences left the screen —
// the AI reading interprets them.
function paintLeadershipLine(doc, id, verdict, flow = null, { flowOnFace = false } = {}) {
  const node = doc.getElementById(id);
  if (!node) return;
  const lead = verdict?.available ? verdict : null;
  const money = flow?.available ? flow : null;
  if (!lead && !money) { node.hidden = true; node.replaceChildren(); return; }
  const face = el(doc, 'p', null, 'leaders-line__summary');
  if (lead) face.append(headChip(doc, '주도주(AI·반도체)', lead.label, lead.state === 'break' || lead.state === 'weak' || lead.shock));
  if (money && (flowOnFace || !lead)) face.append(headChip(doc, '돈의 방향', money.label));
  const rows = [];
  if (lead?.line) rows.push([`주도 영역 (AI·반도체) ${lead.label}`, lead.line]);
  if (money?.line) rows.push([`자금 흐름 ${money.label}`, money.line]);
  const themes = money?.themes;
  if (themes?.available) {
    if (themes.splitLines.length) rows.push(['같은 업종 안에서 갈린 곳', themes.splitLines.join(' / ')]);
    if (themes.memberSplitLines?.length) rows.push(['같은 테마 안에서 갈린 종목', themes.memberSplitLines.join(' / ')]);
    rows.push([`테마 ${themes.groups}개의 하루 흐름`, [themes.strongLine, themes.weakLine].filter(Boolean).join(' / ')]);
  }
  const wasOpen = !!node.querySelector?.(':scope > details')?.open; // the frequent repaint (live quotes) keeps a reader's fold
  const fold = rows.length ? kindFold(doc, 'raw-table', '주도 영역과 자금 흐름의 근거 수치', rawTable(doc, rows, '주도 영역과 자금 흐름')) : null;
  if (fold) fold.open = wasOpen;
  face.title = [lead ? LEAD_METHOD : '', money ? FLOW_METHOD : ''].filter(Boolean).join(' ');
  node.replaceChildren(face, ...(fold ? [fold] : []));
  node.dataset.state = lead ? lead.state : 'unknown';
  node.hidden = false;
}

let correctionBaseRate = null;
let sessionLean = null;
