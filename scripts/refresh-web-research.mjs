import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { fetchAaiiSentiment } from './fetch-data.mjs';

const DATA_PATH = fileURLToPath(new URL('../public-data/data.json', import.meta.url));
const EVIDENCE_PATH = fileURLToPath(new URL('../public-data/structural-data-research.json', import.meta.url));

// This is an operator-captured WebSearch snapshot. Values are copied only from
// the linked publisher pages and are never extrapolated when the page is stale,
// subscriber-only, or lacks a numeric observation.
// 2026-08-22 KST expressed as a non-future UTC instant for the lineage audit.
const CHECKED_AT = '2026-08-21T15:00:00Z';
const SOURCES = Object.freeze({
  aaii: 'https://www.aaii.com/sentimentsurvey',
  naaim: 'https://naaim.org/programs/naaim-exposure-index/',
  investorsIntelligence: 'https://www.investorsintelligence.com/subscribe/packages',
  finraShortInterest: 'https://www.finra.org/finra-data/browse-catalog/equity-short-interest',
  finraApi: 'https://developer.finra.org/docs',
  nyseCorporateActions: 'https://www.nyse.com/market-data/corporate-actions',
  nyseStats: 'https://www.nyse.com/data-insights/nyse-introduces-daily-us-equity-market-statistics-report',
  nasdaqDailyList: 'https://www.nasdaq.com/solutions/data/equities/nasdaq',
  nasdaqBreadth: 'https://www.nasdaq.com/market-activity/most-active',
  krxData: 'https://data.krx.co.kr/',
  krxIndex: 'https://index.krx.co.kr/'
});

const MARKET_SURVEYS = Object.freeze({
  schemaVersion: 'web-research-surveys.v1',
  checkedAt: CHECKED_AT,
  policy: 'official-publisher-public-web; reference-only; no synthesis',
  aaii: {
    status: 'current-reference',
    bullish: 35.5,
    neutral: 24.6,
    bearish: 39.9,
    spread: -4.4,
    observedAt: '2026-08-19',
    period: 'week-ending-2026-08-19',
    source: 'AAII Sentiment Survey',
    sourceKind: 'publisher-public-web',
    sourceUrl: SOURCES.aaii,
    access: 'public-web-terms-apply',
    allowedUse: 'reference-only',
    note: 'Official page exposes the latest weekly percentages; values are not trading-gate inputs.'
  },
  naaim: {
    status: 'stale-reference',
    exposure: 84.02,
    observedAt: '2026-07-22',
    publishedAt: '2026-07-23',
    source: 'NAAIM Exposure Index',
    sourceKind: 'publisher-public-web',
    sourceUrl: SOURCES.naaim,
    access: 'public-web-terms-apply',
    allowedUse: 'reference-only',
    note: 'Official page retains 84.02 as the last public value, exposes public data only with a three-month delay, and requires a subscription/API for current values; no newer current value was inferred.'
  },
  investorsIntelligence: {
    status: 'blocked-no-public-numeric',
    source: 'Investors Intelligence Advisors Sentiment',
    sourceKind: 'publisher-public-web',
    sourceUrl: SOURCES.investorsIntelligence,
    allowedUse: 'not-used',
    note: 'Official subscription page documents the survey but does not expose a current numeric reading without subscriber access.'
  }
});

const OFFICIAL_WEB_REFERENCES = Object.freeze({
  krExports: {
    status: 'stale-reference',
    period: '2026-07-01..2026-07-10',
    periodLabel: '2026-07-01~10',
    observedAt: '2026-07-01',
    publishedAt: '2026-07-13',
    exportsBillionUsd: 29.8,
    importsBillionUsd: 23.5,
    tradeBalanceBillionUsd: 6.3,
    exportsYoyPct: 53.9,
    importsYoyPct: 17.4,
    source: '관세청 수출입 현황 잠정치',
    sourceKind: 'official-primary',
    sourceUrl: 'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10169503&nttSnUrl=be8cdd187fb1efe4fe4c464b1cb3a147',
    allowedUse: 'reference-only',
    note: '공식 공개 페이지에서 확인한 최신 공개 잠정치. 2026년 8월 초순치가 공식 검색 결과에 아직 노출되지 않아 추정·대체하지 않음.'
  }
});

