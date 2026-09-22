import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY || 'ysnle/aio-screener';
const token = process.env.GITHUB_TOKEN || '';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PAGES = 10;

// P1166 (17 작업 단위 2 / 06 O02): data domain별 독립 SLO. 예전에는 market+screener run을 한 풀로
// 합쳐 성공률을 냈기 때문에, 한 도메인이 아예 0회 실행돼도 다른 도메인의 30일 성공이 window를
// PASS로 만들었다. 이제 required 도메인이 window 안에서 0회면 인증하지 않는다.
export const SLO_DOMAINS = Object.freeze({
  market: Object.freeze({ workflow: 'refresh-data.yml', required: true }),
  screener: Object.freeze({ workflow: 'refresh-screener.yml', required: true }),
  watchdog: Object.freeze({ workflow: 'data-watchdog.yml', required: true })
});
export const SLO_TARGETS = Object.freeze({
  domainSuccessRate: 0.995,
  watchdogSuccessRate: 0.995,
  exactSourceIdentityCoverage: 1,
  // 예정 도착률 하한. GitHub은 schedule 지연·누락 가능성을 공식 명시하므로 schedule 자체를 실행
  // 보장으로 취급하지 않고, 관측된 도착을 정책 분모와 비교해 기록한다.
  scheduledArrivalRate: 0.9,
  consecutiveFailureAlertAt: 2
});

const round = (value) => value == null ? null : Math.round(value * 1_000_000) / 1_000_000;

// 06 O02: 정책상 필요한 실행 수는 workflow의 `schedule.cron`에서 파생한다. 문서에 적은 cadence를
// 코드에 복제하지 않고, schedule을 확인할 수 없으면 null로 닫아 인증 불가로 남긴다.
export function parseCronRunsPerDay(expression) {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  // 매일 반복이 아닌 schedule은 '하루 몇 회'로 환산할 수 없다.
  if ([dayOfMonth, month, dayOfWeek].some((field) => field !== '*')) return null;
  const expand = (field, max) => {
    if (field === '*') return max;
    const stepped = /^\*\/(\d+)$/.exec(field);
    if (stepped) { const step = Number(stepped[1]); return step > 0 ? Math.floor(max / step) : null; }
    if (/^\d+(,\d+)*$/.test(field)) return field.split(',').length;
    return null;
  };
  const minutes = expand(minute, 60);
  const hours = expand(hour, 24);
  if (minutes == null || hours == null) return null;
  return minutes * hours;
}

export async function deriveExpectedRunsPerDay(workflowFile, root = repoRoot) {
  let source;
  try { source = await readFile(resolve(root, '.github/workflows', workflowFile), 'utf8'); }
  catch (_) { return null; }
  const crons = [...source.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
  if (!crons.length) return null;
  const perDay = crons.map(parseCronRunsPerDay);
  if (perDay.some((value) => value == null)) return null;
  return perDay.reduce((sum, value) => sum + value, 0);
}

async function fetchRuns(file) {
  const runs = [];
  let pagesFetched = 0;
  let paginationComplete = false;
  const excluded = { nonCompleted: 0, outsideWindow: 0 };
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `https://api.github.com/repos/${repository}/actions/workflows/${file}/runs?status=completed&per_page=100&page=${page}&created=%3E%3D${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}`;
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`${file} runs HTTP ${response.status}`);
    pagesFetched = page;
    const pageRuns = (await response.json()).workflow_runs || [];
    for (const run of pageRuns) {
      if (run.status !== 'completed') { excluded.nonCompleted += 1; continue; }
      if (new Date(run.created_at) < new Date(Date.now() - 30 * 86400000)) { excluded.outsideWindow += 1; continue; }
      runs.push(run);
    }
    if (pageRuns.length < 100) { paginationComplete = true; break; }
  }
  // 06 O02: 일부 페이지만 읽고 30일을 달성했다고 인증하지 않는다.
  return { runs, pagesFetched, maxPages: MAX_PAGES, paginationComplete, truncated: !paginationComplete, excluded };
}

async function fetchAlertIssues() {
  const issues = [];
  let pagesFetched = 0;
  let paginationComplete = false;
  for (let page = 1; page <= 3; page += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=all&labels=aio-operations-alert&per_page=100&page=${page}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`operations alert issues HTTP ${response.status}`);
    pagesFetched = page;
    const pageIssues = (await response.json()).filter((issue) => !issue.pull_request);
    issues.push(...pageIssues);
    if (pageIssues.length < 100) { paginationComplete = true; break; }
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
    pagesFetched,
    paginationComplete,
    source: 'github-issues-api'
  };
}

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

