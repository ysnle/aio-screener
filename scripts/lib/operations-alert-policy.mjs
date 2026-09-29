import importedPolicy from '../../architecture/operations-alert-policy.json' with { type: 'json' };
import { resolveMarketCalendarSession } from '../../src/ai/time/market-session.js';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const policy = deepFreeze(structuredClone(importedPolicy));
export const OPERATIONS_ALERT_POLICY = policy;
export const OPERATIONS_ALERT_STATUSES = Object.freeze([...policy.statuses]);

const SITE_POLICY = policy.alerts.siteUnavailable;
const CORE_POLICY = policy.alerts.coreArtifactStaleness;
const AI_POLICY = policy.alerts.aiDailyUsage;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function isCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 23 || offsetMinute > 59 || (match[9] === '-' && offsetHour === 0 && offsetMinute === 0)) return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseUtcDay(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isCalendarDate(year, month, day) ? value : null;
}

function alertResult(alertId, status, reason, details = {}) {
  return Object.freeze({ alertId, status, reason, ...details });
}

function utcDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dateInTimezone(timestamp, timeZone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return null;
  }
}

function nextDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  const midnight = new Date(0);
  midnight.setUTCHours(0, 0, 0, 0);
  midnight.setUTCFullYear(year, month - 1, day + 1);
  return midnight.toISOString().slice(0, 10);
}

function timezoneWallClockParts(timestamp, timeZone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second)
    };
  } catch (_) {
    return null;
  }
}

// Registered exchange closes are well away from DST transition hours. Solve
// the local wall clock against the runtime's named-zone rules rather than
// assuming a fixed UTC offset (NYSE changes offset across DST boundaries).
function localCloseTimestamp(date, close, timeZone) {
  if (typeof close !== 'string' || !/^\d{2}:\d{2}$/.test(close)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = close.split(':').map(Number);
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59) return null;
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = targetWallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = timezoneWallClockParts(candidate, timeZone);
    if (!local) return null;
    const localWallClock = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const delta = targetWallClock - localWallClock;
    if (delta === 0) return candidate;
    candidate += delta;
  }
  return null;
}

function parseInteger(value, { allowZero = true } = {}) {
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    number = Number(value);
  } else {
    return null;
  }
  if (!Number.isSafeInteger(number) || number < 0 || (!allowZero && number === 0)) return null;
  return number;
}

/**
 * Evaluate only an explicitly reported site state. `outageStartedAt` is
 * required when `siteState` is UNAVAILABLE; deploy timestamps are not used.
 */
export function evaluateSiteUnavailableAlert({ siteState, outageStartedAt, now } = {}) {
  const alertId = SITE_POLICY.id;
  const nowMs = parseTimestamp(now);
  if (nowMs == null) return alertResult(alertId, 'UNKNOWN', 'now-missing-or-invalid', { elapsedMs: null, thresholdMs: SITE_POLICY.thresholdMs });
  if (siteState === SITE_POLICY.availableState) {
    return alertResult(alertId, 'CLEAR', 'site-explicitly-available', { elapsedMs: 0, thresholdMs: SITE_POLICY.thresholdMs });
  }
  if (siteState !== SITE_POLICY.unavailableState) {
    return alertResult(alertId, 'UNKNOWN', siteState == null ? 'site-state-missing' : 'site-state-invalid', { elapsedMs: null, thresholdMs: SITE_POLICY.thresholdMs });
  }
  const startedMs = parseTimestamp(outageStartedAt);
  if (startedMs == null) return alertResult(alertId, 'UNKNOWN', outageStartedAt == null ? 'outage-start-missing' : 'outage-start-invalid', { elapsedMs: null, thresholdMs: SITE_POLICY.thresholdMs });
  if (startedMs > nowMs) return alertResult(alertId, 'UNKNOWN', 'outage-start-in-future', { elapsedMs: null, thresholdMs: SITE_POLICY.thresholdMs });
  const elapsedMs = nowMs - startedMs;
  const status = elapsedMs >= SITE_POLICY.thresholdMs ? 'ALERT' : 'CLEAR';
  return alertResult(alertId, status, status === 'ALERT' ? 'site-unavailable-at-least-24h' : 'site-unavailable-under-24h', { elapsedMs, thresholdMs: SITE_POLICY.thresholdMs });
}

