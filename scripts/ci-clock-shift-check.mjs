#!/usr/bin/env node
// v60.49 (failure class: a check that passes or fails by the weekday it runs). A fixture dated "N calendar days before
// now" and fed to code that keeps only market sessions holds on some days and not others: the AI contract's VIX rows
// sat on iso(1)/iso(2), a weekend every Monday UTC, and from 2026-11-23 00:06Z CI failed and every data refresh with it.
// The v59.99/v60.18 sweep in ci-data-pipeline-contract-check moves the clock 45 and 366 days for the --check generators
// only; no contract check ever ran on another weekday. This runs each non-browser code contract that reads the wall
// clock on the next seven days (01:00Z: a different date in New York than in UTC and Seoul) and on the nearest NYSE and
// KRX holidays, and fails when a verdict differs from today's. The clock moves through scripts/lib/clock-offset.mjs.
//   node scripts/ci-clock-shift-check.mjs [--only scripts/a.mjs,scripts/b.mjs]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MARKET_CALENDAR_REGISTRY } from '../src/domain/market/session/market-calendar.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRELOAD = pathToFileURL(join(root, 'scripts/lib/clock-offset.mjs')).href;
const DAY = 864e5;
const started = Date.now();
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`); };

// Not swept, with the reason. Model checks (*-model) run their own simulated clock; their Date.now text is mutation source.
const NOT_SWEPT = {
  'clock-shift': 'this gate',
  'data-pipeline': 'runs the 45/366-day generator sweep itself',
  'browser-data-fixture': 'tests the browser clock script, which steps aside when Date.now is not native'
};
const manifest = JSON.parse(readFileSync(join(root, 'architecture/qa-pipeline.json'), 'utf8'));
const contractGroups = manifest.profiles.contracts.filter((group) => !group.startsWith('browser'));
const only = (() => { const at = process.argv.indexOf('--only'); return at > 0 ? process.argv[at + 1].split(',') : null; })();
const candidates = only ? only.map((script) => ({ id: script, script, args: [] }))
  : contractGroups.flatMap((group) => manifest.groups[group].gates)
    // v60.50: a data gate that holds code sections (scripts/lib/gate-sections.mjs) is swept too — its code sections are
    // the code contracts the old `mixed` class carried here; its data sections judge the artifact at its own stamps.
    .filter((gate) => existsSync(join(root, gate.script)))
    .filter((gate) => (gate.inputClass !== 'data' || /runSections\(/.test(readFileSync(join(root, gate.script), 'utf8')))
      && !gate.liveData && !NOT_SWEPT[gate.id] && !gate.id.endsWith('-model')
      && /Date\.now\(\)|new Date\(\)/.test(readFileSync(join(root, gate.script), 'utf8')));

// Targets: the next seven days at 01:00Z, the nearest NYSE holiday at 15:00Z and the nearest KRX holiday at 01:00Z.
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const today = new Date(started).toISOString().slice(0, 10);
const weekday = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T12:00:00Z`).getUTCDay()];
const nearestHoliday = (exchange) => Object.values(MARKET_CALENDAR_REGISTRY[exchange]).flatMap((year) => year.holidays)
  .sort((a, b) => Math.abs(Date.parse(a) - started) - Math.abs(Date.parse(b) - started))[0];
const targets = [
  ...Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((date) => ({ label: `${weekday(date)} ${date} 01:00Z`, at: Date.parse(`${date}T01:00:00Z`) })),
  { label: `NYSE holiday ${nearestHoliday('NYSE')} 15:00Z`, at: Date.parse(`${nearestHoliday('NYSE')}T15:00:00Z`) },
  { label: `KRX holiday ${nearestHoliday('KRX')} 01:00Z`, at: Date.parse(`${nearestHoliday('KRX')}T01:00:00Z`) }
];

