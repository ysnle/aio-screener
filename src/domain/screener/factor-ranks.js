// RM-03/RM-04: pure cross-sectional factor ranking model.
//
// The compatibility wrapper in js/aio-data.js still owns profile/storage lookup and projects
// the result onto SCREENER_DB. This module owns only deterministic factor math and quality
// metadata. The model is deliberately a research-relative ranking: it is not a forecast,
// trading signal, suitability assessment, or portfolio construction engine.
//
// Normal finite inputs retain the v1 factor formula and golden-fixture results. v2 adds bounded
// quality controls around that formula:
//   - finite-value audits and duplicate/observation-date diagnostics;
//   - factor-level coverage gating instead of silently diluting a composite with absent factors;
//   - MAD-triggered winsorized statistics for extreme cross-sectional outliers;
//   - sector-relative normalization with unknown-sector -> universe fallback;
//   - row/ensemble confidence that measures evidence coverage, not return probability;
//   - optional prior-rank/regime stability diagnostics (never used to auto-promote weights).
import { normalizeAllowedUse } from '../../data/contracts/evidence.js';
import { canonicalSourceTier } from '../../data/contracts/source-kind.js';

export const FACTOR_RANKS_MODEL_VERSION = 'factor-ranks.v6';
export const FACTOR_RANKS_ALLOWED_USE = 'research-relative-ranking-only';

const DAY_MS = 86_400_000;
// Shared with the producer (fetch-data) so the quality label written into the
// artifact and the freshness gate applied at read time use one budget — two
// budgets let a row read CURRENT at fetch and stale at render, or vice versa.
export const FACTOR_FRESHNESS_MS = 4 * DAY_MS;
const FUNDAMENTAL_FRESHNESS_MS = 180 * DAY_MS;
const MIN_CROSS_SECTION_COVERAGE = 0.8;
// A cross-sectionally active factor can still be absent for an individual security. Do not
// compare a materially different residual model against complete rows: keep the row visible,
// but require at least 80% of the configured active weight before assigning a rank.
const MIN_ROW_WEIGHT_COVERAGE = 0.8;
const MIN_SECTOR_OBSERVATIONS = 6;
// W07-A/P1146: an explicit weight request is a model selection. If too little of the
// requested weight is computable, the run must withhold ranking instead of silently
// renormalizing onto whatever factors happen to be available.
const MIN_REQUESTED_WEIGHT_COVERAGE = 0.8;
// Six observations is the minimum sector bucket size used by the shrinkage rule, so the robust
// guard must also be able to protect a full-size sector bucket of six.
const MIN_ROBUST_OBSERVATIONS = 6;
const ROBUST_Z_THRESHOLD = 6;
const ROBUST_CLIP_Z = 5;
const UNKNOWN_SECTOR = null;

const DEFAULT_WEIGHTS = { momentum: 0.32, trend: 0.23, lowvol: 0.18, size: 0.18, value: 0, quality: 0, kalman: 0.09 };

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function momRaw(row) {
  const parts = [];
  if (finite(row?.ret1m) != null) parts.push({ v: row.ret1m, w: 0.4 });
  if (finite(row?.ret3m) != null) parts.push({ v: row.ret3m, w: 0.4 });
  if (finite(row?.ret6m) != null) parts.push({ v: row.ret6m, w: 0.2 });
  const denom = parts.reduce((sum, p) => sum + p.w, 0);
  return denom > 0 ? parts.reduce((sum, p) => sum + p.v * p.w, 0) / denom : null;
}

function trendRaw(row) {
  const parts = [];
  if (finite(row?.pctSma50) != null) parts.push({ v: row.pctSma50, w: 0.6 });
  if (finite(row?.pctSma200) != null) parts.push({ v: row.pctSma200, w: 0.4 });
  const denom = parts.reduce((sum, p) => sum + p.w, 0);
  return denom > 0 ? parts.reduce((sum, p) => sum + p.v * p.w, 0) / denom : null;
}

function lowvolRaw(row) {
  const volatility = finite(row?.vol);
  return volatility != null && volatility >= 0 ? -volatility : null;
}

function sizeRaw(row) {
  const marketCap = finite(row?.mcap);
  return marketCap != null && marketCap > 0 ? -Math.log(marketCap) : null;
}

function valueRaw(row) {
  const parts = [];
  const addInverse = (value, upper, maxInverse) => {
    const numeric = finite(value);
    if (numeric != null && numeric > 0 && numeric < upper) parts.push(Math.max(0, Math.min(maxInverse, 1 / numeric)) / maxInverse);
  };
  addInverse(row?.pe, 200, 0.20);
  addInverse(row?.pb, 50, 2.0);
  addInverse(row?.evEbitda, 100, 0.20);
  return parts.length ? avg(parts) : null;
}

function qualityRaw(row) {
  const parts = [];
  const addClamped = (value, lo, hi, denominator) => {
    const numeric = finite(value);
    if (numeric != null) parts.push(Math.max(lo, Math.min(hi, numeric)) / denominator);
  };
  addClamped(row?.roe, -30, 60, 60);
  addClamped(row?.margin, -20, 40, 40);
  addClamped(row?.revGrowth, -30, 60, 60);
  return parts.length ? avg(parts) : null;
}

function kalmanRaw(row) {
  const confidence = finite(row?.kalmanVelConf);
  return confidence != null ? confidence : finite(row?.kalmanVel);
}

