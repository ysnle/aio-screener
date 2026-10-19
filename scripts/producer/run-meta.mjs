// data.json `meta` assembly (split out of fetch-data.mjs main, pipeline redesign 2026-10-19). The collection meta is
// the run's observable record: per-plane status, attempt/success clocks and counts. It is built from the source plane
// registry's results only; the later stages (snapshot, analysis, cycle) add their own fields in fetch-data.mjs.
import { readFile } from 'node:fs/promises';
import { MINIMUM_CURRENT_NEWS, NEWS_FEEDS, mergeNewsFeedHealth, NEWS_INTRADAY_LABEL, NEWS_INTRADAY_MAX, NEWS_INTRADAY_POLICY, getKst0800NewsCycle } from '../lib/news-selection.mjs';
import { REPO_ROOT } from './paths.mjs';
import { planeFresh } from './source-planes.mjs';

// P1737: announces public-data/official-references.json (written by the P1734 lane later in the same workflow) so the
// browser fetches it only once it exists; the value is that artifact's own checkedAt.
export function readOfficialReferencesCheckedAt() {
  return readFile(`${REPO_ROOT}/public-data/official-references.json`, 'utf8')
    .then((text) => { const refs = JSON.parse(text); return /^official-web-references\.v\d+$/.test(String(refs?.schemaVersion || '')) ? refs.checkedAt || null : null; })
    .catch(() => null);
}

export async function buildCollectionMeta({ t0, attemptedAt, generatedAt, previousMeta, quoteRun, domainReceipts, fred, macro, macroRaw, planes, news, newsIntraday, marketSurveys }) {
  const { fearGreed, bls, bea, treasury, aaii, fredHyOas, putCall } = planes;
  const macroKeys = Object.keys(macro).filter(k => k[0] !== '_');
  const fearGreedOk = fearGreed?.status !== 'stale-reference'
    && fearGreed?.status !== 'unavailable'
    && typeof fearGreed?.score === 'number' && isFinite(fearGreed.score);
  const newsScores = Array.isArray(news) ? news.map(n => Number(n.score)).filter(n => isFinite(n)) : [];
  const newsCycle = getKst0800NewsCycle(Date.parse(attemptedAt));
  return {
    generatedAt,
    source: 'github-actions',
    symbolsOk: quoteRun.quotes.length,
    symbolsFail: quoteRun.failed.length,
    failedSymbols: quoteRun.failed,
    // P1256: per-domain collection receipts — "fresh collection" vs "previous value kept" is decided here.
    domainReceipts,
    verifyStats: quoteRun.verifyStats,
    tdHasKey: quoteRun.twelveData.hasKey,
    tdFallbackEligible: quoteRun.twelveData.eligible,
    tdFallbackRecovered: quoteRun.twelveData.recovered,
    fearGreedOk,
    // v50.24/WO-1: F&G·FRED failures are exposed in meta (they used to pass silently); v50.78 splits key vs fetch.
    fredHasKey: fred.hasKey,
    fredFetchOk: fred.fetchOk,
    fredOk: fred.fetchOk, // backward compatible alias
    fredLkgUsed: fred.lkgUsed,
    fredLkgSource: fred.lkgUsed ? 'previous-public-data-macro' : null,
    macroKeyCount: macroKeys.length,
    fredFetchedKeyCount: fred.fetched.length,
    fredAttemptedAt: macroRaw?._attemptedAt || generatedAt,
    fredLastSuccessfulAt: fred.cycle.lastSuccessfulAt,
    fredStatus: fred.cycle.status,
    fredExpectedSeriesCount: fred.expected.length,
    fredSuccessfulSeries: fred.fetched,
    fredFailedSeries: fred.failed,
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
    treasuryLastSuccessfulAt: planeFresh('treasury', treasury) ? treasury.fetchedAt : null,
    treasuryObservedAt: treasury.observedAt || null,
    aaiiStatus: aaii.status,
    aaiiAttemptedAt: aaii.attemptedAt || null,
    aaiiFetchedAt: aaii.fetchedAt || null,
    aaiiObservedAt: aaii.observedAt || null,
    aaiiRelayUsed: !!aaii.relayUrl,
    fredHyOasStatus: fredHyOas.status,
    fredHyOasAttemptedAt: fredHyOas.attemptedAt || null,
    fredHyOasLastSuccessfulAt: planeFresh('fredHyOas', fredHyOas) ? fredHyOas.fetchedAt : null,
    fredHyOasObservedAt: fredHyOas.observedAt || null,
    newsOk: Array.isArray(news) && news.length > 0,
    newsCount: Array.isArray(news) ? news.length : 0,
    // `newsSourceCount` used to publish NEWS_FEEDS.length (the number of search feeds) under a name that reads as the
    // number of publishers, while the retained items carry ~29 distinct outlets (P1097). Both numbers are published
    // under names that say which population they count.
    newsFeedCount: NEWS_FEEDS.length,
    newsFeedHealth: news?.feedHealth ? mergeNewsFeedHealth(previousMeta?.newsFeedHealth, news.feedHealth, attemptedAt) : (previousMeta?.newsFeedHealth || undefined), // 2026-10-19: per-feed counts + streak (watchdog)
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
    officialReferencesCheckedAt: await readOfficialReferencesCheckedAt(),
    elapsedMs: Date.now() - t0,
    // `generatedAt` is the payload/attempt clock for macro/news planes. Market publication lineage stays in separate
    // fields; a failed publish must never be read as a fresh LKG market observation.
    attemptedAt,
    artifactGeneratedAt: generatedAt,
    schema: 1,
  };
}

