// v58.72 (owner 2026-10-23, state-machine review): bounded exhaustive model check of the AI market-analysis publication
// lifecycle. The fixtures in ci-data-pipeline-contract-check test one scene each (P1719 retain, P1751 reuse, v58.71
// blocked key); P1955, P1986 and P2000 each came from a run *sequence* nobody had written down. This check drives the
// real producer (genMarketAnalysis -> applyMarketAnalysis, published output fed back as the next run's previous) through
// every sequence of up to DEPTH runs, each run choosing a time step, whether the inputs moved and what the model
// returned, and checks the invariants after every run. A lane-quarantine restore of the narrative is checked from
// every reached state as well. The model call is a stub; the clock is simulated (buildStructuredMarketAnalysis stamps
// generatedAt with `new Date()`, so Date follows the simulated time).
//
// Invariants:
//   N1 verified   — a published reading marked verified passed the semantic gate and is at most 12 h old.
//   N2 retained   — a retained reading names its own generation time, is older than this run, and never nests.
//   N3 fresh      — a reading generated this run is verified only when this run's model answer passed the validator.
//   N4 no repeat  — the same inputs as a blocked attempt, within its sentence day, make no model call (P2000).
//   N5 new day    — the first run of a new 08:00 KST sentence day never reuses without a model call.
//   N6 quarantine — a narrative restored by lane quarantine is null or a verified reading within 12 h (P1986).
import { genMarketAnalysis, MARKET_ANALYSIS_RETAIN_MAX_MS, retainVerifiedMarketAnalysis } from './fetch-data.mjs';
import { applyMarketAnalysis } from './producer/market-narrative.mjs';
import { applyLaneQuarantine } from './lib/lane-quarantine.mjs';

const fail = (message) => { throw new Error(`[narrative-lifecycle-model] ${message}`); };
const DEPTH = 3;
const BASE_MS = Date.parse('2026-10-13T13:00:00.000Z'); // 22:00 KST: the next 08:00 KST boundary is 10 h away
const sentenceDay = (ms) => new Date(ms + 3600000).toISOString().slice(0, 10); // KST date of (now - 08:00)

// Fixture material from the P1719 scene (ci-data-pipeline-contract-check): the good answer passes, the bad one blocks.
const GOOD = 'S&P 500은 10월 12일 7,807.24로 마감했다. 코스피는 5.46% 하락했다.';
const BAD = 'S&P 500은 7,100으로 마감했다. 위험 선호는 제한적이다.';
const snapshotFor = (version) => ({ quotes: [
  { instrumentId: '^GSPC', evidenceId: `market.index.spx:v${version}`, value: 7807.24, changePct: -0.4, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:00:00.000Z', session: 'MARKET_CLOSED' },
  { instrumentId: '^VIX', evidenceId: 'market.vol.vix:t', value: 15.21, changePct: 2.49, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:00:00.000Z', session: 'MARKET_CLOSED' },
  { instrumentId: '^KS11', evidenceId: 'market.index.kospi:t', value: 5975.74, changePct: -5.46, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-13T06:30:00.000Z', session: 'MARKET_CLOSED' }
] });
const TIME_STEPS = {
  tick: (ms) => ms + 30 * 60000,
  nextDay: (ms) => { const next = new Date(ms); next.setUTCHours(23, 30, 0, 0); return next.getTime() > ms ? next.getTime() : next.getTime() + 86400000; },
  expire: (ms) => ms + 13 * 3600000,
};
const PROVIDERS = { good: [GOOD], 'bad-good': [BAD, GOOD], 'bad-bad': [BAD, BAD], empty: [null] };
const EVENTS = [];
for (const time of Object.keys(TIME_STEPS)) for (const inputs of ['same', 'changed']) for (const provider of Object.keys(PROVIDERS)) EVENTS.push({ time, inputs, provider });

// Simulated clock: `new Date()` and Date.now() read it; explicit arguments behave as usual.
const RealDate = Date;
let clockMs = BASE_MS;
class SimulatedDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(clockMs); else super(...args); }
  static now() { return clockMs; }
}

const violations = new Map();
const note = (kind, trace, detail) => {
  const entry = violations.get(kind) || { count: 0, example: null };
  entry.count++;
  if (!entry.example) entry.example = { trace, detail };
  violations.set(kind, entry);
};
const ageOk = (reading, nowMs) => {
  const generated = RealDate.parse(reading?.generatedAt || '');
  return Number.isFinite(generated) && nowMs - generated <= MARKET_ANALYSIS_RETAIN_MAX_MS && generated <= nowMs + 5 * 60000;
};

async function step(state, event) {
  const nowMs = TIME_STEPS[event.time](state.nowMs);
  const version = state.version + (event.inputs === 'changed' ? 1 : 0);
  const answers = [...PROVIDERS[event.provider]];
  let calls = 0;
  const request = async () => { calls++; return { text: answers.shift() ?? null }; };
  clockMs = nowMs;
  const data = { meta: { generatedAt: new RealDate(nowMs).toISOString() }, news: [], macro: {} };
  const out = await genMarketAnalysis(data, snapshotFor(version), { previous: state.published, request, nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] }, earnings: null });
  applyMarketAnalysis(data, out, { previous: state.published, nowMs });
  return { nowMs, version, published: data.marketAnalysis, meta: data.meta, calls, answers: PROVIDERS[event.provider].length - answers.length };
}

