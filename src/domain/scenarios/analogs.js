import { hasFinalConsonant } from '../content/korean-particle.js';
import { relativeBand } from '../themes/recent-check.js';
import { finiteNumber as finite } from '../shared/number.js';
// P1743: one definition of "a similar market move in the past" per branch, shared by the weekly long-history producer
// (scripts/build-scenario-outcomes.mjs, decades of daily closes) and the browser (AIO's own close record as fallback).
// Episodes never overlap: after a hit, the scan jumps past its outcome window, so one long episode counts once.


/** Branch analogs over aligned daily series { spx, tnx, vix, wti, dxy } (tnx in percent). */
export const BRANCH_ANALOGS = Object.freeze({
  reheat: { label: '10년물이 20거래일 25bp 이상 오른 뒤', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 },
  softland: { label: '10년물이 20거래일 25bp 이상 내리고 VIX 20 미만일 때', needs: ['tnx', 'vix'], test: (v) => v.tnx20 <= -0.25 && v.vix < 20 },
  slowdown: { label: '10년물이 20거래일 25bp 이상 내리면서 VIX 20 이상일 때', needs: ['tnx', 'vix'], test: (v) => v.tnx20 <= -0.25 && v.vix >= 20 },
  oilshock: { label: 'WTI가 20거래일 15% 이상 오른 뒤', needs: ['wti'], test: (v) => v.wti20 >= 15 },
  creditstress: { label: 'S&P 500이 20거래일 5% 이상 내리고 VIX 25 이상일 때 (신용 스트레스 대용)', needs: ['vix'], test: (v) => v.spx20 <= -5 && v.vix >= 25 },
  dollarsurge: { label: '달러 인덱스가 20거래일 3% 이상 오른 뒤', needs: ['dxy'], test: (v) => v.dxy20 >= 3 },
  reflation: { label: '10년물이 20거래일 25bp 이상 오르면서 S&P 500도 3% 이상 오를 때', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 && v.spx20 >= 3 },
  volshock: { label: 'VIX가 30 이상일 때', needs: ['vix'], test: (v) => v.vix >= 30 },
  // v57.75: the long-history producer has only spx/tnx/vix/wti/dxy, so both new branches use labelled proxies.
  aibust: { label: 'S&P 500이 20거래일 5% 이상 내리는데 10년물은 25bp 넘게 내리지 않을 때 (AI 투자 꺾임 대용)', needs: ['tnx'], test: (v) => v.spx20 <= -5 && v.tnx20 > -0.25 },
  fiscalsteep: { label: '10년물이 20거래일 25bp 이상 오르는데 S&P 500은 내릴 때 (장기 금리 부담 대용)', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 && v.spx20 < 0 }
});

/** rows: [{ date, spx, tnx?, vix?, wti?, dxy? }] ascending, completed closes only. */
export function analogOutcome(rows, analog, { horizon = 20, lookback = 20 } = {}) {
  const list = Array.isArray(rows) ? rows.filter((row) => finite(row?.spx) > 0) : [];
  if (list.length <= lookback + horizon) return null;
  const outcomes = [];
  // Base rate: every session in the same window, condition or not, so the reader can see whether the condition adds anything.
  // Macro audit 2026-10-17: only sessions where the condition could be tested count — a base that also spans years before a
  // needed series starts (WTI, VIX, DXY) is a different sample from the cases it is set against.
  const testable = (i) => !analog.needs.some((field) => finite(list[i][field]) == null || finite(list[i - lookback][field]) == null);
  let baseN = 0, baseUp = 0;
  for (let i = lookback; i + horizon < list.length; i += 1) { if (!testable(i)) continue; baseN += 1; if (list[i + horizon].spx > list[i].spx) baseUp += 1; }
  for (let i = lookback; i + horizon < list.length; i += 1) {
    const now = list[i], then = list[i - lookback];
    if (!testable(i)) continue;
    const pct = (field) => then[field] ? (now[field] / then[field] - 1) * 100 : null;
    const v = { tnx20: finite(now.tnx) != null && finite(then.tnx) != null ? now.tnx - then.tnx : null, vix: finite(now.vix),
      wti20: pct('wti'), dxy20: pct('dxy'), spx20: pct('spx') };
    let hit = false;
    try { hit = analog.test(v) === true; } catch (_) { hit = false; }
    if (!hit) continue;
    outcomes.push((list[i + horizon].spx / now.spx - 1) * 100);
    i += horizon;
  }
  return summarise(outcomes, { from: list[0].date, to: list[list.length - 1].date, horizon, ...baseRate(baseUp, baseN) });
}

