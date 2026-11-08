#!/usr/bin/env node
// v59.82 (hosting review option A): keeps the producer-only 13F manager row store (public-data/masters/managers/,
// ~285 MB, 41 files) off main. Its weekly in-season rewrites added ~250 MB of packed history in 60 days, and every
// depth-1 Actions checkout downloaded it although Pages never ships it. The files live on the orphan branch
// `masters-store` as one force-pushed commit; main keeps public-data/masters/managers-store.json (tree id, file
// digests, per-manager accession and row counts). Same pattern as the SEC ledger (scripts/sec-fundamentals-store.mjs).
// Subcommands:
//
//   manifest
//       Writes the manifest from the local directory (run by the 13F lane after the row store is rewritten).
//   check
//       Prints whether the local directory matches the manifest: match | absent | mismatch.
//   restore [--require] [--github-output]
//       Brings the directory to the tree main's manifest names: local copy (when it already matches) -> store tip ->
//       the tip's one parent (a publish whose main push did not land) -> none. --require exits 1 on none, so the 13F
//       lane never rebuilds on a partial store.
//   publish [--github-output]
//       Force-pushes the local directory (which must match the manifest) to masters-store, lease-protected, as a commit
//       whose one parentless parent holds the tree main's committed manifest names. Unchanged tree: no push. Run it
//       BEFORE pushing main: main's manifest must never name a tree the store never held.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANAGER_STORE_BRANCH, MANAGER_STORE_DIR, MANAGER_STORE_MANIFEST_PATH,
  buildManagerStoreManifest, compareManagerStoreFiles, isManagerStoreFile, readManagerRows
} from './lib/masters-manager-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, MANAGER_STORE_DIR);
const STORE_REF = `refs/remotes/origin/${MANAGER_STORE_BRANCH}`;
const identity = { GIT_AUTHOR_NAME: 'aio-data-bot', GIT_AUTHOR_EMAIL: 'actions@github.com', GIT_COMMITTER_NAME: 'aio-data-bot', GIT_COMMITTER_EMAIL: 'actions@github.com' };