const tmp = mkdtempSync(join(tmpdir(), 'aio-clock-shift-'));
const run = (argv, offset, readsFile = '') => new Promise((done) => {
  const env = { ...process.env, AIO_CLOCK_OFFSET_MS: String(offset), AIO_CLOCK_READS_FILE: readsFile, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${PRELOAD}`.trim() };
  const child = spawn(process.execPath, argv, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; }); child.stderr.on('data', (chunk) => { out += chunk; });
  child.on('close', (status) => done({ status, out: out.trim().split('\n').slice(-3).join(' | ').slice(-400) }));
});
const pool = async (jobs) => {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.max(2, availableParallelism() - 1) }, async () => {
    while (next < jobs.length) { const at = next++; results[at] = await jobs[at](); }
  }));
  return results;
};

try {
  // Negative control: the pre-fix VIX fixture shape (two rows on calendar days 1 and 2 before now, through the close
  // series) must fail on some target and pass on another, or the clock did not reach the child and the sweep proves nothing.
  const canary = ['--input-type=module', '-e', `const { buildCloseSeries } = await import(${JSON.stringify(pathToFileURL(join(root, 'src/domain/market/session/close-series.js')).href)});
const iso = (n) => new Date(Date.now() - n * ${DAY}).toISOString().slice(0, 10);
process.exit(buildCloseSeries([{ date: iso(2), vix: 17 }, { date: iso(1), vix: 18 }], 'vix').length === 2 ? 0 : 1);`];
  // Today first: which checks read the wall clock at all (a check that does not cannot change with it).
  const baseline = await pool([
    ...candidates.map((gate, i) => () => run([gate.script, ...(gate.args || [])], 0, join(tmp, `reads-${i}.txt`))),
    ...targets.map((target) => () => run(canary, target.at - started))
  ]);
  const canaryRuns = baseline.slice(candidates.length).map((result) => result.status);
  check('v60.49 the negative control (VIX rows on calendar days 1 and 2 back) fails on some target day and passes on another',
    canaryRuns.includes(0) && canaryRuns.some((status) => status !== 0), targets.map((target, i) => `${target.label}=${canaryRuns[i]}`).join(', '));
  const swept = candidates.map((gate, i) => ({ gate, today: baseline[i] })).filter((_, i) => existsSync(join(tmp, `reads-${i}.txt`)));
  const jobs = targets.flatMap((target) => swept.map((entry) => ({ target, entry })));
  const shifted = await pool(jobs.map(({ target, entry }) => () => run([entry.gate.script, ...(entry.gate.args || [])], target.at - started)));
  // A clock defect repeats; a check whose timer lost a race under this sweep's load does not. A differing verdict is run
  // again on its own before it counts (ci-esm-core's 30 ms lazy-router wait failed once that way, on no particular day).
  for (const [i, { target, entry }] of jobs.entries()) {
    if (shifted[i].status === entry.today.status) continue;
    shifted[i] = await run([entry.gate.script, ...(entry.gate.args || [])], target.at - started);
    if (shifted[i].status !== entry.today.status && !entry.rerun) { entry.rerun = true; entry.today = await run([entry.gate.script, ...(entry.gate.args || [])], 0); }
  }
  jobs.forEach(({ target, entry }, i) => {
    check(`v60.49 ${entry.gate.script} gives today's verdict on ${target.label}`, shifted[i].status === entry.today.status,
      `today=${entry.today.status} shifted=${shifted[i].status}: ${shifted[i].out}`);
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  if (failures.length) {
    console.error(`Clock-shift check failed (${failures.length}):\n${failures.map((line) => `- ${line}`).join('\n')}`);
    console.error('A fixture dated from the real clock reaches a session calendar or a freshness window: date its rows on sessions (previousHistorySession) or pass the check a fixed clock.');
    process.exitCode = 1;
  } else {
    console.log(`Clock-shift check OK: ${swept.length} of ${candidates.length} clock-reading checks keep their verdict on ${targets.map((target) => target.label).join(', ')} (${seconds}s).`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
