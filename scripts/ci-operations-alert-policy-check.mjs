import assert from 'node:assert/strict';
import { OPERATIONS_ALERT_POLICY, evaluateAiDailyUsageAlert, evaluateCoreArtifactStalenessAlert, evaluateOperationsAlerts, evaluateSiteUnavailableAlert } from './lib/operations-alert-policy.mjs';

const policy = OPERATIONS_ALERT_POLICY;
const addMs = (timestamp, amount) => new Date(Date.parse(timestamp) + amount).toISOString();
const start = '2026-09-01T00:00:00.000Z';
const siteAt = (elapsedMs) => evaluateSiteUnavailableAlert({ siteState: 'UNAVAILABLE', outageStartedAt: start, now: addMs(start, elapsedMs) });

assert.deepEqual(policy.statuses, ['ALERT', 'CLEAR', 'UNKNOWN']);
assert.equal(policy.alerts.siteUnavailable.thresholdMs, 24 * 60 * 60 * 1000);
assert.deepEqual(policy.alerts.siteUnavailable.requiredEvidence, ['explicitSiteState', 'now']);
assert.deepEqual(policy.alerts.siteUnavailable.conditionalEvidence, { whenSiteStateIs: 'UNAVAILABLE', required: ['outageStartedAt'] });
assert.equal(policy.alerts.coreArtifactStaleness.staleCompletedSessionsThreshold, 2);
assert.deepEqual(policy.alerts.coreArtifactStaleness.publicationTimestampFallbackOrder, [
  'public-data/market-snapshot.json.generatedAt',
  'public-data/market-snapshot.json.lastSuccessfulAt',
  'public-data/data.json.meta.marketSnapshotLastSuccessfulAt'
]);
assert.deepEqual(policy.alerts.coreArtifactStaleness.prohibitedTimestampSources, [
  'public-data/data.json.meta.generatedAt',
  'public-data/data.json.meta.marketSnapshotPublishedAt',
  'public-data/operations-status.json.generatedAt'
]);
assert.equal(policy.alerts.coreArtifactStaleness.doesNotChangeExistingFreshnessGateHours, 12);
assert.equal(policy.alerts.aiDailyUsage.thresholdPercent, 80);
assert.equal(policy.alerts.aiDailyUsage.capVariable, 'ANTHROPIC_DAILY_CAP');
assert.ok(Object.isFrozen(policy) && Object.isFrozen(policy.alerts) && Object.isFrozen(policy.statuses), 'exported policy must not be mutable');

// Site outage: exact below/at/above threshold, plus explicit and unknown states.
assert.equal(siteAt(24 * 60 * 60 * 1000 - 1).status, 'CLEAR', 'outage one millisecond below 24 hours must be clear');
assert.equal(siteAt(24 * 60 * 60 * 1000).status, 'ALERT', 'outage at exactly 24 hours must alert');
assert.equal(siteAt(24 * 60 * 60 * 1000 + 1).status, 'ALERT', 'outage above 24 hours must alert');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'AVAILABLE', now: start }).status, 'CLEAR');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'AVAILABLE' }).status, 'UNKNOWN', 'missing observation time must not clear an alert');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'AVAILABLE', now: 'invalid' }).status, 'UNKNOWN', 'malformed observation time must not clear an alert');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'UNAVAILABLE', now: start }).status, 'UNKNOWN', 'missing outage-start evidence must stay unknown');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'UNAVAILABLE', outageStartedAt: 'not-a-timestamp', now: start }).status, 'UNKNOWN');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'UNAVAILABLE', outageStartedAt: '2026-09-02T00:00:00Z', now: start }).reason, 'outage-start-in-future');
assert.equal(evaluateSiteUnavailableAlert({ siteState: 'UNAVAILABLE', outageStartedAt: start, now: '2026-02-30T00:00:00Z' }).status, 'UNKNOWN', 'impossible calendar dates must be rejected');
assert.equal(evaluateSiteUnavailableAlert({ outageStartedAt: start, now: '2026-09-05T00:00:00Z', deploymentAt: '2026-08-01T00:00:00Z' }).status, 'UNKNOWN', 'a stale deploy timestamp must not imply an outage');

