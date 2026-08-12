import { buildFieldReadiness, createInstrumentRef, SCREENER_FIELD_REGISTRY, stableHash } from '../contracts/screener.js';

// ARX-10/ARX-16 + SCR-OS-01: the native screener reads the published artifact and generated identity
// universe through the platform HTTP gateway. Legacy SCREENER_DB remains only as a
// compatibility enrichment/fallback for non-route consumers that have not yet migrated.
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asOfIsFresh(asOf, now, maxAgeDays) {
  const timestamp = asOf ? new Date(asOf).getTime() : 0;
  return timestamp > 0 && (now - timestamp) / 86400000 <= maxAgeDays;
}

function liveEnrichment(symbol, readLiveData) {
  const live = readLiveData?.()?.[symbol] || {};
  const marketCap = finite(live.marketCap);
  return {
    price: finite(live.price),
    mcap: marketCap != null ? Math.round(marketCap / 1e9) : null,
    _mcapObservedAt: live.ts || live.updatedAt || null
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
  const STALE_AFTER_DAYS = 7;

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
      const unavailable = (revision = null, detail = null) => Object.freeze({
        rows: [],
        filters: {},
        metadata: { detail, artifactRows: 0, universeRows: 0 },
        revision,
        status: 'unavailable',
        updatedAt: clock.iso()
      });

      if (!artifact || !artifact.data || typeof artifact.data !== 'object') {
        return unavailable(null, artifactResponse.error || 'SCREENER_ARTIFACT_INVALID');
      }
      if (!asOfIsFresh(artifact.asOf, now, STALE_AFTER_DAYS)) {
        return unavailable(artifact.asOf || null, 'SCREENER_ARTIFACT_STALE');
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
          _fundamentalSource: factor.fundamentalSource || null,
          _fundamentalModel: factor.fundamentalModel || null,
          _fundamentalPeriod: factor.fundamentalPeriod || null,
          _fundamentalObservedAt: factor.fundamentalObservedAt || null,
          _fundamentalFiledAt: factor.fundamentalFiledAt || null,
          _fundamentalFetchedAt: factor.fundamentalFetchedAt || null,
          _fundamentalAccession: factor.fundamentalAccession || null,
          observedAt: factor.observedAt || artifact.factorObservedAt || artifact.asOf || null,
          fetchedAt: factor.fetchedAt || artifact.asOf || null,
          instrumentRef
        };
        const readiness = buildFieldReadiness(baseRow, {
          registry: SCREENER_FIELD_REGISTRY,
          now,
          revisionId: artifact.asOf || 'unpublished',
          sourceId: factor.source || artifact.source || 'screener-artifact',
          sourceKind: factor.sourceKind === 'official-filing' ? 'T1_OFFICIAL' : 'T3_PUBLIC_DELAYED'
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
          fmpOk: !!artifact.fmpOk,
          fundamentalCoveragePct: Number(artifact.fundamentalCoveragePct) || 0,
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
        status: rows.some((row) => typeof row.ret3m === 'number') ? 'current' : 'partial',
        updatedAt: artifact.asOf || clock.iso()
      });
    }
  });
}
