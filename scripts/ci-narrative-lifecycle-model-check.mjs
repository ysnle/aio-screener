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
//
// v59.25 re-read: the after-hours signature joins the reuse/attempt key as one more input; a change in it is the
// existing "inputs moved" event, and it adds no model outcome, status or reuse path, so the events and invariants hold.
//
// Self-check (pstack create/maintain-formal-verification): the covered functions are fingerprinted in
// architecture/model-check-coverage.json, and each VARIANT below (pre-P2000 and pre-P1986 code, a removed guard) must
// break its invariant at depth VARIANT_DEPTH. When covered code changes: re-read the events and invariants above
// against the new code (a new model outcome, status or reuse path is a new event or state here), update them, then run
// `node scripts/ci-narrative-lifecycle-model-check.mjs --sync`. `--chart <dir>` writes the owner's statechart (Mermaid).
import { mkdirSync } from 'node:fs';
import * as narrative from './producer/market-narrative.mjs';
import * as validate from './lib/market-analysis-validate.mjs';
import * as lanes from './lib/lane-quarantine.mjs';
import { chartDir, createStatechart, importVariant, verifyCoverage, writeChart } from './lib/model-check-kit.mjs';

const GATE = 'narrative-lifecycle-model';
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };
const { MARKET_ANALYSIS_RETAIN_MAX_MS, retainVerifiedMarketAnalysis } = validate;
const DEPTH = 3;
const VARIANT_DEPTH = 2;
const BASE_MS = Date.parse('2026-10-13T13:00:00.000Z'); // 22:00 KST: the next 08:00 KST boundary is 10 h away
const sentenceDay = (ms) => new Date(ms + 3600000).toISOString().slice(0, 10); // KST date of (now - 08:00)

const VARIANTS = [
  { label: 'P2000 이전 코드', expect: ['N4'], module: 'scripts/producer/market-narrative.mjs', replacements: [
    ['if (previous?.blockedAttemptKey === attemptKey) {', 'if (false) {'],
  ] },
  { label: 'P1986 이전 코드', expect: ['N6'], module: 'scripts/lib/lane-quarantine.mjs', replacements: [
    ["retainNarrative(previous[key])) || null;", 'retainNarrative(previous[key])) || previous[key] || null;'],
  ] },
  { label: '새 날 재사용 차단 제거', expect: ['N5'], chart: false, module: 'scripts/producer/market-narrative.mjs', replacements: [
    ['const reused = sentenceDayOpen ? null : reusableMarketAnalysis(', 'const reused = reusableMarketAnalysis('],
  ] },
];

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

// What the home reading card shows, and what each run did, in the owner's words.
const CHART_NODES = {
  start: { label: '해설 없음', kind: 'start' },
  fresh: { label: '새로 검증된 해설', kind: 'works' },
  reused: { label: '검증된 해설 재사용', kind: 'works' },
  retained: { label: '직전 검증본 표시 (HH:MM 기준)', kind: 'works' },
  fallback: { label: '확인된 지표만 표시', kind: 'works' },
  unverified: { label: '검증 안 된 해설이 검증본처럼 표시', kind: 'bug' },
};
const PASSING = new Set(['good', 'bad-good']);

// Simulated clock: `new Date()` and Date.now() read it; explicit arguments behave as usual.
const RealDate = Date;
let clockMs = BASE_MS;
class SimulatedDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(clockMs); else super(...args); }
  static now() { return clockMs; }
}

const ageOk = (reading, nowMs) => {
  const generated = RealDate.parse(reading?.generatedAt || '');
  return Number.isFinite(generated) && nowMs - generated <= MARKET_ANALYSIS_RETAIN_MAX_MS && generated <= nowMs + 5 * 60000;
};
const verifiedOk = (reading, nowMs) => reading?.status === 'verified' && reading.semanticStatus === 'verified' && ageOk(reading, nowMs)
  && !(Array.isArray(reading.semanticIssues) && reading.semanticIssues.length);
function cardState(reading, nowMs, seen) {
  if (!reading) return 'start';
  if (reading.status === 'verified' && !verifiedOk(reading, nowMs)) return 'unverified';
  if (reading.status !== 'verified') return 'fallback';
  if (reading.retained) return 'retained';
  return seen.has(reading.generatedAt) ? 'reused' : 'fresh';
}

