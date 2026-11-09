// v59.59 (analysis/calculation logic refactor): reference values for the indicator, regime and portfolio math.
// Each case states its source: a published worked example, exact arithmetic on a hand-built input, or the definition
// the module's own comment names. A case fails with the input and the value that came back, so a regression names
// its formula. Pure module imports only — no fetch, no artifacts written.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)));
const failures = [];
let passed = 0;
const near = (actual, expected, tol) => typeof actual === 'number' && Math.abs(actual - expected) <= tol;
function check(name, ok, detail) {
  if (ok) passed += 1;
  else failures.push(`${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`);
}

// ── Technical definitions ──────────────────────────────────────────────────────────────────────────────────────────
{
  const { rsiWilder, smaSeries, smaLast, emaSeries, atrWilder } = await load('src/domain/technical/definitions.js');
  // Wilder RSI on the StockCharts "RSI" worked-example closes, exact arithmetic (the table there rounds its averages
  // to 2 decimals and prints 70.53; unrounded averages 3.34/14 and 1.40/14 give 70.46, TA-Lib's value).
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const expected = [70.46, 66.25, 66.48, 69.35, 66.29, 57.92];
  const got = expected.map((_, k) => Number(rsiWilder(closes.slice(0, 15 + k)).toFixed(2)));
  check('v59.59 RSI(14) Wilder worked example', got.every((value, k) => value === expected[k]), got);
  check('v59.59 RSI below period + 1 closes is null', rsiWilder(closes.slice(0, 14)) === null, rsiWilder(closes.slice(0, 14)));
  check('v59.59 RSI of a flat series is neutral 50, not 100', rsiWilder(Array(30).fill(10)) === 50, rsiWilder(Array(30).fill(10)));
  check('v59.59 RSI of a straight rise is 100', rsiWilder(Array.from({ length: 30 }, (_, i) => 10 + i)) === 100);
  check('v59.59 RSI of a straight fall is 0', rsiWilder(Array.from({ length: 30 }, (_, i) => 50 - i)) === 0);
  // The producer's screener rsi is the same number, rounded to one decimal.
  const { closesToFactors } = await load('src/domain/screener/price-factors.js');
  const long = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 4 + i * 0.1);
  check('v59.59 screener rsi = rsiWilder rounded', closesToFactors(long).rsi === Number(rsiWilder(long).toFixed(1)), [closesToFactors(long).rsi, rsiWilder(long)]);
  // SMA/EMA: a missing value inside the window is unknown, never 0.
  check('v59.59 SMA window with a gap is null', JSON.stringify(smaSeries([1, 2, null, 4, 5, 6], 2)) === JSON.stringify([null, 1.5, null, null, 4.5, 5.5]), smaSeries([1, 2, null, 4, 5, 6], 2));
  check('v59.59 SMA last with a gap is null', smaLast([1, 2, 3, null], 2) === null && smaLast([1, 2, 3, 4], 2) === 3.5);
  // EMA(3): seed = SMA of the first 3 (2), then k = 0.5 → 3, 4, 5.
  check('v59.59 EMA(3) seeded with the SMA', JSON.stringify(emaSeries([1, 2, 3, 4, 5, 6], 3)) === JSON.stringify([null, null, 2, 3, 4, 5]), emaSeries([1, 2, 3, 4, 5, 6], 3));
  // ATR(3) Wilder: TRs after the first bar 2, 3, 1, 4 → seed (2+3+1)/3 = 2, then (2·2 + 4)/3 = 8/3.
  const bars = [{ high: 11, low: 9, close: 10 }, { high: 12, low: 10, close: 11 }, { high: 13, low: 10, close: 12 }, { high: 12.5, low: 11.5, close: 12 }, { high: 15, low: 12, close: 14 }];
  const trs = [2, 3, 1, 3];
  const atrExpected = (((trs[0] + trs[1] + trs[2]) / 3) * 2 + trs[3]) / 3;
  check('v59.59 ATR(3) Wilder', near(atrWilder(bars, 3), atrExpected, 1e-12), atrWilder(bars, 3));
}

