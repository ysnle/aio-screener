// P1392: 시장 상태 = six-axis regime board (owner decision 2026-10-02: the 0-100 score and the
// swing/day toggle are retired from user surfaces). The home card shows the same board compactly.
import { renderHomeGuide } from './market-guide.js';
import { AXIS_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { renderStressOutcomes } from './stress-outcomes.js';
import { deepDiveLinks } from './deep-dive.js';
import { alignInput, buildCloseSeries, closeBasis, isUsable, koreaMoveRecord, koreaRecordText, KR_SHOCK_TAIL_PCT, sessionPointBack } from '../../domain/briefing/market-read.js';
import { previousRegime } from '../../domain/briefing/daily-diff.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { regimeFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { createTrendChart } from './trend-chart.js';
import { MACRO_HISTORY, refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { buildRegimeAxisHistory, buildKoreaRegimeObservations, buildKoreaIndexSeries } from '../../domain/market/regime-scenarios.js';
import { renderRegimeRadar } from './regime-radar.js';
import { renderCrossroadsCompact, showCrossroadsSection } from './macro-crossroads.js';
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { usWeekendClosed } from '../../domain/market/market-calendar.js';
import { signedText } from '../../domain/shared/number.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';

// Live review 2026-10-14 (owner reading standard: 3–5 lines, ~130–230자 per block): a longer reading keeps its first
// sentences on the face (up to ~200자, cut at a sentence end) and folds the rest under '이어서 읽기'.
export function splitReading(text, { max = 230, lead = 200, min = 60 } = {}) {
  const value = String(text || '').trim();
  if (value.length <= max) return { lead: value, rest: '' };
  let cut = -1;
  const pattern = /[.?!)](?=\s)/g;
  for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
    const end = match.index + 1;
    if (end > lead) break;
    if (end >= min && (match[0] !== ')' || value[match.index - 1] === '.')) cut = end;
  }
  return cut < 0 ? { lead: value, rest: '' } : { lead: value.slice(0, cut), rest: value.slice(cut).trim() };
}

function readingNodes(doc, text, className, topic = '') {
  const { lead, rest } = splitReading(text);
  const nodes = [el(doc, 'p', lead, className)];
  if (rest) {
    const more = el(doc, 'details', null, 'regime-read-more');
    // v57.61 WCAG 2.4.6: several cards fold under the same words — the summary names its card for screen readers.
    const summary = el(doc, 'summary', '이어서 읽기');
    if (topic) summary.append(el(doc, 'span', ` — ${topic}`, 'sr-only'));
    more.append(summary, el(doc, 'p', rest, className));
    nodes.push(more);
  }
  return nodes;
}

// v57.55 review (E1-02/B4-F7): the credit axis needs the 20-session HY change from macro-history. Only 오늘 and 시장 상태
// asked for it, so the 차트 tab and 포트폴리오 judged credit without it ('양호 3' beside '양호 2 · 중립 2'). Every reader
// now asks for the same record (deduplicated in-flight) and redraws once it lands.
export function readMarketRegime(root, onHistory = null) {
  if (root && sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) {
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => { if (changed && typeof onHistory === 'function') onHistory(); }).catch(() => {});
  }
  return marketInterpretation(root).regime;
}

function summaryLine(regime) {
  const { favorable, neutral, burden, unknown } = regime.counts;
  return `양호 ${favorable}, 중립 ${neutral}, 부담 ${burden}${unknown ? `, 확인 불가 ${unknown}` : ''}`;
}

// P1505 (owner 2026-10-06: no source text on the face of the screen): each axis keeps its source as a hover title and
// in the page-level 데이터 출처 fold, so a user checking a number can still find the series.
const AXIS_SOURCES = Object.freeze({
  trend: 'S&P 500·나스닥 100·나스닥 종합·러셀 2000 일봉 종가 (Yahoo Finance)', // v57.81: the cross-index evidence rows
  breadth: '스크리너 유니버스 구성 종목의 수정 종가로 자체 계산',
  volatility: 'VIX·VIX3M (Cboe 지수, Yahoo Finance 경유)',
  rates: '미 국채 수익률 (미 재무부 공시 par curve, FRED DGS2/DGS10)',
  credit: 'ICE BofA 하이일드 OAS (FRED BAMLH0A0HYM2), CNN Fear & Greed',
  commodities: 'WTI 선물·금 선물·달러 인덱스 (Yahoo Finance)',
  korea: '원/달러·엔/달러·코스피 (Yahoo Finance)'
});

// v57.50 D01: home reads the same credit axis (20-session HY change from macro-history) as 시장 상태; without it home
// showed '집중 유지 4/4' with credit '양호' while 시장 상태 showed 3/4 with credit '중립'.
function requestRegimeMacroHistory(root, doc, pageId = 'page-signal', rerender = () => renderRegimePage({ documentRef: doc, root })) {
  if (!sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) return;
  refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
    if (changed && doc.getElementById(pageId)?.classList?.contains('active')) rerender();
  }).catch(() => {});
}

