// P1743 (owner 2026-10-13): every theme — US THEME_MAP and KR_THEME_MAP alike — read the same way, so the owner's
// examples (a software rally against a semiconductor pullback, bottlenecks in photonics/memory/power) come out of a
// rule rather than a hand-written note. For each theme:
//   stage    — 주도 지속 / 추세 속 조정 / 반등 시도 / 약세 지속, from the measured 6-month (or 3-month) and 1-month medians
//   wind     — tailwind or headwind under the leading and the alternative macro branch (exposure tags × branch lists)
//   choices  — the four choices with their opportunity cost for that stage × wind, and the relatively favoured one
//   evidence — met-condition count, the macro branch's market-pricing direction, and the proxy ETF's past outcomes in
//              the same stage (scenario-outcomes.json) with its sample size
//   thesis   — the structural hypothesis and what would break it (exposures.js), so a pullback in a structural theme
//              is read against its own break conditions
// Rotation is read from all themes at once: which exposure tags gained and lost over the month.
// No price, size, timing or named stock; stock-level selection stays on the theme, chart, company and screener screens.
import { CHOICE_WORDS } from '../content/choice-words.js';
import { creditStable } from '../interpretation/concepts.js';
import { withSubjectParticle, withDirectionParticle } from '../content/korean-particle.js';
import { EXPOSURE_TAGS, WIND_LABELS, themeProfile, windFor } from './exposures.js';
import { THEME_STATES, THEME_STAGE_RULE, themeStateOf, frequencyText, inlineDrift, INLINE_DRIFT_LABELS } from './analogs.js';
import { CHOICES } from '../market/macro-crossroads.js';
import { marketWindowReturns, recentMove, recentMoveText, relativeBand, weeklyNoiseFromVol, WINDOW_LABELS } from '../themes/recent-check.js';
import { signedText, finiteNumber as finite } from '../shared/number.js';

// v58.75: the playbook version lives in theme-stage.js (v59.45), re-exported here for every existing import.
import { THEME_PLAYBOOK_VERSION, SCENARIO_STATE_CURRENT, scenarioBasisCurrent } from './theme-stage.js';
export { THEME_PLAYBOOK_VERSION };
const median = (values) => { const list = values.filter((v) => finite(v) != null).sort((a, b) => a - b); if (!list.length) return null; const m = Math.floor(list.length / 2); return list.length % 2 ? list[m] : (list[m - 1] + list[m]) / 2; };
const pct = (value) => value == null ? '—' : `${signedText(value, 1)}%`;
const marketWord = (row) => (row.market === 'KR' ? '한국' : '미국');
const shortDay = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
/** The index each market's themes are measured against (history field, reader name). */
// Audit 2026-10-17 (owner D5): a theme's stage is an equal-weight median, so the US stage reads against the equal-weight
// S&P 500 (RSP) — against the cap-weighted index a few mega-caps leading put almost every theme behind at once. The
// cap-weighted S&P 500 is shown beside it, and stays the basis while RSP has no close or six-month window on that date.
export const THEME_BENCHMARKS = Object.freeze({ US: { field: 'rsp', name: 'S&P 500 동일가중', fallback: { field: 'spx', name: 'S&P 500' } }, KR: { field: 'kospi', name: '코스피' } });
const BENCHMARK_NAMES = Object.freeze({ rsp: 'S&P 500 동일가중', spx: 'S&P 500', kospi: '코스피' });
// v57.81: a leading trend needs the 50-day share condition or at least this many met conditions to stay 주도 지속.
export const LEAD_CONFIRM_MET = 3;
// v57.84 review: one line with leadingStageText (50%) and R708 — at 30% the stage read 주도 지속 while its own sentence
// said "50일선 위 종목이 30%뿐이라 추세가 넓게 받쳐 주지 않습니다".
export const ABOVE50_FLOOR = 50;
// The shared credit rule lives with the other shared concepts (src/domain/interpretation/concepts.js).
export { creditStable };