// ── Chart comparison returns ───────────────────────────────────────────────────────────────────────────────────────
{
  const { periodReturns, rebasedLine } = await load('src/domain/technical/chart-compare.js');
  const day = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  const bars = Array.from({ length: 23 }, (_, i) => ({ time: day(i), close: i === 10 ? null : 100 + i }));
  const returns = periodReturns(bars);
  const oneMonth = Object.entries(returns).find(([label]) => /1개월|1M/i.test(label))?.[1];
  // 21 sessions back from index 22 is index 1 (close 101): 122/101 − 1 = 20.79%, whatever bar 10 holds.
  check('v59.59 1-month return counts bars, not surviving closes', near(oneMonth, (122 / 101 - 1) * 100, 1e-9), returns);
  const other = bars.map((bar, i) => ({ time: bar.time, close: 50 + (i === 10 ? 0 : i * 0) + (i >= 12 ? 9 : 0) }));
  const line = rebasedLine(bars.map((bar) => ({ ...bar, close: bar.close ?? 110 })), other, 30);
  check('v59.59 rebased line end change is in %', near(line?.endPct, 18, 1e-9), line?.endPct);
}

// ── Rally attempt / follow-through day (O'Neil) ────────────────────────────────────────────────────────────────────
{
  const { rallyAttemptSeries, rallyAttemptRead } = await load('src/domain/market/regime/rally-attempt.js');
  const date = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  const bar = (close, i, volume = 1000) => ({ date: date(i), close, volume });
  // 70 flat sessions (window warm), slide to 90, FTD on day 5, rally to a new high (success), a second correction.
  const path1 = [...Array(70).fill(100), 97, 94, 92, 90, 90.5, 90.8, 91, 92.82, 95, 98, 101, 102, 99, 96, 95.5, 95, 95.4];
  const bars = path1.map((close, i) => bar(close, i, i === 77 ? 2000 : 1000));
  const series = rallyAttemptSeries(bars);
  check('v59.59 warm-up rows are marked', series[10].warmedUp === false && series[62].warmedUp === true, [series[10].warmedUp, series[62].warmedUp]);
  check('v59.59 FTD on day 5 at +2% on rising volume', series[77].followThrough && series[77].day === 5, series[77]);
  check('v59.59 new closing high ends the episode', series[80].phase === 0, series[80]);
  const history = series.map((point, i) => ({ date: bars[i].date, nasdaq: bars[i].close, rallyPhase: point.phase, rallyDay: point.day, followThroughDay: point.followThrough ? 1 : 0 }));
  const later = rallyAttemptRead(history);
  check('v59.59 a new correction after a successful FTD is an attempt', later?.phase === 'attempt', later);
  check('v59.59 a successful earlier FTD is not reported as failed', later && !/실패했습니다/.test(later.plain), later?.plain);
  // Failure path: the FTD is undercut — the next attempt names the failure.
  const path2 = [...Array(70).fill(100), 97, 94, 92, 90, 90.5, 90.8, 91, 92.82, 93, 89, 89.5];
  const bars2 = path2.map((close, i) => bar(close, i, i === 77 ? 2000 : 1000));
  const history2 = rallyAttemptSeries(bars2).map((point, i) => ({ date: bars2[i].date, nasdaq: bars2[i].close, rallyPhase: point.phase, rallyDay: point.day, followThroughDay: point.followThrough ? 1 : 0 }));
  const failed = rallyAttemptRead(history2);
  check('v59.59 an undercut FTD is reported as failed', failed?.phase === 'attempt' && /실패했습니다/.test(failed.plain), failed);
}

// ── Sentiment ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const { vixTermStructure } = await load('src/domain/market/sentiment/metrics.js');
  const term = vixTermStructure({ vix9d: 20, vix: 19, vix3m: 20, vix6m: null });
  check('v59.59 VIX term structure reads without the unused 6-month point', !term.blocked && term.frontInverted === true, term);
  check('v59.59 VIX term structure still blocks without the 3-month point', vixTermStructure({ vix9d: 20, vix: 19, vix3m: null, vix6m: 21 }).blocked === true);
}

// ── Trading score: a gated-out component does not move the total ───────────────────────────────────────────────────
{
  const { computeTradingScoreModel } = await load('src/domain/market/signal/trading-score.js');
  const base = { vix: 16, pcr: 0.8, hyBp: 320, dxy: 100, tnx: 4, spxPrice: 5000, spx50ma: 4900, spx200ma: 4500, breadth20: 80 };
  const gated = computeTradingScoreModel({ ...base, maCurrent: false, breadthAvailable: false });
  const fresh = computeTradingScoreModel({ ...base, maCurrent: true, breadthAvailable: true });
  check('v59.59 stale MA and unavailable breadth leave the total and the coverage', gated.total !== fresh.total && gated.componentCoveragePct === 60 && fresh.componentCoveragePct === 100,
    { gated: [gated.total, gated.componentCoveragePct, gated.componentMissing], fresh: [fresh.total, fresh.componentCoveragePct] });
}

