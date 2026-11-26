// v58.72 (owner 2026-10-23, state-machine review): bounded exhaustive model check of the history.json session lane.
// The hand-picked fixtures in ci-history-field-time-contract-check cover the scenes someone wrote down; this check feeds
// every small dated history (three rows, one field, two values, two relations, two sessions) through the real
// producer transitions and checks the invariants the P1978/P1990/v58.71/P2011 fixes were about. No separate spec: the
// functions under test are the ones refresh-data runs (scripts/producer/history.mjs).
//
// Transitions: mergeBackfillBars (a provider daily bar for a row date), holdRepeatedSessions (session ownership across
// rows), and the next run's row (today's row rewritten with a previous-close or a provisional read) followed by
// holdRepeatedSessions again. Relations: latest-completed-close, previous-completed-close and provisional-session-close
// (the 17:00 ET halt print of futures and the dollar index, written before the settle; a "firm" read is any other).
// Invariants:
//   H1 idempotent  — a second holdRepeatedSessions pass changes nothing.
//   H2 one owner   — each session has at most one non-carried row.
//   H3 settled     — once a settled (latest-completed-close) read of a session is on record, a previous-close read never
//                    changes that session's value, in this run or a later one.
//   H4 no loss     — every observed (session, value) survives as the owner value, a revision, or a held row.
//   H5 provisional — a session with a firm read on record has a firm owner (the provisional close yielded, value and
//                    relation), and a provisional read never changes a firm owner's value.
//   B1 backfill    — a bar never overwrites a completed record of its own session and always replaces another session's.
//                    A carried-forward placeholder is another session's value, so a bar always replaces it; a
//                    provisional close is no completed record, so a bar always replaces it too.
//                    A bar equal to the record in value and in everything but its check time is the same
//                    observation and leaves the record (and its first check time) as it is; B1's outcomes are unchanged.
//
// Provider stamps on days without a session (live 2026-11-15: Yahoo restamped the closed won at Sunday 03:30Z, a New
// York Saturday; that "11/14 session" was moved into the 11/14 row by the keeper and the time contract refused all 14 runs
// until the UTC date rolled). For each field calendar — FX (weekdays, London bars), a US-listed index over a weekend and
// over Thanksgiving, a Korean index over Christmas and the weekend after it, and BTC (every day a session) — every
// sequence of up to three runs from that scene's run times, each reading one of: the last close's own stamp, a restamp at
// the run time with the same or another value, a previous-close read stamped at the recorded bar's open, or one stamped
// at the next session's open, is driven through the producer's own run order (withHistorySession intake →
// dropSessionlessReads → keepDisplacedSessions → the updateHistory upsert, mirrored here → holdRepeatedSessions), from a
// history with and without a row for the last session. After every run:
//   T1 time        — no row holds a value observed after the end of the row's UTC day (the time contract's refusal).
//   T2 session day — no row names a sessionDate that is not a session day of its field.
//   T3 no session  — a read stamped on a day without a session gains, loses or changes no session's owner value.
//   T4 own rule    — a read stamped on a session day (every BTC day) is never held as one that names no session.
//
// The provisional lane (exploreProvisional): a weekday week, a Friday into the weekend and Thanksgiving, every sequence
// of up to three refreshes, each reading the newest or an older settled previous close and finding the hourly bars or
// not, through updateHistory's order with the provisional step (provisionalCloseTargets → withProvisionalCloses) before
// the keeper. P1 own session (never carried into the next session, never a pre-halt or reopen bar, never relabelled),
// P2 settle wins, P3 session day, P4 time — defined at exploreProvisional.
//
// Self-check (pstack create/maintain-formal-verification): the covered functions are fingerprinted in
// architecture/model-check-coverage.json, and each VARIANT below (the pre-P2011 code, a removed guard) must break its
// invariant, so a pass here is a pass of a check that can fail. When covered code changes: re-read the model above
// against the new code (are the relations, events and invariants still the ones the code has?), update it, then run
// `node scripts/ci-history-session-model-check.mjs --sync`. `--chart <dir>` writes the owner's statechart (Mermaid).
import { mkdirSync } from 'node:fs';
import * as history from './producer/history.mjs';
import * as historySession from '../src/domain/market/session/history-session.js';
import { resolveMarketCalendarSession } from '../src/domain/market/session/market-calendar.js';
import { chartDir, createStatechart, importVariant, verifyCoverage, writeChart } from './lib/model-check-kit.mjs';

