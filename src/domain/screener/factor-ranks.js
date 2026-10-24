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
import { MODEL_DEFAULT_WEIGHTS } from './factor-weights.js';
import { screenerMarket, MARKET_POPULATION_POLICY } from './market-scope.js';
import { latestCompletedUsSession, latestCompletedKrSession, resolveMarketCalendarSession } from '../market/market-calendar.js';
import { FUNDAMENTAL_MAX_PERIOD_AGE_DAYS, fundamentalPeriodTooOld } from '../fundamental/period.js';
import { finiteNumber as finite } from '../shared/number.js';

// v7 (2026-10-16): funds, SPACs and sub-$1M 확장 names leave the ranked population (rankingPopulationExclusion).
// v8 (2026-10-17 audit, owner-approved): factor activation is judged on the core tier when 확장 rows are present, a
// zero-weight factor is not active in the model-default run, and outliers no longer mark the run 'partial'.
export const FACTOR_RANKS_MODEL_VERSION = 'factor-ranks.v8';
export const FACTOR_RANKS_ALLOWED_USE = 'research-relative-ranking-only';

const DAY_MS = 86_400_000;
// Shared with the producer (fetch-data) so the quality label written into the
// artifact and the freshness gate applied at read time use one budget — two
// budgets let a row read CURRENT at fetch and stale at render, or vice versa.
export const FACTOR_FRESHNESS_MS = 4 * DAY_MS;
const MIN_RANKED_ROWS = 5;
// 2026-10-13 review S01: value/quality use the provider's period rule (fiscal period end within 456 days of
// the price session). The former 180-day filing-date budget left 79 of 810 US rows current.
const FUNDAMENTAL_FRESHNESS_MS = FUNDAMENTAL_MAX_PERIOD_AGE_DAYS * DAY_MS;
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

// P1449: the model default is the shared NEUTRAL vector from factor-weights.js (one weights
// module). A local backup copy drifted from it (spot-check: momentum .32 vs .27 renormalized
// over the 4 computable factors 39.0% vs 37.0%), and the backtest generator's P1443 promise
// ("the live model runs the same weights") silently validated the wrong model — see
// scripts/lib and ci-data-pipeline-contract-check for the fixture pinning the two together.
const DEFAULT_WEIGHTS = MODEL_DEFAULT_WEIGHTS;

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

// 2026-10-16 review — candidate definitions, used only by the shadow record in the candidate archive (never the page's
// rank until a forward record supports them). 6-1 skips the latest month, whose reversal noise the 1-3-6 blend keeps.
// Signed yields (TTM earnings and book over market value, supplied by the caller) give a loss-maker a low value; with
// positive multiples only, a loss-maker's value is missing and renormalization reads it as average.
function momSixMinusOneRaw(row) {
  const r6 = finite(row?.ret6m);
  const r1 = finite(row?.ret1m);
  return r6 != null && r1 != null && r1 > -100 ? ((1 + r6 / 100) / (1 + r1 / 100) - 1) * 100 : null;
}

// 2026-10-19 (expertise review D2): 12-1 — the year to one month ago (Jegadeesh-Titman), the academic momentum signal,
// from the same close series as ret12m and ret1m: (1+r12)/(1+r1)-1 = close[t-21]/close[t-252]-1. Missing when the
// listing has less than a year of closes; no shorter window stands in for it.
function momTwelveMinusOneRaw(row) {
  const r12 = finite(row?.ret12m);
  const r1 = finite(row?.ret1m);
  return r12 != null && r1 != null && r1 > -100 ? ((1 + r12 / 100) / (1 + r1 / 100) - 1) * 100 : null;
}

