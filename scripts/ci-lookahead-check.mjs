// v58.80 (owner 2026-10-25, freqtrade lookahead-analysis / recursive-analysis): a reading for a past date must not change
// when the data after that date changes or disappears, and today's reading must not depend on how much older history the
// file happens to keep (R725, P2064). R697 asks past frequencies to use "only data available at each case date"; until now
// that held by code review only. This gate re-runs readings on cut or rewritten data, the way freqtrade re-runs a backtest:
//   1. as-of invariance   — f(full file, as of D) equals f(the file as it stood at D)                  (lookahead)
//   2. future perturbation — rewriting every close after D leaves D's backfilled row unchanged         (lookahead in recomputation)
//   3. warm-up sufficiency — today's reading on the full file equals it on the file cut to the stated need (path dependence)
// "The file as it stood at D" is cut per value by its observation time, never by the collection bucket: the Saturday bucket
// holds Friday's 17:00 ET DXY/WTI settle (observed Friday), so a bucket-date cut drops a value a run on D could see.
import { readFileSync } from 'node:fs';
import { buildMarketRegime, buildCloseSeries } from '../src/domain/briefing/market-read.js';
import { spxMovingAveragesFromHistory } from '../src/domain/market/moving-average.js';
import { buildRegimeRadar } from '../src/domain/market/regime-radar.js';
import { buildThemeStageBackfill } from './producer/theme-stage-backfill.mjs';
import { loadThemeMaps } from './build-scenario-state.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const historyFile = readJson('../public-data/history.json');
const rows = (Array.isArray(historyFile) ? historyFile : historyFile.rows || []).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row?.date || ''));
const macroHistory = readJson('../public-data/macro-history.json');
const failures = [];
const notes = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message) => failures.push(message);
const FIELDS = ['spx', 'vix', 'tnx', 'breadth50', 'breadth200', 'dxy', 'wti', 'nasdaq', 'rut'];

const CHECK_SESSIONS = 30;
const spxDates = buildCloseSeries(rows, 'spx').map((point) => point.date);
const checkDates = spxDates.slice(-CHECK_SESSIONS - 1, -1);

// The file as a run at the end of D's New York day saw it: a field value is kept when it was observed by 00:00 ET on D+1
// (05:00Z covers EST; a previous close stamped at the next bar's 00:00 ET boundary belongs to D). A value without its own
// observation time falls back to the bucket date. A later bucket that re-observes D's session after that cut-off is what
// this check exists to catch.
const dayEndUtc = (date) => Date.parse(`${date}T00:00:00Z`) + 29 * 3600e3;
function historyAsOf(date) {
  const cutoff = dayEndUtc(date);
  const out = [];
  for (const row of rows) {
    if (row.date > nextDay(date, 7)) continue;
    const copy = { ...row, fieldMeta: { ...(row.fieldMeta || {}) } };
    let kept = 0;
    for (const field of Object.keys(row)) {
      if (field === 'date' || field === 'fieldMeta') continue;
      const observed = Date.parse(row.fieldMeta?.[field]?.observedAt || '');
      const visible = Number.isFinite(observed) ? observed <= cutoff : row.date <= date;
      if (visible) kept += 1; else { delete copy[field]; delete copy.fieldMeta[field]; }
    }
    if (kept) out.push(copy);
  }
  return out;
}
function nextDay(date, days = 1) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10); }
const macroAsOf = (date) => ({ ...macroHistory, series: Object.fromEntries(Object.entries(macroHistory.series || {}).map(([key, series]) => [key, {
  ...series, observations: (series?.observations || []).filter((row) => String(Array.isArray(row) ? row[0] : row?.date || '').slice(0, 10) <= date)
}])) });

// Credit as the crash replay builds it, so the credit axis is evaluated (an empty credit object leaves it 'unknown' and the
// macro file could never change a state).
const hyObs = (macroHistory.series?.hyOas?.observations || []).map((row) => (Array.isArray(row) ? row : [row?.date, row?.value]));
function creditAt(date) {
  const obs = hyObs.filter((row) => String(row[0]).slice(0, 10) <= date);
  const last = obs.at(-1), five = obs.at(-6);
  return last && five ? { hyBp: last[1] * 100, hyDelta5Bp: (last[1] - five[1]) * 100, hyAsOf: last[0] } : {};
}
const regimeAt = (history, macro, date) => buildMarketRegime({ history, credit: creditAt(date), rates: {}, macroHistory: macro, now: Date.parse(`${date}T22:00:00Z`) });
const axesOf = (regime) => (regime?.axes || []).map((axis) => ({ id: axis.id, state: axis.state, value: axis.value ?? null, detail: axis.detail ?? null }));

