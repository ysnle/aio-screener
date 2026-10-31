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

const PAGES = ['Deploy GitHub Pages', 'Verify released Pages and all external planes'];
const AI = ['Deploy AI proxy', 'Verify health, readiness, CORS, and fail-closed origin'];
const FAST = ['Deploy fast data plane', 'Smoke check fast plane'];
const ok = (step) => ({ conclusion: 'success', step });
const failed = { conclusion: 'failure', step: 'failure' };

export const cases = [
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
