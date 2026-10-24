// v58.72 (owner 2026-10-23, state-machine review): bounded exhaustive model check of the history.json session lane.
// The hand-picked fixtures in ci-history-field-time-contract-check cover the scenes someone wrote down; this check feeds
// every small dated history (three rows, one field, two values, two relations, two sessions) through the real
// producer transitions and checks the invariants the P1978/P1990/v58.71/P2011 fixes were about. No separate spec: the
// functions under test are the ones refresh-data runs (scripts/producer/history.mjs).
//
// Transitions: mergeBackfillBars (a provider daily bar for a row date), holdRepeatedSessions (session ownership across
// rows), and the next run's row (today's row rewritten with a previous-close read) followed by holdRepeatedSessions again.
// Invariants:
//   H1 idempotent  — a second holdRepeatedSessions pass changes nothing.
//   H2 one owner   — each session has at most one non-carried row.
//   H3 settled     — once a settled (latest-completed-close) read of a session is on record, a previous-close read never
//                    changes that session's value, in this run or a later one.
//   H4 no loss     — every observed (session, value) survives as the owner value, a revision, or a held row.
//   B1 backfill    — a bar never overwrites a completed record of its own session and always replaces another session's.
//
// Self-check (pstack create/maintain-formal-verification): the covered functions are fingerprinted in
// architecture/model-check-coverage.json, and each VARIANT below (the pre-P2011 code, a removed guard) must break its
// invariant, so a pass here is a pass of a check that can fail. When covered code changes: re-read the model above
// against the new code (are the relations, events and invariants still the ones the code has?), update it, then run
// `node scripts/ci-history-session-model-check.mjs --sync`. `--chart <dir>` writes the owner's statechart (Mermaid).
import { mkdirSync } from 'node:fs';
import * as history from './producer/history.mjs';
import { chartDir, createStatechart, importVariant, verifyCoverage, writeChart } from './lib/model-check-kit.mjs';

const GATE = 'history-session-model';
const MODULE = 'scripts/producer/history.mjs';
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };

const DATES = ['2026-10-20', '2026-10-21', '2026-10-22'];
const NEXT_DAY = '2026-10-23';
const SESSIONS = ['2026-10-20', '2026-10-21'];
// Held (carried-forward) rows are not seeded: they are reached through holdRepeatedSessions, as in production, so the
// checked states are the reachable ones.
const RELATIONS = ['latest-completed-close', 'previous-completed-close'];
const VALUES = [100, 101];
const FIELD = 'spx';
const AT = '2026-10-23T00:00:00.000Z';

const VARIANTS = [
  { label: 'P2011 이전 코드', expect: ['H3'], replacements: [
    ["const settledOwner = wasSettled && meta.observationRelation === 'previous-completed-close';",
      "const settledOwner = ownerMeta.observationRelation === 'latest-completed-close' && meta.observationRelation === 'previous-completed-close';"],
    ["const firstSettled = !wasSettled && meta.observationRelation === 'latest-completed-close';", 'const firstSettled = false;'],
  ] },
  { label: '보류 행 건너뛰기 제거', expect: ['H1'], chart: false, replacements: [
    ["if (!session || meta.observationRelation === 'carried-forward') continue;", 'if (!session) continue;'],
  ] },
  { label: '백필 세션 대조 제거', expect: ['B1'], chart: false, replacements: [
    ['&& (!ownSession || ownSession === barSession)) continue;', ') continue;'],
  ] },
];

const cells = [null];
for (const value of VALUES) {
  for (const relation of RELATIONS) for (const session of SESSIONS) cells.push({ value, relation, session });
}
const metaFor = (cell) => ({ observationRelation: cell.relation, valueBasis: cell.relation, observedAt: `${cell.session}T20:00:00.000Z`, sessionDate: cell.session });
const build = (combo) => combo.map((cell, i) => {
  const row = { date: DATES[i], fieldMeta: {} };
  row[FIELD] = cell ? cell.value : null;
  if (cell) row.fieldMeta[FIELD] = metaFor(cell);
  return row;
});
const clone = (value) => JSON.parse(JSON.stringify(value));
const sessionOf = (row) => row.fieldMeta?.[FIELD]?.sessionDate || null;
const relationOf = (row) => row.fieldMeta?.[FIELD]?.observationRelation || null;
const live = (row) => typeof row[FIELD] === 'number' && relationOf(row) && relationOf(row) !== 'carried-forward';
const isSettledRead = (row) => typeof row[FIELD] === 'number'
  && (relationOf(row) === 'latest-completed-close' || (relationOf(row) === 'carried-forward' && row.fieldMeta[FIELD].heldRelation === 'latest-completed-close'));