// ── Macro ──────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const { buildLiquidityGrowthGroups } = await load('src/domain/macro/liquidity-growth.js');
  // Consumer sentiment rising 1 a month, ending 2026-05-01: "3개월" is Feb → May = +3.0 (92 days reached January, +4.0).
  const months = Array.from({ length: 12 }, (_, i) => [new Date(Date.UTC(2025, 5 + i, 1)).toISOString().slice(0, 10), 50 + i]);
  const groups = buildLiquidityGrowthGroups({ series: { consumerSentiment: { frequency: 'monthly', observations: months } } }, { referenceMs: Date.parse('2026-05-20T00:00:00Z') });
  const item = groups.flatMap((group) => group.items).find((row) => row.id === 'consumerSentiment');
  check('v59.59 monthly 3-month change compares with the month three back', /3개월 \+3(\.0)?$/.test(item?.changeText || ''), item?.changeText);
}

// ── Portfolio ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const { journalStats } = await load('src/domain/portfolio/trade-journal.js');
  const stats = journalStats([{ pnl: 0, pnlPct: 0, currency: 'USD', holdDays: 3 }, { pnl: 5, pnlPct: 5, currency: 'USD', holdDays: 4 }, { pnl: -4, pnlPct: -2, currency: 'USD', holdDays: 6 }]);
  check('v59.59 break-even lot is neither a win nor a loss', stats.wins === 1 && stats.losses === 1 && stats.flats === 1 && stats.avgLossPct === -2 && stats.payoff === 2.5, stats);
  const { _calcMaxDrawdown } = await load('src/domain/portfolio/return-stats.js');
  // One return stays null — the legacy contract (js/aio-tests.js T29) treats it as no sample, not a drawdown.
  check('v59.59 one return is no drawdown sample (T29 contract)', _calcMaxDrawdown([-0.5]) === null, _calcMaxDrawdown([-0.5]));
  // +10%, −20%, +5%: peak 1.10, trough 0.88 → 20%.
  check('v59.59 max drawdown peak to trough', near(_calcMaxDrawdown([0.1, -0.2, 0.05])?.mdd, 0.2, 1e-12), _calcMaxDrawdown([0.1, -0.2, 0.05]));
  const { stockBondCorrelation } = await load('src/domain/portfolio/asset-class.js');
  const eur = stockBondCorrelation({ historyMap: { TLT: {}, SPY: {} }, commonDates: ['2026-01-02'], bondWeights: { TLT: 1 }, stockWeights: { SPY: 1 }, baseCurrency: 'EUR', history: [] });
  check('v59.59 EUR base is unsupported, not a USD/KRW-inverted translation', eur.available === false && eur.reason === 'currency-unsupported', eur);
}

// ── Index earnings: revision coverage counts only members with revision counts ─────────────────────────────────────
{
  const { buildIndexEarnings } = await load('src/domain/market/indices/index-earnings.js');
  const asOf = '2026-11-01';
  const syms = Array.from({ length: 10 }, (_, i) => `S${i}`);
  const weights = { asOf, rows: syms.map((sym) => ({ sym, sector: 'IT', weight: 1 })) };
  const rows = Object.fromEntries(syms.map((sym, i) => [sym, { asOf, fwd: i < 2 ? { up4w: 3, down4w: 1, eps: 5 } : { eps: 5 } }]));
  const out = buildIndexEarnings({ rows: [], weights, consensus: { asOf, rows }, now: Date.parse('2026-11-02T00:00:00Z') });
  check('v59.59 revision breadth withheld when only 20% of weight has revision counts', out.available === false || (out.breadth == null && (out.coveragePct ?? 0) <= 20.0001), { breadth: out.breadth, coveragePct: out.coveragePct, members: out.members, reason: out.reason });
}