// Core freshness counts only registered, completed market sessions.
const core = (market, artifactPublishedAt, now) => evaluateCoreArtifactStalenessAlert({ market, artifactPublishedAt, now });
assert.equal(core('NYSE', '2026-11-02T22:00:00Z', '2026-11-03T21:00:00Z').status, 'CLEAR', 'one completed session is below the two-session threshold');
assert.equal(core('NYSE', '2026-11-02T22:00:00Z', '2026-11-04T21:00:00Z').status, 'ALERT', 'two completed sessions must alert at the exact threshold');
assert.equal(core('NYSE', '2026-11-02T22:00:00Z', '2026-11-05T21:00:00Z').status, 'ALERT', 'three completed sessions are above the threshold');

// DST: Friday close is 20:00Z before the November offset change; Monday close is 21:00Z after it.
const dstBeforeClose = core('NYSE', '2026-10-30T19:59:59Z', '2026-11-02T20:59:59Z');
assert.equal(dstBeforeClose.status, 'CLEAR');
assert.equal(dstBeforeClose.completedStaleSessions, 1, 'the Monday session must not count before its DST-adjusted close');
const dstAtClose = core('NYSE', '2026-10-30T19:59:59Z', '2026-11-02T21:00:00Z');
assert.equal(dstAtClose.status, 'ALERT');
assert.deepEqual(dstAtClose.staleSessionDates, ['2026-10-30', '2026-11-02']);

// Thanksgiving and the registered early close: Thursday is closed and Friday completes at 13:00 ET.
const beforeHalfDayClose = core('NYSE', '2026-11-25T20:59:59Z', '2026-11-27T17:59:59Z');
assert.equal(beforeHalfDayClose.status, 'CLEAR');
assert.equal(beforeHalfDayClose.completedStaleSessions, 1);
const atHalfDayClose = core('NYSE', '2026-11-25T20:59:59Z', '2026-11-27T18:00:00Z');
assert.equal(atHalfDayClose.status, 'ALERT');
assert.deepEqual(atHalfDayClose.staleSessionDates, ['2026-11-25', '2026-11-27'], 'registered Thanksgiving holiday is skipped and the early close counts at 13:00 ET');
const artifactAfterRegularClose = core('NYSE', '2026-11-25T21:00:00Z', '2026-11-27T18:00:00Z');
assert.equal(artifactAfterRegularClose.status, 'CLEAR');
assert.deepEqual(artifactAfterRegularClose.staleSessionDates, ['2026-11-27'], 'publication at the Wednesday close covers that session');
const artifactAfterHalfDayClose = core('NYSE', '2026-11-27T18:00:00Z', '2026-11-30T21:00:00Z');
assert.equal(artifactAfterHalfDayClose.completedStaleSessions, 1, 'publication at the half-day close covers that session');

assert.equal(core('NYSE', '2026-11-02T22:00:00Z', '2026-11-03T20:59:59Z').completedStaleSessions, 0, 'today does not count before the registered close');
assert.equal(core('NYSE', '2026-11-02T22:00:00Z', '2026-11-03T21:00:00Z').completedStaleSessions, 1, 'today counts once the registered close passes');
assert.equal(core(undefined, '2026-11-02T22:00:00Z', '2026-11-04T21:00:00Z').status, 'UNKNOWN', 'market must be explicit');
assert.equal(core('US', '2026-11-02T22:00:00Z', '2026-11-04T21:00:00Z').status, 'UNKNOWN', 'only explicit NYSE or KRX labels are accepted');
assert.equal(core('toString', '2026-11-02T22:00:00Z', '2026-11-04T21:00:00Z').status, 'UNKNOWN', 'inherited property names are not valid market labels');
assert.equal(core('NYSE', null, '2026-11-04T21:00:00Z').status, 'UNKNOWN');
assert.equal(core('NYSE', 'invalid', '2026-11-04T21:00:00Z').status, 'UNKNOWN');
assert.equal(core('NYSE', '2026-11-02T22:00:00Z', undefined).status, 'UNKNOWN', 'missing evaluation time cannot clear or alert');
assert.equal(evaluateCoreArtifactStalenessAlert({ market: 'NYSE', generatedAt: '2026-11-02T22:00:00Z', now: '2026-11-04T21:00:00Z' }).status, 'UNKNOWN', 'attempt/status clocks cannot stand in for an explicit publication timestamp');
assert.equal(core('NYSE', '2026-11-05T21:00:00Z', '2026-11-04T21:00:00Z').reason, 'artifact-published-at-in-future');
const unknownYear = core('NYSE', '2027-12-31T22:00:00Z', '2028-01-04T22:00:00Z');
assert.equal(unknownYear.status, 'UNKNOWN', 'an unregistered 2028 calendar year must remain unknown');
assert.equal(unknownYear.reason, 'market-calendar-year-unknown');