function chartPanel(doc, charts, range) {
  if (!charts.length || !range) return null;
  const panel = el(doc, 'div', null, 'regime-axis-history');
  // v58.79 (layout over captions): the chart's axes carry the unit and dates; the caption stays for screen readers.
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

// I03: "관련 섹터·테마" names are buttons — a theme opens its detail page, a sector (or a theme without an id) opens
// 테마 · 섹터. Without link data the plain sentence stays.
function opportunityNode(doc, root, view, className) {
  const node = el(doc, 'p', null, className);
  const parts = Array.isArray(view?.opportunityLinks) ? view.opportunityLinks.filter((part) => part?.links?.length) : [];
  if (!parts.length) { node.textContent = view?.opportunity || ''; return node; }
  parts.forEach((part, index) => {
    if (index) node.append(doc.createTextNode(', '));
    node.append(doc.createTextNode(`${part.label}: `));
    part.links.forEach((link, at) => {
      if (at) node.append(doc.createTextNode(', ')); // v58.80: the names ran together ("소재에너지헬스케어")
      const button = el(doc, 'button', link.label, 'regime-opportunity-chip');
      button.type = 'button';
      button.title = link.kind === 'theme' && link.themeId ? `${link.label} 테마 상세` : '테마와 섹터 화면에서 보기';
      button.addEventListener('click', () => {
        if (link.kind === 'theme' && link.themeId && typeof root?.showThemeDetail === 'function') root.showThemeDetail(link.themeId);
        else root?.showPage?.('themes');
      });
      node.append(button);
    });
  });
  return node;
}

function listBlock(doc, title, items) {
  const box = el(doc, 'div', null, 'regime-scenario-list');
  box.append(el(doc, 'h4', title));
  const list = el(doc, 'ul'); for (const item of items || []) list.append(el(doc, 'li', item)); box.append(list);
  return box;
}

// P1633: each path says how likely it is from today's conditions and what it would mean for the
// reader (possibility and opportunity cost), with check / caution / ignore lists on demand.
function scenarioSection(doc, root, model, outlook, openIds = new Set()) {
  const section = el(doc, 'section', null, 'regime-scenarios');
  section.dataset.aioRegimeScenarios = 'native';
  section.id = 'regime-structure';
  // v57.76: this section is the current-state reading (which of three flows the market is closest to); the forward
  // branches by release live in full on 거시 only, so the heading no longer says 향후 시나리오 and the section ends
  // with one link there.
  // v58.79 section frame: title + close chip; "맞는 조건 수, 확률 아님" and the hand-off to 거시 are the chip's hover.
  section.append(frameHead(doc, { title: '지금 시장 흐름 — 세 가지 중 어디에 가까운가', titleClass: 'briefing-h2', asOf: model.asOf ? `${shortDate(model.asOf)} 종가` : '기준일 미확인',
    asOfDetail: '지금 시장이 세 흐름 중 어디에 가까운지(맞는 조건 수, 확률 아님)를 봅니다. 다음 발표가 이 흐름을 어느 쪽으로 옮길지는 거시 화면에서 이어 봅니다.' }));
  markFrame(section, 'signal.scenarios');
  if (!model.available) { section.append(el(doc, 'p', model.reason, 'regime-scenario-hold'), scenarioLink(doc, root)); return section; }
  if (model.reason) section.append(el(doc, 'p', model.reason, 'regime-scenario-hold'));
  if (outlook?.available) section.append(el(doc, 'p', outlook.headline, 'regime-scenario-lead'));
  const byId = Object.fromEntries((outlook?.items || []).map((item) => [item.id, item]));
  const grid = el(doc, 'div', null, 'regime-scenario-grid');
  for (const scenario of model.scenarios) {
    const view = byId[scenario.id];
    const card = el(doc, 'article', null, 'regime-scenario-card');
    card.dataset.scenario = scenario.id; card.dataset.confirmed = String(scenario.confirmed);
    if (view) card.dataset.likelihood = view.likelihood;
    if (outlook?.leadId === scenario.id) card.dataset.lead = 'true';
    const head = el(doc, 'div', null, 'regime-scenario-head');
    // v57.81: while the leadership break holds, the weakness card is titled as the transition and its count names 동반 약세.
    head.append(el(doc, 'h3', view?.transition ? view.title : scenario.title), el(doc, 'span', view ? `${view.transition ? '동반 약세 ' : ''}${view.fit}${view.shortfall ? ', 아직 성립 아님' : ''}` : scenario.status, 'regime-scenario-status'));
    if (view?.shortfall) head.lastChild.title = view.shortfall; // v57.55 review (E2-06)
    card.append(head);
    if (view) {
      card.append(el(doc, 'p', view.posture, 'regime-scenario-reading'));
      card.append(opportunityNode(doc, root, view, 'regime-scenario-opportunity'));
    } else card.append(el(doc, 'p', scenario.interpretation, 'regime-scenario-reading'));
    const more = el(doc, 'details', null, 'regime-scenario-more');
    more.open = openIds.has(scenario.id);
    more.append(el(doc, 'summary', '확인할 것, 조심할 것, 넘겨도 되는 것'));
    if (view) {
      more.append(el(doc, 'p', `조건 근거: ${view.basis}`, 'regime-scenario-basis'));
      more.append(listBlock(doc, '확인할 것', view.check), listBlock(doc, '조심할 것', view.caution), listBlock(doc, '넘겨도 되는 것', view.ignore));
    }
    more.append(el(doc, 'h4', '이 흐름의 뜻'), el(doc, 'p', scenario.interpretation));
    more.append(listBlock(doc, '성립 조건', scenario.conditions));
    more.append(el(doc, 'h4', '이 해석이 틀렸다는 신호'), el(doc, 'p', scenario.counterEvidence));
    card.append(more);
    grid.append(card);
  }
  section.append(grid, scenarioLink(doc, root));
  return section;
}

// v57.76: the compact "다음 발표에 달린 시나리오" block repeated 거시's branches here; one link line replaces it, using the
// same root.showPage + section scroll as the other cross-screen links (home's 세 구조 link, the crossroads links).
function scenarioLink(doc, root) {
  const line = el(doc, 'p', null, 'regime-scenario-next');
  const button = el(doc, 'button', '다음 발표별 시나리오 → 거시', 'flow-next-link');
  button.type = 'button';
  button.addEventListener('click', () => showCrossroadsSection(doc, root));
  line.append(button);
  return line;
}

// v58.53 개편 v2 (3b): the axis table's row labels, the academic line under each opened row (authors · year only) and
// the axis whose burden opens first. Static reference text; live values come from the regime rows.
// v58.80 (first-users bundle 7): the subtitle was the English axis name (Trend, Breadth, …); it now says what the axis watches.
const AXIS_WATCH = Object.freeze({ trend: 'S&P 500 가격 흐름', breadth: '오르는 종목의 넓이', volatility: '지수가 흔들리는 크기', credit: '회사채가 더 얹는 금리', rates: '국채 금리', commodities: '달러 지수와 국제 유가' });
const AXIS_REFS = Object.freeze({
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
  credit: ['하이일드'], rates: ['미 10년물'], commodities: ['달러 인덱스', 'WTI']
});
const OPEN_FIRST = ['breadth', 'trend', 'credit', 'rates', 'volatility', 'commodities'];
const TONE = { favorable: 'good', burden: 'warn', neutral: 'neutral', unknown: 'neutral' };

function faceValue(row) {
  const parts = (AXIS_FACE[row.id] || []).map((prefix) => row.evidence.find(([label]) => label.startsWith(prefix))).filter(Boolean);
  const shown = parts.length ? parts : row.evidence.slice(0, 1);
  // The face keeps the value and its observation date (buildMarketRegime appends ' · M/D' when an axis mixes dates);
  // parentheticals and record notes ('기록 243일 중 …') stay in the opened row.
  // v58.74 (text audit): a credit row judged 부담 at 340bp — below every level line — kept only the level on its face; the
  // 20-session widening that made it 부담 now stays beside it.
  const face = (value) => {
    const [head, ...rest] = String(value).replace(/\s*\([^)]*\)/g, '').split(/ · |, /);
    const widening = row.id === 'credit' && row.state === 'burden' ? String(value).match(/20거래일 [+-]\d+bp/)?.[0] : null;
    return [head, ...(widening ? [widening] : []), ...rest.filter((part) => /^\d{1,2}\/\d{1,2}$/.test(part.trim()))].join(', ');
  };
  return shown.map(([label, value]) => `${label.replace(/\s*\(.*\)$/, '')} ${face(value)}`).join(', ');
}

