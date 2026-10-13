// 2026-10-13 (owner: "finviz maps 같은 S&P 500 지도"): sectors as boxes, members as tiles sized by index weight
// and shaded by return over one completed window (Korean convention: rising red, falling blue). One lead sentence
// reads the map; the sector table and the reading guide stay folded. A tile opens the stock page.
import { buildSectorMap, layoutSectorMap, SECTOR_MAP_PERIODS, shadeOf } from '../../domain/market/sector-map.js';
import { latestCompletedUsSession } from '../../domain/market/market-calendar.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const signed = (value, digits = 2) => (value == null ? '수익률 없음' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`);
const shortDate = (date) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

// The S&P 500 member weights arrive inside the screener artifact (metadata.indexWeights, compact rows).
function weightsOf(metadata) {
  const block = metadata?.indexWeights;
  if (!block || !Array.isArray(block.rows)) return null;
  return { asOf: block.asOf || null, rows: block.rows.map((row) => (Array.isArray(row) ? { sym: row[0], sector: row[1], weight: row[2], name: row[3] || '' } : row)) };
}

function legend(doc, steps) {
  const box = el(doc, 'div', null, 'sector-map-legend');
  box.setAttribute('aria-hidden', 'true');
  const marks = [['d3', `−${steps[2]}%`], ['d2', `−${steps[1]}%`], ['d1', `−${steps[0]}%`], ['n0', '0'], ['u1', `+${steps[0]}%`], ['u2', `+${steps[1]}%`], ['u3', `+${steps[2]}%`]];
  for (const [shade, label] of marks) box.append(el(doc, 'span', label, `sector-map-swatch is-${shade}`));
  return box;
}