const baseRate = (up, n) => n > 0 ? { baseN: n, baseUpPct: Math.round(up / n * 100) } : {};

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

/**
 * Theme stages. v57.81 (analysis audit): the screen measures them against the S&P 500 (KR: KOSPI) over the same window with
 * a ± band (src/domain/themes/recent-check.js), so the labels speak of the index. 'fading' is a leading trend that its
 * 50-day share, its conditions or the last five sessions no longer support (theme-playbook.js decides it; the long-history
 * proxy outcomes below never produce it).
 * v57.84 (owner decision, TECHNICAL-DEFINITIONS 3-1/3-2 안 A): a long trend inside ±band of the index is 동행, not 약세 or
 * 반등 (US energy +9.0% against the S&P 500's +10.0% read 약세 지속); 반등 시도·약세 지속 need the long trend more than the
 * band behind. A trend ahead of the index whose own return is 0 or below is 상대 방어 — falling less is not leading (KOSPI
 * -25.7%, batteries -2.6% read 주도 지속). The proxy outcomes use the same rule against ^GSPC.
 */
export const THEME_STATES = Object.freeze({
  leading: '주도 지속 (긴 추세가 지수보다 앞서고 1개월도 뒤처지지 않음)',
  fading: '추세 약화 확인 중 (긴 추세는 앞서나 50일선 위 비율·조건·최근 5거래일이 받쳐 주지 않음)',
  pullback: '추세 속 조정 (긴 추세는 앞서나 1개월은 뒤처짐)',
  defensive: '상대 방어 (지수보다 앞서지만 긴 추세 수익률이 0 이하 — 덜 하락한 것, 1개월도 뒤처지지 않음)',
  inline: '동행 (긴 추세가 지수와 비슷함)',
  rebound: '반등 시도 (긴 추세는 지수보다 뒤처지나 1개월은 앞섬)',
  weak: '약세 지속 (긴 추세가 지수보다 뒤처지고 1개월도 앞서지 못함)'
});
/**
 * `trend`/`recent` are the long-window and 1-month returns less the index's (or own returns when band is 0); `band` /
 * `recentBand` (%p, ≥ 0) are the ± zones; `absolute` is the theme's own long-window return (null = not checked).
 */
export function themeStateOf(trend, recent, { band = 0, recentBand = 0, absolute = null } = {}) {
  if (trend == null || recent == null) return null;
  if (trend > band) {
    // v57.86 (live review): 상대 방어 also needs the 1-month move not to lag — KR 원전 -10.9%p behind KOSPI over a month
    // (5 sessions -21%) read "덜 하락한 것". Lagging the month falls to 추세 속 조정, whose 5-session break check runs.
    if (recent < -recentBand) return 'pullback';
    return absolute != null && absolute <= 0 ? 'defensive' : 'leading';
  }
  if (band > 0 && trend >= -band) return 'inline';
  return recent > recentBand ? 'rebound' : 'weak';
}
/** 동행 qualifier from the 1-month relative move: 'up' (앞서기 시작) · 'down' (뒤처지기 시작) · null. */
export function inlineDrift(recent, recentBand = 0) {
  if (recent == null) return null;
  return recent > recentBand ? 'up' : recent < -recentBand ? 'down' : null;
}
export const INLINE_DRIFT_LABELS = Object.freeze({ up: '1개월 앞서기 시작', down: '1개월 뒤처지기 시작' });
/** ± bands the live screen uses (R714: recent-check.js relativeBand, not a second copy). */
const OUTCOME_BANDS = Object.freeze({ trend: relativeBand('ret6m'), recent: relativeBand('ret1m') });
// Audit 2026-10-17 (owner D4/D5): the stage rule a stored past-stage count was classified on. A count from another rule
// (the 5%/yr bands, or the cap-weighted S&P 500 basis) is not compared with the live stage until the artifact is rebuilt.
export const THEME_STAGE_RULE = 'theme-stage.v2';
/**
 * Past stages of a proxy ETF and what followed. With `benchmark` ([[date, close]], ^GSPC) the stage is the live rule —
 * 6-month and 1-month returns less the index's with the same bands, and the ETF's own 6-month return for 상대 방어 —
 * and meta.basis is 'relative-banded'; without it the old absolute sign rule stays and basis is 'absolute' (the screen
 * then does not compare it with the live stage).
 */