/**
 * Count registered exchange sessions whose close has passed since the
 * artifact's publication time. Callers must pass a publication timestamp from
 * the declared core artifact fields, never an attempt or status-document clock.
 * Market must be explicitly NYSE or KRX; unregistered calendar dates remain
 * UNKNOWN rather than being inferred from weekdays.
 */
export function evaluateCoreArtifactStalenessAlert({ market, artifactPublishedAt, now } = {}) {
  const alertId = CORE_POLICY.id;
  const resolverMarket = typeof market === 'string' && Object.hasOwn(CORE_POLICY.supportedMarkets, market)
    ? CORE_POLICY.supportedMarkets[market]
    : null;
  if (!resolverMarket) return alertResult(alertId, 'UNKNOWN', market == null ? 'market-missing' : 'market-unsupported', { completedStaleSessions: null, thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold, staleSessionDates: Object.freeze([]) });
  const publicationMs = parseTimestamp(artifactPublishedAt);
  if (publicationMs == null) return alertResult(alertId, 'UNKNOWN', artifactPublishedAt == null ? 'artifact-published-at-missing' : 'artifact-published-at-invalid', { completedStaleSessions: null, thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold, staleSessionDates: Object.freeze([]) });
  const nowMs = parseTimestamp(now);
  if (nowMs == null) return alertResult(alertId, 'UNKNOWN', 'now-missing-or-invalid', { completedStaleSessions: null, thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold, staleSessionDates: Object.freeze([]) });
  if (publicationMs > nowMs) return alertResult(alertId, 'UNKNOWN', 'artifact-published-at-in-future', { completedStaleSessions: null, thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold, staleSessionDates: Object.freeze([]) });

  const firstDate = dateInTimezone(publicationMs, market === 'NYSE' ? 'America/New_York' : 'Asia/Seoul');
  const lastDate = dateInTimezone(nowMs, market === 'NYSE' ? 'America/New_York' : 'Asia/Seoul');
  if (!firstDate || !lastDate) return alertResult(alertId, 'UNKNOWN', 'market-timezone-unavailable', { completedStaleSessions: null, thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold, staleSessionDates: Object.freeze([]) });

  const staleSessionDates = [];
  for (let date = firstDate; date <= lastDate; date = nextDate(date)) {
    const session = resolveMarketCalendarSession({ market: resolverMarket, date });
    if (session.status === 'unknown') {
      return alertResult(alertId, 'UNKNOWN', 'market-calendar-year-unknown', {
        market,
        unknownCalendarDate: date,
        completedStaleSessions: null,
        thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold,
        staleSessionDates: Object.freeze(staleSessionDates)
      });
    }
    if (session.status === 'closed') continue;
    if (session.status !== 'open') {
      return alertResult(alertId, 'UNKNOWN', 'market-calendar-status-invalid', {
        market,
        unknownCalendarDate: date,
        completedStaleSessions: null,
        thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold,
        staleSessionDates: Object.freeze(staleSessionDates)
      });
    }
    const closeMs = localCloseTimestamp(date, session.close, session.timezone);
    if (closeMs == null) {
      return alertResult(alertId, 'UNKNOWN', 'market-calendar-close-invalid', {
        market,
        unknownCalendarDate: date,
        completedStaleSessions: null,
        thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold,
        staleSessionDates: Object.freeze(staleSessionDates)
      });
    }
    // The artifact covers a session if it was generated at or after that
    // registered close. The current session is not complete before its close.
    if (nowMs >= closeMs && publicationMs < closeMs) staleSessionDates.push(date);
  }

  const completedStaleSessions = staleSessionDates.length;
  const status = completedStaleSessions >= CORE_POLICY.staleCompletedSessionsThreshold ? 'ALERT' : 'CLEAR';
  return alertResult(alertId, status, status === 'ALERT' ? 'two-or-more-completed-sessions-stale' : 'fewer-than-two-completed-sessions-stale', {
    market,
    completedStaleSessions,
    thresholdSessions: CORE_POLICY.staleCompletedSessionsThreshold,
    staleSessionDates: Object.freeze(staleSessionDates)
  });
}