const GATE = 'history-session-model';
const MODULE = 'scripts/producer/history.mjs';
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };

const DATES = ['2026-10-20', '2026-10-21', '2026-10-22'];
const NEXT_DAY = '2026-10-23';
const SESSIONS = ['2026-10-20', '2026-10-21'];
const PROVISIONAL = history.PROVISIONAL_CLOSE_RELATION;
// Held (carried-forward) rows are not seeded: they are reached through holdRepeatedSessions, as in production, so the
// checked states are the reachable ones.
const RELATIONS = ['latest-completed-close', 'previous-completed-close', PROVISIONAL];
const NEXT_RUN_RELATIONS = ['previous-completed-close', PROVISIONAL];
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
    ["if (meta.observationRelation === 'carried-forward') continue;", ''],
  ] },
  { label: '백필 세션 대조 제거', expect: ['B1'], chart: false, replacements: [
    ['&& (!ownSession || ownSession === barSession)) continue;', ') continue;'],
  ] },
  { label: '잠정 종가가 확정 읽기에 자리를 내주지 않음', expect: ['H5'], chart: false, replacements: [
    ['const provisionalOwner = isProvisionalClose(ownerMeta) && !isProvisionalClose(meta);', 'const provisionalOwner = false;'],
  ] },
  { label: '잠정 읽기가 확정 값을 고침', expect: ['H5'], chart: false, replacements: [
    ['const provisionalRead = isProvisionalClose(meta) && !isProvisionalClose(ownerMeta);', 'const provisionalRead = false;'],
  ] },
  { label: '백필이 잠정 종가를 남김', expect: ['B1'], chart: false, replacements: [
    ['if (!carried && !offSession && !provisional && readNumber', 'if (!carried && !offSession && readNumber'],
  ] },
];

// The provisional lane, varied: each breaks the P invariant named (see exploreProvisional).
const PROVISIONAL_VARIANTS = [
  { label: '잠정 종가를 다음 날 행 세션으로 기록', expect: ['P1'], replacements: [['sessionDate: session,\n    };\n    written.push', 'sessionDate: rec.date || session,\n    };\n    written.push']] },
  { label: '17:00 ET 전에도 잠정 기록', expect: ['P1'], replacements: [['if (!(nowMs >= cutMs)) return [];', '']] },
  { label: '확정 읽기가 있어도 잠정 기록', expect: ['P2'], replacements: [['if (settledReadOnRecord(hist, field, basis.date)) continue;', '']] },
];

