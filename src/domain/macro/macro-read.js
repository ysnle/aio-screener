// P1426 (owner review 2026-10-03): the 거시 경제 tab explains the economy for a non-specialist —
// whether each reading is good or bad for stocks, which way it is moving, and how the pieces connect.
// Every judgement is a published rule with its threshold shown (the 시장 상태 pattern):
//   growth    — Sahm rule (3-month average unemployment 0.5pp above its prior 12-month low; Claudia Sahm,
//               2019, FRED SAHMREALTIME) and the 3-month payroll average,
//   inflation — core PCE (the measure the FOMC's 2% objective uses) and its 3-month annualised pace,
//   policy    — the 2-year yield against the policy rate (what the market prices for the next moves) and
//               the real policy rate against the FOMC's longer-run neutral (3.0% nominal - 2% = about 1%).
// Rates, credit and oil/dollar reuse the 시장 상태 axes, so the two screens never disagree.
// What a regime has tended to mean for stocks is labelled 해석 (a historical tendency, not a forecast).

import { buildCloseSeries, closeBasis, creditCause, creditState, hyDelta20Bp, hyWidening20Record, sessionPointBack as closeSessionPointBack } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';
import { brentWtiCheck } from './liquidity-growth.js';
import { inflationDirection, oilDivergence, MACRO_SIGNAL_RULES } from './macro-signals.js';

const G = RULES.growth;
const I = RULES.inflation;
const P = RULES.policy;

const STATE_LABELS = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담', unknown: '판정 보류' });

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

