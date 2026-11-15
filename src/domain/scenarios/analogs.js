import { hasFinalConsonant } from '../content/korean-particle.js';
import { relativeBand } from '../themes/recent-check.js';
import { finiteNumber as finite } from '../shared/number.js';
import { OUTCOME_STAMPS } from './outcome-stamps.js';
import { evidenceStrength } from '../shared/evidence-strength.js';
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
  dollarsurge: { label: '달러 지수가 20거래일 3% 이상 오른 뒤', needs: ['dxy'], test: (v) => v.dxy20 >= 3 },
  reflation: { label: '10년물이 20거래일 25bp 이상 오르면서 S&P 500도 3% 이상 오를 때', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 && v.spx20 >= 3 },
  volshock: { label: 'VIX가 30 이상일 때', needs: ['vix'], test: (v) => v.vix >= 30 },
  // v57.75: the long-history producer has only spx/tnx/vix/wti/dxy, so both new branches use labelled proxies.
  aibust: { label: 'S&P 500이 20거래일 5% 이상 내리는데 10년물은 25bp 넘게 내리지 않을 때 (AI 투자 꺾임 대용)', needs: ['tnx'], test: (v) => v.spx20 <= -5 && v.tnx20 > -0.25 },
  fiscalsteep: { label: '10년물이 20거래일 25bp 이상 오르는데 S&P 500은 내릴 때 (장기 금리 부담 대용)', needs: ['tnx'], test: (v) => v.tnx20 >= 0.25 && v.spx20 < 0 }
});

/**
 * The one scan of a branch analog: the testable sessions (the base) and the non-overlapping case sessions. The browser's
 * own-record fallback summarises it lean (analogOutcome); the weekly producer adds the base quartiles, drawdowns and the
 * cash leg (outcome-history.js analogOutcomeHistory). rows: [{ date, spx, tnx?, vix?, wti?, dxy?, cash? }] ascending.
 */
export function analogScan(rows, analog, { horizon = 20, lookback = 20 } = {}) {
  const list = Array.isArray(rows) ? rows.filter((row) => finite(row?.spx) > 0) : [];
  if (list.length <= lookback + horizon) return null;
  // Base rate: every session in the same window, condition or not, so the reader can see whether the condition adds anything.
  // Macro audit 2026-10-17: only sessions where the condition could be tested count — a base that also spans years before a
  // needed series starts (WTI, VIX, DXY) is a different sample from the cases it is set against.
  const testable = (i) => !analog.needs.some((field) => finite(list[i][field]) == null || finite(list[i - lookback][field]) == null);
  const base = [], cases = [];
  for (let i = lookback; i + horizon < list.length; i += 1) if (testable(i)) base.push(i);
  for (let i = lookback; i + horizon < list.length; i += 1) {
    const now = list[i], then = list[i - lookback];
    if (!testable(i)) continue;
    const pct = (field) => then[field] ? (now[field] / then[field] - 1) * 100 : null;
    const v = { tnx20: finite(now.tnx) != null && finite(then.tnx) != null ? now.tnx - then.tnx : null, vix: finite(now.vix),
      wti20: pct('wti'), dxy20: pct('dxy'), spx20: pct('spx') };
    let hit = false;
    try { hit = analog.test(v) === true; } catch (_) { hit = false; }
    if (!hit) continue;
    cases.push(i);
    i += horizon;
  }
  return { list, horizon, base, cases, ret: (i) => (list[i + horizon].spx / list[i].spx - 1) * 100,
    meta: { from: list[0].date, to: list[list.length - 1].date, horizon, ...baseRate(base.filter((i) => list[i + horizon].spx > list[i].spx).length, base.length) } };
}

export function analogOutcome(rows, analog, options = {}) {
  const scan = analogScan(rows, analog, options);
  return scan ? summarise(scan.cases.map(scan.ret), scan.meta) : null;
}

export const baseRate = (up, n) => n > 0 ? { baseN: n, baseUpPct: Math.round(up / n * 100) } : {};

