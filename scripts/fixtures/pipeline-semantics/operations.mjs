// scripts/fixtures/pipeline-semantics/operations.mjs — v59.45 pipeline review regressions (operations alert recovery, SLO recovery)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// The alert logic lives inline in the workflow; run its github-script body against an in-memory GitHub API.
const require = createRequire(import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const alertScript = () => {
  const yaml = readFileSync(new URL('../../../.github/workflows/operations-alert.yml', import.meta.url), 'utf8');
  const body = yaml.split('          script: |')[1];
  assert.ok(body, 'operations-alert.yml keeps one github-script body');
  return new AsyncFunction('context', 'github', 'core', 'require', body.split('\n').map((line) => line.replace(/^ {12}/, '')).join('\n'));
};

// runs: newest first, [{ conclusion, step }] where step is the work-step conclusion or 'error' for an unreadable job list.
async function alert(workflow, runs, { step: stepName, issueState = 'open' } = {}) {
  const rows = runs.map((item, index) => ({
    id: runs.length - index, name: workflow, workflow_id: 10, head_branch: 'main', head_repository: { full_name: 'audit/repo' },
    event: 'workflow_run', conclusion: item.conclusion, updated_at: `2026-10-28T12:${String(runs.length - index).padStart(2, '0')}:00Z`,
    html_url: `https://example.invalid/run/${runs.length - index}`, head_sha: 'a'.repeat(40)
  }));
  const byId = new Map(rows.map((row, index) => [row.id, runs[index]]));
  const writes = [];
  const listJobs = async ({ run_id }) => {
    const item = byId.get(run_id);
    if (item.step === 'error') throw Object.assign(new Error('injected API failure'), { status: 503 });
    return [{ name: 'deploy', conclusion: item.conclusion, steps: [{ name: stepName, conclusion: item.step }] }];
  };
  const marker = `<!-- aio-operations-alert:${workflow} -->`;
  const issues = {
    getLabel: async () => ({}),
    listForRepo: async () => (issueState ? [{ number: 1, state: issueState, body: marker }] : []),
    listComments: async () => [],
    create: async (args) => writes.push({ kind: 'create', ...args }),
    createComment: async (args) => writes.push({ kind: 'comment', ...args }),
    update: async (args) => writes.push({ kind: 'update', ...args })
  };
  await alertScript()(
    { payload: { workflow_run: rows[0] }, repo: { owner: 'audit', repo: 'repo' } },
    { rest: { actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: rows } }), listJobsForWorkflowRun: listJobs }, issues }, paginate: async (fn, args) => fn(args) },
    { info: () => {} },
    require
  );
  return { closed: writes.some((write) => write.state === 'closed'), opened: writes.some((write) => write.state === 'open' || write.kind === 'create') };
}

// v60.19 (Codex audit ai-operations scenes): explicit rows (run-name, start and last-touch times), triggered by rows[0];
// returns the issue writes.
async function alertRows(workflow, rows, { issueState = null, step = null } = {}) {
  const writes = [];
  const marker = `<!-- aio-operations-alert:${workflow} -->`;
  await alertScript()(
    { payload: { workflow: { name: workflow }, workflow_run: rows[0] }, repo: { owner: 'audit', repo: 'repo' } },
    { rest: { actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: rows } }),
      listJobsForWorkflowRun: async ({ run_id }) => { const item = rows.find((row) => row.id === run_id); return [{ name: 'work', conclusion: item.conclusion, steps: step ? [{ name: step, conclusion: item.conclusion }] : [] }]; } },
    issues: { getLabel: async () => ({}), listForRepo: async () => (issueState ? [{ number: 1, state: issueState, body: marker }] : []), listComments: async () => [],
      create: async (args) => writes.push({ kind: 'create', ...args }), createComment: async (args) => writes.push({ kind: 'comment', ...args }), update: async (args) => writes.push({ kind: 'update', ...args }) } },
    paginate: async (fn, args) => fn(args) },
    { info: () => {} },
    require
  );
  return writes;
}
const runRow = (id, name, conclusion, start, touch) => ({ id, name, conclusion, workflow_id: 99, head_branch: 'main', head_repository: { full_name: 'audit/repo' }, event: 'workflow_dispatch',
  run_started_at: `2026-11-14T${start}:00Z`, created_at: `2026-11-14T${start}:00Z`, updated_at: `2026-11-14T${touch}:00Z`, html_url: `https://example.invalid/run/${id}`, head_sha: 'a'.repeat(40) });

const PAGES = ['Deploy GitHub Pages', 'Verify released Pages and all external planes'];
const AI = ['Deploy AI proxy', 'Verify health, readiness, CORS, and fail-closed origin'];
const FAST = ['Deploy fast data plane', 'Smoke check fast plane'];
const ok = (step) => ({ conclusion: 'success', step });
const failed = { conclusion: 'failure', step: 'failure' };

