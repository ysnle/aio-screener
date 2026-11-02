// v59.59 (formal inventory C1, 2026-11-02): bounded exhaustive model check of the browser auto-refresh scheduler's pause
// state (src/app/refresh-scheduler.js). Every sequence of up to DEPTH events is replayed from a fresh install of the real
// module with a virtual clock and fetches that stay pending until the model resolves them.
//
// Events: 숨김 (visibilitychange, hidden), 복귀 (visible), 갱신 요청 (AIO.runScheduledRefresh({keys:['quotes']}) — the
// portfolio/screener retry, the AI ensure-fresh and the manual button all call it, and the retries can fire while
// the tab is hidden), 응답 (the oldest pending fetch resolves), 타이머 (the earliest virtual timer fires).
// Invariants (checked after every event, once its microtasks settle):
//   R1 visible tab is not paused — while the tab is visible the scheduler's pause flag is off.
//   R2 visible tab keeps its timers — while visible, every task with an interval has a timer or a run in flight.
//   R3 hidden tab fetches nothing on its own — a timer firing while hidden starts no fetch.
//
// KNOWN pins findings on the current code that are not fixed yet, by the scene of the trail; the gate fails on any other
// violation and on a KNOWN entry that no longer occurs. Self-check: each VARIANT removes one guard and must produce a
// violation outside KNOWN. When covered code changes: re-read this header against it, update the events and variants,
// run, then `--sync` (commit the covered change first).
// Out of scope: page on-enter refresh (_aioRefreshPageData), the 15% jitter values, task timeouts' error text, network.
import { importVariant, verifyCoverage } from './lib/model-check-kit.mjs';
import * as schedulerModule from '../src/app/refresh-scheduler.js';

const GATE = 'refresh-scheduler-model';
const MODULE = 'src/app/refresh-scheduler.js';
const DEPTH = Number(process.env.AIO_SCHEDULER_DEPTH || 6);
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };
const EVENTS = ['숨김', '복귀', '갱신 요청', '응답', '타이머'];
const FETCHERS = ['fetchLiveQuotes', 'fetchAllNews', 'fetchSentimentHistory', 'fetchBreadthData', 'fetchAllFredData', 'fetchTechnicals', 'fetchVixHistory', 'fetchHYSpread', 'autoUpdateMA', 'fetchKrDynamicData'];

// Fixed in v59.60 (first run 2026-11-02): runScheduledRefresh restored the pause flag it saw at its start, so a run begun
// while hidden that ended after the tab returned left a visible tab paused (trail 숨김 → 갱신 요청 → 복귀 → 응답) and
// every timer stopped without rescheduling. Add a row here only for a finding that cannot be fixed yet.
const KNOWN = [];
const knownKey = (row) => `${row.invariant}|${row.scene}`;

const VARIANTS = [
  { label: '갱신 종료 시 시작 시점 일시정지 값 복원(v59.60 이전)', replacements: [["_schedulerPaused = !!(typeof document !== 'undefined' && document.hidden);", '_schedulerPaused = true;']] },
  { label: '복귀 시 타이머 재시작 제거', replacements: [['      restartScheduler();\n      _lastVisibleTime = Date.now();', '      _lastVisibleTime = Date.now();']] },
  { label: '숨김 시 타이머 해제 제거', replacements: [['        if (cfg.timer) { clearTimeout(cfg.timer); cfg.timer = null; }\n      });\n      console.log(\'[AIO] Tab hidden', '      });\n      console.log(\'[AIO] Tab hidden']] },
  { label: '복귀 시 일시정지 해제 제거', replacements: [['    } else {\n      _schedulerPaused = false;\n      const elapsed', '    } else {\n      const elapsed']] }
];

