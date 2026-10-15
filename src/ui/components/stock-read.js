// P1434: 종목 요약's lead block — one headline, two pictures (52-week position, return vs the S&P 500)
// and the connected reading under them, then where the same question continues.
import { buildStockRead } from '../../domain/entity/stock-read.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';
import { benchmarkRowFor } from '../../domain/market/benchmarks.js';
import { marketRows, screenerMarket } from '../../domain/screener/market-scope.js';
import { currentRotationItems } from '../../domain/themes/produced-rotation.js';
import { latestCompletedKrSession, latestCompletedUsSession, countOpenSessionsBetween } from '../../domain/market/market-calendar.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { themeStagesFor } from '../../domain/scenarios/theme-stage.js';
import { refreshSharedArtifact, SCENARIO_STATE } from '../../data/shared-artifacts.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';
import { summarizeValidation } from './screener-validation.js';
import { el } from './dom.js';
import { buildOutOfUniverseRead } from '../../domain/entity/out-of-universe-read.js';

const TICKER_INDEX_REFERENCE_URL = './public-data/masters/ticker-index-reference.json';

// v57.50 I13: the position weight only from the portfolio surface the portfolio screen already built (vault open,
// one currency basis, total assets known). Nothing is read or unlocked from here.
function holdingFor(root, sym) {
  const surface = root?._aioPortfolioSurface;
  if (!surface || surface.readState !== 'ready' || surface.currencyState === 'mixed-without-conversion') return null;
  const total = Number(surface.totalAssets);
  const row = (Array.isArray(surface.rows) ? surface.rows : []).find((item) => String(item?.symbol || item?.ticker || '').toUpperCase() === sym);
  const value = Number(row?.value);
  if (!row || !(total > 0) || !Number.isFinite(value) || value <= 0) return null;
  return { weightPct: value / total * 100, basisLabel: '현금 포함 총자산 대비' };
}

// v57.50 I12: whether the 13F reference ledger lists this ticker. Loaded once (shared cache with 대가의 포트폴리오);
// until it arrives the 13F link is simply not offered.
function thirteenFFor(root, sym, onLoaded) {
  const index = root?._aioTickerIndexReference;
  if (index && typeof index === 'object') {
    const records = Array.isArray(index.records) ? index.records : [];
    return { covered: index.status === 'REFERENCE_ONLY' && records.some((record) => String(record?.tickerReference || '').toUpperCase() === sym), tickerCount: records.length };
  }
  const fetchFn = root?.fetch || globalThis.fetch;
  if (root && !root._aioTickerIndexReferenceRequested && typeof fetchFn === 'function') {
    root._aioTickerIndexReferenceRequested = true;
    loadJsonArtifact(fetchFn.bind(root), TICKER_INDEX_REFERENCE_URL, { timeoutMs: 8000 })
      .then((value) => { if (value && typeof value === 'object') { root._aioTickerIndexReference = value; onLoaded?.(); } })
      .catch(() => {});
  }
  return null;
}

// v57.81: the session's on-demand record for an out-of-universe listing; the first ask starts the read and re-renders
// when it settles. Records live in the reader's session cache (src/data/on-demand-symbol.js), not on this host.
function onDemandRecord(root, sym, onSettled) {
  const record = typeof root?._aioOnDemandSymbol === 'function' ? root._aioOnDemandSymbol(sym) : null;
  if (record) return record;
  if (typeof root?._aioRequestOnDemandSymbol !== 'function') return null;
  Promise.resolve(root._aioRequestOnDemandSymbol(sym)).then((settled) => { if (settled) onSettled(); }).catch(() => {});
  return { symbol: sym, status: 'loading' };
}

