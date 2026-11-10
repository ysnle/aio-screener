#!/usr/bin/env node
// v59.85 (data-automation redesign): the one commit-and-push path for every producing workflow.
//
//   node scripts/publish-data-commit.mjs --set <id> [--candidate <file>] [--retry collision] [--branch main] [--no-dispatch]
//   node scripts/publish-data-commit.mjs --list
//
// The set (paths, timestamp-only rules, hooks, collision policy) comes from scripts/lib/data-publish-sets.mjs. Order:
//   stage → put timestamp-only files back to HEAD → refuse unparsable JSON → afterStage hooks → 50 MB check →
//   nothing staged? done → beforeCommit hooks → commit → verifyCommit → push; on rejection fetch, `rebase --autostash`,
//   verifyCommit again, retry (5 attempts, jittered) → dispatch exact-SHA CI.
// A rebase conflict or a rebased tree that no longer verifies follows the set's onRebaseFail: 'collision' dispatches one
// re-run from the new main (retry=collision) and ends green with collision=true; a second collision, or 'fail', exits 1.
// Writes changed / sha / collision to $GITHUB_OUTPUT. Exit codes: 0 published or nothing to publish, 1 refused, 2 usage.
//
// Test seams (scripts/ci-publish-data-commit-check.mjs drives this against a throwaway bare remote):
//   AIO_PUBLISH_GH       command used instead of `gh`, or a .js/.mjs/.cjs script run with Node (receives the same arguments)
//   AIO_PUBLISH_SLEEP_MS fixed back-off between push attempts (default: attempt × 3 s + up to 5 s jitter)
//   AIO_PUBLISH_NOW      ISO time used for the commit-message minute
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { DATA_PUBLISH_SETS } from './lib/data-publish-sets.mjs';
import { sameExcept } from './lib/json-same-except.mjs';

export const MAX_PUBLISH_BYTES = 50 * 1024 * 1024;
const MAX_ATTEMPTS = 5;