function stats(values) {
  if (!values.length) return { mu: 0, sd: 1 };
  const mu = avg(values);
  const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mu) * (value - mu), 0) / (values.length - 1)) : 1;
  return { mu, sd: sd > 0 && Number.isFinite(sd) ? sd : 1 };
}

// Use ordinary sample statistics by default to preserve the established model. If a robust
// MAD screen finds a truly extreme value, clip only the statistics sample; the row itself still
// receives a bounded z-score. This keeps a bad print from moving every peer's rank while making
// the intervention observable in diagnostics.
function guardedStats(values) {
  const ordinary = stats(values);
  if (values.length < MIN_ROBUST_OBSERVATIONS) return { ...ordinary, method: 'sample-standard-deviation', outlierCount: 0, outlierIndexes: [] };
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  const robustScale = mad == null ? 0 : mad * 1.4826;
  if (!(robustScale > 1e-12)) return { ...ordinary, method: 'sample-standard-deviation', outlierCount: 0, outlierIndexes: [] };
  const outlierIndexes = values.reduce((indexes, value, index) => {
    if (Math.abs((value - center) / robustScale) > ROBUST_Z_THRESHOLD) indexes.push(index);
    return indexes;
  }, []);
  if (!outlierIndexes.length) return { ...ordinary, method: 'sample-standard-deviation', outlierCount: 0, outlierIndexes: [] };
  const lower = center - ROBUST_CLIP_Z * robustScale;
  const upper = center + ROBUST_CLIP_Z * robustScale;
  const clipped = values.map((value) => Math.max(lower, Math.min(upper, value)));
  const robust = stats(clipped);
  return { ...robust, method: 'winsorized-mad', outlierCount: outlierIndexes.length, outlierIndexes };
}

function winz(x, mu, sd) {
  const numeric = finite(x);
  if (numeric == null) return null;
  const z = (numeric - mu) / sd;
  return Number.isFinite(z) ? Math.max(-3, Math.min(3, z)) : null;
}

// W07-C/P1146: this maps a bounded z-score onto a 0~100 scale (`round(50 + 16.67z)`, z=1 -> 67).
// It is a sector-normalized score, not an empirical percentile and not a normal CDF. The
// composite `rank` below is the separate tie-aware midrank percentile over eligible rows; the
// two concepts must never be presented under one name.
function zToNormalizedScore(z) { return Math.max(0, Math.min(100, Math.round(50 + z * 16.67))); }

function normalizeSector(value) {
  const sector = String(value == null ? '' : value).trim();
  return sector || UNKNOWN_SECTOR;
}

function isoMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isFreshPast(value, now, budgetMs) {
  const observed = isoMs(value);
  return Number.isFinite(observed) && Number.isFinite(now) && now >= observed && now - observed <= budgetMs;
}

const PRICE_FACTOR_KEYS = new Set(['momentum', 'trend', 'lowvol', 'kalman']);

function factorLineage(row, key) {
  const priceFactor = PRICE_FACTOR_KEYS.has(key);
  const fundamentalFactor = key === 'value' || key === 'quality';
  const prefix = key === 'size' ? '_mcap' : fundamentalFactor ? '_fundamental' : 'factor';
  const observedAt = row?.[`${prefix}ObservedAt`] || (priceFactor ? row?.observedAt : null) || null;
  const sourceKind = row?.[`${prefix}SourceKind`] || (priceFactor ? row?.factorSourceKind : null) || (priceFactor ? row?.sourceKind : null) || null;
  const allowedUse = row?.[`${prefix}AllowedUse`] || (priceFactor ? row?.factorAllowedUse : null) || (priceFactor ? row?.allowedUse : null) || null;
  const quality = row?.[`${prefix}Quality`] || (priceFactor ? row?.factorQuality : null) || (priceFactor ? row?.quality : null) || null;
  // P1184/R24-03: price-factor timestamps are bar-starts (P1170). Carry the basis
  // and the explicit bar/session fields with the lineage so a consumer of
  // factorEvidence cannot read a bar-start as the moment the value was knowable.
  // Rows predating the producer fields keep null — absence is recorded, never
  // back-filled with an assumed basis.
  const timeBasis = priceFactor ? (row?.factorTimeBasis || null) : null;
  const barStart = priceFactor ? (row?.factorBarStart || null) : null;
  const sessionDate = priceFactor ? (row?.factorSessionDate || null) : null;
  return { observedAt, timeBasis, barStart, sessionDate, sourceKind, sourceTier: canonicalSourceTier(sourceKind), allowedUse, quality };
}

function factorEvidenceUsable(row, key, now) {
  const lineage = factorLineage(row, key);
  const budget = key === 'size' ? FACTOR_FRESHNESS_MS : ['value', 'quality'].includes(key) ? FUNDAMENTAL_FRESHNESS_MS : FACTOR_FRESHNESS_MS;
  const reasons = [];
  if (!lineage.observedAt) reasons.push('observedAt_missing');
  if (!lineage.sourceKind || !lineage.sourceTier) reasons.push('source_tier_missing_or_unknown');
  if (!lineage.allowedUse) reasons.push('allowedUse_missing');
  if (normalizeAllowedUse(lineage.allowedUse, 'none') === 'none') reasons.push('allowedUse_blocked');
  if (!lineage.quality || typeof lineage.quality !== 'object') reasons.push('quality_missing');
  else if (lineage.quality.stale === true || lineage.quality.blocked === true || lineage.quality.status === 'STALE' || lineage.quality.status === 'MISSING') reasons.push('quality_stale_or_blocked');
  if (!isFreshPast(lineage.observedAt, now, budget)) reasons.push('observedAt_stale_or_future');
  return { ok: reasons.length === 0, lineage, reasons };
}

