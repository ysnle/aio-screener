#!/usr/bin/env node
// P1757: keeps the producer-only SEC ledger (public-data/sec-fundamentals.json, ~67 MB) off main's history.
// The ledger lives on the orphan branch `data-store` as ONE commit that each refresh-screener run force-pushes
// (no history growth, no Actions-cache eviction risk). Subcommands:
//
//   restore [--match-manifest] [--force] [--github-output]
//       Fallback chain: local file (kept unless --force) -> data-store branch -> last copy in main's history
//       (local git log, then the GitHub commits API + a depth-1 fetch) -> none. Prints {source, sha256}; exits 0 even
//       when nothing was found (the workflow decides: the producer then runs a full rebuild, CI gates skip).
//       --match-manifest accepts only a copy whose digest equals sec-fundamentals-summary.manifest.json sourceSha256
//       (main history is probed only while the data-store branch does not exist yet),
//       so a CI checkout validates exactly the ledger that produced its projection.
//   guard
//       Fails when the ledger holds fewer than 90% of the records main's projection manifest published, so a lost
//       ledger rebuilt from nothing can never shrink the public projection.
//   publish [--github-output]
//       Force-pushes the local ledger as a single parentless commit to data-store (lease-protected), unless the
//       branch already holds the identical blob. Run it BEFORE pushing main: main's manifest must never name a
//       digest the store never held.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  SEC_LEDGER_PATH, SEC_LEDGER_MANIFEST_PATH, SEC_STORE_BRANCH, SEC_STORE_FILE, canonicalSha256, repoPath
} from './lib/sec-ledger.mjs';

export const RECORD_FLOOR_RATIO = 0.9;
const STORE_REF = `refs/remotes/origin/${SEC_STORE_BRANCH}`;
const HISTORY_CANDIDATES = 6;
const cwd = repoPath('');

function git(args, { input, binary = false, allowFail = true } = {}) {
  const result = spawnSync('git', args, {
    cwd, input, encoding: binary ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  });
  const ok = result.status === 0;
  if (!ok && !allowFail) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr || '').trim().slice(0, 400)}`);
  return { ok, stdout: binary ? result.stdout : String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
}

const manifestDigest = () => {
  try { return JSON.parse(readFileSync(repoPath(SEC_LEDGER_MANIFEST_PATH), 'utf8')).sourceSha256 || null; } catch { return null; }
};

function writeLedger(buffer) {
  const target = repoPath(SEC_LEDGER_PATH);
  writeFileSync(`${target}.restore.tmp`, buffer);
  renameSync(`${target}.restore.tmp`, target);
}

function blobAt(spec) {
  const blob = git(['cat-file', 'blob', spec], { binary: true });
  return blob.ok && blob.stdout.length ? blob.stdout : null;
}

function accept(buffer, expectedDigest) {
  if (!buffer) return null;
  const text = buffer.toString('utf8');
  try { JSON.parse(text); } catch { return null; }
  const digest = canonicalSha256(text);
  if (expectedDigest && digest !== expectedDigest) return { rejected: true, digest };
  return { buffer, digest };
}

function repositorySlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = git(['remote', 'get-url', 'origin']).stdout;
  return url.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/)?.[1] || null;
}

async function historyCandidates() {
  const local = git(['log', `-n${HISTORY_CANDIDATES}`, '--format=%H', 'HEAD', '--', SEC_LEDGER_PATH]);
  const shas = local.ok ? local.stdout.split('\n').filter(Boolean) : [];
  const slug = repositorySlug();
  if (!slug) return shas;
  try {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
    const response = await fetch(`https://api.github.com/repos/${slug}/commits?sha=main&path=${encodeURIComponent(SEC_LEDGER_PATH)}&per_page=${HISTORY_CANDIDATES}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'aio-sec-ledger-restore', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (response.ok) for (const row of await response.json()) if (row?.sha && !shas.includes(row.sha)) shas.push(row.sha);
  } catch { /* offline or rate-limited: the local candidates (if any) stand */ }
  return shas;
}

