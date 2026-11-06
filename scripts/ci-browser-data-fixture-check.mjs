#!/usr/bin/env node
// v59.70 (wave 2 A′): the pinned browser data (scripts/browser-data-fixture.mjs) stays a faithful copy of what the
// producers write, CI's browser shards read it, and watchdog-browser.yml still runs them on live data.
//   1. every pinned JSON artifact's key structure matches the working tree's (schemaDrift), and no deployed JSON artifact
//      is missing from the pin — the failure names `browser-data-fixture.mjs pin`;
//   2. replays: a new or dropped key is drift; an array empty on one refresh, a renamed map key, or null against a
//      number is not;
//   3. the page clock: start-local-node with AIO_BROWSER_CLOCK_AT serves the clock script first in <head>, and the
//      script moves Date to that time;
//   4. the workflows: ci.yml's browser job installs the pin (cache key = pinned commit + manifest hash) and sets the
//      clock; watchdog-browser.yml runs the same groups twice a day without either; operations-alert.yml watches it.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { load as loadYaml } from 'js-yaml';
import { checkFixture, formatCheckFailure, gitBlobId, readManifest, PIN_HINT, MANIFEST } from './browser-data-fixture.mjs';
import { schemaDrift, schemaShape } from './lib/schema-fingerprint.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, ok) => { if (!ok) failures.push(label); };

// 1. The repository's pin against the working tree.
const manifest = readManifest();
const problems = checkFixture({ manifest });
if (problems.length) {
  console.error(formatCheckFailure(manifest, problems));
  process.exit(1);
}
check('v59.70 the pin names a full commit and its time', /^[0-9a-f]{40}$/.test(manifest.sha) && Number.isFinite(Date.parse(manifest.committedAt)));
check('v59.70 every pinned JSON structure is stored', Object.values(manifest.files).every((entry) => !entry.shape || manifest.shapes[entry.shape]));