// v57.81: where the listing would sit against the current universe (one visual), the short reading, and the inputs
// that were used or missing folded under it. Labelled as computed on request, outside the published ranking.
function outOfUniverseBlock(doc, root, record) {
  const read = buildOutOfUniverseRead(record);
  const box = el(doc, 'section', null, 'stock-read-ou');
  box.id = 'ticker-out-of-universe';
  box.dataset.onDemandState = read.state;
  box.setAttribute('aria-label', read.title || '랭킹 대상 밖 종목');
  box.append(el(doc, 'h3', read.title, 'stock-read-ou-title'));
  if (read.state === 'ready' && read.rank != null) {
    const visual = el(doc, 'div', null, 'stock-read-range');
    visual.append(el(doc, 'span', `현재 유니버스 ${read.ranked ? `${read.ranked}종목 ` : ''}안의 위치(백분위)`, 'stock-read-vis-title'));
    const track = el(doc, 'div', null, 'stock-read-track');
    const marker = el(doc, 'span', null, 'stock-read-marker');
    marker.style.left = `${Math.max(0, Math.min(100, read.rank)).toFixed(1)}%`;
    track.append(marker);
    const scale = el(doc, 'div', null, 'stock-read-scale');
    scale.append(el(doc, 'span', '하위'), el(doc, 'span', `상위 약 ${read.topPct}%`), el(doc, 'span', '상위'));
    visual.append(track, scale);
    box.append(visual);
  }
  if (read.state === 'ready') read.lines.forEach((line) => box.append(el(doc, 'p', line, 'stock-read-ou-line')));
  else box.append(el(doc, 'p', read.text, 'stock-read-ou-line'));
  if (read.inputs?.length) {
    const fold = el(doc, 'details', null, 'stock-read-fold');
    fold.append(el(doc, 'summary', '계산에 쓴 입력과 빠진 입력'));
    const list = el(doc, 'ul', null, 'stock-read-ou-inputs');
    read.inputs.forEach((input) => { const item = el(doc, 'li', `${input.label}: ${input.status} — ${input.detail}`); item.dataset.factor = input.key; item.dataset.status = input.usable ? 'used' : input.active ? 'missing' : 'inactive'; list.append(item); });
    fold.append(list);
    box.append(fold);
  }
  if (read.state === 'ready') {
    const compare = el(doc, 'button', '스크리너 비교에 넣기', 'stock-read-point-link');
    compare.type = 'button';
    compare.setAttribute('aria-label', `${record.symbol}를 스크리너 비교 목록에 넣기`);
    compare.addEventListener('click', () => {
      const added = typeof root?._aioAddScreenerCompare === 'function' ? root._aioAddScreenerCompare(record.symbol) : ((root._aioPendingCompare ||= []).push(record.symbol), true);
      compare.textContent = added ? '스크리너 비교 목록에 넣었습니다' : '비교 목록이 가득 찼습니다(최대 5종목)';
    });
    box.append(compare);
  }
  return box;
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

// 2026-10-14 audit #5: the theme ids this symbol belongs to (US THEME_MAP; KR_THEME_MAP for KRX listings), the same
// association the company card uses, so both read the same stage rows.
function themeIdsFor(root, symbol, rows) {
  if (/\.K[SQ]$/i.test(symbol)) {
    return koreanThemeGroups(root?.KR_THEME_MAP || {}, rows).filter((group) => group.subThemes.some((sub) => sub.tickers.includes(symbol))).map((group) => group.id);
  }
  return themesFor(root, symbol).map((theme) => theme.id);
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

export function relativeVisual(doc, read) {
  const box = el(doc, 'div', null, 'stock-read-relative');
  box.append(el(doc, 'span', `수익률 — ${read.symbol} vs ${read.benchmarkLabel}`, 'stock-read-vis-title'));
  const rows = read.spans.filter((span) => span.stock != null);
  const max = Math.max(1, ...rows.flatMap((span) => [Math.abs(span.stock), Math.abs(span.bench ?? 0)]));
  for (const span of rows) {
    const line = el(doc, 'div', null, 'stock-return-signed-line');
    line.append(el(doc, 'span', span.label, 'stock-read-bar-label'));
    const pair = el(doc, 'div', null, 'stock-return-signed-pair');
    for (const [kind, value] of [['stock', span.stock], ['bench', span.bench]]) {
      if (value == null) continue;
      const bar = el(doc, 'div', null, `stock-return-signed-bar is-${kind} ${value >= 0 ? 'is-up' : 'is-down'}`);
      const width = Math.abs(value) / max * 50;
      bar.style.width = `${width.toFixed(2)}%`;
      bar.style.left = `${(value < 0 ? 50 - width : 50).toFixed(2)}%`;
      bar.title = `${kind === 'stock' ? read.symbol : read.benchmarkLabel} ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
      const row = el(doc, 'div', null, 'stock-return-signed-row');
      const track = el(doc, 'div', null, 'stock-return-signed-track');
      track.append(bar);
      row.append(track, el(doc, 'span', `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'stock-return-signed-value'));
      pair.append(row);
    }
    line.append(pair);
    box.append(line);
  }
  const legend = el(doc, 'div', null, 'stock-read-legend');
  legend.append(el(doc, 'span', read.symbol, 'is-stock'), el(doc, 'span', read.benchmarkLabel, 'is-bench'));
  box.append(el(doc, 'p', '← 하락 · 공통 0% 기준 · 상승 →', 'stock-return-signed-axis'), legend);
  return box;
}

