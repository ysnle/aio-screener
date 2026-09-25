import { readFile } from 'node:fs/promises';
import { buildSloWindow, deriveExpectedRunsPerDay, parseCronRunsPerDay } from './build-operations-slo-window.mjs';

const artifact = JSON.parse(await readFile(new URL('../public-data/operations-slo-window.json', import.meta.url), 'utf8'));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };
const allowedWindowStates = ['INSUFFICIENT_EVIDENCE', 'PASS', 'FAIL'];
const allowedLaneStates = ['MEASURED', 'DEGRADED', 'NOT_OBSERVED'];

check('P1166 schema is the per-domain v3 contract', artifact.schemaVersion === 'operations-slo-window.v3');
check('P1166 7-day window is explicit', artifact.windows?.['7d']?.requiredDays === 7 && allowedWindowStates.includes(artifact.windows?.['7d']?.status));
check('P1166 30-day window is explicit', artifact.windows?.['30d']?.requiredDays === 30 && allowedWindowStates.includes(artifact.windows?.['30d']?.status));
check('P1166 targets include 30-day success and exact identity', artifact.targets?.artifactSuccessRate30d === 0.995 && artifact.targets?.watchdogSuccessRate30d === 0.995 && artifact.targets?.exactSourceIdentityCoverage === 1);
check('P1166 targets declare the scheduled arrival lower bound', typeof artifact.targets?.scheduledArrivalRate === 'number' && artifact.targets.scheduledArrivalRate > 0 && artifact.targets.scheduledArrivalRate <= 1);
check('P1166 failure/recovery/dedupe fields exist', ['failureCount', 'recoveryCount', 'consecutiveFailuresMax', 'dedupedAlerts'].every(key => Object.hasOwn(artifact.failureRecovery || {}, key)));
if (artifact.collectionMode !== 'SOURCE_TEMPLATE_ONLY') check('P1166 runtime alert evidence is measured and internally consistent', typeof artifact.failureRecovery?.dedupedAlerts?.deduped === 'boolean' && artifact.failureRecovery.dedupedAlerts?.source === 'github-issues-api' && ((artifact.certification?.alertDedupe === 'PASS') === artifact.failureRecovery.dedupedAlerts.deduped));
check('P1166 local fixture cannot promote live', artifact.revisionLanes?.localFixturePromotesLive === false && artifact.certification?.publicPromotionAllowed === false);

// P1166 (17 작업 단위 2 / 06 O02): 도메인별 lane과 조회 완전성이 발행된다.
check('P1166 every domain lane is published', ['market', 'screener', 'watchdog'].every(id => {
  const lane = artifact.domains?.[id];
  return lane && lane.required === true && typeof lane.workflow === 'string' && Object.hasOwn(lane, 'observedRuns') && Object.hasOwn(lane, 'scheduledArrivalRate') && allowedLaneStates.includes(lane.status);
}));
check('P1166 query completeness is published per workflow', ['market', 'screener', 'watchdog'].every(id => {
  const item = artifact.query?.completeness?.[id];
  return item && typeof item.paginationComplete === 'boolean' && typeof item.pagesFetched === 'number' && Object.hasOwn(item, 'truncated');
}));
check('P1166 each window publishes per-domain coverage', ['7d', '30d'].every(key => {
  const coverage = artifact.windows?.[key]?.coverage;
  return coverage && Array.isArray(coverage.requiredDomains) && Array.isArray(coverage.missingDomains) && typeof coverage.everyRequiredDomainObserved === 'boolean';
}));

if (artifact.windows?.['30d']?.status === 'PASS') {
  const window30 = artifact.windows['30d'];
  check('P1166 30-day pass has full measured coverage', window30.observedDays >= 30 && window30.artifact?.successRate >= 0.995 && window30.watchdog?.successRate >= 0.995 && window30.artifact?.exactSourceIdentityCoverage === 1 && window30.watchdog?.exactSourceIdentityCoverage === 1);
  check('P1166 30-day pass requires every required domain measured', window30.coverage?.missingDomains?.length === 0 && window30.coverage?.incompleteSources?.length === 0 && window30.coverage.requiredDomains.every(id => window30.domains?.[id]?.status === 'MEASURED'));
}
if (artifact.collectionMode === 'SOURCE_TEMPLATE_ONLY') check('P1166 source template never certifies', artifact.status === 'NOT_CERTIFIED' && artifact.certification?.thirtyDaySlo === 'OPERATOR_REQUIRED');

// 정책 분모는 workflow의 실제 schedule에서 파생한다(문서 cadence 복제 금지).
const cadence = {
  market: await deriveExpectedRunsPerDay('refresh-data.yml'),
  screener: await deriveExpectedRunsPerDay('refresh-screener.yml'),
  watchdog: await deriveExpectedRunsPerDay('data-watchdog.yml')
};
check('P1166 declared cadence is derivable from every workflow schedule', Object.values(cadence).every(value => Number.isFinite(value) && value > 0));
check('P1166 cron expansion matches the checked-in schedules', parseCronRunsPerDay('17,47 * * * *') === 48 && parseCronRunsPerDay('13 7 * * *') === 1 && parseCronRunsPerDay('41 */6 * * *') === 4 && parseCronRunsPerDay('23 * * * *') === 24);
check('P1166 non-daily cron is not converted into a daily count', parseCronRunsPerDay('13 4 * * 1') === null);

