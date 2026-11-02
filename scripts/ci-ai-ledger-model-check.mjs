// v59.59 (owner 2026-11-02, formal verification of the AI budget ledger): bounded exhaustive model check of the shared
// AI month ledger in the Worker's Durable Object. The unit cases in worker/openai-contract.test.mjs each test one
// scene; this check drives the real AIOQuotaDurableObject.mutateQuota (cloudflare-worker-proxy.js) through every
// sequence of up to DEPTH events and compares the persisted ledger after each event with an independent bookkeeping
// of what each request owes. No separate spec of the code: the class under test is the one the Worker deploys.
//
// Model. Two requests (A: 12 USD-micro-millions, B: 10; month cap 20, so both cannot be reserved at once), each from
// its own client connection. Request events: reserve (also a replay of the same request id), release, start,
// settle with the full or a smaller verified charge. Environment events: the object is evicted and reloads from
// storage, the next storage write fails, the clock moves 2 h (from 10/31 23:00Z across the UTC day and month), 4 days
// (past the 3-day idempotency window) or 71 days (past month retention). Each mutateQuota call is one indivisible
// step, as in production (blockConcurrencyWhile serializes every caller). The clock is Date.now; storage clones on
// get and put, as Durable Object storage does. Both budget modes run: hard (the cap refuses) and target (live
// setting AI_MONTHLY_BUDGET_MODE=target: the cap warns, never refuses).
//
// Invariants (checked against what storage holds after every event):
//   L1 month      — months[m] equals the sum, over admitted and not released reservations of month m, of the full
//                   reservation, or the verified charge once settled. Money is never lost or counted twice.
//   L2 no refund  — a release after start returns nothing to the month (the call may already be billed).
//   L3 cap        — in hard mode months[m] never exceeds the month cap.
//   L4 admission  — reserve answers duplicate for a live same-day request id, otherwise admits exactly when the
//                   month has room (always in target mode).
//   L5 counters   — the day's request count and the connection's daily questions and spend match the live
//                   reservations of that day.
//   L6 no brick   — no reachable state makes a call throw, other than the documented refusals (start of a missing
//                   reservation, settle of an unstarted one) and the injected storage failure; a failed write leaves
//                   storage as before the call.
// A day counter is compared with missing = 0: releasing an unstarted reservation after its day was pruned writes that
// day back as 0 (harmless, dropped by the next prune).
// L2 is part of L1's bookkeeping (a started release keeps its amount); it is listed so a reader sees the promise.
//
// Out of scope: the per-connection spend share (1/20 of the month) and retry waivers (each client here is one
// request), the saver (no-search) variant, legacy-month migration, the daily request cap (300) and per-client cap,
// the HTTP layer and the OpenAI call itself (dispatchOpenAi's order is reserve -> start -> settle or release; this
// check allows every order of those calls, which is wider).
//
// Self-check (pstack create/maintain-formal-verification): the covered methods are fingerprinted in
// architecture/model-check-coverage.json, and each VARIANT below must break its invariant, so a pass here is a pass
// of a check that can fail. When covered code changes: re-read the model above against the new code (are the events,
// retention rules and invariants still the ones the code has?), update it, then run
// `node scripts/ci-ai-ledger-model-check.mjs --sync`. `--chart <dir>` writes the owner's statechart (Mermaid).
import { mkdirSync } from 'node:fs';
import * as worker from '../cloudflare-worker-proxy.js';
import { chartDir, createStatechart, importVariant, verifyCoverage, writeChart } from './lib/model-check-kit.mjs';

const GATE = 'ai-ledger-model';
const MODULE = 'cloudflare-worker-proxy.js';
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };

const DEPTH = Number(process.env.AIO_LEDGER_DEPTH || 7);
const VARIANT_DEPTH = 5;
const HOUR = 3600 * 1000, DAY = 24 * HOUR;
const T0 = Date.parse('2026-10-31T23:00:00.000Z');
const CAP = 20000000;
const REQUESTS = [
  { id: 'client:a', client: 'a'.repeat(32), amount: 12000000, smallCharge: 2000000 },
  { id: 'client:b', client: 'b'.repeat(32), amount: 10000000, smallCharge: 2000000 },
];
const TICKS = [['2시간', 2 * HOUR], ['4일', 4 * DAY], ['71일', 71 * DAY]];
const MAX_CLOCK = T0 + 80 * DAY;
const IDEMPOTENCY_MS = 3 * DAY, MONTH_RETENTION_MS = 70 * DAY; // the code's QUOTA_STATE_RETENTION_MS / MONTH_RETENTION_MS