const FAVOURED = {
  leading: { tail: ['hold'], head: ['hold'], mixed: ['hold'], none: ['hold'] },
  fading: { tail: ['wait'], head: ['wait'], mixed: ['wait'], none: ['wait'] },
  pullback: { tail: ['stage'], head: ['wait'], mixed: ['stage', 'wait'], none: ['stage', 'wait'] },
  rebound: { tail: ['stage'], head: ['wait'], mixed: ['wait'], none: ['wait'] },
  weak: { tail: ['wait'], head: ['wait'], mixed: ['wait'], none: ['wait'] },
  // v57.84 (owner decision): 상대 방어 is not leadership and 동행 has no edge of its own over the index.
  defensive: { tail: ['wait'], head: ['wait'], mixed: ['wait'], none: ['wait'] },
  inline: { tail: ['hold'], head: ['wait'], mixed: ['wait'], none: ['wait'] }
};
const WHY = {
  leading: { tail: '추세와 거시 수혜가 같은 방향이라 보유를 이어 가는 쪽의 기회비용이 작습니다.',
    head: '추세는 강하지만 거시 부담이 있어, 보유는 유지하되 부담이 실제 실적으로 번지는지 확인하는 쪽이 맞습니다.',
    other: '추세가 살아 있는 동안에는 보유를 이어 가는 쪽의 기회비용이 작습니다.' },
  fading: { other: '긴 추세는 지수보다 앞서 있지만 50일선 위 종목 비율·조건·최근 5거래일 흐름이 받쳐 주지 않아, 이것들이 회복되는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.' },
  pullback: { tail: '긴 추세가 살아 있고 거시상 수혜인 조정은, 나눠 들어가는 쪽이 바닥 시점을 맞히지 않고도 다음 상승을 놓치지 않는 조합입니다. 구조 가설이 깨지는 신호가 나오면 멈춥니다.',
    head: '긴 추세가 살아 있어도 거시 부담 속 조정은 더 깊어질 수 있어, 부담이 약해지는 것을 기다리는 쪽의 비용이 작습니다.',
    other: '조정이 추세 붕괴인지 쉬어 가기인지 50일선 위 종목 비율로 가늠하며, 확인되면 나눠 들어가는 쪽이 맞습니다.' },
  rebound: { tail: '하락 추세 속 반등이지만 거시 수혜가 있어, 반등이 추세 전환으로 이어지는지 확인하며 나눠 보는 편이 맞습니다.',
    head: '부담 속 반등은 짧게 끝나는 경우가 많아, 추세 전환이 확인될 때까지 기다리는 쪽의 비용이 작습니다.',
    other: '하락 추세 속 반등은 전환인지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.' },
  weak: { tail: '거시 수혜에도 약세가 이어진다면 업종 고유의 문제가 있을 수 있어, 원인이 확인될 때까지 기다리는 쪽이 맞습니다.',
    head: '약세와 거시 부담이 겹쳐 기다림의 비용이 가장 작은 조합입니다.',
    other: '긴 추세와 1개월이 모두 지수보다 뒤처져, 50일선 위 종목 비율이 되살아나기 전까지는 기다리는 쪽의 비용이 작습니다.' },
  defensive: { other: '지수보다 덜 빠졌을 뿐 긴 추세 수익률이 0 이하라 주도로 읽지 않습니다. 지수 하락이 멈추고 이 테마의 긴 추세가 플러스로 돌아서는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.' },
  inline: { tail: '거시 수혜 성격이지만 가격은 아직 지수와 비슷하게 움직여, 보유는 이어 가되 지수보다 앞서기 시작하는지 확인하는 쪽이 맞습니다.',
    other: '지수와 비슷한 폭으로 움직여 이 테마만의 우위가 확인되지 않습니다. 새로 들어가는 판단은 긴 추세가 지수보다 앞서기 시작한 뒤가 비용이 작습니다.' }
};
// v58.74 (text audit): the stage fold prints these once; a card repeats a line only when its own text differs.
export const stageChoiceText = (state) => ({ ...(CHOICE_TEXT[state] || {}) });
const CHOICE_TEXT = {
  leading: { wait: '기다리는 동안 추세가 이어지면 놓친 상승이 기회비용이 됩니다.', hold: '추세가 살아 있는 동안 보유를 이어 가는 비용은 작습니다.', defend: '추세가 강할 때의 방어 전환은 남은 상승을 포기하는 기회비용이 큽니다.' },
  fading: { wait: '판정이 다시 받쳐질 때(50일선 위 비율 회복·5거래일 흐름 안정)까지 기다리면, 추세가 곧바로 이어질 경우의 상승을 놓칩니다.', stage: '추세가 약해지는 중에 나눠 들어가면 평균 가격은 낮출 수 있지만, 꺾임이 이어지면 하락을 함께 떠안습니다.', hold: '보유는 긴 추세가 지수보다 앞서 있는지와 구조 가설이 깨지는 신호를 확인하며 유지합니다.', defend: '추세가 실제로 꺾이면 방어 쪽이 손실을 줄이지만, 일시적 흔들림이면 반등을 놓칩니다.' },
  pullback: { wait: '조정이 쉬어 가기로 끝나면 다음 상승을 놓치는 것이 기회비용입니다.', stage: '나눠 들어가면 바닥을 맞히지 않아도 되지만, 하락이 길어지면 평균 가격도 함께 내려갑니다 — 구조 가설이 깨지는 신호가 중단 조건입니다.', hold: '보유는 조정 폭이 긴 추세 안에 머무는지(6개월 수익 범위 안인지) 확인하며 유지합니다.', defend: '조정 중의 방어 전환은 반등을 놓치는 비용이 클 수 있습니다.' },
  rebound: { wait: '반등이 전환으로 이어지면 초입을 놓치는 것이 기회비용입니다.', stage: '반등 초기에 나눠 들어가면 전환을 일부 잡지만, 반등이 실패하면 하락 추세로 되돌아갑니다.', hold: '보유는 반등이 이전 고점·50일선을 회복하는지 확인하며 유지합니다.', defend: '하락 추세가 끝나지 않았다면 방어 쪽이 손실을 줄입니다.' },
  weak: { wait: '약세가 이어지는 동안 기다림의 비용은 작습니다.', stage: '약세 속 분할은 "싸 보임"에 기대기 쉬워, 추세 회복 신호 없이 나눠 들어가는 비용이 큽니다.', hold: '보유는 약세의 원인(실적·업황)을 확인하며 비중을 점검합니다.', defend: '약세 업종 비중을 줄이는 쪽의 기회비용은 작습니다.' },
  defensive: { wait: '지수 하락이 멈추고 긴 추세가 돌아설 때까지 기다리면 반등 초입 일부를 놓칠 수 있습니다.', stage: '덜 빠진 테마에 나눠 들어가도 지수가 더 내리면 함께 내려갑니다 — 지수보다 앞선다는 것이 플러스 수익을 뜻하지는 않습니다.', hold: '보유는 지수보다 덜 빠지는 흐름이 유지되는지와 긴 추세가 0 위로 돌아서는지 확인하며 유지합니다.', defend: '하락장이 이어지면 방어 쪽이 손실을 줄이지만, 지수가 반등하면 회복을 늦게 탑니다.' },
  inline: { wait: '지수와 같이 움직이는 동안 기다리는 비용은 지수를 갖고 있지 않은 비용과 비슷합니다.', stage: '나눠 들어가면 사실상 지수 노출을 사는 것과 비슷합니다 — 긴 추세가 지수보다 앞서기 시작하는지가 기준입니다.', hold: '보유는 지수 판단과 같이 갑니다. 긴 추세가 지수보다 뒤처지기 시작하면 다시 봅니다.', defend: '이 테마만 따로 방어로 돌릴 근거는 약합니다 — 지수 전체 판단의 문제입니다.' }
};
// v57.81 (audit): "이미 벌어진 50일선과의 거리를 감수합니다" was printed while only 22.5% of the members sat above the line.
function leadingStageText(above50) {
  if (above50 == null) return '새로 나눠 들어가면 이미 오른 가격을 감수합니다 — 50일선 위 종목 비율을 확인할 수 없어 쉬어 가는 구간을 기다리는 편이 비용이 작을 수 있습니다.';
  return above50 >= 50
    ? `구성 종목 ${above50}%가 50일선 위라, 새로 나눠 들어가면 이미 벌어진 50일선과의 거리를 감수합니다 — 쉬어 가는 구간을 기다리는 편이 비용이 작을 수 있습니다.`
    : `50일선 위 종목이 ${above50}%뿐이라 추세가 넓게 받쳐 주지 않습니다 — 새로 나눠 들어가기 전에 그 비율이 회복되는지 보는 편이 비용이 작을 수 있습니다.`;
}

