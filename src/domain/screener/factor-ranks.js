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
export const FACTOR_RANKS_MODEL_VERSION = 'factor-ranks.v4';
export const FACTOR_RANKS_ALLOWED_USE = 'research-relative-ranking-only';

const DAY_MS = 86_400_000;
const FACTOR_FRESHNESS_MS = 4 * DAY_MS;
const FUNDAMENTAL_FRESHNESS_MS = 180 * DAY_MS;
const MIN_CROSS_SECTION_COVERAGE = 0.8;
const MIN_SECTOR_OBSERVATIONS = 6;
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
  if (numeric == null) return 0;
  const z = (numeric - mu) / sd;
  return Number.isFinite(z) ? Math.max(-3, Math.min(3, z)) : 0;
}

function z2pct(z) { return Math.max(0, Math.min(100, Math.round(50 + z * 16.67))); }

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

function freezeRecord(record) { return Object.freeze({ ...record }); }

function sanitizeWeights(weights, factors) {
  const source = weights && typeof weights === 'object' ? weights : DEFAULT_WEIGHTS;
  const applied = {};
  factors.forEach(({ key }) => {
    const value = finite(Number(source[key]));
    applied[key] = value != null && value > 0 ? value : 0;
  });
  let total = Object.values(applied).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) {
    factors.forEach(({ key }) => { applied[key] = 1; });
    total = factors.length;
  }
  return Object.fromEntries(Object.entries(applied).map(([key, value]) => [key, value / total]));
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