function freezeRecord(record) { return Object.freeze({ ...record }); }

function sanitizeWeights(weights, factors) {
  // Model-default path only. The versioned default/neutral weights are intersected with the
  // factors this cross-section can compute and renormalized; the equal-weight fallback exists
  // solely for a default model with no computable weighted factor at all.
  const source = weights && typeof weights === 'object' ? weights : DEFAULT_WEIGHTS;
  const factorKeys = factors.map(({ key }) => key);
  const applied = {};
  factorKeys.forEach((key) => {
    const value = finite(Number(source[key]));
    applied[key] = value != null && value > 0 ? value : 0;
  });
  let total = Object.values(applied).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) {
    factorKeys.forEach((key) => { applied[key] = 1; });
    total = factorKeys.length;
  }
  return Object.fromEntries(Object.entries(applied).map(([key, value]) => [key, value / total]));
}

// W07-A: explicit requests are resolved against requested coverage, never against the
// active-factor intersection alone. Omitted/zero/negative/non-finite weights are dropped as
// requests (an explicit 0 is never promoted to a positive weight), and the caller receives
// requested/applied/excluded weights plus the exact lost coverage.
function deriveExplicitWeights(weights, factorKeys) {
  const requested = Object.entries(weights && typeof weights === 'object' ? weights : {})
    .map(([key, value]) => [key, finite(Number(value))])
    .filter(([, value]) => value != null && value > 0);
  const requestedTotal = requested.reduce((sum, [, value]) => sum + value, 0);
  if (!requested.length || !(requestedTotal > 0)) return { status: 'requested-weights-not-positive' };
  const available = new Set(factorKeys);
  const computable = requested.filter(([key]) => available.has(key));
  if (!computable.length) return { status: 'requested-factors-unavailable' };
  const coveredTotal = computable.reduce((sum, [, value]) => sum + value, 0);
  const coverage = coveredTotal / requestedTotal;
  const requestedFactorWeights = Object.fromEntries(requested.map(([key, value]) => [key, value / requestedTotal]));
  const excludedFactorWeights = Object.fromEntries(requested.filter(([key]) => !available.has(key)).map(([key, value]) => [key, value / requestedTotal]));
  if (coverage < MIN_REQUESTED_WEIGHT_COVERAGE) {
    return { status: 'requested-factor-coverage-below-threshold', coverage, requestedFactorWeights, excludedFactorWeights };
  }
  return {
    status: 'ok',
    coverage,
    appliedFactorWeights: Object.fromEntries(computable.map(([key, value]) => [key, value / coveredTotal])),
    requestedFactorWeights,
    excludedFactorWeights
  };
}

function readPreviousRankMap(previousRanks) {
  if (Array.isArray(previousRanks)) {
    return new Map(previousRanks.map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), finite(row?.rank)]).filter(([sym, rank]) => sym && rank != null));
  }
  if (previousRanks && typeof previousRanks === 'object') {
    return new Map(Object.entries(previousRanks).map(([sym, value]) => [String(sym).trim().toUpperCase(), finite(value && typeof value === 'object' ? value.rank : value)]).filter(([sym, rank]) => sym && rank != null));
  }
  return null;
}

function deriveTurnoverStability(sorted, previousRanks, topPct = 20) {
  const previous = readPreviousRankMap(previousRanks);
  const boundedTopPct = Math.max(1, Math.min(100, Number(topPct) || 20));
  const topCount = Math.ceil(sorted.length * boundedTopPct / 100);
  const topMembers = (entries) => {
    const ordered = entries.slice().sort((a, b) => b[1] - a[1]);
    const count = Math.ceil(ordered.length * boundedTopPct / 100);
    const cutoff = ordered[count - 1]?.[1];
    return new Set(ordered.filter(([, rank]) => rank >= cutoff).map(([symbol]) => symbol));
  };
  // Include every tie at the boundary. Array order must not manufacture turnover.
  const currentTop = topMembers(sorted.map((row) => [row.sym, row.rank]));
  if (!previous) {
    return freezeRecord({ status: 'unavailable', topCount, topPct: boundedTopPct, currentTopCount: currentTop.size, previousTopCount: null, overlapPct: null, turnoverPct: null, stabilityBand: 'unknown', reason: 'prior ranking snapshot not supplied', usedForRanking: false });
  }
  const previousTop = topMembers([...previous.entries()]);
  const overlap = [...currentTop].filter((sym) => previousTop.has(sym)).length;
  const denominator = Math.max(currentTop.size, previousTop.size, 1);
  const turnoverPct = Math.round((1 - overlap / denominator) * 1000) / 10;
  return freezeRecord({
    status: 'observed', topCount, topPct: boundedTopPct, currentTopCount: currentTop.size, previousTopCount: previousTop.size,
    overlapPct: Math.round(overlap / denominator * 1000) / 10, turnoverPct,
    stabilityBand: turnoverPct <= 20 ? 'stable' : turnoverPct <= 40 ? 'mixed' : 'high-turnover',
    tiePolicy: 'include-all-boundary-ties', normalization: 'larger-membership-set',
    reason: 'top-percentile membership overlap including ties; execution turnover/cost/liquidity are not modeled',
    usedForRanking: false
  });
}

