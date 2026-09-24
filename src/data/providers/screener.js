import { buildFieldReadiness, createInstrumentRef, LIVE_QUOTE_DERIVED_ROW_KEYS, SCREENER_FIELD_REGISTRY, stableHashAsync, validateInstrumentRef } from '../contracts/screener.js';
import { INSTRUMENT_REGISTRY, analysisEligibilityFor, resolveInstrument } from '../../domain/market/instrument-registry.js';
import { canonicalSourceTier, isDecisionEligibleSourceKind } from '../contracts/source-kind.js';
import { isValidRightsId } from '../contracts/evidence.js';
import { createPublicationPolicy, evaluatePublicationSet } from './publication-set.js';
import { evaluateQuoteContract } from './quote-contract.js';

// P1173 (17 작업 단위 4 / O07): this consumer declares which input set it can combine. The three
// artifacts may be refreshed on their own cadence, so equal generation dates are not required; what is
// declared is which schema/model versions this consumer knows how to read, and that the universe size
// the screener artifact was enriched against must be the universe that arrived with it.
const SCREENER_PUBLICATION_POLICY = createPublicationPolicy({
  members: ['screener', 'universe', 'model-validation'],
  supportedSchemas: { universe: ['v53.4'], 'model-validation': ['model-validation.v1'] },
  comparableFields: { universeSize: ['screener', 'universe'] }
});

// P1177 (QA-SCR-01): the snapshot identity is the **observation set that arrived** (artifact + universe),
// not the live overlay. A quote tick must not mint a new ranked snapshot, or a stored user run is
// replaced by background price churn (the P1074 invariant). The canonical live key list lives in the
// contract layer so the screen engine's calculation identity derives from the same source.
// P1180/R24-04: `fieldReadiness`/`fieldObservations` are excluded as well — they re-embed live
// values (price.close, valuation.marketCap) and time-derived statuses, so hashing them moved the
// observation identity whenever a live mcap ticked. Derived state is not an arrived observation.
export function snapshotIdentityRows(rows = []) {
  return rows.map((row) => {
    const identity = { ...row };
    for (const key of LIVE_QUOTE_DERIVED_ROW_KEYS) delete identity[key];
    delete identity.fieldReadiness;
    delete identity.fieldObservations;
    return identity;
  });
}

// ARX-10/ARX-16 + SCR-OS-01: the native screener reads the published artifact and generated identity
// universe through the platform HTTP gateway. Legacy SCREENER_DB remains only as a
// compatibility enrichment/fallback for non-route consumers that have not yet migrated.
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrNull(value) {
  return value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim()) ? null : finite(Number(value));
}

