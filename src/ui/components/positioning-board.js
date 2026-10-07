// P1507: 기관 포지셔닝 on 시장 상태 — CFTC futures positioning (public-data/cftc-positioning.json, weekly).
// Reference only: it is not one of the six axes and never moves the regime tally. Each card shows the asset-manager
// net position against its two-year range with a line, one sentence of reading, and its limits folded.

const URL = './public-data/cftc-positioning.json';
const SVG = 'http://www.w3.org/2000/svg';

export function parsePositioningSeries(text) {
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''))
    .map(([date, am, lev, oi]) => ({ date, am: Number(am), lev: Number(lev), oi: oi === '' ? null : Number(oi) }))
    .filter((row) => Number.isFinite(row.am) && Number.isFinite(row.lev));
}

// Where the asset-manager net sits in its own two-year range, said in words a reader can act on.
export function positioningReading(market) {
  const p = market?.assetManagerPercentile2y;
  const change = market?.change4w?.assetManagerNet;
  if (!Number.isFinite(p)) return '2년 비교에 필요한 주간 기록이 아직 부족합니다.';
  // Rate futures: asset-manager longs are mostly benchmark duration, so a high reading means duration is stretched, not 'crowded buying'.
  if (market?.id === 'ty') {
    const tyLevel = p >= 80 ? '2년 중 듀레이션을 가장 길게 늘려 둔 자리라, 금리가 오르면 손실을 줄이려는 매도가 커질 수 있습니다' : p <= 20 ? '2년 중 듀레이션을 가장 짧게 줄여 둔 자리입니다' : '2년 범위의 가운데입니다';
    return `자산운용사 국채 선물 순매수가 ${p}백분위로 ${tyLevel}.${!Number.isFinite(change) || change === 0 ? '' : change < 0 ? ' 최근 4주 동안은 줄여 왔습니다.' : ' 최근 4주 동안은 늘려 왔습니다.'}`;
  }
  const level = p >= 80 ? '2년 범위의 위쪽 끝이라, 새로 살 여력보다 정리할 물량이 더 많은 자리입니다'
    : p <= 20 ? '2년 범위의 아래쪽 끝이라, 이미 많이 줄여 둔 자리입니다'
      : '2년 범위의 가운데입니다';
  const flow = !Number.isFinite(change) || change === 0 ? '' : change < 0 ? ' 최근 4주 동안은 순매수를 줄여 왔습니다.' : ' 최근 4주 동안은 순매수를 늘려 왔습니다.';
  return `자산운용사 순매수가 ${p}백분위로 ${level}.${flow}`;
}

function line(doc, rows, key, width = 260, height = 56) {
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'positioning-line');
  svg.setAttribute('aria-hidden', 'true');
  const values = rows.map((row) => row[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = rows.map((row, index) => `${(index / Math.max(1, rows.length - 1)) * (width - 4) + 2},${height - 3 - ((row[key] - min) / span) * (height - 6)}`);
  const path = doc.createElementNS(SVG, 'polyline');
  path.setAttribute('points', pts.join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--text-secondary)');
  path.setAttribute('stroke-width', '1.4');
  const last = pts[pts.length - 1].split(',');
  const dot = doc.createElementNS(SVG, 'circle');
  dot.setAttribute('cx', last[0]);
  dot.setAttribute('cy', last[1]);
  dot.setAttribute('r', '3');
  dot.setAttribute('fill', 'var(--text-primary)');
  svg.append(path, dot);
  return svg;
}

const fmt = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value)).toLocaleString('en-US')}계약`;
const el = (doc, tag, text, className) => { const node = doc.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

function card(doc, market) {
  const box = el(doc, 'section', null, 'regime-axis positioning-card');
  box.dataset.market = market.id;
  const head = el(doc, 'div', null, 'regime-axis-head');
  head.append(el(doc, 'h3', market.label, 'regime-axis-title'));
  if (Number.isFinite(market.assetManagerPercentile2y)) head.append(el(doc, 'span', `${market.assetManagerPercentile2y}백분위`, 'regime-state is-neutral'));
  box.append(head);
  if (market.latest?.date) box.append(el(doc, 'span', `${Number(market.latest.date.slice(5, 7))}/${Number(market.latest.date.slice(8, 10))} 기준 주간 보고`, 'basis-chip'));
  const rows = parsePositioningSeries(market.series).slice(-104);
  if (rows.length >= 10) box.append(line(doc, rows, 'am'));
  const list = el(doc, 'dl', null, 'regime-evidence');
  const add = (label, value) => { if (value != null) list.append(el(doc, 'dt', label), el(doc, 'dd', value)); };
  add('자산운용사 순매수', market.latest ? fmt(market.latest.assetManagerNet) : null);
  add('4주 변화', market.change4w ? fmt(market.change4w.assetManagerNet) : null);
  add('레버리지 펀드 순매수', market.latest ? `${fmt(market.latest.leveragedNet)} (${market.leveragedPercentile2y ?? '—'}백분위)` : null);
  box.append(list, el(doc, 'p', positioningReading(market), 'regime-read'));
  return box;
}

export async function renderPositioningBoard({ documentRef: doc, root }) {
  const host = doc?.getElementById?.('regime-positioning');
  if (!host || host.dataset.loaded === 'true') return null;
  host.dataset.loaded = 'true';
  let artifact = null;
  try {
    const response = await (root?.fetch || fetch)(URL, { cache: 'no-cache' });
    if (response.ok) artifact = await response.json();
  } catch { artifact = null; }
  const markets = (artifact?.markets || []).filter((row) => row.status === 'ok' || row.status === 'kept-previous');
  if (!markets.length) {
    host.replaceChildren(el(doc, 'p', '주간 포지셔닝 자료는 다음 자동 수집부터 표시됩니다.', 'briefing-footnote'));
    return null;
  }
  const board = el(doc, 'div', null, 'regime-board');
  board.append(...markets.map((market) => card(doc, market)));
  const limits = el(doc, 'details', null, 'macro-axis-more');
  limits.append(el(doc, 'summary', '읽는 법과 한계'), el(doc, 'p', '선물 포지션만 집계한 주간 자료입니다(화요일 기준, 금요일 공개). 자산운용사의 선물 매수는 주식 보유를 대신하는 경우가 많아 방향 신호라기보다 쏠림의 정도로 읽습니다. 증권사 리포트의 포지셔닝 백분위는 집계 대상(모든 S&P 계약의 달러 합계 등)이 달라 이 숫자와 다를 수 있습니다. 포지션이 한쪽 끝에 몰렸다는 것은 되돌림이 일어날 때 크기가 커질 수 있다는 뜻이지, 시점을 알려 주지는 않습니다.', 'regime-flip'));
  host.replaceChildren(board, limits);
  return markets;
}
