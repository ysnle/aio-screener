#!/usr/bin/env node
// scripts/verify-refresh-candidate.mjs — P1265/E2-C6 P1
//
// The refresh workflows used to re-run the heavy artifact checks inside the
// fail-closed promotion gate even though nothing wrote artifacts between the
// earlier validation and the gate — the repetition the E2-C6 audit measured.
// This script binds the candidate instead: after the last producer write and
// validation, `--record` hashes the exact changed file set (the tree that will
// be committed), and the promotion gate's `--expect` re-hashes and fails on any
// drift. One fail-closed candidate check after the last assembly, with the
// early gates kept for fast feedback.
//
//   node scripts/verify-refresh-candidate.mjs --record <path> [--paths a,b,c]
//   node scripts/verify-refresh-candidate.mjs --expect <path> [--paths a,b,c]
//   node scripts/verify-refresh-candidate.mjs --expect-staged <path>
//   node scripts/verify-refresh-candidate.mjs --expect-commit <path>
//   node scripts/verify-refresh-candidate.mjs --self-test
//
// Exit codes: 0 ok, 1 candidate mismatch (explicit cause), 2 usage/state error.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// The candidate always belongs to one repository. Production runs use the script's
// own repo root; fixtures point at an isolated throwaway repo instead.
const repoCwd = process.env.AIO_QA_CANDIDATE_REPO ? resolve(process.env.AIO_QA_CANDIDATE_REPO) : root;

function gitLines(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr || result.error || '').trim()}`);
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.replaceAll('\\', '/'));
}

function candidateFiles(cwd, explicitPaths) {
  if (explicitPaths && explicitPaths.length) return [...new Set(explicitPaths.map((value) => value.trim().replaceAll('\\', '/')).filter(Boolean))].sort();
  return [...new Set([...gitLines(cwd, ['diff', '--name-only', 'HEAD']), ...gitLines(cwd, ['ls-files', '--others', '--exclude-standard'])])].sort();
}

// P1415: a producer may delete files (the masters builder garbage-collects unreferenced 13F
// projections). A tracked file that is gone from the worktree is a deletion in the candidate, not an
// unreadable file — treating it as MISSING failed every operator dispatch (it always runs the full
// 13F chain) while schedule runs, which rarely do, passed.
function deletedFiles(cwd, files) {
  return files.filter((file) => !existsSync(join(cwd, file))
    && spawnSync('git', ['cat-file', '-e', `HEAD:${file}`], { cwd }).status === 0);
}

function digestCandidate(cwd, files, deleted = []) {
  const hash = createHash('sha256');
  const missing = [];
  const deletedSet = new Set(deleted);
  for (const file of files) {
    hash.update(`\0${file}\0`);
    if (deletedSet.has(file)) { hash.update('DELETED'); continue; }
    try {
      hash.update(createHash('sha256').update(readFileSync(join(cwd, file))).digest('hex'));
    } catch {
      missing.push(file);
      hash.update('MISSING');
    }
  }
  return { digest: hash.digest('hex'), missing };
}

function digestGitTree(cwd, files, revision, deleted = []) {
  const hash = createHash('sha256');
  const missing = [];
  const deletedSet = new Set(deleted);
  for (const file of files) {
    hash.update(`\0${file}\0`);
    const objectSpec = `${revision}:${file}`;
    const sizeResult = spawnSync('git', ['cat-file', '-s', objectSpec], { cwd, encoding: 'utf8', maxBuffer: 4096 });
    const expectedBytes = Number(String(sizeResult.stdout || '').trim());
    // P1415: a recorded deletion must be absent from the staged/committed tree.
    if (deletedSet.has(file)) { hash.update(sizeResult.status === 0 ? 'PRESENT' : 'DELETED'); continue; }
    if (sizeResult.status !== 0 || !Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
      missing.push(file);
      hash.update('MISSING');
      continue;
    }
    // Node's spawnSync default maxBuffer is 1 MiB; history.json already exceeds
    // that. Query the immutable blob size first so staged/rebased blobs are read
    // completely without choosing an arbitrary global limit.
    const blob = spawnSync('git', ['show', objectSpec], {
      cwd,
      encoding: null,
      maxBuffer: Math.max(1, expectedBytes + 1)
    });
    if (blob.status !== 0 || !Buffer.isBuffer(blob.stdout) || blob.stdout.length !== expectedBytes) {
      missing.push(file);
      hash.update('MISSING');
    } else {
      hash.update(createHash('sha256').update(blob.stdout).digest('hex'));
    }
  }
  return { digest: hash.digest('hex'), missing };
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

function record(cwd, outPath, explicitPaths) {
  const files = candidateFiles(cwd, explicitPaths);
  const deleted = deletedFiles(cwd, files);
  const { digest, missing } = digestCandidate(cwd, files, deleted);
  const payload = { schemaVersion: 'aio-refresh-candidate.v1', recordedAt: new Date().toISOString(), cwd, files, deleted, digest, missing };
  atomicWrite(outPath, payload);
  console.log(`[refresh-candidate] recorded ${files.length} file(s) (${deleted.length} deleted) digest=${digest.slice(0, 12)} at ${outPath}`);
  if (missing.length) {
    console.error(`[refresh-candidate] WARN unreadable file(s) recorded as MISSING: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function expect(cwd, expectPath, explicitPaths) {
  if (!existsSync(expectPath)) {
    console.error(`[refresh-candidate] no recorded candidate at ${expectPath} — run --record after the last validated assembly first`);
    process.exit(2);
  }
  let baseline = null;
  try {
    baseline = JSON.parse(readFileSync(expectPath, 'utf8'));
  } catch (error) {
    console.error(`[refresh-candidate] recorded candidate unreadable at ${expectPath}: ${error.message}`);
    process.exit(2);
  }
  if (baseline.schemaVersion !== 'aio-refresh-candidate.v1' || baseline.cwd !== cwd || !Array.isArray(baseline.files)) {
    console.error('[refresh-candidate] recorded candidate schema or repository does not match this run');
    process.exit(2);
  }
  const files = explicitPaths && explicitPaths.length ? candidateFiles(cwd, explicitPaths) : baseline.files;
  const { digest, missing } = digestCandidate(cwd, files, deletedFiles(cwd, files));
  const changedSet = candidateFiles(cwd, explicitPaths);
  const drift = [];
  if (digest !== baseline.digest) drift.push('content-or-set drift since the recorded candidate');
  if (!explicitPaths && changedSet.join('\n') !== [...baseline.files].sort().join('\n')) drift.push('changed file set differs from the recorded candidate');
  if (missing.length) drift.push(`unreadable file(s): ${missing.join(', ')}`);
  if (drift.length) {
    console.error(`[refresh-candidate] CANDIDATE MISMATCH vs ${expectPath} (recorded ${baseline.recordedAt}, run ${baseline.digest?.slice(0, 12)}):`);
    for (const reason of drift) console.error(`  - ${reason}`);
    console.error('[refresh-candidate] re-run the producer validation for this exact tree before publishing — nothing is promoted from an unverified candidate.');
    process.exit(1);
  }
  console.log(`[refresh-candidate] candidate matches the validated tree (${files.length} file(s), digest=${digest.slice(0, 12)})`);
}