function parseArgs(argv) {
  const out = { set: null, candidate: null, retry: '', branch: 'main', dispatch: true, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => { const value = argv[i + 1]; if (value == null) throw new Error(`${arg} needs a value`); i += 1; return value; };
    if (arg === '--set') out.set = next();
    else if (arg === '--candidate') out.candidate = next();
    else if (arg === '--retry') out.retry = next();
    else if (arg === '--branch') out.branch = next();
    else if (arg === '--no-dispatch') out.dispatch = false;
    else if (arg === '--list') out.list = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return out;
}

const git = (args, opts = {}) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...opts });
const gitOk = (args) => git(args).status === 0;
function gitOut(args) {
  const result = git(args);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(result.stderr || '').trim()}`);
  return String(result.stdout || '');
}
const shell = (command, env) => spawnSync('bash', ['-c', command], { stdio: 'inherit', env }).status === 0;
const sleepMs = (ms) => { if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
const output = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
};
const stagedNames = () => gitOut(['diff', '--staged', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
const headJson = (path) => {
  const shown = git(['show', `HEAD:${path}`]);
  if (shown.status !== 0) return undefined;
  try { return JSON.parse(shown.stdout); } catch { return undefined; }
};
function gh(args) {
  const bin = process.env.AIO_PUBLISH_GH;
  if (bin && /\.(mjs|cjs|js)$/.test(bin)) return spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' }).status === 0;
  const result = bin ? spawnSync(bin, args, { stdio: 'inherit' }) : spawnSync('gh', args, { stdio: 'inherit' });
  return result.status === 0;
}

export function publish({ set: id, candidate = null, retry = '', branch = 'main', dispatch = true, sets = DATA_PUBLISH_SETS }) {
  const set = sets[id];
  if (!set) { console.error(`::error::unknown publish set ${id}; known: ${Object.keys(sets).join(', ')}`); return 2; }
  if (set.candidateFile && !candidate) { console.error(`::error::set ${id} verifies a candidate; pass --candidate`); return 2; }
  const env = { ...process.env, CANDIDATE: candidate || '' };
  const fail = (message) => { console.error(`::error::${message}`); return 1; };

  // The push below names refs/heads/<branch> explicitly, so a run checked out on any other branch (a workflow_dispatch from
  // a feature branch) would fast-forward that branch's code into <branch> together with its data. Refuse it up front.
  const head = git(['symbolic-ref', '--short', '-q', 'HEAD']).stdout?.trim() || '';
  if (head !== branch) return fail(`${id}: checked out ${head || 'a detached HEAD'}, not ${branch}; data is published only from ${branch}`);

  git(['config', 'user.name', 'aio-data-bot']);
  git(['config', 'user.email', 'actions@github.com']);

  // 1. Stage. A required path that is missing is a producer failure, not an empty cycle.
  for (const path of set.required) {
    if (!existsSync(path)) return fail(`${id}: required output ${path} is missing`);
    if (!gitOk(['add', '--', path])) return fail(`${id}: git add ${path} failed`);
  }
  for (const path of set.optional) if (existsSync(path) && !gitOk(['add', '--', path])) return fail(`${id}: git add ${path} failed`);

  // 2. Timestamp-only rewrites go back to HEAD in the index AND the worktree; a modified-but-unstaged file left behind
  // is what made the next rebase refuse to run (run 42480198913).
  for (const [path, keys] of Object.entries(set.timestampOnly || {})) {
    if (!stagedNames().includes(path)) continue;
    const before = headJson(path);
    let after;
    try { after = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; } // the parse check below names it
    if (before !== undefined && sameExcept(before, after, keys)) {
      gitOut(['reset', '-q', '--', path]);
      gitOut(['checkout', 'HEAD', '--', path]);
      console.log(`${path}: only ${keys.join(', ')} changed; kept the published bytes`);
    }
  }

  // 3. Nothing unparsable reaches main.
  for (const path of stagedNames()) {
    if (!path.endsWith('.json')) continue;
    try { JSON.parse(readFileSync(path, 'utf8')); } catch (error) { return fail(`${id}: staged ${path} is not valid JSON (${error.message})`); }
  }

  // 4. Set-specific checks on the staged tree.
  for (const command of set.afterStage) if (!shell(command, env)) return fail(`${id}: afterStage check failed: ${command}`);

  // 5. GitHub warns at 50 MB and rejects a file over 100 MB; stop before the commit and name the file.
  const oversized = stagedNames().filter((path) => existsSync(path) && statSync(path).isFile() && statSync(path).size > MAX_PUBLISH_BYTES)
    .map((path) => `${path}(${Math.round(statSync(path).size / 1048576)}MB)`);
  if (oversized.length) return fail(`staged file(s) over the 50 MB publish limit: ${oversized.join(' ')}`);

  if (gitOk(['diff', '--staged', '--quiet'])) {
    console.log(`${id}: nothing changed; no commit`);
    output('changed', 'false');
    return 0;
  }

  for (const command of set.beforeCommit) if (!shell(command, env)) return fail(`${id}: beforeCommit step failed: ${command}`);

  const minute = new Date(process.env.AIO_PUBLISH_NOW || Date.now()).toISOString().slice(0, 16);
  if (!gitOk(['commit', '-q', '-m', `${set.message} ${minute}Z`])) return fail(`${id}: git commit failed`);
  const verified = () => set.verifyCommit.every((command) => shell(command, env));
  if (!verified()) return fail(`${id}: the commit does not match its validated candidate`);

  const onRebaseFail = (reason) => {
    git(['rebase', '--abort']);
    if (set.onRebaseFail !== 'collision' || !set.collision) return fail(`${id}: ${reason}; not pushing`);
    if (retry === 'collision') return fail(`${id}: ${reason} again on the collision retry; main keeps changing the files this run produces`);
    const inputs = Object.entries({ ...set.collision.inputs, retry: 'collision' }).flatMap(([key, value]) => ['-f', `${key}=${value}`]);
    if (!gh(['workflow', 'run', set.collision.workflow, '--ref', branch, ...inputs])) return fail(`${id}: ${reason}, and the collision re-run could not be dispatched`);
    console.log(`::warning::${id}: ${reason}; this cycle is re-run from the new ${branch} by a dispatched collision retry.`);
    output('changed', 'false');
    output('collision', 'true');
    return 0;
  };

  for (let attempt = 1; ; attempt += 1) {
    if (gitOk(['push', 'origin', `HEAD:refs/heads/${branch}`])) break;
    if (attempt >= MAX_ATTEMPTS) return fail(`${id}: git push failed after ${MAX_ATTEMPTS} attempts; ${branch} moved faster than this job could catch up`);
    console.log(`push rejected (attempt ${attempt}/${MAX_ATTEMPTS}); rebasing onto the latest ${branch}`);
    if (!gitOk(['fetch', '-q', 'origin', branch])) return fail(`${id}: git fetch origin ${branch} failed`);
    if (!gitOk(['rebase', '-q', '--autostash', `origin/${branch}`])) {
      const conflicted = gitOut(['diff', '--name-only', '--diff-filter=U']).trim().split('\n').filter(Boolean).join(' ');
      return onRebaseFail(`rebase conflict${conflicted ? ` on ${conflicted}` : ''}`);
    }
    if (!verified()) return onRebaseFail('the rebased tree no longer matches the validated candidate');
    const fixed = process.env.AIO_PUBLISH_SLEEP_MS;
    sleepMs(fixed != null ? Number(fixed) : ((attempt + 1) * 3 + Math.floor(Math.random() * 5)) * 1000);
  }

  const sha = gitOut(['rev-parse', 'HEAD']).trim();
  output('changed', 'true');
  console.log(`${id}: pushed ${sha}`);
  // `sha` is the hand-over to converge, which waits for that SHA's CI. It is written only once the CI run exists; a
  // failed dispatch is a warning (the data is already on main), and converge then finds the newest attested release.
  if (dispatch && set.ciOrigin) {
    if (!gh(['workflow', 'run', 'ci.yml', '--ref', branch, '-f', `release_sha=${sha}`, '-f', `origin=${set.ciOrigin}`])) {
      console.log(`::warning::${id}: pushed ${sha} but the exact-SHA CI dispatch failed; the next cycle's release carries it`);
      return 0;
    }
    console.log(`Dispatched CI for exact ${id} commit ${sha}`);
  }
  output('sha', sha);
  return 0;
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry.endsWith('scripts/publish-data-commit.mjs')) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  if (args.list) {
    for (const [id, set] of Object.entries(DATA_PUBLISH_SETS)) console.log(`${id}\t${set.workflow}\t${set.required.length + set.optional.length} paths`);
    process.exit(0);
  }
  if (!args.set) { console.error('usage: publish-data-commit.mjs --set <id> [--candidate <file>] [--retry collision] [--branch main] [--no-dispatch] | --list'); process.exit(2); }
  process.exit(publish(args));
}
