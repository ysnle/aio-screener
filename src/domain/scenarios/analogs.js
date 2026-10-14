import { hasFinalConsonant } from '../content/korean-particle.js';
// P1743: one definition of "a similar market move in the past" per branch, shared by the weekly long-history producer
// (scripts/build-scenario-outcomes.mjs, decades of daily closes) and the browser (AIO's own close record as fallback).
// Episodes never overlap: after a hit, the scan jumps past its outcome window, so one long episode counts once.

const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Branch analogs over aligned daily series { spx, tnx, vix, wti, dxy } (tnx in percent). */
export const BRANCH_ANALOGS = Object.freeze({
  reheat: { label: '10년물이 20거래일 25bp 이상 오른 뒤', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 },
  softland: { label: '10년물이 20거래일 25bp 이상 내리고 VIX 20 미만일 때', needs: ['tnx', 'vix'], test: (v) => v.tnx20 <= -0.25 && v.vix < 20 },
  slowdown: { label: '10년물이 20거래일 25bp 이상 내리면서 VIX 20 이상일 때', needs: ['tnx', 'vix'], test: (v) => v.tnx20 <= -0.25 && v.vix >= 20 },
  oilshock: { label: 'WTI가 20거래일 15% 이상 오른 뒤', needs: ['wti'], test: (v) => v.wti20 >= 15 },
  creditstress: { label: 'S&P 500이 20거래일 5% 이상 내리고 VIX 25 이상일 때 (신용 스트레스 대용)', needs: ['vix'], test: (v) => v.spx20 <= -5 && v.vix >= 25 },
  dollarsurge: { label: '달러 인덱스가 20거래일 3% 이상 오른 뒤', needs: ['dxy'], test: (v) => v.dxy20 >= 3 },
  reflation: { label: '10년물이 20거래일 25bp 이상 오르면서 S&P 500도 3% 이상 오를 때', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 && v.spx20 >= 3 },
  volshock: { label: 'VIX가 30 이상일 때', needs: ['vix'], test: (v) => v.vix >= 30 }
});

/** rows: [{ date, spx, tnx?, vix?, wti?, dxy? }] ascending, completed closes only. */
export function analogOutcome(rows, analog, { horizon = 20, lookback = 20 } = {}) {
  const list = Array.isArray(rows) ? rows.filter((row) => finite(row?.spx) > 0) : [];
  if (list.length <= lookback + horizon) return null;
  const outcomes = [];
  for (let i = lookback; i + horizon < list.length; i += 1) {
    const now = list[i], then = list[i - lookback];
    if (analog.needs.some((field) => finite(now[field]) == null || finite(then[field]) == null)) continue;
    const pct = (field) => then[field] ? (now[field] / then[field] - 1) * 100 : null;
    const v = { tnx20: finite(now.tnx) != null && finite(then.tnx) != null ? now.tnx - then.tnx : null, vix: finite(now.vix),
      wti20: pct('wti'), dxy20: pct('dxy'), spx20: pct('spx') };
    let hit = false;
    try { hit = analog.test(v) === true; } catch (_) { hit = false; }
    if (!hit) continue;
    outcomes.push((list[i + horizon].spx / now.spx - 1) * 100);
    i += horizon;
  }
  return summarise(outcomes, { from: list[0].date, to: list[list.length - 1].date, horizon });
}

export function summarise(outcomes, meta) {
  const sorted = [...outcomes].sort((a, b) => a - b);
  const q = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] : null;
  const round = (value) => value == null ? null : Math.round(value * 10) / 10;
  return { n: outcomes.length, up: outcomes.filter((value) => value > 0).length, median: round(q(0.5)), p25: round(q(0.25)), p75: round(q(0.75)), ...meta };
}

/** Align closes by date: { spx: [[date, value]], tnx: [...] } → [{ date, spx, tnx, ... }] on the S&P dates. */
export function alignCloses(seriesByField) {
  const maps = Object.fromEntries(Object.entries(seriesByField || {}).map(([field, rows]) => [field, new Map((rows || []).map(([date, value]) => [date, value]))]));
  const base = seriesByField?.spx || [];
  return base.map(([date, spx]) => {
    const row = { date, spx };
    for (const [field, map] of Object.entries(maps)) if (field !== 'spx' && map.has(date)) row[field] = map.get(date);
    return row;
  });
}

/** Theme-proxy state outcomes: state from the 6-month and 1-month return, outcome = the next 63 sessions. */
export const THEME_STATES = Object.freeze({
  leading: '주도 지속 (긴 추세↑ · 1개월↑)',
  pullback: '추세 속 조정 (긴 추세↑ · 1개월↓)',
  rebound: '반등 시도 (긴 추세↓ · 1개월↑)',
  weak: '약세 지속 (긴 추세↓ · 1개월↓)'
});
export function themeStateOf(trend, recent) {
  if (trend == null || recent == null) return null;
  if (trend > 0) return recent >= 0 ? 'leading' : 'pullback';
  return recent > 0 ? 'rebound' : 'weak';
}
export function themeStateOutcomes(closes, { horizon = 63 } = {}) {
  const list = (closes || []).filter(([, value]) => finite(value) > 0);
  const buckets = { leading: [], pullback: [], rebound: [], weak: [] };
  const next = { leading: 0, pullback: 0, rebound: 0, weak: 0 };
  for (let i = 126; i + horizon < list.length; i += 1) {
    const trend = (list[i][1] / list[i - 126][1] - 1) * 100;
    const recent = (list[i][1] / list[i - 21][1] - 1) * 100;
    const state = themeStateOf(trend, recent);
    if (!state || i < next[state]) continue; // non-overlapping within each state
    buckets[state].push((list[i + horizon][1] / list[i][1] - 1) * 100);
    next[state] = i + horizon;
  }
  const meta = { from: list[0]?.[0] || null, to: list[list.length - 1]?.[0] || null, horizon };
  return Object.fromEntries(Object.entries(buckets).map(([state, values]) => [state, summarise(values, meta)]));
}

export function frequencyText(freq, label, { source = 'AIO 종가 기록' } = {}) {
  if (!freq) return `${label}: 과거 기록이 없어 빈도를 계산하지 않습니다.`;
  const span = `${String(freq.from || '').slice(0, 4)}~${String(freq.to || '').slice(0, 7)}`;
  if (freq.n < 3) return `${label}: ${source}(${span})에서 같은 움직임이 ${freq.n}번뿐이라 빈도로 말하지 않습니다.`;
  const signed = (value) => `${value > 0 ? '+' : ''}${value}%`;
  return `${label}: ${source}(${span})의 겹치지 않는 ${freq.n}번 중 ${freq.up}번은 이후 ${freq.horizon}거래일 ${hasFinalConsonant(freq.subject || 'S&P 500') ? `${freq.subject || 'S&P 500'}이` : `${freq.subject || 'S&P 500'}가`} 올랐습니다 (중앙값 ${signed(freq.median)}${freq.p25 != null && freq.n >= 8 ? `, 가운데 절반 ${signed(freq.p25)}~${signed(freq.p75)}` : ''}).${freq.n < 10 ? ' 표본이 작아 경향 참고용입니다.' : ''}`;
}