// The session owner before the 11/15 fix: a stamp's own day was its session, whatever the calendar said.
const OLD_SESSION_OWNER = { 'src/domain/market/session/history-session.js': [
  ['return day && isSessionDay(day, field) ? day : null;', 'return day;'],
  ['if (named) return isSessionDay(named, field) ? named : null;', 'if (named) return named;'],
] };
const KEEPER_TIME_GUARD = ['if (!(Date.parse(meta.observedAt) <= Date.parse(`${session}T23:59:59.999Z`))) return null;', ''];
const OFF_SESSION_VARIANTS = [
  { label: '11/15 이전 코드', expect: ['T1', 'T2', 'T3'], replacements: [KEEPER_TIME_GUARD], deps: OLD_SESSION_OWNER },
  { label: '보관 단계 시간 경계 제거', expect: ['T1'], replacements: [KEEPER_TIME_GUARD] },
  { label: '세션 없는 날 판정 제거', expect: ['T2', 'T3'], replacements: [], deps: OLD_SESSION_OWNER },
  { label: '세션 있는 읽기까지 보류', expect: ['T4'], replacements: [['if (!session) {', "if (!session || meta.observationRelation === 'latest-completed-close') {"]] },
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
// A read of a session that is not a provisional close (live, or held as a copy).
const isFirmRead = (row) => typeof row[FIELD] === 'number' && !!relationOf(row) && relationOf(row) !== PROVISIONAL
  && (relationOf(row) !== 'carried-forward' || (!!row.fieldMeta[FIELD].heldRelation && row.fieldMeta[FIELD].heldRelation !== PROVISIONAL));
const firmSessions = (rows) => new Set(rows.filter(isFirmRead).map(sessionOf));

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
  // H5: a session with a firm read on record has a firm owner, and a provisional read never moves a firm owner's value.
  const checkProvisional = (label, firm, before, after, read = null) => {
    for (const session of firm) {
      const owner = after.find((row) => live(row) && sessionOf(row) === session);
      if (owner && relationOf(owner) === PROVISIONAL) note(`H5:${label}:provisional-owner-kept`, before, after);
    }
    if (read?.relation !== PROVISIONAL) return;
    const was = before.find((row) => live(row) && sessionOf(row) === read.session && relationOf(row) !== PROVISIONAL);
    const now = after.find((row) => live(row) && sessionOf(row) === read.session);
    if (was && (!now || now[FIELD] !== was[FIELD])) note(`H5:${label}:firm-owner-revised`, before, after);
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
    checkProvisional('hold', firmSessions(before), before, afterHold);
    chartEdge(null, afterHold, '여러 행의 읽기를 세션별로 정리', `${states}:hold`);

    for (const relation of NEXT_RUN_RELATIONS) for (const session of SESSIONS) for (const value of VALUES) {
      const next = clone(afterHold);
      next.push({ date: NEXT_DAY, [FIELD]: value, fieldMeta: { [FIELD]: metaFor({ value, relation, session }) } });
      holdRepeatedSessions(next, { at: AT, fields: [FIELD] });
      transitions++;
      checkSettled('next-run', settled, afterHold, next);
      checkProvisional('next-run', firmSessions(next), afterHold, next, { relation, session });
      // The chart keeps the settled-close story; provisional reads are checked, not drawn.
      if (relation === PROVISIONAL) continue;
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
      const provisionalPrior = typeof prior[FIELD] === 'number' && relationOf(prior) === PROVISIONAL;
      const completed = typeof prior[FIELD] === 'number' && prior.fieldMeta[FIELD]?.valueBasis && !provisionalPrior;
      if (completed && sessionOf(prior) === DATES[i] && row[FIELD] !== prior[FIELD]) note('B1:backfill:same-session-overwritten', before, merged);
      if (completed && sessionOf(prior) !== DATES[i] && row[FIELD] !== value) note('B1:backfill:other-session-kept', before, merged);
      if (provisionalPrior && row[FIELD] !== value) note('B1:backfill:provisional-kept', before, merged);
    }
  }
  return { violations, states, transitions };
}

