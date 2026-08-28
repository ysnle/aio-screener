import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const output = outIndex >= 0 ? args[outIndex + 1] : null;
if (!output) throw new Error('usage: node scripts/build-operations-slo-window.mjs --out <path>');
const repository = process.env.GITHUB_REPOSITORY || 'ysnle/aio-screener';
const token = process.env.GITHUB_TOKEN || '';
const now = new Date();
const cutoff = new Date(now.getTime() - 30 * 86400000);
const workflows = {
  refreshMarket: 'refresh-data.yml',
  refreshScreener: 'refresh-screener.yml',
  watchdog: 'data-watchdog.yml'
};

async function fetchRuns(file) {
  const runs = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/repos/${repository}/actions/workflows/${file}/runs?status=completed&per_page=100&page=${page}&created=%3E%3D${cutoff.toISOString().slice(0, 10)}`;
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`${file} runs HTTP ${response.status}`);
    const pageRuns = (await response.json()).workflow_runs || [];
    runs.push(...pageRuns.filter((run) => run.status === 'completed' && new Date(run.created_at) >= cutoff));
    if (pageRuns.length < 100) break;
  }
  return runs;
}

async function fetchAlertIssues() {
  const issues = [];
  for (let page = 1; page <= 3; page += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=all&labels=aio-operations-alert&per_page=100&page=${page}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`operations alert issues HTTP ${response.status}`);
    const pageIssues = (await response.json()).filter((issue) => !issue.pull_request);
    issues.push(...pageIssues);
    if (pageIssues.length < 100) break;
  }
  const markers = issues.map((issue) => String(issue.body || '').match(/<!-- aio-operations-alert:([^>]+) -->/)?.[1]).filter(Boolean);
  const uniqueMarkers = new Set(markers);
  return {
    issueCount: issues.length,
    workflowCount: uniqueMarkers.size,
    duplicateMarkerCount: markers.length - uniqueMarkers.size,
    openCount: issues.filter((issue) => issue.state === 'open').length,
    closedCount: issues.filter((issue) => issue.state === 'closed').length,
    deduped: markers.length === uniqueMarkers.size,
    source: 'github-issues-api'
  };
}

const [observed, alertEvidence] = await Promise.all([
  Object.fromEntries(await Promise.all(Object.entries(workflows).map(async ([id, file]) => [id, await fetchRuns(file)]))),
  fetchAlertIssues()
]);
const round = (value) => value == null ? null : Math.round(value * 1_000_000) / 1_000_000;
const summarize = (runs) => {
  const completed = runs.length;
  const succeeded = runs.filter((run) => run.conclusion === 'success').length;
  return {
    completed,
    succeeded,
    failed: completed - succeeded,
    successRate: completed ? round(succeeded / completed) : null,
    observedDays: new Set(runs.map((run) => String(run.created_at).slice(0, 10))).size,
    exactSourceIdentityCoverage: completed ? round(runs.filter((run) => /^[0-9a-f]{40}$/.test(run.head_sha || '')).length / completed) : null
  };
};
const artifactRuns = [...observed.refreshMarket, ...observed.refreshScreener];
const metrics = { artifact: summarize(artifactRuns), watchdog: summarize(observed.watchdog) };
function windowSummary(days) {
  const since = new Date(now.getTime() - days * 86400000);
  const artifact = summarize(artifactRuns.filter((run) => new Date(run.created_at) >= since));
  const watchdog = summarize(observed.watchdog.filter((run) => new Date(run.created_at) >= since));
  const enough = artifact.observedDays >= days && watchdog.observedDays >= days;
  const passing = artifact.successRate >= 0.995 && watchdog.successRate >= 0.995 && artifact.exactSourceIdentityCoverage === 1 && watchdog.exactSourceIdentityCoverage === 1;
  return { requiredDays: days, observedDays: Math.min(artifact.observedDays, watchdog.observedDays), status: !enough ? 'INSUFFICIENT_EVIDENCE' : passing ? 'PASS' : 'FAIL', artifact, watchdog, source: 'github-actions-api' };
}
const orderedWatchdog = [...observed.watchdog].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
let recoveryCount = 0;
let currentFailures = 0;
let consecutiveFailuresMax = 0;
for (const run of orderedWatchdog) {
  if (run.conclusion === 'success') {
    if (currentFailures > 0) recoveryCount += 1;
    currentFailures = 0;
  } else {
    currentFailures += 1;
    consecutiveFailuresMax = Math.max(consecutiveFailuresMax, currentFailures);
  }
}
const windows = { '7d': windowSummary(7), '30d': windowSummary(30) };
const artifact = {
  schemaVersion: 'operations-slo-window.v2',
  status: windows['30d'].status === 'PASS' ? 'CERTIFIED_WINDOW' : 'NOT_CERTIFIED',
  observedAt: now.toISOString(),
  query: { repository, cutoff: cutoff.toISOString(), workflows },
  targets: { artifactSuccessRate30d: 0.995, watchdogSuccessRate30d: 0.995, exactSourceIdentityCoverage: 1, consecutiveFailureAlertAt: 2 },
  windows,
  metrics,
  failureRecovery: { failureCount: metrics.watchdog.failed, recoveryCount, consecutiveFailuresMax, dedupedAlerts: alertEvidence, status: alertEvidence.deduped ? 'MEASURED_DEDUPED' : 'DUPLICATE_ALERTS_DETECTED' },
  revisionLanes: { liveRevision: null, dataRevision: null, localFixturePromotesLive: false, sourceShaCoverage: metrics.watchdog.exactSourceIdentityCoverage },
  certification: { thirtyDaySlo: windows['30d'].status === 'PASS' ? 'PASS' : 'OPERATOR_REQUIRED', alertDedupe: alertEvidence.deduped ? 'PASS' : 'FAIL', publicPromotionAllowed: false },
  reason: 'Actions history measures execution success and recovery; repository issues measure workflow-keyed alert dedupe. Provider rights, live revision, and public promotion remain independent operator evidence.'
};
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, output, status: artifact.status, windows: Object.fromEntries(Object.entries(windows).map(([key, value]) => [key, value.status])) }));
