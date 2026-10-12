// P1392: 시장 상태 = six-axis regime board (owner decision 2026-10-02: the 0-100 score and the
// swing/day toggle are retired from user surfaces). The home card shows the same board compactly.
import { buildCloseSeries, buildMarketRegime, buildMarketRead, closeBasis } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';
import { regimeFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { createTrendChart } from './trend-chart.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { buildRegimeAxisHistory, buildMarketScenarios, buildKoreaRegimeObservations } from '../../domain/market/regime-scenarios.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

export function readMarketRegime(root) {
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

function requestRegimeMacroHistory(root, doc) {
  if (root._aioMacroHistory || root._aioRegimeMacroRequested || Date.now() - (root._aioRegimeMacroTriedAt || 0) < 60000) return;
  const fetchFn = root.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return;
  root._aioRegimeMacroRequested = true;
  root._aioRegimeMacroTriedAt = Date.now();
  loadJsonArtifact(fetchFn.bind(root), './public-data/macro-history.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 })
    .then(payload => { if (payload?.schemaVersion === 'macro-history.v1') root._aioMacroHistory = payload; })
    .catch(() => {})
    .finally(() => { root._aioRegimeMacroRequested = false; if (root._aioMacroHistory && doc.getElementById('page-signal')?.classList?.contains('active')) renderRegimePage({ documentRef: doc, root }); });
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

function scenarioSection(doc, model, openIds = new Set()) {
  const section = el(doc, 'section', null, 'regime-scenarios');
  section.dataset.aioRegimeScenarios = 'native';
  section.append(el(doc, 'h2', '앞으로 확인할 세 가지 흐름', 'briefing-h2'),
    el(doc, 'p', `${model.asOf || '기준일 미확인'} 완료 종가 기준 · 현재 조건과 다음 관측에 따라 해석을 바꿉니다. 발생 확률이나 목표가를 예측한 내용이 아닙니다.`, 'regime-scenario-basis'));
  if (!model.available) { section.append(el(doc, 'p', model.reason, 'regime-scenario-hold')); return section; }
  if (model.reason) section.append(el(doc, 'p', model.reason, 'regime-scenario-hold'));
  const facts = el(doc, 'p', (model.scenarios[0]?.facts || []).join(' · '), 'regime-scenario-current');
  if (facts.textContent) section.append(facts);
  const grid = el(doc, 'div', null, 'regime-scenario-grid');
  for (const scenario of model.scenarios) {
    const card = el(doc, 'article', null, 'regime-scenario-card');
    card.dataset.scenario = scenario.id; card.dataset.confirmed = String(scenario.confirmed);
    const head = el(doc, 'div', null, 'regime-scenario-head');
    head.append(el(doc, 'h3', scenario.title), el(doc, 'span', scenario.status, 'regime-scenario-status'));
    card.append(head, el(doc, 'p', scenario.interpretation, 'regime-scenario-reading'));
    // P1630: the reading stays visible; conditions, counter-evidence and checks are details on demand
    // (owner reading standard, 3-5 lines per block). Open state survives the page's re-renders.
    const more = el(doc, 'details', null, 'regime-scenario-more');
    more.open = openIds.has(scenario.id);
    more.append(el(doc, 'summary', '조건 · 반증 · 다음 확인'));
    more.append(el(doc, 'h4', '유효 조건'));
    const conditions = el(doc, 'ul'); for (const condition of scenario.conditions) conditions.append(el(doc, 'li', condition)); more.append(conditions);
    more.append(el(doc, 'h4', '해석을 뒤집는 관측'), el(doc, 'p', scenario.counterEvidence));
    more.append(el(doc, 'h4', '다음 확인'));
    const checks = el(doc, 'ul'); for (const check of scenario.observe) checks.append(el(doc, 'li', check)); more.append(checks);
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
      card.append(el(doc, 'p', row.read, 'regime-read'));
      const chart = chartPanel(doc, history.axes[row.id] || [], history.range);
      if (chart) card.append(chart);
      const list = el(doc, 'dl', null, 'regime-evidence');
      for (const [label, value] of row.evidence.slice(0, 3)) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
      if (row.evidence.length) card.append(list);
      const watch = scenarios.axes?.find(axis => axis.id === row.id);
      if (row.flip) {
        const changes = el(doc, 'div', null, 'regime-axis-observe');
        changes.append(el(doc, 'h4', '상태가 바뀌는 조건'), el(doc, 'p', row.flip));
        if (watch?.observe) changes.append(el(doc, 'h4', '다음 확인'), el(doc, 'p', watch.observe));
        card.append(changes);
      }
      const details = el(doc, 'details', null, 'regime-axis-details');
      details.append(el(doc, 'summary', row.evidence.length > 3 ? '추가 근거와 출처' : '출처'));
      if (row.evidence.length > 3) { const extra = el(doc, 'dl', null, 'regime-evidence'); for (const [label, value] of row.evidence.slice(3)) extra.append(el(doc, 'dt', label), el(doc, 'dd', value)); details.append(extra); }
      details.append(el(doc, 'p', AXIS_SOURCES[row.id] || 'AIO 완료 관측 기록'));
      card.append(details);
      if (AXIS_SOURCES[row.id]) card.title = `출처: ${AXIS_SOURCES[row.id]}`; // P1505: on hover, not on the face of the card
      return card;
    };
    board.replaceChildren(...regime.axes.filter((row) => row.id !== 'korea').map(card));
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
  if (board) board.insertAdjacentElement('afterend', scenarioSection(doc, scenarios, openIds));
  renderNextSteps(doc, doc.getElementById('regime-next'), regimeFlow({ regime }).next); // P1431
  page.dataset.aioRegimeRenderer = 'native';
  return regime;
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
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('home-hero-total', regime.available ? regime.overall : '판정 대기');
  set('home-hero-headline', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · 미국 6개 축 ${regime.holdReason || summaryLine(regime)}` : '종가 기록을 불러오는 중입니다.');
  set('home-hero-desc', regime.conflicts?.[0] || '');
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
  }
  hero.dataset.aioRegimeRenderer = 'native';
  hero.dataset.state = regime.available ? 'regime' : 'pending';
  return regime;
}
