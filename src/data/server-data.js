// Server data artifact (public-data/data.json + reconciliation-status.json). Legacy unification (2026-10-17): the fetch,
// the reconciliation check and the market-cycle gate moved here from js/aio-data.js _aioLoadServerData, which still
// projects the payload into DATA_SNAPSHOT and the legacy evidence globals.

// R646/P1295/P1296: canonical policy is 12h; artifact metadata does not configure runtime freshness.
export const LIVE_CORE_FRESHNESS_SLA_HOURS = 12;
const LIVE_CORE_FRESHNESS_SLA_MS = LIVE_CORE_FRESHNESS_SLA_HOURS * 60 * 60 * 1000;
const RECONCILIATION_SCHEMA = 'reconciliation-status-v2';
const RECONCILIATION_CATEGORY_COUNT = 22;

// P1291/R641: an exact wall-clock window; a future artifact or a closed market never extends it.
export function isStrictLiveCoreFreshnessAge(ageMs) {
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= LIVE_CORE_FRESHNESS_SLA_MS;
}

// Reconciliation is ready only when it was built from the same market snapshot revision data.json carries.
export function readReconciliationState(payload, marketSnapshotRevision, now = Date.now()) {
  if (payload instanceof Error || !payload || payload.schemaVersion !== RECONCILIATION_SCHEMA || !Array.isArray(payload.categories) || payload.categories.length !== RECONCILIATION_CATEGORY_COUNT) {
    const detail = payload instanceof Error ? payload.message : payload === undefined ? 'not loaded' : 'invalid reconciliation payload';
    return { status: 'unavailable', checkedAt: now, detail };
  }
  const closure = payload.closure || {};
  const sourceRevisionMatches = !!(closure.sourceRevision && marketSnapshotRevision) && closure.sourceRevision === marketSnapshotRevision;
  return {
    status: sourceRevisionMatches ? 'ready' : 'stale',
    checkedAt: now,
    generatedAt: payload.generatedAt || null,
    revision: payload.revision || null,
    sourceRevision: closure.sourceRevision || null,
    sourceRevisionMatches,
    overall: payload.overall || 'BLOCKED',
    counts: payload.counts || {},
    categories: payload.categories,
    partialCategories: closure.partialCategories || [],
    policyBlockedCategories: closure.policyBlockedCategories || [],
    runtimeBlockedCategories: closure.runtimeBlockedCategories || [],
    detail: sourceRevisionMatches ? null : 'market snapshot revision mismatch'
  };
}

// generatedAt is an attempt/payload timestamp, not permission to promote an incomplete market cycle: a failed refresh
// can carry a fresh generatedAt while its quotes stay last-known-good. The live quote plane and the snapshot clock
// advance only for a cycle the producer published with complete tier-0 coverage, inside the freshness window.
export function assessServerCycle(meta = {}, now = Date.now()) {
  const generatedMs = meta.generatedAt ? new Date(meta.generatedAt).getTime() : NaN;
  const ageMs = Number.isFinite(generatedMs) ? now - generatedMs : NaN;
  const ageHours = Number.isFinite(ageMs) ? ageMs / 3600000 : Infinity;
  const raw = meta.marketSnapshotCoverage || {};
  // Older producers returned {required, observed, ratio}; newer snapshot contracts expose tier0Required/tier0Observed.
  const coverage = { ...raw, tier0Required: Number(raw.tier0Required ?? raw.required), tier0Observed: Number(raw.tier0Observed ?? raw.observed) };
  const coverageComplete = coverage.tier0Required > 0 && coverage.tier0Observed === coverage.tier0Required
    && (!Array.isArray(meta.failedSymbols) || meta.failedSymbols.length === 0);
  const fresh = isStrictLiveCoreFreshnessAge(ageMs);
  const published = meta.cycleStatus === 'PUBLISHED' && meta.marketSnapshotPublished === true && coverageComplete;
  const eligible = published && fresh;
  return {
    generatedMs,
    ageMs,
    // v57.50: whole minutes; the raw quotient reached the news stale banner as "118.27963333333334분".
    ageMin: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null,
    ageHours: Number.isFinite(ageHours) ? ageHours : null,
    coverage,
    published,
    fresh,
    eligible,
    staleReason: eligible ? null : !published ? 'market-cycle-not-published' : !Number.isFinite(ageHours) ? 'generatedAt-missing-or-invalid' : 'market-cycle-freshness-sla-exceeded'
  };
}