function emptyResult({ inputVersion, regimeLabel, weights, reason = 'fewer than five eligible rows', inputAudit = {}, factorCoverage = {} } = {}) {
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
    inactiveFactorReasons: Object.freeze({}),
    factorCoverage: Object.freeze({ ...factorCoverage }),
    confidence: 0,
    compositeConfidence: 0,
    confidenceMeaning: '입력 커버리지·표본 안정성 진단값이며 미래 수익률 확률이 아님',
    inputAudit: freezeRecord({ inputRows: 0, eligibleRows: 0, validCoreRows: 0, invalidCoreRows: 0, duplicateRows: 0, missingIdentityRows: 0, reason, ...inputAudit }),
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
  topPct = 20
} = {}) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const seenSymbols = new Set();
  let duplicateRows = 0;
  let missingIdentityRows = 0;
  let invalidCoreRows = 0;
  const items = inputRows.filter((row) => {
    if (!row || (typeof row.ret3m !== 'number' && typeof row.ret1m !== 'number')) return false;
    const symbol = String(row.sym || row.symbol || '').trim().toUpperCase();
    if (!symbol) { missingIdentityRows += 1; return false; }
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
      inputAudit: { inputRows: inputRows.length, eligibleRows: items.length, validCoreRows, invalidCoreRows, duplicateRows, missingIdentityRows }
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
    _factorValues: Object.fromEntries(candidateFactors.map((factor) => {
      const dateUsable = factor.key === 'size' ? isFreshPast(row._mcapObservedAt, now, FACTOR_FRESHNESS_MS)
        : ['value', 'quality'].includes(factor.key) ? isFreshPast(row._fundamentalObservedAt, now, FUNDAMENTAL_FRESHNESS_MS)
          : true;
      return [factor.key, dateUsable ? factor.fn(row) : null];
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
    factorCoverage[factor.key] = freezeRecord({
      observations: observed,
      eligibleRows: items.length,
      coveragePct: Math.round(coverage * 1000) / 10,
      minCoveragePct: MIN_CROSS_SECTION_COVERAGE * 100,
      active: coverage >= MIN_CROSS_SECTION_COVERAGE,
      status: coverage >= MIN_CROSS_SECTION_COVERAGE ? 'active-candidate' : 'coverage-below-threshold'
    });
  });

  const mcapCurrentCount = working.filter((row) => sizeRaw(row) != null && isFreshPast(row._mcapObservedAt, now, FACTOR_FRESHNESS_MS)).length;
  const sizeActive = mcapCurrentCount >= Math.ceil(items.length * MIN_CROSS_SECTION_COVERAGE) && factorCoverage.size.coveragePct >= MIN_CROSS_SECTION_COVERAGE * 100;
  const fundamentalCurrentCount = working.filter((row) => {
    const hasInput = valueRaw(row) != null || qualityRaw(row) != null;
    return hasInput && isFreshPast(row._fundamentalObservedAt, now, FUNDAMENTAL_FRESHNESS_MS);
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
  if (!FACTORS.length) {
    return emptyResult({
      inputVersion,
      regimeLabel,
      weights,
      reason: 'no factor meets the minimum cross-sectional coverage threshold',
      factorCoverage,
      inputAudit: { inputRows: inputRows.length, eligibleRows: items.length, validCoreRows, invalidCoreRows, duplicateRows, missingIdentityRows }
    });
  }

  const activeWeights = weights && typeof weights === 'object' ? { ...weights } : { ...DEFAULT_WEIGHTS };
  const appliedFactorWeights = sanitizeWeights(activeWeights, FACTORS);
  const inactiveFactorReasons = {
    momentum: factorCoverage.momentum.active ? null : `모멘텀 유효값 커버리지 80% 미만 (${factorCoverage.momentum.coveragePct.toFixed(1)}%)`,
    trend: factorCoverage.trend.active ? null : `추세 유효값 커버리지 80% 미만 (${factorCoverage.trend.coveragePct.toFixed(1)}%)`,
    lowvol: factorCoverage.lowvol.active ? null : `변동성 유효값 커버리지 80% 미만 (${factorCoverage.lowvol.coveragePct.toFixed(1)}%)`,
    size: sizeActive ? null : '시가총액 관측시각·80% 커버리지 미확보',
    value: valueActive ? null : `재무 관측시각·180일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    quality: qualityActive ? null : `재무 관측시각·180일 신선도 또는 유효값 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`,
    kalman: factorCoverage.kalman.active ? null : `칼만 유효값 커버리지 80% 미만 (${factorCoverage.kalman.coveragePct.toFixed(1)}%)`
  };
  // Preserve the established reason text when only the freshness gate is responsible. Existing
  // parity fixtures and UI consumers use these two exact messages.
  if (!fundamentalCurrent) {
    const reason = `재무 관측시각·180일 신선도 커버리지 80% 미만 (${fundamentalCurrentPct.toFixed(1)}%; 산출물 ${Number(fundamentalCoveragePct || 0).toFixed(1)}%)`;
    inactiveFactorReasons.value = reason;
    inactiveFactorReasons.quality = reason;
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
    let composite = 0;
    let observedWeight = 0;
    const factorScores = {};
    const missingFactors = [];
    FACTORS.forEach((factor) => {
      const observed = finite(row._factorValues[factor.key]) != null;
      const z = finite(row['_z_' + factor.key]) || 0;
      const weight = appliedFactorWeights[factor.key] || 0;
      composite += z * weight;
      if (observed) observedWeight += weight;
      else missingFactors.push(factor.key);
      factorScores[factor.key] = observed ? z2pct(z) : null;
    });
    // Absent contributions add zero to the composite, but have no displayed score.
    // Coverage records the imputation; it is not a probability of future returns.
    row._compositeZ = composite;
    row.factorScores = Object.freeze(factorScores);
    row.factorCoverage = FACTORS.length ? observedWeight : 0;
    row.missingFactors = Object.freeze(missingFactors);
    const sectorGroup = bySector.get(row._sectorKey) || [];
    const rowSectorConfidence = row._sectorKey === UNKNOWN_SECTOR ? 0 : Math.min(1, sectorGroup.length / MIN_SECTOR_OBSERVATIONS);
    row.confidence = Math.max(0, Math.min(1, 0.55 * row.factorCoverage + 0.25 * crossSectionConfidence + 0.20 * rowSectorConfidence));
    totalCompositeConfidence += row.confidence;
  });

  const sorted = working.slice().sort((a, b) => a._compositeZ - b._compositeZ);
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
      rank: row.rank,
      quantSignal: row.quantSignal,
      factorCoverage: Math.round(row.factorCoverage * 1000) / 1000,
      missingFactors: row.missingFactors,
      confidence: Math.round(row.confidence * 1000) / 1000,
      allowedUse: FACTOR_RANKS_ALLOWED_USE,
      decisionEligible: false
    };
    FACTORS.forEach((factor) => { out['_z_' + factor.key] = row['_z_' + factor.key]; });
    return Object.freeze(out);
  });

  const maxAbsMeanCompositeZ = Math.max(0, ...sectorCounts.filter((entry) => entry.known).map((entry) => {
    const group = bySector.get(entry.sector);
    return Math.abs(avg(group.map((row) => row._compositeZ)) || 0);
  }));
  const activeCoverage = FACTORS.length ? avg(FACTORS.map((factor) => factorCoverage[factor.key].coveragePct / 100)) : 0;
  const compositeConfidence = Math.max(0, Math.min(1, 0.55 * (activeCoverage || 0) + 0.25 * crossSectionConfidence + 0.20 * sectorConfidence));
  const outlierTotal = Object.values(outlierByFactor).reduce((sum, entry) => sum + entry.count, 0);
  const qualityStatus = compositeConfidence >= 0.8 && invalidCoreRows === 0 && duplicateRows === 0 && outlierTotal === 0 ? 'ready' : 'partial';
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
    inactiveFactorReasons: Object.freeze(inactiveFactorReasons),
    factorCoverage: Object.freeze({ ...factorCoverage }),
    confidence: Math.round((totalCompositeConfidence / Math.max(1, n)) * 1000) / 1000,
    compositeConfidence: Math.round(compositeConfidence * 1000) / 1000,
    confidenceMeaning: '입력 커버리지·표본 안정성 진단값이며 미래 수익률 확률이 아님',
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
