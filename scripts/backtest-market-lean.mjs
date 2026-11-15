// Backtest of the 시장 기울기 lean rule itself (owner 2026-11-15: "no unvalidated score shown as a verdict").
//
// For every past US session the live functions are called on the history a reader had that day: buildMarketRegime
// (src/domain/briefing/market-read.js) on the trailing HISTORY_WINDOW rows — history.json keeps a rolling 420 rows, so
// every record, latch and one-year range sees the depth it has live — and buildMarketLean (market-lean.js) on that
// regime. The lean's rule output (us.score / us.ruleKey) is then compared with the S&P 500 return over the next 5, 21
// and 63 sessions: by label, with non-overlapping cases, the hit rate beside the base rate, the median, and the
// buy-lean and defend-lean mean against the all-session mean with a moving-block bootstrap interval, in-sample vs the
// held-out last third. The pass criterion is architecture/validation-gate-criteria.json `marketLean` (declared before
// the first run); scripts/build-validation-gates.mjs judges this file against it.
//
// Axes. The six US axes are reconstructed only from free daily histories:
//   trend (S&P 500, Nasdaq-100, Russell 2000, SOXX), volatility (VIX, 3-month VIX), rates (10-year yield),
//   commodities (WTI, dollar index, gold) — Yahoo Finance daily closes, the source the long-run score backtest uses;
//   credit — FRED ICE BofA HY OAS, which FRED serves for the last three years only: known on those sessions, unknown
//     before, each observation used from the session after its date (it publishes the next morning);
//   breadth — no free point-in-time history of S&P 500 members above their averages: unknown on every session.
// An axis without data is 'unknown' in the live regime, which leaves it out of both sides of the count (never held at
// a neutral constant). The rule needs 4 known axes to give a count at all (MIN_KNOWN_AXES), so before 2023-11 the
// count is over four axes, after it over five.
// The lean's frequency items (VIX band, price temperature) are not passed: the VIX band never votes, and on the
// published record no temperature frequency clears its vote gate, so the count is the only vote the live card casts.
//
//   node scripts/backtest-market-lean.mjs [--out=<file>] [--rows=<cache.json>] [--write-rows=<cache.json>] [--from=YYYY-MM-DD]
// Network (Yahoo chart API, FRED CSV) unless --rows is given. A producer: it runs in .github/workflows/research-backtest.yml,
// and promoting its output into public-data/market-lean-backtest.json is a reviewed change.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMarketRegime } from '../src/domain/briefing/market-read.js';
import { buildMarketLean, MARKET_LEAN_VERSION, LEAN_RULES } from '../src/domain/market/regime/market-lean.js';
import { evidenceStrength } from '../src/domain/shared/evidence-strength.js';
import { isIsoDay } from '../src/domain/shared/session-date.js';
import { nonOverlappingCount } from './lib/rank-statistics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LEAN_BACKTEST_VERSION = 'market-lean-backtest.v1';
export const HISTORY_WINDOW = 420; // scripts/producer/history.mjs keeps 420 rows
export const HORIZONS = [5, 21, 63];
export const US_AXES = ['trend', 'breadth', 'volatility', 'rates', 'credit', 'commodities'];
export const YAHOO_FIELDS = Object.freeze({ spx: '^GSPC', nasdaq: '^IXIC', ndx: '^NDX', rut: '^RUT', vix: '^VIX', vix3m: '^VIX3M', tnx: '^TNX', dxy: 'DX-Y.NYB', wti: 'CL=F', gold: 'GC=F', soxx: 'SOXX' });
// The first session every Yahoo field has a close (3-month VIX starts 2006-07-17); cases start HISTORY_WINDOW rows later.
export const REQUIRED_FIELDS = Object.keys(YAHOO_FIELDS);
const AXES_MISSING = Object.freeze({
  breadth: 'S&P 500 구성 종목의 이동평균 위 비율은 무료 시점별 기록이 없음',
  credit: 'FRED가 ICE BofA 하이일드 스프레드를 최근 3년만 제공 — 그 기간에만 판정에 들어감'
});

