// Korea exchange-close reconciliation: the KR portal daily series replaces Yahoo's KRX closes on matching dates.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { round } from '../lib/producer-math.mjs';
import { isSessionComplete } from '../../src/domain/screener/price-factors.js';
import { _fetchRss } from '../lib/producer-http.mjs';

// 2026-10-13 F01/F02: Yahoo's KRX daily close is often not the exchange close (closing call auction not
// reflected — 005930 2026-10-08 262,000 vs 263,000; 14 of the last 26 sessions differed by up to 2.3%), and
// a session it lists with an empty close (KRX 2026-10-12) froze every KR row on the prior session. The
// exchange daily series redistributed by the KR portal keeps the same volumes and split basis, so its
// close/high/low replace Yahoo's on matching dates and fill the empty sessions. Yahoo's adjusted/raw
// ratio is carried onto the corrected close so dividend adjustment is unchanged. If the series is
// missing or disagrees beyond a corporate-action-sized gap, Yahoo values stay and the gap stays listed.
export const KR_EXCHANGE_CLOSE_SOURCE = 'naver-sisejson-daily';
const KR_EXCHANGE_CLOSE_MAX_DEVIATION = 0.15;
const KR_EXCHANGE_FAILURE_LIMIT = 8;
let _krExchangeFailures = 0;
let _krExchangeSuccesses = 0;

