import { isDecisionQuality, isValidRightsId, normalizeAllowedUse, hasObservedPast, parseEvidenceTime } from './contracts/evidence.js';
import { canonicalSourceTier, isDecisionEligibleSourceKind } from './contracts/source-kind.js';
import { readPortfolioAssumptions } from './portfolio-assumptions.js';

// Native runtime readers.  These readers are deliberately kept in the data
// layer so route providers do not depend on the legacy compatibility facade.
// The legacy shell still owns the mutable runtime globals, but the native data
// contract now has one explicit, read-only boundary for every route slice.

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// P1176 (22 PFR01): Number(null) === 0, so a numeric coercion here turns "no target was
// entered" into "the target is 0" — which then renders as $0.00 and a -100% potential
// return. A price target and a target weight are different types: an absent price target
// is unset, while an explicit 0% weight is a real value.
function optionalNumber(value) {
  if (value == null || value === '') return null;
  return finite(Number(value));
}

function optionalPrice(value) {
  const number = optionalNumber(value);
  return number != null && number > 0 ? number : null;
}

function observedAt(row = {}) {
  return row.observedAt || row.timestamp || row.lastUpdated
    || (String(row.source || '').startsWith('snapshot:') ? row.ts : null)
    || null;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function parseTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function latestIso(values = []) {
  const timestamps = values.map(parseTime).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function oldestIso(values = []) {
  const timestamps = values.map(parseTime).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
}

function lastSeriesObservedAt(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[rows.length - 1] || {};
  return row.observedAt || row.date || row.time || row.timestamp || null;
}

function quoteObservation(root, symbol, nowMs = Date.now()) {
  const row = root?._liveData?.[symbol] || {};
  const hasEnvelope = !!(row.quoteEnvelope && typeof row.quoteEnvelope === 'object');
  // When a producer supplies an envelope, its authority fields are read only
  // from that envelope. A raw row may be accepted as a legacy envelope only
  // when it carries the same explicit fields; source labels never fill them.
  const envelope = hasEnvelope ? row.quoteEnvelope : row;
  const value = finite(hasEnvelope ? envelope.price : (envelope.price ?? row.price));
  const directionValue = finite(hasEnvelope ? envelope.pct : (envelope.pct ?? row.pct));
  const changeBasis = envelope.changeBasis || envelope.valueBasis || 'unknown';
  const observed = envelope.observedAt || null;
  const sourceKind = canonicalSourceTier(envelope.sourceKind);
  const sourceTier = sourceKind;
  const allowedUse = envelope.allowedUse == null ? null : normalizeAllowedUse(envelope.allowedUse, 'none');
  const allowedUseCeiling = envelope.allowedUseCeiling == null ? null : normalizeAllowedUse(envelope.allowedUseCeiling, 'none');
  const quality = envelope.quality && typeof envelope.quality === 'object' ? envelope.quality : null;
  const rightsId = String(envelope.rightsId || '').trim() || null;
  const rawPrice = finite(row.price);
  const rawIdentityMismatch = hasEnvelope && rawPrice != null && value != null && Math.abs(rawPrice - value) > Math.max(1e-9, Math.abs(value) * 1e-8);
  const freshnessMs = Number(envelope.freshnessMs ?? quality?.maxAgeMs ?? envelope.maxAgeMs);
  const observedMs = parseEvidenceTime(observed);
  const clockNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const freshEnough = Number.isFinite(observedMs) && Number.isFinite(freshnessMs) && freshnessMs > 0 && clockNow - observedMs >= 0 && clockNow - observedMs <= freshnessMs;
  const decisionEligible = !!(value != null
    && !rawIdentityMismatch
    && isDecisionEligibleSourceKind(sourceTier)
    && allowedUse === 'decision'
    && allowedUseCeiling === 'decision'
    && isValidRightsId(rightsId)
    && quality
    && isDecisionQuality(quality, envelope.qualityStatus)
    && hasObservedPast({ observedAt: observed })
    && freshEnough
    && !!envelope.revisionId);
  const revisionId = envelope.revisionId || null;
  const envelopeComplete = value != null && !rawIdentityMismatch && !!sourceTier && !!observed && !!quality && !!allowedUse && !!allowedUseCeiling && !!revisionId;
  return {
    value,
    pct: directionValue,
    directionValue,
    currency: hasEnvelope ? (envelope.currency || null) : (envelope.currency || row.currency || null),
    observedAt: observed,
    fetchedAt: envelope.fetchedAt || null,
    source: hasEnvelope ? (envelope.source || null) : (envelope.source || row.source || 'unavailable'),
    sourceKind: sourceKind || (value == null ? 'unavailable' : null),
    sourceTier,
    allowedUse,
    allowedUseCeiling,
    rightsId,
    quality,
    freshnessMs: Number.isFinite(freshnessMs) ? freshnessMs : null,
    rawIdentityMismatch,
    envelopeComplete,
    decisionEligible,
    revisionId,
    changeBasis,
    directionCompatible: directionValue != null && changeBasis !== 'unknown',
    directionReason: directionValue == null ? 'quote-change-missing' : changeBasis === 'unknown' ? 'quote-change-basis-unknown' : null
  };
}

function coverageObservation(rows, { emptyAllowed = false, fallbackObservedAt = null, source = 'runtime-coverage' } = {}) {
  const values = Array.isArray(rows) ? rows : [];
  if (!values.length && emptyAllowed) {
    return { value: 0, directionValue: 0, observedAt: fallbackObservedAt, source, sourceKind: 'local-state', changeBasis: 'not-applicable-empty', directionCompatible: true };
  }
  const usable = values.filter((row) => finite(row?.price ?? row?.quote?.value ?? row?.pct ?? row?.quote?.pct) != null && (row?.quoteObservedAt || row?.observedAt || row?.quote?.observedAt));
  const bases = new Set(usable.map((row) => row?.changeBasis || row?.quote?.changeBasis || 'unknown'));
  const revisions = new Set(usable.map((row) => row?.revision || row?.quote?.revision).filter(Boolean));
  const observedTimes = usable.map((row) => row?.quoteObservedAt || row?.observedAt || row?.quote?.observedAt);
  const directionValues = usable.map((row) => finite(row?.dailyPct ?? row?.pct ?? row?.quote?.pct ?? row?.quote?.directionValue)).filter((value) => value != null);
  const coverage = values.length ? usable.length / values.length : 0;
  const compatible = coverage >= 0.6 && bases.size === 1 && !bases.has('unknown') && revisions.size <= 1 && directionValues.length >= Math.ceil(values.length * 0.6);
  return {
    value: coverage,
    directionValue: directionValues.length ? directionValues.reduce((sum, value) => sum + value, 0) / directionValues.length : null,
    observedAt: oldestIso(observedTimes),
    fetchedAt: latestIso(usable.map((row) => row?.fetchedAt || row?.quote?.fetchedAt)),
    source,
    sourceKind: coverage ? 'runtime-quote-set' : 'unavailable',
    revision: revisions.size === 1 ? [...revisions][0] : null,
    changeBasis: bases.size === 1 ? [...bases][0] : 'mixed',
    directionCompatible: compatible,
    directionReason: compatible ? null : `coverage=${coverage.toFixed(2)},bases=${[...bases].join('|') || 'none'},revisions=${revisions.size}`
  };
}

function hySpreadObservation(root, snapshot = {}) {
  const evidence = root?._serverMacroEvidence?.hyOAS || root?._serverDataMeta?.hyOAS || {};
  const value = finite(root?._hySpreadBp) ?? finite(snapshot.hySpread);
  const source = evidence.source || root?._hySpreadSource || snapshot._hySpreadSource || 'DATA_SNAPSHOT';
  const sourceKind = evidence.sourceKind
    || (String(source).includes('last-known-good') || value == null ? (value == null ? 'unavailable' : 'T4_REFERENCE') : null);
  return {
    value,
    observedAt: evidence.observedAt || root?._hySpreadDate || snapshot._fieldTs?.hySpread || snapshot._snapshotDate || snapshot._updated || null,
    fetchedAt: evidence.fetchedAt || null,
    source,
    sourceKind,
    allowedUse: value == null ? 'none' : evidence.allowedUse || 'reference'
  };
}

function fearGreedObservation(root, snapshot = {}) {
  let canonical = null;
  try { canonical = root?.AIO?.getCanonicalMetric?.('fg') || null; } catch (_) {}
  if (finite(canonical?.value) != null) return {
    value: canonical.value,
    observedAt: canonical.asOf || canonical.observedAt || null,
    fetchedAt: canonical.fetchedAt || null,
    source: canonical.source || canonical.sourceLabel || 'canonical:fear-greed',
    sourceKind: canonical.sourceKind || 'reference',
    allowedUse: canonical.decisionUse === true ? 'decision' : 'reference',
    allowedUseCeiling: canonical.allowedUseCeiling || 'reference'
  };
  if (finite(root?._lastFG) != null) {
    const meta = root._lastFGMeta || {};
    return { value: root._lastFG, observedAt: meta.sourceTs || null, fetchedAt: meta.fetchedAt || null,
      source: meta.sourceLabel || 'runtime:fear-greed', sourceKind: meta.sourceKind || 'reference',
      allowedUse: meta.allowedUse || 'reference', allowedUseCeiling: meta.allowedUseCeiling || 'reference' };
  }
  return { value: finite(snapshot.fg), observedAt: snapshot._fieldTs?.fg || snapshot._snapshotDate || snapshot._updated || null,
    fetchedAt: null, source: 'DATA_SNAPSHOT:fear-greed', sourceKind: finite(snapshot.fg) == null ? 'unavailable' : 'snapshot',
    allowedUse: 'reference', allowedUseCeiling: 'reference' };
}

function putCallObservation(root, snapshot = {}) {
  const payload = root?._lastPutCallPayload || {};
  if (finite(payload.totalPutCall) != null) return { value: payload.totalPutCall, observedAt: payload.asOf || payload.tradeDate || null,
    fetchedAt: payload.fetchedAt || null, source: payload.sourceLabel || payload.source || 'CBOE options volume daily', sourceKind: payload.sourceKind || 'T3_PUBLIC_DELAYED' };
  if (finite(root?._putCallRatio) != null) return { value: root._putCallRatio, observedAt: null, fetchedAt: null, source: 'runtime:put-call-ratio', sourceKind: 'reference' };
  return { value: finite(snapshot.pcr), observedAt: snapshot._fieldTs?.pcr || snapshot._snapshotDate || snapshot._updated || null,
    fetchedAt: null, source: 'DATA_SNAPSHOT:put-call', sourceKind: finite(snapshot.pcr) == null ? 'unavailable' : 'snapshot' };
}

const SCREENER_FACTOR_FIELD_IDS = Object.freeze([
  'price.ret1m', 'price.ret3m', 'price.ret6m', 'price.volatility', 'price.rsi14',
  'price.pctSma50', 'price.pctSma200', 'technical.kalmanVelocity',
  'technical.kalmanConfidence', 'technical.vcpScore', 'technical.vcpStage',
  'technical.ema8', 'technical.ema21', 'technical.ema60'
]);
const SCREENER_FUNDAMENTAL_FIELD_IDS = Object.freeze([
  'valuation.pe', 'valuation.pb', 'valuation.evEbitda', 'quality.roe', 'quality.margin', 'quality.revGrowth'
]);

function screenerObservationCoverage(rows, fieldIds, { now = Date.now(), maxAgeMs, minCoverage = 0.8, source, cache } = {}) {
  const values = Array.isArray(rows) ? rows : [];
  const cacheKey = `${fieldIds.join(',')}|${maxAgeMs}|${minCoverage}|${source}`;
  const cached = cache?.get(values)?.get(cacheKey);
  if (cached && now >= cached.at && now < cached.until) return cached.result;
  let validUntil = Infinity;
  const timestamps = new Map();
  const timestamp = (value) => {
    if (!timestamps.has(value)) timestamps.set(value, parseTime(value));
    return timestamps.get(value);
  };
  let observedCount = 0;
  let currentCount = 0;
  let oldest = Infinity;
  let latest = -Infinity;
  for (const row of values) {
    const byId = new Map((Array.isArray(row?.fieldObservations) ? row.fieldObservations : []).map((item) => [item?.fieldId, item]));
    for (const fieldId of fieldIds) {
      const item = byId.get(fieldId);
      if (item?.value == null || item.value === '' || !item?.observedAt) continue;
      const observedMs = timestamp(item.observedAt);
      if (observedMs == null) continue;
      observedCount++;
      if (maxAgeMs != null) {
        // Future observations become current at observedMs; current observations
        // expire just AFTER the inclusive maxAgeMs boundary. No TTL approximation.
        if (observedMs > now) validUntil = Math.min(validUntil, observedMs);
        else if (observedMs + maxAgeMs >= now) validUntil = Math.min(validUntil, observedMs + maxAgeMs + 1);
      }
      if (maxAgeMs != null && !(now - observedMs >= 0 && now - observedMs <= maxAgeMs)) continue;
      currentCount++;
      oldest = Math.min(oldest, observedMs);
      const fetchedMs = timestamp(item.fetchedAt);
      if (fetchedMs != null) latest = Math.max(latest, fetchedMs);
    }
  }
  const expected = values.length * fieldIds.length;
  const presentCoverage = expected ? observedCount / expected : 0;
  const currentCoverage = expected ? currentCount / expected : 0;
  const available = currentCoverage >= minCoverage;
  const result = {
    value: currentCoverage,
    available,
    observedAt: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
    fetchedAt: Number.isFinite(latest) ? new Date(latest).toISOString() : null,
    source: source || 'screener-field-observations',
    sourceKind: available ? 'field-observation-set' : 'partial-field-observation-set',
    reason: available ? null : `currentCoverage=${currentCoverage.toFixed(3)},presentCoverage=${presentCoverage.toFixed(3)},required=${minCoverage.toFixed(3)}`,
    coverage: { current: currentCoverage, present: presentCoverage, expected, currentCount, observedCount }
  };
  if (cache && Array.isArray(rows)) {
    let entries = cache.get(rows);
    if (!entries) cache.set(rows, entries = new Map());
    entries.set(cacheKey, { at: now, until: validUntil, result });
  }
  return result;
}

export function buildRuntimeObservationCatalog({ root = globalThis, state = {}, now = Date.now(), observationCache } = {}) {
  const meta = root?._serverDataMeta || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const catalog = {};
  Object.keys(root?._liveData || {}).forEach((symbol) => { catalog[`market.${symbol}`] = quoteObservation(root, symbol, now); });
  catalog['sentiment.fearGreed'] = fearGreedObservation(root, snapshot);
  catalog['sentiment.putCall'] = putCallObservation(root, snapshot);
  catalog['sentiment.hySpread'] = hySpreadObservation(root, snapshot);
  const breadth = state?.screener?.metadata?.breadth || root?.AIO_ARCH?.getScreenerState?.()?.metadata?.breadth || null;
  for (const market of ['us', 'kr']) {
    const segment = breadth?.segments?.[market] || null;
    catalog[`breadth.${market}`] = {
      value: finite(segment?.coveragePct),
      directionValue: finite(segment?.advanceRatio),
      observedAt: segment?.observedAt || null,
      fetchedAt: state?.screener?.updatedAt || null,
      source: breadth?.source || 'public-data/screener.json',
      sourceKind: segment ? 'server-artifact' : 'unavailable',
      changeBasis: 'same-universe-advance-decline',
      directionCompatible: finite(segment?.advanceRatio) != null
    };
  }
  const historyRows = Array.isArray(root?._aioHistory) ? root._aioHistory : Array.isArray(root?._historyData) ? root._historyData : [];
  catalog['breadth.history'] = {
    value: historyRows.filter((row) => finite(row?.breadth50) != null || finite(row?.advanceDecline) != null).length,
    observedAt: lastSeriesObservedAt(historyRows),
    source: 'public-data/history.json',
    sourceKind: 'server-history'
  };
  const newsItems = state?.news?.items || root?._allNewsItems || [];
  catalog['news.completedCycle'] = {
    value: Array.isArray(newsItems) ? newsItems.length : 0,
    observedAt: meta.newsCycleEnd || null,
    fetchedAt: meta.generatedAt || null,
    source: 'public-data/data.json:news',
    sourceKind: meta.newsCycleEnd ? 'server-artifact' : 'unavailable',
    revision: meta.cycleId || null
  };
  const screenerState = state?.screener || {};
  catalog['screener.snapshot'] = {
    value: Array.isArray(screenerState.rows) ? screenerState.rows.length : 0,
    observedAt: screenerState.metadata?.factorObservedAt || null,
    // R24-03/P1179: `factorObservedAt` is a bar-start timestamp. Publish the basis
    // beside it so a consumer can never read it as a plain observation time.
    observedAtBasis: screenerState.metadata?.factorTimeBasis || null,
    fetchedAt: screenerState.metadata?.asOf || screenerState.updatedAt || null,
    source: screenerState.metadata?.source || 'public-data/screener.json',
    sourceKind: screenerState.status || 'unavailable',
    revision: screenerState.revision || null
  };
  const screenerRows = Array.isArray(screenerState.rows) ? screenerState.rows : [];
  catalog['screener.factorCoverage'] = {
    ...screenerObservationCoverage(screenerRows, SCREENER_FACTOR_FIELD_IDS, { now, cache: observationCache, maxAgeMs: 4 * 86400000, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:factor` }),
    revision: screenerState.revision || null
  };
  catalog['screener.fundamentalCoverage'] = {
    ...screenerObservationCoverage(screenerRows, SCREENER_FUNDAMENTAL_FIELD_IDS, { now, cache: observationCache, maxAgeMs: 180 * 86400000, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:fundamental` }),
    revision: screenerState.revision || null
  };
  catalog['screener.newsCoverage'] = {
    ...screenerObservationCoverage(screenerRows, ['news.latest'], { now, cache: observationCache, maxAgeMs: 2 * 86400000, minCoverage: 0.1, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:news` }),
    revision: screenerState.revision || null
  };
  const ranking = screenerState.metadata?.ranking || {};
  const rankingCurrent = !!ranking.available
    && ranking.inputVersion === screenerState.revision
    && Number(ranking.ranked) >= Math.ceil(screenerRows.length * 0.8)
    && screenerState.lastRun?.snapshotId === screenerState.snapshotId;
  catalog['screener.rankingEpoch'] = {
    value: Number(ranking.ranked) || 0,
    available: rankingCurrent,
    observedAt: screenerState.metadata?.factorObservedAt || null,
    observedAtBasis: screenerState.metadata?.factorTimeBasis || null,
    fetchedAt: screenerState.metadata?.asOf || screenerState.updatedAt || null,
    source: `${ranking.modelVersion || 'factor-ranks'}:${screenerState.lastRun?.engineVersion || 'screen-engine'}`,
    sourceKind: rankingCurrent ? 'derived-current-snapshot' : 'derived-revision-mismatch',
    revision: ranking.inputVersion || null,
    reason: rankingCurrent ? null : `input=${ranking.inputVersion || 'missing'},state=${screenerState.revision || 'missing'},ranked=${Number(ranking.ranked) || 0},snapshot=${screenerState.lastRun?.snapshotId || 'missing'}|${screenerState.snapshotId || 'missing'}`
  };
  const visibleSymbols = [...(root?.document?.querySelectorAll?.('#screener-results-body [data-aio-screener-ticker]') || [])]
    .map((node) => String(node?.dataset?.aioScreenerTicker || '').toUpperCase()).filter(Boolean);
  const visibleQuotes = visibleSymbols.map((symbol) => {
    const quote = quoteObservation(root, symbol, now);
    return { price: quote.value, observedAt: quote.observedAt, fetchedAt: quote.fetchedAt, revisionId: quote.revisionId, changeBasis: quote.changeBasis, dailyPct: quote.directionValue };
  });
  catalog['screener.visibleQuotes'] = coverageObservation(visibleQuotes, { source: 'screener-visible-runtime-quotes' });
  const entity = state?.entity || {};
  const entityQuote = entity.quote || quoteObservation(root, entity.id || root?._currentTickerId || root?._currentTickerSym || '', now);
  catalog['entity.quote'] = {
    value: finite(entityQuote?.value), directionValue: finite(entityQuote?.pct ?? entityQuote?.directionValue),
    observedAt: entityQuote?.observedAt || null, fetchedAt: entityQuote?.fetchedAt || null,
    source: entityQuote?.source || 'unavailable', sourceKind: entityQuote?.sourceKind || 'runtime-quote',
    revisionId: entityQuote?.revisionId || null, changeBasis: entityQuote?.changeBasis || 'unknown',
    directionCompatible: entityQuote?.directionCompatible !== false && !!entityQuote?.changeBasis && entityQuote.changeBasis !== 'unknown'
  };
  const entityHistory = Array.isArray(entity.history) ? entity.history : [];
  catalog['entity.history'] = { value: entityHistory.length, observedAt: lastSeriesObservedAt(entityHistory), source: 'ticker-history', sourceKind: entityHistory.length ? 'runtime-history' : 'unavailable' };
  catalog['technical.history'] = { ...catalog['entity.history'], source: 'technical-ohlcv' };
  const fundamentals = entity.fundamentals || null;
  catalog['entity.fundamental'] = { value: fundamentals?.coverage?.length || (fundamentals ? 1 : 0), observedAt: fundamentals?.observedAt || fundamentals?.filedAt || null, fetchedAt: fundamentals?.fetchedAt || null, source: fundamentals?.source || 'SEC EDGAR', sourceKind: fundamentals ? 'official-regulator' : 'unavailable' };
  const holdings = Array.isArray(state?.portfolio?.holdings) ? state.portfolio.holdings : [];
  catalog['portfolio.quoteCoverage'] = coverageObservation(holdings, { emptyAllowed: true, fallbackObservedAt: state?.portfolio?.updatedAt || meta.generatedAt || null, source: 'portfolio-holding-quotes' });
  const themeItems = Array.isArray(state?.themes?.items) ? state.themes.items : [];
  catalog['themes.quoteCoverage'] = coverageObservation(themeItems, { source: 'theme-universe-quotes' });
  const detailQuotes = Object.values(state?.themes?.selectedDetail?.quotes || {}).map((quote) => ({ quote }));
  catalog['themeDetail.quoteCoverage'] = coverageObservation(detailQuotes, { source: 'theme-detail-quotes' });
  const macroRecord = (key, valueKey = key) => {
    const evidence = root?._serverMacroEvidence?.[key] || {};
    return { value: finite(snapshot[valueKey]), observedAt: evidence.observedAt || null, fetchedAt: evidence.fetchedAt || null, source: evidence.source || snapshot[`_${key}_src`] || 'DATA_SNAPSHOT', sourceKind: evidence.sourceKind || (evidence.source ? null : 'T4_REFERENCE') };
  };
  catalog['macro.cpi'] = macroRecord('cpi');
  catalog['macro.pce'] = macroRecord('pce');
  catalog['macro.employment'] = macroRecord('unemployment');
  catalog['macro.fedRate'] = macroRecord('fedRate');
  return Object.freeze(catalog);
}

function decisionEvidenceForRow(row, nowMs = Date.now()) {
  const candidate = row?.quoteEnvelope && typeof row.quoteEnvelope === 'object' ? row.quoteEnvelope : row;
  if (!candidate || typeof candidate !== 'object') return { evidence: null, ok: false, errors: ['evidence_missing'] };
  const sourceTier = canonicalSourceTier(candidate.sourceKind);
  const allowedUse = candidate.allowedUse == null ? 'none' : normalizeAllowedUse(candidate.allowedUse, 'none');
  const allowedUseCeiling = candidate.allowedUseCeiling == null ? 'none' : normalizeAllowedUse(candidate.allowedUseCeiling, 'none');
  const evidence = {
    ...candidate,
    sourceKind: candidate.sourceKind || '',
    sourceTier,
    rightsId: candidate.rightsId || '',
    allowedUse,
    allowedUseCeiling,
    allowedUseExplicit: candidate.allowedUse != null,
    allowedUseCeilingExplicit: candidate.allowedUseCeiling != null,
    quality: candidate.quality && typeof candidate.quality === 'object' ? candidate.quality : null,
    qualityStatus: candidate.qualityStatus || candidate.quality?.status || null,
    qualityExplicit: candidate.quality != null || candidate.qualityStatus != null,
    authorityExplicit: candidate.sourceKind != null
  };
  const freshnessMs = Number(candidate.freshnessMs ?? candidate.quality?.maxAgeMs ?? candidate.maxAgeMs);
  const observedMs = parseEvidenceTime(evidence.observedAt);
  const age = Number.isFinite(observedMs) ? nowMs - observedMs : NaN;
  const ok = !!(sourceTier && isDecisionEligibleSourceKind(sourceTier)
    && allowedUse === 'decision' && allowedUseCeiling === 'decision'
    && isValidRightsId(evidence.rightsId)
    && isDecisionQuality(evidence.quality, evidence.qualityStatus)
    && hasObservedPast(evidence, nowMs)
    && !!evidence.revisionId
    && Number.isFinite(freshnessMs) && freshnessMs > 0 && Number.isFinite(age) && age >= 0 && age <= freshnessMs
    && Number.isFinite(Number(evidence.value)));
  const errors = [];
  if (!sourceTier) errors.push('source_tier_missing_or_unknown');
  if (!isDecisionEligibleSourceKind(sourceTier)) errors.push('source_tier_not_decision_eligible');
  if (allowedUse !== 'decision') errors.push('allowed_use_not_decision');
  if (allowedUseCeiling !== 'decision') errors.push('allowed_use_ceiling_not_decision');
  if (!isValidRightsId(evidence.rightsId)) errors.push('rights_id_missing_or_invalid');
  if (!isDecisionQuality(evidence.quality, evidence.qualityStatus)) errors.push('quality_missing_or_invalid');
  if (!hasObservedPast(evidence, nowMs)) errors.push('observed_at_missing_or_invalid');
  if (!evidence.revisionId) errors.push('revision_id_missing');
  if (!Number.isFinite(freshnessMs) || freshnessMs <= 0 || !Number.isFinite(age) || age < 0 || age > freshnessMs) errors.push('freshness_sla_missing_or_exceeded');
  if (!Number.isFinite(Number(evidence.value))) errors.push('value_missing_or_invalid');
  return { evidence, ok, errors };
}

function decisionInputs(root, nowMs = Date.now()) {
  let rows = [];
  try { rows = root?.AIO?.getTradingDecisionInputEvidence?.()?.rows || []; } catch (_) {}
  const byId = new Map(rows.map((row) => [row.id, row]));
  const evaluated = new Map();
  const currentRow = (id) => {
    if (!evaluated.has(id)) evaluated.set(id, decisionEvidenceForRow(byId.get(id), nowMs));
    const result = evaluated.get(id);
    return result?.ok ? result.evidence : null;
  };
  const value = (id) => finite(currentRow(id)?.value);
  const input = {
    vix: value('vix-price'),
    vvix: value('vvix-price'),
    dxy: value('dxy-dollar'),
    tnx: value('tnx-yield'),
    oilPrice: value('oil-price'),
    fg: value('fg-sentiment'),
    spxPrice: value('spx-price'),
    spx50ma: null,
    spx200ma: null,
    breadth200: value('breadth200-participation'),
    pcr: value('pcr-putcall'),
    hyBp: value('hy-spread-bp')
  };
  // MAs are derived evidence, not a free decision grant. Only a producer
  // supplied envelope with tier/rights/quality/allowedUse may pass; a bare
  // timestamp and source label is display/reference data.
  const maEvidence = {};
  const maSource = root?._spxMAEvidence && typeof root._spxMAEvidence === 'object' ? root._spxMAEvidence : {};
  for (const [key, period] of [['spx50ma', 50], ['spx200ma', 200]]) {
    const candidate = maSource[key] || maSource[String(period)] || null;
    const checked = decisionEvidenceForRow(candidate, nowMs);
    const maValue = finite(checked.evidence?.value ?? root?._spxMA?.[period]);
    if (checked.ok && maValue != null) {
      input[key] = maValue;
      maEvidence[key] = { ...checked.evidence, value: maValue };
    } else {
      maEvidence[key] = { value: maValue, source: candidate?.source || root?._spxMASource || 'native-runtime-ma', status: 'blocked', allowedUse: 'none', observedAt: candidate?.observedAt || null, blockedReasons: checked.errors };
    }
  }
  const evidenceKeys = {
    vix: 'vix-price', vvix: 'vvix-price', dxy: 'dxy-dollar', tnx: 'tnx-yield',
    oilPrice: 'oil-price', fg: 'fg-sentiment', spxPrice: 'spx-price',
    breadth200: 'breadth200-participation', pcr: 'pcr-putcall', hyBp: 'hy-spread-bp'
  };
  const decisionEvidence = {};
  Object.entries(evidenceKeys).forEach(([key, id]) => {
    const row = byId.get(id);
    const checked = evaluated.get(id) || decisionEvidenceForRow(row, nowMs);
    evaluated.set(id, checked);
    decisionEvidence[key] = row
      ? { value: finite(row.value), source: row.source || 'unknown', sourceKind: checked.evidence?.sourceKind || null, sourceTier: checked.evidence?.sourceTier || null, status: row.status || 'unavailable', allowedUse: checked.ok ? 'decision' : 'none', allowedUseCeiling: checked.evidence?.allowedUseCeiling || null, observedAt: row.observedAt || null, quality: checked.evidence?.quality || null, rightsId: checked.evidence?.rightsId || null, blockedReasons: checked.ok ? [] : checked.errors }
      : { value: null, source: 'unavailable', sourceKind: null, sourceTier: null, status: 'unavailable', allowedUse: 'none', allowedUseCeiling: null, observedAt: null, blockedReasons: ['evidence_missing'] };
  });
  Object.assign(decisionEvidence, maEvidence);
  input.decisionEvidence = decisionEvidence;
  try { input.newsSentimentScore = finite(root?.computeNewsSentimentScore?.()?.score); } catch (_) { input.newsSentimentScore = null; }
  try { input.newsRiskSignals = root?.computeNewsRiskSignals?.() || []; } catch (_) { input.newsRiskSignals = []; }
  return input;
}

export function createRuntimeReaders({ root = globalThis, now = () => Date.now() } = {}) {
  const readLive = () => root?._liveData && typeof root._liveData === 'object' ? root._liveData : {};
  const readSnapshot = () => root?.DATA_SNAPSHOT && typeof root.DATA_SNAPSHOT === 'object' ? root.DATA_SNAPSHOT : {};
  const isoNow = () => new Date(now()).toISOString();

  const readSentiment = () => {
    const live = readLive();
    const snapshot = readSnapshot();
    const fg = fearGreedObservation(root, snapshot);
    const putCall = putCallObservation(root, snapshot);
    const quote = (symbol) => live[symbol] || {};
    const hySpread = hySpreadObservation(root, snapshot);
    const spyRow = live.SPY || {};
    const spyRaw = spyRow.pct;
    const spyChg = spyRaw == null || typeof spyRaw === 'boolean' || (typeof spyRaw === 'string' && !spyRaw.trim()) ? null : finite(Number(spyRaw));
    let tradingScoreTotal = null;
    try {
      const raw = root?.computeTradingScore?.()?.total;
      tradingScoreTotal = raw == null || typeof raw === 'boolean' || (typeof raw === 'string' && !raw.trim()) ? null : Number(raw);
      if (!Number.isFinite(tradingScoreTotal)) tradingScoreTotal = null;
    } catch (_) { tradingScoreTotal = null; }
    return Object.freeze({
      fearGreed: fg.value,
      fearGreedSourceKind: fg.sourceKind,
      fearGreedSource: fg.source,
      fearGreedObservedAt: fg.observedAt,
      fearGreedAllowedUse: fg.allowedUse,
      fearGreedAllowedUseCeiling: fg.allowedUseCeiling,
      vix9d: finite(quote('^VIX9D').price), vix9dObservedAt: observedAt(quote('^VIX9D')),
      vix: finite(quote('^VIX').price), vixObservedAt: observedAt(quote('^VIX')),
      vix3m: finite(quote('^VIX3M').price), vix3mObservedAt: observedAt(quote('^VIX3M')),
      vix6m: finite(quote('^VIX6M').price), vix6mObservedAt: observedAt(quote('^VIX6M')),
      putCall: putCall.value,
      putCallSourceKind: putCall.sourceKind,
      putCallSource: putCall.source,
      putCallObservedAt: putCall.observedAt,
      hySpread: hySpread.value,
      hySpreadSourceKind: hySpread.sourceKind,
      hySpreadSource: hySpread.source,
      hySpreadDate: hySpread.observedAt,
      hySpreadFetchedAt: hySpread.fetchedAt,
      hySpreadAllowedUse: hySpread.allowedUse,
      aaiiBear: finite(snapshot.aaiiBear), aaiiBull: finite(snapshot.aaiiBull),
      aaiiObservedAt: snapshot._fieldTs?.aaii || root?._serverDataMeta?.marketSurveys?.aaii?.observedAt || null,
      spyChg,
      tradingScoreTotal,
      vixHistory: Array.isArray(root?._vixHistory) ? root._vixHistory.slice(-30).map((point) => ({ date: point?.date || null, value: finite(point?.value) })) : [],
      now: isoNow()
    });
  };

  const readMarket = () => {
    const snapshot = readSnapshot();
    const symbols = ['CL=F', 'GC=F', '^TNX', 'DX-Y.NYB', 'KRW=X', 'JPY=X', 'HYG', '^GSPC', '^IXIC', 'SPY', 'QQQ'];
    const quotes = Object.fromEntries(symbols.map((symbol) => [symbol, quoteObservation(root, symbol, now())]));
    const metrics = {};
    ['fedRate', 'cpi', 'coreCpi', 'pce', 'corePce', 'unemployment', 'nfp', 'consConf', 'breadth5sma', 'breadth20sma', 'breadth50sma', 'breadthAdvanceRatio'].forEach((key) => { metrics[key] = finite(snapshot[key]); });
    const observationTimes = Object.values(quotes).map((row) => row.observedAt);
    return Object.freeze({ quotes, metrics, updatedAt: latestIso([snapshot._updated, ...observationTimes]), observationStart: oldestIso(observationTimes), observationEnd: latestIso(observationTimes) });
  };

  const readNews = () => Array.isArray(root?._allNewsItems) ? root._allNewsItems.slice() : [];

  const readEntity = () => {
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const quote = id ? quoteObservation(root, id, now()) : null;
    const snapshot = readSnapshot();
    const pcr = putCallObservation(root, snapshot);
    const optionQuote = (symbol) => quoteObservation(root, symbol, now());
    return Object.freeze({
      id,
      name: id ? String(root?._currentTickerName || id) : null,
      quote,
      history: id ? clone(root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || []) : [],
      // Fundamentals are replaced by the SEC provider in createEntityProvider.
      fundamentals: null,
      options: { vix: optionQuote('^VIX'), pcr, skew: optionQuote('^SKEW') },
      updatedAt: latestIso([quote?.observedAt, lastSeriesObservedAt(id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : []), pcr.observedAt])
    });
  };

  const readPortfolio = () => {
    try {
      const locked = typeof root?.isPortfolioLocked === 'function' ? root.isPortfolioLocked() : false;
      const hasVaultState = typeof root?.getPortfolioState === 'function' || root?._portfolioState != null;
      const hasPositionsFn = typeof root?.getPortfolioData === 'function';
      if (!hasVaultState && !hasPositionsFn) return { holdings: [], holdingsKnown: false, cash: null, cashKnown: false, readState: 'loading', privacy: 'opt-in', status: 'unavailable', updatedAt: null };
      if (locked) return { holdings: [], holdingsKnown: false, cash: null, cashKnown: false, readState: 'locked', privacy: 'opt-in', status: 'locked', updatedAt: null };
      const state = typeof root?.getPortfolioState === 'function' ? clone(root.getPortfolioState()) : clone(root?._portfolioState) || {};
      const storedHoldings = Array.isArray(state?.holdings) ? state.holdings : null;
      const positions = storedHoldings != null ? storedHoldings : typeof root?.getPortfolioData === 'function' ? root.getPortfolioData() : [];
      const live = readLive();
      const holdings = Array.isArray(positions) ? positions.map((position) => {
        const symbol = String(position?.ticker || position?.symbol || position?.sym || '').toUpperCase();
        const shares = Number(position?.qty ?? position?.shares);
        const avgCost = Number(position?.cost ?? position?.avgCost);
        const quote = quoteObservation(root, symbol, now());
        return { symbol, shares: Number.isFinite(shares) ? shares : null, avgCost: Number.isFinite(avgCost) ? avgCost : null, price: quote.value != null && quote.value > 0 ? quote.value : null, dailyPct: quote.pct, quoteObservedAt: quote.observedAt, fetchedAt: quote.fetchedAt, revisionId: quote.revisionId, changeBasis: quote.changeBasis, sourceKind: quote.sourceKind, sourceTier: quote.sourceTier, allowedUse: quote.allowedUse, allowedUseCeiling: quote.allowedUseCeiling, quality: quote.quality, rightsId: quote.rightsId, quoteEnvelopeComplete: quote.envelopeComplete, decisionEligible: quote.decisionEligible, blockedReasons: quote.decisionEligible ? [] : ['quote-envelope-not-decision-eligible'], sector: position?.sector || null, target: optionalPrice(position?.target), targetWeight: optionalNumber(position?.targetWeight), memo: position?.memo || '', addedAt: position?.addedAt || null, updatedAt: position?.updatedAt || null, source: quote.source || 'native-runtime-vault',
          // E3/P1181 (11 P11-02): 통화는 합산의 단위다 — reader가 지우면 downstream의 mixed 판정이
          // 영원히 발화하지 않는다. 시세 통화는 선언 우선·quote 차선으로 보존하고, 원가 통화는
          // 선언만 읽되 없으면 null(USD로 추정하지 않는다).
          currency: String(position?.currency || position?.priceCurrency || quote.currency || '').trim().toUpperCase() || null,
          costCurrency: String(position?.costCurrency || '').trim().toUpperCase() || null };
      }).filter((item) => item.symbol) : [];
      let cash = null;
      let cashKnown = false;
      try {
        const rawCash = root?.localStorage?.getItem?.('aio_portfolio_cash');
        if (rawCash != null && String(rawCash).trim() !== '') {
          const parsedCash = Number(rawCash);
          if (Number.isFinite(parsedCash) && parsedCash >= 0) { cash = parsedCash; cashKnown = true; }
        }
      } catch (_) {}
      if (state?.cash != null && String(state.cash).trim?.() !== '') {
        const parsedStateCash = Number(state.cash);
        if (Number.isFinite(parsedStateCash) && parsedStateCash >= 0) { cash = parsedStateCash; cashKnown = true; }
      }
      // E3/P1188 (11 P11-02): 통화 선언은 입력이다 — 폼이 쓴 선언을 reader가 그대로 넘긴다.
      // 없으면 null이고 시세·티커·locale로 추정하지 않는다.
      const assumptions = readPortfolioAssumptions(root?.localStorage);
      const baseCurrency = assumptions.baseCurrency || (state?.baseCurrency ?? null);
      const cashCurrency = assumptions.cashCurrency || (state?.cashCurrency ?? null);
      // E4/P1191: 원장도 선언 입력이다 — 셸이 Vault 경로로 보관한 선언을 reader가 그대로 넘긴다.
      const ledger = typeof root?.getPortfolioLedger === 'function' ? clone(root.getPortfolioLedger()) : (state?.ledger ?? null);
      // E3/P1194: 선언된 FX leg도 같은 경계를 지난다 — 환산 근거가 reader에서 사라지면 surface는 못 본다.
      const fxLegs = typeof root?.getPortfolioFxLegs === 'function' ? clone(root.getPortfolioFxLegs()) : (state?.fxLegs ?? []);
      return { ...state, baseCurrency, cashCurrency, ledger, fxLegs: Array.isArray(fxLegs) ? fxLegs : [], holdings, holdingsKnown: true, cash, cashKnown, readState: 'ready', totals: state?.totals ?? null, privacy: state?.privacy || 'opt-in', status: holdings.length ? 'current' : 'empty', updatedAt: latestIso([...holdings.map((row) => row.quoteObservedAt), state?.updatedAt]) || null };
    } catch (_) { return { holdings: [], holdingsKnown: false, cash: null, cashKnown: false, readState: 'failed', privacy: 'opt-in', status: 'unavailable', updatedAt: null }; }
  };

  const readAnalysis = () => {
    const live = readLive();
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const history = id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : [];
    const sentiment = readSentiment();
    const market = readMarket();
    const health = typeof root?.AIO?.getMarketHealth === 'function' ? root.AIO.getMarketHealth() : null;
    const technicalHealth = health || (typeof root?.computeMarketHealth === 'function' ? root.computeMarketHealth({ quotes: live, spxMA: root?._spxMA || {}, spxATH: root?._spxATH }) : null);
    return Object.freeze({ inputVersion: readSnapshot()._updated || readSnapshot()._snapshotDate || 'native-runtime', technical: { symbol: id, ohlcv: clone(history), health: technicalHealth }, sentiment: { fearGreed: sentiment.fearGreed, vix: sentiment.vix }, market: market.metrics, tradingScoreInputs: decisionInputs(root, now()), newsCount: readNews().length, updatedAt: latestIso([lastSeriesObservedAt(history), sentiment.fearGreedObservedAt, sentiment.vixObservedAt, market.updatedAt]) });
  };

  // Only canonical store rows are structurally shared/immutable. Mutable legacy
  // fallbacks and the standalone catalog builder deliberately remain uncached.
  const observationCache = new WeakMap();
  const readObservationCatalog = (state = {}) => buildRuntimeObservationCatalog({ root, state, now: now(), observationCache: state?.screener?.rows ? observationCache : undefined });
  // P1185/E2 S-B: the standalone legacy screener reader was removed here — no writer ever
  // assigns the global it read, so it could only return empty rows while looking like a
  // second screener source. Screener rows flow through the canonical boundary
  // (`getScreenerRows()` via the compatibility facade) and `readObservationCatalog`.
  // (The retired symbol names are deliberately not repeated in this comment: the gate
  // asserts their absence in this file, and a self-referencing comment would defeat it.)
  return Object.freeze({ readSentiment, readMarket, readNews, readEntity, readPortfolio, readAnalysis, readObservationCatalog });
}
