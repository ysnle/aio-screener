// P1392: 시장 상태 = six-axis regime board (owner decision 2026-10-02: the 0-100 score and the
// swing/day toggle are retired from user surfaces). The home card shows the same board compactly.
import { buildCloseSeries, buildMarketRegime, buildMarketRead, closeBasis } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';
import { regimeFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';

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

export function renderRegimePage({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-signal');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const regime = buildMarketRegime(inputs);
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
      const list = el(doc, 'dl', null, 'regime-evidence');
      for (const [label, value] of row.evidence) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
      card.append(list, el(doc, 'p', row.read, 'regime-read'));
      if (row.flip) card.append(el(doc, 'p', `전환 조건: ${row.flip}`, 'regime-flip'));
      if (AXIS_SOURCES[row.id]) card.title = `출처: ${AXIS_SOURCES[row.id]}`; // P1505: on hover, not on the face of the card
      return card;
    };
    board.replaceChildren(...regime.axes.filter((row) => row.id !== 'korea').map(card));
    if (boardKr) boardKr.replaceChildren(...regime.axes.filter((row) => row.id === 'korea').map(card));
    else board.append(...regime.axes.filter((row) => row.id === 'korea').map(card));
  }
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
  set('home-hero-headline', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · ${regime.holdReason || summaryLine(regime)}` : '종가 기록을 불러오는 중입니다.');
  set('home-hero-desc', regime.conflicts?.[0] || '');
  // P1429 (Codex review): the two futures cells were the largest items on home and often empty. When a
  // futures quote is missing the cell shows the cash index's last completed close (same history as 시장 상태)
  // and says the futures quote is unavailable; a live futures quote restores the cell.
  // Codex browser audit H01: the fallback was painted once per regime render, so a futures quote arriving later
  // left "선물 시세 미수신 · 10/6 종가" beside the live futures number. The cell is repainted whenever its live
  // value changes, and only one of the two (futures quote or the cash index close) is ever shown.
  for (const spec of [['home-kpi-es-fallback', 'ES=F', 'spx', 'S&P 500'], ['home-kpi-nq-fallback', 'NQ=F', 'nasdaq', '나스닥 종합']]) {
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
      chip.append(el(doc, 'span', row.title, 'regime-chip-label'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
      return chip;
    }));
  }
  hero.dataset.aioRegimeRenderer = 'native';
  hero.dataset.state = regime.available ? 'regime' : 'pending';
  return regime;
}
