// v58.72 (owner 2026-10-23, state-machine review): bounded exhaustive model check of the history.json session lane.
// The hand-picked fixtures in ci-history-field-time-contract-check cover the scenes someone wrote down; this check feeds
// every small dated history (three rows, one field, two values, two relations, two sessions) through the real
// producer transitions and checks the invariants the P1978/P1990/v58.71 fixes were about. No separate spec: the
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
import { holdRepeatedSessions, mergeBackfillBars } from './producer/history.mjs';

const DATES = ['2026-10-20', '2026-10-21', '2026-10-22'];
const NEXT_DAY = '2026-10-23';
const SESSIONS = ['2026-10-20', '2026-10-21'];
// Held (carried-forward) rows are not seeded: they are reached through holdRepeatedSessions, as in production, so the
// checked states are the reachable ones.
const RELATIONS = ['latest-completed-close', 'previous-completed-close'];
const VALUES = [100, 101];
const FIELD = 'spx';
const AT = '2026-10-23T00:00:00.000Z';

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
const settledReads = (rows) => rows.filter((row) => typeof row[FIELD] === 'number'
  && (relationOf(row) === 'latest-completed-close' || (relationOf(row) === 'carried-forward' && row.fieldMeta[FIELD].heldRelation === 'latest-completed-close')))
  .map((row) => ({ session: sessionOf(row), value: row[FIELD] }));

const violations = new Map();
const note = (kind, before, after) => {
  const entry = violations.get(kind) || { count: 0, example: null };
  entry.count++;
  if (!entry.example) entry.example = { before, after };
  violations.set(kind, entry);
};

function checkOwnership(label, before, after) {
  const owners = new Map();
  for (const row of after) if (live(row)) owners.set(sessionOf(row), (owners.get(sessionOf(row)) || 0) + 1);
  if ([...owners.values()].some((n) => n > 1)) note(`${label}:H2-two-owners`, before, after);
  for (const row of before) {
    if (!live(row)) continue;
    const kept = after.some((other) => sessionOf(other) === sessionOf(row)
      && (other[FIELD] === row[FIELD] || (other.fieldMeta?.[FIELD]?.revisions || []).some((entry) => entry.value === row[FIELD])));
    if (!kept) note(`${label}:H4-value-lost`, before, after);
  }
}

// H3: with exactly one settled value for a session on record (rival settled reads may legitimately revise), the
// session's owner keeps it.
function checkSettled(label, settled, before, after) {
  for (const { session, value } of settled) {
    if (settled.some((other) => other.session === session && other.value !== value)) continue;
    const owner = after.find((row) => live(row) && sessionOf(row) === session);
    if (owner && owner[FIELD] !== value) note(`${label}:H3-settled-replaced`, before, after);
  }
}

let states = 0;
let transitions = 0;
for (const a of cells) for (const b of cells) for (const c of cells) {
  const combo = [a, b, c];
  if (combo.some((cell, i) => cell && cell.session > DATES[i])) continue; // a row never holds a later session
  states++;
  const before = build(combo);
  const settled = settledReads(before);

  // holdRepeatedSessions, twice.
  const held = clone(before);
  holdRepeatedSessions(held, { at: AT, fields: [FIELD] });
  const once = JSON.stringify(held);
  const again = holdRepeatedSessions(held, { at: AT, fields: [FIELD] });
  transitions += 2;
  if (again.held.length || again.revised.length || JSON.stringify(held) !== once) note('hold:H1-not-idempotent', before, JSON.parse(once));
  const afterHold = JSON.parse(once);
  checkOwnership('hold', before, afterHold);
  checkSettled('hold', settled, before, afterHold);

  // The next run: today's row is written with a previous-close read of each session/value, then ownership runs again.
  for (const session of SESSIONS) for (const value of VALUES) {
    const next = clone(afterHold);
    next.push({ date: NEXT_DAY, [FIELD]: value, fieldMeta: { [FIELD]: metaFor({ value, relation: 'previous-completed-close', session }) } });
    holdRepeatedSessions(next, { at: AT, fields: [FIELD] });
    transitions++;
    checkSettled('next-run', settled, afterHold, next);
  }

  // mergeBackfillBars: a settled daily bar for each row date.
  for (let i = 0; i < DATES.length; i++) for (const value of VALUES) {
    const merged = clone(before);
    const bar = { [FIELD]: value, fieldMeta: { [FIELD]: { ...metaFor({ value, relation: 'latest-completed-close', session: DATES[i] }) } } };
    mergeBackfillBars(merged, { [DATES[i]]: bar }, [FIELD]);
    transitions++;
    const prior = before[i];
    const row = merged.find((candidate) => candidate.date === DATES[i]);
    const completed = typeof prior[FIELD] === 'number' && prior.fieldMeta[FIELD]?.valueBasis;
    if (completed && sessionOf(prior) === DATES[i] && row[FIELD] !== prior[FIELD]) note('backfill:B1-same-session-overwritten', before, merged);
    if (completed && sessionOf(prior) !== DATES[i] && row[FIELD] !== value) note('backfill:B1-other-session-kept', before, merged);
  }
}

if (states < 300) throw new Error(`[history-session-model] state space collapsed: ${states} states`);
if (violations.size) {
  for (const [kind, { count, example }] of violations) console.error(`[history-session-model] ${kind} x${count}: ${JSON.stringify(example)}`);
  throw new Error(`[history-session-model] ${violations.size} invariant(s) violated over ${states} states`);
}
console.log(JSON.stringify({ ok: true, states, transitions, invariants: ['H1', 'H2', 'H3', 'H4', 'B1'] }));