// 1. As-of invariance.
let creditEvaluated = 0;
for (const date of checkDates) {
  const asOf = historyAsOf(date);
  if (!same(spxMovingAveragesFromHistory(rows, { asOf: date }), spxMovingAveragesFromHistory(asOf, { asOf: date })))
    fail(`spxMovingAveragesFromHistory(asOf ${date}) uses an S&P 500 close observed after ${date}`);
  for (const field of FIELDS) {
    const full = buildCloseSeries(rows, field, { through: date });
    const then = buildCloseSeries(asOf, field, { through: date });
    if (!same(full, then)) {
      const changed = full.filter((point) => then.find((item) => item.date === point.date)?.value !== point.value).map((point) => point.date);
      fail(`buildCloseSeries(${field}, through ${date}) uses an observation made after ${date} for ${changed.slice(-3).join(', ') || 'a missing session'}`);
    }
  }
  // The crash replay and the AI packet hand buildMarketRegime the whole macro file with a past history.
  const full = regimeAt(asOf, macroHistory, date), cut = regimeAt(asOf, macroAsOf(date), date);
  if (full.axes?.find((axis) => axis.id === 'credit')?.state !== 'unknown') creditEvaluated += 1;
  if (!same(axesOf(full), axesOf(cut))) fail(`buildMarketRegime on ${date} changes when HY OAS after ${date} is removed`);
}
if (creditEvaluated < checkDates.length / 2) fail(`the credit axis was evaluated on only ${creditEvaluated}/${checkDates.length} dates — the macro check would be vacuous`);

// The radar's "5거래일 전" point is today's run looking back; the run on that date must have drawn the same point once both
// runs have a full one-year window (M08 shrinks the window while the file is shorter than a year plus 20 sessions — the
// trend axis, a 200-day distance, needs about 470 sessions, more than the 420 buckets the file keeps, so it stays a note).
{
  const today = buildRegimeRadar({ history: rows }, { macroHistory });
  const fiveBack = spxDates.at(-6);
  const then = buildRegimeRadar({ history: historyAsOf(fiveBack) }, { macroHistory: macroAsOf(fiveBack) });
  for (const axis of today.axes || []) {
    const past = (then.axes || []).find((item) => item.id === axis.id);
    if (axis.values?.[1] == null || past?.values?.[0] == null || axis.values[1] === past.values[0]) continue;
    if (axis.sample === 252 && past.sample === 252) fail(`regime radar ${axis.id}: today's 5-session-back point ${axis.values[1]} ≠ ${past.values[0]} from a run on ${fiveBack}`);
    else notes.push(`radar ${axis.id} window ${axis.sample ?? '-'}/${past.sample ?? '-'} (<252): 5-session-back ${axis.values[1]} vs ${past.values[0]} — expected while the file is short`);
  }
}

// 2. Future perturbation of the theme-stage backfill (v58.79), on a seeded synthetic panel over the real US theme map:
// every sampled session's row must stay the same when every close after it is rewritten.
let backfillChecked = 0;
{
  let seed = 20261025;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const sessions = spxDates;
  const walk = (start) => { let value = start; return sessions.map(() => (value *= 1 + (rand() - 0.5) * 0.04)); };
  const maps = loadThemeMaps();
  const themeMaps = { usThemes: maps.usThemes.slice(0, 6), krThemeMap: {}, labels: maps.labels };
  const symbols = [...new Set(themeMaps.usThemes.flatMap((theme) => (theme.subThemes || []).flatMap((sub) => sub.tickers || [])))];
  const results = symbols.map((sym, i) => ({ sym, dates: sessions, adjCloses: walk(40 + (i % 17) * 7) }));
  const nowMs = Date.parse(`${sessions.at(-1)}T23:59:00Z`);
  const run = (input) => buildThemeStageBackfill({ results: input, themeMaps, history: rows, sessions: 40, nowMs }).history;
  const base = run(results);
  if (base.length < 10) fail(`theme-stage backfill produced ${base.length} rows on the synthetic panel — the perturbation check is not exercised`);
  const sampled = base.filter((_, i) => i % 8 === 0);
  backfillChecked = sampled.length;
  for (const row of sampled) {
    const cutAt = sessions.indexOf(row.date);
    const perturbed = results.map((item) => ({ ...item, adjCloses: item.adjCloses.map((value, i) => (i > cutAt ? value * (0.5 + rand()) : value)) }));
    if (!same(row, run(perturbed).find((item) => item.date === row.date))) fail(`theme-stage backfill row ${row.date} changes when closes after it change`);
  }
}

// 3. Warm-up sufficiency: today's market reading must not depend on history buckets older than the documented need — a
// 200-session average plus the 60-session latch and a 20-session slope, about 280 sessions, so 330 buckets with margin.
const WARMUP_ROWS = 330;
{
  const date = spxDates.at(-1);
  const full = axesOf(regimeAt(rows, macroHistory, date));
  const trimmed = axesOf(regimeAt(rows.slice(-WARMUP_ROWS), macroHistory, date));
  for (const axis of full) {
    const other = trimmed.find((item) => item.id === axis.id);
    if (!same(axis, other)) fail(`warm-up: ${axis.id} reads ${axis.state} on the full file but ${other?.state} with the last ${WARMUP_ROWS} buckets`);
  }
  // The HY 20-session record wants 252 changes plus its 60-session latch; until the macro file holds that many, its
  // threshold still moves as history accrues (recordMin keeps it usable). Reported, not failed.
  if (hyObs.length < 252 + 60 + 21) notes.push(`HY OAS record has ${hyObs.length} observations (< ${252 + 60 + 21}): its stress threshold still depends on how much history exists`);
}

for (const note of notes) console.log(`note: ${note}`);
if (failures.length) {
  console.error(`ci-lookahead-check: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`ci-lookahead-check: PASS — ${checkDates.length} sessions as-of invariant (credit evaluated on ${creditEvaluated}), ${backfillChecked} backfill sessions future-blind, warm-up ${WARMUP_ROWS} buckets sufficient`);
