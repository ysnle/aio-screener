import { readFile, writeFile } from 'node:fs/promises';
import { createReconciliationStatus, validateReconciliationStatus } from '../src/data/contracts/reconciliation.js';
import { CRITICAL_DATA_GAP_REGISTRY, DATA_SOURCE_REGISTRY, sourceContractFor } from '../src/data/contracts/source-registry.js';

export const RECONCILIATION_STATUS_OUT = new URL('../public-data/reconciliation-status.json', import.meta.url);

const INPUT_PATHS = Object.freeze({
  data: new URL('../public-data/data.json', import.meta.url),
  marketSnapshot: new URL('../public-data/market-snapshot.json', import.meta.url),
  screener: new URL('../public-data/screener.json', import.meta.url),
  history: new URL('../public-data/history.json', import.meta.url)
});
const DAY = 24 * 60 * 60 * 1000;

function finite(value) {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

function parseMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function fresh(value, maxAgeMs, nowMs) {
  const observedMs = parseMs(value);
  return observedMs != null && observedMs <= nowMs + 15 * 60 * 1000 && nowMs - observedMs <= maxAgeMs;
}

function stableHash(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function evidenceCheck(id, pass, sourceArtifact, observedAt = null, detail = null) {
  return Object.freeze({
    id,
    status: pass ? 'PASS' : 'FAIL',
    sourceArtifact,
    observedAt: observedAt || null,
    detail: detail || null
  });
}

function quote(snapshot, instrumentId) {
  return (snapshot?.quotes || []).find((row) => row?.instrumentId === instrumentId) || null;
}

function lineagedQuote(row, nowMs, maxAgeMs = 3 * DAY) {
  return !!row
    && finite(row.value)
    && !!row.source
    && !!row.sourceKind
    && !!row.observedAt
    && !!row.fetchedAt
    && fresh(row.observedAt, maxAgeMs, nowMs);
}

function lastHistoryRow(history) {
  return Array.isArray(history) && history.length ? history[history.length - 1] : null;
}

function breadthSegment(screener, key) {
  return screener?.breadth?.segments?.[key] || null;
}

function breadthAvailable(segment, nowMs) {
  return !!segment
    && fresh(segment.observedAt, 4 * DAY, nowMs)
    && finite(segment.coveragePct)
    && Number(segment.coveragePct) >= 80
    && ['above20', 'above50', 'above200', 'advanceRatio'].every((field) => finite(segment[field]));
}

function historyCoverage(history, field, minimum) {
  return Array.isArray(history) && history.filter((row) => finite(row?.[field])).length >= minimum;
}

function categoryDefinition(categoryId, checks, {
  gate,
  policyBlocked = false,
  rights = policyBlocked ? 'OPERATOR_REQUIRED' : 'REVIEW_REQUIRED',
  successReason = 'All executable source, freshness, and scope checks passed.',
  partialReason = 'Some executable checks passed, but the category is not fully reconciled.',
  blockedReason = 'No executable current-data check passed.'
} = {}) {
  return { categoryId, checks, gate: gate || categoryId, policyBlocked, rights, successReason, partialReason, blockedReason };
}

function buildCategory(definition, marketSnapshot, checkedAt) {
  const sourceContract = sourceContractFor(definition.categoryId);
  if (!sourceContract) throw new Error(`SOURCE_CONTRACT_MISSING:${definition.categoryId}`);
  const observed = definition.checks.filter((check) => check.status === 'PASS').length;
  const required = definition.checks.length;
  const status = definition.policyBlocked
    ? 'BLOCKED'
    : observed === required && required > 0
      ? 'MATCH'
      : observed > 0
        ? 'PARTIAL'
        : 'BLOCKED';
  const failedChecks = definition.checks.filter((check) => check.status !== 'PASS').map((check) => check.id);
  const reason = status === 'MATCH'
    ? definition.successReason
    : status === 'PARTIAL'
      ? `${definition.partialReason} Missing: ${failedChecks.join(', ')}.`
      : `${definition.blockedReason} Missing: ${failedChecks.join(', ')}.`;
  const rights = definition.rights === 'REVIEW_REQUIRED' && status === 'MATCH' ? 'CURRENT' : definition.rights;
  return {
    categoryId: definition.categoryId,
    status,
    sourceClass: definition.policyBlocked ? 'UNAVAILABLE' : status === 'MATCH' ? 'OBSERVED' : status === 'PARTIAL' ? 'PARTIAL' : 'UNAVAILABLE',
    reason,
    marketSnapshotRevision: marketSnapshot?.revision || null,
    checkedAt,
    refresh: {
      cadence: sourceContract.cadence,
      mode: sourceContract.refreshMode,
      dailyAuditRequired: sourceContract.dailyRefreshAudit === true,
      producer: sourceContract.producer,
      artifacts: sourceContract.artifacts,
      consumers: sourceContract.consumers
    },
    origins: sourceContract.origins,
    structuralLimit: sourceContract.structuralLimit,
    evidence: {
      observed,
      required,
      gate: definition.gate,
      rights,
      sourceRevision: marketSnapshot?.revision || null,
      promotable: status === 'MATCH' && observed === required && rights === 'CURRENT',
      checks: definition.checks
    }
  };
}

export function buildReconciliationStatus({ data = {}, marketSnapshot = {}, screener = {}, history = [], now = new Date().toISOString() } = {}) {
  const nowMs = parseMs(now) ?? Date.now();
  const macro = data?.macro || {};
  const bls = macro?._bls || {};
  const bea = macro?._bea || {};
  const latestHistory = lastHistoryRow(history);
  const tier0Quotes = marketSnapshot?.quotes || [];
  const tier0Complete = marketSnapshot?.status === 'published'
    && Number(marketSnapshot?.coverage?.tier0Required || marketSnapshot?.coverage?.required) === 16
    && Number(marketSnapshot?.coverage?.tier0Observed || marketSnapshot?.coverage?.observed) === 16;
  const tier0LineageComplete = tier0Quotes.length === 16 && tier0Quotes.every((row) => lineagedQuote(row, nowMs));
  const providerFamilies = new Set(tier0Quotes.map((row) => row?.source).filter(Boolean));
  const usBreadth = breadthSegment(screener, 'us');
  const krBreadth = breadthSegment(screener, 'kr');
  const currentNews = Array.isArray(data?.news) ? data.news : [];
  const newsLineageCoverage = currentNews.length > 0
    ? currentNews.filter((row) => row?.source && row?.link && (row?.eventTime || row?.pubDate)).length / currentNews.length
    : 0;
  const fullContentCoverage = currentNews.some((row) => row?.contentDepth && row.contentDepth !== 'headline-only');
  const putCallObservedAt = data?.putCall?.asOf || data?.meta?.putCallAsOf;
  const fgObservedAt = data?.fearGreed?.asOf;
  const surveys = data?.marketSurveys || {};
  const aaii = surveys?.aaii || null;
  const naaim = surveys?.naaim || null;
  const aaiiFresh = !!aaii
    && ['current-reference', 'current'].includes(String(aaii.status || ''))
    && ['bullish', 'neutral', 'bearish'].every((field) => finite(aaii[field]))
    && fresh(aaii.observedAt, 14 * DAY, nowMs);
  const naaimLatestPublic = !!naaim && finite(naaim.exposure) && !!naaim.observedAt;
  const naaimFresh = naaimLatestPublic && fresh(naaim.observedAt, 14 * DAY, nowMs);
  const historyBreadthRows = Array.isArray(history)
    ? history.filter((row) => finite(row?.breadth50) || finite(row?.advanceDecline) || finite(row?.mcclellan)).length
    : 0;
  const quoteGroup = (symbols, maxAgeMs = 3 * DAY) => symbols.every((symbol) => lineagedQuote(quote(marketSnapshot, symbol), nowMs, maxAgeMs));

  const definitions = [
    categoryDefinition('market-quotes', [
      evidenceCheck('tier0-coverage-16-of-16', tier0Complete, 'public-data/market-snapshot.json', marketSnapshot.generatedAt),
      evidenceCheck('tier0-field-lineage-complete', tier0LineageComplete, 'public-data/market-snapshot.json', marketSnapshot.generatedAt),
      evidenceCheck('independent-provider-reconciliation', providerFamilies.size >= 2, 'public-data/market-snapshot.json', marketSnapshot.generatedAt, `providerFamilies=${providerFamilies.size}`)
    ], { gate: 'tier0-coverage-lineage-provider-diversity' }),

    categoryDefinition('volatility', [
      evidenceCheck('vix-vix3m-current', quoteGroup(['^VIX', '^VIX3M']), 'public-data/market-snapshot.json', quote(marketSnapshot, '^VIX')?.observedAt),
      evidenceCheck('vvix-daily-history-current', finite(latestHistory?.vvix) && fresh(latestHistory?.fieldMeta?.vvix?.observedAt, 4 * DAY, nowMs), 'public-data/history.json', latestHistory?.fieldMeta?.vvix?.observedAt),
      evidenceCheck('vix3m-term-structure-history', historyCoverage(history, 'vix3m', 60), 'public-data/history.json', latestHistory?.date)
    ], { gate: 'vix-vix3m-vvix-history' }),

    categoryDefinition('fear-greed', [
      evidenceCheck('current-score-and-observation', finite(data?.fearGreed?.score) && fresh(fgObservedAt, 2 * DAY, nowMs), 'public-data/data.json', fgObservedAt),
      evidenceCheck('source-identified', !!data?.fearGreed?._source, 'public-data/data.json', fgObservedAt),
      evidenceCheck('history-minimum-60', historyCoverage(history, 'fg', 60), 'public-data/history.json', latestHistory?.date)
    ], { gate: 'current-source-history' }),

    categoryDefinition('put-call', [
      evidenceCheck('total-put-call-present', finite(data?.putCall?.totalPutCall), 'public-data/data.json', putCallObservedAt),
      evidenceCheck('daily-observation-current', fresh(putCallObservedAt, 4 * DAY, nowMs), 'public-data/data.json', putCallObservedAt),
      evidenceCheck('cboe-source-and-delay-policy', /cboe/i.test(String(data?.putCall?.source || '')) && !!data?.putCall?.allowedUse, 'public-data/data.json', data?.putCall?.fetchedAt)
    ], { gate: 'cboe-delayed-lineage' }),

    categoryDefinition('aaii', [
      evidenceCheck('public-web-current-reference', aaiiFresh, 'public-data/data.json', aaii?.observedAt, 'AAII weekly public observation is retained as reference-only.'),
      evidenceCheck('publisher-source-lineage', !!aaii?.sourceUrl && /aaii\.com\/sentimentsurvey/i.test(aaii.sourceUrl), 'public-data/structural-data-research.json', aaii?.observedAt),
      evidenceCheck('redistribution-rights-for-trading', false, 'operator/provider-contract', null, 'Public web observation is not licensed for trading-gate promotion.')
    ], { gate: 'public-web-reference-with-rights-boundary', policyBlocked: !aaiiFresh, rights: 'OPERATOR_REQUIRED', partialReason: 'Public AAII observation is available but rights keep it reference-only.', blockedReason: 'No current public AAII observation is available; synthesis forbidden.' }),

    categoryDefinition('naaim', [
      evidenceCheck('latest-public-reference', naaimLatestPublic, 'public-data/data.json', naaim?.observedAt, 'Last public NAAIM value is retained with its observation date.'),
      evidenceCheck('current-freshness', naaimFresh, 'public-data/data.json', naaim?.observedAt, 'The public page is stale after its subscription transition.'),
      evidenceCheck('redistribution-rights-for-trading', false, 'operator/provider-contract', null, 'NAAIM page requires subscription for current access.')
    ], { gate: 'latest-public-reference-with-rights-boundary', policyBlocked: !naaimLatestPublic, rights: 'OPERATOR_REQUIRED', partialReason: 'Last public NAAIM observation is available, but it is stale/reference-only.', blockedReason: 'No public NAAIM observation is available; inference forbidden.' }),

    categoryDefinition('investors-intelligence', [
      evidenceCheck('subscriber-current', false, 'operator/provider-contract', null, 'Subscriber value unavailable; extrapolation forbidden.')
    ], { gate: 'subscriber-current', policyBlocked: true, blockedReason: 'Subscriber Investors Intelligence data is unavailable and must not be synthesized.' }),

    categoryDefinition('us-breadth', [
      evidenceCheck('aio-us-universe-current', breadthAvailable(usBreadth, nowMs), 'public-data/screener.json', usBreadth?.observedAt),
      evidenceCheck('aio-us-universe-source-labelled', !!screener?.breadth?.source && /research|reference/i.test(String(screener?.breadth?.decisionScope || '')), 'public-data/screener.json', usBreadth?.observedAt),
      evidenceCheck('official-exchange-breadth', false, 'official-exchange-provider', null, 'AIO-universe breadth is not official exchange breadth.')
    ], { gate: 'aio-universe-plus-official-exchange' }),

    categoryDefinition('kr-breadth', [
      evidenceCheck('aio-kr-universe-current', breadthAvailable(krBreadth, nowMs), 'public-data/screener.json', krBreadth?.observedAt),
      evidenceCheck('aio-kr-universe-source-labelled', !!screener?.breadth?.source && /research|reference/i.test(String(screener?.breadth?.decisionScope || '')), 'public-data/screener.json', krBreadth?.observedAt),
      evidenceCheck('official-kr-exchange-breadth', false, 'approved-krx-provider', null, 'Approved official KR breadth source is not configured.')
    ], { gate: 'aio-universe-plus-approved-kr-source' }),

    categoryDefinition('breadth-history', [
      evidenceCheck('durable-daily-breadth-history-60', historyBreadthRows >= 60, 'public-data/history.json', latestHistory?.date, `rows=${historyBreadthRows}`),
      evidenceCheck('mcclellan-advance-decline-source', false, 'official-exchange-provider', null, 'Durable exchange A/D producer is unavailable.')
    ], { gate: 'durable-daily-history' }),

    categoryDefinition('treasury-curve', [
      evidenceCheck('10y-current', lineagedQuote(quote(marketSnapshot, '^TNX'), nowMs), 'public-data/market-snapshot.json', quote(marketSnapshot, '^TNX')?.observedAt),
      evidenceCheck('13w-current', lineagedQuote(quote(marketSnapshot, '^IRX'), nowMs), 'public-data/market-snapshot.json', quote(marketSnapshot, '^IRX')?.observedAt),
      evidenceCheck(
        'five-point-official-curve-current',
        ['dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30'].every((field) => finite(macro[field]) && fresh(macro[`_asOf_${field}`], 5 * DAY, nowMs) && ['fred-official-primary', 'us-treasury-official-primary'].includes(macro[`_source_${field}`])),
        'public-data/data.json',
        macro._asOf_dgs10,
        'FRED DGS2/DGS5/DGS10/DGS20/DGS30 official observations; observation dates, not fetch time, drive freshness.'
      ),
      evidenceCheck('10y-2y-official-spread-current', finite(macro.t10y2y) && fresh(macro._asOf_t10y2y, 5 * DAY, nowMs) && ['fred-official-primary', 'us-treasury-official-primary'].includes(macro._source_t10y2y), 'public-data/data.json', macro._asOf_t10y2y)
    ], { gate: 'official-five-point-curve' }),

    categoryDefinition('hy-oas', [
      evidenceCheck('fred-hy-oas-current', finite(macro.hyOAS) && fresh(macro._asOf_hyOAS, 5 * DAY, nowMs), 'public-data/data.json', macro._asOf_hyOAS),
      evidenceCheck('fred-source-identified', macro._source_hyOAS === 'fred-official-primary', 'public-data/data.json', data?.meta?.fredLastSuccessfulAt),
      evidenceCheck('independent-spread-reconciliation', false, 'secondary-credit-spread-provider', null, 'No independent spread-level cross-check is configured.')
    ], { gate: 'fred-current-plus-cross-check' }),

    categoryDefinition('cpi-pce', [
      evidenceCheck('bls-cpi-official-current-release', ['ok', 'cached-fresh'].includes(bls.status) && finite(bls?.series?.cpi?.value) && !!bls?.series?.cpi?.observedAt, 'public-data/data.json', bls?.series?.cpi?.observedAt),
      evidenceCheck('bea-pce-official-current-release', bea.status === 'ok' && finite(bea?.values?.pce) && finite(bea?.values?.corePce) && !!bea?.releasedAt, 'public-data/data.json', bea?.releasedAt)
    ], { gate: 'bls-bea-official-release', rights: 'CURRENT' }),

    categoryDefinition('employment-wages', [
      evidenceCheck('bls-unemployment', finite(bls?.series?.unemployment?.value) && !!bls?.series?.unemployment?.observedAt, 'public-data/data.json', bls?.series?.unemployment?.observedAt),
      evidenceCheck('bls-nonfarm-payroll', finite(bls?.series?.nonfarmPayroll?.value) && !!bls?.series?.nonfarmPayroll?.observedAt, 'public-data/data.json', bls?.series?.nonfarmPayroll?.observedAt),
      evidenceCheck('bls-average-hourly-earnings', finite(bls?.series?.averageHourlyEarnings?.value) && !!bls?.series?.averageHourlyEarnings?.observedAt, 'public-data/data.json', bls?.series?.averageHourlyEarnings?.observedAt)
    ], { gate: 'bls-employment-wages', rights: 'CURRENT' }),

    categoryDefinition('retail-housing-ism', [
      evidenceCheck('fred-retail-sales', finite(macro.retailSales) && !!macro._asOf_retailSales, 'public-data/data.json', macro._asOf_retailSales),
      evidenceCheck('fred-housing-starts', finite(macro.housingStarts) && !!macro._asOf_housingStarts, 'public-data/data.json', macro._asOf_housingStarts),
      evidenceCheck('release-aware-ism', false, 'ism-official-provider', null, 'Release-aware ISM adapter is not configured.')
    ], { gate: 'retail-housing-ism-release-aware' }),

    categoryDefinition('central-bank-policy', [
      evidenceCheck('fed-rate-official-series', finite(macro.fedRate) && !!macro._asOf_fedRate, 'public-data/data.json', macro._asOf_fedRate),
      evidenceCheck('multi-central-bank-current-registry', false, 'official-central-bank-registry', null, 'BOK/ECB/BOJ/BOE point-level automatic reconciliation is incomplete.')
    ], { gate: 'multi-central-bank-current-registry' }),

    categoryDefinition('macro-calendar', [
      evidenceCheck('bea-next-release', !!bea.nextReleaseAt && parseMs(bea.nextReleaseAt) != null, 'public-data/data.json', bea.nextReleaseAt),
      evidenceCheck('multi-agency-release-aware-calendar', false, 'official-release-calendars', null, 'BLS/FOMC/BEA multi-agency release-triggered ingestion is incomplete.')
    ], { gate: 'multi-agency-release-calendar' }),

    categoryDefinition('news', [
      evidenceCheck('completed-cycle-minimum-10', data?.meta?.newsOk === true && currentNews.length >= 10 && !!data?.meta?.newsCycleEnd, 'public-data/data.json', data?.meta?.newsCycleEnd, `count=${currentNews.length}`),
      evidenceCheck('article-lineage-95pct', newsLineageCoverage >= 0.95, 'public-data/data.json', data?.meta?.generatedAt, `coverage=${(newsLineageCoverage * 100).toFixed(1)}%`),
      evidenceCheck('full-content-evidence', fullContentCoverage, 'public-data/data.json', data?.meta?.generatedAt, 'Headline-only feeds cannot certify article-level claims.')
    ], { gate: 'cycle-lineage-content-depth' }),

    categoryDefinition('commodities-fx', [
      evidenceCheck('tier0-wti-gold-dxy-krw-current', quoteGroup(['CL=F', 'GC=F', 'DX-Y.NYB', 'KRW=X']), 'public-data/market-snapshot.json', marketSnapshot.generatedAt),
      evidenceCheck('settlement-vs-spot-contract', false, 'market-data-field-contract', null, 'Settlement, futures, and spot bases are not fully reconciled.')
    ], { gate: 'current-plus-settlement-spot-contract' }),

    categoryDefinition('global-indices', [
      evidenceCheck('us-major-indices-current', quoteGroup(['^GSPC', '^IXIC', '^DJI', '^RUT']), 'public-data/market-snapshot.json', marketSnapshot.generatedAt),
      evidenceCheck('non-us-major-indices-current', quoteGroup(['^FTSE', '^N225', '^HSI']), 'public-data/market-snapshot.json', marketSnapshot.generatedAt)
    ], { gate: 'us-plus-non-us-session-history' }),

    categoryDefinition('crypto', [
      evidenceCheck('btc-eth-current', quoteGroup(['BTC-USD', 'ETH-USD'], DAY), 'public-data/market-snapshot.json', marketSnapshot.generatedAt),
      evidenceCheck('btc-daily-history-60', historyCoverage(history, 'btc', 60), 'public-data/history.json', latestHistory?.date),
      evidenceCheck(
        'independent-24x7-provider-reconciliation',
        (() => {
          const crossCheck = data?.providerCrossChecks?.crypto;
          if (crossCheck?.status !== 'ok' || !fresh(crossCheck?.fetchedAt, 2 * 60 * 60 * 1000, nowMs)) return false;
          const primary = new Map((marketSnapshot?.quotes || []).filter((row) => ['BTC-USD', 'ETH-USD'].includes(row.instrumentId)).map((row) => [row.instrumentId, Number(row.value)]));
          return (crossCheck.quotes || []).length === 2 && crossCheck.quotes.every((row) => {
            const reference = Number(row.price);
            const candidate = primary.get(row.symbol);
            return Number.isFinite(reference) && Number.isFinite(candidate) && Math.abs(candidate / reference - 1) <= 0.02;
          });
        })(),
        'public-data/data.json:providerCrossChecks.crypto',
        data?.providerCrossChecks?.crypto?.fetchedAt,
        data?.providerCrossChecks?.crypto?.status === 'ok' ? 'CoinGecko comparison requires both assets within 2% of the canonical snapshot.' : 'CoinGecko cross-check unavailable; primary values are not promoted as independently reconciled.'
      )
    ], { gate: 'current-history-provider-diversity' }),

    categoryDefinition('kr-macro-vkospi-supply', [
      evidenceCheck('approved-krx-koscom-rights', false, 'operator/provider-contract', null, 'Approved KRX/Koscom provider and VKOSPI rights are unresolved.')
    ], { gate: 'approved-krx-provider-and-rights', policyBlocked: true, blockedReason: 'Korean licensed market data cannot be promoted without provider rights.' })
  ];

  const categories = definitions.map((definition) => buildCategory(definition, marketSnapshot, now));
  const counts = categories.reduce((acc, category) => {
    acc[category.status] = (acc[category.status] || 0) + 1;
    return acc;
  }, {});
  const policyBlockedCategories = categories.filter((category) => category.status === 'BLOCKED' && category.evidence.rights === 'OPERATOR_REQUIRED').map((category) => category.categoryId);
  const runtimeBlockedCategories = categories.filter((category) => category.status === 'BLOCKED' && category.evidence.rights !== 'OPERATOR_REQUIRED').map((category) => category.categoryId);
  const unresolvedCategories = categories.filter((category) => category.status !== 'MATCH').map((category) => category.categoryId);
  const truthDigest = categories.map((category) => [category.categoryId, category.status, category.evidence.checks.map((check) => check.status)]);
  const sourceRegistryDigest = Object.entries(DATA_SOURCE_REGISTRY).map(([categoryId, contract]) => [categoryId, contract.cadence, contract.producer, contract.origins.map((origin) => [origin.id, origin.access])]);
  const status = createReconciliationStatus({
    schemaVersion: 'reconciliation-status-v2',
    generatedAt: now,
    revision: `reconciliation:${marketSnapshot?.revision || 'no-market-snapshot'}:${stableHash([truthDigest, sourceRegistryDigest, CRITICAL_DATA_GAP_REGISTRY])}`,
    overall: unresolvedCategories.length ? 'PARTIAL' : 'MATCH',
    counts,
    categories,
    closure: {
      complete: unresolvedCategories.length === 0,
      unresolvedCategories,
      partialCategories: categories.filter((category) => category.status === 'PARTIAL').map((category) => category.categoryId),
      operatorRequiredCategories: policyBlockedCategories,
      policyBlockedCategories,
      runtimeBlockedCategories,
      sourceRegistry: {
        categoryCount: Object.keys(DATA_SOURCE_REGISTRY).length,
        dailyAuditCoverage: Object.values(DATA_SOURCE_REGISTRY).filter((contract) => contract.dailyRefreshAudit === true).length,
        criticalDataGaps: CRITICAL_DATA_GAP_REGISTRY
      },
      sourceRevision: marketSnapshot?.revision || null,
      sourceArtifacts: ['public-data/data.json', 'public-data/market-snapshot.json', 'public-data/screener.json', 'public-data/history.json']
    }
  });
  const validation = validateReconciliationStatus(status);
  if (!validation.ok) throw new Error(`RECONCILIATION_STATUS_INVALID:${validation.errors.join(',')}`);
  return status;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return fallback; }
}

export async function writeReconciliationStatus(input = {}) {
  const resolved = {
    data: input.data ?? await readJson(INPUT_PATHS.data, {}),
    marketSnapshot: input.marketSnapshot ?? await readJson(INPUT_PATHS.marketSnapshot, {}),
    screener: input.screener ?? await readJson(INPUT_PATHS.screener, {}),
    history: input.history ?? await readJson(INPUT_PATHS.history, []),
    now: input.now || new Date().toISOString()
  };
  const status = buildReconciliationStatus(resolved);
  await writeFile(RECONCILIATION_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  console.log(JSON.stringify(await writeReconciliationStatus()));
}
