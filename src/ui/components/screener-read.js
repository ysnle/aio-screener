// P1437: 스크리너's lead block — top-fifth sector mix against the universe (bars), the connected reading
// (mix → rotation → trend health → past performance), and where to continue.
import { buildScreenerRead } from '../../domain/screener/screener-read.js';
import { summarizeValidation } from './screener-validation.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function mixVisual(doc, read) {
  const box = el(doc, 'div', null, 'screener-mix');
  box.append(el(doc, 'span', '상위 20%의 업종 비중 vs 전체', 'stock-read-vis-title'));
  const max = Math.max(...read.mix.slice(0, 6).map((row) => Math.max(row.top, row.all)), 1);
  for (const row of read.mix.slice(0, 6)) {
    const line = el(doc, 'div', null, 'stock-read-bars');
    line.append(el(doc, 'span', row.label, 'stock-read-bar-label'));
    const pair = el(doc, 'div', null, 'stock-read-bar-pair');
    for (const [kind, value] of [['stock', row.top], ['bench', row.all]]) {
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const bar = el(doc, 'div', null, `stock-read-bar is-${kind} is-up`);
      bar.style.width = `${Math.max(2, value / max * 100).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${value.toFixed(0)}%`, 'stock-read-bar-value'));
      pair.append(item);
    }
    line.append(pair);
    box.append(line);
  }
  const legend = el(doc, 'div', null, 'stock-read-legend');
  legend.append(el(doc, 'span', '상위 20%', 'is-stock'), el(doc, 'span', '전체 유니버스', 'is-bench'));
  box.append(legend);
  return box;
}

export function renderScreenerRead({ documentRef: doc, root, rows = [] }) {
  const host = doc?.getElementById('screener-read');
  if (!host) return null;
  host.dataset.aioScreenerReadRenderer = 'native';
  const read = buildScreenerRead({
    rows,
    rotation: root?._serverDataMeta?.rotationHistory?.items || {},
    regime: readMarketRegime(root),
    validation: summarizeValidation(root?._aioScreenerBacktestHistory || [], root?._aioModelValidationStatus || null)
  });
  host.replaceChildren(el(doc, 'h2', '지금 순위가 말하는 것', 'briefing-h2'));
  if (!read.available) { host.append(el(doc, 'p', read.reason, 'daily-empty')); renderNextSteps(doc, doc.getElementById('screener-next'), []); return read; }
  host.append(el(doc, 'p', read.headline, 'briefing-read-headline'));
  const layout = el(doc, 'div', null, 'screener-read-layout');
  const list = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    list.append(li);
  }
  layout.append(mixVisual(doc, read), list);
  host.append(layout);
  renderNextSteps(doc, doc.getElementById('screener-next'), read.next);
  return read;
}
