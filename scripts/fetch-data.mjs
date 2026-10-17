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
import { deriveFredCycle } from './lib/refresh-continuity.mjs';
import { factorScopesByMarket, listingMarketOfSymbol, sessionDateInMarket, timeZoneForMarket, timeZoneForSymbol } from '../src/domain/market/session-time.js';
import { latestCompletedUsSession, nyParts, resolveMarketCalendarSession } from '../src/ai/time/market-session.js';
import { barSessionDateForField, historyFieldSessionDate, observationSessionDate } from '../src/domain/market/history-session.js'; // v57.81
import { FACTOR_FRESHNESS_MS } from '../src/domain/screener/factor-ranks.js';
import { reconcileSecRecord } from '../src/domain/fundamental/sec-report.js'; // P1402 + 2026-10-13 F03-F05
import { secFundamentalRowFields } from '../src/domain/fundamental/sec-row-fields.js'; // v57.81: shared with the browser's out-of-universe read
import { evaluateSymbolSignals, distributionDaySeries, BREADTH_SIGNAL_MODEL_VERSION } from '../src/domain/market/breadth-signals.js'; // P1416
import { collectRotationHistory } from './lib/rotation-history.mjs';
import { updateCandidateArchive } from './lib/candidate-archive.mjs'; // P1465
import { SHARED_AI_MODEL, requestSharedAnalysis, requestWorkersAiTranslation, resolveSharedAiConfig } from './lib/ai-shared-analysis.mjs';
import { buildMarketRegime, buildCloseSeries } from '../src/domain/briefing/market-read.js'; // P1635; v57.81 session dates
import { buildMarketScenarios, renderMarketScenarioContext } from '../src/domain/market/regime-scenarios.js';
import { buildScenarioOutlook, renderScenarioOutlookContext } from '../src/domain/market/scenario-outlook.js';
import { buildMacroRead } from '../src/domain/macro/macro-read.js';
import { buildMacroCrossroads, upcomingMacroEvents, renderMacroCrossroadsContext } from '../src/domain/market/macro-crossroads.js';
import { round } from './lib/producer-math.mjs';
import { EXTENDED_SHARD_SCHEMA, RANKING_CONTRACTS, encodeScreenerArtifact, encodeShardRows, expandScreenerArtifact, isValidShard } from '../src/data/screener-extended.js'; // v57.81; v57.95 core encoding
import { _mean, closesToFactors, backtestFactors } from './lib/factors.mjs'; // v57.62 split
import { deriveFactorQuality, isSessionComplete, sessionSegmentOfSymbol, listingCurrencyOf, dailyRowsFromYahooChart, priceHistoryFromRows, priceFactorRow } from '../src/domain/screener/price-factors.js'; // v57.81: shared with the browser
import { indexReturnsByDate } from '../src/domain/technical/follow-through.js'; // v57.87: down-day resilience
export { deriveFactorQuality, isSessionComplete, sessionSegmentOfSymbol, listingCurrencyOf } from '../src/domain/screener/price-factors.js';
import { fetchJSON, _fetchRss } from './lib/producer-http.mjs'; // v57.62 split
import { FRED_SERIES, compareUsdKrwCrossCheck, fetchAaiiSentiment, fetchBeaPce, fetchBlsSeries, fetchCboePutCall, fetchFearGreed, fetchFredDexkousPublic, fetchFredHyOasPublic, fetchTreasuryYieldCurve, mergeMacroLastKnownGood, officialTreasuryDeltas } from './lib/macro-sources.mjs'; // v57.62 split
import { MINIMUM_CURRENT_NEWS, NEWS_FEEDS, NEWS_INTRADAY_LABEL, NEWS_INTRADAY_MAX, NEWS_INTRADAY_POLICY, TICKER_NEWS_MAX_AGE_MS, deriveCyclePublication, deriveTickerNewsLineage, fetchNews, fetchTickerNewsItems, getKst0800NewsCycle, planTickerNewsTargets, selectTickerNewsMemo } from './lib/news-selection.mjs'; // v57.62 split
import { KOREA_MOVE_MENTION_PCT, MARKET_ANALYSIS_CLOSED_SESSIONS, MARKET_SENTENCE_LABEL, dailyMarketSentence, splitMarketSentence, buildMarketAnalysisEvidence, buildMarketAnalysisHeadlineContext, buildMarketAnalysisNewsEvidence, buildStructuredMarketAnalysis, describeMarketAnalysisIssues, retainVerifiedMarketAnalysis, reusableMarketAnalysis, validateMarketAnalysisText, lastVerifiedMarketAnalysis, plainMarketFallbackSummary, LARGE_MOVE_ATTRIBUTION_PCT } from './lib/market-analysis-validate.mjs'; // v57.62 split
export { buildMarketAnalysisEvidence, MARKET_ANALYSIS_CLOSED_SESSIONS, analysisMetricMentions, validateAnalysisMetricMentions, validateAnalysisAdmission, analysisNumberMarkedAsReference, validateMarketAnalysisText, MARKET_ANALYSIS_NEWS_CONTENT_POLICY, isMarketAnalysisNewsEligible, buildMarketAnalysisNewsEvidence, buildMarketAnalysisHeadlineContext, describeMarketAnalysisIssues, MARKET_ANALYSIS_RETAIN_MAX_MS, retainVerifiedMarketAnalysis, reusableMarketAnalysis } from './lib/market-analysis-validate.mjs';
export { deriveCyclePublication, newsSourceLabel, serverNewsHeadlineMonthStale, scoreServerNewsItem, newsHeadlineSignature, newsSameEvent, cleanNewsTitle, newsKeyEntities, createNewsTopicCap, NEWS_INTRADAY_MAX, NEWS_INTRADAY_POLICY, NEWS_INTRADAY_LABEL, selectNewsIntraday, tickerNewsCoreName, TICKER_NEWS_WORD_SYMBOLS, tickerNewsHeadlineNamesIssuer, TICKER_NEWS_MAX_AGE_MS, selectTickerNewsMemo, TICKER_NEWS_RUN_CAP, TICKER_NEWS_FIXED_HEAD, TICKER_NEWS_ROTATION_SLOT_MS, planTickerNewsTargets, deriveTickerNewsLineage } from './lib/news-selection.mjs';
export { parseFredHyOasCsv, fetchFredHyOasPublic, parseFredDexkousCsv, fetchFredDexkousPublic, compareUsdKrwCrossCheck, parseTreasuryYieldCurveHtml, parseTreasuryYieldCurveXml, officialTreasuryDeltas, fetchTreasuryYieldCurve, parseAaiiSentimentText, fetchAaiiSentiment, mergeMacroLastKnownGood, parseBeaPceHtml, normalizeBlsSeriesResponse, BLS_RELEASE_SCHEDULE_IDS, blsReleaseCacheBypass, fetchBlsSeries, parseCboePutCallHtml, classifyCboePutCallCurrentness } from './lib/macro-sources.mjs';
export { _mean, closesToFactors, backtestFactors, dailyNotionalAverage, fxRateOnOrBefore } from './lib/factors.mjs';

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

