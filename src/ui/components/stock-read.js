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
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
import { themeStagesFor, themeMarketOf } from '../../domain/scenarios/theme-stage.js';
import { refreshSharedArtifact, SCENARIO_STATE } from '../../data/shared-artifacts.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';
import { summarizeValidation } from './screener-validation.js';
import { el } from './dom.js';
import { openThemeDetail } from '../navigation/theme-detail.js';
import { buildOutOfUniverseRead } from '../../domain/entity/out-of-universe-read.js';
import { requestFiscalHistory, parseFiscalHistory } from './fiscal-read.js';
import { loadFundamentalAnalysis } from './fundamental-analysis-lazy.js';
import { isLendingFinancial, reconcileFiscalHistory } from '../../domain/fundamental/fiscal-read.js';
import { fiscalYearLabel } from '../../domain/fundamental/period.js';

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
    loadJsonArtifact(stableFetcher(root), TICKER_INDEX_REFERENCE_URL, { timeoutMs: 8000 })
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
  scale.append(el(doc, 'span', '52주 저점'), el(doc, 'span', `현재 ${Math.round(read.position * 100)}%`), el(doc, 'span', '52주 고점'));
  box.append(scale, track);
  return box;
}

// v58.53 개편 v2 (3d): four check tiles — 추세 · 위치 · 재무 · 위험. Each prints a short value from the same row (or the
// SEC annual record) the sentences use, with the sentence's own tone; nothing here is a new score.
const TONE_WORD = Object.freeze({ favorable: '우호', burden: '부담', neutral: '중립' });
const TONE_CHIP = Object.freeze({ favorable: 'sx-chip--good', burden: 'sx-chip--warn', neutral: 'sx-chip--neutral' });
const signedText = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}${unit}`;
function checkTile(doc, { name, tone = 'neutral', chip = null, stale = false, value, detail }) {
  const tile = el(doc, 'div', null, 'v2-stock-check');
  tile.dataset.check = name;
  const head = el(doc, 'div', null, 'v2-stock-check__head');
  head.append(el(doc, 'span', name, 'v2-stock-check__name'),
    el(doc, 'span', chip || TONE_WORD[tone] || '중립', `sx-chip sx-chip--sm ${stale ? 'sx-chip--date' : TONE_CHIP[tone] || 'sx-chip--neutral'}`));
  tile.append(head, el(doc, 'b', value, 'v2-stock-check__value'));
  if (detail) tile.append(el(doc, 'span', detail, 'v2-stock-check__detail'));
  return tile;
}
function stockChecks(doc, read, sym, fundamentals, fundamentalsState = null) {
  const facts = read.facts || {};
  const tone = (id) => read.points.find((point) => point.id === id)?.tone || 'neutral';
  const tiles = [];
  if (facts.trendLabel) {
    const lines = [facts.pct50 != null ? `50일선 ${signedText(facts.pct50)}` : null, facts.pct200 != null ? `200일선 ${signedText(facts.pct200)}` : null].filter(Boolean);
    tiles.push(checkTile(doc, { name: '추세', tone: tone('trend'), value: facts.trendLabel, detail: lines.join(', ') }));
  }
  if (read.position != null) {
    tiles.push(checkTile(doc, { name: '위치', tone: tone('range'), value: `52주 범위 ${Math.round(read.position * 100)}%`, detail: read.high != null ? `52주 고점 대비 ${signedText(read.high)}` : '' }));
  }
  // 재무: the SEC annual record (US); a KRX listing reads DART; an ETF (no 재무 공시 next step) has no company filings.
  const isFund = !read.next.some((step) => step.route === 'fundamental');
  if (/\.K[SQ]$/i.test(sym)) tiles.push(checkTile(doc, { name: '재무', chip: 'DART', value: '한국 공시 원문', detail: '사업보고서 기준, 재무 공시 탭' }));
  else if (!isFund) {
    const own = fundamentals && String(fundamentals.symbol || sym).toUpperCase() === sym ? fundamentals : null;
    const num = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
    const growth = num(own?.revGrowth), margin = num(own?.margin), roe = num(own?.roe);
    const fy = String(own?.fiscalPeriodEnd || '').slice(0, 10);
    const stale = !!own?.quality?.stale;
    if (growth != null || margin != null) {
      tiles.push(checkTile(doc, { name: '재무', chip: fy ? (fiscalYearLabel(fy) || 'SEC') : 'SEC', stale,
        value: growth != null ? `매출 ${signedText(growth)}` : `순이익률 ${margin.toFixed(1)}%`,
        detail: [growth != null && margin != null ? `순이익률 ${margin.toFixed(1)}%` : null, roe != null ? `ROE ${roe.toFixed(1)}%` : null, fy ? `${fy} 마감` : null].filter(Boolean).join(', ') }));
    } else if (fundamentalsState === 'loading') tiles.push(checkTile(doc, { name: '재무', chip: '불러오는 중', value: 'SEC 연간 공시', detail: '공시 요약을 불러오는 중입니다' }));
    // Review: only a loaded projection without this issuer is a confirmed absence; a failed or unknown load says so.
    else if (fundamentalsState === 'absent') tiles.push(checkTile(doc, { name: '재무', chip: '없음', stale: true, value: 'SEC 연간 공시 없음', detail: '수집된 연간 공시에 이 종목이 없습니다, 재무 공시 탭' }));
    else tiles.push(checkTile(doc, { name: '재무', chip: '확인 불가', stale: true, value: 'SEC 공시 확인 불가', detail: '공시 요약을 받지 못했습니다, 잠시 뒤 다시 확인' }));
  }
  // 위험: how far the price sits from its 50-day line in its own daily ranges, and the RSI — the stretch, not a forecast.
  if (facts.pct50 != null && facts.adr > 0) {
    tiles.push(checkTile(doc, { name: '위험', tone: tone('extension'), value: `일평균 변동폭 ${(Math.abs(facts.pct50) / facts.adr).toFixed(1)}배`,
      detail: [facts.pct50 >= 0 ? '50일선 위 거리' : '50일선 아래 거리', facts.rsi != null ? `RSI ${facts.rsi.toFixed(1)}` : null].filter(Boolean).join(', ') }));
  } else if (facts.rsi != null) tiles.push(checkTile(doc, { name: '위험', value: `RSI ${facts.rsi.toFixed(1)}`, detail: '50일선 거리 자료 없음' }));
  if (!tiles.length) return null;
  const box = el(doc, 'div', null, 'v2-stock-checks');
  box.setAttribute('role', 'list');
  box.setAttribute('aria-label', '네 가지 확인');
  tiles.forEach((tile) => { tile.setAttribute('role', 'listitem'); box.append(tile); });
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
  box.append(el(doc, 'p', '← 하락, 공통 0% 기준, 상승 →', 'stock-return-signed-axis'), legend);
  return box;
}

// N20: `fundamentals` is the route's SEC annual-facts record for this symbol (state.fundamentals); its recent
// filings become one "최근 공시" line with the original-filing link.
export function renderStockRead({ documentRef: doc, root, symbol, fundamentals = null, fundamentalsState = null }) {
  const host = doc?.getElementById('ticker-read');
  if (!host) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  host.dataset.aioStockReadRenderer = 'native';
  const next = doc.getElementById('ticker-next');
  // v57.54: the 종목 screen's h1 (screen-reader heading; the hub line shows the subject visually).
  const title = doc.getElementById('ticker-page-title');
  if (title) title.textContent = sym ? `종목, ${sym}` : '종목';
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
    if (host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals, fundamentalsState });
  }) : null;
  const row = rawRow ? { ...rawRow, screenRank: rank >= 0 ? rank+1 : null } : onDemand?.status === 'ready' && onDemand.row ? { ...onDemand.row, screenRank: null } : null;
  // P1447: compare with the stock's own market index (KOSPI/KOSDAQ for KRX listings) over the same windows.
  // 2026-10-13 review S07: cut the index at the row's own factor session (same-date comparison), and say how many
  // sessions behind the market's latest completed close that factor session is.
  const benchmark = benchmarkRowFor(sym, root?._aioHistory || [], { through: row?.factorSessionDate || null });
  const rotation = currentRotationItems(root?._serverDataMeta?.rotationHistory, Date.now());
  const alignedBenchmark = row?.factorSessionDate && benchmark.asOf === row.factorSessionDate ? benchmark : { ...benchmark, ret5d:null, ret1m:null, ret3m:null, ret6m:null }; // v57.84: the 5-day window too
  const market = screenerMarket({ sym });
  const latestSession = market === 'KR' ? latestCompletedKrSession(Date.now()) : latestCompletedUsSession(Date.now(), { requirePrevious: false });
  const factorSession = String(row?.factorSessionDate || '').slice(0, 10);
  const sessionLag = factorSession && latestSession?.date && factorSession < latestSession.date ? { session: factorSession, latest: latestSession.date, sessions: countOpenSessionsBetween(factorSession, latestSession.date, market) } : null;
  host.dataset.aioStockReadSymbol = sym;
  const thirteenF = /\.K[SQ]$/i.test(sym) ? null : thirteenFFor(root, sym, () => { if (host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals, fundamentalsState }); });
  // The screener's validation verdict only when its record is already loaded (the 스크리너 screen loads it); the
  // US validation does not describe the KR ranking.
  const validation = market === 'US' && (root?._aioScreenerBacktestHistory || []).length ? summarizeValidation(root._aioScreenerBacktestHistory, root?._aioModelValidationStatus || null, root?._aioRankingWeights || null) : null;
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed && host.isConnected !== false && host.dataset.aioStockReadSymbol === sym) renderStockRead({ documentRef: doc, root, symbol: sym, fundamentals, fundamentalsState }); }).catch(() => {});
  const themeStages = themeStagesFor(root, { symbol: sym, themeIds: themeIdsFor(root, sym, Array.isArray(rows) ? rows : []) });
  const read = buildStockRead({ symbol: sym, row, benchmark: alignedBenchmark, rotation, themes: themesFor(root, sym), themeStages, regime: readMarketRegime(root), universeSize: ranked.length || null, validation, sessionLag, holding: holdingFor(root, sym), thirteenF, fundamentals });
  if (title && read.available && read.name && read.name !== sym) title.textContent = `종목, ${read.name} (${sym})`;
  host.replaceChildren(el(doc, 'h2', '이 종목의 지금', 'briefing-h2 sr-only'));
  if (!read.available) {
    // v57.81: an out-of-universe listing says what is happening (reading, not listed, chart unavailable), not "기록 없음".
    if (onDemand) host.append(outOfUniverseBlock(doc, root, onDemand));
    else host.append(emptyState(doc, { title: '추세·상대강도 기록 없음', reason: read.reason, compact: true }));
    renderNextSteps(doc, next, [{ route: 'technical', label: '차트', why: '일봉과 이동평균 위치' }, { route: 'fundamental', label: '재무 공시', why: '매출·이익·현금흐름' }]);
    return read;
  }
  // v58.53 개편 v2 (3d): ① one hero card — the reading in one line, four checks (추세 · 위치 · 재무 · 위험) and the
  // 52-week bar; ② the index comparison and the rest of the reading as two cards; ③ the sentences behind the tiles fold.
  const hero = el(doc, 'div', null, 'sx-card sx-card--hero v2-stock-hero');
  // 2026-10-14 audit #13: the rank moved from this heading into the reading ('순위' point).
  hero.append(el(doc, 'span', '이 종목의 지금', 'sx-kicker'), el(doc, 'p', `${read.name} — ${read.headline}`, 'briefing-read-headline v2-stock-lede'));
  // P1599 (S03): the position and returns below are completed-close figures, not the live quote at the top (which
  // can be '—'). Name that basis once, beside the figures it governs — by its date, not by its collection.
  const basisDate = String(row?.factorSessionDate || row?.priceDate || '').slice(0, 10);
  const basisShort = basisDate ? `${Number(basisDate.slice(5, 7))}/${Number(basisDate.slice(8, 10))}` : '';
  hero.append(el(doc, 'p', `아래 위치·수익률은 ${basisShort ? `${basisShort} ` : '완료 '}종가 기준입니다 — 위 현재가와 시점이 다를 수 있습니다.${onDemand?.status === 'ready' ? ' 이 종목은 스크리너 랭킹 대상 밖이라 같은 공식으로 요청 시 계산했습니다.' : ''}`, 'briefing-footnote sx-meta'));
  const checks = stockChecks(doc, read, sym, fundamentals, fundamentalsState);
  if (checks) hero.append(checks);
  if (read.position != null) hero.append(rangeVisual(doc, read));
  host.append(hero);
  // P1599 (F107): rows that restate a chart drawn just above (52-week position, index comparison) fold under
  // it; the rest — theme, market, filings, holding, rank — stay as the reading. v58.53: the trend, distance and heat
  // sentences are the check tiles' long form and fold with them.
  const tiled = new Set(['trend', 'extension', 'rsi']);
  const charted = new Set([read.position != null ? 'range' : null, read.spans.some((span) => span.stock != null) ? 'relative' : null].filter(Boolean));
  const item = (point) => {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    const text = el(doc, 'span', Array.isArray(point.lines) ? null : point.text, 'stock-read-point-text');
    // 2026-10-14 audit #5: one line per theme with its crossroads link; the rotation evidence folds under them.
    if (Array.isArray(point.lines)) {
      for (const line of point.lines) {
        const row = el(doc, 'span', line.text, 'stock-read-theme-line');
        if (typeof (themeMarketOf(sym) === 'KR' ? root?.openKrThemeDetail : root?.showThemeDetail) === 'function') {
          const go = el(doc, 'button', '이 테마의 시나리오 →', 'stock-read-point-link');
          go.type = 'button';
          go.setAttribute('aria-label', `${line.label} 테마의 시나리오 보기`);
          go.addEventListener('click', () => openThemeDetail(root, line.id, { symbol: sym }));
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
  const pair = el(doc, 'div', null, 'v2-stock-pair');
  if (read.spans.some((span) => span.stock != null)) {
    const card = el(doc, 'div', null, 'sx-card v2-stock-card');
    const head = el(doc, 'div', null, 'sx-card__head');
    head.append(el(doc, 'h3', `지수 대비, ${read.benchmarkLabel}`, 'sx-card__title'), el(doc, 'span', basisShort ? `${basisShort} 종가, 배당 포함` : '완료 종가', 'sx-card__meta'));
    card.append(head, relativeVisual(doc, read));
    pair.append(card);
  }
  const reading = read.points.filter((point) => !charted.has(point.id) && !tiled.has(point.id));
  if (reading.length) {
    const card = el(doc, 'div', null, 'sx-card v2-stock-card');
    const head = el(doc, 'div', null, 'sx-card__head');
    head.append(el(doc, 'h3', '함께 읽을 것', 'sx-card__title'), el(doc, 'span', '테마, 시장, 공시', 'sx-card__meta'));
    const points = el(doc, 'ul', null, 'stock-read-points');
    reading.forEach((point) => points.append(item(point)));
    card.append(head, points);
    pair.append(card);
  }
  if (pair.childNodes.length) host.append(pair);
  const restated = read.points.filter((point) => charted.has(point.id) || tiled.has(point.id));
  if (restated.length) {
    const fold = el(doc, 'details', null, 'stock-read-fold sx-disclosure v2-stock-fold');
    fold.append(el(doc, 'summary', '네 가지 확인과 그림의 수치를 문장으로 읽기'));
    const list = el(doc, 'ul', null, 'stock-read-points');
    restated.forEach((point) => list.append(item(point)));
    fold.append(list);
    host.append(fold);
  }
  host.append(el(doc, 'p', `근거, 이동평균 추세(50·200일선), RSI(Wilder 1978), 일평균 변동폭 대비 거리, 데이터, ${basisShort ? `${basisShort} ` : ''}완료 종가, ${read.benchmarkLabel} 같은 기간${fundamentals?.form ? `, SEC ${fundamentals.form}` : ''}`, 'sx-evidence v2-stock-evidence'));
  if (onDemand) host.append(outOfUniverseBlock(doc, root, onDemand));
  renderNextSteps(doc, next, read.next);
  return read;
}

// v58.55 (개편 v2 3d): 종목 요약's analysis pair (3d): 듀폰 분해 beside 역 DCF, in its own host so a quote tick (which rebuilds the reading
// card) never resets a slider the reader is moving. Rebuilt only when its inputs change.
export function renderStockAnalysis({ documentRef: doc, root, symbol, fundamentals = null, close = null, sector = null }) {
  const host = doc?.getElementById('ticker-analysis');
  if (!host) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  const own = fundamentals && String(fundamentals.symbol || sym).toUpperCase() === sym ? fundamentals : null;
  if (!sym || /\.K[SQ]$/i.test(sym) || !own) { host.hidden = true; host.replaceChildren(); delete host.dataset.signature; return null; }
  requestFiscalHistory(root, () => {
    if (String(root?._currentTickerId || '').toUpperCase() === sym) renderStockAnalysis({ documentRef: doc, root, symbol: sym, fundamentals, close, sector });
  }, 'stock-analysis');
  const text = root?._aioSecFiscalHistory?.[sym];
  // v58.55 (review): the same precise latest year as 재무 공시 (reconcileFiscalHistory swaps the rounded USD-million row
  // for the issuer's exact annual receipt), so ROE and FCF agree across the two tabs.
  const history = typeof text === 'string' ? reconcileFiscalHistory(parseFiscalHistory(text), own, sym) : [];
  const financial = isLendingFinancial(sym, sector);
  const signature = JSON.stringify([sym, text || '', own.sharesOutstanding ?? null, own.observedAt ?? null, own.sharesObservedAt ?? null, own.quality?.stale ?? null, history.at(-1) ?? null, close?.value ?? null, close?.date ?? null, financial]);
  if (host.dataset.signature === signature && host.childElementCount) return host;
  // A history request still in flight: nothing to draw yet (the callback repaints), unless it already failed.
  if (!history.length && root?._aioSecFiscalHistory === undefined) { host.hidden = true; return null; }
  const analysis = loadFundamentalAnalysis(() => {
    if (String(root?._currentTickerId || '').toUpperCase() === sym) renderStockAnalysis({ documentRef: doc, root, symbol: sym, fundamentals, close, sector });
  });
  if (!analysis) return null; // first use: the cards module is loading (outside the boot bundle); the callback draws them
  const { dupontCard, reverseDcfCard, assetChainState } = analysis;
  host.dataset.signature = signature;
  host.hidden = false;
  host.replaceChildren(el(doc, 'h2', '수익성 구조와 가격이 말하는 기대', 'sr-only'));
  const pair = el(doc, 'div', null, 'v2-stock-pair v2-analysis-pair');
  const dupont = history.length ? dupontCard(doc, history, { financial, fundamentals: own }) : null;
  const dcf = reverseDcfCard(doc, root, { history, fundamentals: own, close, financial, symbol: sym });
  pair.append(...[dupont, dcf].filter(Boolean));
  host.append(pair);
  host.dataset.assetChain = assetChainState(history);
  return host;
}
