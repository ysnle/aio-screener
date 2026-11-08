// v57.81 (거시 analysis audit, group X): the shared rules every macro read uses for three questions that used to be answered
// separately on each screen —
//   1. did a series actually move? A change counts only beyond a dead zone of half a standard deviation of that series'
//      own n-period changes over its last year (breakevens +2bp against a 7.9bp spread of 20-session changes is noise);
//   2. which way is core inflation going? Core PCE and core CPI must agree, each read on its newest release;
//      otherwise the direction is held as 엇갈림 and both are named with their months;
//   3. can WTI speak for oil? Brent futures against WTI futures: an abnormal same-day gap, Brent surging while WTI does
//      not, opposite 20-session directions, or a WTI move that Brent does not confirm (same sign, at least half the size)
//      hold every WTI-based oil read.
// Pure functions over [{ date, value }] series (ascending); imports nothing but the shared thresholds, so any domain module
// (market-read included) can call them without an import cycle.
import { RULES } from '../rules/thresholds.js';
import { signedText, finiteNumber as finite } from '../shared/number.js';
import { percentileOf } from '../shared/percentile.js';

export const MACRO_SIGNAL_RULES = Object.freeze({
  deadZoneSd: 0.5,          // a move counts only past 0.5 sd of the series' own n-period changes
  bandWindow: 252,          // one year of daily observations
  bandMinSamples: 20,       // fewer changes than this: no band is computed (the read falls back to the sign)
  inflationLevelBufferPp: 0.1, // core PCE must clear the 3% miss line by 0.1pp to be 부담 on the level alone
  oilDirectionPct: Math.abs(RULES.oil.fall20dPct), // a WTI 20-session move this large is read as a direction (▲▼)
  oilConfirmShare: 0.5,     // ... and needs Brent to move the same way by at least half as much
  nfciWindowDays: 28,       // the 4-week window of the NFCI card and the 신용 경색 condition
  sentimentLowPct: 20,      // consumer sentiment in the lowest 20% of its own record
  sentimentWindow: 36,      // three years of monthly releases
  sentimentMinRecords: 24
});

const pct = (now, then) => (then ? (now / then - 1) * 100 : null);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const stdev = (values) => {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
};
const monthOf = (date) => { const month = Number(String(date || '').split('-')[1]); return month ? `${month}월` : ''; };
const indexBack = (series, n) => (series.length > n ? series[series.length - 1 - n] : null);

/** Change against the observation closest to `days` calendar days earlier (never a later one) — the NFCI card and the
 *  신용 경색 condition read the same 4-week window (a weekly series counted in trading sessions read one week). */
export function changeOverDays(series, days) {
  const last = Array.isArray(series) ? series.at(-1) : null;
  if (!last) return null;
  const target = new Date(Date.parse(last.date) - days * 86400000).toISOString().slice(0, 10);
  let then = null;
  for (const row of series) { if (row.date <= target) then = row; else break; }
  return then ? { then, last, value: last.value - then.value } : null;
}

/** The dead zone of one series: 0.5 sd of its own n-observation changes over its last year (index-based; daily series
 *  count observations as sessions, a weekly series passes n = 4 and window = 52). `scale` converts units (% → bp). */
export function changeBand(series, n, { window = MACRO_SIGNAL_RULES.bandWindow, kind = 'diff', scale = 1 } = {}) {
  const rows = (Array.isArray(series) ? series : []).filter((row) => finite(row?.value) != null).slice(-(window + n));
  const changes = [];
  for (let index = n; index < rows.length; index += 1) {
    const change = kind === 'pct' ? pct(rows[index].value, rows[index - n].value) : rows[index].value - rows[index - n].value;
    if (change != null && Number.isFinite(change)) changes.push(change * scale);
  }
  if (changes.length < MACRO_SIGNAL_RULES.bandMinSamples) return null;
  const sd = stdev(changes);
  return { sd, band: sd * MACRO_SIGNAL_RULES.deadZoneSd, samples: changes.length };
}

/** 'up' | 'down' | 'flat' past the band (a missing band falls back to the sign); null without a value. */
export function bandDirection(value, band = null) {
  if (finite(value) == null) return null;
  const edge = finite(band) ?? 0;
  return value > edge ? 'up' : value < -edge ? 'down' : 'flat';
}

const DIRECTION_WORD = { up: '재가속', down: '둔화', flat: '뚜렷한 방향 없음' };
export const INFLATION_DIRECTION_LABELS = Object.freeze({ up: '상승', down: '둔화', mixed: '엇갈림', flat: '방향 보류', unknown: '자료 부족' });

