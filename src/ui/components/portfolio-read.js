// P1438: 포트폴리오's lead block — value share by trend state (one stacked bar), sector weights coloured
// by rotation quadrant, and the reading that ties the book to the market.
import { buildPortfolioRead } from '../../domain/portfolio/portfolio-read.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { benchmarkRowFor, indexReturns } from '../../domain/market/benchmarks.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// P1466: the 3-month gap to the blended index split into sector, stock selection, FX and cash —
// bars on one scale, the total underneath, then what the arithmetic does not claim.
function attributionBox(doc, attribution) {
  const box = el(doc, 'div', null, 'pf-attribution');
  box.append(el(doc, 'span', `지수 대비 차이의 원인 · ${attribution.window}`, 'stock-read-vis-title'));
  const max = Math.max(0.5, ...attribution.excess.map((part) => Math.abs(part.pct)));
  for (const part of attribution.excess) {
    const line = el(doc, 'div', null, 'scr-ic-row');
    const track = el(doc, 'div', null, 'scr-ic-track');
    const fill = el(doc, 'span', null, `scr-ic-fill ${part.pct >= 0 ? 'is-up' : 'is-down'}`);
    fill.style.width = `${Math.min(50, Math.abs(part.pct) / max * 50).toFixed(1)}%`;
    fill.style[part.pct >= 0 ? 'left' : 'right'] = '50%';
    track.append(fill);
    line.append(el(doc, 'span', part.label, 'scr-ic-label'), track, el(doc, 'span', `${part.pct >= 0 ? '+' : ''}${part.pct.toFixed(1)}%p`, 'scr-ic-value'));
    box.append(line);
  }
  const sign = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  box.append(el(doc, 'p', `합계 ${sign(attribution.excessPct)}%p = 내 수익률 ${sign(attribution.totalPct)}% − ${attribution.blendedLabel} ${sign(attribution.blendedPct)}%`, 'theme-strength-basis'));
  const notes = [];
  if (attribution.sectorMappedPct < 100) notes.push(`섹터 효과는 미국 섹터 ETF가 대응되는 보유액 ${attribution.sectorMappedPct.toFixed(0)}%에서만 분리(나머지는 종목 선택에 포함)`);
  if (!attribution.cashDeclared) notes.push('현금이 선언되지 않아 현금 효과는 0으로 계산');
  else if (attribution.cashSharePct > 0) notes.push(`현금 ${attribution.cashSharePct.toFixed(0)}% — 지수에 투자됐다면 얻었을 수익률만큼이 현금 효과`);
  if (attribution.fxHoldingsPct > 0) notes.push(`환율 효과는 기준 통화로 환산한 보유액 ${attribution.fxHoldingsPct.toFixed(0)}%의 원/달러 3개월 변동`);
  notes.push('지금 비중을 3개월 동안 들고 있었다고 가정한 계산이라 실제 계좌 성과와 다릅니다');
  box.append(el(doc, 'p', `${notes.join(' · ')}.`, 'theme-strength-basis'));
  return box;
}

export function renderPortfolioRead({ documentRef: doc, root, surface }) {
  const host = doc?.getElementById('pf-read');
  if (!host) return null;
  host.dataset.aioPortfolioReadRenderer = 'native';
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  const history = root?._aioHistory || [];
  const spy = rows.find((row) => row?.sym === 'SPY') || null;
  // P1466: US holdings are measured against SPY's adjusted return (dividends included, the same basis
  // as the stocks' and sector ETFs' returns); KRX holdings against the KOSPI/KOSDAQ price index.
  const marketReturnFor = (symbol) => {
    const bench = benchmarkRowFor(symbol, history);
    if (bench.market === 'US' && Number.isFinite(Number(spy?.ret3m))) return { ret3m: Number(spy.ret3m), label: 'S&P 500(SPY)' };
    return bench;
  };
  const read = buildPortfolioRead({ surface, rows, benchmarkFor: (symbol) => benchmarkRowFor(symbol, history), marketReturnFor, usdkrwReturnPct: indexReturns(history, 'usdkrw').ret3m, rotation: root?._serverDataMeta?.rotationHistory?.items || {}, regime: readMarketRegime(root) });
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
  if (read.attribution?.available) visuals.append(attributionBox(doc, read.attribution));
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