function git(args, { input, binary = false, allowFail = true, env = {} } = {}) {
  const result = spawnSync('git', args, {
    cwd: root, input, encoding: binary ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env }
  });
  const ok = result.status === 0;
  if (!ok && !allowFail) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr || '').trim().slice(0, 400)}`);
  return { ok, stdout: binary ? result.stdout : String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
}

const localFiles = () => (existsSync(dir) ? readdirSync(dir).filter(isManagerStoreFile).sort().map((name) => ({ name, buffer: readFileSync(path.join(dir, name)) })) : []);
const readManifest = () => {
  try { return JSON.parse(readFileSync(path.join(root, MANAGER_STORE_MANIFEST_PATH), 'utf8')); } catch { return null; }
};
const committedManifest = () => {
  const shown = git(['show', `HEAD:${MANAGER_STORE_MANIFEST_PATH}`]);
  try { return shown.ok ? JSON.parse(shown.stdout) : null; } catch { return null; }
};

// The git tree of exactly these files, computed without writing objects unless `write` (publish) asks for it.
function treeOf(files, { write = false } = {}) {
  const listing = files.map((file) => {
    const blob = git(['hash-object', '--no-filters', ...(write ? ['-w'] : []), '--stdin'], { input: file.buffer, allowFail: false }).stdout;
    return `100644 blob ${blob}\t${file.name}\n`;
  }).join('');
  return git(['mktree', ...(write ? [] : ['--missing'])], { input: listing, allowFail: false }).stdout;
}

async function writeManifest() {
  const files = localFiles();
  if (!files.length) throw new Error(`${MANAGER_STORE_DIR} is empty; refusing to write an empty manifest`);
  const shards = {};
  for (const file of files) {
    if (file.name.includes('.part-')) continue;
    const id = file.name.replace(/\.json$/, '');
    shards[id] = await readManagerRows(dir, id);
  }
  const manifest = buildManagerStoreManifest({ files, shards, treeId: treeOf(files) });
  const target = path.join(root, MANAGER_STORE_MANIFEST_PATH);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const changed = !existsSync(target) || readFileSync(target, 'utf8') !== text;
  if (changed) { writeFileSync(`${target}.tmp`, text); renameSync(`${target}.tmp`, target); }
  return { written: changed, treeId: manifest.treeId, files: manifest.files.length, managers: Object.keys(manifest.managers).length, bytes: manifest.bytes };
}

function materialize(commit, manifest) {
  const listing = git(['ls-tree', commit]);
  if (!listing.ok) return false;
  const staging = `${dir}.restore-tmp`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const line of listing.stdout.split('\n').filter(Boolean)) {
    const [meta, name] = line.split('\t');
    const blob = git(['cat-file', 'blob', meta.split(' ')[2]], { binary: true, allowFail: false }).stdout;
    writeFileSync(path.join(staging, name), blob);
  }
  const files = readdirSync(staging).filter(isManagerStoreFile).sort().map((name) => ({ name, buffer: readFileSync(path.join(staging, name)) }));
  if (compareManagerStoreFiles(manifest, files).status !== 'match') { rmSync(staging, { recursive: true, force: true }); return false; }
  rmSync(dir, { recursive: true, force: true });
  renameSync(staging, dir);
  return true;
}

function restore() {
  const manifest = readManifest();
  if (!manifest) return { source: 'none', reason: 'no-manifest' };
  if (compareManagerStoreFiles(manifest, localFiles()).status === 'match') return { source: 'local', treeId: manifest.treeId };
  const tried = [];
  for (const depth of [1, 2]) {
    if (!git(['fetch', '--no-tags', `--depth=${depth}`, 'origin', `+refs/heads/${MANAGER_STORE_BRANCH}:${STORE_REF}`]).ok) { tried.push('branch-unavailable'); break; }
    const spec = depth === 1 ? STORE_REF : `${STORE_REF}^1`;
    const tree = git(['rev-parse', '-q', '--verify', `${spec}^{tree}`]).stdout;
    if (tree && tree === manifest.treeId && materialize(spec, manifest)) return { source: depth === 1 ? 'store' : 'store-previous', treeId: tree };
    tried.push(`${depth === 1 ? 'tip' : 'previous'}:${tree ? tree.slice(0, 12) : 'missing'}`);
  }
  return { source: 'none', treeId: manifest.treeId, tried: tried.join(',') };
}

function publish() {
  const manifest = readManifest();
  const files = localFiles();
  const local = compareManagerStoreFiles(manifest, files);
  if (local.status !== 'match') throw new Error(`local ${MANAGER_STORE_DIR} does not match ${MANAGER_STORE_MANIFEST_PATH} (${local.status} ${local.drift.slice(0, 5).join(' ')}); run "manifest" first`);
  git(['fetch', '--no-tags', '--depth=2', 'origin', `+refs/heads/${MANAGER_STORE_BRANCH}:${STORE_REF}`]);
  const tree = treeOf(files, { write: true });
  if (tree !== manifest.treeId) throw new Error(`written tree ${tree} differs from the manifest tree ${manifest.treeId}`);
  const tipCommit = git(['rev-parse', '-q', '--verify', STORE_REF]).stdout || '';
  const tipTree = tipCommit ? git(['rev-parse', '-q', '--verify', `${STORE_REF}^{tree}`]).stdout : '';
  if (tipTree === tree) return { published: false, reason: 'unchanged', treeId: tree, commit: tipCommit };
  // The parent is the tree main currently names, so restore --require can always read it while this publish's main
  // commit is not on main yet (or never lands). Fall back to the tip it replaces when main names nothing reachable.
  const named = committedManifest()?.treeId;
  const previousTree = [named, tipTree].find((candidate) => candidate && candidate !== tree && git(['cat-file', '-e', `${candidate}^{tree}`]).ok) || '';
  let parentArgs = [];
  if (previousTree) {
    const previous = git(['commit-tree', previousTree, '-m', 'masters-store: tree main named before this publish (v59.82)'], { env: identity, allowFail: false }).stdout;
    parentArgs = ['-p', previous];
  }
  const sourceSha = git(['rev-parse', 'HEAD']).stdout || 'unknown';
  const commit = git(['commit-tree', tree, ...parentArgs, '-m', `masters-store: 13F manager rows tree=${tree}`, '-m', `Producer-only 13F manager row store (${files.length} files, ${manifest.bytes} bytes), built on main ${sourceSha}. Force-pushed each publish; its one parent holds the tree main named before (v59.82).`], { env: identity, allowFail: false }).stdout;
  git(['push', `--force-with-lease=refs/heads/${MANAGER_STORE_BRANCH}:${tipCommit}`, 'origin', `${commit}:refs/heads/${MANAGER_STORE_BRANCH}`], { allowFail: false });
  git(['update-ref', STORE_REF, commit]);
  return { published: true, reason: tipCommit ? 'replaced' : 'created', treeId: tree, commit };
}

function emit(result) {
  console.log(JSON.stringify(result));
  if (process.argv.includes('--github-output') && process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(result).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => `${key}=${value}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  try {
    if (command === 'manifest') emit(await writeManifest());
    else if (command === 'check') {
      const result = compareManagerStoreFiles(readManifest(), localFiles());
      emit({ status: result.status, drift: result.drift.slice(0, 10).join(' ') });
    } else if (command === 'restore') {
      const result = restore();
      emit(result);
      if (result.source === 'none' && process.argv.includes('--require')) {
        console.error(`::error::masters-store holds no tree matching ${MANAGER_STORE_MANIFEST_PATH} (${result.tried || result.reason}); the 13F lane cannot rebuild on a partial row store`);
        process.exit(1);
      }
    } else if (command === 'publish') emit(publish());
    else {
      console.error('usage: masters-managers-store.mjs manifest | check | restore [--require] [--github-output] | publish [--github-output]');
      process.exit(2);
    }
  } catch (error) {
    console.error(`::error::masters-managers-store ${command}: ${error.message}`);
    process.exit(1);
  }
}