export function loadCriteria() {
  return JSON.parse(readFileSync(path.join(ROOT, 'architecture/validation-gate-criteria.json'), 'utf8')).marketLean;
}

async function fetchYahoo(symbol) {
  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=0&period2=${Math.floor(Date.now() / 1000)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const result = (await res.json())?.chart?.result?.[0];
      const out = new Map();
      (result?.timestamp || []).forEach((ts, i) => {
        const close = result.indicators?.quote?.[0]?.close?.[i];
        if (Number.isFinite(close)) out.set(new Date(ts * 1000).toISOString().slice(0, 10), close);
      });
      if (out.size) return out;
    } catch { /* next host */ }
  }
  return new Map();
}

async function fetchFredHy() {
  try {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    return (await res.text()).trim().split('\n').slice(1).map((line) => line.split(','))
      .map(([date, value]) => [date, Number(value)]).filter(([date, value]) => isIsoDay(date) &&Number.isFinite(value));
  } catch { return []; }
}

/** Session rows from per-field date maps: S&P 500 sessions from the first one where every required field has a close. */
export function mergeRows(series, required = REQUIRED_FIELDS) {
  const dates = [...(series.spx?.keys() || [])].sort();
  const rows = dates.map((date) => {
    const row = { date };
    for (const [field, map] of Object.entries(series)) { const value = map.get(date); if (Number.isFinite(value)) row[field] = value; }
    return row;
  });
  const start = rows.findIndex((row) => required.every((field) => Number.isFinite(row[field])));
  return start < 0 ? [] : rows.slice(start);
}

export async function fetchInputs() {
  const entries = await Promise.all(Object.entries(YAHOO_FIELDS).map(async ([field, symbol]) => [field, await fetchYahoo(symbol)]));
  const series = Object.fromEntries(entries);
  const missing = Object.entries(series).filter(([, map]) => !map.size).map(([field]) => field);
  if (missing.length) throw new Error(`no history for ${missing.join(', ')}`);
  return { rows: mergeRows(series), hy: await fetchFredHy() };
}

/**
 * One reading per session: the live regime on the trailing window, the lean on that regime. `hy` is [[date, pct]];
 * an observation enters from the session after its date. Rows after index i are never read for the reading at i.
 */
export function replayLean(rows, { hy = [], window = HISTORY_WINDOW, start = window - 1, end = rows.length } = {}) {
  const out = [];
  let h = 0;
  for (let i = Math.max(0, start); i < end; i += 1) {
    const date = rows[i].date;
    while (h < hy.length && hy[h][0] < date) h += 1;
    const macroHistory = h > 0 ? { series: { hyOas: { observations: hy.slice(Math.max(0, h - 400), h) } } } : null;
    const history = rows.slice(Math.max(0, i - window + 1), i + 1);
    const regime = buildMarketRegime({ history, credit: {}, rates: {}, macroHistory, now: Date.parse(`${date}T22:00:00Z`) });
    const lean = buildMarketLean({ regime: regime.available ? regime : null });
    const states = Object.fromEntries((regime.axes || []).filter((axis) => US_AXES.includes(axis.id)).map((axis) => [axis.id, axis.state]));
    out.push({ i, date, score: lean.us.available ? lean.us.score : null, ruleKey: lean.us.available ? lean.us.ruleKey : null,
      counts: regime.counts || null, sufficient: regime.sufficient === true, states });
  }
  return out;
}

export const forwardReturn = (rows, i, h) => (i + h < rows.length && rows[i].spx > 0 ? (rows[i + h].spx / rows[i].spx - 1) * 100 : null);

/** Greedy non-overlapping positions: each kept one at or after the previous kept one + h. */
export function nonOverlapping(positions, h) {
  const kept = [];
  let next = -Infinity;
  for (const position of positions) if (position >= next) { kept.push(position); next = position + h; }
  return kept;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mean = (values) => values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
const median = (values) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] : null;
const r2 = (value) => (value == null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100);

export const DIRECTION_GROUPS = Object.freeze({ buy: (s) => s > 0, neutral: (s) => s === 0, defend: (s) => s < 0 });
const STRENGTH_KEYS = ['2', '1', '0', '-1', '-2'];

