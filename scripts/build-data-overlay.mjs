#!/usr/bin/env node
// v59.78 (automation audit 2026-11-08, owner: "정보/데이터가 멈추거나 예전 데이터로 잘못 보이면 이게 제일 큰 문제"):
// a refresh commit used to be releasable only when the newest code commit under it had a green full push CI. One red code
// merge therefore froze the live data plane until someone fixed the code: 11/07 09:26-12:03Z (v59.71), 13:25-16:45Z (#150)
// and 11/08 07:12Z (#158, a 17-byte stale context catalog). In that state this script builds the "data overlay" tree:
// the last code commit that did pass full push CI, with the generated data paths of the refresh commit on top. CI runs the
// reduced contracts on exactly this tree and Pages ships exactly this tree, so the data keeps moving on tested code while
// the red code commit stays off the live site (the watchdog keeps reporting it as an unreleased revision).
//
// The script must run from a copy outside the checkout (it replaces the checkout with an older commit that may not have
// this file), so it imports nothing from the repository: Node built-ins and git only.
//
//   node build-data-overlay.mjs --code-sha <sha> [--data-sha <sha>] [--root <dir>] [--report <file>]

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// v60.46: the paths a producer writes are PRODUCER_WRITTEN_PATHS in scripts/lib/data-publish-sets.mjs (the same list
// resolve-release-source.mjs uses to tell a data-only commit). This script imports nothing from the checkout, so it reads
// that module from the refresh commit itself; the module has no imports, so it loads from a data: URL. Everything else,
// generated knowledge files under public-data/ included, comes from the code commit, as its full push CI tested it.
export async function producerWrittenPaths(root, dataSha) {
  const source = git(root, ['show', `${dataSha}:scripts/lib/data-publish-sets.mjs`]).stdout;
  const { PRODUCER_WRITTEN_PATHS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  if (!Array.isArray(PRODUCER_WRITTEN_PATHS) || !PRODUCER_WRITTEN_PATHS.length) throw new Error(`data commit ${dataSha.slice(0, 12)} declares no PRODUCER_WRITTEN_PATHS`);
  return PRODUCER_WRITTEN_PATHS;
}

const VERSION = /^v\d+\.\d+$/;

/** Rewrites the app/cache revision stamps a producer copied from the newer code to the overlay code's version. */
export function restampOverlayRevision(file, document, version) {
  if (!VERSION.test(version)) throw new Error(`invalid overlay code version ${version}`);
  const next = structuredClone(document);
  if (typeof next.appRevision === 'string' && VERSION.test(next.appRevision)) next.appRevision = version;
  if (typeof next.workerRevision === 'string' && /^sw:v\d+\.\d+$/.test(next.workerRevision)) next.workerRevision = `sw:${version}`;
  if (file === 'public-data/operations-status.json' && next.planes?.browser && VERSION.test(next.planes.browser.revision || '')) {
    next.planes.browser.revision = version;
  }
  return next;
}

export const RESTAMP_FILES = Object.freeze([
  'public-config.json',
  'architecture/asset-manifest.json',
  'architecture/release-manifest.json',
  'architecture/public-readiness.json',
  'public-data/operations-status.json'
]);

function git(root, args, { allowFail = false } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim().slice(0, 400)}`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const known = new Set(['--code-sha', '--data-sha', '--root', '--report']);
  for (let index = 0; index < args.length; index += 2) {
    if (!known.has(args[index])) throw new Error(`unknown argument ${args[index]}`);
  }
  const root = resolve(value('--root') || process.cwd());
  const codeSha = value('--code-sha');
  const dataSha = value('--data-sha') || git(root, ['rev-parse', 'HEAD']).stdout.trim();
  for (const [name, sha] of [['code', codeSha], ['data', dataSha]]) {
    if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`--${name}-sha must be a 40-hex commit`);
  }
  if (git(root, ['cat-file', '-e', `${dataSha}^{commit}`], { allowFail: true }).status !== 0) throw new Error(`data commit ${dataSha} is not in this checkout`);
  if (git(root, ['cat-file', '-e', `${codeSha}^{commit}`], { allowFail: true }).status !== 0) {
    git(root, ['fetch', '--no-tags', '--depth=1', 'origin', codeSha]);
  }
  const generatedPaths = await producerWrittenPaths(root, dataSha);
  // The code tree, exactly as its full push CI tested it.
  git(root, ['checkout', '--force', '--detach', codeSha]);
  // The generated data of the refresh commit. A file the producer deleted must not survive from the code tree.
  for (const path of generatedPaths) rmSync(join(root, path), { recursive: true, force: true });
  // An optional path the refresh commit does not hold stays absent (git checkout refuses a pathspec that matches nothing).
  const files = git(root, ['ls-tree', '-r', '--name-only', dataSha, '--', ...generatedPaths]).stdout.split('\n').filter(Boolean);
  const present = generatedPaths.filter((path) => files.some((file) => file === path || file.startsWith(`${path}/`)));
  if (present.length) git(root, ['checkout', dataSha, '--', ...present]);
  const version = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
  const restamped = [];
  for (const file of RESTAMP_FILES) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const before = JSON.parse(readFileSync(path, 'utf8'));
    const after = restampOverlayRevision(file, before, version);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`);
      restamped.push(file);
    }
  }
  const report = { schemaVersion: 'aio-data-overlay.v1', codeSha, dataSha, codeRevision: version, generatedPaths, restamped, builtAt: new Date().toISOString() };
  const reportPath = value('--report');
  if (reportPath) {
    mkdirSync(dirname(resolve(reportPath)), { recursive: true });
    writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`[data-overlay] code=${codeSha.slice(0, 12)} (${version}) + data=${dataSha.slice(0, 12)}; restamped ${restamped.length} revision file(s)`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-data-overlay.mjs')) {
  main().catch((error) => { console.error(`[data-overlay] ${error.message}`); process.exit(1); });
}
