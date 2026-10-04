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

import { buildCloseSeries, closeBasis } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';

const G = RULES.growth;
const I = RULES.inflation;
const P = RULES.policy;

const STATE_LABELS = Object.freeze({ favorable: '우호', neutral: '중립', burden: '부담', unknown: '판정 보류' });

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
  else if ((sahm && sahm.value >= G.sahmRecessionAt) || (payroll && payroll.avg3 < 0) || (!payroll && nfp != null && nfp < 0)) state = 'burden';
  else if (sahm && sahm.value < G.sahmWatchAt && payroll && payroll.avg3 >= G.payrollSolidK) state = 'favorable';
  const partial = !sahm || !payroll ? ' 3개월 추세와 Sahm 지표는 월별 기록이 쌓이면 반영됩니다.' : '';
  const read = state === 'burden'
    ? (sahm && sahm.value >= G.sahmRecessionAt ? `실업률 3개월 평균이 1년 저점보다 ${sahm.value.toFixed(2)}%p 높아 Sahm 경기침체 신호(${G.sahmRecessionAt}%p)를 넘었습니다.` : '일자리가 줄고 있습니다 — 경기 둔화가 고용으로 번졌습니다.')
    : state === 'favorable' ? '고용이 꾸준히 늘고 실업률이 안정적입니다 — 기업 이익의 바탕이 되는 소비가 버티는 환경입니다.'
      : state === 'unknown' ? '고용 자료를 기다리는 중입니다.'
        : `고용 증가가 느려졌거나 실업률이 조금씩 오르는 중간 구간입니다.${partial}`;
  const payrollTriggered = state === 'burden' && !(sahm && sahm.value >= G.sahmRecessionAt);
  const growthGauge = sahm && !payrollTriggered ? gauge({ label: 'Sahm 지표 (실업률 3개월 평균 − 1년 저점)', value: sahm.value, unit: '%p', digits: 2, ...cuts(0, 1, [G.sahmWatchAt, G.sahmRecessionAt], ['favorable', 'neutral', 'burden'], [[G.sahmWatchAt, `${G.sahmWatchAt}`], [G.sahmRecessionAt, `침체 신호 ${G.sahmRecessionAt}`]]) })
    : payroll ? gauge({ label: '일자리 3개월 평균 (천 명)', value: payroll.avg3, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) })
      : nfp != null ? gauge({ label: '일자리 증감 (최근 1개월, 천 명)', value: nfp, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) }) : null;
  return axis('growth', '성장 (고용 · 소비)', state, {
    gauge: growthGauge,
    headline: sahm ? `Sahm ${sahm.value.toFixed(2)}%p` : unrate == null ? null : `실업률 ${unrate.toFixed(1)}%`,
    evidence: [
      ['실업률', unrate == null ? null : `${unrate.toFixed(1)}%${finite(macro.unemploymentDelta) != null ? ` (전월 ${signed(finite(macro.unemploymentDelta), 1, '%p')})` : ''}`],
      ['Sahm 지표', sahm ? `${sahm.value.toFixed(2)}%p (0.5 이상이면 침체 신호)` : null],
      [payroll ? '일자리 3개월 평균' : '일자리 (최근 1개월)', payroll ? `${signed(payroll.avg3, 0)}천 명 (그 전 3개월 ${signed(payroll.prior3, 0)}천 명)` : nfp == null ? null : `${signed(nfp, 0)}천 명`],
      ['신규 실업수당 청구 (4주 평균)', claims ? `${(claims.avg4 / 10000).toFixed(1)}만 건 (1년 저점 대비 ${signed(claims.aboveLow, 0, '%')})` : null],
      ['소매판매 (전년 대비, 명목)', retailYoy ? `${signed(retailYoy.value, 1, '%')}` : finite(macro.retailSales) == null ? null : `전월 대비 ${signed(finite(macro.retailSales), 1, '%')}`]
    ],
    read,
    flip: state === 'unknown' ? null : `Sahm 지표 ${G.sahmRecessionAt}%p 이상 또는 일자리 3개월 평균 감소면 부담 · Sahm ${G.sahmWatchAt}%p 미만이면서 3개월 평균 ${G.payrollSolidK / 10}만 명 이상이면 우호 (${G.payrollSolidK / 10}만 명은 노동력 증가를 흡수하는 수준으로 흔히 쓰는 기준)`,
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
  const coreCpiPace = annualised3m(seriesOf(mh, 'coreCpiIndex'));
  const delta = finite(macro.corePceDelta);
  const sixMonthsAgo = corePceYoySeries.length > 6 ? corePceYoySeries[corePceYoySeries.length - 7].value : null;
  const breakeven = finite(macro.breakeven10);
  const accelerating = pace ? pace.value >= (yoy ?? Infinity) + I.reaccelPp : null;
  let state = 'neutral';
  if (yoy == null) state = 'unknown';
  else if (yoy >= I.missPct || (accelerating && yoy >= I.nearTargetPct)) state = 'burden';
  else if (yoy <= I.nearTargetPct && (pace ? pace.value <= yoy : delta != null && delta <= 0)) state = 'favorable';
  const gap = yoy == null ? null : yoy - 2;
  const read = state === 'burden'
    ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 연준 목표(2%)보다 ${gap.toFixed(1)}%p 높습니다${accelerating ? ` — 최근 3개월 속도(연율 ${pace.value.toFixed(1)}%)가 더 빨라 다시 오르는 중입니다` : ''}. 연준이 금리를 내리기 어려운 조건입니다.`
    : state === 'favorable' ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 목표에 가깝고 오르는 속도가 줄고 있습니다 — 금리 인하 여지가 생기는 조건입니다.`
      : state === 'unknown' ? '물가 자료를 기다리는 중입니다.'
        : `근원 PCE 물가 ${yoy.toFixed(1)}% — 목표보다 높지만 다시 빨라지는 신호는 뚜렷하지 않습니다.${pace ? '' : ' 3개월 속도는 월별 기록이 쌓이면 반영됩니다.'}`;
  return axis('inflation', '물가', state, {
    gauge: state === 'burden' && yoy < 3 && pace ? gauge({ label: '근원 PCE 3개월 속도 − 1년치 (재가속 폭)', value: pace.value - yoy, unit: '%p', digits: 1, ...cuts(-2, 3, [0, I.reaccelPp], ['favorable', 'neutral', 'burden'], [[0, '0'], [I.reaccelPp, `+${I.reaccelPp} 재가속`]]) }) : gauge({ label: '근원 PCE 물가 (전년 대비)', value: yoy, unit: '%', digits: 1, ...cuts(0, 5, [I.nearTargetPct, I.missPct], ['favorable', 'neutral', 'burden'], [[I.targetPct, `목표 ${I.targetPct}%`], [I.missPct, `${I.missPct}%`]]) }),
    headline: yoy == null ? null : `근원 PCE ${yoy.toFixed(1)}%`,
    evidence: [
      ['근원 PCE (전년 대비)', yoy == null ? null : `${yoy.toFixed(1)}% (목표 2% 대비 ${signed(gap, 1, '%p')})`],
      ['근원 PCE 3개월 속도 (연율)', pace ? `${pace.value.toFixed(1)}% ${pace.value > yoy ? '— 1년 평균보다 빠름' : '— 1년 평균보다 느림'}` : null],
      ['근원 CPI 3개월 속도 (연율)', coreCpiPace ? `${coreCpiPace.value.toFixed(1)}%` : null],
      ['6개월 전 근원 PCE', sixMonthsAgo == null ? null : `${sixMonthsAgo.toFixed(1)}%`],
      ['헤드라인 CPI · PCE', finite(macro.cpi) == null ? null : `${finite(macro.cpi).toFixed(1)}% · ${finite(macro.pce)?.toFixed(1) ?? '—'}%`],
      ['10년 기대인플레이션', breakeven == null ? null : `${breakeven.toFixed(2)}%`]
    ],
    read,
    flip: state === 'unknown' ? null : `근원 PCE ${I.missPct.toFixed(1)}% 이상, 또는 ${I.nearTargetPct}% 이상에서 3개월 속도가 1년치보다 ${I.reaccelPp}%p 이상 빠르면 부담 · ${I.nearTargetPct}% 이하이면서 3개월 속도가 1년치 이하면 우호`,
    link: '물가가 목표보다 높으면 연준은 금리를 높게 유지합니다. 높은 금리는 미래 이익의 현재 가치를 낮춰 성장주 밸류에이션(PER)에 특히 부담이 됩니다.',
    asOf: macro._asOf_corePce || pace?.date || null,
    detail: { yoy, pace, accelerating }
  });
}

function policyAxis({ macro, inflationState }) {
  const upper = finite(macro.fedTargetUpper);
  const lower = finite(macro.fedTargetLower);
  const mid = upper != null && lower != null ? (upper + lower) / 2 : null;
  const corePce = finite(macro.corePce);
  const twoYear = finite(macro.dgs2);
  const realPolicy = mid != null && corePce != null ? mid - corePce : null;
  const pricing = mid != null && twoYear != null ? twoYear - mid : null;
  let state = 'neutral';
  if (mid == null || (pricing == null && realPolicy == null)) state = 'unknown';
  else if ((pricing != null && pricing >= P.pricedMovePp) || (realPolicy != null && realPolicy >= P.restrictiveRealPct)) state = 'burden';
  else if (pricing != null && pricing <= -P.pricedMovePp && inflationState !== 'burden') state = 'favorable';
  const pricingText = pricing == null ? null : pricing >= P.pricedMovePp ? '추가 인상 가능성을 반영' : pricing <= -P.pricedMovePp ? '금리 인하를 반영' : '동결에 가까운 경로를 반영';
  const read = state === 'burden'
    ? (pricing != null && pricing >= P.pricedMovePp ? `2년물(${twoYear.toFixed(2)}%)이 기준금리 중간값(${mid.toFixed(2)}%)보다 ${pricing.toFixed(2)}%p 높습니다 — 시장이 금리를 더 올릴 수 있다고 보고 있습니다.` : `물가를 뺀 실질 기준금리가 ${realPolicy.toFixed(1)}%로 중립 수준(약 1%)보다 훨씬 높은 긴축 상태입니다.`)
    : state === 'favorable' ? `2년물이 기준금리보다 ${Math.abs(pricing).toFixed(2)}%p 낮습니다 — 시장이 금리 인하를 내다보고 있습니다.`
      : state === 'unknown' ? '정책금리나 2년물 자료를 기다리는 중입니다.'
        : `시장은 당분간 ${pricingText || '큰 변화 없는 경로'}하고 있습니다.`;
  return axis('policy', '통화정책', state, {
    gauge: state === 'burden' && (pricing == null || pricing < P.pricedMovePp) && realPolicy != null ? gauge({ label: '실질 기준금리 (중간값 − 근원 PCE)', value: realPolicy, unit: '%', digits: 1, ...cuts(-2, 4, [P.restrictiveRealPct], ['neutral', 'burden'], [[P.neutralRealPct, `중립 약 ${P.neutralRealPct}%`], [P.restrictiveRealPct, `${P.restrictiveRealPct}%`]]) }) : gauge({ label: '2년물 − 기준금리 중간값 (시장이 보는 금리 경로)', value: pricing, unit: '%p', digits: 2, ...cuts(-1.5, 1.5, [-P.pricedMovePp, P.pricedMovePp], ['favorable', 'neutral', 'burden'], [[-P.pricedMovePp, '인하 반영'], [P.pricedMovePp, '인상 반영']]) }),
    headline: pricing == null ? null : pricing >= P.pricedMovePp ? '시장: 인상 반영' : pricing <= -P.pricedMovePp ? '시장: 인하 반영' : '시장: 동결 반영',
    evidence: [
      ['연준 목표 범위', upper == null ? null : `${lower.toFixed(2)}–${upper.toFixed(2)}%`],
      ['2년물 − 기준금리 중간값', pricing == null ? null : `${signed(pricing, 2, '%p')} (${pricingText})`],
      ['실질 기준금리 (중간값 − 근원 PCE)', realPolicy == null ? null : `${realPolicy.toFixed(1)}% (중립 약 1%)`]
    ],
    read,
    flip: state === 'unknown' ? null : `2년물이 기준금리 중간값보다 ${P.pricedMovePp}%p 이상 높거나 실질 기준금리 ${P.restrictiveRealPct}% 이상이면 부담 · ${P.pricedMovePp}%p 이상 낮고(인하 반영) 물가가 부담이 아니면 우호`,
    link: '2년물 금리는 시장이 예상하는 앞으로 1~2년의 기준금리입니다. 인상 쪽으로 기울면 달러 강세와 높은 할인율이 함께 오고, 인하 쪽이면 반대입니다. 단, 경기 악화 때문에 인하를 반영하는 경우는 주식에 좋은 신호가 아닙니다.',
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
  const creditByChange = stateOf('credit') === 'burden' && (hyBp == null || hyBp < RULES.credit.stressAtBp) && hy5 != null && hy5 >= RULES.credit.widen5dBp;
  const credit = creditByChange
    ? gauge({ label: '하이일드 스프레드 5일 변화', value: hy5, unit: 'bp', digits: 0, ...cuts(-50, 100, [0, RULES.credit.widen5dBp], ['favorable', 'neutral', 'burden'], [[0, '0'], [RULES.credit.widen5dBp, `+${RULES.credit.widen5dBp} 급확대`]]) })
    : gauge({ label: '하이일드 스프레드', value: hyBp, unit: 'bp', digits: 0, ...cuts(200, 700, [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], ['favorable', 'neutral', 'burden'], [[RULES.credit.tightBelowBp, `${RULES.credit.tightBelowBp}`], [RULES.credit.stressAtBp, `${RULES.credit.stressAtBp}`]]) });
  const tnx20 = rateFx?.tnx20 ?? null;
  const ratesByRange = stateOf('rates') === 'burden' && (tnx20 == null || tnx20 < RULES.rates.move20dBp) && rateFx?.tnxPosition != null;
  const rates = ratesByRange
    ? gauge({ label: '10년물 1년 범위 내 위치', value: rateFx.tnxPosition * 100, unit: '%', digits: 0, ...cuts(0, 100, [RULES.rates.rangeHighAt * 100], ['neutral', 'burden'], [[RULES.rates.rangeHighAt * 100, `상단 ${RULES.rates.rangeHighAt * 100}%`]]) })
    : gauge({ label: '10년물 20일 변화', value: tnx20, unit: 'bp', digits: 0, ...cuts(-75, 75, [-RULES.rates.move20dBp, RULES.rates.move20dBp], ['favorable', 'neutral', 'burden'], [[-RULES.rates.move20dBp, `−${RULES.rates.move20dBp}`], [RULES.rates.move20dBp, `+${RULES.rates.move20dBp}`]]) });
  const wti20 = rateFx?.wti20 ?? null;
  const dxy20 = rateFx?.dxy20 ?? null;
  const commodityTrigger = stateOf('commodities') !== 'burden' ? 'dollar'
    : rateFx?.wtiHigh ? 'oil-range' : wti20 != null && wti20 >= RULES.oil.rise20dPct ? 'oil-change' : 'dollar';
  const commodities = commodityTrigger === 'oil-range'
    ? gauge({ label: 'WTI 1년 범위 내 위치', value: rateFx.wtiPosition * 100, unit: '%', digits: 0, ...cuts(0, 100, [RULES.oil.rangeHighAt * 100], ['neutral', 'burden'], [[RULES.oil.rangeHighAt * 100, `${RULES.oil.rangeHighAt * 100}%`]]) })
    : commodityTrigger === 'oil-change'
      ? gauge({ label: 'WTI 20일 변화', value: wti20, unit: '%', digits: 1, ...cuts(-20, 20, [RULES.oil.fall20dPct, RULES.oil.rise20dPct], ['favorable', 'neutral', 'burden'], [[RULES.oil.fall20dPct, `${RULES.oil.fall20dPct}%`], [RULES.oil.rise20dPct, `+${RULES.oil.rise20dPct}%`]]) })
      : gauge({ label: '달러 인덱스 20일 변화', value: dxy20, unit: '%', digits: 1, ...cuts(-5, 5, [0, RULES.dollar.rise20dPct], ['favorable', 'neutral', 'burden'], [[RULES.dollar.rise20dPct, `+${RULES.dollar.rise20dPct}%`]]) });
  return {
    rates: { gauge: rates, headline: tnx20 == null ? null : `10년물 20일 ${signed(tnx20, 0, 'bp')}` },
    commodities: { gauge: commodities, headline: wti20 == null ? null : `WTI 20일 ${signed(wti20, 1, '%')} · 달러 ${signed(dxy20, 1, '%')}` },
    credit: { gauge: credit, headline: hyBp == null ? null : `HY ${hyBp.toFixed(0)}bp${hy5 == null ? '' : ` (5일 ${signed(hy5, 0, 'bp')})`}` },
    korea: stateOf('korea') === 'burden' && (rateFx?.krw20 == null || rateFx.krw20 < RULES.fx.krwMove20dPct) && rateFx?.jpy20 != null && rateFx.jpy20 <= -RULES.fx.yenRally20dPct
      ? { gauge: gauge({ label: '엔화 20일 강세 폭 (엔/달러 하락률)', value: -rateFx.jpy20, unit: '%', digits: 1, ...cuts(-5, 8, [RULES.fx.yenRally20dPct], ['neutral', 'burden'], [[RULES.fx.yenRally20dPct, `+${RULES.fx.yenRally20dPct}% 엔 급강세`]]) }), headline: `엔화 20일 ${signed(-rateFx.jpy20, 1, '%')} 강세` }
      : { gauge: gauge({ label: '원/달러 20일 변화', value: rateFx?.krw20 ?? null, unit: '%', digits: 1, ...cuts(-5, 5, [-RULES.fx.krwMove20dPct, RULES.fx.krwMove20dPct], ['favorable', 'neutral', 'burden'], [[-RULES.fx.krwMove20dPct, `−${RULES.fx.krwMove20dPct}%`], [RULES.fx.krwMove20dPct, `+${RULES.fx.krwMove20dPct}%`]]) }), headline: rateFx?.krw20 == null ? null : `원/달러 20일 ${signed(rateFx.krw20, 1, '%')}` }
  };
}

export const REGIME_CRITERIA = `성장 방향: Sahm 지표 ${G.sahmWatchAt}%p 이상이거나 최근 3개월 일자리 증가가 그 전 3개월보다 ${G.payrollSlowdownK / 10}만 명 넘게 적으면 둔화, 아니면 견조 · 물가 방향: 근원 PCE의 최근 3개월 속도(연율)가 1년치보다 빠르면 상승, 아니면 둔화.`;

/** Growth × inflation direction — the classic four-regime frame, with its historical tendency as 해석. */
function buildRegime(growth, inflation) {
  const g = growth.detail;
  const i = inflation.detail;
  const growthDir = g?.payroll && g?.sahm ? (g.sahm.value >= G.sahmWatchAt || g.payroll.avg3 < g.payroll.prior3 - G.payrollSlowdownK ? 'down' : 'up')
    : growth.state === 'burden' ? 'down' : growth.state === 'favorable' ? 'up' : null;
  const inflationDir = i?.pace && i.yoy != null ? (i.pace.value > i.yoy ? 'up' : 'down')
    : inflation.state === 'burden' ? 'up' : inflation.state === 'favorable' ? 'down' : null;
  const provisional = !(g?.payroll && g?.sahm && i?.pace);
  const table = {
    'up/down': { id: 'goldilocks', label: '성장 견조 · 물가 둔화', tone: 'favorable', reading: '이익이 늘면서 금리 부담은 줄어드는 조합으로, 역사적으로 주식에 가장 우호적인 국면입니다(성장주가 상대적으로 강한 경향).' },
    'up/up': { id: 'reflation', label: '성장 견조 · 물가 상승', tone: 'neutral', reading: '이익은 늘지만 금리가 오르기 쉬운 조합입니다. 에너지·금융·가치주가 상대적으로 강하고, 금리에 민감한 성장주는 흔들리기 쉬운 경향이 있습니다.' },
    'down/up': { id: 'stagflation', label: '성장 둔화 · 물가 상승', tone: 'burden', reading: '이익은 줄고 연준은 금리를 내리기 어려운 조합으로, 주식과 채권이 함께 약했던 경우가 많습니다(1970년대, 2022년). 현금·원자재·방어주가 상대적으로 버틴 국면입니다.' },
    'down/down': { id: 'disinflation-slowdown', label: '성장 둔화 · 물가 둔화', tone: 'neutral', reading: '금리 인하 기대로 채권이 강해지고, 주식은 경기 둔화의 깊이에 따라 엇갈립니다. 방어주와 우량 성장주가 경기민감주보다 나았던 경향이 있습니다.' }
  };
  const key = growthDir && inflationDir ? `${growthDir}/${inflationDir}` : null;
  const picked = key ? table[key] : null;
  return picked
    ? { ...picked, available: true, provisional, growthDir, inflationDir, criteria: REGIME_CRITERIA }
    : { available: false, label: '국면 판정 보류', tone: 'unknown', reading: '성장과 물가의 방향을 모두 확인한 뒤 국면을 표시합니다.', provisional: true, growthDir, inflationDir, criteria: REGIME_CRITERIA };
}

/** The transmission chain: oil → inflation expectations → policy path → long rates → valuations, plus
 *  the dollar and credit branches. Each node shows its move; a link is drawn as active only when both
 *  ends moved the same way past the stated thresholds. */
function buildChain({ macro, regime, rateFx }) {
  const axisById = Object.fromEntries((regime?.axes || []).map((row) => [row.id, row]));
  const fx = rateFx || {};
  const wti20 = fx.wti20 ?? null;
  const bei5 = finite(macro.breakeven10Delta5);
  const pricing = finite(macro.dgs2) != null && finite(macro.fedTargetUpper) != null ? finite(macro.dgs2) - (finite(macro.fedTargetUpper) - 0.125) : null;
  const tnx20 = fx.tnx20 ?? null;
  const real5 = finite(macro.realYield10Delta5);
  const dxy20 = fx.dxy20 ?? null;
  const hy5 = finite(macro.hyOASDelta5);
  const dir = (value, up, down) => value == null ? 'unknown' : value >= up ? 'up' : value <= down ? 'down' : 'flat';
  const nodes = [
    { id: 'oil', label: '유가 (WTI)', value: wti20 == null ? '—' : `20일 ${signed(wti20, 1, '%')}`, dir: fx.wtiHigh && wti20 != null && wti20 > RULES.oil.fall20dPct ? 'up' : dir(wti20, RULES.oil.rise20dPct, RULES.oil.fall20dPct) },
    { id: 'breakeven', label: '기대인플레이션', value: bei5 == null ? '—' : `1주 ${signed(bei5 * 100, 0, 'bp')}`, dir: dir(bei5 == null ? null : bei5 * 100, RULES.breakeven.move5dBp, -RULES.breakeven.move5dBp) },
    { id: 'policy', label: '연준 경로 (2년물)', value: pricing == null ? '—' : pricing >= P.pricedMovePp ? '인상 반영' : pricing <= -P.pricedMovePp ? '인하 반영' : '동결 반영', dir: dir(pricing, P.pricedMovePp, -P.pricedMovePp) },
    { id: 'rates', label: '장기금리 (10년물)', value: tnx20 == null ? '—' : `20일 ${signed(tnx20, 0, 'bp')}`, dir: dir(tnx20, RULES.rates.move20dBp, -RULES.rates.move20dBp) },
    { id: 'valuation', label: '주식 밸류에이션', value: axisById.rates ? `금리 축 ${axisById.rates.stateLabel}` : '—', dir: axisById.rates?.state === 'burden' ? 'down' : axisById.rates?.state === 'favorable' ? 'up' : 'flat' }
  ];
  const links = [];
  if (nodes[0].dir !== 'unknown' && nodes[0].dir !== 'flat' && nodes[0].dir === nodes[1].dir) links.push(`유가와 기대인플레이션이 함께 ${nodes[0].dir === 'up' ? '오르고' : '내리고'} 있습니다 — 유가가 물가 예상으로 옮겨 가는 경로가 작동 중입니다.`);
  if (nodes[2].dir === 'up') links.push('2년물이 기준금리보다 높아 시장이 추가 인상 가능성을 가격에 넣고 있습니다.');
  if (nodes[2].dir === 'down') links.push('2년물이 기준금리보다 낮아 시장이 금리 인하를 가격에 넣고 있습니다.');
  if (nodes[0].dir === 'up' && nodes[1].dir !== 'up') links.push(fx.wtiHigh ? '유가가 1년 범위 상단에 있어 물가 부담 요인입니다.' : `유가가 20일 동안 ${signed(wti20, 1, '%')} 올랐습니다 — 아직 기대인플레이션으로 크게 번지지는 않았습니다.`);
  if (nodes[3].dir === 'up') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 올랐습니다${real5 != null && bei5 != null && real5 > bei5 && real5 > 0 ? ' — 상승 대부분이 실질금리라 성장주 밸류에이션에 더 직접적입니다' : ''}.`);
  if (nodes[3].dir === 'down') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 내려 할인율 부담이 줄고 있습니다.`);
  const branches = [
    { id: 'dollar', label: '달러', value: dxy20 == null ? '—' : `20일 ${signed(dxy20, 1, '%')}`, dir: dir(dxy20, RULES.dollar.rise20dPct, RULES.dollar.fall20dPct), effect: dxy20 == null ? null : dxy20 >= RULES.dollar.rise20dPct ? '달러 강세 → 미국 다국적 기업의 해외 매출 환산 감소, 신흥국·원화 약세(외국인 순매도 압력)' : dxy20 <= RULES.dollar.fall20dPct ? '달러 약세 → 해외 매출 환산 증가, 신흥국·원화에 우호적' : '달러는 큰 방향 없이 움직이고 있습니다' },
    { id: 'credit', label: '신용 스프레드', value: hy5 == null ? '—' : `1주 ${signed(hy5 * 100, 0, 'bp')}`, dir: dir(hy5 == null ? null : hy5 * 100, RULES.credit.widen5dBp, -RULES.credit.widen5dBp), effect: hy5 == null ? null : hy5 * 100 >= RULES.credit.widen5dBp ? '스프레드 확대 → 기업 자금 조달 비용 상승, 주식 위험 프리미엄 상승' : hy5 * 100 <= -RULES.credit.widen5dBp ? '스프레드 축소 → 자금 조달 여건 개선' : '신용 시장은 안정적입니다' }
  ];
  // Colour by effect on stocks: every node rising is a headwind except valuation, where a fall is.
  const impact = (node) => node.dir === 'unknown' || node.dir === 'flat' ? node.dir : (node.id === 'valuation' ? node.dir === 'down' : node.dir === 'up') ? 'burden' : 'favorable';
  const legend = `화살표 기준(시장 상태와 같음): 유가 20일 +${RULES.oil.rise20dPct}% 이상 또는 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상 / ${RULES.oil.fall20dPct}% 이하 · 기대인플레이션 1주 ±${RULES.breakeven.move5dBp}bp · 2년물 − 기준금리 ±${P.pricedMovePp}%p · 10년물 20일 ±${RULES.rates.move20dBp}bp · 달러 20일 ±${RULES.dollar.rise20dPct}% · 신용 스프레드 1주 ±${RULES.credit.widen5dBp}bp. 빨간 테두리는 주식에 부담, 초록은 우호.`;
  return { nodes: nodes.map((node) => ({ ...node, impact: impact(node) })), links, branches: branches.map((node) => ({ ...node, impact: impact(node) })), legend };
}

/** 20-session changes on the completed-close basis (the 시장 상태 basis). */
export function closeChanges(history = []) {
  const basis = closeBasis(history);
  const change = (field, kind) => {
    const series = buildCloseSeries(history, field, { through: basis });
    if (series.length <= 20) return null;
    const last = series[series.length - 1].value;
    const back = series[series.length - 21].value;
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
  return { basis, wti20: change('wti'), dxy20: change('dxy'), tnx20: change('tnx', 'bp'), gold20: change('gold'), krw20: change('usdkrw'), jpy20: change('usdjpy'), wtiPosition, wtiHigh: wtiPosition != null && wtiPosition >= RULES.oil.rangeHighAt, tnxPosition: position('tnx') };
}

export function buildMacroRead({ macro = null, macroHistory = null, regime = null, rateFx = null, history = null } = {}) {
  if (!rateFx && Array.isArray(history)) rateFx = closeChanges(history);
  const m = macro && typeof macro === 'object' ? macro : {};
  const mh = macroHistory?.schemaVersion === 'macro-history.v1' ? macroHistory : null;
  const gauges = sharedGauges({ macro: m, rateFx, regime });
  const growth = growthAxis({ macro: m, mh });
  const inflation = inflationAxis({ macro: m, mh });
  const policy = policyAxis({ macro: m, inflationState: inflation.state });
  const axes = [
    growth, inflation, policy,
    reuse(regime, 'rates', '금리 · 할인율', '10년물 금리는 주식 가치를 계산하는 할인율의 기준입니다. 빠르게 오르면 PER이 높은 성장주부터 부담을 받습니다.', gauges.rates),
    reuse(regime, 'commodities', '유가 · 달러', '유가는 물가(에너지는 CPI의 약 7%)와 소비 여력에, 달러는 해외 매출 환산과 신흥국 자금 흐름에 영향을 줍니다.', gauges.commodities),
    reuse(regime, 'credit', '신용', '하이일드 스프레드가 넓어지면 기업 자금 조달이 어려워지고, 주식 하락이 신용 위험으로 번지고 있다는 신호가 됩니다.', gauges.credit)
  ];
  const known = axes.filter((row) => row.state !== 'unknown');
  const count = (state) => known.filter((row) => row.state === state).length;
  const macroRegime = buildRegime(growth, inflation);
  const historyStatus = !mh ? 'missing' : mh.status === 'awaiting-first-producer-run' ? 'awaiting' : Object.keys(mh.series || {}).length ? 'ok' : 'missing';
  return {
    available: known.length > 0,
    historyStatus,
    historyAsOf: mh?.generatedAt || null,
    regime: macroRegime,
    axes,
    counts: { favorable: count('favorable'), neutral: count('neutral'), burden: count('burden'), unknown: axes.length - known.length },
    chain: buildChain({ macro: m, regime, rateFx }),
    sharedGauges: gauges,
    labels: { monthDay, monthLabel }
  };
}
