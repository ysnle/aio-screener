// scripts/lib/research-validation.mjs — v58.83 research-backtest inference and external benchmark helpers.
//
// Why: the long-run factor artifact reported naive iid t-stats on IC series whose forward windows
// overlap (methodology.icInferenceCaveat), and nothing outside this repo checked that the momentum
// factor behaves like the documented momentum anomaly. These helpers add (1) a Newey-West (Bartlett
// kernel) HAC standard error for a mean of serially dependent observations, and (2) a comparison of
// our momentum long-short window returns with Kenneth French's daily momentum factor (Mom/UMD,
// Data Library, free) over the exact same trading days, judged by a criterion fixed in advance.
// Pure functions only; fetching lives in scripts/backtest-factors-longrun.mjs.
import { inflateRawSync } from 'node:zlib';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (v) => (isNum(v) ? Math.round(v * 1000) / 1000 : null);

// Lag choice: at least the overlap the sampling creates (forward window fwdDays sampled every
// stepDays leaves ceil(fwd/step) - 1 overlapping neighbours), and at least the Newey-West (1994)
// plug-in rule floor(4 * (n/100)^(2/9)), so non-overlapping series still get a small autocorrelation allowance.
export function hacLagFor(n, fwdDays, stepDays) {
  const overlap = Math.max(0, Math.ceil(fwdDays / Math.max(1, stepDays)) - 1);
  const ruleOfThumb = n > 0 ? Math.floor(4 * Math.pow(n / 100, 2 / 9)) : 0;
  return Math.min(Math.max(overlap, ruleOfThumb), Math.max(0, n - 2));
}

// Newey-West long-run variance of the mean with Bartlett weights 1 - j/(L+1).
export function neweyWestMeanStats(values, lags) {
  const x = (values || []).filter(isNum);
  const n = x.length;
  if (n < 3) return { n, mean: null, hacSe: null, hacTStat: null, hacCi95: null, lags: null, inference: 'insufficient-observations' };
  const mean = x.reduce((s, v) => s + v, 0) / n;
  const d = x.map((v) => v - mean);
  const gamma = (j) => { let s = 0; for (let t = j; t < n; t++) s += d[t] * d[t - j]; return s / n; };
  const L = Math.max(0, Math.min(Math.floor(lags), n - 1));
  let lrv = gamma(0);
  for (let j = 1; j <= L; j++) lrv += 2 * (1 - j / (L + 1)) * gamma(j);
  const se = lrv > 0 ? Math.sqrt(lrv / n) : null;
  return {
    n,
    mean: r3(mean),
    hacSe: se != null ? Math.round(se * 10000) / 10000 : null,
    hacTStat: se ? Math.round((mean / se) * 100) / 100 : null,
    hacCi95: se ? [r3(mean - 1.96 * se), r3(mean + 1.96 * se)] : null,
    lags: L,
    inference: 'newey-west-bartlett',
  };
}

// The Data Library ships each table as a one-file ZIP. Sizes come from the central directory, so an
// entry written with a trailing data descriptor (flag 0x8) still reads; encrypted, zip64 or other
// compression methods fail closed.
export function extractFirstZipEntry(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not a zip local file header');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  let compressedSize, localOffset = 0;
  if (eocd >= 0) {
    const cd = buf.readUInt32LE(eocd + 16);
    if (cd + 46 > buf.length || buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip central directory missing');
    compressedSize = buf.readUInt32LE(cd + 20);
    localOffset = buf.readUInt32LE(cd + 42);
  } else {
    if (buf.readUInt16LE(6) & 0x8) throw new Error('zip entry sizes not in local header');
    compressedSize = buf.readUInt32LE(18);
  }
  if (compressedSize === 0xffffffff || localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('unsupported zip layout');
  const flags = buf.readUInt16LE(localOffset + 6);
  const method = buf.readUInt16LE(localOffset + 8);
  if (flags & 0x1) throw new Error('encrypted zip entry');
  const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
  const body = buf.subarray(start, start + compressedSize);
  if (method === 0) return body.toString('latin1');
  if (method === 8) return inflateRawSync(body).toString('latin1');
  throw new Error('unsupported zip compression method ' + method);
}

// Daily table rows look like "19261103,   0.56" (YYYYMMDD, percent). Text before/after the table
// is skipped; a -99.99/-999 missing marker keeps its date with a null return so a window that spans
// it is excluded rather than compounded as 0%. Returns { dates, returns } with decimal returns.
export function parseFrenchDailyFactorCsv(text) {
  const dates = [], returns = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*(\d{4})(\d{2})(\d{2})\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,|$)/.exec(line);
    if (!m) continue;
    const pct = Number(m[4]);
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    if (dates.length && date <= dates[dates.length - 1]) continue;
    dates.push(date);
    returns.push(isNum(pct) && pct > -99.99 ? pct / 100 : null);
  }
  return { dates, returns };
}

// Compound the factor over days strictly after `from` up to and including `to` (the same holding
// period as a close-to-close forward return). Null when the series does not cover the window or a
// day inside it is missing.
export function compoundWindow(series, from, to) {
  if (!series || !series.dates.length || !(from < to)) return null;
  if (series.dates[0] > from || series.dates[series.dates.length - 1] < to) return null;
  let growth = 1, days = 0;
  for (let i = 0; i < series.dates.length; i++) {
    const d = series.dates[i];
    if (d <= from) continue;
    if (d > to) break;
    if (!isNum(series.returns[i])) return null;
    growth *= 1 + series.returns[i];
    days++;
  }
  return days > 0 ? growth - 1 : null;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

// Pre-registered (v58.83, before the first run): the implementation is called consistent with the
// documented momentum anomaly when at least MIN_WINDOWS windows overlap and Pearson r >= PASS_R;
// r <= 0 is a FAIL (our "momentum" moves against the published factor); anything between is
// INCONCLUSIVE. The universe is ~120 US mega caps while the published factor spans all NYSE/AMEX/
// NASDAQ stocks with 2-12 month formation, so perfect agreement is not expected. A PASS checks the
// implementation; it is not predictive validation and does not promote the screener model.
export const EXTERNAL_MOMENTUM_CRITERION = Object.freeze({ minWindows: 60, passR: 0.3, failR: 0 });

export function compareWithExternalFactor(windows, series, criterion = EXTERNAL_MOMENTUM_CRITERION) {
  const pairs = [];
  let uncovered = 0;
  for (const w of windows || []) {
    if (!w || !isNum(w.spread) || !w.rebalanceDate || !w.forwardDate) continue;
    const ext = compoundWindow(series, w.rebalanceDate, w.forwardDate);
    if (ext == null) { uncovered++; continue; }
    pairs.push([w.spread, ext]);
  }
  const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
  const signAgree = pairs.length ? pairs.filter(([a, b]) => Math.sign(a) === Math.sign(b)).length / pairs.length : null;
  const status = pairs.length < criterion.minWindows || r == null ? 'INSUFFICIENT'
    : r >= criterion.passR ? 'PASS' : r <= criterion.failR ? 'FAIL' : 'INCONCLUSIVE';
  return {
    status,
    windows: pairs.length,
    uncoveredWindows: uncovered,
    pearsonR: r3(r),
    signAgreementPct: signAgree == null ? null : Math.round(signAgree * 1000) / 10,
    criterion: { ...criterion },
  };
}
