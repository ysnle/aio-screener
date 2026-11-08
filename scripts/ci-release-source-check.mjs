#!/usr/bin/env node
// v59.78: unit contract for the refresh release source decision (resolve-release-source.mjs) and the overlay revision
// restamp (build-data-overlay.mjs). Offline: synthetic first-parent chains and push CI tables only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideReleaseSource, firstParentChain, sourceCommitOf } from './resolve-release-source.mjs';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { OVERLAY_GENERATED_PATHS, RESTAMP_FILES, restampOverlayRevision } from './build-data-overlay.mjs';
import { failureBlocks, WATCHDOG_PROFILE } from './lib/qa-live-data.mjs';

const sha = (n) => String(n).padStart(40, '0');
// chain[0] = refresh commit (newest); sha(5) is the red code merge; sha(8) the previous green code.
const chain = [sha(1), sha(2), sha(3), sha(4), sha(5), sha(6), sha(7), sha(8), sha(9)];
const table = (rows) => (commit) => rows[commit] || [];
const green = [{ status: 'completed', conclusion: 'success' }];
const red = [{ status: 'completed', conclusion: 'failure' }];
const running = [{ status: 'in_progress', conclusion: null }];

let decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(5)]: green }) });
assert.equal(decision.mode, 'direct', 'v59.78 green code under the refresh commit releases it directly');
assert.equal(decision.codeSha, sha(1), 'v59.78 release-source contract');

// P1952: a treesame commit above the code commit carrying the green push CI also counts.
decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(5)]: red, [sha(3)]: green }) });
assert.equal(decision.mode, 'direct', 'v59.78 a treesame commit above the code commit with green push CI releases directly (P1952)');
assert.equal(decision.testedOn, sha(3), 'v59.78 release-source contract');

decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(5)]: running, [sha(8)]: green }) });
assert.equal(decision.mode, 'wait', 'v59.78 a push CI still running is awaited, not refused (11/07 03:01Z race)');

decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(5)]: red, [sha(8)]: green }) });
assert.equal(decision.mode, 'overlay', 'v59.78 red code: the data rides on the newest code that passed');
assert.equal(decision.codeSha, sha(8), 'v59.78 release-source contract');

// A green run on an older commit inside the treesame span does not exist; one below the code commit is overlay only.
decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(6)]: green, [sha(8)]: green }) });
assert.equal(decision.codeSha, sha(6), 'v59.78 the newest green code below the red commit wins');

decision = decideReleaseSource({ chain, sourceSha: sha(5), pushRuns: table({ [sha(5)]: red }) });
assert.equal(decision.mode, 'refuse', 'v59.78 no green code anywhere: refuse');

decision = decideReleaseSource({ chain, sourceSha: sha(1), pushRuns: table({ [sha(8)]: green }) });
assert.equal(decision.mode, 'refuse', 'v59.78 a commit that changes code is never a reduced-scope release');