// v50.24/WO-1: Yahoo는 두 호스트(query1/query2)를 운영하고 차단/레이트리밋이 호스트마다 다르게
// 걸리는 경우가 잦다. GitHub Actions 러너 IP가 한 호스트에서 막혀도 다른 호스트로 폴백 → 전량 실패
// (= data.json 미갱신)를 줄인다. 2 호스트 × 2 시도 = 최대 4회. 그래도 다 실패하면 throw(해당 심볼만).
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 (호스트 폴백 내성) ──
// v51.64 P545: 주말/휴장 수집 시 Yahoo meta.chartPreviousClose가 전주 종가를 반환해
// 주간 변동률이 일간으로 오표시되는 구조적 문제 수정.
// → range=5d OHLCV 배열의 실제 전전일 종가(closes[-2])로 일간 Pct 계산.
//   OHLCV 배열이 2개 미만일 때만 chartPreviousClose로 폴백.
// P1799 (2026-10-15): closes[-2] assumes the last bar is the current session. At the KRX open Yahoo has not printed
// today's bar yet (or prints it with a null close), so closes[-2] was the close two sessions back: 10/15 09:01 KST
// showed KOSPI -5.53% / KOSDAQ -6.24% against the 10/13 close instead of -5.1% / -4.75% against 10/14, and on 10/14
// the -0.44% close read as -5.88%. For Seoul-session quotes the previous close is the last bar dated before the
// session of regularMarketTime (exchange-local dates via meta.gmtoffset).
export function exchangeLocalDate(ms, timeZone) {
  if (!Number.isFinite(ms) || !timeZone) return null;
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch (_) { return null; }
}
export function previousCloseBarIndex(closeBars, meta) {
  const bars = Array.isArray(closeBars) ? closeBars : [];
  if (meta?.exchangeTimezoneName !== 'Asia/Seoul' || !Number.isFinite(meta?.regularMarketTime) || !Number.isFinite(meta?.gmtoffset)) return bars.length >= 2 ? bars.length - 2 : -1;
  const localDay = (seconds) => new Date((seconds + meta.gmtoffset) * 1000).toISOString().slice(0, 10);
  const sessionDay = localDay(meta.regularMarketTime);
  return bars.map((bar) => Number.isFinite(bar.timestamp) && localDay(bar.timestamp) < sessionDay).lastIndexOf(true);
}
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
      const prevIndex = previousCloseBarIndex(closeBars, m);
      let prev, pct, pctSource;
      if (prevIndex >= 0) {
        prev = closes[prevIndex];               // 실제 전일 거래일 종가
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
        // P1799: when the current session's bar is not printed yet, its opening boundary is unknown — fail closed (P1095).
        regularMarketPreviousCloseObservedAt: prevIndex === closeBars.length - 2 && Number.isFinite(closeBars[closeBars.length - 1].timestamp)
          ? new Date(closeBars[closeBars.length - 1].timestamp * 1000).toISOString()
          : null,
        // P1192: 위 경계가 이 행의 완료 컷을 넘을 때(진행 중 bar의 개시 시각이 KST-08:00 컷보다
        // 뒤인 창 — FX/상품) 쓸 직전 bar의 개시 경계. 관측 시각이 아니라 bar 경계다.
        previousBarOpenedAt: prevIndex >= 0 && Number.isFinite(closeBars[prevIndex].timestamp)
          ? new Date(closeBars[prevIndex].timestamp * 1000).toISOString()
          : null,
        // v57.70 (2026-10-15 audit): the boundary above is 00:00 ET of the NEXT day for futures/DXY bars, and readers
        // dated the close by that boundary — the 10/12 WTI close sat on 10/13 and the briefing read 0.0% for a day.
        // The previous bar's own trading date, in the exchange's time zone, names the session the close belongs to.
        previousCloseSessionDate: prevIndex >= 0 && Number.isFinite(closeBars[prevIndex].timestamp)
          ? exchangeLocalDate(closeBars[prevIndex].timestamp * 1000, m.exchangeTimezoneName)
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
            // P1721 dated the cut close by its own stamp; v57.81 writes that date (New York trading day of the cut, at or
            // before 19:00 ET) so a later read of the same cut is recognised as the same session, not a new one.
            quote.previousCloseSessionDate = exchangeLocalDate(Date.parse(cut.observedAt || ''), 'America/New_York');
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
      // v57.81: the row assembly is shared with the browser's out-of-universe read (src/domain/screener/price-factors.js).
      return dailyRowsFromYahooChart(res, { fetchedAt });
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
  // v57.83 (owner 2026-10-16: "지수는 덜 빠져도 AI·반도체는 많이 빠졌다"): the semiconductor ETF, already collected in
  // SYMBOLS, gets a daily close column so a semiconductor drawdown under a steady index (2026-02~03, 2026-07) is on record.
  // The <60-observation rule backfills one year on the next run. Nothing reads it for a judgement yet.
  'SMH': 'smh',
};
const HIST_FIELDS = ['spx','nasdaq','ndx','dow','rut','vix','vix3m','vvix','tnx','dxy','wti','brent','gold','kospi','kosdaq','btc','usdkrw','usdjpy','tlt','smh','fg'];
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
  smh: [20, 2000],
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
    // v57.81: a futures/FX/DXY/BTC bar is still trading until the next bar opens, so the newest bar of a continuous
    // instrument is never written as a completed close (the market lane records it as a previous close once closed).
    const continuous = /(=F|=X)$|^DX-Y\.NYB$|-USD$/.test(r.sym);
    for (const [barIndex, bar] of r.rows.entries()) {
      if (continuous && barIndex === r.rows.length - 1) continue;
      // v57.81: a bar is keyed by its own session in its zone. Yahoo FX bars open at 00:00 London (23:00Z in summer),
      // so the UTC date of the stamp filed the 10/9 won bar under 10/8.
      const sessionDate = barSessionDateForField(field, bar.observedAt) || bar.date;
      const row = { ...bar, date: sessionDate };
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
        sessionDate, // v57.81: the bar's own session (its open stamp's local date)
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

// v57.81: history.json carried one market session under two row dates. A row is keyed by the UTC run date and holds
// the latest completed close known at that run, so the backfill lane's 10/12 DXY bar (row 10/12) and the market lane's
// previous close at the 10/13 23:51Z run (the same 10/12 close, row 10/13) were two "observations" of 102.58, and a
// weekend row repeated Friday's close as if new. Each field's session is now compared across rows: the earliest row
// that records a session owns it, and a later row with the same session is marked held (carried-forward, carriedFrom,
// heldReason) — never deleted. When two producer-dated reads of one session differ, the later read (the provider's
// settled bar) revises the owner and the replaced value is kept in `revisions`. Legacy pairs that differ keep both
// values; readers resolve them by settle time. Idempotent: a held field is skipped on the next run.
export function holdRepeatedSessions(hist, { at = new Date().toISOString(), fields = HIST_MARKET_FIELDS } = {}) {
  const rows = (Array.isArray(hist) ? hist : []).filter((row) => row && typeof row === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')))
    .sort((a, b) => a.date.localeCompare(b.date));
  const held = [];
  const revised = [];
  const dated = (meta) => /^\d{4}-\d{2}-\d{2}$/.test(String(meta?.sessionDate || ''));
  for (const field of fields) {
    const owners = new Map();
    for (const row of rows) {
      const value = row[field];
      const meta = row.fieldMeta?.[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || !meta?.observedAt || meta.observationRelation === 'carried-forward') continue;
      const session = historyFieldSessionDate(meta, field) || observationSessionDate(field, meta.observedAt);
      if (!session) continue;
      const owner = owners.get(session);
      if (!owner) { owners.set(session, row); continue; }
      const ownerMeta = owner.fieldMeta[field];
      if (owner[field] !== value) {
        if (!dated(ownerMeta) || !dated(meta)) continue;
        ownerMeta.revisions = [...(Array.isArray(ownerMeta.revisions) ? ownerMeta.revisions : []),
          { value: owner[field], observedAt: ownerMeta.observedAt || null, fetchedAt: ownerMeta.fetchedAt || null, revisedAt: at, revisedFromRow: row.date }].slice(-5);
        revised.push({ date: owner.date, field, session, from: owner[field], to: value, by: row.date });
        owner[field] = value;
      }
      row.fieldMeta[field] = {
        ...meta,
        allowedUse: 'reference-only',
        observationRelation: 'carried-forward',
        heldRelation: meta.observationRelation || null,
        heldReason: 'session-already-recorded',
        carriedFrom: owner.date,
        sessionDate: session,
      };
      held.push({ date: row.date, field, session, carriedFrom: owner.date });
    }
  }
  return { held, revised };
}

export function usPreOpenIndexPrint(symbol, observedAt) {
  if (!/^\^(VIX|VIX3M|VVIX|GSPC|IXIC|NDX|DJI|RUT|TNX)$/.test(String(symbol || ''))) return false;
  const at = Date.parse(observedAt || '');
  if (!Number.isFinite(at)) return false;
  const parts = nyParts(at);
  const day = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return !['Sat', 'Sun'].includes(day) && parts.minute < 9 * 60 + 30;
}

// v57.81: futures, DXY and FX reopen at 18:00 ET for the next trading day. A print from that evening (the 10/04 and 10/11
// Sunday 23:01-23:26Z WTI/DXY/gold/won prints filed as MARKET_CLOSED) belongs to a session that has not completed, so
// it is never a completed close; the history takes the previous completed close instead.
export function continuousReopenPrint(symbol, observedAt) {
  if (!/(=F|=X)$|^DX-Y\.NYB$/.test(String(symbol || ''))) return false;
  const at = Date.parse(observedAt || '');
  if (!Number.isFinite(at)) return false;
  const day = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return !['Fri', 'Sat'].includes(day) && nyParts(at).minute >= 18 * 60;
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
      // v57.81: an evening reopen print of a futures/FX/DXY session is the same case (continuousReopenPrint).
      const preOpenPrint = !isOpenPoint && (usPreOpenIndexPrint(q.symbol, q.observedAt) || continuousReopenPrint(q.symbol, q.observedAt));
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
        sessionDate: effectiveUsePreviousClose ? (q.previousCloseSessionDate || null) : null,
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
      ...(quote?.sessionDate ? { sessionDate: quote.sessionDate } : {}),
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
      // v57.81: every completed close names its session. A previous close takes the provider bar's own trading date
      // (v57.70) or, when the provider gave none, the session its bar-boundary stamp determines; a closing print takes
      // its exchange-local date. holdRepeatedSessions then compares sessions, not row dates.
      if (!fieldMeta[field].sessionDate) {
        const session = historyFieldSessionDate(fieldMeta[field], field) || observationSessionDate(field, fieldMeta[field].observedAt);
        if (session) fieldMeta[field].sessionDate = session;
      }
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
    // v57.81: a session already recorded on an earlier row is held on this one, never a second observation.
    const held = holdRepeatedSessions(hist, { at: fetchedAt });
    if (held.held.length || held.revised.length) console.log(`[fetch-data] history: 같은 세션 반복 ${held.held.length}건 보류 표시, 재조회 갱신 ${held.revised.length}건`);
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 420) hist = hist.slice(hist.length - 420);  // 14개월 cap
    await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(hist)));
    // P1246: 이번 실행이 실제로 기록한 USD/KRW 확정 종가. FRED DEXKOUS 교차검증이 이 값을 기준으로
    // 삼는다 — 아티팩트가 실제로 담은 값이어야 검증이 의미를 갖는다. 없으면 null로 남겨 교차검증이
    // "판정 불가"를 말하게 한다(값을 지어내지 않는다).
    const fxObservation = Number.isFinite(fieldValues.usdkrw)
      ? { value: fieldValues.usdkrw, date: today, observedAt: fieldMeta.usdkrw?.observedAt || null, valueBasis: fieldMeta.usdkrw?.valueBasis || null }
      : null;
    // P1246: 공식 관측일과 **같은 시점**의 우리 확정 종가를 골라 비교한다. 하루 어긋난 봉까지는 같은
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

