#!/usr/bin/env node
// v59.78: unit contract for the refresh release source decision (resolve-release-source.mjs) and the overlay revision
// restamp (build-data-overlay.mjs). Offline: synthetic first-parent chains and push CI tables only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideReleaseSource } from './resolve-release-source.mjs';
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

console.log('release source contract PASS: direct, treesame, wait, overlay, refuse decisions; overlay restamp; workflow wiring; watchdog maintenance roles');