function checkRun(trace, prev, next, event) {
  const reading = next.published;
  const seen = new Set(prev.generated);
  const freshThisRun = reading?.generatedAt && !seen.has(reading.generatedAt);
  if (reading?.status === 'verified') {
    if (reading.semanticStatus !== 'verified' || (Array.isArray(reading.semanticIssues) && reading.semanticIssues.length)) note('N1-unverified-published-as-verified', trace, reading.semanticIssues);
    if (!ageOk(reading, next.nowMs)) note('N1-verified-older-than-12h', trace, reading.generatedAt);
  }
  if (reading?.retained) {
    if (reading.retained.from !== reading.generatedAt) note('N2-retained-from-mismatch', trace, reading.retained);
    if (freshThisRun) note('N2-retained-with-fresh-time', trace, reading.generatedAt);
    if (reading.lastVerified || reading.retained.retained) note('N2-retained-nests', trace, Object.keys(reading));
  }
  if (reading?.lastVerified && (reading.lastVerified.lastVerified || reading.lastVerified.retained)) note('N2-last-verified-chain', trace, Object.keys(reading.lastVerified));
  if (freshThisRun && reading.status === 'verified' && !reading.retained && !(event.provider === 'good' || event.provider === 'bad-good')) note('N3-verified-without-passing-answer', trace, event.provider);
  if (freshThisRun && reading.status === 'verified' && next.calls === 0) note('N3-fresh-verified-without-call', trace, reading.generatedAt);
  const sameInputs = next.version === prev.version && sentenceDay(next.nowMs) === sentenceDay(prev.nowMs);
  if (prev.published?.blockedAttemptKey && sameInputs && next.calls > 0) note('N4-blocked-inputs-called-again', trace, next.calls);
  const newDay = sentenceDay(next.nowMs) !== sentenceDay(prev.nowMs);
  if (newDay && prev.published && next.calls === 0) note('N5-new-day-without-call', trace, reading?.generatedAt);
  if (!reading) note('N0-no-reading-published', trace, next.meta);
}

function checkQuarantine(trace, state) {
  if (!state.published) return;
  const restored = applyLaneQuarantine({ marketAnalysis: null, meta: {} }, { marketAnalysis: state.published, meta: { generatedAt: new RealDate(state.nowMs).toISOString() } },
    [{ lane: 'narrative', check: 'model-check' }], { nowIso: new RealDate(state.nowMs + 30 * 60000).toISOString(), retainNarrative: (analysis) => retainVerifiedMarketAnalysis(analysis, { reason: 'lane-quarantine: model-check', nowMs: state.nowMs + 30 * 60000 }) });
  const kept = restored.marketAnalysis;
  if (kept == null) return;
  if (kept.status !== 'verified' || kept.semanticStatus !== 'verified' || !ageOk(kept, state.nowMs + 30 * 60000)) note('N6-quarantine-restored-unverified', trace, { status: kept.status, generatedAt: kept.generatedAt });
  if (!kept.retained || kept.retained.from !== kept.generatedAt) note('N6-quarantine-restore-unlabelled', trace, kept.retained);
}

// Abstract state for de-duplication: what the next run can observe, with times relative to now.
const abstractKey = (state) => {
  const p = state.published;
  const rel = (iso) => (iso ? Math.round((state.nowMs - RealDate.parse(iso)) / 60000) : null);
  return JSON.stringify([p?.status, p?.semanticStatus, !!p?.retained, rel(p?.generatedAt), rel(p?.retained?.from), !!p?.blockedAttemptKey, !!p?.lastVerified, rel(p?.lastVerified?.generatedAt),
    p?.sentence?.day === sentenceDay(state.nowMs), state.version - (state.blockedVersion ?? -1), new RealDate(state.nowMs).toISOString().slice(11, 16)]);
};

const warn = console.warn; const log = console.log;
let runs = 0;
let states = 0;
const outcomes = new Map();
globalThis.Date = SimulatedDate;
console.warn = () => {}; console.log = () => {};
try {
  let frontier = [{ nowMs: BASE_MS, version: 0, published: null, generated: [], trace: [] }];
  for (let depth = 1; depth <= DEPTH; depth++) {
    const nextFrontier = new Map();
    for (const state of frontier) {
      for (const event of EVENTS) {
        const result = await step(state, event);
        runs++;
        const trace = [...state.trace, `${event.time}/${event.inputs}/${event.provider}`];
        checkRun(trace, state, result, event);
        const reading = result.published;
        const outcome = `${reading?.status}${reading?.retained ? '+retained' : ''}${result.calls ? '' : '+no-call'}`;
        outcomes.set(outcome, (outcomes.get(outcome) || 0) + 1);
        const next = { nowMs: result.nowMs, version: result.version, published: reading, generated: [...new Set([...state.generated, reading?.generatedAt].filter(Boolean))], trace,
          blockedVersion: reading?.blockedAttemptKey ? result.version : state.blockedVersion };
        checkQuarantine(trace, next);
        const key = abstractKey(next);
        if (!nextFrontier.has(key)) nextFrontier.set(key, next);
      }
    }
    frontier = [...nextFrontier.values()];
    states += frontier.length;
  }
} finally {
  globalThis.Date = RealDate;
  console.warn = warn; console.log = log;
}

// Calibration: every lifecycle branch must be reached, or the model is not exercising the producer.
for (const required of ['verified', 'verified+no-call', 'verified+retained', 'blocked']) if (!outcomes.has(required)) fail(`outcome ${required} never reached: ${JSON.stringify(Object.fromEntries(outcomes))}`);
if (violations.size) {
  for (const [kind, { count, example }] of violations) console.error(`[narrative-lifecycle-model] ${kind} x${count}: ${JSON.stringify(example).slice(0, 1200)}`);
  fail(`${violations.size} invariant(s) violated over ${runs} runs`);
}
console.log(JSON.stringify({ ok: true, depth: DEPTH, runs, states, outcomes: Object.fromEntries(outcomes), invariants: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'] }));