// The 3-month median between the long trend and the month tells a pause-and-resume apart from a straight run.
function midNote(state, ret6m, ret3m) {
  if (ret6m == null || ret3m == null) return '';
  if (state === 'leading' && ret3m < 0) return ', 3개월로는 조정 구간이었다가 1개월 기준 다시 앞섬';
  if (state === 'pullback' && ret3m < 0) return ', 3개월째 밀리는 흐름';
  if (state === 'rebound' && ret3m > 0) return ', 3개월 기준으로는 이미 회복 흐름';
  return '';
}

function depthOk(trend, ret1m, { relative = false } = {}) {
  if (trend == null || ret1m == null || ret1m >= 0) return null;
  // v57.84 (owner decision 3-2): against the index the lead is additive — the excess up to the month is trend − month.
  const before = relative ? trend - ret1m : ((1 + trend / 100) / (1 + ret1m / 100) - 1) * 100; // gain up to the start of the month
  return before > 0 ? -ret1m <= before / 2 : false;
}

// States whose month reads up (leading, fading, rebound) or down (pullback, weak); five sessions running hard the other
// way hold that month's verdict.
const UP_CLAIM = new Set(['leading', 'fading', 'rebound']);

// v57.81: stage relative to the market's index over the same windows, with a ± band; absolute only when the index has
// no close on the theme's own date (then the label says so). v57.84: one rule for a theme row and its group rows — the
// groups were read on the bare sign of their own returns, so a group could be 주도 inside a theme that was not.
// v57.84 (owner decision 3-2): with no index close on the theme's date the stage is withheld (판정 보류) instead of read on
// absolute returns — two bases never share one set of names. The theme's own long return decides 상대 방어.
function relativeStage({ ret1m, ret3m, ret6m, basis, benchmark }) {
  const trendKey = ret6m != null ? 'ret6m' : 'ret3m';
  const trend = ret6m ?? ret3m;
  const bench = benchmark && basis && benchmark.asOf === basis && finite(benchmark[trendKey]) != null && finite(benchmark.ret1m) != null ? benchmark : null;
  const trendX = trend == null || !bench ? null : trend - bench[trendKey];
  const recentX = ret1m == null || !bench ? null : ret1m - bench.ret1m;
  const band = relativeBand(trendKey), recentBand = relativeBand('ret1m');
  const state = bench ? themeStateOf(trendX, recentX, { band, recentBand, absolute: trend }) : null;
  return { trendKey, trend, bench, trendX, recentX, band, recentBand, state, drift: state === 'inline' ? inlineDrift(recentX, recentBand) : null };
}