async function restore({ force = false, matchManifest = false } = {}) {
  const expected = matchManifest ? manifestDigest() : null;
  const tried = [];
  if (existsSync(repoPath(SEC_LEDGER_PATH)) && !force) {
    const local = accept(readFileSync(repoPath(SEC_LEDGER_PATH)), expected);
    if (local && !local.rejected) return { source: 'local', sha256: local.digest, matchesManifest: local.digest === manifestDigest() };
    tried.push(`local:${local?.rejected ? `digest-mismatch:${local.digest.slice(0, 12)}` : 'unreadable'}`);
  }
  // 1. data-store branch (one commit, depth 1).
  const fetched = git(['fetch', '--no-tags', '--depth=1', 'origin', `+refs/heads/${SEC_STORE_BRANCH}:${STORE_REF}`]);
  if (fetched.ok) {
    const store = accept(blobAt(`${STORE_REF}:${SEC_STORE_FILE}`), expected);
    if (store && !store.rejected) {
      writeLedger(store.buffer);
      return { source: 'store', sha256: store.digest, matchesManifest: store.digest === manifestDigest(), commit: git(['rev-parse', STORE_REF]).stdout };
    }
    tried.push(`store:${store?.rejected ? `digest-mismatch:${store.digest.slice(0, 12)}` : 'missing-file'}`);
  } else tried.push('store:branch-unavailable');
  // A digest-matched restore (CI) reads history only while the store branch does not exist yet; once it does, older
  // history copies can never match a post-migration manifest and each probe would download another ~67 MB blob.
  if (matchManifest && fetched.ok) return { source: 'none', sha256: null, matchesManifest: false, tried };
  // 2. last copy in main's history (the commit that removed it from the index has no blob; older ones do).
  for (const sha of await historyCandidates()) {
    let buffer = blobAt(`${sha}:${SEC_LEDGER_PATH}`);
    if (!buffer && git(['fetch', '--no-tags', '--depth=1', 'origin', sha]).ok) buffer = blobAt(`${sha}:${SEC_LEDGER_PATH}`);
    const copy = accept(buffer, expected);
    if (copy && !copy.rejected) {
      writeLedger(copy.buffer);
      return { source: 'history', sha256: copy.digest, matchesManifest: copy.digest === manifestDigest(), commit: sha };
    }
    tried.push(`history:${sha.slice(0, 10)}:${copy?.rejected ? 'digest-mismatch' : 'no-blob'}`);
  }
  return { source: 'none', sha256: null, matchesManifest: false, tried };
}

function guard() {
  const ledger = JSON.parse(readFileSync(repoPath(SEC_LEDGER_PATH), 'utf8'));
  const records = Object.keys(ledger.data || {}).length;
  let published = null;
  try { published = Number(JSON.parse(readFileSync(repoPath(SEC_LEDGER_MANIFEST_PATH), 'utf8')).records); } catch { published = null; }
  const floor = Number.isFinite(published) && published > 0 ? Math.floor(published * RECORD_FLOOR_RATIO) : 0;
  const ok = records >= floor;
  return { ok, records, published, floor };
}

function publish() {
  if (!existsSync(repoPath(SEC_LEDGER_PATH))) throw new Error(`${SEC_LEDGER_PATH} is missing; nothing to publish`);
  const sha256 = canonicalSha256(readFileSync(repoPath(SEC_LEDGER_PATH), 'utf8'));
  const blob = git(['hash-object', '-w', '--no-filters', SEC_LEDGER_PATH], { allowFail: false }).stdout;
  const previousCommit = git(['rev-parse', '-q', '--verify', STORE_REF]).stdout || '';
  const previousBlob = previousCommit ? git(['rev-parse', '-q', '--verify', `${STORE_REF}:${SEC_STORE_FILE}`]).stdout : '';
  if (previousBlob && previousBlob === blob) return { published: false, reason: 'unchanged', sha256, commit: previousCommit };
  const tree = git(['mktree'], { input: `100644 blob ${blob}\t${SEC_STORE_FILE}\n`, allowFail: false }).stdout;
  const sourceSha = git(['rev-parse', 'HEAD']).stdout || 'unknown';
  const identity = { GIT_AUTHOR_NAME: 'aio-data-bot', GIT_AUTHOR_EMAIL: 'actions@github.com', GIT_COMMITTER_NAME: 'aio-data-bot', GIT_COMMITTER_EMAIL: 'actions@github.com' };
  const commitResult = spawnSync('git', ['commit-tree', tree, '-m', `data-store: ${SEC_STORE_FILE} sha256=${sha256}`, '-m', `Producer-only SEC ledger (P1757). Built on main ${sourceSha}. Single parentless commit, force-pushed each run.`], {
    cwd, encoding: 'utf8', env: { ...process.env, ...identity }
  });
  if (commitResult.status !== 0) throw new Error(`git commit-tree failed: ${commitResult.stderr}`);
  const commit = commitResult.stdout.trim();
  // The lease names the commit restore saw (or requires the branch to be absent), so a concurrent writer is never lost.
  git(['push', `--force-with-lease=refs/heads/${SEC_STORE_BRANCH}:${previousCommit}`, 'origin', `${commit}:refs/heads/${SEC_STORE_BRANCH}`], { allowFail: false });
  git(['update-ref', STORE_REF, commit]);
  return { published: true, reason: previousCommit ? 'replaced' : 'created', sha256, commit };
}

function emit(result) {
  console.log(JSON.stringify(result));
  if (process.argv.includes('--github-output') && process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(result).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => `${key}=${value}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry && (import.meta.url === `file://${entry}` || import.meta.url === `file:///${entry}`)) {
  const command = process.argv[2];
  try {
    if (command === 'restore') emit(await restore({ force: process.argv.includes('--force'), matchManifest: process.argv.includes('--match-manifest') }));
    else if (command === 'guard') {
      const result = guard();
      emit(result);
      if (!result.ok) {
        console.error(`::error::P1757 SEC ledger holds ${result.records} records, below the floor ${result.floor} (90% of the ${result.published} main published); refusing to shrink the public projection`);
        process.exit(1);
      }
    } else if (command === 'publish') emit(publish());
    else {
      console.error('usage: sec-fundamentals-store.mjs restore [--match-manifest] [--force] [--github-output] | guard | publish [--github-output]');
      process.exit(2);
    }
  } catch (error) {
    console.error(`::error::P1757 sec-fundamentals-store ${command}: ${error.message}`);
    process.exit(1);
  }
}
