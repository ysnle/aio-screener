// v59.70 (S16): 포트폴리오 ③ 노출 — one stacked bar of the stock part by sector (the five largest, the rest as 기타) and
// one line naming the largest holding and the largest sector. Weights are the surface's base-currency values, the
// denominator the holdings themselves (cash is not a sector). The concentration verdicts stay in 점검.
import { el } from './dom.js';

const SEGMENTS = 5;

export function portfolioExposure({ surface, sectorLabel = (name) => name } = {}) {
  if (surface?.currencyState === 'mixed-without-conversion') return { available: false, reason: 'currency' };
  const rows = (Array.isArray(surface?.rows) ? surface.rows : []).filter((row) => Number(row?.value) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
  if (!rows.length || !(total > 0)) return { available: false, reason: 'empty' };
  const name = (sector) => (sector === 'ETF' ? '광범위 ETF' : !sector || sector === 'Unclassified' ? '분류 없음' : sectorLabel(sector));
  const bySector = new Map(); const bySymbol = new Map();
  for (const row of rows) {
    const label = name(row.sector);
    bySector.set(label, (bySector.get(label) || 0) + Number(row.value));
    bySymbol.set(row.symbol, (bySymbol.get(row.symbol) || 0) + Number(row.value));
  }
  const sectors = [...bySector].map(([label, value]) => ({ label, pct: value / total * 100 })).sort((a, b) => b.pct - a.pct);
  const shown = sectors.slice(0, SEGMENTS);
  const rest = sectors.slice(SEGMENTS).reduce((sum, row) => sum + row.pct, 0);
  if (rest > 0) shown.push({ label: '기타', pct: rest, other: true });
  const [topSymbol, topValue] = [...bySymbol].sort((a, b) => b[1] - a[1])[0];
  const topSector = sectors.find((row) => row.label !== '분류 없음' && row.label !== '광범위 ETF') || null;
  return { available: true, segments: shown, topSymbol, topSymbolPct: topValue / total * 100, topSector, holdings: bySymbol.size };
}

export function renderPortfolioExposureBar({ documentRef: doc, surface, sectorLabel }) {
  const host = doc?.getElementById('pf-exposure-bar');
  if (!host) return null;
  const body = host.querySelector('[data-pf-exposure-body]');
  if (!body) return null;
  const model = portfolioExposure({ surface, sectorLabel });
  if (!model.available) { host.hidden = true; return model; }
  host.hidden = false;
  const pct = (value) => `${value.toFixed(0)}%`;
  const lead = `가장 큰 종목 ${model.topSymbol} ${pct(model.topSymbolPct)}${model.topSector ? ` · 가장 큰 섹터 ${model.topSector.label} ${pct(model.topSector.pct)}` : ''}`;
  const bar = el(doc, 'div', null, 'pf-exposure-track');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `섹터 비중: ${model.segments.map((row) => `${row.label} ${pct(row.pct)}`).join(', ')}`);
  const legend = el(doc, 'ul', null, 'pf-exposure-legend');
  model.segments.forEach((row, index) => {
    const tone = row.other ? 'is-other' : `is-s${index + 1}`;
    const seg = el(doc, 'span', null, `pf-exposure-seg ${tone}`);
    seg.style.width = `${row.pct.toFixed(2)}%`;
    seg.title = `${row.label} ${row.pct.toFixed(1)}%`;
    bar.append(seg);
    const item = el(doc, 'li', null, 'pf-exposure-key');
    item.append(el(doc, 'span', null, `pf-exposure-swatch ${tone}`), el(doc, 'span', row.label, 'pf-exposure-name'), el(doc, 'b', pct(row.pct), 'pf-exposure-value'));
    legend.append(item);
  });
  body.replaceChildren(el(doc, 'p', lead, 'pf-exposure-lead'), bar, legend);
  return model;
}
