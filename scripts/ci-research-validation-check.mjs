// v58.83: deterministic checks for the long-run factor backtest's HAC inference and the external
// momentum benchmark (scripts/lib/research-validation.mjs). Offline fixtures only — the real run is
// .github/workflows/research-backtest.yml.
import { deflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { hacLagFor, neweyWestMeanStats, extractFirstZipEntry, parseFrenchDailyFactorCsv, compoundWindow, compareWithExternalFactor } from './lib/research-validation.mjs';
import { backtestFactors } from './lib/factors.mjs';

const errors = [];
const check = (label, ok, detail) => { if (!ok) errors.push(label + (detail ? ': ' + JSON.stringify(detail) : '')); };

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
check('v58.83 zip written with a data descriptor reads through the central directory', ddParsed.dates.join() === '2024-01-02,2024-01-03,2024-01-05,2024-01-08', ddParsed);
check('v58.83 zip entry inflates and the daily table parses with missing markers skipped', parsed.dates.join() === '2024-01-02,2024-01-03,2024-01-05,2024-01-08' && parsed.returns[0] === 0.01 && parsed.returns[1] === -0.005, parsed);
let rejected = false;
try { extractFirstZipEntry(Buffer.from('not a zip at all, just text....')); } catch { rejected = true; }
check('v58.83 non-zip payload fails closed', rejected);

// Window = days strictly after the rebalance close through the forward close.
const w = compoundWindow(parsed, '2024-01-02', '2024-01-05');
check('v58.83 factor compounds over (rebalance, forward] only', Math.abs(w - (0.995 * 1.02 - 1)) < 1e-12, w);
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
const btDays = Array.from({ length: 160 }, (_, i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10));
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

const longrun = await readFile(new URL('./backtest-factors-longrun.mjs', import.meta.url), 'utf8');
check('v58.83 long-run script reports HAC inference and the external benchmark', /neweyWestMeanStats/.test(longrun) && /externalBenchmark/.test(longrun) && /compareWithExternalFactor/.test(longrun));

if (errors.length) {
  console.error('research-validation check failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('research-validation check passed (HAC inference, French momentum parser, pre-registered benchmark verdicts, opt-in factor spreads)');