function themeRow({ market, id, label, ret1m, ret3m, ret6m, ret5d = null, vol = null, memberCount = 1, above50, basis, benchmark = null, groups = [], members = null, crossroads, credit, outcomes, heavyweights = null, heavyweightNote = '' }) {
  const profile = themeProfile(market, id);
  const tags = profile?.tags || [];
  const stage = relativeStage({ ret1m, ret3m, ret6m, basis, benchmark });
  const { trendKey, trend, bench, trendX, recentX, band, recentBand, drift } = stage;
  const benchName = bench?.name || BENCHMARK_NAMES[bench?.field] || THEME_BENCHMARKS[market]?.name || '지수';
  const reference = bench?.reference && finite(bench.reference[trendKey]) != null && trend != null
    ? { name: bench.reference.name || BENCHMARK_NAMES[bench.reference.field] || '지수', trend: trend - bench.reference[trendKey], recent: ret1m == null || finite(bench.reference.ret1m) == null ? null : ret1m - bench.reference.ret1m } : null;
  let state = stage.state;
  // v57.87 (10/16 audit): a Korean theme's equal-weight median beat the cap-weighted KOSPI only because its two largest
  // names led the index down (반도체 1개월 -4.5% vs 삼성 -16% · 하이닉스 -30%, KOSPI -15.6%). When the largest-traded members'
  // 1-month median trails the index by more than the 1-month band, an ahead-of-index stage is withheld with that line.
  const heavyMid = heavyweights?.length ? median(heavyweights.map((member) => member.ret1m)) : null;
  const heavyHeld = market === 'KR' && bench && heavyMid != null && finite(bench.ret1m) != null && heavyMid < bench.ret1m - recentBand
    && ['leading', 'defensive', 'inline', 'pullback'].includes(state);
  if (heavyHeld) state = null;
  const weeklyNoise = weeklyNoiseFromVol(vol, { members: memberCount });
  const recent = recentMove({ ret5d, benchRet5d: bench ? finite(bench.ret5d) : null, noise: weeklyNoise });
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId) || null;
  const alt = crossroads?.items?.find((item) => item.id === crossroads.altId) || null;
  const wind = { lead: windFor(tags, lead), alt: windFor(tags, alt) };
  const above50Ok = above50 == null ? null : above50 >= ABOVE50_FLOOR;
  const conditions = state ? [
    [bench ? `긴 추세 앞섬 (${WINDOW_LABELS[trendKey]} 중앙값이 ${benchName}보다 ${band}%p 넘게 높음)` : `긴 추세 유지 (${WINDOW_LABELS[trendKey]} 중앙값 플러스)`, trendX == null ? null : trendX > band],
    [`조정이 무너지지 않음 (50일선 위 종목 ${ABOVE50_FLOOR}% 이상)`, above50Ok],
    [`중심 시나리오에서 수혜 또는 중립${lead ? ` ('${lead.title.split(' — ')[0]}')` : ''}`, lead ? wind.lead !== 'head' : null],
    // v57.81: one credit rule with 시장 상태 — neutral or widening credit is not "stable".
    ['신용 안정 (신용 지표 양호)', creditStable(credit)],
    // A drop that has taken back more than half of the gain before it is no longer a pause inside the trend.
    ...(state === 'pullback' ? [['조정 깊이 (1개월 지수 대비 낙폭이 그 전까지 앞선 폭의 절반 이하)', depthOk(trendX, recentX, { relative: true })]] : [])
  ] : [];
  const known = conditions.filter(([, ok]) => ok != null);
  const met = known.filter(([, ok]) => ok).length;
  // v57.81: 주도 지속 needs the 50-day share or most conditions, and no sharp five-session break; otherwise 추세 약화 확인 중.
  const fadeReasons = [];
  if (state === 'leading') {
    if (above50Ok !== true && met < LEAD_CONFIRM_MET) fadeReasons.push(`${above50 != null ? `50일선 위 ${above50}%` : '50일선 위 비율 확인 불가'}, 조건 ${met}/${conditions.length}`);
    if (recent?.broken || fadeReasons.length) state = 'fading';
  }
  const deep = state === 'pullback' && depthOk(trendX, recentX, { relative: true }) === false;
  // v57.84: 동행 claims a direction only through its drift; 상대 방어 claims none.
  const upClaim = UP_CLAIM.has(state) || drift === 'up';
  const downClaim = state === 'pullback' || state === 'weak' || drift === 'down';
  const contradicted = !!recent && (upClaim ? recent.broken : downClaim ? recent.surged : false);
  // v57.87 (10/16 audit): a 추세 속 조정 whose last five sessions broke (US AI infra -12% in five sessions) or whose own long
  // return is 0 or below (KR 원전 3개월 -1.0%, 1개월 -29.5%) put 분할 first; the highlights already dropped broken pullbacks.
  const shakyPullback = !deep && state === 'pullback' && (recent?.broken || (trend != null && trend <= 0));
  const favored = deep || shakyPullback ? ['wait'] : state === 'leading' ? (met >= LEAD_CONFIRM_MET ? ['hold'] : ['hold', 'wait']) : state ? FAVOURED[state][wind.lead] : [];
  const why = deep ? '1개월 낙폭이 그 전까지 오른 폭의 절반을 넘어, 쉬어 가기보다 추세가 꺾이는 신호일 수 있습니다. 낙폭이 멈추고 50일선 위 종목 비율이 회복되는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.'
    : shakyPullback ? (recent?.broken ? '최근 5거래일 낙폭이 평소 1주 움직임의 2배를 넘어, 조정이 멈췄는지 확인하기 전에 나눠 들어가면 하락을 함께 떠안을 수 있습니다. 5거래일 흐름이 안정되고 50일선 위 종목 비율이 회복되는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.'
      : `${WINDOW_LABELS[trendKey]} 자체 수익률이 0 이하라 지수보다 덜 빠졌을 뿐 오르는 추세는 아닙니다. 1개월 낙폭이 멈추는지 확인하기 전까지 기다리는 쪽의 비용이 작습니다.`)
    // v58.74 (text audit): 추세 약화 named all three reasons even when only one failed; it names the ones that did.
    : state === 'fading' ? `긴 추세는 지수보다 앞서 있지만 ${withSubjectParticle([fadeReasons.length ? '50일선 위 종목 비율과 충족 조건 수' : null, recent?.broken ? '최근 5거래일 흐름' : null].filter(Boolean).join(', ') || '확인 조건')} 받쳐 주지 않습니다. 회복되는지 확인하기 전까지는 기다리는 쪽의 비용이 작습니다.`
    : state ? (WHY[state][wind.lead] || WHY[state].other) : '';
  // v57.84 (owner decision 3-2): the proxy's past stages count only when they were classified on the live rule.
  // Audit 2026-10-17 (D4/D5): and on the same bands and benchmark (an artifact without a rule stamp predates both).
  const proxyOutcome = outcomes?.themes?.[id];
  const proxyRelative = proxyOutcome?.basis === 'relative-banded' && proxyOutcome.rule === THEME_STAGE_RULE && (proxyOutcome.benchmark || 'spx') === (bench?.field || THEME_BENCHMARKS[market]?.field);
  const proxy = state && state !== 'fading' && proxyRelative ? outcomes?.themes?.[id]?.[state] : null;
  const proxySymbol = outcomes?.themes?.[id]?.symbol;
  const windowName = `${WINDOW_LABELS[trendKey]}·1개월, ${bench ? `${benchName} 대비` : '절대 수익률(지수 비교 불가)'}${reference ? `, 참고: ${reference.name} 대비 ${WINDOW_LABELS[trendKey]} ${pct(reference.trend).replace(/%$/, '%p')}` : ''}`;
  const recentClause = recent && (contradicted || recent.broken)
    ? `, ${recentMoveText(recent, { benchmarkName: benchName })}${contradicted ? `, 평소 1주 움직임의 2배를 넘는 ${upClaim ? '급락' : '반등'} — 1개월 판정 보류` : ''}`
    : '';
  const shortName = state ? `${THEME_STATES[state].split(' (')[0]}${drift && !contradicted ? `, ${INLINE_DRIFT_LABELS[drift]}` : ''}` : null;
  const stateLabel = !state ? (heavyHeld ? `판정 보류 — 거래대금 상위 종목이 ${benchName}보다 더 빠져, 동일가중 중앙값만으로 앞섰다고 보지 않습니다` : bench ? '판정 보류' : `판정 보류 (${benchName} 종가가 테마 기준일과 맞지 않음)`)
    : `${shortName} (${windowName}${fadeReasons.length ? `, ${fadeReasons.join(', ')}` : ''})${contradicted ? '' : midNote(state, ret6m, ret3m)}${recentClause}`;
  const choices = state ? { ...CHOICE_TEXT[state], ...(state === 'leading' ? { stage: leadingStageText(above50) } : {}) } : {};
  return {
    heavyweightNote: !state && heavyHeld ? heavyweightNote || null : null,
    market, id, label, tags, tagLabels: tags.map((tag) => EXPOSURE_TAGS[tag]), thesis: profile?.thesis || null, breaks: profile?.breaks || [],
    ret1m, ret3m, ret6m, ret5d, above50, basis, members, state, stateLabel, recent, contradicted, weeklyNoise,
    relative: bench ? { name: benchName, field: bench.field || null, trendKey, trend: trendX, recent: recentX, band, recentBand, reference } : null,
    wind, windText: lead ? `중심 시나리오 '${lead.title.split(' — ')[0]}'에서 ${WIND_LABELS[wind.lead]}${alt ? `, 대안 시나리오 '${alt.title.split(' — ')[0]}'에서 ${WIND_LABELS[wind.alt]}` : ''}` : '거시 시나리오 판단 보류',
    favored, favoredWhy: why, choices,
    fit: known.length < 2 ? '판단 보류' : `조건 충족 ${met}/${conditions.length}`, met, total: conditions.length, known: known.length,
    basisText: conditions.map(([text, ok]) => `${text} ${ok == null ? '확인 불가' : ok ? '충족' : '미충족'}`),
    past: state === 'fading' ? '이 단계는 50일선 위 비율과 최근 5거래일을 함께 보는 판정이라 장기 기록(대표 ETF)과 같은 기준으로 비교하지 않습니다.'
      : proxySymbol && !proxyRelative ? `대표 ETF의 장기 기록은 아직 다른 기준(절대 수익률이거나 이전 밴드·기준 지수)으로 분류돼 있어, ${benchName} 대비인 지금 단계와 비교하지 않습니다(다음 장기 기록 갱신 때 같은 기준으로 다시 계산).`
      : proxy ? frequencyText({ ...proxy, subject: proxySymbol }, `대표 ETF ${proxySymbol}가 같은 단계(${THEME_STATES[state].split(' (')[0]}, ${benchName} 대비 같은 기준)였을 때`, { source: '장기 일봉 기록' }) : '같은 단계의 장기 과거 기록(대표 ETF)이 없어 빈도를 말하지 않습니다.',
    positioning: '직접 자료는 없습니다 — 1개월 낙폭과 50일선 위 비율로 추정합니다.',
    groups
  };
}