// N20: `fundamentals` is the route's SEC annual-facts record for this symbol (state.fundamentals); its recent
// filings become one "최근 공시" line with the original-filing link.
export function renderStockRead({ documentRef: doc, root, symbol, fundamentals = null }) {
  const host = doc?.getElementById('ticker-read');
  if (!host) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  host.dataset.aioStockReadRenderer = 'native';
  const next = doc.getElementById('ticker-next');
  // v57.54: the 종목 screen's h1 (screen-reader heading; the hub line shows the subject visually).
  const title = doc.getElementById('ticker-page-title');
  if (title) title.textContent = sym ? `종목 · ${sym}` : '종목';
  if (!sym) { host.replaceChildren(); host.hidden = true; renderNextSteps(doc, next, []); return null; }
  host.hidden = false;
  const rows = call(root, '_aioGetCanonicalScreenerRows', []);
  const list = marketRows(Array.isArray(rows) ? rows : [], screenerMarket({ sym }));
  const rawRow = list.find((item) => item?.sym === sym) || null;
  // 2026-10-14 audit #3/#13: one denominator with the screener — the rows its ranking actually ranked (screenRank).
  // Without a screen result the factor-eligible ordering is the fallback (the same model, before conditions).
  // v57.54: a KR row carried a screenRank from another market's run (삼성전자 "890/239"). The rank is this market's
  // ordinal inside the same row set as its denominator, never the raw field.
  const screened = list.filter(item => Number.isFinite(item?.screenRank)).sort((a, b) => a.screenRank - b.screenRank);
  const ranked = screened.length ? screened : list.filter(item => item.rankingEligibility === 'eligible' && Number.isFinite(item.rank)).sort((a,b) => b.rank-a.rank);
  const rank = rawRow ? ranked.findIndex(item => item.sym === sym) : -1;
  // v57.81 (owner 2026-10-15): a US listing outside the published universe is read on demand with the screener's own
  // formulas (src/data/on-demand-symbol.js) instead of "기록 없음"; its row has no published rank.
  const onDemand = !rawRow && list.length && screenerMarket({ sym }) !== 'KR' ? onDemandRecord(root, sym, () => {
    if (host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals });
  }) : null;
  const row = rawRow ? { ...rawRow, screenRank: rank >= 0 ? rank+1 : null } : onDemand?.status === 'ready' && onDemand.row ? { ...onDemand.row, screenRank: null } : null;
  // P1447: compare with the stock's own market index (KOSPI/KOSDAQ for KRX listings) over the same windows.
  // 2026-10-13 review S07: cut the index at the row's own factor session (same-date comparison), and say how many
  // sessions behind the market's latest completed close that factor session is.
  const benchmark = benchmarkRowFor(sym, root?._aioHistory || [], { through: row?.factorSessionDate || null });
  const rotation = currentRotationItems(root?._serverDataMeta?.rotationHistory, Date.now());
  const alignedBenchmark = row?.factorSessionDate && benchmark.asOf === row.factorSessionDate ? benchmark : { ...benchmark, ret1m:null, ret3m:null, ret6m:null };
  const market = screenerMarket({ sym });
  const latestSession = market === 'KR' ? latestCompletedKrSession(Date.now()) : latestCompletedUsSession(Date.now(), { requirePrevious: false });
  const factorSession = String(row?.factorSessionDate || '').slice(0, 10);
  const sessionLag = factorSession && latestSession?.date && factorSession < latestSession.date ? { session: factorSession, latest: latestSession.date, sessions: countOpenSessionsBetween(factorSession, latestSession.date, market) } : null;
  host.dataset.aioStockReadSymbol = sym;
  const thirteenF = /\.K[SQ]$/i.test(sym) ? null : thirteenFFor(root, sym, () => { if (host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals }); });
  // The screener's validation verdict only when its record is already loaded (the 스크리너 screen loads it); the
  // US validation does not describe the KR ranking.
  const validation = market === 'US' && (root?._aioScreenerBacktestHistory || []).length ? summarizeValidation(root._aioScreenerBacktestHistory, root?._aioModelValidationStatus || null, root?._aioRankingWeights || null) : null;
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals }); }).catch(() => {});
  const themeStages = themeStagesFor(root, { symbol: sym, themeIds: themeIdsFor(root, sym, Array.isArray(rows) ? rows : []) });
  const read = buildStockRead({ symbol: sym, row, benchmark: alignedBenchmark, rotation, themes: themesFor(root, sym), themeStages, regime: readMarketRegime(root), universeSize: ranked.length || null, validation, sessionLag, holding: holdingFor(root, sym), thirteenF, fundamentals });
  if (title && read.available && read.name && read.name !== sym) title.textContent = `종목 · ${read.name} (${sym})`;
  host.replaceChildren(el(doc, 'h2', '이 종목의 지금', 'briefing-h2'));
  if (!read.available) {
    // v57.81: an out-of-universe listing says what is happening (reading, not listed, chart unavailable), not "기록 없음".
    if (onDemand) host.append(outOfUniverseBlock(doc, root, onDemand));
    else host.append(emptyState(doc, { title: '추세·상대강도 기록 없음', reason: read.reason, compact: true }));
    renderNextSteps(doc, next, [{ route: 'technical', label: '차트', why: '일봉과 이동평균 위치' }, { route: 'fundamental', label: '재무 공시', why: '매출·이익·현금흐름' }]);
    return read;
  }
  // 2026-10-14 audit #13: the rank moved from this heading into the reading ('순위' point).
  host.append(el(doc, 'p', `${read.name} — ${read.headline}`, 'briefing-read-headline'));
  // P1599 (S03): the position and returns below are completed-close figures, not the live quote at the top (which
  // can be '—'). Name that basis once, beside the figures it governs — by its date, not by its collection.
  const basisDate = String(row?.factorSessionDate || row?.priceDate || '').slice(0, 10);
  host.append(el(doc, 'p', `아래 위치·수익률은 ${basisDate ? `${Number(basisDate.slice(5, 7))}/${Number(basisDate.slice(8, 10))} ` : '완료 '}종가 기준입니다 — 위 현재가와 시점이 다를 수 있습니다.${onDemand?.status === 'ready' ? ' 이 종목은 스크리너 랭킹 대상 밖이라 같은 공식으로 요청 시 계산했습니다.' : ''}`, 'briefing-footnote'));
  const visuals = el(doc, 'div', null, 'stock-read-visuals');
  if (read.position != null) visuals.append(rangeVisual(doc, read));
  if (read.spans.some((span) => span.stock != null)) visuals.append(relativeVisual(doc, read));
  if (visuals.childNodes.length) host.append(visuals);
  // P1599 (F107): rows that restate a chart drawn just above (52-week position, index comparison) fold under
  // it; the rest — trend, distance, heat, theme, market — stay as the reading.
  const charted = new Set([read.position != null ? 'range' : null, read.spans.some((span) => span.stock != null) ? 'relative' : null].filter(Boolean));
  const item = (point) => {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    const text = el(doc, 'span', Array.isArray(point.lines) ? null : point.text, 'stock-read-point-text');
    // 2026-10-14 audit #5: one line per theme with its crossroads link; the rotation evidence folds under them.
    if (Array.isArray(point.lines)) {
      for (const line of point.lines) {
        const row = el(doc, 'span', line.text, 'stock-read-theme-line');
        row.style.display = 'block';
        if (typeof root?.showThemeDetail === 'function') {
          const go = el(doc, 'button', '이 테마의 시나리오 →', 'stock-read-point-link');
          go.type = 'button';
          go.setAttribute('aria-label', `${line.label} 테마의 시나리오 보기`);
          go.addEventListener('click', () => root.showThemeDetail(line.id));
          row.append(doc.createTextNode(' '), go);
        }
        text.append(row);
      }
      if (point.evidence?.text) {
        const fold = el(doc, 'details', null, 'stock-read-fold');
        fold.append(el(doc, 'summary', point.evidence.summary), el(doc, 'p', point.evidence.text));
        text.append(fold);
      }
    }
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), text);
    if (point.link?.href) {
      const anchor = el(doc, 'a', point.link.label, 'stock-read-point-link');
      anchor.href = point.link.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      if (point.link.ariaLabel) anchor.setAttribute('aria-label', point.link.ariaLabel);
      text.append(doc.createTextNode(' '), anchor);
    }
    return li;
  };
  const points = el(doc, 'ul', null, 'stock-read-points');
  read.points.filter((point) => !charted.has(point.id)).forEach((point) => points.append(item(point)));
  host.append(points);
  const restated = read.points.filter((point) => charted.has(point.id));
  if (restated.length) {
    const fold = el(doc, 'details', null, 'stock-read-fold');
    fold.append(el(doc, 'summary', '위 그림의 수치를 문장으로 읽기'));
    const list = el(doc, 'ul', null, 'stock-read-points');
    restated.forEach((point) => list.append(item(point)));
    fold.append(list);
    host.append(fold);
  }
  if (onDemand) host.append(outOfUniverseBlock(doc, root, onDemand));
  renderNextSteps(doc, next, read.next);
  return read;
}