// The five-session change of each axis's headline series, from the same completed closes the axis reads.
function fiveDayChange(id, inputs, asOf) {
  const series = (field) => buildCloseSeries(inputs?.history || [], field, { through: asOf });
  const delta = (field, kind) => {
    const points = series(field);
    const last = points.at(-1), base = points.at(-6);
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
    // Only the 5-session change the credit axis itself admits (aligned to the close basis, like take(..., alignments.hy)).
    const hy5 = Number(inputs?.credit?.hyDelta5Bp);
    const usable = inputs?.credit?.hyDelta5Bp != null && Number.isFinite(hy5) && isUsable(alignInput(inputs?.credit?.hyAsOf, asOf));
    return usable ? signedText(hy5, 0, 'bp') : null;
  }
  return null;
}

// v58.55 (owner 2026-10-20): the design's 기준까지 column — the nearest threshold of the axis rule (regime axis.flipDistance,
// measured in the indicator's own unit) in bold, the line it is measured to under it.
function distanceCell(doc, row) {
  const cell = el(doc, 'span', null, 'mk-axis__dist');
  const d = row.flipDistance;
  if (!d) { cell.textContent = '—'; cell.classList.add('is-empty'); return cell; }
  cell.dataset.direction = d.direction;
  cell.append(el(doc, 'b', d.label, 'mk-axis__dist-value'), el(doc, 'span', `${d.short}${d.also?.length ? ', 함께 필요' : ''}`, 'mk-axis__dist-basis'));
  cell.title = `종가 기준, ${d.condition} ${row.title} → ${d.towardLabel}${(d.also || []).map((also) => `, 함께 필요: ${also.condition}${also.text ? ` (${also.text})` : ''}`).join('')}`;
  return cell;
}

// The screens that render an axis's AXIS_DEEP_DIVES teaching blocks in full (breadth-board deepDiveFold, macro-board axisCard).
const AXIS_PRINCIPLE_HOME = Object.freeze({
  breadth: { route: 'breadth', label: '시장 폭' },
  rates: { route: 'macro', label: '거시 경제' },
  credit: { route: 'macro', label: '거시 경제' },
  commodities: { route: 'macro', label: '거시 경제' }
});