async function _enrichPriceFactors(syms, { concurrency = 5 } = {}) {
  const computedAt = new Date().toISOString();
  const results = await mapLimit(syms, concurrency, async (sym) => {
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
  try { universeRows = JSON.parse(await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8')).universe || []; } catch (_) { universeRows = []; }
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
      ['pePrice','pePriceBasis','pbPrice','pbPriceBasis','valuationPrice','valuationPriceBasis','valuationSharesOutstanding','valuationSharesObservedAt','valuationSharesCheck','valuationSharesBasis','valuationHeldReason'].forEach(key => {
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
  // v57.95: rows are written in the row-defaults encoding (shared lineage once per file); readers expand it.
  await atomicWriteFile(SCREENER_OUT, JSON.stringify(encodeScreenerArtifact(payload)));
  // P1465: record today's default-profile candidates (the page's own ranking path on the files just
  // written) and fill the outcomes of entries whose 21-session window has closed. Non-fatal.
  try {
    const archiveInfo = await updateCandidateArchive({ root: new URL('../', import.meta.url), results, write: (url, text) => atomicWriteFile(fileURLToPath(url), text) });
    console.log(`[fetch-data] candidate archive: ${archiveInfo.action} ${archiveInfo.date || '-'} · entries ${archiveInfo.entries} · measured ${archiveInfo.measured} (+${archiveInfo.filled})`);
  } catch (e) { console.warn('[fetch-data] candidate archive 실패(무시):', e && e.message || e); }
  return { count: ok, universe: syms.length, asOf: payload.asOf, backtestIC: backtest && backtest.ic && backtest.ic.composite, tickerNews: tickerNewsOk, fmpOk: fmpResult.ok > 0, fmpCount: fmpResult.ok, fmpHasKey: fmpResult.hasKey, fmpPlanError: fmpResult.planError, secFundamentalsOk: secResult.ok > 0, secFundamentalsCount: secResult.ok, fundamentalCount, fundamentalCoveragePct };
}

// ── v57.81: extended universe shard (Russell 2000 + Nasdaq-listed common stocks outside the core) ──
// Owner (2026-10-15): every Russell 2000 member and every Nasdaq-listed stock must be ranked with the same factors.
// The core artifact (screener.json) keeps its size and contract; the extra rows go to screener-extended.json with the
// same row schema, produced by the same _enrichPriceFactors / enrichSecFundamentals / mergeSecIntoFactorRows path.
// It runs as its own job after the core refresh (refresh-screener.yml), so a failure here never touches the core.
const SCREENER_EXTENDED_OUT = `${__dir}/../public-data/screener-extended.json`;
const SCREENER_EXTENDED_UNIVERSE = `${__dir}/../public-data/screener-extended-universe.json`;
const SEC_EXTENDED_LEDGER_PATH = `${__dir}/../public-data/sec-fundamentals-extended.json`;
// Below this share of fetched histories the run is treated as a provider failure: the previous shard stays.
export const EXTENDED_SHARD_COVERAGE_FLOOR = 0.6;
// A full refresh runs once per new US session (the core's US factor session advanced past the shard's), with an age
// backstop so a missed trigger heals within a day. Rows all describe one session, so no rotation is needed.
export const EXTENDED_REFRESH_MAX_AGE_MS = 26 * 3600 * 1000;

export function extendedRefreshDue({ previousShard = null, coreScreener = null, nowMs = Date.now(), force = false } = {}) {
  if (force) return { due: true, reason: 'forced' };
  if (!previousShard?.asOf || !isValidShard(previousShard)) return { due: true, reason: 'no-previous-shard' };
  const previousSession = previousShard.factorSessionDateByMarket?.US || null;
  const coreSession = coreScreener?.factorSessionDateByMarket?.US || null;
  if (coreSession && (!previousSession || previousSession < coreSession)) return { due: true, reason: `core-session-advanced:${previousSession || 'none'}->${coreSession}` };
  const ageMs = nowMs - Date.parse(previousShard.asOf);
  if (!(ageMs < EXTENDED_REFRESH_MAX_AGE_MS)) return { due: true, reason: 'age-backstop' };
  return { due: false, reason: `shard-current:${previousSession || 'unknown'}` };
}

export function buildExtendedShardPayload({ data, syms, identityRows, membership, secResult, computedAt, ok, nowIso = new Date().toISOString() }) {
  const factorScopes = factorScopesByMarket(data);
  const fundamentalCount = syms.filter((sym) => ['pe', 'pb', 'roe', 'margin', 'revGrowth'].some((key) => typeof data[sym]?.[key] === 'number' && Number.isFinite(data[sym][key]))).length;
  const sources = membership?.meta?.sources || {};
  const encoded = encodeShardRows(data);
  return {
    schemaVersion: EXTENDED_SHARD_SCHEMA,
    asOf: nowIso,
    factorObservedAt: factorScopes.US?.barStart || null,
    factorTimeBasis: 'bar-start',
    factorSessionDateByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.sessionDate])),
    factorBarStartByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.barStart])),
    factorComputedAt: computedAt,
    source: 'github-actions:yahoo-1y',
    universe: syms.length,
    ok,
    unfetchedSymbols: syms.filter((sym) => !data[sym]).sort(),
    coverage: { pricePct: syms.length ? round(ok / syms.length * 100, 1) : 0, floorPct: EXTENDED_SHARD_COVERAGE_FLOOR * 100, fundamentalCount, fundamentalCoveragePct: syms.length ? round(fundamentalCount / syms.length * 100, 1) : 0 },
    membership: {
      artifact: 'public-data/screener-extended-universe.json',
      generatedAt: membership?.generatedAt || null,
      asOf: { r2000: sources.r2000?.asOf || null, nasdaq: sources.nasdaq?.asOf || null },
      status: { r2000: sources.r2000?.status || 'UNKNOWN', nasdaq: sources.nasdaq?.status || 'UNKNOWN' },
      counts: membership?.meta?.counts || null
    },
    fmpHasKey: false,
    secFundamentalsOk: secResult.ok > 0,
    secFundamentalsCount: secResult.ok,
    secFundamentalsStored: secResult.stored,
    secFundamentalsEligible: secResult.eligible,
    secFundamentalsModel: secResult.model,
    secFundamentalsGeneratedAt: secResult.generatedAt,
    fundamentalCount,
    fundamentalCoveragePct: syms.length ? round(fundamentalCount / syms.length * 100, 1) : 0,
    fundamentalCoverageDenominator: syms.length,
    fundamentalModels: ['sec-fy-normalized-v2'],
    fundamentalCoverageScope: 'extended universe (Russell 2000 + Nasdaq common stocks outside the core); SEC annual facts from the compact extended ledger, filled over daily batches',
    rankingContract: {
      contract: RANKING_CONTRACTS.extended.id,
      label: RANKING_CONTRACTS.extended.label,
      population: RANKING_CONTRACTS.extended.population,
      allowedUse: 'research-relative-ranking-only',
      tradingSignal: false,
      predictiveValidation: 'not-established',
      liveModelParity: false,
      validationReadiness: { status: 'BLOCKED', blockers: ['extended-universe-not-backtested'] },
      percentilePolicy: 'The browser recomputes factor percentiles over core + extended rows of the same market. The core view ranks the core universe only, so a core stock can hold a different percentile in each view.',
      coreOnly: ['backtest', 'candidate-archive', 'conditional-evidence', 'model-validation'],
      weightPolicy: 'fixed-neutral-until-explicit-promotion',
      reason: 'same factor model as the core artifact; the extended population has no backtest or forward candidate record'
    },
    universeLineage: {
      generatedFrom: 'public-data/screener-extended-universe.json',
      membershipPolicy: 'current-membership-applied-retrospectively',
      lookaheadBias: 'historical-membership-not-available',
      survivorshipBias: 'uncontrolled-current-membership-only',
      allowedUse: 'research-reference-not-predictive-validation'
    },
    coreMembership: membership?.coreMembership && typeof membership.coreMembership === 'object' ? membership.coreMembership : {},
    identity: identityRows.map((row) => ({
      sym: row.sym, name: row.name || row.sym, sector: row.sector || null, index: row.index || null,
      membership: Array.isArray(row.membership) ? row.membership : [], exchange: row.exchange || null,
      ...(row.nasdaqFinancialStatus ? { nasdaqFinancialStatus: row.nasdaqFinancialStatus } : {}),
      // 2026-10-16: SEC SIC from the extended ledger; the ranker drops blank checks (6770) by this code, not the name.
      ...(/^\d{3,4}$/.test(String(secResult?.sicBySymbol?.[row.sym]?.sic || '')) ? { sic: String(secResult.sicBySymbol[row.sym].sic) } : {})
    })),
    ...encoded
  };
}