// One mutable world the global stubs read, replaced for every replayed sequence.
let world = null;
const flush = async () => { for (let i = 0; i < 12; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
const doc = { get hidden() { return world.hidden; }, addEventListener(type, fn) { if (type === 'visibilitychange') world.onVisibility = fn; }, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
const stubs = {
  document: doc, T: { COOLDOWN: 60000 }, updateDataStatus() {}, _aioRegisterTimer: () => 0, showDataError() {},
  setTimeout: (fn, ms) => { const id = ++world.seq; world.timers.set(id, { fn, at: world.now + (Number(ms) || 0), id }); return id; },
  clearTimeout: (id) => { world.timers.delete(id); }
};
for (const name of FETCHERS) stubs[name] = () => new Promise((resolve) => { world.pending.push(resolve); world.fetchesStarted += 1; });
for (const [name, value] of Object.entries(stubs)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const realConsoleLog = console.log;

async function replay(install, trail) {
  world = { hidden: false, onVisibility: null, seq: 0, now: 1_800_000_000_000, timers: new Map(), pending: [], fetchesStarted: 0 };
  const win = { AIO: {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } } };
  console.log = () => {};
  try {
    install(win);
    win.startDataScheduler();
    const violations = [];
    let runStartedHidden = false;
    for (const event of trail) {
      if (event === '숨김') { world.hidden = true; world.onVisibility(); }
      else if (event === '복귀') { world.hidden = false; world.onVisibility(); }
      else if (event === '갱신 요청') { if (world.hidden) runStartedHidden = true; win.AIO.runScheduledRefresh({ keys: ['quotes'], reason: 'model-check' }).catch(() => {}); }
      else if (event === '응답') { const resolve = world.pending.shift(); if (resolve) resolve({ ok: true }); }
      else {
        const next = [...world.timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (next) {
          world.timers.delete(next.id);
          world.now = next.at;
          const before = world.fetchesStarted;
          next.fn();
          await flush();
          if (world.hidden && world.fetchesStarted > before) violations.push('R3');
        }
      }
      await flush();
      if (!world.hidden) {
        if (win.AIO.getRefreshSchedulerAudit().paused) violations.push('R1');
        const idle = Object.entries(win.REFRESH_SCHEDULE).filter(([, cfg]) => cfg.fn && cfg.interval > 0 && !cfg.timer && !cfg._inFlight).map(([key]) => key);
        if (idle.length) violations.push('R2');
      }
      if (violations.length) return { invariants: [...new Set(violations)], scene: runStartedHidden ? 'run-started-hidden' : 'other' };
    }
    return null;
  } finally {
    console.log = realConsoleLog;
  }
}

async function explore(install) {
  const found = new Map();
  let sequences = 0;
  const walk = async (trail) => {
    if (trail.length) {
      sequences += 1;
      const result = await replay(install, trail);
      if (result) {
        for (const invariant of result.invariants) {
          const key = knownKey({ invariant, scene: result.scene });
          if (!found.has(key) || found.get(key).trail.length > trail.length) found.set(key, { invariant, scene: result.scene, trail: trail.slice() });
        }
        return; // the shortest trail per prefix is enough; longer ones only repeat it
      }
    }
    if (trail.length >= DEPTH) return;
    // The browser fires visibilitychange only on a change, so a repeated 숨김 or 복귀 is not a reachable event.
    const hidden = trail.filter((event) => event === '숨김' || event === '복귀').at(-1) === '숨김';
    for (const event of EVENTS) if (!(event === '숨김' && hidden) && !(event === '복귀' && !hidden)) await walk([...trail, event]);
  };
  await walk([]);
  return { sequences, found };
}

const known = new Set(KNOWN.map(knownKey));
const current = await explore(schedulerModule.installRefreshScheduler);
const unexpected = [...current.found.values()].filter((row) => !known.has(knownKey(row)));
if (unexpected.length) fail(`violations (shortest trail each):\n  ${unexpected.map((row) => `${row.invariant}: ${row.trail.join(' → ')}`).join('\n  ')}`);
const gone = KNOWN.filter((row) => !current.found.has(knownKey(row)));
if (gone.length) fail(`KNOWN finding no longer occurs — delete it from KNOWN: ${gone.map(knownKey).join(', ')}`);

const variants = [];
for (const variant of VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  const result = await explore(mod.installRefreshScheduler);
  const broke = [...result.found.values()].filter((row) => !known.has(knownKey(row)));
  if (!broke.length) fail(`variant "${variant.label}" broke nothing: the model lost the power to fail`);
  variants.push({ label: variant.label, broke: [...new Set(broke.map((row) => row.invariant))] });
}

const drift = verifyCoverage(GATE, [{ module: MODULE, name: 'installRefreshScheduler', fn: schedulerModule.installRefreshScheduler }], { sync: process.argv.includes('--sync') });
if (drift.length) fail(`covered code changed — re-read the model in this file's header against it, update it, then rerun with --sync:\n  ${drift.join('\n  ')}`);

console.log(JSON.stringify({ ok: true, gate: GATE, depth: DEPTH, sequences: current.sequences, known: [...current.found.values()].map((row) => ({ invariant: row.invariant, trail: row.trail.join(' → ') })), variants }));