/**
 * @param {object} input
 * @param {Array} input.usGroups buildGroupStrength().groups (current session only)
 * @param {Array} input.krThemes krThemeArtifactRead().themes
 * @param {object} input.crossroads buildMacroCrossroads() result
 * @param {string} [input.credit] credit axis state
 * @param {object} [input.outcomes] scenario-outcomes.v1
 * @param {object} [input.labels] US theme id → Korean name
 * @param {Array} [input.history] shared close history (spx, kospi) — the stage is read against the index when present
 * @param {object} [input.benchmarks] { US, KR } marketWindowReturns() results, instead of `history` (fixtures)
 */
export function buildThemePlaybook({ usGroups = [], krThemes = [], crossroads = null, credit = null, outcomes = null, labels = {}, history = null, benchmarks: given = null } = {}) {
  const byTheme = new Map();
  for (const group of usGroups) {
    if (!group?.themeId || group.current === false) continue;
    if (!byTheme.has(group.themeId)) byTheme.set(group.themeId, []);
    byTheme.get(group.themeId).push(group);
  }
  const usBasis = [...byTheme.values()].flat().map((g) => g.basis).filter(Boolean).sort().at(-1) || null;
  const krBasis = krThemes.filter((theme) => theme?.covered >= 3).map((theme) => theme?.basis).filter(Boolean).sort().at(-1) || null;
  const benchFor = (market, through) => {
    if (!(Array.isArray(history) && history.length && through)) return null;
    const spec = THEME_BENCHMARKS[market];
    const read = (side) => ({ ...marketWindowReturns(history, side.field, { through }), name: side.name });
    const primary = read(spec);
    const usable = primary.asOf === through && finite(primary.ret1m) != null && finite(primary.ret6m) != null;
    if (!spec.fallback) return primary;
    const fallback = read(spec.fallback);
    return usable ? { ...primary, reference: fallback.asOf === through ? fallback : null } : fallback;
  };
  const benchmarks = { US: given?.US ?? benchFor('US', usBasis), KR: given?.KR ?? benchFor('KR', krBasis) };
  const rows = [];
  for (const [id, groups] of byTheme) {
    // v58.74: members pooled once across the theme's groups (a ticker in two groups counts once); group medians only
    // when the groups carry no member rows.
    const pooled = [...new Map(groups.flatMap((g) => g.memberStats || []).map((m) => [m.sym, m])).values()];
    const pick = (key, groupKey = key) => (pooled.length ? median(pooled.map((m) => m[key])) : median(groups.map((g) => g[groupKey])));
    const measured50 = pooled.filter((m) => finite(m.pctSma50) != null);
    const above50 = pooled.length ? (measured50.length ? Math.round(measured50.filter((m) => m.pctSma50 > 0).length / measured50.length * 100) : null) : median(groups.map((g) => g.above50Pct));
    const ret1m = pick('ret1m'), ret3m = pick('ret3m'), ret6m = pick('ret6m');
    if (ret1m == null) continue;
    rows.push(themeRow({ market: 'US', id, label: labels[id] || groups[0].themeName || id, ret1m, ret3m, ret6m, above50,
      ret5d: pick('ret5d'), vol: pick('vol'), memberCount: pooled.length || groups.reduce((sum, g) => sum + (finite(g.members) ?? 0), 0) || 1,
      basis: groups.map((g) => g.basis).filter(Boolean).sort().at(-1) || null, benchmark: benchmarks.US,
      groups: groups.map((g) => ({ name: g.name, ret1m: g.ret1m, ret3m: g.ret3m, ret6m: g.ret6m, ret5d: g.ret5d ?? null, above50: g.above50Pct,
        state: relativeStage({ ret1m: g.ret1m, ret3m: g.ret3m, ret6m: g.ret6m, basis: g.basis || null, benchmark: benchmarks.US }).state })),
      crossroads, credit, outcomes }));
  }
  for (const theme of krThemes) {
    if (!(theme?.covered >= 3) || theme.ret1m == null) continue;
    rows.push(themeRow({ market: 'KR', id: theme.id, label: theme.label, ret1m: theme.ret1m, ret3m: theme.ret3m, ret6m: null, ret5d: theme.ret5d ?? null, vol: theme.vol ?? null, memberCount: theme.covered,
      above50: theme.above50Pct, members: theme.covered, basis: theme.basis || null, benchmark: benchmarks.KR, crossroads, credit, outcomes,
      heavyweights: Array.isArray(theme.heavyweights) ? theme.heavyweights : null, heavyweightNote: theme.heavyweightNote || '' }));
  }
  const usBench = benchmarks.US?.asOf && benchmarks.US.asOf === usBasis ? benchmarks.US : null;
  const rotation = rotationOf(rows, { period: usBench?.from?.ret1m ? { from: usBench.from.ret1m, to: usBasis } : null, benchRet5d: usBench?.ret5d ?? null });
  // v58.74 (text audit 오늘 C3): the month's ends read against the central scenario — whether price and scenario point the
  // same way. Only the US ends are counted (the scenario exposures are US-led); with no lead branch nothing is said.
  const leadItem = crossroads?.items?.find((item) => item.id === crossroads.leadId) || null;
  const usUp = rotation.gainers.filter((row) => row.market !== 'KR'), usDown = rotation.losers.filter((row) => row.market !== 'KR');
  if (leadItem && usUp.length && usDown.length) {
    const upTail = usUp.filter((row) => row.wind.lead === 'tail').length, downHead = usDown.filter((row) => row.wind.lead === 'head').length;
    const upHead = usUp.filter((row) => row.wind.lead === 'head').length, downTail = usDown.filter((row) => row.wind.lead === 'tail').length;
    const name = leadItem.title.split(' — ')[0];
    const tie = upTail + downHead > upHead + downTail ? '시나리오와 가격이 같은 방향입니다'
      : upHead + downTail > upTail + downHead ? '가격이 시나리오와 반대로 움직였습니다' : '시나리오와 가격의 방향이 뚜렷하게 겹치지 않습니다';
    rotation.scenarioTie = `중심 시나리오 ${withDirectionParticle(`'${name}'`)} 보면 상위 ${usUp.length}개 중 ${upTail}개가 수혜 쪽, 하위 ${usDown.length}개 중 ${downHead}개가 부담 쪽이라 ${tie}.`;
    rotation.text = `${rotation.text} ${rotation.scenarioTie}`;
  }
  const highlights = {
    // Only well-supported pullbacks (most known conditions met, including the depth check) are surfaced.
    structuralPullbacks: rows.filter((row) => row.state === 'pullback' && row.wind.lead !== 'head' && row.known >= 3 && row.met / row.known >= 0.75 && !row.recent?.broken).sort((a, b) => b.met - a.met || b.ret1m - a.ret1m),
    // v57.81: only themes that pass the corrected stage (index-relative, confirmed, no five-session break) count as leading.
    headwindLeaders: rows.filter((row) => row.state === 'leading' && row.wind.lead === 'head'),
    tailwindLaggards: rows.filter((row) => row.state === 'weak' && row.wind.lead === 'tail')
  };
  const asOfByMarket = { US: usBasis, KR: krBasis };
  return { available: rows.length > 0, version: THEME_PLAYBOOK_VERSION, themes: rows, rotation, highlights, benchmarks,
    asOf: usBasis || krBasis || null, asOfByMarket, asOfText: basisText(asOfByMarket) };
}