/** One core measure: its 3-month annualised pace against its year-over-year rate, with the 0.5pp re-acceleration step. */
function measureDirection(name, input) {
  const pace = finite(input?.pace);
  const yoy = finite(input?.yoy);
  if (pace == null || yoy == null) return null;
  const margin = pace - yoy;
  const step = RULES.inflation.reaccelPp;
  const dir = margin >= step ? 'up' : margin <= -step ? 'down' : 'flat';
  const month = monthOf(input.date);
  return { name, pace, yoy, margin, dir, date: input.date || null, month,
    text: `${name}${month ? `(${month})` : ''} ${DIRECTION_WORD[dir]}(3개월 연율 ${pace.toFixed(1)}%, 전년 대비 ${yoy.toFixed(1)}%)` };
}

/** Core inflation direction from core PCE and core CPI, each on its newest release. Both must point the same way past
 *  the step; opposite directions are 엇갈림, a single measure past its step with the other flat is held. With one measure
 *  published, that measure decides (single: true). */
export function inflationDirection({ pce = null, cpi = null } = {}) {
  const p = measureDirection('근원 PCE', pce);
  const c = measureDirection('근원 CPI', cpi);
  const anyUp = p?.dir === 'up' || c?.dir === 'up';
  const parts = [p, c].filter(Boolean);
  let state = 'unknown';
  if (p && c) state = p.dir === c.dir ? p.dir : (p.dir !== 'flat' && c.dir !== 'flat') ? 'mixed' : 'flat';
  else if (parts.length === 1) state = parts[0].dir;
  const dir = state === 'up' || state === 'down' ? state : null;
  const text = parts.map((row) => row.text).join(', ');
  return { dir, state, label: INFLATION_DIRECTION_LABELS[state], single: parts.length === 1, anyUp, pce: p, cpi: c,
    reaccelerating: parts.filter((row) => row.dir === 'up'), text };
}

/** the one read of where the policy cycle stands — the last move of the target upper bound in the
 *  past `days` (180) calendar days. The 물가 chapter alone knew the Fed had hiked (9/17, 3.75→4.00%); the 물가 axis
 *  ('연준이 금리를 내리기 어려운 조건') and the release bands ('인하 기대가 줄어듭니다') still asked whether cuts were near.
 *  Accepts [{ date, value }] ascending (fedTargetUpper). */
