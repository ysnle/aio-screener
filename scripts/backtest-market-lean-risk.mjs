// Risk read of the 시장 기울기 condition count (measurement only, 2026-11-15). The direction test in
// scripts/backtest-market-lean.mjs failed; this asks whether the burdened-axis count describes the RANGE of the next
// month instead: deep drawdowns, realised volatility, the low tail. The daily axis states are that harness's
// `replayLean` (live buildMarketRegime, point in time) — reused, not copied; the bootstrap, split and non-overlap rules
// are its exports too. The criterion was written before the first run and is registered unchanged in
// architecture/validation-gate-criteria.json `marketLeanRisk`; scripts/build-validation-gates.mjs judges risk-result.json
// against it into model-validation-status.json `marketLean.risk` (review v60.19 A5), and the 시장 상태 fold states that verdict.
//
//   node scripts/backtest-market-lean-risk.mjs --out-dir=<dir> [--rows=<cache.json>]
// Writes <dir>/rows.json (when fetched), <dir>/readings.json and <dir>/risk-result.json. Runs weekly beside the direction
// backtest in .github/workflows/research-backtest.yml; promoting risk-result.json into public-data/market-lean-risk.json
// is a reviewed change, as for the direction study.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayLean, fetchInputs, nonOverlapping, blockBootstrap, loadCriteria, US_AXES, HISTORY_WINDOW } from './backtest-market-lean.mjs';
import { evidenceStrength } from '../src/domain/shared/evidence-strength.js';
import { MARKET_LEAN_VERSION, LEAN_RULES } from '../src/domain/market/regime/market-lean.js';

export const LEAN_RISK_VERSION = 'market-lean-risk.v1';
export const PRIMARY = Object.freeze({ horizon: 21, drawdownAt: -5, low: (b) => b === 0, high: (b) => b >= 2 });
const GROUPS = Object.freeze({ low: (b) => b === 0, mid: (b) => b === 1, high: (b) => b >= 2 });
const NET_GROUPS = Object.freeze({ 'net>=+1': (n) => n >= 1, 'net0': (n) => n === 0, 'net<=-1': (n) => n <= -1 });
const VIX_BANDS = Object.freeze([['<15', 0, 15], ['15-20', 15, 20], ['20-25', 20, 25], ['25-30', 25, 30], ['30+', 30, Infinity]]);

const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const median = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctile = (v, q) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

/** Forward outcomes at horizon h from the close of row i (reads rows after i only for the outcome). */
export function outcomes(rows, i, h) {
  if (i + h >= rows.length || !(rows[i].spx > 0)) return null;
  const base = rows[i].spx;
  let mdd = 0;
  const logs = [];
  for (let k = 1; k <= h; k += 1) {
    mdd = Math.min(mdd, rows[i + k].spx / base - 1);
    logs.push(Math.log(rows[i + k].spx / rows[i + k - 1].spx));
  }
  const m = mean(logs);
  const sd = Math.sqrt(logs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, logs.length - 1));
  return { ret: (rows[i + h].spx / base - 1) * 100, mdd: mdd * 100, rv: sd * Math.sqrt(252) * 100 };
}

const burdenCount = (states, axes = US_AXES) => axes.filter((id) => states[id] === 'burden').length;
const favourCount = (states) => US_AXES.filter((id) => states[id] === 'favorable').length;

/** Group summary over daily pairs; cases = greedy non-overlapping. */
function summarize(pairs, h) {
  const cases = nonOverlapping(pairs.map((p) => p.i), h).length;
  const ev = evidenceStrength(cases);
  return {
    days: pairs.length, cases, evidence: ev.tag,
    rvMedian: r2(median(pairs.map((p) => p.rv))),
    mddMedian: r2(median(pairs.map((p) => p.mdd))),
    pDD5: pairs.length ? r2(pairs.filter((p) => p.mdd <= -5).length / pairs.length * 100) : null,
    pDD8: pairs.length ? r2(pairs.filter((p) => p.mdd <= -8).length / pairs.length * 100) : null,
    ret5th: r2(pctile(pairs.map((p) => p.ret), 0.05)),
    retMean: r2(mean(pairs.map((p) => p.ret))),
    retMedian: r2(median(pairs.map((p) => p.ret)))
  };
}

/** P(mdd <= threshold | high) - P(... | low) over pairs, with `key` the grouping value on each pair. */
const diffStat = (key, high, low, at = PRIMARY.drawdownAt) => (pairs) => {
  const hi = pairs.filter((p) => high(p[key])), lo = pairs.filter((p) => low(p[key]));
  if (!hi.length || !lo.length) return null;
  const rate = (g) => g.filter((p) => p.mdd <= at).length / g.length * 100;
  return rate(hi) - rate(lo);
};