/**
 * v58.75 (persona review): the one theme rotation read every screen prints. The live playbook (the same pipeline the theme
 * screen draws) wins; the per-refresh artifact stands in only when it was written by the same playbook version.
 * @returns {{ text: string, pullbacks: Array<{market:string,id:string,label:string,ret1m:number|null}>, source: 'live'|'artifact'|null }}
 */
export function themeRotationRead({ live = null, artifact = null, nowMs = Date.now() } = {}) {
  if (live?.available && live.rotation?.text) {
    return { text: live.rotation.text, pullbacks: (live.highlights?.structuralPullbacks || []).map(({ market, id, label, ret1m }) => ({ market, id, label, ret1m })), source: 'live' };
  }
  // v59.45 (P10-STATE-01): the stand-in also needs a current publication (a stamped status other than 'current' is not)
  // and a US basis within the session lag; it carries that basis so the line can date itself.
  const asOf = artifact?.basis?.themeAsOfByMarket?.US || null;
  if (artifact?.playbookVersion === THEME_PLAYBOOK_VERSION && artifact.rotation?.text && (artifact.status == null || artifact.status === SCENARIO_STATE_CURRENT) && scenarioBasisCurrent(asOf, 'US', nowMs)) {
    const byKey = new Map((artifact.themes || []).map((row) => [`${row.market}:${row.id}`, row]));
    return { text: artifact.rotation.text, pullbacks: (artifact.highlights?.structuralPullbacks || []).map((key) => byKey.get(key)).filter(Boolean), source: 'artifact', asOf };
  }
  return { text: '', pullbacks: [], source: null };
}