const settledReads = (rows) => rows.filter(isSettledRead).map((row) => ({ session: sessionOf(row), value: row[FIELD] }));

// What a reader of history.json sees for one session.
const CHART_NODES = {
  start: { label: '갱신 시작', kind: 'start' },
  none: { label: '기록 없음', kind: 'works' },
  provisional: { label: '전일 종가 읽기만 기록됨', kind: 'works' },
  settled: { label: '확정 종가 기록됨', kind: 'works' },
  overwritten: { label: '확정 종가가 다른 값으로 덮임', kind: 'bug' },
  twoOwners: { label: '한 세션에 대표 값이 둘', kind: 'bug' },
};
function sessionState(rows, session) {
  const owners = rows.filter((row) => live(row) && sessionOf(row) === session);
  if (owners.length > 1) return 'twoOwners';
  const settled = rows.filter((row) => isSettledRead(row) && sessionOf(row) === session).map((row) => row[FIELD]);
  if (!owners.length) return 'none';
  if (!settled.length) return 'provisional';
  return settled.includes(owners[0][FIELD]) ? 'settled' : 'overwritten';
}

function explore({ holdRepeatedSessions, mergeBackfillBars }, chart, variant) {
  const violations = new Map();
  const note = (kind, before, after) => {
    const entry = violations.get(kind) || { count: 0, example: null };
    entry.count++;
    if (!entry.example) entry.example = { before, after };
    violations.set(kind, entry);
  };
  const checkOwnership = (label, before, after) => {
    const owners = new Map();
    for (const row of after) if (live(row)) owners.set(sessionOf(row), (owners.get(sessionOf(row)) || 0) + 1);
    if ([...owners.values()].some((n) => n > 1)) note(`H2:${label}:two-owners`, before, after);
    for (const row of before) {
      if (!live(row)) continue;
      const kept = after.some((other) => sessionOf(other) === sessionOf(row)
        && (other[FIELD] === row[FIELD] || (other.fieldMeta?.[FIELD]?.revisions || []).some((entry) => entry.value === row[FIELD])));
      if (!kept) note(`H4:${label}:value-lost`, before, after);
    }
  };
  // With exactly one settled value for a session on record (rival settled reads may legitimately revise), the
  // session's owner keeps it.
  const checkSettled = (label, settled, before, after) => {
    for (const { session, value } of settled) {
      if (settled.some((other) => other.session === session && other.value !== value)) continue;
      const owner = after.find((row) => live(row) && sessionOf(row) === session);
      if (owner && owner[FIELD] !== value) note(`H3:${label}:settled-replaced`, before, after);
    }
  };
  const chartEdge = (beforeRows, afterRows, label, caseId) => {
    for (const session of SESSIONS) {
      const from = beforeRows ? sessionState(beforeRows, session) : 'start';
      const to = sessionState(afterRows, session);
      if (to === 'none') continue;
      chart.add(from, to, label, variant, `${caseId}:${session}`);
    }
  };

  let states = 0;
  let transitions = 0;
  for (const a of cells) for (const b of cells) for (const c of cells) {
    const combo = [a, b, c];
    if (combo.some((cell, i) => cell && cell.session > DATES[i])) continue; // a row never holds a later session
    states++;
    const before = build(combo);
    const settled = settledReads(before);

    const held = clone(before);
    holdRepeatedSessions(held, { at: AT, fields: [FIELD] });
    const once = JSON.stringify(held);
    const again = holdRepeatedSessions(held, { at: AT, fields: [FIELD] });
    transitions += 2;
    if (again.held.length || again.revised.length || JSON.stringify(held) !== once) note('H1:hold:not-idempotent', before, JSON.parse(once));
    const afterHold = JSON.parse(once);
    checkOwnership('hold', before, afterHold);
    checkSettled('hold', settled, before, afterHold);
    chartEdge(null, afterHold, '여러 행의 읽기를 세션별로 정리', `${states}:hold`);

    for (const session of SESSIONS) for (const value of VALUES) {
      const next = clone(afterHold);
      next.push({ date: NEXT_DAY, [FIELD]: value, fieldMeta: { [FIELD]: metaFor({ value, relation: 'previous-completed-close', session }) } });
      holdRepeatedSessions(next, { at: AT, fields: [FIELD] });
      transitions++;
      checkSettled('next-run', settled, afterHold, next);
      const same = afterHold.some((row) => live(row) && sessionOf(row) === session && row[FIELD] === value);
      chartEdge(afterHold, next, same ? '다음 회차: 같은 값의 전일 종가 읽기' : '다음 회차: 다른 값의 전일 종가 읽기', `${states}:next:${session}:${value}`);
    }

    for (let i = 0; i < DATES.length; i++) for (const value of VALUES) {
      const merged = clone(before);
      const bar = { [FIELD]: value, fieldMeta: { [FIELD]: { ...metaFor({ value, relation: 'latest-completed-close', session: DATES[i] }) } } };
      mergeBackfillBars(merged, { [DATES[i]]: bar }, [FIELD]);
      transitions++;
      const prior = before[i];
      const row = merged.find((candidate) => candidate.date === DATES[i]);
      const completed = typeof prior[FIELD] === 'number' && prior.fieldMeta[FIELD]?.valueBasis;
      if (completed && sessionOf(prior) === DATES[i] && row[FIELD] !== prior[FIELD]) note('B1:backfill:same-session-overwritten', before, merged);
      if (completed && sessionOf(prior) !== DATES[i] && row[FIELD] !== value) note('B1:backfill:other-session-kept', before, merged);
    }
  }
  return { violations, states, transitions };
}