async function explore({ genMarketAnalysis, applyMarketAnalysis, applyLaneQuarantine }, depth, chart, variant) {
  const violations = new Map();
  const outcomes = new Map();
  const note = (kind, trace, detail) => {
    const entry = violations.get(kind) || { count: 0, example: null };
    entry.count++;
    if (!entry.example) entry.example = { trace, detail };
    violations.set(kind, entry);
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
    return { nowMs, version, published: data.marketAnalysis, meta: data.meta, calls };
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
    const repeated = Boolean(prev.published?.blockedAttemptKey && sameInputs && next.calls > 0);
    if (repeated) note('N4-blocked-inputs-called-again', trace, next.calls);
    const newDay = sentenceDay(next.nowMs) !== sentenceDay(prev.nowMs);
    if (newDay && prev.published && next.calls === 0) note('N5-new-day-without-call', trace, reading?.generatedAt);
    if (!reading) note('N0-no-reading-published', trace, next.meta);
    const aged = prev.published?.status === 'verified' && !ageOk(prev.published, next.nowMs) ? '검증본이 12시간 넘게 지나 ' : '';
    const label = repeated ? '같은 막힌 입력인데 모델을 다시 호출'
      : next.calls === 0 ? (prev.published?.blockedAttemptKey && sameInputs ? `${aged}막힌 입력 그대로 → 모델 호출 없음` : '자료 변화 없음 → 모델 호출 없이 재사용')
      : `${aged}모델 답 ${PASSING.has(event.provider) ? '검증 통과' : '불합격'}`;
    next.card = cardState(reading, next.nowMs, seen);
    chart.add(prev.card, next.card, label, variant, trace.join('>'));
  }

  function checkQuarantine(trace, state) {
    if (!state.published) return;
    const atMs = state.nowMs + 30 * 60000;
    const restored = applyLaneQuarantine({ marketAnalysis: null, meta: {} }, { marketAnalysis: state.published, meta: { generatedAt: new RealDate(state.nowMs).toISOString() } },
      [{ lane: 'narrative', check: 'model-check' }], { nowIso: new RealDate(atMs).toISOString(), retainNarrative: (analysis) => retainVerifiedMarketAnalysis(analysis, { reason: 'lane-quarantine: model-check', nowMs: atMs }) });
    const kept = restored.marketAnalysis;
    const from = state.card;
    const caseId = `${trace.join('>')}>quarantine`;
    if (kept == null) { chart.add(from, 'start', '레인 격리: 되돌릴 검증본 없음', variant, caseId); return; }
    const ok = kept.status === 'verified' && kept.semanticStatus === 'verified' && ageOk(kept, atMs);
    if (!ok) note('N6-quarantine-restored-unverified', trace, { status: kept.status, generatedAt: kept.generatedAt });
    if (!kept.retained || kept.retained.from !== kept.generatedAt) note('N6-quarantine-restore-unlabelled', trace, kept.retained);
    chart.add(from, ok ? 'retained' : 'unverified', '레인 격리: 직전 게시본으로 되돌림', variant, caseId);
  }

  // Abstract state for de-duplication: what the next run can observe, with times relative to now.
  const abstractKey = (state) => {
    const p = state.published;
    const rel = (iso) => (iso ? Math.round((state.nowMs - RealDate.parse(iso)) / 60000) : null);
    return JSON.stringify([p?.status, p?.semanticStatus, !!p?.retained, rel(p?.generatedAt), rel(p?.retained?.from), !!p?.blockedAttemptKey, !!p?.lastVerified, rel(p?.lastVerified?.generatedAt),
      p?.sentence?.day === sentenceDay(state.nowMs), state.version - (state.blockedVersion ?? -1), new RealDate(state.nowMs).toISOString().slice(11, 16)]);
  };

  let runs = 0;
  let states = 0;
  let frontier = [{ nowMs: BASE_MS, version: 0, published: null, generated: [], trace: [], card: 'start' }];
  for (let level = 1; level <= depth; level++) {
    const nextFrontier = new Map();
    for (const state of frontier) {
      for (const event of EVENTS) {
        const result = await step(state, event);
        runs++;
        const trace = [...state.trace, `${event.time}/${event.inputs}/${event.provider}`];
        const reading = result.published;
        const next = { nowMs: result.nowMs, version: result.version, published: reading, generated: [...new Set([...state.generated, reading?.generatedAt].filter(Boolean))], trace,
          blockedVersion: reading?.blockedAttemptKey ? result.version : state.blockedVersion };
        checkRun(trace, state, result, event);
        next.card = result.card;
        const outcome = `${reading?.status}${reading?.retained ? '+retained' : ''}${result.calls ? '' : '+no-call'}`;
        outcomes.set(outcome, (outcomes.get(outcome) || 0) + 1);
        checkQuarantine(trace, next);
        const key = abstractKey(next);
        if (!nextFrontier.has(key)) nextFrontier.set(key, next);
      }
    }
    frontier = [...nextFrontier.values()];
    states += frontier.length;
  }
  return { violations, outcomes, runs, states };
}