export async function enrichScreenerExtended({ nowMs = Date.now() } = {}) {
  let membership = null;
  try { membership = JSON.parse(await readFile(SCREENER_EXTENDED_UNIVERSE, 'utf8')); } catch { /* not produced yet */ }
  if (!Array.isArray(membership?.universe) || !membership.universe.length) return { skipped: true, reason: 'no-extended-universe' };
  let previous = null;
  try { previous = JSON.parse(await readFile(SCREENER_EXTENDED_OUT, 'utf8')); } catch { /* first run */ }
  let core = null;
  try { core = JSON.parse(await readFile(SCREENER_OUT, 'utf8')); } catch { /* core missing: the age rule decides */ }
  const due = extendedRefreshDue({ previousShard: previous, coreScreener: core, nowMs, force: process.env.SCREENER_EXTENDED_FORCE === '1' });
  if (!due.due) { console.log(`[fetch-data] extended shard not due (${due.reason})`); return { skipped: true, reason: due.reason }; }
  // The core universe may have grown since the membership file was written; a core symbol is never duplicated here.
  const coreSymbols = new Set((await getScreenerUniverse()).symbols);
  const identityRows = membership.universe.filter((row) => row && row.sym && !coreSymbols.has(row.sym));
  const syms = identityRows.map((row) => row.sym);
  const assetType = Object.fromEntries(identityRows.map((row) => [row.sym, screenerAssetType(row)]));
  const concurrency = Math.max(1, Math.min(8, Number(process.env.SCREENER_EXTENDED_CONCURRENCY) || 5));
  const startedAt = Date.now();
  const { data, results, ok, computedAt } = await _enrichPriceFactors(syms, { concurrency });
  console.log(`[fetch-data] extended price factors ${ok}/${syms.length} in ${Math.round((Date.now() - startedAt) / 1000)}s (concurrency ${concurrency}, due: ${due.reason})`);
  const secResult = await enrichSecFundamentals(syms, data, results, assetType, { ledgerPath: SEC_EXTENDED_LEDGER_PATH });
  mergeSecIntoFactorRows(data, secResult.data);
  // P715: no raw price is published. Ticker news is collected for the core only; the status says so per row.
  for (const sym in data) {
    if (data[sym] && 'price' in data[sym]) delete data[sym].price;
    data[sym].newsStatus = 'not-covered';
  }
  if (syms.length && ok / syms.length < EXTENDED_SHARD_COVERAGE_FLOOR) {
    console.log(`::warning::extended shard: ${ok}/${syms.length} histories (< ${EXTENDED_SHARD_COVERAGE_FLOOR * 100}%) — ${previous ? 'previous shard kept' : 'nothing written'}`);
    return { retained: !!previous, count: ok, universe: syms.length };
  }
  const payload = buildExtendedShardPayload({ data, syms, identityRows, membership, secResult, computedAt, ok });
  await atomicWriteFile(SCREENER_EXTENDED_OUT, JSON.stringify(payload));
  console.log(`[fetch-data] extended shard ${ok}/${syms.length} rows · fundamentals ${payload.fundamentalCount} (${payload.fundamentalCoveragePct}%) · US session ${payload.factorSessionDateByMarket.US || '-'}`);
  return { count: ok, universe: syms.length, asOf: payload.asOf };
}