const STRUCTURAL_EVIDENCE = {
  schemaVersion: 'structural-data-research.v1',
  source: 'official-web-research',
  checkedAt: CHECKED_AT,
  method: 'WebSearch against official publisher, exchange, regulator, or government pages; no secondary value promoted when the official numeric field was unavailable.',
  entries: [
    {
      id: 'aaii', status: 'CURRENT_REFERENCE', valueArtifact: 'public-data/data.json.marketSurveys.aaii',
      sourceUrl: SOURCES.aaii, observation: '2026-08-19', detail: '35.5 bullish / 24.6 neutral / 39.9 bearish; current official public observation, retained as reference-only because publisher terms apply.'
    },
    {
      id: 'naaim', status: 'STALE_REFERENCE', valueArtifact: 'public-data/data.json.marketSurveys.naaim',
      sourceUrl: SOURCES.naaim, observation: '2026-07-22', detail: '84.02 is the last public value retained; the publisher now exposes public data with a three-month delay and reserves current/API access for subscribers, so no current value was inferred.'
    },
    {
      id: 'investors-intelligence', status: 'BLOCKED', sourceUrl: SOURCES.investorsIntelligence,
      detail: 'Official public page provides methodology/education but no current numeric reading; subscriber value required.'
    },
    {
      id: 'historical-universe-and-corporate-actions', status: 'PARTIAL_SOURCE_FOUND',
      sourceUrls: [SOURCES.nyseCorporateActions, SOURCES.nasdaqDailyList],
      detail: 'Official NYSE corporate-action reports and Nasdaq Daily List are identified, but a complete survivorship-free historical membership/factor feed is not publicly configured; no synthetic history inserted.'
    },
    {
      id: 'independent-quote-reconciliation', status: 'BLOCKED',
      sourceUrls: [SOURCES.nasdaqBreadth],
      detail: 'Official public pages describe delayed/real-time products but do not provide a configured redistribution-approved second quote plane for all 78 symbols.'
    },
    {
      id: 'official-exchange-breadth', status: 'BLOCKED',
      sourceUrls: [SOURCES.nyseStats, SOURCES.nasdaqBreadth],
      detail: 'Official pages expose market-statistics/movers products, but no stable public exchange-wide A/D and new-high/new-low payload was available for a durable adapter; AIO-universe breadth remains separately labeled.'
    },
    {
      id: 'earnings-revisions-and-guidance', status: 'PARTIAL_SOURCE_FOUND',
      sourceUrls: ['https://www.sec.gov/edgar/search/', 'https://www.sec.gov/Archives/edgar/data/'],
      detail: 'SEC filings support dated actuals and issuer guidance text; no official public consensus-revision series was found, so consensus values remain blocked.'
    },
    {
      id: 'short-interest-and-options-flow', status: 'PARTIAL_SOURCE_FOUND',
      sourceUrls: [SOURCES.finraShortInterest, SOURCES.finraApi, 'https://www.cboe.com/us/options/market_statistics/daily/'],
      detail: 'FINRA publishes the dataset and API documentation, but API credentials/entitlement are required for automated access; Cboe aggregate put/call remains the only configured public options metric. No per-symbol short/options flow was synthesized.'
    },
    {
      id: 'kr-macro-vkospi-supply', status: 'PARTIAL_SOURCE_FOUND',
      sourceUrls: [SOURCES.krxData, SOURCES.krxIndex],
      detail: 'KRX official data/index pages confirm the authoritative VKOSPI and market-data surfaces, but a public redistribution-ready adapter/rights path is not configured; no web/secondary VKOSPI value was promoted.'
    },
    {
      id: 'kr-export-reference', status: 'STALE_REFERENCE',
      valueArtifact: 'public-data/data.json.officialWebReferences.krExports',
      sourceUrl: OFFICIAL_WEB_REFERENCES.krExports.sourceUrl,
      observation: OFFICIAL_WEB_REFERENCES.krExports.observedAt,
      detail: 'Latest public official customs reference found: 2026-07-01~10 exports $29.8B, +53.9% YoY; reference-only and not a live API replacement.'
    }
  ]
};

const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
const aaii = await fetchAaiiSentiment(data.marketSurveys?.aaii || MARKET_SURVEYS.aaii);
const marketSurveys = { ...MARKET_SURVEYS, automatedCheckedAt: aaii.attemptedAt, aaii };
const structuralEvidence = {
  ...STRUCTURAL_EVIDENCE,
  entries: STRUCTURAL_EVIDENCE.entries.map((entry) => entry.id === 'aaii'
    ? {
        ...entry,
        status: aaii.status === 'current-reference' ? 'CURRENT_REFERENCE' : 'STALE_REFERENCE',
        observation: aaii.observedAt,
        detail: `${aaii.bullish}% bullish / ${aaii.neutral}% neutral / ${aaii.bearish}% bearish; automated official-public reference${aaii.relayUrl ? ' via bounded reader relay' : ''}, excluded from trading gates.`
      }
    : entry)
};
data.marketSurveys = marketSurveys;
  data.officialWebReferences = OFFICIAL_WEB_REFERENCES;
data.meta = data.meta || {};
data.meta.marketSurveysStatus = 'web-research-captured-reference';
data.meta.marketSurveysCheckedAt = CHECKED_AT;
data.meta.aaiiStatus = aaii.status;
data.meta.aaiiAttemptedAt = aaii.attemptedAt;
data.meta.aaiiFetchedAt = aaii.fetchedAt;
data.meta.aaiiObservedAt = aaii.observedAt;
data.meta.aaiiRelayUsed = !!aaii.relayUrl;
await atomicWriteFile(DATA_PATH, JSON.stringify(data, null, 1) + '\n', 'utf8');
await atomicWriteFile(EVIDENCE_PATH, JSON.stringify(structuralEvidence, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  ok: true,
  checkedAt: CHECKED_AT,
  aaii,
  naaim: MARKET_SURVEYS.naaim,
  evidenceEntries: STRUCTURAL_EVIDENCE.entries.length,
  artifacts: ['public-data/data.json', 'public-data/structural-data-research.json']
}));
