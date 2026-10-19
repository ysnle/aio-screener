// Core screener lane (refresh-screener.yml): universe, price factors, SEC/FMP fundamentals, ticker news, screener.json.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { factorScopesByMarket, listingMarketOfSymbol } from '../../src/domain/market/session-time.js';
import { reconcileSecRecord } from '../../src/domain/fundamental/sec-report.js';
import { secFundamentalRowFields } from '../../src/domain/fundamental/sec-row-fields.js';
import { distributionDaySeries } from '../../src/domain/market/breadth-signals.js';
import { updateCandidateArchive } from '../lib/candidate-archive.mjs';
import { round } from '../lib/producer-math.mjs';
import { encodeScreenerArtifact, expandScreenerArtifact } from '../../src/data/screener-extended.js';
import { _mean, backtestFactors } from '../lib/factors.mjs';
import { isSessionComplete, sessionSegmentOfSymbol, listingCurrencyOf, priceHistoryFromRows, priceFactorRow } from '../../src/domain/screener/price-factors.js';
import { indexReturnsByDate } from '../../src/domain/technical/follow-through.js';
import { fetchJSON } from '../lib/producer-http.mjs';
import { TICKER_NEWS_MAX_AGE_MS, deriveTickerNewsLineage, fetchTickerNewsItems, planTickerNewsTargets, selectTickerNewsMemo } from '../lib/news-selection.mjs';
import { REPO_ROOT, SEC_FUNDAMENTALS_OUT } from './paths.mjs';
import { mapLimit, fetchHistory } from './quotes.mjs';
import { reconcileKrExchangeCloses, summarizeKrCloseReconciliation, fetchKrExchangeDaily } from './kr-exchange.mjs';
import { computeScreenerBreadthHistory, writeBreadthContributors, updateScreenerBreadthHistory } from './screener-breadth.mjs';

// ── v50.52 Track1: 스크리너 팩터 enrichment (정적 SCREENER_DB → 라이브 팩터 데이터) ──
// 왜: SCREENER_DB(js/aio-data.js)는 시총/RSI/시그널이 하드코딩(2026-04 기준)이라 stale.
//     서버에서 유니버스 1년 일별 종가를 받아 모멘텀/저변동/추세/RSI 팩터를 계산해 screener.json으로
//     떨군다(일 1회 자가 스로틀). 클라가 병합 → 멀티팩터 랭킹의 입력. value/quality(P/E·마진)는
//     무료 대규모 소스 없음 → 가격 파생 4팩터부터(정직). 심볼은 SCREENER_DB에서 런타임 추출(단일 출처).
export const SCREENER_OUT = `${REPO_ROOT}/public-data/screener.json`;

// 2026-10-13 V03: the fund flag read only `sector === 'ETF'`, so the eleven sector SPDRs (index 'ETF',
// sector = their GICS sector) and IWM/DIA (sector Financials) were counted as stocks in breadth. A fund is
// declared by the catalogue's index or sector, or named as one (ETF / SPDR); a company name such as
// "Northern Trust" is not matched.
const KNOWN_FUND_SYMBOLS = new Set(['IWM', 'DIA', 'SPY', 'QQQ', 'VOO', 'IVV', 'VTI']);
export function screenerAssetType(row) {
  const sym = String(row?.sym || '').toUpperCase();
  const index = String(row?.index || '').toUpperCase();
  const sector = String(row?.sector || '').toUpperCase();
  const name = String(row?.name || '');
  if (index === 'ETF' || sector === 'ETF' || KNOWN_FUND_SYMBOLS.has(sym) || /\bETF\b|\bSPDR\b/i.test(name)) return 'ETF';
  return 'stock';
}

// v51.94/Phase 2 [B6]: 심볼 목록을 js/aio-data.js 소스 텍스트 정규식 스크래핑 대신
// public-data/screener-universe.json(scripts/sync-screener-universe.mjs가 SCREENER_DB에서
// 생성하는 JSON 아티팩트)에서 직접 읽는다. 이전 방식은 "\n];" 문자열 탐색으로 배열 끝을
// 찾아 취약했다(배열 안 어딘가에 그 정확한 바이트열이 나타나면 조기 종료) — JSON은 그런
// 경계 추측이 필요 없다. screener-universe.json이 오래됐거나 없으면(sync 누락) CI의
// ci-data-pipeline-contract-check.mjs가 drift를 잡아낸다.
export async function getScreenerUniverse() {
  try {
    const raw = await readFile(`${REPO_ROOT}/public-data/screener-universe.json`, 'utf8');
    const j = JSON.parse(raw);
    const syms = (j.universe || []).map(r => r && r.sym).filter(Boolean);
    return {
      symbols: [...new Set(syms)],
      // P1443: the backtest ranks with the live model, which normalizes within sectors.
      sectors: Object.fromEntries((j.universe || []).filter(r => r && r.sym).map(r => [r.sym, r.sector || null])),
      // P1449: breadth contributors must say which entries are ETFs (asset type), not silently
      // mix them into "미국 주식" counts — ETFs are already inside the screener universe.
      assetType: Object.fromEntries((j.universe || []).filter(r => r && r.sym).map(r => [r.sym, screenerAssetType(r)])),
      shareClassOf: Object.fromEntries((j.universe || []).filter(r => r && r.sym && r.shareClassOf).map(r => [r.sym, r.shareClassOf])),
      meta: j.meta && typeof j.meta === 'object' ? j.meta : {},
      generatedFrom: j.generatedFrom || 'unknown',
      generatedBy: j.generatedBy || 'unknown'
    };
  } catch (e) {
    console.warn('[fetch-data] screener-universe.json 읽기 실패:', e && e.message);
    return { symbols: [], meta: {}, generatedFrom: null, generatedBy: null };
  }
}

// Yahoo 심볼 정규화: 클래스주 BRK.B→BRK-B. KR(.KS/.KQ)·일반은 보존.
const _yhSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');