function expectGitTree(cwd, expectPath, revision) {
  if (!existsSync(expectPath)) {
    console.error(`[refresh-candidate] no recorded candidate at ${expectPath}`);
    process.exit(2);
  }
  let baseline;
  try { baseline = JSON.parse(readFileSync(expectPath, 'utf8')); }
  catch (error) {
    console.error(`[refresh-candidate] recorded candidate unreadable: ${error.message}`);
    process.exit(2);
  }
  if (baseline.schemaVersion !== 'aio-refresh-candidate.v1' || baseline.cwd !== cwd || !Array.isArray(baseline.files)) {
    console.error('[refresh-candidate] recorded candidate schema or repository does not match this run');
    process.exit(2);
  }
  const files = revision === '' ? gitLines(cwd, ['diff', '--cached', '--name-only', 'HEAD']) : baseline.files;
  const { digest, missing } = digestGitTree(cwd, baseline.files, revision, Array.isArray(baseline.deleted) ? baseline.deleted : []);
  const drift = [];
  if (revision === '' && files.sort().join('\n') !== [...baseline.files].sort().join('\n')) drift.push('staged file set differs from the validated candidate');
  if (digest !== baseline.digest) drift.push('staged/committed content differs from the validated candidate');
  if (missing.length) drift.push(`missing blob(s): ${missing.join(', ')}`);
  if (drift.length) {
    console.error(`[refresh-candidate] CANDIDATE MISMATCH at ${revision === '' ? 'index' : revision}: ${drift.join('; ')}`);
    process.exit(1);
  }
  console.log(`[refresh-candidate] ${revision === '' ? 'staged' : 'committed'} tree matches validated candidate (${baseline.files.length} file(s))`);
}

