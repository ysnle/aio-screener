// ARX-10/ARX-16: the native screener reads the published artifact and generated identity
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
    async readCurrent() {
      const [artifactResponse, universeResponse] = await Promise.all([
        httpClient.requestJson(url, { cache: 'no-store' }),
        httpClient.requestJson(universeUrl, { cache: 'no-store' })
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
        return {
          symbol,
          sym: symbol,
          name: identity.name || '',
          sector: identity.sector || null,
          index: identity.index || null,
          signal: null,
          memo: null,
          source: factor.source || 'screener-artifact',
          sourceKind: factor.sourceKind || null,
          allowedUse: factor.allowedUse || null,
          price: finite(factor.price) ?? live.price,
          mcap: live.mcap,
          _mcapObservedAt: live._mcapObservedAt,
          rsi: finite(factor.rsi),
          ret1m: finite(factor.ret1m),
          ret3m: finite(factor.ret3m),
          ret6m: finite(factor.ret6m),
          vol: finite(factor.vol),
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
          observedAt: factor.observedAt || artifact.factorObservedAt || artifact.asOf || null
        };
      });

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
          source: artifact.source || 'public-data/screener.json'
        },
        revision: artifact.asOf || null,
        status: rows.some((row) => typeof row.ret3m === 'number') ? 'current' : 'partial',
        updatedAt: artifact.asOf || clock.iso()
      });
    }
  });
}
