import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY || 'ysnle/aio-screener';
const token = process.env.GITHUB_TOKEN || '';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_PAGES = 30; // P1597: 49/day * 30 days plus bounded dispatch/retry headroom.

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
export function dailyCronSlots(expression) {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  // 매일 반복이 아닌 schedule은 '하루 몇 회'로 환산할 수 없다.
  if ([dayOfMonth, month, dayOfWeek].some((field) => field !== '*')) return null;
  const expand = (field, max) => {
    if (field === '*') return Array.from({ length: max }, (_, index) => index);
    const stepped = /^\*\/(\d+)$/.exec(field);
    if (stepped) { const step = Number(stepped[1]); return step > 0 && step <= max ? Array.from({ length: Math.ceil(max / step) }, (_, index) => index * step) : null; }
    if (/^\d+(,\d+)*$/.test(field)) {
      const values = [...new Set(field.split(',').map(Number))];
      return values.every(value => value >= 0 && value < max) ? values : null;
    }
    return null;
  };
  const minutes = expand(minute, 60);
  const hours = expand(hour, 24);
  if (minutes == null || hours == null) return null;
  return hours.flatMap(hour => minutes.map(minute => hour * 60 + minute));
}

export function parseCronRunsPerDay(expression) {
  return dailyCronSlots(expression)?.length ?? null;
}

export function cronRunsPerDayFromSource(source) {
  const crons = [...String(source || '').matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
  if (!crons.length) return null;
  const slots = crons.map(dailyCronSlots);
  if (slots.some((value) => value == null)) return null;
  return new Set(slots.flat()).size;
}

export async function deriveExpectedRunsPerDay(workflowFile, root = repoRoot) {
  let source;
  try { source = await readFile(resolve(root, '.github/workflows', workflowFile), 'utf8'); }
  catch (_) { return null; }
  return cronRunsPerDayFromSource(source);
}

// Codex audit F30 (2026-10-15): the denominator was today's cron x the window, so a schedule changed mid-window was
// back-filled over all 30 days. With the workflow file's commit history the expected count is summed per segment
// ([{ from, perDay }] ascending; each segment runs until the next one starts).
export function expectedRunsFromHistory(segments, fromMs, toMs) {
  if (!Array.isArray(segments) || !segments.length) return null;
  let total = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const start = Math.max(fromMs, Date.parse(segments[i].from));
    const end = Math.min(toMs, i + 1 < segments.length ? Date.parse(segments[i + 1].from) : toMs);
    if (!(end > start)) continue;
    if (!Number.isFinite(segments[i].perDay)) return null;
    total += segments[i].perDay * (end - start) / 86400000;
  }
  return Math.floor(total);
}

async function fetchRuns(file) {
  const runs = [];
  let pagesFetched = 0;
  let paginationComplete = false;
  const excluded = { nonCompleted: 0, outsideWindow: 0 };
  const now = Date.now();
  const since = now - 30 * 86400000;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `https://api.github.com/repos/${repository}/actions/workflows/${file}/runs?branch=main&status=completed&per_page=100&page=${page}&created=%3E%3D${new Date(since).toISOString().slice(0, 10)}`;
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`${file} runs HTTP ${response.status}`);
    pagesFetched = page;
    const pageRuns = (await response.json()).workflow_runs || [];
    for (const run of pageRuns) {
      if (run.status !== 'completed') { excluded.nonCompleted += 1; continue; }
      const time = Date.parse(run.created_at);
      if (!Number.isFinite(time) || time < since || time > now) { excluded.outsideWindow += 1; continue; }
      runs.push(run);
    }
    if (pageRuns.length < 100) { paginationComplete = true; break; }
  }
  // 06 O02: 일부 페이지만 읽고 30일을 달성했다고 인증하지 않는다.
  return { runs, pagesFetched, maxPages: MAX_PAGES, paginationComplete, truncated: !paginationComplete, excluded };
}

