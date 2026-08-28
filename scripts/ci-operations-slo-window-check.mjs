import { readFile } from 'node:fs/promises';
const artifact = JSON.parse(await readFile(new URL('../public-data/operations-slo-window.json', import.meta.url), 'utf8'));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };
const allowedWindowStates = ['INSUFFICIENT_EVIDENCE', 'PASS', 'FAIL'];
check('schema is the measured/template v2 contract', artifact.schemaVersion === 'operations-slo-window.v2');
check('7-day window is explicit', artifact.windows?.['7d']?.requiredDays === 7 && allowedWindowStates.includes(artifact.windows?.['7d']?.status));
check('30-day window is explicit', artifact.windows?.['30d']?.requiredDays === 30 && allowedWindowStates.includes(artifact.windows?.['30d']?.status));
check('targets include 30-day success and exact identity', artifact.targets?.artifactSuccessRate30d === 0.995 && artifact.targets?.watchdogSuccessRate30d === 0.995 && artifact.targets?.exactSourceIdentityCoverage === 1);
check('failure/recovery/dedupe fields exist', ['failureCount', 'recoveryCount', 'consecutiveFailuresMax', 'dedupedAlerts'].every(key => Object.hasOwn(artifact.failureRecovery || {}, key)));
if (artifact.collectionMode !== 'SOURCE_TEMPLATE_ONLY') check('runtime alert evidence is measured and internally consistent', typeof artifact.failureRecovery?.dedupedAlerts?.deduped === 'boolean' && artifact.failureRecovery.dedupedAlerts?.source === 'github-issues-api' && ((artifact.certification?.alertDedupe === 'PASS') === artifact.failureRecovery.dedupedAlerts.deduped));
check('local fixture cannot promote live', artifact.revisionLanes?.localFixturePromotesLive === false && artifact.certification?.publicPromotionAllowed === false);
if (artifact.windows?.['30d']?.status === 'PASS') {
  check('30-day pass has full measured coverage', artifact.windows['30d'].observedDays >= 30 && artifact.windows['30d'].artifact?.successRate >= 0.995 && artifact.windows['30d'].watchdog?.successRate >= 0.995 && artifact.windows['30d'].artifact?.exactSourceIdentityCoverage === 1 && artifact.windows['30d'].watchdog?.exactSourceIdentityCoverage === 1);
}
if (artifact.collectionMode === 'SOURCE_TEMPLATE_ONLY') check('source template never certifies', artifact.status === 'NOT_CERTIFIED' && artifact.certification?.thirtyDaySlo === 'OPERATOR_REQUIRED');
if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log(`Operations SLO window check OK: 7d=${artifact.windows['7d'].status}, 30d=${artifact.windows['30d'].status}, certification=${artifact.certification?.thirtyDaySlo}.`);