// 2. Replays.
const pinned = { meta: { asOf: '2026-11-04', quotes: { NVDA: { px: 1 }, AAPL: { px: 2 }, '005930.KS': { px: 3 } } }, rows: [{ sym: 'NVDA', price: 1, tags: [] }], ipos: [{ symbol: 'X', date: 'd' }] };
const drift = (current) => schemaDrift(schemaShape(pinned), schemaShape(current));
check('v59.70 a new key is drift', drift({ ...pinned, rows: [{ sym: 'NVDA', price: 1, tags: [], extra: 1 }] }).includes('+rows[].extra'));
check('v59.70 a dropped key is drift', drift({ meta: pinned.meta, rows: pinned.rows }).includes('-ipos'));
check('v59.70 an array empty on this refresh is not drift', drift({ ...pinned, ipos: [] }).length === 0);
check('v59.70 a map with other data keys is not drift', drift({ ...pinned, meta: { asOf: 'x', quotes: { TSLA: { px: 1 }, AMD: { px: 2 }, '2026-11-04': { px: 3 } } } }).length === 0);
check('v59.70 null against a number is not drift', drift({ ...pinned, rows: [{ sym: 'NVDA', price: null, tags: [] }] }).length === 0);
check('v59.70 a scalar replaced by an object is drift', drift({ ...pinned, meta: { ...pinned.meta, asOf: { date: 'x' } } }).includes('meta.asOf'));
const scratch = mkdtempSync(join(tmpdir(), 'aio-browser-data-'));
try {
  mkdirSync(join(scratch, 'public-data'), { recursive: true });
  writeFileSync(join(scratch, 'public-data', 'a.json'), JSON.stringify({ ...pinned, added: true }));
  writeFileSync(join(scratch, 'public-data', 'b.json'), '{}');
  const fake = { sha: 'f'.repeat(40), committedAt: '2026-11-04T00:00:00Z', files: { 'public-data/a.json': { blob: '0', shape: 'p' } }, shapes: { p: schemaShape(pinned) } };
  const found = checkFixture({ manifest: fake, dataRoot: scratch, listCurrent: () => ['public-data/a.json', 'public-data/b.json'] });
  check(`v59.70 checkFixture reports drift and a new artifact: ${found.join(' / ')}`, found.some((line) => line.startsWith('public-data/a.json: +added')) && found.some((line) => line.startsWith('public-data/b.json: new deployed artifact')));
  check('v59.70 the failure says how to re-pin', formatCheckFailure(fake, found).includes(PIN_HINT) && PIN_HINT === 'node scripts/browser-data-fixture.mjs pin');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
check('v59.70 blob ids are git blob ids', gitBlobId(Buffer.from('hello\n')) === 'ce013625030ba8dba906f756967f9e9ca394464a');

// 3. The page clock.
const at = '2026-11-04T04:33:05Z';
const server = await startLocalServer(0, { label: 'browser-data-fixture/clock', env: { AIO_BROWSER_CLOCK_AT: at } });
try {
  const base = `http://127.0.0.1:${server.port}`;
  const html = await (await fetch(`${base}/index.html`)).text();
  const headOpen = html.search(/<head(?:\s[^>]*)?>/i);
  const afterHead = html.slice(headOpen).replace(/^<head(?:\s[^>]*)?>/i, '');
  check('v59.70 the clock script is the first thing in <head>', afterHead.startsWith('<script src="./__aio-clock.js"></script>'));
  const script = await (await fetch(`${base}/__aio-clock.js`)).text();
  const sandbox = { window: {}, Date };
  vm.runInNewContext(script, sandbox);
  const shifted = sandbox.window.Date;
  check('v59.70 the clock script moves Date.now and new Date() to AIO_BROWSER_CLOCK_AT', Math.abs(shifted.now() - Date.parse(at)) < 5000 && Math.abs(new shifted().getTime() - Date.parse(at)) < 5000);
  const fixedDate = class extends Date {};
  fixedDate.now = () => 0; // a gate's own frozen clock (page.addInitScript) is not native
  const frozen = { window: {}, Date: fixedDate };
  vm.runInNewContext(script, frozen);
  check('v59.70 the clock script leaves a gate\'s own fixed clock alone', frozen.window.Date === undefined && frozen.window.__aioClockShift?.skipped);
  check('v59.70 explicit dates and Date() keep their meaning', new shifted(2020, 0, 2).getFullYear() === 2020 && typeof shifted() === 'string' && new shifted() instanceof Date);
} finally {
  await closeAll({ server });
}

// 4. The workflows.
const ci = loadYaml(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
const steps = ci.jobs.browser.steps;
const index = (name) => steps.findIndex((step) => step.name === name);
const readStep = steps[index('Read the pinned browser data')];
const cacheStep = steps[index('Cache the pinned browser data')];
const installStep = steps[index('Install the pinned browser data')];
check('v59.70 ci.yml browser job reads the pin and sets the page clock', /browser-data-fixture\.mjs sha/.test(readStep?.run || '') && /AIO_BROWSER_CLOCK_AT=.*browser-data-fixture\.mjs clock.*GITHUB_ENV/.test(readStep?.run || ''));
check('v59.70 the snapshot cache key is the pinned commit plus the manifest hash', cacheStep?.with?.key?.includes('steps.browser-data.outputs.sha') && cacheStep.with.key.includes(`hashFiles('${MANIFEST}')`));
check('v59.70 a cache miss fetches the pinned commit and materializes it', /git fetch --no-tags --depth=1 origin "\$PINNED_SHA"/.test(steps[index('Materialize the pinned browser data')]?.run || '') && /cache-hit != 'true'/.test(steps[index('Materialize the pinned browser data')]?.if || ''));
check('v59.70 the pin is installed before the gates run', /install --from "\$SNAPSHOT_DIR" --overwrite-public-data/.test(installStep?.run || '') && index('Install the pinned browser data') < index('Run all gates in shard'));
const watchdog = loadYaml(readFileSync(join(root, '.github/workflows/watchdog-browser.yml'), 'utf8'));
const crons = (watchdog.on?.schedule || []).map((entry) => entry.cron);
const hours = crons.flatMap((cron) => String(cron.split(' ')[1]).split(','));
const watchdogRuns = JSON.stringify(watchdog.jobs);
check(`v59.70 watchdog-browser runs twice a day: ${crons.join(' ')}`, hours.length === 2);
check('v59.70 watchdog-browser runs every CI browser group on live data', JSON.stringify(watchdog.jobs.browser.strategy.matrix.group) === JSON.stringify(ci.jobs.browser.strategy.matrix.group) && !/browser-data-fixture|AIO_BROWSER_CLOCK_AT|AIO_BROWSER_DATA_ROOT/.test(watchdogRuns));
check('v59.70 CI and the watchdog install Chromium the same way', steps.some((step) => step.uses === './.github/actions/setup-browser-gates') && watchdog.jobs.browser.steps.some((step) => step.uses === './.github/actions/setup-browser-gates'));
const alert = loadYaml(readFileSync(join(root, '.github/workflows/operations-alert.yml'), 'utf8'));
check('v59.70 operations-alert opens an issue when watchdog-browser fails', (alert.on?.workflow_run?.workflows || []).includes(watchdog.name));

if (failures.length) {
  console.error(`browser data fixture check failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`browser data fixture check OK: ${Object.keys(manifest.files).length} pinned files at ${manifest.sha.slice(0, 12)} (${manifest.committedAt}); drift replays, page clock and workflow wiring hold`);
}
