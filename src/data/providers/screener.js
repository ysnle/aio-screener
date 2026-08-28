import { buildFieldReadiness, createInstrumentRef, SCREENER_FIELD_REGISTRY, stableHash } from '../contracts/screener.js';

// ARX-10/ARX-16 + SCR-OS-01: the native screener reads the published artifact and generated identity
// universe through the platform HTTP gateway. Legacy SCREENER_DB remains only as a
// compatibility enrichment/fallback for non-route consumers that have not yet migrated.
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrNull(value) {
  return value == null || value === '' ? null : finite(Number(value));
}

function asOfIsFresh(asOf, now, maxAgeDays) {
  const timestamp = asOf ? new Date(asOf).getTime() : 0;
  return timestamp > 0 && (now - timestamp) / 86400000 <= maxAgeDays;
}

const RIGHTS_VALUES = new Set(['VERIFIED', 'REVIEW_REQUIRED', 'UNKNOWN']);

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
// per-field map yet.  This keeps official SEC fields usable while preserving
// the REVIEW_REQUIRED gate for the free Yahoo EOD path.
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

function liveEnrichment(symbol, readLiveData) {
  const live = readLiveData?.()?.[symbol] || {};
  const envelope = live.quoteEnvelope || {};
  const marketCap = finite(live.marketCap);
  const observedAt = live.observedAt || envelope.observedAt || live.timestamp || live.ts || null;
  const fetchedAt = live.fetchedAt || envelope.fetchedAt || live.updatedAt || null;
  const source = live.source || envelope.source || 'runtime-quote';
  const revision = live.revision || envelope.revision || null;
  return {
    price: finite(live.price),
    mcap: marketCap != null ? Math.round(marketCap / 1e9) : null,
    priceObservedAt: observedAt,
    priceFetchedAt: fetchedAt,
    priceSource: source,
    priceRevision: revision,
    _mcapObservedAt: observedAt,
    _mcapFetchedAt: fetchedAt,
    _mcapSource: source,
    _mcapRevision: revision
  };
}