/**
 * Moving-block bootstrap of a statistic over daily (score, fwd) pairs in session order: blocks of `blockSessions`
 * consecutive pairs with uniform starts, concatenated to the sample length. Resamples where the statistic is undefined
 * (a group absent) are dropped and counted.
 */
export function blockBootstrap(pairs, stat, { blockSessions, resamples, seed, level }) {
  const n = pairs.length;
  const point = stat(pairs);
  if (point == null || n < blockSessions) return { point: r2(point), ci: null, used: 0 };
  const rand = mulberry32(seed);
  const draws = [];
  for (let r = 0; r < resamples; r += 1) {
    const sample = [];
    while (sample.length < n) { const from = Math.floor(rand() * (n - blockSessions + 1)); for (let k = 0; k < blockSessions && sample.length < n; k += 1) sample.push(pairs[from + k]); }
    const value = stat(sample);
    if (value != null && Number.isFinite(value)) draws.push(value);
  }
  draws.sort((a, b) => a - b);
  const tail = (1 - level) / 2;
  return { point: r2(point), ci: draws.length ? [r2(quantile(draws, tail)), r2(quantile(draws, 1 - tail))] : null, used: draws.length };
}

const vsAll = (test) => (pairs) => { const g = pairs.filter((p) => test(p.score)).map((p) => p.fwd); return g.length ? mean(g) - mean(pairs.map((p) => p.fwd)) : null; };
const spread = (pairs) => { const b = pairs.filter((p) => p.score > 0).map((p) => p.fwd), d = pairs.filter((p) => p.score < 0).map((p) => p.fwd); return b.length && d.length ? mean(b) - mean(d) : null; };

/** Label statistics over one span of daily pairs { i, score, fwd } at horizon h. */
export function spanStats(pairs, h, interval) {
  const group = (test) => {
    const days = pairs.filter((p) => test(p.score));
    const caseIdx = nonOverlapping(days.map((p) => p.i), h);
    const byI = new Map(days.map((p) => [p.i, p.fwd]));
    const cases = caseIdx.map((i) => byI.get(i));
    const ev = evidenceStrength(cases.length);
    return { days: days.length, cases: cases.length, effectiveN: nonOverlappingCount(days.map((p) => p.i), h), evidence: ev.tag, level: ev.level,
      hitRate: ev.figures ? r2(cases.filter((v) => v > 0).length / cases.length * 100) : null,
      median: ev.figures ? r2(median(cases)) : null, mean: ev.figures ? r2(mean(cases)) : null, dailyMean: r2(mean(days.map((p) => p.fwd))) };
  };
  const all = group(() => true);
  const out = { from: pairs[0]?.date || null, to: pairs.at(-1)?.date || null, base: all, labels: {} };
  for (const [name, test] of Object.entries(DIRECTION_GROUPS)) out.labels[name] = group(test);
  for (const key of STRENGTH_KEYS) out.labels[key] = group((s) => String(s) === key);
  if (interval) {
    out.labels.buy.vsAll = blockBootstrap(pairs, vsAll(DIRECTION_GROUPS.buy), interval);
    out.labels.defend.vsAll = blockBootstrap(pairs, vsAll(DIRECTION_GROUPS.defend), interval);
    out.spreadBuyMinusDefend = blockBootstrap(pairs, spread, interval);
  }
  return out;
}

