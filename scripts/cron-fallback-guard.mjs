#!/usr/bin/env node
// v59.85 (data-automation redesign): a GitHub cron that is only the fallback for the data-plane Worker's dispatch.
//
// Since v59.81 the Worker dispatches refresh-data.yml at :20/:50 and event-briefs.yml at :05/:25/:45, but both GitHub
// crons stayed active. When GitHub did run them, they added a second full cycle minutes after the Worker's: on 11/08
// refresh-data ran from the cron at 06:02, 13:26 and 14:27 on top of the dispatches, the 14:20 dispatch and the 14:27 cron
// being two full cycles 7 minutes apart (two commits, two CI runs, two Pages deploys for the same data). A cron run now
// stands down when a dispatched run of the same workflow (the Worker's, a collision re-run or an operator's) started
// inside the window and is still running or succeeded; it still runs when the Worker missed its slot or its run failed,
// which is what a fallback is for. Other schedule runs never count: a cron that stood down also ends 'success', and
// counting it would let one no-op cover the next cron after a missed Worker slot. The crons fire a few minutes before
// the Worker's minute, so an on-time cron still runs; GitHub mostly delivers them late, which is the case this covers.
//
//   node scripts/cron-fallback-guard.mjs --workflow refresh-data.yml --window-min 20 [--github-output]
//   node scripts/cron-fallback-guard.mjs --self-test
//
// Reads EVENT_NAME (github.event_name), GITHUB_REPOSITORY, GITHUB_RUN_ID. Anything other than a schedule event never
// stands down. A failed lookup fails open (the cron runs, as before). Writes covered=true|false and reason.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/** Pure decision over the workflow's recent runs (newest first, as the Actions API returns them). */
export function cronCovered({ eventName, runs, nowMs, windowMin, currentRunId = null }) {
  if (eventName !== 'schedule') return { covered: false, reason: `event-${eventName || 'unknown'}` };
  if (!Array.isArray(runs)) return { covered: false, reason: 'runs-unavailable-fail-open' };
  const windowMs = windowMin * 60000;
  for (const run of runs) {
    if (currentRunId != null && String(run.id) === String(currentRunId)) continue;
    if (run.event !== 'workflow_dispatch') continue;
    const startedMs = Date.parse(run.run_started_at || run.created_at || '');
    if (!Number.isFinite(startedMs) || nowMs - startedMs > windowMs || startedMs > nowMs) continue;
    const live = run.status !== 'completed';
    if (live || run.conclusion === 'success') {
      return { covered: true, reason: `run-${run.id}-${run.event}-${live ? run.status : 'success'}-${Math.round((nowMs - startedMs) / 60000)}m-ago` };
    }
  }
  return { covered: false, reason: `no-live-or-successful-run-in-${windowMin}m` };
}

function selfTest() {
  const now = Date.parse('2026-11-08T14:27:00Z');
  const run = (id, minutesAgo, status, conclusion, event = 'workflow_dispatch') => ({ id, event, status, conclusion, run_started_at: new Date(now - minutesAgo * 60000).toISOString() });
  const cases = [
    [{ eventName: 'workflow_dispatch', runs: [run(1, 2, 'in_progress', null)] }, false],
    [{ eventName: 'schedule', runs: [run(1, 7, 'completed', 'success')] }, true],
    [{ eventName: 'schedule', runs: [run(1, 3, 'in_progress', null)] }, true],
    [{ eventName: 'schedule', runs: [run(1, 7, 'completed', 'failure')] }, false],
    [{ eventName: 'schedule', runs: [run(1, 25, 'completed', 'success')] }, false],
    [{ eventName: 'schedule', runs: [run(9, 0, 'in_progress', null, 'schedule')], currentRunId: 9 }, false],
    [{ eventName: 'schedule', runs: [run(8, 15, 'completed', 'success', 'schedule')] }, false],
    [{ eventName: 'schedule', runs: null }, false],
  ];
  const bad = cases.filter(([input, expected]) => cronCovered({ nowMs: now, windowMin: 20, ...input }).covered !== expected);
  if (bad.length) { console.error(`cron-fallback-guard self-test failed: ${bad.map(([input]) => JSON.stringify(input)).join(' | ')}`); process.exit(1); }
  console.log(`cron-fallback-guard self-test OK (${cases.length} cases)`);
}

function fetchRuns(workflow) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return null;
  const result = spawnSync('gh', ['api', `repos/${repo}/actions/workflows/${workflow}/runs?per_page=10`, '--jq', '.workflow_runs'], { encoding: 'utf8' });
  if (result.status !== 0) { console.log(`::warning::cron fallback guard could not list ${workflow} runs (${String(result.stderr).trim().slice(0, 200)}); running`); return null; }
  try { return JSON.parse(result.stdout); } catch { return null; }
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry.endsWith('scripts/cron-fallback-guard.mjs')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) { selfTest(); process.exit(0); }
  const value = (flag) => { const at = argv.indexOf(flag); return at >= 0 ? argv[at + 1] : null; };
  const workflow = value('--workflow');
  const windowMin = Number(value('--window-min') || 20);
  if (!workflow || !Number.isFinite(windowMin) || windowMin <= 0) { console.error('usage: cron-fallback-guard.mjs --workflow <file.yml> --window-min <n> [--github-output] | --self-test'); process.exit(2); }
  const eventName = process.env.EVENT_NAME || '';
  const decision = cronCovered({ eventName, runs: eventName === 'schedule' ? fetchRuns(workflow) : [], nowMs: Date.now(), windowMin, currentRunId: process.env.GITHUB_RUN_ID || null });
  console.log(`cron fallback guard: covered=${decision.covered} (${decision.reason})`);
  if (argv.includes('--github-output') && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `covered=${decision.covered}\nreason=${decision.reason}\n`);
}