// ── Provider stamps on days without a session ──
// last: the last session before the closed days; closeAt: its closing stamp; barOpen / nextOpen: the open of its own daily
// bar and of the next session's bar (a previous-close read is stamped at one of them); runs: the refresh instants (UTC).
const OFF_SESSION_SCENES = [
  { field: 'usdkrw', before: '2026-11-12', last: '2026-11-13', closeAt: '2026-11-13T22:33:36.000Z', barOpen: '2026-11-13T00:00:00.000Z', nextOpen: '2026-11-16T00:00:00.000Z',
    runs: ['2026-11-13T23:51:00.000Z', '2026-11-14T03:21:00.000Z', '2026-11-14T23:21:00.000Z', '2026-11-15T03:21:00.000Z', '2026-11-15T17:20:00.000Z', '2026-11-15T22:30:00.000Z', '2026-11-16T00:21:00.000Z'] },
  { field: 'spx', before: '2026-11-12', last: '2026-11-13', closeAt: '2026-11-13T21:00:00.000Z', barOpen: '2026-11-13T14:30:00.000Z', nextOpen: '2026-11-16T14:30:00.000Z',
    runs: ['2026-11-13T23:51:00.000Z', '2026-11-14T03:21:00.000Z', '2026-11-15T17:20:00.000Z', '2026-11-15T23:30:00.000Z', '2026-11-16T14:50:00.000Z', '2026-11-16T23:51:00.000Z'] },
  { field: 'spx', before: '2026-11-24', last: '2026-11-25', closeAt: '2026-11-25T21:00:00.000Z', barOpen: '2026-11-25T14:30:00.000Z', nextOpen: '2026-11-27T14:30:00.000Z',
    runs: ['2026-11-25T23:51:00.000Z', '2026-11-26T03:21:00.000Z', '2026-11-26T17:20:00.000Z', '2026-11-26T23:51:00.000Z', '2026-11-27T14:50:00.000Z', '2026-11-27T19:00:00.000Z'] },
  { field: 'kospi', before: '2026-12-23', last: '2026-12-24', closeAt: '2026-12-24T06:30:00.000Z', barOpen: '2026-12-24T00:00:00.000Z', nextOpen: '2026-12-28T00:00:00.000Z',
    runs: ['2026-12-24T23:51:00.000Z', '2026-12-25T03:21:00.000Z', '2026-12-26T03:21:00.000Z', '2026-12-27T17:20:00.000Z', '2026-12-28T00:21:00.000Z', '2026-12-28T07:00:00.000Z'] },
  { field: 'btc', before: '2026-11-12', last: '2026-11-13', closeAt: '2026-11-13T23:50:00.000Z', barOpen: '2026-11-13T00:00:00.000Z', nextOpen: '2026-11-14T00:00:00.000Z',
    runs: ['2026-11-14T03:21:00.000Z', '2026-11-15T03:21:00.000Z', '2026-11-15T17:20:00.000Z', '2026-11-16T00:21:00.000Z'] },
];
const { isHistorySessionDay } = historySession; // the declared field calendars are the spec's calendar
const RESTAMP_LAG_MS = 10 * 60000;
const DAY_FORMAT = new Map();
// The day a stamp names (spec side): Seoul for Korean indices, UTC for BTC and midnight-UTC stamps, New York otherwise.
function stampDay(field, at) {
  if (field === 'btc' || /T00:00:00(\.000)?Z$/.test(at)) return at.slice(0, 10);
  const zone = field === 'kospi' || field === 'kosdaq' ? 'Asia/Seoul' : 'America/New_York';
  if (!DAY_FORMAT.has(zone)) DAY_FORMAT.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return DAY_FORMAT.get(zone).format(new Date(at));
}
const readsFor = (scene, at) => [
  { kind: '마지막 종가 스탬프', relation: 'latest-completed-close', stamp: scene.closeAt, value: 100 },
  { kind: '실행 시각 재스탬프(같은 값)', relation: 'latest-completed-close', stamp: new Date(Date.parse(at) - RESTAMP_LAG_MS).toISOString(), value: 100 },
  { kind: '실행 시각 재스탬프(다른 값)', relation: 'latest-completed-close', stamp: new Date(Date.parse(at) - RESTAMP_LAG_MS).toISOString(), value: 101 },
  { kind: '전일 종가(자기 봉 개시)', relation: 'previous-completed-close', stamp: scene.barOpen, value: 100, sessionDate: scene.last },
  ...(Date.parse(scene.nextOpen) <= Date.parse(at) ? [{ kind: '전일 종가(다음 봉 개시)', relation: 'previous-completed-close', stamp: scene.nextOpen, value: 100, sessionDate: scene.last }] : []),
];
const fieldMetaOf = (relation, observedAt, extra = {}) => ({
  observedAt, fetchedAt: observedAt, lastSuccessfulAt: observedAt, source: 'model', sourceKind: 'model', allowedUse: 'completed-market-series',
  marketSession: 'COMPLETED', valueBasis: relation, observationRelation: relation,
  observedAtSource: relation === 'previous-completed-close' ? 'provider-previous-close' : 'provider-current', ...extra,
});
function seedRows(scene, withLast) {
  const rows = [{ date: scene.before, [scene.field]: 99, fieldMeta: { [scene.field]: fieldMetaOf('latest-completed-close', `${scene.before}${scene.closeAt.slice(10)}`, { sessionDate: scene.before }) } }];
  if (withLast) rows.push({ date: scene.last, [scene.field]: 100, fieldMeta: { [scene.field]: fieldMetaOf('latest-completed-close', scene.closeAt, { sessionDate: scene.last }) } });
  return rows;
}
// One refresh in updateHistory's order. The upsert line is updateHistory's own (it is not a separate function).
function refresh(mod, rows, field, at, read) {
  const today = at.slice(0, 10);
  const meta = mod.withHistorySession({ ...fieldMetaOf(read.relation, read.stamp, read.sessionDate ? { sessionDate: read.sessionDate } : {}), fetchedAt: at, lastSuccessfulAt: at }, field);
  const rec = { date: today, [field]: read.value, fieldMeta: { [field]: meta } };
  mod.dropSessionlessReads(rows, today, rec, { fields: [field] });
  mod.keepDisplacedSessions(rows, today, rec, { fields: [field] });
  const idx = rows.findIndex((row) => row.date === today);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...rec, fieldMeta: { ...(rows[idx].fieldMeta || {}), ...rec.fieldMeta } }; else rows.push(rec);
  mod.holdRepeatedSessions(rows, { at, fields: [field] });
  rows.sort((a, b) => a.date.localeCompare(b.date));
}
function ownerValues(rows, field) {
  const owners = new Map();
  for (const row of rows) {
    const meta = row.fieldMeta?.[field];
    if (typeof row[field] !== 'number' || !meta || meta.observationRelation === 'carried-forward' || !meta.sessionDate || owners.has(meta.sessionDate)) continue;
    owners.set(meta.sessionDate, row[field]);
  }
  return owners;
}

