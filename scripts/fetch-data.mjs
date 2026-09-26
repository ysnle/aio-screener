// ─────────────────────────────────────────────────────────────────────────
// AIO Screener — 서버측 데이터 수집기 (GitHub Actions cron에서 실행)
//
// 왜 이 파일이 존재하나:
//   브라우저에서 직접 Yahoo/CNN/FRED를 부르면 CORS로 막혀 제3자 프록시를
//   거쳐야 하고(자주 죽음), API 키는 공개 정적 사이트에 못 넣는다(노출).
//   → 이 스크립트가 "서버에서" 데이터를 받아 public-data/data.json으로 떨군다.
//   정적 사이트는 같은 출처의 data.json만 읽으면 되므로 CORS/프록시/키 문제가 0.
//
// 출력: public-data/data.json  (applyLiveQuotes()가 그대로 먹을 수 있는 형식)
// 실행: node scripts/fetch-data.mjs   (Node 20+ 내장 fetch 사용)
// 환경변수(선택): FRED_API_KEY  (없으면 macro 블록은 빈 값 — 사이트는 정적 폴백)
// ─────────────────────────────────────────────────────────────────────────

import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest as runTradingScoreBacktest } from './backtest-trading-score.mjs';
import { deriveMarketSession, publishMarketSnapshot } from './build-market-snapshot.mjs';
import { writeOperationsStatus } from './build-operations-status.mjs';
import { writeReconciliationStatus } from './build-reconciliation-status.mjs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { buildDomainReceipt } from './lib/domain-receipt.mjs';
import { deriveFredCycle } from './lib/refresh-continuity.mjs';
import { percentileRank01, spearman } from './lib/rank-statistics.mjs';
import { factorScopesByMarket, marketOfSymbol, sessionDateInMarket, timeZoneForMarket } from '../src/domain/market/session-time.js';
import { FACTOR_FRESHNESS_MS } from '../src/domain/screener/factor-ranks.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/data.json`;
const HIST = `${__dir}/../public-data/history.json`;
const MARKET_SNAPSHOT_OUT = `${__dir}/../public-data/market-snapshot.json`;
const SEC_FUNDAMENTALS_OUT = `${__dir}/../public-data/sec-fundamentals.json`;

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^DJI','^RUT','^VIX','^VIX3M','^VVIX','^FTSE','^N225','^HSI',
  // 금리 (Yahoo: ^TNX=10Y, ^TYX=30Y, ^FVX=5Y, ^IRX=13주)
  '^TNX','^TYX','^FVX','^IRX',
  // 원자재·환율 (v50.40: GBPUSD/CNY/AUDUSD 추가 — fxbond 페이지 "—" unavailable 해소, 클라이언트 LIVE_SYMBOLS와 정합)
  'CL=F','BZ=F','GC=F','SI=F','DX-Y.NYB','KRW=X','EURUSD=X','JPY=X','GBPUSD=X','CNY=X','AUDUSD=X',
  // 신용·핵심 ETF (breadth/리스크 입력)
  'HYG','LQD','TLT','SPY','QQQ','IWM','RSP','DIA','SMH','XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE','XLB','XLC',
  // 한국 지수
  '^KS11','^KQ11',
  // 크립토
  'BTC-USD','ETH-USD',
  // 미국 메가캡 (ticker/fundamental/technical 기본)
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AVGO','AMD','NFLX','JPM','BRK-B','LLY','UNH','XOM','COST','WMT','PLTR','MU','CRWD','MSTR','COIN',
  // 한국 대표주
  '005930.KS','000660.KS','005380.KS','035420.KS','373220.KS','105560.KS','207940.KS',
];

// FRED 시리즈 (YoY 또는 레벨). PAYEMS는 MoM 차이(천명) = NFP.
// v51.97/Phase 2 [B2]: housingStarts/retailSales/usWageGrowth 추가 — 세 시리즈 ID(HOUST/RSAFS/
// CES0500000003) 모두 클라이언트 자체 FRED_SERIES 테이블(aio-data.js:3195~3216, 개인 FRED 키
// 보유 사용자용 브릿지)에서 이미 실사용 중이던 것을 서버(레포 공용 키)로 승격 — 전 사용자 자동 적용.
// consConf(Conf. Board)는 의도적으로 제외: FRED엔 Conference Board 소비자신뢰 시리즈가 없음(비영리
// 민간기관 유료 라이선스, UMCSENT=미시간대와는 발행기관·척도가 다른 별개 지표 — P456/P593 참조).
// 한국 CPI(FRED KORCPIALLMINMEI 등 OECD 릴레이)는 이번에 보류: 신선도 검증 불가(로컬 네트워크 제약)
// + 이미 더 권위있는 직접 소스(KOSIS API 브릿지 aio-data.js fetchAllKosisData, /data-refresh 통계청
// 수동 확인)가 있어 릴레이로 교체 시 오히려 신선도 퇴보 위험 — 확장 후보로 문서에만 남김.
const FRED_SERIES = {
  // Market-standard headline/core CPI are the non-seasonally-adjusted
  // twelve-month CPI-U series.  Keep the SA series as explicitly named
  // companions below so an analytical consumer cannot mistake one for the
  // BLS release headline.
  cpi:        { id: 'CPIAUCNS', kind: 'yoy' },
  coreCpi:    { id: 'CPILFENS', kind: 'yoy' },
  cpiSa:      { id: 'CPIAUCSL', kind: 'yoy' },
  coreCpiSa:  { id: 'CPILFESL', kind: 'yoy' },
  pce:        { id: 'PCEPI',    kind: 'yoy' },
  corePce:    { id: 'PCEPILFE', kind: 'yoy' },
  fedRate:    { id: 'FEDFUNDS', kind: 'level' },
  unemployment:{ id: 'UNRATE',  kind: 'level' },
  nfp:        { id: 'PAYEMS',   kind: 'mom_diff' }, // 천명 단위 (e.g. 172)
  housingStarts: { id: 'HOUST',          kind: 'level', scale: 0.001 }, // 천 단위→백만 단위 (DATA_SNAPSHOT.housingStarts는 1.47M 형태)
  retailSales:   { id: 'RSAFS',          kind: 'mom_pct' },             // 소매판매 MoM% (레벨 $ 시리즈에서 파생)
  usWageGrowth:  { id: 'CES0500000003',  kind: 'yoy' },                 // 시간당 평균임금 YoY%
  hyOAS:         { id: 'BAMLH0A0HYM2',   kind: 'level', scale: 1 },     // FRED percent; UI converts to bp at the renderer boundary
  dgs2:          { id: 'DGS2',            kind: 'level' },               // 미 국채 2Y (%), 공식 FRED 일별 관측
  dgs5:          { id: 'DGS5',            kind: 'level' },               // 미 국채 5Y (%)
  dgs10:         { id: 'DGS10',           kind: 'level' },               // 미 국채 10Y (%)
  dgs20:         { id: 'DGS20',           kind: 'level' },               // 미 국채 20Y (%)
  dgs30:         { id: 'DGS30',           kind: 'level' },               // 미 국채 30Y (%)
  t10y2y:        { id: 'T10Y2Y',          kind: 'level' },               // 10Y-2Y 스프레드 (%p), 단일 만기에서 추정 금지
};

// BLS Public Data API v1 is a separate official observation path from FRED.
// Keep the bounded allowlist explicit and preserve typed observation evidence
// inside data.json.macro.  Only the explicit NSA headline/core fields may
// become the canonical CPI slots; SA companions stay namespaced below.
const BLS_SERIES = {
  // BLS release headlines use the unadjusted CPI-U index.  SA-derived
  // twelve-month changes remain available under separate metric IDs/fields;
  // they are analytical companions, never an implicit replacement.
  cpi: { id: 'CUUR0000SA0', field: 'blsCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'NSA', displayRole: 'market-standard-headline', definition: 'CPI-U U.S. city average all items, not seasonally adjusted', derive: 'yoy' },
  cpiSa: { id: 'CUSR0000SA0', field: 'blsCpiSaYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', displayRole: 'analytical-seasonally-adjusted', definition: 'CPI-U U.S. city average all items, seasonally adjusted', derive: 'yoy' },
  coreCpi: { id: 'CUUR0000SA0L1E', field: 'blsCoreCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'NSA', displayRole: 'market-standard-core', definition: 'CPI-U U.S. city average all items less food and energy, not seasonally adjusted', derive: 'yoy' },
  coreCpiSa: { id: 'CUSR0000SA0L1E', field: 'blsCoreCpiSaYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', displayRole: 'analytical-seasonally-adjusted-core', definition: 'CPI-U U.S. city average all items less food and energy, seasonally adjusted', derive: 'yoy' },
  unemployment: { id: 'LNS14000000', field: 'blsUnemployment', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  laborForceParticipation: { id: 'LNS11300000', field: 'blsLaborForceParticipation', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  nonfarmPayroll: { id: 'CES0000000001', field: 'blsNfpMoM', unit: 'thousands', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'mom_diff' },
  averageHourlyEarnings: { id: 'CES0500000003', field: 'blsAverageHourlyEarningsYoY', unit: 'USD/hour', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'yoy' },
};
const BLS_ENDPOINT = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const BLS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FRED_HY_OAS_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2';
const FRED_HY_OAS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const treasuryMonth = new Date().toISOString().slice(0, 7).replace('-', '');
const TREASURY_CURVE_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${treasuryMonth}`;
const TREASURY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const AAII_SENTIMENT_URL = 'https://www.aaii.com/sentimentsurvey/sent_results?adv=yes';
const AAII_READER_URL = `https://r.jina.ai/${AAII_SENTIMENT_URL}`;
const AAII_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener-bot/1.0)' };

async function fetchJSON(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, { headers: UA, signal: ctrl.signal, ...opts });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

// RSS/HTML 텍스트 fetch — 단일 시도, JSON API와 달리 retry 불요(피드별 실패는 호출자가 무시).
async function _fetchRss(url, timeoutMs) {
  timeoutMs = timeoutMs || 12000;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } catch (e) { clearTimeout(to); throw e; }
}

// P734: Google News RSS can transiently serve a cached window with no items in
// the completed 08:00 KST cycle. Retry the feed and then broaden only the
// provider query window; the caller still filters every item back to the
// canonical 24-hour cycle, so stale articles are never promoted as current.
async function _fetchRssWithRetry(url, timeoutMs, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await _fetchRss(url, timeoutMs); }
    catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

// v50.24/WO-1: Yahoo는 두 호스트(query1/query2)를 운영하고 차단/레이트리밋이 호스트마다 다르게
// 걸리는 경우가 잦다. GitHub Actions 러너 IP가 한 호스트에서 막혀도 다른 호스트로 폴백 → 전량 실패
// (= data.json 미갱신)를 줄인다. 2 호스트 × 2 시도 = 최대 4회. 그래도 다 실패하면 throw(해당 심볼만).
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 (호스트 폴백 내성) ──
// v51.64 P545: 주말/휴장 수집 시 Yahoo meta.chartPreviousClose가 전주 종가를 반환해
// 주간 변동률이 일간으로 오표시되는 구조적 문제 수정.
// → range=5d OHLCV 배열의 실제 전전일 종가(closes[-2])로 일간 Pct 계산.
//   OHLCV 배열이 2개 미만일 때만 chartPreviousClose로 폴백.
async function fetchQuote(symbol) {
  let lastErr;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=5d';
      const j = await fetchJSON(url, {}, 2);
      const res = j?.chart?.result?.[0];
      const m = res?.meta;
      if (!m || typeof m.regularMarketPrice !== 'number') throw new Error('no meta');
      const price = m.regularMarketPrice;

      // OHLCV 배열에서 실제 전일 종가 추출 (주말 수집 시에도 정확한 trading-day 기준)
      const rawCloses = res?.indicators?.quote?.[0]?.close || [];
      const rawTimestamps = res?.timestamp || [];
      const closeBars = rawCloses
        .map((close, index) => ({ close, timestamp: rawTimestamps[index] }))
        .filter((bar) => bar.close != null && isFinite(bar.close) && bar.close > 0);
      const closes = closeBars.map((bar) => bar.close);
      let prev, pct, pctSource;
      if (closes.length >= 2) {
        prev = closes[closes.length - 2];       // 실제 전일 거래일 종가
        pct  = ((price - prev) / prev) * 100;
        pctSource = 'ohlcv-daily';
      } else {
        // OHLCV 부족 시 메타 필드 폴백 (구형 동작 유지)
        prev = (typeof m.chartPreviousClose === 'number' && m.chartPreviousClose > 0)
          ? m.chartPreviousClose
          : (typeof m.previousClose === 'number' ? m.previousClose : null);
        pct  = (prev && prev > 0) ? ((price - prev) / prev) * 100 : null;
        pctSource = 'chart-meta-fallback';
      }
      return {
        symbol,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketPreviousClose: prev,
        chartPreviousClose: prev,
        // P1255 (07:M04 계열 잔여 D5/N1): quote 경로는 조정 개념을 수집하지 않으므로 그 사실을
        // 선언한다 — 이 가격이 배당·분할 중 무엇을 반영하는지는 공급자 관례에 의존하며 미검증이다.
        priceBasis: 'provider-close-adjustment-scope-undeclared',
        // Yahoo daily timestamps mark the bar OPEN, not its close. For an
        // in-session quote the previous completed bar closes at the boundary
        // represented by the current bar's timestamp. Using the previous
        // bar's own timestamp made otherwise-correct previous-close values
        // appear one market day older on WTI/gold/BTC/KR series.
        regularMarketPreviousCloseObservedAt: closeBars.length >= 2 && Number.isFinite(closeBars[closeBars.length - 1].timestamp)
          ? new Date(closeBars[closeBars.length - 1].timestamp * 1000).toISOString()
          : null,
        // P1192: 위 경계가 이 행의 완료 컷을 넘을 때(진행 중 bar의 개시 시각이 KST-08:00 컷보다
        // 뒤인 창 — FX/상품) 쓸 직전 bar의 개시 경계. 관측 시각이 아니라 bar 경계다.
        previousBarOpenedAt: closeBars.length >= 2 && Number.isFinite(closeBars[closeBars.length - 2].timestamp)
          ? new Date(closeBars[closeBars.length - 2].timestamp * 1000).toISOString()
          : null,
        _pctSource: pctSource,
        _source: 'live:yahoo-gh',
        // Observation lineage: generatedAt is fetch time, not necessarily market observation time.
        regularMarketTime: Number.isFinite(m.regularMarketTime) ? m.regularMarketTime : null,
        observedAt: Number.isFinite(m.regularMarketTime) ? new Date(m.regularMarketTime * 1000).toISOString() : null,
        fetchedAt: new Date().toISOString(),
        delayedByMs: Number.isFinite(m.regularMarketTime) ? Math.max(0, Date.now() - m.regularMarketTime * 1000) : null,
        delayProvenance: {
          observedField: 'Yahoo chart.meta.regularMarketTime',
          measuredAtField: 'fetch-time Date.now()',
          unit: 'milliseconds',
          method: 'max(0, fetchedAt-observedAt)',
          policyOwner: 'scripts/build-market-snapshot.mjs:deriveMarketSession',
          qualityPolicy: 'provider-observation-is-not-current-without-session-and-delay-gate'
        },
        marketState: m.marketState || null,
        marketSession: m.marketState || null,
        exchangeTimezoneName: m.exchangeTimezoneName || null,
        fullExchangeName: m.fullExchangeName || m.exchangeName || null,
        venue: m.fullExchangeName || m.exchangeName || null,
        currency: m.currency || null,
        source: 'Yahoo chart',
        // Yahoo/TwelveData are public delayed/reference feeds. Their observed
        // timestamp is useful lineage but cannot create a licensed decision
        // grant; session/delay gates remain explicit downstream evidence.
        sourceTier: 'T3_PUBLIC_DELAYED',
        sourceKind: 'T3_PUBLIC_DELAYED',
        allowedUse: 'reference-only',
        allowedUseCeiling: 'reference',
        rightsId: 'PUBLIC_REFERENCE',
        qualityStatus: Number.isFinite(m.regularMarketTime) ? 'CURRENT' : 'MISSING',
        quality: { status: Number.isFinite(m.regularMarketTime) ? 'CURRENT' : 'MISSING', stale: false, decisionUse: false, allowedUse: 'reference' },
      };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// v50.99: fetch 성공처럼 보이는 데이터 품질 검증.
// Yahoo가 에러 없이 stale/비정상 데이터를 반환할 수 있음 — 전일 종가 대비 변동폭으로 판별.
// 허용 범위: 금리(±5%p) / 크립토(±50%) / 그 외(±30%). 범위 초과 시 재시도 대상.
function _quoteVerifyTol(symbol) {
  if (/^\^(TNX|TYX|FVX|IRX)$/.test(symbol)) return 5;
  if (/-USD$/.test(symbol)) return 50;
  return 30;
}
function _quoteOk(q) {
  if (!q || q.__error) return false;
  const price = q.regularMarketPrice, prev = q.regularMarketPreviousClose || q.chartPreviousClose;
  if (typeof price !== 'number' || price <= 0) return false;
  if (prev > 0) {
    const chg = Math.abs((price - prev) / prev) * 100;
    if (chg > _quoteVerifyTol(q.symbol)) return false;
  }
  return true;
}

// v51.92/Phase 2 [B1]: Yahoo가 두 호스트 모두 실패할 때의 2차 공급자 폴백.
// 왜 ETF만: Twelve Data는 US 상장 ETF/주식은 Yahoo와 동일한 평문 티커(SPY, QQQ ...)를
// 쓰지만, 지수(^GSPC)·선물(CL=F)·FX(KRW=X)·한국주식은 표기 체계가 다르다. 무료(demo) 키로는
// AAPL 외 심볼이 401이라 실측 검증이 불가능했다 — 틀린 심볼 매핑으로 잘못된 가격이 라이브에
// 들어가는 위험을 피하기 위해, Yahoo·Twelve Data 표기가 1:1로 확실히 같은 이 서브셋(신용·핵심
// ETF, SYMBOLS 배열의 "breadth/리스크 입력" 블록과 동일)으로만 스코프를 한정한다.
// 지수/선물/FX/KR 확장은 실제 유효 키로 심볼 표기를 실측 검증한 뒤 별도로 진행할 것.
const TWELVE_DATA_ETF_FALLBACK_SYMBOLS = new Set([
  'HYG','LQD','TLT','SPY','QQQ','IWM','RSP','DIA','SMH',
  'XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE','XLB','XLC',
]);

async function fetchQuoteTwelveData(symbol, apiKey) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const j = await fetchJSON(url, {}, 2);
  if (j && (j.status === 'error' || j.code)) throw new Error(`twelvedata: ${j.message || j.code}`);
  const price = parseFloat(j && j.close);
  const prev = parseFloat(j && j.previous_close);
  if (!isFinite(price) || price <= 0) throw new Error('twelvedata: no close price');
  const pct = (isFinite(prev) && prev > 0) ? ((price - prev) / prev) * 100 : null;
  return {
    symbol,
    regularMarketPrice: price,
    regularMarketChangePercent: pct,
    regularMarketPreviousClose: isFinite(prev) ? prev : null,
    chartPreviousClose: isFinite(prev) ? prev : null,
    // P1255 (07:M04 계열 잔여 D5): 폴백 공급자도 같은 가격 기준 계약을 선언한다.
    priceBasis: 'provider-close-adjustment-scope-undeclared',
    _pctSource: 'twelvedata-quote',
    _source: 'live:twelvedata-fallback',
    regularMarketTime: j && j.timestamp ? Number(j.timestamp) : null,
    observedAt: j && j.timestamp ? new Date(Number(j.timestamp) * 1000).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    delayedByMs: j && j.timestamp ? Math.max(0, Date.now() - Number(j.timestamp) * 1000) : null,
    delayProvenance: {
      observedField: 'Twelve Data quote.timestamp',
      measuredAtField: 'fetch-time Date.now()',
      unit: 'milliseconds',
      method: 'max(0, fetchedAt-observedAt)',
      policyOwner: 'scripts/build-market-snapshot.mjs:deriveMarketSession',
      qualityPolicy: 'fallback-observation-is-not-current-without-session-and-delay-gate'
    },
    marketState: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    marketSession: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    exchangeTimezoneName: j && j.timezone || null,
    fullExchangeName: j && j.exchange || null,
    venue: j && j.exchange || null,
    currency: j && j.currency || null,
    source: 'Twelve Data quote fallback',
    sourceTier: 'T3_PUBLIC_DELAYED',
    sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'reference-only',
    allowedUseCeiling: 'reference',
    rightsId: 'PUBLIC_REFERENCE',
    qualityStatus: j && j.timestamp ? 'CURRENT' : 'MISSING',
    quality: { status: j && j.timestamp ? 'CURRENT' : 'MISSING', stale: false, decisionUse: false, allowedUse: 'reference' },
  };
}

// 동시성 제한 배치 실행
async function mapLimit(items, limit, fn) {
  const out = [];
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const my = idx++;
      out[my] = await fn(items[my]).catch(e => ({ __error: true, item: items[my], msg: String(e && e.message || e) }));
    }
  });
  await Promise.all(workers);
  return out;
}

// ── FRED ──
async function fetchFred(key) {
  const attemptedAt = new Date().toISOString();
  if (!key) return {
    _source: 'fred:no-key',
    _attemptedAt: attemptedAt,
    _successfulSeries: [],
    _failedSeries: [],
    _failureReason: 'api-key-not-configured'
  };
  // P565/R256: a single failed FRED series used to be swallowed with no log and no field-level
  // flag — only the aggregate macroKeyCount dropped by one, with nothing telling anyone WHICH
  // series broke. enrichFundamentals (FMP) already detects and surfaces plan/auth errors
  // explicitly; this brings FRED to the same standard so a stale/broken series (the mechanism
  // behind Fed/BOJ/BOK/BOE rates going 15-62 days stale) is visible instead of silent.
  const out = { _source: 'fred', _attemptedAt: attemptedAt, _failedSeries: [], _successfulSeries: [] };
  const markFailed = (field) => {
    if (!out._failedSeries.includes(field)) out._failedSeries.push(field);
  };
  for (const [field, spec] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}` +
        `&api_key=${key}&file_type=json&sort_order=desc&limit=14`;
      const j = await fetchJSON(url);
      // A provider can return an HTTP-success JSON envelope containing no
      // usable observations (rate-limit/error payload, '.', or NaN).  Such a
      // response is a failed series, never a current null/zero observation.
      const obs = (j.observations || [])
        .map((o) => ({ d: String(o?.date || ''), v: Number.parseFloat(o?.value) }))
        .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.d) && Number.isFinite(o.v))
        .sort((a, b) => b.d.localeCompare(a.d));
      if (!obs.length) {
        markFailed(field);
        continue;
      }
      let succeeded = false;
      if (spec.kind === 'level') {
        // v51.97/Phase 2 [B2]: scale — 시리즈 원 단위(예: HOUST=천 단위)를 소비처 단위(백만)로
        // 변환. 미지정 시 1(기존 fedRate/unemployment 등 동작 불변).
        const scale = spec.scale || 1;
        const level = round(obs[0].v * scale, 3);
        if (level === null) {
          markFailed(field);
          continue;
        }
        out[field] = level;
        succeeded = true;
        // MoM delta: 이번 달 레벨 - 지난 달 레벨
        if (obs.length >= 2) {
          const delta = round((obs[0].v - obs[1].v) * scale, 3);
          if (delta !== null) out[field + 'Delta'] = delta;
        }
      } else if (spec.kind === 'mom_pct') {
        // v51.97/Phase 2 [B2]: 레벨(예: RSAFS 소매판매 $) 시리즈의 전월 대비 변화율(%).
        if (obs.length >= 2 && obs[1].v !== 0) {
          const change = round((obs[0].v / obs[1].v - 1) * 100, 1);
          if (change !== null) {
            out[field] = change;
            succeeded = true;
          }
        }
      } else if (spec.kind === 'yoy') {
        const cur = obs[0];
        // Do not substitute the oldest available point when an exact
        // twelve-month comparator is absent: that would label a 13/14-month
        // change as YoY and silently falsify the observation period.
        const yoy = obs.find(o => monthsBetween(o.d, cur.d) === 12);
        const curYoY = (yoy && yoy.v !== 0) ? round((cur.v / yoy.v - 1) * 100, 1) : null;
        if (curYoY !== null) {
          out[field] = curYoY;
          succeeded = true;
        }
        // MoM delta in YoY rate: 이번 달 YoY - 지난 달 YoY (인플레이션 속도 변화)
        if (obs.length >= 2) {
          const prev = obs[1];
          const yoyPrev = obs.find(o => monthsBetween(o.d, prev.d) === 12);
          const prevYoY = (yoyPrev && yoyPrev.v !== 0 && yoyPrev.d !== yoy?.d)
            ? round((prev.v / yoyPrev.v - 1) * 100, 1) : null;
          if (curYoY !== null && prevYoY !== null) out[field + 'Delta'] = round(curYoY - prevYoY, 1);
        }
      } else if (spec.kind === 'mom_diff') {
        if (obs.length >= 2 && Number.isFinite(obs[0].v - obs[1].v)) {
          out[field] = Math.round(obs[0].v - obs[1].v); // 천명
          succeeded = true;
        }
        // 전월 대비 delta: 이번 달 변화 - 지난 달 변화
        if (succeeded && obs.length >= 3) {
          const delta = Math.round((obs[0].v - obs[1].v) - (obs[1].v - obs[2].v));
          if (Number.isFinite(delta)) out[field + 'Delta'] = delta;
        }
      }
      if (succeeded) {
        out._successfulSeries.push(field);
        out['_asOf_' + field] = obs[0].d;
      } else {
        markFailed(field);
      }
    } catch (e) {
      markFailed(field);
      console.warn(`[fetch-data] FRED series 실패: ${field} (${spec.id}) — ${e.message}`);
    }
  }
  return out;
}

export function parseFredHyOasCsv(csv, fetchedAt = new Date().toISOString()) {
  const observations = String(csv || '').trim().split(/\r?\n/).slice(1).map((line) => {
    const [observedAt, rawValue] = line.split(',');
    const value = rawValue == null || rawValue.trim() === '' ? NaN : Number(rawValue);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(observedAt || '').trim()) && Number.isFinite(value)
      ? { observedAt: observedAt.trim(), value }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = observations[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'fred-public-series.v1',
    status: 'ok',
    seriesId: 'BAMLH0A0HYM2',
    source: 'FRED public series download (ICE BofA US High Yield Index OAS)',
    sourceKind: 'official-government-relay',
    sourceUrl: FRED_HY_OAS_CSV_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    value: latest.value,
    unit: 'percent',
    allowedUse: 'official-relay-observation-with-publication-lag',
    decisionUse: false
  };
}

export async function fetchFredHyOasPublic(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.value != null && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= FRED_HY_OAS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const csv = await _fetchRss(FRED_HY_OAS_CSV_URL, 18000);
    const parsed = parseFredHyOasCsv(csv, nowIso);
    if (!parsed) throw new Error('FRED public CSV contained no dated numeric HY OAS observation');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.value != null && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'fred-public-series.v1', status: 'unavailable', seriesId: 'BAMLH0A0HYM2',
      source: 'FRED public series download (ICE BofA US High Yield Index OAS)', sourceKind: 'official-government-relay',
      sourceUrl: FRED_HY_OAS_CSV_URL, observedAt: null, fetchedAt: null, attemptedAt: nowIso, value: null,
      unit: 'percent', failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

// ── P1246: FRED DEXKOUS — 공식 USD/KRW 교차검증 (키 불필요) ─────────────────────────────
// FRED의 DEXKOUS는 연준 H.10이 발표하는 공식 일별 원/달러 환율이다. fredgraph.csv 공개 다운로드는
// API 키가 필요 없어(FRED HY OAS와 같은 경로) 로컬 무키 실행에서도 상태를 정직하게 발행할 수 있다.
// 주의: 공식 계열은 공표 지연이 있어 공급자 스팟 종가와 같은 날짜가 아닐 수 있다 — 그래서 이
// 교차검증은 **값 출처가 아니라 참조**다. 불일치는 숨기지 않고 보고하되, 공급자 시계열을 공식 값으로
// 덮어쓰지 않는다(단일 소유권: history의 usdkrw는 Yahoo chart가 계속 소유한다).
const FRED_DEXKOUS_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS';
const FRED_DEXKOUS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function parseFredDexkousCsv(csv, fetchedAt = new Date().toISOString()) {
  const observations = String(csv || '').trim().split(/\r?\n/).slice(1).map((line) => {
    const [observedAt, rawValue] = line.split(',');
    const value = rawValue == null || rawValue.trim() === '' ? NaN : Number(rawValue);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(observedAt || '').trim()) && Number.isFinite(value)
      ? { observedAt: observedAt.trim(), value }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = observations[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'fred-public-series.v1',
    status: 'ok',
    seriesId: 'DEXKOUS',
    source: 'FRED public series download (Federal Reserve H.10 USD/KRW noon buying rate)',
    sourceKind: 'official-government-relay',
    sourceUrl: FRED_DEXKOUS_CSV_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    value: latest.value,
    unit: 'KRW per USD',
    allowedUse: 'official-relay-observation-with-publication-lag',
    decisionUse: false
  };
}

export async function fetchFredDexkousPublic(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.value != null && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= FRED_DEXKOUS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const csv = await _fetchRss(FRED_DEXKOUS_CSV_URL, 18000);
    const parsed = parseFredDexkousCsv(csv, nowIso);
    if (!parsed) throw new Error('FRED public CSV contained no dated numeric DEXKOUS observation');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.value != null && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'fred-public-series.v1', status: 'unavailable', seriesId: 'DEXKOUS',
      source: 'FRED public series download (Federal Reserve H.10 USD/KRW noon buying rate)', sourceKind: 'official-government-relay',
      sourceUrl: FRED_DEXKOUS_CSV_URL, observedAt: null, fetchedAt: null, attemptedAt: nowIso, value: null,
      unit: 'KRW per USD', failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

// 순수 판정: **같은 날짜**의 공급자 완료 종가와 공식 관측치를 비교해 상태를 말한다. 어느 값도 바꾸지
// 않는다. 시점이 다른 두 값(공식 계열의 공표 지연)을 비교해 "불일치"라고 말하면 지연을 데이터 오류로
// 오표기하는 것이므로, 날짜가 다르면 판정하지 않고 not-comparable로 남긴다.
// 실측(2026-09-25): DEXKOUS 최신 관측은 7일 전이고 그 사이 스팟이 2.09% 움직였다 — 지연을 무시한
// 비교는 정상 계열을 매일 'divergent'로 신고했을 것이다.
export function compareUsdKrwCrossCheck({ provider = null, official = null, latestProvider = null, tolerancePct = 5, attemptedAt = new Date().toISOString() } = {}) {
  const providerDate = String(provider?.date || (provider?.observedAt ? String(provider.observedAt).slice(0, 10) : '') || '').slice(0, 10) || null;
  const officialDate = String(official?.observedAt || '').slice(0, 10) || null;
  const base = {
    schemaVersion: 'fx-cross-check.v1',
    provider: 'Yahoo chart KRW=X completed close',
    officialSource: official?.source || 'FRED DEXKOUS (Federal Reserve H.10)',
    officialSourceUrl: official?.sourceUrl || FRED_DEXKOUS_CSV_URL,
    providerValue: provider?.value ?? null,
    providerDate,
    // 최신값은 맥락으로만 싣는다. 비교는 같은 날짜끼리 한다.
    latestProviderValue: latestProvider?.value ?? null,
    latestProviderDate: latestProvider?.date || null,
    officialValue: official?.value ?? null,
    officialDate,
    // 공식 계열의 원본 레코드를 통째로 보존한다 — 상태·출처·실패 사유·수집 시각의 단일 표기이고,
    // 다음 실행이 이 레코드로 12시간 캐시를 재사용한다(별도 아티팩트를 만들지 않는다).
    official: official || null,
    tolerancePct,
    attemptedAt,
    fetchedAt: official?.fetchedAt || null,
    // 참조용이다. 이 레코드는 어떤 소비자의 값도 대체하지 않는다.
    allowedUse: 'reference-only-not-a-value-source',
    decisionUse: false,
  };
  if (!Number.isFinite(base.providerValue) || !Number.isFinite(base.officialValue)) {
    return { ...base, status: 'unavailable', comparable: false, dayGap: null, divergencePct: null, reason: 'no aligned observation on one or both sides' };
  }
  // 공급자 봉의 날짜 스탬프가 공식 관측일과 하루 어긋나는 경우가 있다(FX 일봉 경계 00:00Z vs 발표일
  // 표기). 어긋난 날짜를 그대로 기록하고, 하루까지는 같은 시점으로 본다 — 그 이상은 다른 관측이다.
  const dayGap = (providerDate && officialDate) ? Math.round((Date.parse(providerDate) - Date.parse(officialDate)) / 86400000) : null;
  const comparable = Number.isFinite(dayGap) && Math.abs(dayGap) <= 1;
  const divergencePct = round(Math.abs(base.providerValue / base.officialValue - 1) * 100, 3);
  if (!comparable) {
    return { ...base, status: 'not-comparable', comparable: false, dayGap, divergencePct,
      reason: `provider ${providerDate} and official ${officialDate} are different observations` };
  }
  return {
    ...base,
    status: divergencePct <= tolerancePct ? 'ok' : 'divergent',
    comparable: true,
    dayGap,
    divergencePct,
    // 두 계열은 측정 기준이 다르다(스팟 종가 vs 정오 매입환율). 허용폭을 넘는 차이는 작은 시차가 아니라
    // 다른 상품/배율을 집어온 신호로 읽는다.
    reason: divergencePct <= tolerancePct ? null : `aligned close differs from the official observation by ${divergencePct}% (> ${tolerancePct}%)`,
  };
}

export function parseTreasuryYieldCurveHtml(html, fetchedAt = new Date().toISOString()) {
  const rows = [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
  const parsed = rows.map(row => {
    const datetime = (row.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})T/i) || [])[1] || null;
    if (!datetime) return null;
    const pick = (years) => {
      const pattern = new RegExp(`<td\\b[^>]*headers="view-field-bc-${years}year-table-column"[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
      const raw = (row.match(pattern) || [])[1] || '';
      const normalized = raw.replace(/<[^>]*>/g, '').trim();
      const value = normalized === '' ? NaN : Number(normalized);
      return Number.isFinite(value) ? value : null;
    };
    const values = { dgs2: pick(2), dgs5: pick(5), dgs10: pick(10), dgs20: pick(20), dgs30: pick(30) };
    return Object.values(values).every(Number.isFinite) ? { observedAt: datetime, values } : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = parsed[0] || null;
  if (!latest) return null;
  const values = { ...latest.values, t10y2y: round(latest.values.dgs10 - latest.values.dgs2, 3) };
  return {
    schemaVersion: 'us-treasury-curve.v1',
    status: 'ok',
    source: 'U.S. Treasury Daily Par Yield Curve Rates',
    sourceKind: 'T1_OFFICIAL',
    sourceUrl: TREASURY_CURVE_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    values,
    allowedUse: 'official-observation-and-derived-same-date-spread',
    decisionUse: false
  };
}