export function renderSectorMap({ documentRef: doc, root, store }) {
  const host = doc?.getElementById('sector-map');
  if (!host || !root) return null;
  const rerender = () => renderSectorMap({ documentRef: doc, root, store });
  let rows = [];
  let weights = null;
  let revision = '';
  try {
    const screener = store?.getState?.()?.screener;
    rows = screener?.rows || root._aioGetCanonicalScreenerRows?.() || [];
    weights = weightsOf(screener?.metadata);
    revision = `${screener?.metadata?.asOf || ''}|${screener?.metadata?.factorComputedAt || ''}`;
  } catch (_) { rows = []; }
  const expected = latestCompletedUsSession(Date.now(), { requirePrevious: false })?.date || null;
  // The map reads completed-close returns only, so live-quote ticks change nothing: keep the drawn map (and the
  // reader's open folds and first-click selection) unless the artifact, the period or the expected session moved.
  const renderKey = `${revision}|${rows.length}|${weights?.asOf || ''}|${root._aioSectorMapPeriod || ''}|${expected || ''}`;
  if (host.dataset.aioSectorMapKey === renderKey && host.childElementCount > 0) return host._aioSectorMapModel || null;
  const probe = buildSectorMap({ rows, weights, period: root._aioSectorMapPeriod || 'ret1d', expectedSession: expected });
  // Default to the shortest window that has data (1일 once the producer publishes it, 1개월 until then).
  let period = root._aioSectorMapPeriod;
  if (!period || !probe.periods?.[period]) period = Object.keys(SECTOR_MAP_PERIODS).find((id) => probe.periods?.[id]) || 'ret1m';
  const model = period === probe.period ? probe : buildSectorMap({ rows, weights, period, expectedSession: expected });
  host.replaceChildren();
  host.dataset.aioSectorMapRenderer = 'native';
  host.dataset.aioSectorMapKey = renderKey;
  host._aioSectorMapModel = model;
  const head = el(doc, 'div', null, 'sector-map-head');
  const title = el(doc, 'h2', 'S&P 500 지도', 'briefing-h2');
  head.append(title);
  const tabs = el(doc, 'div', null, 'sector-map-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', '수익률 기간');
  for (const [id, spec] of Object.entries(SECTOR_MAP_PERIODS)) {
    const button = el(doc, 'button', spec.label, `sector-map-tab${id === model.period ? ' is-active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(id === model.period));
    if (!model.periods?.[id]) { button.disabled = true; button.title = '다음 데이터 갱신부터 표시됩니다'; }
    button.addEventListener('click', () => { root._aioSectorMapPeriod = id; rerender(); });
    tabs.append(button);
  }
  head.append(tabs);
  host.append(head);
  if (!model.available) { host.append(el(doc, 'p', model.reason || '스크리너 수익률 수신 대기', 'briefing-empty')); return model; }

  const basisText = model.basis
    ? model.current ? `${shortDate(model.basis)} 미국 종가 기준` : `${shortDate(model.basis)} 미국 종가 기준(최신 거래일 ${shortDate(model.expectedSession)} 반영 전 — 지금이 아닌 그날의 지도)`
    : '종가 기준일 확인 필요';
  const sizeText = model.sizeBasis === 'index-weight' ? `넓이 = 지수 비중(${model.members}종목${model.weightsAsOf ? ` · ${shortDate(model.weightsAsOf)} 보유 비중` : ''})` : `넓이 = 시가총액 근사(공시 주식 수 × 종가, ${model.drawn}/${model.members}종목)`;
  host.append(el(doc, 'p', `${sizeText} · 색 = ${model.periodLabel} 수익률 · ${basisText}`, 'sector-map-basis'));
  host.append(el(doc, 'p', model.lead, 'sector-map-lead'));

  const canvas = el(doc, 'div', null, 'sector-map-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `S&P 500 섹터 지도, ${model.periodLabel} 수익률. ${model.lead} 섹터별 숫자와 종목 이동은 아래 '섹터별 숫자'에서 볼 수 있습니다.`);
  host.append(canvas);
  const detail = el(doc, 'p', '타일에 마우스를 올리거나 누르면 종목이 표시됩니다. 두 번 누르면 종목 화면으로 이동합니다.', 'sector-map-detail');
  detail.setAttribute('aria-live', 'polite');
  host.append(detail, legend(doc, model.steps));

  const paint = () => {
    const width = Math.max(280, Math.floor(canvas.clientWidth || host.clientWidth || 960));
    // Landscape on wide screens; on a phone the sectors stack into a taller map so tiles keep a readable size.
    const height = width >= 720 ? Math.round(width * 0.54) : Math.round(width * 1.25);
    canvas.style.height = `${height}px`;
    const { sectors, tiles } = layoutSectorMap(model, width, height, { header: width >= 720 ? 18 : 16 });
    const nodes = [];
    for (const sector of sectors) {
      const box = el(doc, 'div', null, 'sector-map-sector');
      Object.assign(box.style, { left: `${sector.x}px`, top: `${sector.y}px`, width: `${sector.w}px`, height: `${sector.h}px` });
      if (sector.showHeader) box.append(el(doc, 'span', `${sector.label} ${signed(sector.ret, 1)}`, 'sector-map-sector-label'));
      nodes.push(box);
    }
    let selected = null;
    for (const tile of tiles) {
      const shade = shadeOf(tile.ret, model.steps);
      const node = el(doc, 'div', null, `sector-map-tile is-${shade}`);
      Object.assign(node.style, { left: `${tile.x}px`, top: `${tile.y}px`, width: `${Math.max(0, tile.w - 1)}px`, height: `${Math.max(0, tile.h - 1)}px` });
      node.dataset.sym = tile.sym;
      if (tile.w >= 30 && tile.h >= 18) {
        const size = Math.max(10, Math.min(20, Math.sqrt(tile.w * tile.h) / 5.2));
        node.style.fontSize = `${size.toFixed(1)}px`;
        node.append(el(doc, 'strong', tile.sym));
        if (tile.h >= size * 2.6 && tile.w >= 40) node.append(el(doc, 'span', tile.staleRet != null ? '기준일 다름' : signed(tile.ret, Math.abs(tile.ret ?? 0) >= 10 ? 1 : 2)));
      }
      const describe = () => `${tile.sym}${tile.name ? ` · ${tile.name}` : ''} · ${tile.sectorLabel} · ${model.sizeBasis === 'index-weight' ? `지수 비중 ${tile.value.toFixed(2)}%` : `시가총액 약 ${tile.value >= 1e12 ? `${(tile.value / 1e12).toFixed(2)}조` : `${Math.round(tile.value / 1e8).toLocaleString('ko-KR')}억`} 달러`} · ${model.periodLabel} ${tile.staleRet != null ? `${signed(tile.staleRet)} (${shortDate(tile.basis)} 종가 · 기준일이 달라 색과 평균에서 제외)` : `${signed(tile.ret)}${tile.basis && tile.basis !== model.basis ? ` (${shortDate(tile.basis)} 종가)` : ''}`}`;
      node.addEventListener('mouseenter', () => { detail.textContent = describe(); });
      node.addEventListener('click', () => {
        if (selected === tile.sym && typeof root.showTicker === 'function') { root.showTicker(tile.sym); return; }
        selected = tile.sym;
        detail.textContent = `${describe()} — 한 번 더 누르면 종목 화면으로 이동합니다.`;
      });
      nodes.push(node);
    }
    canvas.replaceChildren(...nodes);
  };
  paint();
  // Repaint on width changes only (the map is laid out in pixels).
  try {
    root._aioSectorMapObserver?.disconnect?.();
    let lastWidth = canvas.clientWidth;
    if (typeof root.ResizeObserver === 'function') {
      // P1681: paint sets the canvas height, which can toggle the page scrollbar and resize the canvas again inside the
      // same observation ("ResizeObserver loop completed with undelivered notifications") — repaint on the next frame.
      let frame = 0;
      const schedule = typeof root.requestAnimationFrame === 'function' ? (fn) => root.requestAnimationFrame(fn) : (fn) => setTimeout(fn, 16);
      const observer = new root.ResizeObserver(() => {
        if (!canvas.isConnected) { observer.disconnect(); return; }
        if (frame || Math.abs(canvas.clientWidth - lastWidth) <= 8) return;
        frame = schedule(() => { frame = 0; if (!canvas.isConnected) return; lastWidth = canvas.clientWidth; paint(); });
      });
      observer.observe(canvas);
      root._aioSectorMapObserver = observer;
    }
  } catch (_) {}

  const table = el(doc, 'details', null, 'sector-map-table');
  table.append(el(doc, 'summary', '섹터별 숫자'));
  const dl = el(doc, 'dl', null, 'regime-evidence');
  for (const sector of [...model.sectors].sort((a, b) => (b.ret ?? -Infinity) - (a.ret ?? -Infinity))) {
    const movers = sector.members.filter((item) => item.ret != null);
    const best = [...movers].sort((a, b) => b.ret - a.ret)[0];
    const worst = [...movers].sort((a, b) => a.ret - b.ret)[0];
    // P1681: the tiles are pointer-only, so the table is the keyboard path — its strongest/weakest names open the stock page.
    const dd = el(doc, 'dd', `${signed(sector.ret)} · ${sector.count}종목 중 ${sector.up}개 상승 · `);
    const symbolButton = (item) => {
      const button = el(doc, 'button', `${item.sym} ${signed(item.ret, 1)}`, 'breadth-drill-symbol');
      button.type = 'button';
      button.addEventListener('click', () => root.showTicker?.(item.sym));
      return button;
    };
    dd.append('가장 강한 ', best ? symbolButton(best) : '—', ' · 가장 약한 ', worst ? symbolButton(worst) : '—');
    dl.append(el(doc, 'dt', sector.label), dd);
  }
  table.append(dl);
  const guide = el(doc, 'details', null, 'sector-map-table');
  guide.append(el(doc, 'summary', '지도 읽는 법'));
  guide.append(el(doc, 'p', `큰 상자는 섹터, 그 안의 타일은 종목입니다. 타일 넓이는 지수 안에서 차지하는 비중이라, 큰 타일 몇 개의 색이 지수 등락을 거의 결정합니다. 색은 ${model.periodLabel} 수익률이며 오르면 빨강, 내리면 파랑, 진할수록 크게 움직였습니다. 기간이 길수록 색 구간도 넓혀 같은 진하기가 비슷한 정도의 움직임을 뜻합니다. 회색은 AIO가 수익률을 수집하지 않는 종목입니다.`, 'regime-read'));
  guide.append(el(doc, 'p', '지도에 빨강이 넓어도 소수 대형주만 오른 날이면 시장 폭은 좁을 수 있습니다 — 위 문장의 상위 10종목과 나머지 비교, 시장 상태의 시장 폭과 함께 봅니다. 색은 지난 움직임이며 매수·매도 신호가 아닙니다.', 'regime-read'));
  host.append(table, guide);
  return model;
}
