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
import { runBacktest as runTradingScoreBacktest } from './backtest-trading-score.mjs';
import { publishMarketSnapshot } from './build-market-snapshot.mjs';
import { writeOperationsStatus } from './build-operations-status.mjs';
import { writeReconciliationStatus } from './build-reconciliation-status.mjs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { deriveFedPolicyRate } from './lib/official-calendars.mjs';
import { collectRotationHistory } from './lib/rotation-history.mjs';
import { resolveSharedAiConfig } from './lib/ai-shared-analysis.mjs';
import { createAiUsage, marketAnalysisOutcome } from './producer/ai-usage.mjs';
import { sealMarketTimeline, summarizeMarketTimeline } from './lib/market-timeline.mjs';
import { compareUsdKrwCrossCheck } from './lib/macro-sources.mjs';
import { deriveCyclePublication } from './lib/news-selection.mjs';
import { REPO_ROOT, OUT, HIST, MARKET_SNAPSHOT_OUT } from './producer/paths.mjs';
import { SYMBOLS, fetchHistory, collectVerifiedQuotes } from './producer/quotes.mjs';
import { deriveFredPlane } from './producer/fred.mjs';
import { updateHistory } from './producer/history.mjs';
import { SCREENER_OUT, enrichScreener } from './producer/screener.mjs';
import { enrichScreenerExtended } from './producer/screener-extended.mjs';
import { writeMacroHistory, MACRO_CALENDAR_OUT, writeMacroCalendar } from './producer/macro-history.mjs';
import { translateHeadlines, genMarketAnalysis, applyMarketAnalysis } from './producer/market-narrative.mjs';
import { readPreviousPlanes, sourcePlanes, collectSourcePlanes } from './producer/source-planes.mjs';
import { mergeMacroPlanes, buildMarketSurveys } from './producer/macro-merge.mjs';
import { buildDomainReceipts } from './producer/receipts.mjs';
import { buildCollectionMeta, applySnapshotCycleMeta } from './producer/run-meta.mjs';
export { deriveFactorQuality, isSessionComplete, sessionSegmentOfSymbol, listingCurrencyOf } from '../src/domain/screener/price-factors.js';
export { buildMarketAnalysisEvidence, MARKET_ANALYSIS_CLOSED_SESSIONS, analysisMetricMentions, validateAnalysisMetricMentions, validateAnalysisAdmission, analysisNumberMarkedAsReference, validateMarketAnalysisText, MARKET_ANALYSIS_NEWS_CONTENT_POLICY, isMarketAnalysisNewsEligible, buildMarketAnalysisNewsEvidence, buildMarketAnalysisHeadlineContext, describeMarketAnalysisIssues, MARKET_ANALYSIS_RETAIN_MAX_MS, retainVerifiedMarketAnalysis, reusableMarketAnalysis } from './lib/market-analysis-validate.mjs';
export { deriveCyclePublication, newsSourceLabel, serverNewsHeadlineMonthStale, scoreServerNewsItem, newsHeadlineSignature, newsSameEvent, cleanNewsTitle, newsKeyEntities, createNewsTopicCap, NEWS_INTRADAY_MAX, NEWS_INTRADAY_POLICY, NEWS_INTRADAY_LABEL, selectNewsIntraday, tickerNewsCoreName, TICKER_NEWS_WORD_SYMBOLS, tickerNewsHeadlineNamesIssuer, TICKER_NEWS_MAX_AGE_MS, selectTickerNewsMemo, TICKER_NEWS_RUN_CAP, TICKER_NEWS_FIXED_HEAD, TICKER_NEWS_ROTATION_SLOT_MS, planTickerNewsTargets, deriveTickerNewsLineage } from './lib/news-selection.mjs';
export { parseFredHyOasCsv, fetchFredHyOasPublic, parseFredDexkousCsv, fetchFredDexkousPublic, compareUsdKrwCrossCheck, parseTreasuryYieldCurveHtml, parseTreasuryYieldCurveXml, officialTreasuryDeltas, fetchTreasuryYieldCurve, parseAaiiSentimentText, fetchAaiiSentiment, mergeMacroLastKnownGood, parseBeaPceHtml, normalizeBlsSeriesResponse, BLS_RELEASE_SCHEDULE_IDS, blsReleaseCacheBypass, fetchBlsSeries, parseCboePutCallHtml, classifyCboePutCallCurrentness } from './lib/macro-sources.mjs';
export { _mean, closesToFactors, backtestFactors, dailyNotionalAverage, fxRateOnOrBefore } from './lib/factors.mjs';
export { _quoteOk, exchangeLocalDate, fxCloseAtCut, previousCloseBarIndex } from './producer/quotes.mjs';
export { KR_EXCHANGE_CLOSE_SOURCE, parseKrDailySeries, reconcileKrExchangeCloses, summarizeKrCloseReconciliation } from './producer/kr-exchange.mjs';
export { HIST_FIELD_PLAUSIBILITY, boundPreviousCloseToCut, continuousReopenPrint, histValueWithinPlausibility, holdRepeatedSessions, missingRecentUsSessions, normalizeHistoryRows, usPreOpenIndexPrint } from './producer/history.mjs';
export { applyTickerNewsResults, computeScreenerBreadth, enrichScreener, enrichSecFundamentals, mergeSecIntoFactorRows, screenerAssetType, sp500MemberSet } from './producer/screener.mjs';
export { EXTENDED_REFRESH_MAX_AGE_MS, EXTENDED_SHARD_COVERAGE_FLOOR, buildExtendedShardPayload, enrichScreenerExtended, extendedRefreshDue, sicDescriptionMap } from './producer/screener-extended.mjs';
export { breadthMinimumEligible, buildBreadthContributorSessions, computeScreenerBreadthHistory } from './producer/screener-breadth.mjs';
export { MACRO_CALENDAR_RELEASES, MACRO_HISTORY_SERIES, MACRO_LONG_SERIES, collectMacroLongHistory, parseFredObservations, writeMacroCalendar } from './producer/macro-history.mjs';
export { HEADLINE_TRANSLATION_MAX, PRIOR_SESSION_MOVE_1D_PCT, PRIOR_SESSION_MOVE_5D_PCT, buildMarketAnalysisRegimeContext, genMarketAnalysis, isCleanKoreanTitle, marketAnalysisCrossroadsContext, marketAnalysisRegimeInput, priorSessionMoveLines, scenarioStateThemeLines, translateHeadlines } from './producer/market-narrative.mjs';