// KRX calendar dates count only after the registered 15:30 KST close; weekends and its registered 2026-10-05 holiday do not count.
const krxBeforeClose = core('KRX', '2026-10-02T06:29:59Z', '2026-10-06T06:29:59Z');
assert.equal(krxBeforeClose.status, 'CLEAR');
assert.deepEqual(krxBeforeClose.staleSessionDates, ['2026-10-02']);
const krxAtClose = core('KRX', '2026-10-02T06:29:59Z', '2026-10-06T06:30:00Z');
assert.equal(krxAtClose.status, 'ALERT');
assert.deepEqual(krxAtClose.staleSessionDates, ['2026-10-02', '2026-10-06']);
assert.equal(core('KRX', '2027-12-31T06:30:00Z', '2028-01-03T06:30:00Z').status, 'UNKNOWN', 'an unregistered KRX calendar year must remain unknown');

// AI quota uses request counts divided by the actual daily request cap.
const ai = (requestCount) => evaluateAiDailyUsageAlert({ requestCount, usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-09-01T12:00:00.000Z' });
assert.equal(ai(79).status, 'CLEAR', '79% is below the usage alert threshold');
assert.equal(ai(80).status, 'ALERT', '80% is the inclusive usage alert threshold');
assert.equal(ai(81).status, 'ALERT', '81% is above the usage alert threshold');
assert.equal(evaluateAiDailyUsageAlert({ usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN', 'missing request count is unknown');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 80, anthropicDailyCap: 100, now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN', 'missing usage day is unknown');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 80, usageDayUtc: '2026-09-01', now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN', 'missing actual daily request cap is unknown');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: '80', usageDayUtc: '2026-09-01', anthropicDailyCap: '100', now: '2026-09-01T12:00:00Z' }).status, 'ALERT', 'canonical environment integer strings are accepted');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 80, usageDayUtc: '2026-08-31', anthropicDailyCap: 100, now: '2026-09-01T00:00:00Z' }).status, 'UNKNOWN', 'wrong UTC usage day is unknown');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 80, usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-02-30T12:00:00Z' }).status, 'UNKNOWN');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 101, usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN', 'usage above the configured cap is impossible evidence');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 1.5, usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 0, usageDayUtc: '2026-09-01', anthropicDailyCap: 0, now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 1, usageDayUtc: '2026-09-01', anthropicDailyCap: '1.5', now: '2026-09-01T12:00:00Z' }).status, 'UNKNOWN');
assert.equal(evaluateAiDailyUsageAlert({ requestCount: 80, usageDayUtc: '2026-09-01', anthropicDailyCap: 100 }).status, 'UNKNOWN', 'missing evaluation time cannot create a daily usage alert');

// Evaluators and the aggregate view do not mutate caller-owned evidence.
const evidence = {
  siteUnavailable: { siteState: 'UNAVAILABLE', outageStartedAt: start, now: addMs(start, 24 * 60 * 60 * 1000), metadata: { source: 'fixture' } },
  coreArtifactStaleness: { market: 'NYSE', artifactPublishedAt: '2026-11-02T22:00:00Z', now: '2026-11-04T21:00:00Z', metadata: { source: 'fixture' } },
  aiDailyUsage: { requestCount: 80, usageDayUtc: '2026-09-01', anthropicDailyCap: 100, now: '2026-09-01T12:00:00Z', metadata: { source: 'fixture' } }
};
const before = structuredClone(evidence);
evaluateSiteUnavailableAlert(evidence.siteUnavailable);
evaluateCoreArtifactStalenessAlert(evidence.coreArtifactStaleness);
evaluateAiDailyUsageAlert(evidence.aiDailyUsage);
const aggregate = evaluateOperationsAlerts(evidence);
assert.deepEqual(evidence, before, 'individual and aggregate evaluators must leave input objects unchanged');
assert.equal(aggregate.schemaVersion, policy.schemaVersion);
assert.deepEqual([aggregate.siteUnavailable.status, aggregate.coreArtifactStaleness.status, aggregate.aiDailyUsage.status], ['ALERT', 'ALERT', 'ALERT']);

console.log('[operations-alert-policy] PASS — three deterministic alert policies, calendar boundaries, unknown evidence, and immutability');