// v57.81: SESSION_CLOSE_RULES, sessionSegmentOfSymbol, listingCurrencyOf and isSessionComplete live in
// src/domain/screener/price-factors.js (shared with the browser's out-of-universe read).

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
// v57.69 (P1802): the history lane already withholds a count judged on less than half the universe; the
// contributor lane did not, so 10/14 was published with one eligible mover and the screen read 0 as a count.
export const breadthMinimumEligible = (universe) => Math.max(20, Math.ceil(Number(universe) * 0.5));
export function buildBreadthContributorSessions(rows, nowMs = Date.now()) {
  return (Array.isArray(rows) ? rows : [])
    .filter((point) => point?.date && point?.us?.contributors && isSessionComplete(point.date, 'us', nowMs)
      && Number(point.us.signalEligible?.movers) >= breadthMinimumEligible(point.us.universe))
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
}
async function writeBreadthContributors(rows, nowMs = Date.now()) {
  const sessions = buildBreadthContributorSessions(rows, nowMs);
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
      const minimumEligible = breadthMinimumEligible(universe);
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

// v57.81: plain Korean values with their session ("10/14 종가"), never "SPX=… (ISO)"; the last verified reading rides along
// as `lastVerified` so the next run can still keep it (retainVerifiedMarketAnalysis).
function buildMarketAnalysisFallback(data, reason, metricEvidence = buildMarketAnalysisEvidence(data), newsEvidence = buildMarketAnalysisNewsEvidence(data), { previous = null, nowMs = Date.now() } = {}) {
  const summary = plainMarketFallbackSummary(metricEvidence);
  const fallback = buildStructuredMarketAnalysis({ data, text: summary, model: 'none', status: 'blocked', reason, metricEvidence, newsEvidence, semantic: { ok: false, issues: [reason], causalEvidenceCount: 0 } });
  const lastVerified = lastVerifiedMarketAnalysis(previous, nowMs);
  return lastVerified ? { ...fallback, lastVerified } : fallback;
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
    // v57.81 (owner 2026-10-15): the trend state with the Nasdaq-100 / Russell 2000 evidence rows and the leadership-break
    // flag travel as their own lines, so the narrative cannot call the trend 양호 or say semis lead while the flag is on.
    const trend = (regime.axes || []).find((axis) => axis.id === 'trend');
    const trendLine = trend ? `추세 판정: ${trend.stateLabel || trend.state}${trend.testing ? ' (50일선 시험 구간)' : ''}${trend.capped ? ' (나스닥 100·러셀 2000 동반 약세로 중립 상한)' : ''} · 근거: ${(trend.evidence || []).map(([label, value]) => `${label} ${value}`).join('; ')}` : '';
    const leadership = regime.leadership;
    const leadershipLine = leadership?.break ? `주도 영역 이탈(leadershipBreak): 예 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      // v57.83: leaders weak without market-wide confirmation is not "아니오" — the narrative must not say they still lead.
      : leadership?.state === 'weak' ? `주도 영역 이탈(leadershipBreak): 확산 미확인 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      : leadership?.state === 'holding' ? '주도 영역 이탈(leadershipBreak): 아니오.' : '주도 영역 이탈(leadershipBreak): 확인 불가.';
    const conflicts = (regime.conflicts || []).length ? `엇갈리는 신호: ${regime.conflicts.join(' ')}` : '';
    // v57.81: the validator rejects a Korea-vs-US sentence without both session dates when they differ; the packet says so.
    const krDate = buildCloseSeries(input.history, 'kospi').at(-1)?.date || null;
    const sessions = krDate && regime.asOf && krDate !== regime.asOf ? `세션 기준일: 미국 ${regime.asOf.slice(5).replace('-', '/').replace(/^0/, '')} · 한국 ${krDate.slice(5).replace('-', '/').replace(/^0/, '')} — 두 시장을 한 문장에서 함께 말하면 두 날짜(M/D)를 모두 적을 것.` : '';
    return [`종합: ${regime.overall} (양호 ${regime.counts?.favorable ?? '-'} · 부담 ${regime.counts?.burden ?? '-'})`, sessions, priorSessionMoveLines(input.history), trendLine, leadershipLine, conflicts, axes,
      renderMarketScenarioContext(input, { regime }), renderScenarioOutlookContext(outlook), marketAnalysisCrossroadsContext(data, input, regime)].filter(Boolean).join('\n');
  } catch (error) {
    return '';
  }
}

// v57.87 (10/16 audit): on the session after KOSPI's -7.6% close the commentary spoke only of the next morning's
// in-session rebound — METRIC_EVIDENCE carries the latest observation, so the completed crash close never reached the
// prompt. A completed close that moved 3% in a session or 8% over five sessions travels as its own dated line.
export const PRIOR_SESSION_MOVE_1D_PCT = 3;
export const PRIOR_SESSION_MOVE_5D_PCT = 8;
export function priorSessionMoveLines(history = []) {
  const md = (date) => String(date || '').slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
  const signed = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const lines = [];
  // WTI too (10/16 audit): its in-session row is dropped from METRIC_EVIDENCE, so a +3% oil close never reached the prompt.
  for (const [field, label] of [['spx', 'S&P 500'], ['kospi', '코스피'], ['wti', 'WTI']]) {
    const series = buildCloseSeries(history, field).filter((point) => Number(point?.value) > 0);
    if (series.length < 2) continue;
    const last = series.at(-1), prior = series.at(-2), back5 = series.length >= 6 ? series.at(-6) : null;
    const d1 = (last.value / prior.value - 1) * 100;
    const d5 = back5 ? (last.value / back5.value - 1) * 100 : null;
    if (!(Math.abs(d1) >= PRIOR_SESSION_MOVE_1D_PCT || (d5 != null && Math.abs(d5) >= PRIOR_SESSION_MOVE_5D_PCT))) continue;
    lines.push(`${label} ${md(last.date)} 종가 ${signed(d1)}${d5 != null ? ` (5거래일 ${signed(d5)})` : ''}`);
  }
  return lines.length ? `직전 완료 세션의 큰 움직임: ${lines.join(' · ')} — 이후 장중 반등·하락과 별개로, 해석의 첫 두 줄 안에 이 종가 변화를 날짜(M/D)와 함께 한 번 쓸 것.` : '';
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
    const model = buildMacroCrossroads({ read: read ? { ...read, breadthState } : read, macroHistory: input.macroHistory, history: input.history, events: upcomingMacroEvents({ schedules }), outcomes, previousLeadId: state?.crossroads?.leadId || null });
    return [renderMacroCrossroadsContext(model, { state }), scenarioStateThemeLines(state)].filter(Boolean).join('\n');
  } catch (_) { return ''; }
}