export function policyCycle(upperSeries = [], { days = 180 } = {}) {
  const rows = (Array.isArray(upperSeries) ? upperSeries : []).filter((row) => row?.date && finite(row.value) != null);
  if (rows.length < 2) return { state: 'unknown', hiking: false, cutting: false, move: 0, date: null };
  const cutoff = new Date(Date.parse(`${rows.at(-1).date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  for (let i = rows.length - 1; i > 0 && rows[i].date >= cutoff; i -= 1) {
    const move = rows[i].value - rows[i - 1].value;
    if (Math.abs(move) > 1e-9) return { state: move > 0 ? 'hiking' : 'cutting', hiking: move > 0, cutting: move < 0, move, date: rows[i].date };
  }
  return { state: 'hold', hiking: false, cutting: false, move: 0, date: null };
}

/** Consumer sentiment rebased on its own record: the latest release's percentile within the last three years, with its
 *  month. A survey below a fixed 60 all year said nothing about this month. */
export function sentimentRank(series) {
  const rows = (Array.isArray(series) ? series : []).filter((row) => finite(row?.value) != null).slice(-MACRO_SIGNAL_RULES.sentimentWindow);
  const last = rows.at(-1);
  if (!last || rows.length < MACRO_SIGNAL_RULES.sentimentMinRecords) return last ? { value: last.value, date: last.date, month: monthOf(last.date), percentile: null, records: rows.length } : null;
  // v59.71 (quant review): the shared convention (shared/percentile.js) — (below + equal/2)/n counted the release itself,
  // so a record low read 1.4 here and 0 on every other percentile.
  return { value: last.value, date: last.date, month: monthOf(last.date), percentile: percentileOf(rows.map((row) => row.value), last.value), records: rows.length };
}

/** Brent futures against WTI futures from two close series: the same-day spread, both 20-session changes (pointBack is the
 *  caller's session helper; index-based by default) and the bands the divergence rule reads. */
export function brentWtiFromSeries({ brent = [], wti = [], pointBack = indexBack } = {}) {
  const wtiByDate = new Map(wti.map((row) => [row.date, row.value]));
  const pairs = brent.filter((row) => wtiByDate.has(row.date)).map((row) => ({ date: row.date, brent: row.value, wti: wtiByDate.get(row.date) }));
  const last = pairs.at(-1);
  if (!last) return null;
  const spread = last.brent - last.wti;
  const yearAgo = Date.parse(last.date) - 365 * 86400000;
  const spreadMedian = median(pairs.filter((row) => Date.parse(row.date) >= yearAgo).map((row) => row.brent - row.wti));
  const b0 = pointBack(brent.filter((row) => row.date <= last.date), 20);
  const w0 = pointBack(wti.filter((row) => row.date <= last.date), 20);
  const brent20 = b0 ? pct(last.brent, b0.value) : null;
  const wti20 = w0 ? pct(last.wti, w0.value) : null;
  const back = pairs.length > 20 ? pairs[pairs.length - 21] : null;
  const check = { date: last.date, brent: last.brent, wti: last.wti, spread, spreadMedian, spread20Back: back ? back.brent - back.wti : null, brent20, wti20,
    // Macro audit 2026-10-17: Brent +10.1% beside WTI +9.9% read "WTI만 덜 올라" — a cliff at the surge line. WTI now lags only
    // when it covers less than oilConfirmShare of Brent's move, the share the 'unconfirmed' rule below already uses.
    diverges: brent20 != null && brent20 >= RULES.oil.rise20dPct && (wti20 == null || wti20 < brent20 * MACRO_SIGNAL_RULES.oilConfirmShare),
    abnormal: Math.abs(spread) > BRENT_WTI_SPREAD_HOLD_USD, basis: 'futures' };
  return { ...check, ...oilDivergence(check) };
}

/** P1726: a same-day Brent − WTI futures gap above $15 is outside the range where the two have been comparable. */
export const BRENT_WTI_SPREAD_HOLD_USD = 15;

/** The one divergence rule every oil read uses (거시 chain, rate hub, scenario conditions, 시장 달러·원자재).
 *  held: WTI alone cannot stand for oil — its fall is not read as easing and its move is not counted as a condition.
 *  Accepts a brentWtiFromSeries()/brentWtiCheck() result (or any { basis, brent20, wti20, abnormal, diverges }). */
export function oilDivergence(check = null, { wti20 = check?.wti20 ?? null } = {}) {
  const none = { held: false, kind: null, text: null };
  if (!check) return none;
  const brent20 = finite(check.brent20);
  const w20 = finite(wti20);
  if (check.abnormal) return { held: true, kind: 'abnormal', text: '같은 날 브렌트와 WTI 선물의 차이가 평소 범위를 크게 벗어나 유가 방향 판단을 보류합니다.' };
  if (check.basis !== 'futures' || brent20 == null || w20 == null) return none;
  const pair = `20거래일 브렌트 ${signedText(brent20, 1, '%')}, WTI ${signedText(w20, 1, '%')}`;
  const spreadMove = finite(check.spread20Back) != null && finite(check.spread) != null ? `, 같은 날 차이 ${check.spread20Back.toFixed(1)}달러 → ${check.spread.toFixed(1)}달러` : '';
  if (check.diverges) return { held: true, kind: 'brent-rise', text: `${pair}${spreadMove} — 국제 유가는 오르는데 WTI만 덜 올라 WTI로 유가 방향을 읽지 않습니다.` };
  const word = w20 < 0 ? '하락' : '상승';
  if (brent20 !== 0 && w20 !== 0 && Math.sign(brent20) !== Math.sign(w20)) {
    return { held: true, kind: 'opposite', text: `${pair}${spreadMove} — 두 유가의 20일 방향이 달라 WTI 20일 ${word}을 유가 전체의 움직임으로 읽지 않습니다.` };
  }
  // the mirror of 'unconfirmed' — Brent (the seaborne benchmark) moved past the direction line while
  // WTI covered less than half of it. Brent -6.1% beside WTI -1.1% read '유가·달러가 중립 범위' and '유가 때문은 아닙니다'.
  if (Math.abs(brent20) >= MACRO_SIGNAL_RULES.oilDirectionPct && Math.abs(w20) < Math.abs(brent20) * MACRO_SIGNAL_RULES.oilConfirmShare) {
    const bWord = brent20 < 0 ? '하락' : '상승';
    return { held: true, kind: 'brent-led', text: `${pair}${spreadMove} — 국제 유가(브렌트)의 20일 ${bWord}을 WTI가 절반도 따라가지 않아 WTI로 유가 방향을 읽지 않습니다.` };
  }
  if (Math.abs(w20) >= MACRO_SIGNAL_RULES.oilDirectionPct && Math.abs(brent20) < Math.abs(w20) * MACRO_SIGNAL_RULES.oilConfirmShare) {
    return { held: true, kind: 'unconfirmed', text: `${pair}${spreadMove} — 브렌트가 WTI 20일 ${word}의 절반도 따라가지 않아 WTI 20일 ${word}을 유가 전체의 움직임으로 읽지 않습니다.` };
  }
  return none;
}