async function githubJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-slo-window', ...(token ? { authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// F30: cadence segments for the window from the workflow file's commits (the shallow watchdog checkout has no history).
// Any failure returns null and the lane says its denominator is the current cron back-filled.
async function fetchCadenceHistory(file, sinceMs) {
  try {
    const path = `.github/workflows/${file}`;
    const base = `https://api.github.com/repos/${repository}`;
    const sinceIso = new Date(sinceMs).toISOString();
    const [before] = await githubJson(`${base}/commits?path=${encodeURIComponent(path)}&sha=main&until=${sinceIso}&per_page=1`);
    const within = (await githubJson(`${base}/commits?path=${encodeURIComponent(path)}&sha=main&since=${sinceIso}&per_page=100`)).reverse();
    const perDayAt = async (sha) => cronRunsPerDayFromSource(Buffer.from((await githubJson(`${base}/contents/${path}?ref=${sha}`)).content || '', 'base64').toString('utf8'));
    const segments = [];
    if (before) segments.push({ from: sinceIso, perDay: await perDayAt(before.sha), sha: before.sha });
    for (const commit of within) segments.push({ from: commit.commit?.committer?.date || commit.commit?.author?.date, perDay: await perDayAt(commit.sha), sha: commit.sha });
    return segments.length && segments.every((segment) => Number.isFinite(segment.perDay) && Number.isFinite(Date.parse(segment.from))) ? segments : null;
  } catch (_) { return null; }
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
    const rawIssues = await response.json();
    const pageIssues = rawIssues.filter((issue) => !issue.pull_request);
    issues.push(...pageIssues);
    if (rawIssues.length < 100) { paginationComplete = true; break; }
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
// R24-07/P1242: 예정 도착(scheduled arrival)은 `schedule` event만 측정한다. 종전에는
// workflow_dispatch만 제외하고 push 등 나머지 trigger를 전부 scheduled로 세어, 30일간 push 성공만
// 있는 lane도 MEASURED·창 PASS가 될 수 있었다. 다른 trigger는 별도 lane의 사실이므로 제외하고
// 개수·종류만 남긴다. 결과적으로 push-only 창은 NOT_OBSERVED이며 PASS가 될 수 없다.
// F30: the data-plane Worker's dispatches are the designed scheduler (P1377: GitHub cron ran every 4-6 h), not an
// operator's manual run. They carry trigger=scheduler, which the workflow's run-name puts in display_title, so they
// count toward delivery; operator dispatches stay excluded. scheduledArrivalRate keeps its GitHub-cron meaning.
export const isAutomatedDispatch = (run) => run.event === 'workflow_dispatch' && /(?:^|[\s·(])scheduler(?:$|[\s)])/.test(String(run.display_title || ''));
const buildLane = (runs, { workflow, required, expectedRuns, expectedRunsBasis = 'current-cron-backfilled' }) => {
  const automated = runs.filter(isAutomatedDispatch);
  const manual = runs.filter((run) => run.event === 'workflow_dispatch' && !isAutomatedDispatch(run));
  const scheduled = runs.filter((run) => run.event === 'schedule');
  const otherEvents = runs.filter((run) => run.event !== 'schedule' && run.event !== 'workflow_dispatch');
  const summary = summarize([...scheduled, ...automated]);
  const arrivalRate = expectedRuns ? round(Math.min(1, scheduled.length / expectedRuns)) : null;
  const deliveryRate = expectedRuns ? round(Math.min(1, summary.completed / expectedRuns)) : null;
  const status = summary.completed === 0
    ? 'NOT_OBSERVED'
    : summary.successRate >= SLO_TARGETS.domainSuccessRate
      && summary.exactSourceIdentityCoverage === 1
      && deliveryRate != null && deliveryRate >= SLO_TARGETS.scheduledArrivalRate
      ? 'MEASURED'
      : 'DEGRADED';
  return {
    workflow,
    required,
    expectedRuns,
    expectedRunsBasis,
    measures: 'workflow-execution', // not data freshness or provider uptime
    observedRuns: summary.completed,
    scheduledRuns: scheduled.length,
    automatedDispatchRuns: automated.length,
    deliveryRate,
    manualRunsExcluded: manual.length,
    nonScheduledRunsExcluded: otherEvents.length,
    nonScheduledEventBreakdown: Object.fromEntries([...new Set(otherEvents.map((run) => run.event || 'unknown'))]
      .map((event) => [event, otherEvents.filter((run) => (run.event || 'unknown') === event).length])),
    cancelledRuns: scheduled.filter((run) => run.conclusion === 'cancelled').length,
    scheduledArrivalRate: arrivalRate,
    ...summary,
    status
  };
};

// 순수 계산부: 네트워크 없이 repro fixture로 검증할 수 있도록 export한다.
export function buildSloWindow({ observed = {}, cadencePerDay = {}, cadenceHistory = {}, query = {}, alertEvidence = {}, now: evaluatedAt = new Date(), cutoff: evaluatedCutoff = evaluatedAt, repository: repo = repository, collectionMode = 'MEASURED_RUNTIME' }) {
  // P1597: future/invalid timestamps and duplicate API run IDs cannot create evidence.
  observed = Object.fromEntries(Object.keys(SLO_DOMAINS).map(id => {
    const seen = new Set();
    const runs = (observed[id] || []).filter(run => {
      const time = Date.parse(run.created_at);
      if (!Number.isFinite(time) || time > evaluatedAt.getTime() || time < evaluatedAt.getTime() - 30 * 86400000
          || (run.head_branch && run.head_branch !== 'main')) return false;
      if (run.id != null) {
        if (seen.has(String(run.id))) return false;
        seen.add(String(run.id));
      }
      return true;
    });
    return [id, runs];
  }));
  const windowSummary = (days) => {
    const since = new Date(evaluatedAt.getTime() - days * 86400000);
    const lanes = {};
    for (const [id, domain] of Object.entries(SLO_DOMAINS)) {
      const runs = (observed[id] || []).filter((run) => new Date(run.created_at) >= since);
      const perDay = cadencePerDay[id];
      const fromHistory = expectedRunsFromHistory(cadenceHistory[id], since.getTime(), evaluatedAt.getTime());
      lanes[id] = buildLane(runs, {
        workflow: domain.workflow,
        required: domain.required,
        expectedRuns: fromHistory != null ? fromHistory : perDay == null ? null : Math.floor(perDay * days),
        expectedRunsBasis: fromHistory != null ? 'cadence-history' : 'current-cron-backfilled'
      });
    }
    const requiredIds = Object.entries(lanes).filter(([, lane]) => lane.required).map(([id]) => id);
    const missingDomains = requiredIds.filter((id) => lanes[id].observedRuns === 0);
    const incompleteSources = requiredIds.filter(id => query[id]?.paginationComplete !== true || query[id]?.truncated === true);
    const observedDays = requiredIds.length ? Math.min(...requiredIds.map((id) => lanes[id].observedDays)) : 0;
    const passing = requiredIds.every((id) => lanes[id].status === 'MEASURED');
    return {
      requiredDays: days,
      observedDays,
      status: missingDomains.length || incompleteSources.length || observedDays < days ? 'INSUFFICIENT_EVIDENCE' : passing ? 'PASS' : 'FAIL',
      domains: lanes,
      coverage: {
        requiredDomains: requiredIds,
        missingDomains,
        incompleteSources,
        everyRequiredDomainObserved: missingDomains.length === 0,
        everySourcePaginated: incompleteSources.length === 0
      },
      // 하위 호환 필드: 종전 소비자가 읽던 pooled artifact/watchdog 요약. PASS 판정에는 쓰지 않는다.
      // R24-07/P1242: this pooled compatibility summary counts schedule arrivals only, like the lanes.
      artifact: summarize([...(observed.market || []), ...(observed.screener || [])]
        .filter((run) => new Date(run.created_at) >= since && run.event === 'schedule')),
      watchdog: lanes.watchdog ? { ...lanes.watchdog } : null,
      source: 'github-actions-api'
    };
  };

  const windows = { '7d': windowSummary(7), '30d': windowSummary(30) };
  const metrics = { artifact: windows['30d'].artifact, watchdog: windows['30d'].watchdog };
  const orderedWatchdog = observed.watchdog.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
  const completeAlertEvidence = hasAlertEvidence && alertEvidence.paginationComplete === true && alertEvidence.source === 'github-issues-api';

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
      status: completeAlertEvidence ? (alertEvidence.deduped ? 'MEASURED_DEDUPED' : 'DUPLICATE_ALERTS_DETECTED') : 'INSUFFICIENT_EVIDENCE'
    },
    revisionLanes: { liveRevision: null, dataRevision: null, localFixturePromotesLive: false, sourceShaCoverage: metrics.watchdog?.exactSourceIdentityCoverage ?? null },
    certification: {
      thirtyDaySlo: windows['30d'].status === 'PASS' ? 'PASS' : (windows['30d'].status === 'FAIL' ? 'FAIL' : 'OPERATOR_REQUIRED'),
      alertDedupe: completeAlertEvidence ? (alertEvidence.deduped ? 'PASS' : 'FAIL') : 'OPERATOR_REQUIRED',
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
  const [alertEvidence, cadenceEntries, historyEntries] = await Promise.all([
    fetchAlertIssues(),
    Promise.all(Object.entries(SLO_DOMAINS).map(async ([id, domain]) => [id, await deriveExpectedRunsPerDay(domain.workflow)])),
    Promise.all(Object.entries(SLO_DOMAINS).map(async ([id, domain]) => [id, await fetchCadenceHistory(domain.workflow, cutoff.getTime())]))
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
  const artifact = buildSloWindow({ observed, cadencePerDay: Object.fromEntries(cadenceEntries), cadenceHistory: Object.fromEntries(historyEntries.filter(([, segments]) => segments)), query, alertEvidence, now, cutoff, repository });
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    output,
    status: artifact.status,
    windows: Object.fromEntries(Object.entries(artifact.windows).map(([key, value]) => [key, value.status])),
    domains: Object.fromEntries(Object.entries(artifact.domains).map(([id, lane]) => [id, lane.status]))
  }));
}