// Linear interpolation between the two neighbours: the lower one alone made the median of an even count the
// lower-middle case (two cases -4% and +6% read -4%).
export const quantile = (sorted, p) => { if (!sorted.length) return null; const at = p * (sorted.length - 1), lo = Math.floor(at); return sorted[lo] + (at - lo) * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]); };
export function summarise(outcomes, meta) {
  const sorted = [...outcomes].sort((a, b) => a - b);
  const round = (value) => value == null ? null : Math.round(value * 10) / 10;
  return { n: outcomes.length, up: outcomes.filter((value) => value > 0).length, median: round(quantile(sorted, 0.5)), p25: round(quantile(sorted, 0.25)), p75: round(quantile(sorted, 0.75)), ...meta };
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
export const OUTCOME_BANDS = Object.freeze({ trend: relativeBand('ret6m'), recent: relativeBand('ret1m') });
// Audit 2026-10-17 (owner D4/D5): the stage rule a stored past-stage count was classified on. A count from another rule
// (the 5%/yr bands, or the cap-weighted S&P 500 basis) is not compared with the live stage until the artifact is rebuilt.
export const THEME_STAGE_RULE = 'theme-stage.v2';
/** The horizon the weekly producer scores past stages on (sessions); part of the outcome fingerprint. */
export const THEME_OUTCOME_HORIZON = 63;
/** The history field the US stage reads against (theme-playbook.js THEME_BENCHMARKS.US) and the proxies are scored on. */
export const THEME_OUTCOME_BENCHMARK = 'rsp';
/**
 * A stored theme record usable for a live stage read against `benchmark`: the same index and the live definition stamp
 * (outcome-stamps.js, generated by scripts/build-outcome-stamps.mjs over the parameters and the source of the functions
 * below that classify and score it). A change in how a record is computed is then never read under the new wording —
 * the own-return → excess outcome change once kept THEME_STAGE_RULE as it was.
 */
export const themeOutcomeCurrent = (record, benchmark) => !!record && !!benchmark && record.benchmark === benchmark && record.fingerprint === OUTCOME_STAMPS.themeStage;
// themeStateOutcomes (the producer's stage scoring) lives in outcome-history.js, off the boot path.

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
  if (!freq || !(freq.n >= 1)) return { n: 0, informative: null, method: ANALOG_METHOD, strength: evidenceStrength(0) };
  // The floors are the shared evidence-strength rule (src/domain/shared/evidence-strength.js).
  const strength = evidenceStrength(freq.n);
  const hasBase = Number.isFinite(freq.up) && Number.isFinite(freq.baseUpPct) && strength.figures;
  const share = hasBase ? freq.up / freq.n : null;
  return { n: freq.n, up: freq.up ?? null, sharePct: share == null ? null : Math.round(share * 100), baseUpPct: hasBase ? freq.baseUpPct : null,
    informative: hasBase ? beyondBaseRate(share, freq.baseUpPct / 100, freq.n) : null, small: strength.reference, strength, method: ANALOG_METHOD };
}

export function frequencyText(freq, label, { source = 'AIO 종가 기록' } = {}) {
  if (!freq) return `${label}: 과거 기록이 없어 빈도를 계산하지 않습니다.`;
  // v59.56 (text pass): '2001~2026-10' mixed a bare year with an ISO month; both ends read as words.
  const toYm = String(freq.to || '').slice(0, 7).split('-').map(Number);
  const span = `${String(freq.from || '').slice(0, 4)}년~${toYm[0] ? `${toYm[0]}년${toYm[1] ? ` ${toYm[1]}월` : ''}` : ''}`;
  if (freq.n < 3) return `${label}: ${source}(${span})에서 같은 움직임이 ${freq.n}번뿐이라 빈도로 말하지 않습니다.`;
  const signed = (value) => `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
  // v57.79: a percentage needs at least 10 non-overlapping cases; below that the counts stand alone.
  const sharePct = Math.round(freq.up / freq.n * 100);
  const evidence = pastEvidence(freq);
  // outcome 'excess' (themeStateOutcomes with a benchmark): the counts are sessions the proxy beat the index.
  const excess = freq.outcome === 'excess';
  const [rose, rise, rising, mid] = excess ? [`${freq.versus || '지수'}보다 더 올랐습니다`, '지수 초과', '지수를 앞서', '초과 수익 중앙값'] : ['올랐습니다', '상승', '올라', '중앙값'];
  // Not beyond the base rate: the counts and the base, without a share or median to anchor on.
  // One sample note for every outcome read-out (evidenceStrength) — under its floor the counts stand alone, with no
  // share or median; below the full count the figures are marked 참고.
  const note = evidence.strength.note ? ` ${evidence.strength.note}` : '';
  if (evidence.informative === false) return `${label}: ${source}(${span})에서 서로 겹치지 않는 사례 ${freq.n}번의 이후 ${freq.horizon}거래일 흐름은 평소(같은 기록 전체 거래일의 ${freq.baseUpPct}% ${rise})와 표본 오차 안에서 구별되지 않았습니다. 이 조건만으로는 방향을 말할 수 없습니다.${note}`;
  const base = evidence.informative ? ` 비슷한 때 ${sharePct}%, 같은 기록 전체 거래일에서는 ${freq.baseUpPct}%가 ${rising}, 둘의 차이가 이 조건이 더하는 정보입니다.` : '';
  const figures = evidence.strength.figures ? ` (${mid} ${signed(freq.median)}${excess ? 'p' : ''}${freq.p25 != null ? `, 가운데 절반 ${signed(freq.p25)}~${signed(freq.p75)}` : ''})` : '';
  return `${label}: ${source}(${span})에서 서로 겹치지 않는 사례 ${freq.n}번 중 ${freq.up}번은 이후 ${freq.horizon}거래일 동안 ${hasFinalConsonant(freq.subject || 'S&P 500') ? `${freq.subject || 'S&P 500'}이` : `${freq.subject || 'S&P 500'}가`} ${rose}${figures}.${base}${note}`; // R706
}