// v51.91 P586/C2: append each backtest run's IC/spread/hitRate to a small time series so drift
// (or a broken factor silently going to IC~0) is visible across runs instead of being overwritten
// every 6h with no history. Separate file from history.json (daily market data, different
// producer/cadence) to avoid entangling two independently-working accumulation paths.
const BACKTEST_HIST = `${REPO_ROOT}/public-data/backtest-history.json`;
async function updateBacktestHistory(backtest) {
  if (!backtest || !backtest.ic) return null;
  try {
    let hist = [];
    try { const raw = JSON.parse(await readFile(BACKTEST_HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    const today = new Date().toISOString().slice(0, 10);
    const rec = {
      date: today,
      asOf: backtest.asOf,
      modelFingerprint: backtest.modelFingerprint,
      n: backtest.n,
      dates: backtest.dates,
      ic: backtest.ic,
      quantileSpread: backtest.quantileSpread,
      quantileSpreadNet: backtest.quantileSpreadNet,
      transactionCostPct: backtest.transactionCostPct,
      hitRate: backtest.hitRate,
      netHitRate: backtest.netHitRate,
      turnover: backtest.turnover,
      liquidity: backtest.liquidity,
      executionModel: backtest.executionModel,
      universePolicy: backtest.universePolicy,
      weightRegime: backtest.weightRegime,
    };
    const idx = hist.findIndex((h) => h && h.date === today);
    if (idx >= 0) hist[idx] = rec; else hist.push(rec);   // 같은 날 재실행 = upsert(최신 실행 우선)
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 180) hist = hist.slice(hist.length - 180);   // ~6개월 cap (일 단위)
    await atomicWriteFile(BACKTEST_HIST, JSON.stringify(hist));
    return { days: hist.length, today, upsert: idx >= 0 ? 'update' : 'append' };
  } catch (e) {
    console.warn('[fetch-data] backtest history 갱신 실패(무시):', e && e.message || e);
    return null;
  }
}

// v50.54 3B/3C: FMP 밸류/퀄리티/어닝 enrichment — process.env.FMP_API_KEY 있을 때만(유료 티어 권장).
//   per-symbol ratios-ttm(PE/PB/EV-EBITDA/ROE/마진) + financial-growth(매출성장) + earnings-surprises(EPS 서프라이즈).
//   KR(.KS/.KQ)은 FMP 미지원 → 제외. 키 없으면 null(클라 4팩터 폴백·무회귀).
const _fmpSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');
async function enrichFundamentals(syms) {
  const key = process.env.FMP_API_KEY;
  if (!key) return { data: null, hasKey: false, ok: 0, total: 0, planError: false };
  const base = 'https://financialmodelingprep.com/api/v3';
  const us = syms.filter(s => !/\.(KS|KQ)$/i.test(s));
  const out = {};
  let ok = 0;
  let planError = false; // HTTP 403/401 = 플랜 미지원 또는 키 무효

  // 첫 심볼로 플랜/키 유효성 선진단 (전체 실행 전에 문제 조기 감지)
  const diagSym = encodeURIComponent(_fmpSym(us[0] || 'AAPL'));
  try {
    const diagR = await fetchJSON(`${base}/ratios-ttm/${diagSym}?apikey=${key}`, {}, 1);
    if (Array.isArray(diagR) && diagR.length === 0) {
      console.warn(`[fetch-data] FMP 선진단: ratios-ttm 응답 빈 배열 — 플랜 미지원 가능성. 심볼: ${us[0]}`);
    }
  } catch (e) {
    const msg = e && e.message || String(e);
    if (/HTTP 4(0[13])/.test(msg)) {
      planError = true;
      console.warn(`[fetch-data] FMP 키 오류 또는 플랜 불충분: ${msg}`);
      console.warn('[fetch-data] FMP ratios-ttm/financial-growth는 Starter 플랜($14.99/월) 이상 필요. 무료 키는 이 엔드포인트를 지원하지 않습니다.');
      console.warn('[fetch-data] GitHub Secret 이름이 FMP_API_KEY 인지 확인하세요.');
      return { data: null, hasKey: true, ok: 0, total: us.length, planError: true };
    }
    console.warn(`[fetch-data] FMP 선진단 실패: ${msg} — 계속 진행`);
  }

  await mapLimit(us, 4, async (sym) => {
    const s = encodeURIComponent(_fmpSym(sym));
    try {
      const fmpFetch = (endpoint) =>
        fetchJSON(`${base}/${endpoint}?apikey=${key}`, {}, 1)
          .catch(e => { console.warn(`[fetch-data] FMP ${sym} ${endpoint}: ${e && e.message}`); return null; });
      const [ratios, growth, earn] = await Promise.all([
        fmpFetch(`ratios-ttm/${s}`),
        fmpFetch(`financial-growth/${s}?period=annual&limit=1`),
        fmpFetch(`earnings-surprises/${s}`),
      ]);
      const r = Array.isArray(ratios) ? ratios[0] : null;
      const g = Array.isArray(growth) ? growth[0] : null;
      const e = Array.isArray(earn) ? earn[0] : null;
      const rec = {};
      if (r) {
        if (typeof r.peRatioTTM === 'number' && r.peRatioTTM > 0) rec.pe = round(r.peRatioTTM, 2);
        if (typeof r.priceToBookRatioTTM === 'number' && r.priceToBookRatioTTM > 0) rec.pb = round(r.priceToBookRatioTTM, 2);
        if (typeof r.enterpriseValueMultipleTTM === 'number' && r.enterpriseValueMultipleTTM > 0) rec.evEbitda = round(r.enterpriseValueMultipleTTM, 2);
        if (typeof r.returnOnEquityTTM === 'number') rec.roe = round(r.returnOnEquityTTM * 100, 1);
        if (typeof r.netProfitMarginTTM === 'number') rec.margin = round(r.netProfitMarginTTM * 100, 1);
      }
      if (g && typeof g.revenueGrowth === 'number') rec.revGrowth = round(g.revenueGrowth * 100, 1);
      if (e && typeof e.actualEarningResult === 'number' && typeof e.estimatedEarning === 'number' && e.estimatedEarning !== 0) {
        rec.epsSurprise = round((e.actualEarningResult - e.estimatedEarning) / Math.abs(e.estimatedEarning) * 100, 1);
      }
      if (Object.keys(rec).length) {
        // FMP ratios are a convenience/public API observation. The response
        // carries no point-in-time availability or redistributable rights
        // proof, so preserve the values for display but keep ranking use
        // explicitly blocked until a producer supplies that evidence.
        Object.assign(rec, {
          fundamentalSourceKind: 'T3_PUBLIC_DELAYED',
          fundamentalAllowedUse: 'none',
          fundamentalQuality: { status: 'MISSING', stale: true, decisionUse: false, allowedUse: 'none' },
          fundamentalUseBlockedReason: 'point-in-time availability and rights evidence missing'
        });
        out[sym] = rec; ok++;
      }
    } catch (e) { console.warn(`[fetch-data] FMP ${sym} 처리 오류:`, e && e.message); }
  });
  console.log(`[fetch-data] FMP fundamentals: ${ok}/${us.length} 심볼 enriched`);
  if (ok === 0 && us.length > 0) {
    console.warn('[fetch-data] FMP enrichment 0건 — 키 유효하나 플랜 미지원이거나 네트워크 오류일 수 있습니다.');
  }
  return { data: out, hasKey: true, ok, total: us.length, planError: false };
}

export async function enrichSecFundamentals(syms, priceData, priceResults = null, assetTypeOf = {}, { ledgerPath = SEC_FUNDAMENTALS_OUT } = {}) {
  try {
    // v57.81: the extended universe reads its own compact ledger (public-data/sec-fundamentals-extended.json).
    const payload = JSON.parse(await readFile(ledgerPath, 'utf8'));
    const rows = payload && payload.data || {};
    const out = {};
    let available = 0;
    const maxFetchAge = 45 * 86400000;
    // P715 공개 계약 때문에 sec-fundamentals.json의 pe/pb는 가격이 없어 비어 있다.
    // 같은 실행의 메모리 한정 priceResults(adjusted close)로만 재계산한다.
    // 발행 아티팩트에 가격을 기록하지 않으며, 계산 근거(가격·발행주식·관측일)를
    // rec에 함께 남겨 PIT 재현이 가능하게 한다.
    const priceBySym = new Map();
    for (const r of (Array.isArray(priceResults) ? priceResults : [])) {
      if (!r || r.__error || typeof r.sym !== 'string') continue;
      const series = Array.isArray(r.adjCloses) && r.adjCloses.length ? r.adjCloses : r.closes;
      const last = Array.isArray(series) ? series[series.length - 1] : null;
      if (typeof last === 'number' && Number.isFinite(last) && last > 0) priceBySym.set(r.sym, last);
    }
    for (const sym of syms) {
      // 2026-10-13 F08: ETFs/trusts carry no operating financials (USO margin 115%, SLV negative revenue).
      if (assetTypeOf?.[sym] === 'ETF' || String(priceData?.[sym]?.assetType || '').toUpperCase() === 'ETF') continue;
      // P1402 parent equity + F03/F05 heal (revenue per period, margin > 100% withheld, other-year shares dropped).
      const row = reconcileSecRecord(rows[sym]);
      if (!row || !row.fetchedAt || Date.now() - new Date(row.fetchedAt).getTime() > maxFetchAge) continue;
      // v57.81: the per-symbol SEC row fields are one shared pure function (src/domain/fundamental/sec-row-fields.js),
      // so the browser's out-of-universe read builds them the same way.
      const rec = secFundamentalRowFields(row, { price: priceBySym.get(sym), dollarVolume30d: priceData?.[sym]?.dollarVolume30d, factorSessionDate: priceData?.[sym]?.factorSessionDate, payloadModel: payload.model });
      if (!rec) continue;
      out[sym] = rec;
      available++;
    }
    return {
      data: out,
      ok: available,
      stored: Object.keys(rows).length,
      eligible: Number(payload.eligible) || 0,
      model: payload.model || 'sec-fy-normalized-v2',
      generatedAt: payload.generatedAt || null,
      source: payload.source || 'SEC EDGAR companyfacts',
      // 2026-10-16: the filer's SEC SIC code per issuer (scripts/fetch-sec-fundamentals.mjs issuerSic).
      sicBySymbol: payload.issuerSic && typeof payload.issuerSic === 'object' ? payload.issuerSic : {}
    };
  } catch (error) {
    return { data: {}, ok: 0, stored: 0, eligible: 0, model: 'sec-fy-normalized-v2', generatedAt: null, source: 'SEC EDGAR companyfacts', error: String(error && error.message || error) };
  }
}

// P1184/R24-03: 품질 라벨을 타임스탬프 존재만으로 CURRENT로 발행하면 provider가 오래된 마지막 봉을
// 돌려준 날에도 artifact에 CURRENT가 남는다(소비측은 같은 행을 4일 경과로 차단한다). 소비측
// factor-ranks와 같은 신선도 예산을 공유해 처음부터 같은 판정을 쓴다 — 라벨이 다르면
// 'CURRENT인데 차단되는' 행이 생긴다.

export async function _enrichPriceFactors(syms, { concurrency = 5 } = {}) {
  const computedAt = new Date().toISOString();
  const fetchOne = async (sym) => {
    // P1442 (review 2026-10-04): factors are labelled "세션 종가 기준", but a refresh 22 minutes after the
    // US open used the in-progress daily bar for returns, volume, ranges and VCP. Only bars whose session
    // has closed (isSessionComplete, the same guard the breadth path uses) enter any factor.
    let fetched = await fetchHistory(_yhSym(sym), '1y');
    const providerMeta = fetched?.meta || null;
    const market = sessionSegmentOfSymbol(sym);
    let providerNullCloseDates = fetched?.nullCloseDates || [];
    let closeReconciliation = null;
    if (market === 'kr' && Array.isArray(fetched) && fetched.length) {
      const exchange = await fetchKrExchangeDaily(sym, fetched[0].date);
      const reconciled = reconcileKrExchangeCloses(fetched, exchange.rows, { nullCloseDates: providerNullCloseDates });
      if (exchange.error && reconciled.report.status !== 'reconciled') reconciled.report.reason = exchange.error;
      fetched = reconciled.rows;
      providerNullCloseDates = reconciled.nullCloseDates;
      closeReconciliation = reconciled.report;
    }
    // v57.81: shared with the browser's out-of-universe read (src/domain/screener/price-factors.js).
    return priceHistoryFromRows(sym, fetched, { providerMeta, nullCloseDates: providerNullCloseDates, closeReconciliation, market });
  };
  const results = await mapLimit(syms, concurrency, fetchOne);
  // 2026-10-19 data audit: the extended run lost one alphabetical block every time (STLN..UNFI 260, STKE..UNTY 265,
  // S–V on 10/17-18) — throttling late in the job, with nothing retrying it. Failed symbols get one slower second
  // pass; a block of 20+ waits first so the throttle can lift.
  const priceMissing = (r) => !r || r.__error || !(Array.isArray(r.closes) && r.closes.length);
  const failedAt = results.map((r, i) => (priceMissing(r) ? i : -1)).filter((i) => i >= 0);
  if (failedAt.length) {
    if (failedAt.length >= 20) await new Promise((resolve) => setTimeout(resolve, 45000));
    const retried = await mapLimit(failedAt.map((i) => syms[i]), 2, (sym) => fetchOne(sym).catch(() => null));
    let recovered = 0;
    failedAt.forEach((i, k) => { if (!priceMissing(retried[k])) { results[i] = retried[k]; recovered += 1; } });
    console.log(`[fetch-data] price factors retry: ${recovered}/${failedAt.length} recovered`);
  }
  // 2026-10-13 F13: non-USD traded value is converted session by session at that currency's daily USD
  // close (one 1y FX series per currency), so KR/JP/TW rows carry a USD figure with its basis instead of null.
  const quoteCurrencyOf = (r) => listingCurrencyOf(r?.sym, r?.providerMeta);
  const fxSeries = new Map();
  for (const currency of new Set(results.filter((r) => r && !r.__error && r.closes).map(quoteCurrencyOf).filter((c) => c && c !== 'USD'))) {
    try {
      const bars = await fetchHistory(`${currency}=X`, '1y');
      const series = (bars || []).filter((bar) => bar && bar.close > 0).map((bar) => ({ date: bar.date, close: bar.close }));
      if (series.length) fxSeries.set(currency, series);
    } catch { /* conversion stays unavailable for this currency */ }
  }
  // v57.87: index one-session returns for the down-day resilience field — S&P 500 for US listings, KOSPI / KOSDAQ for
  // Korean ones — on completed sessions only (the same guard as the factor histories).
  const indexReturns = new Map();
  for (const [key, symbol, segment] of [['us', '^GSPC', 'us'], ['kr', '^KS11', 'kr'], ['kq', '^KQ11', 'kr']]) {
    try {
      const bars = (await fetchHistory(symbol, '1y') || []).filter((bar) => bar && bar.close > 0 && bar.date && isSessionComplete(bar.date, segment));
      if (bars.length > 60) indexReturns.set(key, indexReturnsByDate({ dates: bars.map((bar) => bar.date), closes: bars.map((bar) => bar.close) }));
    } catch { /* resilience stays unavailable for this market */ }
  }
  const data = {};
  let ok = 0;
  for (const r of results) {
    if (!r || r.__error || !r.closes) continue;
    // v57.81: shared with the browser's out-of-universe read (src/domain/screener/price-factors.js).
    const f = priceFactorRow(r, { computedAt, fxSeries, indexReturns });
    if (f) {
      data[r.sym] = f; ok++;
    }
  }
  return { data, results, ok, computedAt };
}

// Daily market breadth from the same price history used by the screener factors.
// The former pipeline fetched 800+ histories but left breadth on a manual snapshot/RSP proxy.
// This output is explicitly the AIO screener universe, not official exchange breadth.
export function computeScreenerBreadth(syms, results, assetTypeOf = null, options = null) {
  const sp500Members = options && options.sp500Members instanceof Set ? options.sp500Members : null;
  const isKr = (sym) => /\.(KS|KQ)$/i.test(String(sym || ''));
  // F07/V04: Tokyo/Taiwan listings are not US stocks; they stay in `all` only. Self-contained on purpose
  // (the contract gate evaluates this function alone); suffixes mirror INTL_LISTING_TIME_ZONE in session-time.js.
  const isUs = (sym) => !isKr(sym) && !/\.(T|TW|TWO)$/i.test(String(sym || ''));
  // v57.50 D21: stocks only — ETFs are excluded from numerator and denominator when the asset type is known.
  const isEtf = (sym) => typeof assetTypeOf === 'function' && assetTypeOf(sym) === 'ETF';
  syms = (syms || []).filter((sym) => !isEtf(sym));
  const validRows = (results || []).filter(r => r && !r.__error && !isEtf(r.sym) && Array.isArray(r.adjCloses) && r.adjCloses.length >= 2
    && r.adjustedCloseStatus !== 'unavailable'
    // Number(null) is 0: a missing adjusted close must fail this check, not count as a decline.
    && typeof r.adjCloses[r.adjCloses.length - 1] === 'number' && Number.isFinite(r.adjCloses[r.adjCloses.length - 1])
    && typeof r.adjCloses[r.adjCloses.length - 2] === 'number' && Number.isFinite(r.adjCloses[r.adjCloses.length - 2]));
  const pct = (n, d) => d > 0 ? round(n / d * 100, 1) : null;
  const meanLast = (arr, n) => {
    if (!Array.isArray(arr) || arr.length < n) return null;
    const values = arr.slice(-n);
    return values.every((v) => typeof v === 'number' && Number.isFinite(v)) ? _mean(values) : null;
  };

  function buildSegment(id, label, include) {
    const segmentSymbols = (syms || []).filter(include);
    const rows = validRows.filter(r => include(r.sym));
    const counts = { above5:0, eligible5:0, above20:0, eligible20:0, above50:0, eligible50:0, above200:0, eligible200:0 };
    let advances = 0, declines = 0, unchanged = 0;
    // v57.75 (crash audit): observedAt was the newest row's time, so one early-updating symbol stamped a segment that
    // still held the previous session for most rows with the new date. It is now the latest time on the date most rows
    // were observed (the session the counts actually describe).
    const dayCount = new Map();
    rows.forEach(r => { const day = String(r.observedAt || '').slice(0, 10); if (day) dayCount.set(day, (dayCount.get(day) || 0) + 1); });
    const sessionDay = [...dayCount.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || null;
    let observedAt = null;
    rows.forEach(r => {
      const c = r.adjCloses;
      const last = c[c.length - 1], prev = c[c.length - 2];
      if (last > prev) advances++; else if (last < prev) declines++; else unchanged++;
      [5,20,50,200].forEach(n => {
        const avg = meanLast(c, n);
        if (avg == null || !isFinite(avg)) return;
        counts['eligible' + n]++;
        if (last > avg) counts['above' + n]++;
      });
      if (r.observedAt && String(r.observedAt).slice(0, 10) === sessionDay && (!observedAt || new Date(r.observedAt).getTime() > new Date(observedAt).getTime())) observedAt = r.observedAt;
    });
    const directional = advances + declines;
    return {
      id, label,
      universe: segmentSymbols.length,
      eligible: rows.length,
      coveragePct: pct(rows.length, segmentSymbols.length),
      observedAt,
      above5: pct(counts.above5, counts.eligible5),
      above20: pct(counts.above20, counts.eligible20),
      above50: pct(counts.above50, counts.eligible50),
      above200: pct(counts.above200, counts.eligible200),
      eligibleByWindow: { d5:counts.eligible5, d20:counts.eligible20, d50:counts.eligible50, d200:counts.eligible200 },
      advanceRatio: directional > 0 ? round(advances / directional, 4) : null,
      advances, declines, unchanged,
    };
  }

  return {
    schemaVersion: '1.0',
    source: 'github-actions:yahoo-1y-adjusted-close',
    method: 'unweighted share above trailing adjusted-close SMA; advance ratio excludes unchanged securities',
    decisionScope: 'research/reference; AIO screener universe, not official exchange breadth',
    segments: {
      all: buildSegment('all', 'AIO 전체 스크리너 유니버스', () => true),
      us: buildSegment('us', 'AIO 미국 스크리너 유니버스', sym => isUs(sym)),
      kr: buildSegment('kr', 'AIO 한국 스크리너 유니버스', sym => isKr(sym)),
      // V16: the same measure on S&P 500 members only (membership from sp500-weights.json), so the
      // participation read is not tilted by the watch list's theme names. Absent membership → no segment.
      ...(sp500Members && sp500Members.size ? { sp500: sp500Segment(sp500Members) } : {}),
    },
  };

  function sp500Segment(members) {
    const segment = buildSegment('sp500', 'S&P 500 구성 종목', (sym) => isUs(sym) && members.has(String(sym).toUpperCase()));
    return { ...segment, indexMembers: members.size, memberCoveragePct: pct(segment.eligible, members.size), membershipSource: 'public-data/sp500-weights.json' };
  }
}

// V16: S&P 500 member symbols from the weights artifact (index-provider ETF holdings), or null.
export function sp500MemberSet(weights) {
  if (weights?.schemaVersion !== 'sp500-weights.v1' || !Array.isArray(weights.rows) || weights.rows.length < 450) return null;
  const members = new Set(weights.rows.map((row) => String(row?.sym || '').trim().toUpperCase()).filter(Boolean));
  return members.size >= 450 ? members : null;
}

// Phase 3: 주요 종목 Google News RSS fetch → data[sym].newsMemo 인라인 갱신.
//   prioSyms: 지수/선물/FX/크립토/KR 제외 후 전달. 동시성 3(레이트리밋 방어).
// 2026-10-13 news audit: U.S. stocks only (ETFs have no issuer news; Korean codes returned English noise), names
// from the universe for the company-name query (N01), a rotating 90-name slice (N04), verified memos carried for
// three days (N04), and a per-row newsStatus so the screener can tell "waiting for its turn" from "fetch failed"
// (N21). newsMemoVerified marks memos whose headline names the issuer (N02 reads it).
export function applyTickerNewsResults(data, { eligible = [], targets = [], results = [], previous = {}, names = {}, nowMs = Date.now() } = {}) {
  const targeted = new Set(targets);
  const eligibleSet = new Set(eligible);
  const bySym = new Map((Array.isArray(results) ? results : []).filter((row) => row && row.sym).map((row) => [row.sym, row]));
  const counts = { collected: 0, retained: 0, noVerifiedArticle: 0, fetchFailed: 0, rotationPending: 0, notCovered: 0 };
  const retain = (sym) => {
    const prior = previous?.[sym];
    const observed = Date.parse(prior?.newsObservedAt || '');
    if (!(prior && prior.newsMemoVerified === true && prior.newsMemo && Number.isFinite(observed) && nowMs - observed <= TICKER_NEWS_MAX_AGE_MS)) return false;
    Object.assign(data[sym], { newsMemo: prior.newsMemo, newsTs: prior.newsObservedAt, newsObservedAt: prior.newsObservedAt,
      newsFetchedAt: prior.newsFetchedAt || null, newsMemoVerified: true, newsMemoSources: Array.isArray(prior.newsMemoSources) ? prior.newsMemoSources : [], newsStatus: 'retained' });
    return true;
  };
  for (const sym of Object.keys(data)) {
    const row = data[sym];
    if (!row) continue;
    for (const key of ['newsMemo', 'newsTs', 'newsObservedAt', 'newsFetchedAt', 'newsMemoVerified', 'newsMemoSources', 'newsStatus']) delete row[key];
    if (!eligibleSet.has(sym)) { row.newsStatus = 'not-covered'; counts.notCovered++; continue; }
    if (!targeted.has(sym)) {
      if (retain(sym)) counts.retained++; else { row.newsStatus = 'rotation-pending'; counts.rotationPending++; }
      continue;
    }
    const result = bySym.get(sym);
    if (!result || result.__error || result.error) {
      if (retain(sym)) counts.retained++; else { row.newsStatus = 'fetch-failed'; counts.fetchFailed++; }
      continue;
    }
    const selected = selectTickerNewsMemo(result.items, { sym, name: names[sym], nowMs });
    // An empty feed is often transient (P734); like a failed fetch it keeps a still-valid verified memo.
    if (!selected && !(Array.isArray(result.items) && result.items.length) && retain(sym)) { counts.retained++; continue; }
    if (!selected) { row.newsStatus = 'no-verified-article'; counts.noVerifiedArticle++; continue; }
    const lineage = deriveTickerNewsLineage(selected.items, result.fetchedAt);
    row.newsMemo = selected.memo;
    row.newsTs = lineage.newsTs;
    row.newsObservedAt = lineage.newsObservedAt;
    row.newsFetchedAt = lineage.newsFetchedAt;
    row.newsMemoVerified = true;
    row.newsMemoSources = selected.sources;
    row.newsStatus = 'collected';
    counts.collected++;
  }
  return counts;
}

async function _enrichTickerNews(prioSyms, data) {
  let universeRows = [];
  try { universeRows = JSON.parse(await readFile(`${REPO_ROOT}/public-data/screener-universe.json`, 'utf8')).universe || []; } catch (_) { universeRows = []; }
  const meta = new Map(universeRows.filter((row) => row && row.sym).map((row) => [row.sym, row]));
  const names = Object.fromEntries([...meta].map(([sym, row]) => [sym, row.name || '']));
  // Universe order (largest names first) is the rotation order; ETFs and rows without a name are not covered.
  // v57.51: the same ETF rule as breadth and SEC (sector SPDRs carry a GICS sector but index 'ETF').
  const eligible = prioSyms.filter((sym) => data[sym] && meta.has(sym) && screenerAssetType(meta.get(sym)) !== 'ETF' && names[sym]);
  let previous = {};
  try { previous = expandScreenerArtifact(JSON.parse(await readFile(SCREENER_OUT, 'utf8'))).data || {}; } catch (_) { previous = {}; }
  const nowMs = Date.now();
  const plan = planTickerNewsTargets(eligible, nowMs);
  const tickerNewsResults = await mapLimit(plan.targets, 3, async (sym) => {
    const fetched = await fetchTickerNewsItems(sym, names[sym], 3);
    return { sym, items: fetched.items, error: fetched.error, fetchedAt: new Date().toISOString() };
  });
  const counts = applyTickerNewsResults(data, { eligible, targets: plan.targets, results: tickerNewsResults, previous, names, nowMs });
  console.log(`[fetch-data] ticker news rotation: ${plan.targets.length}/${eligible.length} targets (offset ${plan.offset}, ${plan.cycleRuns} runs/cycle) · ${JSON.stringify(counts)}`);
  return counts.collected + counts.retained;
}

// v57.81: one merge for the core artifact and the extended shard (the same rule, not a copy).
export function mergeSecIntoFactorRows(data, secData = {}) {
  for (const sym in secData) {
    // A screener row represents a successfully derived factor observation. A
    // filing-only row belongs in sec-fundamentals.json, not in this factor map.
    // Injecting it here makes `ok`, row count and factor readiness disagree.
    if (!data[sym]) continue;
    const sec = secData[sym];
    ['pe','pb','roe','margin','revGrowth'].forEach(key => {
      if (typeof data[sym][key] !== 'number' && typeof sec[key] === 'number') data[sym][key] = sec[key];
    });
    if (!data[sym].fundamentalSource) {
      ['fundamentalSource','fundamentalModel','fundamentalPeriod','fundamentalPeriodEnd','fundamentalObservedAt','fundamentalFiledAt','fundamentalFetchedAt','fundamentalAccession','fundamentalSourceKind','fundamentalAllowedUse','fundamentalQuality','fundamentalRightsId','fundamentalUseBlockedReason'].forEach(key => {
        if (sec[key] != null) data[sym][key] = sec[key];
      });
      // 메모리 한정 가격으로 재계산한 pe/pb는 계산 근거(가격·기저·발행주식·관측일)를
      // 행에 함께 남긴다. 발행 아티팩트에 원시가를 기록하지 않는다.
      // 2026-10-13 F04/F10: the verified share basis and the close it multiplies travel with the row.
      ['pePrice','pePriceBasis','peEarningsBasis','peEarningsThrough','peEarningsConcept','pbPrice','pbPriceBasis','valuationPrice','valuationPriceBasis','valuationSharesOutstanding','valuationSharesObservedAt','valuationSharesCheck','valuationSharesBasis','valuationHeldReason'].forEach(key => {
        if (sec[key] != null) data[sym][key] = sec[key];
      });
    }
  }
  return data;
}

export async function enrichScreener() {
  // 자가 스로틀: screener.json이 20시간 내면 스킵(일 1회). BACKFILL/SCREENER_ENRICH=1로 강제.
  if (process.env.SCREENER_ENRICH !== '1' && process.env.BACKFILL !== '1') {
    try {
      const prev = JSON.parse(await readFile(SCREENER_OUT, 'utf8'));
      if (prev && prev.asOf && (Date.now() - new Date(prev.asOf).getTime()) < 6 * 3600 * 1000) {
        return { skipped: true, count: Object.keys(prev.data || {}).length };
      }
    } catch { /* 최초 실행 */ }
  }
  const universeInfo = await getScreenerUniverse();
  const syms = universeInfo.symbols;
  if (!syms.length) return { skipped: true, count: 0, reason: 'no-symbols' };
  // The configured catalogue is a current membership snapshot, not a point-in-time
  // research universe. Preserve its lineage beside every derived result so consumers
  // cannot mistake retrospective ranking for a predictive, survivorship-correct test.
  const universeLineage = {
    ...(universeInfo.meta || {}),
    generatedFrom: universeInfo.generatedFrom || 'public-data/screener-universe.json',
    generatedBy: universeInfo.generatedBy || null,
    membershipPolicy: 'current-configured-universe-applied-retrospectively',
    lookaheadBias: 'historical-membership-not-available',
    survivorshipBias: 'uncontrolled-current-membership-only',
    allowedUse: 'research-reference-not-predictive-validation'
  };

  // 1단계: 가격 팩터 계산
  const { data, results, ok, computedAt } = await _enrichPriceFactors(syms);
  { const kr = summarizeKrCloseReconciliation(results); console.log(`[fetch-data] KR exchange close: ${JSON.stringify(kr.byStatus)} rows ${kr.rows} · closes corrected ${kr.correctedCloses} · sessions filled ${kr.filledSessions}`); }

  // 2단계: FMP 밸류/퀄리티/어닝 병합(키 있을 때만 — 없으면 4팩터 폴백)
  let fmpResult = { data: null, hasKey: false, ok: 0, total: 0, planError: false };
  try {
    fmpResult = await enrichFundamentals(syms);
    if (fmpResult && fmpResult.data) {
      for (const sym in fmpResult.data) {
        if (data[sym]) Object.assign(data[sym], fmpResult.data[sym]);
      }
    }
  } catch (e) { console.warn('[fetch-data] fundamentals 병합 실패(무시):', e && e.message || e); }

  // 3단계: 무료 공식 SEC annual facts를 FMP 결측 필드에 병합.
  // SEC는 annual filing facts이고 FMP는 TTM이므로 서로 같은 모델처럼 섞지 않는다.
  const secResult = await enrichSecFundamentals(syms, data, results, universeInfo.assetType || {}); // F08: ETFs excluded
  mergeSecIntoFactorRows(data, secResult.data);

  // 4단계: 개별 종목 뉴스 메모 (지수/선물/FX/크립토/KR 제외)
  const prioSyms = syms.filter(s => !/^\^|=F$|=X$|-USD$|\.KS$|\.KQ$/i.test(s));
  let tickerNewsOk = 0;
  try { tickerNewsOk = await _enrichTickerNews(prioSyms, data); }
  catch (e) { console.warn('[fetch-data] ticker news 실패(무시):', e && e.message || e); }
  console.log(`[fetch-data] ticker news: ${tickerNewsOk}종목 뉴스 메모 수집`);

  // 5단계: 횡단면 팩터 백테스트(closes 재사용 — 1패스)
  let backtest = null;
  try {
    backtest = backtestFactors(results.filter(r => r && r.closes && r.closes.length >= 148), {
      universeMeta: universeLineage,
      sectorOf: (sym) => universeInfo.sectors?.[sym] ?? null // P1443: live-model parity (sector-relative z-scores)
    });
  }
  catch (e) { console.warn('[fetch-data] backtest 실패(무시):', e && e.message || e); }
  const assetTypeOf = (sym) => universeInfo.assetType?.[sym] ?? null;
  let sp500Weights = null;
  try { sp500Weights = JSON.parse(await readFile(`${REPO_ROOT}/public-data/sp500-weights.json`, 'utf8')); } catch { /* not collected yet */ }
  // v57.51 V09: a secondary share class (GOOG→GOOGL, FOX→FOXA, NWS→NWSA) is one issuer; equal-weight breadth counts it once.
  const secondaryClass = new Set(Object.keys(universeInfo.shareClassOf || {}));
  const breadthSyms = syms.filter((sym) => !secondaryClass.has(sym));
  const breadthResults = (results || []).filter((row) => !secondaryClass.has(row?.sym));
  const breadth = computeScreenerBreadth(breadthSyms, breadthResults, assetTypeOf, { sp500Members: sp500MemberSet(sp500Weights) });
  // P1449: breadth contributors carry each symbol's asset type so the drilldown can say which
  // single-day moves need a corporate-action check. v57.50 D21: ETFs are no longer in the breadth population.
  const breadthHistory = computeScreenerBreadthHistory(breadthSyms, breadthResults, undefined, Date.now(), assetTypeOf);
  // P1416: distribution days need the index's own volume; one extra daily-bar request.
  let distribution = null;
  try {
    const spxBars = await fetchHistory('^GSPC', '6mo');
    distribution = { series: distributionDaySeries((spxBars || []).map((bar) => ({ date: bar.date, close: bar.close, volume: bar.volume }))) };
  } catch (e) { console.warn('[fetch-data] distribution-day bars unavailable:', e && e.message || e); }
  const breadthHistoryInfo = await updateScreenerBreadthHistory(breadthHistory, Date.now(), distribution);
  await writeBreadthContributors(breadthHistory, Date.now());
  const usUniverse = syms.filter(s => listingMarketOfSymbol(s) === 'US').length;
  const fundamentalCount = syms.filter(sym => {
    const row = data[sym] || {};
    return ['pe','pb','roe','margin','revGrowth'].some(key => typeof row[key] === 'number' && Number.isFinite(row[key]));
  }).length;
  const fundamentalCoveragePct = usUniverse ? round(fundamentalCount / usUniverse * 100, 1) : 0;

  // v51.91 P586/C2: IC/spread/hitRate 시계열 누적(별도 아티팩트) — 매 실행 덮어쓰기로 드리프트가
  // 안 보이던 문제 시정. screener.json 자체는 계속 최신 1개 스냅샷만 유지(기존 소비자 영향 없음).
  let backtestHistInfo = null;
  try { backtestHistInfo = await updateBacktestHistory(backtest); }
  catch (e) { console.warn('[fetch-data] backtest history 실패(무시):', e && e.message || e); }
  if (backtestHistInfo) console.log(`[fetch-data] backtest history: ${backtestHistInfo.days}일 누적 (${backtestHistInfo.upsert})`);

  // P715 (사용자 결정 "클라이언트 직접 fetch 전환"의 스크리너 축): 공개 아티팩트에서 종목별
  // 원시 현재가를 재배포하지 않는다 — 파생 지표(수익률/RSI/SMA대비%/kalman/VCP)만 공개한다.
  // 내부 계산(breadth/backtest)은 위에서 이미 closes를 소비했고, 클라이언트 현재가 컬럼은
  // data-live-price 라이브 갱신 경로로만 채워진다(미커버 종목은 '—').
  for (const sym in data) { if (data[sym] && 'price' in data[sym]) delete data[sym].price; }

  // P1170 (15 D04): 혼합 시장의 전역 max 하나는 개별 종목의 최신성을 대표하지 못한다. 시장별로
  // barStart 범위와 세션 기준일을 남기고, 값의 시간 기저를 basis로 표시한다.
  const factorScopes = factorScopesByMarket(data);
  // 2026-10-13 S&P 500 map: the member weights refreshed just before this step (fetch-sp500-weights.mjs) travel
  // inside the screener artifact, so the page needs no extra request and a missing file is simply an absent field.
  let indexWeights = null;
  try {
    const weights = sp500Weights;
    if (weights?.schemaVersion === 'sp500-weights.v1' && Array.isArray(weights.rows) && weights.rows.length >= 450) {
      indexWeights = { index: 'SP500', asOf: weights.asOf || null, source: weights.source, basis: weights.basis, columns: ['sym', 'sector', 'weight', 'name'], rows: weights.rows.map((row) => [row.sym, row.sector, row.weight, row.name]) };
    }
  } catch { /* weights not collected yet: the map falls back to shares x close */ }

  const payload = {
    asOf: new Date().toISOString(),
    factorObservedAt: breadth.segments.all.observedAt,
    // factorObservedAt은 그 세션 일봉의 **바 시작**이며 종가 기반 팩터의 관측시각이 아니다.
    factorTimeBasis: 'bar-start',
    factorSessionDateByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.sessionDate])),
    factorBarStartByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.barStart])),
    factorComputedAt: computedAt,
    source: 'github-actions:yahoo-1y',
    universe: syms.length,
    ok,
    // P1589: a universe symbol whose history failed this run is listed, not silently absent
    // (WBD/ET appeared in some runs and vanished in others with no trace).
    unfetchedSymbols: syms.filter((sym) => !data[sym]).sort(),
    fmpHasKey: fmpResult.hasKey,
    fmpOk: fmpResult.ok > 0,
    fmpCount: fmpResult.ok,
    fmpPlanError: fmpResult.planError,
    secFundamentalsOk: secResult.ok > 0,
    secFundamentalsCount: secResult.ok,
    secFundamentalsStored: secResult.stored,
    secFundamentalsEligible: secResult.eligible,
    secFundamentalsModel: secResult.model,
    secFundamentalsGeneratedAt: secResult.generatedAt,
    fundamentalCount,
    fundamentalCoveragePct,
    fundamentalCoverageDenominator: usUniverse,
    fundamentalModels: ['fmp-ttm', 'sec-fy-normalized-v2'],
    fundamentalCoverageScope: 'US screener universe; mixed fundamental fields, separate from SEC-only coverage',
    krCloseReconciliation: summarizeKrCloseReconciliation(results),
    breadth,
    breadthHistory: {
      status: breadthHistoryInfo.updated ? 'CURRENT' : 'BLOCKED',
      rows: breadthHistoryInfo.rows,
      artifact: 'public-data/history.json',
      source: 'AIO universe adjusted-close history',
      allowedUse: 'research-history-not-official-exchange'
    },
    indexWeights,
    rankingContract: {
      allowedUse: 'research-relative-ranking-only',
      tradingSignal: false,
      predictiveValidation: 'not-established',
      liveModelParity: false,
      validationReadiness: backtest && backtest.validationReadiness || { status: 'BLOCKED', blockers: ['backtest-not-produced'] },
      reason: 'long-run composite IC is not positive/stable; backtest covers only fixed NEUTRAL momentum/trend/lowvol/kalman subset and excludes unpromoted proposal tilts',
      evidenceArtifact: 'public-data/factor-backtest-longrun.json',
      weightPolicy: 'fixed-neutral-until-explicit-promotion',
      universePolicy: backtest && backtest.universePolicy || universeLineage,
      executionModel: backtest && backtest.executionModel || null,
      liquidityPolicy: backtest && backtest.liquidity || null
    },
    universeLineage,
    data,
    backtest,
  };
  // v57.95: rows are written in the row-defaults encoding (shared lineage once per file); readers expand it.
  await atomicWriteFile(SCREENER_OUT, JSON.stringify(encodeScreenerArtifact(payload)));
  // P1465: record today's default-profile candidates (the page's own ranking path on the files just
  // written) and fill the outcomes of entries whose 21-session window has closed. Non-fatal.
  try {
    const archiveInfo = await updateCandidateArchive({ root: pathToFileURL(`${REPO_ROOT}/`), results, write: (url, text) => atomicWriteFile(fileURLToPath(url), text) });
    console.log(`[fetch-data] candidate archive: ${archiveInfo.action} ${archiveInfo.date || '-'} · entries ${archiveInfo.entries} · measured ${archiveInfo.measured} (+${archiveInfo.filled})`);
  } catch (e) { console.warn('[fetch-data] candidate archive 실패(무시):', e && e.message || e); }
  return { count: ok, universe: syms.length, asOf: payload.asOf, backtestIC: backtest && backtest.ic && backtest.ic.composite, tickerNews: tickerNewsOk, fmpOk: fmpResult.ok > 0, fmpCount: fmpResult.ok, fmpHasKey: fmpResult.hasKey, fmpPlanError: fmpResult.planError, secFundamentalsOk: secResult.ok > 0, secFundamentalsCount: secResult.ok, fundamentalCount, fundamentalCoveragePct };
}