function signedYieldValueRaw(row) {
  const parts = [];
  const earningsYield = finite(row?.earningsYieldTtm);
  const bookYield = finite(row?.bookYield);
  if (earningsYield != null) parts.push(Math.max(-0.2, Math.min(0.2, earningsYield)) / 0.2);
  if (bookYield != null) parts.push(Math.max(-1, Math.min(2, bookYield)) / 2);
  return parts.length ? avg(parts) : null;
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
  // 2026-10-13 F11: EV/EBITDA is retired at the provider (no automated producer; 0 of 873 rows), so this term is
  // inert on live rows. The line stays only because the legacy-derived factor-ranks golden fixture
  // (architecture/fixtures/factor-ranks-golden.json) feeds evEbitda inputs; removing it needs a golden refresh.
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

// Expertise review 2026-10-19 (screener audit D7): growth is not quality. The candidate model ranks quality on
// profitability alone (ROE, margin) so its forward record can test the definition the default keeps.
function profitabilityRaw(row) {
  const parts = [];
  const roe = finite(row?.roe);
  const margin = finite(row?.margin);
  if (roe != null) parts.push(Math.max(-30, Math.min(60, roe)) / 60);
  if (margin != null) parts.push(Math.max(-20, Math.min(40, margin)) / 40);
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
const sessionCache = new Map();
function isLatestCompletedPriceSession(row, lineage, now) {
  if (lineage.timeBasis !== 'bar-start' || !lineage.sessionDate || row?.factorBarCompleteness !== 'completed-sessions-only') return false;
  const observed=isoMs(lineage.observedAt), market=screenerMarket(row), key=`${market}:${Math.floor(now/60000)}`;
  if(!Number.isFinite(observed)||observed>now)return false;
  if(!sessionCache.has(key)) { sessionCache.set(key,market==='KR'?latestCompletedKrSession(now):latestCompletedUsSession(now,{requirePrevious:false})); if(sessionCache.size>8)sessionCache.delete(sessionCache.keys().next().value); }
  const latest=sessionCache.get(key);
  const zone=market==='KR'?'Asia/Seoul':'America/New_York';
  const ownDate=new Date(observed).toLocaleDateString('en-CA',{timeZone:zone});
  return latest?.date===lineage.sessionDate && ownDate===lineage.sessionDate && resolveMarketCalendarSession({market,date:ownDate}).status==='open';
}

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

// S01: a fundamental is current when its fiscal period ended within 456 days of the row's price session
// (the provider's rule). Rows without a published period end fall back to the filing time under the same budget.
function fundamentalFresh(row, observedAt, now) {
  const observed = isoMs(observedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(now) || observed > now) return false;
  if (!row?._fundamentalPeriodEnd) return isFreshPast(observedAt, now, FUNDAMENTAL_FRESHNESS_MS);
  const session = row.factorSessionDate || row.factorObservedAt || new Date(now).toISOString();
  return Number.isFinite(Date.parse(String(row._fundamentalPeriodEnd).slice(0, 10))) && !fundamentalPeriodTooOld(row._fundamentalPeriodEnd, session);
}

function factorEvidenceUsable(row, key, now) {
  const lineage = factorLineage(row, key);
  const budget = FACTOR_FRESHNESS_MS;
  const fundamentalFactor = key === 'value' || key === 'quality';
  const reasons = [];
  if (!lineage.observedAt) reasons.push('observedAt_missing');
  if (!lineage.sourceKind || !lineage.sourceTier) reasons.push('source_tier_missing_or_unknown');
  if (!lineage.allowedUse) reasons.push('allowedUse_missing');
  if (normalizeAllowedUse(lineage.allowedUse, 'none') === 'none') reasons.push('allowedUse_blocked');
  if (!lineage.quality || typeof lineage.quality !== 'object') reasons.push('quality_missing');
  else if (lineage.quality.stale === true || lineage.quality.blocked === true || lineage.quality.status === 'STALE' || lineage.quality.status === 'MISSING') reasons.push('quality_stale_or_blocked');
  // P1625: a latest completed KRX close remains current through a holiday + weekend.
  if (fundamentalFactor ? !fundamentalFresh(row, lineage.observedAt, now) : (!isFreshPast(lineage.observedAt, now, budget) && !(PRICE_FACTOR_KEYS.has(key) && isLatestCompletedPriceSession(row,lineage,now)))) reasons.push('observedAt_stale_or_future');
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
function computeFactorRanksForPopulation({
  rows = [], weights = null, regimeLabel = null, fundamentalCoveragePct = 0, fmpOk = false,
  now = Date.now(), inputVersion = 'unknown', previousRanks = null, previousRegimeLabel = null, previousWeights = null,
  topPct = 20, weightsPolicy = null, momentumDefinition = 'blend-1-3-6', valueDefinition = 'positive-multiples', qualityDefinition = 'roe-margin-growth'
} = {}) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const momentumFn = momentumDefinition === 'twelve-minus-one' ? momTwelveMinusOneRaw : momentumDefinition === 'six-minus-one' ? momSixMinusOneRaw : momRaw;
  const valueFn = valueDefinition === 'signed-yields' ? signedYieldValueRaw : valueRaw;
  const qualityFn = qualityDefinition === 'profitability' ? profitabilityRaw : qualityRaw;
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
    { key: 'momentum', fn: momentumFn },
    { key: 'trend', fn: trendRaw },
    { key: 'lowvol', fn: lowvolRaw },
    { key: 'size', fn: sizeRaw },
    { key: 'value', fn: valueFn },
    { key: 'quality', fn: qualityFn },
    { key: 'kalman', fn: kalmanRaw }
  ];
  const working = items.map((row, index) => {
    // One lineage verdict per row and factor: the value below is read only when that same verdict passes.
    const evidence = Object.fromEntries(candidateFactors.map((factor) => [factor.key, factorEvidenceUsable(row, factor.key, now)]));
    return {
      ...row,
      sym: String(row.sym || row.symbol).trim().toUpperCase(),
      _factorIndex: index,
      _sectorKey: normalizeSector(row.sector),
      _factorEvidence: evidence,
      _factorValues: Object.fromEntries(candidateFactors.map((factor) => [factor.key, evidence[factor.key].ok ? factor.fn(row) : null]))
    };
  });
  const bySector = new Map();
  working.forEach((row) => {
    const key = row._sectorKey;
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key).push(row);
  });

  // 2026-10-17 audit (D5, owner-approved): whether a factor is part of the model is judged on the core tier when 확장
  // rows are present. The extended rows' thinner filings (fundamental coverage 62.5% against 89% in the core) used to
  // switch value and quality off for every row, so the 확장 toggle changed the core names' model. Extended rows
  // without a fundamental now meet the row-level evidence floor like any other row.
  const coreRows = working.filter((row) => row.universeTier !== 'extended');
  const coverageRows = coreRows.length >= MIN_RANKED_ROWS && coreRows.length < working.length ? coreRows : working;
  const coverageBasis = coverageRows === working ? 'all-eligible-rows' : 'core-tier';
  const factorCoverage = {};
  candidateFactors.forEach((factor) => {
    const observed = coverageRows.filter((row) => finite(row._factorValues[factor.key]) != null).length;
    const coverage = coverageRows.length ? observed / coverageRows.length : 0;
    const lineageBlocked = working.filter((row) => !row._factorEvidence[factor.key]?.ok).length;
    factorCoverage[factor.key] = freezeRecord({
      observations: observed,
      eligibleRows: coverageRows.length,
      coverageBasis,
      lineageBlocked,
      coveragePct: Math.round(coverage * 1000) / 10,
      minCoveragePct: MIN_CROSS_SECTION_COVERAGE * 100,
      active: coverage >= MIN_CROSS_SECTION_COVERAGE,
      status: coverage >= MIN_CROSS_SECTION_COVERAGE ? 'active-candidate' : 'coverage-below-threshold'
    });
  });

  const mcapCurrentCount = coverageRows.filter((row) => sizeRaw(row) != null && row._factorEvidence.size?.ok).length;
  const sizeActive = mcapCurrentCount >= Math.ceil(coverageRows.length * MIN_CROSS_SECTION_COVERAGE) && factorCoverage.size.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
  const fundamentalCurrentCount = coverageRows.filter((row) => {
    const hasInput = valueFn(row) != null || qualityFn(row) != null;
    return hasInput && (row._factorEvidence.value?.ok || row._factorEvidence.quality?.ok);
  }).length;
  const fundamentalCurrentPct = coverageRows.length ? fundamentalCurrentCount / coverageRows.length * 100 : 0;
  const fundamentalCurrent = fundamentalCurrentCount >= Math.ceil(coverageRows.length * MIN_CROSS_SECTION_COVERAGE);
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
  let FACTORS = candidateFactors.filter((factor) => activeCandidates.has(factor.key));
  const inactiveFactorReasons = {
    momentum: factorCoverage.momentum.active ? null : `모멘텀 유효값 커버리지 80% 미만 (${factorCoverage.momentum.coveragePct.toFixed(1)}%)`,
    trend: factorCoverage.trend.active ? null : `추세 유효값 커버리지 80% 미만 (${factorCoverage.trend.coveragePct.toFixed(1)}%)`,
    lowvol: factorCoverage.lowvol.active ? null : `변동성 유효값 커버리지 80% 미만 (${factorCoverage.lowvol.coveragePct.toFixed(1)}%)`,
    size: sizeActive ? null : '시가총액 관측시각·출처 tier·quality·허용용도 또는 80% 커버리지 미확보',
    value: valueActive ? null : `재무 관측시각·출처 tier·quality·허용용도·회계기간 456일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    quality: qualityActive ? null : `재무 관측시각·출처 tier·quality·허용용도·회계기간 456일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    kalman: factorCoverage.kalman.active ? null : `칼만 유효값 커버리지 80% 미만 (${factorCoverage.kalman.coveragePct.toFixed(1)}%)`
  };
  // Preserve the established reason text when only the freshness gate is responsible. Existing
  // parity fixtures and UI consumers use these two exact messages.
  if (!fundamentalCurrent) {
    const reason = `재무 관측시각·회계기간 456일 신선도 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`;
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
    // D6 (2026-10-17 audit): a factor the default model weights at 0 (size, until it has an artifact-fixed market cap)
    // is not part of the model even when its data is present — it neither scores rows nor changes the model identity.
    const weighted = FACTORS.filter((factor) => appliedFactorWeights[factor.key] > 0);
    if (weighted.length && weighted.length < FACTORS.length) {
      FACTORS.filter((factor) => !(appliedFactorWeights[factor.key] > 0)).forEach((factor) => {
        inactiveFactorReasons[factor.key] = `기본 모델 가중 0 — ${factor.key === 'size' ? '규모는 실시간 시가총액이 일부 종목에만 들어와 기본 순위에 쓰지 않음' : '기본 순위에 쓰지 않음'}`;
        delete appliedFactorWeights[factor.key];
      });
      FACTORS = weighted;
    }
  }

  // D8 (2026-10-17 audit, kept): every factor, price factors included, is compared inside its sector. This removes
  // industry momentum from the momentum factor on purpose — the ranking should separate stocks within a sector rather
  // than restate the sector rotation (테마 · 섹터 owns that), and it keeps the top fifth from filling with one sector.
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
    // P1553: a percentile needs peers. The input guard counts rows with a return, but a row also needs 80% of the weighted
    // evidence to be ranked, so fewer than MIN_RANKED_ROWS can remain; one remaining row used to be published as rank 50
    // ("중간 20%") although nothing was compared. Such rows keep a null rank.
    const rank = n >= MIN_RANKED_ROWS ? Math.round(((start + end - 1) / 2 / (n - 1)) * 100) : null;
    for (let index = start; rank != null && index < end; index += 1) {
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
  // D9 (2026-10-17 audit): extreme values are already winsorized and listed in outlierDiagnostics, and rows below the
  // row-level evidence floor are listed on the page as '순위 밖'; neither is an input failure of the run. Requiring zero
  // of both meant an 800-row universe (46 outliers, 41 thin rows) could never read 'ready'. A run is partial when more
  // than a tenth of its rows could not be ranked.
  const qualityStatus = compositeConfidence >= 0.8 && invalidCoreRows === 0 && duplicateRows === 0 && rowCoverageBlocked <= items.length * 0.1 ? 'ready' : 'partial';
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
    coverageBasis,
    factorDefinitions: Object.freeze({ momentum: momentumFn === momRaw ? 'blend-1-3-6' : momentumFn === momTwelveMinusOneRaw ? 'twelve-minus-one' : 'six-minus-one', value: valueFn === valueRaw ? 'positive-multiples' : 'signed-yields', quality: qualityFn === qualityRaw ? 'roe-margin-growth' : 'profitability' }),
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

// 2026-10-16 screener model review (owner-approved): funds, SPACs and — in the 확장 tier — names trading under $1M a day
// are not ranked against operating companies. A bond ETF or a SPAC's trust cash has near-zero volatility and topped the
// low-volatility factor (77 SPACs in the extended top fifth). The rows stay on the screen with a null rank and the reason.
// Funds use the universe's declared index 'ETF'. SPACs: the filer's SEC SIC code 6770 (Blank Checks), which the
// extended SEC ledger records per issuer (issuerSic) and the shard carries as identity.sic, OR the registered-name
// rule. Neither alone is complete (2026-10-16 measurement over 3,913 extended rows): SIC 6770 caught 42 SPACs the name
// misses (Churchill Capital Corp XII, Cantor Equity Partners, Talon Capital Corp), and 23 pre-merger SPACs named
// "... Acquisition Corp" are filed under their target industry's code (7372, 2836, 8200), not 6770. The name rule
// only ever removes a rank with its reason; it never assigns an identity (R628). Known miss: a de-SPAC whose SEC code
// was never updated (Innventure, 6770 since its 2024 merger) leaves the ranking until SEC reclassifies it.
export const EXTENDED_MIN_DOLLAR_VOLUME_30D = 1_000_000;
export const SPAC_SIC = '6770';
const SPAC_NAME = /acquisitions?\s*(?:\d+|I{1,3}|IV|VI{0,3})?\s*(?:corp(?:oration)?|company|co|inc|ltd|limited)\b|acquisitions?\s+(?:I{1,3}|IV|VI{0,3})\s*$|\bspac\b|\bblank check\b|\bmerger corp(?:oration)?\b/i;
export function rankingPopulationExclusion(row) {
  if (row?.index === 'ETF' || row?.assetType === 'ETF' || row?.instrumentRef?.assetType === 'ETF') return 'fund';
  if (String(row?.sic ?? '').trim() === SPAC_SIC || SPAC_NAME.test(String(row?.name || ''))) return 'spac';
  const dollarVolume = finite(row?.dollarVolume30d);
  if (row?.universeTier === 'extended' && dollarVolume != null && dollarVolume < EXTENDED_MIN_DOLLAR_VOLUME_30D) return 'illiquid';
  return null;
}

// P1625: both legacy compatibility and native orchestration call this boundary.
export function computeFactorRanks(input = {}) {
  // v57.51 F07/V04: Tokyo/Taiwan listings (listingMarket INTL) stay visible in the US list but are not ranked against
  // the US cross-section — a different session calendar and currency are not one comparison population.
  const isIntl = (row) => [row?.market, row?.listingMarket, row?.instrumentRef?.market].some((value) => String(value || '').toUpperCase() === 'INTL') || /\.(T|TWO?)$/i.test(String(row?.sym || row?.symbol || ''));
  const excludedRows = [];
  const populationExclusions = { fund: 0, spac: 0, illiquid: 0, foreign: 0 };
  const rows = (Array.isArray(input.rows) ? input.rows : []).filter((row) => {
    // 2026-10-17 audit: a Tokyo/Taiwan row left the ranking with no row and no reason, so the page counted it as
    // '점수 계산 불가'. It now carries its exclusion like a fund or a SPAC.
    const reason = isIntl(row) ? 'foreign' : rankingPopulationExclusion(row);
    if (!reason) return true;
    populationExclusions[reason] += 1;
    const sym = String(row?.sym || row?.symbol || '').trim().toUpperCase();
    if (sym) excludedRows.push(Object.freeze({ sym, rank: null, quantSignal: null, _compositeZ: null, factorScores: Object.freeze({}), missingFactors: Object.freeze([]), rankingEligibility: 'population-excluded', populationExclusion: reason, allowedUse: FACTOR_RANKS_ALLOWED_USE, decisionEligible: false }));
    return false;
  });
  const exclusionSummary = Object.freeze({ ...populationExclusions, extendedMinDollarVolume30d: EXTENDED_MIN_DOLLAR_VOLUME_30D });
  const markets = [...new Set(rows.map(screenerMarket).filter(Boolean))];
  if (markets.length <= 1) {
    const result = computeFactorRanksForPopulation({ ...input, rows });
    const market = markets[0] || 'US';
    return Object.freeze({ ...result, populationPolicy: MARKET_POPULATION_POLICY, populationMarket: market, populationExclusions: exclusionSummary, byMarket: Object.freeze({ [market]: result }), rows: Object.freeze([...result.rows, ...excludedRows]) });
  }
  const byMarket = Object.fromEntries(markets.map(market => {
    const result = computeFactorRanksForPopulation({ ...input, rows: rows.filter(row => screenerMarket(row) === market), previousRanks: Array.isArray(input.previousRanks) ? input.previousRanks.filter(row => screenerMarket(row) === market) : null });
    return [market, result];
  }));
  const primary = byMarket.US || Object.values(byMarket)[0];
  const available = Object.values(byMarket).some(result => result.available);
  return Object.freeze({
    ...primary, available,
    populationPolicy: MARKET_POPULATION_POLICY, populationMarket: null, populationExclusions: exclusionSummary,
    byMarket: Object.freeze(byMarket),
    ranked: Object.values(byMarket).reduce((sum, result) => sum + (result.ranked || 0), 0),
    inputAudit: Object.freeze({ ...primary.inputAudit, inputRows: rows.length, eligibleRows: Object.values(byMarket).reduce((sum, result) => sum + (result.inputAudit?.eligibleRows || 0), 0) }),
    rows: Object.freeze([...markets.flatMap(market => byMarket[market].rows.map(row => ({ ...row, rankingMarket: market, populationPolicy: MARKET_POPULATION_POLICY }))), ...excludedRows])
  });
}