async function main() {
  const t0 = Date.now();
  const aiUsage = createAiUsage();
  console.log(`[fetch-data] ${SYMBOLS.length} 심볼 + FRED + F&G 수집 시작`);

  // P1262: `previous` (the whole previous data.json) lives in main scope; the receipts read it outside the read block.
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch (_) {}
  const prior = readPreviousPlanes(previous);

  const attemptedAt = new Date().toISOString();
  const generatedAt = attemptedAt;
  // CPI/NFP release dates for the BLS cache bypass, read from the previous calendar artifact before this run rewrites it.
  const blsReleaseSchedules = await readFile(MACRO_CALENDAR_OUT, 'utf8').then((text) => JSON.parse(text)?.schedules || null).catch(() => null);
  // P1358: collect bounded completed-session ETF research once per session.
  // This independent lane reuses the existing free delayed Yahoo path; it
  // publishes only derived rotation/returns, preserving P715 raw-price stripping.
  const rotationHistoryTask = collectRotationHistory({ fetchHistory, previous: previous?.rotationHistory, now: Date.parse(attemptedAt) });
  // P1426: monthly/weekly/daily macro observations for the 거시 direction reads (independent lane).
  const macroHistoryTask = writeMacroHistory(process.env.FRED_API_KEY).catch((error) => ({ written: false, reason: error?.message || String(error) }));
  const macroCalendarTask = writeMacroCalendar(process.env.FRED_API_KEY).catch((error) => ({ written: false, reason: error?.message || String(error) }));
  // Every source plane runs concurrently under Promise.allSettled; a failed plane publishes its declared fallback.
  const { values: planes } = await collectSourcePlanes(sourcePlanes({ prior, attemptedAt, blsReleaseSchedules }));
  const { fred: macroRaw, fearGreed, news, putCall, bls, bea, treasury, fredHyOas, cryptoCrossCheck, aaii, fredDexkous } = planes;
  // P1720: only a fresh collection carries the intraday slot; a fallback to the previous bundle publishes none.
  const newsIntraday = Array.isArray(news?.intraday) ? news.intraday : [];
  const marketSurveys = buildMarketSurveys(prior.marketSurveys, aaii);
  const macro = mergeMacroPlanes({ macroRaw, previousMacro: prior.macro, bls, bea, treasury, fredHyOas });
  const quoteRun = await collectVerifiedQuotes(planes.quotes);
  const { quotes, failed } = quoteRun;

  const fredHasKey = !!process.env.FRED_API_KEY;
  const fred = { hasKey: fredHasKey, ...deriveFredPlane({ configured: fredHasKey, macroRaw, previousMacro: prior.macro, previousMeta: prior.meta, attemptedAt }) };
  const domainReceipts = buildDomainReceipts({
    previousMeta: prior.meta, attemptedAt, generatedAt, symbolCount: SYMBOLS.length, quotes, failed,
    news, previousNews: prior.news, fredSeriesIds: fred.expected, fredFetchedKeys: fred.fetched, fredFailedSeries: fred.failed, planes
  });

  const data = {
    meta: await buildCollectionMeta({ t0, attemptedAt, generatedAt, previousMeta: prior.meta, quoteRun, domainReceipts, fred, macro, macroRaw, planes, news, newsIntraday, marketSurveys }),
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
    // P1737: the Korea export reference moved to public-data/official-references.json (verified by the P1734 lane);
    // the operator snapshot in data.json is no longer carried forward.
    officialWebReferences: null,
    news,
    // P1720: provisional post-08:00 slot (empty array when the news plane failed or nothing qualified).
    newsIntraday,
  };

  if (fredHasKey && !fred.fetchOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키 유효성/레이트리밋 확인');
  // P565/R256: a partial failure (e.g. 6 of 9 series succeed) used to pass silently — the exact mechanism that let
  // individual stale/broken series (Fed/BOJ/BOK/BOE rates) go unnoticed for weeks.
  if (fredHasKey && fred.failed.length > 0) console.warn(`[fetch-data] 경고: FRED 시리즈 ${fred.failed.length}건 실패 — ${fred.failed.join(', ')}`);
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

  // v50.48/Phase 4: 선택적 서버 LLM 분석문 (키 있을 때만; 실패해도 data.json 정상 — 클라 템플릿 폴백)
  // P1093: this runs AFTER the canonical snapshot is resolved, because the narrative's
  // evidence must be sourced from the published snapshot (unit/metricId/evidenceId)
  // rather than from `data.quotes`, which toPublicPayload strips before publishing.
  // M01: append this cycle's completed close first, so the narrative's regime context reads the same session the
  // published history (and therefore the screen) will show.
  const histInfo = await updateHistory(data, marketSnapshotForConsumers, fredDexkous);
  // 2026-10-19 cadence: slots ending 06/12/18/24 KST are sealed once (never overwritten); their new headlines share the
  // translation call below, and one short slot summary follows the macro reading.
  let timelineRun = { timeline: previous?.marketTimeline || null, sealed: [], newHeadlines: [] };
  try { timelineRun = sealMarketTimeline({ previous: previous?.marketTimeline, snapshot: marketSnapshotForConsumers, pool: news?.slotPool || null }); }
  catch (error) { console.warn(`[fetch-data] market timeline kept previous: ${error?.message || error}`); }
  if (timelineRun.timeline) data.marketTimeline = timelineRun.timeline;
  try {
    // First-users F31: a slot sealed while translation was down kept English titles for its two days. Its selection and quotes
    // stay sealed; only the missing Korean title is filled by a later run (after this cycle's own headlines, inside the cap).
    const untranslatedSealed = (data.marketTimeline?.slots || []).flatMap((slot) => slot?.headlines || []).filter((row) => row && !row.titleKo);
    const headlineTranslation = await translateHeadlines([...new Set([...(data.news || []), ...(data.newsIntraday || []), ...timelineRun.newHeadlines, ...untranslatedSealed])], {
      previous: [...(previous?.news || []), ...(previous?.newsIntraday || []), ...(previous?.marketTimeline?.current?.headlines || []),
        ...(previous?.marketTimeline?.slots || []).flatMap((slot) => slot?.headlines || [])],
      request: aiUsage.shared('headline-translation'),
      translate: aiUsage.workersTranslate('headline-translation') });
    data.meta.headlineTranslation = headlineTranslation;
    aiUsage.note('headline-translation', headlineTranslation.provider ? 'translated' : headlineTranslation.pending ? (headlineTranslation.reason || 'unparsed') : 'nothing-new');
    console.log(`[fetch-data] headline translation: reused ${headlineTranslation.reused}, new ${headlineTranslation.translated}/${headlineTranslation.pending}${headlineTranslation.provider ? ` via ${headlineTranslation.provider}` : ''}${headlineTranslation.freeReason ? ` (free path: ${headlineTranslation.freeReason})` : ''}${headlineTranslation.reason ? ` (${headlineTranslation.reason})` : ''}`);
  } catch (error) { console.warn(`[fetch-data] headline translation skipped: ${error?.message || error}`); }
  const marketAnalysis = await genMarketAnalysis(data, marketSnapshotForConsumers, { previous: previous?.marketAnalysis || null, request: aiUsage.shared('market-analysis') });
  applyMarketAnalysis(data, marketAnalysis, { previous: previous?.marketAnalysis || null });
  aiUsage.note('market-analysis', marketAnalysisOutcome(marketAnalysis, aiUsage.receipt().purposes['market-analysis']));
  data.meta.marketTimelineSealed = timelineRun.sealed;
  data.meta.marketTimelineSummary = await summarizeMarketTimeline(data.marketTimeline || null, { request: aiUsage.shared('slot-summary') })
    .catch((error) => `summary-error:${String(error?.message || error).slice(0, 80)}`);
  aiUsage.note('slot-summary', data.meta.marketTimelineSummary || 'not-due');
  data.meta.aiUsage = aiUsage.receipt();
  console.log(`[fetch-data] market timeline: sealed ${timelineRun.sealed.length ? timelineRun.sealed.join(',') : 'none'}; summary ${data.meta.marketTimelineSummary || 'not-due'}`);
  applySnapshotCycleMeta(data.meta, { marketSnapshotInfo, marketSnapshotForConsumers, quoteCount: quotes.length, requiredQuoteCount: SYMBOLS.length });

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
  try { scoreBacktestInfo = await runTradingScoreBacktest(HIST, `${REPO_ROOT}/public-data/score-backtest-history.json`); }
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
  console.log(`[fetch-data] 완료: quotes ${quotes.length}/${SYMBOLS.length} [verify: 1차ok=${quoteRun.verifyStats.pass1} retry=${quoteRun.verifyStats.retried} 복구=${quoteRun.verifyStats.recovered} 최종실패=${failed.length}], macro keys ${Object.keys(macro).length}, F&G ${fearGreed.score ?? 'fail'}, news ${data.meta.newsCount}, history ${histInfo ? histInfo.days + 'd(' + histInfo.upsert + (histInfo.backfilled ? ',+' + histInfo.backfilled + 'bf' : '') + ')' : 'skip'}, fx ${data.providerCrossChecks?.fx?.status || 'n/a'}, screener ${scrInfo ? (scrInfo.skipped ? 'skip(' + scrInfo.count + ')' : scrInfo.count + '/' + scrInfo.universe + (scrInfo.tickerNews != null ? ' tickerNews=' + scrInfo.tickerNews : '')) : 'n/a'}, FMP ${fmpSummary}, ${data.meta.elapsedMs}ms`);

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
