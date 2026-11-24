// Deterministic checks for the long-run factor backtest's HAC inference and the external
// momentum benchmark (scripts/lib/research-validation.mjs). Offline fixtures only — the real run is
// .github/workflows/research-backtest.yml.
import { deflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { hacLagFor, neweyWestMeanStats, extractFirstZipEntry, parseFrenchDailyFactorCsv, compoundWindow, compareWithExternalFactor } from './lib/research-validation.mjs';
import { backtestFactors } from './lib/factors.mjs';
import { spearmanWithEffectiveCI, nonOverlappingCount } from './lib/rank-statistics.mjs';
import { selectTopByMarketCap } from './backtest-factors-longrun.mjs';
import { runSections } from './lib/gate-sections.mjs';

const errors = [];
const check = (label, ok, detail) => { if (!ok) errors.push(label + (detail ? ': ' + JSON.stringify(detail) : '')); };
const report = () => {
  const failed = errors.splice(0);
  if (!failed.length) return;
  console.error('research-validation check failed:\n- ' + failed.join('\n- '));
  process.exit(1);
};

// The statistics run on fixtures (code); whether the committed screener carries enough US rows for the long-run
// job is a data section that also runs in a data run.
await runSections('research-validation', [
['statistics', async () => {

// Lag rule: overlap of 63-day windows sampled every 21 days is 2; rule of thumb for n=114 is 4.
check('v58.83 HAC lag covers window overlap and the Newey-West plug-in rule', hacLagFor(114, 63, 21) === 4 && hacLagFor(10, 63, 21) === 2 && hacLagFor(114, 21, 21) === 4 && hacLagFor(3, 63, 21) === 1, [hacLagFor(114, 63, 21), hacLagFor(10, 63, 21), hacLagFor(3, 63, 21)]);

// A deterministic positively autocorrelated series (AR(1), phi 0.8) must widen the HAC error versus lag 0.
let state = 0, seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const ar = Array.from({ length: 200 }, () => (state = 0.8 * state + rand()) + 0.05);
const lag0 = neweyWestMeanStats(ar, 0), lagged = neweyWestMeanStats(ar, hacLagFor(200, 63, 21));
check('v58.83 HAC standard error widens on positively autocorrelated observations', lagged.hacSe > lag0.hacSe * 1.5 && Math.abs(lagged.hacTStat) < Math.abs(lag0.hacTStat), { lag0, lagged });
const iid = Array.from({ length: 200 }, () => rand());
const naiveSe = Math.sqrt(iid.reduce((s, v, _, a) => s + (v - a.reduce((x, y) => x + y, 0) / a.length) ** 2, 0) / (iid.length - 1) / iid.length);
check('v58.83 lag-0 HAC equals the iid standard error up to the n/(n-1) factor', Math.abs(neweyWestMeanStats(iid, 0).hacSe - naiveSe * Math.sqrt(199 / 200)) < 1e-4);
check('v58.83 HAC fails closed below three observations', neweyWestMeanStats([0.1, null, 0.2], 1).inference === 'insufficient-observations');

// Data Library layout: prose header, ",Mom" header row, YYYYMMDD rows in percent, copyright footer.
const csv = 'This file was created by CMPT_ME_PRIOR_RETS_DAILY.\r\nMissing data are indicated by -99.99 or -999.\r\n\r\n,Mom   \r\n20240102,   1.00\r\n20240103,  -0.50\r\n20240104, -99.99\r\n20240105,   2.00\r\n20240108,   0.10\r\n\r\nCopyright 2024 Kenneth R. French\r\n';
const name = Buffer.from('F-F_Momentum_Factor_daily.CSV');
const body = deflateRawSync(Buffer.from(csv, 'latin1'));
const header = Buffer.alloc(30);
header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6); header.writeUInt16LE(8, 8);
header.writeUInt32LE(body.length, 18); header.writeUInt32LE(csv.length, 22); header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28);
const zip = Buffer.concat([header, name, body]);
const parsed = parseFrenchDailyFactorCsv(extractFirstZipEntry(zip));
// Same entry written with a data descriptor (sizes zeroed locally) plus central directory + EOCD.
const ddHeader = Buffer.from(header); ddHeader.writeUInt16LE(0x8, 6); ddHeader.writeUInt32LE(0, 18); ddHeader.writeUInt32LE(0, 22);
const local = Buffer.concat([ddHeader, name, body, Buffer.alloc(16)]);
const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(csv.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + name.length, 12); eocd.writeUInt32LE(local.length, 16);
const ddParsed = parseFrenchDailyFactorCsv(extractFirstZipEntry(Buffer.concat([local, central, name, eocd])));
check('v58.83 zip written with a data descriptor reads through the central directory', ddParsed.dates.join() === parsed.dates.join(), ddParsed);
check('v58.83 zip entry inflates and the daily table parses with missing markers kept as null days', parsed.dates.join() === '2024-01-02,2024-01-03,2024-01-04,2024-01-05,2024-01-08' && parsed.returns[0] === 0.01 && parsed.returns[1] === -0.005 && parsed.returns[2] === null, parsed);
let rejected = false;
try { extractFirstZipEntry(Buffer.from('not a zip at all, just text....')); } catch { rejected = true; }
check('v58.83 non-zip payload fails closed', rejected);

// Window = days strictly after the rebalance close through the forward close.
const w = compoundWindow(parsed, '2024-01-02', '2024-01-03');
check('v58.83 factor compounds over (rebalance, forward] only', Math.abs(w - -0.005) < 1e-12 && Math.abs(compoundWindow(parsed, '2024-01-04', '2024-01-08') - (1.02 * 1.001 - 1)) < 1e-12, w);
check('v58.83 a window spanning a missing factor day is excluded, not compounded as 0%', compoundWindow(parsed, '2024-01-03', '2024-01-05') === null && compoundWindow(parsed, '2024-01-02', '2024-01-08') === null);
check('v58.83 uncovered window returns null', compoundWindow(parsed, '2023-12-01', '2024-01-05') === null && compoundWindow(parsed, '2024-01-03', '2024-02-01') === null);

// Comparison verdicts against a synthetic factor series.
const days = Array.from({ length: 900 }, (_, i) => new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10));
const ext = { dates: days, returns: days.map((_, i) => Math.sin(i / 3) / 100) };
const windows = [];
for (let i = 0; i + 10 < days.length; i += 10) windows.push({ rebalanceDate: days[i], forwardDate: days[i + 10], spread: compoundWindow(ext, days[i], days[i + 10]) * 2 + 0.001 });
const agree = compareWithExternalFactor(windows, ext);
const against = compareWithExternalFactor(windows.map((x) => ({ ...x, spread: -x.spread })), ext);
const few = compareWithExternalFactor(windows.slice(0, 20), ext);
check('v58.83 pre-registered verdicts: agreement PASS, opposite FAIL, short sample INSUFFICIENT', agree.status === 'PASS' && agree.pearsonR > 0.99 && against.status === 'FAIL' && few.status === 'INSUFFICIENT' && agree.criterion.minWindows === 60, { agree, against: against.status, few: few.status });

// backtestFactors exposes dated per-factor spreads only when asked, leaving the default output unchanged.
const btDays = Array.from({ length: 330 }, (_, i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10));
const stocks = Array.from({ length: 15 }, (_, k) => {
  const closes = btDays.map((_, i) => 100 * Math.exp((k - 7) * 0.001 * i + 0.01 * Math.sin(i / 5 + k)));
  return { sym: 'T' + k, dates: btDays, closes, adjCloses: closes, volumes: btDays.map(() => 1e6) };
});
const plain = backtestFactors(stocks, { offsets: [42, 21], fwdDays: 21 });
const withSpreads = backtestFactors(stocks, { offsets: [42, 21], fwdDays: 21, factorSpreads: true });
const mom = withSpreads.factorSpreadByDate && withSpreads.factorSpreadByDate.momentum;
check('v58.83 per-factor spreads are opt-in', !('factorSpreadByDate' in plain) && Array.isArray(mom) && mom.length === 2, { plainKeys: 'factorSpreadByDate' in plain, mom });
check('v58.83 each momentum window carries its rebalance and T+21 forward date', Array.isArray(mom) && mom.every((x) => x.forwardDate === btDays[btDays.indexOf(x.rebalanceDate) + 21] && Number.isFinite(x.spread)), mom);
check('v58.83 opt-in spreads do not change the default statistics', JSON.stringify(plain.ic) === JSON.stringify(withSpreads.ic) && plain.quantileSpread === withSpreads.quantileSpread);

const universeRows = [{ sym: 'AAA' }, { sym: 'BBB' }, { sym: '005930.KS' }, { sym: 'CCC' }, { sym: 'DDD' }];
const screenerData = { AAA: { valuationPrice: 10, valuationSharesOutstanding: 100 }, BBB: { valuationPrice: 50, valuationSharesOutstanding: 100 }, '005930.KS': { valuationPrice: 1e5, valuationSharesOutstanding: 1e9 }, CCC: { valuationPrice: 20 }, DDD: { valuationPrice: 30, valuationSharesOutstanding: 100 } };
const top = selectTopByMarketCap(universeRows, screenerData, 2);
check('v58.83 long-run universe ranks US rows by price × shares and skips KR or incomplete rows', top.map((r) => r.sym).join() === 'BBB,DDD' && top[0].mcap === 5000, top);

// IC per market. US momentum persists, KR momentum reverses every 60 sessions; the pooled IC hides both.
{
  const days = [];
  for (let d = Date.UTC(2025, 0, 1); days.length < 330; d += 86400000) { if (![0, 6].includes(new Date(d).getUTCDay())) days.push(new Date(d).toISOString().slice(0, 10)); }
  let s = 7;
  const noise = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; };
  const make = (sym, drift, flip) => {
    let price = 100;
    const closes = days.map((_, i) => (price *= 1 + (flip ? drift * (Math.floor(i / 60) % 2 === 0 ? 1 : -1) : drift) + noise() * 0.004));
    return { sym, dates: days, closes, adjCloses: closes, adjustedCloseStatus: 'complete' };
  };
  const us = Array.from({ length: 40 }, (_, i) => make('U' + i, (i - 20) * 0.0002, false));
  const kr = Array.from({ length: 30 }, (_, i) => make('K' + i + '.KS', (i - 15) * 0.0003, true));
  const opts = { offsets: [105, 84, 63, 42], fwdDays: 21 };
  const pooled = backtestFactors([...us, ...kr], opts);
  const usOnly = backtestFactors(us, opts);
  check('v60.16 a two-market backtest labels its IC as pooled and reports each market', pooled.icBasis === 'pooled-markets' && pooled.icMarkets.join() === 'US,KR'
    && pooled.icByMarket.US.dates.length === 4 && pooled.icByMarket.KR.icByDate.composite.length === 4, { basis: pooled.icBasis, markets: pooled.icMarkets });
  check('v60.16 the per-market IC is the IC of that market alone (US 0.99 and KR -0.8 momentum, not the pooled 0.6)', JSON.stringify(pooled.icByMarket.US.ic) === JSON.stringify(usOnly.ic)
    && pooled.icByMarket.US.ic.momentum > 0.9 && pooled.icByMarket.KR.ic.momentum < -0.5 && pooled.ic.momentum > pooled.icByMarket.KR.ic.momentum && pooled.ic.momentum < pooled.icByMarket.US.ic.momentum,
    { pooled: pooled.ic.momentum, us: pooled.icByMarket.US.ic, kr: pooled.icByMarket.KR.ic, usOnly: usOnly.ic });
  check('v60.16 a single-market backtest is not labelled pooled', usOnly.icBasis === 'single-market' && usOnly.icMarkets.join() === 'US');
  check('v60.16 the backtest reports the one-session execution lag beside the same-close figures', usOnly.executionLag.sessions === 1 && usOnly.executionLag.dates === 4
    && Number.isFinite(usOnly.executionLag.icComposite) && Number.isFinite(usOnly.executionLag.quantileSpread) && usOnly.executionLag.quantileSpread !== usOnly.quantileSpread, usOnly.executionLag);
}

// Intervals of a rank correlation on overlapping forward windows use the non-overlapping count.
{
  const n = 630;
  let s = 11;
  const noise = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const daily = Array.from({ length: n + 21 }, () => noise());
  let level = 0;
  const score = Array.from({ length: n }, () => (level = 0.97 * level + noise()));
  const pairs = score.map((value, i) => [value, daily.slice(i + 1, i + 22).reduce((sum, r) => sum + r, 0) + value * 0.15, i]);
  const eff = spearmanWithEffectiveCI(pairs, 21);
  const width = (ci) => ci[1] - ci[0];
  check('v60.16 the interval of a 21-session forward correlation rests on n/21 windows, not on the row count', eff.n === n && eff.nEff === 30 && width(eff.ci95) > width(eff.ci95NaiveIid) * 3
    && eff.hac && width(eff.hac.hacCi95) > width(eff.ci95NaiveIid) && eff.hac.lags >= 20, eff);
  check('v60.16 a subset with gaps counts its own non-overlapping windows and carries no HAC interval', nonOverlappingCount([0, 5, 21, 30, 42, 300], 21) === 4
    && spearmanWithEffectiveCI(pairs.filter((_, i) => i % 3 === 0), 21).hac === null && spearmanWithEffectiveCI(pairs.filter((_, i) => i % 3 === 0), 21).nEff === 30);
  check('v60.16 one-session horizons keep the plain Fisher interval', JSON.stringify(spearmanWithEffectiveCI(pairs, 1).ci95) === JSON.stringify(spearmanWithEffectiveCI(pairs, 1).ci95NaiveIid));
}

// The validation view reads the US-only IC series when the record carries it, names the pooled one otherwise,
// and dates the gate by its evidence (the long-run study), not by the day the judgement was recomputed.
{
  const { readValidationState } = await import('../src/ui/components/screener-validation.js');
  const { longrunStudyAge, LONGRUN_STALE_AFTER_DAYS } = await import('./backtest-factors-longrun.mjs');
  const dates = ['2026-08-17', '2026-09-16'];
  const backtest = { rebalanceDates: dates, rebalancesCounted: 2, quantileSpreadNet: -0.3, netHitRate: 50, icByDate: { composite: [0.05, 0.07] }, icCompositeDates: dates };
  const gate = JSON.parse(await readFile(new URL('../public-data/screener-validation-gate.json', import.meta.url), 'utf8'));
  const root = { _aioScreenerValidationGate: gate };
  const pooledRead = readValidationState({ metadata: { backtest }, root });
  const marketRead = readValidationState({ metadata: { backtest: { ...backtest, icBasis: 'pooled-markets', icByMarket: { US: { dates, icByDate: { composite: [0.11, -0.02] } }, KR: { dates, icByDate: { composite: [-0.2, 0.3] } } } } }, root });
  check('v60.16 the per-date IC of the US view is the US-only series when present, and the pooled series is named as pooled', marketRead.icScope === '미국 종목만' && marketRead.points.map((p) => p.ic).join() === '0.11,-0.02'
    && pooledRead.icScope === '미국·한국 합산' && pooledRead.points.map((p) => p.ic).join() === '0.05,0.07', { market: marketRead.points, pooled: pooledRead.points });
  check('v60.16 the validation gate is dated by its evidence study', pooledRead.gateEvidenceAt === String(gate.evidenceGeneratedAt).slice(0, 10) && pooledRead.gateObservedAt === String(gate.observedAt).slice(0, 10), { evidence: pooledRead.gateEvidenceAt, judged: pooledRead.gateObservedAt });
  const study = JSON.parse(await readFile(new URL('../public-data/factor-backtest-longrun.json', import.meta.url), 'utf8'));
  const at = Date.parse(study.generatedAt);
  check('v60.16 the long-run study states its age against the 120-day window', LONGRUN_STALE_AFTER_DAYS === 120 && longrunStudyAge(study, at + 119 * 86400000).stale === false
    && longrunStudyAge(study, at + 121 * 86400000).stale === true && longrunStudyAge({}, at).stale === true);
}

const longrun = await readFile(new URL('./backtest-factors-longrun.mjs', import.meta.url), 'utf8');
check('v60.16 the long-run study writes the fields the gate and the reader need: cost scenario, present-day universe basis, staleness window, IC decay, net-spread HAC',
  /executionModel: baselineRef\.executionModel/.test(longrun) && /universeBasis: 'present-day-top-market-cap'/.test(longrun) && /staleAfterDays: LONGRUN_STALE_AFTER_DAYS/.test(longrun) && /icDecay/.test(longrun) && /quantileSpreadNetHac/.test(longrun));
check('v58.83 long-run script reports HAC inference and the external benchmark', /neweyWestMeanStats/.test(longrun) && /externalBenchmark/.test(longrun) && /compareWithExternalFactor/.test(longrun));

report();
console.log('research-validation check passed (HAC inference, French momentum parser, pre-registered benchmark verdicts, opt-in factor spreads)');
}, 'code'],
['committed-universe', async () => {
const realTop = selectTopByMarketCap(JSON.parse(await readFile(new URL('../public-data/screener-universe.json', import.meta.url), 'utf8')).universe, JSON.parse(await readFile(new URL('../public-data/screener.json', import.meta.url), 'utf8')).data, 120);
check('v58.83 committed artifacts yield enough tickers for the default top-120 run (script aborts below 20)', realTop.length >= 100, realTop.length);
report();
console.log(`research-validation: committed screener yields ${realTop.length} US tickers for the top-120 run`);
}, 'data'],
]);
