#!/usr/bin/env node
// v59.78 (automation audit 2026-11-08): decides which code a reduced-scope (refresh) release ships on.
//
//   direct  — the newest code commit under the refresh commit has a successful full push CI (P1952 treesame rule), so
//             the refresh commit itself is the release, as before.
//   overlay — that code commit's full push CI settled red. The release is the last code commit with a successful full
//             push CI plus the refresh commit's generated paths (scripts/build-data-overlay.mjs). Before v59.78 this
//             case refused every refresh release until the code was fixed (11/07 09:26-12:03Z, 13:25-16:45Z; 11/08 07:12Z).
//   wait    — that push CI is still queued or running. The resolver polls (default 15 min) instead of refusing: on
//             11/07 03:01Z a refresh CI reached attest two minutes before the v59.70 push CI turned green and was refused.
//
//   node scripts/resolve-release-source.mjs --sha <refresh sha> [--wait-min 15] [--github-output] [--json]
//   node scripts/resolve-release-source.mjs --sha <refresh sha> --verify-code-sha <sha>   (attest re-check, no wait)

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { OVERLAY_GENERATED_PATHS } from './build-data-overlay.mjs';

const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const HISTORY_LIMIT = 400;

const git = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim().slice(0, 300)}`);
  return result.stdout.trim();
};

/** Newest first-parent commit at or below `sha` that changes anything outside the refresh-generated paths. */
export function sourceCommitOf(sha) {
  return git(['log', '-1', '--first-parent', '--format=%H', sha, '--', '.', ...OVERLAY_GENERATED_PATHS.map((path) => `:(exclude)${path}`)]);
}

/**
 * First-parent history from `sha` down to `sourceSha`, however many refresh commits sit above it, plus `limit` older
 * commits to find the last green code in. Codex review on PR #161: a fixed 400-commit window dropped the code commit
 * after ~8 quiet days of 30-minute refreshes and refused every later release.
 */
export function firstParentChain(sha, sourceSha = null, limit = HISTORY_LIMIT) {
  const above = sourceSha ? Number(git(['rev-list', '--first-parent', '--count', `${sourceSha}..${sha}`])) : 0;
  return git(['rev-list', '--first-parent', `--max-count=${above + limit}`, sha]).split('\n').filter(Boolean);
}

/**
 * Pure decision. `chain` is first-parent history from the refresh commit down (chain[0] = refresh sha), `sourceSha` the
 * newest code commit in it, `pushRuns(sha)` the main push CI runs on a commit ({ status, conclusion }).
 * Returns { mode: 'direct'|'overlay'|'wait'|'refuse', codeSha, testedOn, reason }.
 */
export function decideReleaseSource({ chain, sourceSha, pushRuns }) {
  const refreshSha = chain[0];
  const sourceIndex = chain.indexOf(sourceSha);
  if (!sourceSha || sourceSha === refreshSha || sourceIndex < 0) {
    return { mode: 'refuse', codeSha: null, testedOn: null, reason: `reduced-scope CI cannot attest ${refreshSha}: it changes files outside the refresh-generated paths` };
  }
  // P1952: every first-parent commit from the refresh commit (exclusive) down to sourceSha holds the same code tree.
  const treesame = chain.slice(1, sourceIndex + 1);
  for (const candidate of treesame) {
    if (pushRuns(candidate).some((run) => run.status === 'completed' && run.conclusion === 'success')) {
      return { mode: 'direct', codeSha: refreshSha, testedOn: candidate, reason: `code ${sourceSha.slice(0, 12)} has a successful full push CI on ${candidate.slice(0, 12)}` };
    }
  }
  const active = treesame.find((candidate) => pushRuns(candidate).some((run) => ACTIVE.has(run.status)));
  if (active) return { mode: 'wait', codeSha: null, testedOn: null, reason: `full push CI for ${active.slice(0, 12)} is still running` };
  // The newest code is red (or was never pushed through CI). Ride on the newest code commit that passed.
  for (const candidate of chain.slice(sourceIndex + 1)) {
    if (pushRuns(candidate).some((run) => run.status === 'completed' && run.conclusion === 'success')) {
      return { mode: 'overlay', codeSha: candidate, testedOn: candidate, reason: `code ${sourceSha.slice(0, 12)} has no successful full push CI; data rides on ${candidate.slice(0, 12)}, the newest code that passed` };
    }
  }
  return { mode: 'refuse', codeSha: null, testedOn: null, reason: `no successful full push CI in the last ${chain.length} first-parent commits` };
}

async function listMainPushRuns(repository, token) {
  const runs = [];
  for (let page = 1; page <= 3; page += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=100&page=${page}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub push CI listing HTTP ${response.status}`);
    const body = await response.json();
    runs.push(...(body.workflow_runs || []));
    if ((body.workflow_runs || []).length < 100) break;
  }
  const bySha = new Map();
  for (const run of runs) {
    if (!bySha.has(run.head_sha)) bySha.set(run.head_sha, []);
    bySha.get(run.head_sha).push({ id: run.id, status: run.status, conclusion: run.conclusion });
  }
  return (sha) => bySha.get(sha) || [];
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const known = new Set(['--sha', '--wait-min', '--verify-code-sha', '--github-output', '--json', '--poll-ms']);
  for (const arg of args) if (arg.startsWith('--') && !known.has(arg)) throw new Error(`unknown argument ${arg}`);
  const sha = value('--sha');
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('--sha must be a 40-hex commit');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) throw new Error('GH_TOKEN and GITHUB_REPOSITORY are required');
  const verify = value('--verify-code-sha');
  const deadline = Date.now() + (verify ? 0 : Number(value('--wait-min') ?? 15)) * 60000;
  const pollMs = Number(value('--poll-ms') || 30000);
  const sourceSha = sourceCommitOf(sha);
  const chain = firstParentChain(sha, sourceSha);
  let decision;
  for (;;) {
    decision = decideReleaseSource({ chain, sourceSha, pushRuns: await listMainPushRuns(repository, token) });
    if (decision.mode !== 'wait' || Date.now() >= deadline) break;
    console.log(`[release-source] waiting: ${decision.reason}`);
    await new Promise((resolveSleep) => setTimeout(resolveSleep, pollMs));
  }
  if (decision.mode === 'wait') decision = { ...decision, mode: 'refuse', reason: `${decision.reason}; gave up waiting (the next refresh cycle retries)` };
  if (verify) {
    // Attest re-check: preflight's overlay choice stays valid when its code commit still has its successful push CI and
    // sits on this release's first-parent line; a direct choice needs the direct rule to hold now.
    const pushRuns = await listMainPushRuns(repository, token);
    const ok = verify === sha
      ? decision.mode === 'direct'
      : chain.includes(verify) && pushRuns(verify).some((run) => run.status === 'completed' && run.conclusion === 'success');
    if (!ok) throw new Error(`release source ${verify.slice(0, 12)} for ${sha.slice(0, 12)} no longer verifies (${decision.reason})`);
    console.log(`[release-source] verified ${verify === sha ? 'direct' : 'overlay'} release ${sha.slice(0, 12)} on code ${verify.slice(0, 12)}`);
    return;
  }
  const result = { schemaVersion: 'aio-release-source.v1', refreshSha: sha, sourceSha, ...decision };
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(`[release-source] ${decision.mode}: ${decision.reason}`);
  if (decision.mode === 'refuse') {
    console.log(`::error::${decision.reason}`);
    process.exit(1);
  }
  if (decision.mode === 'overlay') console.log(`::warning::data overlay release: ${decision.reason}`);
  if (args.includes('--github-output') && process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `release_mode=${decision.mode}\ncode_sha=${decision.codeSha}\n`);
  }
}

if (process.argv[1]?.endsWith('resolve-release-source.mjs')) {
  main().catch((error) => { console.error(`[release-source] ${error.message}`); process.exit(1); });
}