// The window._serverDataMeta record the legacy screens read.
// v58.70: a lane that failed its check on this refresh is held at the last published value (scripts/lib/lane-quarantine.mjs);
// the shell's 주의 항목 bar names it as stale while the rest of the data is current.
export function laneQuarantineNotices(entries) {
  return (Array.isArray(entries) ? entries : []).filter((lane) => lane && lane.lane).map((lane) => {
    const sinceMs = Date.parse(lane.since || '');
    const kst = Number.isFinite(sinceMs) ? new Date(sinceMs + 9 * 3600000) : null; // KST, the site's clock
    const since = kst ? `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}` : '';
    return { icon: '', text: `${lane.label || lane.lane} 낡음`, detail: `${since ? `${since}부터 갱신 검사를 통과하지 못해 ` : ''}${lane.notice || '직전 게시본을 보여 줍니다'}. 나머지 데이터는 정상 갱신됩니다.`, color: '#f59e0b' };
  });
}

export function buildServerDataMeta(d, { reconciliation, now = Date.now() } = {}) {
  const m = d.meta;
  const macro = d.macro || {};
  const cycle = assessServerCycle(m, now);
  const num = (value) => (value == null ? null : Number(value));
  return {
    generatedAt: m.generatedAt, rotationHistory: d.rotationHistory || null,
    attemptedAt: m.attemptedAt || m.generatedAt || null,
    artifactGeneratedAt: m.artifactGeneratedAt || m.generatedAt || null,
    ageMin: cycle.ageMin,
    symbolsOk: m.symbolsOk,
    symbolsFail: m.symbolsFail,
    failedSymbols: m.failedSymbols || [],
    fearGreedOk: !!m.fearGreedOk,
    fredHasKey: !!m.fredHasKey,
    fredFetchOk: !!m.fredFetchOk,
    fredOk: !!m.fredOk,
    fredFetchedKeyCount: m.fredFetchedKeyCount || 0,
    fredLastSuccessfulAt: m.fredLastSuccessfulAt || null,
    treasuryStatus: m.treasuryStatus || macro._treasury?.status || 'unavailable',
    treasuryObservedAt: m.treasuryObservedAt || macro._treasury?.observedAt || null,
    treasuryLastSuccessfulAt: m.treasuryLastSuccessfulAt || macro._treasury?.lastSuccessfulAt || null,
    macroKeyCount: m.macroKeyCount || 0,
    newsOk: !!m.newsOk,
    newsCount: m.newsCount || (Array.isArray(d.news) ? d.news.length : 0),
    newsCyclePolicy: m.newsCyclePolicy || null,
    newsCycleStart: m.newsCycleStart || null,
    newsCycleEnd: m.newsCycleEnd || null,
    newsCycleLabel: m.newsCycleLabel || null,
    newsNextRefresh: m.newsNextRefresh || null,
    laneQuarantine: Array.isArray(m.laneQuarantine) ? m.laneQuarantine : [], // v58.70: lanes held at the last published value
    pipelineNotices: laneQuarantineNotices(m.laneQuarantine),
    marketSnapshotRevision: m.marketSnapshotRevision || null,
    marketSnapshotAttemptRevision: m.marketSnapshotAttemptRevision || null,
    marketSnapshotAttemptedAt: m.marketSnapshotAttemptedAt || null,
    marketSnapshotPublishedAt: m.marketSnapshotPublishedAt || null,
    marketSnapshotLastSuccessfulAt: m.marketSnapshotLastSuccessfulAt || null,
    // The published quote coverage sits beside the revision so shell status can tell a loaded reference snapshot from
    // an empty/unknown state.
    marketSnapshotCoverage: cycle.coverage,
    marketSnapshotPublished: m.marketSnapshotPublished === true,
    marketCyclePublished: cycle.published,
    cycleId: m.cycleId || null,
    cycleStatus: m.cycleStatus || 'unknown',
    marketCycleFreshnessSlaHours: LIVE_CORE_FRESHNESS_SLA_HOURS,
    liveCoreAgeHours: cycle.ageHours,
    liveCoreFresh: cycle.fresh,
    liveCoreEligible: cycle.eligible,
    liveCoreStaleReason: cycle.staleReason,
    cycleManifestRevision: m.cycleManifestRevision || null,
    cycleManifestAttemptRevision: m.cycleManifestAttemptRevision || null,
    cycleComponents: m.cycleComponents || null,
    putCallOk: !!m.putCallOk,
    putCallAsOf: m.putCallAsOf || d.putCall?.asOf || null,
    // v52.75/WP-AI0: generation success is not semantic verification; the raw LLM marketAnalysis stays blocked until
    // the producer emits an explicit semantic-gate pass.
    marketAnalysisSemanticOk: m.marketAnalysisSemanticOk === true,
    marketAnalysisOk: m.marketAnalysisOk === true && m.marketAnalysisSemanticOk === true,
    // P1729: the AI panel names a blocked scheduled analysis or the retained previous verified one.
    marketAnalysisReason: m.marketAnalysisReason || null,
    marketAnalysisRetained: m.marketAnalysisRetained || null,
    fmpHasKey: m.fmpHasKey != null ? !!m.fmpHasKey : null, // null: the screener step was skipped, so unknown
    fmpOk: !!m.fmpOk,
    fmpCount: num(m.fmpCount),
    fmpPlanError: !!m.fmpPlanError,
    secFundamentalsOk: !!m.secFundamentalsOk,
    secFundamentalsCount: num(m.secFundamentalsCount),
    fundamentalCoveragePct: num(m.fundamentalCoveragePct),
    blsStatus: m.blsStatus || macro._bls?.status || 'unavailable',
    blsSeriesCount: m.blsSeriesCount || 0,
    blsFailedSeries: m.blsFailedSeries || [],
    blsAttemptedAt: m.blsAttemptedAt || macro._bls?.attemptedAt || null,
    blsLastSuccessfulAt: m.blsLastSuccessfulAt || macro._bls?.lastSuccessfulAt || null,
    beaStatus: m.beaStatus || macro._bea?.status || 'unavailable',
    beaAttemptedAt: m.beaAttemptedAt || macro._bea?.attemptedAt || null,
    beaLastSuccessfulAt: m.beaLastSuccessfulAt || macro._bea?.lastSuccessfulAt || null,
    beaReleaseAt: m.beaReleaseAt || macro._bea?.releasedAt || null,
    beaNextReleaseAt: m.beaNextReleaseAt || macro._bea?.nextReleaseAt || null,
    reconciliation,
    loadedAt: now,
    artifacts: { dataJson: cycle.eligible ? 'ready' : 'stale', reconciliationStatus: reconciliation?.status || 'unavailable', telegramDigest: 'pending' }
  };
}