function deriveRegimeStability(regimeLabel, previousRegimeLabel, previousWeights, activeWeights) {
  const current = regimeLabel || null;
  const previous = previousRegimeLabel || null;
  const changed = current != null && previous != null && current !== previous;
  const weightKeys = new Set([...Object.keys(activeWeights || {}), ...Object.keys(previousWeights || {})]);
  const maxWeightDelta = previousWeights && typeof previousWeights === 'object'
    ? Math.max(0, ...[...weightKeys].map((key) => Math.abs((finite(Number(activeWeights?.[key])) || 0) - (finite(Number(previousWeights?.[key])) || 0))))
    : null;
  return freezeRecord({
    status: !current ? 'missing' : !previous ? 'unavailable' : changed ? 'transition' : 'stable',
    current, previous, changed, maxWeightDelta,
    reason: !previous ? 'prior regime/weight snapshot not supplied; no hysteresis claim' : 'diagnostic only; automatic weight promotion is disabled',
    usedForRanking: false
  });
}

function emptyResult({ inputVersion, regimeLabel, weights, reason = 'fewer than five eligible rows', inputAudit = {}, factorCoverage = {}, inactiveFactorReasons = {}, requestedFactorWeights = {}, excludedFactorWeights = {}, requestedWeightCoveragePct = null } = {}) {
  return Object.freeze({
    modelVersion: FACTOR_RANKS_MODEL_VERSION,
    inputVersion,
    available: false,
    qualityStatus: 'unavailable',
    ranked: 0,
    activeFactors: Object.freeze([]),
    activeFactorRegime: regimeLabel || null,
    activeFactorWeights: Object.freeze({ ...(weights || DEFAULT_WEIGHTS) }),
    appliedFactorWeights: Object.freeze({}),
    requestedFactorWeights: Object.freeze({ ...requestedFactorWeights }),
    excludedFactorWeights: Object.freeze({ ...excludedFactorWeights }),
    requestedWeightCoveragePct,
    rankingState: 'unavailable',
    rankingUnavailableReason: reason,
    inactiveFactorReasons: Object.freeze({ ...inactiveFactorReasons }),
    factorCoverage: Object.freeze({ ...factorCoverage }),
    confidence: 0,
    compositeConfidence: 0,
    confidenceMeaning: '입력 커버리지·표본 안정성 진단값이며 미래 수익률 확률이 아님',
    inputAudit: freezeRecord({ inputRows: 0, eligibleRows: 0, validCoreRows: 0, invalidCoreRows: 0, duplicateRows: 0, missingIdentityRows: 0, rawBasisRows: 0, reason, ...inputAudit }),
    sectorNeutrality: freezeRecord({ method: 'sector-relative-z-score-with-global-shrinkage', unknownSectorPolicy: 'universe-fallback', status: 'unavailable', groups: 0, unknownRows: 0, maxAbsMeanCompositeZ: null }),
    outlierDiagnostics: freezeRecord({ method: 'MAD-triggered-winsorization', byFactor: {}, totalOutliers: 0 }),
    regimeStability: deriveRegimeStability(regimeLabel, null, null, {}),
    turnoverStability: deriveTurnoverStability([], null),
    researchBoundary: freezeRecord({ allowedUse: FACTOR_RANKS_ALLOWED_USE, tradingSignal: false, decisionEligible: false, predictiveValidation: 'not-established', autoWeightPromotion: false, reason: 'insufficient cross-sectional factor observations' }),
    rows: Object.freeze([])
  });
}

/**
 * @param {object} input
 * @param {Array<object>} input.rows SCREENER_DB-shaped rows. Read-only.
 * @param {object|null} input.weights resolved regime/profile weights.
 * @param {string|null} input.regimeLabel resolved regime/profile label.
 * @param {number} input.fundamentalCoveragePct published artifact coverage (display only).
 * @param {boolean} input.fmpOk published provider flag (display only; never promotes missing data).
 * @param {number} input.now Date.now-equivalent, explicit for testability.
 * @param {Array<object>|object|null} input.previousRanks optional prior rank snapshot for diagnostics.
 * @param {string|null} input.previousRegimeLabel optional prior regime label for diagnostics.
 * @param {object|null} input.previousWeights optional prior weights for diagnostics.
 */