export function themeStateOutcomes(closes, { horizon = 63, benchmark = null, benchmarkField = 'spx' } = {}) {
  const list = (closes || []).filter(([, value]) => finite(value) > 0);
  const bench = Array.isArray(benchmark) && benchmark.length ? new Map(benchmark.filter(([, v]) => finite(v) > 0)) : null;
  const buckets = Object.fromEntries(Object.keys(THEME_STATES).map((state) => [state, []])); // 'fading' stays empty here
  const next = Object.fromEntries(Object.keys(THEME_STATES).map((state) => [state, 0]));
  let baseN = 0, baseUp = 0;
  // v59.45 (P9-THEME-02): the base rate counts the same sessions a stage can be read on — with a benchmark, only those
  // where the index has all three closes (a stretch before the index existed is not part of either sample).
  const testable = (i) => !bench || !!(bench.get(list[i - 126][0]) && bench.get(list[i - 21][0]) && bench.get(list[i][0]));
  let firstTestable = null, lastTestable = null;
  for (let i = 126; i + horizon < list.length; i += 1) {
    if (!testable(i)) continue;
    baseN += 1; if (list[i + horizon][1] > list[i][1]) baseUp += 1;
    if (firstTestable == null) firstTestable = i;
    lastTestable = i;
  }
  for (let i = 126; i + horizon < list.length; i += 1) {
    const trendAbs = (list[i][1] / list[i - 126][1] - 1) * 100;
    const recentAbs = (list[i][1] / list[i - 21][1] - 1) * 100;
    let state;
    if (bench) {
      if (!testable(i)) continue;
      const b0 = bench.get(list[i - 126][0]), b1 = bench.get(list[i - 21][0]), b2 = bench.get(list[i][0]);
      state = themeStateOf(trendAbs - (b2 / b0 - 1) * 100, recentAbs - (b2 / b1 - 1) * 100, { band: OUTCOME_BANDS.trend, recentBand: OUTCOME_BANDS.recent, absolute: trendAbs });
    } else state = themeStateOf(trendAbs, recentAbs);
    if (!state || i < next[state]) continue; // non-overlapping within each state
    buckets[state].push((list[i + horizon][1] / list[i][1] - 1) * 100);
    next[state] = i + horizon;
  }
  const meta = { from: list[0]?.[0] || null, to: list[list.length - 1]?.[0] || null, horizon, basis: bench ? 'relative-banded' : 'absolute', ...baseRate(baseUp, baseN),
    ...(bench ? { testableFrom: firstTestable == null ? null : list[firstTestable][0], testableTo: lastTestable == null ? null : list[lastTestable][0] } : {}) };
  return { ...Object.fromEntries(Object.entries(buckets).map(([state, values]) => [state, summarise(values, meta)])), basis: meta.basis,
    ...(bench ? { rule: THEME_STAGE_RULE, benchmark: benchmarkField } : {}) };
}

