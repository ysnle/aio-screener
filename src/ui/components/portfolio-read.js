// P1438: 포트폴리오's lead block — value share by trend state (one stacked bar), sector weights coloured
// by rotation quadrant, and the reading that ties the book to the market.
import { buildPortfolioRead } from '../../domain/portfolio/portfolio-read.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { benchmarkRowFor } from '../../domain/market/benchmarks.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderPortfolioRead({ documentRef: doc, root, surface }) {
  const host = doc?.getElementById('pf-read');
  if (!host) return null;
  host.dataset.aioPortfolioReadRenderer = 'native';
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  const read = buildPortfolioRead({ surface, rows, benchmarkFor: (symbol) => benchmarkRowFor(symbol, root?._aioHistory || []), rotation: root?._serverDataMeta?.rotationHistory?.items || {}, regime: readMarketRegime(root) });
  const next = doc.getElementById('pf-next');
  if (!read.available) {
    // P1449: a hold is not an absence — the reason (currency mix without declared rates) is
    // user-facing content, printed here instead of silently removing the section.
    host.hidden = false;
    host.replaceChildren(el(doc, 'h2', '내 포트폴리오와 시장', 'briefing-h2'), el(doc, 'p', read.reason, 'daily-empty'));
    renderNextSteps(doc, next, []);
    return read;
  }
  host.hidden = false;
  host.replaceChildren(el(doc, 'h2', '내 포트폴리오와 시장', 'briefing-h2'));
  if (read.excluded) host.querySelector('h2').append(el(doc, 'span', `스크리너 기록이 없는 ${read.excluded}종목 제외${read.total > 0 && read.excludedValue != null ? ` — 제외 보유액은 평가액의 ${(read.excludedValue / read.total * 100).toFixed(0)}%` : ''}`, 'briefing-h2-note'));
  if (read.headline) host.append(el(doc, 'p', read.headline, 'briefing-read-headline'));
  const visuals = el(doc, 'div', null, 'stock-read-visuals');
  if (read.trendMix.length) {
    const box = el(doc, 'div', null, 'pf-trend-mix');
    box.append(el(doc, 'span', '평가액 기준 추세 상태', 'stock-read-vis-title'));
    const bar = el(doc, 'div', null, 'pf-trend-bar');
    for (const row of read.trendMix.filter((item) => item.pct > 0)) {
      const seg = el(doc, 'span', row.pct >= 12 ? `${row.pct.toFixed(0)}%` : '', `pf-trend-seg is-${row.state}`);
      seg.style.width = `${row.pct.toFixed(1)}%`;
      seg.title = `${row.label} ${row.pct.toFixed(1)}%`;
      bar.append(seg);
    }
    const legend = el(doc, 'div', null, 'pf-trend-legend');
    for (const row of read.trendMix) legend.append(el(doc, 'span', `${row.label} ${row.pct.toFixed(0)}%`, `is-${row.state}`));
    box.append(bar, legend);
    visuals.append(box);
  }
  if (read.sectorMix.length) {
    const box = el(doc, 'div', null, 'pf-sector-mix');
    box.append(el(doc, 'span', '섹터 비중 · 섹터 회전 단계', 'stock-read-vis-title'));
    for (const row of read.sectorMix.slice(0, 6)) {
      const line = el(doc, 'div', null, 'stock-read-bars');
      line.append(el(doc, 'span', row.label, 'stock-read-bar-label'));
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const bar = el(doc, 'div', null, `stock-read-bar pf-sector-bar is-${row.quadrant?.tone || 'unknown'}`);
      bar.style.width = `${Math.max(2, row.pct).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${row.pct.toFixed(0)}%${row.quadrant ? ` · ${row.quadrant.label}` : ''}`, 'stock-read-bar-value'));
      line.append(item);
      box.append(line);
    }
    visuals.append(box);
  }
  if (visuals.childNodes.length) host.append(visuals);
  const list = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    list.append(li);
  }
  host.append(list);
  renderNextSteps(doc, next, read.next);
  return read;
}