/** "미국 10/14 · 한국 10/15 확정 종가" — each market's own close date. */
export function basisText(asOfByMarket = {}) {
  const parts = [asOfByMarket.US ? `미국 ${shortDay(asOfByMarket.US)}` : null, asOfByMarket.KR ? `한국 ${shortDay(asOfByMarket.KR)}` : null].filter(Boolean);
  return parts.length ? `${parts.join(', ')} 확정 종가` : '기준일 미확인';
}

// v57.81 (audit): a tag-level "힘이 옮겨 갔습니다" needs at least this many themes on each end; thinner tags are read as
// named themes only, so two or three themes cannot make a market-wide rotation claim.
export const ROTATION_TAG_MIN_THEMES = 5;

function tagMedians(rows, benchRet5d = null) {
  const tally = new Map();
  for (const row of rows) for (const tag of row.tags) {
    if (!tally.has(tag)) tally.set(tag, []);
    tally.get(tag).push(row);
  }
  return [...tally].filter(([, list]) => list.length >= 2).map(([tag, list]) => {
    const ret5d = median(list.map((row) => row.ret5d ?? null));
    // The tag's week against its themes' typical weekly move (recent-check.js), benchmark-relative when known.
    const recent = recentMove({ ret5d, benchRet5d, noise: median(list.map((row) => row.weeklyNoise ?? null)) });
    return { tag, label: EXPOSURE_TAGS[tag], ret1m: median(list.map((row) => row.ret1m)), ret5d, recent, n: list.length };
  }).sort((a, b) => b.ret1m - a.ret1m);
}

/**
 * Which exposure tags gained and lost over the month. v57.54 (owner: US-first screener): the rotation is read on the
 * US themes and the Korean ones follow in one short line; all themes together only when the US set has fewer than two
 * tags with two themes each. A named theme carries its market word only when the sentence mixes markets.
 * v57.81: the window is named with its dates, a tag claim needs ROTATION_TAG_MIN_THEMES themes per end, and a strong
 * side whose last five sessions ran hard the other way says so instead of reading as a move still under way.
 */