// Codex review on PR #161: the chain reaches the code commit however many refresh commits sit above it.
{
  const repo = mkdtempSync(join(tmpdir(), 'aio-release-source-'));
  const run = (...args) => { const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' }); assert.equal(result.status, 0, `v59.78 release-source fixture git ${args[0]}: ${result.stderr}`); return result.stdout.trim(); };
  run('init', '-q'); run('config', 'user.email', 'qa@example.invalid'); run('config', 'user.name', 'qa');
  writeFileSync(join(repo, 'app.js'), '1\n'); run('add', '.'); run('commit', '-qm', 'code');
  const code = run('rev-parse', 'HEAD');
  mkdirSync(join(repo, 'public-data'));
  for (let index = 0; index < 5; index += 1) { writeFileSync(join(repo, 'public-data', 'x.json'), `${index}\n`); run('add', '.'); run('commit', '-qm', `data ${index}`); }
  const head = run('rev-parse', 'HEAD');
  const cwd = process.cwd();
  process.chdir(repo);
  try {
    assert.equal(sourceCommitOf(head), code, 'v59.78 release-source contract');
    const longChain = firstParentChain(head, code, 2);
    assert.ok(longChain.includes(code), 'v59.78 the first-parent chain always reaches the code commit under the refresh commits');
    assert.equal(decideReleaseSource({ chain: longChain, sourceSha: code, pushRuns: table({ [code]: green }) }).mode, 'direct', 'v59.78 release-source contract');
  } finally { process.chdir(cwd); }
}

const restamped = restampOverlayRevision('architecture/asset-manifest.json', { appRevision: 'v59.78', workerRevision: 'sw:v59.78', dataRevision: 'market-snapshot:x' }, 'v59.75');
assert.deepEqual(restamped, { appRevision: 'v59.75', workerRevision: 'sw:v59.75', dataRevision: 'market-snapshot:x' }, 'v59.78 release-source contract');
const ops = restampOverlayRevision('public-data/operations-status.json', { appRevision: 'v59.78', planes: { browser: { revision: 'v59.78' } } }, 'v59.75');
assert.equal(ops.planes.browser.revision, 'v59.75', 'v59.78 operations-status browser revision is restamped to the overlay code');
assert.throws(() => restampOverlayRevision('public-config.json', {}, 'latest'), 'v59.78 release-source contract');
for (const file of RESTAMP_FILES) assert.ok(OVERLAY_GENERATED_PATHS.some((path) => file === path || file.startsWith(`${path}/`)), `v59.78 ${file} is an overlay path`);

// The attest guard used to hold its own copy of the generated-path list; the workflows must call the shared resolver/builder.
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const pages = readFileSync(new URL('../.github/workflows/pages-deploy.yml', import.meta.url), 'utf8');
assert.match(ci, /resolve-release-source\.mjs --sha "\$\{\{ inputs\.release_sha \|\| github\.sha \}\}" --wait-min 15 --github-output/, 'v59.78 release-source contract');
assert.match(ci, /resolve-release-source\.mjs --sha "\$EXPECTED_SHA" --verify-code-sha "\$CODE_SHA"/, 'v59.78 release-source contract');
assert.match(ci, /if: needs\.preflight\.outputs\.release_mode == 'overlay'[\s\S]*?build-data-overlay\.mjs/, 'v59.78 release-source contract');
assert.match(pages, /if: steps\.release\.outputs\.code_sha != ''[\s\S]*?build-data-overlay\.mjs/, 'v59.78 release-source contract');
assert.match(pages, /releaseMode:process\.env\.AIO_CODE_SHA\?'data-overlay':'direct'/, 'v59.78 release-source contract');
// Codex review on PR #161: the preflight validates the overlay tree too, with the code commit's own dependencies.
const preflightJob = ci.slice(ci.indexOf('  preflight:'), ci.indexOf('\n  contracts:'));
assert.match(preflightJob, /resolve-release-source\.mjs[\s\S]*?if: steps\.release-source\.outputs\.release_mode == 'overlay'[\s\S]*?build-data-overlay\.mjs[\s\S]*?npm ci[\s\S]*?qa-runner\.mjs --group preflight/, 'v59.78 preflight runs on the overlay tree, after the resolver and before npm ci');
// The Pages hand-off must outlast the reduced CI's wait for push CI (15 min) plus the run itself.
for (const file of ['refresh-data.yml', 'refresh-screener.yml']) {
  const text = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
  const waits = [...text.matchAll(/ensure-live-convergence\.mjs --await-sha [^\n]*--timeout-min (\d+)/g)].map((match) => Number(match[1]));
  assert.ok(waits.length > 0 && waits.every((minutes) => minutes >= 30), `v59.78 ${file} converge waits at least 30 min (${waits.join(',')})`);
}
assert.ok(!/':\(exclude\)public-data'/.test(ci), 'v59.78 the generated path list lives in build-data-overlay.mjs only');

// v59.78: the data watchdog reports repository upkeep instead of going red on it; every other run still fails on it.
const maintenance = { id: 'watchdog-knowledge-lint', watchdogRole: 'maintenance' };
assert.equal(failureBlocks(maintenance, 'source', WATCHDOG_PROFILE), false, 'v59.78 release-source contract');
assert.equal(failureBlocks(maintenance, 'source', 'group'), true, 'v59.78 release-source contract');
assert.equal(failureBlocks(maintenance, 'ci', 'group'), true, 'v59.78 release-source contract');
assert.equal(failureBlocks({ id: 'external-pipeline' }, 'source', WATCHDOG_PROFILE), true, 'v59.78 live-data gates keep the watchdog red');
const pipeline = JSON.parse(readFileSync(new URL('../architecture/qa-pipeline.json', import.meta.url), 'utf8'));
const roles = Object.values(pipeline.groups).flatMap((group) => group.gates || []).filter((gate) => gate.watchdogRole).map((gate) => `${gate.id}:${gate.watchdogRole}`).sort();
assert.deepEqual(roles, ['watchdog-browser-data-pin-drift:maintenance', 'watchdog-knowledge-lint:maintenance'], 'v59.78 only repository-upkeep twins are maintenance; data and live gates stay blocking');

console.log('release source contract PASS: direct, treesame, wait, overlay, refuse decisions; overlay restamp; workflow wiring; preflight overlay; converge budget; watchdog maintenance roles');