function exploreOffSession(mod) {
  const violations = new Map();
  const seen = new Set();
  let transitions = 0;
  const note = (kind, trail, rows) => {
    const entry = violations.get(kind) || { count: 0, example: null };
    entry.count++;
    if (!entry.example) entry.example = { trail, rows };
    violations.set(kind, entry);
  };
  const check = (scene, read, before, after, trail) => {
    const { field } = scene;
    for (const row of after) {
      const meta = row.fieldMeta?.[field];
      if (typeof row[field] !== 'number' || !meta) continue;
      if (Date.parse(meta.observedAt) > Date.parse(`${row.date}T23:59:59.999Z`)) note(`T1:${field}:observed-after-row`, trail, after);
      if (meta.sessionDate && !isHistorySessionDay(meta.sessionDate, field)) note(`T2:${field}:not-a-session-day`, trail, after);
      if (meta.heldReason === 'no-session-on-stamp-day' && isHistorySessionDay(stampDay(field, meta.observedAt), field)) note(`T4:${field}:session-read-held`, trail, after);
    }
    if (!read.sessionDate && !isHistorySessionDay(stampDay(field, read.stamp), field)) {
      const was = ownerValues(before, field);
      const now = ownerValues(after, field);
      if (was.size !== now.size || [...was].some(([session, value]) => now.get(session) !== value)) note(`T3:${field}:owner-changed`, trail, after);
    }
  };
  const walk = (scene, rows, from, trail) => {
    seen.add(`${scene.field}:${JSON.stringify(rows)}`);
    if (trail.length === 4) return; // the seed label and up to three runs
    for (let i = from; i < scene.runs.length; i++) {
      const at = scene.runs[i];
      for (const read of readsFor(scene, at)) {
        const next = clone(rows);
        refresh(mod, next, scene.field, at, read);
        transitions++;
        const step = [...trail, `${at.slice(5, 16)} ${read.kind} ${read.stamp.slice(5, 19)}`];
        check(scene, read, rows, next, step);
        walk(scene, next, i + 1, step);
      }
    }
  };
  for (const scene of OFF_SESSION_SCENES) for (const withLast of [true, false]) walk(scene, seedRows(scene, withLast), 0, [withLast ? '마지막 세션 행 있음' : '마지막 세션 행 없음']);
  return { violations, states: seen.size, transitions };
}

