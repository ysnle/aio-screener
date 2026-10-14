// P1392: 시장 상태 = six-axis regime board (owner decision 2026-10-02: the 0-100 score and the
// swing/day toggle are retired from user surfaces). The home card shows the same board compactly.
import { AXIS_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { renderStressOutcomes } from './stress-outcomes.js';
import { deepDiveFold } from './deep-dive.js';
import { buildCloseSeries, buildMarketRegime, buildMarketRead, closeBasis, koreaMoveRecord, koreaRecordText, KR_SHOCK_TAIL_PCT } from '../../domain/briefing/market-read.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { collectMarketInputs } from './briefing-read.js';
import { regimeFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { createTrendChart } from './trend-chart.js';
import { MACRO_HISTORY, refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { buildRegimeAxisHistory, buildMarketScenarios, buildKoreaRegimeObservations, buildKoreaIndexSeries } from '../../domain/market/regime-scenarios.js';
import { renderRegimeRadar } from './regime-radar.js';
import { outlookForRoot } from './scenario-outlook.js';
import { renderCrossroadsCompact } from './macro-crossroads.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

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

function readingNodes(doc, text, className) {
  const { lead, rest } = splitReading(text);
  const nodes = [el(doc, 'p', lead, className)];
  if (rest) {
    const more = el(doc, 'details', null, 'regime-read-more');
    more.append(el(doc, 'summary', '이어서 읽기'), el(doc, 'p', rest, className));
    nodes.push(more);
  }
  return nodes;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

// v57.55 review (E1-02/B4-F7): the credit axis needs the 20-session HY change from macro-history. Only 오늘 and 시장 상태
// asked for it, so the 차트 tab and 포트폴리오 judged credit without it ('우호 3' beside '우호 2 · 중립 2'). Every reader
// now asks for the same record (deduplicated in-flight) and redraws once it lands.
export function readMarketRegime(root, onHistory = null) {
  if (root && sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) {
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => { if (changed && typeof onHistory === 'function') onHistory(); }).catch(() => {});
  }
  return buildMarketRegime(collectMarketInputs(root));
}

function summaryLine(regime) {
  const { favorable, neutral, burden, unknown } = regime.counts;
  return `우호 ${favorable} · 중립 ${neutral} · 부담 ${burden}${unknown ? ` · 확인 불가 ${unknown}` : ''}`;
}

// P1505 (owner 2026-10-06: no source text on the face of the screen): each axis keeps its source as a hover title and
// in the page-level 데이터 출처 fold, so a user checking a number can still find the series.
const AXIS_SOURCES = Object.freeze({
  trend: 'S&P 500·나스닥 일봉 종가 (Yahoo Finance)',
  breadth: '스크리너 유니버스 구성 종목의 수정 종가로 자체 계산',
  volatility: 'VIX·VIX3M (Cboe 지수, Yahoo Finance 경유)',
  rates: '미 국채 수익률 (미 재무부 공시 par curve · FRED DGS2/DGS10)',
  credit: 'ICE BofA 하이일드 OAS (FRED BAMLH0A0HYM2) · CNN Fear & Greed',
  commodities: 'WTI 선물·금 선물·달러 인덱스 (Yahoo Finance)',
  korea: '원/달러·엔/달러·코스피 (Yahoo Finance)'
});

// v57.50 D01: home reads the same credit axis (20-session HY change from macro-history) as 시장 상태; without it home
// showed '집중 유지 4/4' with credit '우호' while 시장 상태 showed 3/4 with credit '중립'.
function requestRegimeMacroHistory(root, doc, pageId = 'page-signal', rerender = () => renderRegimePage({ documentRef: doc, root })) {
  if (!sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) return;
  refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
    if (changed && doc.getElementById(pageId)?.classList?.contains('active')) rerender();
  }).catch(() => {});
}

function chartPanel(doc, charts, range) {
  if (!charts.length || !range) return null;
  const panel = el(doc, 'div', null, 'regime-axis-history');
  const caption = el(doc, 'p', null, 'regime-chart-caption');
  const plot = el(doc, 'div', null, 'regime-axis-plot');
  const note = el(doc, 'p', null, 'regime-chart-note');
  let buttons = [];
  const show = selected => {
    caption.textContent = `${selected.title} · 세로축 ${selected.unit} · ${selected.series[0].date}~${selected.series.at(-1).date}`;
    plot.replaceChildren(createTrendChart(doc, { ...selected, label: `${selected.title} (${selected.unit})`, range }));
    plot.dataset.historySeries = selected.id;
    note.textContent = selected.note || '';
    note.hidden = !selected.note;
    for (const [button, item] of buttons) button.setAttribute('aria-pressed', item.id === selected.id ? 'true' : 'false');
  };
  if (charts.length > 1) {
    const selectors = el(doc, 'div', null, 'regime-chart-selectors');
    selectors.setAttribute('role', 'group'); selectors.setAttribute('aria-label', '같은 축의 관측 차트 선택');
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
    if (index) node.append(doc.createTextNode(' · '));
    node.append(doc.createTextNode(`${part.label}: `));
    for (const link of part.links) {
      const button = el(doc, 'button', link.label, 'regime-opportunity-chip');
      button.type = 'button';
      button.title = link.kind === 'theme' && link.themeId ? `${link.label} 테마 상세` : '테마 · 섹터 화면에서 보기';
      button.addEventListener('click', () => {
        if (link.kind === 'theme' && link.themeId && typeof root?.showThemeDetail === 'function') root.showThemeDetail(link.themeId);
        else root?.showPage?.('themes');
      });
      node.append(button);
    }
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
  section.append(el(doc, 'h2', '지금 구조와 앞으로의 갈림길', 'briefing-h2'),
    el(doc, 'p', `${model.asOf || '기준일 미확인'} 완료 종가 기준 · 먼저 지금 시장이 세 구조 중 어디에 가까운지(맞는 조건 수, 확률 아님)를 보고, 이어서 다음 발표가 그 구조를 어느 쪽으로 옮길지 봅니다.`, 'regime-scenario-basis'));
  if (!model.available) { section.append(el(doc, 'p', model.reason, 'regime-scenario-hold')); return section; }
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
    head.append(el(doc, 'h3', scenario.title), el(doc, 'span', view ? `${view.fit}${view.shortfall ? ' · 아직 성립 아님' : ''}` : scenario.status, 'regime-scenario-status'));
    if (view?.shortfall) head.lastChild.title = view.shortfall; // v57.55 review (E2-06)
    card.append(head);
    if (view) {
      card.append(el(doc, 'p', view.posture, 'regime-scenario-reading'));
      card.append(opportunityNode(doc, root, view, 'regime-scenario-opportunity'));
    } else card.append(el(doc, 'p', scenario.interpretation, 'regime-scenario-reading'));
    const more = el(doc, 'details', null, 'regime-scenario-more');
    more.open = openIds.has(scenario.id);
    more.append(el(doc, 'summary', '확인할 것 · 조심할 것 · 넘겨도 되는 것'));
    if (view) {
      more.append(el(doc, 'p', `조건 근거: ${view.basis}`, 'regime-scenario-basis'));
      more.append(listBlock(doc, '확인할 것', view.check), listBlock(doc, '조심할 것', view.caution), listBlock(doc, '넘겨도 되는 것', view.ignore));
    }
    more.append(el(doc, 'h4', '이 흐름의 뜻'), el(doc, 'p', scenario.interpretation));
    more.append(listBlock(doc, '유효 조건', scenario.conditions));
    more.append(el(doc, 'h4', '해석을 뒤집는 관측'), el(doc, 'p', scenario.counterEvidence));
    card.append(more);
    grid.append(card);
  }
  section.append(grid);
  return section;
}

export function renderRegimePage({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-signal');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const regime = buildMarketRegime(inputs);
  requestRegimeMacroHistory(root, doc);
  const history = buildRegimeAxisHistory(inputs, { regime, macroHistory: root._aioMacroHistory || null });
  const scenarios = buildMarketScenarios(inputs, { regime });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('regime-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · 6개 축의 상태와 판정이 바뀌는 조건` : '종가 기록을 불러오는 중입니다.');
  const overall = set('regime-overall', regime.available ? regime.overall : '판정 대기');
  if (overall) overall.dataset.overall = regime.overall || '';
  set('regime-counts', regime.available ? (regime.holdReason || summaryLine(regime)) : '');
  const read = regime.available ? buildMarketRead(inputs) : null;
  set('regime-headline', read?.headline ? `${read.headline}${read.headlineReading ? ` ${read.headlineReading}` : ''}` : '');
  const conflicts = doc.getElementById('regime-conflicts');
  if (conflicts) conflicts.replaceChildren(...(regime.conflicts || []).map((text) => el(doc, 'li', text)));
  const board = doc.getElementById('regime-board');
  const boardKr = doc.getElementById('regime-board-kr');
  if (board) {
    board.classList.add('regime-quality-board');
    // P1428: the US six axes and the Korea FX card are drawn apart (the tally counts only the six).
    const card = (row) => {
      const card = el(doc, 'section', null, 'regime-axis');
      card.dataset.axis = row.id;
      card.dataset.state = row.state;
      const head = el(doc, 'div', null, 'regime-axis-head');
      head.append(el(doc, 'h3', row.title, 'regime-axis-title'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
      card.append(head);
      // P1399: one basis chip per card — the axis's own observation date against the close basis.
      if (row.basis) card.append(el(doc, 'span', row.basis, `basis-chip${row.basisStatus === 'aligned' ? '' : ' is-off'}`));
      card.append(...readingNodes(doc, row.read, 'regime-read'));
      const chart = chartPanel(doc, history.axes[row.id] || [], history.range);
      if (chart) card.append(chart);
      // P1659 (owner reading standard: one visual, a short reading, folded details): the face keeps the chart, the
      // reading, the headline number and the condition that would change the state; the rest of the evidence rows
      // and the generic "다음 확인" line move into the card's fold. Six cards were ~2,650px tall on desktop.
      const list = el(doc, 'dl', null, 'regime-evidence');
      for (const [label, value] of row.evidence.slice(0, 1)) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
      if (row.evidence.length) card.append(list);
      const watch = scenarios.axes?.find(axis => axis.id === row.id);
      if (row.flip) {
        const changes = el(doc, 'div', null, 'regime-axis-observe');
        changes.append(el(doc, 'h4', '상태가 바뀌는 조건'), el(doc, 'p', row.flip));
        card.append(changes);
      }
      // P1660 (owner 2026-10-12): the fold teaches — the principle, how practitioners read it, how it links to the
      // other axes — then today's remaining numbers and a link to the page that goes deeper. Sources stay on hover.
      const extra = [];
      if (row.evidence.length > 1) { const list = el(doc, 'dl', null, 'regime-evidence'); for (const [label, value] of row.evidence.slice(1)) list.append(el(doc, 'dt', label), el(doc, 'dd', value)); extra.push(el(doc, 'h4', '지금 숫자 더 보기'), list); }
      if (row.flip && watch?.observe) extra.push(el(doc, 'h4', '다음 확인'), el(doc, 'p', watch.observe));
      const details = deepDiveFold(doc, root, row.title, AXIS_DEEP_DIVES[row.id], extra);
      if (details) card.append(details);
      if (AXIS_SOURCES[row.id]) card.title = `출처: ${AXIS_SOURCES[row.id]}`; // P1505: on hover, not on the face of the card
      return card;
    };
    board.replaceChildren(...regime.axes.filter((row) => row.id !== 'korea').map(card));
    if (regime.available) renderRegimeRadar({ documentRef: doc, root, inputs, anchor: board, verdicts: regime.axes }); // P1637
    renderStressOutcomes({ documentRef: doc, root, anchor: board }); // P1661: past outcomes by stress band
    if (boardKr) {
      boardKr.classList.add('regime-quality-board', 'regime-quality-korea');
      const korea = buildKoreaRegimeObservations(inputs, { through: regime.asOf || null });
      const cards = korea.cards.map(item => {
        const section = el(doc, 'section', null, 'regime-axis'); section.dataset.axis = item.id; section.dataset.market = 'KR';
        section.append(el(doc, 'h3', item.title, 'regime-axis-title'), el(doc, 'p', `${item.scope} · ${item.asOf}${item.stale ? ' · 지연 자료' : ''}`, 'regime-chart-caption'),
          el(doc, 'p', `${item.last.toLocaleString('en-US', { maximumFractionDigits: item.id === 'usdkrw' ? 2 : 2 })} ${item.unit}`, 'regime-korea-value'), el(doc, 'p', item.read, 'regime-read'));
        if (item.series.length > 1) { const chart = chartPanel(doc, [{ id: item.id, title: item.title, unit: item.unit, series: item.series, format: value => value.toLocaleString('en-US', { maximumFractionDigits: 0 }) }], [item.series[0].date, item.series.at(-1).date]); if (chart) section.append(chart); }
        section.append(el(doc, 'p', item.observe, 'regime-read'));
        // P1628: keep the existing yen/carry reference available while separating
        // Korea's equity sessions from the US-aligned FX regime.
        if (item.id === 'usdkrw') {
          const reference = regime.axes.find(axis => axis.id === 'korea');
          if (reference?.evidence?.length) {
            const details = el(doc, 'details', null, 'regime-axis-details');
            details.append(el(doc, 'summary', '원·엔 연결 근거와 관찰'), el(doc, 'p', `미국 종가 기준에 맞춘 환율 참고 · ${reference.basis || '관측일 미확인'}`));
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
    }
    else board.append(...regime.axes.filter((row) => row.id === 'korea').map(card));
  }
  const previous = page.querySelector('[data-aio-regime-scenarios]');
  const openIds = new Set([...(previous?.querySelectorAll?.('.regime-scenario-more[open]') || [])].map(node => node.closest('.regime-scenario-card')?.dataset.scenario));
  previous?.remove();
  root.__aioScenarioOutlook = scenarios.available ? outlookForRoot(root, { scenarios, regime }) : null;
  const scenarioNode = board ? scenarioSection(doc, root, scenarios, root.__aioScenarioOutlook, openIds) : null;
  if (scenarioNode) { board.insertAdjacentElement('afterend', scenarioNode); renderCrossroadsCompact({ documentRef: doc, root, regime, anchor: scenarioNode.lastElementChild || scenarioNode, id: 'signal-crossroads', title: '다음 발표가 가를 길' }); } // P1742: the branches continue the structure section
  renderNextSteps(doc, doc.getElementById('regime-next'), regimeFlow({ regime, groups: root.__aioScenarioOutlook?.rotation || {} }).next); // P1431, I02
  // P1727: a link that asked for a section of this page (the briefing's Korea sentence -> 한국 시장 참고) shows it once.
  const handoff = consumeResearchHandoff({ root, routeId: 'signal' });
  const anchorId = handoff?.context?.anchor ? String(handoff.context.anchor) : '';
  if (/^[a-z0-9-]+$/i.test(anchorId)) {
    const section = doc.getElementById(anchorId);
    const heading = section?.previousElementSibling?.tagName === 'H2' ? section.previousElementSibling : section;
    heading?.scrollIntoView?.({ block: 'start' });
  }
  page.dataset.aioRegimeRenderer = 'native';
  return regime;
}

// P1651: home summarized only the six US axes, so a -3.6% KOSPI day (-8.4% over five KRX sessions) after the US
// close appeared only as a small ticker number. One line states the latest completed KRX session on its own date.
function paintKoreaLine(doc, root) {
  const headline = doc.getElementById('home-hero-headline');
  if (!headline) return;
  let line = doc.getElementById('home-kr-line');
  const history = root._aioHistory || [];
  const part = (field, title) => {
    const series = buildKoreaIndexSeries(history, field);
    const last = series.at(-1), prev = series.at(-2), prior5 = series.at(-6);
    if (!last) return null;
    const pctOf = (base) => base?.value > 0 ? (last.value / base.value - 1) * 100 : null;
    const signed = (v) => v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const d1 = signed(pctOf(prev)), d5 = signed(pctOf(prior5));
    return { date: last.date, text: `${title} ${last.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${d1 ? ` (${d1}${d5 ? ` · 5거래일 ${d5}` : ''})` : ''}`, d5: pctOf(prior5) };
  };
  const kospi = part('kospi', '코스피'), kosdaq = part('kosdaq', '코스닥');
  if (!kospi) { if (line) line.hidden = true; return; }
  if (!line) { line = el(doc, 'div', null, 'home-kr-line'); line.id = 'home-kr-line'; headline.insertAdjacentElement('afterend', line); }
  const [, month, day] = kospi.date.split('-').map(Number);
  // P1723: a move rare in AIO's own KOSPI record (1-session or 5-session, outer 5%) is named with that record even when
  // the 5-session change stays under 5%; the US six-axis tally is unchanged.
  const record = koreaMoveRecord(history, { now: Date.now() });
  const rare = record?.extreme && record.date === kospi.date ? koreaRecordText(record, { maxTail: KR_SHOCK_TAIL_PCT }) : '';
  const tone = rare ? ` — 코스피 변화가 ${rare}라 미국장과 따로 확인할 구간입니다.`
    : kospi.d5 != null && Math.abs(kospi.d5) >= 5 ? (kospi.d5 < 0 ? ' — 5거래일 낙폭이 커 미국장과 따로 확인할 구간입니다.' : ' — 5거래일 상승 폭이 커 미국장과 따로 확인할 구간입니다.') : '';
  line.textContent = `한국장 ${month}/${day} 마감 · ${[kospi.text, kosdaq?.text].filter(Boolean).join(' · ')}${tone}`;
  line.dataset.observedAt = kospi.date;
  line.dataset.market = 'KR';
  line.title = '한국 정규장 완료 종가 기준입니다. 미국 6개 축의 우호·중립·부담 합계에는 넣지 않습니다.';
  line.hidden = false;
}

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
  const prev = series[series.length - 2];
  if (!last) { fallback.hidden = true; return; }
  const change = prev ? (last.value / prev.value - 1) * 100 : null;
  const [, month, day] = last.date.split('-').map(Number);
  fallback.replaceChildren();
  const value = doc.createElement('span');
  value.className = 'kpi-fallback-value';
  value.textContent = last.value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const note = doc.createElement('span');
  note.className = 'kpi-fallback-note';
  note.textContent = `${month}/${day} 종가${change == null ? '' : ` ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} · 선물 시세 미수신`;
  if (labelNode) labelNode.textContent = label;
  fallback.append(value, note);
  fallback.hidden = false;
  cell?.setAttribute('data-futures-missing', 'true');
}

// Home: one line plus the axis states, linking to the full board.
export function renderHomeRegime({ documentRef: doc, root }) {
  const hero = doc?.getElementById('home-score-hero');
  if (!hero) return null;
  const regime = readMarketRegime(root);
  requestRegimeMacroHistory(root, doc, 'page-home', () => renderHomeRegime({ documentRef: doc, root }));
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('home-hero-total', regime.available ? regime.overall : '판정 대기');
  set('home-hero-headline', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · 미국 6개 축 ${regime.holdReason || summaryLine(regime)}` : '종가 기록을 불러오는 중입니다.');
  set('home-hero-desc', regime.conflicts?.[0] || '');
  paintKoreaLine(doc, root);
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
      const chip = el(doc, 'div', null, 'regime-chip');
      chip.dataset.state = row.state;
      // P1592 (F42): the tally above counts the six US axes; the Korea FX card is a reference beside it.
      const reference = row.id === 'korea';
      if (reference) { chip.classList.add('is-reference'); chip.title = '한국 참고 — 위 우호·중립·부담 합계에 넣지 않습니다'; }
      chip.append(el(doc, 'span', reference ? `${row.title} · 참고` : row.title, 'regime-chip-label'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
      return chip;
    }));
    // P1633/P1745: home answers "so what" in ONE forward block — the present structure (which of the three it is
    // closest to, and the themes leading it), then the branch the next releases would confirm and where it leads.
    let outlookBox = doc.getElementById('home-outlook');
    if (!outlookBox) { outlookBox = el(doc, 'div', null, 'home-outlook'); outlookBox.id = 'home-outlook'; chips.insertAdjacentElement('afterend', outlookBox); }
    outlookBox.hidden = true; // anchor only; the merged block below carries the structure line
    const scenarios = regime.available ? buildMarketScenarios(collectMarketInputs(root), { regime }) : null;
    const outlook = scenarios?.available ? outlookForRoot(root, { scenarios, regime }) : null;
    const lead = outlook?.items?.find((item) => item.id === outlook.leadId);
    const structure = [];
    if (lead) {
      const toStructure = el(doc, 'button', '세 구조의 조건 보기 →', 'flow-next-link');
      toStructure.type = 'button';
      toStructure.addEventListener('click', () => { root.showPage?.('signal'); setTimeout(() => doc.getElementById('regime-structure')?.scrollIntoView?.({ block: 'start' }), 60); });
      // v57.54 audit (9): 오늘 shows the related sectors/themes only as named links; without current names the line is omitted.
      const named = (lead.opportunityLinks || []).some((part) => part?.links?.length);
      // v57.54 (owner review 2026-10-14): the first sentence of the posture and its 반증 line; the middle sentence lives
      // with the three structures on 시장 상태.
      const sentences = String(lead.posture || '').split(/(?<=니다\.)\s+/);
      const counter = sentences.find((line) => line.startsWith('반증'));
      const line = el(doc, 'p', null, 'xr-structure');
      line.append(el(doc, 'strong', `지금 구조 '${lead.title}'`), el(doc, 'span', `${lead.fit}${lead.shortfall ? ` · ${lead.shortfall}` : ''}`, 'basis-chip'), doc.createTextNode(` ${sentences[0] || ''}`));
      structure.push(line, ...(counter ? [el(doc, 'p', counter, 'xr-structure-note')] : []), ...(named ? [opportunityNode(doc, root, lead, 'home-outlook-opportunity')] : []), toStructure);
    } else if (scenarios?.held) structure.push(el(doc, 'p', `지금 구조: 판단 보류 — ${scenarios.reason}`, 'xr-structure'));
    renderCrossroadsCompact({ documentRef: doc, root, regime, anchor: outlookBox, id: 'home-crossroads', structure, title: '지금 구조와 앞으로' }); // P1742/P1745
  }
  hero.dataset.aioRegimeRenderer = 'native';
  hero.dataset.state = regime.available ? 'regime' : 'pending';
  return regime;
}