const describe = (violations) => [...violations].map(([kind, { count, example }]) => `${kind} x${count}: ${JSON.stringify(example).slice(0, 1200)}`);
const chart = createStatechart({ title: '홈 AI 시황 해설 카드의 상태 (실제 생성기 연속 실행 전수 탐색)', nodes: CHART_NODES });
const warn = console.warn; const log = console.log;
let real;
const variantResults = [];
globalThis.Date = SimulatedDate;
console.warn = () => {}; console.log = () => {};
try {
  real = await explore({ ...narrative, applyLaneQuarantine: lanes.applyLaneQuarantine }, DEPTH, chart, null);
  for (const variant of VARIANTS) {
    const mod = await importVariant(variant.module, variant.replacements, variant.label);
    const fns = { genMarketAnalysis: mod.genMarketAnalysis || narrative.genMarketAnalysis, applyMarketAnalysis: mod.applyMarketAnalysis || narrative.applyMarketAnalysis, applyLaneQuarantine: mod.applyLaneQuarantine || lanes.applyLaneQuarantine };
    const run = await explore(fns, VARIANT_DEPTH, variant.chart === false ? createStatechart({ title: '', nodes: {} }) : chart, variant.label);
    variantResults.push({ variant: variant.label, expect: variant.expect, broken: [...new Set([...run.violations.keys()].map((kind) => kind.split('-')[0]))] });
  }
} finally {
  globalThis.Date = RealDate;
  console.warn = warn; console.log = log;
}

// Calibration: every lifecycle branch must be reached, or the model is not exercising the producer.
for (const required of ['verified', 'verified+no-call', 'verified+retained', 'blocked']) if (!real.outcomes.has(required)) fail(`outcome ${required} never reached: ${JSON.stringify(Object.fromEntries(real.outcomes))}`);
if (real.violations.size) {
  for (const line of describe(real.violations)) console.error(`[${GATE}] ${line}`);
  fail(`${real.violations.size} invariant(s) violated over ${real.runs} runs`);
}
for (const { variant, expect, broken } of variantResults) {
  const missed = expect.filter((id) => !broken.includes(id));
  if (missed.length) fail(`variant "${variant}" should break ${missed.join(', ')} but the check passed it (broken: ${broken.join(', ') || 'none'}) — the model lost the power to fail`);
}

const sync = process.argv.includes('--sync');
const drift = verifyCoverage(GATE, [
  { module: 'scripts/producer/market-narrative.mjs', name: 'genMarketAnalysis', fn: narrative.genMarketAnalysis },
  { module: 'scripts/producer/market-narrative.mjs', name: 'applyMarketAnalysis', fn: narrative.applyMarketAnalysis },
  { module: 'scripts/lib/market-analysis-validate.mjs', name: 'reusableMarketAnalysis', fn: validate.reusableMarketAnalysis },
  { module: 'scripts/lib/market-analysis-validate.mjs', name: 'retainVerifiedMarketAnalysis', fn: validate.retainVerifiedMarketAnalysis },
  { module: 'scripts/lib/market-analysis-validate.mjs', name: 'lastVerifiedMarketAnalysis', fn: validate.lastVerifiedMarketAnalysis },
  { module: 'scripts/lib/lane-quarantine.mjs', name: 'applyLaneQuarantine', fn: lanes.applyLaneQuarantine },
], { sync });
if (drift.length) fail(`covered code changed — re-read the events and invariants in this file's header against it, update them, then rerun with --sync:\n  ${drift.join('\n  ')}`);

const dir = chartDir();
if (dir) {
  mkdirSync(dir, { recursive: true });
  writeChart(dir, 'narrative-lifecycle', chart, {
    title: '홈 AI 시황 해설 카드의 상태도',
    command: 'node scripts/ci-narrative-lifecycle-model-check.mjs --chart <폴더>',
    reading: [
      `홈의 AI 시황 해설은 30분마다 다시 만들어집니다. 카드에 보일 수 있는 상태는 다섯 가지입니다. 새로 검증된 해설, 재사용, 직전 검증본, 확인된 지표만, 해설 없음입니다. 모델 답이 검증을 통과하지 못하면 12시간 안의 직전 검증본을 보여 주고, 그마저 없으면 지표만 보여 줍니다.`,
      `이 그림은 실제 해설 생성기를 연속 ${DEPTH}회까지 모든 조합(${real.runs.toLocaleString('en-US')}회 실행)으로 돌려 얻은 전이입니다. 빨간 선은 과거 결함을 그때 코드로 재현한 경로입니다. P2000은 막힌 입력으로 모델을 계속 다시 부르던 결함이고, P1986은 레인 격리가 검증 안 된 해설을 되돌리던 결함입니다. 초록 선은 지금 코드가 같은 상황에서 가는 경로입니다. 현재 코드는 여섯 규칙 모두 위반 0건입니다.`,
    ],
  });
}
console.log(JSON.stringify({ ok: true, depth: DEPTH, runs: real.runs, states: real.states, outcomes: Object.fromEntries(real.outcomes), invariants: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'],
  variants: variantResults.map(({ variant, broken }) => ({ variant, broken })), synced: sync, chartEdges: chart.edgeCount() }));