// ── The provisional close lane ──
// sessions: the US sessions on record and after (seeded: the first `seeded`, settled in their own rows); runs: refresh
// instants (UTC, November, so 17:00 ET is 22:00Z). Session i settles at 80+i, three hours and more after its 17:00 ET halt
// (a previous-close read of it exists only from then); its hourly bars close at 60+i (15:00 ET bar), 70+i (16:00 ET bar,
// the halt print) and 50+i (18:00 ET reopen bar of the next trading day). Each run reads one settled session (the newest,
// or an older one: the provider's previous close flickers) and finds the hourly bars or not.
const PROVISIONAL_SCENES = [
  { label: '평일', field: 'wti', sessions: ['2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'], seeded: 2,
    runs: ['2026-11-17T21:21:00.000Z', '2026-11-17T22:21:00.000Z', '2026-11-17T23:51:00.000Z', '2026-11-18T00:21:00.000Z', '2026-11-18T01:51:00.000Z', '2026-11-18T03:21:00.000Z',
      '2026-11-18T22:21:00.000Z', '2026-11-18T23:51:00.000Z', '2026-11-19T01:51:00.000Z'] },
  { label: '금요일과 주말', field: 'gold', sessions: ['2026-11-18', '2026-11-19', '2026-11-20'], seeded: 2,
    runs: ['2026-11-20T21:21:00.000Z', '2026-11-20T23:51:00.000Z', '2026-11-21T00:21:00.000Z', '2026-11-21T03:21:00.000Z', '2026-11-22T17:20:00.000Z', '2026-11-22T23:51:00.000Z', '2026-11-23T01:51:00.000Z'] },
  { label: '추수감사절', field: 'dxy', sessions: ['2026-11-23', '2026-11-24', '2026-11-25'], seeded: 2,
    runs: ['2026-11-25T22:21:00.000Z', '2026-11-25T23:51:00.000Z', '2026-11-26T00:21:00.000Z', '2026-11-26T03:21:00.000Z', '2026-11-26T22:21:00.000Z', '2026-11-26T23:51:00.000Z', '2026-11-27T01:51:00.000Z'] },
];
const HALT_Z = 'T22:00:00.000Z'; // 17:00 EST
const settleAt = (session) => Date.parse(`${session}${HALT_Z}`) + 3.4 * 3600000;
const barsAt = (scene, at) => {
  const timestamp = []; const close = [];
  scene.sessions.forEach((session, i) => {
    for (const [hourZ, value] of [[20, 60 + i], [21, 70 + i], [23, 50 + i]]) {
      const openMs = Date.parse(`${session}T${String(hourZ).padStart(2, '0')}:00:00.000Z`);
      if (openMs + 3600000 <= Date.parse(at)) { timestamp.push(openMs / 1000); close.push(value); }
    }
  });
  return { timestamp, close };
};
const settledMeta = (session, at) => fieldMetaOf('previous-completed-close', `${session}T05:00:00.000Z`, { sessionDate: session, fetchedAt: at, lastSuccessfulAt: at });
// One refresh in updateHistory's order, with the provisional step where updateHistory runs it.
function provisionalRefresh(mod, rows, scene, at, read, withBars) {
  const { field } = scene;
  const today = at.slice(0, 10);
  const rec = { date: today, [field]: 80 + scene.sessions.indexOf(read), fieldMeta: { [field]: mod.withHistorySession(settledMeta(read, at), field) } };
  const targets = mod.provisionalCloseTargets(rows, rec, Date.parse(at), [field]);
  mod.withProvisionalCloses(rows, rec, targets, withBars ? { [field]: barsAt(scene, at) } : {}, { fetchedAt: at });
  mod.dropSessionlessReads(rows, today, rec, { fields: [field] });
  mod.keepDisplacedSessions(rows, today, rec, { fields: [field] });
  const idx = rows.findIndex((row) => row.date === today);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...rec, fieldMeta: { ...(rows[idx].fieldMeta || {}), ...rec.fieldMeta } }; else rows.push(rec);
  mod.holdRepeatedSessions(rows, { at, fields: [field] });
  rows.sort((a, b) => a.date.localeCompare(b.date));
}
// After every run:
//   P1 own session — a provisional value is its own session's 16:00 ET bar (the halt print), filed under that session,
//                    and no other live value is one: it is never carried into the next session, a pre-halt or reopen bar
//                    never stands in for it, and it is never relabelled as another relation.
//   P2 settle wins — once a session's settle was read, its owner is that settle (not provisional), from then on.
//   P3 session day — a provisional value names an open US session, written at or after its 17:00 ET halt.
//   P4 time        — no row holds a value observed after the end of the row's UTC day (the time contract).
function exploreProvisional(mod) {
  const violations = new Map();
  const seen = new Set();
  let transitions = 0;
  const note = (kind, trail, rows) => {
    const entry = violations.get(kind) || { count: 0, example: null };
    entry.count++;
    if (!entry.example) entry.example = { trail, rows };
    violations.set(kind, entry);
  };
  const check = (scene, rows, settledSeen, trail) => {
    const { field, sessions } = scene;
    for (const row of rows) {
      const meta = row.fieldMeta?.[field];
      if (typeof row[field] !== 'number' || !meta) continue;
      if (Date.parse(meta.observedAt) > Date.parse(`${row.date}T23:59:59.999Z`)) note(`P4:${field}:observed-after-row`, trail, rows);
      if (meta.observationRelation === 'carried-forward') continue;
      const i = sessions.indexOf(meta.sessionDate);
      const halt = row[field] >= 70 && row[field] < 80;
      if (meta.observationRelation === PROVISIONAL) {
        if (i < 0 || row[field] !== 70 + i) note(`P1:${field}:provisional-not-own-halt-print`, trail, rows);
        if (resolveMarketCalendarSession({ market: 'US', date: meta.sessionDate }).status !== 'open' || Date.parse(meta.fetchedAt) < Date.parse(`${meta.sessionDate}${HALT_Z}`)) note(`P3:${field}:provisional-off-session`, trail, rows);
      } else if (halt) note(`P1:${field}:halt-print-relabelled`, trail, rows);
    }
    for (const session of settledSeen) {
      const owner = rows.find((row) => typeof row[field] === 'number' && row.fieldMeta?.[field]?.observationRelation !== 'carried-forward' && row.fieldMeta?.[field]?.sessionDate === session);
      if (!owner || owner[field] !== 80 + sessions.indexOf(session) || owner.fieldMeta[field].observationRelation === PROVISIONAL) note(`P2:${field}:settle-not-owner`, trail, rows);
    }
  };
  const walk = (scene, rows, from, settledSeen, trail) => {
    seen.add(`${scene.label}:${JSON.stringify(rows)}`);
    if (trail.length === 4) return; // the seed label and up to three runs
    for (let i = from; i < scene.runs.length; i++) {
      const at = scene.runs[i];
      const reads = scene.sessions.filter((session) => settleAt(session) <= Date.parse(at));
      for (const read of reads) for (const withBars of [true, false]) {
        const next = clone(rows);
        provisionalRefresh(mod, next, scene, at, read, withBars);
        transitions++;
        const step = [...trail, `${at.slice(5, 16)} 전일 종가 ${read.slice(5)}${withBars ? ' + 시간봉' : ''}`];
        const nowSettled = new Set([...settledSeen, read]);
        check(scene, next, nowSettled, step);
        walk(scene, next, i + 1, nowSettled, step);
      }
    }
  };
  for (const scene of PROVISIONAL_SCENES) {
    const seeded = scene.sessions.slice(0, scene.seeded);
    const rows = seeded.map((session, i) => ({ date: session, [scene.field]: 80 + i, fieldMeta: { [scene.field]: settledMeta(session, `${session}T23:51:00.000Z`) } }));
    walk(scene, rows, 0, new Set(seeded), [scene.label]);
  }
  return { violations, states: seen.size, transitions };
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

const offSession = exploreOffSession(history);
if (offSession.states < 1000) fail(`off-session state space collapsed: ${offSession.states} states`);
if (offSession.violations.size) {
  for (const line of describe(offSession.violations)) console.error(`[${GATE}] ${line}`);
  fail(`${offSession.violations.size} off-session invariant(s) violated over ${offSession.states} states`);
}
for (const variant of OFF_SESSION_VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label, { deps: variant.deps || {} });
  const run = exploreOffSession(mod);
  const broken = [...new Set([...run.violations.keys()].map((kind) => kind.split(':')[0]))].sort();
  const missed = variant.expect.filter((id) => !broken.includes(id));
  if (missed.length) fail(`variant "${variant.label}" should break ${missed.join(', ')} but the check passed it (broken: ${broken.join(', ') || 'none'}) — the model lost the power to fail`);
  variantResults.push({ variant: variant.label, broken });
}