const VARIANTS = [
  { label: '시작한 예약 환불', expect: ['L1'], replacements: [
    ["if (typeof reservation === 'object' && reservation.started) {", 'if (false) {'],
  ] },
  { label: '예약 중복 검사 제거', expect: ['L1'], replacements: [
    ['if (this.counts.reservations[key]) {', 'if (false) {'],
  ] },
  { label: '월 상한 검사 제거', expect: ['L3'], hardOnly: true, replacements: [
    ['monthlyReservedMicroUsd + amount > body.monthlyCapMicroUsd))', 'false))'],
  ] },
  { label: '저장 실패 뒤 메모리 유지', expect: ['L1'], replacements: [
    ['catch (error) { this.loaded = false; throw error; }', 'catch (error) { throw error; }'],
  ] },
  { label: '정산 중복 검사 제거', expect: ['L6'], replacements: [
    ["if (reservation.settled === true) { result = { ok: true, settled: false, duplicate: true }; return; }", ''],
  ] },
];

const dayKeyAt = (t) => 'claude:' + new Date(t).toISOString().slice(0, 10);
const monthOf = (dayKey) => dayKey.slice(7, 14);
const nextMonthStart = (month) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.getTime(); };
const LIVE = new Set(['reserved', 'started', 'settled']);

// --- the independent bookkeeping (what each request owes), never read from the ledger ---
const ghostPrune = (g, now) => {
  for (const rec of g.records) {
    if ((rec.phase === 'started' || rec.phase === 'settled') && rec.createdAt < now - IDEMPOTENCY_MS) rec.phase = 'gone';
    else if (rec.phase === 'reserved' && rec.createdAt < now - MONTH_RETENTION_MS) rec.phase = 'gone-unstarted';
  }
  g.months = g.months.filter((m) => !(nextMonthStart(m) < now - MONTH_RETENTION_MS));
  g.days = g.days.filter((d) => !(Date.parse(`${d.slice(7)}T00:00:00Z`) < now - IDEMPOTENCY_MS));
  g.prunedAt = now;
};
const owes = (rec) => rec.phase !== 'released';
const monthSum = (g, m) => g.records.filter((r) => r.month === m && owes(r)).reduce((s, r) => s + r.owed, 0);
const current = (g, i) => (g.current[i] === null ? null : g.records[g.current[i]]);

// What the ledger must hold, from the bookkeeping.
function expectedLedger(g) {
  const months = Object.fromEntries(g.months.map((m) => [m, monthSum(g, m)]));
  const days = Object.fromEntries(g.days.map((d) => [d, g.records.filter((r) => r.dayKey === d && owes(r)).length]));
  const today = dayKeyAt(g.prunedAt);
  const clients = {}, spend = {};
  for (const r of g.records) {
    if (r.dayKey !== today || !LIVE.has(r.phase)) continue;
    clients[r.client] = (clients[r.client] || 0) + 1;
    spend[r.client] = (spend[r.client] || 0) + r.owed;
  }
  return { months, days, today, clients, spend };
}

function checkLedger(stored, g, hard, note) {
  const counts = stored ? JSON.parse(stored) : { months: {}, days: {}, clients: {}, clientSpend: {} };
  const want = expectedLedger(g);
  const gotMonths = counts.months || {};
  for (const m of new Set([...Object.keys(gotMonths), ...Object.keys(want.months)])) {
    if (gotMonths[m] !== want.months[m]) note('L1:month', { month: m, ledger: gotMonths[m], owed: want.months[m] });
    if (hard && gotMonths[m] > CAP) note('L3:cap', { month: m, ledger: gotMonths[m], cap: CAP });
  }
  const gotDays = Object.fromEntries(Object.entries(counts.days || {}).filter(([d]) => d.startsWith('claude:')));
  for (const d of new Set([...Object.keys(gotDays), ...Object.keys(want.days)])) {
    if ((gotDays[d] || 0) !== (want.days[d] || 0)) note('L5:day-count', { day: d, ledger: gotDays[d], live: want.days[d] });
  }
  for (const [name, map, wantMap] of [['questions', counts.clients || {}, want.clients], ['spend', counts.clientSpend || {}, want.spend]]) {
    for (const [day, bucket] of Object.entries(map)) {
      if (day !== want.today && Object.keys(bucket).length) note(`L5:client-${name}-stale-day`, { day, bucket });
    }
    const bucket = map[want.today] || {};
    for (const c of new Set([...Object.keys(bucket), ...Object.keys(wantMap)])) {
      if ((bucket[c] || 0) !== (wantMap[c] || 0)) note(`L5:client-${name}`, { client: c.slice(0, 4), ledger: bucket[c] || 0, live: wantMap[c] || 0 });
    }
  }
}