export function rotationOf(rows, { period = null, benchRet5d = null } = {}) {
  const us = rows.filter((row) => row.market !== 'KR'), kr = rows.filter((row) => row.market === 'KR');
  const usTags = tagMedians(us, benchRet5d);
  const usFirst = usTags.length >= 2;
  const tags = usFirst ? usTags : tagMedians(rows);
  // v57.54 review: with no US rows (screener not read yet) the read is Korea-only and says so, not '미국·한국'.
  const scope = usFirst ? '미국' : us.length ? '미국·한국' : '한국';
  const ends = (list, k) => { const sorted = [...list].sort((a, b) => b.ret1m - a.ret1m); return { up: sorted.slice(0, k), down: sorted.slice(-k).reverse().filter((row) => !sorted.slice(0, k).includes(row)) }; };
  const main = ends(usFirst ? us : rows, 3);
  const sub = usFirst && kr.length >= 4 ? ends(kr, 2) : null;
  const top = tags[0], bottom = tags[tags.length - 1];
  const spread = top && bottom ? top.ret1m - bottom.ret1m : null;
  const week = (row) => (row.recent?.broken || row.recent?.surged) && row.ret5d != null ? `, 5거래일 ${pct(row.ret5d)}` : '';
  const named = (row) => `${scope === '미국·한국' ? `${marketWord(row)} ` : ''}${row.label}(${pct(row.ret1m)}${week(row)})`;
  const krLine = sub ? ` 한국은 1개월 상위 ${sub.up.map((row) => `${row.label}(${pct(row.ret1m)}${week(row)})`).join(', ')}, 하위 ${sub.down.map((row) => `${row.label}(${pct(row.ret1m)}${week(row)})`).join(', ')}입니다.` : '';
  const span = period?.from && period?.to ? `(${shortDay(period.from)}~${shortDay(period.to)})` : '';
  const lead = `최근 1개월${span} ${scope} 테마`;
  const sides = `상위 ${main.up.map(named).join(', ')}, 하위 ${main.down.map(named).join(', ')}`;
  const thick = top && bottom && top.n >= ROTATION_TAG_MIN_THEMES && bottom.n >= ROTATION_TAG_MIN_THEMES;
  const against = top?.ret1m > 0 && top.recent?.broken
    ? ` 다만 최근 5거래일 '${top.label}' 성격 중앙값은 ${pct(top.ret5d)}로 평소 1주 움직임의 2배를 넘게 반대로 움직여, 1개월 기준 이동이 지금도 이어진다고 보지 않습니다.` : '';
  const text = !top || !bottom || top === bottom ? '테마 기록이 부족해 가격 기준 강약 이동을 읽지 않습니다.'
    : spread < 3 ? `${lead}는 성격별 차이가 작습니다(가장 강한 '${top.label}' ${pct(top.ret1m)}, 가장 약한 '${bottom.label}' ${pct(bottom.ret1m)}) — 뚜렷한 가격 기준 강약 이동은 보이지 않습니다.${krLine}`
      : !thick ? `${lead}는 ${sides}입니다. 테마 묶음마다 표본이 ${ROTATION_TAG_MIN_THEMES}개 미만이라 한 달 동안 힘이 어느 묶음으로 옮겨 갔는지는 판단하지 않습니다.${krLine} 가격 흐름 기준이며 자금 유출입 자료는 아닙니다.`
        : `${lead}는 '${bottom.label}' 성격(중앙값 ${pct(bottom.ret1m)})에서 '${top.label}' 성격(중앙값 ${pct(top.ret1m)})으로 힘이 옮겨 갔습니다.${against} ${sides}.${krLine} 가격 흐름 기준이며 자금 유출입 자료는 아닙니다.`;
  return { tags, gainers: [...main.up, ...(sub?.up || [])], losers: [...main.down, ...(sub?.down || [])], market: scope, text };
}

/** Theme block for the AI: rotation, the notable combinations, and the themes a question names (or the most notable). */
export function renderThemePlaybookContext(model, { query = '' } = {}) {
  if (!model?.available) return '';
  const named = model.themes.filter((row) => row.label && query.includes(row.label.split(/[ /·]/)[0]));
  const notable = [...model.highlights.structuralPullbacks.slice(0, 4), ...model.highlights.headwindLeaders.slice(0, 2), ...model.highlights.tailwindLaggards.slice(0, 2), ...model.rotation.gainers.slice(0, 2), ...model.rotation.losers.slice(0, 2)];
  const picked = [...new Map([...named, ...notable].map((row) => [`${row.market}:${row.id}`, row])).values()].slice(0, 10);
  // v57.81: every line names its windows and carries the last five sessions, so the AI cannot call a theme leading
  // from the month while the week broke.
  const line = (row) => `- [${row.market}] ${row.label}: ${row.stateLabel} (5거래일 ${pct(row.ret5d ?? null)}, 1개월 ${pct(row.ret1m)}${row.ret3m != null ? `, 3개월 ${pct(row.ret3m)}` : ''}${row.ret6m != null ? `, 6개월 ${pct(row.ret6m)}` : ''}${row.above50 != null ? `, 50일선 위 ${row.above50}%` : ''}). 성격: ${row.tagLabels.join(', ') || '미분류'}. 거시: ${row.windText}. ${row.fit} [${row.basisText.join(', ')}]. ${CHOICE_WORDS.favored}: ${row.favored.map((key) => CHOICES[key]).join(', ') || '판단 보류'} — ${row.favoredWhy} 과거: ${row.past}${row.thesis ? ` 구조 가설: ${row.thesis}. 가설이 깨지는 신호: ${row.breaks.join(', ')}.` : ''}`;
  const withWeek = (r) => `${marketWord(r)} ${r.label}(${r.market === 'KR' ? '3개월' : '6개월'}·1개월 기준, ${recentMoveText(r.recent, { benchmarkName: r.relative?.name || '지수' }) || '최근 5거래일 —'})`;
  return [`【테마 시나리오 — 모든 테마를 같은 규칙으로(${model.asOfText || `${model.asOf || '기준일 미확인'} 확정 종가`}), 단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수(미국 S&P 500, 한국 코스피)와 비교하고 최근 5거래일로 점검】`, `가격 기준 강약 이동(자금 유출입 자료 아님): ${model.rotation.text}`,
    model.highlights.structuralPullbacks.length ? `추세 속 조정 + 중심 시나리오에서 역풍 아님: ${model.highlights.structuralPullbacks.slice(0, 6).map((r) => `${marketWord(r)} ${r.label}(${pct(r.ret1m)})`).join(', ')}` : '',
    model.highlights.headwindLeaders.length ? `거시 부담에도 주도: ${model.highlights.headwindLeaders.map(withWeek).join(', ')} — 업종 고유 동력(실적·구조 수요) 확인 필요` : '',
    ...picked.map(line),
    '단계가 \'추세 약화 확인 중\'이거나 최근 5거래일이 1개월 판정과 반대인 테마는 \'주도\'라고 쓰지 마라 — 5거래일 움직임을 함께 써라.',
    '레버리지·포지션 쏠림은 직접 자료가 없다 — 주장하려면 웹 출처를 붙이고, 없으면 가격 단서(낙폭·50일선 위 비율)로만 말하라. 세부 종목은 테마 상세·차트·기업·스크리너에서 사용자가 고른다.'].filter(Boolean).join('\n');
}