export function createScreenerProvider({
  httpClient,
  url = './public-data/screener.json',
  universeUrl = './public-data/screener-universe.json',
  readLiveData = () => ({}),
  clock = { now: () => Date.now(), iso: () => new Date().toISOString() }
} = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') throw new Error('SCREENER_HTTP_CLIENT_INVALID');
  const ARTIFACT_STALE_AFTER_DAYS = 2;
  const FACTOR_STALE_AFTER_DAYS = 4;

  return Object.freeze({
    async readCurrent({ signal } = {}) {
      const [artifactResponse, universeResponse] = await Promise.all([
        httpClient.requestJson(url, { cache: 'no-store', signal }),
        httpClient.requestJson(universeUrl, { cache: 'no-store', signal })
      ]);
      const now = typeof clock.now === 'function' ? clock.now() : Date.now();
      const artifact = artifactResponse.ok && artifactResponse.data && typeof artifactResponse.data === 'object'
        ? artifactResponse.data
        : null;
      const universePayload = universeResponse.ok && universeResponse.data && typeof universeResponse.data === 'object'
        ? universeResponse.data
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

      if (!artifact || !artifact.data || typeof artifact.data !== 'object') {
        return unavailable(null, artifactResponse.error || 'SCREENER_ARTIFACT_INVALID');
      }
      if (!asOfIsFresh(artifact.asOf, now, ARTIFACT_STALE_AFTER_DAYS)) {
        return unavailable(artifact.asOf || null, 'SCREENER_ARTIFACT_STALE');
      }
      if (!asOfIsFresh(artifact.factorObservedAt, now, FACTOR_STALE_AFTER_DAYS)) {
        return unavailable(artifact.asOf || null, 'SCREENER_FACTOR_OBSERVATION_STALE');
      }

      const universe = universeResponse.ok && Array.isArray(universeResponse.data?.universe)
        ? universeResponse.data.universe
        : [];
      const universeBySymbol = new Map(universe.map((row) => [String(row?.sym || '').toUpperCase(), row]));
      const symbols = [...new Set([
        ...universe.map((row) => String(row?.sym || '').toUpperCase()).filter(Boolean),
        ...Object.keys(artifact.data).map((symbol) => String(symbol).toUpperCase())
      ])];

      const rows = symbols.map((symbol) => {
        const identity = universeBySymbol.get(symbol) || {};
        const factor = artifact.data[symbol] || {};
        const live = liveEnrichment(symbol, readLiveData);
        const market = /\.K[QS]$/i.test(symbol) || ['KOSPI', 'KOSDAQ'].includes(String(identity.index || '').toUpperCase()) ? 'KR' : 'US';
        const instrumentRef = createInstrumentRef({
          instrumentId: `${market}:${symbol}`,
          symbol,
          market,
          mic: market === 'KR' ? 'XKRX' : (String(identity.index || '').toUpperCase() === 'NYSE' ? 'XNYS' : 'XNAS'),
          currency: market === 'KR' ? 'KRW' : 'USD',
          assetType: 'EQUITY',
          validFrom: identity.validFrom,
          validTo: identity.validTo
        });
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
          price: finite(factor.price) ?? live.price,
          priceObservedAt: finite(factor.price) != null ? (factor.observedAt || artifact.factorObservedAt || null) : live.priceObservedAt,
          priceFetchedAt: finite(factor.price) != null ? (factor.fetchedAt || artifact.asOf || null) : live.priceFetchedAt,
          priceSource: finite(factor.price) != null ? (factor.source || artifact.source || 'screener-artifact') : live.priceSource,
          priceRevision: finite(factor.price) != null ? (artifact.asOf || null) : live.priceRevision,
          pctFrom52wLow: finite(factor.pctFrom52wLow),
          pctFrom52wHigh: finite(factor.pctFrom52wHigh),
          adrPct: finite(factor.adrPct),
          avgVolume30d: finite(factor.avgVolume30d),
          dollarVolume30d: finite(factor.dollarVolume30d),
          lastVolume: finite(factor.lastVolume),
          dollarVolume: finite(factor.dollarVolume),
          ema8: finite(factor.ema8),
          ema21: finite(factor.ema21),
          ema60: finite(factor.ema60),
          mcap: live.mcap,
          _mcapObservedAt: live._mcapObservedAt,
          _mcapFetchedAt: live._mcapFetchedAt,
          _mcapSource: live._mcapSource,
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
          newsTs: factor.newsTs || null,
          newsObservedAt: factor.newsTs || null,
          newsFetchedAt: factor.fetchedAt || artifact.asOf || null,
          newsSource: 'ticker-news-artifact',
          _fundamentalSource: factor.fundamentalSource || null,
          _fundamentalModel: factor.fundamentalModel || null,
          _fundamentalPeriod: factor.fundamentalPeriod || null,
          _fundamentalObservedAt: factor.fundamentalObservedAt || null,
          _fundamentalFiledAt: factor.fundamentalFiledAt || null,
          _fundamentalFetchedAt: factor.fundamentalFetchedAt || null,
          _fundamentalAccession: factor.fundamentalAccession || null,
          identityObservedAt: identity.validFrom || artifact.asOf || null,
          identityFetchedAt: artifact.asOf || null,
          identitySource: 'public-data/screener-universe.json',
          observedAt: factor.observedAt || artifact.factorObservedAt || artifact.asOf || null,
          fetchedAt: factor.fetchedAt || artifact.asOf || null,
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
        const readiness = buildFieldReadiness(baseRow, {
          registry: SCREENER_FIELD_REGISTRY,
          now,
          revisionId: artifact.asOf || 'unpublished',
          sourceId: factor.source || artifact.source || 'screener-artifact',
          sourceKind: factor.sourceKind === 'official-filing' ? 'T1_OFFICIAL' : 'T3_PUBLIC_DELAYED',
          rightsByField,
          sourceKindByField
        });
        return { ...baseRow, fieldReadiness: readiness, fieldObservations: readiness.observations };
      });

      const snapshotId = `screener-snapshot-${stableHash({ revision: artifact.asOf, source: artifact.source, universe: symbols })}`;

      return Object.freeze({
        rows,
        filters: {},
        metadata: {
          asOf: artifact.asOf || null,
          factorObservedAt: artifact.factorObservedAt || null,
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
          breadth: artifact.breadth || null,
          source: artifact.source || 'public-data/screener.json',
          contractVersion: 'screener-workbench.v1',
          fieldRegistryVersion: SCREENER_FIELD_REGISTRY.version,
          snapshotId,
          snapshotStatus: 'immutable-local-snapshot'
        },
        revision: artifact.asOf || null,
        snapshotId,
        status: rows.some((row) => typeof row.ret3m === 'number') && universeFreshnessStatus !== 'stale' ? 'current' : 'partial',
        updatedAt: artifact.asOf || null
      });
    }
  });
}