// 17: 수동 실행을 추가해 분모를 유리하게 바꾸지 않는다 → workflow_dispatch run은 lane 계산에서
// 제외하고 개수만 남긴다. 취소·미실행은 별도 상태로 기록한다(성공률 분모에는 남는다).
const buildLane = (runs, { workflow, required, expectedRuns }) => {
  const manual = runs.filter((run) => run.event === 'workflow_dispatch');
  const scheduled = runs.filter((run) => run.event !== 'workflow_dispatch');
  const summary = summarize(scheduled);
  const arrivalRate = expectedRuns ? round(Math.min(1, summary.completed / expectedRuns)) : null;
  const status = summary.completed === 0
    ? 'NOT_OBSERVED'
    : summary.successRate >= SLO_TARGETS.domainSuccessRate
      && summary.exactSourceIdentityCoverage === 1
      && arrivalRate != null && arrivalRate >= SLO_TARGETS.scheduledArrivalRate
      ? 'MEASURED'
      : 'DEGRADED';
  return {
    workflow,
    required,
    expectedRuns,
    observedRuns: summary.completed,
    manualRunsExcluded: manual.length,
    cancelledRuns: scheduled.filter((run) => run.conclusion === 'cancelled').length,
    scheduledArrivalRate: arrivalRate,
    ...summary,
    status
  };
};

