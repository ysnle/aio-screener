import endpoints from '../../architecture/worker-endpoints.json' with { type: 'json' };
import {
  OPERATIONS_ALERT_POLICY,
  evaluateAiDailyUsageAlert,
  evaluateCoreArtifactStalenessAlert,
  evaluateSiteUnavailableAlert
} from '../lib/operations-alert-policy.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PAGES_BASE = 'https://ysnle.github.io/aio-screener';
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

const SAFE_REASONS = Object.freeze({
  siteUnavailable: new Set([
    'now-missing-or-invalid',
    'site-explicitly-available',
    'site-state-missing',
    'site-state-invalid',
    'outage-start-missing',
    'outage-start-invalid',
    'outage-start-in-future',
    'site-unavailable-at-least-24h',
    'site-unavailable-under-24h',
    'source-evidence-invalid'
  ]),
  coreArtifactStaleness: new Set([
    'one-or-more-markets-two-session-stale',
    'all-markets-under-two-session-threshold',
    'one-or-more-markets-unknown',
    'market-evidence-invalid'
  ]),
  aiDailyUsage: new Set([
    'operator-token-missing',
    'usage-source-unavailable',
    'usage-evidence-invalid',
    'now-missing-or-invalid',
    'request-count-missing',
    'request-count-invalid',
    'daily-cap-missing',
    'daily-cap-invalid',
    'usage-day-missing',
    'usage-day-invalid',
    'usage-day-does-not-match-current-utc-day',
    'request-count-exceeds-daily-cap',
    'daily-request-usage-at-least-80-percent',
    'daily-request-usage-under-80-percent',
    'source-evidence-invalid'
  ])
});

const CORE_EVALUATION_REASONS = new Set([
  'market-missing',
  'market-unsupported',
  'artifact-published-at-missing',
  'artifact-published-at-invalid',
  'artifact-published-at-in-future',
  'now-missing-or-invalid',
  'market-timezone-unavailable',
  'market-calendar-year-unknown',
  'market-calendar-status-invalid',
  'market-calendar-close-invalid',
  'two-or-more-completed-sessions-stale',
  'fewer-than-two-completed-sessions-stale'
]);

function isCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function isValidTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== 'Z') {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 23 || offsetMinute > 59 || (match[9] === '-' && offsetHour === 0 && offsetMinute === 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function observationTime(clock) {
  try {
    const value = clock();
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
    return typeof value === 'string' ? value : undefined;
  } catch (_) {
    return undefined;
  }
}

function pagesRoot(baseUrl) {
  const root = new URL(baseUrl || DEFAULT_PAGES_BASE);
  root.search = '';
  root.hash = '';
  root.pathname = `${root.pathname.replace(/\/+$/, '')}/`;
  return root;
}

async function fetchJson(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { method: 'GET', cache: 'no-store' });
    if (!response || response.ok !== true) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}

async function probeSite(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { method: 'GET', cache: 'no-store' });
    if (!response || typeof response.ok !== 'boolean') return undefined;
    return response.ok ? 'AVAILABLE' : 'UNAVAILABLE';
  } catch (_) {
    return undefined;
  }
}

function candidateTimestamp(source, marketSnapshot, data) {
  switch (source) {
    case 'public-data/market-snapshot.json.generatedAt': return marketSnapshot?.generatedAt;
    case 'public-data/market-snapshot.json.lastSuccessfulAt': return marketSnapshot?.lastSuccessfulAt;
    case 'public-data/data.json.meta.marketSnapshotLastSuccessfulAt': return data?.meta?.marketSnapshotLastSuccessfulAt;
    default: return undefined;
  }
}

function selectPublicationTimestamp(marketSnapshot, data) {
  const fallbackOrder = OPERATIONS_ALERT_POLICY.alerts.coreArtifactStaleness.publicationTimestampFallbackOrder;
  for (const source of fallbackOrder) {
    const value = candidateTimestamp(source, marketSnapshot, data);
    if (isValidTimestamp(value)) return value;
  }
  return undefined;
}

function summarize(alert, safeReasons) {
  const status = ['ALERT', 'CLEAR', 'UNKNOWN'].includes(alert?.status) ? alert.status : 'UNKNOWN';
  const reason = safeReasons.has(alert?.reason) ? alert.reason : 'source-evidence-invalid';
  return Object.freeze({ status, reason });
}

function missingSummary(reason) {
  return Object.freeze({ status: 'UNKNOWN', reason });
}