// One significance rule for every "differs from the base rate" reading (pastConflict, frequencyText): the share must sit
// more than two binomial standard errors of the base rate (about 95%) away. Overlapping base-rate sessions make the true
// error wider still, so one standard error flagged ordinary sampling noise as a contradiction.
export const BASE_RATE_SE = 2;
export const beyondBaseRate = (share, base, n) => Math.abs(share - base) > BASE_RATE_SE * Math.sqrt(base * (1 - base) / n);

// Owner 2026-10-19 (macro audit D2/D7, "전체 구조 개편"): the analogs pick past days by a market move (the branch's proxy),
// not by the branch's own conditions, so the line is only worth reading where it differs from the base rate. One reading
// of a frequency record for every surface (거시 branch line, 오늘 guide, lessons, AI): below 10 cases no share; at 10+ the
// share is stated only when it sits beyond the base rate — otherwise the reader is told the move added no information.
export const ANALOG_METHOD = 'market-move-proxy.v2';
export function pastEvidence(freq) {
  if (!freq || !(freq.n >= 1)) return { n: 0, informative: null, method: ANALOG_METHOD };
  const hasBase = Number.isFinite(freq.up) && Number.isFinite(freq.baseUpPct) && freq.n >= 10;
  const share = hasBase ? freq.up / freq.n : null;
  return { n: freq.n, up: freq.up ?? null, sharePct: share == null ? null : Math.round(share * 100), baseUpPct: hasBase ? freq.baseUpPct : null,
    informative: hasBase ? beyondBaseRate(share, freq.baseUpPct / 100, freq.n) : null, small: freq.n < 30, method: ANALOG_METHOD };
}

export function frequencyText(freq, label, { source = 'AIO 종가 기록' } = {}) {
  if (!freq) return `${label}: 과거 기록이 없어 빈도를 계산하지 않습니다.`;
  const span = `${String(freq.from || '').slice(0, 4)}~${String(freq.to || '').slice(0, 7)}`;
  if (freq.n < 3) return `${label}: ${source}(${span})에서 같은 움직임이 ${freq.n}번뿐이라 빈도로 말하지 않습니다.`;
  const signed = (value) => `${value > 0 ? '+' : ''}${value}%`;
  // v57.79: a percentage needs at least 10 non-overlapping cases; below that the counts stand alone.
  const sharePct = Math.round(freq.up / freq.n * 100);
  const evidence = pastEvidence(freq);
  // Not beyond the base rate: the counts and the base, without a share or median to anchor on.
  if (evidence.informative === false) return `${label}: ${source}(${span})의 겹치지 않는 ${freq.n}번 뒤 ${freq.horizon}거래일 흐름은 같은 기록 전체 거래일(${freq.baseUpPct}% 상승)과 표본 오차 안에서 구별되지 않았습니다 — 이 움직임만으로는 방향에 대한 정보가 없습니다.${freq.n < 30 ? ' 30번 미만의 작은 표본입니다.' : ''}`;
  const base = evidence.informative ? ` 비슷한 때 ${sharePct}%, 같은 기록 전체 거래일에서는 ${freq.baseUpPct}%가 올라, 둘의 차이가 이 조건이 더하는 정보입니다.` : '';
  return `${label}: ${source}(${span})의 겹치지 않는 ${freq.n}번 중 ${freq.up}번은 이후 ${freq.horizon}거래일 ${hasFinalConsonant(freq.subject || 'S&P 500') ? `${freq.subject || 'S&P 500'}이` : `${freq.subject || 'S&P 500'}가`} 올랐습니다 (중앙값 ${signed(freq.median)}${freq.p25 != null && freq.n >= 8 ? `, 가운데 절반 ${signed(freq.p25)}~${signed(freq.p75)}` : ''}).${base}${freq.n < 10 ? ' 표본이 작아 경향 참고용입니다.' : freq.n < 30 ? ' 30번 미만의 작은 표본이라 비율은 참고용입니다.' : ''}`; // R706: 10-29 cases carry a small-sample note (codex audit F09)
}