// Fetches data.json, then the reconciliation artifact built from it. The minute cache-buster (v57.61) bypasses the
// 10-minute CDN copy so both files come from the same origin minute.
// prefetched: the <head> boot request for data.json (src/data/boot-prefetch.js); a failed one falls back to a fetch.
export async function fetchServerData({ fetch = globalThis.fetch, now = () => Date.now(), prefetched = null } = {}) {
  const minute = prefetched?.minute ?? Math.floor(now() / 60000);
  const response = await (prefetched?.response ? prefetched.response.catch(() => null) : Promise.resolve(null))
    .then((early) => (early?.ok ? early : fetch(`./public-data/data.json?t=${minute}`, { cache: 'no-cache' })));
  if (!response.ok) return { ok: false, reason: `data.json HTTP ${response.status}` };
  const data = await response.json();
  if (!data || !data.meta) return { ok: false, reason: 'invalid data.json payload' };
  // The 22-category reconciliation is rebuilt on every server refresh; reloading it with data.json lets the browser
  // see category degradation without a page reload.
  let reconciliationPayload;
  try {
    const reconciliationResponse = await fetch(`./public-data/reconciliation-status.json?t=${minute}`, { cache: 'no-cache' });
    reconciliationPayload = reconciliationResponse.ok ? await reconciliationResponse.json() : new Error(`HTTP ${reconciliationResponse.status}`);
  } catch (error) {
    reconciliationPayload = error instanceof Error ? error : new Error(String(error));
  }
  return { ok: true, data, reconciliation: readReconciliationState(reconciliationPayload, data.meta.marketSnapshotRevision, now()) };
}