/** The whole study from session rows and HY observations (pure apart from the clock). */
export function buildLeanBacktest({ rows, hy = [], criteria = loadCriteria(), nowIso = new Date().toISOString(), window = HISTORY_WINDOW, from = null } = {}) {
  const startIndex = Math.max(window - 1, from ? rows.findIndex((row) => row.date >= from) : 0);
  const readings = replayLean(rows, { hy, window, start: startIndex });
  const usable = readings.filter((r) => r.score != null);
  const coverage = Object.fromEntries(US_AXES.map((id) => {
    const known = readings.filter((r) => r.states[id] && r.states[id] !== 'unknown').length;
    return [id, { knownSessions: known, share: readings.length ? r2(known / readings.length) : 0, from: readings.find((r) => r.states[id] && r.states[id] !== 'unknown')?.date || null }];
  }));
  // An axis counts as reconstructed when it is known on at least 90% of the replayed sessions.
  const axesReconstructed = US_AXES.filter((id) => coverage[id].share >= 0.9);
  const axesMissing = US_AXES.filter((id) => !axesReconstructed.includes(id)).map((id) => ({ id, knownShare: coverage[id].share, knownFrom: coverage[id].from, why: AXES_MISSING[id] || '기록 부족' }));
  const interval = criteria.interval;
  const pairsAt = (h) => usable.map((r) => ({ i: r.i, date: r.date, score: r.score, fwd: forwardReturn(rows, r.i, h) })).filter((p) => p.fwd != null);
  const judged = pairsAt(criteria.horizon);
  const splitAt = judged[Math.floor(judged.length * (1 - criteria.heldOutFraction))]?.i ?? Infinity;
  const horizons = {};
  for (const h of HORIZONS) {
    const pairs = pairsAt(h);
    const embargo = Math.max(h, criteria.embargoSessions);
    horizons[`h${h}`] = {
      all: spanStats(pairs, h, h === criteria.horizon ? interval : null),
      // In-sample windows end before the held-out part starts (an embargo of one horizon, or the criterion's if longer).
      inSample: spanStats(pairs.filter((p) => p.i < splitAt - embargo), h, h === criteria.horizon ? interval : null),
      heldOut: spanStats(pairs.filter((p) => p.i >= splitAt), h, h === criteria.horizon ? interval : null)
    };
  }
  const tally = (list) => list.reduce((acc, r) => { const k = String(r.score); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return {
    schemaVersion: LEAN_BACKTEST_VERSION,
    generatedAt: nowIso,
    methodology: {
      ruleVersion: MARKET_LEAN_VERSION, leanRules: LEAN_RULES, ruleTested: 'us.score of buildMarketLean on buildMarketRegime (live functions, condition-count vote only)',
      pointInTime: `trailing ${window} session rows per reading (history.json depth); HY OAS from the session after its date`,
      sources: { yahoo: YAHOO_FIELDS, fred: 'BAMLH0A0HYM2' }, outcome: 'S&P 500 price return (no dividends), close to close',
      axesReconstructed, axesMissing, axisCoverage: coverage, frequencyItems: 'not passed (VIX band never votes; no published temperature frequency clears its vote gate)',
      nonOverlap: 'greedy per label: a case at or after the previous case + horizon', criteria: 'architecture/validation-gate-criteria.json#marketLean', interval,
      split: { heldOutFraction: criteria.heldOutFraction, heldOutFrom: rows[splitAt]?.date || null, embargoSessions: criteria.embargoSessions }
    },
    span: { from: readings[0]?.date || null, to: readings.at(-1)?.date || null, sessions: readings.length, sufficientSessions: usable.length, scoreDays: tally(usable) },
    horizons
  };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const out = arg('out');
  if (!out) { console.error('usage: node scripts/backtest-market-lean.mjs --out=<file> [--rows=<cache>] [--write-rows=<cache>] [--from=YYYY-MM-DD]'); process.exit(2); }
  const inputs = arg('rows') ? JSON.parse(readFileSync(arg('rows'), 'utf8')) : await fetchInputs();
  if (arg('write-rows')) writeFileSync(arg('write-rows'), JSON.stringify(inputs));
  const started = Date.now();
  const result = buildLeanBacktest({ rows: inputs.rows, hy: inputs.hy || [], from: arg('from') });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  const h = result.horizons[`h${loadCriteria().horizon}`];
  console.log(`market lean backtest: ${result.span.from}~${result.span.to}, ${result.span.sufficientSessions} sessions, axes ${result.methodology.axesReconstructed.join('/')}, held-out from ${result.methodology.split.heldOutFrom}; buy cases ${h.heldOut.labels.buy.cases} vsAll ${JSON.stringify(h.heldOut.labels.buy.vsAll)}; defend cases ${h.heldOut.labels.defend.cases} vsAll ${JSON.stringify(h.heldOut.labels.defend.vsAll)} (${Math.round((Date.now() - started) / 1000)}s) → ${out}`);
}
