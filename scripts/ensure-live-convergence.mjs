#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ensure-live-convergence.mjs — R606 라이브 수렴 드라이버
//
// 문제 (2026-09-17 관측):
//   기본 GITHUB_TOKEN으로 만든 workflow_dispatch 실행은 workflow_run 이벤트를
//   발생시키지 않는다. 그래서 refresh 봇이 디스패치한 CI는 게이트를 통과하고
//   attestation까지 만들었지만, 그 attestation을 소비할 Deploy GitHub Pages
//   실행이 생성되지 않았다. 봇 커밋 5건이 main에 쌓이는 동안 라이브는 13.4시간
//   뒤처졌고, 배포는 사람이 푸시할 때만 일어났다.
//
// 이 드라이버의 역할:
//   1. origin/main의 목표 리비전을 확정한다.
//   2. 그 리비전에 대해 "성공했고 attestation 아티팩트를 가진" CI 실행을 찾는다.
//   3. 라이브 deployment.json의 sourceSha가 목표와 다르면, 그 CI 실행 id를
//      pages-deploy에 명시적으로 넘겨 배포를 요청한다.
//
// 안전 경계:
//   - 여기서 직접 배포하지 않는다. Pages 배포는 pages-deploy.yml만 수행하며,
//     그 워크플로가 attestation 아티팩트와 SHA 일치를 다시 검증한다.
//   - CI가 실패했거나 attestation이 없는 리비전은 배포를 요청하지 않는다.
//   - 파일을 쓰지 않는다(리포트 출력 제외). 저장소 상태를 변경하지 않는다.
//   - 멱등하다. 이미 수렴했으면 아무 일도 하지 않는다.
//
// 사용법:
//   node scripts/ensure-live-convergence.mjs
//   node scripts/ensure-live-convergence.mjs --await-sha <sha> [--timeout-min 20]
//   node scripts/ensure-live-convergence.mjs --dry-run [--json]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const DRY_RUN = has('--dry-run');
const AS_JSON = has('--json');
const AWAIT_SHA = valueOf('--await-sha');
const REPORT_PATH = valueOf('--report');
const TIMEOUT_MIN = Number(valueOf('--timeout-min') || 20);
const POLL_MS = Number(valueOf('--poll-ms') || 15000);

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPOSITORY || '';
const LIVE_BASE = (process.env.AIO_LIVE_BASE || 'https://ysnle.github.io/aio-screener').replace(/\/+$/, '');
const API = 'https://api.github.com';

const report = {
  schemaVersion: 'aio-live-convergence.v1',
  observedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  repository: REPO || null,
  liveBase: LIVE_BASE,
  targetSha: null,
  ciRunId: null,
  liveSha: null,
  status: 'UNKNOWN',
  actions: [],
  notes: []
};

const note = (message) => report.notes.push(message);

function finish(status, exitCode = 0) {
  report.status = status;
  if (REPORT_PATH) writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  if (AS_JSON) console.log(JSON.stringify(report, null, 2));
  else console.log(`[convergence] ${status}${report.targetSha ? ` target=${report.targetSha.slice(0, 12)}` : ''}${report.liveSha ? ` live=${report.liveSha.slice(0, 12)}` : ''}${report.ciRunId ? ` ciRun=${report.ciRunId}` : ''}${report.notes.length ? ` notes=${report.notes.join(' | ')}` : ''}`);
  process.exit(exitCode);
}

if (!TOKEN) finish('ERROR_MISSING_TOKEN', 1);
if (!REPO) finish('ERROR_MISSING_REPOSITORY', 1);

// v59.49 (refresh-data 10-30 14:23Z): one GitHub 500 on the CI dispatch failed a refresh whose data was already pushed.
// A 5xx gets one retry; a duplicate dispatch is harmless (CI concurrency groups by release_sha).
async function api(path, options = {}, attempt = 1) {
  try {
    return await apiOnce(path, options);
  } catch (error) {
    if (attempt >= 2 || !/ -> 5\d\d /.test(`${error.message} `)) throw error;
    note(`retrying after ${error.message.slice(0, 80)}`);
    await sleep(5000);
    return api(path, options, attempt + 1);
  }
}

async function apiOnce(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${TOKEN}`,
      'x-github-api-version': '2022-11-28',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status} ${text.slice(0, 200)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dispatchWorkflow(file, inputs) {
  if (DRY_RUN) {
    report.actions.push({ action: 'dispatch', workflow: file, inputs, dryRun: true });
    note(`dry-run would dispatch ${file}`);
    return false;
  }
  await api(`/repos/${REPO}/actions/workflows/${file}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs })
  });
  report.actions.push({ action: 'dispatch', workflow: file, inputs, dryRun: false });
  return true;
}

async function resolveTargetSha() {
  if (AWAIT_SHA) return AWAIT_SHA;
  if (process.env.AIO_CONVERGENCE_TARGET_SHA) return process.env.AIO_CONVERGENCE_TARGET_SHA;
  const commit = await api(`/repos/${REPO}/commits/main`);
  return commit.sha;
}

async function listCiRuns(sha) {
  const payload = await api(`/repos/${REPO}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=30`);
  return (payload.workflow_runs || []).filter((run) => run.head_sha === sha);
}

async function runHasAttestation(runId) {
  const payload = await api(`/repos/${REPO}/actions/runs/${runId}/artifacts`);
  return (payload.artifacts || []).some((artifact) => artifact.name === 'aio-release-attestation' && artifact.expired === false);
}