function selfTest() {
  const temp = mkdtempSync(join(tmpdir(), 'aio-refresh-candidate-'));
  try {
    const repo = join(temp, 'repo');
    mkdirSync(repo, { recursive: true });
    const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    git('init');
    git('config', 'user.email', 'fixture@aio.test');
    git('config', 'user.name', 'fixture');
    writeFileSync(join(repo, 'artifact.json'), '{"v":1}\n');
    git('add', 'artifact.json');
    const commit = git('commit', '-m', 'init');
    if (commit.status !== 0) throw new Error(`fixture commit failed: ${commit.stderr}`);
    const baselinePath = join(temp, 'candidate.json');

    record(repo, baselinePath, null);
    // tamper after recording — the expect must fail with an explicit cause
    writeFileSync(join(repo, 'artifact.json'), '{"v":2}\n');
    const runCli = (...cliArgs) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...cliArgs], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, AIO_QA_CANDIDATE_REPO: repo }
    });
    const tampered = runCli('--expect', baselinePath);
    if (tampered.status !== 1 || !/CANDIDATE MISMATCH/.test(tampered.stderr)) throw new Error(`tampered candidate was not rejected: ${tampered.status} ${tampered.stderr}`);
    // re-record the new tree — expect must pass
    // P1299/QA-DATA-42: staged and committed blobs above Node's default 1 MiB buffer remain verifiable.
    writeFileSync(join(repo, 'large.bin'), Buffer.alloc(1024 * 1024 + 64, 0x61));
    record(repo, baselinePath, null);
    const clean = runCli('--expect', baselinePath);
    if (clean.status !== 0) throw new Error(`clean candidate was rejected: ${clean.status} ${clean.stderr}`);
    // a new untracked file after recording must fail the set check
    writeFileSync(join(repo, 'extra.json'), '{}\n');
    const widened = runCli('--expect', baselinePath);
    if (widened.status !== 1 || !/changed file set differs/.test(widened.stderr)) throw new Error(`widened candidate set was not rejected: ${widened.status} ${widened.stderr}`);
    // missing baseline must fail closed
    const absent = runCli('--expect', join(temp, 'nope.json'));
    if (absent.status !== 2) throw new Error(`absent baseline was not rejected: ${absent.status}`);
    rmSync(join(repo, 'extra.json'));
    const unstaged = runCli('--expect-staged', baselinePath);
    if (unstaged.status !== 1 || !/CANDIDATE MISMATCH/.test(unstaged.stderr)) throw new Error(`unstaged candidate was accepted as staged: ${unstaged.status} ${unstaged.stderr}`);
    git('add', 'artifact.json', 'large.bin');
    const staged = runCli('--expect-staged', baselinePath);
    if (staged.status !== 0) throw new Error(`P1299/QA-DATA-42 staged candidate with >1 MiB blob was rejected: ${staged.stderr}`);
    git('commit', '-m', 'validated');
    const committed = runCli('--expect-commit', baselinePath);
    if (committed.status !== 0) throw new Error(`P1299/QA-DATA-42 committed candidate with >1 MiB blob was rejected: ${committed.stderr}`);
    // P1415: a producer deletion is part of the candidate through every gate.
    rmSync(join(repo, 'artifact.json'));
    record(repo, baselinePath, null);
    const deletedExpect = runCli('--expect', baselinePath);
    if (deletedExpect.status !== 0) throw new Error(`P1415 a deleted tracked file was treated as unreadable: ${deletedExpect.stderr}`);
    git('add', '-A');
    const deletedStaged = runCli('--expect-staged', baselinePath);
    if (deletedStaged.status !== 0) throw new Error(`P1415 staged deletion rejected: ${deletedStaged.stderr}`);
    git('commit', '-m', 'gc');
    const deletedCommitted = runCli('--expect-commit', baselinePath);
    if (deletedCommitted.status !== 0) throw new Error(`P1415 committed deletion rejected: ${deletedCommitted.stderr}`);
    console.log('[refresh-candidate] self-test OK: tamper rejection, clean accept, set-drift rejection, >1 MiB staged/committed blob support, producer deletions and missing-baseline fail-closed');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const pathsArg = flag('--paths');
const explicitPaths = pathsArg ? pathsArg.split(',') : null;

if (args.includes('--self-test')) {
  selfTest();
} else if (args.includes('--record')) {
  const out = flag('--record');
  if (!out) {
    console.error('usage: verify-refresh-candidate.mjs --record <path> [--paths a,b,c]');
    process.exit(2);
  }
  record(repoCwd, resolve(out), explicitPaths);
} else if (args.includes('--expect')) {
  const expectPath = flag('--expect');
  if (!expectPath) {
    console.error('usage: verify-refresh-candidate.mjs --expect <path> [--paths a,b,c]');
    process.exit(2);
  }
  expect(repoCwd, resolve(expectPath), explicitPaths);
} else if (args.includes('--expect-staged') || args.includes('--expect-commit')) {
  const revision = args.includes('--expect-staged') ? '' : 'HEAD';
  const expectPath = flag(revision === '' ? '--expect-staged' : '--expect-commit');
  if (!expectPath) process.exit(2);
  expectGitTree(repoCwd, resolve(expectPath), revision);
} else {
  console.error('usage: verify-refresh-candidate.mjs --record <path> | --expect <path> | --self-test');
  process.exit(2);
}