// --- one Durable Object step on a restored instance ---
function makeInstance(mod, state, env) {
  const rows = new Map();
  if (state.stored !== null) rows.set('quota-state', JSON.parse(state.stored));
  const io = { failNext: state.failArmed, puts: 0, failed: false };
  const storage = {
    get: async (k) => structuredClone(rows.get(k)),
    put: async (k, v) => {
      if (io.failNext) { io.failNext = false; io.failed = true; throw new Error('injected storage failure'); }
      rows.set(k, structuredClone(v)); io.puts++;
    },
  };
  const dobj = new mod.AIOQuotaDurableObject({ id: { jurisdiction: 'us' }, storage, blockConcurrencyWhile: (fn) => fn() }, env);
  if (state.memory !== null) { dobj.counts = JSON.parse(state.memory); dobj.loaded = true; }
  return { dobj, rows, io };
}

const realNow = Date.now;
async function step(mod, state, env, event) {
  const g = structuredClone(state.ghost);
  const next = { ...state, ghost: g };
  if (event.kind === 'evict') return { ...next, memory: null };
  if (event.kind === 'fail') return { ...next, failArmed: true };
  if (event.kind === 'tick') return { ...next, clock: state.clock + event.ms };

  const { dobj, rows, io } = makeInstance(mod, state, env);
  const req = REQUESTS[event.req];
  const rec = current(g, event.req);
  const dayKey = event.kind === 'reserve' ? dayKeyAt(state.clock) : rec.dayKey;
  const body = { dayKey, requestId: req.id };
  if (event.kind === 'reserve') Object.assign(body, { cap: 300, reservationMicroUsd: req.amount, monthlyCapMicroUsd: CAP, clientKey: req.client, clientCap: 150 });
  if (event.kind === 'settle') body.chargeMicroUsd = event.small ? req.smallCharge : req.amount;

  let result = null, error = null;
  Date.now = () => state.clock;
  try { result = await dobj.mutateQuota(event.kind, body); } catch (e) { error = e; } finally { Date.now = realNow; }

  next.stored = rows.has('quota-state') ? JSON.stringify(rows.get('quota-state')) : null;
  next.memory = dobj.loaded ? JSON.stringify(dobj.counts) : null;
  next.failArmed = io.failNext;
  const issues = [];
  // Bookkeeping: the prune at the top of every call is durable once any write of this call succeeded.
  if (io.puts > 0 || !io.failed) ghostPrune(g, state.clock);
  const live = rec && LIVE.has(rec.phase) && rec.dayKey === dayKey;
  let expectThrow = false;
  if (event.kind === 'start') expectThrow = !live;
  if (event.kind === 'settle') expectThrow = !(live && (rec.phase === 'started' || rec.phase === 'settled'));
  if (error) {
    const injected = io.failed;
    if (!injected && !expectThrow) issues.push(['L6:unexpected-throw', { event: event.label, error: error.message }]);
    if (injected && io.puts === 0 && next.stored !== state.stored) issues.push(['L6:failed-write-changed-storage', { event: event.label }]);
    return { next, issues, error };
  }
  if (expectThrow) issues.push(['L6:refusal-missing', { event: event.label, result }]);
  const hard = !String(env.AI_MONTHLY_BUDGET_MODE || '').includes('target');
  if (event.kind === 'reserve') {
    if (live) {
      if (!result?.duplicate) issues.push(['L4:duplicate-not-recognised', { event: event.label, result }]);
    } else {
      const month = monthOf(dayKey);
      const room = !hard || monthSum(g, month) + req.amount <= CAP;
      if (!!result?.reserved !== room) issues.push(['L4:admission', { event: event.label, expected: room, result }]);
      if (room) {
        g.records.push({ req: event.req, dayKey, month, client: req.client, owed: req.amount, phase: 'reserved', createdAt: state.clock });
        g.current[event.req] = g.records.length - 1;
        if (!g.months.includes(month)) g.months.push(month);
        if (!g.days.includes(dayKey)) g.days.push(dayKey);
      }
    }
  } else if (event.kind === 'release') {
    if (live && rec.phase === 'reserved') rec.phase = 'released';
  } else if (event.kind === 'start') {
    if (rec.phase === 'reserved') rec.phase = 'started';
  } else if (event.kind === 'settle') {
    if (rec.phase === 'started') { rec.owed = body.chargeMicroUsd; rec.phase = 'settled'; }
  }
  return { next, issues, result };
}

