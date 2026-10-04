// P1434: 종목 요약's lead block — one headline, two pictures (52-week position, return vs the S&P 500)
// and the connected reading under them, then where the same question continues.
import { buildStockRead } from '../../domain/entity/stock-read.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';
import { benchmarkRowFor } from '../../domain/market/benchmarks.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function call(root, name, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn() ?? fallback) : fallback; } catch (_) { return fallback; }
}

function themesFor(root, symbol) {
  const map = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  return map.filter((theme) => (Array.isArray(theme.leaders) && theme.leaders.includes(symbol))
    || (theme.subThemes || []).some((sub) => Array.isArray(sub.tickers) && sub.tickers.includes(symbol)))
    .map((theme) => ({ id: theme.id, label: theme.nameKr || theme.id, etf: theme.etf || null }));
}

function rangeVisual(doc, read) {
  const box = el(doc, 'div', null, 'stock-read-range');
  box.append(el(doc, 'span', '52주 위치', 'stock-read-vis-title'));
  const track = el(doc, 'div', null, 'stock-read-track');
  const marker = el(doc, 'span', null, 'stock-read-marker');
  marker.style.left = `${(read.position * 100).toFixed(1)}%`;
  track.append(marker);
  const scale = el(doc, 'div', null, 'stock-read-scale');
  scale.append(el(doc, 'span', '52주 저점'), el(doc, 'span', `${Math.round(read.position * 100)}%`), el(doc, 'span', '52주 고점'));
  box.append(track, scale);
  return box;
}

function relativeVisual(doc, read) {
  const box = el(doc, 'div', null, 'stock-read-relative');
  box.append(el(doc, 'span', `수익률 — ${read.symbol} vs ${read.benchmarkLabel}`, 'stock-read-vis-title'));
  const rows = read.spans.filter((span) => span.stock != null);
  const max = Math.max(1, ...rows.flatMap((span) => [Math.abs(span.stock), Math.abs(span.bench ?? 0)]));
  for (const span of rows) {
    const line = el(doc, 'div', null, 'stock-read-bars');
    line.append(el(doc, 'span', span.label, 'stock-read-bar-label'));
    const pair = el(doc, 'div', null, 'stock-read-bar-pair');
    for (const [kind, value] of [['stock', span.stock], ['bench', span.bench]]) {
      if (value == null) continue;
      const bar = el(doc, 'div', null, `stock-read-bar is-${kind} ${value >= 0 ? 'is-up' : 'is-down'}`);
      bar.style.width = `${Math.max(2, Math.abs(value) / max * 100).toFixed(1)}%`;
      bar.title = `${kind === 'stock' ? read.symbol : read.benchmarkLabel} ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
      const row = el(doc, 'div', null, 'stock-read-bar-row');
      row.append(bar, el(doc, 'span', `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'stock-read-bar-value'));
      pair.append(row);
    }
    line.append(pair);
    box.append(line);
  }
  const legend = el(doc, 'div', null, 'stock-read-legend');
  legend.append(el(doc, 'span', read.symbol, 'is-stock'), el(doc, 'span', read.benchmarkLabel, 'is-bench'));
  box.append(legend);
  return box;
}

export function renderStockRead({ documentRef: doc, root, symbol }) {
  const host = doc?.getElementById('ticker-read');
  if (!host) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  host.dataset.aioStockReadRenderer = 'native';
  const next = doc.getElementById('ticker-next');
  if (!sym) { host.replaceChildren(); host.hidden = true; renderNextSteps(doc, next, []); return null; }
  host.hidden = false;
  const rows = call(root, '_aioGetCanonicalScreenerRows', []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((item) => item?.sym === sym) || null;
  // P1447: compare with the stock's own market index (KOSPI/KOSDAQ for KRX listings) over the same windows.
  const benchmark = benchmarkRowFor(sym, root?._aioHistory || []);
  const rotation = root?._serverDataMeta?.rotationHistory?.items || {};
  const read = buildStockRead({ symbol: sym, row, benchmark, rotation, themes: themesFor(root, sym), regime: readMarketRegime(root), universeSize: list.length || null });
  host.replaceChildren(el(doc, 'h2', '이 종목의 지금', 'briefing-h2'));
  if (!read.available) {
    host.append(emptyState(doc, { title: '추세·상대강도 기록 없음', reason: read.reason, compact: true }));
    renderNextSteps(doc, next, [{ route: 'technical', label: '차트', why: '일봉과 이동평균 위치' }, { route: 'fundamental', label: '재무 공시', why: '매출·이익·현금흐름' }]);
    return read;
  }
  host.querySelector('h2').append(el(doc, 'span', read.ranking ? `스크리너 상대 순위 ${read.ranking.rank}위 / ${read.ranking.of} (상위 ${read.ranking.topPct}%)` : '', 'briefing-h2-note'));
  host.append(el(doc, 'p', `${read.name} — ${read.headline}`, 'briefing-read-headline'));
  const visuals = el(doc, 'div', null, 'stock-read-visuals');
  if (read.position != null) visuals.append(rangeVisual(doc, read));
  if (read.spans.some((span) => span.stock != null)) visuals.append(relativeVisual(doc, read));
  if (visuals.childNodes.length) host.append(visuals);
  const points = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    points.append(li);
  }
  host.append(points);
  renderNextSteps(doc, next, read.next);
  return read;
}
