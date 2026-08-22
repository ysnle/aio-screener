const entry = (config) => Object.freeze({
  dailyRefreshAudit: true,
  ...config,
  artifacts: Object.freeze([...(config.artifacts || [])]),
  consumers: Object.freeze([...(config.consumers || [])]),
  origins: Object.freeze((config.origins || []).map((origin) => Object.freeze({ ...origin }))),
  structuralLimit: config.structuralLimit ? Object.freeze({ ...config.structuralLimit }) : null
});

// Machine-readable source of truth for every category emitted by
// reconciliation-status.json. A provider being listed here does not make its
// values current: the reconciliation builder still requires observation-level
// evidence from the generated artifacts. The registry answers the separate
// questions "where can this value originate?", "who refreshes it?", and
// "which limitation must remain visible when collection is impossible?".
export const DATA_SOURCE_REGISTRY = Object.freeze({
  'market-quotes': entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs',
    artifacts: ['public-data/market-snapshot.json', 'public-data/history.json'],
    consumers: ['home', 'signal', 'technical', 'ticker', 'portfolio', 'screener'],
    origins: [
      { id: 'yahoo-chart', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['price', 'previousClose', 'changePct', 'OHLCV', 'marketSession'] },
      { id: 'twelve-data', authority: 'secondary', sourceKind: 'licensed-api', access: 'optional-key', url: 'https://twelvedata.com/docs', fields: ['price-fallback'] }
    ],
    structuralLimit: { kind: 'provider-rights-and-diversity', reason: 'Primary quote path is a public information service and no independent full-universe reconciliation is configured.', remediation: 'Configure a redistribution-approved quote provider and retain field-level cross-provider tolerances.' }
  }),
  volatility: entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs',
    artifacts: ['public-data/market-snapshot.json', 'public-data/history.json'], consumers: ['sentiment', 'options', 'signal'],
    origins: [{ id: 'yahoo-volatility-indexes', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['VIX', 'VIX3M', 'VVIX'] }],
    structuralLimit: { kind: 'official-history-rights', reason: 'Official Cboe redistribution and settlement contracts are not configured.', remediation: 'Add an approved Cboe source before labeling the series official.' }
  }),
  'fear-greed': entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/data.json', 'public-data/history.json'], consumers: ['home', 'sentiment', 'briefing'],
    origins: [{ id: 'cnn-fear-greed', authority: 'publisher', sourceKind: 'secondary-index', access: 'public-web', url: 'https://www.cnn.com/markets/fear-and-greed', fields: ['score', 'rating', 'daily-history'] }],
    structuralLimit: { kind: 'publisher-methodology-and-rights', reason: 'CNN is the index publisher but the web feed is not an exchange or regulator API.', remediation: 'Preserve CNN attribution and reference-only decision use unless a licensed contract is obtained.' }
  }),
  'put-call': entry({
    cadence: 'daily', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/data.json'], consumers: ['sentiment', 'options', 'briefing'],
    origins: [{ id: 'cboe-daily-statistics', authority: 'official-exchange', sourceKind: 'official-primary', access: 'public-web-terms-apply', url: 'https://www.cboe.com/us/options/market_statistics/daily/', fields: ['totalPutCall', 'equityPutCall', 'indexPutCall'] }], structuralLimit: null
  }),
  aaii: entry({
    cadence: 'weekly', refreshMode: 'operator-web-research', producer: 'scripts/refresh-web-research.mjs', artifacts: ['public-data/data.json', 'public-data/structural-data-research.json', 'public-data/reconciliation-status.json'], consumers: ['sentiment'],
    origins: [{ id: 'aaii-sentiment-survey', authority: 'publisher', sourceKind: 'publisher-public-web', access: 'public-web-terms-apply', url: 'https://www.aaii.com/sentimentsurvey', fields: ['bullish', 'neutral', 'bearish'] }],
    structuralLimit: { kind: 'publisher-terms-and-reference-cadence', reason: 'The official public page provides weekly values, but this is reference-only and not a licensed real-time trading input.', remediation: 'Keep the dated public observation and obtain licensed rights before promotion beyond reference use.' }
  }),
  naaim: entry({
    cadence: 'weekly', refreshMode: 'operator-web-research', producer: 'scripts/refresh-web-research.mjs', artifacts: ['public-data/data.json', 'public-data/structural-data-research.json', 'public-data/reconciliation-status.json'], consumers: ['sentiment'],
    origins: [{ id: 'naaim-exposure-index', authority: 'publisher', sourceKind: 'publisher-public-web', access: 'public-web-terms-apply', url: 'https://naaim.org/programs/naaim-exposure-index/', fields: ['exposureIndex'] }],
    structuralLimit: { kind: 'publisher-current-subscription-and-commercial-use-permission', reason: 'The publisher exposes public values with a three-month delay, reserves current/API access for subscribers, and requires express permission for commercial use.', remediation: 'Retain dated public values as stale reference only; configure licensed/direct access and permitted display rights for current data.' }
  }),
  'investors-intelligence': entry({
    cadence: 'weekly', refreshMode: 'operator', producer: 'operator/provider-contract', artifacts: ['public-data/reconciliation-status.json'], consumers: ['sentiment'],
    origins: [{ id: 'investors-intelligence-advisors-sentiment', authority: 'publisher', sourceKind: 'licensed', access: 'subscriber', url: 'https://www.investorsintelligence.com/subscribe/packages', fields: ['bullish', 'bearish', 'correction'] }],
    structuralLimit: { kind: 'subscriber-data', reason: 'Subscriber survey values are unavailable.', remediation: 'Configure subscriber rights; do not extrapolate.' }
  }),
  'us-breadth': entry({
    cadence: '6h', refreshMode: 'derived', producer: 'scripts/fetch-data.mjs:enrichScreener', artifacts: ['public-data/screener.json', 'public-data/history.json'], consumers: ['breadth', 'signal', 'briefing'],
    origins: [{ id: 'aio-us-universe-breadth', authority: 'derived', sourceKind: 'derived-research', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['above5', 'above20', 'above50', 'above200', 'advanceRatio'] }],
    structuralLimit: { kind: 'universe-scope', reason: 'AIO-universe breadth is not official NYSE/Nasdaq exchange breadth.', remediation: 'Add an approved exchange-wide advances/declines and new-high/new-low feed as a separate metric.' }
  }),
  'kr-breadth': entry({
    cadence: '6h', refreshMode: 'derived', producer: 'scripts/fetch-data.mjs:enrichScreener', artifacts: ['public-data/screener.json', 'public-data/history.json'], consumers: ['breadth', 'signal', 'briefing'],
    origins: [{ id: 'aio-kr-universe-breadth', authority: 'derived', sourceKind: 'derived-research', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['above5', 'above20', 'above50', 'above200', 'advanceRatio'] }, { id: 'krx-market-data', authority: 'official-exchange', sourceKind: 'official-primary', access: 'operator-rights-required', url: 'https://data.krx.co.kr/', fields: ['officialAdvancesDeclines'] }],
    structuralLimit: { kind: 'krx-rights', reason: 'Approved KRX/Koscom breadth redistribution is not configured.', remediation: 'Configure approved KRX/Koscom access and keep AIO-universe breadth separately labeled.' }
  }),
  'breadth-history': entry({
    cadence: '6h', refreshMode: 'derived', producer: 'scripts/fetch-data.mjs:updateScreenerBreadthHistory', artifacts: ['public-data/history.json'], consumers: ['breadth', 'technical'],
    origins: [{ id: 'aio-universe-adjusted-close-history', authority: 'derived', sourceKind: 'derived-research', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['breadth20', 'breadth50', 'breadth200', 'advanceRatio', 'advanceDecline'] }],
    structuralLimit: { kind: 'official-advance-decline', reason: 'AIO history can measure its own universe but cannot be labeled McClellan/official exchange A-D.', remediation: 'Keep AIO participation history distinct; add official exchange A-D before calculating McClellan.' }
  }),
  'treasury-curve': entry({
    cadence: 'daily', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs:fetchFred', artifacts: ['public-data/data.json', 'public-data/history.json'], consumers: ['macro', 'fxbond', 'briefing'],
    origins: [{ id: 'us-treasury-daily-par-curve', authority: 'official-government', sourceKind: 'official-primary', access: 'public-web', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', fields: ['2Y', '5Y', '10Y', '20Y', '30Y', 'same-date 10Y-2Y'] }, { id: 'fred-h15-treasury', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'api-key', url: 'https://fred.stlouisfed.org/docs/api/fred/series_observations.html', fields: ['DGS2', 'DGS5', 'DGS10', 'DGS20', 'DGS30', 'T10Y2Y'] }, { id: 'yahoo-treasury-indexes', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['IRX', 'FVX', 'TNX', 'TYX'] }], structuralLimit: null
  }),
  'hy-oas': entry({
    cadence: 'daily', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs:fetchFred', artifacts: ['public-data/data.json'], consumers: ['fxbond', 'signal', 'briefing'],
    origins: [
      { id: 'fred-baml-hy-oas', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'api-key', url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2', fields: ['BAMLH0A0HYM2'] },
      { id: 'fred-baml-hy-oas-public-csv', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'public-download', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2', fields: ['BAMLH0A0HYM2'] }
    ],
    structuralLimit: { kind: 'independent-reconciliation', reason: 'No independent spread-level cross-check is configured.', remediation: 'Add a redistribution-approved ICE/Bloomberg/LSEG or equivalent source.' }
  }),
  'cpi-pce': entry({
    cadence: 'release', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/data.json'], consumers: ['macro', 'briefing', 'signal'],
    origins: [{ id: 'bls-public-data', authority: 'official-government', sourceKind: 'official-primary', access: 'public-api', url: 'https://www.bls.gov/bls/api_features.htm', fields: ['CPI', 'coreCPI'] }, { id: 'bea-nipa-api', authority: 'official-government', sourceKind: 'official-primary', access: 'public-api', url: 'https://apps.bea.gov/api/', fields: ['PCE', 'corePCE'] }, { id: 'fred-macro-relay', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'api-key', url: 'https://fred.stlouisfed.org/docs/api/fred/series_observations.html', fields: ['CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE'] }], structuralLimit: null
  }),
  'employment-wages': entry({
    cadence: 'release', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs:fetchBlsSeries', artifacts: ['public-data/data.json'], consumers: ['macro', 'briefing'],
    origins: [{ id: 'bls-public-data', authority: 'official-government', sourceKind: 'official-primary', access: 'public-api', url: 'https://www.bls.gov/bls/api_features.htm', fields: ['UNRATE', 'PAYEMS', 'AHE', 'LFPR'] }], structuralLimit: null
  }),
  'retail-housing-ism': entry({
    cadence: 'release', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs:fetchFred', artifacts: ['public-data/data.json'], consumers: ['macro', 'briefing'],
    origins: [{ id: 'fred-retail-housing', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'api-key', url: 'https://fred.stlouisfed.org/docs/api/fred/series_observations.html', fields: ['RSAFS', 'HOUST'] }, { id: 'ism-report-on-business', authority: 'publisher', sourceKind: 'licensed-or-public-release', access: 'not-configured', url: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/', fields: ['manufacturingPMI', 'servicesPMI'] }],
    structuralLimit: { kind: 'release-aware-ism', reason: 'An official release-aware ISM adapter is not configured.', remediation: 'Configure a permitted ISM release source and retain release timestamp.' }
  }),
  'central-bank-policy': entry({
    cadence: 'daily-audit/event-refresh', refreshMode: 'scheduled-and-operator', producer: 'scripts/fetch-data.mjs + official calendar registry', artifacts: ['public-data/data.json'], consumers: ['macro', 'fxbond', 'briefing'],
    origins: [{ id: 'fred-fedfunds', authority: 'official-government-relay', sourceKind: 'official-primary', access: 'api-key', url: 'https://fred.stlouisfed.org/series/FEDFUNDS', fields: ['fedRate'] }, { id: 'federal-reserve-fomc', authority: 'official-central-bank', sourceKind: 'official-primary', access: 'public-web', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', fields: ['FOMC decisions'] }, { id: 'bok-ecb-boj-boe', authority: 'official-central-banks', sourceKind: 'official-primary', access: 'partially-configured', url: 'https://www.bis.org/cbanks.htm', fields: ['BOK', 'ECB', 'BOJ', 'BOE policy rates'] }],
    structuralLimit: { kind: 'multi-central-bank-registry', reason: 'Point-level automatic reconciliation for BOK/ECB/BOJ/BOE is incomplete.', remediation: 'Add official adapters per bank and release-event tests.' }
  }),
  'macro-calendar': entry({
    cadence: 'daily-audit/event-refresh', refreshMode: 'scheduled-and-static-registry', producer: 'scripts/fetch-data.mjs + calendar registry', artifacts: ['public-data/data.json', 'js/aio-data.js'], consumers: ['macro', 'briefing'],
    origins: [{ id: 'fomc-calendar', authority: 'official-central-bank', sourceKind: 'official-primary', access: 'public-web', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', fields: ['FOMC meetings'] }, { id: 'bls-release-calendar', authority: 'official-government', sourceKind: 'official-primary', access: 'public-web', url: 'https://www.bls.gov/schedule/', fields: ['CPI', 'Employment'] }, { id: 'bea-release-schedule', authority: 'official-government', sourceKind: 'official-primary', access: 'public-web', url: 'https://www.bea.gov/news/schedule', fields: ['PCE', 'GDP'] }],
    structuralLimit: { kind: 'multi-agency-trigger', reason: 'Calendar dates are registered, but a single release-triggered ingestion adapter is incomplete.', remediation: 'Poll official schedules daily and trigger post-release refresh by event identity.' }
  }),
  news: entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs:fetchNews', artifacts: ['public-data/data.json', 'public-data/telegram-digest.json'], consumers: ['home', 'briefing', 'market-news', 'ticker', 'screener'],
    origins: [{ id: 'publisher-rss-and-google-news', authority: 'publisher-aggregation', sourceKind: 'secondary-headline', access: 'public-rss', url: 'https://news.google.com/rss', fields: ['headline', 'publisher', 'publishedAt', 'url'] }, { id: 'telegram-public-web', authority: 'untrusted-reference', sourceKind: 'reference', access: 'public-web', url: 'https://t.me/s/', fields: ['research-summary', 'publishedAt', 'channel'] }],
    structuralLimit: { kind: 'full-content-and-editorial', reason: 'Headline-only feeds cannot certify article-level claims and Telegram is untrusted reference material.', remediation: 'Add permitted full-text publisher feeds and human/editorial verification for public factual claims.' }
  }),
  'commodities-fx': entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/market-snapshot.json', 'public-data/history.json'], consumers: ['home', 'fxbond', 'briefing'],
    origins: [{ id: 'yahoo-cross-asset', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['WTI futures', 'gold futures', 'DXY', 'FX spot'] }, { id: 'twelve-data-cross-check', authority: 'secondary', sourceKind: 'licensed-api', access: 'optional-key', url: 'https://twelvedata.com/docs', fields: ['fallback quotes'] }],
    structuralLimit: { kind: 'basis-contract', reason: 'Futures settlement, delayed futures, index and FX spot bases are not interchangeable.', remediation: 'Retain instrument/valueBasis per field and add settlement-specific sources where required.' }
  }),
  'global-indices': entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/market-snapshot.json', 'public-data/history.json'], consumers: ['home', 'briefing', 'technical'],
    origins: [{ id: 'yahoo-global-indices', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['SPX', 'Nasdaq', 'Dow', 'Russell', 'FTSE', 'Nikkei', 'Hang Seng', 'KOSPI', 'KOSDAQ'] }],
    structuralLimit: { kind: 'provider-rights-and-session-coverage', reason: 'A single public-information provider covers markets with different sessions and redistribution terms.', remediation: 'Add venue-approved feeds and per-exchange calendars before institutional claims.' }
  }),
  crypto: entry({
    cadence: '30m', refreshMode: 'scheduled', producer: 'scripts/fetch-data.mjs', artifacts: ['public-data/data.json', 'public-data/market-snapshot.json', 'public-data/history.json'], consumers: ['home', 'briefing'],
    origins: [{ id: 'yahoo-crypto', authority: 'secondary', sourceKind: 'public-information-service', access: 'public-unofficial', url: 'https://query1.finance.yahoo.com/v8/finance/chart/', fields: ['BTC-USD', 'ETH-USD'] }, { id: 'coingecko-simple-price', authority: 'secondary', sourceKind: 'public-api', access: 'public-best-effort', url: 'https://docs.coingecko.com/reference/simple-price', fields: ['BTC', 'ETH cross-check'] }],
    structuralLimit: { kind: 'redistribution-and-provider-sla', reason: 'CoinGecko public access supplies an independent best-effort comparison but not an institutional redistribution/SLA contract.', remediation: 'Retain the 2%/2-hour fail-closed comparison and obtain an approved provider before institutional promotion.' }
  }),
  'kr-macro-vkospi-supply': entry({
    cadence: 'daily', refreshMode: 'operator-and-browser', producer: 'KOSIS/BOK/approved-KRX adapters', artifacts: ['public-data/reconciliation-status.json'], consumers: ['macro', 'briefing', 'themes'],
    origins: [{ id: 'bok-ecos', authority: 'official-central-bank', sourceKind: 'official-primary', access: 'api-key-or-public', url: 'https://ecos.bok.or.kr/api/', fields: ['Korean macro', 'rates', 'FX'] }, { id: 'kosis', authority: 'official-government', sourceKind: 'official-primary', access: 'api-key-or-public', url: 'https://kosis.kr/openapi/', fields: ['Korean statistics'] }, { id: 'krx-koscom', authority: 'official-exchange', sourceKind: 'official-primary', access: 'operator-rights-required', url: 'https://data.krx.co.kr/', fields: ['VKOSPI', 'investor flows', 'official breadth'] }],
    structuralLimit: { kind: 'approved-krx-rights', reason: 'Approved KRX/Koscom provider and redistribution rights are unresolved.', remediation: 'Configure approved access; do not promote Naver/web values as official exchange data.' }
  })
});

// Important professional-screener capabilities observed in comparable open
// projects. These are deliberately kept separate from the 22 current-data
// categories so an absent capability cannot be mistaken for a stale value.
export const CRITICAL_DATA_GAP_REGISTRY = Object.freeze([
  Object.freeze({ id: 'point-in-time-fundamentals', priority: 'P0', status: 'PARTIAL', reason: 'SEC-covered annual facts now retain append-only filing observations and can be reconstructed by accepted/filed time; coverage still converges in bounded batches and does not supply historical prices or non-SEC issuers.', requiredOrigin: 'SEC companyfacts plus submissions acceptanceDateTime', allowedInterimUse: 'filing-as-of research; valuation only with contemporaneous price', implementedScope: 'sec-pit-facts.v1 history and deterministic as-of selector', remainingLimit: 'bounded SEC coverage, older accession acceptance timestamps, historical prices and non-US issuers', validationGate: 'scripts/ci-professional-data-gap-check.mjs' }),
  Object.freeze({ id: 'historical-universe-and-corporate-actions', priority: 'P0', status: 'BLOCKED', reason: 'Delisted securities, membership windows, ticker mapping and split/dividend factors are incomplete.', requiredOrigin: 'PIT membership, map files and factor files', allowedInterimUse: 'no predictive promotion' }),
  Object.freeze({ id: 'independent-quote-reconciliation', priority: 'P0', status: 'BLOCKED', reason: 'Tier-0 and rendered quotes lack a redistribution-approved independent comparison plane.', requiredOrigin: 'licensed quote provider', allowedInterimUse: 'reference with source/session labels' }),
  Object.freeze({ id: 'official-exchange-breadth', priority: 'P1', status: 'BLOCKED', reason: 'AIO-universe breadth does not replace exchange A/D and new-high/new-low data.', requiredOrigin: 'NYSE/Nasdaq/KRX approved feed', allowedInterimUse: 'AIO-universe participation only' }),
  Object.freeze({ id: 'earnings-revisions-and-guidance', priority: 'P1', status: 'BLOCKED', reason: 'Consensus revisions, surprise history and guidance need a licensed or explicitly permitted source.', requiredOrigin: 'licensed estimates plus SEC filings', allowedInterimUse: 'filed actuals and dated news only' }),
  Object.freeze({ id: 'short-interest-and-options-flow', priority: 'P1', status: 'BLOCKED', reason: 'Short interest, borrow cost, options Greeks/IV surface and flow require specialized feeds.', requiredOrigin: 'FINRA/exchange/OPRA or licensed vendor', allowedInterimUse: 'Cboe aggregate put/call and delayed VIX only' }),
  Object.freeze({ id: 'insider-and-institutional-filings', priority: 'P1', status: 'PARTIAL', reason: 'Seven manager 13F holdings, adjacent-quarter changes and twelve-quarter history are normalized and source-linked; Forms 3/4/5 and 13D/G are not yet normalized.', requiredOrigin: 'SEC EDGAR', allowedInterimUse: 'reported-period institutional reference only', implementedScope: 'verified 13F metadata, holdings, changes and history', remainingLimit: 'insider Forms 3/4/5, beneficial ownership 13D/G and complete CUSIP-to-ticker master', validationGate: 'scripts/ci-masters-contract-check.mjs' }),
  Object.freeze({ id: 'portfolio-risk-attribution', priority: 'P2', status: 'PARTIAL', reason: 'Browser-side VaR/CVaR, drawdown, benchmark beta/alpha, correlation, stress and return/risk contribution are implemented; institutional factor models and capacity remain unavailable.', requiredOrigin: 'adjusted OHLCV plus benchmark/factor series', allowedInterimUse: 'historical research with survivorship and provider limitations', implementedScope: '3-month daily risk plus up-to-10-year monthly benchmark and component attribution', remainingLimit: 'licensed factor returns, transaction costs, liquidity/capacity and survivorship-free histories', validationGate: 'scripts/ci-professional-data-gap-check.mjs' })
]);

export const SOURCE_REGISTRY_CATEGORY_IDS = Object.freeze(Object.keys(DATA_SOURCE_REGISTRY));

export function sourceContractFor(categoryId) {
  return DATA_SOURCE_REGISTRY[String(categoryId || '')] || null;
}