function eventsFor(state) {
  const out = [{ kind: 'evict', label: '재시작' }, { kind: 'fail', label: '다음 저장 실패' }];
  for (const [label, ms] of TICKS) if (state.clock + ms <= MAX_CLOCK) out.push({ kind: 'tick', ms, label: `시간 +${label}` });
  REQUESTS.forEach((req, i) => {
    const name = i === 0 ? 'A' : 'B';
    out.push({ kind: 'reserve', req: i, label: `${name} 예약` });
    if (state.ghost.current[i] === null) return;
    out.push({ kind: 'release', req: i, label: `${name} 해제` });
    out.push({ kind: 'start', req: i, label: `${name} 호출 시작` });
    out.push({ kind: 'settle', req: i, small: false, label: `${name} 전액 정산` });
    out.push({ kind: 'settle', req: i, small: true, label: `${name} 적은 금액 정산` });
  });
  return out;
}

// Request A as the owner sees it, from the ledger itself.
const CHART_NODES = {
  start: { label: '요청 전', kind: 'start' },
  none: { label: '예약 없음', kind: 'works' },
  reserved: { label: '예약됨 (전액 잡힘)', kind: 'works' },
  started: { label: '호출 시작 (환불 불가)', kind: 'works' },
  settled: { label: '정산됨 (실제 금액)', kind: 'works' },
  aged: { label: '기록 정리됨 (금액은 월에 남음)', kind: 'works' },
  broken: { label: '월 합계가 실제 빚과 다름', kind: 'bug' },
};
function chartPhase(stored, g) {
  const rec = current(g, 0);
  if (!rec) return 'none';
  const counts = stored ? JSON.parse(stored) : null;
  const row = counts?.reservations?.[`${rec.dayKey}:${REQUESTS[0].id}`];
  if (!row) return rec.phase === 'gone' || rec.phase === 'gone-unstarted' ? 'aged' : 'none';
  return row.settled ? 'settled' : row.started ? 'started' : 'reserved';
}

async function explore(mod, env, depth, chart, variant) {
  const violations = new Map();
  const note = (kind, example) => { const v = violations.get(kind) || { count: 0, example }; v.count++; violations.set(kind, v); };
  const init = { stored: null, memory: null, clock: T0, failArmed: false, ghost: { records: [], current: REQUESTS.map(() => null), months: [], days: [], prunedAt: T0 } };
  const seen = new Set();
  let frontier = [{ state: init, path: [] }];
  let states = 0, transitions = 0;
  for (let level = 0; level < depth && frontier.length; level++) {
    const nextFrontier = [];
    for (const { state, path } of frontier) {
      for (const event of eventsFor(state)) {
        const out = await step(mod, state, env, event);
        const next = out.next || out;
        transitions++;
        const trail = [...path, event.label];
        const local = [];
        for (const [kind, ex] of out.issues || []) local.push([kind, ex]);
        if (event.kind !== 'evict' && event.kind !== 'fail' && event.kind !== 'tick') {
          checkLedger(next.stored, next.ghost, !String(env.AI_MONTHLY_BUDGET_MODE || '').includes('target'), (kind, ex) => local.push([kind, ex]));
        }
        for (const [kind, ex] of local) note(kind, { trail, ...ex });
        if (chart && event.req === 0) { // request A only, so each arrow is one of A's own calls
          const from = chartPhase(state.stored, state.ghost), to = local.some(([k]) => k.startsWith('L1')) ? 'broken' : chartPhase(next.stored, next.ghost);
          if (from !== to || variant) chart.add(level === 0 ? 'start' : from, to, event.label, variant, `${JSON.stringify([state.stored, state.ghost.current])}|${event.label}`);
        }
        if (local.length) continue; // a broken state is reported, not explored further
        const key = JSON.stringify([next.stored, next.memory, next.clock, next.failArmed, next.ghost]);
        if (seen.has(key)) continue;
        seen.add(key); states++;
        nextFrontier.push({ state: next, path: trail });
      }
    }
    frontier = nextFrontier;
  }
  return { violations, states, transitions };
}

