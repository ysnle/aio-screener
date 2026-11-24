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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  'browser-data-fixture': 'tests the browser clock script, which steps aside when Date.now is not native',
  // The two slowest clock readers (79s and 35s, a third of the sweep). Their reads are run timings and
  // generation stamps, not a market calendar; both kept their verdict on all ten v60.51 targets (next seven days,
  // NYSE and KRX holidays, +30 days) before the sweep was cut to two.
  'qa-runner-behavior': 'drives qa-runner on fixture manifests; its clock reads time the runs',
  'knowledge-generated-parity': 'regenerates the generated knowledge files and diffs them; its clock reads stamp the build'
};
const manifest = JSON.parse(readFileSync(join(root, 'architecture/qa-pipeline.json'), 'utf8'));
const contractGroups = manifest.profiles.contracts.filter((group) => !group.startsWith('browser'));
const only = (() => { const at = process.argv.indexOf('--only'); return at > 0 ? process.argv[at + 1].split(',') : null; })();
// v60.51 (check-fixtures): a gate is a candidate when anything it can load reaches the clock — its static import graph
// (relative `import`/`export from`/literal `import()`/`new URL('./x.mjs', import.meta.url)`) contains `Date.now()` or
// `new Date()`, or contains a load the graph cannot follow (a computed `import()`, a child process, vm, new Function).
// The today run of each candidate then records whether it read the clock (scripts/lib/clock-offset.mjs), and only those
// are swept. v60.49–v60.50 required the clock in the gate script's own text, so ci-pipeline-semantics-check.mjs (its
// fixtures loaded by computed path, a close fixed at 2026-11-16 judged against src's clock) was never a candidate, and
// four of the 29 text matches (workflow-yaml, domain-parity, structural, telegram-channels) never read the clock at all.
const IMPORT_SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"`])(\.{1,2}\/[^'"`$]+)\1|new URL\(\s*(['"`])(\.{1,2}\/[^'"`$]+\.m?js)\3\s*,\s*import\.meta\.url/g;
const REACHES_CLOCK = /Date\.now\(\)|new Date\(\)|\bimport\(\s*(?!['"][^'"`$]*['"]\s*\))|\b(?:spawn|spawnSync|execFile|execFileSync|execSync|fork)\(|\bvm\.|runInNewContext|new Function\(/;
const reachMemo = new Map();
function reachesClock(file, seen = new Set()) {
  if (reachMemo.has(file)) return reachMemo.get(file);
  if (seen.has(file) || !existsSync(file)) return false;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  let hit = REACHES_CLOCK.test(source);
  for (const match of hit ? [] : source.matchAll(IMPORT_SPEC)) {
    const target = resolve(dirname(file), match[2] || match[4]);
    if (/\.m?js$/.test(target) && reachesClock(target, seen)) { hit = true; break; }
  }
  if (hit) reachMemo.set(file, true); // only a hit is final: a miss inside a cycle may still reach the clock elsewhere
  return hit;
}
const candidates = only ? only.map((script) => ({ id: script, script, args: [] }))
  : contractGroups.flatMap((group) => manifest.groups[group].gates)
    // A data gate that holds code sections (scripts/lib/gate-sections.mjs) is swept too — its code sections are
    // the code contracts the old `mixed` class carried here; its data sections judge the artifact at its own stamps.
    .filter((gate) => existsSync(join(root, gate.script)))
    .filter((gate) => (gate.inputClass !== 'data' || /runSections\(/.test(readFileSync(join(root, gate.script), 'utf8')))
      && !gate.liveData && !NOT_SWEPT[gate.id] && !gate.id.endsWith('-model'))
    .filter((gate) => reachesClock(join(root, gate.script)));

// Targets: the next Sunday at 01:00Z — Saturday evening in New York, Sunday in UTC and Seoul, so "now" is no
// session anywhere and a lookback of one or two calendar days lands on the weekend (the v60.49 VIX fixture class) — and
// 30 days ahead: a fixture with a fixed date turns stale once and stays stale, so the far day catches every such flip
// within the next 30 days (the 11/16 close went "over a week old" eight days later). v60.49–v60.50 ran every day of the
// next week and the nearest NYSE/KRX holidays; with every clock reader swept that cost ~10 minutes of parallel work and
// starved the runner, so the sweep keeps the Sunday, one mid-week 01:00Z day, the next NYSE holiday and the far day;
// Monday-only and KRX-holiday-only flips are no longer probed. A check whose today run took HEAVY_MS or longer (tooling
// suites that read the clock for timings) runs on the far day only. JOBS: the gate is `exclusive` in qa-pipeline.json, so qa-runner runs nothing beside it, and
// its own pool takes the runner's static budget (AIO_QA_JOBS, default 4) — never more, so it cannot starve the machine
// (v60.51 first ran availableParallelism()-1 = 11 processes beside the runner's 4 and two model checks timed out).
const HORIZON_DAYS = 30;
const HEAVY_MS = 15000;
const JOBS = Math.max(1, Number(process.env.AIO_CLOCK_SHIFT_JOBS) || Number(process.env.AIO_QA_JOBS) || 4);
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const today = new Date(started).toISOString().slice(0, 10);
const weekday = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T12:00:00Z`).getUTCDay()];
const horizon = addDays(today, HORIZON_DAYS);
const sunday = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).find((date) => weekday(date) === 'Sun');
// The next mid-week day at 01:00Z (Seoul's morning, New York's previous evening: the KST date is not the UTC or New York
// date) and the next NYSE holiday at 15:00Z, both for the checks under HEAVY_MS (put back after the cut to two).
const midweek = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).find((date) => ['Tue', 'Wed', 'Thu'].includes(weekday(date)));
const nyseHoliday = Object.values(MARKET_CALENDAR_REGISTRY.NYSE).flatMap((year) => year.holidays).filter((date) => date > today).sort()[0];
const targets = [
  { label: `Sun ${sunday} 01:00Z`, at: Date.parse(`${sunday}T01:00:00Z`), daily: true },
  { label: `${weekday(midweek)} ${midweek} 01:00Z`, at: Date.parse(`${midweek}T01:00:00Z`), daily: true },
  ...(nyseHoliday ? [{ label: `NYSE holiday ${nyseHoliday} 15:00Z`, at: Date.parse(`${nyseHoliday}T15:00:00Z`) }] : []),
  { label: `+${HORIZON_DAYS}d ${weekday(horizon)} ${horizon} 01:00Z`, at: Date.parse(`${horizon}T01:00:00Z`), heavy: true, horizon: true }
];

const tmp = mkdtempSync(join(tmpdir(), 'aio-clock-shift-'));
// Discovery control: a check whose own text never names the clock, loading (by a computed path, as the
// pipeline-semantics runner loads its fixtures) a fixture close fixed at today and a module that judges its age by the
// wall clock — passes today, fails once the close is over 20 days old. It must be swept and must flip on the far day,
// or the sweep would miss the 11/16 class again.
const CONTROL = join(tmp, 'control-check.mjs');
writeFileSync(join(tmp, 'control-fixture.mjs'), `export const CLOSE = ${JSON.stringify(today)};\n`);
writeFileSync(join(tmp, 'control-age.mjs'), 'export const ageDays = (date) => (Date.now() - Date.parse(`${date}T00:00:00Z`)) / 864e5;\n');
writeFileSync(CONTROL, `const load = (name) => import(new URL(\`./control-\${name}.mjs\`, import.meta.url));
const [{ CLOSE }, { ageDays }] = await Promise.all([load('fixture'), load('age')]);
process.exit(ageDays(CLOSE) > 20 ? 1 : 0);\n`);
const control = { id: 'v60.51-discovery-control', script: CONTROL, args: [], control: true };
candidates.push(control);
const run = (argv, offset, readsFile = '') => new Promise((done) => {
  const env = { ...process.env, AIO_CLOCK_OFFSET_MS: String(offset), AIO_CLOCK_READS_FILE: readsFile, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${PRELOAD}`.trim() };
  const begun = Date.now();
  const child = spawn(process.execPath, argv, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; }); child.stderr.on('data', (chunk) => { out += chunk; });
  child.on('close', (status) => done({ status, ms: Date.now() - begun, out: out.trim().split('\n').slice(-3).join(' | ').slice(-400) }));
});
const pool = async (jobs) => {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, Math.max(1, availableParallelism() - 1)) }, async () => {
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
  // The canary also runs on the next Wednesday 01:00Z (Tuesday and Monday back are sessions), whatever weekday the far day is.
  const wednesday = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).find((date) => weekday(date) === 'Wed');
  const canaryTargets = [...targets, { label: `Wed ${wednesday} 01:00Z`, at: Date.parse(`${wednesday}T01:00:00Z`) }];
  const baseline = await pool([
    ...candidates.map((gate, i) => () => run([gate.script, ...(gate.args || [])], 0, join(tmp, `reads-${i}.txt`))),
    ...canaryTargets.map((target) => () => run(canary, target.at - started))
  ]);
  const canaryRuns = baseline.slice(candidates.length).map((result) => result.status);
  check('v60.49 the negative control (VIX rows on calendar days 1 and 2 back) fails on the Sunday and passes on the Wednesday',
    canaryRuns[0] !== 0 && canaryRuns.at(-1) === 0, canaryTargets.map((target, i) => `${target.label}=${canaryRuns[i]}`).join(', '));
  const swept = candidates.map((gate, i) => ({ gate, today: baseline[i], heavy: baseline[i].ms >= HEAVY_MS })).filter((_, i) => existsSync(join(tmp, `reads-${i}.txt`)));
  const jobs = targets.flatMap((target) => swept.filter((entry) => !entry.heavy || target.heavy).map((entry) => ({ target, entry })));
  const controlEntry = swept.find((entry) => entry.gate.control);
  const controlJobs = jobs.filter(({ entry }) => entry.gate.control);
  const shifted = await pool(jobs.map(({ target, entry }) => () => run([entry.gate.script, ...(entry.gate.args || [])], target.at - started)));
  // A clock defect repeats; a check whose timer lost a race under this sweep's load does not. A differing verdict is run
  // again on its own before it counts (ci-esm-core's 30 ms lazy-router wait failed once that way, on no particular day).
  for (const [i, { target, entry }] of jobs.entries()) {
    if (entry.gate.control || shifted[i].status === entry.today.status) continue;
    shifted[i] = await run([entry.gate.script, ...(entry.gate.args || [])], target.at - started);
    if (shifted[i].status !== entry.today.status && !entry.rerun) { entry.rerun = true; entry.today = await run([entry.gate.script, ...(entry.gate.args || [])], 0); }
  }
  const statusOn = (label) => shifted[jobs.findIndex(({ target, entry }) => entry.gate.control && target.label === label)]?.status;
  check('v60.51 the discovery control (clock read only in a module it loads; a close fixed at today) is swept, passes today and fails 30 days on',
    controlEntry && controlEntry.today.status === 0 && statusOn(targets.find((target) => target.horizon).label) === 1
      && controlJobs.filter(({ target }) => target.daily).every(({ target }) => statusOn(target.label) === 0),
    controlEntry ? `today=${controlEntry.today.status} ${controlJobs.map(({ target }) => `${target.label}=${statusOn(target.label)}`).join(', ')}` : 'not swept: its clock read was not seen');
  jobs.forEach(({ target, entry }, i) => {
    if (entry.gate.control) return;
    check(`v60.49 ${entry.gate.script} gives today's verdict on ${target.label}`, shifted[i].status === entry.today.status,
      `today=${entry.today.status} shifted=${shifted[i].status}: ${shifted[i].out}`);
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const gates = swept.filter((entry) => !entry.gate.control);
  if (failures.length) {
    console.error(`Clock-shift check failed (${failures.length}):\n${failures.map((line) => `- ${line}`).join('\n')}`);
    console.error('A fixture dated from the real clock reaches a session calendar or a freshness window: date its rows on sessions (previousHistorySession) or pass the check a fixed clock.');
    process.exitCode = 1;
  } else {
    const heavy = gates.filter((entry) => entry.heavy).map((entry) => entry.gate.id);
    console.log(`Clock-shift check OK: ${gates.length} of ${candidates.length - 1} candidate checks (import graph reaches the clock) read it and keep their verdict on ${targets.map((target) => target.label).join(', ')}${heavy.length ? ` (${heavy.length} taking ${HEAVY_MS / 1000}s+ on +${HORIZON_DAYS}d only: ${heavy.join(', ')})` : ''}; the discovery control flipped on +${HORIZON_DAYS}d; ${JOBS} jobs (${seconds}s).`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