// ── One percentile convention (shared/percentile.js) ───────────────────────────────────────────────────────────────
{
  const { percentileOf } = await load('src/domain/shared/percentile.js');
  const sample = [1, 2, 3, 4, 5];
  check('v59.59 percentile: the sample high is 100, the low 0, the middle 50', percentileOf(sample, 5) === 100 && percentileOf(sample, 1) === 0 && percentileOf(sample, 3) === 50, [percentileOf(sample, 5), percentileOf(sample, 1), percentileOf(sample, 3)]);
  check('v59.59 percentile: ties count half among the others', percentileOf([1, 2, 2, 3], 2) === 50, percentileOf([1, 2, 2, 3], 2));
  check('v59.59 percentile: a value outside the sample ranks against all of it', percentileOf([1, 2, 3], 10) === 100 && percentileOf([1, 2, 3], 2.5) === (2 / 3) * 100);
  const { trailingRanks } = await load('src/domain/market/sentiment/market-temperature.js');
  const rising = Array.from({ length: 10 }, (_, i) => i);
  check('v59.59 temperature rank of a running high is 100 (was 95)', trailingRanks(rising, { window: 10, minSample: 10 }).at(-1) === 100, trailingRanks(rising, { window: 10, minSample: 10 }).at(-1));
}

// ── Portfolio FX ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const { krwTranslationPct } = await load('src/domain/portfolio/stress-sensitivity.js');
  // KRW book: 50% AAPL (USD) gains the +10% won move; 30% Toyota (JPY) and 20% Samsung (KRW) do not.
  const krw = krwTranslationPct({ weights: { AAPL: 0.5, '7203.T': 0.3, '005930.KS': 0.2 }, baseCurrency: 'KRW', shockPct: 10 });
  check('v59.59 won translation counts USD listings only in a KRW book', near(krw, 5, 1e-12), krw);
  const { appUsdKrwClose } = await load('src/domain/portfolio/cash.js');
  const fx = appUsdKrwClose([{ date: '2026-10-29', usdkrw: 1400 }, { date: '2026-10-30', usdkrw: 1414 }], { now: Date.parse('2026-10-31T00:00:00Z') });
  check('v59.59 app USD/KRW close carries the previous session', fx?.rate === 1414 && fx?.prevRate === 1400, fx);
  const { _calcCorrelationMatrix } = await load('src/domain/portfolio/return-stats.js');
  const m = _calcCorrelationMatrix({ A: [0.01, -0.02, 0.03, 0.01], B: [0, 0, 0, 0] });
  check('v59.59 a flat holding has no correlation cell (not 0)', m.matrix[0][1] === null && m.matrix[1][0] === null, m.matrix);
}

// ── Legacy snapshot reads the producer's VCP ───────────────────────────────────────────────────────────────────────
{
  const { _calcVCPServer } = await load('src/domain/screener/price-factors.js');
  const n = 260;
  const closes = Array.from({ length: n }, (_, i) => 50 + i * 0.2);
  const v = _calcVCPServer(closes, closes.map((c) => c * 1.01), closes.map((c) => c * 0.99), closes.map(() => 1e6));
  check('v59.59 producer VCP result carries the legacy fields', v && typeof v.stage2 === 'boolean' && Array.isArray(v.contractionDepths) && typeof v.nearPivot === 'boolean' && typeof v.breakout === 'boolean', v);
}


// ── Feature-audit hand-offs: Weinstein stage, growth-scare rates, one neutral real rate ────────────────────────────
{
  const { weinsteinStage } = await load('src/domain/technical/definitions.js');
  // 40 weeks rising 1/week, then a 4-week dip under the still-rising 30-week line.
  const weekly = [...Array.from({ length: 40 }, (_, i) => 100 + i), 128, 124, 122, 121];
  const w = weinsteinStage(weekly);
  check('v59.59 a close under a still-rising 30-week line is a stage-2 pullback, not stage 3', w?.stage === 2 && w.pullback === true && w.slope > 0, w);
  const { sepNeutral } = await load('src/domain/macro/taylor-rule.js');
  const { buildMacroRead } = await load('src/domain/macro/macro-read.js');
  const mh = { schemaVersion: 'macro-history.v1', series: { sepLongRunFedFunds: { observations: [[new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), 3.2]] } } };
  const policy = buildMacroRead({ macro: { fedTargetUpper: 6, fedTargetLower: 5.75, corePce: 2.5 }, macroHistory: mh }).axes.find((axis) => axis.id === 'policy');
  check('v59.59 the policy axis names the Taylor rule SEP neutral rate', sepNeutral(mh)?.rStar === 1.2 && /중립 수준\(약 1\.2%\)/.test(policy?.read || ''), policy?.read);
}

if (failures.length) {
  console.error(`[quant-reference] ${failures.length} failed, ${passed} passed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[quant-reference] ${passed} reference cases passed`);