// Review v60.19 B1: the 13F lane's alert step run as the workflow runs it (its own cwd and $GITHUB_OUTPUT).
async function laneAlertStep(marker) {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync: readText } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const cwd = mkdtempSync(join(tmpdir(), 'aio-lane-'));
  mkdirSync(join(cwd, '.cache/daily-lane'), { recursive: true });
  writeFileSync(join(cwd, '.cache/daily-lane/last-poll.json'), JSON.stringify(marker));
  const output = join(cwd, 'github-output');
  writeFileSync(output, '');
  const script = resolve(new URL('../../daily-lane-age.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const run = spawnSync(process.execPath, [script, '--alert-state'], { cwd, env: { ...process.env, GITHUB_OUTPUT: output }, encoding: 'utf8' });
  return { status: run.status, outputs: Object.fromEntries(readText(output, 'utf8').split('\n').filter(Boolean).map((line) => line.split('='))) };
}

export const cases = [
  { id: 'review v60.19 B1', name: '13F 수집이 3번 연속 실패해도 경보만 열고 갱신 실행은 성공으로 끝나며, cron 대체 실행은 물러선다', run: async ({ load }) => {
      const workflow = readFileSync(new URL('../../../.github/workflows/refresh-data.yml', import.meta.url), 'utf8');
      const step = await laneAlertStep({ polledAt: '2026-11-06T09:00:00Z', failedAt: '2026-11-15T03:00:00Z', failures: 3 });
      assert.equal(step.outputs.state, 'open', 'three failures in a row raise the alert');
      assert.equal(step.status, 0, 'the alert step exits 0');
      assert.ok(!/--raise-persistent/.test(workflow) && /daily-lane-alert:[\s\S]*?issues: write/.test(workflow), 'the alert is an issue job, not a red step');
      // The refresh run concludes on its data cycle; the Worker's dispatched run then covers the cron that follows it.
      const conclusion = step.status === 0 ? 'success' : 'failure';
      const { cronCovered } = await load('scripts/cron-fallback-guard.mjs');
      const nowMs = Date.parse('2026-11-15T03:27:00Z');
      const decision = cronCovered({ eventName: 'schedule', nowMs, windowMin: 30, runs: [{ id: 1, event: 'workflow_dispatch', status: 'completed', conclusion, run_started_at: '2026-11-15T03:20:00Z' }] });
      assert.equal(decision.covered, true, `the fallback cron stands down after the dispatched run (${decision.reason})`);
      assert.equal((await laneAlertStep({ polledAt: '2026-11-15T04:00:00Z' })).outputs.state, 'clear', 'a published poll clears the alert');
  } },
  { id: 'P15-OPS-01', name: '작업 목록을 못 읽은 Pages 성공 두 번은 장애 이슈를 닫지 않는다', run: async () => {
      assert.equal((await alert(PAGES[0], [ok('error'), ok('error'), failed], { step: PAGES[1] })).closed, false);
  } },
  { id: 'P15-OPS-01', name: '배포·점검을 건너뛴 Worker 성공은 장애 이슈를 닫지 않는다', run: async () => {
      for (const [workflow, step] of [AI, FAST]) assert.equal((await alert(workflow, [ok('skipped'), ok('skipped'), failed], { step })).closed, false, workflow);
  } },
  { id: 'P15-OPS-01', name: '점검이 통과한 Worker 성공 두 번은 이슈를 닫는다(대조군)', run: async () => {
      for (const [workflow, step] of [AI, FAST]) assert.equal((await alert(workflow, [ok('success'), ok('success'), failed], { step })).closed, true, workflow);
      assert.equal((await alert(PAGES[0], [ok('success'), ok('success'), failed], { step: PAGES[1] })).closed, true);
  } },
  { id: 'P15-OPS-01', name: '관측되지 않은 성공은 연속 실패를 끊지 않는다', run: async () => {
      assert.equal((await alert(AI[0], [failed, ok('skipped'), failed], { step: AI[1], issueState: null })).opened, true);
      assert.equal((await alert(PAGES[0], [failed, ok('error'), failed], { step: PAGES[1], issueState: null })).opened, true);
      assert.equal((await alert(AI[0], [failed, ok('success'), failed], { step: AI[1], issueState: null })).opened, false);
  } },
  { id: 'v60.19 OPS-ALERT', name: '스케줄러 표시명의 연속 실패 두 번은 경보를 연다', run: async () => {
      const named = 'Refresh market data · scheduler';
      const writes = await alertRows('Refresh market data', [runRow(2, named, 'failure', '12:20', '12:21'), runRow(1, named, 'failure', '11:20', '11:21')]);
      assert.equal(writes.filter((write) => write.kind === 'create').length, 1);
  } },
  { id: 'v60.19 OPS-ALERT', name: '늦게 갱신된 이전 실패는 성공 뒤의 실패를 연속 실패로 만들지 않는다', run: async () => {
      const writes = await alertRows('CI', [runRow(3, 'CI', 'failure', '12:20', '12:22'), runRow(2, 'CI', 'success', '12:10', '12:11'), runRow(1, 'CI', 'failure', '11:55', '12:15')]);
      assert.deepEqual(writes, []);
  } },
  { id: 'v60.19 OPS-ALERT', name: 'Event briefs 경보는 성공 한 번으로 닫히지 않고 두 번 연속 성공에 닫힌다', run: async () => {
      const lane = 'Event briefs (FOMC and market-mover earnings)';
      const once = await alertRows(lane, [runRow(2, lane, 'success', '12:20', '12:21'), runRow(1, lane, 'failure', '12:00', '12:01')], { issueState: 'open', step: 'Build event briefs' });
      assert.equal(once.some((write) => write.state === 'closed'), false);
      const twice = await alertRows(lane, [runRow(3, lane, 'success', '12:40', '12:41'), runRow(2, lane, 'success', '12:20', '12:21'), runRow(1, lane, 'failure', '12:00', '12:01')], { issueState: 'open', step: 'Build event briefs' });
      assert.equal(twice.some((write) => write.state === 'closed'), true);
  } },
  { id: 'v60.19 OPS-SLO', name: 'Worker가 보낸 감시 실행(scheduler)은 SLO 관측에 들어가고 운영자 실행은 빠진다', run: async ({ load }) => {
      const { buildSloWindow } = await load('scripts/build-operations-slo-window.mjs');
      const base = { id: 43595599734, event: 'workflow_dispatch', conclusion: 'success', head_branch: 'main', head_sha: '3f4d1b5073f88d2c348a70a8169b1c4cbaf8aece', created_at: '2026-11-14T12:35:40Z' };
      const lane = (title) => buildSloWindow({ observed: { watchdog: [{ ...base, display_title: title }] }, now: new Date('2026-11-14T12:45:00Z') }).windows['7d'].domains.watchdog;
      assert.equal(lane('Data freshness watchdog · scheduler').observedRuns, 1);
      assert.equal(lane('Data freshness watchdog · operator').manualRunsExcluded, 1);
  } },
  { id: 'P15-SLO-01', name: '성공률에서 뺀 수동 성공은 복구 횟수에도 넣지 않는다', run: async ({ load }) => {
      const { buildSloWindow } = await load('scripts/build-operations-slo-window.mjs');
      const sha = 'a'.repeat(40);
      const run = (id, event, conclusion, hour, title = 'watchdog') => ({ id, event, conclusion, display_title: title, head_sha: sha, created_at: `2026-10-27T0${hour}:00:00Z` });
      const now = new Date('2026-10-29T00:00:00Z');
      const manual = buildSloWindow({ observed: { watchdog: [run(1, 'schedule', 'failure', 0), run(2, 'workflow_dispatch', 'success', 1, 'operator run'), run(3, 'schedule', 'failure', 2)] }, now });
      assert.equal(manual.domains.watchdog.manualRunsExcluded, 1);
      assert.equal(manual.failureRecovery.failureCount, 2);
      assert.equal(manual.failureRecovery.recoveryCount, 0);
      assert.equal(manual.failureRecovery.consecutiveFailuresMax, 2);
      const scheduled = buildSloWindow({ observed: { watchdog: [run(1, 'schedule', 'failure', 0), run(2, 'schedule', 'success', 1), run(3, 'schedule', 'failure', 2)] }, now });
      assert.equal(scheduled.failureRecovery.recoveryCount, 1);
      assert.equal(scheduled.failureRecovery.consecutiveFailuresMax, 1);
  } },
  { id: 'R3-06', name: '시도한 대상 일부만 갱신된 수집은 실패 기록이 없어도 새 수집 성공으로 부르지 않는다', run: async ({ load }) => {
      const { buildDomainReceipt } = await load('scripts/lib/domain-receipt.mjs');
      const attemptedAt = '2026-10-31T00:00:00Z';
      const base = { attemptedAt, eligible: 10, attempted: 10, updated: 3, stored: 10 };
      assert.equal(buildDomainReceipt({ ...base, failures: [] }).publication.status, 'PARTIAL');
      assert.equal(buildDomainReceipt({ ...base, failures: [{ symbol: 'A', status: 'TRANSIENT_PROVIDER_FAILURE' }] }).publication.status, 'PARTIAL');
      // Unchanged: every target updated is SUCCESS; terminal rows of this batch keep a partial batch PARTIAL.
      assert.equal(buildDomainReceipt({ ...base, updated: 10, failures: [] }).publication.status, 'SUCCESS');
      assert.equal(buildDomainReceipt({ attemptedAt, eligible: 5, attempted: 5, updated: 3, stored: 5, failures: [{ symbol: 'B', status: 'TERMINAL_UNSUPPORTED', attemptedAt }, { symbol: 'C', status: 'TERMINAL_UNSUPPORTED', attemptedAt }] }).publication.status, 'PARTIAL');
  } },
];