const provisional = exploreProvisional(history);
if (provisional.states < 300) fail(`provisional state space collapsed: ${provisional.states} states`);
if (provisional.violations.size) {
  for (const line of describe(provisional.violations)) console.error(`[${GATE}] ${line}`);
  fail(`${provisional.violations.size} provisional invariant(s) violated over ${provisional.states} states`);
}
for (const variant of PROVISIONAL_VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  const run = exploreProvisional(mod);
  const broken = [...new Set([...run.violations.keys()].map((kind) => kind.split(':')[0]))].sort();
  const missed = variant.expect.filter((id) => !broken.includes(id));
  if (missed.length) fail(`variant "${variant.label}" should break ${missed.join(', ')} but the check passed it (broken: ${broken.join(', ') || 'none'}) — the model lost the power to fail`);
  variantResults.push({ variant: variant.label, broken });
}

const SESSION_MODULE = 'src/domain/market/session/history-session.js';
const sync = process.argv.includes('--sync');
const drift = verifyCoverage(GATE, [
  { module: MODULE, name: 'holdRepeatedSessions', fn: history.holdRepeatedSessions },
  { module: MODULE, name: 'mergeBackfillBars', fn: history.mergeBackfillBars },
  { module: MODULE, name: 'keepDisplacedSessions', fn: history.keepDisplacedSessions },
  { module: MODULE, name: 'keepInSessionRow', fn: history.keepInSessionRow },
  { module: MODULE, name: 'dropSessionlessReads', fn: history.dropSessionlessReads },
  { module: MODULE, name: 'withHistorySession', fn: history.withHistorySession },
  { module: MODULE, name: 'provisionalCloseTargets', fn: history.provisionalCloseTargets },
  { module: MODULE, name: 'provisionalCloseBar', fn: history.provisionalCloseBar },
  { module: MODULE, name: 'withProvisionalCloses', fn: history.withProvisionalCloses },
  { module: SESSION_MODULE, name: 'observationSessionDate', fn: historySession.observationSessionDate },
  { module: SESSION_MODULE, name: 'historyObservationSession', fn: historySession.historyObservationSession },
  { module: SESSION_MODULE, name: 'historyHeldSessionDate', fn: historySession.historyHeldSessionDate },
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
console.log(JSON.stringify({ ok: true, states: real.states, transitions: real.transitions, offSession: { states: offSession.states, transitions: offSession.transitions }, provisional: { states: provisional.states, transitions: provisional.transitions }, invariants: ['H1', 'H2', 'H3', 'H4', 'H5', 'B1', 'T1', 'T2', 'T3', 'T4', 'P1', 'P2', 'P3', 'P4'], variants: variantResults, synced: sync, chartEdges: chart.edgeCount() }));