const dayMs = 86400000;
const fixtureRuns = (perDay, days, at) => {
  const runs = [];
  for (let day = 0; day < days; day += 1) {
    for (let slot = 0; slot < perDay; slot += 1) {
      runs.push({
        created_at: new Date(at.getTime() - (day + slot / perDay) * dayMs).toISOString(),
        conclusion: 'success',
        head_sha: 'a'.repeat(40),
        event: 'schedule'
      });
    }
  }
  return runs;
};
const completeQuery = Object.fromEntries(['market', 'screener', 'watchdog'].map(id => [id, { paginationComplete: true, pagesFetched: 1, truncated: false }]));
const at = new Date('2026-09-21T00:00:00.000Z');

// 문서 17의 합성 반증(automation-slo-repro.json): market 매일 1회 성공 30일, screener 0회,
// watchdog 매일 1회 성공 30일. 예전 집계는 이 fixture를 CERTIFIED_WINDOW로 만들었다.
const reproObserved = {
  market: fixtureRuns(1, 30, at),
  screener: [],
  watchdog: fixtureRuns(1, 30, at)
};
const repro = buildSloWindow({ observed: reproObserved, cadencePerDay: cadence, query: completeQuery, alertEvidence: { deduped: true, source: 'github-issues-api' }, now: at });
check('P1166 O04 repro: a zero-run required domain cannot be certified', repro.status !== 'CERTIFIED_WINDOW');

// R24-07/P1242: push 등 다른 trigger로 채운 창은 예정 도착이 아니다. 종전 집계는
// workflow_dispatch만 제외하고 나머지를 전부 scheduled로 세어, 30일간 push 성공만 있는 lane도
// MEASURED·CERTIFIED_WINDOW가 될 수 있었다(06 O02·O04).
const pushOnly = buildSloWindow({
  observed: Object.fromEntries(['market', 'screener', 'watchdog']
    .map((id) => [id, fixtureRuns(1, 30, at).map((run) => ({ ...run, event: 'push' }))])),
  cadencePerDay: cadence,
  query: completeQuery,
  alertEvidence: { deduped: true, source: 'github-issues-api' },
  now: at
});
check('P1242 R24-07: a push-only window is not a scheduled arrival', pushOnly.status !== 'CERTIFIED_WINDOW'
  && ['market', 'screener', 'watchdog'].every((id) => pushOnly.windows?.['30d']?.domains?.[id]?.status === 'NOT_OBSERVED')
  && ['market', 'screener', 'watchdog'].every((id) => (pushOnly.windows?.['30d']?.domains?.[id]?.nonScheduledRunsExcluded || 0) === 30)
  && pushOnly.windows?.['30d']?.domains?.market?.nonScheduledEventBreakdown?.push === 30);
check('P1166 O04 repro: the 30-day window is not a pass', repro.windows['30d'].status !== 'PASS');
check('P1166 O04 repro: the missing domain is named', (repro.windows['30d'].coverage?.missingDomains || []).includes('screener'));
check('P1166 O04 repro: the screener lane is NOT_OBSERVED', repro.windows['30d'].domains.screener.status === 'NOT_OBSERVED');

// 게이트가 항상 실패하는 것은 방지가 아니다: 예정 cadence를 채우고 조회가 완전하면 PASS여야 한다.
const healthy = buildSloWindow({
  observed: {
    market: fixtureRuns(cadence.market, 30, at),
    screener: fixtureRuns(cadence.screener, 30, at),
    watchdog: fixtureRuns(cadence.watchdog, 30, at)
  },
  cadencePerDay: cadence,
  query: completeQuery,
  alertEvidence: { deduped: true, source: 'github-issues-api' },
  now: at
});
check('P1166 a fully observed window still certifies', healthy.status === 'CERTIFIED_WINDOW' && healthy.windows['30d'].status === 'PASS');

// 조회가 잘린 세대는 성공률이 완벽해도 인증하지 않는다(06 O02).
const truncated = buildSloWindow({
  observed: {
    market: fixtureRuns(cadence.market, 30, at),
    screener: fixtureRuns(cadence.screener, 30, at),
    watchdog: fixtureRuns(cadence.watchdog, 30, at)
  },
  cadencePerDay: cadence,
  query: { ...completeQuery, screener: { paginationComplete: false, pagesFetched: 10, truncated: true } },
  alertEvidence: { deduped: true, source: 'github-issues-api' },
  now: at
});
check('P1166 a truncated query cannot be certified', truncated.status !== 'CERTIFIED_WINDOW' && (truncated.windows['30d'].coverage?.incompleteSources || []).includes('screener'));

// 수동 실행은 예정 도착 분모를 유리하게 바꾸지 못한다(17).
const manualOnly = buildSloWindow({
  observed: {
    market: fixtureRuns(cadence.market, 30, at),
    screener: [...fixtureRuns(0, 0, at), ...Array.from({ length: 120 }, (unused, index) => ({ created_at: new Date(at.getTime() - index * 60000).toISOString(), conclusion: 'success', head_sha: 'b'.repeat(40), event: 'workflow_dispatch' }))],
    watchdog: fixtureRuns(cadence.watchdog, 30, at)
  },
  cadencePerDay: cadence,
  query: completeQuery,
  alertEvidence: { deduped: true, source: 'github-issues-api' },
  now: at
});
check('P1166 manual runs do not substitute for scheduled arrivals', manualOnly.status !== 'CERTIFIED_WINDOW' && manualOnly.windows['30d'].domains.screener.observedRuns === 0);

if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log(`Operations SLO window check OK: 7d=${artifact.windows['7d'].status}, 30d=${artifact.windows['30d'].status}, certification=${artifact.certification?.thirtyDaySlo}, per-domain lanes + O04 repro guard verified.`);