// AR-07 snapshot lineage and the KST 08:00 cycle manifest: attempt and last-known-good revisions stay separate.
export function applySnapshotCycleMeta(meta, { marketSnapshotInfo, marketSnapshotForConsumers, quoteCount, requiredQuoteCount }) {
  const marketSnapshotAttemptRevision = marketSnapshotInfo.snapshot.revision || null;
  const marketSnapshotPublishedRevision = marketSnapshotForConsumers?.revision || marketSnapshotInfo.retainedRevision || null;
  meta.marketSnapshotPublished = !!marketSnapshotInfo.published;
  meta.marketSnapshotAttemptedAt = marketSnapshotInfo.snapshot.attemptedAt || meta.attemptedAt;
  meta.marketSnapshotPublishedAt = marketSnapshotInfo.published ? marketSnapshotInfo.snapshot.generatedAt : null;
  meta.marketSnapshotAttemptRevision = marketSnapshotAttemptRevision;
  meta.marketSnapshotLastSuccessfulAt = marketSnapshotForConsumers?.generatedAt || null;
  meta.marketSnapshotCoverage = {
    ...(marketSnapshotInfo.coverage || {}),
    tier0Required: Number(marketSnapshotInfo.coverage?.tier0Required ?? marketSnapshotInfo.coverage?.required ?? 0),
    tier0Observed: Number(marketSnapshotInfo.coverage?.tier0Observed ?? marketSnapshotInfo.coverage?.observed ?? 0)
  };
  meta.marketSnapshotRevision = marketSnapshotPublishedRevision;
  const cycleId = `kst-0800-${meta.newsCycleEnd}`;
  meta.cycleId = cycleId;
  meta.cycleStatus = 'PENDING';
  meta.marketCycleFreshnessSlaHours = 12;
  meta.cycleComponents = {
    marketSnapshotRevision: marketSnapshotPublishedRevision,
    marketSnapshotPublished: !!marketSnapshotInfo.published,
    quoteCount,
    requiredQuoteCount,
    newsGeneratedAt: meta.generatedAt,
    newsCount: meta.newsCount,
    minimumNewsCount: MINIMUM_CURRENT_NEWS,
    historyCycleEnd: meta.newsCycleEnd,
    historyUpdated: false,
    telegramDigestExpected: true,
  };
  meta.cycleManifestRevision = `${cycleId}:${marketSnapshotInfo.published ? marketSnapshotPublishedRevision || 'published-unknown' : 'unpublished:' + (marketSnapshotAttemptRevision || 'unknown')}`;
  meta.cycleManifestAttemptRevision = marketSnapshotAttemptRevision;
  return meta;
}