function isoTimestamp(value) {
  // Published screener timestamps are ISO strings. Reject numeric legacy `newsTs` values so an
  // old collection-time epoch cannot be promoted back into a fresh observation during migration.
  if (!(typeof value === 'string' && value.trim()) && !(value instanceof Date)) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function asOfIsFresh(asOf, now, maxAgeDays) {
  const timestamp = asOf ? new Date(asOf).getTime() : 0;
  return timestamp > 0 && now >= timestamp && (now - timestamp) / 86400000 <= maxAgeDays;
}

const RIGHTS_VALUES = new Set(['VERIFIED', 'REVIEW_REQUIRED', 'UNKNOWN', 'BLOCKED', 'DENIED']);

function normalizeRights(value) {
  const normalized = String(value == null ? '' : value).trim().toUpperCase();
  return RIGHTS_VALUES.has(normalized) ? normalized : null;
}

function readRightsOverride(definition, factor, artifact) {
  const fieldId = definition.fieldId;
  const rowKey = definition.rowKey;
  const sources = [factor, artifact, artifact?.metadata].filter((value) => value && typeof value === 'object');
  for (const source of sources) {
    for (const mapKey of ['rightsByField', 'fieldRights', 'rights']) {
      const map = source[mapKey];
      if (!map || typeof map !== 'object') continue;
      const explicit = normalizeRights(map[fieldId] ?? map[rowKey]);
      if (explicit) return explicit;
    }
    for (const key of [`${fieldId}Rights`, `${fieldId}RightsId`, `${rowKey}Rights`, `${rowKey}RightsId`]) {
      const explicit = normalizeRights(source[key]);
      if (explicit) return explicit;
    }
  }
  return null;
}

function isOfficialFilingSource(source) {
  return /(?:sec\s+edgar|\bdart(?:\b|-)|\bofficial\b)/i.test(String(source || ''));
}

// Rights are a usage/entitlement gate, not a claim that a delayed public feed
// is exchange-authoritative.  Resolve them from artifact metadata first and
// use conservative source-family defaults only where the producer has no
// per-field map yet. The free Yahoo EOD path retains REVIEW_REQUIRED metadata;
// its research availability is evaluated separately from rights certification.
function resolveFieldRights(definition, factor, artifact, row) {
  const explicit = readRightsOverride(definition, factor, artifact);
  if (explicit) return explicit;
  const fieldId = definition.fieldId;
  if (fieldId.startsWith('identity.')) return 'VERIFIED';
  if (fieldId.startsWith('fundamental.') || fieldId.startsWith('quality.')) {
    const source = String(factor.fundamentalSource || row._fundamentalSource || '').toLowerCase();
    if (isOfficialFilingSource(source)) return 'VERIFIED';
    if (source) return 'REVIEW_REQUIRED';
    return 'UNKNOWN';
  }
  if (fieldId === 'valuation.marketCap') return row._mcapSource ? 'REVIEW_REQUIRED' : 'UNKNOWN';
  if (fieldId.startsWith('valuation.')) {
    const source = String(factor.fundamentalSource || row._fundamentalSource || '').toLowerCase();
    if (isOfficialFilingSource(source)) return 'VERIFIED';
    if (source) return 'REVIEW_REQUIRED';
    return 'UNKNOWN';
  }
  if (fieldId.startsWith('price.') || fieldId.startsWith('technical.')) return 'REVIEW_REQUIRED';
  if (fieldId.startsWith('news.')) return row.newsSource ? 'REVIEW_REQUIRED' : 'UNKNOWN';
  if (fieldId.startsWith('breadth.') || fieldId.startsWith('regime.')) return 'VERIFIED';
  return 'UNKNOWN';
}

function resolveFieldSourceKind(definition, factor, artifact, row) {
  const fieldId = definition.fieldId;
  if (fieldId === 'price.close' && row.priceSourceKind) return row.priceSourceKind;
  const explicitMap = factor?.sourceKindByField || artifact?.sourceKindByField || artifact?.metadata?.sourceKindByField;
  const explicit = explicitMap && typeof explicitMap === 'object' ? explicitMap[fieldId] : null;
  if (['T1_OFFICIAL', 'T2_LICENSED', 'T3_PUBLIC_DELAYED', 'T4_REFERENCE'].includes(explicit)) return explicit;
  if (fieldId.startsWith('identity.') || fieldId.startsWith('breadth.') || fieldId.startsWith('regime.')) return 'T4_REFERENCE';
  if (fieldId.startsWith('fundamental.') || fieldId.startsWith('quality.') || fieldId.startsWith('valuation.')) {
    const source = String(factor.fundamentalSource || row._fundamentalSource || '').toLowerCase();
    if (isOfficialFilingSource(source)) return 'T1_OFFICIAL';
  }
  return 'T3_PUBLIC_DELAYED';
}

function liveEnrichment(symbol, liveData) {
  const live = liveData?.[symbol] || {};
  const hasEnvelope = !!(live.quoteEnvelope && typeof live.quoteEnvelope === 'object');
  const envelope = hasEnvelope ? live.quoteEnvelope : live;
  const quality = envelope.quality && typeof envelope.quality === 'object' ? envelope.quality : null;
  // Once a producer supplies an envelope, all value and identity fields come
  // from that envelope. A raw sibling value is not a permissible fallback for
  // an otherwise complete grant.
  const price = finite(hasEnvelope ? envelope.price : live.price);
  const marketCap = finite(hasEnvelope ? envelope.marketCap : live.marketCap);
  const observedAt = envelope.observedAt || null;
  const fetchedAt = envelope.fetchedAt || null;
  const source = hasEnvelope ? (envelope.source || null) : (envelope.source || live.source || 'runtime-quote');
  // A raw/live/current label, truth object, or source string cannot produce a
  // canonical authority tier. Only the explicit envelope fields below count.
  const sourceKind = canonicalSourceTier(envelope.sourceKind);
  const allowedUse = envelope.allowedUse == null ? null : envelope.allowedUse;
  const allowedUseCeiling = envelope.allowedUseCeiling == null ? null : envelope.allowedUseCeiling;
  const explicitDecisionUse = allowedUse === 'decision' || allowedUse === 'trading';
  const qualityDecisionUse = !!(quality && quality.decisionUse === true && quality.stale !== true && !['stale', 'blocked', 'missing', 'unavailable'].includes(String(quality.status || '').toLowerCase()));
  const revisionId = envelope.revisionId || null;
  const rightsId = envelope.rightsId || null;
  const rawIdentityMismatch = hasEnvelope && live.price != null && price != null && Math.abs(Number(live.price) - price) > Math.max(1e-9, Math.abs(price) * 1e-8);
  return {
    price,
    mcap: marketCap != null ? marketCap / 1e9 : null,
    marketCap,
    currency: hasEnvelope ? (envelope.currency || null) : (live.currency || envelope.currency || null),
    marketCapCurrency: hasEnvelope ? (envelope.marketCapCurrency || envelope.currency || null) : (live.marketCapCurrency || live.currency || envelope.currency || null),
    priceObservedAt: observedAt,
    priceFetchedAt: fetchedAt,
    priceSource: source,
    priceSourceKind: sourceKind,
    priceAllowedUse: explicitDecisionUse,
    priceAllowedUseCeiling: allowedUseCeiling,
    priceQualityDecisionUse: qualityDecisionUse,
    priceQuality: quality,
    priceRightsId: rightsId,
    priceEnvelopeComplete: !!(price != null && !rawIdentityMismatch && sourceKind && allowedUse && allowedUseCeiling && observedAt && quality && revisionId),
    priceRevision: revisionId,
    _mcapObservedAt: observedAt,
    _mcapFetchedAt: fetchedAt,
    _mcapSource: source,
    _mcapSourceKind: sourceKind,
    _mcapAllowedUse: allowedUse,
    _mcapQuality: quality,
    _mcapRevision: revisionId,
    rawIdentityMismatch
  };
}

export function createScreenerProvider({
  httpClient,
  url = './public-data/screener.json',
  universeUrl = './public-data/screener-universe.json',
  modelValidationUrl = './public-data/model-validation-status.json',
  readLiveData = () => ({}),
  clock = { now: () => Date.now(), iso: () => new Date().toISOString() },
  yieldImpl = () => typeof globalThis.scheduler?.yield === 'function'
    ? globalThis.scheduler.yield()
    : new Promise(resolve => setTimeout(resolve, 0))
} = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') throw new Error('SCREENER_HTTP_CLIENT_INVALID');
  const ARTIFACT_STALE_AFTER_DAYS = 2;
  const FACTOR_STALE_AFTER_DAYS = 4;
  let cachedResponses = null;
  let fetchGeneration = 0;
  let pendingResponses = null;
  // P1173: the previous read's member revisions, so a set assembled across publication transitions can
  // be recognised instead of being served as one complete observation.
  let previousPublicationSet = null;

  return Object.freeze({
    async readCurrent({ signal, refresh = true } = {}) {
      const checkAborted = () => { if (signal?.aborted) throw new DOMException('Screener read cancelled', 'AbortError'); };
      checkAborted();
      let responses = !refresh && pendingResponses ? await pendingResponses : cachedResponses;
      if (refresh || !responses) {
        const generation = ++fetchGeneration;
        const pending = Promise.all([
          httpClient.requestJson(url, { cache: 'no-store', signal }),
          httpClient.requestJson(universeUrl, { cache: 'no-store', signal }),
          httpClient.requestJson(modelValidationUrl, { cache: 'no-store', signal })
        ]);
        pendingResponses = pending;
        try { responses = await pending; }
        finally { if (pendingResponses === pending) pendingResponses = null; }
        if (generation === fetchGeneration && !signal?.aborted) cachedResponses = responses;
      }
      const [artifactResponse, universeResponse, modelValidationResponse] = responses;
      checkAborted();
      const now = typeof clock.now === 'function' ? clock.now() : Date.now();
      const LIVE_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
      const receivedArtifact = artifactResponse.ok && artifactResponse.data && typeof artifactResponse.data === 'object'
        ? artifactResponse.data
        : null;
      const universePayload = universeResponse.ok && universeResponse.data && typeof universeResponse.data === 'object'
        ? universeResponse.data
        : null;
      const modelValidation = modelValidationResponse?.ok && modelValidationResponse.data && typeof modelValidationResponse.data === 'object'
        && ['BLOCKED', 'PARTIAL', 'READY'].includes(String(modelValidationResponse.data.status || '').toUpperCase())
        ? modelValidationResponse.data
        : null;
      // P1173: an unrecognized status used to become `null` silently, so "the file is missing" and
      // "the file says something this consumer cannot read" produced the same output. Keep the reason.
      const modelValidationRejected = modelValidationResponse?.ok && modelValidationResponse.data && typeof modelValidationResponse.data === 'object'
        && !['BLOCKED', 'PARTIAL', 'READY'].includes(String(modelValidationResponse.data.status || '').toUpperCase())
        ? `model-validation-status-unrecognized:${String(modelValidationResponse.data.status || '(missing)')}`
        : null;
      const universeMeta = universePayload?.meta && typeof universePayload.meta === 'object' ? universePayload.meta : {};
      const universeLastBulkUpdate = universeMeta.lastBulkUpdate || null;
      const universeStaleAfterDays = numberOrNull(universeMeta.staleAfterDays) ?? 30;
      const universeCurrentness = String(universeMeta.currentness || '').trim().toUpperCase() || 'UNKNOWN';
      const universeFreshnessStatus = Array.isArray(universePayload?.universe)
        ? (universeCurrentness === 'STALE' || !asOfIsFresh(universeLastBulkUpdate, now, universeStaleAfterDays) ? 'stale' : universeCurrentness === 'CURRENT' ? 'current' : 'unknown')
        : 'unknown';
      const unavailable = (revision = null, detail = null) => Object.freeze({
        rows: [],
        filters: {},
        metadata: { detail, artifactRows: 0, universeRows: 0 },
        revision,
        status: 'unavailable',
        updatedAt: null
      });

      const artifactValid = !!receivedArtifact?.data && typeof receivedArtifact.data === 'object' && !Array.isArray(receivedArtifact.data);
      if (!artifactValid && !Array.isArray(universePayload?.universe)) return unavailable(null, artifactResponse.error || 'SCREENER_ARTIFACT_INVALID');
      // Preserve identities and permitted reference fields during stale/partial
      // refreshes. Per-field readiness, not a file timestamp, gates calculations.
      const artifact = artifactValid ? receivedArtifact : { data: {} };
      const artifactFresh = artifactValid && asOfIsFresh(artifact.asOf, now, ARTIFACT_STALE_AFTER_DAYS);
      const factorsFresh = artifactValid && asOfIsFresh(artifact.factorObservedAt, now, FACTOR_STALE_AFTER_DAYS);
      const warnings = [
        ...(!artifactValid ? ['SCREENER_ARTIFACT_INVALID'] : []),
        ...(artifactValid && !artifactFresh ? ['SCREENER_ARTIFACT_STALE'] : []),
        ...(artifactValid && !factorsFresh ? ['SCREENER_FACTOR_OBSERVATION_STALE'] : [])
      ];

      const universe = universeResponse.ok && Array.isArray(universeResponse.data?.universe)
        ? universeResponse.data.universe
        : [];
      const universeBySymbol = new Map(universe.map((row) => [String(row?.sym || '').toUpperCase(), row]));
      const symbols = [...new Set([
        ...universe.map((row) => String(row?.sym || '').toUpperCase()).filter(Boolean),
        ...Object.keys(artifact.data).map((symbol) => String(symbol).toUpperCase())
      ])];

      let liveData = {};
      try {
        const candidate = readLiveData?.();
        if (candidate && typeof candidate === 'object') liveData = candidate;
      } catch (_) {
        warnings.push('SCREENER_LIVE_ENRICHMENT_UNAVAILABLE');
      }
      // Capture primitive quote projections before yielding: the legacy map can
      // mutate during a provider turn, but one snapshot must keep one quote cut.
      const liveBySymbol = new Map(symbols.map(symbol => [symbol, liveEnrichment(symbol, liveData)]));
      const rows = [];
      for (const symbol of symbols) {
        const identity = universeBySymbol.get(symbol) || {};
        const factor = artifact.data[symbol] || {};
        const live = liveBySymbol.get(symbol);
        const market = /\.K[QS]$/i.test(symbol) || ['KOSPI', 'KOSDAQ'].includes(String(identity.index || '').toUpperCase()) ? 'KR' : 'US';
        const artifactCurrency = String(factor.currency || identity.currency || '').trim().toUpperCase() || null;
        const liveCurrency = String(live.currency || '').trim().toUpperCase() || null;
        // P1174 (15 D06): 가격·통화·identity·시각은 하나의 quote다. 통화를 잃은 quote는 "충돌이 없으니
        // 호환"이 아니라 **미완전**이며, artifact 통화를 물려받으려면 동일 instrument/listing 보증이 먼저
        // 필요하다. 보증이 없으면 가격을 채택하지 않고 마지막 적격 가격을 참고값으로 남긴다.
        const resolvedIdentity = resolveInstrument({ symbol, market, publishedName: identity.name, registry: INSTRUMENT_REGISTRY });
        const identityProof = resolvedIdentity.verification === 'VERIFIED';
        const quoteContract = evaluateQuoteContract({
          quote: { price: live.price, currency: liveCurrency, observedAt: live.priceObservedAt },
          artifact: { currency: artifactCurrency },
          identityProof
        });
        const currencyCompatible = quoteContract.admissible;
        // P1113: `artifact.factorObservedAt` is a normalized day bucket for the
        // whole artifact, not an observation. Chaining it here let a row without
        // its own timestamp inherit the bucket as its price observation time —
        // the same mixed-vintage shape P1095 closed for history.json. Fail closed.
        const artifactPriceObservedAt = factor.observedAt || null;
        const artifactPriceTime = Date.parse(artifactPriceObservedAt || '');
        const livePriceTime = Date.parse(live.priceObservedAt || '');
        const liveEvidenceEligible = live.priceAllowedUse === true && live.priceQualityDecisionUse === true
          && live.priceAllowedUseCeiling === 'decision'
          && isDecisionEligibleSourceKind(live.priceSourceKind)
          && isValidRightsId(live.priceRightsId)
          && live.priceEnvelopeComplete === true
          && !!live.priceRevision
          && Number.isFinite(livePriceTime) && livePriceTime <= now && now - livePriceTime <= LIVE_QUOTE_MAX_AGE_MS;
        const useLivePrice = currencyCompatible && live.price != null && liveEvidenceEligible
          && (finite(factor.price) == null || !Number.isFinite(artifactPriceTime) || artifactPriceTime > now || livePriceTime > artifactPriceTime);
        const useArtifactPrice = !useLivePrice && finite(factor.price) != null;
        const currency = useLivePrice ? (liveCurrency || quoteContract.currency) : artifactCurrency;
        const marketCapCurrency = String(live.marketCapCurrency || currency || '').trim().toUpperCase() || null;
        const volumeCurrency = String(factor.dollarVolumeCurrency || factor.currency || '').trim().toUpperCase() || null;
        const hasExplicitNewsObservation = Object.prototype.hasOwnProperty.call(factor, 'newsObservedAt');
        const newsObservedAt = hasExplicitNewsObservation ? isoTimestamp(factor.newsObservedAt) : isoTimestamp(factor.newsTs);
        const newsFetchedAt = isoTimestamp(factor.newsFetchedAt);
        const instrumentRef = createInstrumentRef({
          instrumentId: `${market}:${symbol}`,
          symbol,
          market,
          mic: identity.mic || factor.mic || resolvedIdentity.mic || null,
          currency,
          assetType: identity.assetType || factor.assetType || resolvedIdentity.assetType || null,
          validFrom: identity.validFrom,
          validTo: identity.validTo
        });
        const identityValidation = validateInstrumentRef(instrumentRef);
        const baseRow = {
          symbol,
          sym: symbol,
          name: identity.name || '',
          sector: identity.sector || null,
          index: identity.index || null,
          signal: null,
          memo: identity.memo || null,
          source: factor.source || 'screener-artifact',
          sourceKind: factor.sourceKind || null,
          allowedUse: factor.allowedUse || null,
          price: useLivePrice ? live.price : useArtifactPrice ? factor.price : null,
          priceObservedAt: useLivePrice ? live.priceObservedAt : useArtifactPrice ? artifactPriceObservedAt : null,
          priceFetchedAt: useLivePrice ? live.priceFetchedAt : useArtifactPrice ? (factor.fetchedAt || artifact.asOf || null) : null,
          priceSource: useLivePrice ? live.priceSource : useArtifactPrice ? (factor.source || artifact.source || 'screener-artifact') : null,
          priceSourceKind: useLivePrice ? live.priceSourceKind : factor.sourceKind || null,
          priceAllowedUse: useLivePrice ? live.allowedUse : factor.allowedUse || null,
          priceAllowedUseCeiling: useLivePrice ? live.allowedUseCeiling : factor.allowedUseCeiling || null,
          priceQuality: useLivePrice ? live.priceQuality : factor.factorQuality || factor.quality || null,
          priceRightsId: useLivePrice ? live.priceRightsId : factor.rightsId || null,
          factorObservedAt: factor.factorObservedAt || factor.observedAt || null,
          // R24-03/P1179: the producer publishes bar-start, session, timezone, basis and
          // computed time separately (P1170). Dropping them here made every downstream
          // consumer fall back to the bar timestamp, so the fields travel with the row.
          // factorBarStart falls back to the artifact's own bar timestamp — the producer
          // defines both from the same observation; an absent basis stays null (unknown)
          // rather than being assumed.
          factorBarStart: factor.factorBarStart || factor.observedAt || null,
          factorSessionDate: factor.factorSessionDate || null,
          factorSessionTimezone: factor.factorSessionTimezone || null,
          factorTimeBasis: factor.factorTimeBasis || null,
          factorComputedAt: factor.factorComputedAt || null,
          factorSourceKind: factor.factorSourceKind || factor.sourceKind || null,
          factorAllowedUse: factor.factorAllowedUse || factor.allowedUse || null,
          factorQuality: factor.factorQuality || factor.quality || null,
          priceRevision: useLivePrice ? live.priceRevision : useArtifactPrice ? (artifact.asOf || null) : null,
          livePriceRejectedReason: live.price == null ? null : useLivePrice ? null : !currencyCompatible ? (quoteContract.reason || 'currency-conflict') : !liveEvidenceEligible ? 'decision-evidence-ineligible' : 'not-newer-than-artifact',
          // P1174 (15 D06): 미완전 quote는 버리지 않고 진단으로 남긴다 — 통화 없는 가격이 조용히
          // 현재 가격이 되는 대신, 왜 채택되지 않았는지와 값이 여기에 남는다.
          liveQuoteDiagnostic: Object.freeze({
            admissible: quoteContract.admissible,
            reason: quoteContract.reason,
            currencySource: quoteContract.currencySource,
            diagnosticPrice: quoteContract.diagnosticPrice,
            identityProof
          }),
          priceCurrencyConflict: !currencyCompatible,
          pctFrom52wLow: finite(factor.pctFrom52wLow),
          pctFrom52wHigh: finite(factor.pctFrom52wHigh),
          adrPct: finite(factor.adrPct),
          avgVolume30d: finite(factor.avgVolume30d),
          dollarVolume30d: volumeCurrency === 'USD' ? finite(factor.dollarVolume30d) : null,
          lastVolume: finite(factor.lastVolume),
          dollarVolume: volumeCurrency === 'USD' ? finite(factor.dollarVolume) : null,
          ema8: finite(factor.ema8),
          ema21: finite(factor.ema21),
          ema60: finite(factor.ema60),
          mcap: liveEvidenceEligible && marketCapCurrency === 'USD' ? live.mcap : null,
          nativeMarketCap: live.marketCap == null ? null : { value: live.marketCap, currency: marketCapCurrency, observedAt: live._mcapObservedAt, source: live._mcapSource, allowedUse: 'reference-only' },
          _mcapObservedAt: live._mcapObservedAt,
          _mcapFetchedAt: live._mcapFetchedAt,
          _mcapSource: live._mcapSource,
          _mcapSourceKind: live._mcapSourceKind,
          _mcapAllowedUse: live._mcapAllowedUse,
          _mcapQuality: live._mcapQuality,
          _mcapRevision: live._mcapRevision,
          rsi: finite(factor.rsi),
          ret1m: finite(factor.ret1m),
          ret3m: finite(factor.ret3m),
          ret6m: finite(factor.ret6m),
          vol: finite(factor.vol),
          rvol20: finite(factor.rvol20 ?? factor.rvol),
          benchmarkRet: finite(factor.benchmarkRet),
          benchmarkRelativeStrength: finite(factor.benchmarkRelativeStrength),
          pctSma50: finite(factor.pctSma50),
          pctSma200: finite(factor.pctSma200),
          kalmanVel: finite(factor.kalmanVel),
          kalmanPt: finite(factor.kalmanPt),
          kalmanInnovZ: finite(factor.kalmanInnovZ),
          kalmanVelConf: finite(factor.kalmanVelConf),
          kalmanScale: factor.kalmanScale || null,
          vcpScore: finite(factor.vcpScore),
          vcpStage: factor.vcpStage || null,
          vcpPivot: finite(factor.vcpPivot),
          pe: finite(factor.pe),
          pb: finite(factor.pb),
          evEbitda: finite(factor.evEbitda),
          roe: finite(factor.roe),
          margin: finite(factor.margin),
          revGrowth: finite(factor.revGrowth),
          newsMemo: factor.newsMemo || null,
          newsTs: newsObservedAt,
          newsObservedAt: newsObservedAt,
          newsFetchedAt: newsFetchedAt,
          newsSource: 'ticker-news-artifact',
          _fundamentalSource: factor.fundamentalSource || null,
          _fundamentalModel: factor.fundamentalModel || null,
          _fundamentalPeriod: factor.fundamentalPeriod || null,
          _fundamentalObservedAt: factor.fundamentalObservedAt || null,
          _fundamentalSourceKind: factor.fundamentalSourceKind || null,
          _fundamentalAllowedUse: factor.fundamentalAllowedUse || null,
          _fundamentalQuality: factor.fundamentalQuality || null,
          _fundamentalPeriodEnd: factor.fundamentalPeriodEnd || null,
          _fundamentalFiledAt: factor.fundamentalFiledAt || null,
          _fundamentalFetchedAt: factor.fundamentalFetchedAt || null,
          _fundamentalAccession: factor.fundamentalAccession || null,
          _valuationPePrice: finite(factor.pePrice),
          _valuationPePriceBasis: factor.pePriceBasis || null,
          _valuationPbPrice: finite(factor.pbPrice),
          _valuationPbPriceBasis: factor.pbPriceBasis || null,
          _valuationSharesOutstanding: finite(factor.valuationSharesOutstanding),
          _valuationSharesObservedAt: factor.valuationSharesObservedAt || null,
          identityObservedAt: universeLastBulkUpdate || identity.validFrom || null,
          identityFetchedAt: universeMeta.fetchedAt || null,
          identitySource: 'public-data/screener-universe.json',
          observedAt: factor.observedAt || null,
          fetchedAt: factor.fetchedAt || artifact.asOf || null,
          // P1167 (15 D05): 정적 유니버스 producer는 MIC·assetType을 발행하지 않고 시장은 심볼
          // suffix/index에서 추정한다. 그 사실을 조용한 null로 두면 '가격 조회 성공'이 '식별 metadata
          // 확인'으로 읽힌다. 어떤 필수 식별 필드가 미확인인지와 시장 출처를 행에 남긴다 —
          // 값을 발명해 873행을 한꺼번에 추정으로 채우지 않는다(15 D05 설계).
          identityValidation: {
            ok: identityValidation.ok,
            missing: identityValidation.errors,
            marketSource: 'symbol-suffix-inference',
            // P1171 (15 D05): 축별 검증 수준과 유형별 분석 적격성을 분리한다. 미확인 유형을 발행자
            // 비율 모델에 넣지 않는다(ETF는 발행자 재무제표가 없다).
            assetTypeVerification: resolvedIdentity.verificationDetail.assetType,
            micVerification: resolvedIdentity.verificationDetail.mic,
            currencyVerification: resolvedIdentity.verificationDetail.currency,
            registrySource: resolvedIdentity.source,
            analysisEligibility: analysisEligibilityFor(instrumentRef.assetType),
            note: identityValidation.ok ? null : '정적 유니버스와 registry가 발행하지 않은 식별 필드가 있습니다 — 가격 조회 성공은 식별 확인이 아닙니다.'
          },
          instrumentRef
        };
        const rightsByField = Object.fromEntries(SCREENER_FIELD_REGISTRY.fields.map((definition) => [
          definition.fieldId,
          resolveFieldRights(definition, factor, artifact, baseRow)
        ]));
        const sourceKindByField = Object.fromEntries(SCREENER_FIELD_REGISTRY.fields.map((definition) => [
          definition.fieldId,
          resolveFieldSourceKind(definition, factor, artifact, baseRow)
        ]));
        if (baseRow.nativeMarketCap) baseRow.nativeMarketCap.rightsId = rightsByField['valuation.marketCap'];
        const readiness = buildFieldReadiness(baseRow, {
          registry: SCREENER_FIELD_REGISTRY,
          now,
          revisionId: artifact.asOf || 'unpublished',
          sourceId: factor.source || artifact.source || 'screener-artifact',
          sourceKind: factor.sourceKind === 'official-filing' ? 'T1_OFFICIAL' : 'T3_PUBLIC_DELAYED',
          rightsByField,
          sourceKindByField
        });
        rows.push({ ...baseRow, fieldReadiness: readiness, fieldObservations: readiness.observations });
        if (rows.length % 32 === 0 && rows.length < symbols.length) {
          await yieldImpl();
          checkAborted();
        }
      }

      // P1173 (17 작업 단위 4 / O07): judge the input set, not just each file on its own. The three
      // responses arrive from independent URLs with their own cadences, so "each file is fresh" never
      // said whether they can be used together. An incompatible set is reported and downgrades the read
      // instead of being combined silently.
      const publicationSetFull = evaluatePublicationSet({
        policy: SCREENER_PUBLICATION_POLICY,
        previous: previousPublicationSet,
        members: [
          {
            member: 'screener', present: artifactValid, revision: artifact.asOf || null, observedAt: artifact.asOf || null,
            schemaVersion: artifact.schemaVersion || null, universeSize: numberOrNull(artifact.universe)
          },
          {
            member: 'universe', present: Array.isArray(universePayload?.universe), revision: universeLastBulkUpdate,
            observedAt: universeLastBulkUpdate, schemaVersion: universeMeta.schemaVersion || null,
            universeSize: Array.isArray(universePayload?.universe) ? universePayload.universe.length : null
          },
          {
            member: 'model-validation', present: !!modelValidation,
            revision: modelValidation?.observedAt || modelValidation?.generatedAt || null,
            observedAt: modelValidation?.observedAt || null, schemaVersion: modelValidation?.schemaVersion || null
          }
        ]
      });
      previousPublicationSet = Object.freeze({
        revisions: Object.fromEntries(publicationSetFull.members.map((entry) => [entry.member, entry.revision]))
      });
      const publicationSet = Object.freeze({
        version: publicationSetFull.version,
        status: publicationSetFull.status,
        reason: publicationSetFull.reason,
        compatible: publicationSetFull.compatible,
        checked: publicationSetFull.checked,
        policyMembers: publicationSetFull.policy.members,
        members: Object.freeze(publicationSetFull.members.map((entry) => Object.freeze({
          member: entry.member, present: entry.present, revision: entry.revision,
          observedAt: entry.observedAt, schemaVersion: entry.schemaVersion
        }))),
        // Declares which members could not be judged for compatibility at all, so "declares nothing"
        // does not read as "compatible".
        unjudged: publicationSetFull.unjudged,
        missing: publicationSetFull.missing,
        incompatibilities: publicationSetFull.incompatibilities,
        advancedSincePreviousRead: publicationSetFull.advancedSincePreviousRead
      });
      if (!publicationSet.compatible) warnings.push('SCREENER_PUBLICATION_SET_INCOMPATIBLE');

      // P1180/R24-04 (07 W07-G): observationSetId covers the publication set, not just the
      // screener file. Universe membership/schema and the model-validation revision are inputs
      // that arrived with this read, so a member revision change must move the observation
      // identity even when no row value changes.
      const publicationRevisions = Object.fromEntries(publicationSet.members.map((entry) => [entry.member, entry.revision]));
      const snapshotId = `screener-snapshot-${await stableHashAsync({ revision: artifact.asOf, source: artifact.source, publicationRevisions, rows: snapshotIdentityRows(rows) }, { yieldImpl, signal })}`;

      return Object.freeze({
        rows,
        filters: {},
        metadata: {
          warnings,
          artifactFreshnessStatus: artifactValid ? artifactFresh ? 'current' : 'stale' : 'missing',
          factorFreshnessStatus: factorsFresh ? 'current' : artifactValid ? 'stale' : 'missing',
          displayPolicy: 'per-field-reference-with-observation-time',
          calculationPolicy: 'per-field-readiness',
          asOf: artifact.asOf || null,
          factorObservedAt: artifact.factorObservedAt || null,
          // R24-03/P1179: artifact-level time contract travels with the metadata —
          // the UI must not reconstruct a session date from the bar timestamp.
          factorTimeBasis: artifact.factorTimeBasis || null,
          factorSessionDateByMarket: artifact.factorSessionDateByMarket && typeof artifact.factorSessionDateByMarket === 'object' ? { ...artifact.factorSessionDateByMarket } : null,
          factorBarStartByMarket: artifact.factorBarStartByMarket && typeof artifact.factorBarStartByMarket === 'object' ? { ...artifact.factorBarStartByMarket } : null,
          factorComputedAt: artifact.factorComputedAt || null,
          universe: Number(artifact.universe) || symbols.length,
          artifactRows: Object.keys(artifact.data).length,
          universeRows: universe.length,
          universeCurrentness,
          universeLastBulkUpdate,
          universeStaleAfterDays,
          universeFreshnessStatus,
          fmpOk: !!artifact.fmpOk,
          fundamentalCoveragePct: numberOrNull(artifact.fundamentalCoveragePct),
          fundamentalCoverageDenominator: numberOrNull(artifact.fundamentalCoverageDenominator),
          fundamentalModels: Array.isArray(artifact.fundamentalModels) ? artifact.fundamentalModels.slice() : [],
          fundamentalCoverageScope: artifact.fundamentalCoverageScope || 'US screener universe; mixed fundamental fields',
          secFundamentalsCount: numberOrNull(artifact.secFundamentalsCount),
          secFundamentalsStored: numberOrNull(artifact.secFundamentalsStored),
          secFundamentalsEligible: numberOrNull(artifact.secFundamentalsEligible),
          secFundamentalsModel: artifact.secFundamentalsModel || null,
          secFundamentalsGeneratedAt: artifact.secFundamentalsGeneratedAt || null,
          secFundamentalsOk: !!artifact.secFundamentalsOk,
          rankingContract: artifact.rankingContract || null,
          backtest: artifact.backtest || null,
          modelValidation: modelValidation ? {
            status: String(modelValidation.status).toUpperCase(),
            allowedUse: modelValidation.allowedUse || 'none',
            pointInTimeUniverse: modelValidation.pointInTimeUniverse === true,
            transactionCostsModeled: modelValidation.transactionCostsModeled === true,
            liquidityCapacityModeled: modelValidation.liquidityCapacityModeled === true,
            liveBacktestParity: modelValidation.liveBacktestParity === true,
            blockers: Array.isArray(modelValidation.blockers) ? [...modelValidation.blockers] : [],
            observedAt: modelValidation.observedAt || modelValidation.generatedAt || null
          } : { status: 'BLOCKED', allowedUse: 'none', blockers: [modelValidationRejected || 'model-validation-status-unavailable'], observedAt: null, rejection: modelValidationRejected },
          publicationSet,
          conditionalEvidence: artifact.conditionalEvidence || null,
          dataLineage: artifact.dataLineage || null,
          breadth: artifact.breadth || null,
          source: artifact.source || 'public-data/screener.json',
          contractVersion: 'screener-workbench.v1',
          fieldRegistryVersion: SCREENER_FIELD_REGISTRY.version,
          snapshotId,
          snapshotStatus: 'content-addressed-observation-set'
        },
        revision: artifact.asOf || null,
        snapshotId,
        status: !rows.length ? 'unavailable' : artifactFresh && factorsFresh && publicationSet.compatible && rows.some((row) => typeof row.ret3m === 'number') && universeFreshnessStatus !== 'stale' ? 'current' : 'partial',
        updatedAt: artifact.asOf || null
      });
    }
  });
}
