// P1392: 시장 상태 = six-axis regime board (owner decision 2026-10-02: the 0-100 score and the
// swing/day toggle are retired from user surfaces). The home card shows the same board compactly.
import { buildMarketRegime, buildMarketRead } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';

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
  const { favorable, neutral, burden } = regime.counts;
  return `우호 ${favorable} · 중립 ${neutral} · 부담 ${burden}`;
}

export function renderRegimePage({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-signal');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const regime = buildMarketRegime(inputs);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('regime-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · 6개 축의 상태와 판정이 바뀌는 조건` : '종가 기록을 불러오는 중입니다.');
  const overall = set('regime-overall', regime.available ? regime.overall : '판정 대기');
  if (overall) overall.dataset.overall = regime.overall || '';
  set('regime-counts', regime.available ? summaryLine(regime) : '');
  const read = regime.available ? buildMarketRead(inputs) : null;
  set('regime-headline', read?.headline || '');
  const conflicts = doc.getElementById('regime-conflicts');
  if (conflicts) conflicts.replaceChildren(...(regime.conflicts || []).map((text) => el(doc, 'li', text)));
  const board = doc.getElementById('regime-board');
  if (board) {
    board.replaceChildren(...regime.axes.map((row) => {
      const card = el(doc, 'section', null, 'regime-axis');
      card.dataset.axis = row.id;
      card.dataset.state = row.state;
      const head = el(doc, 'div', null, 'regime-axis-head');
      head.append(el(doc, 'h3', row.title, 'regime-axis-title'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
      card.append(head);
      const list = el(doc, 'dl', null, 'regime-evidence');
      for (const [label, value] of row.evidence) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
      card.append(list, el(doc, 'p', row.read, 'regime-read'));
      if (row.flip) card.append(el(doc, 'p', `전환 조건: ${row.flip}`, 'regime-flip'));
      return card;
    }));
  }
  page.dataset.aioRegimeRenderer = 'native';
  return regime;
}

// Home: one line plus the axis states, linking to the full board.
export function renderHomeRegime({ documentRef: doc, root }) {
  const hero = doc?.getElementById('home-score-hero');
  if (!hero) return null;
  const regime = readMarketRegime(root);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('home-hero-total', regime.available ? regime.overall : '판정 대기');
  set('home-hero-headline', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준 · ${summaryLine(regime)}` : '종가 기록을 불러오는 중입니다.');
  set('home-hero-desc', regime.conflicts?.[0] || '');
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