export function signed(value, digits = 1, suffix = '') {
  if (value == null) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${suffix}`;
}

function monthDay(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

function monthLabel(date) {
  const [year, month] = String(date || '').split('-').map(Number);
  return year && month ? `${String(year).slice(2)}년 ${month}월` : '';
}

/** Observations of one macro-history series as [{date, value}] ascending. */
export function seriesOf(macroHistory, field) {
  const rows = macroHistory?.series?.[field]?.observations;
  return Array.isArray(rows) ? rows.map(([date, value]) => ({ date, value: finite(value) })).filter((row) => row.value != null) : [];
}

function monthsBack(series, date, months) {
  const [year, month] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1)).toISOString().slice(0, 7);
  return series.find((row) => row.date.slice(0, 7) === target) || null;
}

/** Year-over-year % for each month that has its exact 12-month comparator. */
export function yoySeries(series) {
  return series.map((row) => {
    const base = monthsBack(series, row.date, 12);
    return base && base.value ? { date: row.date, value: (row.value / base.value - 1) * 100 } : null;
  }).filter(Boolean);
}

/** Three-month annualised pace — how fast prices rose over the last quarter, at a yearly rate. */
export function annualised3m(series) {
  const last = series[series.length - 1];
  const base = last ? monthsBack(series, last.date, 3) : null;
  return last && base && base.value ? { date: last.date, value: ((last.value / base.value) ** 4 - 1) * 100 } : null;
}

/** Sahm rule: 3-month average unemployment minus the lowest 3-month average of the prior 12 months. */
export function sahmGap(unemployment) {
  if (unemployment.length < 15) return null;
  const avg3 = unemployment.map((row, index) => index < 2 ? null : { date: row.date, value: (row.value + unemployment[index - 1].value + unemployment[index - 2].value) / 3 }).filter(Boolean);
  const last = avg3[avg3.length - 1];
  const prior = avg3.slice(-13, -1);
  if (prior.length < 12) return null;
  const low = Math.min(...prior.map((row) => row.value));
  return { date: last.date, value: last.value - low, avg3: last.value, low };
}

function payrollTrend(payrolls) {
  if (payrolls.length < 7) return null;
  const changes = payrolls.slice(1).map((row, index) => ({ date: row.date, value: row.value - payrolls[index].value }));
  const recent = changes.slice(-3);
  const prior = changes.slice(-6, -3);
  const avg = (rows) => rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  return { date: recent[recent.length - 1].date, avg3: avg(recent), prior3: avg(prior), changes };
}

function claimsTrend(claims) {
  if (claims.length < 30) return null;
  const avg4 = claims.map((row, index) => index < 3 ? null : { date: row.date, value: (row.value + claims[index - 1].value + claims[index - 2].value + claims[index - 3].value) / 4 }).filter(Boolean);
  const last = avg4[avg4.length - 1];
  const year = avg4.filter((row) => Date.parse(row.date) >= Date.parse(last.date) - 365 * 86400000);
  const low = Math.min(...year.map((row) => row.value));
  return { date: last.date, avg4: last.value, low, aboveLow: (last.value / low - 1) * 100, series: avg4 };
}

function lastOf(series) { return series.length ? series[series.length - 1] : null; }

/** Gauge bands and markers from rule cut points: cuts(min, max, [c1, c2], [tone0, tone1, tone2], [[at, label]]). */
function cuts(min, max, points, tones, markers) {
  const edges = [min, ...points, max];
  return { min, max, bands: tones.map((tone, index) => ({ from: edges[index], to: edges[index + 1], tone })), markers: markers.map(([at, label]) => ({ at, label })) };
}

/** A threshold gauge: the value on a fixed scale with its rule's bands (tone = effect on stocks). */
export function gauge({ label, value, min, max, unit = '', digits = 1, bands = [], markers = [] }) {
  if (value == null || !Number.isFinite(value)) return null;
  return { label, value, min, max, unit, digits, bands, markers, clipped: value < min || value > max };
}

function changeOver(series, sessions) {
  if (series.length <= sessions) return null;
  return series[series.length - 1].value - series[series.length - 1 - sessions].value;
}

function axis(id, title, state, { evidence = [], read, flip, link, asOf, detail = null, gauge = null, headline = null }) {
  return { id, title, state, stateLabel: STATE_LABELS[state], evidence: evidence.filter(([, value]) => value != null && value !== '—'), read, flip, link, asOf, detail, gauge, headline };
}

function growthAxis({ macro, mh }) {
  const unemployment = seriesOf(mh, 'unemployment');
  const sahm = sahmGap(unemployment);
  const payroll = payrollTrend(seriesOf(mh, 'payrolls'));
  const claims = claimsTrend(seriesOf(mh, 'initialClaims'));
  const retail = seriesOf(mh, 'retailSales');
  const retailYoy = lastOf(yoySeries(retail));
  const nfp = finite(macro.nfp);
  const unrate = finite(macro.unemployment) ?? lastOf(unemployment)?.value ?? null;
  let state = 'neutral';
  if (sahm == null && payroll == null && nfp == null) state = 'unknown';
  // Audit D5: one payroll month (revised, noisy) no longer decides burden on its own; the 3-month average does.
  else if ((sahm && sahm.value >= G.sahmRecessionAt) || (payroll && payroll.avg3 < 0)) state = 'burden';
  else if (sahm && sahm.value < G.sahmWatchAt && payroll && payroll.avg3 >= G.payrollSolidK) state = 'favorable';
  const partial = !sahm || !payroll ? ' 3개월 추세와 Sahm 지표는 월별 기록이 쌓이면 반영됩니다.' : '';
  // Expert review M18: the neutral reading names the indicator that held it there instead of a generic either/or.
  const neutralRead = !payroll && nfp != null && nfp < 0 && !(sahm && sahm.value >= G.sahmWatchAt)
    ? `최근 1개월 일자리가 ${Math.abs(Math.round(nfp))}천 명 줄었지만, 한 달 수치는 수정과 변동이 커서 3개월 추세가 쌓일 때까지 부담으로 보지 않습니다.${partial}`
    : sahm && sahm.value >= G.sahmWatchAt
    ? `실업률 3개월 평균이 1년 저점보다 ${sahm.value.toFixed(2)}%p 올라 주의 구간(${G.sahmWatchAt}~${G.sahmRecessionAt}%p)입니다. 아직 Sahm 경기침체 신호(${G.sahmRecessionAt}%p)에는 못 미칩니다.`
    : payroll && payroll.avg3 < G.payrollSolidK
      ? `일자리가 최근 3개월 평균 ${Math.round(payroll.avg3)}천 명씩 늘어 기준(${G.payrollSolidK / 10}만 명)에 못 미칩니다${sahm ? ` — 실업률 Sahm 지표는 ${sahm.value.toFixed(2)}%p로 낮아 침체 신호는 아닙니다` : ''}.`
      : `고용 증가가 느려졌거나 실업률이 조금씩 오르는 중간 구간입니다.${partial}`;
  const read = state === 'burden'
    ? (sahm && sahm.value >= G.sahmRecessionAt ? `실업률 3개월 평균이 1년 저점보다 ${sahm.value.toFixed(2)}%p 높아 Sahm 경기침체 신호(${G.sahmRecessionAt}%p)를 넘었습니다.` : '일자리가 줄고 있습니다 — 경기 둔화가 고용으로 번졌습니다.')
    : state === 'favorable' ? '고용이 꾸준히 늘고 실업률이 안정적입니다 — 기업 이익의 바탕이 되는 소비가 버티는 환경입니다.'
      : state === 'unknown' ? '고용 자료를 기다리는 중입니다.'
        : neutralRead;
  // P1599 (A01): the card leads with the indicator that decided the state. A calm Sahm reading beside a neutral
  // verdict (decided by slow payroll growth) read as a contradiction.
  const payrollHeld = state === 'neutral' && sahm && sahm.value < G.sahmWatchAt && payroll && payroll.avg3 < G.payrollSolidK;
  const payrollTriggered = (state === 'burden' && !(sahm && sahm.value >= G.sahmRecessionAt)) || payrollHeld;
  const growthGauge = sahm && !payrollTriggered ? gauge({ label: 'Sahm 지표 (실업률 3개월 평균 − 1년 저점)', value: sahm.value, unit: '%p', digits: 2, ...cuts(0, 1, [G.sahmWatchAt, G.sahmRecessionAt], ['favorable', 'neutral', 'burden'], [[G.sahmWatchAt, `${G.sahmWatchAt}`], [G.sahmRecessionAt, `침체 신호 ${G.sahmRecessionAt}`]]) })
    : payroll ? gauge({ label: '일자리 3개월 평균 (천 명)', value: payroll.avg3, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) })
      : nfp != null ? gauge({ label: '일자리 증감 (최근 1개월, 천 명)', value: nfp, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) }) : null;
  return axis('growth', '성장 (고용 · 소비)', state, {
    gauge: growthGauge,
    headline: payrollTriggered && payroll ? `일자리 3개월 평균 ${signed(payroll.avg3, 0)}천 명` : sahm ? `Sahm ${sahm.value.toFixed(2)}%p` : unrate == null ? null : `실업률 ${unrate.toFixed(1)}%`,
    evidence: [
      ['실업률', unrate == null ? null : `${unrate.toFixed(1)}%${finite(macro.unemploymentDelta) != null ? ` (전월 ${signed(finite(macro.unemploymentDelta), 1, '%p')})` : ''}`],
      ['Sahm 지표', sahm ? `${sahm.value.toFixed(2)}%p (${G.sahmRecessionAt} 이상이면 침체 신호)` : null],
      [payroll ? '일자리 3개월 평균' : '일자리 (최근 1개월)', payroll ? `${signed(payroll.avg3, 0)}천 명 (그 전 3개월 ${signed(payroll.prior3, 0)}천 명)` : nfp == null ? null : `${signed(nfp, 0)}천 명`],
      ['신규 실업수당 청구 (4주 평균)', claims ? `${(claims.avg4 / 10000).toFixed(1)}만 건 (1년 저점 대비 ${signed(claims.aboveLow, 0, '%')})` : null],
      ['소매판매 (전년 대비, 명목)', retailYoy ? `${signed(retailYoy.value, 1, '%')}` : finite(macro.retailSales) == null ? null : `전월 대비 ${signed(finite(macro.retailSales), 1, '%')}`]
    ],
    read,
    flip: state === 'unknown' ? null : `Sahm 지표 ${G.sahmRecessionAt}%p 이상 또는 일자리 3개월 평균 감소면 부담 · Sahm ${G.sahmWatchAt}%p 미만이면서 3개월 평균 ${G.payrollSolidK / 10}만 명 이상이면 양호 (${G.payrollSolidK / 10}만 명은 노동력 증가를 흡수하는 수준으로 흔히 쓰는 기준)`,
    link: '고용과 소비는 기업 매출의 바탕입니다. 둔화가 확인되면 경기민감주·소형주가 먼저 약해지고, 금리 인하 기대가 커지면서 채권 금리는 내려가는 경향이 있습니다.',
    asOf: sahm?.date || payroll?.date || macro._asOf_unemployment || null,
    detail: { sahm, payroll, claims }
  });
}

function inflationAxis({ macro, mh }) {
  const corePceIndex = seriesOf(mh, 'corePceIndex');
  const corePceYoySeries = yoySeries(corePceIndex);
  const yoy = finite(macro.corePce) ?? lastOf(corePceYoySeries)?.value ?? null;
  const pace = annualised3m(corePceIndex);
  const coreCpiIndex = seriesOf(mh, 'coreCpiIndex');
  const coreCpiPace = annualised3m(coreCpiIndex);
  const coreCpiYoy = lastOf(yoySeries(coreCpiIndex));
  const delta = finite(macro.corePceDelta);
  const sixMonthsAgo = corePceYoySeries.length > 6 ? corePceYoySeries[corePceYoySeries.length - 7].value : null;
  const breakeven = finite(macro.breakeven10);
  // v57.81 (audit X1): the direction of core inflation needs core PCE and core CPI to agree, each on its newest release —
  // the quadrant, this axis and the '물가 재가속' / '물가 둔화' scenarios all read this one flag.
  // Macro audit 2026-10-17: the PCE pair compares the 3-month pace with the year-over-year rate of the same month, as the
  // CPI pair already did — the released yoy (macro.corePce) can be a month newer than the history the pace is read from.
  const paceYoy = pace ? corePceYoySeries.find((row) => row.date === pace.date)?.value ?? null : null;
  const releasedSameMonth = pace && String(macro._asOf_corePce || '').slice(0, 7) === pace.date.slice(0, 7);
  const pceYoyForPace = paceYoy ?? (releasedSameMonth ? yoy : null);
  const direction = inflationDirection({
    pce: pace && pceYoyForPace != null ? { pace: pace.value, yoy: pceYoyForPace, date: pace.date } : null,
    cpi: coreCpiPace && coreCpiYoy && coreCpiYoy.date === coreCpiPace.date ? { pace: coreCpiPace.value, yoy: coreCpiYoy.value, date: coreCpiPace.date } : null
  });
  const accelerating = direction.state === 'unknown' ? null : direction.dir === 'up';
  // v57.81 (audit X5): core PCE 3.0076% against the 3.0% line was 부담 by 0.008pp. The level alone needs a 0.1pp margin; at
  // the line (or anywhere from 2.5%) a re-accelerating core measure — PCE or the newer CPI — is what fires, and the read says which.
  const levelAt = I.missPct + MACRO_SIGNAL_RULES.inflationLevelBufferPp;
  const reaccel = direction.reaccelerating;
  let state = 'neutral';
  let firedBy = null;
  if (yoy == null) state = 'unknown';
  else if (yoy >= levelAt) { state = 'burden'; firedBy = 'level'; }
  // v57.84 review: one measure re-accelerating while the other slows is 엇갈림 on the quadrant and fails the 물가 재가속
  // branch, so the axis no longer calls it 부담 — a single 3-month pace is noisy (±0.1pp a month is ±1.2pp annualised).
  // The axis fires on agreement (direction 'up') and names the mixed reading otherwise.
  else if (yoy >= I.nearTargetPct && reaccel.length && direction.dir === 'up') { state = 'burden'; firedBy = 'reaccel'; }
  else if (yoy <= I.nearTargetPct && !direction.anyUp && (pace ? pace.value <= (pceYoyForPace ?? yoy) : delta != null && delta <= 0)) state = 'favorable';
  const gap = yoy == null ? null : yoy - I.targetPct;
  const fired = reaccel[0] || null;
  const slowing = direction.state === 'mixed' ? [direction.pce, direction.cpi].find((row) => row?.dir === 'down') : null;
  const mixedNote = slowing ? ` ${slowing.name}${slowing.month ? `(${slowing.month})` : ''}는 둔화 쪽이라 두 지표의 방향은 엇갈립니다.` : '';
  const read = state === 'burden'
    ? (firedBy === 'level'
      ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 연준 목표(${I.targetPct}%)보다 ${gap.toFixed(1)}%p 높아 수준 기준(${levelAt.toFixed(1)}%)을 넘었습니다${reaccel.length ? ` — ${reaccel.map((row) => row.name).join('·')}의 최근 3개월 속도도 더 빨라 다시 오르는 중입니다` : ''}. 연준이 금리를 내리기 어려운 조건입니다.${mixedNote}`
      : `근원 PCE 물가가 ${yoy.toFixed(1)}%로 목표보다 ${gap.toFixed(1)}%p 높고, ${fired.name}${fired.month ? `(${fired.month})` : ''}의 최근 3개월 속도(연율 ${fired.pace.toFixed(1)}%)가 1년치(${fired.yoy.toFixed(1)}%)보다 ${fired.margin.toFixed(1)}%p 빨라 다시 오르고 있습니다 — 부담 판정은 이 재가속 때문입니다. 연준이 금리를 내리기 어려운 조건입니다.${mixedNote}`)
    : state === 'favorable' ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 목표에 가깝고 오르는 속도가 줄고 있습니다 — 금리 인하 여지가 생기는 조건입니다.`
      : state === 'unknown' ? '물가 자료를 기다리는 중입니다.'
        : `근원 PCE 물가 ${yoy.toFixed(1)}% — ${yoy > I.targetPct ? '목표보다 높지만' : yoy < I.targetPct ? '목표보다 낮고' : '목표 수준이고'} ${direction.state === 'mixed' && reaccel.length ? `${reaccel[0].name}${reaccel[0].month ? `(${reaccel[0].month})` : ''}만 빨라지고${mixedNote} 두 지표가 함께 가리키는 재가속은 아닙니다.` : '다시 빨라지는 신호는 뚜렷하지 않습니다.'}${yoy >= I.missPct ? ` 수준 기준(${levelAt.toFixed(1)}%)에는 못 미쳐 수준만으로 부담으로 보지 않습니다.` : ''}${pace ? '' : ' 3개월 속도는 월별 기록이 쌓이면 반영됩니다.'}`;
  const gaugeOf = state === 'burden' && firedBy === 'reaccel' && fired
    ? gauge({ label: `${fired.name} 3개월 속도 − 1년치 (재가속 폭)`, value: fired.margin, unit: '%p', digits: 1, ...cuts(-2, 3, [0, I.reaccelPp], ['favorable', 'neutral', 'burden'], [[0, '0'], [I.reaccelPp, `+${I.reaccelPp} 재가속`]]) })
    : gauge({ label: '근원 PCE 물가 (전년 대비)', value: yoy, unit: '%', digits: 1, ...cuts(0, 5, [I.nearTargetPct, levelAt], ['favorable', 'neutral', 'burden'], [[I.targetPct, `목표 ${I.targetPct}%`], [levelAt, `${levelAt.toFixed(1)}%`]]) });
  return axis('inflation', '물가', state, {
    gauge: gaugeOf,
    headline: yoy == null ? null : `근원 PCE ${yoy.toFixed(1)}%${firedBy === 'reaccel' && fired ? ` · ${fired.name} 재가속` : ''}`,
    evidence: [
      ['근원 PCE (전년 대비)', yoy == null ? null : `${yoy.toFixed(1)}% (목표 ${I.targetPct}% 대비 ${signed(gap, 1, '%p')})`],
      ['근원 PCE 3개월 속도 (연율)', pace ? `${pace.value.toFixed(1)}% ${pace.value > (pceYoyForPace ?? yoy) ? '— 1년치(전년 대비)보다 빠름' : '— 1년치(전년 대비)보다 느림'}` : null],
      ['근원 CPI 3개월 속도 (연율)', coreCpiPace ? `${coreCpiPace.value.toFixed(1)}%${coreCpiYoy ? ` (${monthLabel(coreCpiPace.date)} · 전년 대비 ${coreCpiYoy.value.toFixed(1)}%)` : ''}` : null],
      ['물가 방향 (PCE·CPI)', direction.state === 'unknown' ? null : `${direction.label} — ${direction.text}`],
      ['6개월 전 근원 PCE', sixMonthsAgo == null ? null : `${sixMonthsAgo.toFixed(1)}%`],
      ['헤드라인 CPI · PCE', finite(macro.cpi) == null ? null : `${finite(macro.cpi).toFixed(1)}% · ${finite(macro.pce)?.toFixed(1) ?? '—'}%`],
      ['10년 기대인플레이션', breakeven == null ? null : `${breakeven.toFixed(2)}%`]
    ],
    read,
    flip: state === 'unknown' ? null : `근원 PCE ${levelAt.toFixed(1)}% 이상(${I.missPct.toFixed(1)}% 선 + ${MACRO_SIGNAL_RULES.inflationLevelBufferPp}%p), 또는 ${I.nearTargetPct}% 이상에서 근원 PCE·CPI가 함께 재가속(3개월 속도가 1년치보다 ${I.reaccelPp}%p 이상 빠름)하면 부담 · ${I.nearTargetPct}% 이하이면서 3개월 속도가 1년치 이하(두 지표 모두 재가속 아님)면 양호`,
    link: '물가가 목표보다 높으면 연준은 금리를 높게 유지합니다. 높은 금리는 미래 이익의 현재 가치를 낮춰 성장주 밸류에이션(PER)에 특히 부담이 됩니다.',
    asOf: macro._asOf_corePce || pace?.date || null,
    detail: { yoy, pace, paceYoy: pceYoyForPace, accelerating, direction, firedBy }
  });
}

/** The 2-year yield against the target-range midpoint — one definition for the policy axis and the chain's policy node. */
function policyPricing(macro) {
  const upper = finite(macro.fedTargetUpper);
  const lower = finite(macro.fedTargetLower);
  const mid = upper != null && lower != null ? (upper + lower) / 2 : null;
  const twoYear = finite(macro.dgs2);
  return { upper, lower, mid, twoYear, pricing: mid != null && twoYear != null ? twoYear - mid : null };
}

function policyAxis({ macro, inflationState, growthState = null }) {
  const { upper, lower, mid, twoYear, pricing } = policyPricing(macro);
  const corePce = finite(macro.corePce);
  const realPolicy = mid != null && corePce != null ? mid - corePce : null;
  let state = 'neutral';
  if (mid == null || (pricing == null && realPolicy == null)) state = 'unknown';
  else if ((pricing != null && pricing >= P.pricedMovePp) || (realPolicy != null && realPolicy >= P.restrictiveRealPct)) state = 'burden';
  // Audit D3: cuts priced because growth is breaking are not a tailwind (the axis link says so), so a weak growth axis
  // holds the reading at neutral instead of favorable.
  const recessionCut = pricing != null && pricing <= -P.pricedMovePp && growthState === 'burden';
  if (state === 'neutral' && pricing != null && pricing <= -P.pricedMovePp && inflationState !== 'burden' && !recessionCut) state = 'favorable';
  // P1449: 2년물 − 기준금리 중간값은 정책 경로와 기간·위험 프리미엄을 분리하지 못한 대용 지표다.
  // 관측(수준)은 그대로 말하고, "시장이 인상/인하를 반영"이라는 해석은 프리미엄 미분해를 명시한다.
  const PRICING_BASIS = '기간·위험 프리미엄 분해 자료가 없는 대용 지표(2년물 − 기준금리 중간값)';
  const pricingText = pricing == null ? null : pricing >= P.pricedMovePp ? '기준금리보다 뚜렷이 높은' : pricing <= -P.pricedMovePp ? '기준금리보다 뚜렷이 낮은' : '기준금리 부근(동결에 가까운)';
  const read = state === 'burden'
    ? (pricing != null && pricing >= P.pricedMovePp
      ? `2년물(${twoYear.toFixed(2)}%)이 기준금리 중간값(${mid.toFixed(2)}%)보다 ${pricing.toFixed(2)}%p 높습니다. 앞으로 1~2년 기준금리가 지금보다 높을 가능성이 일부 반영됐을 수 있지만, 이 차이에는 기간·위험 프리미엄도 섞여 있어 ‘인상 예상’으로 단정할 수는 없습니다.`
      : `물가를 뺀 실질 기준금리가 ${realPolicy.toFixed(1)}%로 중립 수준(약 ${P.neutralRealPct}%)보다 훨씬 높은 긴축 상태입니다.`)
    : state === 'favorable' ? `2년물이 기준금리보다 ${Math.abs(pricing).toFixed(2)}%p 낮습니다. 인하 가능성이 일부 반영됐을 수 있지만, 프리미엄을 분리한 자료가 없어 ‘인하 예상’으로 단정할 수는 없습니다.`
      : state === 'unknown' ? '정책금리나 2년물 자료를 기다리는 중입니다.'
        : recessionCut ? `2년물이 기준금리보다 ${Math.abs(pricing).toFixed(2)}%p 낮지만, 성장 축이 부담이라 경기 악화 때문에 인하를 반영하는 쪽으로 읽어 양호로 보지 않습니다(${PRICING_BASIS}).`
          : `시장이 보는 2년물은 당분간 ${pricingText || '큰 변화 없는'} 수준입니다(${PRICING_BASIS}).`;
  return axis('policy', '통화정책', state, {
    gauge: state === 'burden' && (pricing == null || pricing < P.pricedMovePp) && realPolicy != null ? gauge({ label: '실질 기준금리 (중간값 − 근원 PCE)', value: realPolicy, unit: '%', digits: 1, ...cuts(-2, 4, [P.restrictiveRealPct], ['neutral', 'burden'], [[P.neutralRealPct, `중립 약 ${P.neutralRealPct}%`], [P.restrictiveRealPct, `${P.restrictiveRealPct}%`]]) }) : gauge({ label: '2년물 − 기준금리 중간값', value: pricing, unit: '%p', digits: 2, ...cuts(-1.5, 1.5, [-P.pricedMovePp, P.pricedMovePp], ['favorable', 'neutral', 'burden'], [[-P.pricedMovePp, `−${P.pricedMovePp}%p`], [P.pricedMovePp, `+${P.pricedMovePp}%p`]]) }),
    // Codex review 2026-10-05: the headline states the observed gap; the reading below says why it is not
    // a forecast of hikes (premia are not separated).
    headline: pricing == null ? null : pricing >= P.pricedMovePp ? `2년물이 기준금리보다 ${pricing.toFixed(2)}%p 높음` : pricing <= -P.pricedMovePp ? `2년물이 기준금리보다 ${Math.abs(pricing).toFixed(2)}%p 낮음` : '2년물이 기준금리와 비슷함',
    evidence: [
      ['연준 목표 범위', upper == null ? null : `${lower.toFixed(2)}–${upper.toFixed(2)}%`],
      ['2년물 − 기준금리 중간값', pricing == null ? null : `${signed(pricing, 2, '%p')} (${pricingText} 수준)`],
      ['실질 기준금리 (중간값 − 근원 PCE)', realPolicy == null ? null : `${realPolicy.toFixed(1)}% (중립 약 ${P.neutralRealPct}%)`]
    ],
    read,
    flip: state === 'unknown' ? null : `2년물이 기준금리 중간값보다 ${P.pricedMovePp}%p 이상 높거나 실질 기준금리 ${P.restrictiveRealPct}% 이상이면 부담 · ${P.pricedMovePp}%p 이상 낮고(인하 반영) 물가·성장이 부담이 아니면 양호`,
    link: '2년물 금리에는 앞으로 1~2년의 기준금리 예상과 기간·위험 프리미엄이 함께 들어 있습니다. 위쪽으로 벌어지면 달러 강세와 높은 할인율이 함께 오고, 인하 쪽이면 반대입니다. 단, 경기 악화 때문에 인하를 반영하는 경우는 주식에 좋은 신호가 아닙니다.',
    asOf: macro._asOf_dgs2 || null,
    detail: { mid, pricing, realPolicy }
  });
}

function reuse(regime, id, title, link, extras = {}) {
  const row = regime?.axes?.find((item) => item.id === id);
  if (!row) return axis(id, title, 'unknown', { read: '종가 기록을 불러오는 중입니다.', link });
  return { ...row, title, link, shared: true, gauge: extras.gauge || null, headline: extras.headline || null };
}

// Gauges for the 시장 상태 axes. P1427: each gauge shows the variable that actually decided the state —
// a burden triggered by a fast 5-day credit widening is drawn on the 5-day change, not the level, so the
// pin never sits in the green band of a card that reads 부담.
function sharedGauges({ macro, rateFx, regime }) {
  const stateOf = (id) => regime?.axes?.find((row) => row.id === id)?.state || 'unknown';
  const hy = finite(macro.hyOAS);
  const hyBp = hy == null ? null : hy * 100;
  const hy5 = finite(macro.hyOASDelta5) == null ? null : finite(macro.hyOASDelta5) * 100;
  // Codex audit F06: the gauge follows creditCause — a burden from the 20-session record is drawn on that change.
  const cause = stateOf('credit') === 'burden' ? creditCause({ hyBp, hy5, hy20Record: rateFx?.hy20Record || null }) : { primary: null };
  const creditByChange = cause.primary === 'fast5';
  const creditBy20 = cause.primary === 'wide20' && finite(rateFx?.hy20Record?.value) != null;
  // v57.50 (W1 request): a level under the tight cut is drawn favourable only when creditState() says so (5-day not
  // widening, no 20-session widening, no heavy hedging) — otherwise that band is neutral, as on the 시장 상태 axis.
  const creditVerdict = stateOf('credit') !== 'unknown' ? stateOf('credit') : creditState({ hyBp, hy5, hy20: rateFx?.hy20 ?? null, pcr: null }); // hy20: macro-history 20-session change
  const lowTone = creditVerdict === 'favorable' ? 'favorable' : 'neutral';
  const record20 = rateFx?.hy20Record;
  const credit = creditBy20
    ? gauge({ label: '하이일드 스프레드 20거래일 변화', value: record20.value, unit: 'bp', digits: 0, ...cuts(-50, Math.max(150, Math.ceil(record20.value / 50) * 50 + 50), [RULES.credit.widen20dBp, record20.enterBp], ['favorable', 'neutral', 'burden'], [[RULES.credit.widen20dBp, `+${RULES.credit.widen20dBp}`], [record20.enterBp, `+${Math.round(record20.enterBp)} 1년 상위`]]) })
    : creditByChange
    ? gauge({ label: '하이일드 스프레드 5거래일 변화', value: hy5, unit: 'bp', digits: 0, ...cuts(-50, 100, [0, RULES.credit.widen5dBp], ['favorable', 'neutral', 'burden'], [[0, '0'], [RULES.credit.widen5dBp, `+${RULES.credit.widen5dBp} 급확대`]]) })
    : gauge({ label: '하이일드 스프레드', value: hyBp, unit: 'bp', digits: 0, ...cuts(200, 700, [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], [lowTone, 'neutral', 'burden'], [[RULES.credit.tightBelowBp, `${RULES.credit.tightBelowBp}`], [RULES.credit.stressAtBp, `${RULES.credit.stressAtBp}`]]) });
  const tnx20 = rateFx?.tnx20 ?? null;
  const ratesByRange = stateOf('rates') === 'burden' && (tnx20 == null || tnx20 < RULES.rates.move20dBp) && rateFx?.tnxPosition != null;
  // v57.86 (live review): a 부담 held between the 80% exit and the 90% entry drew its pin in the neutral band — the cut is the exit line then.
  const ratesHeld = ratesByRange && rateFx.tnxPosition < RULES.rates.rangeHighAt;
  const ratesCut = (ratesHeld ? RULES.rates.rangeExitAt : RULES.rates.rangeHighAt) * 100;
  const rates = ratesByRange
    ? gauge({ label: '10년물 1년 범위 내 위치', value: rateFx.tnxPosition * 100, unit: '%', digits: 0, ...cuts(0, 100, [ratesCut], ['neutral', 'burden'], [[ratesCut, ratesHeld ? `유지 ${ratesCut}%` : `상단 ${ratesCut}%`]]) })
    : gauge({ label: '10년물 20일 변화', value: tnx20, unit: 'bp', digits: 0, ...cuts(-75, 75, [-RULES.rates.move20dBp, RULES.rates.move20dBp], ['favorable', 'neutral', 'burden'], [[-RULES.rates.move20dBp, `−${RULES.rates.move20dBp}`], [RULES.rates.move20dBp, `+${RULES.rates.move20dBp}`]]) });
  const wti20 = rateFx?.wti20 ?? null;
  const dxy20 = rateFx?.dxy20 ?? null;
  const dollarLine = rateFx?.dxyPosition != null && rateFx.dxyPosition >= RULES.dollar.rangeHighAt ? RULES.dollar.rise20dPct : RULES.dollar.rise20dPct + RULES.dollar.bufferPct;
  const commodityTrigger = stateOf('commodities') !== 'burden' ? 'dollar'
    : rateFx?.wtiHigh ? 'oil-range' : wti20 != null && wti20 >= RULES.oil.rise20dPct ? 'oil-change' : 'dollar';
  const commodities = commodityTrigger === 'oil-range'
    ? gauge({ label: 'WTI 1년 범위 내 위치', value: rateFx.wtiPosition * 100, unit: '%', digits: 0, ...cuts(0, 100, [RULES.oil.rangeHighAt * 100], ['neutral', 'burden'], [[RULES.oil.rangeHighAt * 100, `${RULES.oil.rangeHighAt * 100}%`]]) })
    : commodityTrigger === 'oil-change'
      ? gauge({ label: 'WTI 20일 변화', value: wti20, unit: '%', digits: 1, ...cuts(-20, 20, [RULES.oil.fall20dPct, RULES.oil.rise20dPct], ['favorable', 'neutral', 'burden'], [[RULES.oil.fall20dPct, `${RULES.oil.fall20dPct}%`], [RULES.oil.rise20dPct, `+${RULES.oil.rise20dPct}%`]]) })
      // v57.84 (threshold consolidation): the burden band starts where dollarRiseBurden() does — rise20dPct + bufferPct, or
      // rise20dPct at the top of the dollar's one-year range — and the falling band is favourable only when the axis is (easing
      // needs oil falling too). DXY +2.2% read 중립 on the axis with the pin in the burden band.
      : gauge({ label: '달러 인덱스 20일 변화', value: dxy20, unit: '%', digits: 1, ...cuts(-5, 5, [0, dollarLine], [stateOf('commodities') === 'favorable' ? 'favorable' : 'neutral', 'neutral', 'burden'], [[dollarLine, `+${dollarLine}%`]]) });
  return {
    rates: { gauge: rates, headline: tnx20 == null ? null : `10년물 20일 ${signed(tnx20, 0, 'bp')}` },
    // P1726: the 5-session WTI move is named when it runs against the 20-session direction.
    commodities: { gauge: commodities, headline: wti20 == null ? null : `WTI 20일 ${signed(wti20, 1, '%')}${rateFx?.wti5 != null && Math.abs(rateFx.wti5) >= RULES.oil.turn5dPct && Math.sign(rateFx.wti5) !== Math.sign(wti20) ? `(최근 5일 ${signed(rateFx.wti5, 1, '%')})` : ''} · 달러 ${signed(dxy20, 1, '%')}` },
    credit: { gauge: credit, headline: hyBp == null ? null : `하이일드 ${hyBp.toFixed(0)}bp${hy5 == null ? '' : ` (5거래일 ${signed(hy5, 0, 'bp')}${creditBy20 ? ` · 20거래일 ${signed(record20.value, 0, 'bp')}` : ''})`}` },
    korea: stateOf('korea') === 'burden' && (rateFx?.krw20 == null || rateFx.krw20 < RULES.fx.krwMove20dPct) && rateFx?.jpy20 != null && rateFx.jpy20 <= -RULES.fx.yenRally20dPct
      ? { gauge: gauge({ label: '엔화 20일 강세 폭 (엔/달러 하락률)', value: -rateFx.jpy20, unit: '%', digits: 1, ...cuts(-5, 8, [RULES.fx.yenRally20dPct], ['neutral', 'burden'], [[RULES.fx.yenRally20dPct, `+${RULES.fx.yenRally20dPct}% 엔 급강세`]]) }), headline: `엔화 20일 ${signed(-rateFx.jpy20, 1, '%')} 강세` }
      // v57.86 (live review): a won past −2% held at 중립 (KOSPI contradicts, last-day turn, endpoint-only) drew its pin in the
      // favourable band — each outer band takes its tone only when the axis reached it, as the dollar gauge does.
      : { gauge: gauge({ label: '원/달러 20일 변화', value: rateFx?.krw20 ?? null, unit: '%', digits: 1, ...cuts(-5, 5, [-RULES.fx.krwMove20dPct, RULES.fx.krwMove20dPct], [stateOf('korea') === 'favorable' ? 'favorable' : 'neutral', 'neutral', stateOf('korea') === 'burden' ? 'burden' : 'neutral'], [[-RULES.fx.krwMove20dPct, `−${RULES.fx.krwMove20dPct}%`], [RULES.fx.krwMove20dPct, `+${RULES.fx.krwMove20dPct}%`]]) }), headline: rateFx?.krw20 == null ? null : `원/달러 20일 ${signed(rateFx.krw20, 1, '%')}` }
  };
}

// v57.50 D16/D17: a direction is set only by a signal past its cut. Within the dead band (growth: half the
// slowdown step around the cut; prices: |3-month pace − year| below the re-acceleration step) the direction is held,
// and "no slowdown signal" alone is no longer read as 견조 — 견조 needs the payroll level the growth axis calls solid.
export const REGIME_CRITERIA = `성장 방향: Sahm 지표 ${G.sahmWatchAt}%p 이상이거나 최근 3개월 일자리 증가가 그 전 3개월보다 ${G.payrollSlowdownK / 10}만 명 넘게 적으면 둔화 · 둔화 신호가 없고 3개월 평균이 ${G.payrollSolidK / 10}만 명 이상이면 견조 · 둘 다 아니면 확인 안 됨 · 둔화 기준과의 차이가 ${G.payrollSlowdownK / 2}천 명 미만이면 근소(경계)로 보고 방향을 정하지 않음. 물가 방향: 근원 PCE와 근원 CPI 각각의 최근 3개월 속도(연율)와 전년 대비의 차이가 ${I.reaccelPp}%p 이상이면 그 쪽(빠르면 상승, 느리면 둔화) · 두 지표가 같은 쪽이면 그 방향, 반대쪽이면 엇갈림, 한쪽이라도 ${I.reaccelPp}%p 미만이면 방향 보류(각 지표의 가장 최근 발표 기준). 두 방향이 모두 정해질 때만 사분면을 표시합니다.`;

/** Growth × inflation direction — the classic four-regime frame, with its historical tendency as 해석. */
// Expert review M12: a quarter or month label for the observation a regime input reads ("26년 2분기", "9월").
export function periodLabel(date, frequency) {
  const [year, month] = String(date || '').split('-').map(Number);
  if (!year || !month) return '';
  if (frequency === 'quarterly') return `${String(year).slice(2)}년 ${Math.floor((month - 1) / 3) + 1}분기`;
  return `${String(year).slice(2)}년 ${month}월`;
}

function buildRegime(growth, inflation, mh = null) {
  const g = growth.detail;
  const i = inflation.detail;
  // Expert review M12 → v57.50 D16/D17: a direction inside its dead band is held (근소 · 경계), not decided; the read names
  // the month each input describes — the GDP card below can be a quarter older than the payroll month the quadrant reads.
  const growthMargin = g?.payroll && g?.sahm && g.sahm.value < G.sahmWatchAt ? g.payroll.avg3 - (g.payroll.prior3 - G.payrollSlowdownK) : null;
  // v57.81 (audit X1): the inflation direction is the shared PCE·CPI flag (inflationAxis detail.direction).
  const dirFlag = i?.direction && i.direction.state !== 'unknown' ? i.direction : null;
  const inflationMargin = i?.pace && (i.paceYoy ?? i.yoy) != null ? i.pace.value - (i.paceYoy ?? i.yoy) : null;
  const splitShort = dirFlag?.state === 'mixed' ? [dirFlag.pce, dirFlag.cpi].map((row) => `${row.name}${row.month ? ` ${row.month}` : ''} ${row.dir === 'up' ? '재가속' : '둔화'}`).join(' · ') : null;
  const flatNote = dirFlag?.state === 'flat' ? [dirFlag.pce, dirFlag.cpi].filter(Boolean).filter((row) => row.dir === 'flat').map((row) => `${row.name} 3개월 연율과 전년 대비의 차이 ${Math.abs(row.margin).toFixed(1)}%p(${I.reaccelPp}%p 미만)`).join(' · ') : null;
  const near = {
    growth: growthMargin != null && Math.abs(growthMargin) < G.payrollSlowdownK / 2 ? `일자리 3개월 평균이 둔화 기준(직전 3개월 − ${G.payrollSlowdownK}천 명 = ${(g.payroll.prior3 - G.payrollSlowdownK).toFixed(0)}천 명)과 ${Math.abs(growthMargin).toFixed(0)}천 명 차이(기준 ${G.payrollSlowdownK}천 명의 절반 미만)` : null,
    inflation: dirFlag ? flatNote || null : inflationMargin != null && Math.abs(inflationMargin) < I.reaccelPp ? `근원 PCE 3개월 연율과 전년 대비의 차이 ${Math.abs(inflationMargin).toFixed(1)}%p(${I.reaccelPp}%p 미만)` : null
  };
  let growthDir = null;
  let growthHeld = null;
  if (g?.payroll && g?.sahm) {
    if (g.sahm.value >= G.sahmWatchAt) growthDir = 'down';
    else if (near.growth) growthHeld = '근소(경계)';
    else if (growthMargin < 0) growthDir = 'down';
    else if (g.payroll.avg3 >= G.payrollSolidK) growthDir = 'up';
    else growthHeld = '확인 안 됨';
  } else if (growth.state === 'burden') growthDir = 'down';
  else if (growth.state === 'favorable') growthDir = 'up';
  let inflationDir = null;
  let inflationHeld = null;
  if (dirFlag) {
    if (dirFlag.dir) inflationDir = dirFlag.dir;
    else inflationHeld = dirFlag.state === 'mixed' ? '엇갈림' : '방향 보류';
  } else if (i?.pace && i.yoy != null) {
    if (near.inflation) inflationHeld = '방향 보류';
    else inflationDir = inflationMargin > 0 ? 'up' : 'down';
  } else if (inflation.state === 'burden') inflationDir = 'up';
  else if (inflation.state === 'favorable') inflationDir = 'down';
  const provisional = !(g?.payroll && g?.sahm && i?.pace);
  const held = { growth: growthHeld, inflation: inflationHeld };
  const gdpLast = mh ? seriesOf(mh, 'realGdp').at(-1) : null;
  const asOfNote = [g?.payroll ? `고용 ${periodLabel(g.payroll.date)}` : null, i?.pace ? `근원 PCE ${periodLabel(i.pace.date)}` : null, dirFlag?.cpi?.date ? `근원 CPI ${periodLabel(dirFlag.cpi.date)}` : null].filter(Boolean).join(' · ');
  const timing = asOfNote ? `사분면은 ${asOfNote} 기준입니다${gdpLast ? ` — 아래 실질 GDP 카드는 ${periodLabel(gdpLast.date, 'quarterly')} 기준이라 더 이른 시점입니다` : ''}. 각 지표의 가장 최근 발표를 씁니다.` : null;
  // v57.50 D18: the quadrant reads the 3-month SPEED of prices, so its label says "물가 속도 둔화" — beside an inflation
  // axis that can still read 부담 on the level. Regime readings describe what tended to happen, not where to allocate.
  const table = {
    'up/down': { id: 'goldilocks', label: '성장 견조 · 물가 속도 둔화', tone: 'favorable', reading: '이익이 늘면서 금리 부담은 줄어드는 조합입니다. 과거 사례에서 주식이 강했던 경우가 있었지만 항상 그런 것은 아니며, 이 설명은 사례 기반이라 지금의 예측이 아닙니다.' },
    'up/up': { id: 'reflation', label: '성장 견조 · 물가 상승', tone: 'neutral', reading: '이익은 늘지만 금리가 오르기 쉬운 조합입니다. 과거 이런 국면에서는 금리에 민감한 성장주의 변동이 컸던 경향이 있습니다. 사례 기반의 설명이며 지금의 예측이 아닙니다.' },
    'down/up': { id: 'stagflation', label: '성장 둔화 · 물가 상승', tone: 'burden', reading: '이익은 줄고 연준은 금리를 내리기 어려운 조합으로, 주식과 채권이 함께 약했던 경우가 많습니다(1970년대, 2022년). 사례 기반의 설명이며 지금의 예측이 아닙니다.' },
    'down/down': { id: 'disinflation-slowdown', label: '성장 둔화 · 물가 속도 둔화', tone: 'neutral', reading: '역사적으로 금리 인하 기대에 채권이 강해진 국면이었고, 주식은 경기 둔화의 깊이에 따라 엇갈렸습니다. 이 설명은 사례 기반의 역사적 경향이며, 지금 관측된 10년물 움직임과 별개입니다 — 금리의 현재 상태는 시장 상태 화면(금리 축)에서 확인합니다.' }
  };
  const key = growthDir && inflationDir ? `${growthDir}/${inflationDir}` : null;
  // Codex browser audit H14: the quadrant could not be reproduced from the screen. Each rule is listed with the
  // value it read, the threshold and the outcome, so the placement can be recomputed from these rows alone.
  const n = (value, digits = 1) => (value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits));
  const inputs = [
    g?.sahm ? ['Sahm 지표', `${n(g.sahm.value, 2)}%p`, `${G.sahmWatchAt}%p 이상이면 둔화`, g.sahm.value >= G.sahmWatchAt ? '둔화 신호' : '기준 미만'] : ['Sahm 지표', '—', `${G.sahmWatchAt}%p 이상이면 둔화`, '자료 없음'],
    g?.payroll ? ['일자리 증가 3개월 평균', `${n(g.payroll.avg3, 0)}천 명 (직전 3개월 ${n(g.payroll.prior3, 0)}천 명)`, `직전보다 ${G.payrollSlowdownK}천 명 넘게 적으면 둔화 · ${G.payrollSolidK}천 명 이상이면 견조`, growthHeld ? (near.growth ? '경계 · 방향 보류 (근소)' : `${growthHeld} — 방향 보류`) : g.sahm && g.sahm.value >= G.sahmWatchAt ? '판정은 Sahm 지표' : growthDir === 'down' ? '둔화 신호' : '견조'] : ['일자리 증가 3개월 평균', '—', '직전 3개월과 비교', '자료 없음'],
    ...(dirFlag ? [dirFlag.pce, dirFlag.cpi].filter(Boolean).map((row) => [`${row.name}${row.month ? ` (${row.month})` : ''}`, `최근 3개월 연율 ${n(row.pace)}% · 전년 대비 ${n(row.yoy)}%`, `차이 ${I.reaccelPp}%p 이상이면 그 방향(빠르면 상승, 느리면 둔화)`, row.dir === 'up' ? '상승 방향' : row.dir === 'down' ? '둔화 방향' : `방향 없음 (차이 ${n(Math.abs(row.margin))}%p)`])
      : [i?.pace && i.yoy != null ? ['근원 PCE', `최근 3개월 연율 ${n(i.pace.value)}% · 전년 대비 ${n(i.paceYoy ?? i.yoy)}%`, `차이 ${I.reaccelPp}%p 이상이면 그 방향(빠르면 상승, 느리면 둔화)`, inflationHeld ? `${inflationHeld} (차이 ${n(Math.abs(inflationMargin))}%p)` : inflationDir === 'up' ? '상승 방향' : '둔화 방향'] : ['근원 PCE', '—', '3개월 연율과 전년 대비 비교', '자료 없음']]),
    ...(dirFlag && !dirFlag.single ? [['물가 방향 (두 지표)', dirFlag.label, '두 지표가 같은 쪽이어야 방향 · 반대면 엇갈림', inflationDir ? (inflationDir === 'up' ? '상승 방향' : '둔화 방향') : `${inflationHeld} — 방향 보류`]] : [])
  ];
  const picked = key ? table[key] : null;
  if (picked) return { ...picked, available: true, provisional, growthDir, inflationDir, criteria: REGIME_CRITERIA, inputs, near, held, timing, inflationSplit: null };
  // v57.50 D16/D17: say which direction is held and why, instead of a bare "판정 보류".
  const heldParts = [
    growthHeld ? `성장 방향 ${growthHeld}` : growthDir ? null : '성장 방향 자료 부족',
    inflationHeld ? `물가 방향 ${inflationHeld}${splitShort ? `(${splitShort})` : ''}` : inflationDir ? null : '물가 방향 자료 부족'
  ].filter(Boolean);
  const knownParts = [growthDir ? `성장 ${growthDir === 'up' ? '견조' : '둔화'}` : null, inflationDir ? `물가 속도 ${inflationDir === 'up' ? '상승' : '둔화'}` : null].filter(Boolean);
  const reading = `${heldParts.join(' · ')} — 사분면을 확정하지 않습니다${knownParts.length ? ` — 정해진 쪽은 ${knownParts.join(' · ')}입니다` : ''}. 기준과의 차이가 커지는 다음 발표에서 다시 판정합니다.`;
  return { available: false, label: '국면 판정 보류', tone: 'unknown', reading, provisional: true, growthDir, inflationDir, criteria: REGIME_CRITERIA, inputs, near, held, timing, inflationSplit: splitShort };
}

/** The transmission chain: oil → inflation expectations → policy path → long rates → valuations, plus
 *  the dollar and credit branches. Each node shows its move; a link is drawn as active only when both
 *  ends moved the same way past the stated thresholds. */
function buildChain({ macro, regime, rateFx, oil = null, mh = null }) {
  const axisById = Object.fromEntries((regime?.axes || []).map((row) => [row.id, row]));
  const fx = rateFx || {};
  const wti20 = fx.wti20 ?? null;
  // Expert review M06: WTI alone read as easing oil while Brent rose sharply; such a node is held, not coloured favourable.
  // P1726: a same-day Brent-WTI gap far outside its usual range (abnormal) holds the node as well — neither the
  // Brent reading nor "WTI 하락 = 물가 완화" is drawn from a pair that may not be comparable.
  // v57.81 (audit X4): the one shared Brent/WTI rule (macro-signals oilDivergence) — the rate hub, the scenario conditions and
  // this node no longer disagree (WTI −7.2% drawn ▼ beside "두 유가의 방향이 달라 하락으로 보지 않습니다").
  const oilHeld = oilDivergence(oil).held;
  // P1726 (P1592 pattern): a 5-session move against the 20-session direction is named beside it (direction unchanged).
  const wti5 = fx.wti5 ?? null;
  const oilShort = wti20 != null && wti5 != null && Math.abs(wti5) >= RULES.oil.turn5dPct && Math.sign(wti5) !== Math.sign(wti20) ? `(최근 5일 ${signed(wti5, 1, '%')} ${wti5 > 0 ? '반등' : '반락'})` : '';
  // P1528 (audit H17): a real yield and a breakeven observed on different days are not comparable. The briefing already
  // holds them apart (market-read splitHeld); the chain must not draw or compare their 5-day moves either.
  const asOfDay = (value) => String(value || '').slice(0, 10);
  const splitReal = !!(macro._asOf_realYield10 && macro._asOf_breakeven10 && asOfDay(macro._asOf_realYield10) !== asOfDay(macro._asOf_breakeven10));
  const bei5 = splitReal ? null : finite(macro.breakeven10Delta5);
  // Macro audit 2026-10-17: the same midpoint as the 통화정책 axis — upper − 0.125 assumed a 25bp-wide range.
  const pricing = policyPricing(macro).pricing;
  const tnx20 = fx.tnx20 ?? null;
  const real5 = splitReal ? null : finite(macro.realYield10Delta5);
  const dxy20 = fx.dxy20 ?? null;
  const hy5 = finite(macro.hyOASDelta5);
  // v57.50 (coordinator rule): "안정" is said only when creditState() is favorable — the same verdict as the 시장 상태 credit
  // axis. A small 5-day move alone is not calm (the level or a 20-session widening can still hold the axis at 중립/부담).
  const creditVerdict = axisById.credit?.state || creditState({ hyBp: finite(macro.hyOAS) == null ? null : finite(macro.hyOAS) * 100, hy5: hy5 == null ? null : hy5 * 100, hy20: hyDelta20Bp(mh)?.value ?? null, pcr: null });
  // Codex audit F06: a 부담 names the input that decided it (level / 5-session / 20-session record), never a fixed "수준".
  const hyBpNow = finite(macro.hyOAS) == null ? null : finite(macro.hyOAS) * 100;
  const record20 = mh ? hyWidening20Record(mh) : null;
  const cause = creditCause({ hyBp: hyBpNow, hy5: hy5 == null ? null : hy5 * 100, hy20Record: record20 });
  const burdenText = cause.level ? `스프레드 수준(${Math.round(hyBpNow)}bp)이 부담 구간(${RULES.credit.stressAtBp}bp 이상)입니다(시장 상태 신용 지표 부담)`
    : cause.wide20 ? `수준(${Math.round(hyBpNow)}bp)은 부담 구간이 아니지만 20거래일 ${signed(record20.value, 0, 'bp')} 확대가 ${record20.pct >= 100 ? '지난 1년 중 가장 큰 폭이' : `지난 1년 변화의 ${record20.pct}백분위`}라 부담입니다(시장 상태 신용 지표 부담)`
      : '신용 지표가 부담입니다 — 수준과 5·20거래일 변화를 함께 확인하세요(시장 상태 신용 지표 부담)';
  const creditCalm = creditVerdict === 'favorable' ? '신용 시장은 안정적입니다(시장 상태 신용 지표 양호)'
    : creditVerdict === 'burden' ? burdenText
      : creditVerdict === 'neutral' ? '5거래일 변화는 작지만 신용 지표는 중립입니다 — 수준이나 20거래일 변화 때문에 안정으로 보지 않습니다'
        : '신용 지표 판정 보류 — 스프레드 기록을 기다립니다';
  const dir = (value, up, down) => value == null ? 'unknown' : value >= up ? 'up' : value <= down ? 'down' : 'flat';
  const nodes = [
    { id: 'oil', label: '유가 (WTI)', held: oilHeld, value: wti20 == null ? '—' : `20일 ${signed(wti20, 1, '%')}${oilShort}${oilHeld ? (oil?.abnormal ? ' · 브렌트 비교 보류' : ` · 브렌트 ${signed(oil.brent20, 1, '%')}`) : ''}`, dir: fx.wtiHigh && wti20 != null && wti20 > RULES.oil.fall20dPct ? 'up' : dir(wti20, RULES.oil.rise20dPct, RULES.oil.fall20dPct) },
    { id: 'breakeven', label: '기대인플레이션', value: bei5 == null ? (splitReal ? '기준일이 달라 보류' : '—') : `5거래일 ${signed(bei5 * 100, 0, 'bp')}`, dir: dir(bei5 == null ? null : bei5 * 100, RULES.breakeven.move5dBp, -RULES.breakeven.move5dBp) },
    { id: 'policy', label: '연준 경로 (2년물)', value: pricing == null ? '—' : pricing >= P.pricedMovePp ? `기준금리 대비 ${signed(pricing, 2, '%p')}` : pricing <= -P.pricedMovePp ? `기준금리 대비 ${signed(pricing, 2, '%p')}` : '동결 근접', dir: dir(pricing, P.pricedMovePp, -P.pricedMovePp) },
    { id: 'rates', label: '장기금리 (10년물)', value: tnx20 == null ? '—' : `20일 ${signed(tnx20, 0, 'bp')}`, dir: dir(tnx20, RULES.rates.move20dBp, -RULES.rates.move20dBp) },
    { id: 'valuation', label: '주식 밸류에이션 압력(해석)', inferred: true, value: axisById.rates ? `관측 아님 · 금리 지표 ${axisById.rates.stateLabel}에서 추론` : '—', dir: axisById.rates?.state === 'burden' ? 'down' : axisById.rates?.state === 'favorable' ? 'up' : 'flat' }
  ];
  const links = [];
  // v57.91: the full Brent–WTI paragraph is shown once, under the WTI chart (macro-board); the chain and the axis point there.
  if (oilHeld) links.push('유가 고리는 브렌트와 WTI가 엇갈려 판단을 보류합니다 — 두 유가의 같은 날 비교는 WTI 원유 차트 설명에 있습니다.');
  if (!oilHeld && nodes[0].dir !== 'unknown' && nodes[0].dir !== 'flat' && nodes[0].dir === nodes[1].dir) links.push(`유가(20일)와 기대인플레이션(5거래일)이 함께 ${nodes[0].dir === 'up' ? '오르고' : '내리고'} 있습니다 — 유가가 물가 예상으로 옮겨 가는 경로와 같은 방향이지만, 관측 기간이 달라 인과를 확인한 것은 아닙니다.`);
  // P1449: 2년물은 프리미엄을 분리하지 못한 대용 지표 — 링크 문장도 해석 단정 대신 관측을 말한다.
  if (nodes[2].dir === 'up') links.push('2년물이 기준금리 중간값보다 높습니다. 기간 프리미엄이 섞여 있어 추가 인상 예상으로 단정하지 않습니다.');
  if (nodes[2].dir === 'down') links.push('2년물이 기준금리 중간값보다 낮습니다. 기간 프리미엄이 섞여 있어 인하 예상으로 단정하지 않습니다.');
  if (!oilHeld && nodes[0].dir === 'up' && nodes[1].dir !== 'up') links.push(fx.wtiHigh ? '유가가 1년 범위 상단에 있어 물가 부담 요인입니다.' : `유가가 20일 동안 ${signed(wti20, 1, '%')} 올랐습니다 — 아직 기대인플레이션으로 크게 번지지는 않았습니다.`);
  if (nodes[3].dir === 'up') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 올랐습니다${real5 != null && bei5 != null && real5 > bei5 && real5 > 0 ? ' — 실질금리 우위는 5거래일 관측 기준이며(20일 전체 분해는 자료가 없음), 그 관측은 성장주 밸류에이션 부담 쪽과 같은 방향입니다' : ''}.`);
  if (nodes[3].dir === 'down') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 내려 할인율 부담이 줄고 있습니다.`);
  // Codex browser audit H15: when two neighbours on the textbook path moved in opposite directions, the arrow is
  // not working right now — say so as a question to check, instead of letting the drawn arrow imply it does.
  for (const [a, b] of [[0, 1], [1, 3]]) { // the policy node is a level against the target, not a move
    const from = nodes[a];
    const to = nodes[b];
    if (from.held) continue;
    if (!['up', 'down'].includes(from.dir) || !['up', 'down'].includes(to.dir) || from.dir === to.dir) continue;
    links.push(`${from.label}(${from.dir === 'up' ? '상승' : '하락'})와 ${to.label}(${to.dir === 'up' ? '상승' : '하락'})가 반대로 움직였습니다 — 이 고리가 지금은 작동하지 않는 이유(다른 요인이 더 크거나, 관측 기간이 달라서)를 확인할 지점입니다.`);
  }
  const branches = [
    { id: 'dollar', label: '달러', value: dxy20 == null ? '—' : `20일 ${signed(dxy20, 1, '%')}`, dir: dir(dxy20, RULES.dollar.rise20dPct, RULES.dollar.fall20dPct), effect: dxy20 == null ? null : dxy20 >= RULES.dollar.rise20dPct ? '달러 강세 → 미국 다국적 기업의 해외 매출 환산 감소, 신흥국·원화 약세(외국인 순매도 압력)' : dxy20 <= RULES.dollar.fall20dPct ? '달러 약세 → 해외 매출 환산 증가, 신흥국·원화에 우호적' : '달러는 큰 방향 없이 움직이고 있습니다' },
    { id: 'credit', label: '하이일드 스프레드', value: hy5 == null ? '—' : `5거래일 ${signed(hy5 * 100, 0, 'bp')}${cause.wide20 && finite(record20?.value) != null ? ` · 20거래일 ${signed(record20.value, 0, 'bp')}` : ''}`, dir: dir(hy5 == null ? null : hy5 * 100, RULES.credit.widen5dBp, -RULES.credit.widen5dBp), effect: hy5 == null ? null : hy5 * 100 >= RULES.credit.widen5dBp ? '스프레드 확대 → 기업 자금 조달 비용 상승, 주식 위험 프리미엄 상승' : hy5 * 100 <= -RULES.credit.widen5dBp ? '스프레드 축소 → 자금 조달 여건 개선' : creditCalm }
  ];
  // Colour by effect on stocks: every node rising is a headwind except valuation, where a fall is.
  const impact = (node) => node.dir === 'unknown' || node.dir === 'flat' ? node.dir : (node.id === 'valuation' ? node.dir === 'down' : node.dir === 'up') ? 'burden' : 'favorable';
  // P1599 (A04): the 'not causation' caveat is stated once, in the section lead above the chain; the legend keeps the thresholds.
  const legend = `▲▼ 기준(시장 상태와 같음): 유가 20일 +${RULES.oil.rise20dPct}% 이상 또는 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상 / ${RULES.oil.fall20dPct}% 이하 · 기대인플레이션 5거래일 ±${RULES.breakeven.move5dBp}bp · 2년물 − 기준금리 ±${P.pricedMovePp}%p · 10년물 20일 ±${RULES.rates.move20dBp}bp · 달러 20일 ±${RULES.dollar.rise20dPct}% · 하이일드 스프레드 5거래일 ±${RULES.credit.widen5dBp}bp. 빨간 테두리는 주식에 부담, 초록은 양호.`;
  return { nodes: nodes.map((node) => ({ ...node, impact: node.held ? 'unknown' : impact(node) })), links, branches: branches.map((node) => ({ ...node, impact: impact(node) })), legend };
}

/** 20-session changes on the completed-close basis (the 시장 상태 basis). */
export function closeChanges(history = []) {
  const basis = closeBasis(history);
  const change = (field, kind, sessions = 20) => {
    const series = buildCloseSeries(history, field, { through: basis });
    const point = closeSessionPointBack(series, sessions); // M01 → v57.50: the 시장 상태 session helper on the same close series
    if (!point) return null;
    const last = series[series.length - 1].value;
    const back = point.value;
    return kind === 'bp' ? (last - back) * 100 : (last / back - 1) * 100;
  };
  const wti = buildCloseSeries(history, 'wti', { through: basis });
  const last = wti[wti.length - 1];
  const year = last ? wti.filter((row) => Date.parse(row.date) >= Date.parse(last.date) - 365 * 86400000).map((row) => row.value) : [];
  const wtiPosition = year.length > 20 ? (last.value - Math.min(...year)) / ((Math.max(...year) - Math.min(...year)) || 1) : null;
  const position = (field) => {
    const series = buildCloseSeries(history, field, { through: basis });
    const end = series[series.length - 1];
    const year = end ? series.filter((row) => Date.parse(row.date) >= Date.parse(end.date) - 365 * 86400000).map((row) => row.value) : [];
    return year.length > 20 ? (end.value - Math.min(...year)) / ((Math.max(...year) - Math.min(...year)) || 1) : null;
  };
  return { basis, wti20: change('wti'), wti5: change('wti', 'pct', 5), dxy20: change('dxy'), tnx20: change('tnx', 'bp'), gold20: change('gold'), krw20: change('usdkrw'), jpy20: change('usdjpy'), wtiPosition, wtiHigh: wtiPosition != null && wtiPosition >= RULES.oil.rangeHighAt, tnxPosition: position('tnx'), dxyPosition: position('dxy') };
}

// v57.50 I04: where the 거시 경제 / 금리 · 환율 reading continues. Links follow the axis states and name why; sectors are
// pointed to through the observed rotation (테마 · 섹터), never through an assumed macro beta per industry.
export function macroNextSteps(read) {
  const byId = Object.fromEntries((read?.axes || []).map((row) => [row.id, row]));
  const state = (id) => byId[id]?.state || 'unknown';
  const label = (id) => byId[id]?.stateLabel || '판정 보류';
  const next = [];
  if (state('rates') === 'burden' || state('rates') === 'neutral') next.push({ route: 'fxbond', label: '금리 · 환율', why: `금리 · 할인율 ${label('rates')} — 수익률 곡선·실질금리 중 어디에서 오는지` });
  const SHORT = { inflation: '물가', rates: '금리', commodities: '유가·달러' };
  const pressure = ['inflation', 'rates', 'commodities'].filter((id) => state(id) === 'burden').map((id) => SHORT[id]);
  next.push({ route: 'themes', label: '테마 · 섹터', why: pressure.length
    ? `${pressure.join(' · ')} 부담 속에서 실제로 시장보다 강한 섹터가 어디인지(섹터 회전 관측)`
    : '지금의 거시 국면에서 실제로 시장보다 강한 섹터가 어디인지(섹터 회전 관측)' });
  next.push({ route: 'signal', label: '시장 상태', why: `금리·유가와 달러·신용은 시장 상태와 같은 판정 — 추세·시장 폭까지 합친 6개 지표 전체(신용 ${label('credit')})` });
  next.push({ route: 'briefing', label: '브리핑', why: '다음 7일 고용·물가·연준 발표 일정과 오늘 종가 해석' });
  return next;
}

export function ratesNextSteps({ read = null, carry = null } = {}) {
  const byId = Object.fromEntries((read?.axes || []).map((row) => [row.id, row]));
  const label = (id) => byId[id]?.stateLabel || '판정 보류';
  const next = [{ route: 'macro', label: '거시 경제', why: `물가 ${label('inflation')} · 통화정책 ${label('policy')} — 금리 경로를 움직이는 쪽` }];
  next.push({ route: 'signal', label: '시장 상태', why: `금리(${label('rates')})와 추세·시장 폭을 합친 판정${carry?.available ? ` (환율은 참고로 따로 표시 · 엔화 20일 ${signed(carry.yenStrength, 1, '%')})` : ''}` });
  if (byId.rates?.state === 'burden' || byId.rates?.state === 'favorable') next.push({ route: 'themes', label: '테마 · 섹터', why: `금리 ${label('rates')} 국면에서 섹터 회전(선도·후행)이 어떻게 나타나는지` });
  next.push({ route: 'briefing', label: '브리핑', why: '다음 7일 국채·물가·연준 일정과 오늘 금리·달러 움직임 해석' });
  return next;
}

export function buildMacroRead({ macro = null, macroHistory = null, regime = null, rateFx = null, history = null } = {}) {
  if (!rateFx && Array.isArray(history)) rateFx = closeChanges(history);
  const m = macro && typeof macro === 'object' ? macro : {};
  const mh = macroHistory?.schemaVersion === 'macro-history.v1' ? macroHistory : null;
  const gauges = sharedGauges({ macro: m, rateFx: { ...(rateFx || {}), hy20: hyDelta20Bp(mh)?.value ?? null, hy20Record: mh ? hyWidening20Record(mh) : null }, regime });
  const oil = brentWtiCheck(macroHistory, Array.isArray(history) ? history : []);
  const growth = growthAxis({ macro: m, mh });
  const inflation = inflationAxis({ macro: m, mh });
  const policy = policyAxis({ macro: m, inflationState: inflation.state, growthState: growth.state });
  const axes = [
    growth, inflation, policy,
    reuse(regime, 'rates', '금리 · 할인율', '10년물 금리는 주식 가치를 계산하는 할인율의 기준입니다. 빠르게 오르면 PER이 높은 성장주부터 부담을 받습니다.', gauges.rates),
    { ...reuse(regime, 'commodities', '유가 · 달러', '유가는 물가(에너지는 CPI의 약 7%)와 소비 여력에, 달러는 해외 매출 환산과 신흥국 자금 흐름에 영향을 줍니다.', gauges.commodities), caveat: oilDivergence(oil).held ? '두 유가(브렌트·WTI)의 같은 날 비교는 WTI 원유 차트 설명에 있습니다.' : null },
    reuse(regime, 'credit', '신용', '하이일드 스프레드가 넓어지면 기업 자금 조달이 어려워지고, 주식 하락이 신용 위험으로 번지고 있다는 신호가 됩니다.', gauges.credit)
  ];
  const known = axes.filter((row) => row.state !== 'unknown');
  const count = (state) => known.filter((row) => row.state === state).length;
  const macroRegime = buildRegime(growth, inflation, mh);
  const historyStatus = !mh ? 'missing' : mh.status === 'awaiting-first-producer-run' ? 'awaiting' : Object.keys(mh.series || {}).length ? 'ok' : 'missing';
  return {
    available: known.length > 0,
    historyStatus,
    historyAsOf: mh?.generatedAt || null,
    regime: macroRegime,
    axes,
    counts: { favorable: count('favorable'), neutral: count('neutral'), burden: count('burden'), unknown: axes.length - known.length },
    chain: buildChain({ macro: m, regime, rateFx, oil, mh }),
    oil,
    sharedGauges: gauges,
    labels: { monthDay, monthLabel }
  };
}