// Newest completed+successful run that still carries a live attestation artifact.
// A successful run whose attest job was skipped (PR runs) is not deployable.
async function findAttestedRun(runs) {
  const candidates = runs
    .filter((run) => run.status === 'completed' && run.conclusion === 'success')
    .sort((left, right) => Number(right.id) - Number(left.id));
  for (const run of candidates) {
    if (await runHasAttestation(run.id)) return run;
  }
  return null;
}

// Pipeline redesign (2026-10-19): on weekdays every cycle awaits its own new commit, and a CI run that settles after the
// 12-minute wait ended that cycle as AWAITING (green); the next cycle awaited a newer commit, so a failed data CI was
// seen only by the 6-hour freshness watchdog. Each awaiting cycle now looks back at the newest settled dispatched data
// CI for an earlier revision: a failure there (with nothing newer settled green) fails this cycle within ~30 minutes.
// v58.77 (pipeline audit OPS-02): a CI run that timed out, needs approval or never started is a failed attestation too;
// only a cancelled run (superseded by a newer one) or a skipped one stays green.
const UNSUCCESSFUL = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);
const unsuccessful = (run) => UNSUCCESSFUL.has(run && run.conclusion);

async function previousDataCiFailure(targetSha) {
  const payload = await api(`/repos/${REPO}/actions/workflows/ci.yml/runs?branch=main&event=workflow_dispatch&per_page=20`);
  const earlier = (payload.workflow_runs || [])
    .filter((run) => run.head_sha !== targetSha && run.status === 'completed' && run.conclusion !== 'cancelled' && run.conclusion !== 'skipped')
    .sort((left, right) => Number(right.id) - Number(left.id));
  return earlier[0] && unsuccessful(earlier[0]) ? earlier[0] : null;
}

async function awaitAttestedRun(sha) {
  const deadline = Date.now() + TIMEOUT_MIN * 60000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const runs = await listCiRuns(sha);
    const attested = await findAttestedRun(runs);
    if (attested) return { attested, runs };
    if (runs.length > 0 && runs.every((run) => run.status === 'completed')) {
      return { attested: null, runs, settled: true };
    }
    await sleep(POLL_MS);
  }
  return { attested: null, runs: await listCiRuns(sha), timedOut: true };
}

async function readLiveSha() {
  try {
    const response = await fetch(`${LIVE_BASE}/deployment.json?convergence=${Date.now()}`, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      note(`live deployment.json returned ${response.status}`);
      return null;
    }
    const payload = await response.json();
    return typeof payload.sourceSha === 'string' ? payload.sourceSha : null;
  } catch (error) {
    note(`live deployment.json unreadable: ${error.message}`);
    return null;
  }
}

try {
  report.targetSha = await resolveTargetSha();

  if (AWAIT_SHA) {
    const awaited = await awaitAttestedRun(report.targetSha);
    if (awaited.timedOut) {
      note(`waited ${TIMEOUT_MIN}min for an attested CI run without success; the next scheduled cycle converges`);
      const earlierFailure = await previousDataCiFailure(report.targetSha).catch(() => null);
      if (earlierFailure) note(`the previous data revision ${String(earlierFailure.head_sha).slice(0, 12)} settled with a failed CI run ${earlierFailure.id} after its own wait`);
      finish('AWAITING_CI_ATTESTATION', earlierFailure ? 1 : 0);
    }
    if (!awaited.attested) {
      note(awaited.settled
        ? 'CI finished for this revision without a successful attested run; refusing to deploy an unattested revision'
        : 'no attested CI run yet; the next scheduled cycle converges');
      // v57.88 (automation audit): 16 consecutive failed data-commit CI runs (2026-10-15 21:55Z~10-16 07:52Z) froze Pages
      // for 5.7 hours while every refresh run stayed green — a dispatched CI run emits no workflow_run, so nothing alerted.
      // A revision whose CI settled with a failure now fails this job (and the alert that follows it); a run that was only
      // cancelled by a newer one stays green.
      const ciFailed = (awaited.settled && (awaited.runs || []).some(unsuccessful))
        || (!awaited.settled && !!(await previousDataCiFailure(report.targetSha).catch(() => null)));
      finish(awaited.settled ? 'UNATTESTED_REVISION' : 'AWAITING_CI_ATTESTATION', ciFailed ? 1 : 0);
    }
    report.ciRunId = awaited.attested.id;
  } else {
    const runs = await listCiRuns(report.targetSha);
    const attested = await findAttestedRun(runs);
    if (!attested) {
      const anyCompleted = runs.some((run) => run.status === 'completed');
      if (runs.length === 0) {
        // A lost dispatch is the failure mode this driver exists for: no run was
        // ever created for the target revision, so ask CI to validate it.
        await dispatchWorkflow('ci.yml', { release_sha: report.targetSha });
        finish('DISPATCHED_CI');
      }
      note(`no successful attested CI run for the target revision (${runs.length} run(s), completed=${anyCompleted})`);
      // v57.92 (audit W06): the --await-sha branch already turned a settled CI failure red (v57.88); this default branch
      // (used after "No changes" cycles) ended green on the same state. Both now share the rule: every run finished and
      // one failed → exit 1. A cancelled run or one still running stays green.
      const settledFailure = runs.length > 0 && runs.every((run) => run.status === 'completed') && runs.some(unsuccessful);
      finish('UNATTESTED_REVISION', settledFailure ? 1 : 0);
    }
    report.ciRunId = attested.id;
  }

  report.liveSha = await readLiveSha();
  if (report.liveSha === report.targetSha) finish('CONVERGED');

  await dispatchWorkflow('pages-deploy.yml', {
    ci_run_id: String(report.ciRunId),
    expected_sha: report.targetSha
  });
  finish('DISPATCHED_DEPLOY');
} catch (error) {
  note(`hard error: ${error.message}`);
  finish('ERROR', 1);
}