/**
 * Compare current UTC-day request usage to the actual configured
 * ANTHROPIC_DAILY_CAP. Numeric strings are accepted for environment values
 * only when they are canonical non-negative decimal integers.
 */
export function evaluateAiDailyUsageAlert({ requestCount, usageDayUtc, anthropicDailyCap, now } = {}) {
  const alertId = AI_POLICY.id;
  const nowMs = parseTimestamp(now);
  if (nowMs == null) return alertResult(alertId, 'UNKNOWN', 'now-missing-or-invalid', { requestCount: null, anthropicDailyCap: null, usageDayUtc: null, thresholdPercent: AI_POLICY.thresholdPercent });
  const count = parseInteger(requestCount);
  if (count == null) return alertResult(alertId, 'UNKNOWN', requestCount == null ? 'request-count-missing' : 'request-count-invalid', { requestCount: null, anthropicDailyCap: null, usageDayUtc: null, thresholdPercent: AI_POLICY.thresholdPercent });
  const cap = parseInteger(anthropicDailyCap, { allowZero: false });
  if (cap == null) return alertResult(alertId, 'UNKNOWN', anthropicDailyCap == null ? 'daily-cap-missing' : 'daily-cap-invalid', { requestCount: count, anthropicDailyCap: null, usageDayUtc: null, thresholdPercent: AI_POLICY.thresholdPercent });
  const day = parseUtcDay(usageDayUtc);
  if (day == null) return alertResult(alertId, 'UNKNOWN', usageDayUtc == null ? 'usage-day-missing' : 'usage-day-invalid', { requestCount: count, anthropicDailyCap: cap, usageDayUtc: null, thresholdPercent: AI_POLICY.thresholdPercent });
  if (day !== utcDay(nowMs)) return alertResult(alertId, 'UNKNOWN', 'usage-day-does-not-match-current-utc-day', { requestCount: count, anthropicDailyCap: cap, usageDayUtc: day, thresholdPercent: AI_POLICY.thresholdPercent });
  if (count > cap) return alertResult(alertId, 'UNKNOWN', 'request-count-exceeds-daily-cap', { requestCount: count, anthropicDailyCap: cap, usageDayUtc: day, thresholdPercent: AI_POLICY.thresholdPercent });

  const isAtOrAboveThreshold = BigInt(count) * 100n >= BigInt(cap) * BigInt(AI_POLICY.thresholdPercent);
  const status = isAtOrAboveThreshold ? 'ALERT' : 'CLEAR';
  return alertResult(alertId, status, status === 'ALERT' ? 'daily-request-usage-at-least-80-percent' : 'daily-request-usage-under-80-percent', {
    requestCount: count,
    anthropicDailyCap: cap,
    usageDayUtc: day,
    usagePercent: (count / cap) * 100,
    thresholdPercent: AI_POLICY.thresholdPercent
  });
}

/** Evaluate the three policies without changing or enriching their evidence. */
export function evaluateOperationsAlerts({ siteUnavailable, coreArtifactStaleness, aiDailyUsage } = {}) {
  return Object.freeze({
    schemaVersion: policy.schemaVersion,
    siteUnavailable: evaluateSiteUnavailableAlert(siteUnavailable),
    coreArtifactStaleness: evaluateCoreArtifactStalenessAlert(coreArtifactStaleness),
    aiDailyUsage: evaluateAiDailyUsageAlert(aiDailyUsage)
  });
}