export function scenarioStateThemeLines(state) {
  const themes = Array.isArray(state?.themes) ? state.themes : [];
  if (!themes.length) return '';
  const byKey = new Map(themes.map((row) => [`${row.market}:${row.id}`, row]));
  // v57.81 (themes audit): each named theme carries its stage window and its last five sessions beside the month, so the
  // narrative cannot call a theme leading from the month while the week broke (validator: themeLeadClaimIssues).
  const signedPct = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
  const named = (keys = []) => keys.map((key) => byKey.get(key)).filter(Boolean).map((row) => `${row.label}(${row.market === 'KR' ? '3개월' : '6개월'}·1개월 기준 · 1개월 ${signedPct(row.ret1m)}${Number.isFinite(row.ret5d) ? ` · 5거래일 ${signedPct(row.ret5d)}` : ''})`).slice(0, 6).join(', ');
  const h = state.highlights || {};
  // v57.75 (crash audit): theme returns lag the macro read by a session when the theme producer has not run yet; the
  // header says so, so the model does not present them as today's moves.
  const themeAsOf = state.basis?.themeAsOf || null, macroAsOf = state.basis?.macroAsOf || null;
  const lag = themeAsOf && macroAsOf && themeAsOf < macroAsOf ? ` — 거시 기준일 ${macroAsOf}보다 오래된 값, 최근 세션 움직임 반영 전이므로 오늘의 움직임으로 쓰지 마라` : '';
  // v57.81: KR themes close a session after the US ones; the header prints each market's date and the stage rule.
  const byMarket = state.basis?.themeAsOfByMarket || null;
  const dates = byMarket && (byMarket.US || byMarket.KR) ? [byMarket.US ? `미국 ${byMarket.US}` : '', byMarket.KR ? `한국 ${byMarket.KR}` : ''].filter(Boolean).join(' · ') : (themeAsOf || '기준일 미확인');
  return [`【테마 시나리오 — 모든 테마를 같은 규칙으로(${dates} 확정 종가, 직전 갱신${lag}) · 단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수와 비교하고 최근 5거래일로 점검】`, state.rotation?.text ? `가격 기준 강약 이동: ${state.rotation.text}` : '',
    h.structuralPullbacks?.length ? `긴 추세 속 조정 + 중심 시나리오에서 역풍 아님: ${named(h.structuralPullbacks)}` : '',
    h.headwindLeaders?.length ? `거시 부담에도 주도: ${named(h.headwindLeaders)}` : '',
    h.tailwindLaggards?.length ? `거시 수혜인데 약세: ${named(h.tailwindLaggards)}` : ''].filter(Boolean).join('\n');
}

async function readHistoryRows() {
  try {
    const parsed = JSON.parse(await readFile(HIST, 'utf8'));
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.history) ? parsed.history : [];
  } catch (_) { return []; }
}

// v57.55 review (news trust): every browser re-translated the same English headlines through the shared AI budget, and on a
// rate limit fell back to machine translation ("금 회사 - Kitco AM 보고서"). Headlines are translated once here: titles
// already translated last run are reused, only new English titles go in one bounded request, and anything that does not
// come back as a Korean line keeps no titleKo (the browser then translates as before). A failure never blocks the cycle.
export const HEADLINE_TRANSLATION_MAX = 30;
const hasHangul = (text) => /[가-힣]/.test(String(text || ''));
// v57.69 (P1803): the free model returned Korean lines with Thai, Hanja or Kana mixed in, and any one Hangul syllable
// passed. A translation is kept only when it carries no other script and at least two Hangul syllables; a cached
// translation from an earlier run is held to the same test so a bad one is not reused forever.
export const isCleanKoreanTitle = (text) => {
  const value = String(text || '');
  return (value.match(/[가-힣]/g) || []).length >= 2 && !/[฀-๿぀-ヿ㐀-䶿一-鿿Ѐ-ӿ؀-ۿ�]/.test(value);
};
export async function translateHeadlines(items, { previous = [], request = null, translate = null } = {}) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && typeof item.title === 'string' && item.title.trim());
  const known = new Map((Array.isArray(previous) ? previous : []).filter((item) => item?.title && isCleanKoreanTitle(item.titleKo)).map((item) => [item.title, item.titleKo]));
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
      if (isCleanKoreanTitle(ko) && ko.length <= 200) { item.titleKo = ko; count += 1; }
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