export function parseTreasuryYieldCurveXml(xml, fetchedAt = new Date().toISOString()) {
  const entries = [...String(xml || '').matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => match[1]);
  const parsed = entries.map((entry) => {
    const observedAt = (entry.match(/<d:NEW_DATE\b[^>]*>(\d{4}-\d{2}-\d{2})T/i) || [])[1] || null;
    if (!observedAt) return null;
    const pick = (years) => {
      const raw = (entry.match(new RegExp(`<d:BC_${years}YEAR\\b[^>]*>([^<]+)<\\/d:BC_${years}YEAR>`, 'i')) || [])[1];
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const values = { dgs2: pick(2), dgs5: pick(5), dgs10: pick(10), dgs20: pick(20), dgs30: pick(30) };
    return Object.values(values).every(Number.isFinite) ? { observedAt, values } : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = parsed[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'us-treasury-curve.v1',
    status: 'ok',
    source: 'U.S. Treasury Daily Par Yield Curve Rates XML Feed',
    sourceKind: 'T1_OFFICIAL',
    sourceUrl: TREASURY_CURVE_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    values: { ...latest.values, t10y2y: round(latest.values.dgs10 - latest.values.dgs2, 3) },
    allowedUse: 'official-observation-and-derived-same-date-spread',
    decisionUse: false
  };
}

export async function fetchTreasuryYieldCurve(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.status === 'ok' && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= TREASURY_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const xml = await _fetchRss(TREASURY_CURVE_URL, 35000);
    const parsed = parseTreasuryYieldCurveXml(xml, nowIso);
    if (!parsed) throw new Error('official Treasury XML feed contained no complete five-point curve');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.values && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'us-treasury-curve.v1', status: 'unavailable', source: 'U.S. Treasury Daily Par Yield Curve Rates',
      sourceKind: 'T1_OFFICIAL', sourceUrl: TREASURY_CURVE_URL, observedAt: null, fetchedAt: null,
      attemptedAt: nowIso, values: {}, failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

function inferAaiiObservationDate(monthName, day, fetchedAt) {
  const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(String(monthName || '').slice(0, 3).toLowerCase());
  const fetched = new Date(fetchedAt);
  if (monthIndex < 0 || !Number.isFinite(fetched.getTime())) return null;
  let year = fetched.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, monthIndex, Number(day)));
  if (candidate.getTime() > fetched.getTime() + 14 * 86400000) {
    year -= 1;
    candidate = new Date(Date.UTC(year, monthIndex, Number(day)));
  }
  return Number.isFinite(candidate.getTime()) ? candidate.toISOString().slice(0, 10) : null;
}

export function parseAaiiSentimentText(text, fetchedAt = new Date().toISOString(), relayUrl = null) {
  const normalized = String(text || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ');
  const matches = [...normalized.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(\d{1,3}(?:\.\d+)?)%\s*(\d{1,3}(?:\.\d+)?)%\s*(\d{1,3}(?:\.\d+)?)%/gi)];
  const rows = matches.map((match) => {
    const observedAt = inferAaiiObservationDate(match[1], Number(match[2]), fetchedAt);
    const bullish = Number(match[3]);
    const neutral = Number(match[4]);
    const bearish = Number(match[5]);
    const total = bullish + neutral + bearish;
    return observedAt && [bullish, neutral, bearish].every(value => value >= 0 && value <= 100) && Math.abs(total - 100) <= 0.3
      ? { observedAt, bullish, neutral, bearish }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = rows[0] || null;
  if (!latest) return null;
  return {
    status: 'current-reference',
    ...latest,
    spread: round(latest.bullish - latest.bearish, 1),
    period: `week-ending-${latest.observedAt}`,
    source: 'AAII Sentiment Survey',
    sourceKind: relayUrl ? 'publisher-public-web-via-reader-relay' : 'publisher-public-web',
    sourceUrl: AAII_SENTIMENT_URL,
    relayUrl,
    fetchedAt,
    access: 'public-web-terms-apply',
    allowedUse: 'reference-only',
    decisionUse: false,
    note: relayUrl
      ? 'Official public percentages collected through a bounded text relay after the publisher blocked direct automation; reference-only and excluded from trading gates.'
      : 'Official public percentages collected directly; reference-only and excluded from trading gates.'
  };
}

export async function fetchAaiiSentiment(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.status === 'current-reference' && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= AAII_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, cacheHit: true };
  }
  const failures = [];
  for (const candidate of [
    { url: AAII_SENTIMENT_URL, timeoutMs: 15000, relayUrl: null },
    { url: AAII_READER_URL, timeoutMs: 25000, relayUrl: AAII_READER_URL }
  ]) {
    try {
      const text = await _fetchRss(candidate.url, candidate.timeoutMs);
      const parsed = parseAaiiSentimentText(text, nowIso, candidate.relayUrl);
      if (!parsed) throw new Error('no complete dated AAII percentage row');
      return { ...parsed, attemptedAt: nowIso, cacheHit: false };
    } catch (error) {
      failures.push(`${candidate.relayUrl ? 'relay' : 'direct'}:${String(error?.message || error)}`);
    }
  }
  if (previous?.observedAt) return { ...previous, status: 'stale-reference', attemptedAt: nowIso, failureReason: failures.join(' | '), cacheHit: false };
  return {
    status: 'unavailable', bullish: null, neutral: null, bearish: null, spread: null, observedAt: null,
    source: 'AAII Sentiment Survey', sourceKind: 'publisher-public-web', sourceUrl: AAII_SENTIMENT_URL,
    fetchedAt: null, attemptedAt: nowIso, failureReason: failures.join(' | '), allowedUse: 'none', decisionUse: false
  };
}

// AR-07 Batch 0/QG-06: a missing FRED key or a transient series failure must
// not erase a usable last-known-good macro payload. The original observation
// dates remain on each field and the meta status still says the new fetch did
// not succeed, so this is never presented as a fresh observation.
export function mergeMacroLastKnownGood(current, previous) {
  if (!previous || typeof previous !== 'object') return current || {};
  const merged = { ...previous, ...(current || {}) };
  // P1142: `_failureReason`은 no-key/plane-fail 런에서만 설정되고 keyed 성공 런은 이 필드를
  // 쓰지 않는다. spread는 previous-only 키를 보존하므로, 키를 등록한 뒤 성공한 런에서도 과거
  // `api-key-not-configured`가 완성된 FRED 런 옆에 계속 게시되는 모순이 생겼다(data.json:599 vs meta).
  // keyed 런(`_source: 'fred'`)이면 이전 런의 실패 사유를 지운다 — no-key/plane-fail 런은
  // 자신의 `_failureReason`이 spread에서 current 쪽으로 이기므로 그대로 유지된다.
  if (current?._source === 'fred' && merged._failureReason) delete merged._failureReason;
  // A retained value keeps its original observation date, but it must not keep
  // the source/status of the failed current fetch. Otherwise downstream readers
  // can mistake an LKG carry-forward for a newly observed official value.
  for (const field of Object.keys(FRED_SERIES)) {
    const currentValue = Number(current?.[field]);
    const previousValue = Number(previous?.[field]);
    if (Number.isFinite(currentValue)) {
      // P1090: `_freshness_*` is published as the field's CURRENT freshness, but the
      // old code only ever set it — never cleared it. Once a field had been carried
      // forward in any earlier cycle it kept reading `stale-reference` forever, even
      // after every source recovered. All 19 macro fields were published as stale
      // while `_source_*` named a live official primary fetch, which made a real
      // last-known-good indistinguishable from a refreshed value.
      if (previous?.[`_freshness_${field}`]) merged[`_freshness_${field}`] = 'observed';
      continue;
    }
    if (!Number.isFinite(previousValue)) continue;
    const previousSource = previous?.[`_source_${field}`] || previous?._source || 'unknown';
    merged[`_originSource_${field}`] = previous?.[`_originSource_${field}`] || previousSource;
    merged[`_source_${field}`] = 'last-known-good';
    merged[`_freshness_${field}`] = 'stale-reference';
  }
  const failed = new Set([...(Array.isArray(previous._failedSeries) ? previous._failedSeries : []), ...(Array.isArray(current?._failedSeries) ? current._failedSeries : [])]);
  merged._failedSeries = [...failed];
  merged._lastKnownGoodAt = previous._lastKnownGoodAt || previous._asOf_hyOAS || null;
  return merged;
}

function _decodeOfficialHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function _signedPercent(direction, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return /^decreas/i.test(String(direction || '')) ? -parsed : parsed;
}

// P869: FRED publication lag must not leave a newly released PCE print blank or
// stale. BEA's release page is the primary source for the current headline/core
// PCE rates; observation period, release time and next release remain separate.
// BEA publishes the monthly change and the twelve-month change in separate
// paragraphs, and inside the monthly paragraph the goods/services/food/energy
// detail sits between the headline and core sentences. A bounded look-ahead
// window therefore crossed the paragraph boundary and captured the
// twelve-month figure: the published `corePceMoM` was 3.3, exactly the core
// YoY 3.3, beside a correct `pceMoM` of 0.2 (P1096). Slice each paragraph by
// its own lead-in and parse the headline/core pair inside that slice.
function _beaParagraph(text, startRe, endRe) {
  const source = String(text || '');
  const start = source.search(startRe);
  if (start < 0) return '';
  const rest = source.slice(start);
  const end = endRe ? rest.search(endRe) : -1;
  return end > 0 ? rest.slice(0, end) : rest;
}

// Headline and core are read from the SAME paragraph slice, independently. The
// twelve-month paragraph can never supply a monthly figure, and an absent
// monthly core clause stays null instead of borrowing a neighbouring period.
function _beaHeadline(section) {
  const match = section.match(/the PCE price index for [A-Za-z]+ (increased|decreased)\s+([0-9.]+)\s+percent/i);
  return match ? _signedPercent(match[1], match[2]) : null;
}

function _beaCore(section) {
  const match = section.match(/Excluding food and energy,\s+(?:the PCE price index\s+)?(increased|decreased)\s+([0-9.]+)\s+percent/i);
  return match ? _signedPercent(match[1], match[2]) : null;
}

export function parseBeaPceHtml(html, releaseUrl = null, fetchedAt = new Date().toISOString()) {
  const text = _decodeOfficialHtml(html);
  const title = text.match(/Personal Income and Outlays,\s+([A-Za-z]+)\s+(\d{4})/i);
  const yoySection = _beaParagraph(text, /same month one year ago/i, /next release/i);
  const momSection = _beaParagraph(text, /preceding month/i, /same month one year ago/i);
  const pce = _beaHeadline(yoySection);
  const corePce = _beaCore(yoySection);
  const pceMoM = _beaHeadline(momSection);
  const corePceMoM = _beaCore(momSection);
  const release = text.match(/RELEASE AT[\s\S]{0,100}?,\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  const next = text.match(/Next release:\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!title || !Number.isFinite(pce) || !Number.isFinite(corePce)) throw new Error('BEA_PCE_PARSE_REQUIRED_FIELDS_MISSING');
  const observationDate = new Date(`${title[1]} 1, ${title[2]} 00:00:00 UTC`);
  const releaseDate = release ? new Date(`${release[1]} 12:30:00 UTC`) : null;
  const nextReleaseDate = next ? new Date(`${next[1]} 12:30:00 UTC`) : null;
  if (Number.isNaN(observationDate.getTime())) {
    throw new Error('BEA_PCE_PARSE_INVALID_VALUES');
  }
  return {
    status: 'ok',
    source: 'U.S. Bureau of Economic Analysis',
    sourceKind: 'T1_OFFICIAL',
    allowedUse: 'macro-evidence-with-observation-release-and-fetch-time',
    releaseUrl,
    observationPeriod: `${title[1]} ${title[2]}`,
    observedAt: observationDate.toISOString().slice(0, 10),
    releasedAt: releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate.toISOString() : null,
    nextReleaseAt: nextReleaseDate && !Number.isNaN(nextReleaseDate.getTime()) ? nextReleaseDate.toISOString() : null,
    fetchedAt,
    lastSuccessfulAt: fetchedAt,
    values: { pce, corePce, pceMoM, corePceMoM },
  };
}

async function fetchBeaPce(previous = null) {
  const attemptedAt = new Date().toISOString();
  try {
    const indexUrl = 'https://www.bea.gov/news/current-releases';
    const indexHtml = await _fetchRss(indexUrl, 12000);
    const match = indexHtml.match(/href=["']([^"']*personal-income-and-outlays[^"']*)["']/i);
    if (!match) throw new Error('BEA_PCE_RELEASE_LINK_MISSING');
    const releaseUrl = new URL(match[1], indexUrl).toString();
    const releaseHtml = await _fetchRss(releaseUrl, 12000);
    return { ...parseBeaPceHtml(releaseHtml, releaseUrl, attemptedAt), attemptedAt };
  } catch (error) {
    console.warn(`[fetch-data] BEA PCE 실패: ${error && error.message || error}`);
    return {
      status: previous && previous.status === 'ok' ? 'last-known-good' : 'unavailable',
      source: 'U.S. Bureau of Economic Analysis',
    sourceKind: 'T1_OFFICIAL',
      allowedUse: 'reference-only',
      attemptedAt,
      fetchedAt: null,
      lastSuccessfulAt: previous && previous.lastSuccessfulAt || null,
      failureReason: String(error && error.message || error),
      ...(previous && typeof previous === 'object' ? previous : {}),
      attemptedAt,
    };
  }
}

// ── CNN Fear & Greed (봇차단 우회용 브라우저 유사 헤더) ──
async function fetchFearGreed(previous = null) {
  const attemptedAt = new Date().toISOString();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.cnn.com/markets/fear-and-greed',
    'Origin': 'https://www.cnn.com',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const j = await fetchJSON('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', { headers });
    const fg = j?.fear_and_greed;
    if (fg && typeof fg.score === 'number') {
      const normalizedHistory = (Array.isArray(j?.fear_and_greed_historical?.data) ? j.fear_and_greed_historical.data : [])
        .map((row) => {
          const timestamp = Number(row?.x);
          const score = Number(row?.y);
          if (!Number.isFinite(timestamp) || !Number.isFinite(score)) return null;
          return {
            observedAt: new Date(timestamp).toISOString(),
            score: round(score, 2),
            rating: row?.rating || null
          };
        })
        .filter(Boolean);
      // The response carries the daily series (midnight timestamps) plus an
      // intraday reading, so keying by full timestamp published two points for
      // one calendar day — a daily series a day-join cannot use (P1100).
      // Keep one point per day and prefer CNN's own daily marker.
      const byDay = new Map();
      for (const row of normalizedHistory) {
        const day = row.observedAt.slice(0, 10);
        const current = byDay.get(day);
        if (!current || row.observedAt.endsWith('T00:00:00.000Z')) byDay.set(day, row);
      }
      const history = [...byDay.values()]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .slice(-420);
      return {
        score: Math.round(fg.score),
        rating: fg.rating || null,
        _source: 'cnn',
        sourceUrl: 'https://www.cnn.com/markets/fear-and-greed',
        asOf: fg.timestamp || null,
        // CNN API의 previous_close = 전일 종가 시점 F&G 점수
        previousScore: typeof fg.previous_close === 'number' ? Math.round(fg.previous_close) : null,
        previousWeek: typeof fg.previous_1_week === 'number' ? Math.round(fg.previous_1_week) : null,
        history,
        attemptedAt,
        fetchedAt: attemptedAt,
        status: 'current-reference',
      };
    }
  } catch (e) {}
  if (previous && Number.isFinite(Number(previous.score))) {
    return {
      ...previous,
      _source: previous._source || 'cnn:last-known-good',
      status: 'stale-reference',
      attemptedAt,
      fetchedAt: null,
      failureReason: 'cnn-fear-greed-unavailable'
    };
  }
  return { _source: 'cnn:fail', status: 'unavailable', attemptedAt, fetchedAt: null };
}

function blsObservationDate(year, period) {
  const month = Number(String(period || '').slice(1));
  return /^\d{4}$/.test(String(year || '')) && month >= 1 && month <= 12
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : null;
}

function blsMonthlyRows(series) {
  return (series && Array.isArray(series.data) ? series.data : [])
    .filter(row => /^M(?:0[1-9]|1[0-2])$/.test(String(row.period || '')))
    .map(row => ({
      year: String(row.year),
      period: String(row.period),
      date: blsObservationDate(row.year, row.period),
      value: Number(row.value),
      footnotes: Array.isArray(row.footnotes) ? row.footnotes.filter(Boolean) : []
    }))
    .filter(row => row.date && Number.isFinite(row.value))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function blsPriorMonth(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function blsPriorYear(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function normalizeBlsSeriesResponse(payload, fetchedAt = new Date().toISOString()) {
  const responseRows = new Map((payload && payload.Results && Array.isArray(payload.Results.series) ? payload.Results.series : [])
    .map(series => [series.seriesID, series]));
  const series = {};
  const values = {};
  const failures = [];

  Object.entries(BLS_SERIES).forEach(([metricId, config]) => {
    const raw = responseRows.get(config.id);
    const rows = blsMonthlyRows(raw);
    const latest = rows[0] || null;
    const evidence = {
      metricId,
      seriesId: config.id,
      unit: config.unit,
      frequency: config.frequency,
      seasonalAdjustment: config.seasonalAdjustment,
      displayRole: config.displayRole || null,
      definition: config.definition || null,
      source: 'BLS Public Data API v1',
    sourceKind: 'T1_OFFICIAL',
      sourceUrl: 'https://www.bls.gov/developers/',
      fetchedAt,
      releaseAt: null,
      observedAt: latest && latest.date,
      observationPeriod: latest ? `${latest.year}-${latest.period}` : null,
      rawValue: latest ? latest.value : null,
      observationStatus: latest && latest.footnotes.length ? 'footnote-present' : 'final',
      footnotes: latest ? latest.footnotes : [],
      allowedUse: 'macro-evidence-with-observation-date',
      decisionUse: false,
      status: 'unavailable',
      value: null,
      inputObservationPeriods: []
    };

    if (!latest) {
      failures.push({ metricId, seriesId: config.id, reason: 'empty_or_invalid_monthly_data' });
      series[metricId] = evidence;
      return;
    }

    let derived = latest.value;
    let inputs = [latest];
    if (config.derive === 'yoy') {
      const prior = rows.find(row => row.date === blsPriorYear(latest.date));
      if (!prior || prior.value === 0) {
        evidence.status = 'insufficient_history';
        failures.push({ metricId, seriesId: config.id, reason: 'insufficient_history_for_yoy' });
        series[metricId] = evidence;
        return;
      }
      derived = round((latest.value / prior.value - 1) * 100, 1);
      inputs = [latest, prior];
    } else if (config.derive === 'mom_diff') {
      const prior = rows.find(row => row.date === blsPriorMonth(latest.date));
      if (!prior) {
        evidence.status = 'insufficient_history';
        failures.push({ metricId, seriesId: config.id, reason: 'insufficient_history_for_mom_diff' });
        series[metricId] = evidence;
        return;
      }
      derived = round(latest.value - prior.value, 0);
      inputs = [latest, prior];
    }

    evidence.value = derived;
    evidence.status = 'ok';
    evidence.inputObservationPeriods = inputs.map(row => `${row.year}-${row.period}`);
    values[config.field] = derived;
    series[metricId] = evidence;
  });

  const successful = Object.values(series).filter(row => row.status === 'ok').length;
  return {
    schemaVersion: 'bls-evidence.v1',
    source: 'BLS Public Data API v1',
    sourceKind: 'T1_OFFICIAL',
    sourceUrl: BLS_ENDPOINT,
    fetchedAt,
    lastSuccessfulAt: successful ? fetchedAt : null,
    attemptedAt: fetchedAt,
    releaseAt: null,
    status: successful === Object.keys(BLS_SERIES).length ? 'ok' : successful ? 'partial' : 'unavailable',
    series,
    values,
    failures,
    allowedUse: 'macro-evidence-with-observation-date',
    decisionUse: false
  };
}

export async function fetchBlsSeries(previous = null) {
  const now = new Date();
  const nowIso = now.toISOString();
  const previousFetchedAt = previous && previous.fetchedAt ? new Date(previous.fetchedAt).getTime() : NaN;
  if (previous && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= BLS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }

  try {
    const year = now.getUTCFullYear();
    const response = await fetchJSON(BLS_ENDPOINT, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: Object.values(BLS_SERIES).map(config => config.id),
        startyear: String(year - 2),
        endyear: String(year)
      })
    });
    if (!response || response.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS status ${response && response.message || response && response.status || 'unknown'}`);
    const normalized = normalizeBlsSeriesResponse(response, nowIso);
    if (Object.keys(normalized.values).length) return normalized;
    throw new Error('BLS response contained no usable monthly series');
  } catch (error) {
    const failureReason = String(error && error.message || error);
    if (previous && previous.series) {
      return {
        ...previous,
        status: 'stale',
        attemptedAt: nowIso,
        failureReason,
        cacheHit: false
      };
    }
    return {
      schemaVersion: 'bls-evidence.v1',
      source: 'BLS Public Data API v1',
    sourceKind: 'T1_OFFICIAL',
      sourceUrl: BLS_ENDPOINT,
      fetchedAt: null,
      lastSuccessfulAt: null,
      attemptedAt: nowIso,
      releaseAt: null,
      status: 'unavailable',
      series: {},
      values: {},
      failures: [{ metricId: 'batch', seriesId: Object.values(BLS_SERIES).map(config => config.id).join(','), reason: failureReason }],
      failureReason,
      allowedUse: 'none',
      decisionUse: false
    };
  }
}

// ── Cboe official daily Put/Call statistics ──
// The legacy CDN JSON currently returns AccessDenied to server/browser callers.
// Cboe's official daily statistics page embeds the same ratios and selected
// trading date in its server-rendered payload, so Actions can ingest it without
// a public CORS proxy. This is delayed daily volume, never labelled real-time.
export function parseCboePutCallHtml(html) {
  const normalized = String(html || '').replace(/\\"/g, '"');
  const pick = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp('"name"\\s*:\\s*"' + escaped + '"\\s*,\\s*"value"\\s*:\\s*"([0-9.]+)"', 'i'));
    const value = match ? Number(match[1]) : null;
    return Number.isFinite(value) ? value : null;
  };
  const selectedDate = (normalized.match(/"selectedDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const totalPutCall = pick('TOTAL PUT/CALL RATIO');
  if (!Number.isFinite(totalPutCall) || !selectedDate) return null;
  return {
    totalPutCall,
    indexPutCall: pick('INDEX PUT/CALL RATIO'),
    equityPutCall: pick('EQUITY PUT/CALL RATIO'),
    asOf: selectedDate,
    fetchedAt: new Date().toISOString(),
    source: 'Cboe Daily Market Statistics',
    sourceUrl: 'https://www.cboe.com/data/mktstat.aspx',
    sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'decision-with-daily-delay'
  };
}

async function fetchCboePutCall() {
  const attemptedAt = new Date().toISOString();
  try {
    const html = await _fetchRss('https://www.cboe.com/data/mktstat.aspx', 18000);
    const parsed = parseCboePutCallHtml(html);
    if (!parsed) throw new Error('official page did not contain ratio/date contract');
    return { ...parsed, attemptedAt, status: 'current-reference' };
  } catch (error) {
    console.warn('[fetch-data] Cboe Put/Call 수집 실패:', error && error.message || error);
    return { source: 'Cboe Daily Market Statistics', sourceKind: 'unavailable', allowedUse: 'none', fetchedAt: null, attemptedAt, status: 'unavailable', totalPutCall: null, error: String(error && error.message || error) };
  }
}

// ── WO-6 (ops): 서버측 뉴스 백스톱 (브라우저 CORS 프록시 전멸 대비) ──
// 왜: 클라이언트 뉴스는 제3자 프록시(allorigins 등, 자주 죽음)에 의존. 서버(Actions)는 CORS가
//     없으므로 안정적으로 RSS를 받아 data.json.news로 떨군다. 클라이언트는 자체 뉴스가 비었을
//     때만 이걸 폴백으로 렌더(작동 중이면 손대지 않음 — additive). Google News RSS는 서버 fetch에
//     안정적이고 <source> 태그로 실제 매체명을 준다.
function _googleNewsSearchUrl(query, hl = 'en-US', gl = 'US', ceid = 'US:en') {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=' + hl + '&gl=' + gl + '&ceid=' + ceid;
}

const NEWS_CYCLE_POLICY = 'kst-0800-completed-24h';
const NEWS_CYCLE_CUTOFF_HOUR_KST = 8;
const KST_OFFSET_MS = 9 * 3600000;
const DAY_MS = 24 * 3600000;
const MINIMUM_CURRENT_NEWS = 10;

export function deriveCyclePublication({
  marketSnapshotPublished = false,
  quoteCount = 0,
  requiredQuoteCount = 0,
  newsCount = 0,
  minimumNewsCount = MINIMUM_CURRENT_NEWS,
  historyUpdated = false
} = {}) {
  const blockers = [];
  if (marketSnapshotPublished !== true) blockers.push('market-snapshot-not-published');
  if (!(Number(requiredQuoteCount) > 0 && Number(quoteCount) >= Number(requiredQuoteCount))) blockers.push('quote-coverage-incomplete');
  if (!(Number(newsCount) >= Number(minimumNewsCount))) blockers.push('current-news-below-minimum');
  if (historyUpdated !== true) blockers.push('history-update-incomplete');
  return Object.freeze({
    complete: blockers.length === 0,
    status: blockers.length === 0 ? 'PUBLISHED' : 'DEGRADED',
    blockers: Object.freeze(blockers),
    components: Object.freeze({
      marketSnapshotPublished: marketSnapshotPublished === true,
      quoteCount: Number(quoteCount) || 0,
      requiredQuoteCount: Number(requiredQuoteCount) || 0,
      newsCount: Number(newsCount) || 0,
      minimumNewsCount: Number(minimumNewsCount) || MINIMUM_CURRENT_NEWS,
      historyUpdated: historyUpdated === true
    })
  });
}

function _fmtKstCycleDate(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getKst0800NewsCycle(nowMs = Date.now()) {
  const kstNow = new Date(nowMs + KST_OFFSET_MS);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  let endMs = Date.UTC(y, m, d, NEWS_CYCLE_CUTOFF_HOUR_KST, 0, 0, 0) - KST_OFFSET_MS;
  if (nowMs < endMs) endMs -= DAY_MS;
  const startMs = endMs - DAY_MS;
  return {
    policy: NEWS_CYCLE_POLICY,
    cutoffHourKst: NEWS_CYCLE_CUTOFF_HOUR_KST,
    startMs,
    endMs,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    label: `${_fmtKstCycleDate(startMs)} 08:00 KST ~ ${_fmtKstCycleDate(endMs)} 08:00 KST`,
    nextRefresh: new Date(endMs + DAY_MS).toISOString(),
  };
}

const NEWS_FEEDS = [
  { query: 'Reuters Bloomberg CNBC market moving stocks S&P 500 Nasdaq Federal Reserve Treasury yields oil when:2d', source: 'Google News - Market movers', topic: 'macro', country: 'us', tier: 1 },
  { query: 'stock market OR S&P 500 OR Nasdaq OR Federal Reserve OR Treasury yield OR inflation when:2d', source: 'Google News - US markets', topic: 'macro', country: 'us', tier: 2 },
  { query: 'Nvidia OR Micron OR semiconductor OR AI stocks OR data center OR earnings guidance when:2d', source: 'Google News - AI/Semis', topic: 'semi', country: 'us', tier: 2 },
  { query: 'Iran OR Hormuz OR Red Sea OR oil prices OR geopolitics OR sanctions when:2d', source: 'Google News - Geopolitics/Energy', topic: 'geo', country: 'global', tier: 1 },
  { query: 'dollar OR yen OR Treasury yields OR bond market OR credit spreads OR gold when:2d', source: 'Google News - FX/Bonds', topic: 'fxbond', country: 'global', tier: 1 },
  { query: 'LQD OR HYG OR corporate bonds OR credit spreads OR investment grade OAS OR rating downgrade OR AI capex funding OR data center financing when:2d', source: 'Google News - Credit/Funding', topic: 'credit', country: 'global', tier: 1 },
  { query: 'upgrade OR downgrade OR price target OR analyst rating OR earnings guidance stock when:2d', source: 'Google News - Analyst/Earnings', topic: 'analyst', country: 'us', tier: 2 },
  { query: 'KOSPI Samsung Electronics SK Hynix AI semiconductor selloff rebound Micron foreign investors when:2d', source: 'Google News - Korea markets', topic: 'korea', country: 'kr', tier: 2 },
].map(feed => ({ ...feed, url: _googleNewsSearchUrl(feed.query, feed.country === 'kr' ? 'ko' : 'en-US', feed.country === 'kr' ? 'KR' : 'US', feed.country === 'kr' ? 'KR:ko' : 'US:en') }));

const SERVER_NEWS_PRIORITY_RULES = [
  { label: 'macro-rates', points: 14, re: /\b(fed|fomc|powell|rate cut|rate hike|inflation|cpi|ppi|pce|payroll|jobs report|recession|soft landing|treasury yield|bond yield)\b/i },
  { label: 'geopolitics-energy', points: 14, re: /\b(iran|hormuz|red sea|israel|lebanon|ukraine|sanction|tariff|export control|oil prices?|wti|brent|lng|opec)\b/i },
  { label: 'ai-semis', points: 13, re: /\b(nvidia|nvda|semiconductor|chip|hbm|dram|sk hynix|samsung electronics|tsmc|asml|blackwell|rubin|data center|ai infrastructure)\b/i },
  { label: 'credit-funding', points: 12, re: /\b(lqd|hyg|oas|credit spreads?|corporate bonds?|investment grade|high yield|rating downgrade|debt financing|funding costs?|capex funding|project finance|data center financing)\b/i },
  { label: 'earnings-guidance', points: 10, re: /\b(earnings|revenue|eps|guidance|outlook|margin|buyback|dividend|preannounces?)\b/i },
  { label: 'analyst-action', points: 8, re: /\b(upgrade|downgrade|price target|rating|initiates|overweight|underweight|buy rating|sell rating)\b/i },
  { label: 'fx-bonds-commodities', points: 8, re: /\b(dollar|yen|euro|yuan|won|dxy|forex|gold|copper|credit spread|yield curve)\b/i },
  { label: 'mega-cap', points: 8, re: /\b(aapl|apple|msft|microsoft|nvda|nvidia|amzn|amazon|meta|tesla|tsla|googl|google|avgo|broadcom|amd|oracle|orcl|jpm|exxon|xom)\b/i },
];

const SERVER_NEWS_CLICKBAIT_RE = /\b(next nvidia|next tesla|must buy|guaranteed return|millionaire|hidden gem|penny stock|to the moon|won't believe|don't miss|best stocks? to buy now)\b/i;
const SERVER_NEWS_UNVERIFIED_RE = /\b(people familiar|sources say|according to sources|unconfirmed|rumor|reportedly|may be considering|is said to)\b/i;
const SERVER_NEWS_TIER1_SOURCE_RE = /\b(Reuters|Bloomberg|Associated Press|AP News|Financial Times|Wall Street Journal|WSJ|CNBC)\b/i;
const SERVER_NEWS_TIER2_SOURCE_RE = /\b(MarketWatch|Barron's|Nikkei|Yonhap|Naver|Korea JoongAng|The Korea Herald|The Hill|Yahoo Finance)\b/i;
const SERVER_NEWS_LOW_QUALITY_SOURCE_RE = /\b(Ad-hoc-news|MSN|GuruFocus|IndexBox|Pluang|Bitget|Stocktwits|TradingPedia|The Vibes|WBFF|Benzinga|Zacks)\b/i;

function getServerNewsSourceTier(source, feedTier) {
  const src = String(source || '');
  if (SERVER_NEWS_TIER1_SOURCE_RE.test(src)) return 1;
  if (SERVER_NEWS_TIER2_SOURCE_RE.test(src)) return 2;
  if (SERVER_NEWS_LOW_QUALITY_SOURCE_RE.test(src)) return 4;
  if (!src && feedTier) return Math.max(2, feedTier);
  return 3;
}

function scoreServerNewsItem(item) {
  const text = `${item.title || ''} ${item.source || ''} ${item.topic || ''}`;
  if (SERVER_NEWS_CLICKBAIT_RE.test(text)) return { score: 0, selectionReason: 'clickbait-filter' };

  let score = 20;
  const reasons = ['base+20'];
  const sourceTier = getServerNewsSourceTier(item.source, item.feedTier || item.tier);
  item.tier = sourceTier;
  const tierBonus = sourceTier === 1 ? 16 : sourceTier === 2 ? 9 : sourceTier === 3 ? 2 : -8;
  score += tierBonus;
  reasons.push(`source-tier${sourceTier}${tierBonus >= 0 ? '+' : ''}${tierBonus}`);

  const ageH = item.ts ? ((item.scoringNowMs || Date.now()) - item.ts) / 3600000 : 48;
  const recency = ageH <= 1 ? 18 : ageH <= 6 ? 12 : ageH <= 24 ? 6 : ageH <= 48 ? 2 : -8;
  score += recency;
  reasons.push(`recency${recency >= 0 ? '+' : ''}${recency}`);

  for (const rule of SERVER_NEWS_PRIORITY_RULES) {
    if (rule.re.test(text)) {
      score += rule.points;
      reasons.push(`${rule.label}+${rule.points}`);
    }
  }

  if (SERVER_NEWS_UNVERIFIED_RE.test(text)) {
    score -= 8;
    reasons.push('unverified-8');
  }
  if (/\b(opinion|sponsored|partner content|advertisement)\b/i.test(text)) {
    score -= 18;
    reasons.push('promo-opinion-18');
  }
  if (sourceTier >= 4) {
    score -= 8;
    reasons.push('low-quality-source-8');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, selectionReason: reasons.slice(0, 7).join(' | ') };
}

async function fetchCoinGeckoCrossCheck() {
  const attemptedAt = new Date().toISOString();
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true';
    const payload = await fetchJSON(url, { headers: { accept: 'application/json' } }, 2);
    const normalize = (id, symbol) => {
      const row = payload?.[id] || {};
      const price = Number(row.usd);
      const epoch = Number(row.last_updated_at);
      return {
        symbol,
        price: Number.isFinite(price) && price > 0 ? price : null,
        observedAt: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : null
      };
    };
    const quotes = [normalize('bitcoin', 'BTC-USD'), normalize('ethereum', 'ETH-USD')];
    const ok = quotes.every((row) => row.price != null && row.observedAt);
    return { status: ok ? 'ok' : 'partial', attemptedAt, fetchedAt: new Date().toISOString(), source: 'CoinGecko Simple Price API', sourceKind: 'independent-secondary', sourceUrl: url, quotes };
  } catch (error) {
    return { status: 'unavailable', attemptedAt, fetchedAt: null, source: 'CoinGecko Simple Price API', sourceKind: 'independent-secondary', sourceUrl: 'https://api.coingecko.com/api/v3/simple/price', quotes: [], reason: String(error?.message || error) };
  }
}
function serverNewsSourceTierLabel(tier) {
  return ({ 1: 'official-or-wire', 2: 'reputable-secondary', 3: 'aggregator-or-trade', 4: 'low-quality' })[Number(tier)] || 'unknown';
}
function _decodeNewsEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// RSS <item> 파서 — fetchNews/fetchTickerNewsItems 공용. needLink=true 시 link 없는 항목 제외.
function _parseRssXml(xml, opts) {
  const limit = (opts && opts.limit) || 20;
  const titleLen = (opts && opts.titleLen) || 200;
  const needLink = !!(opts && opts.needLink);
  const items = [];
  for (const b of xml.split(/<item>/i).slice(1, limit + 1)) {
    const title = _decodeNewsEntities((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const link  = _decodeNewsEntities((b.match(/<link>([\s\S]*?)<\/link>/i)  || [])[1]);
    const pub   = _decodeNewsEntities((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const src   = _decodeNewsEntities((b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
    if (!title || (needLink && !link)) continue;
    const ts = pub ? new Date(pub).getTime() : 0;
    items.push({ title: title.slice(0, titleLen), link: link || null, source: src || '', pubDate: pub || null, ts: isFinite(ts) ? ts : 0 });
  }
  return items;
}

async function fetchNews() {
  const cycle = getKst0800NewsCycle();
  const items = [];    // US/글로벌 피드
  const krItems = [];  // 한국 전용 (reserved slot)
  for (const feed of NEWS_FEEDS) {
    const isKr = feed.country === 'kr';
    try {
      const feedUrls = [feed.url, feed.url.replace(/when%3A2d/i, 'when%3A7d')];
      let parsed = [];
      for (const feedUrl of feedUrls) {
        const candidate = _parseRssXml(await _fetchRssWithRetry(feedUrl, 12000), { limit: 20, titleLen: 200, needLink: true });
        parsed = candidate;
        const hasCurrent = candidate.some(p => {
          const ts = p.ts;
          return isFinite(ts) && ts >= cycle.startMs && ts < cycle.endMs;
        });
        if (hasCurrent || feedUrl === feedUrls[feedUrls.length - 1]) break;
      }
      for (const p of parsed) {
        const t = p.ts;
        if (!isFinite(t) || t < cycle.startMs || t >= cycle.endMs) continue;
        const item = {
          title: p.title, link: p.link, source: p.source || feed.source,
          pubDate: p.pubDate, ts: isFinite(t) ? t : 0,
          topic: isKr ? 'kr' : feed.topic,  // 'korea' → 'kr' 정규화
          country: feed.country,
          tier: getServerNewsSourceTier(p.source || feed.source, feed.tier),
          feedTier: feed.tier,
          feedSource: feed.source,
          scoringNowMs: cycle.endMs,
          newsCyclePolicy: cycle.policy,
          newsCycleStart: cycle.start,
          newsCycleEnd: cycle.end,
          newsCycleLabel: cycle.label,
        };
        Object.assign(item, scoreServerNewsItem(item));
        if (isKr) { krItems.push(item); } else { items.push(item); }
      }
    } catch (e) { /* 피드별 실패 무시 */ }
  }
  // US/글로벌: 점수순 정렬, 한국: 최신순 정렬
  items.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  krItems.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  const seen = new Set();
  const out = [];
  function pushItem(it) {
    out.push({
      title: it.title, link: it.link, source: it.source,
      pubDate: it.pubDate, topic: it.topic, country: it.country,
      tier: it.tier, score: it.score, selectionReason: it.selectionReason,
      feedSource: it.feedSource,
      sourceTierLabel: serverNewsSourceTierLabel(it.tier),
      contentDepth: 'headline-only',
      eventTime: isFinite(it.ts) && it.ts > 0 ? new Date(it.ts).toISOString() : null,
      eventTimeKind: 'published',
      independenceKey: String(it.source || it.feedSource || '').trim().toLowerCase() || null,
      newsCyclePolicy: it.newsCyclePolicy,
      newsCycleStart: it.newsCycleStart,
      newsCycleEnd: it.newsCycleEnd,
      newsCycleLabel: it.newsCycleLabel,
    });
  }
  // 한국 뉴스 최대 3슬롯 먼저 예약
  const KR_SLOTS = 3;
  for (const it of krItems) {
    if (out.length >= KR_SLOTS) break;
    const k = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    pushItem(it);
  }
  // 나머지 슬롯(최대 37개)을 US/글로벌 뉴스로 채움
  for (const it of items) {
    if (out.length >= 40) break;
    const k = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    pushItem(it);
  }
  return out;
}

// ── v51.15: 개별 종목 뉴스 enrichment — Google News RSS per-ticker → screener.json newsMemo ──
// _fetchRss + _parseRssXml 공용 헬퍼 기반으로 중복 없이 구현.
async function fetchTickerNewsItems(sym, days) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock when:' + (days || 3) + 'd') + '&hl=en-US&gl=US&ceid=US:en';
  try { return _parseRssXml(await _fetchRss(url, 8000), { limit: 5, titleLen: 130 }); }
  catch (e) { return []; }
}

// 뉴스 아이템 배열 → 스크리너 메모 문자열 (최신 2건, "[MM-DD] 제목 (출처)" 형식)
function _fmtTickerNewsMemo(items) {
  if (!items || !items.length) return null;
  const top = items.filter(i => i.title).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
  if (!top.length) return null;
  return top.map(it => {
    const d = it.ts ? new Date(it.ts).toISOString().slice(5, 10) : '';
    const src = it.source ? ' (' + it.source + ')' : '';
    return '[' + d + '] ' + it.title + src;
  }).join(' · ');
}

function _tickerNewsTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const timestamp = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      const numeric = Number(text);
      const timestamp = numeric < 1e12 ? numeric * 1000 : numeric;
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  return null;
}

// Keep publication/observation time separate from collection time. The RSS parser normally
// supplies `ts` derived from pubDate, but accepting either field keeps this boundary fail-closed
// when an upstream parser omits one representation or returns an invalid date.
export function deriveTickerNewsLineage(items, fetchedAt = new Date().toISOString()) {
  const timestamps = (Array.isArray(items) ? items : []).flatMap((item) => [
    _tickerNewsTimestampMs(item?.ts),
    _tickerNewsTimestampMs(item?.pubDate)
  ]).filter((timestamp) => timestamp != null);
  const latest = timestamps.length ? Math.max(...timestamps) : null;
  const newsObservedAt = latest == null ? null : new Date(latest).toISOString();
  const fetchedTimestamp = _tickerNewsTimestampMs(fetchedAt);
  const newsFetchedAt = fetchedTimestamp == null ? null : new Date(fetchedTimestamp).toISOString();
  return { newsObservedAt, newsTs: newsObservedAt, newsFetchedAt };
}

const round = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
function monthsBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

// ── v50.52 B4: Yahoo v8/chart 다일 종가 히스토리 (백필용) ──
// 왜: fetchQuote는 range=5d + meta(현재가)만 읽어 history가 하루 1건씩만 쌓임(20~60일 대기).
//     range=6mo로 일별 종가 배열을 1회 받아 history.json을 즉시 시드 → 차트 대기 제거.
async function fetchHistory(symbol, range = '6mo') {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range;
      const j = await fetchJSON(url, {}, 2);
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp;
      const q0 = res?.indicators?.quote?.[0];
      const closes = q0?.close;
      const fetchedAt = new Date().toISOString();
      // v51.91 P587/R265/C6: Yahoo's chart endpoint already returns a parallel
      // indicators.adjclose[0].adjclose series (split+dividend adjusted, no extra query param
      // needed — verified by direct fetch, not assumed) alongside the raw OHLCV. Expose it as
      // `adjClose` per row; callers that compute returns/momentum on dividend-paying equities
      // should prefer it (see _enrichPriceFactors below) since raw close systematically understates
      // total return for high-yield names — measured divergence on KO: +14.6% (raw) vs +17.9%
      // (adjusted) over 1y, a 3.3pp gap from dividends alone. `high`/`low`/`volume` and this
      // function's other consumer (backfillHistory, index-level symbols only) stay on raw values.
      const adjArr = res?.indicators?.adjclose?.[0]?.adjclose;
      if (!Array.isArray(ts) || !Array.isArray(closes)) throw new Error('no history arrays');
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number' || !isFinite(c)) continue;
        const h = q0.high?.[i], l = q0.low?.[i], v = q0.volume?.[i];
        const a = Array.isArray(adjArr) ? adjArr[i] : undefined;
        out.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          observedAt: new Date(ts[i] * 1000).toISOString(),
           close: round(c, 2),
          // Missing adjusted-close evidence stays missing. A raw-close fallback
          // would silently turn a total-return backtest into a price-only test.
          adjClose: (typeof a === 'number' && isFinite(a) && a > 0) ? round(a, 2) : null,
           // Missing OHLC bars are unknown.  Falling back to close creates a
           // fabricated zero-range bar and can make ADR/VCP look complete.
           high:   typeof h === 'number' && isFinite(h) ? round(h, 2)    : null,
           low:    typeof l === 'number' && isFinite(l) ? round(l, 2)    : null,
           // Missing volume is unknown, not zero.  Zero is a real observation
           // for some instruments and would otherwise corrupt VCP/liquidity
           // factors while making a partial provider response look complete.
           volume: typeof v === 'number' && isFinite(v) ? Math.round(v)  : null,
           fetchedAt,
         });
      }
      return out;
    } catch (e) { /* 호스트 폴백 */ }
  }
  return [];
}

// history.json 레코드 필드 ↔ Yahoo 심볼 매핑 (백필 대상). F&G/IV는 과거 무료 소스 없어 제외(해당 일자 null).
const HIST_SYMBOLS = {
  '^GSPC': 'spx', '^IXIC': 'nasdaq', '^DJI': 'dow', '^RUT': 'rut',
  '^VIX': 'vix', '^VIX3M': 'vix3m', '^VVIX': 'vvix', '^TNX': 'tnx',
  'DX-Y.NYB': 'dxy', 'CL=F': 'wti', 'GC=F': 'gold',
  '^KS11': 'kospi', '^KQ11': 'kosdaq', 'BTC-USD': 'btc',
  // P1246 (E3/E4 FX 축): USD/KRW도 같은 producer 경로(Yahoo chart 일별 종가, worker 프록시가
  // CORS를 처리)로 일별 히스토리를 갖는다. 새 출처·새 키·새 약관이 없고, 백테스트 랩의 통화 축이
  // 요구하던 "과거 FX 시계열 공급원"이 이 열이다. 교차검증은 FRED DEXKOUS(공식 bilateral)가 한다.
  'KRW=X': 'usdkrw',
};
const HIST_FIELDS = ['spx','nasdaq','dow','rut','vix','vix3m','vvix','tnx','dxy','wti','gold','kospi','kosdaq','btc','usdkrw','fg'];
// P1246 (data-refresh: 품질 경계): 히스토리 시장 필드의 **단일** 타당 범위 선언. producer가 이 범위를
// 벗어난 값을 관측으로 승격하지 않고(null + fieldMeta 없음 = P1101의 무관측 표기), 게이트가 같은 선언을
// 가져와 아티팩트를 검사한다 — 선언과 집행이 서로 다른 리터럴을 들고 어긋나는 경로를 만들지 않는다.
export const HIST_FIELD_PLAUSIBILITY = Object.freeze({
  spx: [500, 50000], nasdaq: [500, 100000], dow: [2000, 150000], rut: [100, 10000],
  vix: [5, 200], vvix: [20, 400], tnx: [0, 20], dxy: [50, 200], wti: [1, 400],
  gold: [100, 20000], kospi: [300, 20000], kosdaq: [100, 5000], btc: [1000, 2000000],
  // 원/달러는 1997년 외환위기 이후 800~2000원대를 벗어난 적이 없다. 공급자 오류(예: 지수/배율
  // 혼동)로 한 자리·두 자리 수가 들어오면 그대로 히스토리에 남아 백테스트 환산을 오염시킨다.
  usdkrw: [800, 2000],
});
export function histValueWithinPlausibility(field, value) {
  const range = HIST_FIELD_PLAUSIBILITY[field];
  if (!range) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1];
}
const HIST_MARKET_FIELDS = HIST_FIELDS.filter(field => field !== 'fg');
// Breadth columns are produced by the screener lane, so a row written by the
// 30-minute market lane used to omit them entirely while the screener lane
// deleted the key when a window had too few eligible symbols. Rows then had
// different key sets and a one-row breadth lag was indistinguishable from
// "unavailable" (P1101). Both lanes now publish every column; absence is null.
const HIST_BREADTH_FIELDS = ['breadth20','breadth50','breadth200','advanceRatio','advanceDecline'];
const HIST_ALL_FIELDS = [...HIST_FIELDS, ...HIST_BREADTH_FIELDS];
// Per-row cycle metadata. Rows seeded by the historical backfill never carried
// it, so the column set differed by row; null records "not recorded" instead.
const HIST_ROW_META = ['seriesMode','cycleEnd','marketSnapshotRevision'];

// "No observation" is null with no fieldMeta entry; a fieldMeta entry always
// describes a finite value. Normalizing every row also normalizes rows written
// by earlier producer revisions, so no separate migration is needed.
export function normalizeHistoryRows(hist) {
  for (const row of hist) {
    if (!row || typeof row !== 'object') continue;
    if (!row.fieldMeta || typeof row.fieldMeta !== 'object') row.fieldMeta = {};
    for (const key of HIST_ROW_META) if (row[key] === undefined) row[key] = null;
    for (const field of HIST_ALL_FIELDS) {
      if (row[field] === undefined) row[field] = null;
      if (row[field] === null || !Number.isFinite(Number(row[field]))) delete row.fieldMeta[field];
    }
  }
  return hist;
}

// v53.14/AR-07 Batch 0: history.json은 행의 공통 date만으로 관측시각을 대표하지 않는다.
// 각 수치에 source/observedAt/fetchedAt/allowedUse를 보존해 미국·한국·24/7 자산의
// 거래일·수집일을 섞지 않는다. 기존 숫자 필드는 하위 호환으로 유지한다.
async function backfillHistory(hist) {
  const byDate = {};
  const syms = Object.keys(HIST_SYMBOLS);
  const results = await mapLimit(syms, 4, async (sym) => ({ sym, rows: await fetchHistory(sym, '1y') }));
  for (const r of results) {
    if (!r || r.__error || !Array.isArray(r.rows)) continue;
    const field = HIST_SYMBOLS[r.sym];
    for (const row of r.rows) {
      // P1246: 품질 경계는 백필 레인에도 똑같이 적용된다. 선언된 타당 범위를 벗어난 공급자 값은
      // 관측으로 승격하지 않는다 — 그 날짜의 행 자체를 만들지 않는다(값도 fieldMeta도 없음).
      if (!histValueWithinPlausibility(field, row.close)) continue;
      if (!byDate[row.date]) byDate[row.date] = { date: row.date };
      byDate[row.date][field] = row.close;
      byDate[row.date].fieldMeta = byDate[row.date].fieldMeta || {};
      byDate[row.date].fieldMeta[field] = {
        observedAt: row.observedAt || null,
        fetchedAt: row.fetchedAt || null,
        lastSuccessfulAt: row.fetchedAt || null,
        source: 'Yahoo chart',
        sourceKind: 'T3_PUBLIC_DELAYED',
        allowedUse: 'research-history',
        // P1117: every history fieldMeta must declare how the timestamp was obtained.
        // This backfill lane published neither marker, so a row it wrote last would fail
        // the artifact gate that requires an observation relation on every market field.
        observationRelation: 'latest-completed-close',
        observedAtSource: row.observedAt ? 'provider-current' : 'unavailable',
      };
    }
  }
  let added = 0;
  for (const date of Object.keys(byDate)) {
    const existing = hist.find(h => h && h.date === date);
    if (existing) {
      for (const f of HIST_FIELDS) {
        if (byDate[date][f] != null) existing[f] = byDate[date][f];
      }
      existing.fieldMeta = { ...(existing.fieldMeta || {}), ...(byDate[date].fieldMeta || {}) };
      continue;
    }
    const base = { date, fieldMeta: byDate[date].fieldMeta || {} };
    for (const f of HIST_FIELDS) base[f] = (byDate[date][f] != null ? byDate[date][f] : null);
    hist.push(base);
    added++;
  }
  hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { hist, added };
}

// Weekend/holiday rows can legitimately repeat the previous observed close.
// Carry the earlier evidence forward explicitly instead of pretending that the
// market observed a new value on the calendar bucket date.
function carryForwardHistoryEvidence(hist) {
  const rows = [...hist].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.fieldMeta = row.fieldMeta || {};
    for (const field of HIST_MARKET_FIELDS) {
      if (typeof row[field] !== 'number' || row.fieldMeta[field]?.observedAt) continue;
      for (let j = i - 1; j >= 0; j--) {
        const prior = rows[j];
        const priorMeta = prior?.fieldMeta?.[field];
        if (typeof prior?.[field] !== 'number' || !priorMeta?.observedAt) continue;
        // The old common-date record may contain an unverified weekend value.
        // Replace it with the last observed close before carrying the evidence;
        // the relation is explicit and downgraded to reference-only.
        row[field] = prior[field];
        row.fieldMeta[field] = {
          ...priorMeta,
          allowedUse: 'reference-only',
          observationRelation: 'carried-forward',
          carriedFrom: prior.date,
        };
        break;
      }
    }
  }
  return hist;
}

// ── WO-7 (ops): 일별 히스토리 축적 (public-data/history.json) ──
// 왜: data.json은 매 실행 덮어쓰기라 과거가 안 남는다. 52주 VIX(IV Rank)·breadth 사이클·F&G 추이
//     차트가 하드코딩 시드 배열에 의존하는 근본 원인. 하루 1건(같은 날은 최신값으로 upsert =
//     마지막 실행이 종가에 가까움)씩 핵심 지표를 append → 시간이 지나면 사이트가 자체 실데이터 사용.
// 핵심 심볼(SPX/VIX) 없으면 스킵(널 레코드 오염 방지). ~420일(14개월) cap.
async function updateHistory(data, marketSnapshot = null, officialFx = null) {
  try {
    const snapshotBySym = new Map((marketSnapshot?.quotes || []).map((row) => [row.instrumentId, row]));
    const bySymQuote = {};
    const bySym = {};
    for (const q of data.quotes || []) {
      const session = snapshotBySym.get(q.symbol)?.session || deriveMarketSession({
        instrumentId: q.symbol,
        observedAt: q.observedAt,
        providerSession: q.marketSession || q.marketState,
        now: Date.parse(data.meta?.generatedAt || '') || Date.now(),
      });
      const isOpenPoint = session === 'CURRENT_SESSION' || session === 'DELAYED_IN_SESSION';
      const previousClose = Number(q.regularMarketPreviousClose ?? q.chartPreviousClose);
      const previousObservedAt = q.regularMarketPreviousCloseObservedAt || null;
      const usePreviousClose = isOpenPoint && Number.isFinite(previousClose) && previousClose > 0;
      bySym[q.symbol] = usePreviousClose ? previousClose : q.regularMarketPrice;
      // A history row is a completed daily close, not the provider's intraday
      // previous-value anchor — and that holds for 24/7 assets too. BTC/ETH have a real
      // previous completed daily bar (regularMarketPreviousClose, stamped with the boundary
      // that closed it, see regularMarketPreviousCloseObservedAt above), so they take the
      // same path as sessioned instruments.
      // 2026-09-20: this lane used to override continuous quotes back to regularMarketPrice.
      // P1144's premise ("a 24/7 quote has no previous completed day") was false — the daily
      // chart provides one — and recording a mid-day observation as a completed daily close is
      // exactly what ci-history-field-time-contract-check rejects as "in-session observation
      // promoted as daily close", which kept CI red and Pages undeployed.
      // P1095: a previous-completed-close value must not inherit the CURRENT
      // observation's timestamp. The old fallback (`previousObservedAt || q.observedAt`)
      // did exactly that whenever the provider omitted
      // `regularMarketPreviousCloseObservedAt`, so history.json published the prior
      // session's close stamped with the current cut (dxy/wti/gold/kospi/kosdaq/btc):
      // 14 fields split across two time conventions, six of them shifted by a session,
      // with nothing marking the substitution. Fail closed instead — no timestamp means
      // a consumer must not read the value as a current observation.
      const effectiveUsePreviousClose = usePreviousClose;
      const bySymQuoteEntry = {
        ...q,
        observedAt: effectiveUsePreviousClose ? previousObservedAt : q.observedAt,
        observationRelation: effectiveUsePreviousClose ? 'previous-completed-close' : 'latest-completed-close',
        observedAtSource: effectiveUsePreviousClose
          ? (previousObservedAt ? 'provider-previous-close' : 'unavailable')
          : 'provider-current',
        marketSession: 'COMPLETED',
        observedMarketSession: session,
        valueBasis: effectiveUsePreviousClose ? 'previous-completed-close' : 'latest-completed-close',
        allowedUse: 'completed-market-series',
      };
      bySymQuote[q.symbol] = bySymQuoteEntry;
    }
    const pick = (s) => (typeof bySym[s] === 'number' && isFinite(bySym[s])) ? round(bySym[s], 2) : null;
    // P1246 (품질 경계): 히스토리에 실릴 값은 선언된 타당 범위 안에 있어야 한다. 범위 밖 값은 관측이
    // 아니라 공급자 오류로 취급해 null로 남긴다(값도 fieldMeta도 없음 — P1101의 무관측 표기).
    const pickField = (field, symbol) => {
      const value = pick(symbol);
      if (value == null) return null;
      if (histValueWithinPlausibility(field, value)) return value;
      console.warn(`[fetch-data] history: ${field}(${symbol})=${value} 이 타당 범위 밖 — 관측으로 기록하지 않음`);
      return null;
    };
    if (pick('^GSPC') === null && pick('^VIX') === null) {
      console.warn('[fetch-data] history: 핵심 심볼(SPX/VIX) 없음 — 히스토리 갱신 스킵');
      return null;
    }
    const fetchedAt = data.meta?.generatedAt || new Date().toISOString();
    const cycleEnd = data.meta?.newsCycleEnd || fetchedAt;
    boundPreviousCloseToCut({ bySym, bySymQuote, cycleEnd });
    const fieldMeta = {};
    const historyMeta = (field, quote, fallback = {}) => ({
      observedAt: quote?.observedAt || fallback.observedAt || null,
      fetchedAt: quote?.fetchedAt || fetchedAt,
      lastSuccessfulAt: quote?.fetchedAt || fetchedAt,
      source: quote?.source || fallback.source || 'Yahoo chart',
      sourceKind: quote?.sourceTier || fallback.sourceKind || 'public-information-service',
      allowedUse: quote?.allowedUse || fallback.allowedUse || 'reference',
      marketSession: quote?.marketSession || quote?.marketState || fallback.marketSession || null,
      observedMarketSession: quote?.observedMarketSession || fallback.observedMarketSession || null,
      valueBasis: quote?.valueBasis || fallback.valueBasis || null,
      // P1117: bySymQuote computes observationRelation/observedAtSource, but this projection
      // dropped both, so history.json never published the substitution marker the
      // previous-completed-close fix was supposed to expose. The artifact gate skipped its
      // assertions forever because it looks for exactly this field. Publish what the
      // producer already knows instead of recomputing it downstream.
      observationRelation: quote?.observationRelation || fallback.observationRelation || 'latest-completed-close',
      observedAtSource: quote?.observedAtSource || fallback.observedAtSource || 'provider-current',
    });
    // P1246: 값과 증거를 **한 번의 열거**에서 만든다. 종전에는 `rec`의 명시적 pick 목록과 이 루프가
    // 같은 HIST_SYMBOLS 매핑을 두 번 나열해, 한쪽만 고치면 값과 fieldMeta가 서로 다른 필드 집합을
    // 갖게 됐다(새 필드를 추가할 때 특히 조용히 어긋난다).
    const fieldValues = {};
    for (const [sym, field] of Object.entries(HIST_SYMBOLS)) {
      const value = pickField(field, sym);
      if (value === null) continue;
      fieldValues[field] = value;
      fieldMeta[field] = historyMeta(field, bySymQuote[sym]);
    }
    if (typeof data.fearGreed?.score === 'number') {
      const rawAsOf = data.fearGreed.asOf;
      const asOfMs = typeof rawAsOf === 'number' ? (rawAsOf < 1e12 ? rawAsOf * 1000 : rawAsOf) : Date.parse(rawAsOf || '');
      fieldMeta.fg = historyMeta('fg', null, {
        observedAt: Number.isFinite(asOfMs) ? new Date(asOfMs).toISOString() : null,
        source: data.fearGreed._source || 'CNN Fear & Greed',
        sourceKind: 'public-api',
        allowedUse: 'reference',
        // F&G is a publisher-dated daily value, not a market close cut.
        observationRelation: 'day-scoped-published',
        observedAtSource: Number.isFinite(asOfMs) ? 'publisher-as-of' : 'unavailable',
      });
    }
    const today = new Date(fetchedAt).toISOString().slice(0, 10); // UTC 일자 bucket; fieldMeta is authoritative
    const rec = {
      date: today,
      seriesMode: 'completed-market-cut',
      cycleEnd: cycleEnd,
      marketSnapshotRevision: data.meta?.marketSnapshotRevision || marketSnapshot?.revision || null,
      ...fieldValues,
      fg: (data.fearGreed && typeof data.fearGreed.score === 'number') ? data.fearGreed.score : null,
      fieldMeta,
    };
    let hist = [];
    try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    // CNN publishes a dated historical series in the same response as the
    // current Fear & Greed value. Backfill those observations with their real
    // dates instead of waiting 60 future refresh cycles or inventing history.
    for (const point of Array.isArray(data.fearGreed?.history) ? data.fearGreed.history : []) {
      const date = String(point?.observedAt || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Number(point?.score))) continue;
      let row = hist.find((item) => item?.date === date);
      if (!row) { row = { date, fieldMeta: {} }; hist.push(row); }
      row.fg = Number(point.score);
      row.fieldMeta = row.fieldMeta || {};
      row.fieldMeta.fg = {
        observedAt: point.observedAt,
        fetchedAt,
        lastSuccessfulAt: fetchedAt,
        source: 'CNN Fear & Greed historical graph',
        sourceKind: 'secondary-index',
        allowedUse: 'reference-history'
      };
    }
    // `fieldMeta.fg` cites the CNN historical graph, so the row value must be
    // that series' point for the day. The headline `fearGreed.score` is rounded
    // separately, and spreading it over the row published 26 beside provenance
    // that recorded 26.11 (P1100).
    const fgSeriesValue = hist.find((row) => row?.date === today)?.fg;
    if (Number.isFinite(Number(fgSeriesValue))) rec.fg = Number(fgSeriesValue);
    // v50.52 B4: 최초/얇을 때(또는 BACKFILL=1) 6개월 일별 종가로 과거 시드 — 차트 대기 제거(멱등).
    let backfilled = 0;
    const needsFieldMeta = hist.some(row => HIST_MARKET_FIELDS.some(field => typeof row?.[field] === 'number' && !row?.fieldMeta?.[field]?.observedAt));
    const needsFieldBackfill = HIST_MARKET_FIELDS.some((field) => hist.filter((row) => typeof row?.[field] === 'number' && Number.isFinite(row[field])).length < 60);
    if (hist.length < 60 || process.env.BACKFILL === '1' || needsFieldMeta || needsFieldBackfill) {
      try { const bf = await backfillHistory(hist); hist = bf.hist; backfilled = bf.added; } catch (e) { console.warn('[fetch-data] backfill 실패(무시):', e && e.message || e); }
    }
    hist = carryForwardHistoryEvidence(hist);
    const idx = hist.findIndex(h => h && h.date === today);
    if (idx >= 0) hist[idx] = { ...hist[idx], ...rec, fieldMeta: { ...(hist[idx].fieldMeta || {}), ...fieldMeta } }; else hist.push(rec); // 같은 날 = upsert
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 420) hist = hist.slice(hist.length - 420);  // 14개월 cap
    await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(hist)));
    // P1246: 이번 실행이 실제로 기록한 USD/KRW 완료 종가. FRED DEXKOUS 교차검증이 이 값을 기준으로
    // 삼는다 — 아티팩트가 실제로 담은 값이어야 검증이 의미를 갖는다. 없으면 null로 남겨 교차검증이
    // "판정 불가"를 말하게 한다(값을 지어내지 않는다).
    const fxObservation = Number.isFinite(fieldValues.usdkrw)
      ? { value: fieldValues.usdkrw, date: today, observedAt: fieldMeta.usdkrw?.observedAt || null, valueBasis: fieldMeta.usdkrw?.valueBasis || null }
      : null;
    // P1246: 공식 관측일과 **같은 시점**의 우리 완료 종가를 골라 비교한다. 하루 어긋난 봉까지는 같은
    // 시점으로 보되 실제 날짜를 레코드에 남긴다. 그 이상 벌어지면 최신값으로 대신하지 않고 '판정 불가'
    // 로 남긴다 — 시점이 다른 두 값을 비교해 불일치라고 말하는 것은 공표 지연을 데이터 오류로
    // 오표기하는 것이다.
    const officialDate = String(officialFx?.observedAt || '').slice(0, 10);
    const alignedRow = /^\d{4}-\d{2}-\d{2}$/.test(officialDate)
      ? [officialDate,
          new Date(Date.parse(`${officialDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10),
          new Date(Date.parse(`${officialDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)]
        .map((candidate) => hist.find((row) => row && row.date === candidate && Number.isFinite(row.usdkrw)))
        .find(Boolean) || null
      : null;
    const fxCrossCheck = compareUsdKrwCrossCheck({
      provider: alignedRow
        ? { value: alignedRow.usdkrw, date: alignedRow.date, observedAt: alignedRow.fieldMeta?.usdkrw?.observedAt || `${alignedRow.date}T00:00:00.000Z` }
        : null,
      latestProvider: fxObservation,
      official: officialFx,
    });
    return { days: hist.length, today, upsert: idx >= 0 ? 'update' : 'append', backfilled, fxCrossCheck };
  } catch (e) {
    console.warn('[fetch-data] history 갱신 실패(무시):', e && e.message || e);
    return null;
  }
}

// ── v50.52 Track1: 스크리너 팩터 enrichment (정적 SCREENER_DB → 라이브 팩터 데이터) ──
// 왜: SCREENER_DB(js/aio-data.js)는 시총/RSI/시그널이 하드코딩(2026-04 기준)이라 stale.
//     서버에서 유니버스 1년 일별 종가를 받아 모멘텀/저변동/추세/RSI 팩터를 계산해 screener.json으로
//     떨군다(일 1회 자가 스로틀). 클라가 병합 → 멀티팩터 랭킹의 입력. value/quality(P/E·마진)는
//     무료 대규모 소스 없음 → 가격 파생 4팩터부터(정직). 심볼은 SCREENER_DB에서 런타임 추출(단일 출처).
const SCREENER_OUT = `${__dir}/../public-data/screener.json`;
const BACKTEST_DEFAULT_TRANSACTION_COST_BPS = 20;
const BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS = 20;
const BACKTEST_MIN_LIQUIDITY_OBSERVATIONS = 10;

// v51.94/Phase 2 [B6]: 심볼 목록을 js/aio-data.js 소스 텍스트 정규식 스크래핑 대신
// public-data/screener-universe.json(scripts/sync-screener-universe.mjs가 SCREENER_DB에서
// 생성하는 JSON 아티팩트)에서 직접 읽는다. 이전 방식은 "\n];" 문자열 탐색으로 배열 끝을
// 찾아 취약했다(배열 안 어딘가에 그 정확한 바이트열이 나타나면 조기 종료) — JSON은 그런
// 경계 추측이 필요 없다. screener-universe.json이 오래됐거나 없으면(sync 누락) CI의
// ci-data-pipeline-contract-check.mjs가 drift를 잡아낸다.
async function getScreenerUniverse() {
  try {
    const raw = await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8');
    const j = JSON.parse(raw);
    const syms = (j.universe || []).map(r => r && r.sym).filter(Boolean);
    return {
      symbols: [...new Set(syms)],
      meta: j.meta && typeof j.meta === 'object' ? j.meta : {},
      generatedFrom: j.generatedFrom || 'unknown',
      generatedBy: j.generatedBy || 'unknown'
    };
  } catch (e) {
    console.warn('[fetch-data] screener-universe.json 읽기 실패:', e && e.message);
    return { symbols: [], meta: {}, generatedFrom: null, generatedBy: null };
  }
}

async function getScreenerSymbols() {
  return (await getScreenerUniverse()).symbols;
}
// Yahoo 심볼 정규화: 클래스주 BRK.B→BRK-B. KR(.KS/.KQ)·일반은 보존.
const _yhSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');

export const _mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function _retPct(closes, n) {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n], b = closes[closes.length - 1];
  return (a > 0) ? round((b / a - 1) * 100, 2) : null;
}
function _annVol(closes, n) {
  if (closes.length < n + 1) return null;
  const seg = closes.slice(-(n + 1));
  const rets = [];
  for (let i = 1; i < seg.length; i++) if (seg[i - 1] > 0) rets.push(seg[i] / seg[i - 1] - 1);
  const mu = _mean(rets);
  if (mu == null || rets.length < 2) return null;
  const v = rets.reduce((s, r) => s + (r - mu) * (r - mu), 0) / (rets.length - 1);
  return round(Math.sqrt(v) * Math.sqrt(252) * 100, 2);   // 연율화 %
}

// Historical liquidity is an observation, not a tradability guarantee. Keep the
// native quote currency and the number of usable bars so a cross-sectional
// backtest cannot silently compare KRW notionals with USD notionals or treat a
// sparse volume series as liquid. Execution impact/borrow/spread are deliberately
// outside this helper; the backtest reports the coverage and applies only its
// explicitly-labelled transaction-cost scenario.
function _historicalLiquidity(stock, endIndex, window) {
  const closes = Array.isArray(stock?.closes) ? stock.closes : [];
  const volumes = Array.isArray(stock?.volumes) ? stock.volumes : [];
  if (closes.length !== volumes.length || !Number.isInteger(endIndex) || endIndex < 0) return null;
  const lookback = Math.max(1, Number(window) || BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS);
  const start = Math.max(0, endIndex - lookback + 1);
  const values = [];
  for (let index = start; index <= endIndex; index += 1) {
    const close = Number(closes[index]);
    const volume = Number(volumes[index]);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(volume) && volume > 0) values.push(close * volume);
  }
  if (values.length < Math.min(BACKTEST_MIN_LIQUIDITY_OBSERVATIONS, lookback)) return null;
  return {
    averageNotional: _mean(values),
    observationCount: values.length,
    windowDays: lookback,
    currency: stock?.currency || (/\.(KS|KQ)$/i.test(String(stock?.sym || '')) ? 'KRW' : 'USD')
  };
}

function _normaliseBacktestDate(value) {
  const date = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function _hasCompleteAdjustedSeries(stock, dateCount) {
  const adjusted = Array.isArray(stock?.adjCloses) ? stock.adjCloses : null;
  const expected = Number.isInteger(dateCount) && dateCount > 0 ? dateCount : null;
  if (!adjusted || (expected != null && adjusted.length !== expected) || !adjusted.length) return false;
  return adjusted.every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
}
// v51.91 P584/R265/C1: switched from Cutler's RSI (simple average over only the last 14 bars,
// recomputed fresh each call) to Wilder's RSI (initial 14-bar average, then recursively smoothed
// over the full input history) — matching js/aio-core.js:_calcRSILast exactly. The two methods
// carried the same "RSI(14)" label but produced different numbers whenever there was a meaningful
// gain/loss regime earlier in the series, so screener.json's rsi and the client's own RSI display
// could diverge by several points. Wilder's method is what TradingView/TA-Lib/most brokers mean by
// "RSI" by default — the named-methodology-parity requirement from R265. Verified by extraction:
// scripts/ci-data-pipeline-contract-check.mjs runs both implementations against identical synthetic
// closes and asserts the outputs match within tolerance.
function _rsi14(closes) {
  const period = 14;
  const nums = closes.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  if (nums.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = nums[i] - nums[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let j = period + 1; j < nums.length; j++) {
    const diff = nums[j] - nums[j - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - (100 / (1 + rs)), 1);
}
// v51.32: 칼만 추세 필터 — 숨겨진 가격 레벨과 추세 속도(velocity)를 재귀 추정.
// 노이즈 측정에서 실제 추세 속도를 분리 (Rolling OLS보다 연속적이고 안정적).
// state=[level, velocity], F=[[1,1],[0,1]], H=[1,0], Q=diag(Ql,Qv), R=obs noise.
function _kalmanTrend(closes, vol) {
  if (!Array.isArray(closes) || closes.length < 10) return null;
  const series = closes
    .map(v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.log(v) : null)
    .filter(v => v !== null);
  if (series.length < 10) return null;
  const Ql = 1e-4, Qv = 1e-5;
  // R = daily observation noise. Use asset's own daily variance when available so
  // high-vol stocks (VIX 70+) don't over-trust the signal and low-vol names don't lag.
  const dailyVol = (typeof vol === 'number' && vol > 0) ? (vol / 100) / Math.sqrt(252) : null;
  const R = dailyVol ? Math.max(1e-4, dailyVol * dailyVol) : 1e-2;
  // 초기 속도: 첫 5일 선형 기울기로 시드 (s1=0 시작 시 20~30일 수렴 지연 제거)
  const initN = Math.min(5, series.length - 1);
  const s1Init = initN > 0 ? (series[initN] - series[0]) / initN : 0;
  let s0 = series[0], s1 = s1Init;
  let p00 = 1, p01 = 0, p10 = 0, p11 = 1;
  let lastE = 0, lastS = R;
  for (let i = 0; i < series.length; i++) {
    const y = series[i];
    const ps0 = s0 + s1, ps1 = s1;
    const pp00 = p00 + p01 + p10 + p11 + Ql;
    const pp01 = p01 + p11, pp10 = p10 + p11, pp11 = p11 + Qv;
    const e = y - ps0, S = pp00 + R;
    lastE = e; lastS = S;
    const k0 = pp00 / S, k1 = pp10 / S;
    s0 = ps0 + k0 * e; s1 = ps1 + k1 * e;
    p00 = (1 - k0) * pp00; p01 = (1 - k0) * pp01;
    p10 = -k1 * pp00 + pp10; p11 = -k1 * pp01 + pp11;
  }
  const vel = (Math.expm1(s1) * 100), pt = p00 + p11;
  const innovZ = lastS > 0 ? round(lastE / Math.sqrt(lastS), 4) : null;
  const velConf = round(vel / (1 + Math.sqrt(Math.max(pt, 0))), 6);
  return { vel: round(vel, 6), pt: round(pt, 6), innovZ, velConf, scale: 'log_pct_day' };
}
export function closesToFactors(closes) {
  if (!Array.isArray(closes) || closes.length < 30) return null;
  const price = closes[closes.length - 1];
  const sma50 = closes.length >= 50 ? _mean(closes.slice(-50)) : null;
  const sma200 = closes.length >= 200 ? _mean(closes.slice(-200)) : null;
  const vol60 = _annVol(closes, 60);
  const kalman = _kalmanTrend(closes.slice(-90), vol60);
  return {
    price: round(price, 2),
    ret1m: _retPct(closes, 21), ret3m: _retPct(closes, 63), ret6m: _retPct(closes, 126),
    vol: vol60, rsi: _rsi14(closes),
    pctSma50: (sma50 && sma50 > 0) ? round((price / sma50 - 1) * 100, 2) : null,
    pctSma200: (sma200 && sma200 > 0) ? round((price / sma200 - 1) * 100, 2) : null,
    kalmanVel:    kalman ? kalman.vel     : null,
    kalmanPt:     kalman ? kalman.pt      : null,
    kalmanInnovZ: kalman ? kalman.innovZ  : null,
    kalmanVelConf:kalman ? kalman.velConf : null,
    kalmanScale:  kalman ? kalman.scale   : null,
  };
}

// v50.53 2B: 서버 팩터 백테스트 — 수집한 1년 일별 종가로 횡단면(cross-sectional) 검증.
//   끝(today)에서 N일 전 리밸 시점마다 전 종목을 팩터로 랭크 → forward 21일 수익률과의 Spearman IC,
//   종합 랭크 상-하위 분위 스프레드, 방향 적중률. 누적 대기 불요(enrich 시점 1패스 계산).
function _spearman(xs, ys) {
  return spearman(xs, ys);
}
// v52.50/WO-3: opts.offsets/opts.fwdDays는 선택적 override — 생략 시 기존 6개월 프로덕션
// 리밸런스 세트+21일 forward 그대로(호출부 무변화, 하위호환). scripts/backtest-factors-longrun.mjs가
// 수년치 데이터로 훨씬 많은 리밸런스 시점을 넘겨 이 동일 포뮬러를 재사용한다(로직 복제 방지).
export function backtestFactors(stockData, opts) {
  opts = opts || {};
  var OFFSETS = opts.offsets || [147, 126, 105, 84, 63, 42], FWD = opts.fwdDays || 21;     // 끝에서 N일 전 리밸 시점들
  var isNum = function(v){ return typeof v === 'number' && isFinite(v); };
  var transactionCostBps = isNum(Number(opts.transactionCostBps))
    ? Math.max(0, Number(opts.transactionCostBps))
    : BACKTEST_DEFAULT_TRANSACTION_COST_BPS;
  var liquidityWindowDays = Math.max(1, Number(opts.liquidityWindowDays) || BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS);
  var universeMeta = opts.universeMeta && typeof opts.universeMeta === 'object' ? opts.universeMeta : {};
  var rawStocks = Array.isArray(stockData) ? stockData.filter(function(s){ return s && typeof s === 'object'; }) : [];
  // A tail offset is not a market date. Different IPO histories, missing bars,
  // and exchange holidays otherwise put different real dates into one
  // cross-section. Keep only rows with a strictly increasing, date-aligned
  // series and derive the rebalance calendar from their date intersection.
  var datedStocks = [], excludedWithoutDates = 0;
  rawStocks.forEach(function(stock) {
    var rawDates = Array.isArray(stock.dates) ? stock.dates : null;
    var dates = rawDates ? rawDates.map(_normaliseBacktestDate) : null;
    var closes = Array.isArray(stock.closes) ? stock.closes : null;
    // Adjusted-close coverage is tracked separately below. A stock with a
    // valid date/price calendar but missing corporate-action data belongs in
    // the date-aligned universe and must be reported as adjusted-data
    // excluded, not misclassified as a missing-calendar row.
    var valid = !!(dates && dates.length && closes && dates.length === closes.length);
    if (valid) {
      for (var di = 0; di < dates.length; di++) {
        if (!dates[di] || (di > 0 && dates[di] <= dates[di - 1])) { valid = false; break; }
      }
    }
    if (!valid) { excludedWithoutDates++; return; }
    var dateIndex = new Map();
    dates.forEach(function(date, index){ dateIndex.set(date, index); });
    datedStocks.push({ stock: stock, dates: dates, dateIndex: dateIndex });
  });
  var dateAlignmentMode = !rawStocks.length || excludedWithoutDates === 0 ? 'aligned'
    : datedStocks.length ? 'minimum-coverage' : 'blocked';
  var commonDateSet = null;
  datedStocks.forEach(function(record) {
    var ownDates = new Set(record.dates);
    if (commonDateSet == null) commonDateSet = ownDates;
    else commonDateSet = new Set(Array.from(commonDateSet).filter(function(date){ return ownDates.has(date); }));
  });
  var commonDates = commonDateSet ? Array.from(commonDateSet).sort() : [];
  // The strict all-symbol intersection is retained as a diagnostic only. It
  // can collapse the sample when one symbol misses a holiday/bar. Rebalance
  // on observed market dates that meet a declared minimum symbol coverage,
  // and require each symbol to have both the exact rebalance and target date.
  var minDateCoverage = isNum(Number(opts.minDateCoverage))
    ? Math.max(0, Math.min(1, Number(opts.minDateCoverage))) : 0.8;
  var dateCounts = new Map();
  datedStocks.forEach(function(record) {
    record.dates.forEach(function(date) { dateCounts.set(date, (dateCounts.get(date) || 0) + 1); });
  });
  var suppliedCalendarDates = Array.isArray(opts.calendarDates)
    ? opts.calendarDates.map(_normaliseBacktestDate).filter(Boolean)
    : null;
  var calendarDates = suppliedCalendarDates && suppliedCalendarDates.length
    ? Array.from(new Set(suppliedCalendarDates)).sort()
    : Array.from(dateCounts.entries())
      .filter(function(entry) { return datedStocks.length > 0 && entry[1] / datedStocks.length >= minDateCoverage; })
      .map(function(entry) { return entry[0]; })
      .sort();
  var calendarDateSet = new Set(calendarDates);
  var calendarIndex = new Map(calendarDates.map(function(date, index) { return [date, index]; }));
  var requestedRebalanceDates = Array.isArray(opts.rebalanceDates)
    ? opts.rebalanceDates.map(_normaliseBacktestDate).filter(Boolean)
    : OFFSETS.map(function(offset) {
        var number = Number(offset);
        if (!Number.isInteger(number) || number < 0 || number >= calendarDates.length) return null;
        // Offset zero means the final completed minimum-coverage calendar date;
        // it is never a per-symbol tail lookup.
        return calendarDates[calendarDates.length - 1 - number];
      }).filter(Boolean);
  requestedRebalanceDates = Array.from(new Set(requestedRebalanceDates));
  var rebalanceDates = requestedRebalanceDates.filter(function(date){ return calendarDateSet.has(date); }).sort();
  var droppedRebalanceDates = requestedRebalanceDates.filter(function(date){ return rebalanceDates.indexOf(date) < 0; });
  var dateReadyRecords = datedStocks;
  // v51.91 P586/C2: this backtest validates a *fixed* 4-factor subset, not the live ranking model
  // (js/aio-data.js:_aioComputeFactorRanks), whose marketState tilts are currently
  // proposal-only; production ranks remain fixed at NEUTRAL until an explicit
  // promotion record proves live/backtest parity and receives human review. The UI
  // previously implied "종합 랭크가 검증 기반" (the live composite rank is what's validated) —
  // that was not accurate. What IS validated here: momentum/trend/lowvol/kalman at
  // the fixed NEUTRAL weights; proposal tilts are not validated or applied.
  //   size/value/quality are excluded — not because they don't matter, but because backtesting
  //   them here would either be infeasible or methodologically unsound with data this pipeline
  //   actually has: size needs historical shares-outstanding (not fetched anywhere — mcap is a
  //   hand-maintained static seed in SCREENER_DB, not a live time series); value/quality come from
  //   FMP as today-only TTM snapshots (fetch-data.mjs:enrichFundamentals), so scoring a rebalance
  //   147 days ago with today's P/E/ROE would be look-ahead bias — using information that wasn't
  //   actually available at that date. Do not add them without solving those two problems first.
  //   Weights below are the live NEUTRAL constant's momentum/trend/lowvol/kalman entries
  //   (.27/.20/.16/.10, subset sum .73), renormalized to sum to 1 over just this subset — a single
  //   source of truth instead of an independently hand-picked second weight set (see P584/C1 for
  //   why two independent copies of the same "thing" drift apart over time).
  var COMP_W = { mom: 0.370, trend: 0.274, lowvol: 0.219, kalman: 0.137 };
  var EXCLUDED_FACTORS = ['size', 'value', 'quality'];
  var EXCLUDED_FACTORS_REASON = 'size needs historical shares-outstanding data this pipeline does not fetch; value/quality are FMP today-only TTM snapshots with no historical time series, so backtesting them would use look-ahead information';
  var IC_FACTORS = ['momentum','trend','lowvol','kalman','composite'];
  var icS = {}, icN = {};
  // v52.50/WO-3: per-rebalance-date IC list (additive, existing icS/icN mean-only output unchanged) —
  // needed to compute ICIR (mean IC / stddev IC across dates) and its t-stat/CI, which Codex's WO-3
  // gate asks for explicitly and which a single averaged IC number cannot support.
  var icByDate = {};
  IC_FACTORS.forEach(function(k){ icS[k]=0; icN[k]=0; icByDate[k]=[]; });
  var spreadSum = 0, spreadNetSum = 0, costSum = 0, spreadN = 0, hit = 0, netHit = 0, hitN = 0;
  var turnoverValues = [], liquidityCoverageValues = [], liquidityObservedRows = 0, liquidityEligibleRows = 0;
  var previousPositions = null;
  var adjustedCloseEligible = dateReadyRecords.filter(function(record){ return _hasCompleteAdjustedSeries(record.stock, record.dates.length); }).length;
  var adjustedCloseExcluded = Math.max(0, dateReadyRecords.length - adjustedCloseEligible);
  var adjustedCloseEligibleRows = 0, adjustedCloseExcludedRows = 0;
  var missingRebalanceRows = 0, missingForwardRows = 0;
  var compositeWeightCoverageMin = 0.8;
  function rank01(vals) { // 값→0..1 percentile(null=0.5), 동점은 평균순위
    return percentileRank01(vals);
  }
  rebalanceDates.forEach(function(rebalanceDate) {
    var rows = [];
    dateReadyRecords.forEach(function(record) {
      var s = record.stock;
      // Return-based factor/backtest math is adjusted-close-only. Raw close is
      // retained for technical/OHLC consumers but is not a silent substitute:
      // without a complete aligned adjusted series, this symbol is excluded and
      // the output reports partial coverage instead of fabricating a result.
      var hasAdjusted = _hasCompleteAdjustedSeries(s, record.dates.length)
        && (!s.adjustedCloseStatus || s.adjustedCloseStatus === 'complete');
      if (!hasAdjusted) {
        adjustedCloseExcludedRows++;
        return;
      }
      adjustedCloseEligibleRows++;
      var c = s.adjCloses;
      var p = record.dateIndex.get(rebalanceDate);
      var rebalanceCalendarIndex = calendarIndex.get(rebalanceDate);
      var forwardDate = Number.isInteger(rebalanceCalendarIndex) ? calendarDates[rebalanceCalendarIndex + FWD] || null : null;
      var forwardIndex = forwardDate ? record.dateIndex.get(forwardDate) : null;
      if (!Number.isInteger(p)) { missingRebalanceRows++; return; }
      if (p < 63) { missingRebalanceRows++; return; }
      if (!Number.isInteger(forwardIndex) || forwardIndex <= p || forwardIndex > c.length - 1) { missingForwardRows++; return; }
      var f = closesToFactors(c.slice(0, p + 1)); if (!f) return;
      var fwd = (c[p] > 0) ? (c[forwardIndex] / c[p] - 1) : null; if (!isNum(fwd) || !forwardDate) return;
      // 모멘텀: 1M(40%)+3M(40%)+6M(20%) — 6M은 추세(trend)와 중복 크므로 가중 축소
      var momParts = [
        isNum(f.ret1m) ? { v: f.ret1m, w: 0.4 } : null,
        isNum(f.ret3m) ? { v: f.ret3m, w: 0.4 } : null,
        isNum(f.ret6m) ? { v: f.ret6m, w: 0.2 } : null,
      ].filter(Boolean);
      var momSum = momParts.reduce(function(s,p){return s+p.w;},0);
      var mom = momParts.length ? momParts.reduce(function(s,p){return s+p.v*p.w;},0)/momSum : null;
      var tr = [f.pctSma50, f.pctSma200].filter(isNum); tr = tr.length ? _mean(tr) : null;
      var kalman = isNum(f.kalmanVelConf) ? f.kalmanVelConf : (isNum(f.kalmanVel) ? f.kalmanVel : null);
      var liquidity = _historicalLiquidity(s, p, liquidityWindowDays);
      rows.push({
        sym: s.sym || s.symbol || null,
        rebalanceDate: rebalanceDate,
        forwardDate: forwardDate,
        mom: mom, trend: tr, lowvol: isNum(f.vol) ? -f.vol : null, kalman: kalman, fwd: fwd,
        liquidity: liquidity && isNum(liquidity.averageNotional) ? liquidity.averageNotional : null,
        liquidityObservations: liquidity ? liquidity.observationCount : 0,
        liquidityCurrency: liquidity ? liquidity.currency : (s.currency || (/\.(KS|KQ)$/i.test(String(s.sym || '')) ? 'KRW' : 'USD'))
      });
    });
    if (rows.length < 10) return;
    // 단일 팩터 Spearman IC
    [['mom','momentum'], ['trend','trend'], ['lowvol','lowvol'], ['kalman','kalman']].forEach(function(pair) {
      var ps = rows.filter(function(r){ return isNum(r[pair[0]]); });
      if (ps.length < 10) return;
      var ic = _spearman(ps.map(function(r){ return r[pair[0]]; }), ps.map(function(r){ return r.fwd; }));
      if (isNum(ic)) { icS[pair[1]] += ic; icN[pair[1]]++; icByDate[pair[1]].push(ic); }
    });
    // 복합 팩터: 라이브 가중과 동기화된 percentile 가중합
    var rm  = rank01(rows.map(function(r){ return r.mom; }));
    var rt  = rank01(rows.map(function(r){ return r.trend; }));
    var rl  = rank01(rows.map(function(r){ return r.lowvol; }));
    var rk  = rank01(rows.map(function(r){ return r.kalman; }));
    rows.forEach(function(r, i){
      // A missing factor is absent evidence, not the neutral percentile 0.5.
      // Exclude its weight from this row so partial coverage cannot dilute the
      // observed composite toward the cross-sectional midpoint.
      var composite = 0, wTotal = 0;
      if (isNum(r.mom)) { composite += COMP_W.mom * rm[i]; wTotal += COMP_W.mom; }
      if (isNum(r.trend)) { composite += COMP_W.trend * rt[i]; wTotal += COMP_W.trend; }
      if (isNum(r.lowvol)) { composite += COMP_W.lowvol * rl[i]; wTotal += COMP_W.lowvol; }
      if (isNum(r.kalman)) { composite += COMP_W.kalman * rk[i]; wTotal += COMP_W.kalman; }
      r.compositeWeightCoverage = wTotal;
      r.comp = wTotal >= compositeWeightCoverageMin ? composite / wTotal : null;
    });
    var icC = _spearman(rows.map(function(r){ return r.comp; }), rows.map(function(r){ return r.fwd; }));
    if (isNum(icC)) { icS.composite += icC; icN.composite++; icByDate.composite.push(icC); }
    // 상하위 20% 분위 스프레드 & 방향 적중률. Rows without any observed
    // composite are excluded from portfolio construction; they cannot become
    // a hidden neutral holding through rank01's display fallback.
    var rankedRows = rows.filter(function(r){ return isNum(r.comp); });
    if (rankedRows.length < 2) return;
    var sorted = rankedRows.slice().sort(function(a, b){ return a.comp - b.comp; });
    var q = Math.max(1, Math.floor(sorted.length / 5));
    var botM = _mean(sorted.slice(0, q).map(function(r){ return r.fwd; }));
    var topM = _mean(sorted.slice(-q).map(function(r){ return r.fwd; }));
    if (isNum(topM) && isNum(botM)) {
      var grossSpread = topM - botM;
      var positions = new Map();
      var longWeight = 0.5 / q, shortWeight = -0.5 / q;
      sorted.slice(-q).forEach(function(r){ if (r.sym) positions.set(r.sym, longWeight); });
      sorted.slice(0, q).forEach(function(r){ if (r.sym) positions.set(r.sym, shortWeight); });
      var turnover = previousPositions == null
        ? [...positions.values()].reduce(function(sum, value){ return sum + Math.abs(value); }, 0)
        : [...new Set([...previousPositions.keys(), ...positions.keys()])].reduce(function(sum, sym){
            return sum + Math.abs((positions.get(sym) || 0) - (previousPositions.get(sym) || 0));
          }, 0);
      var cost = turnover * transactionCostBps / 10000;
      var netSpread = grossSpread - cost;
      var selectedLiquidity = sorted.slice(0, q).concat(sorted.slice(-q));
      var selectedWithLiquidity = selectedLiquidity.filter(function(r){ return isNum(r.liquidity) && r.liquidityObservations >= BACKTEST_MIN_LIQUIDITY_OBSERVATIONS; }).length;
      var liquidityCoverage = selectedLiquidity.length ? selectedWithLiquidity / selectedLiquidity.length : null;
      var observedLiquidity = rankedRows.filter(function(r){ return isNum(r.liquidity); }).length;
      liquidityObservedRows += observedLiquidity;
      liquidityEligibleRows += rankedRows.length;
      if (liquidityCoverage != null) liquidityCoverageValues.push(liquidityCoverage);
      spreadSum += grossSpread;
      spreadNetSum += netSpread;
      costSum += cost;
      spreadN++;
      turnoverValues.push(turnover);
      hitN++;
      if (grossSpread > 0) hit++;
      if (netSpread > 0) netHit++;
      previousPositions = positions;
    }
  });
  var ic = {}; IC_FACTORS.forEach(function(k){ ic[k] = icN[k] ? round(icS[k] / icN[k], 3) : null; });
  var calculationStatus = !calendarDates.length || !rebalanceDates.length || !spreadN
    ? 'BLOCKED'
    : (adjustedCloseExcluded > 0 || missingRebalanceRows > 0 || missingForwardRows > 0 ? 'PARTIAL' : 'COMPLETE');
  var validationBlockers = [
    'historical-universe-point-in-time-not-available',
    'survivorship-bias-uncontrolled-current-membership',
    'corporate-action-event-audit-not-available',
    'execution-liquidity-filter-not-applied',
    'transaction-costs-scenario-only'
  ];
  if (adjustedCloseExcluded > 0) validationBlockers.push('adjusted-close-coverage-incomplete');
  if (!calendarDates.length || !rebalanceDates.length) validationBlockers.push('rebalance-calendar-insufficient');
  var validationReadiness = {
    status: 'BLOCKED',
    predictiveValidation: 'BLOCKED',
    tradingValidation: 'BLOCKED',
    allowedUse: 'research-reference-only',
    blockers: Array.from(new Set(validationBlockers)),
    reason: 'calculation output is descriptive research evidence; promotion requires PIT universe, corporate-action audit, execution liquidity and full cost model'
  };
  return {
    asOf: new Date().toISOString(), fwdDays: FWD, dates: spreadN,
    status: calculationStatus,
    calculationStatus: calculationStatus,
    readiness: validationReadiness,
    validationReadiness: validationReadiness,
    blockingReason: calculationStatus === 'BLOCKED' ? (!calendarDates.length ? 'rebalance-calendar-required' : 'insufficient-calculation-observations') : null,
    blockingReasons: validationReadiness.blockers,
    rebalanceDates: rebalanceDates,
    dateAlignment: {
      mode: dateAlignmentMode,
      contract: 'explicit-rebalance-dates-or-minimum-coverage-calendar-offsets',
      commonDateCount: commonDates.length,
      strictCommonDateCount: commonDates.length,
      calendarDateCount: calendarDates.length,
      calendarDates: calendarDates,
      calendarPolicy: suppliedCalendarDates && suppliedCalendarDates.length ? 'supplied-calendar' : 'minimum-coverage',
      minimumDateCoverage: minDateCoverage,
      dateCoverage: Object.fromEntries(calendarDates.map(function(date) { return [date, dateCounts.get(date) || 0]; })),
      requestedCount: requestedRebalanceDates.length,
      usedCount: rebalanceDates.length,
      droppedRequestedDates: droppedRebalanceDates,
      excludedStocksWithoutDateSeries: excludedWithoutDates,
      forwardMapping: 'common-calendar exact rebalance date plus T+n target date; symbols missing either date are excluded'
    },
    n: adjustedCloseEligible,
    priceBasis: 'adjusted-close-required',
      adjustedCloseStatus: adjustedCloseExcluded > 0 ? (adjustedCloseEligible > 0 ? 'partial' : 'unavailable') : (!calendarDates.length ? 'unavailable' : 'complete'),
    adjustedCloseEligible: adjustedCloseEligible,
    adjustedCloseExcluded: adjustedCloseExcluded,
    adjustedCloseEligibleRows: adjustedCloseEligibleRows,
      adjustedCloseExcludedRows: adjustedCloseExcludedRows,
    missingRebalanceRows: missingRebalanceRows,
    missingForwardRows: missingForwardRows,
    corporateActions: {
      priceBasis: 'adjusted-close-only',
      eventAudit: 'not-available',
      validationStatus: 'BLOCKED',
      blockedReasons: ['corporate-action-event-audit-not-available']
    },
    ic: ic,
    icByDate: icByDate,
    quantileSpread: spreadN ? round(spreadSum / spreadN * 100, 2) : null,
    quantileSpreadNet: spreadN ? round(spreadNetSum / spreadN * 100, 2) : null,
    transactionCostPct: spreadN ? round(costSum / spreadN * 100, 3) : null,
    hitRate: hitN ? round(hit / hitN * 100, 1) : null,
    netHitRate: hitN ? round(netHit / hitN * 100, 1) : null,
    turnover: {
      rebalanceCount: turnoverValues.length,
      average: turnoverValues.length ? round(_mean(turnoverValues), 4) : null,
      maximum: turnoverValues.length ? round(Math.max(...turnoverValues), 4) : null,
      unit: 'absolute portfolio-weight change; long/short equal-weight quintiles'
    },
    compositeWeightCoverageMin: compositeWeightCoverageMin,
    liquidity: {
      windowDays: liquidityWindowDays,
      minimumObservations: BACKTEST_MIN_LIQUIDITY_OBSERVATIONS,
      observedRows: liquidityObservedRows,
      eligibleRows: liquidityEligibleRows,
      coveragePct: liquidityEligibleRows ? round(liquidityObservedRows / liquidityEligibleRows * 100, 1) : null,
      selectedCoveragePct: liquidityCoverageValues.length ? round(_mean(liquidityCoverageValues) * 100, 1) : null,
      unitPolicy: 'native-close-times-volume; USD and KRW are not cross-converted',
      executionFilterApplied: false,
      validationStatus: 'BLOCKED',
      blockedReasons: ['execution-liquidity-filter-not-applied', 'fill-capacity-and-market-impact-not-modeled'],
      allowedUse: 'research-only; liquidity is diagnostic, not a fill guarantee'
    },
    executionModel: {
      rebalance: 'each supplied rebalance date; equal-weight long top quintile / short bottom quintile',
      transactionCostBps,
      costBasis: 'scenario one-way bps multiplied by absolute portfolio-weight turnover',
      excludedCosts: ['bid-ask spread', 'market impact', 'borrow fee/availability', 'taxes', 'FX conversion'],
      status: 'scenario-only-not-live-execution',
      validationStatus: 'BLOCKED',
      blockedReasons: ['transaction-costs-scenario-only', 'spread-impact-borrow-tax-and-fx-not-modeled']
    },
    universePolicy: {
      membership: 'current-configured-universe-applied-retrospectively',
      selectionAsOf: universeMeta.lastBulkUpdate || null,
      currentness: universeMeta.currentness || 'unknown',
      generatedFrom: universeMeta.generatedFrom || 'public-data/screener-universe.json',
      lookaheadBias: 'historical-membership-not-available',
      survivorshipBias: 'uncontrolled-current-membership-only',
      pointInTimeStatus: 'BLOCKED',
      validationStatus: 'BLOCKED',
      blockedReasons: ['historical-universe-point-in-time-not-available', 'survivorship-bias-uncontrolled-current-membership'],
      allowedUse: 'research-reference-not-predictive-validation'
    },
    compWeights: COMP_W,
    weightPolicy: 'fixed-neutral-until-explicit-promotion',
    weightRegime: 'NEUTRAL',
    excludedFactors: EXCLUDED_FACTORS,
    excludedFactorsReason: EXCLUDED_FACTORS_REASON,
    kalmanScale: 'log_pct_day',
  };
}

// v51.91 P586/C2: append each backtest run's IC/spread/hitRate to a small time series so drift
// (or a broken factor silently going to IC~0) is visible across runs instead of being overwritten
// every 6h with no history. Separate file from history.json (daily market data, different
// producer/cadence) to avoid entangling two independently-working accumulation paths.
const BACKTEST_HIST = `${__dir}/../public-data/backtest-history.json`;
async function updateBacktestHistory(backtest) {
  if (!backtest || !backtest.ic) return null;
  try {
    let hist = [];
    try { const raw = JSON.parse(await readFile(BACKTEST_HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    const today = new Date().toISOString().slice(0, 10);
    const rec = {
      date: today,
      asOf: backtest.asOf,
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

async function enrichSecFundamentals(syms, priceData, priceResults = null) {
  try {
    const payload = JSON.parse(await readFile(SEC_FUNDAMENTALS_OUT, 'utf8'));
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
      const row = rows[sym];
      if (!row || !row.fetchedAt || Date.now() - new Date(row.fetchedAt).getTime() > maxFetchAge) continue;
      const rec = {};
      ['pe','pb','roe','margin','revGrowth'].forEach(key => {
        if (typeof row[key] === 'number' && Number.isFinite(row[key])) rec[key] = row[key];
      });
      if (rec.pe == null || rec.pb == null) {
        const px = priceBySym.get(sym);
        const shares = Number(row.sharesOutstanding);
        const netIncome = Number(row.netIncome);
        const equity = Number(row.equity);
        if (Number.isFinite(px) && px > 0 && Number.isFinite(shares) && shares > 0) {
          const mcap = px * shares;
          if (rec.pe == null && Number.isFinite(netIncome) && netIncome > 0) {
            rec.pe = Math.round(mcap / netIncome * 100) / 100;
            rec.pePrice = px;
            rec.pePriceBasis = 'adjusted-close';
          }
          if (rec.pb == null && Number.isFinite(equity) && equity > 0) {
            rec.pb = Math.round(mcap / equity * 100) / 100;
            rec.pbPrice = px;
            rec.pbPriceBasis = 'adjusted-close';
          }
          if (rec.pePrice != null || rec.pbPrice != null) {
            rec.valuationSharesOutstanding = shares;
            rec.valuationSharesObservedAt = row.sharesObservedAt || null;
          }
        }
      }
      if (!Object.keys(rec).length) continue;
      Object.assign(rec, {
        fundamentalSource: 'SEC EDGAR companyfacts',
        fundamentalModel: row.model || payload.model || 'sec-fy-normalized-v2',
        fundamentalPeriod: row.periodType || 'FY',
        // Period end is not availability. Ranking may use only the first time
        // the filing was public; retain period end separately for display.
        fundamentalPeriodEnd: row.observedAt || null,
        fundamentalObservedAt: row.availableAt || row.acceptedAt || row.filedAt || null,
        fundamentalFiledAt: row.filedAt || null,
        fundamentalFetchedAt: row.fetchedAt,
        fundamentalAccession: row.accession || null,
        fundamentalSourceKind: 'T1_OFFICIAL',
        fundamentalAllowedUse: 'research-relative-ranking-only',
        fundamentalQuality: {
          status: row.availableAt || row.acceptedAt || row.filedAt ? 'CURRENT' : 'MISSING',
          stale: !(row.availableAt || row.acceptedAt || row.filedAt),
          decisionUse: false,
          allowedUse: 'reference'
        },
        fundamentalRightsId: 'PUBLIC_REFERENCE'
      });
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
      source: payload.source || 'SEC EDGAR companyfacts'
    };
  } catch (error) {
    return { data: {}, ok: 0, stored: 0, eligible: 0, model: 'sec-fy-normalized-v2', generatedAt: null, source: 'SEC EDGAR companyfacts', error: String(error && error.message || error) };
  }
}

// v51.68: VCP (Volatility Contraction Pattern) 서버 사이드 계산 — aio-core.js _calcVCP 대응
function _calcVCPServer(closes, highs, lows, volumes) {
  const n = closes.length;
  if (n < 60) return null;
  function sma(arr, p) {
    if (arr.length < p) return null;
    let s = 0; for (let i = arr.length - p; i < arr.length; i++) s += arr[i]; return s / p;
  }
  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  const price = closes[n - 1];
  const s50 = sma(closes, 50), s150 = sma(closes, 150), s200 = sma(closes, 200);
  const lk52 = Math.min(252, n);
  const h52 = highs.slice(n - lk52).reduce((m, v) => v > m ? v : m, 0);
  const pct52 = h52 > 0 ? (price - h52) / h52 * 100 : null;
  const stage2 = !!(s50 && s150 && s200 && price > s150 && s150 > s200 && price > s50 && pct52 !== null && pct52 >= -30);
  const bLen = Math.min(65, n - 10);
  const bH = highs.slice(n - bLen), bL = lows.slice(n - bLen), bV = volumes.slice(n - bLen);
  const N = 4; const swH = [], swL = [];
  for (let i = N; i < bH.length - N; i++) {
    let h = true, l = true;
    for (let j = i - N; j <= i + N; j++) {
      if (j === i) continue;
      if (bH[j] >= bH[i]) h = false;
      if (bL[j] <= bL[i]) l = false;
    }
    if (h) swH.push({ idx: i, p: bH[i] });
    if (l) swL.push({ idx: i, p: bL[i] });
  }
  const ctrs = [];
  for (let hi = 0; hi < swH.length; hi++) {
    let nl = null;
    for (let li = 0; li < swL.length; li++) { if (swL[li].idx > swH[hi].idx) { nl = swL[li]; break; } }
    if (!nl) continue;
    const d = (swH[hi].p - nl.p) / swH[hi].p * 100;
    if (d >= 1 && d <= 45) ctrs.push({ depth: Math.round(d * 10) / 10 });
  }
  const cnt = ctrs.length;
  const shrink = cnt >= 2 && ctrs.every((c, i) => i === 0 || ctrs[i].depth < ctrs[i - 1].depth);
  let volDry = false;
  if (bV.length >= 20) {
    const half = Math.floor(bV.length / 2);
    const fv = bV.slice(0, half).filter(v => v > 0);
    const sv = bV.slice(half).filter(v => v > 0);
    const fa = avg(fv), sa = avg(sv);
    volDry = fa > 0 && sa > 0 && sa < fa * 0.85;
  }
  let pivot = null;
  const recSH = swH.filter(sh => sh.idx >= bH.length - 25);
  if (recSH.length) pivot = recSH[recSH.length - 1].p;
  else if (swH.length) pivot = swH[swH.length - 1].p;
  const nearPivot = !!(pivot && price >= pivot * 0.97 && price <= pivot * 1.03);
  const lv = volumes[n - 1];
  const vs = volumes.slice(-21, -1).filter(v => v > 0);
  const rvol = (vs.length >= 10 && lv > 0) ? lv / avg(vs) : null;
  const brk = !!(pivot && price > pivot && rvol !== null && rvol > 1.4);
  let score = 0;
  if (stage2)    score += 25;
  if (cnt >= 2)  score += Math.min(20, cnt * 7);
  if (shrink)    score += 20;
  if (volDry)    score += 15;
  if (nearPivot) score += 10;
  if (brk)       score += 10;
  score = Math.min(100, Math.round(score));
  const vcpStage = !stage2 ? 'not_stage2' : brk ? 'breakout' : nearPivot ? 'near_pivot' : (cnt >= 2 && shrink) ? 'contracting' : cnt >= 1 ? 'basing' : 'stage2_only';
  return { vcpScore: score, vcpStage, pivotLevel: pivot,
           contractionCount: cnt, isShrinking: shrink, volumeDrying: volDry,
           pctFrom52wHigh: pct52 !== null ? Math.round(pct52 * 10) / 10 : null };
}

// Phase 1: 심볼 배열 → 1y 가격 이력 fetch + 팩터 계산. results 배열은 backtest에 재사용.
// v53.91: materialize the observable pieces of the TradingView "best winners"
// screen. These are evidence fields, not a buy score: missing source series
// stays null and the setup layer fails closed.
function _calcSetupScreenFields(closes, adjCloses, highs, lows, volumes) {
  const n = Math.min(closes.length, adjCloses.length, highs.length, lows.length, volumes.length);
  if (n < 1) return null;
  const tail = (arr, p) => arr.slice(Math.max(0, arr.length - p));
  const avg = (arr) => {
    const vals = arr.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const ema = (arr, period) => {
    if (arr.length < period) return null;
    let value = avg(arr.slice(0, period));
    if (value == null) return null;
    const alpha = 2 / (period + 1);
    for (let i = period; i < arr.length; i++) value = arr[i] * alpha + value * (1 - alpha);
    return value;
  };
  const price = closes[n - 1];
  const lowWindow = tail(lows, Math.min(252, n)).filter(v => v > 0);
  const highWindow = tail(highs, Math.min(252, n)).filter(v => v > 0);
  const low52 = lowWindow.length ? Math.min(...lowWindow) : null;
  const high52 = highWindow.length ? Math.max(...highWindow) : null;
  const adrWindow = Math.min(20, n);
  const adrPct = price > 0 ? avg(tail(highs, adrWindow).map((h, i) => {
    const idx = n - adrWindow + i;
    const lo = lows[idx];
    const base = closes[idx];
    return h > 0 && lo >= 0 && base > 0 ? (h - lo) / base * 100 : null;
  }).filter(v => v != null)) : null;
  const avgVolume30d = avg(tail(volumes, Math.min(30, n)));
  const latestVolume = typeof volumes[n - 1] === 'number' && Number.isFinite(volumes[n - 1]) && volumes[n - 1] > 0
    ? volumes[n - 1] : null;
  return {
    price: typeof price === 'number' && Number.isFinite(price) ? round(price, 4) : null,
    pctFrom52wLow: low52 > 0 ? round((price - low52) / low52 * 100, 1) : null,
    pctFrom52wHigh: high52 > 0 ? round((price - high52) / high52 * 100, 1) : null,
    adrPct: adrPct == null ? null : round(adrPct, 2),
    avgVolume30d: avgVolume30d == null ? null : Math.round(avgVolume30d),
    dollarVolume30d: price > 0 && avgVolume30d != null ? Math.round(price * avgVolume30d) : null,
    lastVolume: latestVolume == null ? null : Math.round(latestVolume),
    dollarVolume: price > 0 && latestVolume != null ? Math.round(price * latestVolume) : null,
    ema8: ema(closes, 8),
    ema21: ema(closes, 21),
    ema60: ema(closes, 60),
    // P1255 (07:M04 계열 잔여 D3): setup 비교(예: price > ema60)는 같은 계열 안에서만 성립한다.
    // EMA를 price와 같은 close 계열로 계산하고 기준을 선언한다 — 조정 EMA와 raw 가격을 직접
    // 비교하던 혼합 basis를 제거한다(조정 계열 수익률은 별도 ret* 필드가 소유).
    emaBasis: 'same-close-series-as-price'
  };
}

// P1184/R24-03: 품질 라벨을 타임스탬프 존재만으로 CURRENT로 발행하면 provider가 오래된 마지막 봉을
// 돌려준 날에도 artifact에 CURRENT가 남는다(소비측은 같은 행을 4일 경과로 차단한다). 소비측
// factor-ranks와 같은 신선도 예산을 공유해 처음부터 같은 판정을 쓴다 — 라벨이 다르면
// 'CURRENT인데 차단되는' 행이 생긴다.
export function deriveFactorQuality({ observedAt, computedAt } = {}) {
  const observedMs = observedAt ? Date.parse(observedAt) : NaN;
  const computedMs = computedAt ? Date.parse(computedAt) : NaN;
  const ageMs = Number.isFinite(observedMs) && Number.isFinite(computedMs) ? computedMs - observedMs : NaN;
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= FACTOR_FRESHNESS_MS;
  return {
    status: !Number.isFinite(observedMs) ? 'MISSING' : fresh ? 'CURRENT' : 'STALE',
    stale: !fresh,
    ageMs: Number.isFinite(ageMs) ? ageMs : null,
    basis: 'bar-start-to-computedAt',
    decisionUse: false,
    allowedUse: 'reference'
  };
}

async function _enrichPriceFactors(syms) {
  const computedAt = new Date().toISOString();
  const results = await mapLimit(syms, 5, async (sym) => {
    const rows = await fetchHistory(_yhSym(sym), '1y');
    return {
      sym,
      dates:     (rows || []).map(r => r.date),
      observedAts:(rows || []).map(r => r.observedAt || null),
      closes:    (rows || []).map(r => r.close),
      // Keep adjusted closes separate from raw OHLC. Return/factor/backtest
      // consumers must opt into this series explicitly; a missing adjusted value
      // remains null instead of silently becoming a raw close.
      adjCloses: (rows || []).map(r => (typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) ? r.adjClose : null)),
      highs:     (rows || []).map(r => (typeof r.high === 'number' && Number.isFinite(r.high) ? r.high : null)),
      lows:      (rows || []).map(r => (typeof r.low === 'number' && Number.isFinite(r.low) ? r.low : null)),
      // Preserve unknown volume as null; downstream factor helpers ignore
      // incomplete volume windows instead of treating missing data as zero.
      volumes:   (rows || []).map(r => (typeof r.volume === 'number' && Number.isFinite(r.volume) ? r.volume : null)),
      observedAt:(rows && rows.length && rows[rows.length - 1].observedAt) || null,
      adjustedCloseStatus: (rows || []).length > 0 && (rows || []).every(r => typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) && r.adjClose > 0)
        ? 'complete'
        : (rows || []).some(r => typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) && r.adjClose > 0) ? 'partial' : 'unavailable',
    };
  });
  const data = {};
  let ok = 0;
  for (const r of results) {
    if (!r || r.__error || !r.closes) continue;
    const hasCompleteAdjusted = r.adjustedCloseStatus === 'complete'
      && r.adjCloses && r.adjCloses.length === r.closes.length
      && r.adjCloses.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    // The screener may still expose a raw-price technical snapshot when the
    // provider omits adjusted closes, but it is explicitly partial and never
    // enters the adjusted-close backtest below.
    const factorPriceSeries = hasCompleteAdjusted ? r.adjCloses : r.closes;
    const f = closesToFactors(factorPriceSeries);
    if (f) {
      // v51.68: VCP 패턴 인식 — OHLCV 60봉 이상일 때 계산 (raw close, 조정종가 아님 — 위 주석 참조)
      if (r.closes.length >= 60 && r.highs && r.lows && r.volumes) {
        const vcp = _calcVCPServer(r.closes, r.highs, r.lows, r.volumes);
        if (vcp) { f.vcpScore = vcp.vcpScore; f.vcpStage = vcp.vcpStage; f.vcpPivot = vcp.pivotLevel; }
      }
      const setupFields = _calcSetupScreenFields(
        r.closes,
        hasCompleteAdjusted ? r.adjCloses : r.closes,
        r.highs || [], r.lows || [], r.volumes || []
      );
      if (setupFields) Object.assign(f, setupFields);
      // Yahoo's KR suffix is part of the upstream instrument identifier. Persist
      // the quote currency with the derived price/liquidity fields so consumers
      // never have to infer that a numeric amount is USD.
      f.currency = /\.(KS|KQ)$/i.test(String(r.sym || '')) ? 'KRW' : 'USD';
      f.dollarVolumeCurrency = f.currency;
      f.priceBasis = hasCompleteAdjusted ? 'adjusted-close' : 'raw-close-partial-no-adjusted-series';
      f.adjustedCloseStatus = r.adjustedCloseStatus;
      f.backtestEligible = hasCompleteAdjusted;
      f.observedAt = r.observedAt;
      f.source = hasCompleteAdjusted
        ? 'Yahoo chart 1y adjusted-close history'
        : 'Yahoo chart 1y raw-close history (adjusted-close unavailable)';
      f.sourceKind = 'T3_PUBLIC_DELAYED';
      f.allowedUse = 'research-relative-ranking-only';
      f.allowedUseCeiling = 'reference';
      f.rightsId = 'PUBLIC_REFERENCE';
      f.factorObservedAt = r.observedAt;
      // P1170 (15 D04): barStart와 그 세션 날짜를 분리해 남긴다. factorObservedAt은 호환 필드로
      // 유지하되 'bar-start' basis를 함께 발행해 관측시각으로 읽히지 않게 한다.
      f.factorBarStart = r.observedAt;
      f.factorSessionDate = sessionDateInMarket(r.observedAt, marketOfSymbol(r.sym));
      f.factorSessionTimezone = timeZoneForMarket(marketOfSymbol(r.sym));
      f.factorTimeBasis = 'bar-start';
      f.factorComputedAt = computedAt;
      f.factorSourceKind = 'T3_PUBLIC_DELAYED';
      f.factorAllowedUse = 'research-relative-ranking-only';
      f.factorQuality = deriveFactorQuality({ observedAt: r.observedAt, computedAt });
      data[r.sym] = f; ok++;
    }
  }
  return { data, results, ok, computedAt };
}

// Daily market breadth from the same price history used by the screener factors.
// The former pipeline fetched 800+ histories but left breadth on a manual snapshot/RSP proxy.
// This output is explicitly the AIO screener universe, not official exchange breadth.
export function computeScreenerBreadth(syms, results) {
  const isKr = (sym) => /\.(KS|KQ)$/i.test(String(sym || ''));
  const validRows = (results || []).filter(r => r && !r.__error && Array.isArray(r.adjCloses) && r.adjCloses.length >= 2
    && r.adjustedCloseStatus !== 'unavailable'
    && Number.isFinite(Number(r.adjCloses[r.adjCloses.length - 1]))
    && Number.isFinite(Number(r.adjCloses[r.adjCloses.length - 2])));
  const pct = (n, d) => d > 0 ? round(n / d * 100, 1) : null;
  const meanLast = (arr, n) => {
    if (!Array.isArray(arr) || arr.length < n) return null;
    const values = arr.slice(-n).map(Number);
    return values.every(Number.isFinite) ? _mean(values) : null;
  };

  function buildSegment(id, label, include) {
    const segmentSymbols = (syms || []).filter(include);
    const rows = validRows.filter(r => include(r.sym));
    const counts = { above5:0, eligible5:0, above20:0, eligible20:0, above50:0, eligible50:0, above200:0, eligible200:0 };
    let advances = 0, declines = 0, unchanged = 0;
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
      if (r.observedAt && (!observedAt || new Date(r.observedAt).getTime() > new Date(observedAt).getTime())) observedAt = r.observedAt;
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
      us: buildSegment('us', 'AIO 미국 스크리너 유니버스', sym => !isKr(sym)),
      kr: buildSegment('kr', 'AIO 한국 스크리너 유니버스', sym => isKr(sym)),
    },
  };
}

// Phase 3: 주요 종목 Google News RSS fetch → data[sym].newsMemo 인라인 갱신.
//   prioSyms: 지수/선물/FX/크립토/KR 제외 후 전달. 동시성 3(레이트리밋 방어).
async function _enrichTickerNews(prioSyms, data) {
  const extraSyms = Object.keys(data).filter(s => !prioSyms.includes(s)).slice(0, 60);
  const newsTargets = [...new Set([...prioSyms, ...extraSyms])].slice(0, 90);
  const tickerNewsResults = await mapLimit(newsTargets, 3, async (sym) => {
    const items = await fetchTickerNewsItems(sym, 3);
    return { sym, items, fetchedAt: new Date().toISOString() };
  });
  let ok = 0;
  for (const nr of tickerNewsResults) {
    if (!nr || nr.__error) continue;
    const memo = _fmtTickerNewsMemo(nr.items);
    if (memo && data[nr.sym]) {
      const lineage = deriveTickerNewsLineage(nr.items, nr.fetchedAt);
      data[nr.sym].newsMemo = memo;
      data[nr.sym].newsTs = lineage.newsTs;
      data[nr.sym].newsObservedAt = lineage.newsObservedAt;
      data[nr.sym].newsFetchedAt = lineage.newsFetchedAt;
      ok++;
    }
  }
  return ok;
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
  const secResult = await enrichSecFundamentals(syms, data, results);
  for (const sym in secResult.data) {
    // A screener row represents a successfully derived factor observation. A
    // filing-only row belongs in sec-fundamentals.json, not in this factor map.
    // Injecting it here makes `ok`, row count and factor readiness disagree.
    if (!data[sym]) continue;
    const sec = secResult.data[sym];
    ['pe','pb','roe','margin','revGrowth'].forEach(key => {
      if (typeof data[sym][key] !== 'number' && typeof sec[key] === 'number') data[sym][key] = sec[key];
    });
    if (!data[sym].fundamentalSource) {
      ['fundamentalSource','fundamentalModel','fundamentalPeriod','fundamentalPeriodEnd','fundamentalObservedAt','fundamentalFiledAt','fundamentalFetchedAt','fundamentalAccession','fundamentalSourceKind','fundamentalAllowedUse','fundamentalQuality','fundamentalRightsId','fundamentalUseBlockedReason'].forEach(key => {
        if (sec[key] != null) data[sym][key] = sec[key];
      });
      // 메모리 한정 가격으로 재계산한 pe/pb는 계산 근거(가격·기저·발행주식·관측일)를
      // 행에 함께 남긴다. 발행 아티팩트에 원시가를 기록하지 않는다.
      ['pePrice','pePriceBasis','pbPrice','pbPriceBasis','valuationSharesOutstanding','valuationSharesObservedAt'].forEach(key => {
        if (sec[key] != null) data[sym][key] = sec[key];
      });
    }
  }

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
      universeMeta: universeLineage
    });
  }
  catch (e) { console.warn('[fetch-data] backtest 실패(무시):', e && e.message || e); }
  const breadth = computeScreenerBreadth(syms, results);
  const breadthHistory = computeScreenerBreadthHistory(syms, results);
  const breadthHistoryInfo = await updateScreenerBreadthHistory(breadthHistory);
  const usUniverse = syms.filter(s => !/\.(KS|KQ)$/i.test(s)).length;
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
    breadth,
    breadthHistory: {
      status: breadthHistoryInfo.updated ? 'CURRENT' : 'BLOCKED',
      rows: breadthHistoryInfo.rows,
      artifact: 'public-data/history.json',
      source: 'AIO universe adjusted-close history',
      allowedUse: 'research-history-not-official-exchange'
    },
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
  await atomicWriteFile(SCREENER_OUT, JSON.stringify(payload));
  return { count: ok, universe: syms.length, asOf: payload.asOf, backtestIC: backtest && backtest.ic && backtest.ic.composite, tickerNews: tickerNewsOk, fmpOk: fmpResult.ok > 0, fmpCount: fmpResult.ok, fmpHasKey: fmpResult.hasKey, fmpPlanError: fmpResult.planError, secFundamentalsOk: secResult.ok > 0, secFundamentalsCount: secResult.ok, fundamentalCount, fundamentalCoveragePct };
}

const MARKET_ANALYSIS_QUOTE_DEFS = [
  { symbol: '^GSPC', metricId: 'market.spx', label: 'SPX', unit: 'index', aliases: ['S&P 500'] },
  { symbol: '^VIX', metricId: 'market.vix', label: 'VIX', unit: 'index', aliases: [] },
  { symbol: '^TNX', metricId: 'market.us10y', label: '10Y', unit: 'index', aliases: ['US 10Y', 'Treasury'] },
  { symbol: 'DX-Y.NYB', metricId: 'market.dxy', label: 'DXY', unit: 'index', aliases: [] },
  { symbol: 'CL=F', metricId: 'market.wti', label: 'WTI', unit: 'USD/barrel', aliases: ['oil'] },
  { symbol: 'GC=F', metricId: 'market.gold', label: 'Gold', unit: 'USD/oz', aliases: [] },
  { symbol: '^KS11', metricId: 'market.kospi', label: 'KOSPI', unit: 'index', aliases: [] },
];
const MARKET_ANALYSIS_MACRO_DEFS = [
  { key: 'cpi', metricId: 'macro.cpi', label: 'CPI', unit: 'percent', aliases: [] },
  { key: 'fedRate', metricId: 'macro.fed-rate', label: 'FedRate', unit: 'percent', aliases: ['Fed rate', 'Fed funds'] },
  { key: 'nfp', blsMetricId: 'nonfarmPayroll', metricId: 'macro.nfp-mom', label: 'NFP', unit: 'thousands', aliases: ['nonfarm payroll'] },
];

function _validIsoDate(value) {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
}

export function buildMarketAnalysisEvidence(data, options = {}) {
  const evidence = [];
  // P1093: the narrative's evidence must be derived from the artifact that actually
  // publishes it. `data.quotes` is stripped by toPublicPayload (P715), so a claim
  // built from it cited a quote plane the published data.json no longer contains —
  // and `MARKET_ANALYSIS_QUOTE_DEFS` duplicated unit/metricId values that disagreed
  // with the canonical snapshot (^TNX was `index` here and `percent` in
  // market-snapshot.json). Prefer the canonical snapshot rows so unit, metricId and
  // evidenceId all resolve inside the published artifact.
  const snapshotQuotes = new Map();
  for (const row of (options.snapshot?.quotes || [])) {
    if (row && row.instrumentId) snapshotQuotes.set(row.instrumentId, row);
  }
  const quotes = new Map((data?.quotes || []).filter(row => row && row.symbol).map(row => [row.symbol, row]));
  for (const def of MARKET_ANALYSIS_QUOTE_DEFS) {
    const canonical = snapshotQuotes.get(def.symbol) || null;
    const row = quotes.get(def.symbol);
    const value = Number(canonical ? canonical.value : row?.regularMarketPrice);
    const asOf = _validIsoDate(canonical ? canonical.observedAt : (row?.observedAt || row?.fetchedAt));
    const source = canonical ? canonical.source : row?.source;
    if (!Number.isFinite(value) || !asOf || !source) continue;
    evidence.push({
      evidenceId: canonical?.evidenceId || `market-analysis:${def.symbol}:${asOf}`,
      metricId: def.metricId,
      canonicalMetricId: canonical?.metricId || null,
      label: def.label,
      value,
      unit: canonical?.unit || def.unit,
      observedAt: asOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf,
      source,
      sourceTier: row?.sourceTier || 'unknown',
      sourceKind: (canonical ? canonical.sourceKind : row?.sourceKind) || 'market-quote',
      allowedUse: (canonical ? canonical.allowedUse : row?.allowedUse) || 'reference-only',
      status: 'observed',
    });
  }
  const macro = data?.macro || {};
  for (const def of MARKET_ANALYSIS_MACRO_DEFS) {
    const bls = macro._bls?.series?.[def.blsMetricId || def.key];
    const value = Number(macro[def.key]);
    // A BLS series is eligible for the market-standard CPI evidence slot only
    // when its seasonal-adjustment contract matches the slot.  This prevents
    // a legacy SA CUSR payload from masquerading as the NSA release headline.
    const expectedAdjustment = def.key === 'cpi' || def.key === 'coreCpi' ? 'NSA' : null;
    const blsDefinitionMatches = !expectedAdjustment || String(bls?.seasonalAdjustment || '').toUpperCase() === expectedAdjustment;
    const blsMatchesValue = bls?.status === 'ok' && blsDefinitionMatches && Number.isFinite(Number(bls.value)) && Number(bls.value) === value;
    const asOf = _validIsoDate(blsMatchesValue ? bls.observedAt : macro[`_asOf_${def.key}`]);
    const source = blsMatchesValue ? bls.source : (macro._source === 'fred' ? 'FRED' : null);
    if (!Number.isFinite(value) || !asOf || !source) continue;
    evidence.push({
      evidenceId: `market-analysis:${def.metricId}:${asOf}`,
      metricId: def.metricId,
      label: def.label,
      value,
      unit: def.unit,
      observedAt: asOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf,
      source,
      sourceTier: blsMatchesValue ? (bls.sourceKind || 'T1_OFFICIAL') : 'T1_OFFICIAL',
      sourceKind: blsMatchesValue ? (bls.sourceKind || 'T1_OFFICIAL') : 'T1_OFFICIAL',
      allowedUse: blsMatchesValue ? (bls.allowedUse || 'macro-evidence-with-observation-date') : 'macro-evidence-with-observation-date',
      status: 'observed',
    });
  }
  const fgValue = Number(data?.fearGreed?.score);
  const fgAsOf = _validIsoDate(data?.fearGreed?.asOf);
  if (Number.isFinite(fgValue) && fgAsOf && data?.fearGreed?._source) {
    evidence.push({
      evidenceId: `market-analysis:fear-greed:${fgAsOf}`,
      metricId: 'sentiment.fear-greed',
      label: 'Fear&Greed',
      value: fgValue,
      unit: 'score',
      observedAt: fgAsOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf: fgAsOf,
      source: data.fearGreed._source,
      sourceTier: 'public-api',
      sourceKind: 'public-api',
      allowedUse: 'reference-only',
      status: 'observed',
    });
  }
  return evidence;
}

function _analysisNumberAfterLabel(body, labels) {
  const escaped = labels.map(label => String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = body.match(new RegExp(`(?:${escaped})[^\\d-]{0,18}(-?\\d[\\d,.]*)`, 'i'));
  if (!match) return null;
  const value = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function validateMarketAnalysisText(text, data, snapshot = null) {
  const issues = [];
  // P1122: `warnings` never withholds the analysis; it names what the reader must treat
  // carefully. Blocking is reserved for claims that can be wrong (values, units, scale).
  const warnings = [];
  const value = Number(data?.macro?.nfp);
  const body = String(text || '').trim();
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  if (!body) issues.push('empty');
  if (metricEvidence.length < 2) issues.push('metric-evidence-insufficient');
  // Proximity is an ambiguity signal, not a false number: a correct sentence that lists
  // VIX and Fear & Greed together is not a fabrication. The precise guard is
  // `metric-value-mismatch`, which compares the stated number with its own evidence row.
  if (/(?:VIX[\s\S]{0,60}(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)|(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)[\s\S]{0,60}VIX)/i.test(body)) {
    warnings.push('metric-identity-proximity:vix-vs-fear-greed');
  }
  for (const def of [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]) {
    const row = metricEvidence.find(item => item.metricId === def.metricId);
    if (!row) continue;
    const mentioned = _analysisNumberAfterLabel(body, [def.label, ...(def.aliases || [])]);
    if (mentioned == null) continue;
    // Tolerance follows the unit the evidence actually carries (canonical snapshot
    // unit when available), not the duplicated def table.
    const tolerance = Math.max(row.unit === 'percent' ? 0.15 : 0.5, Math.abs(Number(row.value)) * 0.05);
    if (Math.abs(mentioned - Number(row.value)) > tolerance) issues.push(`metric-value-mismatch:${def.metricId}`);
  }
  // PAYEMS delta is stored in thousands. A model may mention NFP without a
  // number, but if it writes one, reject the known 10x forms before publish.
  if (Number.isFinite(value) && /NFP|nonfarm|비농업|고용/i.test(body)) {
    const abs = Math.abs(value);
    const fmt = (n) => String(Math.round(n * 100) / 100).replace(/\.0+$/, '');
    const wrongTenThousand = new RegExp(`\\b${fmt(abs)}\\s*만(?:명)?`, 'i');
    const wrongThousands = new RegExp(`\\b${fmt(abs * 10)}\\s*(?:천|k)\\b`, 'i');
    const wrongPersons = new RegExp(`\\b${fmt(abs * 10000).replace('.', '[.,]?')}\\s*명?\\b`, 'i');
    if (wrongTenThousand.test(body) || wrongThousands.test(body) || wrongPersons.test(body)) {
      issues.push('nfp-scale-mismatch');
    }
  }
  const nfpMention = _analysisNumberAfterLabel(body, ['NFP', 'nonfarm payroll']);
  if (Number.isFinite(value) && Number.isFinite(nfpMention) && Math.abs(nfpMention) > Math.max(1, Math.abs(value)) * 100) {
    issues.push('nfp-scale-mismatch');
  }
  // P1139/QA-EXHAUST-80: the causal detector was an English word list, so Korean causal prose
  // ("금리 우려 때문입니다") was never recognised as causal and the attribution disclosure below
  // could not fire for the language most of this product's narrative is written in. The Korean
  // branch is a separate regex on purpose: `\b` is ASCII-anchored and never matches around Hangul,
  // so wrapping both languages in one `\b(?:…)\b` would silently disable the Korean half.
  const causalClaimEn = /\b(?:because|due to|driven by|led by|after|following|amid|risk|supports?|weakened|strengthened)\b/i
    .test(body);
  const causalClaimKo = /(?:때문|원인|이유|영향|배경|여파|기인|인해|인한|따른|우려|주도|견인)/.test(body);
  const causalClaim = causalClaimEn || causalClaimKo;
  // P1122: article-level causal evidence is impossible under the declared headline-only
  // rights policy, so its absence is a disclosure, not a refusal. What IS required is
  // attribution — a causal sentence must name the headline it rests on. The value and
  // NFP-scale fabrication checks above stay blocking.
  const causalEvidence = buildMarketAnalysisNewsEvidence(data);
  const headlineContext = buildMarketAnalysisHeadlineContext(data);
  if (causalClaim && causalEvidence.length === 0) {
    const attributed = /헤드라인|보도|기사|언론|according to|headline|reported/i.test(body);
    if (headlineContext.length === 0) warnings.push('causal-evidence-missing');
    else if (!attributed) warnings.push('causal-attribution-missing');
  }
  return {
    ok: issues.length === 0,
    issues: Array.from(new Set(issues)),
    warnings: Array.from(new Set(warnings)),
    metricEvidence,
    causalEvidenceCount: causalEvidence.length,
    headlineCount: headlineContext.length,
  };
}

// v50.48/Phase 4: 선택적 서버 LLM 시장 분석문 생성 (운영자 ANTHROPIC_API_KEY Secret 있을 때만).
//   raw fetch 사용 — Action에 anthropic SDK 의존성 미추가. best-effort: 실패해도 data.json은 정상(클라가 템플릿 합성으로 폴백).
//   Haiku 4.5(최저가). 수집한 시세/매크로/F&G/뉴스 헤드라인으로 간결 프롬프트 → 4~5줄 한국어 분석.
async function genMarketAnalysisLegacy(data) {
  const key = process.env.ANTHROPIC_API_KEY;
  try {
    const metricEvidence = buildMarketAnalysisEvidence(data);
    if (metricEvidence.length < 2) {
      console.warn('[fetch-data] LLM market analysis blocked: insufficient typed metric evidence');
      return null;
    }
  if (!key) return null; // 키 없으면 스킵 — 클라이언트 템플릿이 처리
    const q = {};
    (data.quotes || []).forEach(x => { if (x && x.symbol) q[x.symbol] = x.regularMarketPrice ?? x.price; });
    const newsEvidence = buildMarketAnalysisNewsEvidence(data);
    const heads = newsEvidence.map(n => '- ' + (n.title || '') + ' [' + (n.source || 'unknown') + ' | ' + (n.observedAt || 'unknown') + ']').join('\n');
    const evidenceLines = metricEvidence.slice(0, 16).map(row => `- ${row.metricId} label=${row.label} value=${row.value} unit=${row.unit} asOf=${row.asOf} source=${row.source}`).join('\n');
    const nfp = Number(data.macro?.nfp);
    const nfpUnit = data.macro?._bls?.series?.nonfarmPayroll?.unit || 'thousands';
    const nfpObservedAt = data.macro?._bls?.series?.nonfarmPayroll?.observedAt || data.macro?._asOf_nfp || '—';
    const nfpContext = Number.isFinite(nfp)
      ? `NFP MoM ${nfp} ${nfpUnit} persons (${nfp * 1000}명; observedAt ${nfpObservedAt}; ${nfp}천명을 ${nfp}만명으로 쓰지 말 것)`
      : `NFP ${data.macro?.nfp ?? '—'} ${nfpUnit} persons (observedAt ${nfpObservedAt})`;
    const ctx = [
      `SPX ${q['^GSPC'] ?? '—'} VIX ${q['^VIX'] ?? '—'} 10Y ${q['^TNX'] ?? '—'} DXY ${q['DX-Y.NYB'] ?? '—'} WTI ${q['CL=F'] ?? '—'} Gold ${q['GC=F'] ?? '—'} KOSPI ${q['^KS11'] ?? '—'}`,
      `F&G ${data.fearGreed?.score ?? '—'}`,
      `CPI ${data.macro?.cpi ?? '—'} FedRate ${data.macro?.fedRate ?? '—'} ${nfpContext}`,
      `최근 뉴스 헤드라인:\n${heads || '없음'}`,
    ].join('\n');
    const prompt = `다음 실시간 시장 데이터로 "현재 시장 분석"을 한국어 4~5줄로 작성하라. 객관적·간결·투자 조언 단정 금지. 수치는 위 데이터만 인용(추측 금지). 형식: 한 줄 요약 + ①변동성/심리 ②거시/금리 ③주도 뉴스/리스크.\n\n${ctx}`;
    // 모델 정책: AI 채팅과 동일 — Haiku 기본, "필요할 때"만 Sonnet 승격(Opus 미사용). 승격 조건:
    //   VIX 고변동(≥25) · 지정학/위기 뉴스 헤드라인 · 강제(LLM_MARKET_ANALYSIS_MODEL=sonnet). 그 외 Haiku(저비용).
    const vix = Number(q['^VIX']);
    const crisisNews = /\b(war|conflict|crash|crisis|sanction|invasion|military|선전포고|전쟁|급락|위기|폭락|제재)\b/i.test(heads);
    const force = (process.env.LLM_MARKET_ANALYSIS_MODEL || '').toLowerCase() === 'sonnet';
    const escalate = force || (isFinite(vix) && vix >= 25) || crisisNews;
    const model = escalate ? 'claude-sonnet-4-6' : 'claude-haiku-4-5';
    const enforcedPrompt = prompt + '\n\nTyped metric evidence (mandatory):\n' + evidenceLines + '\nVIX and Fear&Greed are distinct metrics. Preserve metric identity, unit, scale, asOf, and source for every numeric or causal claim.';
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 20000);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: enforcedPrompt }] }),
      signal: ac.signal,
    });
    clearTimeout(to);
    if (!r.ok) { console.warn(`[fetch-data] LLM 분석 생성 실패 HTTP ${r.status} (템플릿 폴백)`); return null; }
    const j = await r.json();
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) return null;
    const semantic = validateMarketAnalysisText(text, data);
    if (!semantic.ok) {
      console.warn(`[fetch-data] LLM 분석 semantic gate 차단: ${semantic.issues.join(',')}`);
      return null;
    }
    const oneLine = text.split('\n').map(s => s.trim()).filter(Boolean)[0] || text.slice(0, 120);
    console.log(`[fetch-data] LLM 분석 생성: ${model}${escalate ? ' (승격: VIX/위기뉴스)' : ' (기본)'}`);
    return { full: text, oneLine, generatedAt: new Date().toISOString(), model, semanticStatus: 'verified', semanticIssues: [], metricEvidence: semantic.metricEvidence, causalEvidenceCount: semantic.causalEvidenceCount };
  } catch (e) { console.warn('[fetch-data] LLM 분석 생성 예외(템플릿 폴백):', e && e.message); return null; }
}

const MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS = new Set(['', 'headline', 'headline-only', 'title-only', 'snippet']);

// P1119 (S9): the news pipeline retains feed headlines and links only. Preserving
// publisher excerpts was rejected on source-rights grounds, so article-level causal
// evidence is never available. P1122 keeps that rights boundary but stops treating its
// absence as a reason to withhold the narrative: directional/causal prose is published
// from the retained headlines plus typed metrics, with explicit attribution and a
// disclosure, instead of being dropped for a body we deliberately never keep.
export const MARKET_ANALYSIS_NEWS_CONTENT_POLICY = Object.freeze({
  schemaVersion: 'news-content-policy.v1',
  retainedDepth: 'headline-only',
  excerptRetention: 'not-permitted-source-rights',
  causalNarrative: 'headline-attributed-with-disclosure',
  rationale: 'RSS feeds grant headline/link reuse only; article bodies are never redistributed. Directional and causal commentary is published from retained headlines and typed metrics with explicit attribution, never as an unsourced assertion.',
});

// Only rows with an explicit non-headline content contract and substantive
// text may support causal/AI market analysis.  RSS title rows deliberately
// remain usable by currentness/discovery surfaces but fail closed here.
// Under MARKET_ANALYSIS_NEWS_CONTENT_POLICY no producer lane sets a non-headline
// depth, so this predicate returns false for every published row by design.
export function isMarketAnalysisNewsEligible(row) {
  const depth = String(row?.contentDepth || '').trim().toLowerCase().replace(/_/g, '-');
  if (MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS.has(depth)) return false;
  const body = String(row?.content || row?.body || row?.description || row?.summary || row?.excerpt || row?.desc || '').trim();
  return body.length >= 40;
}

export function buildMarketAnalysisNewsEvidence(data) {
  const rows = Array.isArray(data?.news) ? data.news : [];
  const clusters = new Set();
  return rows
    .filter(row => row && row.title && row.source && row.link && _validIsoDate(row.eventTime || row.pubDate) && isMarketAnalysisNewsEligible(row))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map(row => {
      const observedAt = _validIsoDate(row.eventTime || row.pubDate);
      const clusterId = String(row.independenceKey || row.source || row.topic || 'unknown').toLowerCase();
      if (clusters.has(clusterId)) return null;
      clusters.add(clusterId);
      return {
        evidenceId: `news:${row.link}:${observedAt}`,
        clusterId,
        title: String(row.title).slice(0, 240),
        source: row.source,
        sourceKind: row.sourceKind || 'news-feed',
        contentDepth: String(row.contentDepth || '').trim(),
        evidenceBasis: 'article-content-or-excerpt',
        observedAt,
        collectedAt: data?.meta?.generatedAt || null,
        link: row.link,
        allowedUse: 'causal-reference',
        status: 'observed',
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

// P1122: retained headlines are not causal evidence, but they are the news material the
// narrative is allowed to cite by name ("헤드라인에 따르면 …"). Keeping them separate from
// `newsEvidence` preserves the rights boundary while giving the model something real to
// attribute instead of forcing an observation-only summary.
export function buildMarketAnalysisHeadlineContext(data) {
  const rows = Array.isArray(data?.news) ? data.news : [];
  const seen = new Set();
  return rows
    .filter(row => row && row.title && row.source && _validIsoDate(row.eventTime || row.pubDate))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .filter(row => {
      const key = String(row.link || row.title).slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map(row => {
      const observedAt = _validIsoDate(row.eventTime || row.pubDate);
      return {
        evidenceId: `headline:${row.link || row.title}:${observedAt}`,
        title: String(row.title).slice(0, 240),
        source: row.source,
        contentDepth: 'headline-only',
        evidenceBasis: 'headline-title',
        observedAt,
        link: row.link || null,
        allowedUse: 'reference',
        status: 'observed',
      };
    });
}

function _marketAnalysisSummary(text) {
  return String(text || '').trim().split(/\n+/).map(line => line.trim()).filter(Boolean).join('\n').slice(0, 2400);
}

function _marketAnalysisOneLine(summary) {
  return String(summary || '').split(/\n+/).map(line => line.trim()).filter(Boolean)[0] || '';
}

function buildStructuredMarketAnalysis({ data, text, model, status, reason, metricEvidence, newsEvidence, semantic }) {
  const evidenceIds = [...metricEvidence, ...newsEvidence].map(row => row.evidenceId);
  const summary = _marketAnalysisSummary(text);
  const oneLine = _marketAnalysisOneLine(summary);
  const claims = summary ? [{
    id: 'market-summary-1',
    text: summary,
    claimType: 'summary',
    evidenceIds,
    status: status === 'verified' ? 'validated' : 'blocked',
  }] : [];
  return {
    schemaVersion: 'market-analysis.v2',
    status,
    summary,
    full: summary,
    oneLine,
    regime: { label: status === 'verified' ? 'MODEL_SUMMARY' : 'UNKNOWN', status, evidenceIds: metricEvidence.map(row => row.evidenceId) },
    drivers: status === 'verified' ? [{ label: 'validated summary drivers', evidenceIds }] : [],
    risks: status === 'verified' ? [{ label: 'validated summary risks', evidenceIds }] : [],
    watch: [{ label: status === 'verified' ? 'monitor cited evidence' : 'await validated market analysis', evidenceIds }],
    claims,
    evidenceIds,
    generatedAt: new Date().toISOString(),
    model: model || 'none',
    validatorVersion: 'market-analysis-validator.v2',
    semanticStatus: semantic?.ok && status === 'verified' ? 'verified' : 'blocked',
    semanticIssues: semantic?.issues || [reason || 'analysis-unavailable'],
    metricEvidence,
    newsEvidence,
    headlineContext: buildMarketAnalysisHeadlineContext(data),
    causalEvidenceCount: semantic?.causalEvidenceCount || 0,
    semanticWarnings: semantic?.warnings || [],
    newsContentPolicy: MARKET_ANALYSIS_NEWS_CONTENT_POLICY,
    // P1122: the narrative is published, but the reader is told what it may and may not
    // rest on and who owns the decision.
    disclosure: status === 'verified'
      ? '헤드라인 제목과 검증된 지표만 사용했습니다. 기사 본문은 출처 권리상 사용하지 않으므로 인과·방향 서술은 헤드라인 귀속 기반의 참고 해석이며, 최종 판단과 책임은 사용자에게 있습니다.'
      : null,
    reason: reason || null,
  };
}

// Reconstruct daily breadth from the same dated adjusted-close rows used by
// the screener. Date alignment is explicit; array position is never used to
// align different securities. This remains AIO-universe research data, not
// official exchange advance/decline data.
export function computeScreenerBreadthHistory(syms, results, maxRows = 252) {
  const symbolSet = new Set(syms || []);
  const buckets = new Map();
  const windows = [20, 50, 200];
  const segmentFor = (sym) => /\.(KS|KQ)$/i.test(String(sym || '')) ? 'kr' : 'us';
  const universe = {
    all: symbolSet.size,
    us: [...symbolSet].filter((sym) => segmentFor(sym) === 'us').length,
    kr: [...symbolSet].filter((sym) => segmentFor(sym) === 'kr').length
  };
  const blank = () => ({ eligible: 0, advances: 0, declines: 0, unchanged: 0, observedAt: null, above: { 20: 0, 50: 0, 200: 0 }, eligibleByWindow: { 20: 0, 50: 0, 200: 0 } });
  const getBucket = (date) => {
    if (!buckets.has(date)) buckets.set(date, { all: blank(), us: blank(), kr: blank() });
    return buckets.get(date);
  };
  const update = (bucket, values, prefix, finitePrefix, index, observedAt) => {
    const value = values[index];
    const previous = values[index - 1];
    if (!Number.isFinite(value) || !Number.isFinite(previous)) return;
    bucket.eligible += 1;
    if (value > previous) bucket.advances += 1;
    else if (value < previous) bucket.declines += 1;
    else bucket.unchanged += 1;
    if (observedAt && (!bucket.observedAt || Date.parse(observedAt) > Date.parse(bucket.observedAt))) bucket.observedAt = observedAt;
    for (const window of windows) {
      if (index + 1 < window) continue;
      if (finitePrefix[index + 1] - finitePrefix[index + 1 - window] !== window) continue;
      const average = (prefix[index + 1] - prefix[index + 1 - window]) / window;
      if (!Number.isFinite(average)) continue;
      bucket.eligibleByWindow[window] += 1;
      if (value > average) bucket.above[window] += 1;
    }
  };

  for (const row of results || []) {
    if (!row || row.__error || !symbolSet.has(row.sym) || !Array.isArray(row.dates) || !Array.isArray(row.adjCloses) || row.dates.length !== row.adjCloses.length) continue;
    const values = row.adjCloses.map((value) => value == null || value === '' ? Number.NaN : Number(value));
    const prefix = [0];
    const finitePrefix = [0];
    for (const value of values) {
      prefix.push(prefix[prefix.length - 1] + (Number.isFinite(value) ? value : 0));
      finitePrefix.push(finitePrefix[finitePrefix.length - 1] + (Number.isFinite(value) ? 1 : 0));
    }
    const market = segmentFor(row.sym);
    for (let index = 1; index < values.length; index += 1) {
      const date = String(row.dates[index] || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const observedAt = row.observedAts?.[index] || `${date}T00:00:00.000Z`;
      const bucket = getBucket(date);
      update(bucket.all, values, prefix, finitePrefix, index, observedAt);
      update(bucket[market], values, prefix, finitePrefix, index, observedAt);
    }
  }

  const pct = (n, d) => d > 0 ? round(n / d * 100, 1) : null;
  const finalize = (bucket, universeSize) => {
    const directional = bucket.advances + bucket.declines;
    return {
      observedAt: bucket.observedAt,
      universe: universeSize,
      eligible: bucket.eligible,
      coveragePct: pct(bucket.eligible, universeSize),
      eligibleByWindow: { ...bucket.eligibleByWindow },
      breadth20: pct(bucket.above[20], bucket.eligibleByWindow[20]),
      breadth50: pct(bucket.above[50], bucket.eligibleByWindow[50]),
      breadth200: pct(bucket.above[200], bucket.eligibleByWindow[200]),
      advanceRatio: directional > 0 ? round(bucket.advances / directional, 4) : null,
      advanceDecline: bucket.advances - bucket.declines,
      advances: bucket.advances,
      declines: bucket.declines,
      unchanged: bucket.unchanged
    };
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-Math.max(60, Number(maxRows) || 252))
    .map(([date, segments]) => ({ date, all: finalize(segments.all, universe.all), us: finalize(segments.us, universe.us), kr: finalize(segments.kr, universe.kr) }));
}

async function updateScreenerBreadthHistory(rows) {
  if (!Array.isArray(rows) || rows.length < 60) return { updated: false, rows: rows?.length || 0 };
  let history = [];
  try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) history = raw; } catch { /* first producer run */ }
  const fetchedAt = new Date().toISOString();
  const fields = ['breadth20', 'breadth50', 'breadth200', 'advanceRatio', 'advanceDecline'];
  for (const point of rows) {
    const segment = point?.us;
    if (!segment || !point?.date) continue;
    let target = history.find((row) => row?.date === point.date);
    if (!target) { target = { date: point.date, fieldMeta: {} }; history.push(target); }
    target.fieldMeta = target.fieldMeta || {};
    for (const field of fields) {
      const window = /^breadth(20|50|200)$/.exec(field)?.[1];
      const eligible = window ? Number(segment.eligibleByWindow?.[window]) : Number(segment.eligible);
      const universe = Number(segment.universe);
      const minimumEligible = Math.max(20, Math.ceil(universe * 0.5));
      const rawValue = segment[field];
      const value = rawValue == null || rawValue === '' ? Number.NaN : Number(rawValue);
      if (!Number.isFinite(value) || !Number.isFinite(eligible) || eligible < minimumEligible) {
        // Keep the column so the row shape stays stable; null plus no fieldMeta
        // is the single spelling of "no observation" (P1101).
        target[field] = null;
        delete target.fieldMeta[field];
        continue;
      }
      target[field] = value;
      target.fieldMeta[field] = {
        observedAt: segment.observedAt || `${point.date}T00:00:00.000Z`,
        fetchedAt,
        lastSuccessfulAt: fetchedAt,
        source: 'AIO US screener universe from Yahoo adjusted-close history',
        sourceKind: 'derived-research',
        allowedUse: 'research-history',
        // P1117: the screener breadth lane writes into the same rows; without these two
        // markers its fields would be the only fieldMeta keys on the latest row that the
        // history artifact gate could not classify.
        observationRelation: 'latest-completed-close',
        observedAtSource: 'derived-from-adjusted-close-series',
        universeScope: 'aio-us-screener-universe-not-official-exchange',
        universe,
        eligible,
        coveragePct: round(eligible / universe * 100, 1)
      };
    }
  }
  history.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  if (history.length > 420) history = history.slice(-420);
  await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(history)));
  return { updated: true, rows: rows.length, totalHistoryRows: history.length };
}

function buildMarketAnalysisFallback(data, reason, metricEvidence = buildMarketAnalysisEvidence(data), newsEvidence = buildMarketAnalysisNewsEvidence(data)) {
  const observed = metricEvidence.slice(0, 4).map(row => `${row.label}=${row.value} ${row.unit} (${row.observedAt})`).join(' · ');
  const summary = observed
    ? `시장 분석 대기: 검증된 관측치만 표시합니다 — ${observed}. 추가 방향성·인과 해석은 유효한 분석 산출물 확인 후 제공됩니다.`
    : '시장 분석 대기: 유효한 관측 증거가 부족해 방향성·인과 해석을 보류합니다.';
  return buildStructuredMarketAnalysis({ data, text: summary, model: 'none', status: 'blocked', reason, metricEvidence, newsEvidence, semantic: { ok: false, issues: [reason], causalEvidenceCount: 0 } });
}

export async function genMarketAnalysis(data, snapshot = null) {
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  const newsEvidence = buildMarketAnalysisNewsEvidence(data);
  if (metricEvidence.length < 2) return buildMarketAnalysisFallback(data, 'metric-evidence-insufficient', metricEvidence, newsEvidence);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return buildMarketAnalysisFallback(data, 'anthropic-key-not-configured', metricEvidence, newsEvidence);
  try {
    const q = {};
    (data.quotes || []).forEach(row => { if (row?.symbol) q[row.symbol] = row.regularMarketPrice ?? row.price; });
    const evidenceLines = metricEvidence.slice(0, 16).map(row => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit} observedAt=${row.observedAt} source=${row.source}`).join('\n');
    const newsLines = newsEvidence.map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    const headlineLines = buildMarketAnalysisHeadlineContext(data).map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    const vix = Number(q['^VIX']);
    const model = vix >= 25 ? 'claude-sonnet-4-6' : 'claude-haiku-4-5';
    const prompt = [
      'Produce a concise Korean market analysis from the typed evidence below.',
      'Every numeric claim must be supported by one or more supplied METRIC_EVIDENCE ids.',
      'Do not merge VIX with Fear&Greed. Do not invent missing values. Return 4-5 concise lines.',
      'METRIC_EVIDENCE:\n' + evidenceLines,
      'NEWS_CLUSTERS (article-level evidence, may be absent):\n' + (newsLines || 'none'),
      'HEADLINE_CONTEXT (retained headlines — titles only; these are the only news material available):\n' + (headlineLines || 'none'),
      'DIRECTIONAL/CAUSAL PROSE: you may offer a directional or causal reading, but attribute it to the named headline ("헤드라인에 따르면", "According to <source>") and present it as one reading among alternatives, never as a confirmed fact. End with what would invalidate the reading and what the reader should check. The final decision belongs to the reader, not to this text.',
    ].join('\n\n');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return buildMarketAnalysisFallback(data, `provider-http-${response.status}`, metricEvidence, newsEvidence);
    const payload = await response.json();
    const text = (payload.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n').trim();
    const semantic = validateMarketAnalysisText(text, data, snapshot);
    if (!text || !semantic.ok) return buildMarketAnalysisFallback(data, semantic.issues.join(','), metricEvidence, newsEvidence);
    return buildStructuredMarketAnalysis({ data, text: semantic.text || text, model, status: 'verified', reason: null, metricEvidence, newsEvidence, semantic });
  } catch (error) {
    return buildMarketAnalysisFallback(data, error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error', metricEvidence, newsEvidence);
  }
}

async function main() {
  const t0 = Date.now();
  console.log(`[fetch-data] ${SYMBOLS.length} 심볼 + FRED + F&G 수집 시작`);

  let previousBls = null;
  let previousBea = null;
  let previousTreasury = null;
  let previousFredHyOas = null;
  let previousFredDexkous = null;
  let previousMacro = null;
  let previousMarketSurveys = null;
  let previousOfficialWebReferences = null;
  let previousFearGreed = null;
  let previousNews = null;
  let previousMeta = null;
  // P1262: `previous`(이전 data.json 전체)는 main 스코프에 둔다 — P1256의 domainReceipt
  // priorReceipt가 이 블록 밖에서 이 값을 읽는데 const를 try 안에 선언해 모든 실행이
  // ReferenceError로 죽었다. 계열 변수와 같은 스코프로 올린다.
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'));
    previousMeta = previous && previous.meta || null;
    previousBls = previous && previous.macro && previous.macro._bls || null;
    previousBea = previous && previous.macro && previous.macro._bea || null;
    previousTreasury = previous && previous.macro && previous.macro._treasury || null;
    previousFredHyOas = previous && previous.macro && previous.macro._fredHyOas || null;
    // P1246: 교차검증 레코드가 공식 원본 레코드를 그대로 보존하므로, 다음 실행은 그 레코드를
    // previous로 받아 12시간 캐시를 재사용한다(별도 아티팩트 없이 lineage가 이어진다).
    previousFredDexkous = previous && previous.providerCrossChecks && previous.providerCrossChecks.fx && previous.providerCrossChecks.fx.official || null;
    previousMacro = previous && previous.macro || null;
    previousMarketSurveys = previous && previous.marketSurveys || null;
    previousOfficialWebReferences = previous && previous.officialWebReferences || null;
    previousFearGreed = previous && previous.fearGreed || null;
    previousNews = previous && Array.isArray(previous.news) ? previous.news : null;
  } catch (_) {}

  // Keep each source plane independently observable.  A single unexpected
  // provider exception must not abort the other free-source collectors or
  // turn a complete cycle into an unlabelled empty artifact.
  const attemptedAt = new Date().toISOString();
  const settled = await Promise.allSettled([
    mapLimit(SYMBOLS, 6, fetchQuote),
    fetchFred(process.env.FRED_API_KEY),
    fetchFearGreed(previousFearGreed),
    fetchNews(),
    fetchCboePutCall(),
    fetchBlsSeries(previousBls),
    fetchBeaPce(previousBea),
    fetchTreasuryYieldCurve(previousTreasury),
    fetchFredHyOasPublic(previousFredHyOas),
    fetchCoinGeckoCrossCheck(),
    fetchAaiiSentiment(previousMarketSurveys?.aaii || null),
    fetchFredDexkousPublic(previousFredDexkous),
  ]);
  const settledValue = (index, fallback, label) => {
    const result = settled[index];
    if (result?.status === 'fulfilled' && result.value != null) return result.value;
    const reason = result?.reason?.message || String(result?.reason || 'unknown-error');
    console.warn(`[fetch-data] ${label} plane failed; preserving other planes: ${reason}`);
    return typeof fallback === 'function' ? fallback(reason) : fallback;
  };
  const quotesRaw = settledValue(0, SYMBOLS.map((symbol) => ({ __error: true, item: symbol, msg: 'quote-plane-failed' })), 'quote');
  const macroRaw = settledValue(1, {
    _source: 'fred:unavailable', _attemptedAt: attemptedAt,
    _successfulSeries: [], _failedSeries: Object.keys(FRED_SERIES),
    _failureReason: 'fred-plane-failed'
  }, 'FRED');
  const fearGreed = settledValue(2, {
    ...(previousFearGreed && typeof previousFearGreed === 'object' ? previousFearGreed : {}),
    _source: previousFearGreed?.score != null ? 'cnn:last-known-good' : 'cnn:unavailable',
    status: previousFearGreed?.score != null ? 'stale-reference' : 'unavailable',
    attemptedAt, fetchedAt: null, failureReason: 'fear-greed-plane-failed'
  }, 'Fear & Greed');
  const news = settledValue(3, previousNews && previousNews.length ? previousNews : [], 'news');
  const putCall = settledValue(4, { source: 'Cboe Daily Market Statistics', sourceKind: 'unavailable', allowedUse: 'none', fetchedAt: null, attemptedAt, totalPutCall: null, error: 'put-call-plane-failed' }, 'Put/Call');
  const bls = settledValue(5, previousBls?.series ? { ...previousBls, status: 'stale', attemptedAt, failureReason: 'bls-plane-failed' } : { status: 'unavailable', attemptedAt, fetchedAt: null, lastSuccessfulAt: null, values: {}, series: {}, failures: [{ metricId: 'batch', reason: 'bls-plane-failed' }] }, 'BLS');
  const bea = settledValue(6, previousBea ? { ...previousBea, status: 'last-known-good', attemptedAt, failureReason: 'bea-plane-failed' } : { status: 'unavailable', attemptedAt, fetchedAt: null, lastSuccessfulAt: null, values: {}, failureReason: 'bea-plane-failed' }, 'BEA');
  const treasury = settledValue(7, previousTreasury?.values ? { ...previousTreasury, status: 'stale', attemptedAt, failureReason: 'treasury-plane-failed' } : { status: 'unavailable', attemptedAt, fetchedAt: null, values: {}, failureReason: 'treasury-plane-failed' }, 'Treasury');
  const fredHyOas = settledValue(8, previousFredHyOas ? { ...previousFredHyOas, status: 'stale', attemptedAt, failureReason: 'fred-hy-oas-plane-failed' } : { status: 'unavailable', attemptedAt, fetchedAt: null, value: null, failureReason: 'fred-hy-oas-plane-failed' }, 'FRED HY OAS');
  const cryptoCrossCheck = settledValue(9, { status: 'unavailable', attemptedAt, fetchedAt: null, quotes: [], reason: 'crypto-cross-check-plane-failed' }, 'crypto cross-check');
  const aaii = settledValue(10, previousMarketSurveys?.aaii ? { ...previousMarketSurveys.aaii, status: 'stale-reference', attemptedAt, failureReason: 'aaii-plane-failed' } : { status: 'unavailable', attemptedAt, fetchedAt: null, observedAt: null, failureReason: 'aaii-plane-failed' }, 'AAII');
  const fredDexkous = settledValue(11, { status: 'unavailable', attemptedAt, fetchedAt: null, value: null, reason: 'fred-dexkous-plane-failed' }, 'FRED DEXKOUS');
  const surveyAttemptedAt = aaii.attemptedAt || new Date().toISOString();
  // `checkedAt` was inherited verbatim from the previous artifact, so it froze at
  // its first value forever while `automatedCheckedAt` advanced: two "checked at"
  // fields with opposite meanings in one object, and the frozen one was the one
  // whose name read as authoritative (P1107). `checkedAt` now means the live
  // automated check; the carried editorial snapshot time keeps its own name.
  const marketSurveys = {
    ...(previousMarketSurveys || {}),
    schemaVersion: 'web-research-surveys.v2',
    checkedAt: surveyAttemptedAt,
    automatedCheckedAt: surveyAttemptedAt,
    webResearchCheckedAt: previousMarketSurveys?.webResearchCheckedAt || previousMarketSurveys?.checkedAt || null,
    policy: previousMarketSurveys?.policy || 'official-publisher-public-web; bounded relay fallback; reference-only; no synthesis',
    aaii
  };
  const macro = mergeMacroLastKnownGood(macroRaw, previousMacro);
  for (const field of Object.keys(FRED_SERIES)) {
    if (Number.isFinite(Number(macroRaw?.[field]))) macro[`_source_${field}`] = 'fred-official-primary';
  }
  Object.assign(macro, bls.values || {});
  // Promote only the successful BLS headline/core fields to the canonical
  // `macro.cpi`/`macro.coreCpi` slots.  Those slots are consumed by the
  // market-standard CPI cards and therefore must be CPI-U NSA, while the
  // explicitly named `blsCpiSaYoY`/`blsCoreCpiSaYoY` values remain available
  // for SA analysis.  A stale BLS last-known-good payload is retained under
  // `_bls` but never silently promoted over the current FRED/previous value.
  const blsFieldPromotions = [
    ['cpi', 'blsCpiYoY'],
    ['coreCpi', 'blsCoreCpiYoY']
  ];
  if (['ok', 'cached-fresh', 'partial'].includes(bls.status)) {
    for (const [macroField, blsField] of blsFieldPromotions) {
      const metricId = macroField;
      const seriesEvidence = bls.series?.[metricId];
      const value = Number(bls.values?.[blsField]);
      if (seriesEvidence?.status !== 'ok' || !Number.isFinite(value)) continue;
      macro[macroField] = value;
      macro[`_asOf_${macroField}`] = seriesEvidence.observedAt || null;
      macro[`_source_${macroField}`] = 'bls-official-primary';
    }
  }
  macro._bls = bls;
  macro._bea = bea;
  macro._treasury = treasury;
  macro._fredHyOas = fredHyOas;
  if (['ok', 'cached-fresh'].includes(fredHyOas.status) && Number.isFinite(Number(fredHyOas.value))) {
    const currentObservedAt = String(macro._asOf_hyOAS || '');
    if (!currentObservedAt || String(fredHyOas.observedAt || '') >= currentObservedAt) {
      macro.hyOAS = Number(fredHyOas.value);
      macro._asOf_hyOAS = fredHyOas.observedAt;
      macro._source_hyOAS = 'fred-official-public-csv';
    }
  }
  if (['ok', 'cached-fresh'].includes(treasury.status) && treasury.values) {
    for (const field of ['dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30', 't10y2y']) {
      if (!Number.isFinite(Number(treasury.values[field]))) continue;
      macro[field] = Number(treasury.values[field]);
      macro[`_asOf_${field}`] = treasury.observedAt;
      macro[`_source_${field}`] = 'us-treasury-official-primary';
    }
  }
  if (bea.status === 'ok' && bea.values) {
    if (Number.isFinite(bea.values.pce)) {
      macro.pce = bea.values.pce;
      macro._asOf_pce = bea.observedAt;
      macro._source_pce = 'bea-official-primary';
    }
    if (Number.isFinite(bea.values.corePce)) {
      macro.corePce = bea.values.corePce;
      macro._asOf_corePce = bea.observedAt;
      macro._source_corePce = 'bea-official-primary';
    }
  }

  // v50.99: 검증 패스 — 의심 항목 재시도 후 최종 확정
  const pass1 = quotesRaw.filter(q => _quoteOk(q));
  const toRetry = quotesRaw.filter(q => !_quoteOk(q)).map(q => q && q.symbol ? q.symbol : (q && q.item)).filter(Boolean);
  let pass2 = [];
  if (toRetry.length) {
    console.log(`[fetch-data] verify-retry: ${toRetry.length}개 재시도 (에러 또는 비정상 변동폭): ${toRetry.join(',')}`);
    const retried = await mapLimit(toRetry, 3, sym => fetchQuote(sym).catch(() => ({ __error: true, item: sym })));
    pass2 = retried.filter(q => _quoteOk(q));
    console.log(`[fetch-data] verify-result: ${pass2.length}/${toRetry.length} 복구`);
  }
  // v51.92/Phase 2 [B1]: Yahoo가 (호스트 폴백 + verify-retry까지) 전부 실패한 핵심 ETF에
  // 한해 Twelve Data로 2차 폴백. TWELVE_DATA_API_KEY 미등록 시 완전 무동작(FRED/FMP와 동일 패턴).
  const yahooFailed = toRetry.filter(s => !pass2.find(q => q && q.symbol === s));
  const tdApiKey = process.env.TWELVE_DATA_API_KEY;
  const tdEligible = yahooFailed.filter(s => TWELVE_DATA_ETF_FALLBACK_SYMBOLS.has(s));
  let pass3 = [];
  if (tdApiKey && tdEligible.length) {
    console.log(`[fetch-data] twelvedata-fallback: ${tdEligible.length}개 시도 (Yahoo 전부 실패한 핵심 ETF): ${tdEligible.join(',')}`);
    const tdResults = await mapLimit(tdEligible, 3, sym => fetchQuoteTwelveData(sym, tdApiKey).catch(e => ({ __error: true, item: sym, msg: String(e && e.message || e) })));
    pass3 = tdResults.filter(q => _quoteOk(q));
    console.log(`[fetch-data] twelvedata-result: ${pass3.length}/${tdEligible.length} 복구`);
  } else if (!tdApiKey && yahooFailed.length) {
    console.warn('[fetch-data] 경고: TWELVE_DATA_API_KEY GitHub Secret 미등록 — 핵심 ETF Yahoo 실패 시 2차 폴백 비활성.');
  }

  const quotes = [...pass1, ...pass2, ...pass3];
  const failed = yahooFailed.filter(s => !pass3.find(q => q && q.symbol === s));

  // v50.24/WO-1: F&G·FRED 실패를 meta에 노출(이전엔 조용히 통과). 사이트 나이 배지/감사가 surfacing.
  // v50.78: fredHasKey(Secret 등록 여부) / fredFetchOk(실제 데이터 수신 여부) 세분화.
  //   fredHasKey=false → GitHub Secrets 미등록. fredHasKey=true && fredFetchOk=false → 키 있으나 API 실패.
  const macroKeys = Object.keys(macro).filter(k => k[0] !== '_');
  const fredExpectedSeries = Object.keys(FRED_SERIES);
  const fearGreedOk = fearGreed?.status !== 'stale-reference'
    && fearGreed?.status !== 'unavailable'
    && typeof fearGreed?.score === 'number' && isFinite(fearGreed.score);
  const fredHasKey = !!process.env.FRED_API_KEY;
  // A FRED cycle is successful only when every configured series has a finite
  // value. Partial responses remain usable through per-field LKG merge, but
  // the cycle cannot claim a fresh aggregate timestamp.
  const fredCycle = deriveFredCycle({ configured: fredHasKey, expected: fredExpectedSeries,
    current: macroRaw || {}, previous: previousMacro || {}, previousMeta: previousMeta || {}, attemptedAt });
  const fredFetchedKeys = fredCycle.successful;
  const fredFailedSeries = fredCycle.failed;
  const fredFetchOk = fredCycle.complete;
  const fredLkgUsed = fredCycle.lkgUsed;
  const fredLkgSource = fredLkgUsed ? 'previous-public-data-macro' : null;
  const fredStatus = fredCycle.status;
  const newsScores = Array.isArray(news) ? news.map(n => Number(n.score)).filter(n => isFinite(n)) : [];
  const newsCycle = getKst0800NewsCycle();
  const fredOk = fredFetchOk; // 하위 호환 유지
  const generatedAt = attemptedAt;

  // P1256 (E5 O06 / 17 작업 단위 1): 도메인별 수집 결과를 receipt로 남긴다 — exit code나
  // generatedAt은 수집 성공이 아니다. 이번 batch가 갱신했는가와 기존 적격값이 그대로 발행되는가는
  // 다른 축이며, 소비자(build-operations-status)는 그 구분을 사용자 언어로 바꾼다.
  const priorReceipts = (previous && previous.meta && previous.meta.domainReceipts) || {};
  const receiptRunId = `fetch-data:${attemptedAt}`;
  const planeReceipt = (domain, { eligible, attempted, updated, stored, failures = [], note }) => buildDomainReceipt({
    domain,
    runId: receiptRunId,
    attemptedAt,
    sourceRevision: null,
    inputWatermarks: { generatedAt },
    eligible,
    attempted,
    updated,
    stored,
    failures,
    priorReceipt: priorReceipts[domain] || null,
    basisNote: note || 'per-plane independent collection; retained eligible values stay published while a failed refresh keeps the previous artifact'
  });
  const newsFellBack = Array.isArray(previousNews) && news === previousNews;
  const fredSeriesIds = fredExpectedSeries;
  const blsSeriesIds = Object.keys((bls && bls.series) || {});
  const blsFresh = ['ok', 'cached-fresh', 'partial'].includes(bls && bls.status);
  const beaFresh = ['ok', 'cached-fresh'].includes(bea && bea.status);
  const treasuryFresh = ['ok', 'cached-fresh'].includes(treasury && treasury.status);
  const aaiiFresh = ['ok', 'cached-fresh'].includes(aaii && aaii.status);
  const putCallFresh = !!(putCall && !putCall.error && putCall.fetchedAt);
  const domainReceipts = {
    'market-quotes': planeReceipt('market-quotes', {
      eligible: SYMBOLS.length, attempted: SYMBOLS.length, updated: quotes.length, stored: quotes.length,
      failures: failed.map((symbol) => ({ symbol, status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    news: planeReceipt('news', {
      eligible: NEWS_FEEDS.length, attempted: NEWS_FEEDS.length,
      updated: newsFellBack ? 0 : (Array.isArray(news) ? news.length : 0),
      stored: Array.isArray(news) ? news.length : 0,
      failures: newsFellBack ? [{ symbol: 'news-plane', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }] : []
    }),
    'macro-fred': planeReceipt('macro-fred', {
      eligible: fredSeriesIds.length, attempted: fredSeriesIds.length,
      updated: fredFetchedKeys.length, stored: fredSeriesIds.length,
      failures: fredFailedSeries.map((id) => ({ symbol: id, status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    'macro-bls': planeReceipt('macro-bls', {
      eligible: blsSeriesIds.length + (bls && Array.isArray(bls.failures) ? bls.failures.filter((row) => row && row.metricId && row.metricId !== 'batch').length : 0),
      attempted: blsSeriesIds.length + (bls && Array.isArray(bls.failures) ? bls.failures.filter((row) => row && row.metricId && row.metricId !== 'batch').length : 0),
      updated: blsFresh ? blsSeriesIds.length : 0,
      stored: blsSeriesIds.length,
      failures: (bls && Array.isArray(bls.failures) ? bls.failures : []).map((row) => ({ symbol: row.metricId || 'batch', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    'macro-bea': planeReceipt('macro-bea', {
      eligible: 1, attempted: 1, updated: beaFresh ? 1 : 0,
      stored: (beaFresh || (bea && bea.status === 'last-known-good')) ? 1 : 0,
      failures: beaFresh ? [] : [{ symbol: 'bea-pce', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }]
    }),
    'treasury-curve': planeReceipt('treasury-curve', {
      eligible: 1, attempted: 1, updated: treasuryFresh ? 1 : 0,
      stored: (treasuryFresh || (treasury && treasury.status === 'stale')) ? 1 : 0,
      failures: treasuryFresh ? [] : [{ symbol: 'treasury-yield-curve', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }]
    }),
    'surveys-aaii': planeReceipt('surveys-aaii', {
      eligible: 1, attempted: 1, updated: aaiiFresh ? 1 : 0,
      stored: (aaiiFresh || (aaii && aaii.observedAt)) ? 1 : 0,
      failures: aaiiFresh ? [] : [{ symbol: 'aaii-sentiment', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }]
    }),
    'options-put-call': planeReceipt('options-put-call', {
      eligible: 1, attempted: 1, updated: putCallFresh ? 1 : 0,
      stored: (putCallFresh || (putCall && Number.isFinite(Number(putCall.totalPutCall)))) ? 1 : 0,
      failures: putCallFresh ? [] : [{ symbol: 'cboe-put-call', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }]
    })
  };

  const data = {
    meta: {
      generatedAt,
      source: 'github-actions',
      symbolsOk: quotes.length,
      symbolsFail: failed.length,
      failedSymbols: failed,
      // P1256: 도메인별 수집 receipt — "새 수집 성공"과 "기존값 유지"의 구분이 여기서 생긴다.
      domainReceipts,
      verifyStats: { pass1: pass1.length, retried: toRetry.length, recovered: pass2.length, failed: failed.length },
      tdHasKey: !!tdApiKey,
      tdFallbackEligible: tdEligible.length,
      tdFallbackRecovered: pass3.length,
      fearGreedOk,
      fredHasKey,
      fredFetchOk,
      fredOk,
      fredLkgUsed,
      fredLkgSource,
      macroKeyCount: macroKeys.length,
      fredFetchedKeyCount: fredFetchedKeys.length,
      fredAttemptedAt: macroRaw?._attemptedAt || generatedAt,
      fredLastSuccessfulAt: fredCycle.lastSuccessfulAt,
      fredStatus,
      fredExpectedSeriesCount: fredExpectedSeries.length,
      fredSuccessfulSeries: fredFetchedKeys,
      fredFailedSeries,
      blsStatus: bls.status,
      blsSeriesCount: Object.keys(bls.values || {}).length,
      blsFailedSeries: (bls.failures || []).map(row => row.metricId),
      blsAttemptedAt: bls.attemptedAt || null,
      blsLastSuccessfulAt: bls.lastSuccessfulAt || null,
      beaStatus: bea.status,
      beaAttemptedAt: bea.attemptedAt || null,
      beaLastSuccessfulAt: bea.lastSuccessfulAt || null,
      beaReleaseAt: bea.releasedAt || null,
      beaNextReleaseAt: bea.nextReleaseAt || null,
      treasuryStatus: treasury.status,
      treasuryAttemptedAt: treasury.attemptedAt || null,
      treasuryLastSuccessfulAt: ['ok', 'cached-fresh'].includes(treasury.status) ? treasury.fetchedAt : null,
      treasuryObservedAt: treasury.observedAt || null,
      aaiiStatus: aaii.status,
      aaiiAttemptedAt: aaii.attemptedAt || null,
      aaiiFetchedAt: aaii.fetchedAt || null,
      aaiiObservedAt: aaii.observedAt || null,
      aaiiRelayUsed: !!aaii.relayUrl,
      fredHyOasStatus: fredHyOas.status,
      fredHyOasAttemptedAt: fredHyOas.attemptedAt || null,
      fredHyOasLastSuccessfulAt: ['ok', 'cached-fresh'].includes(fredHyOas.status) ? fredHyOas.fetchedAt : null,
      fredHyOasObservedAt: fredHyOas.observedAt || null,
      newsOk: Array.isArray(news) && news.length > 0,
      newsCount: Array.isArray(news) ? news.length : 0,
      // `newsSourceCount` used to publish NEWS_FEEDS.length (the number of search
      // feeds) under a name that reads as the number of publishers, while the
      // retained items carry ~29 distinct outlets (P1097). Publish both numbers
      // under names that say which population they count.
      newsFeedCount: NEWS_FEEDS.length,
      newsPublisherCount: new Set((Array.isArray(news) ? news : []).map(item => item && item.source).filter(Boolean)).size,
      newsCyclePolicy: newsCycle.policy,
      newsCycleStart: newsCycle.start,
      newsCycleEnd: newsCycle.end,
      newsCycleLabel: newsCycle.label,
      newsNextRefresh: newsCycle.nextRefresh,
      serverNewsScored: true,
      newsScoreMin: newsScores.length ? Math.min(...newsScores) : null,
      newsScoreMax: newsScores.length ? Math.max(...newsScores) : null,
      putCallOk: putCall && Number.isFinite(putCall.totalPutCall),
      putCallAsOf: putCall && putCall.asOf || null,
      marketSurveysStatus: marketSurveys ? 'web-research-captured-reference' : null,
      marketSurveysCheckedAt: marketSurveys?.checkedAt || null,
      marketSurveysWebResearchCheckedAt: marketSurveys?.webResearchCheckedAt || null,
      elapsedMs: Date.now() - t0,
      // `generatedAt` is the payload/attempt clock for macro/news planes. Keep
      // market publication lineage in separate fields; a failed publish must
      // never be read as a fresh LKG market observation.
      attemptedAt,
      artifactGeneratedAt: generatedAt,
      schema: 1,
    },
    quotes,
    macro,
    fearGreed,
    putCall,
    providerCrossChecks: { crypto: cryptoCrossCheck },
    // AAII is refreshed server-side from its official public table, with a
    // bounded text-relay fallback when publisher anti-bot policy blocks direct
    // automation. Subscriber-only surveys remain preserved/blocked and no
    // missing percentage is synthesized.
    marketSurveys,
    officialWebReferences: previousOfficialWebReferences,
    news,
  };

  if (fredHasKey && !fredFetchOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키 유효성/레이트리밋 확인');
  // P565/R256: fredFetchOk only requires macroKeys.length > 0, so a partial failure (e.g. 6 of
  // 9 series succeed) previously passed this check silently — the exact mechanism that let
  // individual stale/broken series (Fed/BOJ/BOK/BOE rates) go unnoticed for weeks.
  if (fredHasKey && fredFailedSeries.length > 0) console.warn(`[fetch-data] 경고: FRED 시리즈 ${fredFailedSeries.length}건 실패 — ${fredFailedSeries.join(', ')}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[fetch-data] 경고: ANTHROPIC_API_KEY 미등록 — AI 분석 비활성. 클라이언트 템플릿 폴백 사용.');

  // Fail closed before touching the last-known-good public artifact. A transient
  // provider/network outage must never replace data.json with an empty payload.
  const minimumQuoteCount = Math.ceil(SYMBOLS.length * 0.5);
  if (quotes.length < minimumQuoteCount) {
    throw new Error(`CORE_QUOTE_COVERAGE_FAILED:${quotes.length}/${SYMBOLS.length}; existing data.json preserved`);
  }

  // AR-07 Batch 0: publish the bounded Tier 0 fallback independently of the
  // public data.json quote policy. A failed Tier 0 gate retains the previous
  // snapshot and records the failed attempt in its status sidecar.
  const marketSnapshotInfo = await publishMarketSnapshot({
    quotes,
    attemptedAt: data.meta.generatedAt,
    source: 'github-actions:fetch-data'
  });
  // publishMarketSnapshot deliberately returns the failed attempt alongside a
  // retainedRevision. Do not pass that failed attempt to history/reconciliation
  // consumers: load the actual on-disk LKG snapshot when publication is
  // blocked, and keep the attempt lineage in separate metadata fields.
  let marketSnapshotForConsumers = marketSnapshotInfo.published ? marketSnapshotInfo.snapshot : null;
  if (!marketSnapshotForConsumers && marketSnapshotInfo.retainedRevision) {
    try { marketSnapshotForConsumers = JSON.parse(await readFile(MARKET_SNAPSHOT_OUT, 'utf8')); }
    catch (_) { marketSnapshotForConsumers = null; }
  }
  const marketSnapshotAttemptRevision = marketSnapshotInfo.snapshot.revision || null;
  const marketSnapshotPublishedRevision = marketSnapshotForConsumers?.revision || marketSnapshotInfo.retainedRevision || null;

  // v50.48/Phase 4: 선택적 서버 LLM 분석문 (키 있을 때만; 실패해도 data.json 정상 — 클라 템플릿 폴백)
  // P1093: this runs AFTER the canonical snapshot is resolved, because the narrative's
  // evidence must be sourced from the published snapshot (unit/metricId/evidenceId)
  // rather than from `data.quotes`, which toPublicPayload strips before publishing.
  const marketAnalysis = await genMarketAnalysis(data, marketSnapshotForConsumers);
  if (marketAnalysis) {
    data.marketAnalysis = marketAnalysis;
    data.meta.marketAnalysisOk = marketAnalysis.status === 'verified';
    data.meta.marketAnalysisSemanticOk = marketAnalysis.status === 'verified' && marketAnalysis.semanticStatus === 'verified' && Array.isArray(marketAnalysis.metricEvidence) && marketAnalysis.metricEvidence.length >= 2 && (!marketAnalysis.semanticIssues || marketAnalysis.semanticIssues.length === 0);
    data.meta.marketAnalysisEvidenceCount = Array.isArray(marketAnalysis.metricEvidence) ? marketAnalysis.metricEvidence.length : 0;
    data.meta.marketAnalysisNewsEvidenceCount = Array.isArray(marketAnalysis.newsEvidence) ? marketAnalysis.newsEvidence.length : 0;
  } else {
    data.meta.marketAnalysisOk = false;
    data.meta.marketAnalysisSemanticOk = false;
    data.meta.marketAnalysisEvidenceCount = 0;
    data.meta.marketAnalysisNewsEvidenceCount = 0;
  }
  data.meta.marketSnapshotPublished = !!marketSnapshotInfo.published;
  data.meta.marketSnapshotAttemptedAt = marketSnapshotInfo.snapshot.attemptedAt || data.meta.attemptedAt;
  data.meta.marketSnapshotPublishedAt = marketSnapshotInfo.published ? marketSnapshotInfo.snapshot.generatedAt : null;
  data.meta.marketSnapshotAttemptRevision = marketSnapshotAttemptRevision;
  data.meta.marketSnapshotLastSuccessfulAt = marketSnapshotForConsumers?.generatedAt || null;
  data.meta.marketSnapshotCoverage = {
    ...(marketSnapshotInfo.coverage || {}),
    tier0Required: Number(marketSnapshotInfo.coverage?.tier0Required ?? marketSnapshotInfo.coverage?.required ?? 0),
    tier0Observed: Number(marketSnapshotInfo.coverage?.tier0Observed ?? marketSnapshotInfo.coverage?.observed ?? 0)
  };
  data.meta.marketSnapshotRevision = marketSnapshotPublishedRevision;
  const cycleId = `kst-0800-${data.meta.newsCycleEnd}`;
  data.meta.cycleId = cycleId;
  data.meta.cycleStatus = 'PENDING';
  data.meta.marketCycleFreshnessSlaHours = 12;
  data.meta.cycleComponents = {
    marketSnapshotRevision:marketSnapshotPublishedRevision,
    marketSnapshotPublished:!!marketSnapshotInfo.published,
    quoteCount:quotes.length,
    requiredQuoteCount:SYMBOLS.length,
    newsGeneratedAt:data.meta.generatedAt,
    newsCount:data.meta.newsCount,
    minimumNewsCount:MINIMUM_CURRENT_NEWS,
    historyCycleEnd:data.meta.newsCycleEnd,
    historyUpdated:false,
    telegramDigestExpected:true,
  };
  data.meta.cycleManifestRevision = `${cycleId}:${marketSnapshotInfo.published ? marketSnapshotPublishedRevision || 'published-unknown' : 'unpublished:' + (marketSnapshotAttemptRevision || 'unknown')}`;
  data.meta.cycleManifestAttemptRevision = marketSnapshotAttemptRevision;

  await mkdir(dirname(OUT), { recursive: true });
  // P715 (사용자 결정 "클라이언트 직접 fetch 전환"): 공개 data.json에서 종목별 시세 재배포를
  // 중단한다 — quotes는 내부 파생(히스토리 append·분석 프롬프트·건강도 카운트)에만 사용하고
  // 발행 아티팩트에는 빈 배열로 담는다(소비자 배열 형태 계약 보존). meta.symbolsOk는
  // "수집 파이프라인 건강도" 의미로 유지되어 워치독 floor(<70) 계약이 그대로 동작한다.
  // P719: OUT에 쓰는 모든 경로는 반드시 이 헬퍼를 거친다 — 첫 발행 후 meta 후기록 재기록(아래
  // scrInfo 반영)이 스트립 안 된 원본 `data`를 그대로 써서 P715 계약을 덮어쓴 라이브 사고의 재발 방지.
  const toPublicPayload = (d) => ({
    ...d,
    quotes: [],
    meta: { ...d.meta, quotesPublished: false, quotePolicy: 'client-direct-fetch-only(P715)' }
  });
  await atomicWriteFile(OUT, JSON.stringify(toPublicPayload(data), null, 1));
  // WO-7 (ops): 일별 히스토리 누적 (충분한 데이터일 때만 — 아래 <50% 가드와 별개로 핵심 심볼 존재 시)
  const histInfo = await updateHistory(data, marketSnapshotForConsumers, fredDexkous);
  // P1246: FX 교차검증 — 히스토리 레인이 기록한 **공식 관측일과 같은 날짜**의 완료 종가를 공식
  // DEXKOUS와 비교해 **상태만** 발행한다. 값 출처는 바뀌지 않는다(providerCrossChecks는 참조 면이다).
  // 히스토리 레인이 통째로 실패해도 판정 불가 레코드를 남긴다 — 교차검증의 부재를 성공으로 읽지 않는다.
  if (data.providerCrossChecks) {
    data.providerCrossChecks.fx = histInfo?.fxCrossCheck
      || compareUsdKrwCrossCheck({ provider: null, official: fredDexkous, attemptedAt });
  }
  const cyclePublication = deriveCyclePublication({
    marketSnapshotPublished: !!marketSnapshotInfo.published,
    quoteCount: quotes.length,
    requiredQuoteCount: SYMBOLS.length,
    newsCount: data.meta.newsCount,
    historyUpdated: !!histInfo
  });
  data.meta.cycleStatus = cyclePublication.status;
  data.meta.cycleBlockers = [...cyclePublication.blockers];
  data.meta.cycleComponents = {
    ...data.meta.cycleComponents,
    ...cyclePublication.components,
    historyCycleEnd:data.meta.newsCycleEnd
  };
  // Phase 3 [C3] P599: computeTradingScore 재구성 검증 하네스 — history.json이 방금 갱신됐으니
  // 그 최신 상태로 재실행(순수 함수, 네트워크 호출 없음, history.json만 읽고 자체 산출물에만 씀).
  let scoreBacktestInfo = null;
  try { scoreBacktestInfo = await runTradingScoreBacktest(HIST, `${__dir}/../public-data/score-backtest-history.json`); }
  catch (e) { console.warn('[fetch-data] trading-score backtest 실패(무시):', e && e.message || e); }
  if (scoreBacktestInfo) console.log(`[fetch-data] score backtest: ${scoreBacktestInfo.records.length}건 누적, summary=${JSON.stringify(scoreBacktestInfo.summary)}`);
  // Screener is a separate six-hour workflow. The 30-minute core job never
  // downloads 870 one-year histories or writes screener.json.
  let scrInfo = null;
  try {
    const existing = JSON.parse(await readFile(SCREENER_OUT, 'utf8'));
    scrInfo = {
      skipped: true,
      count: Object.keys(existing.data || {}).length,
      universe: existing.universe || 0,
      fmpHasKey: existing.fmpHasKey,
      fmpOk: existing.fmpOk,
      fmpCount: existing.fmpCount || 0,
      fmpPlanError: existing.fmpPlanError,
      secFundamentalsOk: existing.secFundamentalsOk,
      secFundamentalsCount: existing.secFundamentalsCount || 0,
      fundamentalCoveragePct: existing.fundamentalCoveragePct || 0
    };
  } catch (e) { console.warn('[fetch-data] 기존 screener 상태 읽기 실패:', e && e.message || e); }

  // FMP 상태를 data.meta에 후기록 (screener 실행 결과 반영)
  if (scrInfo && !scrInfo.skipped) {
    data.meta.fmpHasKey = !!scrInfo.fmpHasKey;
    data.meta.fmpOk = !!scrInfo.fmpOk;
    data.meta.fmpCount = scrInfo.fmpCount || 0;
    data.meta.fmpPlanError = !!scrInfo.fmpPlanError;
    if (scrInfo.fmpHasKey && !scrInfo.fmpOk) {
      if (scrInfo.fmpPlanError) console.warn('[fetch-data] FMP: 키 등록됨 → HTTP 403/401 — 플랜이 ratios-ttm을 지원하지 않습니다. Starter($14.99/월) 이상 필요.');
      else console.warn('[fetch-data] FMP: 키 등록됨 → 0건 enriched — API 오류 또는 모든 심볼 실패.');
    }
  } else {
    data.meta.fmpHasKey = !!process.env.FMP_API_KEY;
  }
  if (scrInfo) {
    data.meta.secFundamentalsOk = !!scrInfo.secFundamentalsOk;
    data.meta.secFundamentalsCount = scrInfo.secFundamentalsCount || 0;
    data.meta.fundamentalCoveragePct = scrInfo.fundamentalCoveragePct || 0;
  }
  const reconciliationStatus = await writeReconciliationStatus({ data, marketSnapshot: marketSnapshotForConsumers });
  await writeOperationsStatus({ data, marketSnapshot: marketSnapshotForConsumers, reconciliation: reconciliationStatus });

  // scrInfo 반영 후 data.json 재기록 (fmpHasKey 등 meta 업데이트) — P719: 반드시 스트립 경유
  await atomicWriteFile(OUT, JSON.stringify(toPublicPayload(data), null, 1));

  // P719 read-back 계약 검증: 마지막으로 디스크에 남은 발행본이 P715 계약(quotes=[],
  // quotesPublished:false)을 만족하는지 실제 파일로 확인. 위반이면 커밋 전에 워크플로가 죽는다.
  {
    const published = JSON.parse(await readFile(OUT, 'utf8'));
    if ((Array.isArray(published.quotes) && published.quotes.length > 0) || published.meta?.quotesPublished !== false) {
      throw new Error(`P715_QUOTE_CONTRACT_VIOLATION: published quotes=${published.quotes?.length}, quotesPublished=${published.meta?.quotesPublished}`);
    }
  }

  const fmpSummary = scrInfo && !scrInfo.skipped
    ? `hasKey=${scrInfo.fmpHasKey} ok=${scrInfo.fmpOk} count=${scrInfo.fmpCount || 0}${scrInfo.fmpPlanError ? ' ⚠PLAN_ERROR' : ''}`
    : `hasKey=${!!process.env.FMP_API_KEY} (screener skipped)`;
  console.log(`[fetch-data] 완료: quotes ${quotes.length}/${SYMBOLS.length} [verify: 1차ok=${pass1.length} retry=${toRetry.length} 복구=${pass2.length} 최종실패=${failed.length}], macro keys ${Object.keys(macro).length}, F&G ${fearGreed.score ?? 'fail'}, news ${data.meta.newsCount}, history ${histInfo ? histInfo.days + 'd(' + histInfo.upsert + (histInfo.backfilled ? ',+' + histInfo.backfilled + 'bf' : '') + ')' : 'skip'}, fx ${data.providerCrossChecks?.fx?.status || 'n/a'}, screener ${scrInfo ? (scrInfo.skipped ? 'skip(' + scrInfo.count + ')' : scrInfo.count + '/' + scrInfo.universe + (scrInfo.tickerNews != null ? ' tickerNews=' + scrInfo.tickerNews : '')) : 'n/a'}, FMP ${fmpSummary}, ${data.meta.elapsedMs}ms`);

}

/**
 * P1192 (P1095 권위): 한 행의 완료 컷을 넘는 `previous-completed-close` 스탬프를 직전 bar 경계로
 * 되돌린다. Yahoo는 진행 중 bar를 그 bar의 개시 시각으로 스탬프하는데, FX/상품 일봉 경계(00:00Z)가
 * KST-08:00 뉴스 컷(23:00Z)보다 뒤라 그 경계가 컷을 넘는다. 값은 **실제 완료 종가**이므로 버리지
 * 않고 bar 경계로 앉히고, 그마저 컷을 넘으면 값을 싣지 않는다 — 컷을 늘리거나 시각만 바꾸는 위장은
 * 두 게이트(P1095·history-time)가 동시에 금지한다. `bySym`/`bySymQuote`를 제자리에서 고친다.
 */
export function boundPreviousCloseToCut({ bySym, bySymQuote, cycleEnd } = {}) {
  const cutMs = Date.parse(cycleEnd);
  const adjusted = [];
  const dropped = [];
  for (const [sym, quote] of Object.entries(bySymQuote || {})) {
    if (!quote || quote.observationRelation !== 'previous-completed-close') continue;
    const stamp = Date.parse(quote.observedAt || '');
    if (!Number.isFinite(stamp) || !Number.isFinite(cutMs) || stamp <= cutMs) continue;
    const fallback = quote.previousBarOpenedAt || null;
    if (!fallback || !(Date.parse(fallback) <= cutMs)) {
      if (bySym) bySym[sym] = null;
      delete bySymQuote[sym];
      dropped.push(sym);
      continue;
    }
    bySymQuote[sym] = { ...quote, observedAt: fallback, observedAtBoundary: 'previous-bar-open', observedAtCandidate: quote.observedAt };
    adjusted.push({ sym, from: quote.observedAt, to: fallback });
  }
  return { adjusted, dropped };
}

// v52.50/WO-3: direct-run guard (같은 패턴을 이미 backtest-trading-score.mjs 등이 씀) — 이 파일은
// GitHub Actions에서 항상 `node scripts/fetch-data.mjs`로 직접 실행되므로 이 가드는 프로덕션 동작을
// 전혀 바꾸지 않는다(그 경우 이 조건은 항상 참). 다만 이제 closesToFactors/backtestFactors/_mean이
// export돼 있어, 이 가드가 없으면 다른 스크립트가 그 함수만 재사용하려고 import하는 순간 라이브
// fetch 파이프라인 전체(실 네트워크 호출+public-data/*.json 덮어쓰기)가 부작용으로 실행돼버린다.
const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  const task = process.env.SCREENER_ONLY === '1' ? enrichScreener() : main();
  task.catch(e => { console.error('[fetch-data] 치명적 오류:', e); process.exit(1); });
}
