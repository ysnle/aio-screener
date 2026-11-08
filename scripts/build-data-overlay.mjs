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

// The paths a refresh producer writes. Keep in step with OVERLAY_GENERATED_PATHS in resolve-release-source.mjs and the
// exclusion list of the attest guard; ci-qa-pipeline-contract-check.mjs asserts that they agree.
export const OVERLAY_GENERATED_PATHS = Object.freeze([
  'public-data',
  'architecture/asset-manifest.json',
  'architecture/release-manifest.json',
  'architecture/public-readiness.json',
  'public-config.json',
  // v59.85: the live-data browser watchdog re-pins this file and pushes it with GITHUB_TOKEN, which starts no push CI
  // (it dispatches a full-scope CI instead). As a code path, that commit became "the newest code" with no successful push
  // CI, so every later refresh release would have ridden the overlay on the commit before it until a human pushed. It
  // only names the data snapshot the browser gates read, so it is generated like the data itself.
  'architecture/browser-data-fixture.json'
]);

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

function main() {
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
  // The code tree, exactly as its full push CI tested it.
  git(root, ['checkout', '--force', '--detach', codeSha]);
  // The generated data of the refresh commit. A file the producer deleted must not survive from the code tree.
  rmSync(join(root, 'public-data'), { recursive: true, force: true });
  git(root, ['checkout', dataSha, '--', ...OVERLAY_GENERATED_PATHS]);
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
  const report = { schemaVersion: 'aio-data-overlay.v1', codeSha, dataSha, codeRevision: version, generatedPaths: OVERLAY_GENERATED_PATHS, restamped, builtAt: new Date().toISOString() };
  const reportPath = value('--report');
  if (reportPath) {
    mkdirSync(dirname(resolve(reportPath)), { recursive: true });
    writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`[data-overlay] code=${codeSha.slice(0, 12)} (${version}) + data=${dataSha.slice(0, 12)}; restamped ${restamped.length} revision file(s)`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-data-overlay.mjs')) {
  try { main(); } catch (error) { console.error(`[data-overlay] ${error.message}`); process.exit(1); }
}