function groupTable(pairs, h, key, groups) {
  const out = { base: summarize(pairs, h) };
  for (const [name, test] of Object.entries(groups)) out[name] = summarize(pairs.filter((p) => test(p[key])), h);
  return out;
}

export function buildRiskStudy({ rows, readings, criteria = loadCriteria() }) {
  const interval = criteria.interval;
  const usable = readings.filter((r) => r.score != null);
  const pairsAt = (h) => usable.map((r) => {
    const o = outcomes(rows, r.i, h);
    if (!o) return null;
    const b = burdenCount(r.states);
    const extra = Object.fromEntries(US_AXES.map((id) => [`b_no_${id}`, burdenCount(r.states, US_AXES.filter((a) => a !== id))]));
    const vix = rows[r.i].vix;
    return { i: r.i, date: r.date, burden: b, net: favourCount(r.states) - b, vol: r.states.volatility || 'unknown',
      volBurden: r.states.volatility === 'burden' ? 1 : 0, otherBurden: burdenCount(r.states, US_AXES.filter((a) => a !== 'volatility')),
      vixBand: VIX_BANDS.find(([, lo, hi]) => vix >= lo && vix < hi)?.[0] || null, known: US_AXES.filter((id) => r.states[id] && r.states[id] !== 'unknown').length,
      ...extra, ...o };
  }).filter(Boolean);
  // The harness's split (buildLeanBacktest): held-out = last third of the 21-session readings.
  const judged = pairsAt(criteria.horizon);
  const splitAt = judged[Math.floor(judged.length * (1 - criteria.heldOutFraction))]?.i ?? Infinity;
  const embargo = criteria.embargoSessions;
  const inSampleIdx = judged.filter((p) => p.i < splitAt - embargo).map((p) => p.i);
  const midAt = inSampleIdx[Math.floor(inSampleIdx.length / 2)];
  const spans = {
    all: () => true,
    firstTwoThirds: (p, h) => p.i < splitAt - Math.max(h, embargo),
    halfA: (p, h) => p.i < midAt - Math.max(h, embargo),
    halfB: (p, h) => p.i >= midAt && p.i < splitAt - Math.max(h, embargo),
    heldOut: (p) => p.i >= splitAt
  };
  const primaryStat = diffStat('burden', PRIMARY.high, PRIMARY.low);
  const horizons = {};
  for (const h of [5, 21, 63]) {
    const pairs = pairsAt(h);
    const perSpan = {};
    for (const [name, test] of Object.entries(spans)) {
      const sp = pairs.filter((p) => test(p, h));
      const withCi = h === PRIMARY.horizon;
      perSpan[name] = {
        from: sp[0]?.date || null, to: sp.at(-1)?.date || null,
        burden: groupTable(sp, h, 'burden', GROUPS),
        net: groupTable(sp, h, 'net', NET_GROUPS),
        diffHighMinusLow: withCi ? blockBootstrap(sp, primaryStat, interval) : { point: r2(primaryStat(sp)) },
        diffHighMinusLowDD8: { point: r2(diffStat('burden', PRIMARY.high, PRIMARY.low, -8)(sp)) },
        diffRvMedian: r2((median(sp.filter((p) => p.burden >= 2).map((p) => p.rv)) ?? NaN) - (median(sp.filter((p) => p.burden === 0).map((p) => p.rv)) ?? NaN)),
        diffRetMean: r2((mean(sp.filter((p) => p.burden >= 2).map((p) => p.ret)) ?? NaN) - (mean(sp.filter((p) => p.burden === 0).map((p) => p.ret)) ?? NaN)),
        knownAxes: [...new Set(sp.map((p) => p.known))].sort()
      };
      if (withCi) {
        // Reference only: which axis carries it, and whether VIX alone does.
        perSpan[name].dropOne = Object.fromEntries(US_AXES.filter((id) => sp.some((p) => p[`b_no_${id}`] !== p.burden)).map((id) => {
          const st = diffStat(`b_no_${id}`, PRIMARY.high, PRIMARY.low);
          const hi = sp.filter((p) => p[`b_no_${id}`] >= 2), lo = sp.filter((p) => p[`b_no_${id}`] === 0);
          return [id, { point: r2(st(sp)), ci: name === 'heldOut' || name === 'all' ? blockBootstrap(sp, st, interval).ci : undefined,
            highCases: nonOverlapping(hi.map((p) => p.i), h).length, lowCases: nonOverlapping(lo.map((p) => p.i), h).length }];
        }));
        const volStat = diffStat('volBurden', (v) => v === 1, (v) => v === 0);
        perSpan[name].volatilityAxisAlone = { groups: groupTable(sp, h, 'vol', { burden: (v) => v === 'burden', neutral: (v) => v === 'neutral', favorable: (v) => v === 'favorable' }),
          diffBurdenMinusNot: name === 'heldOut' || name === 'all' ? blockBootstrap(sp, volStat, interval) : { point: r2(volStat(sp)) } };
        perSpan[name].vixBand = groupTable(sp, h, 'vixBand', Object.fromEntries(VIX_BANDS.map(([id]) => [id, (v) => v === id])));
        // Does the count add anything once the volatility axis is known? Non-volatility burdened count within each stratum.
        const strat = {};
        for (const [label, test] of [['volBurden', (p) => p.volBurden === 1], ['volNotBurden', (p) => p.volBurden === 0]]) {
          const s = sp.filter(test);
          strat[label] = { table: groupTable(s, h, 'otherBurden', { 'other0': (b) => b === 0, 'other1': (b) => b === 1, 'other2+': (b) => b >= 2 }),
            diff2plusMinus0: name === 'heldOut' || name === 'all' ? blockBootstrap(s, diffStat('otherBurden', (b) => b >= 2, (b) => b === 0), interval) : { point: r2(diffStat('otherBurden', (b) => b >= 2, (b) => b === 0)(s)) },
            diff1plusMinus0: { point: r2(diffStat('otherBurden', (b) => b >= 1, (b) => b === 0)(s)) } };
        }
        perSpan[name].withinVolatilityStrata = strat;
      }
    }
    horizons[`h${h}`] = perSpan;
  }
  const p21 = horizons.h21;
  const ho = p21.heldOut;
  const checks = {
    heldOutCases: { high: ho.burden.high.cases, low: ho.burden.low.cases, ok: ho.burden.high.cases >= 30 && ho.burden.low.cases >= 30 },
    heldOutLowerAboveZero: { ci: ho.diffHighMinusLow.ci, ok: !!ho.diffHighMinusLow.ci && ho.diffHighMinusLow.ci[0] > 0 },
    firstTwoThirdsPositive: { point: p21.firstTwoThirds.diffHighMinusLow.point, ok: p21.firstTwoThirds.diffHighMinusLow.point > 0 },
    halfAPositive: { point: p21.halfA.diffHighMinusLow.point, ok: p21.halfA.diffHighMinusLow.point > 0 },
    halfBPositive: { point: p21.halfB.diffHighMinusLow.point, ok: p21.halfB.diffHighMinusLow.point > 0 }
  };
  const latest = readings.at(-1);
  return {
    schemaVersion: LEAN_RISK_VERSION,
    generatedAt: new Date().toISOString(),
    criterion: 'architecture/validation-gate-criteria.json#marketLeanRisk (declared before the first run)',
    // Review v60.19 A5: what scripts/build-validation-gates.mjs checks against the registered criterion before judging.
    methodology: { ruleVersion: MARKET_LEAN_VERSION, leanRules: LEAN_RULES, interval, window: HISTORY_WINDOW,
      primary: { horizon: PRIMARY.horizon, drawdownPct: PRIMARY.drawdownAt, lowBurden: 0, highBurdenMin: 2 },
      split: { heldOutFraction: criteria.heldOutFraction, embargoSessions: embargo, heldOutFrom: rows[splitAt]?.date || null, halfBFrom: rows[midAt]?.date || null } },
    span: { from: usable[0]?.date, to: usable.at(-1)?.date, sessions: usable.length, heldOutFrom: rows[splitAt]?.date || null, halfBFrom: rows[midAt]?.date || null, window: HISTORY_WINDOW },
    latestReading: latest ? { date: latest.date, states: latest.states, burden: burdenCount(latest.states), favourable: favourCount(latest.states) } : null,
    verdict: { pass: Object.values(checks).every((c) => c.ok), checks },
    horizons
  };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const dir = arg('out-dir');
  if (!dir) { console.error('usage: node scripts/backtest-market-lean-risk.mjs --out-dir=<dir> [--rows=<cache.json>]'); process.exit(2); }
  const rowsFile = arg('rows') || path.join(dir, 'rows.json');
  let inputs;
  if (existsSync(rowsFile)) inputs = JSON.parse(readFileSync(rowsFile, 'utf8'));
  else { inputs = await fetchInputs(); writeFileSync(rowsFile, JSON.stringify(inputs)); }
  const readingsFile = path.join(dir, 'readings.json');
  let readings;
  if (existsSync(readingsFile)) readings = JSON.parse(readFileSync(readingsFile, 'utf8'));
  else { const t = Date.now(); readings = replayLean(inputs.rows, { hy: inputs.hy || [] }); writeFileSync(readingsFile, JSON.stringify(readings)); console.log(`replayed ${readings.length} sessions in ${Math.round((Date.now() - t) / 1000)}s`); }
  const result = buildRiskStudy({ rows: inputs.rows, readings });
  writeFileSync(path.join(dir, 'risk-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ span: result.span, latest: result.latestReading, verdict: result.verdict }, null, 2));
}