const describe = (violations) => [...violations].map(([kind, { count, example }]) => `${kind} x${count}: ${JSON.stringify(example).slice(0, 900)}`);
const chart = createStatechart({ title: '공용 AI 월 예산 원장: 요청 하나의 예약 (실제 코드 전수 탐색)', nodes: CHART_NODES });
const MODES = [['hard', {}], ['target', { AI_MONTHLY_BUDGET_MODE: 'target' }]];

const real = {};
for (const [mode, env] of MODES) {
  const run = await explore(worker, env, DEPTH, mode === 'hard' ? chart : null, null);
  if (run.states < 2000) fail(`state space collapsed in ${mode} mode: ${run.states} states`);
  if (run.violations.size) {
    for (const line of describe(run.violations)) console.error(`[${GATE}] ${mode}: ${line}`);
    fail(`${run.violations.size} invariant(s) violated over ${run.states} states in ${mode} mode`);
  }
  real[mode] = { states: run.states, transitions: run.transitions };
}

const variantResults = [];
for (const variant of VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  const broken = new Set();
  for (const [mode, env] of MODES) {
    if (variant.hardOnly && mode !== 'hard') continue;
    const run = await explore(mod, env, VARIANT_DEPTH, mode === 'hard' && variant.label === '시작한 예약 환불' ? chart : null, variant.label);
    for (const kind of run.violations.keys()) broken.add(kind.split(':')[0]);
  }
  const missed = variant.expect.filter((id) => !broken.has(id));
  if (missed.length) fail(`variant "${variant.label}" should break ${missed.join(', ')} but the check passed it (broken: ${[...broken].join(', ') || 'none'}) — the model lost the power to fail`);
  variantResults.push({ variant: variant.label, broken: [...broken].sort() });
}

const sync = process.argv.includes('--sync');
const proto = worker.AIOQuotaDurableObject.prototype;
const drift = verifyCoverage(GATE, ['load', 'save', 'refundClientSpend', 'prune', 'mutateQuota'].map((name) => ({ module: MODULE, name: `AIOQuotaDurableObject.${name}`, fn: proto[name] })), { sync });
if (drift.length) fail(`covered code changed — re-read the model in this file's header against it, update the model, then rerun with --sync:\n  ${drift.join('\n  ')}`);

const dir = chartDir();
if (dir) {
  mkdirSync(dir, { recursive: true });
  writeChart(dir, 'ai-ledger', chart, {
    title: '공용 AI 월 예산 원장 상태도',
    command: 'node scripts/ci-ai-ledger-model-check.mjs --chart <폴더>',
    reading: [
      '채팅, 번역, Actions 분석, 웹검색은 한 달 AI 예산 원장을 함께 씁니다. 요청마다 먼저 최대 금액을 예약하고, OpenAI 호출을 시작하면 그 예약은 더 이상 돌려받지 못하며, 응답이 끝나면 실제 금액으로 정산합니다. 월 합계는 언제나 아직 갚지 않은 예약과 정산된 금액의 합이어야 합니다.',
      `이 그림은 실제 원장 코드에 두 요청의 모든 순서(재시작·저장 실패·날짜와 월 경계 포함)를 ${DEPTH}단계까지 넣어 얻은 전이입니다(상한 모드 ${real.hard.states.toLocaleString('en-US')}개 상태). 빨간 선은 호출을 시작한 예약을 환불하도록 망가뜨린 코드가 가는 길이고, 지금 코드는 그 길로 가지 않습니다.`,
    ],
  });
}
console.log(JSON.stringify({ ok: true, depth: DEPTH, modes: real, invariants: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], variants: variantResults, synced: sync, chartEdges: chart.edgeCount() }));
