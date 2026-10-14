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
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest as runTradingScoreBacktest } from './backtest-trading-score.mjs';
import { deriveMarketSession, publishMarketSnapshot } from './build-market-snapshot.mjs';
import { writeOperationsStatus } from './build-operations-status.mjs';
import { writeReconciliationStatus } from './build-reconciliation-status.mjs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { buildIsmRuleEvents, buildMacroCalendarPayload, deriveFedPolicyRate, resolveFomcSchedule } from './lib/official-calendars.mjs'; // P1731-P1733
import { buildDomainReceipt } from './lib/domain-receipt.mjs';
import { newsArticleKey, issuerNameMentioned } from '../src/domain/news/stories.js';
import { deriveFredCycle } from './lib/refresh-continuity.mjs';
import { percentileRank01, spearman } from './lib/rank-statistics.mjs';
import { factorScopesByMarket, listingMarketOfSymbol, sessionDateInMarket, timeZoneForMarket, timeZoneForSymbol } from '../src/domain/market/session-time.js';
import { latestCompletedUsSession, nyParts, resolveMarketCalendarSession } from '../src/ai/time/market-session.js';
import { FACTOR_FRESHNESS_MS, computeFactorRanks } from '../src/domain/screener/factor-ranks.js';
import { MODEL_DEFAULT_WEIGHTS } from '../src/domain/screener/factor-weights.js';
import { buildScreenerModelFingerprint } from '../src/domain/screener/model-fingerprint.js';
import { reconcileSecRecord, secSharesTrust } from '../src/domain/fundamental/sec-report.js'; // P1402 + 2026-10-13 F03-F05
import { evaluateSymbolSignals, distributionDaySeries, BREADTH_SIGNAL_MODEL_VERSION } from '../src/domain/market/breadth-signals.js'; // P1416
import { collectRotationHistory } from './lib/rotation-history.mjs';
import { updateCandidateArchive } from './lib/candidate-archive.mjs'; // P1465
import { SHARED_AI_MODEL, requestSharedAnalysis, requestWorkersAiTranslation, resolveSharedAiConfig } from './lib/ai-shared-analysis.mjs';
import { analysisLevelsAfterLabels, analysisProse, isNonMetricNumber } from './lib/market-analysis-numbers.mjs';
import { buildMarketRegime } from '../src/domain/briefing/market-read.js'; // P1635
import { buildMarketScenarios, renderMarketScenarioContext } from '../src/domain/market/regime-scenarios.js';
import { buildScenarioOutlook, renderScenarioOutlookContext } from '../src/domain/market/scenario-outlook.js';
import { buildMacroRead } from '../src/domain/macro/macro-read.js';
import { buildMacroCrossroads, upcomingMacroEvents, renderMacroCrossroadsContext } from '../src/domain/market/macro-crossroads.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/data.json`;
const HIST = `${__dir}/../public-data/history.json`;
const SCENARIO_STATE_OUT = `${__dir}/../public-data/scenario-state.json`; // P1743 (written by build-scenario-state.mjs)
const SCENARIO_OUTCOMES_OUT = `${__dir}/../public-data/scenario-outcomes.json`; // P1743 (weekly)
const MARKET_SNAPSHOT_OUT = `${__dir}/../public-data/market-snapshot.json`;
const SEC_FUNDAMENTALS_OUT = `${__dir}/../public-data/sec-fundamentals.json`;

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^NDX','^DJI','^RUT','^VIX','^VIX3M','^VVIX','^FTSE','^N225','^HSI',
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
  fedRate:    { id: 'FEDFUNDS', kind: 'level' }, // effective rate, MONTHLY average — not the policy target
  // 2026-10-01: the FOMC target range itself (official daily FRED series); the policy-rate surfaces
  // compared FEDFUNDS' monthly average (3.63) with BOK's policy rate and the 3.75-4.00 decision.
  fedTargetLower: { id: 'DFEDTARL', kind: 'level' },
  fedTargetUpper: { id: 'DFEDTARU', kind: 'level' },
  unemployment:{ id: 'UNRATE',  kind: 'level' },
  nfp:        { id: 'PAYEMS',   kind: 'mom_diff' }, // 천명 단위 (e.g. 172)
  housingStarts: { id: 'HOUST',          kind: 'level', scale: 0.001 }, // 천 단위→백만 단위 (DATA_SNAPSHOT.housingStarts는 1.47M 형태)
  retailSales:   { id: 'RSAFS',          kind: 'mom_pct' },             // 소매판매 MoM% (레벨 $ 시리즈에서 파생)
  usWageGrowth:  { id: 'CES0500000003',  kind: 'yoy' },                 // 시간당 평균임금 YoY%
  hyOAS:         { id: 'BAMLH0A0HYM2',   kind: 'level', scale: 1, delta5: true }, // FRED percent; UI converts to bp at the renderer boundary
  dgs2:          { id: 'DGS2',            kind: 'level', delta5: true }, // 미 국채 2Y (%), 공식 FRED 일별 관측
  dgs5:          { id: 'DGS5',            kind: 'level' },               // 미 국채 5Y (%)
  dgs10:         { id: 'DGS10',           kind: 'level', delta5: true }, // 미 국채 10Y (%)
  dgs20:         { id: 'DGS20',           kind: 'level' },               // 미 국채 20Y (%)
  dgs30:         { id: 'DGS30',           kind: 'level' },               // 미 국채 30Y (%)
  t10y2y:        { id: 'T10Y2Y',          kind: 'level' },               // 10Y-2Y 스프레드 (%p), 단일 만기에서 추정 금지
  // P1390: decompose a nominal 10Y move into real yield (TIPS) and inflation compensation; a real-yield-led
  // rise compresses equity multiples, a breakeven-led rise runs through the oil/inflation channel.
  realYield10:   { id: 'DFII10',          kind: 'level', delta5: true }, // 10Y TIPS 실질금리 (%)
  breakeven10:   { id: 'T10YIE',          kind: 'level', delta5: true }, // 10Y 기대인플레이션(BEI, %)
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
    // P1547: the deadline covers the body read (cleared only after r.json()), and a definitive 4xx
    // (not 408/429) is returned to the caller instead of being retried against the same provider.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { headers: UA, signal: ctrl.signal, ...opts });
      if (!r.ok) {
        const err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) break;
      await new Promise(res => setTimeout(res, 600 * (i + 1)));
    } finally {
      clearTimeout(to);
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
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
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
        // P1581: with range=5d, chartPreviousClose is the close BEFORE the 5-day window, so using it
        // printed a multi-day change as the daily change (the P545 class). Only meta.previousClose is a
        // previous session close; without it the change stays missing.
        prev = (typeof m.previousClose === 'number' && m.previousClose > 0) ? m.previousClose : null;
        pct  = (prev && prev > 0) ? ((price - prev) / prev) * 100 : null;
        pctSource = 'chart-meta-fallback';
      }
      const quote = {
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
      // P1721: on a weekday an FX pair is always in session, so its history row and daily change rest entirely on the
      // previous close. Yahoo's daily FX bars dropped Mon 10/12 and left 10/13 null, so closes[-2] reached back to the
      // Friday 10/9 bar and 10/12-10/13 both recorded 1,342.99 (the screen froze at 10/9). The FX previous close is now
      // the hourly close at the 23:00Z (KST 08:00) cut — the same cut the history row carries. A failed hourly read
      // keeps the daily path above.
      if (/=X$/.test(symbol) && FX_WEEKDAY_SESSION(Date.now())) {
        try {
          const hourly = await fetchJSON(host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=60m&range=5d', {}, 1);
          const hres = hourly?.chart?.result?.[0];
          const cut = fxCloseAtCut(hres?.timestamp || [], hres?.indicators?.quote?.[0]?.close || [], Date.now());
          if (cut && cut.close > 0) {
            quote.regularMarketPreviousClose = cut.close;
            quote.chartPreviousClose = cut.close;
            quote.regularMarketChangePercent = ((price - cut.close) / cut.close) * 100;
            quote.regularMarketPreviousCloseObservedAt = cut.observedAt;
            quote.previousBarOpenedAt = cut.previousBoundary;
            quote._pctSource = 'fx-hourly-cut-close';
          }
        } catch (_) { /* daily path stays */ }
      }
      return quote;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// P1721: FX trades Sunday 22:00Z to Friday ~21:00Z; Saturday/Sunday (UTC) keep the daily-bar path (a Friday close).
function FX_WEEKDAY_SESSION(nowMs) {
  const day = new Date(nowMs).getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * P1721: the FX close at the latest completed 23:00Z (KST 08:00) cut whose day was a weekday session, read from
 * hourly bars (open timestamps). The last non-null hourly close in the four hours before the cut is the close; its
 * observation time is that bar's end (never after the cut). Returns null when no bar qualifies — never a guess.
 */
export function fxCloseAtCut(timestamps = [], closes = [], nowMs = Date.now()) {
  const HOUR = 3600000;
  let boundary = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate(), 23);
  if (boundary > nowMs) boundary -= 24 * HOUR;
  const weekdaySessionEndingAt = (b) => { const day = new Date(b - 1).getUTCDay(); return day >= 1 && day <= 5; };
  for (let guard = 0; guard < 4 && !weekdaySessionEndingAt(boundary); guard += 1) boundary -= 24 * HOUR;
  if (!weekdaySessionEndingAt(boundary)) return null;
  let best = null;
  for (let i = 0; i < timestamps.length; i += 1) {
    const openMs = Number(timestamps[i]) * 1000;
    const close = Number(closes[i]);
    if (!Number.isFinite(openMs) || closes[i] == null || !Number.isFinite(close) || close <= 0) continue;
    if (openMs >= boundary || openMs < boundary - 4 * HOUR) continue;
    if (!best || openMs > best.openMs) best = { openMs, close };
  }
  if (!best) return null;
  let previous = boundary - 24 * HOUR;
  for (let guard = 0; guard < 4 && !weekdaySessionEndingAt(previous); guard += 1) previous -= 24 * HOUR;
  return {
    close: best.close,
    observedAt: new Date(Math.min(best.openMs + HOUR, boundary)).toISOString(),
    boundary: new Date(boundary).toISOString(),
    previousBoundary: new Date(previous).toISOString(),
  };
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
      // P1336: one transient runner→FRED abort failed CPI/UNRATE for a whole cycle; retry once after 3 s.
      const j = await fetchJSON(url).catch(async () => { await new Promise((r) => setTimeout(r, 3000)); return fetchJSON(url); });
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
        // P1390: a one-week change (5 observations) for daily series that drive the briefing read.
        if (spec.delta5 && obs.length >= 6) {
          const delta5 = round((obs[0].v - obs[5].v) * scale, 3);
          if (delta5 !== null) out[field + 'Delta5'] = delta5;
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
    // Codex review 2026-10-05: earlier sessions of the same feed, so 1-day and 1-week changes are taken
    // from the same official series as the level (newest first).
    series: parsed.slice(0, 8).map((entry) => ({ observedAt: entry.observedAt, values: entry.values })),
    allowedUse: 'official-observation-and-derived-same-date-spread',
    decisionUse: false
  };
}

// Codex review 2026-10-05 (오늘 10년물 +4bp vs 금리·환율 −5bp): the Treasury feed replaced the FRED level
// with a newer date but the FRED change (one session older) stayed beside it. A change is published only
// when both ends come from the official feed, with the date it belongs to; otherwise it is removed.
export function officialTreasuryDeltas(treasury, field) {
  const entries = Array.isArray(treasury?.series) ? treasury.series.filter((entry) => entry?.observedAt < treasury.observedAt) : [];
  const current = Number(treasury?.values?.[field]);
  const at = (index) => Number(entries[index]?.values?.[field]);
  const delta = entries.length >= 1 && Number.isFinite(current) && Number.isFinite(at(0)) ? round(current - at(0), 3) : null;
  const delta5 = entries.length >= 5 && Number.isFinite(current) && Number.isFinite(at(4)) ? round(current - at(4), 3) : null;
  return { delta, delta5, asOf: treasury?.observedAt || null };
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
      // P1385: unconditional — a newly added series (fedTargetLower/Upper, P1375) had no previous
      // marker, so it was published with `_source_*` but no `_freshness_*` and CI went red.
      merged[`_freshness_${field}`] = 'observed';
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
    // P1572: the carried row is spread first so a failed attempt can never republish it as 'ok'.
    return {
      ...(previous && typeof previous === 'object' ? previous : {}),
      status: previous && previous.values ? 'last-known-good' : 'unavailable',
      source: 'U.S. Bureau of Economic Analysis',
      sourceKind: 'T1_OFFICIAL',
      allowedUse: 'reference-only',
      attemptedAt,
      fetchedAt: null,
      lastSuccessfulAt: previous && previous.lastSuccessfulAt || null,
      failureReason: String(error && error.message || error),
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

// P1573: Cboe posts a session's ratios after the close, so the page may lag one session.
// Anything older than the session before the latest completed US close is stale, not current.
export function classifyCboePutCallCurrentness(asOf, now = Date.now()) {
  const session = latestCompletedUsSession(now);
  if (!asOf || !session) return 'stale-reference';
  const oldestCurrent = session.previousDate || session.date;
  return asOf >= oldestCurrent ? 'current-reference' : 'stale-reference';
}

async function fetchCboePutCall() {
  const attemptedAt = new Date().toISOString();
  try {
    const html = await _fetchRss('https://www.cboe.com/data/mktstat.aspx', 18000);
    const parsed = parseCboePutCallHtml(html);
    if (!parsed) throw new Error('official page did not contain ratio/date contract');
    return { ...parsed, attemptedAt, status: classifyCboePutCallCurrentness(parsed.asOf) };
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
  // P1373: the ko/KR edition was queried with English terms and returned no in-cycle items.
  { query: '코스피 OR 코스닥 OR 삼성전자 OR SK하이닉스 OR 외국인 순매수 OR 원달러 환율 when:2d', source: 'Google News - Korea markets', topic: 'korea', country: 'kr', tier: 2 },
].map(feed => ({ ...feed, url: _googleNewsSearchUrl(feed.query, feed.country === 'kr' ? 'ko' : 'en-US', feed.country === 'kr' ? 'KR' : 'US', feed.country === 'kr' ? 'KR:ko' : 'US:en') }));

const SERVER_NEWS_PRIORITY_RULES = [
  { label: 'macro-rates', points: 14, re: /\b(fed|fomc|powell|rate cut|rate hike|inflation|cpi|ppi|pce|payroll|jobs report|recession|soft landing|treasury yield|bond yield)\b/i },
  { label: 'geopolitics-energy', points: 14, re: /\b(iran|hormuz|red sea|israel|lebanon|ukraine|sanction|tariff|export control|oil prices?|wti|brent|lng|opec)\b/i },
  { label: 'ai-semis', points: 13, re: /\b(nvidia|nvda|semiconductor|chip|hbm|dram|sk hynix|samsung electronics|tsmc|asml|blackwell|rubin|data center|ai infrastructure)\b/i },
  { label: 'credit-funding', points: 12, re: /\b(lqd|hyg|oas|credit spreads?|corporate bonds?|investment grade|high yield|rating downgrade|debt financing|funding costs?|capex funding|project finance|data center financing)\b/i },
  { label: 'earnings-guidance', points: 10, re: /\b(earnings|revenue|eps|guidance|outlook|margin|buyback|dividend|preannounces?)\b/i },
  { label: 'analyst-action', points: 8, re: /\b(upgrade|downgrade|price target|rating|initiates|overweight|underweight|buy rating|sell rating)\b/i },
  { label: 'fx-bonds-commodities', points: 8, re: /\b(dollar|yen|euro|yuan|won|dxy|forex|gold|copper|credit spread|yield curve)\b/i },
  // P1504: broad market vocabulary — counts toward the topic floor with a small weight so 'Nasdaq hits new high,
  // 10-year yield tops 5.3%' or 'global bond sell-off' are not dropped as off-topic.
  { label: 'market-general', points: 4, re: /\b(stocks?|stock market|wall street|equities|s&p 500|nasdaq|dow jones|russell 2000|yields?|bonds?|10-year|30-year|treasur(?:y|ies)|oil|crude|commodit(?:y|ies)|futures|markets?)\b/i },
  { label: 'mega-cap', points: 8, re: /\b(aapl|apple|msft|microsoft|nvda|nvidia|amzn|amazon|meta|tesla|tsla|googl|google|avgo|broadcom|amd|oracle|orcl|jpm|exxon|xom)\b/i },
];

// 2026-10-13 news audit N13: "Adding Nvidia … is How Fortunes Are Made" and the same promise-of-wealth family.
const SERVER_NEWS_CLICKBAIT_RE = /\b(next nvidia|next tesla|must buy|guaranteed return|millionaire|hidden gem|penny stock|to the moon|won't believe|don't miss|best stocks? to buy now|fortunes? (?:are|is|was|were|could be|can be|will be) made|make you (?:rich|a fortune)|life[- ]changing (?:money|wealth|returns?)|generational wealth|set (?:you )?up for life|retire (?:rich|early|a millionaire)|turn \$?[\d,]+ into)\b/i;
const SERVER_NEWS_UNVERIFIED_RE = /\b(people familiar|sources say|according to sources|unconfirmed|rumor|reportedly|may be considering|is said to)\b/i;
const SERVER_NEWS_TIER1_SOURCE_RE = /\b(Reuters|Bloomberg|Associated Press|AP News|Financial Times|Wall Street Journal|WSJ|CNBC)\b/i;
// P1720: the Korean-edition feed labels these same tier-2 publishers in Korean (연합뉴스 = Yonhap), which `\b` never
// matches around Hangul, so a Yonhap headline ranked as tier 3. Same publishers, their Korean labels — not new sources.
const SERVER_NEWS_TIER2_SOURCE_RE = /\b(?:MarketWatch|Barron's|Nikkei|Yonhap|Naver|Korea JoongAng|The Korea Herald|The Hill|Yahoo Finance)\b|^(?:연합뉴스|중앙일보|코리아\s?헤럴드)$/i;
// P1504: the list missed the spellings Google News actually returns ("AD HOC NEWS") and several content farms
// that filled the 2026-10-06 cycle (TradingKey ×4, livetradingnews, BBN Times, simplywall.st).
const SERVER_NEWS_LOW_QUALITY_SOURCE_RE = /\b(Ad[- ]?hoc[- ]?news|MSN|GuruFocus|IndexBox|Pluang|Bitget|Stocktwits|TradingPedia|The Vibes|WBFF|Benzinga|Zacks|TradingKey|livetradingnews|BBN Times|simplywall\.st|Simply Wall St(?:reet)?|Telangana Today|Goodreturns|Startup Fortune|BigGo Finance|Eurasia Business News|bitcoinmagazine|GoldSilver|Motley Fool|FX Leaders|Coinpedia|Blockchain\.News|TMGM|VT Markets|Markets\.com|Admirals?|Action Forex|Moomoo|Invezz|Capital\.com|Plus500|XTB|FXOpen|Exness|AvaTrade|eToro|MarketBeat|24\/7 Wall St)\b/i;
// N12 (2026-10-13 audit): the additions after Blockchain.News are CFD-broker and trading-app marketing desks (TMGM,
// VT Markets, Markets.com, Admirals, Action Forex, Moomoo, Invezz …) and template/listicle farms (MarketBeat,
// 24/7 Wall St). Matching runs on the host-normalised source label, so "www.tmgm.com" is caught as well.
// Google News sometimes returns the publisher as a bare URL; only its host is kept as the source label.
export function newsSourceLabel(raw) {
  const text = String(raw || '').trim();
  if (!/^https?:\/\//i.test(text) && !/^www\./i.test(text)) return text;
  try { return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./i, ''); } catch (_) { return text; }
}
// P1504: Korean headlines matched none of the English priority rules, so every Korean item scored on source and
// recency alone. The same topics in Korean.
const SERVER_NEWS_PRIORITY_RULES_KO = [
  { label: 'ko-macro-rates', points: 14, re: /(금리|기준금리|물가|인플레|연준|FOMC|파월|국채|고용지표|경기침체|한국은행|금통위)/ },
  { label: 'ko-fx', points: 10, re: /(환율|원·?달러|원화|달러|엔화|외환)/ },
  { label: 'ko-semis', points: 13, re: /(반도체|메모리|HBM|D램|낸드|파운드리|삼성전자|SK하이닉스|하이닉스|삼전닉스)/ },
  { label: 'ko-earnings', points: 10, re: /(실적|영업이익|매출|가이던스|잠정|어닝)/ },
  { label: 'ko-flows', points: 9, re: /(외국인|기관|순매수|순매도|공매도|수급|리밸런싱|만기)/ },
  { label: 'ko-market', points: 8, re: /(코스피|코스닥|증시|지수|상장|공모)/ },
  { label: 'ko-geo-trade', points: 12, re: /(관세|제재|수출통제|중동|이란|호르무즈|전쟁|대미\s*투자)/ }
];

function getServerNewsSourceTier(source, feedTier) {
  const src = String(source || '');
  if (SERVER_NEWS_TIER1_SOURCE_RE.test(src)) return 1;
  if (SERVER_NEWS_TIER2_SOURCE_RE.test(src)) return 2;
  if (SERVER_NEWS_LOW_QUALITY_SOURCE_RE.test(src)) return 4;
  if (!src && feedTier) return Math.max(2, feedTier);
  return 3;
}

// Codex browser audit H04 (2026-10-07): weather and baccarat posts were published as 실적/한국 news. The topic
// rules ran over "title + source + feed topic", so every item from an earnings-query feed matched /earnings/
// through its own feed label, and the floor (topicHits > 0) passed it. Topic evidence now comes from the
// headline alone; the feed's topic and the source name are not evidence that the article is about markets.
const SERVER_NEWS_OFFTOPIC_RE = /(바카라|카지노\s*게임|슬롯\s*머신|토토|승률\s*계산|베팅\s*전략|날씨|기온|한파|폭설|폭우|\bweather\b|\bsnowfall\b|\bchinook\b|winter planning|\bbaccarat\b|casino games?|sports betting|\bhoroscope\b)/i;
// Owner 2026-10-12 (뉴스 30건 vs 50건): more slots would add noise, not news. Pages that are not articles — quote
// pages, auto-generated price-target "forecasts", filing-form listings — and reposts whose headline names a month
// two or more months before the cycle are dropped before ranking.
const SERVER_NEWS_NOT_ARTICLE_RE = /(Stock Price, News, Quote|Quote & History|Price Target\s*[—-]\s*Prediction|Forecast\s*[—-]\s*Price Target|^Form\s+\d|\bForm 4\b|Stock Price Today|Price Prediction (?:for )?20\d\d)/i;
const NEWS_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export function serverNewsHeadlineMonthStale(headline, nowMs = Date.now()) {
  const match = String(headline || '').toLowerCase().match(/\b(january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}\b/);
  if (!match) return false;
  const named = NEWS_MONTHS.indexOf(match[1]);
  const current = new Date(nowMs).getUTCMonth();
  return ((current - named + 12) % 12) >= 2 && ((current - named + 12) % 12) <= 9;
}
export function scoreServerNewsItem(item) {
  const headline = String(item.title || '');
  const text = `${headline} ${item.source || ''}`;
  if (SERVER_NEWS_CLICKBAIT_RE.test(headline)) return { score: 0, selectionReason: 'clickbait-filter' };
  if (SERVER_NEWS_NOT_ARTICLE_RE.test(headline)) { item.topicHits = 0; return { score: 0, selectionReason: 'not-article-filter' }; }
  if (serverNewsHeadlineMonthStale(headline, item.scoringNowMs || Date.now())) { item.topicHits = 0; return { score: 0, selectionReason: 'stale-repost-filter' }; }
  if (SERVER_NEWS_OFFTOPIC_RE.test(headline)) { item.topicHits = 0; return { score: 0, selectionReason: 'off-topic-filter' }; }

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

  let topicHits = 0;
  for (const rule of [...SERVER_NEWS_PRIORITY_RULES, ...SERVER_NEWS_PRIORITY_RULES_KO]) {
    if (rule.re.test(headline)) {
      score += rule.points;
      topicHits += 1;
      reasons.push(`${rule.label}+${rule.points}`);
    }
  }
  // P1504: a headline that touches no market topic is not market news, whatever feed returned it.
  item.topicHits = topicHits;

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
    const guid = _decodeNewsEntities((b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]);
    // N13: a URL-shaped publisher becomes its host name; the raw value is kept only to strip the title suffix.
    items.push({ title: title.slice(0, titleLen), guid: guid || null, sourceArticleId: guid || null, fetchedAt: new Date().toISOString(), link: link || null, source: newsSourceLabel(src), _sourceRaw: src || '', pubDate: pub || null, ts: isFinite(ts) ? ts : 0 });
  }
  return items;
}

export function newsHeadlineSignature(title) {
  const text = String(title || '').toLowerCase().replace(/\s+-\s+[^-]+$/, '').replace(/[^\p{L}\p{N}.%$ ]/gu, ' ');
  const compact = text.replace(/\s+/g, '');
  const grams = new Set();
  for (let i = 0; i < compact.length - 1; i += 1) grams.add(compact.slice(i, i + 2));
  const figures = new Set((text.match(/\$?\d+(?:\.\d+)?\s*(?:조|억|%|bp|billion|trillion|bn)/g) || []).map((x) => x.replace(/\s/g, '')));
  return { grams, figures };
}
export function newsSameEvent(a, b) {
  let shared = 0;
  for (const gram of a.grams) if (b.grams.has(gram)) shared += 1;
  const jaccard = shared / Math.max(1, a.grams.size + b.grams.size - shared);
  const sameFigure = [...a.figures].some((figure) => b.figures.has(figure));
  return jaccard >= 0.6 || (sameFigure && jaccard >= 0.25);
}

// Google News appends " - Source" to every title; the source is shown separately (hover / folded sources only).
export function cleanNewsTitle(title, source, rawSource = '') {
  const text = String(title || '');
  for (const src of [String(source || '').trim(), String(rawSource || '').trim()]) {
    if (src && text.endsWith(` - ${src}`)) return text.slice(0, -(src.length + 3)).trim();
  }
  return text;
}

// N11 (2026-10-13 audit): paraphrases of one story are not the same headline, so newsSameEvent let seven
// "oil rises on Saudi attacks" and eight "stocks wait for bank earnings and CPI" items through. Within one 24h
// cycle (the date is the cycle), a headline's key entities are its topic; at most two picks may share a pair of
// key entities and at most four (three for an index wrap) a single one.
const NEWS_KEY_ENTITIES = [
  ['oil', /\b(?:oil|crude|brent|wti|opec)\b|유가|원유/i],
  ['gold', /\b(?:gold|bullion|xau)\b|금값|금 가격/i],
  ['inflation', /\b(?:cpi|inflation|ppi|pce)\b|물가|인플레/i],
  ['fed', /\b(?:fed|fomc|powell|federal reserve)\b|연준/i],
  ['index-wrap', /\b(?:s&p 500|dow(?: jones)?|nasdaq|wall street|stock (?:index )?futures|us stocks|stock market today|new york stocks)\b|코스피|코스닥|뉴욕증시/i],
  ['bank-earnings', /\bbank(?:s'|s)? earnings\b|은행 실적/i],
  ['saudi', /\bsaudi\b|사우디/i],
  ['iran', /\b(?:iran|tehran)\b|이란/i],
  ['hormuz', /\bhormuz\b|호르무즈/i],
  ['houthi', /\b(?:houthis?|red sea)\b|후티|홍해/i],
  ['russia-ukraine', /\b(?:russia|ukraine|kremlin)\b|러시아|우크라이나/i],
  ['israel', /\b(?:israel|gaza|hezbollah|lebanon)\b|이스라엘/i],
  ['china', /\b(?:china|chinese|beijing)\b|중국/i],
  ['tariff', /\btariffs?\b|관세/i],
  ['dollar-fx', /\b(?:dollar|dxy|yen|euro|yuan)\b|환율|원·?달러|엔화/i],
  ['treasury', /\b(?:treasur(?:y|ies)|bond yields?|10-year)\b|국채/i],
  ['nvidia', /\bnvidia\b|엔비디아/i],
  ['semis', /\b(?:semiconductors?|chips?|chipmakers?)\b|반도체/i],
];
const NEWS_ENTITY_SINGLE_CAP = { 'index-wrap': 3 };
const NEWS_ENTITY_SINGLE_CAP_DEFAULT = 4;
const NEWS_ENTITY_PAIR_CAP = 2;
export function newsKeyEntities(title) {
  const text = String(title || '');
  return NEWS_KEY_ENTITIES.filter(([, re]) => re.test(text)).map(([key]) => key);
}
export function createNewsTopicCap() {
  const single = new Map();
  const pairs = new Map();
  const pairKeys = (keys) => keys.flatMap((a, i) => keys.slice(i + 1).map((b) => `${a}+${b}`));
  return {
    full(title) {
      const keys = newsKeyEntities(title);
      if (keys.some((key) => (single.get(key) || 0) >= (NEWS_ENTITY_SINGLE_CAP[key] ?? NEWS_ENTITY_SINGLE_CAP_DEFAULT))) return true;
      return pairKeys(keys).some((key) => (pairs.get(key) || 0) >= NEWS_ENTITY_PAIR_CAP);
    },
    add(title) {
      const keys = newsKeyEntities(title);
      for (const key of keys) single.set(key, (single.get(key) || 0) + 1);
      for (const key of pairKeys(keys)) pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  };
}

// P1720: the caller passes the run's attempt time so the collected cycle and meta.newsCycleEnd are one cut even when a
// run straddles 08:00 KST (23:00Z); otherwise newsIntraday is picked against the previous cut and fails the gate.
async function fetchNews(nowMs = Date.now()) {
  const cycle = getKst0800NewsCycle(nowMs);
  const items = [];    // US/글로벌 피드
  const krItems = [];  // 한국 전용 (reserved slot)
  const intradayCandidates = []; // P1720: published after cycle.endMs (08:00 KST)
  for (const feed of NEWS_FEEDS) {
    const isKr = feed.country === 'kr';
    try {
      const feedUrls = [feed.url, feed.url.replace(/when%3A2d/i, 'when%3A7d')];
      let parsed = [];
      for (const feedUrl of feedUrls) {
        const candidate = _parseRssXml(await _fetchRssWithRetry(feedUrl, 12000), { limit: 40, titleLen: 200, needLink: true }) // 2026-10-12: a deeper candidate pool so the stricter filters below still fill the slots with real articles;
        parsed = candidate;
        const hasCurrent = candidate.some(p => {
          const ts = p.ts;
          return isFinite(ts) && ts >= cycle.startMs && ts < cycle.endMs;
        });
        if (hasCurrent || feedUrl === feedUrls[feedUrls.length - 1]) break;
      }
      for (const p of parsed) {
        const t = p.ts;
        // P1720: articles published after the 08:00 cut are kept aside for the provisional intraday slot; the
        // completed 08:00 bundle below stays the canonical window.
        if (isFinite(t) && t >= cycle.endMs) {
          intradayCandidates.push({ title: p.title, link: p.link, source: p.source || feed.source, _sourceRaw: p._sourceRaw,
            guid: p.guid, sourceArticleId: p.sourceArticleId, ts: t, topic: isKr ? 'kr' : feed.topic, country: feed.country,
            feedTier: feed.tier, feedSource: feed.source });
        }
        if (!isFinite(t) || t < cycle.startMs || t >= cycle.endMs) continue;
        const item = {
          title: p.title, link: p.link, source: p.source || feed.source, _sourceRaw: p._sourceRaw,
          guid: p.guid, sourceArticleId: p.sourceArticleId, fetchedAt: p.fetchedAt, evidenceKind: p.evidenceKind,
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
        // P1504: selection floor — off-topic headlines (a lacrosse team surfaced through a "Red Sea" query) and
        // low-quality sources are dropped before ranking instead of filling empty slots.
        if (!(item.topicHits > 0) || item.tier >= 4 || !(item.score > 0)) continue;
        if (isKr) { krItems.push(item); } else { items.push(item); }
      }
    } catch (e) { /* 피드별 실패 무시 */ }
  }
  // US/글로벌: 점수순 정렬, 한국: 최신순 정렬
  items.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  krItems.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  const seen = new Set();
  const out = [];
  // P1504: one source may hold at most three of the forty slots (AD HOC NEWS held five).
  const perSource = new Map();
  const SOURCE_CAP = 3;
  const sourceKey = (it) => String(it.source || it.feedSource || '').trim().toLowerCase();
  const sourceFull = (it) => (perSource.get(sourceKey(it)) || 0) >= SOURCE_CAP;
  // Owner 2026-10-12: one event, one slot. Two outlets reporting the same story (same specific figure, or nearly
  // the same headline) used two of the slots; the higher-scored one is kept because candidates arrive score-ordered.
  const pickedGrams = [];
  const sameEvent = (it) => {
    const mine = newsHeadlineSignature(it.title);
    return pickedGrams.some((other) => newsSameEvent(mine, other));
  };
  // Google News appends " - Source" to every title; the source is shown separately.
  const cleanTitle = (it) => cleanNewsTitle(it.title, it.source, it._sourceRaw);
  // N11: paraphrases of one story share key entities ("oil" + "saudi"); see createNewsTopicCap.
  const topicCap = createNewsTopicCap();
  const topicFull = (it) => topicCap.full(cleanTitle(it));
  function pushItem(it) {
    pickedGrams.push(newsHeadlineSignature(it.title));
    perSource.set(sourceKey(it), (perSource.get(sourceKey(it)) || 0) + 1);
    topicCap.add(cleanTitle(it));
    out.push({
      title: cleanTitle(it), link: it.link, source: it.source,
      guid: it.guid, sourceArticleId: it.sourceArticleId, fetchedAt: it.fetchedAt, evidenceKind: it.evidenceKind,
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
    if (sourceFull(it) || topicFull(it)) continue;
    const k = newsArticleKey(it);
    if (seen.has(k) || sameEvent(it)) continue;
    seen.add(k);
    pushItem(it);
  }
  // P1373: score-only ranking let semis/macro/geo fill every slot (fxbond and credit got 0 of 40).
  // Reserve a small floor per under-covered topic before the score-ordered fill.
  for (const [topic, floor] of [['fxbond', 3], ['credit', 2]]) {
    let taken = 0;
    for (const it of items) {
      if (taken >= floor || out.length >= 40) break;
      if (it.topic !== topic) continue;
      if (sourceFull(it) || topicFull(it)) continue;
      const k = newsArticleKey(it);
      if (seen.has(k) || sameEvent(it)) continue;
      seen.add(k);
      pushItem(it);
      taken += 1;
    }
  }
  // 나머지 슬롯을 US/글로벌 뉴스로 채움
  for (const it of items) {
    if (out.length >= 40) break;
    if (sourceFull(it) || topicFull(it)) continue;
    const k = newsArticleKey(it);
    if (seen.has(k) || sameEvent(it)) continue;
    seen.add(k);
    pushItem(it);
  }
  // P1720: the provisional intraday slot rides on the same array without entering its JSON (non-enumerable), so every
  // existing consumer of `news` keeps the canonical 08:00 bundle unchanged.
  Object.defineProperty(out, 'intraday', { value: selectNewsIntraday(intradayCandidates, { cycleEndMs: cycle.endMs, canonical: out }), enumerable: false });
  return out;
}

// P1720 (coordinator N14, 2026-10-13): the completed 08:00 KST bundle left a Korean session's events out until the next
// morning (KOSPI -5.46% on 10/13 had no headline all day). Articles published after the cut get a separate, provisional
// slot: tier 1-2 publishers only, the same clickbait/not-article/off-topic/stale filters and topic cap as the bundle,
// one slot per event (including events already in the bundle), at most two per publisher, at most six. When the next
// 08:00 bundle is cut, these articles fall inside its window and leave this slot by construction.
export const NEWS_INTRADAY_MAX = 6;
export const NEWS_INTRADAY_POLICY = 'kst-0800-after-provisional';
export const NEWS_INTRADAY_LABEL = '08:00 이후 장중 속보 · 잠정';
export function selectNewsIntraday(candidates, { cycleEndMs, nowMs = Date.now(), canonical = [], max = NEWS_INTRADAY_MAX } = {}) {
  if (!Number.isFinite(cycleEndMs)) return [];
  const scored = [];
  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const ts = Number(raw?.ts);
    if (!raw?.title || !raw?.link || !Number.isFinite(ts) || ts < cycleEndMs || ts > nowMs + 15 * 60000) continue;
    const item = { ...raw, ts, scoringNowMs: nowMs };
    Object.assign(item, scoreServerNewsItem(item));
    if (!(item.topicHits > 0) || !(item.score > 0) || !(item.tier <= 2)) continue;
    scored.push(item);
  }
  scored.sort((a, b) => (b.score || 0) - (a.score || 0) || b.ts - a.ts);
  const seen = new Set((Array.isArray(canonical) ? canonical : []).map((row) => newsArticleKey(row)));
  const signatures = (Array.isArray(canonical) ? canonical : []).map((row) => newsHeadlineSignature(row?.title));
  const perSource = new Map();
  const topicCap = createNewsTopicCap();
  const picked = [];
  // As in the bundle (KR_SLOTS), Korean-session items take up to two slots first; the rest is score order.
  const take = (it) => {
    if (picked.length >= max) return;
    const title = cleanNewsTitle(it.title, it.source, it._sourceRaw);
    const key = newsArticleKey(it);
    const signature = newsHeadlineSignature(it.title);
    const publisher = String(it.source || '').trim().toLowerCase();
    if (seen.has(key) || signatures.some((other) => newsSameEvent(signature, other)) || (perSource.get(publisher) || 0) >= 2 || topicCap.full(title)) return;
    seen.add(key);
    signatures.push(signature);
    perSource.set(publisher, (perSource.get(publisher) || 0) + 1);
    topicCap.add(title);
    picked.push({
      title, link: it.link, source: it.source, publishedAt: new Date(it.ts).toISOString(),
      topic: it.topic, market: it.country, tier: it.tier, sourceTierLabel: serverNewsSourceTierLabel(it.tier),
      score: it.score, selectionReason: it.selectionReason, contentDepth: 'headline-only', provisional: true,
    });
  };
  for (const it of scored) if (it.country === 'kr' && picked.length < 2) take(it);
  for (const it of scored) take(it);
  return picked.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ── v51.15: 개별 종목 뉴스 enrichment — Google News RSS per-ticker → screener.json newsMemo ──
// _fetchRss + _parseRssXml 공용 헬퍼 기반으로 중복 없이 구현.
// 2026-10-13 news audit N01: the query was "<SYM> stock", so about one memo in five was another company's story
// (V → "NVDA vs AVGO", MA → MA Financial, DE → Edel SE, LIN → Lin Hsiu-ming, NOW → "Microsoft Now Has",
// LOW → "12-Year Low", BROS → Warner Bros.). The query now uses the company's core name, and a headline is kept
// only when it names the issuer (core name, "(SYM)", ":SYM", "$SYM" or "SYM stock"); otherwise the memo is empty.
export function tickerNewsCoreName(name) {
  const original = String(name || '').replace(/[’‘]/g, '\'').trim();
  let core = original.replace(/\s+Class\s+[A-C]$/i, '').replace(/\s+[A-C]$/, '');
  const suffix = /(?:,?\s+(?:Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Companies|Holdings?|Group|Ltd\.?|plc|PLC|N\.?V\.?|S\.?A\.?|AG|SE|Technologies|Technology|Tech|Systems|Platforms|Motor|Chase|Intl|International)|\s*&\s*Co\.?)$/;
  for (let prev = null; prev !== core && core;) { prev = core; core = core.replace(suffix, '').trim(); }
  return core || original;
}
export const TICKER_NEWS_WORD_SYMBOLS = new Set(['AI', 'IT', 'ON', 'ALL', 'NOW', 'SO', 'ARE', 'HAS', 'KEY', 'NET', 'APP', 'FAST', 'BE', 'LOW', 'CAT', 'DOW', 'ED', 'PEG', 'AN', 'ONE', 'OR', 'GO', 'MA', 'DE', 'LIN', 'BROS', 'CASH', 'GOLD', 'FUN', 'PLAY', 'MAIN', 'WELL', 'TECH', 'HOOD', 'PATH', 'RUN', 'SHOP', 'SNOW', 'TEAM', 'ZS', 'EV', 'US', 'UK', 'EU', 'CEO', 'IPO', 'ETF', 'GDP', 'CPI', 'FED']);
const _escTickerRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 'symbol' | 'name' | null — how (whether) the headline names this issuer. */
export function tickerNewsHeadlineNamesIssuer(title, sym, name) {
  const text = String(title || '').replace(/[’‘]/g, '\'');
  const S = String(sym || '').trim().toUpperCase();
  if (!text || !S) return null;
  const esc = _escTickerRe(S);
  if (new RegExp(`\\$${esc}(?![A-Za-z0-9])|\\(\\s*(?:(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX|OTC)\\s*:\\s*)?${esc}\\s*(?::\\s*(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX|OTC)\\s*)?\\)|(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX)\\s*:\\s*${esc}(?![A-Za-z0-9])`).test(text)) return 'symbol';
  // A ticker that is also a word or common abbreviation ("This AI Stock", "AI's power demand", "KEY stocks") does not
  // name its issuer by "SYM stock" / "SYM's"; those tickers need $SYM, (SYM) or an exchange prefix.
  if (S.length >= 2 && !TICKER_NEWS_WORD_SYMBOLS.has(S) && new RegExp(`(?:^|[^A-Za-z0-9$])${esc}(?=\\s+(?:Stock|stock|Shares|shares|Earnings|earnings)\\b|'s\\b)`).test(text)) return 'symbol';
  const core = tickerNewsCoreName(name);
  // A legal name shortened to one word ("Booking Holdings" → "Booking", "Cisco Systems" → "Cisco") must sit next
  // to a corporate cue (stock/shares/earnings/…), as an ordinary-word company name does.
  const shortened = core !== String(name || '').replace(/[’‘]/g, '\'').trim();
  return issuerNameMentioned(text, core, S, { requireCue: shortened }) ? 'name' : null;
}
const _kstMonthDay = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(5, 10);
export const TICKER_NEWS_MAX_AGE_MS = 3 * DAY_MS;
/**
 * N01/N05/N09/N10/N22: pick at most two recent headlines that name the issuer, from sources and page types the
 * market-news selection would also accept, one per event. Dates are KST; sources travel separately (never in the
 * memo text). Returns null when nothing qualifies (fail-closed: no memo rather than another company's story).
 */
export function selectTickerNewsMemo(items, { sym, name, nowMs = Date.now(), maxItems = 2 } = {}) {
  const candidates = (Array.isArray(items) ? items : [])
    .map((it) => ({ ...it, title: cleanNewsTitle(it?.title, it?.source, it?._sourceRaw).slice(0, 130) }))
    .filter((it) => it.title && Number.isFinite(it.ts) && it.ts > 0 && it.ts <= nowMs + 3600000 && nowMs - it.ts <= TICKER_NEWS_MAX_AGE_MS)
    .sort((a, b) => b.ts - a.ts);
  const picked = [];
  const signatures = [];
  for (const it of candidates) {
    if (picked.length >= maxItems) break;
    if (getServerNewsSourceTier(it.source, 3) >= 4) continue;
    if (SERVER_NEWS_NOT_ARTICLE_RE.test(it.title) || SERVER_NEWS_CLICKBAIT_RE.test(it.title) || serverNewsHeadlineMonthStale(it.title, nowMs)) continue;
    const issuerMatch = tickerNewsHeadlineNamesIssuer(it.title, sym, name);
    if (!issuerMatch) continue;
    const signature = newsHeadlineSignature(it.title);
    if (signatures.some((other) => newsSameEvent(signature, other))) continue;
    signatures.push(signature);
    picked.push({ ...it, issuerMatch });
  }
  if (!picked.length) return null;
  return {
    memo: picked.map((it) => `[${_kstMonthDay(it.ts)}] ${it.title}`).join(' · '),
    sources: picked.map((it) => it.source || null),
    items: picked
  };
}

async function fetchTickerNewsItems(sym, name, days) {
  const core = tickerNewsCoreName(name);
  const query = core ? `"${core}" stock when:${days || 3}d` : `${sym} stock when:${days || 3}d`;
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  try { return { items: _parseRssXml(await _fetchRss(url, 8000), { limit: 15, titleLen: 220 }), error: null }; }
  catch (e) { return { items: [], error: String(e && e.message || e) }; }
}

// N04: the run cap stays at 90 requests; the targets rotate. The first ten universe names (the largest) are
// fetched every run and the rest move through in 80-name slices keyed by the 6-hour run slot, so every U.S. stock
// is reached within about ten runs (~2.5 days); a verified memo is kept for three days in between.
export const TICKER_NEWS_RUN_CAP = 90;
export const TICKER_NEWS_FIXED_HEAD = 10;
export const TICKER_NEWS_ROTATION_SLOT_MS = 6 * 3600000;
export function planTickerNewsTargets(eligible, nowMs = Date.now(), { cap = TICKER_NEWS_RUN_CAP, head = TICKER_NEWS_FIXED_HEAD, slotMs = TICKER_NEWS_ROTATION_SLOT_MS } = {}) {
  const list = [...new Set(Array.isArray(eligible) ? eligible : [])];
  if (list.length <= cap) return { targets: list, fixed: list.length, perRun: 0, cycleRuns: 1, offset: 0 };
  const fixed = list.slice(0, Math.min(head, cap));
  const rest = list.slice(fixed.length);
  const perRun = cap - fixed.length;
  const cycleRuns = Math.ceil(rest.length / perRun);
  const offset = (Math.floor(nowMs / slotMs) % cycleRuns) * perRun;
  return { targets: [...fixed, ...rest.slice(offset, offset + perRun)], fixed: fixed.length, perRun, cycleRuns, offset };
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
      // P1683: a session the provider lists with an empty close (KRX 2026-10-12 on Yahoo) is a gap, not a
      // non-session — remember its date so short-window returns across it are not labelled one session.
      out.nullCloseDates = [];
      // 2026-10-13 F07: the listing's own currency and exchange zone travel with the series so a Tokyo or
      // Taipei row is never published as USD on a New York session date.
      out.meta = { currency: res.meta?.currency || null, exchangeTimezoneName: res.meta?.exchangeTimezoneName || null, symbol: res.meta?.symbol || null };
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number' || !isFinite(c)) { if (Number.isFinite(ts[i])) out.nullCloseDates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10)); continue; }
        const h = q0.high?.[i], l = q0.low?.[i], v = q0.volume?.[i];
        const a = Array.isArray(adjArr) ? adjArr[i] : undefined;
        out.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          observedAt: new Date(ts[i] * 1000).toISOString(),
          instrumentId: res.meta?.symbol || null,
          timeframe: res.meta?.dataGranularity || null,
          currency: res.meta?.currency || null,
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

// 2026-10-13 F01/F02: Yahoo's KRX daily close is often not the exchange close (closing call auction not
// reflected — 005930 2026-10-08 262,000 vs 263,000; 14 of the last 26 sessions differed by up to 2.3%), and
// a session it lists with an empty close (KRX 2026-10-12) froze every KR row on the prior session. The
// exchange daily series redistributed by the KR portal keeps the same volumes and split basis, so its
// close/high/low replace Yahoo's on matching dates and fill the empty sessions. Yahoo's adjusted/raw
// ratio is carried onto the corrected close so dividend adjustment is unchanged. If the series is
// missing or disagrees beyond a corporate-action-sized gap, Yahoo values stay and the gap stays listed.
export const KR_EXCHANGE_CLOSE_SOURCE = 'naver-sisejson-daily';
const KR_EXCHANGE_CLOSE_MAX_DEVIATION = 0.15;
const KR_EXCHANGE_FAILURE_LIMIT = 8;
let _krExchangeFailures = 0;
let _krExchangeSuccesses = 0;

export function parseKrDailySeries(text) {
  const rows = [];
  const seen = new Set();
  const rx = /\["(\d{8})",\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+)/g;
  let m;
  while ((m = rx.exec(String(text || ''))) !== null) {
    const d = m[1];
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const check = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== date || seen.has(date)) continue;
    const [open, high, low, close, volume] = m.slice(2, 7).map(Number);
    // An exchange bar must be internally consistent; anything else is not used to correct a provider bar.
    if (!(close > 0) || !(high > 0) || !(low > 0) || high < low || close > high || close < low) continue;
    seen.add(date);
    rows.push({ date, open, high, low, close, volume: Number.isFinite(volume) ? volume : null });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function reconcileKrExchangeCloses(rows, exchangeRows, { nullCloseDates = [], maxDeviation = KR_EXCHANGE_CLOSE_MAX_DEVIATION, fetchedAt = new Date().toISOString(), nowMs = Date.now() } = {}) {
  const base = Array.isArray(rows) ? rows.filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) : [];
  const gaps = Array.isArray(nullCloseDates) ? [...nullCloseDates] : [];
  const report = { source: KR_EXCHANGE_CLOSE_SOURCE, status: 'unavailable', reason: null, compared: 0, correctedCloses: 0, correctedRanges: 0, filledSessions: 0, filledDates: [], maxDeviationPct: null, providerMissingSessions: gaps };
  // An in-session exchange bar (KST trading hours) is a live print, not a close: it neither corrects, fills nor
  // enters the basis-mismatch comparison (an intraday 15% move must not reject the whole year's reconciliation).
  const byDate = new Map((Array.isArray(exchangeRows) ? exchangeRows : []).filter((row) => row && isSessionComplete(row.date, 'kr', nowMs)).map((row) => [row.date, row]));
  if (!base.length || !byDate.size) {
    report.reason = !base.length ? 'provider-series-empty' : 'exchange-series-unavailable';
    return { rows: base, nullCloseDates: gaps, report };
  }
  let maxDev = 0;
  for (const row of base) {
    const x = byDate.get(row.date);
    if (!x || !(row.close > 0)) continue;
    report.compared += 1;
    maxDev = Math.max(maxDev, Math.abs(x.close / row.close - 1));
  }
  report.maxDeviationPct = report.compared ? round(maxDev * 100, 2) : null;
  if (!report.compared) { report.reason = 'no-overlapping-sessions'; return { rows: base, nullCloseDates: gaps, report }; }
  // A split or a different adjustment basis shows up as a large uniform gap; a closing auction does not.
  if (maxDev > maxDeviation) { report.status = 'rejected'; report.reason = 'adjustment-basis-mismatch'; return { rows: base, nullCloseDates: gaps, report }; }
  const ratioOf = (row) => row && row.close > 0 && typeof row.adjClose === 'number' && row.adjClose > 0 ? row.adjClose / row.close : null;
  const out = base.map((row) => {
    const x = byDate.get(row.date);
    if (!x || !(row.close > 0)) return row;
    const closeChanged = x.close !== row.close;
    const rangeChanged = x.high !== row.high || x.low !== row.low;
    if (!closeChanged && !rangeChanged) return row;
    if (closeChanged) report.correctedCloses += 1;
    if (rangeChanged) report.correctedRanges += 1;
    const ratio = ratioOf(row);
    return { ...row, close: round(x.close, 2), high: round(x.high, 2), low: round(x.low, 2), adjClose: ratio == null ? row.adjClose : round(x.close * ratio, 2), closeSource: KR_EXCHANGE_CLOSE_SOURCE };
  });
  const have = new Set(out.map((row) => row.date));
  const firstDate = out[0].date;
  for (const x of byDate.values()) {
    if (x.date < firstDate || have.has(x.date)) continue;
    const prev = [...out].reverse().find((row) => row.date < x.date) || null;
    const next = out.find((row) => row.date > x.date) || null;
    const prevRatio = ratioOf(prev), nextRatio = ratioOf(next);
    // The adjusted/raw ratio of a filled session is known only when both neighbours agree (no ex-date in
    // between) or, for a new latest session, when the previous bar carries no pending adjustment.
    // Tolerance covers the two-decimal rounding of both series relative to the price (a 1,000원 stock's rounding moves
    // the ratio by ~1e-5), still far below any real dividend step. An unknown ratio leaves the session unfilled rather
    // than adding a null adjusted close that breadth and SMA windows would misread.
    const tol = Math.max(1e-6, 0.011 / Math.max(1, Math.min(prev?.close || Infinity, next?.close || Infinity)));
    const ratio = next ? (prevRatio != null && nextRatio != null && Math.abs(prevRatio - nextRatio) < tol ? nextRatio : null)
      : (prevRatio != null && Math.abs(prevRatio - 1) < tol ? 1 : null);
    if (ratio == null) continue;
    const template = prev || next;
    out.push({
      date: x.date,
      observedAt: `${x.date}T00:00:00.000Z`,
      instrumentId: template?.instrumentId || null,
      timeframe: template?.timeframe || null,
      currency: template?.currency || 'KRW',
      close: round(x.close, 2),
      adjClose: round(x.close * ratio, 2),
      high: round(x.high, 2),
      low: round(x.low, 2),
      volume: x.volume == null ? null : Math.round(x.volume),
      fetchedAt,
      closeSource: KR_EXCHANGE_CLOSE_SOURCE,
    });
    have.add(x.date);
    report.filledSessions += 1;
    report.filledDates.push(x.date);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const filled = new Set(report.filledDates);
  report.providerMissingSessions = gaps.filter((date) => !filled.has(date));
  report.status = 'reconciled';
  return { rows: out, nullCloseDates: report.providerMissingSessions, report };
}

// Run-level summary for the artifact: how many KR rows were reconciled, and which were left on provider values.
export function summarizeKrCloseReconciliation(results) {
  const reports = (Array.isArray(results) ? results : []).filter((r) => r && r.closeReconciliation).map((r) => [r.sym, r.closeReconciliation]);
  const byStatus = {};
  let correctedCloses = 0, filledSessions = 0;
  for (const [, report] of reports) {
    byStatus[report.status] = (byStatus[report.status] || 0) + 1;
    correctedCloses += report.correctedCloses || 0;
    filledSessions += report.filledSessions || 0;
  }
  return {
    source: KR_EXCHANGE_CLOSE_SOURCE,
    basis: 'exchange daily close/high/low replace provider values on matching sessions; provider adjusted/raw ratio kept',
    rows: reports.length,
    byStatus,
    correctedCloses,
    filledSessions,
    notReconciled: reports.filter(([, report]) => report.status !== 'reconciled').map(([sym, report]) => [sym, report.reason || report.status]).slice(0, 40),
  };
}

function _krTodayDate(nowMs = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
}

async function fetchKrExchangeDaily(sym, startDate, endDate = _krTodayDate()) {
  const code = String(sym || '').replace(/\.(KS|KQ)$/i, '').toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) return { rows: [], error: 'unsupported-code' };
  // A blocked endpoint (for example from a non-KR runner) fails fast for the rest of the run.
  if (_krExchangeSuccesses === 0 && _krExchangeFailures >= KR_EXCHANGE_FAILURE_LIMIT) return { rows: [], error: 'circuit-open' };
  const url = 'https://api.finance.naver.com/siseJson.naver?symbol=' + code + '&requestType=1&startTime='
    + String(startDate || '').replace(/-/g, '') + '&endTime=' + String(endDate || '').replace(/-/g, '') + '&timeframe=day';
  try {
    const rows = parseKrDailySeries(await _fetchRss(url, 12000));
    if (rows.length) _krExchangeSuccesses += 1; else _krExchangeFailures += 1;
    return { rows, error: rows.length ? null : 'empty-series' };
  } catch (e) {
    _krExchangeFailures += 1;
    return { rows: [], error: String((e && e.message) || e).slice(0, 80) };
  }
}

// history.json 레코드 필드 ↔ Yahoo 심볼 매핑 (백필 대상). F&G/IV는 과거 무료 소스 없어 제외(해당 일자 null).
const HIST_SYMBOLS = {
  '^GSPC': 'spx', '^IXIC': 'nasdaq', '^NDX': 'ndx', '^DJI': 'dow', '^RUT': 'rut',
  '^VIX': 'vix', '^VIX3M': 'vix3m', '^VVIX': 'vvix', '^TNX': 'tnx',
  'DX-Y.NYB': 'dxy', 'CL=F': 'wti', 'GC=F': 'gold',
  // P1721: Brent front-month futures, collected in SYMBOLS already, get the same completed-close column as WTI (CL=F).
  // The 거시 Brent value was FRED's Europe Brent *spot* (DCOILBRENTEU, days behind, 125-135 vs futures ~105 on 10/2-10/6),
  // a different basis than the WTI futures beside it.
  'BZ=F': 'brent',
  '^KS11': 'kospi', '^KQ11': 'kosdaq', 'BTC-USD': 'btc',
  // P1246 (E3/E4 FX 축): USD/KRW도 같은 producer 경로(Yahoo chart 일별 종가, worker 프록시가
  // CORS를 처리)로 일별 히스토리를 갖는다. 새 출처·새 키·새 약관이 없고, 백테스트 랩의 통화 축이
  // 요구하던 "과거 FX 시계열 공급원"이 이 열이다. 교차검증은 FRED DEXKOUS(공식 bilateral)가 한다.
  'KRW=X': 'usdkrw',
  // P1394: USD/JPY joins the FX axis (yen carry / BOJ channel); the <60-observation rule backfills 1y on the next run.
  'JPY=X': 'usdjpy',
  // P1586: 20-year Treasury ETF closes feed the safe-haven component of the self-computed sentiment index.
  'TLT': 'tlt',
};
const HIST_FIELDS = ['spx','nasdaq','ndx','dow','rut','vix','vix3m','vvix','tnx','dxy','wti','brent','gold','kospi','kosdaq','btc','usdkrw','usdjpy','tlt','fg'];
// P1246 (data-refresh: 품질 경계): 히스토리 시장 필드의 **단일** 타당 범위 선언. producer가 이 범위를
// 벗어난 값을 관측으로 승격하지 않고(null + fieldMeta 없음 = P1101의 무관측 표기), 게이트가 같은 선언을
// 가져와 아티팩트를 검사한다 — 선언과 집행이 서로 다른 리터럴을 들고 어긋나는 경로를 만들지 않는다.
export const HIST_FIELD_PLAUSIBILITY = Object.freeze({
  spx: [500, 50000], nasdaq: [500, 100000], ndx: [500, 100000], dow: [2000, 150000], rut: [100, 10000],
  vix: [5, 200], vvix: [20, 400], tnx: [0, 20], dxy: [50, 200], wti: [1, 400], brent: [1, 400],
  gold: [100, 20000], kospi: [300, 20000], kosdaq: [100, 5000], btc: [1000, 2000000],
  // 원/달러는 1997년 외환위기 이후 800~2000원대를 벗어난 적이 없다. 공급자 오류(예: 지수/배율
  // 혼동)로 한 자리·두 자리 수가 들어오면 그대로 히스토리에 남아 백테스트 환산을 오염시킨다.
  usdkrw: [800, 2000],
  usdjpy: [50, 400],
  tlt: [20, 400],
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
const HIST_BREADTH_FIELDS = ['breadth20','breadth50','breadth200','advanceRatio','advanceDecline','breadth40','breadthUp4','breadthDown4','breadthNewHighs','breadthNewLows','distributionDays']; // P1416
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
// Codex browser audit H02 (2026-10-07): no refresh ran between the US 10/5 close and the 10/6 open, so the 10/5
// S&P 500 close never entered history and "어제와 달라진 점" compared 10/2 with 10/6. The daily backfill only ran
// for thin histories. A completed US session missing from the last ten days now triggers the same backfill,
// which writes the provider's daily bar for that session (completed bars only, P1399).
export function missingRecentUsSessions(hist, nowMs = Date.now(), lookbackDays = 10) {
  const basis = latestCompletedUsSession(nowMs);
  if (!basis?.date) return [];
  const have = new Set();
  for (const row of Array.isArray(hist) ? hist : []) {
    if (!Number.isFinite(Number(row?.spx))) continue;
    const meta = row?.fieldMeta?.spx;
    if (meta?.observationRelation === 'carried-forward') continue;
    const at = meta?.observedAt ? Date.parse(meta.observedAt) : NaN;
    have.add(Number.isFinite(at) ? nyParts(at).date : row.date);
  }
  const missing = [];
  let cursor = basis.date;
  for (let i = 0; i < lookbackDays; i += 1) {
    const session = resolveMarketCalendarSession({ market: 'US', date: cursor });
    if (session?.status === 'open' && !have.has(cursor)) missing.push(cursor);
    cursor = new Date(Date.parse(`${cursor}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return missing.sort();
}

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
      if (!isSessionComplete(row.date, /^\^?(KS|KQ)/.test(r.sym) ? 'kr' : 'us')) continue; // P1399: no partial bar
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
      // P1656: a backfill only fills gaps. It runs whenever any field is thin, so overwriting every row
      // replaced the producer's completed-close record (valueBasis, close-time observedAt) with a daily bar
      // stamped at its bar start, and the score's close-basis selector then rejected that day's VIX/SPX.
      existing.fieldMeta = existing.fieldMeta || {};
      for (const f of HIST_FIELDS) {
        if (byDate[date][f] == null) continue;
        if (Number.isFinite(Number(existing[f])) && existing.fieldMeta[f]?.valueBasis) continue;
        existing[f] = byDate[date][f];
        if (byDate[date].fieldMeta?.[f]) existing.fieldMeta[f] = byDate[date].fieldMeta[f];
      }
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

export function usPreOpenIndexPrint(symbol, observedAt) {
  if (!/^\^(VIX|VIX3M|VVIX|GSPC|IXIC|NDX|DJI|RUT|TNX)$/.test(String(symbol || ''))) return false;
  const at = Date.parse(observedAt || '');
  if (!Number.isFinite(at)) return false;
  const parts = nyParts(at);
  const day = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return !['Sat', 'Sun'].includes(day) && parts.minute < 9 * 60 + 30;
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
      // P1656: VIX-family indices also print in Cboe's extended hours; a weekday print before the 09:30 ET open
      // is that session's pre-open value, not a completed close (10/12 07:01 ET VIX 15.48 was filed as one).
      const preOpenPrint = !isOpenPoint && usPreOpenIndexPrint(q.symbol, q.observedAt);
      const usePreviousClose = (isOpenPoint || preOpenPrint) && Number.isFinite(previousClose) && previousClose > 0;
      // P1576: in session without a previous close there is no completed close to record; the
      // intraday price must not be written as one (fail closed, like P1095's timestamp rule).
      bySym[q.symbol] = usePreviousClose ? previousClose : (isOpenPoint || preOpenPrint) ? null : q.regularMarketPrice;
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
    // P1586: the Cboe total put/call ratio accumulates one point per trading date (the page's own date,
    // never the fetch day) so the self-computed sentiment index can average five sessions.
    if (data.putCall?.status === 'current-reference' && /^\d{4}-\d{2}-\d{2}$/.test(String(data.putCall.asOf || '')) && Number.isFinite(Number(data.putCall.totalPutCall))) {
      let row = hist.find((item) => item?.date === data.putCall.asOf);
      if (!row) { row = { date: data.putCall.asOf, fieldMeta: {} }; hist.push(row); }
      row.pcr = Number(data.putCall.totalPutCall);
      row.fieldMeta = { ...(row.fieldMeta || {}), pcr: { observedAt: data.putCall.asOf, fetchedAt, lastSuccessfulAt: fetchedAt, source: 'Cboe Daily Market Statistics', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-history' } };
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
    const missingSessions = missingRecentUsSessions(hist);
    if (missingSessions.length) console.log(`[fetch-data] 최근 미국 거래일 종가 누락 ${missingSessions.join(',')} — 일봉 백필 실행`);
    if (hist.length < 60 || process.env.BACKFILL === '1' || needsFieldMeta || needsFieldBackfill || missingSessions.length) {
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
async function getScreenerUniverse() {
  try {
    const raw = await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8');
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
    // 2026-10-13 (owner: S&P 500 map): one- and five-session returns on the same completed close series, so the
    // sector map can colour a day or a week without republishing raw prices (P715 keeps prices out).
    ret1d: _retPct(closes, 1), ret5d: _retPct(closes, 5),
    ret1m: _retPct(closes, 21), ret3m: _retPct(closes, 63), ret6m: _retPct(closes, 126),
    vol: vol60, rsi: _rsi14(closes),
    pctSma50: (sma50 && sma50 > 0) ? round((price / sma50 - 1) * 100, 2) : null,
    pctSma200: (sma200 && sma200 > 0) ? round((price / sma200 - 1) * 100, 2) : null,
    // 2026-10-14 (owner: custom screener conditions): short averages and the 1-year closing high as distances on the
    // same series, so "5/10/20 정배열" and "52주 신고가" are read without publishing a raw price (P715).
    ...Object.fromEntries([5, 10, 20].map((n) => { const sma = _mean(closes.slice(-n)); return [`pctSma${n}`, sma > 0 ? round((price / sma - 1) * 100, 2) : null]; })),
    pctFromCloseHigh52w: closes.length >= 250 ? (() => { const high = Math.max(...closes.slice(-252)); return high > 0 ? round((price / high - 1) * 100, 2) : null; })() : null,
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
  var sectorOf = opts && typeof opts.sectorOf === 'function' ? opts.sectorOf : function() { return null; };
  var liveActiveFactorsSeen = [];
  // P1449: model identity — the canonical string the UI compares against its live model before
  // presenting stored rows as validation of the current ranking.
  var modelFingerprint = buildScreenerModelFingerprint({
    rebalanceOffsets: OFFSETS,
    fwdDays: FWD,
    transactionCostBps: transactionCostBps
  });
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
      // P1443: the same trend definition as the live model (50-day 60%, 200-day 40%).
      var trParts = [isNum(f.pctSma50) ? { v: f.pctSma50, w: 0.6 } : null, isNum(f.pctSma200) ? { v: f.pctSma200, w: 0.4 } : null].filter(Boolean);
      var trW = trParts.reduce(function(sum, p){ return sum + p.w; }, 0);
      var tr = trW > 0 ? trParts.reduce(function(sum, p){ return sum + p.v * p.w; }, 0) / trW : null;
      var kalman = isNum(f.kalmanVelConf) ? f.kalmanVelConf : (isNum(f.kalmanVel) ? f.kalmanVel : null);
      var liquidity = _historicalLiquidity(s, p, liquidityWindowDays);
      rows.push({
        sym: s.sym || s.symbol || null,
        rebalanceDate: rebalanceDate,
        forwardDate: forwardDate,
        mom: mom, trend: tr, lowvol: isNum(f.vol) ? -f.vol : null, kalman: kalman, fwd: fwd, f: f,
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
    // P1443/I P1449: the composite is the live model itself — computeFactorRanks with the
    // same raw definitions (trend 60/40 of the 50/200-day distances), sector-relative z-scores,
    // coverage gates and the live model default weights (factor-weights.js NEUTRAL, one
    // weights module) — run on the factor values known at the rebalance date. The former
    // percentile-weighted re-implementation (trend as a plain mean, universe percentiles) ranked a
    // different model, so its IC did not validate the ranking on screen; the weights are now
    // passed explicitly so the validation can never drift back to a second copy of the vector.
    var asOf = rebalanceDate + 'T21:00:00.000Z';
    var live = computeFactorRanks({
      weights: MODEL_DEFAULT_WEIGHTS,
      weightsPolicy: 'model-default',
      rows: rows.map(function(r) {
        return { sym: r.sym, sector: sectorOf(r.sym), ret1m: r.f.ret1m, ret3m: r.f.ret3m, ret6m: r.f.ret6m,
          pctSma50: r.f.pctSma50, pctSma200: r.f.pctSma200, vol: r.f.vol, kalmanVel: r.f.kalmanVel, kalmanVelConf: r.f.kalmanVelConf,
          adjustedCloseStatus: 'complete', observedAt: asOf, factorSourceKind: 'T3_PUBLIC_DELAYED',
          factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT' } };
      }),
      now: Date.parse(asOf) + 3600000,
      inputVersion: 'backtest:' + rebalanceDate
    });
    var liveRank = new Map((live && Array.isArray(live.rows) ? live.rows : []).map(function(row) { return [row.sym, isNum(row.rank) ? row.rank / 100 : null]; }));
    if (live && live.activeFactors) liveActiveFactorsSeen.push(live.activeFactors.join('+'));
    rows.forEach(function(r){
      r.comp = r.sym && liveRank.has(String(r.sym).toUpperCase()) ? liveRank.get(String(r.sym).toUpperCase()) : null;
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
      // P1443: the spread (top mean − bottom mean) is the return of $1 long plus $1 short, so the
      // positions — and therefore turnover and cost — use the same ±1 gross legs (was ±0.5).
      var longWeight = 1 / q, shortWeight = -1 / q;
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
    modelFingerprint: modelFingerprint,
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
    // P1443: what the two rates actually count — not a per-stock direction accuracy.
    hitRateMeaning: 'share of rebalances where the top-quintile mean forward return exceeded the bottom quintile (gross / net of cost)',
    rebalancesCounted: hitN,
    modelParity: {
      composite: 'live computeFactorRanks (factor-ranks.js) on factor values known at each rebalance date',
      activeFactors: liveActiveFactorsSeen.length ? [...new Set(liveActiveFactorsSeen)] : [],
      notValidated: ['size (no historical shares outstanding)', 'value / quality (no point-in-time fundamentals)'],
      longShortGross: '±1 legs (spread and cost on the same exposure)'
    },
    turnover: {
      rebalanceCount: turnoverValues.length,
      average: turnoverValues.length ? round(_mean(turnoverValues), 4) : null,
      maximum: turnoverValues.length ? round(Math.max(...turnoverValues), 4) : null,
      unit: 'absolute portfolio-weight change; ±1 gross long/short equal-weight quintiles'
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
    compWeights: 'factor-weights.js NEUTRAL renormalized over the computable factors — the same live model default ranking uses (P1449 fingerprint below)', // P1443/I P1449: it was a hand copy of the same thing that drifted
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

export async function enrichSecFundamentals(syms, priceData, priceResults = null, assetTypeOf = {}) {
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
      // 2026-10-13 F08: ETFs/trusts carry no operating financials (USO margin 115%, SLV negative revenue).
      if (assetTypeOf?.[sym] === 'ETF' || String(priceData?.[sym]?.assetType || '').toUpperCase() === 'ETF') continue;
      // P1402 parent equity + F03/F05 heal (revenue per period, margin > 100% withheld, other-year shares dropped).
      const row = reconcileSecRecord(rows[sym]);
      if (!row || !row.fetchedAt || Date.now() - new Date(row.fetchedAt).getTime() > maxFetchAge) continue;
      const rec = {};
      const px = priceBySym.get(sym);
      // F04/F10: only a share count matched to EPS by the producer, or (older/unchecked records) one whose implied
      // daily turnover is plausible, may price P/E, P/B or the reference market cap. PKG's stored 1000x cover count
      // (P/E 26,255) fails the turnover band; a stale-period or scale-mismatched count is never used.
      const trust = secSharesTrust(row, { price: px, dollarVolume30d: priceData?.[sym]?.dollarVolume30d });
      ['roe','margin','revGrowth'].concat(trust.shares ? ['pe','pb'] : []).forEach(key => {
        if (typeof row[key] === 'number' && Number.isFinite(row[key])) rec[key] = row[key];
      });
      if (Number.isFinite(px) && px > 0 && trust.shares) {
        const shares = trust.shares;
        const netIncome = Number(row.netIncome);
        const equity = Number(row.equity);
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
        // F10: the reference market cap needs only a close and a verified count, not positive earnings or equity.
        rec.valuationPrice = px;
        rec.valuationPriceBasis = 'adjusted-close';
        rec.valuationSharesOutstanding = shares;
        rec.valuationSharesObservedAt = row.sharesObservedAt || null;
        rec.valuationSharesCheck = trust.check;
        rec.valuationSharesBasis = row.sharesBasis || 'dei-cover';
      }
      // P1652: a filing whose period ended over 15 months ago is not current fundamentals (companyfacts concept gaps
      // left WFC on FY2019 and NEE on FY2012); the fields stay missing rather than ranking on a stale year.
      // F15: the same 456-day fiscal-year-end age (period.js FUNDAMENTAL_MAX_PERIOD_AGE_DAYS) sets the quality label.
      const sessionMs = Date.parse(String(priceData?.[sym]?.factorSessionDate || '').slice(0, 10));
      const reportAgeDays = row.observedAt ? Math.floor(((Number.isFinite(sessionMs) ? sessionMs : Date.now()) - Date.parse(row.observedAt)) / 86400000) : null;
      if (row.observedAt && (Date.now() - Date.parse(row.observedAt)) / 86400000 > 456) continue;
      // P1652: P/E under 2 or P/B under 0.1 is a share-class/unit mismatch (BRK-B, IBKR), not a valuation — and the
      // same share basis cannot size a reference market cap either.
      const shareBasisMismatch = (rec.pe != null && !(rec.pe >= 2)) || (rec.pb != null && !(rec.pb >= 0.1));
      if (rec.pe != null && !(rec.pe >= 2)) { delete rec.pe; delete rec.pePrice; delete rec.pePriceBasis; }
      if (rec.pb != null && !(rec.pb >= 0.1)) { delete rec.pb; delete rec.pbPrice; delete rec.pbPriceBasis; }
      if (shareBasisMismatch) {
        ['valuationPrice', 'valuationPriceBasis', 'valuationSharesOutstanding', 'valuationSharesObservedAt', 'valuationSharesCheck', 'valuationSharesBasis'].forEach((key) => delete rec[key]);
        rec.valuationHeldReason = 'share-class-or-unit-mismatch';
      }
      if (!trust.shares) rec.valuationHeldReason = trust.reason;
      if (!['pe', 'pb', 'roe', 'margin', 'revGrowth', 'valuationSharesOutstanding'].some((key) => rec[key] != null)) continue;
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
        // F15: CURRENT meant "has a filing date" (624/624 rows). The label now follows the fiscal-year-end age
        // against the factor session (456-day rule); rows past it are not merged at all (above).
        fundamentalQuality: {
          status: !(row.availableAt || row.acceptedAt || row.filedAt) ? 'MISSING' : reportAgeDays != null && reportAgeDays <= 456 ? 'CURRENT' : 'STALE',
          stale: !(row.availableAt || row.acceptedAt || row.filedAt) || !(reportAgeDays != null && reportAgeDays <= 456),
          basis: 'fiscal-year-end-age',
          period: 'FY',
          reportAgeDays,
          maxAgeDays: 456,
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
// Mean of daily close x volume over the last `window` sessions, the same rule as _historicalLiquidity
// (positive close and volume only, at least min(10, window) usable sessions). `divisors` converts each
// session at its own FX rate (native units per USD); a session without a rate is not counted.
export function dailyNotionalAverage(closes, volumes, { window = 30, divisors = null, minObservations = BACKTEST_MIN_LIQUIDITY_OBSERVATIONS } = {}) {
  const n = Math.min(Array.isArray(closes) ? closes.length : 0, Array.isArray(volumes) ? volumes.length : 0);
  const lookback = Math.max(1, Number(window) || 30);
  const values = [];
  for (let i = Math.max(0, n - lookback); i < n; i += 1) {
    const close = Number(closes[i]);
    const volume = Number(volumes[i]);
    const divisor = divisors ? Number(divisors[i]) : 1;
    if (Number.isFinite(close) && close > 0 && Number.isFinite(volume) && volume > 0 && Number.isFinite(divisor) && divisor > 0) values.push(close * volume / divisor);
  }
  if (!values.length || values.length < Math.min(minObservations, lookback)) return null;
  return { value: _mean(values), observations: values.length, windowSessions: lookback };
}

// FX close on or before a session date (at most `maxLagDays` earlier). `series` is date-sorted [{date, close}].
export function fxRateOnOrBefore(series, date, maxLagDays = 4) {
  if (!Array.isArray(series) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  let found = null;
  for (const point of series) { if (point.date <= date) found = point; else break; }
  if (!found || !(found.close > 0)) return null;
  const lagDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${found.date}T00:00:00Z`)) / 86400000;
  return lagDays <= maxLagDays ? found.close : null;
}

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
    // 2026-10-13 F21: traded value is the mean of each session's close x volume (the backtest liquidity
    // definition), not today's close times the average volume, which moved the 30-day figure with one print.
    dollarVolume30d: (() => { const notional = dailyNotionalAverage(closes.slice(0, n), volumes.slice(0, n), { window: 30 }); return notional ? Math.round(notional.value) : null; })(),
    lastVolume: latestVolume == null ? null : Math.round(latestVolume),
    // v57.51 F11: 20-session relative volume — the last session's volume over the mean of the 20 sessions before it
    // (the chart's _calcRVOL definition). The '돌파 관찰' preset read this field while no producer wrote it.
    rvol20: (() => {
      if (latestVolume == null || n < 16) return null;
      const base = volumes.slice(Math.max(0, n - 21), n - 1).filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      const mean = base.length >= 15 ? avg(base) : null;
      return mean > 0 ? round(latestVolume / mean, 2) : null;
    })(),
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
    const rows = (fetched || []).filter((row) => !row?.date || isSessionComplete(row.date, market));
    const partialSessionDropped = (fetched || []).length - rows.length;
    const nullCloseDates = providerNullCloseDates.filter((date) => isSessionComplete(date, market));
    if (closeReconciliation) {
      closeReconciliation.providerMissingSessions = nullCloseDates;
      closeReconciliation.filledDates = closeReconciliation.filledDates.filter((date) => isSessionComplete(date, market));
      closeReconciliation.filledSessions = closeReconciliation.filledDates.length;
    }
    return {
      sym,
      partialSessionDropped,
      providerMeta,
      closeReconciliation,
      nullCloseDates,
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
      // P1683: a completed session with an empty provider close inside the 1- or 5-session window makes that
      // return span an extra session — publish null (the map greys it) instead of a mislabelled move.
      const gaps = Array.isArray(r.nullCloseDates) ? r.nullCloseDates : [];
      const dates = Array.isArray(r.dates) ? r.dates : [];
      const gapInside = (n) => dates.length > n && gaps.some((date) => date > dates[dates.length - 1 - n] && date < dates[dates.length - 1]);
      if (gapInside(1)) f.ret1d = null;
      if (gapInside(5)) f.ret5d = null;
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
      f.currency = quoteCurrencyOf(r);
      f.listingMarket = listingMarketOfSymbol(r.sym);
      f.dollarVolumeCurrency = f.currency;
      const nativeNotional = dailyNotionalAverage(r.closes, r.volumes, { window: 30 });
      f.tradedValue30d = nativeNotional ? Math.round(nativeNotional.value) : null;
      f.tradedValueCurrency = f.currency;
      f.tradedValueBasis = 'mean-session-close-x-volume-30-sessions';
      if (f.currency && f.currency !== 'USD') {
        const fx = fxSeries.get(f.currency) || null;
        const divisors = fx ? (r.dates || []).map((date) => fxRateOnOrBefore(fx, date)) : null;
        const lastDivisor = divisors && divisors.length ? divisors[divisors.length - 1] : null;
        if (divisors && lastDivisor > 0) {
          const usd = dailyNotionalAverage(r.closes, r.volumes, { window: 30, divisors });
          f.dollarVolume30d = usd ? Math.round(usd.value) : null;
          f.dollarVolume = f.dollarVolume != null ? Math.round(f.dollarVolume / lastDivisor) : null;
          f.dollarVolumeCurrency = 'USD';
          f.dollarVolumeFx = { symbol: `${f.currency}=X`, quote: `${f.currency} per USD`, basis: 'daily-close-on-or-before-session-date', maxLagDays: 4 };
        } else {
          // No rate: the native figure stays in tradedValue30d; the USD fields are not published.
          f.dollarVolume30d = null;
          f.dollarVolume = null;
        }
      }
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
      // F07: the session date is read in the listing's exchange zone (provider zone first, suffix map second).
      const sessionZone = timeZoneForMarket(r.providerMeta?.exchangeTimezoneName || timeZoneForSymbol(r.sym));
      f.factorSessionDate = sessionDateInMarket(r.observedAt, sessionZone);
      f.factorSessionTimezone = sessionZone;
      if (r.closeReconciliation) f.closeReconciliation = r.closeReconciliation;
      else if (Array.isArray(r.nullCloseDates) && r.nullCloseDates.length) f.providerMissingSessions = r.nullCloseDates;
      f.factorTimeBasis = 'bar-start';
      f.factorComputedAt = computedAt;
      f.factorSourceKind = 'T3_PUBLIC_DELAYED';
      f.factorAllowedUse = 'research-relative-ranking-only';
      f.factorQuality = deriveFactorQuality({ observedAt: r.observedAt, computedAt });
      f.factorBarCompleteness = 'completed-sessions-only';
      if (r.partialSessionDropped) f.partialSessionDropped = r.partialSessionDropped;
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
  try { universeRows = JSON.parse(await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8')).universe || []; } catch (_) { universeRows = []; }
  const meta = new Map(universeRows.filter((row) => row && row.sym).map((row) => [row.sym, row]));
  const names = Object.fromEntries([...meta].map(([sym, row]) => [sym, row.name || '']));
  // Universe order (largest names first) is the rotation order; ETFs and rows without a name are not covered.
  // v57.51: the same ETF rule as breadth and SEC (sector SPDRs carry a GICS sector but index 'ETF').
  const eligible = prioSyms.filter((sym) => data[sym] && meta.has(sym) && screenerAssetType(meta.get(sym)) !== 'ETF' && names[sym]);
  let previous = {};
  try { previous = JSON.parse(await readFile(SCREENER_OUT, 'utf8')).data || {}; } catch (_) { previous = {}; }
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
      // 2026-10-13 F04/F10: the verified share basis and the close it multiplies travel with the row.
      ['pePrice','pePriceBasis','pbPrice','pbPriceBasis','valuationPrice','valuationPriceBasis','valuationSharesOutstanding','valuationSharesObservedAt','valuationSharesCheck','valuationSharesBasis','valuationHeldReason'].forEach(key => {
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
      universeMeta: universeLineage,
      sectorOf: (sym) => universeInfo.sectors?.[sym] ?? null // P1443: live-model parity (sector-relative z-scores)
    });
  }
  catch (e) { console.warn('[fetch-data] backtest 실패(무시):', e && e.message || e); }
  const assetTypeOf = (sym) => universeInfo.assetType?.[sym] ?? null;
  let sp500Weights = null;
  try { sp500Weights = JSON.parse(await readFile(new URL('../public-data/sp500-weights.json', import.meta.url), 'utf8')); } catch { /* not collected yet */ }
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
  await atomicWriteFile(SCREENER_OUT, JSON.stringify(payload));
  // P1465: record today's default-profile candidates (the page's own ranking path on the files just
  // written) and fill the outcomes of entries whose 21-session window has closed. Non-fatal.
  try {
    const archiveInfo = await updateCandidateArchive({ root: new URL('../', import.meta.url), results, write: (url, text) => atomicWriteFile(fileURLToPath(url), text) });
    console.log(`[fetch-data] candidate archive: ${archiveInfo.action} ${archiveInfo.date || '-'} · entries ${archiveInfo.entries} · measured ${archiveInfo.measured} (+${archiveInfo.filled})`);
  } catch (e) { console.warn('[fetch-data] candidate archive 실패(무시):', e && e.message || e); }
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
      // P1372: an intraday delayed value must not be narrated as a close.
      session: canonical?.session || row?.marketState || null,
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

// P1585: the first number after a label was taken as the level, so a correct Korean sentence that
// states the move first ("SPX는 0.66% 오른 7,816") failed as metric-value-mismatch on every quote
// and blocked ~70% of market analyses. Within the label's clause, skip change-like numbers (signed,
// %p/bp/포인트, a following up/down verb, or a % on a non-rate level) and compare the first level.
function _analysisNumberAfterLabel(body, labels) {
  const allLabels = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]
    .flatMap(def => [def.label, ...(def.aliases || [])]);
  return analysisLevelsAfterLabels(body, labels, { allLabels })[0] ?? null;
}

// T03/T08 (v57.48 review, 2026-10-13): a verified analysis opened "유가 -6.40%인 코스피는 장중 하락" (-6.40% was
// KOSPI's move) and "금리 -0.08%" (a relative change of the yield, read as -8bp). The validator compared only the
// level after an English label, so Korean names and % moves were never checked. Every mention — English label or the
// Korean name the model actually writes — now has its % move checked against that metric's own changePct, a rate may
// move only in bp, and an in-session value must be written as 장중 with its time.
export const MARKET_ANALYSIS_CLOSED_SESSIONS = Object.freeze(['MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED', 'REGULAR']);
const MARKET_ANALYSIS_MENTIONS = Object.freeze({
  'market.spx': ['S&P\\s?500', 'SPX', 'S&P', '에스앤피\\s?(?:오백|500)'],
  'market.vix': ['VIX', '변동성\\s?지수', '공포\\s?지수'],
  'market.us10y': ['US 10Y', '10Y', 'Treasury', '(?:미(?:국)?\\s?)?(?:10년물|10년\\s?국채|국채\\s?10년물?)(?:\\s?(?:금리|수익률))?',
    // review: a bare 금리 is the 10-year only when no other tenor/kind qualifies it (2년물·실질·정책·기준 금리 are other series).
    '(?<![가-힣])(?<!(?:\\d\\s?(?:년물|년|개월물|개월)|실질|정책|기준|단기|장기|명목|모기지|대출|예금|회사채)\\s?)금리'],
  'market.dxy': ['DXY', '달러\\s?(?:지수|인덱스)'],
  'market.wti': ['WTI', 'oil', '(?<![가-힣])유가', '(?<![가-힣])원유'],
  'market.gold': ['Gold', '(?<![가-힣])금(?:값|\\s?가격|\\s?선물)?(?=[은는이가을를도의과와·,\\s]|$)'],
  'market.kospi': ['KOSPI', '코스피(?!\\s?200)'],
});
const MARKET_ANALYSIS_MENTION_ENTRIES = Object.entries(MARKET_ANALYSIS_MENTIONS).flatMap(([metricId, patterns]) => patterns.map((source) => {
  const latin = /^[A-Za-z]/.test(source);
  return { metricId, latin, source: latin ? `(?<![A-Za-z0-9_.:-])${source}(?![A-Za-z0-9_.:-])` : source };
}));
const MARKET_ANALYSIS_MENTION_RE = new RegExp(MARKET_ANALYSIS_MENTION_ENTRIES.map((entry) => `(${entry.source})`).join('|'), 'gi');

/** Every metric mention with the clause that belongs to it (up to the next mention or the sentence end). */
export function analysisMetricMentions(text) {
  const body = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const hits = [...body.matchAll(MARKET_ANALYSIS_MENTION_RE)].map((match) => {
    const entry = MARKET_ANALYSIS_MENTION_ENTRIES[match.slice(1).findIndex((group) => group !== undefined)];
    return { metricId: entry.metricId, latin: entry.latin, start: match.index, end: match.index + match[0].length };
  });
  return hits.map((hit, index) => {
    const stop = Math.min(hit.end + 60, hits[index + 1]?.start ?? Infinity);
    const clause = body.slice(hit.end, stop).split(/(?<!\d)[.。](?!\d)|\n|[;；]/)[0];
    const sentenceStart = Math.max(body.lastIndexOf('.', hit.start), body.lastIndexOf('\n', hit.start), body.lastIndexOf('。', hit.start)) + 1;
    const sentenceEnd = body.slice(hit.end).search(/(?<!\d)[.。](?!\d)|\n/);
    return { ...hit, clause, sentence: body.slice(sentenceStart, sentenceEnd < 0 ? body.length : hit.end + sentenceEnd) };
  });
}

const ANALYSIS_UP = /(?:상승|오른|올라|올랐|급등|반등|강세|높아|뛴|확대)/;
const ANALYSIS_DOWN = /(?:하락|내린|내려|내렸|떨어|급락|약세|낮아|빠진|축소)/;
/** % moves, bp moves and Korean-name levels checked against each metric's own evidence. */
export function validateAnalysisMetricMentions(text, metricEvidence = [], changes = new Map(), { context = '' } = {}) {
  const issues = [];
  const supported = (digits) => !!context && context.includes(digits);
  for (const mention of analysisMetricMentions(text)) {
    const row = metricEvidence.find((item) => item.metricId === mention.metricId);
    if (!row) continue;
    const rate = row.unit === 'percent';
    const level = Number(row.value);
    const changePct = changes.get(row.evidenceId);
    const bpChange = rate && Number.isFinite(changePct) ? (level - level / (1 + changePct / 100)) * 100 : null;
    const inSession = !!row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session);
    let usedIntraday = false;
    let levelSeen = false;
    for (const match of mention.clause.matchAll(/([+\-−±]?)(\d[\d,]*(?:\.\d+)?)\s*(%포인트|%p|bps|bp|포인트|%)?/gi)) {
      const [, sign, digits, suffix = ''] = match;
      const after = mention.clause.slice(match.index + match[0].length, match.index + match[0].length + 14);
      // P1719: one date/time/count rule shared with the label-level reader (10월·오후 3시 are not levels).
      if (isNonMetricNumber(mention.clause, match.index, match[0].length) || /^(?:%p|%포인트|포인트)$/i.test(suffix)) continue;
      // review: a multi-period move ("20일 동안 8.2% 하락") or a share ("40%를 차지") is not the one-session change.
      const before = mention.clause.slice(Math.max(0, match.index - 16), match.index);
      if (/(?:\d\s?(?:일|주|개월|년|거래일|세션)|연초|연간|올해|분기|월간|주간)[^\d]{0,8}$/.test(before) || /^\s*(?:를|을|의|가|이)?\s*(?:차지|비중|비율|확률|가능성|점유)/.test(after)) continue;
      const magnitude = Number(digits.replace(/,/g, ''));
      if (!Number.isFinite(magnitude)) continue;
      const direction = sign === '-' || sign === '−' ? -1 : sign === '+' ? 1 : ANALYSIS_DOWN.test(after) ? -1 : ANALYSIS_UP.test(after) ? 1 : 0;
      const moved = direction !== 0;
      const stated = direction ? direction * magnitude : magnitude;
      const plain = digits.replace(/,/g, '');
      if (/^bps?$/i.test(suffix)) {
        const gap = direction ? Math.abs(stated - bpChange) : Math.abs(magnitude - Math.abs(bpChange));
        if (rate && bpChange != null && gap > Math.max(1, Math.abs(bpChange) * 0.25) && !supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (suffix === '%') {
        if (rate) {
          if (moved) issues.push(`rate-change-not-bp:${row.metricId}`);
          else if (!mention.latin && Math.abs(magnitude - level) > 0.15 && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
          continue;
        }
        if (!Number.isFinite(changePct)) continue;
        // v57.50 (live 10/13): KOSPI fell 5.46% and the commentary was blocked for "5% 이상 급락", the wording of the
        // news it cited. A bound ("N% 이상/넘게") holds when the move reaches N; an approximation ("약·거의 N%",
        // "N% 가까이/안팎/가량") holds within max(0.5, 10%) of N. The direction must still agree when one is stated.
        const bound = /^\s*(?:이상|넘게|넘는|넘어|초과|웃도)/.test(after);
        const approx = /(?:약|거의|대략|무려)\s*$/.test(before) || /^\s*(?:가까이|가량|안팎|내외|정도|근처)/.test(after);
        const sameWay = !direction || Math.sign(changePct) === direction || changePct === 0;
        const matches = bound ? sameWay && Math.abs(changePct) >= magnitude - 0.15
          : approx ? sameWay && Math.abs(Math.abs(changePct) - magnitude) <= Math.max(0.5, magnitude * 0.1)
            : direction ? Math.abs(stated - changePct) <= 0.15 : Math.abs(magnitude - Math.abs(changePct)) <= 0.15;
        if (matches) usedIntraday = usedIntraday || inSession;
        else if (!supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (moved || levelSeen) continue;
      levelSeen = true;
      const tolerance = Math.max(rate ? 0.15 : 0.5, Math.abs(level) * 0.02);
      if (Math.abs(magnitude - level) <= tolerance) usedIntraday = usedIntraday || inSession;
      else if (!mention.latin && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
    }
    if (usedIntraday && !(/장중/.test(mention.sentence) && /\d{1,2}:\d{2}|\d{1,2}시(?:\s?\d{1,2}분)?/.test(mention.sentence))) issues.push(`intraday-time-missing:${row.metricId}`);
  }
  return [...new Set(issues)];
}

// M06: typed admission for the claims the prompt forbids or the evidence can disprove. These are blocking issues.
const ANALYSIS_TRADE_INSTRUCTION = /(?:매수|매도|매집|손절|익절|진입|청산)(?:하세요|하십시오|해라|하라|할\s*때입니다|하시길)|(?:사세요|파세요|사라|팔아라|담으세요|비중을\s*(?:늘리|줄이)세요)|목표\s*가(?:는|를)?\s*\$?\d|\b(?:buy|sell)\s+now\b/i;
const ANALYSIS_PROBABILITY = /\d+(?:\.\d+)?\s*%\s*(?:의\s*)?(?:확률|가능성|승률)|(?:확률|가능성|승률)(?:은|이|는|로|이\s*약)?\s*(?:약\s*)?\d+(?:\.\d+)?\s*%/;
export function validateAnalysisAdmission(body, { changes = new Map(), context = '' } = {}) {
  const issues = [];
  if (ANALYSIS_TRADE_INSTRUCTION.test(body)) issues.push('trade-instruction');
  if (ANALYSIS_PROBABILITY.test(body)) issues.push('probability-claim');
  // Condition counts must be well-formed and, when a regime context was supplied, appear in it.
  for (const match of body.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:개)?\s*(?:조건|충족)|(?:조건|부합)\s*(\d+)\s*\/\s*(\d+)/g)) { // T06: "현재 조건 부합 n/m"
    const met = Number(match[1] ?? match[3]); const total = Number(match[2] ?? match[4]);
    if (!(total > 0) || met > total || total > 10) issues.push('condition-count-invalid');
    else if (context && !new RegExp(String.raw`(?:조건\s*${met}\s*/\s*${total}|${met}\s*/\s*${total})`).test(context)) issues.push('condition-count-unsupported');
  }
  // Day-over-day change: a stated "변화/상승/하락 x%" near a label must match the evidence change within 0.15%p.
  for (const match of body.matchAll(/(?:변화율|등락률|상승률|하락률|변화|등락)\s*(?:은|는|이|가|률은)?\s*([+\-−]?\d+(?:\.\d+)?)\s*%/g)) {
    const stated = Number(match[1].replace('−', '-'));
    if (Math.abs(stated) > 25) { issues.push('change-implausible'); continue; }
    // A multi-day change quoted from the regime context (e.g. 20일 변화) is supported by that context.
    const inContext = context && context.includes(String(Math.abs(stated)));
    if (changes.size && !inContext && ![...changes.values()].some((value) => Math.abs(Math.abs(value) - Math.abs(stated)) <= 0.15)) issues.push('change-unsupported');
  }
  return [...new Set(issues)];
}

function analysisContextHasNumber(context, value) {
  if (!context || !Number.isFinite(value)) return false;
  const forms = new Set([String(value), value.toLocaleString('en-US', { maximumFractionDigits: 6 })]);
  return [...forms].some((form) => new RegExp(`(?<![\\d.,-])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`).test(context));
}

const ANALYSIS_REFERENCE_LEVEL = /^\s*[(（]?\s*(?:\d+\s*일\s*(?:선|이동평균|평균)|이동평균|이평|고점|저점|평균|전일|직전|지지|저항|대비|52주)/;
export function analysisNumberMarkedAsReference(body, value) {
  const forms = new Set([String(value), Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 })]);
  const text = String(body || '');
  for (const form of forms) {
    const pattern = new RegExp(`(?<![\\d.,-])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`, 'g');
    let match;
    while ((match = pattern.exec(text))) {
      const before = text.slice(Math.max(0, match.index - 16), match.index);
      if (/(?:일선|이동평균|이평|고점|저점|평균|전일|직전|지지|저항|52주)\s*$|(?:일선|이동평균|고점|저점)\D{0,6}$/.test(before)) return true;
      if (ANALYSIS_REFERENCE_LEVEL.test(text.slice(match.index + match[0].length))) return true;
    }
  }
  return false;
}

export function validateMarketAnalysisText(text, data, snapshot = null, { context = '' } = {}) {
  const issues = [];
  // P1122: `warnings` never withholds the analysis; it names what the reader must treat
  // carefully. Blocking is reserved for claims that can be wrong (values, units, scale).
  const warnings = [];
  const value = Number(data?.macro?.nfp);
  const body = String(text || '').trim();
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  if (!body) issues.push('empty');
  if (metricEvidence.length < 2) issues.push('metric-evidence-insufficient');
  const changes = new Map((snapshot?.quotes || []).filter(row => row?.evidenceId && Number.isFinite(Number(row.changePct))).map(row => [row.evidenceId, Number(row.changePct)]));
  issues.push(...validateAnalysisAdmission(body, { changes, context }));
  // P1372: "a concise Korean market analysis" produced an English analysis *of the Korean
  // market*. The product is Korean; English prose is not publishable.
  // P1585: count prose only — the prompt asks for evidence ids, and tickers (SPX, VIX, DXY, WTI)
  // are Latin by nature, so a Korean answer that cites them was read as English.
  const allMetricLabels = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]
    .flatMap(def => [def.label, ...(def.aliases || [])]);
  // P1594: remove known metric labels, not arbitrary uppercase English sentences.
  const prose = analysisProse(body, allMetricLabels);
  const hangul = (prose.match(/[가-힣]/g) || []).length;
  const latin = (prose.match(/[A-Za-z]/g) || []).length;
  if (body && latin >= 30 && hangul < latin * 0.6) issues.push('language-not-korean');
  for (const row of metricEvidence) {
    if (!row.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session)) continue;
    const label = String(row.label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (label && new RegExp(`${label}(?:(?![.。,]\\s|\\n|이고|이며|[A-Z]{2,}).){0,40}(?:마감|종가|closed|closing|close at)`).test(body)) issues.push(`session-wording-mismatch:${row.metricId}`);
  }
  // Proximity is an ambiguity signal, not a false number: a correct sentence that lists
  // VIX and Fear & Greed together is not a fabrication. The precise guard is
  // `metric-value-mismatch`, which compares the stated number with its own evidence row.
  if (/(?:VIX[\s\S]{0,60}(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)|(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)[\s\S]{0,60}VIX)/i.test(body)) {
    warnings.push('metric-identity-proximity:vix-vs-fear-greed');
  }
  for (const def of [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]) {
    const row = metricEvidence.find(item => item.metricId === def.metricId);
    if (!row) continue;
    const levels = analysisLevelsAfterLabels(body, [def.label, ...(def.aliases || [])], { allLabels: allMetricLabels, unit: row.unit });
    // Tolerance follows the unit the evidence actually carries (canonical snapshot
    // unit when available), not the duplicated def table.
    const tolerance = Math.max(row.unit === 'percent' ? 0.15 : 0.5, Math.abs(Number(row.value)) * 0.02); // P1585: 5% let SPX 7,500 pass for 7,816
    // P1719: the same context exception as validateAnalysisMetricMentions (a value quoted from REGIME_CONTEXT), bounded to
    // a whole number so "10" does not pass because "100" or "2026-10" appears somewhere in the context.
    // Review: the exception also needs the text to mark the number as a reference level (moving average, high, prior
    // close …) so a context value written as the current level ("S&P 500 7,650") is still blocked.
    const referenced = (mentioned) => analysisContextHasNumber(context, mentioned) && analysisNumberMarkedAsReference(body, mentioned);
    if (levels.some(mentioned => Math.abs(mentioned - Number(row.value)) > tolerance && !referenced(mentioned))) issues.push(`metric-value-mismatch:${def.metricId}`);
  }
  // T03/T08: % moves against each metric's own changePct, rates in bp only, Korean metric names, 장중 + time for in-session values.
  issues.push(...validateAnalysisMetricMentions(body, metricEvidence, changes, { context }));
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

// AI commentary shares the Worker budget with chat and translation (P1421).

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
  // P1372: a markdown heading ("# ... Analysis") is not analysis text and must not become the one-liner.
  return String(text || '').trim().split(/\n+/).map(line => line.trim()).filter((line) => line && !/^#{1,6}\s/.test(line)).join('\n').slice(0, 2400);
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
    reason: status === 'verified' ? null : reason || 'analysis-unavailable',
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
    validatorVersion: 'market-analysis-validator.v3',
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

// P1399: a daily bar is a completed close only after its session ends. A run during the US
// session (or before the KR close) sees a partial bar for today; breadth built from it was
// stamped 'latest-completed-close' while the index inputs used the previous close.
// 2026-10-13 F07: Tokyo (close 15:30) and Taiwan (close 13:30) listings are judged on their own clock with
// the same 15-minute settlement margin; any other segment keeps the US rule.
const SESSION_CLOSE_RULES = Object.freeze({
  us: { zone: 'America/New_York', closeMinutes: 16 * 60 + 15 },
  kr: { zone: 'Asia/Seoul', closeMinutes: 15 * 60 + 45 },
  jp: { zone: 'Asia/Tokyo', closeMinutes: 15 * 60 + 45 },
  tw: { zone: 'Asia/Taipei', closeMinutes: 13 * 60 + 45 },
});

export function sessionSegmentOfSymbol(sym) {
  const text = String(sym || '').toUpperCase();
  if (/\.(KS|KQ)$/.test(text)) return 'kr';
  if (/\.T$/.test(text) && listingMarketOfSymbol(text) === 'INTL') return 'jp';
  if (/\.TWO?$/.test(text)) return 'tw';
  return 'us';
}

// Quote currency of a listing: the provider's declared currency first; the suffix rule only for US/KR.
// An overseas listing without a declared currency stays unknown rather than defaulting to USD.
export function listingCurrencyOf(sym, providerMeta = null) {
  const declared = String(providerMeta?.currency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(declared)) return declared;
  const market = listingMarketOfSymbol(sym);
  return market === 'KR' ? 'KRW' : market === 'US' ? 'USD' : null;
}

export function isSessionComplete(date, segment, nowMs = Date.now()) {
  const rule = SESSION_CLOSE_RULES[segment] || SESSION_CLOSE_RULES.us;
  const zone = rule.zone;
  const closeMinutes = rule.closeMinutes;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(nowMs)).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (date !== today) return date < today;
  return Number(parts.hour) * 60 + Number(parts.minute) >= closeMinutes;
}

// Reconstruct daily breadth from the same dated adjusted-close rows used by
// the screener. Date alignment is explicit; array position is never used to
// align different securities. This remains AIO-universe research data, not
// official exchange advance/decline data.
export function computeScreenerBreadthHistory(syms, results, maxRows = 252, nowMs = Date.now(), assetTypeOf = null) {
  // v57.50 D21: breadth is a share of stocks; ETFs (index trackers, VIX products) are excluded from both
  // the numerator and the denominator when the universe's asset type is known.
  const isEtf = (sym) => typeof assetTypeOf === 'function' && assetTypeOf(sym) === 'ETF';
  const symbolSet = new Set((syms || []).filter((sym) => !isEtf(sym)));
  const buckets = new Map();
  const windows = [20, 50, 200];
  // F07/V04: a Tokyo/Taiwan listing has no US/KR bucket; it counts only in `all`, judged on its own close.
  const segmentFor = (sym) => /\.(KS|KQ)$/i.test(String(sym || '')) ? 'kr' : listingMarketOfSymbol(sym) === 'INTL' ? 'intl' : 'us';
  const universe = {
    all: symbolSet.size,
    us: [...symbolSet].filter((sym) => segmentFor(sym) === 'us').length,
    kr: [...symbolSet].filter((sym) => segmentFor(sym) === 'kr').length
  };
  const blank = () => ({ eligible: 0, advances: 0, declines: 0, unchanged: 0, observedAt: null, above: { 20: 0, 40: 0, 50: 0, 200: 0 }, eligibleByWindow: { 20: 0, 40: 0, 50: 0, 200: 0 },
    // P1416: StockBee 4% movers, 52-week highs/lows; each with its own eligible denominator.
    up4: 0, down4: 0, moverEligible: 0, newHighs: 0, newLows: 0, highLowEligible: 0, contributors: { up4: [], down4: [], newHigh: [], newLow: [] } });
  const getBucket = (date) => {
    if (!buckets.has(date)) buckets.set(date, { all: blank(), us: blank(), kr: blank() });
    return buckets.get(date);
  };
  const addSignals = (bucket, signal, sym) => {
    if (!signal) return;
    if (signal.above40Eligible) { bucket.eligibleByWindow[40] += 1; if (signal.above40) bucket.above[40] += 1; }
    if (signal.moverEligible) bucket.moverEligible += 1;
    const change = signal.change == null ? null : round(signal.change * 100, 2);
    // P1449: contributors carry their asset type; a ≥20% one-day move is flagged as
    // possibly corporate-action-affected (spin-off etc.) — the audit source does not exist yet,
    // so the UI must show this as '조정 여부 미확인', not as a crash reading.
    const assetType = typeof assetTypeOf === 'function' ? (assetTypeOf(sym) || null) : null;
    const caSuspected = change != null && Math.abs(change) >= 20;
    if (signal.mover === 'up') { bucket.up4 += 1; bucket.contributors.up4.push([sym, change, assetType, caSuspected]); }
    if (signal.mover === 'down') { bucket.down4 += 1; bucket.contributors.down4.push([sym, change, assetType, caSuspected]); }
    if (signal.highLowEligible) {
      bucket.highLowEligible += 1;
      if (signal.newHigh) { bucket.newHighs += 1; bucket.contributors.newHigh.push([sym, change, assetType, caSuspected]); }
      if (signal.newLow) { bucket.newLows += 1; bucket.contributors.newLow.push([sym, change, assetType, caSuspected]); }
    }
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
    const sessionSegment = market === 'intl' ? sessionSegmentOfSymbol(row.sym) : market;
    const signals = Array.isArray(row.closes) && row.closes.length === values.length
      ? evaluateSymbolSignals({ closes: row.closes, adjCloses: row.adjCloses, highs: row.highs || [], lows: row.lows || [], volumes: row.volumes || [] })
      : [];
    for (let index = 1; index < values.length; index += 1) {
      const date = String(row.dates[index] || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isSessionComplete(date, sessionSegment, nowMs)) continue;
      const observedAt = row.observedAts?.[index] || `${date}T00:00:00.000Z`;
      const bucket = getBucket(date);
      update(bucket.all, values, prefix, finitePrefix, index, observedAt);
      if (bucket[market]) update(bucket[market], values, prefix, finitePrefix, index, observedAt);
      addSignals(bucket.all, signals[index], row.sym);
      if (bucket[market]) addSignals(bucket[market], signals[index], row.sym);
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
      breadth40: pct(bucket.above[40], bucket.eligibleByWindow[40]),
      breadthUp4: bucket.moverEligible > 0 ? bucket.up4 : null,
      breadthDown4: bucket.moverEligible > 0 ? bucket.down4 : null,
      breadthNewHighs: bucket.highLowEligible > 0 ? bucket.newHighs : null,
      breadthNewLows: bucket.highLowEligible > 0 ? bucket.newLows : null,
      signalEligible: { movers: bucket.moverEligible, highLow: bucket.highLowEligible },
      contributors: bucket.contributors,
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

// P1426 (owner review 2026-10-03): the 거시 screen needs direction, not just the latest print — the
// three-month pace of inflation, the Sahm-rule unemployment gap, the payroll trend, weekly claims and
// a year of daily rates/credit. One raw-observation artifact from FRED (the operator key in Actions);
// every derived figure is computed in src/domain/macro so the rule and its inputs stay inspectable.
// A series that fails keeps its previous observations, marked stale, instead of disappearing.
export const MACRO_HISTORY_SERIES = Object.freeze({
  cpiIndex:       { id: 'CPIAUCSL',      frequency: 'monthly', limit: 40,  unit: 'index', label: 'CPI-U (계절조정 지수)' },
  coreCpiIndex:   { id: 'CPILFESL',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 CPI-U (계절조정 지수)' },
  // P1427: the official headline YoY is the NSA index; cards plot NSA so their history matches the value shown.
  cpiIndexNsa:    { id: 'CPIAUCNS',      frequency: 'monthly', limit: 40,  unit: 'index', label: 'CPI-U (계절조정 전 지수)' },
  coreCpiIndexNsa:{ id: 'CPILFENS',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 CPI-U (계절조정 전 지수)' },
  pceIndex:       { id: 'PCEPI',         frequency: 'monthly', limit: 40,  unit: 'index', label: 'PCE 물가지수' },
  corePceIndex:   { id: 'PCEPILFE',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 PCE 물가지수' },
  unemployment:   { id: 'UNRATE',        frequency: 'monthly', limit: 40,  unit: 'percent', label: '실업률' },
  payrolls:       { id: 'PAYEMS',        frequency: 'monthly', limit: 40,  unit: 'thousands', label: '비농업 고용자 수' },
  hourlyEarnings: { id: 'CES0500000003', frequency: 'monthly', limit: 40,  unit: 'usd-per-hour', label: '평균 시간당 임금' },
  retailSales:    { id: 'RSAFS',         frequency: 'monthly', limit: 40,  unit: 'usd-millions', label: '소매판매' },
  housingStarts:  { id: 'HOUST',         frequency: 'monthly', limit: 40,  unit: 'thousands-saar', label: '주택 착공' },
  fedFunds:       { id: 'FEDFUNDS',      frequency: 'monthly', limit: 40,  unit: 'percent', label: '실효 연방기금금리' },
  initialClaims:  { id: 'ICSA',          frequency: 'weekly',  limit: 110, unit: 'claims', label: '신규 실업수당 청구' },
  fedTargetUpper: { id: 'DFEDTARU',      frequency: 'daily',   limit: 400, unit: 'percent', label: '연준 목표 상단' },
  dgs2:           { id: 'DGS2',          frequency: 'daily',   limit: 280, unit: 'percent', label: '미 국채 2년' },
  dgs10:          { id: 'DGS10',         frequency: 'daily',   limit: 280, unit: 'percent', label: '미 국채 10년' },
  t10y3m:         { id: 'T10Y3M',        frequency: 'daily',   limit: 280, unit: 'percentage-point', label: '10년-3개월 금리차' },
  realYield10:    { id: 'DFII10',        frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 실질금리 (TIPS)' },
  breakeven10:    { id: 'T10YIE',        frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 기대인플레이션' },
  // P1469 (review 2026-10-04, term premium): the Federal Reserve Board's Kim-Wright 10-year term premium
  // (model estimate, official FRED series). NY Fed ACM is published only as a spreadsheet, so the same
  // concept is taken from the official FRED path and named by its model on screen.
  termPremium10:  { id: 'THREEFYTP10',   frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 기간 프리미엄 (Kim-Wright)' },
  hyOas:          { id: 'BAMLH0A0HYM2',  frequency: 'daily',   limit: 280, unit: 'percent', label: '하이일드 스프레드' },
  // P1586: investment-grade OAS — the junk-bond component is HY minus IG.
  igOas:          { id: 'BAMLC0A0CM',    frequency: 'daily',   limit: 280, unit: 'percent', label: '투자등급 회사채 스프레드' },
  // P1638: rating tiers — stress usually starts in the weakest borrowers (CCC) before the HY average moves.
  bbOas:          { id: 'BAMLH0A1HYBB',  frequency: 'daily',   limit: 280, unit: 'percent', label: 'BB 등급 스프레드' },
  bOas:           { id: 'BAMLH0A2HYB',   frequency: 'daily',   limit: 280, unit: 'percent', label: 'B 등급 스프레드' },
  cccOas:         { id: 'BAMLH0A3HYC',   frequency: 'daily',   limit: 280, unit: 'percent', label: 'CCC 이하 스프레드' },
  // P1654 (owner 2026-10-12: fill free official data gaps): liquidity, growth and wider commodity/FX context from the
  // same operator FRED key. Raw observations only; readings are derived in src/domain/macro.
  fedBalanceSheet:{ id: 'WALCL',         frequency: 'weekly',  limit: 110, unit: 'usd-millions', label: '연준 총자산' },
  reverseRepo:    { id: 'RRPONTSYD',     frequency: 'daily',   limit: 280, unit: 'usd-billions', label: '역레포 잔액' },
  treasuryAccount:{ id: 'WTREGEN',       frequency: 'weekly',  limit: 110, unit: 'usd-millions', label: '재무부 일반계정(TGA)' },
  sofr:           { id: 'SOFR',          frequency: 'daily',   limit: 280, unit: 'percent', label: 'SOFR 단기금리' },
  financialConditions: { id: 'NFCI',     frequency: 'weekly',  limit: 110, unit: 'index', label: '시카고 연은 금융여건지수' },
  realGdp:        { id: 'GDPC1',         frequency: 'quarterly', limit: 24, unit: 'usd-billions-chained', label: '실질 GDP' },
  ppiFinalDemand: { id: 'PPIFIS',        frequency: 'monthly', limit: 40,  unit: 'index', label: '생산자물가(최종수요)' },
  consumerSentiment: { id: 'UMCSENT',    frequency: 'monthly', limit: 40,  unit: 'index', label: '미시간대 소비자심리' },
  jobOpenings:    { id: 'JTSJOL',        frequency: 'monthly', limit: 40,  unit: 'thousands', label: '구인 건수(JOLTS)' },
  brent:          { id: 'DCOILBRENTEU',  frequency: 'daily',   limit: 280, unit: 'usd-per-barrel', label: '브렌트유' },
  natGas:         { id: 'DHHNGSP',       frequency: 'daily',   limit: 280, unit: 'usd-per-mmbtu', label: '천연가스(헨리허브)' },
  copper:         { id: 'PCOPPUSDM',     frequency: 'monthly', limit: 40,  unit: 'usd-per-ton', label: '구리' },
  usdCny:         { id: 'DEXCHUS',       frequency: 'daily',   limit: 280, unit: 'cny-per-usd', label: '위안/달러' }
});
const MACRO_HISTORY_OUT = `${__dir}/../public-data/macro-history.json`;

export function parseFredObservations(payload) {
  return (payload?.observations || [])
    .map((row) => ({ date: String(row?.date || ''), value: Number.parseFloat(row?.value) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 2026-10-14 (live review 4f): decades of context for the few gauges a reader compares with history — monthly means since
// 1990 (or the series' start) via FRED's own aggregation/transformation, refreshed at most once a day. The screen reads
// where today's value sits in that history; it is a range, not a forecast.
// 2026-10-14 (live review 4f): decades of context for the few gauges a reader compares with history — monthly means since
// 1990 (or the series' start) via FRED's own aggregation/transformation. Carried inside macro-history.json as `long`
// and refetched at most once a day. The screen reads where today's value sits in that history; a range, not a forecast.
export const MACRO_LONG_SERIES = Object.freeze({
  fedFunds:     { id: 'FEDFUNDS',     units: 'lin', unit: 'percent', label: '기준금리(실효 연방기금금리)' },
  dgs10:        { id: 'DGS10',        units: 'lin', unit: 'percent', label: '미국 10년물 금리' },
  dgs2:         { id: 'DGS2',         units: 'lin', unit: 'percent', label: '미국 2년물 금리' },
  t10y3m:       { id: 'T10Y3M',       units: 'lin', unit: 'percentage-points', label: '10년물 − 3개월물 금리차' },
  realYield10:  { id: 'DFII10',       units: 'lin', unit: 'percent', label: '10년 실질금리' },
  coreCpiYoY:   { id: 'CPILFESL',     units: 'pc1', unit: 'percent', label: '근원 CPI 전년 대비' },
  unemployment: { id: 'UNRATE',       units: 'lin', unit: 'percent', label: '실업률' },
  vix:          { id: 'VIXCLS',       units: 'lin', unit: 'index', label: 'VIX' }
});
export async function collectMacroLongHistory(key, previousLong, { fetchFn = fetchJSON, nowMs = Date.now(), minAgeMs = 20 * 3600000 } = {}) {
  const previousMs = Date.parse(previousLong?.generatedAt || '');
  if (previousLong?.series && Number.isFinite(previousMs) && nowMs - previousMs >= 0 && nowMs - previousMs < minAgeMs) return previousLong; // a series FRED cannot serve is retried next day, not every run
  const series = {};
  const failed = [];
  for (const [field, spec] of Object.entries(MACRO_LONG_SERIES)) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}&api_key=${key}&file_type=json&observation_start=1990-01-01&frequency=m&aggregation_method=avg&units=${spec.units}`;
    try {
      const observations = parseFredObservations(await fetchFn(url));
      if (observations.length < 120) throw new Error('too-few-observations');
      series[field] = { id: spec.id, label: spec.label, unit: spec.unit, transform: spec.units === 'pc1' ? 'percent-change-from-year-ago' : 'monthly-mean', observations: observations.map((row) => [row.date.slice(0, 7), Math.round(row.value * 100) / 100]) };
    } catch (error) {
      failed.push(field);
      const kept = previousLong?.series?.[field];
      if (kept?.observations?.length) series[field] = { ...kept, stale: true };
      console.warn(`[fetch-data] macro long history ${spec.id} failed: ${error?.message || error}`);
    }
  }
  if (!Object.keys(series).length) return previousLong || null;
  return { generatedAt: new Date(nowMs).toISOString(), frequency: 'monthly', columns: ['month', 'value'], failed, series };
}

async function writeMacroHistory(key, { fetchFn = fetchJSON, nowMs = Date.now() } = {}) {
  let previous = null;
  try { previous = JSON.parse(await readFile(MACRO_HISTORY_OUT, 'utf8')); } catch { /* first producer run */ }
  if (!key) return { written: false, reason: 'api-key-not-configured' };
  const series = {};
  const failed = [];
  for (const [field, spec] of Object.entries(MACRO_HISTORY_SERIES)) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}&api_key=${key}&file_type=json&sort_order=desc&limit=${spec.limit}`;
    try {
      const observations = parseFredObservations(await fetchFn(url));
      if (observations.length < 3) throw new Error('too-few-observations');
      series[field] = { id: spec.id, label: spec.label, frequency: spec.frequency, unit: spec.unit, fetchedAt: new Date(nowMs).toISOString(), stale: false, observations: observations.map((row) => [row.date, row.value]) };
    } catch (error) {
      failed.push(field);
      const kept = previous?.series?.[field];
      if (kept?.observations?.length) series[field] = { ...kept, stale: true };
      console.warn(`[fetch-data] macro history ${spec.id} failed: ${error?.message || error}`);
    }
  }
  if (!Object.keys(series).length) return { written: false, reason: 'all-series-failed' };
  const payload = {
    schemaVersion: 'macro-history.v1',
    generatedAt: new Date(nowMs).toISOString(),
    source: 'FRED, Federal Reserve Bank of St. Louis',
    sourceKind: 'T1_OFFICIAL',
    status: failed.length ? 'partial' : 'ok',
    failed,
    columns: ['date', 'value'],
    series,
    long: await collectMacroLongHistory(key, previous?.long || null, { fetchFn, nowMs }).catch(() => previous?.long || null)
  };
  await atomicWriteFile(MACRO_HISTORY_OUT, JSON.stringify(payload));
  return { written: true, series: Object.keys(series).length, failed };
}

// P1654: the release dates of the four FRED-published indicators the calendar shows. The browser calendar was a
// hand-maintained array that ran out after 2026-12; the producer now writes the official FRED release schedule each
// run (BOK is not a FRED release and stays on its annual official calendar; FOMC/ISM: see P1731/P1733 below).
const MACRO_CALENDAR_OUT = `${__dir}/../public-data/macro-calendar.json`;
export const MACRO_CALENDAR_RELEASES = Object.freeze({ 'us-retail': 9, 'us-cpi': 10, 'us-nfp': 50, 'us-pce': 54 });
// P1731/P1733: the same artifact now also carries the FOMC meetings (official Fed page, rechecked at most every 12h,
// previous parse kept on failure) and the rule-derived ISM PMI dates; neither needs the FRED key. I/O is injectable
// so the gate can run this end to end on fixtures without touching public-data.
export async function writeMacroCalendar(key, { fetchFn = fetchJSON, fetchTextFn = (url) => _fetchRss(url, 15000), nowMs = Date.now(), outPath = MACRO_CALENDAR_OUT, readFn = readFile, writeFn = atomicWriteFile } = {}) {
  let previous = null;
  try { previous = JSON.parse(await readFn(outPath, 'utf8')); } catch { /* first producer run */ }
  const start = new Date(nowMs - 45 * 86400000).toISOString().slice(0, 10);
  const end = new Date(nowMs + 400 * 86400000).toISOString().slice(0, 10);
  const schedules = {};
  const failed = [];
  for (const [calendarId, releaseId] of Object.entries(MACRO_CALENDAR_RELEASES)) {
    if (!key) { failed.push(calendarId); continue; }
    const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${releaseId}&realtime_start=${start}&realtime_end=${end}&include_release_dates_with_no_data=true&sort_order=asc&limit=60&api_key=${key}&file_type=json`;
    try {
      const payload = await fetchFn(url);
      const dates = [...new Set((payload?.release_dates || []).map((row) => String(row?.date || '')).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
      if (!dates.length) throw new Error('no-dates');
      schedules[calendarId] = dates;
    } catch (error) {
      failed.push(calendarId);
      console.warn(`[fetch-data] macro calendar ${calendarId} failed: ${error?.message || error}`);
    }
  }
  const fomc = await resolveFomcSchedule({ previous, fetchHtml: fetchTextFn, nowMs });
  if (fomc.meta.fomcStatus !== 'ok') console.warn(`[fetch-data] FOMC calendar ${fomc.meta.fomcStatus}: ${fomc.meta.fomcReason}`);
  const ismEvents = buildIsmRuleEvents({ fromMs: nowMs - 45 * 86400000, toMs: nowMs + 400 * 86400000 });
  const payload = buildMacroCalendarPayload({ nowMs, fredSchedules: schedules, fredFailed: failed, fredFailureReason: key ? null : 'api-key-not-configured', previous, fomc, ismEvents });
  if (!payload) return { written: false, reason: 'nothing-to-publish' };
  await writeFn(outPath, JSON.stringify(payload));
  return { written: true, releases: Object.keys(payload.schedules).length, failed, fomcStatus: payload.meta.fomcStatus, fomcReason: payload.meta.fomcReason, fomcFetched: fomc.fetched };
}

// P1416: which stocks made each count — the latest 20 completed sessions, US segment. Names come
// from the screener universe on the client; this artifact carries symbols and the day's change only.
const BREADTH_CONTRIBUTORS_OUT = `${__dir}/../public-data/breadth-contributors.json`;
async function writeBreadthContributors(rows, nowMs = Date.now()) {
  const sessions = (Array.isArray(rows) ? rows : [])
    .filter((point) => point?.date && point?.us?.contributors && isSessionComplete(point.date, 'us', nowMs))
    .slice(-20)
    .map((point) => ({
      date: point.date,
      eligible: point.us.signalEligible || null,
      // P1449: contributor entries become objects — asset type (ETF/stock) plus the
      // corporate-action suspicion flag (|day change| >= 20%). "미국 주식" counts bundle ETFs
      // with individual names, so the drilldown must say which is which.
      signals: Object.fromEntries(Object.entries(point.us.contributors).map(([key, list]) => [key,
        [...list]
          .sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))
          .slice(0, 80)
          .map((entry) => ({ symbol: entry[0], dayChangePct: entry[1] ?? null, assetType: entry[2] ?? null, corporateActionSuspected: entry[3] === true }))
      ])),
      counts: { up4: point.us.breadthUp4, down4: point.us.breadthDown4, newHigh: point.us.breadthNewHighs, newLow: point.us.breadthNewLows }
    }));
  if (!sessions.length) return { written: false };
  const payload = { schemaVersion: 'breadth-contributors.v2', model: BREADTH_SIGNAL_MODEL_VERSION, generatedAt: new Date(nowMs).toISOString(), universeScope: 'aio-us-screener-universe-not-official-exchange', universeAssetTypes: 'stocks-only-etfs-excluded', columns: ['symbol', 'dayChangePct', 'assetType', 'corporateActionSuspected'], corporateActionPolicy: 'none-adjusted — a >=20% one-day move is flagged only as a suspicion to check against the filing, not adjusted or confirmed', sessions };
  await atomicWriteFile(BREADTH_CONTRIBUTORS_OUT, JSON.stringify(payload));
  return { written: true, sessions: sessions.length };
}

async function updateScreenerBreadthHistory(rows, nowMs = Date.now(), distribution = null) {
  if (!Array.isArray(rows) || rows.length < 60) return { updated: false, rows: rows?.length || 0 };
  let history = [];
  try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) history = raw; } catch { /* first producer run */ }
  const fetchedAt = new Date().toISOString();
  const fields = ['breadth20', 'breadth50', 'breadth200', 'advanceRatio', 'advanceDecline', 'breadth40', 'breadthUp4', 'breadthDown4', 'breadthNewHighs', 'breadthNewLows'];
  // P1416: each count is judged against its own eligible population.
  const eligibleFor = (segment, field) => {
    const window = /^breadth(20|40|50|200)$/.exec(field)?.[1];
    if (window) return Number(segment.eligibleByWindow?.[window]);
    if (field === 'breadthUp4' || field === 'breadthDown4') return Number(segment.signalEligible?.movers);
    if (field === 'breadthNewHighs' || field === 'breadthNewLows') return Number(segment.signalEligible?.highLow);
    return Number(segment.eligible);
  };
  // P1399: an earlier in-session run may have written today's partial breadth; clear it.
  for (const row of history) {
    if (!row?.date || isSessionComplete(row.date, 'us', nowMs)) continue;
    for (const field of fields) { if (field in row) row[field] = null; if (row.fieldMeta) delete row.fieldMeta[field]; }
  }
  for (const point of rows) {
    const segment = point?.us;
    if (!segment || !point?.date) continue;
    let target = history.find((row) => row?.date === point.date);
    if (!target) { target = { date: point.date, fieldMeta: {} }; history.push(target); }
    target.fieldMeta = target.fieldMeta || {};
    for (const field of fields) {
      const eligible = eligibleFor(segment, field);
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
  // P1416: S&P 500 distribution days (25-session count) from the index's own completed bars.
  let distributionRows = 0;
  for (const point of Array.isArray(distribution?.series) ? distribution.series : []) {
    if (!point?.date || point.count == null || !isSessionComplete(point.date, 'us', nowMs)) continue;
    const target = history.find((row) => row?.date === point.date);
    if (!target) continue;
    target.distributionDays = point.count;
    target.fieldMeta = target.fieldMeta || {};
    target.fieldMeta.distributionDays = {
      observedAt: `${point.date}T20:00:00.000Z`, fetchedAt, lastSuccessfulAt: fetchedAt,
      source: 'Yahoo chart ^GSPC daily bars', sourceKind: 'derived-research', allowedUse: 'research-history',
      observationRelation: 'latest-completed-close', observedAtSource: 'derived-from-index-daily-bars',
      model: BREADTH_SIGNAL_MODEL_VERSION, rule: 'close <= -0.2% on volume above the prior session; latest 25 sessions'
    };
    distributionRows += 1;
  }
  history.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  if (history.length > 420) history = history.slice(-420);
  await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(history)));
  return { updated: true, rows: rows.length, totalHistoryRows: history.length, distributionRows };
}

function buildMarketAnalysisFallback(data, reason, metricEvidence = buildMarketAnalysisEvidence(data), newsEvidence = buildMarketAnalysisNewsEvidence(data)) {
  const observed = metricEvidence.slice(0, 4).map(row => `${row.label}=${row.value} ${row.unit} (${row.observedAt})`).join(' · ');
  const summary = observed
    ? `시장 분석 대기: 검증된 관측치만 표시합니다 — ${observed}. 추가 방향성·인과 해석은 유효한 분석 산출물 확인 후 제공됩니다.`
    : '시장 분석 대기: 유효한 관측 증거가 부족해 방향성·인과 해석을 보류합니다.';
  return buildStructuredMarketAnalysis({ data, text: summary, model: 'none', status: 'blocked', reason, metricEvidence, newsEvidence, semantic: { ok: false, issues: [reason], causalEvidenceCount: 0 } });
}

// P1635: the published narrative read only levels, so it filled its lines with statements such as
// "the two indicators are different indicators". It now receives the same deterministic regime,
// scenario and likelihood reading the 시장 상태 screen shows (same domain modules, same completed
// closes in history.json), and is asked to connect change -> meaning -> path -> what to check.
// P1685 review: the screen's credit axis reads the 20-session HY change from macro-history; the narrative must get
// the same series or it calls credit 'favorable' while the screen says 'neutral'.
function readPublishedMacroHistory() {
  try { return JSON.parse(readFileSync(MACRO_HISTORY_OUT, 'utf8')); } catch (_) { return null; }
}

export function marketAnalysisRegimeInput(data, history = [], macroHistory = readPublishedMacroHistory()) {
  const macro = data?.macro || {};
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const hy = num(macro.hyOAS);
  const hyDelta5 = num(macro.hyOASDelta5);
  // v57.50 C03: the screen's credit axis also reads the Cboe total put/call (briefing-read collectMarketInputs);
  // the narrative gets the same value and observation date, or the two surfaces judge credit on different inputs.
  const putCall = data?.putCall && !data.putCall.error ? data.putCall : null;
  const pcr = num(putCall?.totalPutCall);
  const pcrAsOf = pcr != null && /^\d{4}-\d{2}-\d{2}$/.test(String(putCall?.asOf || '')) ? putCall.asOf : null;
  return {
    history: Array.isArray(history) ? history : [],
    macroHistory: macroHistory || null,
    now: Date.now(), // M05: the narrative uses the same latest-session admission as the screen
    credit: {
      hyBp: hy == null ? null : Math.round(hy * 100), hyAsOf: macro._asOf_hyOAS || null,
      hyDelta5Bp: hyDelta5 == null ? null : Math.round(hyDelta5 * 100),
      fg: num(data?.fearGreed?.score), fgAsOf: data?.fearGreed?.asOf || null, pcr: pcrAsOf ? pcr : null, pcrAsOf, aaiiAsOf: null
    },
    rates: {
      realYield10: num(macro.realYield10), realYield10Delta5: num(macro.realYield10Delta5),
      breakeven10Delta5: num(macro.breakeven10Delta5), dgs2Delta5: num(macro.dgs2Delta5), dgs10Delta5: num(macro.dgs10Delta5),
      asOf: macro._asOf_realYield10 || macro._asOf_dgs10 || null, realAsOf: macro._asOf_realYield10 || null, breakevenAsOf: macro._asOf_breakeven10 || null
    }
  };
}

export function buildMarketAnalysisRegimeContext(data, history = []) {
  try {
    const input = marketAnalysisRegimeInput(data, history);
    const regime = buildMarketRegime(input);
    if (!regime?.available) return '';
    const scenarios = buildMarketScenarios(input, { regime });
    const axes = (regime.axes || []).map((axis) => `${axis.label || axis.id}: ${axis.state}${axis.read ? ` — ${axis.read}` : ''}`).join('\n');
    const outlook = buildScenarioOutlook({ scenarios, regime });
    return [`종합: ${regime.overall} (우호 ${regime.counts?.favorable ?? '-'} · 부담 ${regime.counts?.burden ?? '-'})`, axes,
      renderMarketScenarioContext(input, { regime }), renderScenarioOutlookContext(outlook), marketAnalysisCrossroadsContext(data, input, regime)].filter(Boolean).join('\n');
  } catch (error) {
    return '';
  }
}

// P1742 (owner 2026-10-13): the narrative looks forward with the same branches the 거시 screen draws — the next official
// releases, each branch's chain, its three likelihood lines and the reader's choices with their opportunity cost.
export function marketAnalysisCrossroadsContext(data, input, regime) {
  try {
    let schedules = {};
    try { schedules = JSON.parse(readFileSync(MACRO_CALENDAR_OUT, 'utf8'))?.schedules || {}; } catch (_) { schedules = {}; }
    const read = buildMacroRead({ macro: data?.macro || null, macroHistory: input.macroHistory, regime: regime?.available ? regime : null, history: input.history });
    // P1743: the previous refresh's scenario state (scripts/build-scenario-state.mjs runs after this producer) adds the
    // automated record — what changed, how the latest releases scored — and every theme's stage under the same branches.
    let state = null, outcomes = null;
    try { state = JSON.parse(readFileSync(SCENARIO_STATE_OUT, 'utf8')); } catch (_) { state = null; }
    try { outcomes = JSON.parse(readFileSync(SCENARIO_OUTCOMES_OUT, 'utf8')); } catch (_) { outcomes = null; }
    const breadthState = regime?.axes?.find((axis) => axis.id === 'breadth')?.state || null;
    const model = buildMacroCrossroads({ read: read ? { ...read, breadthState } : read, macroHistory: input.macroHistory, history: input.history, events: upcomingMacroEvents({ schedules }), outcomes });
    return [renderMacroCrossroadsContext(model, { state }), scenarioStateThemeLines(state)].filter(Boolean).join('\n');
  } catch (_) { return ''; }
}

export function scenarioStateThemeLines(state) {
  const themes = Array.isArray(state?.themes) ? state.themes : [];
  if (!themes.length) return '';
  const byKey = new Map(themes.map((row) => [`${row.market}:${row.id}`, row]));
  const named = (keys = []) => keys.map((key) => byKey.get(key)).filter(Boolean).map((row) => `${row.label}(1개월 ${row.ret1m >= 0 ? '+' : ''}${Number(row.ret1m).toFixed(1)}%)`).slice(0, 6).join(', ');
  const h = state.highlights || {};
  return [`【테마 갈림길 — 모든 테마를 같은 규칙으로(${state.basis?.themeAsOf || '기준일 미확인'} 완료 종가, 직전 갱신)】`, state.rotation?.text ? `가격 기준 강약 이동: ${state.rotation.text}` : '',
    h.structuralPullbacks?.length ? `긴 추세 속 조정 + 거시 역풍 아님: ${named(h.structuralPullbacks)}` : '',
    h.headwindLeaders?.length ? `거시 역풍에도 주도: ${named(h.headwindLeaders)}` : '',
    h.tailwindLaggards?.length ? `거시 순풍인데 약세: ${named(h.tailwindLaggards)}` : ''].filter(Boolean).join('\n');
}

async function readHistoryRows() {
  try {
    const parsed = JSON.parse(await readFile(HIST, 'utf8'));
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.history) ? parsed.history : [];
  } catch (_) { return []; }
}

// P1719: what the validator blocked, in terms the model can act on — the issue, the metric's evidence value and change,
// and the level the validator read after the label. Appended once to the retry prompt.
export function describeMarketAnalysisIssues(text, issues = [], metricEvidence = [], changes = new Map()) {
  const defs = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS];
  const allLabels = defs.flatMap((def) => [def.label, ...(def.aliases || [])]);
  return [...new Set(issues)].slice(0, 8).map((issue) => {
    const metricId = String(issue).split(':')[1] || '';
    const row = metricEvidence.find((item) => item.metricId === metricId);
    if (!row) return `- ${issue}`;
    const def = defs.find((item) => item.metricId === metricId);
    const read = def ? analysisLevelsAfterLabels(text, [def.label, ...(def.aliases || [])], { allLabels, unit: row.unit }) : [];
    const change = changes.get(row.evidenceId);
    const changeText = Number.isFinite(change)
      ? (row.unit === 'percent' ? `, change ${((row.value - row.value / (1 + change / 100)) * 100).toFixed(1)}bp` : `, change ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)
      : '';
    return `- ${issue}: evidence ${row.label}=${row.value} ${row.unit}${changeText} (${row.evidenceId})${read.length ? `; the text was read as ${read.join(', ')}` : ''}`;
  }).join('\n');
}

export const MARKET_ANALYSIS_RETAIN_MAX_MS = 12 * 3600000;
// P1719 (coordinator decision 2026-10-13): when the retry is also blocked, the previous verified analysis is kept for up
// to 12 hours from its own generatedAt. It keeps status/semanticStatus 'verified' (every consumer — client sink,
// meta.marketAnalysisOk, operations status — reads those) and carries `retained` so a surface can say
// "HH:MM 기준 직전 검증본". Older than 12 hours, or never verified, falls through to the blocked fallback.
export function retainVerifiedMarketAnalysis(previous, { reason, nowMs = Date.now() } = {}) {
  if (!previous || previous.status !== 'verified' || previous.semanticStatus !== 'verified') return null;
  if (Array.isArray(previous.semanticIssues) && previous.semanticIssues.length) return null;
  const generatedMs = Date.parse(previous.generatedAt || '');
  if (!Number.isFinite(generatedMs) || generatedMs > nowMs + 5 * 60000 || nowMs - generatedMs > MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  return {
    ...previous,
    retained: { at: new Date(nowMs).toISOString(), from: previous.generatedAt, reason: String(reason || 'analysis-blocked').slice(0, 300), maxAgeHours: 12 },
  };
}

// Every 30-minute refresh used to call the model even when nothing it reads had moved (nights, weekends). A verified,
// un-flagged previous analysis under 12 h old whose metric/news evidence ids and headline ids equal this run's is
// reused as-is (its generatedAt keeps aging, so it still expires at 12 h). Anything else calls as before.
// v57.55 review (news trust): every browser re-translated the same English headlines through the shared AI budget, and on a
// rate limit fell back to machine translation ("금 회사 - Kitco AM 보고서"). Headlines are translated once here: titles
// already translated last run are reused, only new English titles go in one bounded request, and anything that does not
// come back as a Korean line keeps no titleKo (the browser then translates as before). A failure never blocks the cycle.
export const HEADLINE_TRANSLATION_MAX = 30;
const hasHangul = (text) => /[가-힣]/.test(String(text || ''));
export async function translateHeadlines(items, { previous = [], request = null, translate = null } = {}) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && typeof item.title === 'string' && item.title.trim());
  const known = new Map((Array.isArray(previous) ? previous : []).filter((item) => item?.title && hasHangul(item.titleKo)).map((item) => [item.title, item.titleKo]));
  let reused = 0;
  for (const item of list) {
    if (hasHangul(item.title) || item.titleKo) continue;
    if (known.has(item.title)) { item.titleKo = known.get(item.title); reused += 1; }
  }
  const pending = list.filter((item) => !hasHangul(item.title) && !item.titleKo).slice(0, HEADLINE_TRANSLATION_MAX);
  const accept = (strings) => {
    let count = 0;
    pending.forEach((item, index) => {
      const ko = typeof strings[index] === 'string' ? strings[index].replace(/\s+/g, ' ').trim() : '';
      if (hasHangul(ko) && ko.length <= 200) { item.titleKo = ko; count += 1; }
    });
    return count;
  };
  // 2026-10-14: Workers AI first (free daily allowance on the Worker); a refusal or a short answer falls to the shared model.
  let freeReason = null;
  if (pending.length && typeof translate === 'function') {
    let free = null;
    try { free = await translate(pending.map((item) => item.title.slice(0, 300))); } catch (_) { free = null; }
    if (Array.isArray(free?.translations) && free.translations.length === pending.length) {
      const translated = accept(free.translations);
      if (translated >= Math.ceil(pending.length * 0.8)) return { reused, translated, pending: pending.length, provider: 'workers-ai', model: free.model || null, reason: null };
      pending.forEach((item) => { delete item.titleKo; });
      freeReason = 'workers-ai-low-yield';
    } else freeReason = free?.reason || 'workers-ai-unavailable';
  }
  if (!pending.length || typeof request !== 'function') return { reused, translated: 0, pending: pending.length, reason: pending.length ? 'no-request' : null, ...(freeReason ? { freeReason } : {}) };
  const prompt = ['다음 영어 금융 뉴스 헤드라인을 자연스러운 한국어 기사 제목으로 옮겨라. 고유명사·티커·숫자는 그대로 두고, 뜻을 더하거나 빼지 마라.',
    `출력은 JSON 문자열 배열 하나만, 입력과 같은 순서로 정확히 ${pending.length}개.`,
    JSON.stringify(pending.map((item) => item.title.slice(0, 300)))].join('\n');
  let result = null;
  try { result = await request(prompt); } catch (_) { result = null; }
  const text = String(result?.text || '');
  let parsed = null;
  try { parsed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch (_) { parsed = null; }
  if (!Array.isArray(parsed) || parsed.length !== pending.length) return { reused, translated: 0, pending: pending.length, reason: result?.reason || 'unparsed', ...(freeReason ? { freeReason } : {}) };
  return { reused, translated: accept(parsed), pending: pending.length, provider: 'shared-openai', reason: null, ...(freeReason ? { freeReason } : {}) };
}

export function reusableMarketAnalysis(previous, { metricEvidence = [], newsEvidence = [], headlineContext = [], nowMs = Date.now() } = {}) {
  if (!previous || previous.status !== 'verified' || previous.semanticStatus !== 'verified') return null;
  if (Array.isArray(previous.semanticIssues) && previous.semanticIssues.length) return null;
  const generatedMs = Date.parse(previous.generatedAt || '');
  if (!Number.isFinite(generatedMs) || generatedMs > nowMs + 5 * 60000 || nowMs - generatedMs >= MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  const idSet = (rows) => JSON.stringify([...new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.evidenceId || '')))].sort());
  if (!Array.isArray(previous.metricEvidence) || !previous.metricEvidence.length) return null;
  if (idSet(previous.metricEvidence) !== idSet(metricEvidence)) return null;
  if (idSet(previous.newsEvidence) !== idSet(newsEvidence)) return null;
  if (idSet(previous.headlineContext) !== idSet(headlineContext)) return null;
  return previous;
}

export async function genMarketAnalysis(data, snapshot = null, { previous = null, request = null, nowMs = Date.now() } = {}) {
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  const newsEvidence = buildMarketAnalysisNewsEvidence(data);
  if (metricEvidence.length < 2) return buildMarketAnalysisFallback(data, 'metric-evidence-insufficient', metricEvidence, newsEvidence);
  const reused = reusableMarketAnalysis(previous, { metricEvidence, newsEvidence, headlineContext: buildMarketAnalysisHeadlineContext(data), nowMs });
  if (reused) {
    console.log(`[fetch-data] marketAnalysis evidence and headlines unchanged — reusing verified analysis from ${reused.generatedAt} (no AI call)`);
    return reused;
  }
  // `request` is a fixture seam (ci contract); production always uses the shared Worker.
  if (!request && !resolveSharedAiConfig()) return buildMarketAnalysisFallback(data, 'shared-ai-not-configured', metricEvidence, newsEvidence);
  const ask = request || requestSharedAnalysis;
  try {
    const changeOf = new Map((snapshot?.quotes || []).filter(row => row?.evidenceId && Number.isFinite(Number(row.changePct))).map(row => [row.evidenceId, Number(row.changePct)]));
    // T08 (v57.48 review): the briefing shows completed closes, and the commentary under it opened with KOSPI/WTI/DXY/gold
    // in-session moves. Only completed-session values reach the prompt; in-session rows stay out (the validator still
    // requires 장중 + time if one appears). T03: a rate's change is given in bp — its changePct is a relative change of
    // the yield (-0.08% of 5.24% is -0.4bp), which the model wrote as "금리 -0.08%".
    const promptEvidence = metricEvidence.filter((row) => !row.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session));
    const changeText = (row) => {
      if (!changeOf.has(row.evidenceId)) return '';
      const pct = changeOf.get(row.evidenceId);
      if (row.unit === 'percent') { const bp = (row.value - row.value / (1 + pct / 100)) * 100; return ` change=${bp >= 0 ? '+' : ''}${bp.toFixed(1)}bp vs previous close`; }
      return ` change=${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% vs previous close`;
    };
    const evidenceLines = promptEvidence.slice(0, 16).map(row => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${changeText(row)} observedAt=${row.observedAt} session=${row.session || 'n/a'} source=${row.source}`).join('\n');
    const regimeContext = buildMarketAnalysisRegimeContext(data, await readHistoryRows());
    const newsLines = newsEvidence.map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    const headlineLines = buildMarketAnalysisHeadlineContext(data).map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    // P1719/P1720: post-08:00 headlines are the only news on a Korean session's events before the next bundle; they are
    // labelled provisional so the model does not present them as settled.
    const intradayLines = (Array.isArray(data?.newsIntraday) ? data.newsIntraday : []).slice(0, NEWS_INTRADAY_MAX)
      .filter((row) => row && row.title && row.publishedAt)
      .map((row) => `- [08:00 이후 장중 속보(잠정)] ${row.title} [${row.source || 'unknown'}] publishedAt=${row.publishedAt}`).join('\n');
    const model = SHARED_AI_MODEL;
    const prompt = [
      '아래 근거로 시장 해석을 반드시 한국어로만 작성하라(영어 문장 금지). 제목·마크다운 헤더 없이 7~9줄 평문으로 쓴다. Write the whole answer in Korean.',
      '순서: (1) 완료된 종가 기준으로 무엇이 얼마나 바뀌었나(METRIC_EVIDENCE의 change 값 — 절대값이 가장 큰 변화부터) (2) 그 변화가 REGIME_CONTEXT의 어느 축·흐름과 맞물리는가 (3) 지금 조건에 가장 가까운 흐름 — 반드시 흐름·갈림길 이름과 함께("「이름」 — 조건 부합 n/m"), 숫자만 단독으로 쓰지 않는다 (4) 앞으로의 갈림길: REGIME_CONTEXT의 【앞으로의 갈림길】에서 다음 분기점(발표 날짜)과 조건이 가장 많이 맞는 길, 시장 가격이 같은 방향인지, 금리 괴리가 있으면 그 뜻 — 인과(무엇이 무엇을 거쳐 주가에 닿는지)를 한 문장으로 (5) 그 길이라면 선택지(기다림·분할 접근·보유 유지·방어 전환)별 기회비용과 상대적으로 유리한 쪽, 반대 길로 가면 무엇이 바뀌는지, 【테마 갈림길】이 있으면 그 길에서 순풍·역풍인 테마와 추세 속 조정 테마를 한 문장으로 (6) 다음에 확인할 것과 이 해석이 틀렸다고 볼 반증 조건. 지표를 나열만 하거나 "두 지표는 서로 다르다"처럼 정보가 없는 문장은 쓰지 마라.',
      '가격·수량·시점·특정 종목 매매 지시(사라/팔아라, 목표가, "비중을 늘리세요" 같은 명령)는 쓰지 않는다. 대신 갈림길별 선택지의 기회비용과 "이 길이라면 상대적으로 유리한 쪽"은 REGIME_CONTEXT 근거로 쓴다(소유자 2026-10-13). 가능성은 조건 부합 n/m · 시장 가격 방향 · 과거 빈도(표본 수와 함께)로만 말하고 %·확률 숫자를 만들지 마라. 세부 종목 선택은 사용자가 차트·기업·테마·스크리너에서 한다고 밝혀도 된다.',
      '각 변화율은 반드시 그 지표 이름 바로 뒤에 쓴다(예: "코스피 -1.2%"). 다른 지표의 변화율을 앞 지표 이름에 붙이지 마라. 금리(10Y)의 변화는 bp로만 쓰고 %로 쓰지 마라(금리 수준만 % 단위).',
      'METRIC_EVIDENCE에는 완료된 종가만 들어 있다. 장중 값은 쓰지 마라. 부득이 장중 값을 언급하면 "장중"과 관측 시각(예: 13:05 KST)을 같은 문장에 쓰고 "마감·종가"라고 쓰지 마라.',
      'Every numeric claim must be supported by one or more supplied METRIC_EVIDENCE ids.',
      'Do not treat VIX and Fear&Greed as the same metric, and do not spend a sentence saying they differ. Do not invent missing values. Return 7-9 concise lines.',
      'REGIME_CONTEXT (deterministic reading from the same completed closes the site shows; cite as [regime-context]):\n' + (regimeContext || 'none'),
      'METRIC_EVIDENCE:\n' + evidenceLines,
      'NEWS_CLUSTERS (article-level evidence, may be absent):\n' + (newsLines || 'none'),
      'HEADLINE_CONTEXT (retained headlines — titles only; these are the only news material available):\n' + (headlineLines || 'none')
        + (intradayLines ? '\n08:00 이후 장중 속보(잠정 — 다음 08:00 묶음 전의 미확정 헤드라인, 인용 시 "잠정"으로 표시):\n' + intradayLines : ''),
      'DIRECTIONAL/CAUSAL PROSE: you may offer a directional or causal reading, but attribute it to the named headline ("헤드라인에 따르면", "According to <source>") and present it as one reading among alternatives, never as a confirmed fact. End with what would invalidate the reading and what the reader should check. The final decision belongs to the reader, not to this text.',
    ].join('\n\n');
    const result = await ask(prompt);
    if (!result.text) return buildMarketAnalysisFallback(data, result.reason, metricEvidence, newsEvidence);
    let text = result.text;
    let semantic = validateMarketAnalysisText(text, data, snapshot, { context: regimeContext });
    // P1719: the rejected text goes to the Actions log only (400 chars), never into a public artifact.
    const logRejected = (attempt, body, issues) => console.warn(`[fetch-data] marketAnalysis ${attempt} blocked: ${issues.join(',').slice(0, 300)} :: ${String(body || '').replace(/\s+/g, ' ').slice(0, 400)}`);
    if (!semantic.ok) {
      // P1719: one retry with the validator's reasons; a second block is final for this run.
      logRejected('attempt-1', text, semantic.issues);
      const retryPrompt = prompt + '\n\nPREVIOUS_ATTEMPT_REJECTED (자동 검증기가 직전 답을 아래 이유로 차단했다. 같은 오류 없이 처음부터 다시 쓴다. 날짜·시각 숫자를 지표 이름 바로 뒤에 두지 말고, 지표 수준·변화는 METRIC_EVIDENCE 값만 쓴다):\n'
        + describeMarketAnalysisIssues(text, semantic.issues, metricEvidence, changeOf);
      const retry = await ask(retryPrompt).catch(() => ({ text: null }));
      if (retry.text) {
        text = retry.text;
        semantic = validateMarketAnalysisText(text, data, snapshot, { context: regimeContext });
        if (!semantic.ok) logRejected('attempt-2', text, semantic.issues);
      }
    }
    if (!text || !semantic.ok) {
      const reason = semantic.issues.join(',');
      const retained = retainVerifiedMarketAnalysis(previous, { reason, nowMs });
      if (retained) {
        console.warn(`[fetch-data] marketAnalysis retained previous verified analysis from ${retained.retained.from}`);
        return retained;
      }
      return buildMarketAnalysisFallback(data, reason, metricEvidence, newsEvidence);
    }
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
    // P1737: the Korea export reference moved to public-data/official-references.json (verified by the P1734 lane);
    // the operator snapshot in data.json is no longer carried forward.
    previousOfficialWebReferences = null;
    previousFearGreed = previous && previous.fearGreed || null;
    previousNews = previous && Array.isArray(previous.news) ? previous.news : null;
  } catch (_) {}

  // Keep each source plane independently observable.  A single unexpected
  // provider exception must not abort the other free-source collectors or
  // turn a complete cycle into an unlabelled empty artifact.
  const attemptedAt = new Date().toISOString();
  // P1358: collect bounded completed-session ETF research once per session.
  // This independent lane reuses the existing free delayed Yahoo path; it
  // publishes only derived rotation/returns, preserving P715 raw-price stripping.
  const rotationHistoryTask = collectRotationHistory({ fetchHistory, previous: previous?.rotationHistory, now: Date.parse(attemptedAt) });
  // P1426: monthly/weekly/daily macro observations for the 거시 direction reads (independent lane).
  const macroHistoryTask = writeMacroHistory(process.env.FRED_API_KEY).catch((error) => ({ written: false, reason: error?.message || String(error) }));
  const macroCalendarTask = writeMacroCalendar(process.env.FRED_API_KEY).catch((error) => ({ written: false, reason: error?.message || String(error) }));
  const settled = await Promise.allSettled([
    mapLimit(SYMBOLS, 6, fetchQuote),
    fetchFred(process.env.FRED_API_KEY),
    fetchFearGreed(previousFearGreed),
    fetchNews(Date.parse(attemptedAt)),
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
  // P1720: only a fresh collection carries the intraday slot; a fallback to the previous bundle publishes none.
  const newsIntraday = Array.isArray(news?.intraday) ? news.intraday : [];
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
  // P1737 (2026-10-13): NAAIM is retired (undated three-month-delayed page number, not verifiable), so the carried
  // snapshot no longer brings it forward; AAII and the Investors Intelligence boundary are unchanged.
  const { naaim: _retiredNaaim, ...carriedSurveys } = previousMarketSurveys || {};
  const marketSurveys = {
    ...carriedSurveys,
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
      const fredAsOf = String(macro[`_asOf_${field}`] || '');
      macro[field] = Number(treasury.values[field]);
      macro[`_asOf_${field}`] = treasury.observedAt;
      macro[`_source_${field}`] = 'us-treasury-official-primary';
      if (field === 't10y2y') continue;
      const official = officialTreasuryDeltas(treasury, field);
      const fredSameDate = fredAsOf === String(treasury.observedAt || '');
      for (const [suffix, value] of [['Delta', official.delta], ['Delta5', official.delta5]]) {
        if (value != null) macro[`${field}${suffix}`] = value;
        else if (!fredSameDate) delete macro[`${field}${suffix}`];
      }
      macro[`_deltaAsOf_${field}`] = official.delta != null || fredSameDate ? treasury.observedAt : null;
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
  const newsCycle = getKst0800NewsCycle(Date.parse(attemptedAt));
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
      newsIntradayPolicy: NEWS_INTRADAY_POLICY,
      newsIntradayLabel: NEWS_INTRADAY_LABEL,
      newsIntradayCount: newsIntraday.length,
      newsIntradayMax: NEWS_INTRADAY_MAX,
      serverNewsScored: true,
      newsScoreMin: newsScores.length ? Math.min(...newsScores) : null,
      newsScoreMax: newsScores.length ? Math.max(...newsScores) : null,
      putCallOk: putCall && Number.isFinite(putCall.totalPutCall),
      putCallAsOf: putCall && putCall.asOf || null,
      marketSurveysStatus: marketSurveys ? 'web-research-captured-reference' : null,
      marketSurveysCheckedAt: marketSurveys?.checkedAt || null,
      marketSurveysWebResearchCheckedAt: marketSurveys?.webResearchCheckedAt || null,
      // P1737: announces public-data/official-references.json (written by the P1734 lane later in the same workflow)
      // so the browser fetches it only once it exists; the value is that artifact's own checkedAt.
      officialReferencesCheckedAt: await readFile(`${__dir}/../public-data/official-references.json`, 'utf8')
        .then((text) => { const refs = JSON.parse(text); return /^official-web-references\.v\d+$/.test(String(refs?.schemaVersion || '')) ? refs.checkedAt || null : null; })
        .catch(() => null),
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
    // P1732: the FOMC target range derived from the FRED bounds above; 'stale' (with reason) unless both bounds
    // share a recent observation date and are 25bp apart.
    policyRates: { fed: deriveFedPolicyRate(macro, Date.parse(attemptedAt)) },
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
    // P1720: provisional post-08:00 slot (empty array when the news plane failed or nothing qualified).
    newsIntraday,
  };

  if (fredHasKey && !fredFetchOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키 유효성/레이트리밋 확인');
  // P565/R256: fredFetchOk only requires macroKeys.length > 0, so a partial failure (e.g. 6 of
  // 9 series succeed) previously passed this check silently — the exact mechanism that let
  // individual stale/broken series (Fed/BOJ/BOK/BOE rates) go unnoticed for weeks.
  if (fredHasKey && fredFailedSeries.length > 0) console.warn(`[fetch-data] 경고: FRED 시리즈 ${fredFailedSeries.length}건 실패 — ${fredFailedSeries.join(', ')}`);
  if (!resolveSharedAiConfig()) console.warn('[fetch-data] 경고: 공유 AI Worker/자동화 인증 미설정 — AI 분석 보류. 검증된 관측치만 표시.');

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
  // M01: append this cycle's completed close first, so the narrative's regime context reads the same session the
  // published history (and therefore the screen) will show.
  const histInfo = await updateHistory(data, marketSnapshotForConsumers, fredDexkous);
  try {
    const headlineTranslation = await translateHeadlines([...(data.news || []), ...(data.newsIntraday || [])], {
      previous: [...(previous?.news || []), ...(previous?.newsIntraday || [])],
      request: resolveSharedAiConfig() ? (prompt) => requestSharedAnalysis(prompt) : null,
      translate: resolveSharedAiConfig() ? (titles) => requestWorkersAiTranslation(titles) : null });
    data.meta.headlineTranslation = headlineTranslation;
    console.log(`[fetch-data] headline translation: reused ${headlineTranslation.reused}, new ${headlineTranslation.translated}/${headlineTranslation.pending}${headlineTranslation.provider ? ` via ${headlineTranslation.provider}` : ''}${headlineTranslation.freeReason ? ` (free path: ${headlineTranslation.freeReason})` : ''}${headlineTranslation.reason ? ` (${headlineTranslation.reason})` : ''}`);
  } catch (error) { console.warn(`[fetch-data] headline translation skipped: ${error?.message || error}`); }
  const marketAnalysis = await genMarketAnalysis(data, marketSnapshotForConsumers, { previous: previous?.marketAnalysis || null });
  if (marketAnalysis) {
    data.marketAnalysis = marketAnalysis;
    data.meta.marketAnalysisOk = marketAnalysis.status === 'verified';
    // P1719: a retained previous verification is still verified prose, but this run's attempt was blocked.
    data.meta.marketAnalysisRetained = marketAnalysis.retained || null;
    data.meta.marketAnalysisSemanticOk = marketAnalysis.status === 'verified' && marketAnalysis.semanticStatus === 'verified' && Array.isArray(marketAnalysis.metricEvidence) && marketAnalysis.metricEvidence.length >= 2 && (!marketAnalysis.semanticIssues || marketAnalysis.semanticIssues.length === 0);
    data.meta.marketAnalysisEvidenceCount = Array.isArray(marketAnalysis.metricEvidence) ? marketAnalysis.metricEvidence.length : 0;
    data.meta.marketAnalysisNewsEvidenceCount = Array.isArray(marketAnalysis.newsEvidence) ? marketAnalysis.newsEvidence.length : 0;
    // P1594: retain the exact blocked reason, never substitute a credentials/budget guess.
    data.meta.marketAnalysisReason = marketAnalysis.status === 'verified' ? null : marketAnalysis.reason;
  } else {
    data.meta.marketAnalysisOk = false;
    data.meta.marketAnalysisSemanticOk = false;
    data.meta.marketAnalysisEvidenceCount = 0;
    data.meta.marketAnalysisNewsEvidenceCount = 0;
    data.meta.marketAnalysisReason = 'analysis-unavailable';
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
  data.rotationHistory = await rotationHistoryTask;
  await atomicWriteFile(OUT, JSON.stringify(toPublicPayload(data), null, 1));
  const macroHistoryInfo = await macroHistoryTask;
  const macroCalendarInfo = await macroCalendarTask;
  console.log(`[fetch-data] macro calendar: ${JSON.stringify(macroCalendarInfo)}`);
  console.log(`[fetch-data] macro history: ${JSON.stringify(macroHistoryInfo)}`);
  // WO-7 (ops): 일별 히스토리 누적 (충분한 데이터일 때만 — 아래 <50% 가드와 별개로 핵심 심볼 존재 시)
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