async function collectAiUsage(fetchImpl, token, now, url) {
  if (typeof token !== 'string' || token.length === 0) return missingSummary('operator-token-missing');
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'X-AIO-Operator-Token': token }
    });
    if (!response || response.ok !== true) return missingSummary('usage-source-unavailable');
    let evidence;
    try {
      evidence = await response.json();
    } catch (_) {
      return missingSummary('usage-source-unavailable');
    }
    if (!evidence || evidence.schemaVersion !== 'aio-operator-ai-usage.v1') {
      return missingSummary('usage-evidence-invalid');
    }
    return summarize(evaluateAiDailyUsageAlert({
      requestCount: evidence.requestCount,
      usageDayUtc: evidence.usageDayUtc,
      anthropicDailyCap: evidence.anthropicDailyCap,
      now
    }), SAFE_REASONS.aiDailyUsage);
  } catch (_) {
    return missingSummary('usage-source-unavailable');
  }
}

function summarizeMarketAlerts(alerts) {
  const results = alerts.map((alert) => summarize(alert, CORE_EVALUATION_REASONS));
  if (results.some((result) => result.status === 'ALERT')) {
    return Object.freeze({ status: 'ALERT', reason: 'one-or-more-markets-two-session-stale' });
  }
  if (results.some((result) => result.status !== 'CLEAR')) {
    return Object.freeze({ status: 'UNKNOWN', reason: 'one-or-more-markets-unknown' });
  }
  return Object.freeze({ status: 'CLEAR', reason: 'all-markets-under-two-session-threshold' });
}

/**
 * Fetch the deployed public sources and return only policy status/reason pairs.
 * No evidence is persisted. Inject `fetchImpl` and `clock` for deterministic
 * contract checks; AI usage is requested only when a private operator token is
 * explicitly supplied.
 */
export async function collectOperationsAlertObservations({
  fetchImpl = globalThis.fetch,
  clock = () => new Date(),
  pagesBaseUrl = process.env.AIO_LIVE_BASE || DEFAULT_PAGES_BASE,
  markets = ['NYSE', 'KRX'],
  operatorToken,
  outageStartedAt
} = {}) {
  const now = observationTime(clock);
  let root;
  let workerUsageUrl;
  try {
    root = pagesRoot(pagesBaseUrl);
    const proxyBase = new URL(endpoints.proxy.baseUrl);
    const proxyPath = endpoints.proxy.operatorAiUsagePath;
    workerUsageUrl = new URL(proxyPath, proxyBase).href;
  } catch (_) {
    return Object.freeze({
      siteUnavailable: missingSummary('site-state-missing'),
      coreArtifactStaleness: missingSummary('artifact-published-at-missing'),
      aiDailyUsage: missingSummary(typeof operatorToken === 'string' && operatorToken.length > 0 ? 'usage-source-unavailable' : 'operator-token-missing')
    });
  }

  const [siteState, marketSnapshot, data] = await Promise.all([
    probeSite(fetchImpl, root.href),
    fetchJson(fetchImpl, new URL('public-data/market-snapshot.json', root).href),
    fetchJson(fetchImpl, new URL('public-data/data.json', root).href)
  ]);
  const aiDailyUsage = await collectAiUsage(fetchImpl, operatorToken, now, workerUsageUrl);
  const artifactPublishedAt = selectPublicationTimestamp(marketSnapshot, data);
  const normalizedMarkets = Array.isArray(markets)
    && markets.length > 0
    && markets.every((value) => value === 'NYSE' || value === 'KRX')
    && new Set(markets).size === markets.length
    ? markets
    : null;
  const coreArtifactStaleness = normalizedMarkets
    ? summarizeMarketAlerts(normalizedMarkets.map((market) => evaluateCoreArtifactStalenessAlert({ market, artifactPublishedAt, now })))
    : missingSummary('market-evidence-invalid');

  return Object.freeze({
    siteUnavailable: summarize(evaluateSiteUnavailableAlert({ siteState, outageStartedAt, now }), SAFE_REASONS.siteUnavailable),
    coreArtifactStaleness,
    aiDailyUsage
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const result = await collectOperationsAlertObservations({
    markets: process.env.AIO_OPERATIONS_MARKETS?.split(',').map((value) => value.trim()).filter(Boolean),
    operatorToken: process.env.AIO_OPERATOR_TOKEN,
    outageStartedAt: process.env.AIO_SITE_OUTAGE_STARTED_AT
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