export async function genMarketAnalysis(data, snapshot = null, { previous = null, request = null, nowMs = Date.now(), history = null } = {}) {
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  const newsEvidence = buildMarketAnalysisNewsEvidence(data);
  const keep = { previous, nowMs }; // v57.81: every fallback carries the last verified reading forward
  if (metricEvidence.length < 2) return buildMarketAnalysisFallback(data, 'metric-evidence-insufficient', metricEvidence, newsEvidence, keep);
  const reused = reusableMarketAnalysis(previous, { metricEvidence, newsEvidence, headlineContext: buildMarketAnalysisHeadlineContext(data), nowMs });
  if (reused) {
    console.log(`[fetch-data] marketAnalysis evidence and headlines unchanged — reusing verified analysis from ${reused.generatedAt} (no AI call)`);
    return reused;
  }
  // `request` is a fixture seam (ci contract); production always uses the shared Worker.
  if (!request && !resolveSharedAiConfig()) return buildMarketAnalysisFallback(data, 'shared-ai-not-configured', metricEvidence, newsEvidence, keep);
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
    // v57.69 (2026-10-15 crash audit): KOSPI fell over 5% in session and the commentary, built from completed closes only,
    // never mentioned it. A Korean move of 3% or more in session is offered on its own, labelled 장중 with its KST time.
    const kstTime = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
    const koreaIntradayLines = metricEvidence
      .filter((row) => row.metricId === 'market.kospi' && row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session) && Math.abs(changeOf.get(row.evidenceId)) >= KOREA_MOVE_MENTION_PCT)
      .map((row) => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${changeText(row)} 장중 ${kstTime(row.observedAt)} KST 기준(지연 값) session=${row.session}`).join('\n');
    // v57.81: the same completed closes feed REGIME_CONTEXT and the validator's completed-close basis for in-session rows.
    const historyRows = history || await readHistoryRows(); // v57.86: `history` is a fixture seam (a dated test must not read rows published after it)
    const regimeContext = buildMarketAnalysisRegimeContext(data, historyRows);
    const validate = (body) => validateMarketAnalysisText(body, data, snapshot, { context: regimeContext, history: historyRows });
    // v57.75: a large equity move (KOSPI 3% / S&P 500 1%) lets the day's sentence be replaced once (dailyMarketSentence).
    // v57.81: computed before the prompt so the first attempt is told a cause must be attributed (the validator blocks
    // an unattributed reading on such a day; before, only the retry was told and both 10/15 05:55Z/07:52Z attempts failed).
    const largeMove = metricEvidence.some((row) => (row.metricId === 'market.kospi' && Math.abs(changeOf.get(row.evidenceId)) >= KOREA_MOVE_MENTION_PCT)
      || (row.metricId === 'market.spx' && Math.abs(changeOf.get(row.evidenceId)) >= LARGE_MOVE_ATTRIBUTION_PCT));
    const newsLines = newsEvidence.map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    const headlineLines = buildMarketAnalysisHeadlineContext(data).map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    // P1719/P1720: post-08:00 headlines are the only news on a Korean session's events before the next bundle; they are
    // labelled provisional so the model does not present them as settled.
    const intradayLines = (Array.isArray(data?.newsIntraday) ? data.newsIntraday : []).slice(0, NEWS_INTRADAY_MAX)
      .filter((row) => row && row.title && row.publishedAt)
      .map((row) => `- [08:00 이후 장중 속보(잠정)] ${row.title} [${row.source || 'unknown'}] publishedAt=${row.publishedAt}`).join('\n');
    const macroNow = data?.macro || {};
    const signed = (value) => `${Number(value) >= 0 ? '+' : ''}${value}`;
    const inflationLine = Number.isFinite(Number(macroNow.cpi)) && Number.isFinite(Number(macroNow.cpiDelta))
      ? `INFLATION_DIRECTION: 미국 CPI 전년비 ${macroNow.cpi}% (직전 달 대비 ${signed(macroNow.cpiDelta)}%p)${Number.isFinite(Number(macroNow.coreCpi)) ? `, 근원 ${macroNow.coreCpi}% (${signed(macroNow.coreCpiDelta)}%p)` : ''}, 기준월 ${String(macroNow._asOf_cpi || '').slice(0, 7) || '미확인'}. `
        + (Number(macroNow.cpiDelta) > 0 || Number(macroNow.coreCpiDelta) > 0 ? '물가는 오르는 중이다 — "물가 둔화"라고 쓰지 마라.' : '물가 방향을 이 값 밖에서 추정하지 마라.')
      : '';
    const model = SHARED_AI_MODEL;
    const prompt = [
      '아래 근거로 시장 해석을 반드시 한국어로만 작성하라(영어 문장 금지). 제목·마크다운 헤더 없이 7~9줄 평문으로 쓴다. Write the whole answer in Korean.',
      '순서: (1) 완료된 종가 기준으로 무엇이 얼마나 바뀌었나(METRIC_EVIDENCE의 change 값 — 절대값이 가장 큰 변화부터) (2) 그 변화가 REGIME_CONTEXT의 어느 축·흐름과 맞물리는가 (3) 지금 조건에 가장 가까운 흐름 — 반드시 흐름·시나리오 이름과 함께("「이름」 — 조건 충족 n/m"), 숫자만 단독으로 쓰지 않는다. 단 REGIME_CONTEXT가 "보기 이릅니다"·"중심 시나리오를 정하지 않습니다"라고 하면 그 판정을 먼저 그대로 쓰고, 가장 많이 맞는 흐름은 "핵심 조건 미충족"과 함께만 언급하며 그 흐름을 결론처럼 쓰지 않는다 (4) 향후 시나리오: REGIME_CONTEXT의 【향후 시나리오】에서 다음 발표(날짜)과 조건이 가장 많이 맞는 시나리오, 시장 가격이 같은 방향인지, 금리 괴리가 있으면 그 뜻 — 인과(무엇이 무엇을 거쳐 주가에 닿는지)를 한 문장으로 (5) 그 시나리오라면 선택지(관망·분할 접근·보유 유지·방어 전환)별 기회비용과 상대적으로 유리한 쪽(중심 시나리오가 없으면 "유리한 쪽"을 정하지 말고 각 시나리오로 갈 때 무엇이 바뀌는지만), 반대 시나리오로 가면 무엇이 바뀌는지, 【테마 시나리오】가 있으면 그 시나리오에서 수혜·부담인 테마와 추세 속 조정 테마를 한 문장으로 (6) 다음에 확인할 것과 이 해석이 틀렸다고 볼 반증 조건. 지표를 나열만 하거나 "두 지표는 서로 다르다"처럼 정보가 없는 문장은 쓰지 마라.',
      '가격·수량·시점·특정 종목 매매 지시(사라/팔아라, 목표가, "비중을 늘리세요" 같은 명령)는 쓰지 않는다. 대신 시나리오별 선택지의 기회비용과 "이 시나리오라면 상대적으로 유리한 쪽"은 REGIME_CONTEXT 근거로 쓴다(소유자 2026-10-13). 가능성은 조건 충족 n/m · 시장 가격 방향 · 과거 빈도(표본 수와 함께)로만 말하고 %·확률 숫자를 만들지 마라. 세부 종목 선택은 사용자가 차트·기업·테마·스크리너에서 한다고 밝혀도 된다.',
      '각 변화율은 반드시 그 지표 이름 바로 뒤에 쓴다(예: "코스피 -1.2%"). 다른 지표의 변화율을 앞 지표 이름에 붙이지 마라. 금리(10Y)의 변화는 bp로만 쓰고 %로 쓰지 마라(금리 수준만 % 단위).',
      'METRIC_EVIDENCE에는 완료된 종가만 들어 있다. 장중 값은 쓰지 마라. 부득이 장중 값을 언급하면 "장중"과 관측 시각(예: 13:05 KST)을 같은 문장에 쓰고 "마감·종가"라고 쓰지 마라.',
      'Every numeric claim must be supported by one or more supplied METRIC_EVIDENCE ids.',
      'Do not treat VIX and Fear&Greed as the same metric, and do not spend a sentence saying they differ. Do not invent missing values. Return 7-9 concise lines.',
      // v57.75: the CPI direction is stated so the model does not infer "물가 둔화" from falling yields (blocked, then retried).
      ...(inflationLine ? [inflationLine] : []),
      'REGIME_CONTEXT (deterministic reading from the same completed closes the site shows; cite as [regime-context]):\n' + (regimeContext || 'none'),
      'METRIC_EVIDENCE:\n' + evidenceLines,
      ...(koreaIntradayLines ? ['KOREA_LARGE_INTRADAY_MOVE (장중 지연 값 — 반드시 한 줄로 언급하라: "코스피 장중 HH:MM KST 기준 -x.xx%"처럼 장중과 시각을 같은 문장에 쓰고 마감·종가라고 쓰지 마라. ' + (intradayLines
        // v57.75 (crash audit): HEADLINE_CONTEXT is the 08:00 bundle, written before the Korean session — on 10/15 the model
        // pinned a −7.8% intraday drop on those older headlines and called the won "강세" while USD/KRW rose. The cause may
        // only come from post-08:00 headlines; without them the line says the cause headline was not collected.
        ? '원인은 아래 "08:00 이후 장중 속보(잠정)" 헤드라인에만 귀속하고 잠정이라고 표시하라. 08:00 이전 헤드라인을 장중 하락의 원인으로 쓰지 마라'
        : '08:00 이후 장중 헤드라인이 없다. 원인을 추정하지 말고 "장중 원인 헤드라인 미수집"이라고 쓴다') + '. 원화 방향은 USD/KRW 값으로만 판단한다(USD/KRW 상승 = 원화 약세)):\n' + koreaIntradayLines] : []),
      'NEWS_CLUSTERS (article-level evidence, may be absent):\n' + (newsLines || 'none'),
      'HEADLINE_CONTEXT (retained headlines — titles only; these are the only news material available):\n' + (headlineLines || 'none')
        + (intradayLines ? '\n08:00 이후 장중 속보(잠정 — 다음 08:00 묶음 전의 미확정 헤드라인, 인용 시 "잠정"으로 표시):\n' + intradayLines : ''),
      'DIRECTIONAL/CAUSAL PROSE: you may offer a directional or causal reading, but attribute it to the named headline ("헤드라인에 따르면", "According to <source>") and present it as one reading among alternatives, never as a confirmed fact. End with what would invalidate the reading and what the reader should check. The final decision belongs to the reader, not to this text.',
      ...(largeMove ? ['LARGE_MOVE (S&P 500 1% 이상 또는 코스피 3% 이상): 보도된 배경을 반드시 한 문장으로 쓴다 — "헤드라인에 따르면 …이 배경으로 거론됐다"처럼 HEADLINE_CONTEXT(장중 움직임이면 08:00 이후 장중 속보) 헤드라인 하나를 이름과 함께 든다. 그 문장 안에서 "단정할 수 없다·확인되지 않았다"로 귀속을 지우지 말고, 다른 해석이 있다는 점은 다음 문장에 쓴다.'] : []),
      // v57.71 (owner 2026-10-15): the home's one-sentence line, written by the same call (no extra request).
      `마지막에 7~9줄과 별도로 한 줄을 더 쓴다: "${MARKET_SENTENCE_LABEL} " 뒤에 지금 시장을 관통하는 긴장을 질문이나 대비로 담은 한 문장(40자 안팎). 숫자·%·종목명·티커·매매 지시 없이, 오늘의 근거(METRIC_EVIDENCE·HEADLINE_CONTEXT·REGIME_CONTEXT)에서 나온 갈림을 담는다. 문체 예시(그대로 쓰지 말 것): "오늘의 하락은 기회인가, 서사의 끝을 알리는 신호인가?" / "누군가는 이날을 기다렸고, 누군가는 이날을 기점으로 떠날 것이다."`,
    ].join('\n\n');
    // v57.75: the retained text is re-checked against this run's data — on 10/15 a reading verified before the crash
    // ("원화 강세", easing inflation) would otherwise be re-served for 12 h after the evidence turned.
    // v57.81: the full result goes back so a value quoted for an observation that has since moved a little is not fatal
    // (retainedReadingIssues), and a provider failure keeps the verified reading too instead of the plain fallback.
    const retainOrFallback = (reason) => {
      const retained = retainVerifiedMarketAnalysis(previous, { reason, nowMs, revalidate: (summary) => validateMarketAnalysisText(summary, data, snapshot, { context: regimeContext, history: historyRows }) });
      if (retained) {
        console.warn(`[fetch-data] marketAnalysis retained previous verified analysis from ${retained.retained.from}`);
        return retained;
      }
      return buildMarketAnalysisFallback(data, reason, metricEvidence, newsEvidence, keep);
    };
    const result = await ask(prompt);
    if (!result.text) return retainOrFallback(result.reason || 'provider-empty');
    let { body: text, sentence: sentenceCandidate } = splitMarketSentence(result.text);
    let semantic = validate(text);
    // P1719: the rejected text goes to the Actions log only (400 chars), never into a public artifact.
    // v57.81: an attribution block also logs the sentences that named news (300 chars), so the next block is diagnosable —
    // the 10/15 log cut off before the sentence the validator judged.
    const logRejected = (attempt, body, issues) => {
      const newsSentences = issues.includes('causal-attribution-missing')
        ? String(body || '').replace(/\[[^\]]*\]/g, '').split(/(?<=[.?!。])\s+|\n+/).filter((sentence) => /헤드라인|보도|기사|언론|속보|뉴스|according to|headline|reported/i.test(sentence)).join(' / ').replace(/\s+/g, ' ').slice(0, 300)
        : '';
      console.warn(`[fetch-data] marketAnalysis ${attempt} blocked: ${issues.join(',').slice(0, 300)} :: ${String(body || '').replace(/\s+/g, ' ').slice(0, 400)}${issues.includes('causal-attribution-missing') ? ` :: news-sentences=${newsSentences || 'none'}` : ''}`);
    };
    if (!semantic.ok) {
      // P1719: one retry with the validator's reasons; a second block is final for this run.
      logRejected('attempt-1', text, semantic.issues);
      const retryPrompt = prompt + '\n\nPREVIOUS_ATTEMPT_REJECTED (자동 검증기가 직전 답을 아래 이유로 차단했다. 같은 오류 없이 처음부터 다시 쓴다. 날짜·시각 숫자를 지표 이름 바로 뒤에 두지 말고, 지표 수준·변화는 METRIC_EVIDENCE 값만 쓴다):\n'
        + describeMarketAnalysisIssues(text, semantic.issues, metricEvidence, changeOf);
      const retry = await ask(retryPrompt).catch(() => ({ text: null }));
      if (retry.text) {
        ({ body: text, sentence: sentenceCandidate } = splitMarketSentence(retry.text));
        semantic = validate(text);
        if (!semantic.ok) logRejected('attempt-2', text, semantic.issues);
      }
    }
    if (!text || !semantic.ok) return retainOrFallback(semantic.issues.join(','));
    return { ...buildStructuredMarketAnalysis({ data, text: semantic.text || text, model, status: 'verified', reason: null, metricEvidence, newsEvidence, semantic }), sentenceCandidate, largeMove };
  } catch (error) {
    return buildMarketAnalysisFallback(data, error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error', metricEvidence, newsEvidence, keep);
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
  // CPI/NFP release dates for the BLS cache bypass, read from the previous calendar artifact before this run rewrites it.
  const blsReleaseSchedules = await readFile(MACRO_CALENDAR_OUT, 'utf8').then((text) => JSON.parse(text)?.schedules || null).catch(() => null);
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
    fetchBlsSeries(previousBls, { releaseSchedules: blsReleaseSchedules }),
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
    // v57.71: one sentence a day — kept from the earlier run of the same 08:00 KST day, else this run's validated line.
    const { sentenceCandidate = null, largeMove = false, ...analysis } = marketAnalysis;
    const inflationRising = Number(data.macro?.cpiDelta) > 0 || Number(data.macro?.coreCpiDelta) > 0;
    data.marketAnalysis = { ...analysis, sentence: dailyMarketSentence({ candidate: sentenceCandidate, previous: previous?.marketAnalysis?.sentence || null, nowMs: Date.now(), largeMove, inflationRising }) };
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
  // P1246: FX 교차검증 — 히스토리 레인이 기록한 **공식 관측일과 같은 날짜**의 확정 종가를 공식
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
 * KST-08:00 뉴스 컷(23:00Z)보다 뒤라 그 경계가 컷을 넘는다. 값은 **실제 확정 종가**이므로 버리지
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
  const task = process.env.SCREENER_EXTENDED === '1' ? enrichScreenerExtended() : process.env.SCREENER_ONLY === '1' ? enrichScreener() : main();
  task.catch(e => { console.error('[fetch-data] 치명적 오류:', e); process.exit(1); });
}