function axisRow(doc, root, row, { history, scenarios, previous, inputs, asOf, open }) {
  const card = el(doc, 'details', null, 'regime-axis sx-disclosure mk-axis');
  card.dataset.axis = row.id;
  card.dataset.state = row.state;
  card.open = !!open;
  const summary = el(doc, 'summary', null, 'mk-axis__row');
  const name = el(doc, 'span', null, 'mk-axis__name');
  name.append(el(doc, 'b', row.title), el(doc, 'span', AXIS_WATCH[row.id] || '', 'mk-axis__en'));
  const prev = previous?.axes?.find((axis) => axis.id === row.id);
  // A previous state rebuilt from partial inputs (prev.partial) is not shown as a flip.
  const prevShown = prev && !prev.partial ? prev : null;
  const prevText = prevShown ? (prevShown.state === row.state ? `${prevShown.stateLabel}, 같음` : `${prevShown.stateLabel} → ${row.stateLabel}`) : '—';
  const rule = el(doc, 'span', row.flip || '—', 'mk-axis__rule');
  if (row.flip) rule.title = row.flip;
  summary.append(name, el(doc, 'span', row.stateLabel, `sx-chip sx-chip--sm sx-chip--${TONE[row.state] || 'neutral'} mk-axis__state`),
    el(doc, 'span', faceValue(row) || '최신 관측 없음', 'mk-axis__value'), rule, distanceCell(doc, row),
    el(doc, 'span', prevText, `mk-axis__prev${prevShown && prevShown.state !== row.state ? ' is-changed' : ''}`),
    el(doc, 'span', fiveDayChange(row.id, inputs, asOf) || '—', 'mk-axis__d5'));
  card.append(summary);
  // ③ three cards: 원리 / 지금 읽기 / 한계 · 함께 볼 것 (the teaching blocks of axis-deep-dives, today's reading between them).
  const deep = AXIS_DEEP_DIVES[row.id];
  const blocks = deep?.blocks || [];
  const body = el(doc, 'div', null, 'sx-disclosure__body mk-axis__body');
  const cardOf = (label, ...nodes) => { const box = el(doc, 'div', null, 'sx-disclosure__card'); box.append(el(doc, 'span', label, 'sx-disclosure__label'), ...nodes); return box; };
  const readNow = cardOf('지금 읽기', ...readingNodes(doc, row.read, 'regime-read', row.title));
  // P1399: one basis chip per axis — its own observation date against the close basis.
  if (row.basis) readNow.append(el(doc, 'span', row.basis, `basis-chip${row.basisStatus === 'aligned' ? '' : ' is-off'}`));
  // v58.75 (persona review): an axis whose principle text is already the teaching block of its own screen (시장 폭 page;
  // the 거시 factor cards for rates, credit, oil·dollar) points there instead of repeating it word for word; the verdict,
  // its evidence, the thresholds and dates below stay.
  const home = AXIS_PRINCIPLE_HOME[row.id];
  if (home) {
    const go = el(doc, 'button', `${home.label}에서 원리 보기`, 'flow-next-link');
    go.type = 'button';
    go.dataset.action = 'showPage';
    go.dataset.arg = home.route;
    body.append(readNow, cardOf('원리, 읽는 법', el(doc, 'p', `이 지표가 무엇을 재고 전문가가 어떻게 읽는지는 ${home.label} 화면에 있습니다. 여기서는 판정과 기준, 근거 숫자만 봅니다.`, 'sx-disclosure__text'), go));
  } else {
    body.append(cardOf('원리', el(doc, 'p', blocks[0]?.[1] || '', 'sx-disclosure__text')), readNow,
      cardOf('읽는 법, 함께 볼 것', ...blocks.slice(1).map(([, text]) => el(doc, 'p', text, 'sx-disclosure__text'))));
  }
  // The chart, every evidence row and the flip condition stay one level down in the opened row.
  const detail = el(doc, 'div', null, 'mk-axis__detail');
  const chart = chartPanel(doc, history.axes[row.id] || [], history.range);
  if (chart) detail.append(chart);
  const facts = el(doc, 'div', null, 'mk-axis__facts');
  if (row.evidence.length) { const list = el(doc, 'dl', null, 'regime-evidence'); for (const [label, value] of row.evidence) list.append(el(doc, 'dt', label), el(doc, 'dd', value)); facts.append(list); }
  if (row.flip) {
    const changes = el(doc, 'div', null, 'regime-axis-observe');
    // v58.55: the nearest threshold toward each other state (the rule's own numbers), then the full rule sentence.
    if (row.flipDistances?.length) {
      changes.append(el(doc, 'h4', '가장 가까운 기준'));
      const near = el(doc, 'ul', null, 'mk-axis__near');
      for (const item of row.flipDistances) {
        const li = el(doc, 'li', null, 'mk-axis__near-item');
        li.dataset.direction = item.direction;
        li.append(el(doc, 'b', `${item.direction === 'improve' ? '↑' : '↓'} ${item.towardLabel}까지 ${item.text}`, 'mk-axis__near-value'),
          el(doc, 'span', `${item.condition} ${row.title} → ${item.towardLabel}${(item.also || []).map((also) => `, 함께 필요: ${also.condition}${also.text ? ` (${also.text})` : ''}`).join('')}`, 'mk-axis__near-text'));
        near.append(li);
      }
      changes.append(near);
    }
    changes.append(el(doc, 'h4', '상태가 바뀌는 조건'), el(doc, 'p', row.flip));
    // The 5거래일 전 column folds away below desktop width; the opened row keeps it.
    changes.append(el(doc, 'p', `5거래일 전 판정, ${prevText}`, 'mk-axis__prev-line'));
    facts.append(changes);
  }
  const watch = scenarios.axes?.find((axis) => axis.id === row.id);
  if (row.flip && watch?.observe) facts.append(el(doc, 'h4', '다음 확인'), el(doc, 'p', watch.observe, 'regime-read'));
  const links = deepDiveLinks(doc, root, deep);
  if (links.length) { const nav = el(doc, 'div', null, 'mk-axis__links'); nav.append(...links); facts.append(nav); }
  detail.append(facts);
  body.append(detail);
  card.append(body);
  // P1661 / v57.76: past outcomes after days with a similar VIX fold inside the volatility row (a direct child of it).
  if (row.id === 'volatility') renderStressOutcomes({ documentRef: doc, root, host: card });
  // ④ evidence line: academic basis (authors · year), data source, validation state.
  const evidence = el(doc, 'p', null, 'sx-evidence mk-axis__evidence');
  evidence.append(el(doc, 'span', `학술 근거, ${AXIS_REFS[row.id] || '—'}`), el(doc, 'span', `데이터, ${AXIS_SOURCES[row.id] || '—'}`), el(doc, 'span', '판정 기준, 공개 관례 기준선, 예측력 검증 전'));
  card.append(evidence);
  // Single-open accordion (README: openAxis); the choice survives a repaint of the board.
  card.addEventListener('toggle', () => {
    if (card.open) {
      root.__aioOpenAxis = row.id;
      for (const other of card.parentElement?.children || []) if (other !== card && other.open) other.open = false;
    } else if (root.__aioOpenAxis === row.id) root.__aioOpenAxis = '';
  });
  return card;
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

function comboAndWatch(doc, root, regime, interpretation) {
  const conflicts = doc.getElementById('regime-conflicts');
  if (conflicts) {
    const items = (regime.conflicts || []).map((text) => el(doc, 'li', text));
    conflicts.replaceChildren(...(items.length ? items : regime.available ? [el(doc, 'li', '지표끼리 엇갈리는 조합이 없습니다 — 여섯 지표가 같은 쪽을 가리키거나 중립입니다.')] : []));
  }
  const watch = doc.getElementById('regime-watch');
  if (!watch) return;
  const items = [];
  const next = interpretation.crossroads?.nextEvent;
  if (next?.name && next?.date) items.push([`${next.when || shortDate(next.date)} ${next.name}`, '발표별 시나리오는 거시 화면에서 봅니다.']);
  for (const check of interpretation.marketRead?.checks || []) if (items.length < 4) items.push([check, '']);
  watch.replaceChildren(...items.map(([title, note], index) => {
    const item = el(doc, 'li', null, 'mk-watch__item');
    const text = el(doc, 'span', null, 'mk-watch__text');
    text.append(el(doc, 'b', title));
    if (note) text.append(el(doc, 'span', note, 'mk-watch__note'));
    item.append(el(doc, 'span', String(index + 1), 'mk-watch__num'), text);
    return item;
  }));
  watch.closest?.('section')?.toggleAttribute?.('hidden', !items.length);
}

// v57.78 perf: `store` (optional) lets the scenario outlook read the native screener rows in place instead of the
// legacy bridge, which deep-clones the row set on every call; fixtures that omit it keep the bridge read.
// v58.53 개편 v2 (3b): ① hero (verdict · tally bar · previous verdict) → ② six-axis table whose rows open single-file
// into ③ 원리 / 지금 읽기 / 한계 cards with the chart and evidence → ④ evidence line; then 이 조합이 뜻하는 것 ·
// 다음에 확인할 것, and the radar, the three market flows and the Korea board as lower cards.
export function renderRegimePage({ documentRef: doc, root, store = null }) {
  const page = doc?.getElementById('page-signal');
  if (!page) return null;
  // Owner 2026-10-19: regime, structure flows and outlook come from the shared interpretation (one build per data change).
  const interpretation = marketInterpretation(root, { store });
  const { inputs, regime } = interpretation;
  requestRegimeMacroHistory(root, doc, 'page-signal', () => renderRegimePage({ documentRef: doc, root, store }));
  const history = buildRegimeAxisHistory(inputs, { regime, macroHistory: root._aioMacroHistory || null });
  const scenarios = interpretation.scenarios || { available: false };
  const previous = previousRegime({ ...inputs, macroHistory: inputs?.macroHistory || root._aioMacroHistory || null }, regime);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('regime-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준, 6개 지표, 공개 기준선` : '종가 기록을 불러오는 중입니다.');
  // F01: before the closes load, a verdict the static shell painted from today-verdict.json stays (not '판정 대기').
  const overall = regime.available || !doc.getElementById('home-hero-total')?.dataset?.firstPaint ? set('regime-overall', regime.available ? regime.overall : '판정 대기') : doc.getElementById('regime-overall');
  if (overall) { overall.dataset.overall = regime.overall || ''; overall.setAttribute('aria-label', `미국 시장 판정: ${regime.available ? regime.overall : '판정 대기'}`); } // v57.77 (a11y 2.4.6)
  // The tally bar's legend carries the counts; this line stays for a held verdict (its reason) only.
  set('regime-counts', regime.available ? (regime.holdReason || (doc.getElementById('regime-tally') ? '' : summaryLine(regime))) : '');
  const breadthRow = (regime.axes || []).find((row) => row.id === 'breadth');
  // v58.68: the leadership break is told by its own line (regime-leaders) below the headline.
  set('regime-shape', !regime.leadershipBreak && breadthRow?.narrow ? '좁은 장세, 소수 종목이 지수를 받침' : '');
  const read = interpretation.marketRead;
  // v59.44 (owner 2026-10-30): a '혼조' held there by weak AI·semiconductor leaders over a favourable count says so first.
  const capLine = regime.leadershipCap && regime.heroLine ? `${regime.heroLine} ` : '';
  set('regime-headline', read?.headline ? `${capLine}${read.headline}${read.headlineReading ? ` ${read.headlineReading}` : ''}` : capLine.trim());
  paintLeadershipLine(doc, 'regime-leaders', regime.available ? regime.leadershipVerdict : null, interpretation.flow);
  // v58.75 (persona review): the distribution-day strip is a lazy chunk (not first-paint critical; boot budget).
  if (regime.available) import('./distribution-strip.js').then(({ distributionStrip }) => {
    const node = doc.getElementById('regime-leaders');
    if (!node) return;
    node.querySelector(':scope > .leaders-line__dist')?.remove();
    const strip = distributionStrip(doc, inputs?.history || root._aioHistory, regime.asOf);
    if (strip) { node.append(strip); node.hidden = false; }
  }).catch(() => {});
  heroSide(doc, regime, previous);
  comboAndWatch(doc, root, regime, interpretation);
  // v58.75 (persona review, spec F1): the four choices' conditional costs and the nearest flips, under the axis table (lazy).
  const axesCard = doc.getElementById('regime-board')?.closest?.('section');
  if (axesCard) import('./regime-choices.js').then(({ renderRegimeChoices }) => renderRegimeChoices({ documentRef: doc, guide: interpretation.guide, axes: regime.available ? regime.axes : [], anchor: axesCard })).catch(() => {});
  const board = doc.getElementById('regime-board');
  const boardKr = doc.getElementById('regime-board-kr');
  if (board) {
    board.classList.add('regime-quality-board');
    const usAxes = regime.axes.filter((row) => row.id !== 'korea');
    // README: the default open row is the key burden axis (시장 폭 first); a reader's own choice (or closing all) is kept.
    const openId = typeof root.__aioOpenAxis === 'string' ? root.__aioOpenAxis
      : OPEN_FIRST.find((id) => usAxes.some((row) => row.id === id && row.state === 'burden')) || '';
    // P1428: the US six axes and the Korea FX card are drawn apart (the tally counts only the six).
    board.replaceChildren(...usAxes.map((row) => axisRow(doc, root, row, { history, scenarios, previous, inputs, asOf: regime.asOf, open: row.id === openId })));
    const radarHost = doc.getElementById('regime-radar-host');
    if (regime.available) renderRegimeRadar({ documentRef: doc, root, inputs, anchor: radarHost || board, verdicts: regime.axes }); // P1637
    if (boardKr) {
      boardKr.classList.add('regime-quality-board', 'regime-quality-korea');
      const korea = buildKoreaRegimeObservations(inputs, { through: regime.asOf || null });
      const cards = korea.cards.map(item => {
        const section = el(doc, 'section', null, 'regime-axis'); section.dataset.axis = item.id; section.dataset.market = 'KR';
        section.append(el(doc, 'h3', item.title, 'regime-axis-title'), el(doc, 'p', `${item.scope}, ${item.asOf}${item.stale ? ', 지연 자료' : ''}`, 'regime-chart-caption'),
          el(doc, 'p', `${item.last.toLocaleString('en-US', { maximumFractionDigits: item.id === 'usdkrw' ? 2 : 2 })} ${item.unit}`, 'regime-korea-value'), el(doc, 'p', item.read, 'regime-read'));
        if (item.series.length > 1) { const chart = chartPanel(doc, [{ id: item.id, title: item.title, unit: item.unit, series: item.series, format: value => value.toLocaleString('en-US', { maximumFractionDigits: 0 }) }], [item.series[0].date, item.series.at(-1).date]); if (chart) section.append(chart); }
        section.append(el(doc, 'p', item.observe, 'regime-read'));
        // P1628: keep the existing yen/carry reference available while separating
        // Korea's equity sessions from the US-aligned FX regime.
        if (item.id === 'usdkrw') {
          const reference = regime.axes.find(axis => axis.id === 'korea');
          if (reference?.evidence?.length) {
            const details = el(doc, 'details', null, 'regime-axis-details');
            details.append(el(doc, 'summary', '원·엔 연결 근거와 관찰'), el(doc, 'p', `미국 종가 기준에 맞춘 환율 참고, ${reference.basis || '관측일 미확인'}`));
            const evidence = el(doc, 'dl', null, 'regime-evidence'); for (const [label, value] of reference.evidence) evidence.append(el(doc, 'dt', label), el(doc, 'dd', value));
            details.append(evidence, el(doc, 'p', reference.read));
            if (reference.flip) details.append(el(doc, 'p', reference.flip));
            section.append(details);
          }
        }
        return section;
      });
      boardKr.replaceChildren(...cards);
      boardKr.hidden = !cards.length;
      const krSection = boardKr.closest?.('section.mk-korea');
      if (krSection) krSection.hidden = !cards.length; // the 한국 시장 참고 card goes with its board
      // v58.56 (re-audit #16): the folded card's one line carries the latest KRX close (same record as the 오늘 line).
      const krSummary = doc.getElementById('regime-kr-summary');
      if (krSummary) {
        const parts = koreaIndexParts(root._aioHistory || []);
        krSummary.textContent = parts.kospi ? `${shortDate(parts.kospi.date)} 마감, ${parts.kospi.text}` : '위 6개 지표 합계 제외';
        krSummary.title = '한국 정규장 확정 종가, 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않는 참고입니다';
      }
    }
  }
  const previousNode = page.querySelector('[data-aio-regime-scenarios]');
  const openIds = new Set([...(previousNode?.querySelectorAll?.('.regime-scenario-more[open]') || [])].map(node => node.closest('.regime-scenario-card')?.dataset.scenario));
  previousNode?.remove();
  root.__aioScenarioOutlook = interpretation.outlook;
  const scenarioNode = board ? scenarioSection(doc, root, scenarios, root.__aioScenarioOutlook, openIds) : null;
  const structureHost = doc.getElementById('regime-structure-host');
  if (scenarioNode && structureHost) structureHost.append(scenarioNode);
  else if (scenarioNode) board.insertAdjacentElement('afterend', scenarioNode); // v57.76: the branches by release are on 거시; the section ends with a link there
  renderNextSteps(doc, doc.getElementById('regime-next'), regimeFlow({ regime, groups: root.__aioScenarioOutlook?.rotation || {} }).next); // P1431, I02
  // P1727: a link that asked for a section of this page (the briefing's Korea sentence -> 한국 시장 참고) shows it once.
  const handoff = consumeResearchHandoff({ root, routeId: 'signal' });
  const anchorId = handoff?.context?.anchor ? String(handoff.context.anchor) : '';
  if (/^[a-z0-9-]+$/i.test(anchorId)) {
    const section = doc.getElementById(anchorId);
    // v58.56 (re-audit #16): the Korea card is folded; a link that asks for it opens the fold first.
    const fold = section?.closest?.('details');
    if (fold) fold.open = true;
    const heading = fold ? fold.closest('section') || fold : section?.previousElementSibling?.tagName === 'H2' ? section.previousElementSibling : section;
    heading?.scrollIntoView?.({ block: 'start' });
  }
  page.dataset.aioRegimeRenderer = 'native';
  return regime;
}

// P1651: home summarized only the six US axes, so a -3.6% KOSPI day (-8.4% over five KRX sessions) after the US
// close appeared only as a small ticker number. One line states the latest completed KRX session on its own date.
// v58.56: shared by the 오늘 line and the folded 한국 시장 참고 summary on 시장 상태.
function koreaIndexParts(history) {
  const part = (field, title) => {
    const series = buildKoreaIndexSeries(history, field);
    const last = series.at(-1), prev = series.at(-2), prior5 = series.at(-6);
    if (!last) return null;
    const pctOf = (base) => base?.value > 0 ? (last.value / base.value - 1) * 100 : null;
    const signed = (v) => v == null ? null : `${signedText(v, 1)}%`;
    const d1 = signed(pctOf(prev)), d5 = signed(pctOf(prior5));
    return { date: last.date, text: `${title} ${last.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${d1 ? ` (${d1}${d5 ? `, 5거래일 ${d5}` : ''})` : ''}`, d5: pctOf(prior5) };
  };
  return { kospi: part('kospi', '코스피'), kosdaq: part('kosdaq', '코스닥') };
}

// v58.68 (owner 2026-10-23): the AI·semiconductor leaders' own verdict, shown under the six-axis verdict on 오늘 and
// 시장 상태 (domain/market/leadership-verdict.js). It names the leaders' state; the six-axis count is unchanged.
// The money-flow part (domain/market/market-flow.js) follows it: where the session's money went across sectors and
// sub-themes, with the 10-year yield and fear on the same session.
function linePart(doc, { title, state, burden = false, read, evidence, tip }) {
  const part = el(doc, 'div', null, 'leaders-line__part');
  const head = el(doc, 'div', null, 'leaders-line__head');
  const chip = el(doc, 'span', state, 'leaders-line__state');
  if (burden) chip.classList.add('is-burden');
  head.append(el(doc, 'span', title, 'leaders-line__label'), chip, el(doc, 'span', read, 'leaders-line__read'));
  part.append(head, ...(evidence ? [el(doc, 'div', evidence, 'leaders-line__evidence')] : []));
  part.title = tip;
  return part;
}
function paintLeadershipLine(doc, id, verdict, flow = null) {
  const node = doc.getElementById(id);
  if (!node) return;
  const parts = [];
  if (verdict?.available) {
    parts.push(linePart(doc, { title: '주도 영역 (AI·반도체)', state: verdict.label, burden: verdict.state === 'break' || verdict.state === 'weak' || verdict.shock, read: verdict.read, evidence: verdict.line,
      tip: '반도체 ETF(SMH)·나스닥 100의 추세와 하루 변화, 미국 종목의 최근 종가 신저가 수로 냅니다. 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않습니다.' }));
  }
  if (flow?.available) {
    const part = linePart(doc, { title: '자금 흐름', state: flow.label, read: flow.read, evidence: flow.line,
      tip: '미국 섹터 ETF의 하루 등락, 같은 날 10년물 금리 변화와 공포·탐욕 지수로 냅니다. 성장(기술·통신·반도체)과 방어(필수소비재·유틸리티·헬스케어) 업종의 평균 차이가 3%p 이상이면 한쪽으로의 이동으로 봅니다.' });
    const themes = flow.themes;
    if (themes?.available) {
      if (themes.splitLines.length) part.append(el(doc, 'div', `같은 업종 안에서 갈린 곳, ${themes.splitLines.slice(0, 2).join(' / ')}`, 'leaders-line__evidence'));
      if (themes.memberSplitLines?.length) part.append(el(doc, 'div', `같은 테마 안에서 갈린 종목, ${themes.memberSplitLines.slice(0, 2).join(' / ')}`, 'leaders-line__evidence'));
      const more = el(doc, 'details', null, 'leaders-line__more');
      const list = el(doc, 'ul', null, 'leaders-line__list');
      for (const text of [themes.strongLine, themes.weakLine, ...themes.splitLines.slice(2).map((line) => `갈림, ${line}`)].filter(Boolean)) list.append(el(doc, 'li', text));
      more.append(el(doc, 'summary', `테마 ${themes.groups}개 하루 흐름`), list);
      part.append(more);
    }
    parts.push(part);
  }
  if (!parts.length) { node.hidden = true; node.replaceChildren(); return; }
  node.replaceChildren(...parts);
  node.dataset.state = verdict?.available ? verdict.state : 'unknown';
  node.hidden = false;
}

function paintKoreaLine(doc, root) {
  const headline = doc.getElementById('home-hero-headline');
  if (!headline) return;
  let line = doc.getElementById('home-kr-line');
  const history = root._aioHistory || [];
  const { kospi, kosdaq } = koreaIndexParts(history);
  if (!kospi) { if (line) line.hidden = true; return; }
  if (!line) { line = el(doc, 'div', null, 'home-kr-line'); line.id = 'home-kr-line'; headline.insertAdjacentElement('afterend', line); }
  const [, month, day] = kospi.date.split('-').map(Number);
  // P1723: a move rare in AIO's own KOSPI record (1-session or 5-session, outer 5%) is named with that record even when
  // the 5-session change stays under 5%; the US six-axis tally is unchanged.
  const record = koreaMoveRecord(history, { now: Date.now() });
  const rare = record?.extreme && record.date === kospi.date ? koreaRecordText(record, { maxTail: KR_SHOCK_TAIL_PCT }) : '';
  const tone = rare ? ` — 코스피 변화가 ${rare}라 미국장과 따로 확인할 구간입니다.`
    : kospi.d5 != null && Math.abs(kospi.d5) >= 5 ? (kospi.d5 < 0 ? ' — 5거래일 낙폭이 커 미국장과 따로 확인할 구간입니다.' : ' — 5거래일 상승 폭이 커 미국장과 따로 확인할 구간입니다.') : '';
  line.textContent = `한국장 ${month}/${day} 마감, ${[kospi.text, kosdaq?.text].filter(Boolean).join(', ')}${tone}`;
  line.dataset.observedAt = kospi.date;
  line.dataset.market = 'KR';
  line.title = '한국 정규장 확정 종가 기준입니다. 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않습니다.';
  line.hidden = false;
}

let sessionLean = null;

function paintFuturesCell(doc, root, cellId, futures, field, label) {
  const fallback = doc.getElementById(cellId);
  if (!fallback) return;
  const cell = fallback.parentElement;
  const live = Number(root._liveData?.[futures]?.price);
  // P1505: the label follows what the cell shows — the futures name with a futures quote, the cash index name with its close.
  const labelNode = cell?.querySelector('.kpi-label');
  if (labelNode && !labelNode.dataset.futuresLabel) labelNode.dataset.futuresLabel = labelNode.textContent;
  if (Number.isFinite(live) && live > 0) { fallback.hidden = true; cell?.removeAttribute('data-futures-missing'); if (labelNode) labelNode.textContent = labelNode.dataset.futuresLabel; return; }
  const history = root._aioHistory || [];
  const series = buildCloseSeries(history, field, { through: closeBasis(history) });
  const last = series[series.length - 1];
  const prev = sessionPointBack(series, 1); // v58.69: the previous session itself, not the point before a missing close
  if (!last) { fallback.hidden = true; return; }
  const change = prev ? (last.value / prev.value - 1) * 100 : null;
  const [, month, day] = last.date.split('-').map(Number);
  fallback.replaceChildren();
  const value = doc.createElement('span');
  value.className = 'kpi-fallback-value';
  value.textContent = last.value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const note = doc.createElement('span');
  note.className = 'kpi-fallback-note';
  note.textContent = `${month}/${day} 종가${change == null ? '' : ` ${signedText(change, 2, '%')}`}, ${usWeekendClosed() ? '선물 주말 휴장' : '선물 시세 대기 중'}`; // v58.74: CME is shut over the weekend, nothing is pending
  if (labelNode) labelNode.textContent = label;
  fallback.append(value, note);
  fallback.hidden = false;
  cell?.setAttribute('data-futures-missing', 'true');
}

// Home: one line plus the axis states, linking to the full board.
// v57.78 perf: the market inputs are gathered once per render (they were gathered for the regime, again for the
// scenarios, and a third time by the daily loop); the returned regime is handed to renderDailyLoop. The macro-history
// request readMarketRegime made is the same deduplicated request requestRegimeMacroHistory makes below.
export function renderHomeRegime({ documentRef: doc, root, store = null }) {
  const hero = doc?.getElementById('home-score-hero');
  if (!hero) return null;
  const interpretation = marketInterpretation(root, { store });
  const { regime } = interpretation;
  requestRegimeMacroHistory(root, doc, 'page-home', () => renderHomeRegime({ documentRef: doc, root, store }));
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  // v58.55 (design 2b): the page kicker above the 오늘 title — today's date (KST) · the close the verdict is based on.
  // F01: the static shell may have painted the produced verdict (index.html, today-verdict.json); an unavailable regime
  // (closes still loading) leaves it, and the first real render takes the fields over.
  const heroTotal = doc.getElementById('home-hero-total');
  const held = !regime.available && !!heroTotal?.dataset?.firstPaint;
  if (!held && heroTotal?.dataset) delete heroTotal.dataset.firstPaint;
  const kicker = held ? null : doc.getElementById('home-date-label');
  if (kicker) {
    let today = '';
    try { today = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()); } catch (_) { today = ''; }
    const text = [today, regime.available && regime.asOf ? `${shortDate(regime.asOf)} 미국 종가 기준` : ''].filter(Boolean).join(', ');
    if (text) kicker.textContent = text;
  }
  if (!held) set('home-hero-total', regime.available ? regime.overall : '판정 대기');
  // v58.79 (owner 2026-10-25, layout over captions): the close date is in the page subtitle and the six counts are the
  // axis chips below, so this line speaks only when the verdict is held (why) and stays empty (hidden) otherwise.
  if (!held) set('home-hero-headline', regime.available ? (regime.holdReason || (regime.overall === '판정 보류' ? `미국 6개 지표 ${summaryLine(regime)}` : '')) : '종가 기록을 불러오는 중입니다.');
  // v58.56 (re-audit #2): the hero sentence is the regime's one plain line (heroLine); the full conflict sentences with
  // their numbers and rules move into the 6개 축 근거 fold under the axis chips.
  if (!held) set('home-hero-desc', regime.heroLine || '');
  paintLeadershipLine(doc, 'home-hero-leaders', regime.available ? regime.leadershipVerdict : null, interpretation.flow);
  const why = doc.getElementById('home-hero-why');
  const whyList = doc.getElementById('home-hero-why-list');
  if (why && whyList) {
    const lines = regime.available ? (regime.conflicts || []) : [];
    whyList.replaceChildren(...lines.map((text) => el(doc, 'li', text)));
    why.hidden = !lines.length;
  }
  paintKoreaLine(doc, root);
  // v58.81 (owner 2026-10-26): the market clock with the Korea↔US link check, then the probabilistic lean, under the verdict.
  // Loaded after first paint (boot budget); the module also hands the AI context its two readers.
  (sessionLean ||= import('./session-lean.js')).then((mod) => mod.paintHome(doc, root, store, regime, () => renderHomeRegime({ documentRef: doc, root, store }), () => marketInterpretation(root, { store }).regime)).catch(() => { sessionLean = null; });
  // P1429 (Codex review): the two futures cells were the largest items on home and often empty. When a
  // futures quote is missing the cell shows the cash index's last completed close (same history as 시장 상태)
  // and says the futures quote is unavailable; a live futures quote restores the cell.
  // Codex browser audit H01: the fallback was painted once per regime render, so a futures quote arriving later
  // left "선물 시세 미수신 · 10/6 종가" beside the live futures number. The cell is repainted whenever its live
  // value changes, and only one of the two (futures quote or the cash index close) is ever shown.
  for (const spec of [['home-kpi-es-fallback', 'ES=F', 'spx', 'S&P 500 현물'], ['home-kpi-nq-fallback', 'NQ=F', 'ndx', '나스닥 100 현물']]) {
    paintFuturesCell(doc, root, ...spec);
    const cell = doc.getElementById(spec[0])?.parentElement;
    const liveNode = cell?.querySelector?.(`[data-live-price="${spec[1]}"]`);
    const Observer = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (liveNode && !liveNode.dataset.aioFuturesObserved && typeof Observer === 'function') {
      liveNode.dataset.aioFuturesObserved = '1';
      new Observer(() => paintFuturesCell(doc, root, ...spec)).observe(liveNode, { childList: true, characterData: true, subtree: true });
    }
  }
  // P1428: the F&G day change on home uses the completed-close history, the same basis as 투자 심리
  // (it used CNN's own previous_close, so the two screens showed +3 and +2 for the same 31).
  const fgDelta = doc.getElementById('home-fg-delta');
  if (fgDelta) {
    const history = root._aioHistory || [];
    const fg = buildCloseSeries(history, 'fg', { through: closeBasis(history) });
    const change = fg.length > 1 ? Math.round(fg[fg.length - 1].value) - Math.round(fg[fg.length - 2].value) : null;
    fgDelta.textContent = change == null ? '' : `전일 대비 ${change > 0 ? '+' : ''}${change}`;
    fgDelta.className = 'aio-metric-delta';
    fgDelta.dataset.aioFgDeltaRenderer = 'native';
  }
  const chips = doc.getElementById('home-hero-components');
  if (chips) {
    chips.replaceChildren(...regime.axes.map((row) => {
      // v58.80 (first-users run-4): the chips looked clickable and did nothing, and the verdict had no way to its chart.
      // Each chip opens 시장 상태 with that axis (its chart and rule) unfolded.
      const chip = el(doc, 'button', null, 'regime-chip');
      chip.type = 'button';
      chip.dataset.state = row.state;
      chip.addEventListener('click', () => {
        root.showPage?.('signal');
        setTimeout(() => { const axis = doc.querySelector?.(`.mk-axis[data-axis="${row.id}"]`); if (axis) { axis.open = true; axis.scrollIntoView?.({ block: 'start' }); } }, 120);
      });
      // P1592 (F42): the tally above counts the six US axes; the Korea FX card is a reference beside it.
      const reference = row.id === 'korea';
      if (reference) { chip.classList.add('is-reference'); chip.title = '한국 참고 — 위 양호·중립·부담 합계에 넣지 않습니다'; }
      chip.append(el(doc, 'span', reference ? `${row.title}, 참고` : row.title, 'regime-chip-label'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
      return chip;
    }));
    // v58.80 run-5 (impatient #2): the six chips did not read as the way to the verdict's chart; one named link under them
    // opens 시장 상태 with the trend axis (the S&P 500 close chart and its 50-day line) unfolded.
    if (!doc.getElementById('home-hero-chart-link')) {
      const toChart = el(doc, 'button', '판정 근거와 지수 차트 보기 →', 'flow-next-link');
      toChart.type = 'button';
      toChart.id = 'home-hero-chart-link';
      toChart.addEventListener('click', () => {
        root.showPage?.('signal');
        setTimeout(() => { const axis = doc.querySelector?.('.mk-axis[data-axis="trend"]'); if (axis) { axis.open = true; axis.scrollIntoView?.({ block: 'start' }); } }, 120);
      });
      chips.insertAdjacentElement('afterend', toChart);
    }
    // P1633/P1745: home answers "so what" in ONE forward block — the present structure (which of the three it is
    // closest to, and the themes leading it), then the branch the next releases would confirm and where it leads.
    let outlookBox = doc.getElementById('home-outlook');
    // Layout review 2026-10-18: the block is a full-width section of its own, after the completed-close evidence (the
    // close-to-close changes, which T804 keeps right under the verdict, and the participation chart that also anchors
    // there). Inside the hero's flex row it shrank to its text width and left the right of a wide screen empty.
    const outlookAnchor = doc.getElementById('home-participation') || doc.getElementById('home-daily-changes') || hero;
    if (!outlookBox) { outlookBox = el(doc, 'div', null, 'home-outlook'); outlookBox.id = 'home-outlook'; outlookAnchor.insertAdjacentElement('afterend', outlookBox); }
    else if (outlookBox.parentElement === hero) outlookAnchor.insertAdjacentElement('afterend', outlookBox);
    outlookBox.hidden = true; // anchor only; the merged block below carries the structure line
    const scenarios = regime.available ? interpretation.scenarios : null;
    const outlook = interpretation.outlook;
    const lead = outlook?.items?.find((item) => item.id === outlook.leadId);
    const structure = [];
    if (lead) {
      const toStructure = el(doc, 'button', '세 가지 시장 흐름 보기 →', 'flow-next-link');
      toStructure.type = 'button';
      toStructure.addEventListener('click', () => { root.showPage?.('signal'); setTimeout(() => doc.getElementById('regime-structure')?.scrollIntoView?.({ block: 'start' }), 60); });
      // v57.54 audit (9): 오늘 shows the related sectors/themes only as named links; without current names the line is omitted.
      const named = (lead.opportunityLinks || []).some((part) => part?.links?.length);
      // v57.54 (owner review 2026-10-14): the first sentence of the posture and its 반증 line; the middle sentence lives
      // with the three structures on 시장 상태.
      const sentences = String(lead.posture || '').split(/(?<=니다\.)\s+/);
      // v57.81: the transition reading also carries its next checkpoint on home.
      // v58.74 (text audit 오늘 C2): the confirm condition stays beside its 반증, so home reads both sides of the transition.
      const counter = ['확인:', '반증', '다음 확인'].map((prefix) => sentences.find((line) => line.startsWith(prefix))).filter(Boolean).join(' ');
      const line = el(doc, 'p', null, 'xr-structure');
      line.append(el(doc, 'strong', `지금 시장 흐름 '${lead.title}'`), el(doc, 'span', `${lead.fit}${lead.shortfall ? `, ${lead.shortfall}` : ''}`, 'basis-chip'), doc.createTextNode(` ${sentences[0] || ''}`));
      structure.push(line, ...(counter ? [el(doc, 'p', counter, 'xr-structure-note')] : []), ...(named ? [opportunityNode(doc, root, lead, 'home-outlook-opportunity')] : []), toStructure);
    } else if (scenarios?.held) structure.push(el(doc, 'p', `지금 구조: 판단 보류 — ${scenarios.reason}`, 'xr-structure'));
    renderCrossroadsCompact({ documentRef: doc, root, regime, anchor: outlookBox, id: 'home-crossroads', structure, title: '지금 흐름과 다음 발표', headingLevel: 'h2' }); // v57.77 (a11y 1.3.1): home has no h2 before this block // P1742/P1745
    // Owner 2026-10-19: the shared guide (situation · choices across scenarios · lean/avoid · principles) right after it.
    renderHomeGuide({ documentRef: doc, root, store, anchor: outlookBox.nextElementSibling || outlookBox }); // the crossroads block sits right after its anchor
  }
  hero.dataset.aioRegimeRenderer = 'native';
  hero.dataset.state = regime.available ? 'regime' : 'pending';
  return regime;
}
