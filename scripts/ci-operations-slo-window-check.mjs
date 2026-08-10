import { readFile } from 'node:fs/promises';
const artifact = JSON.parse(await readFile(new URL('../public-data/operations-slo-window.json', import.meta.url), 'utf8'));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };
check('7-day window is explicit', artifact.windows?.['7d']?.requiredDays === 7 && artifact.windows?.['7d']?.status === 'STALE');
check('30-day window is explicit', artifact.windows?.['30d']?.requiredDays === 30 && artifact.windows?.['30d']?.status === 'STALE');
check('failure/recovery/dedupe fields exist', ['failureCount', 'recoveryCount', 'dedupedAlerts'].every(key => Object.hasOwn(artifact.failureRecovery || {}, key)));
check('local fixture cannot promote live', artifact.revisionLanes?.localFixturePromotesLive === false && artifact.revisionLanes?.liveRevision === null);
if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Operations SLO window check OK: explicit 7/30-day, failure/recovery/dedupe, and local/live separation passed.');