export function parseKrDailySeries(text) {
  const rows = [];
  const seen = new Set();
  const rx = /\["(\d{8})",\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+)/g;
  let m;
  while ((m = rx.exec(String(text || ''))) !== null) {
    const d = m[1];
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const check = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== date || seen.has(date)) continue;
    const [open, high, low, close, volume] = m.slice(2, 7).map(Number);
    // An exchange bar must be internally consistent; anything else is not used to correct a provider bar.
    if (!(close > 0) || !(high > 0) || !(low > 0) || high < low || close > high || close < low) continue;
    seen.add(date);
    rows.push({ date, open, high, low, close, volume: Number.isFinite(volume) ? volume : null });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function reconcileKrExchangeCloses(rows, exchangeRows, { nullCloseDates = [], maxDeviation = KR_EXCHANGE_CLOSE_MAX_DEVIATION, fetchedAt = new Date().toISOString(), nowMs = Date.now() } = {}) {
  const base = Array.isArray(rows) ? rows.filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) : [];
  const gaps = Array.isArray(nullCloseDates) ? [...nullCloseDates] : [];
  const report = { source: KR_EXCHANGE_CLOSE_SOURCE, status: 'unavailable', reason: null, compared: 0, correctedCloses: 0, correctedRanges: 0, filledSessions: 0, filledDates: [], maxDeviationPct: null, providerMissingSessions: gaps };
  // An in-session exchange bar (KST trading hours) is a live print, not a close: it neither corrects, fills nor
  // enters the basis-mismatch comparison (an intraday 15% move must not reject the whole year's reconciliation).
  const byDate = new Map((Array.isArray(exchangeRows) ? exchangeRows : []).filter((row) => row && isSessionComplete(row.date, 'kr', nowMs)).map((row) => [row.date, row]));
  if (!base.length || !byDate.size) {
    report.reason = !base.length ? 'provider-series-empty' : 'exchange-series-unavailable';
    return { rows: base, nullCloseDates: gaps, report };
  }
  let maxDev = 0;
  for (const row of base) {
    const x = byDate.get(row.date);
    if (!x || !(row.close > 0)) continue;
    report.compared += 1;
    maxDev = Math.max(maxDev, Math.abs(x.close / row.close - 1));
  }
  report.maxDeviationPct = report.compared ? round(maxDev * 100, 2) : null;
  if (!report.compared) { report.reason = 'no-overlapping-sessions'; return { rows: base, nullCloseDates: gaps, report }; }
  // A split or a different adjustment basis shows up as a large uniform gap; a closing auction does not.
  if (maxDev > maxDeviation) { report.status = 'rejected'; report.reason = 'adjustment-basis-mismatch'; return { rows: base, nullCloseDates: gaps, report }; }
  const ratioOf = (row) => row && row.close > 0 && typeof row.adjClose === 'number' && row.adjClose > 0 ? row.adjClose / row.close : null;
  const out = base.map((row) => {
    const x = byDate.get(row.date);
    if (!x || !(row.close > 0)) return row;
    const closeChanged = x.close !== row.close;
    const rangeChanged = x.high !== row.high || x.low !== row.low;
    if (!closeChanged && !rangeChanged) return row;
    if (closeChanged) report.correctedCloses += 1;
    if (rangeChanged) report.correctedRanges += 1;
    const ratio = ratioOf(row);
    return { ...row, close: round(x.close, 2), high: round(x.high, 2), low: round(x.low, 2), adjClose: ratio == null ? row.adjClose : round(x.close * ratio, 2), closeSource: KR_EXCHANGE_CLOSE_SOURCE };
  });
  const have = new Set(out.map((row) => row.date));
  const firstDate = out[0].date;
  for (const x of byDate.values()) {
    if (x.date < firstDate || have.has(x.date)) continue;
    const prev = [...out].reverse().find((row) => row.date < x.date) || null;
    const next = out.find((row) => row.date > x.date) || null;
    const prevRatio = ratioOf(prev), nextRatio = ratioOf(next);
    // The adjusted/raw ratio of a filled session is known only when both neighbours agree (no ex-date in
    // between) or, for a new latest session, when the previous bar carries no pending adjustment.
    // Tolerance covers the two-decimal rounding of both series relative to the price (a 1,000원 stock's rounding moves
    // the ratio by ~1e-5), still far below any real dividend step. An unknown ratio leaves the session unfilled rather
    // than adding a null adjusted close that breadth and SMA windows would misread.
    const tol = Math.max(1e-6, 0.011 / Math.max(1, Math.min(prev?.close || Infinity, next?.close || Infinity)));
    const ratio = next ? (prevRatio != null && nextRatio != null && Math.abs(prevRatio - nextRatio) < tol ? nextRatio : null)
      : (prevRatio != null && Math.abs(prevRatio - 1) < tol ? 1 : null);
    if (ratio == null) continue;
    const template = prev || next;
    out.push({
      date: x.date,
      observedAt: `${x.date}T00:00:00.000Z`,
      instrumentId: template?.instrumentId || null,
      timeframe: template?.timeframe || null,
      currency: template?.currency || 'KRW',
      close: round(x.close, 2),
      adjClose: round(x.close * ratio, 2),
      high: round(x.high, 2),
      low: round(x.low, 2),
      volume: x.volume == null ? null : Math.round(x.volume),
      fetchedAt,
      closeSource: KR_EXCHANGE_CLOSE_SOURCE,
    });
    have.add(x.date);
    report.filledSessions += 1;
    report.filledDates.push(x.date);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  const filled = new Set(report.filledDates);
  report.providerMissingSessions = gaps.filter((date) => !filled.has(date));
  report.status = 'reconciled';
  return { rows: out, nullCloseDates: report.providerMissingSessions, report };
}

// Run-level summary for the artifact: how many KR rows were reconciled, and which were left on provider values.
export function summarizeKrCloseReconciliation(results) {
  const reports = (Array.isArray(results) ? results : []).filter((r) => r && r.closeReconciliation).map((r) => [r.sym, r.closeReconciliation]);
  const byStatus = {};
  let correctedCloses = 0, filledSessions = 0;
  for (const [, report] of reports) {
    byStatus[report.status] = (byStatus[report.status] || 0) + 1;
    correctedCloses += report.correctedCloses || 0;
    filledSessions += report.filledSessions || 0;
  }
  return {
    source: KR_EXCHANGE_CLOSE_SOURCE,
    basis: 'exchange daily close/high/low replace provider values on matching sessions; provider adjusted/raw ratio kept',
    rows: reports.length,
    byStatus,
    correctedCloses,
    filledSessions,
    notReconciled: reports.filter(([, report]) => report.status !== 'reconciled').map(([sym, report]) => [sym, report.reason || report.status]).slice(0, 40),
  };
}

function _krTodayDate(nowMs = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
}

export async function fetchKrExchangeDaily(sym, startDate, endDate = _krTodayDate()) {
  const code = String(sym || '').replace(/\.(KS|KQ)$/i, '').toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) return { rows: [], error: 'unsupported-code' };
  // A blocked endpoint (for example from a non-KR runner) fails fast for the rest of the run.
  if (_krExchangeSuccesses === 0 && _krExchangeFailures >= KR_EXCHANGE_FAILURE_LIMIT) return { rows: [], error: 'circuit-open' };
  const url = 'https://api.finance.naver.com/siseJson.naver?symbol=' + code + '&requestType=1&startTime='
    + String(startDate || '').replace(/-/g, '') + '&endTime=' + String(endDate || '').replace(/-/g, '') + '&timeframe=day';
  try {
    const rows = parseKrDailySeries(await _fetchRss(url, 12000));
    if (rows.length) _krExchangeSuccesses += 1; else _krExchangeFailures += 1;
    return { rows, error: rows.length ? null : 'empty-series' };
  } catch (e) {
    _krExchangeFailures += 1;
    return { rows: [], error: String((e && e.message) || e).slice(0, 80) };
  }
}