export function computeFactorRanks({
  rows = [], weights = null, regimeLabel = null, fundamentalCoveragePct = 0, fmpOk = false,
  now = Date.now(), inputVersion = 'unknown', previousRanks = null, previousRegimeLabel = null, previousWeights = null,
  topPct = 20, weightsPolicy = null
} = {}) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const seenSymbols = new Set();
  let duplicateRows = 0;
  let missingIdentityRows = 0;
  let invalidCoreRows = 0;
  let rawBasisRows = 0;
  const items = inputRows.filter((row) => {
    if (!row || (typeof row.ret3m !== 'number' && typeof row.ret1m !== 'number')) return false;
    const symbol = String(row.sym || row.symbol || '').trim().toUpperCase();
    if (!symbol) { missingIdentityRows += 1; return false; }
    // P1255 (07:M04 계열 잔여 D1): 조정 완결이 아닌 계열의 가격수익률은 조정 계열과 한 순위에서
    // 비교하지 않는다 — return-contract의 `mixed-adjustment-scope-in-one-comparison` 위반을
    // 막는다. 가격 기준 선언이 아예 없는 합성/구형 행은 기존 동작을 유지하고, 선언된
    // raw/partial 행만 비교 집합에서 분리해 inputAudit에 남긴다.
    if (row.adjustedCloseStatus != null && row.adjustedCloseStatus !== 'complete') { rawBasisRows += 1; return false; }
    if (finite(row.ret3m) == null && finite(row.ret1m) == null) { invalidCoreRows += 1; return false; }
    if (symbol && seenSymbols.has(symbol)) { duplicateRows += 1; return false; }
    if (symbol) seenSymbols.add(symbol);
    return true;
  });
  const validCoreRows = items.filter((row) => finite(row.ret3m) != null || finite(row.ret1m) != null).length;
  if (items.length < 5 || validCoreRows < 5) {
    return emptyResult({
      inputVersion,
      regimeLabel,
      weights,
      reason: items.length < 5 ? 'fewer than five eligible rows' : 'fewer than five rows with finite momentum observations',
      inputAudit: { inputRows: inputRows.length, eligibleRows: items.length, validCoreRows, invalidCoreRows, duplicateRows, missingIdentityRows, rawBasisRows }
    });
  }

  const candidateFactors = [
    { key: 'momentum', fn: momRaw },
    { key: 'trend', fn: trendRaw },
    { key: 'lowvol', fn: lowvolRaw },
    { key: 'size', fn: sizeRaw },
    { key: 'value', fn: valueRaw },
    { key: 'quality', fn: qualityRaw },
    { key: 'kalman', fn: kalmanRaw }
  ];
  const working = items.map((row, index) => ({
    ...row,
    sym: String(row.sym || row.symbol).trim().toUpperCase(),
    _factorIndex: index,
    _sectorKey: normalizeSector(row.sector),
    _factorEvidence: Object.fromEntries(candidateFactors.map((factor) => [factor.key, factorEvidenceUsable(row, factor.key, now)])),
    _factorValues: Object.fromEntries(candidateFactors.map((factor) => {
      const evidence = factorEvidenceUsable(row, factor.key, now);
      return [factor.key, evidence.ok ? factor.fn(row) : null];
    }))
  }));
  const bySector = new Map();
  working.forEach((row) => {
    const key = row._sectorKey;
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key).push(row);
  });

  const factorCoverage = {};
  candidateFactors.forEach((factor) => {
    const observed = working.filter((row) => finite(row._factorValues[factor.key]) != null).length;
    const coverage = items.length ? observed / items.length : 0;
    const lineageBlocked = working.filter((row) => !row._factorEvidence[factor.key]?.ok).length;
    factorCoverage[factor.key] = freezeRecord({
      observations: observed,
      eligibleRows: items.length,
      lineageBlocked,
      coveragePct: Math.round(coverage * 1000) / 10,
      minCoveragePct: MIN_CROSS_SECTION_COVERAGE * 100,
      active: coverage >= MIN_CROSS_SECTION_COVERAGE,
      status: coverage >= MIN_CROSS_SECTION_COVERAGE ? 'active-candidate' : 'coverage-below-threshold'
    });
  });

  const mcapCurrentCount = working.filter((row) => sizeRaw(row) != null && row._factorEvidence.size?.ok).length;
  const sizeActive = mcapCurrentCount >= Math.ceil(items.length * MIN_CROSS_SECTION_COVERAGE) && factorCoverage.size.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
  const fundamentalCurrentCount = working.filter((row) => {
    const hasInput = valueRaw(row) != null || qualityRaw(row) != null;
    return hasInput && (row._factorEvidence.value?.ok || row._factorEvidence.quality?.ok);
  }).length;
  const fundamentalCurrentPct = items.length ? fundamentalCurrentCount / items.length * 100 : 0;
  const fundamentalCurrent = fundamentalCurrentCount >= Math.ceil(items.length * MIN_CROSS_SECTION_COVERAGE);
  const valueActive = fundamentalCurrent && factorCoverage.value.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
  const qualityActive = fundamentalCurrent && factorCoverage.quality.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
  factorCoverage.size = freezeRecord({ ...factorCoverage.size, active: sizeActive, status: sizeActive ? 'active' : 'freshness-or-coverage-blocked' });
  factorCoverage.value = freezeRecord({ ...factorCoverage.value, active: valueActive, status: valueActive ? 'active' : 'freshness-or-coverage-blocked' });
  factorCoverage.quality = freezeRecord({ ...factorCoverage.quality, active: qualityActive, status: qualityActive ? 'active' : 'freshness-or-coverage-blocked' });
  factorCoverage.kalman = freezeRecord({ ...factorCoverage.kalman, active: factorCoverage.kalman.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100, status: factorCoverage.kalman.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100 ? 'active' : 'coverage-below-threshold' });
  for (const key of ['momentum', 'trend', 'lowvol']) {
    const active = factorCoverage[key].coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
    factorCoverage[key] = freezeRecord({ ...factorCoverage[key], active, status: active ? 'active' : 'coverage-below-threshold' });
  }
  const activeCandidates = new Set(candidateFactors.filter((factor) => ['momentum', 'trend', 'lowvol'].includes(factor.key) && factorCoverage[factor.key].coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100).map((factor) => factor.key));
  if (sizeActive) activeCandidates.add('size');
  if (valueActive) activeCandidates.add('value');
  if (qualityActive) activeCandidates.add('quality');
  if (factorCoverage.kalman.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100) activeCandidates.add('kalman');
  const FACTORS = candidateFactors.filter((factor) => activeCandidates.has(factor.key));
  const inactiveFactorReasons = {
    momentum: factorCoverage.momentum.active ? null : `모멘텀 유효값 커버리지 80% 미만 (${factorCoverage.momentum.coveragePct.toFixed(1)}%)`,
    trend: factorCoverage.trend.active ? null : `추세 유효값 커버리지 80% 미만 (${factorCoverage.trend.coveragePct.toFixed(1)}%)`,
    lowvol: factorCoverage.lowvol.active ? null : `변동성 유효값 커버리지 80% 미만 (${factorCoverage.lowvol.coveragePct.toFixed(1)}%)`,
    size: sizeActive ? null : '시가총액 관측시각·출처 tier·quality·허용용도 또는 80% 커버리지 미확보',
    value: valueActive ? null : `재무 관측시각·출처 tier·quality·허용용도·180일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    quality: qualityActive ? null : `재무 관측시각·출처 tier·quality·허용용도·180일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    kalman: factorCoverage.kalman.active ? null : `칼만 유효값 커버리지 80% 미만 (${factorCoverage.kalman.coveragePct.toFixed(1)}%)`
  };
  // Preserve the established reason text when only the freshness gate is responsible. Existing
  // parity fixtures and UI consumers use these two exact messages.
  if (!fundamentalCurrent) {
    const reason = `재무 관측시각·180일 신선도 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`;
    inactiveFactorReasons.value = reason;
    inactiveFactorReasons.quality = reason;
  }
  if (!FACTORS.length) {
    return emptyResult({
      inputVersion,
      regimeLabel,
      weights,
      reason: 'no factor meets the minimum cross-sectional coverage threshold',
      factorCoverage,
      inactiveFactorReasons,
      inputAudit: { inputRows: inputRows.length, eligibleRows: items.length, validCoreRows, invalidCoreRows, duplicateRows, missingIdentityRows, rawBasisRows }
    });
  }

  // W07-A: an explicit weight request must not degrade into a different model. When the
  // caller supplies explicit weights, resolve them against requested coverage and fail
  // closed if the requested factors are absent or too little of the request is computable.
  const activeWeights = weights && typeof weights === 'object' ? { ...weights } : { ...DEFAULT_WEIGHTS };
  const explicitWeights = weightsPolicy === 'explicit' || (weightsPolicy == null && !!(weights && typeof weights === 'object'));
  const factorKeys = FACTORS.map((factor) => factor.key);
  let appliedFactorWeights = null;
  let requestedFactorWeights = Object.freeze({ ...activeWeights });
  let excludedFactorWeights = Object.freeze({});
  let requestedWeightCoveragePct = 100;
  if (explicitWeights) {
    const resolution = deriveExplicitWeights(activeWeights, factorKeys);
    if (resolution.status !== 'ok') {
      return emptyResult({
        inputVersion,
        regimeLabel,
        weights,
        reason: resolution.status,
        factorCoverage,
        inactiveFactorReasons,
        requestedFactorWeights: resolution.requestedFactorWeights || {},
        excludedFactorWeights: resolution.excludedFactorWeights || {},
        requestedWeightCoveragePct: resolution.coverage == null ? null : Math.round(resolution.coverage * 1000) / 10,
        inputAudit: { inputRows: inputRows.length, eligibleRows: items.length, validCoreRows, invalidCoreRows, duplicateRows, missingIdentityRows, rawBasisRows }
      });
    }
    appliedFactorWeights = resolution.appliedFactorWeights;
    requestedFactorWeights = Object.freeze({ ...resolution.requestedFactorWeights });
    excludedFactorWeights = Object.freeze({ ...resolution.excludedFactorWeights });
    requestedWeightCoveragePct = Math.round(resolution.coverage * 1000) / 10;
  } else {
    appliedFactorWeights = sanitizeWeights(activeWeights, FACTORS);
  }

  const outlierByFactor = {};
  FACTORS.forEach((factor) => {
    const finiteRows = working.filter((row) => finite(row._factorValues[factor.key]) != null);
    const allVals = finiteRows.map((row) => row._factorValues[factor.key]);
    const universeStats = guardedStats(allVals);
    const outlierRows = new Set();
    const guardedGroups = [];
    if (universeStats.outlierIndexes.length) {
      universeStats.outlierIndexes.forEach((index) => {
        const row = finiteRows[index];
        if (row) outlierRows.add(String(row.sym || row.symbol || `row-${row._factorIndex}`));
      });
      guardedGroups.push('universe');
    }
    for (const [sectorKey, group] of bySector.entries()) {
      const finiteGroupRows = group.filter((row) => finite(row._factorValues[factor.key]) != null);
      const vals = finiteGroupRows.map((row) => row._factorValues[factor.key]);
      let groupStats = universeStats;
      if (sectorKey !== UNKNOWN_SECTOR) {
        if (vals.length >= MIN_SECTOR_OBSERVATIONS) {
          groupStats = guardedStats(vals);
        } else if (vals.length >= 2) {
          const sectorStats = guardedStats(vals);
          const blend = vals.length / MIN_SECTOR_OBSERVATIONS;
          groupStats = {
            mu: blend * sectorStats.mu + (1 - blend) * universeStats.mu,
            sd: blend * sectorStats.sd + (1 - blend) * universeStats.sd,
            method: sectorStats.method === 'winsorized-mad' ? 'sector-winsorized-mad+universe-shrinkage' : 'sector+universe-shrinkage',
            outlierCount: sectorStats.outlierCount,
            outlierIndexes: sectorStats.outlierIndexes
          };
        }
      }
      if (groupStats.outlierIndexes.length) {
        groupStats.outlierIndexes.forEach((index) => {
          const candidate = finiteGroupRows[index];
          if (candidate) outlierRows.add(String(candidate.sym || candidate.symbol || `row-${candidate._factorIndex}`));
        });
        guardedGroups.push(sectorKey || 'unknown');
      }
      group.forEach((row) => { row['_z_' + factor.key] = winz(row._factorValues[factor.key], groupStats.mu, groupStats.sd); });
    }
    outlierByFactor[factor.key] = freezeRecord({ count: outlierRows.size, symbols: Object.freeze([...outlierRows]), guardedGroups: Object.freeze([...new Set(guardedGroups)]), method: 'MAD-triggered-winsorization' });
  });

  const sectorCounts = [...bySector.entries()].map(([sector, group]) => ({ sector: sector || 'unknown', count: group.length, known: sector !== UNKNOWN_SECTOR }));
  const knownRows = sectorCounts.filter((entry) => entry.known).reduce((sum, entry) => sum + entry.count, 0);
  const sectorConfidence = items.length ? Math.max(0, Math.min(1, (knownRows / items.length) * Math.min(1, sectorCounts.filter((entry) => entry.known).length / 3))) : 0;
  const crossSectionConfidence = Math.min(1, items.length / 30);
  let totalCompositeConfidence = 0;
  working.forEach((row) => {
    let weightedComposite = 0;
    let observedWeight = 0;
    const factorScores = {};
    const missingFactors = [];
    FACTORS.forEach((factor) => {
      const observed = finite(row._factorValues[factor.key]) != null;
      const z = finite(row['_z_' + factor.key]);
      const weight = appliedFactorWeights[factor.key] || 0;
      const usable = observed && z != null;
      if (usable && weight > 0) {
        weightedComposite += z * weight;
        observedWeight += weight;
      }
      if (!usable) missingFactors.push(factor.key);
      factorScores[factor.key] = usable ? zToNormalizedScore(z) : null;
    });
    // Renormalization is safe only for immaterial gaps. Below the row-level evidence floor the
    // security would effectively be ranked by a different model, which creates missingness
    // selection bias. Preserve the diagnostics and display row, but fail closed on rank.
    row._compositeZ = observedWeight + Number.EPSILON >= MIN_ROW_WEIGHT_COVERAGE
      ? weightedComposite / observedWeight
      : null;
    row.factorScores = Object.freeze(factorScores);
    row.factorCoverage = FACTORS.length ? observedWeight : 0;
    row.missingFactors = Object.freeze(missingFactors);
    row.rankingEligibility = row._compositeZ == null ? 'insufficient-row-factor-coverage' : 'eligible';
    const sectorGroup = bySector.get(row._sectorKey) || [];
    const rowSectorConfidence = row._sectorKey === UNKNOWN_SECTOR ? 0 : Math.min(1, sectorGroup.length / MIN_SECTOR_OBSERVATIONS);
    row.confidence = Math.max(0, Math.min(1, 0.55 * row.factorCoverage + 0.25 * crossSectionConfidence + 0.20 * rowSectorConfidence));
    if (row._compositeZ != null) totalCompositeConfidence += row.confidence;
  });

  // Rows with no usable weighted evidence stay visible with null score/rank but must not
  // alter the percentile denominator or the turnover universe.
  const sorted = working.filter((row) => finite(row._compositeZ) != null).sort((a, b) => a._compositeZ - b._compositeZ);
  const n = sorted.length;
  // Equal evidence must receive the same percentile, independent of input order.
  for (let start = 0; start < n;) {
    let end = start + 1;
    while (end < n && sorted[end]._compositeZ === sorted[start]._compositeZ) end += 1;
    const rank = n > 1 ? Math.round(((start + end - 1) / 2 / (n - 1)) * 100) : 50;
    for (let index = start; index < end; index += 1) {
      sorted[index].rank = rank;
      sorted[index].quantSignal = rank >= 80 ? '상위 20%' : rank >= 60 ? '상위 40%' : rank >= 40 ? '중간 20%' : '하위 40%';
    }
    start = end;
  }

  const resultRows = working.map((row) => {
    const out = {
      sym: row.sym,
      _compositeZ: row._compositeZ,
      factorScores: row.factorScores,
      rank: row.rank ?? null,
      quantSignal: row.quantSignal || null,
      factorCoverage: Math.round(row.factorCoverage * 1000) / 1000,
      missingFactors: row.missingFactors,
      confidence: Math.round(row.confidence * 1000) / 1000,
      rankingEligibility: row.rankingEligibility,
      minimumFactorCoverage: MIN_ROW_WEIGHT_COVERAGE,
      factorEvidence: Object.freeze(Object.fromEntries(Object.entries(row._factorEvidence).map(([key, evidence]) => [key, Object.freeze({
        eligible: !!evidence.ok,
        observedAt: evidence.lineage?.observedAt || null,
        // P1184: publish *what kind of instant* observedAt is alongside it.
        timeBasis: evidence.lineage?.timeBasis || null,
        barStart: evidence.lineage?.barStart || null,
        sessionDate: evidence.lineage?.sessionDate || null,
        sourceKind: evidence.lineage?.sourceKind || null,
        sourceTier: evidence.lineage?.sourceTier || null,
        allowedUse: evidence.lineage?.allowedUse || null,
        blockedReasons: Object.freeze(evidence.reasons || [])
      })]))),
      allowedUse: FACTOR_RANKS_ALLOWED_USE,
      decisionEligible: false
    };
    FACTORS.forEach((factor) => { out['_z_' + factor.key] = row['_z_' + factor.key]; });
    return Object.freeze(out);
  });

  const maxAbsMeanCompositeZ = Math.max(0, ...sectorCounts.filter((entry) => entry.known).map((entry) => {
    const group = bySector.get(entry.sector);
    const composites = group.map((row) => row._compositeZ).filter((value) => finite(value) != null);
    return composites.length ? Math.abs(avg(composites)) : 0;
  }));
  const activeCoverage = FACTORS.length ? avg(FACTORS.map((factor) => factorCoverage[factor.key].coveragePct / 100)) : 0;
  const compositeConfidence = Math.max(0, Math.min(1, 0.55 * (activeCoverage || 0) + 0.25 * crossSectionConfidence + 0.20 * sectorConfidence));
  const outlierTotal = Object.values(outlierByFactor).reduce((sum, entry) => sum + entry.count, 0);
  const rowCoverageBlocked = working.filter((row) => row.rankingEligibility !== 'eligible').length;
  const qualityStatus = compositeConfidence >= 0.8 && invalidCoreRows === 0 && duplicateRows === 0 && outlierTotal === 0 && rowCoverageBlocked === 0 ? 'ready' : 'partial';
  const smallSectorGroups = sectorCounts.filter((entry) => entry.known && entry.count < MIN_SECTOR_OBSERVATIONS);
  const unknownRows = sectorCounts.find((entry) => !entry.known)?.count || 0;
  const sectorNeutrality = freezeRecord({
    method: 'sector-relative-z-score-with-global-shrinkage',
    unknownSectorPolicy: 'universe-fallback',
    status: smallSectorGroups.length || unknownRows || maxAbsMeanCompositeZ > 0.25 ? 'partial' : 'observed',
    groups: sectorCounts.filter((entry) => entry.known).length,
    unknownRows,
    smallSectorGroups: Object.freeze(smallSectorGroups.map((entry) => entry.sector)),
    maxAbsMeanCompositeZ: Number.isFinite(maxAbsMeanCompositeZ) ? Math.round(maxAbsMeanCompositeZ * 1e6) / 1e6 : null,
    groupsDetail: Object.freeze(sectorCounts.map((entry) => freezeRecord(entry)))
  });
  const inputAudit = freezeRecord({
    inputRows: inputRows.length,
    eligibleRows: items.length,
    validCoreRows,
    invalidCoreRows,
    duplicateRows,
    missingIdentityRows,
    rowCoverageBlocked,
    minimumRowWeightCoverage: MIN_ROW_WEIGHT_COVERAGE,
    fundamentalCurrentRows: fundamentalCurrentCount,
    fundamentalArtifactCoveragePct: finite(Number(fundamentalCoveragePct)),
    fmpOk: fmpOk === true,
    futureOrInvalidMcapDates: inputRows.filter((row) => row?._mcapObservedAt && !isFreshPast(row._mcapObservedAt, now, FACTOR_FRESHNESS_MS)).length,
    futureOrInvalidFundamentalDates: inputRows.filter((row) => row?._fundamentalObservedAt && !isFreshPast(row._fundamentalObservedAt, now, FUNDAMENTAL_FRESHNESS_MS)).length
  });

  return Object.freeze({
    modelVersion: FACTOR_RANKS_MODEL_VERSION,
    inputVersion,
    available: true,
    qualityStatus,
    ranked: n,
    activeFactors: Object.freeze(FACTORS.map((factor) => factor.key)),
    activeFactorRegime: regimeLabel || null,
    activeFactorWeights: Object.freeze({ ...activeWeights }),
    appliedFactorWeights: Object.freeze({ ...appliedFactorWeights }),
    requestedFactorWeights: Object.freeze({ ...requestedFactorWeights }),
    excludedFactorWeights: Object.freeze({ ...excludedFactorWeights }),
    requestedWeightCoveragePct,
    weightsPolicy: explicitWeights ? 'explicit' : 'model-default',
    rankingState: 'ranked',
    rankingUnavailableReason: null,
    inactiveFactorReasons: Object.freeze(inactiveFactorReasons),
    factorCoverage: Object.freeze({ ...factorCoverage }),
    confidence: Math.round((totalCompositeConfidence / Math.max(1, n)) * 1000) / 1000,
    compositeConfidence: Math.round(compositeConfidence * 1000) / 1000,
    confidenceMeaning: '입력 커버리지·표본 안정성 진단값이며 미래 수익률 확률이 아님',
    // W07-C/P1146: name the two scales so no consumer reads a z-scale as a percentile.
    factorScoreScale: 'sector-normalized-z-to-0-100',
    factorScoreMeaning: '섹터 기준 정규화 점수(z 스케일)이며 경험적 백분위나 성공확률이 아님',
    compositeRankMeaning: 'eligible 집합 동점 midrank 백분위(0~100)',
    inputAudit,
    sectorNeutrality,
    outlierDiagnostics: freezeRecord({ method: 'MAD-triggered-winsorization', byFactor: Object.freeze(outlierByFactor), totalOutliers: outlierTotal }),
    regimeStability: deriveRegimeStability(regimeLabel, previousRegimeLabel, previousWeights, activeWeights),
    turnoverStability: deriveTurnoverStability(sorted, previousRanks, topPct),
    researchBoundary: freezeRecord({
      allowedUse: FACTOR_RANKS_ALLOWED_USE,
      tradingSignal: false,
      decisionEligible: false,
      predictiveValidation: 'not-established',
      autoWeightPromotion: false,
      reason: '현재 결과는 관측시점 기준 상대 순위이며 PIT·생존편향·비용·유동성·실거래 패리티를 인증하지 않음'
    }),
    rows: Object.freeze(resultRows)
  });
}