// 순수 계산부: 네트워크 없이 repro fixture로 검증할 수 있도록 export한다.
export function buildSloWindow({ observed = {}, cadencePerDay = {}, query = {}, alertEvidence = {}, now: evaluatedAt = new Date(), cutoff: evaluatedCutoff = evaluatedAt, repository: repo = repository, collectionMode = 'MEASURED_RUNTIME' }) {
  const windowSummary = (days) => {
    const since = new Date(evaluatedAt.getTime() - days * 86400000);
    const lanes = {};
    for (const [id, domain] of Object.entries(SLO_DOMAINS)) {
      const runs = (observed[id] || []).filter((run) => new Date(run.created_at) >= since);
      const perDay = cadencePerDay[id];
      lanes[id] = buildLane(runs, {
        workflow: domain.workflow,
        required: domain.required,
        expectedRuns: perDay == null ? null : Math.floor(perDay * days)
      });
    }
    const requiredIds = Object.entries(lanes).filter(([, lane]) => lane.required).map(([id]) => id);
    const missingDomains = requiredIds.filter((id) => lanes[id].observedRuns === 0);
    const incompleteSources = Object.entries(query)
      .filter(([, item]) => item && item.paginationComplete !== true)
      .map(([id]) => id);
    const observedDays = requiredIds.length ? Math.min(...requiredIds.map((id) => lanes[id].observedDays)) : 0;
    const passing = requiredIds.every((id) => lanes[id].status === 'MEASURED');
    return {
      requiredDays: days,
      observedDays,
      status: missingDomains.length || incompleteSources.length ? 'INSUFFICIENT_EVIDENCE' : passing ? 'PASS' : 'FAIL',
      domains: lanes,
      coverage: {
        requiredDomains: requiredIds,
        missingDomains,
        incompleteSources,
        everyRequiredDomainObserved: missingDomains.length === 0,
        everySourcePaginated: incompleteSources.length === 0
      },
      // 하위 호환 필드: 종전 소비자가 읽던 pooled artifact/watchdog 요약. PASS 판정에는 쓰지 않는다.
      artifact: summarize([...(observed.market || []), ...(observed.screener || [])]
        .filter((run) => new Date(run.created_at) >= since && run.event !== 'workflow_dispatch')),
      watchdog: lanes.watchdog ? { ...lanes.watchdog } : null,
      source: 'github-actions-api'
    };
  };

  const windows = { '7d': windowSummary(7), '30d': windowSummary(30) };
  const metrics = { artifact: windows['30d'].artifact, watchdog: windows['30d'].watchdog };
  const orderedWatchdog = [...(observed.watchdog || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
  const hasAlertEvidence = Object.keys(alertEvidence).length > 0;

  return {
    schemaVersion: 'operations-slo-window.v3',
    status: windows['30d'].status === 'PASS' ? 'CERTIFIED_WINDOW' : 'NOT_CERTIFIED',
    observedAt: evaluatedAt.toISOString(),
    collectionMode,
    query: {
      repository: repo,
      cutoff: new Date(evaluatedCutoff).toISOString(),
      workflows: Object.fromEntries(Object.entries(SLO_DOMAINS).map(([id, domain]) => [id, domain.workflow])),
      completeness: query
    },
    targets: {
      artifactSuccessRate30d: SLO_TARGETS.domainSuccessRate,
      watchdogSuccessRate30d: SLO_TARGETS.watchdogSuccessRate,
      exactSourceIdentityCoverage: SLO_TARGETS.exactSourceIdentityCoverage,
      scheduledArrivalRate: SLO_TARGETS.scheduledArrivalRate,
      consecutiveFailureAlertAt: SLO_TARGETS.consecutiveFailureAlertAt
    },
    domains: Object.fromEntries(Object.entries(windows['30d'].domains).map(([id, lane]) => [id, {
      workflow: lane.workflow,
      required: lane.required,
      expectedRuns: lane.expectedRuns,
      observedRuns: lane.observedRuns,
      scheduledArrivalRate: lane.scheduledArrivalRate,
      manualRunsExcluded: lane.manualRunsExcluded,
      successRate: lane.successRate,
      observedDays: lane.observedDays,
      status: lane.status
    }])),
    windows,
    metrics,
    failureRecovery: {
      failureCount: metrics.watchdog?.failed ?? null,
      recoveryCount,
      consecutiveFailuresMax,
      dedupedAlerts: hasAlertEvidence ? alertEvidence : null,
      status: hasAlertEvidence ? (alertEvidence.deduped ? 'MEASURED_DEDUPED' : 'DUPLICATE_ALERTS_DETECTED') : 'INSUFFICIENT_EVIDENCE'
    },
    revisionLanes: { liveRevision: null, dataRevision: null, localFixturePromotesLive: false, sourceShaCoverage: metrics.watchdog?.exactSourceIdentityCoverage ?? null },
    certification: {
      thirtyDaySlo: windows['30d'].status === 'PASS' ? 'PASS' : (windows['30d'].status === 'FAIL' ? 'FAIL' : 'OPERATOR_REQUIRED'),
      alertDedupe: hasAlertEvidence ? (alertEvidence.deduped ? 'PASS' : 'FAIL') : 'OPERATOR_REQUIRED',
      publicPromotionAllowed: false
    },
    reason: 'Per-domain lanes measure scheduled arrival and success independently; a required domain with zero observed runs in the window cannot be certified. Actions history measures execution success and recovery; repository issues measure workflow-keyed alert dedupe. Provider rights, live revision, and public promotion remain independent operator evidence.'
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const output = outIndex >= 0 ? args[outIndex + 1] : null;
  if (!output) throw new Error('usage: node scripts/build-operations-slo-window.mjs --out <path>');
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 86400000);
  const fetched = await Promise.all(Object.entries(SLO_DOMAINS).map(async ([id, domain]) => [id, await fetchRuns(domain.workflow)]));
  const [alertEvidence, cadenceEntries] = await Promise.all([
    fetchAlertIssues(),
    Promise.all(Object.entries(SLO_DOMAINS).map(async ([id, domain]) => [id, await deriveExpectedRunsPerDay(domain.workflow)]))
  ]);
  const observed = Object.fromEntries(fetched.map(([id, result]) => [id, result.runs]));
  const query = Object.fromEntries(fetched.map(([id, result]) => [id, {
    workflow: SLO_DOMAINS[id].workflow,
    pagesFetched: result.pagesFetched,
    maxPages: result.maxPages,
    paginationComplete: result.paginationComplete,
    truncated: result.truncated,
    excluded: result.excluded
  }]));
  query.alerts = { pagesFetched: alertEvidence.pagesFetched, maxPages: 3, paginationComplete: alertEvidence.paginationComplete };
  const artifact = buildSloWindow({ observed, cadencePerDay: Object.fromEntries(cadenceEntries), query, alertEvidence, now, cutoff, repository });
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    output,
    status: artifact.status,
    windows: Object.fromEntries(Object.entries(artifact.windows).map(([key, value]) => [key, value.status])),
    domains: Object.fromEntries(Object.entries(artifact.domains).map(([id, lane]) => [id, lane.status]))
  }));
}
