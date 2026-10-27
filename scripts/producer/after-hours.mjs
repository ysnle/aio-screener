// v59.25 (owner 2026-10-27): the 08:00 KST reading never saw the US after-hours session. On 10/26 Celestica +9%,
// Whirlpool -8.5% and Cadence +2.4% moved on earnings after the close, and the site had no lane that collected them.
// The day's after-close reporters (earnings-calendar.json, hour=amc) are read from Yahoo's 5-minute chart with
// extended hours: the last 16:00-20:00 ET print of that session against the regular close. Provisional, reference-only.
import { fetchJSON } from '../lib/producer-http.mjs';
import { AFTER_HOURS_REQUIRED_PCT } from '../lib/market-analysis-validate.mjs';

export const AFTER_HOURS_MAX = 8;
export const AFTER_HOURS_MENTION_PCT = 3; // a move this large, or an index-weight leader, is offered to the reading
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function nyParts(ms) {
  const parts = Object.fromEntries(NY.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), hhmm: `${parts.hour}:${parts.minute}` };
}

// The day's after-close reporters, heaviest S&P 500 weight first, then by revenue estimate.
export function afterHoursCandidates(calendar, sessionDate, { max = AFTER_HOURS_MAX } = {}) {
  const rows = Array.isArray(calendar?.earnings) ? calendar.earnings : [];
  return rows
    .filter((row) => row?.symbol && row.date === sessionDate && row.hour === 'amc' && /^[A-Z][A-Z.\-]{0,6}$/.test(row.symbol))
    .sort((a, b) => (Number(b.indexWeight) || 0) - (Number(a.indexWeight) || 0) || (Number(b.revenueEstimate) || 0) - (Number(a.revenueEstimate) || 0))
    .slice(0, max);
}

// One chart response → the session's regular close and last after-hours print, or null when the chart is not that session.
export function afterHoursMoveFromChart(chart, sessionDate) {
  const result = chart?.chart?.result?.[0];
  const meta = result?.meta || {};
  const stamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const regularClose = Number(meta.regularMarketPrice);
  const regularAt = Number(meta.regularMarketTime) * 1000;
  if (!(regularClose > 0) || !Number.isFinite(regularAt) || nyParts(regularAt).date !== sessionDate) return null;
  let last = null;
  for (let i = 0; i < stamps.length; i += 1) {
    const value = Number(closes[i]);
    if (!(value > 0)) continue;
    const at = stamps[i] * 1000;
    const { date, minutes } = nyParts(at);
    if (date === sessionDate && minutes >= 16 * 60 && minutes < 20 * 60) last = { value, at };
  }
  if (!last) return null;
  return {
    regularClose: Math.round(regularClose * 100) / 100,
    last: Math.round(last.value * 100) / 100,
    changePct: Math.round((last.value / regularClose - 1) * 10000) / 100,
    observedAt: new Date(last.at).toISOString(),
  };
}

async function fetchExtendedChart(symbol) {
  let lastError = null;
  for (const host of YAHOO_HOSTS) {
    try { return await fetchJSON(`${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`, {}, 1); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('no-host');
}

// `fetchChart` is a fixture seam. The previous artifact is kept while the same session has nothing new (a failed run).
export async function collectAfterHours({ calendar, sessionDate, previous = null, nowMs = Date.now(), fetchChart = fetchExtendedChart } = {}) {
  const keep = previous?.sessionDate === sessionDate && Array.isArray(previous?.rows) && previous.rows.length ? previous : null;
  if (!sessionDate) return keep;
  const now = nyParts(nowMs);
  // The after-hours session starts at 16:00 ET on the session date and its last print holds until the next pre-market.
  if (now.date === sessionDate && now.minutes < 16 * 60) return keep;
  const candidates = afterHoursCandidates(calendar, sessionDate);
  if (!candidates.length) return keep;
  const rows = [];
  for (const row of candidates) {
    try {
      const move = afterHoursMoveFromChart(await fetchChart(row.symbol), sessionDate);
      if (!move) continue;
      rows.push({ symbol: row.symbol, ...move, indexWeight: row.indexWeight ?? null,
        epsActual: row.epsActual ?? null, epsEstimate: row.epsEstimate ?? null, revenueActual: row.revenueActual ?? null, revenueEstimate: row.revenueEstimate ?? null });
    } catch (error) {
      console.warn(`[fetch-data] after-hours ${row.symbol} skipped: ${error?.message || error}`);
    }
  }
  // A symbol this run could not read keeps its earlier row from the same session (with its own observedAt), so one
  // failed request does not drop a move already seen nor change the reuse key.
  if (!rows.length) return keep;
  if (keep) for (const row of keep.rows) if (candidates.some((c) => c.symbol === row.symbol) && !rows.some((r) => r.symbol === row.symbol)) rows.push(row);
  const order = new Map(candidates.map((row, index) => [row.symbol, index]));
  rows.sort((a, b) => (order.get(a.symbol) ?? 99) - (order.get(b.symbol) ?? 99));
  return {
    schemaVersion: 'after-hours.v1', sessionDate, fetchedAt: new Date(nowMs).toISOString(),
    source: 'Yahoo chart (5m, includePrePost)', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', provisional: true,
    basis: 'last 16:00-20:00 ET print vs regular-session close; earnings-calendar.json amc reporters',
    rows,
  };
}

const signedPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const reported = (value) => value != null && value !== '' && Number.isFinite(Number(value)); // null is not 0 (missing EPS stays missing)
const eps = (row) => (reported(row.epsActual) && reported(row.epsEstimate) ? `, EPS ${row.epsActual} (예상 ${Number(row.epsEstimate).toFixed(2)})` : '');
// The prompt block: moves of 3% or more and the heaviest index names, each with its ET time. Empty when nothing qualifies.
const mentionedRows = (afterHours) => (Array.isArray(afterHours?.rows) ? afterHours.rows : [])
  .filter((row) => Number.isFinite(row?.changePct) && (Math.abs(row.changePct) >= AFTER_HOURS_MENTION_PCT || Number(row.indexWeight) >= 0.1));
export function afterHoursContextLines(afterHours) {
  const rows = mentionedRows(afterHours);
  const md = String(afterHours?.sessionDate || '').slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
  return rows.map((row) => `- ${row.symbol} ${md} 시간외 ${nyParts(Date.parse(row.observedAt)).hhmm} ET 기준 ${signedPct(row.changePct)} (정규장 종가 ${row.regularClose} 대비 ${row.last}${eps(row)}) — 장 마감 후 실적 발표`).join('\n');
}

// Reuse key: the rows the prompt carries, with whole-percent moves, so a few cents of after-hours drift does not buy a new
// model call while a row crossing the mention edge (into or out of the prompt) or a newly reported EPS does. A `!` marks
// a move the validator requires the reading to name (v59.42), so +4.7% → +5.2% reopens a reading that may omit it.
export function afterHoursSignature(afterHours) {
  const rows = mentionedRows(afterHours);
  return rows.length ? `${afterHours.sessionDate}:${rows.map((row) => `${row.symbol}${Math.round(row.changePct)}${Math.abs(row.changePct) >= AFTER_HOURS_REQUIRED_PCT ? '!' : ''}${eps(row)}`).join(',')}` : '';
}