const describe = (violations) => [...violations].map(([kind, { count, example }]) => `${kind} x${count}: ${JSON.stringify(example).slice(0, 900)}`);
const chart = createStatechart({ title: 'history.json 한 세션의 기록 (실제 코드 전수 탐색)', nodes: CHART_NODES });

const real = explore(history, chart, null);
if (real.states < 300) fail(`state space collapsed: ${real.states} states`);
if (real.violations.size) {
  for (const line of describe(real.violations)) console.error(`[${GATE}] ${line}`);
  fail(`${real.violations.size} invariant(s) violated over ${real.states} states`);
}

const variantResults = [];
for (const variant of VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  // Only the past-defect variant is drawn; guard-removal variants prove the check can fail but are not real history.
  const run = explore(mod, variant.chart === false ? createStatechart({ title: '', nodes: {} }) : chart, variant.label);
  const broken = [...new Set([...run.violations.keys()].map((kind) => kind.split(':')[0]))];
  const missed = variant.expect.filter((id) => !broken.includes(id));
  if (missed.length) fail(`variant "${variant.label}" should break ${missed.join(', ')} but the check passed it (broken: ${broken.join(', ') || 'none'}) — the model lost the power to fail`);
  variantResults.push({ variant: variant.label, broken });
}

const sync = process.argv.includes('--sync');
const drift = verifyCoverage(GATE, [
  { module: MODULE, name: 'holdRepeatedSessions', fn: history.holdRepeatedSessions },
  { module: MODULE, name: 'mergeBackfillBars', fn: history.mergeBackfillBars },
], { sync });
if (drift.length) fail(`covered code changed — re-read the model in this file's header against it, update the model, then rerun with --sync:\n  ${drift.join('\n  ')}`);

const dir = chartDir();
if (dir) {
  mkdirSync(dir, { recursive: true });
  writeChart(dir, 'history-session', chart, {
    title: 'history.json 한 세션의 종가 기록 상태도',
    command: 'node scripts/ci-history-session-model-check.mjs --chart <폴더>',
    reading: [
      `history.json은 지수·환율 종가를 날짜별 행에 쌓습니다. 같은 세션의 종가는 여러 번 읽힙니다. 아침 회차가 전일 종가로 먼저 적고, 나중에 확정 일봉이 들어옵니다. 확정 종가가 한 번 기록되면 그 뒤의 전일 종가 읽기가 값을 바꾸면 안 됩니다.`,
      `이 그림은 실제 세션 정리 함수에 작은 history ${real.states}개 상태를 모두 넣어 얻은 전이입니다(${real.transitions.toLocaleString('en-US')}회). 빨간 선은 P2011 이전 코드가 확정 종가를 다른 값으로 덮던 두 경로이고, 초록 선은 같은 입력에서 지금 코드가 가는 경로입니다. 실제 history.json에서는 이 상황이 0건이었습니다.`,
    ],
  });
}
console.log(JSON.stringify({ ok: true, states: real.states, transitions: real.transitions, invariants: ['H1', 'H2', 'H3', 'H4', 'B1'], variants: variantResults, synced: sync, chartEdges: chart.edgeCount() }));
