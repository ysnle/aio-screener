// P1426 (owner review 2026-10-03): the 매크로 tab explains the economy for a non-specialist —
// whether each reading is good or bad for stocks, which way it is moving, and how the pieces connect.
// Every judgement is a published rule with its threshold shown (the 시장 상태 pattern):
//   growth    — Sahm rule (3-month average unemployment 0.5pp above its prior 12-month low; Claudia Sahm,
//               2019, FRED SAHMREALTIME) and the 3-month payroll average,
//   inflation — core PCE (the measure the FOMC's 2% objective uses) and its 3-month annualised pace,
//   policy    — the 2-year yield against the policy rate (what the market prices for the next moves) and
//               the real policy rate against the FOMC's longer-run neutral (3.0% nominal - 2% = about 1%).
// Rates, credit and oil/dollar reuse the 시장 상태 axes, so the two screens never disagree.
// What a regime has tended to mean for stocks is labelled 해석 (a historical tendency, not a forecast).

import { AXIS_REASON_LABEL, creditCause, creditState, hyObservation, hyWidening20Record } from '../briefing/market-read.js';
import { buildCloseSeries, closeBasis, sessionPointBack as closeSessionPointBack } from '../market/session/close-series.js';
import { RULES } from '../rules/thresholds.js';
import { brentWtiCheck } from './liquidity-growth.js';
import { inflationDirection, oilDivergence, MACRO_SIGNAL_RULES } from './macro-signals.js';
import { peopleText, signedText, readNumber as finite } from '../shared/number.js';
// v59.59: the neutral real rate on the 정책 axis is the Taylor rule's own SEP-derived r* (an import cycle used only at call time).
import { sepNeutral } from './taylor-rule.js';
import { fedTargetRange } from './fed-target-range.js';

const G = RULES.growth;
const I = RULES.inflation;
const P = RULES.policy;

const STATE_LABELS = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담', unknown: '판정 보류' });

// The 매크로-owned axes (growth, inflation, policy) carry no assembled sentence either: why an axis holds its state is one
// 판정 사유 evidence row in this fixed vocabulary, the figures it stood on in parentheses — the same shape as the shared
// axes' AXIS_REASONS (market-read.js). The outlook and conditional clauses the old `read` carried are not kept here; the
// rule is the axis's flip, the teaching is the screen's method fold. Nothing here decides a state.
export const MACRO_AXIS_REASONS = Object.freeze({
  missing: '기록 없음',
  'growth.sahmRecession': 'Sahm 지표 침체 신호 기준 이상', 'growth.payrollFall': '일자리 3개월 평균 감소',
  'growth.solid': 'Sahm 지표 주의 기준 미만, 일자리 3개월 평균 기준 이상', 'growth.oneMonthFall': '최근 1개월 일자리 감소, 3개월 추세 기록 없음',
  'growth.sahmWatch': 'Sahm 지표 주의 구간', 'growth.payrollSlow': '일자리 3개월 평균 기준 미만', 'growth.middle': '고용·실업률 중간 구간',
  'growth.partial': '3개월 추세·Sahm 지표 기록 부족',
  'inflation.level': '근원 PCE 수준 기준 이상', 'inflation.reaccel': '근원 물가 3개월 속도 재가속',
  'inflation.bothUp': '근원 PCE·CPI 3개월 속도 함께 빠름', 'inflation.oneUp': '한 지표만 3개월 속도 빠름, 다른 지표 미확인',
  'inflation.someUp': '3개월 속도가 1년치보다 빠른 지표 있음, 두 지표 동반 재가속 아님', 'inflation.split': '두 지표 방향 엇갈림',
  'inflation.nearTarget': '근원 PCE 목표 근처, 3개월 속도 1년치 이하', 'inflation.belowLevel': '근원 PCE 수준 기준 미만',
  'inflation.noReaccel': '재가속 신호 없음', 'inflation.noPace': '3개월 속도 기록 부족',
  'policy.twoYearAbove': '2년물이 기준금리 중간값보다 기준 이상 높음', 'policy.realTight': '실질 기준금리 긴축 기준 이상',
  'policy.realBelowNeutral': '실질 기준금리 중립 추정 아래', 'policy.twoYearBelow': '2년물이 기준금리 중간값보다 기준 이상 낮음',
  'policy.recessionCut': '2년물 인하 반영, 성장 부담으로 양호 제한', 'policy.nearMid': '2년물이 기준금리 중간값 부근',
  'policy.noTwoYear': '2년물 자료 없음, 실질 기준금리 긴축 기준 미만'
});
// [code, ...extras] items → the 판정 사유 row.
const reasonRow = (...items) => [AXIS_REASON_LABEL, items.filter((item) => item?.[0]).map(([code, ...extra]) => {
  const tail = extra.filter(Boolean);
  return `${MACRO_AXIS_REASONS[code]}${tail.length ? ` (${tail.join(', ')})` : ''}`;
}).join(' · ') || null];


export function signed(value, digits = 1, suffix = '') {
  return signedText(value, digits, suffix);
}

export function monthDay(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

const monthOfAsOf = (date) => { const month = Number(String(date || '').slice(5, 7)); return month ? `(${month}월분)` : ''; };

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
/** Month-over-month % changes, only between calendar-adjacent months (a skipped release is not a one-month change). */
export const monthIndex = (date) => { const [y, m] = String(date).split('-').map(Number); return y * 12 + m; };
export function monthOverMonth(rows = []) {
  return rows.slice(1).map((row, index) => (monthIndex(row.date) - monthIndex(rows[index].date) === 1 ? { date: row.date, value: (row.value / rows[index].value - 1) * 100 } : null)).filter(Boolean);
}
/** The month-over-month change for one month ('YYYY-MM…'), or null when that month or the one before it is missing. */
export function monthChangeAt(rows = [], month) {
  const key = String(month || '').slice(0, 7);
  const at = rows.findIndex((row) => String(row.date).slice(0, 7) === key);
  return at > 0 ? monthOverMonth(rows.slice(at - 1, at + 1))[0]?.value ?? null : null;
}

export function yoySeries(series) {
  return series.map((row) => {
    const base = monthsBack(series, row.date, 12);
    return base && base.value ? { date: row.date, value: (row.value / base.value - 1) * 100 } : null;
  }).filter(Boolean);
}

/** One month's year-over-year rate. A 12-month base that was never published (October 2025) falls back to the 13-month,
 *  then the 11-month change at a yearly rate, and `note` names the base month used. */
export function yoyAt(series, date) {
  const row = series.find((item) => item.date === date);
  for (const months of [12, 13, 11]) {
    const base = row && monthsBack(series, date, months);
    // A 13- or 11-month base is a derived rate, not the year-over-year: it carries its own name (`label`) and basis
    // (`note`), so no reader prints it as '전년 대비'. Every reader prints the note inside its own parentheses, so the
    // note is a ", …" clause that names the missing month and the base used, never a second pair of parentheses.
    if (base?.value) return { date, value: ((row.value / base.value) ** (12 / months) - 1) * 100, derived: months !== 12,
      label: months === 12 ? '전년 대비' : `${months}개월 연율`,
      note: months === 12 ? '' : `, ${monthLabel(new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 13, 1)).toISOString())} 지수가 없어 ${monthLabel(base.date)} 대비` };
  }
  return null;
}

/**
 * The latest year-over-year rate of a nominal series with the same month's price rise taken out. Nominal retail
 * sales read 3%+ in 16 of 26 months while only 10 grew 1% after prices (2026-03: +3.6% nominal, +0.3% real). A month
 * whose price index is missing has no real rate.
 */
export function realYoyLatest(nominal, prices) {
  const row = yoySeries(nominal).at(-1);
  const price = row ? yoySeries(prices).find((item) => item.date.slice(0, 7) === row.date.slice(0, 7)) : null;
  return row && price ? { date: row.date, value: ((1 + row.value / 100) / (1 + price.value / 100) - 1) * 100, nominal: row.value } : null;
}

/** Three-month annualised pace — how fast prices rose over the last quarter, at a yearly rate. */
export function annualised3m(series) {
  const last = series[series.length - 1];
  const base = last ? monthsBack(series, last.date, 3) : null;
  return last && base && base.value ? { date: last.date, value: ((last.value / base.value) ** 4 - 1) * 100 } : null;
}

/** Sahm rule: 3-month average unemployment minus the lowest 3-month average of the prior 12 months. */
// v59.71 (quant review): the windows are calendar months, not array neighbours — a skipped release (October
// 2025, the shutdown month) averaged non-adjacent months and stretched "the prior 12" to 13 calendar months. A 3-month
// average uses the months present in its three (at least two); the prior window is the 12 calendar months before, at
// least 11 present — one missing release does not blank the reading for a year.
export function sahmGap(unemployment) {
  if (unemployment.length < 15) return null;
  const byMonth = new Map(unemployment.map((row) => [row.date.slice(0, 7), row]));
  const monthKey = (date, back) => { const [y, m] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 7); };
  const avg3At = (date) => {
    const rows = [0, 1, 2].map((back) => byMonth.get(monthKey(date, back))).filter(Boolean);
    return rows.length >= 2 ? rows.reduce((sum, row) => sum + row.value, 0) / rows.length : null;
  };
  const lastRow = unemployment[unemployment.length - 1];
  const lastAvg = avg3At(lastRow.date);
  if (lastAvg == null || !byMonth.has(monthKey(lastRow.date, 0))) return null;
  const last = { date: lastRow.date, value: lastAvg };
  const prior = Array.from({ length: 12 }, (_, i) => monthKey(lastRow.date, i + 1)).filter((key) => byMonth.has(key))
    .map((key) => ({ date: `${key}-01`, value: avg3At(`${key}-01`) })).filter((row) => row.value != null);
  if (prior.length < 11) return null;
  const low = Math.min(...prior.map((row) => row.value));
  return { date: last.date, value: last.value - low, avg3: last.value, low };
}

// The monthly print that settles the held growth direction once the next report rolls both 3-month windows.
function nextPayrollCuts(payroll, G) {
  const changes = payroll?.changes || [];
  if (changes.length < 5) return null;
  const tail = changes.slice(-2).reduce((sum, row) => sum + row.value, 0);
  const rolledPrior = changes.slice(-5, -2).reduce((sum, row) => sum + row.value, 0) / 3;
  return { down: 3 * (rolledPrior - G.payrollSlowdownK * 1.5) - tail, up: 3 * Math.max(rolledPrior - G.payrollSlowdownK / 2, G.payrollSolidK) - tail };
}

function payrollTrend(payrolls) {
  if (payrolls.length < 7) return null;
  const changes = payrolls.slice(1).map((row, index) => ({ date: row.date, value: row.value - payrolls[index].value }));
  const recent = changes.slice(-3);
  const prior = changes.slice(-6, -3);
  const avg = (rows) => rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  return { date: recent[recent.length - 1].date, avg3: avg(recent), prior3: avg(prior), changes };
}

export function claimsTrend(claims) {
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
  const retailReal = realYoyLatest(retail, seriesOf(mh, 'cpiIndex'));
  const nfp = finite(macro.nfp);
  const unrate = finite(macro.unemployment) ?? lastOf(unemployment)?.value ?? null;
  let state = 'neutral';
  if (sahm == null && payroll == null && nfp == null) state = 'unknown';
  // Audit D5: one payroll month (revised, noisy) no longer decides burden on its own; the 3-month average does.
  else if ((sahm && sahm.value >= G.sahmRecessionAt) || (payroll && payroll.avg3 < 0)) state = 'burden';
  else if (sahm && sahm.value < G.sahmWatchAt && payroll && payroll.avg3 >= G.payrollSolidK) state = 'favorable';
  // Expert review M18: a neutral reason names the indicator that held it there instead of a generic either/or.
  const partial = !sahm || !payroll ? ['growth.partial'] : null;
  const sahmText = sahm ? `${sahm.value.toFixed(2)}%p` : null;
  const avg3Text = payroll ? peopleText(payroll.avg3, { sign: true }) : null;
  const reason = state === 'unknown' ? reasonRow(['missing'])
    : state === 'burden' ? (sahm && sahm.value >= G.sahmRecessionAt ? reasonRow(['growth.sahmRecession', sahmText, `기준 ${G.sahmRecessionAt}%p`]) : reasonRow(['growth.payrollFall', avg3Text]))
      : state === 'favorable' ? reasonRow(['growth.solid', sahm ? `Sahm ${sahmText}` : null, payroll ? `3개월 평균 ${avg3Text}` : null])
        : !payroll && nfp != null && nfp < 0 && !(sahm && sahm.value >= G.sahmWatchAt) ? reasonRow(['growth.oneMonthFall', peopleText(nfp, { sign: true })], partial)
          : sahm && sahm.value >= G.sahmWatchAt ? reasonRow(['growth.sahmWatch', sahmText, `주의 ${G.sahmWatchAt}~${G.sahmRecessionAt}%p`])
            : payroll && payroll.avg3 < G.payrollSolidK ? reasonRow(['growth.payrollSlow', avg3Text, `기준 ${G.payrollSolidK / 10}만 명`, sahm ? `Sahm ${sahmText}` : null])
              : reasonRow(['growth.middle'], partial);
  // P1599 (A01): the card leads with the indicator that decided the state. A calm Sahm reading beside a neutral
  // verdict (decided by slow payroll growth) read as a contradiction.
  const payrollHeld = state === 'neutral' && sahm && sahm.value < G.sahmWatchAt && payroll && payroll.avg3 < G.payrollSolidK;
  const payrollTriggered = (state === 'burden' && !(sahm && sahm.value >= G.sahmRecessionAt)) || payrollHeld;
  const growthGauge = sahm && !payrollTriggered ? gauge({ label: 'Sahm 지표 (실업률 3개월 평균 − 1년 저점)', value: sahm.value, unit: '%p', digits: 2, ...cuts(0, 1, [G.sahmWatchAt, G.sahmRecessionAt], ['favorable', 'neutral', 'burden'], [[G.sahmWatchAt, `${G.sahmWatchAt}`], [G.sahmRecessionAt, `침체 신호 ${G.sahmRecessionAt}`]]) })
    : payroll ? gauge({ label: '일자리 3개월 평균 (천 명)', value: payroll.avg3, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) })
      : nfp != null ? gauge({ label: '일자리 증감 (최근 1개월, 천 명)', value: nfp, unit: '천 명', digits: 0, ...cuts(-100, 300, [0, G.payrollSolidK], ['burden', 'neutral', 'favorable'], [[0, '0'], [G.payrollSolidK, `${G.payrollSolidK / 10}만`]]) }) : null;
  return axis('growth', '성장 (고용, 소비)', state, {
    gauge: growthGauge,
    headline: payrollTriggered && payroll ? `일자리 3개월 평균 ${peopleText(payroll.avg3, { sign: true })}` : sahm ? `실업률 1년 저점 대비 ${Number(sahm.value.toFixed(2)) > 0 ? '+' : ''}${sahm.value.toFixed(2)}%p` : unrate == null ? null : `실업률 ${unrate.toFixed(1)}%`,
    evidence: [
      reason,
      ['실업률', unrate == null ? null : `${unrate.toFixed(1)}%${finite(macro.unemploymentDelta) != null ? ` (전월 ${signed(finite(macro.unemploymentDelta), 1, '%p')})` : ''}`],
      ['Sahm 지표', sahm ? `${sahm.value.toFixed(2)}%p (${G.sahmWatchAt}%p 이상이면 둔화, ${G.sahmRecessionAt}%p 이상이면 침체 신호)` : null],
      [payroll ? '일자리 3개월 평균' : '일자리 (최근 1개월)', payroll ? `${peopleText(payroll.avg3, { sign: true })} (그 전 3개월 ${peopleText(payroll.prior3, { sign: true })})` : nfp == null ? null : peopleText(nfp, { sign: true })],
      ['신규 실업수당 청구 (4주 평균)', claims ? `${(claims.avg4 / 10000).toFixed(1)}만 건 (1년 저점 대비 ${signed(claims.aboveLow, 0, '%')})` : null],
      ['소매판매 (전년 대비, 명목)', retailYoy ? `${signed(retailYoy.value, 1, '%')}${retailReal && retailReal.date === retailYoy.date ? ` (물가 반영 ${signed(retailReal.value, 1, '%')})` : ''}` : finite(macro.retailSales) == null ? null : `전월 대비 ${signed(finite(macro.retailSales), 1, '%')}`]
    ],
    flip: state === 'unknown' ? null : `Sahm 지표 ${G.sahmRecessionAt}%p 이상 또는 일자리 3개월 평균 감소면 부담, Sahm ${G.sahmWatchAt}%p 미만이면서 3개월 평균 ${G.payrollSolidK / 10}만 명 이상이면 양호 (${G.payrollSolidK / 10}만 명은 노동력 증가를 흡수하는 수준으로 흔히 쓰는 기준)`,
    link: '고용과 소비는 기업 매출의 바탕입니다. 둔화가 확인되면 경기민감주·소형주가 먼저 약해지고, 금리 인하 기대가 커지면서 채권 금리는 내려가는 경향이 있습니다.',
    asOf: sahm?.date || payroll?.date || macro._asOf_unemployment || null,
    detail: { sahm, payroll, claims }
  });
}

/** the one core-inflation reading — year-over-year, 3-month pace and the PCE·CPI direction — that
 *  the 물가 axis, the quadrant and the 물가 chapter all read. The chapter used its own "last two months vs the two before"
 *  rule and said '다시 빨라졌습니다' while this direction was 방향 보류. */
export function coreInflationRead({ macro = {}, mh = null } = {}) {
  const corePceIndex = seriesOf(mh, 'corePceIndex');
  const corePceYoySeries = yoySeries(corePceIndex);
  const recorded = finite(macro?.corePce);
  const unrounded = lastOf(corePceYoySeries)?.value ?? null;
  const yoy = recorded == null ? unrounded : unrounded != null && Math.abs(unrounded - recorded) <= 0.05 + 1e-9 ? unrounded : recorded;
  const pace = annualised3m(corePceIndex);
  const coreCpiIndex = seriesOf(mh, 'coreCpiIndex');
  const coreCpiPace = annualised3m(coreCpiIndex);
  // The pace's own month, never an older month's yoy; a missing year-ago row reads the 13- or 11-month base (yoyAt).
  const coreCpiYoy = coreCpiPace ? yoyAt(coreCpiIndex, coreCpiPace.date) : null;
  // v57.81 (audit X1): the direction of core inflation needs core PCE and core CPI to agree, each on its newest release —
  // the quadrant, the 물가 axis, the 물가 chapter and the '물가 재가속' / '물가 둔화' scenarios all read this one flag.
  // Macro audit 2026-10-17: the PCE pair compares the 3-month pace with the year-over-year rate of the same month, as the
  // CPI pair already did — the released yoy (macro.corePce) can be a month newer than the history the pace is read from.
  const paceYoy = pace ? corePceYoySeries.find((row) => row.date === pace.date)?.value ?? null : null;
  const releasedSameMonth = pace && String(macro?._asOf_corePce || '').slice(0, 7) === pace.date.slice(0, 7);
  const pceYoyForPace = paceYoy ?? (releasedSameMonth ? yoy : null);
  const direction = inflationDirection({
    pce: pace && pceYoyForPace != null ? { pace: pace.value, yoy: pceYoyForPace, date: pace.date } : null,
    cpi: coreCpiPace && coreCpiYoy ? { pace: coreCpiPace.value, yoy: coreCpiYoy.value, date: coreCpiPace.date, yoyLabel: coreCpiYoy.label, note: coreCpiYoy.note } : null
  });
  // The direction row's label names the measures it actually read (one measure alone is not 'PCE·CPI').
  const directionLabel = direction.single ? `물가 방향 (${direction.pce ? '근원 PCE' : '근원 CPI'}만)` : '물가 방향 (PCE·CPI)';
  return { corePceIndex, corePceYoySeries, yoy, pace, pceYoyForPace, coreCpiIndex, coreCpiPace, coreCpiYoy, direction, directionLabel };
}

function inflationAxis({ macro, mh }) {
  // v59.59 (logic refactor): macro.corePce stays the number of record, but the producer rounds it to one decimal; when
  // the unrounded series value is that same figure (within the rounding), the series value is read, as the Taylor rule
  // does — 3.05 published as 3.1 crossed the 0.1pp buffer above the 3% line only through the rounding (coreInflationRead).
  const shared = coreInflationRead({ macro, mh });
  const { corePceYoySeries, yoy, pace, coreCpiPace, coreCpiYoy, pceYoyForPace, direction, directionLabel } = shared;
  // 2026-10-19 (expertise review): the composition of sticky core CPI — shelter (lags market rents by about a year) and
  // services ex-shelter ("supercore", wage-driven). A 3-month pace within 0.3pp of the year reads as steady. Evidence only: neither part
  // changes the axis state.
  const parts = [['주거비', 'shelterCpiIndex'], ['주거비 제외 서비스', 'supercoreCpiIndex']].map(([name, field]) => {
    const index = seriesOf(mh, field);
    const yoyRow = lastOf(yoySeries(index));
    const paceRow = annualised3m(index);
    return yoyRow && paceRow && yoyRow.date === paceRow.date ? { name, yoy: yoyRow.value, pace: paceRow.value, date: yoyRow.date } : null;
  });
  const composition = parts.every(Boolean) && parts[0].date === parts[1].date
    ? `${monthLabel(parts[0].date)} ${parts.map((row) => `${row.name} ${row.yoy.toFixed(1)}% (3개월 연율 ${row.pace.toFixed(1)}%, ${Math.abs(row.pace - row.yoy) < 0.3 ? '1년치와 비슷' : row.pace > row.yoy ? '빨라짐' : '느려짐'})`).join(', ')} — 주거비는 임대 시세를 늦게 따라가 천천히 내려오고, 주거비 제외 서비스는 임금과 함께 움직입니다`
    : null;
  const delta = finite(macro.corePceDelta);
  const sixMonthsAgo = corePceYoySeries.length > 6 ? corePceYoySeries[corePceYoySeries.length - 7].value : null;
  const breakeven = finite(macro.breakeven10);
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
  const mixed = slowing ? ['inflation.split', `${slowing.month ? `${slowing.month} ` : ''}${slowing.name} 둔화`] : null;
  const yoyText = yoy == null ? null : `${yoy.toFixed(1)}%`;
  const reason = state === 'unknown' ? reasonRow(['missing'])
    : state === 'burden' ? (firedBy === 'level'
      ? reasonRow(['inflation.level', yoyText, `기준 ${levelAt.toFixed(1)}%`],
        direction.dir === 'up' && !direction.single ? ['inflation.bothUp'] : direction.dir === 'up' ? ['inflation.oneUp', reaccel[0]?.name || null] : reaccel.length ? ['inflation.someUp', reaccel.map((row) => row.name).join('·')] : null, mixed)
      : reasonRow(['inflation.reaccel', `${fired.name}${fired.month ? ` ${fired.month}` : ''} 3개월 연율 ${fired.pace.toFixed(1)}%`, `1년치 ${fired.yoy.toFixed(1)}%`], mixed))
      : state === 'favorable' ? reasonRow(['inflation.nearTarget', yoyText])
        : reasonRow(['inflation.belowLevel', yoyText, `기준 ${levelAt.toFixed(1)}%`],
          direction.state === 'mixed' && reaccel.length ? ['inflation.split', `${reaccel[0].name}${reaccel[0].month ? ` ${reaccel[0].month}` : ''}만 빠름`, slowing ? `${slowing.month ? `${slowing.month} ` : ''}${slowing.name} 둔화` : null] : ['inflation.noReaccel'],
          pace ? null : ['inflation.noPace']);
  const gaugeOf = state === 'burden' && firedBy === 'reaccel' && fired
    ? gauge({ label: `${fired.name} 3개월 속도 − 1년치 (재가속 폭)`, value: fired.margin, unit: '%p', digits: 1, ...cuts(-2, 3, [0, I.reaccelPp], ['favorable', 'neutral', 'burden'], [[0, '0'], [I.reaccelPp, `+${I.reaccelPp} 재가속`]]) })
    : gauge({ label: '근원 PCE 물가 (전년 대비)', value: yoy, unit: '%', digits: 1, ...cuts(0, 5, [I.nearTargetPct, levelAt], ['favorable', 'neutral', 'burden'], [[I.targetPct, `목표 ${I.targetPct}%`], [levelAt, `${levelAt.toFixed(1)}%`]]) });
  return axis('inflation', '물가', state, {
    gauge: gaugeOf,
    headline: yoy == null ? null : `근원 PCE ${yoy.toFixed(1)}%${firedBy === 'reaccel' && fired ? `, ${fired.name} 재가속` : ''}`,
    evidence: [
      reason,
      ['근원 PCE (전년 대비)', yoy == null ? null : `${yoy.toFixed(1)}% (목표 ${I.targetPct}% 대비 ${signed(gap, 1, '%p')})`],
      ['근원 PCE 3개월 속도 (연율)', pace ? `${pace.value.toFixed(1)}% ${pace.value > (pceYoyForPace ?? yoy) ? '— 1년치(전년 대비)보다 빠름' : '— 1년치(전년 대비)보다 느림'}` : null],
      ['근원 CPI 3개월 속도 (연율)', coreCpiPace ? `${coreCpiPace.value.toFixed(1)}% (${monthLabel(coreCpiPace.date)}${coreCpiYoy ? `, ${coreCpiYoy.label} ${coreCpiYoy.value.toFixed(1)}%${coreCpiYoy.note}` : ', 같은 달 전년 대비 없음'})` : null],
      ['근원 CPI 구성 (주거비, 주거비 제외 서비스)', composition],
      [directionLabel, direction.state === 'unknown' ? null : `${direction.label} — ${direction.text}`],
      ['6개월 전 근원 PCE', sixMonthsAgo == null ? null : `${sixMonthsAgo.toFixed(1)}%`],
      // v60.18 (weekly audit D3): each print names its month — a September CPI (held by the October comparator gap) sat
      // unlabelled beside October readings.
      ['헤드라인 CPI, PCE', finite(macro.cpi) == null ? null : [['cpi', macro.cpi], ['pce', macro.pce]].map(([key, value]) => `${finite(value)?.toFixed(1) ?? '—'}%${monthOfAsOf(macro[`_asOf_${key}`])}`).join(', ')],
      ['10년 기대인플레이션', breakeven == null ? null : `${breakeven.toFixed(2)}%`]
    ],
    flip: state === 'unknown' ? null : `근원 PCE ${levelAt.toFixed(1)}% 이상(${I.missPct.toFixed(1)}% 선 + ${MACRO_SIGNAL_RULES.inflationLevelBufferPp}%p), 또는 ${I.nearTargetPct}% 이상에서 근원 PCE·CPI가 함께 재가속(3개월 속도가 1년치보다 ${I.reaccelPp}%p 이상 빠름)하면 부담, ${I.nearTargetPct}% 이하이면서 3개월 속도가 1년치 이하(두 지표 모두 재가속 아님)면 양호`,
    link: '물가가 목표보다 높으면 연준은 금리를 높게 유지합니다. 높은 금리는 미래 이익의 현재 가치를 낮춰 성장주 밸류에이션(PER)에 특히 부담이 됩니다.',
    asOf: macro._asOf_corePce || pace?.date || null,
    detail: { yoy, pace, paceYoy: pceYoyForPace, accelerating, direction, firedBy, composition: parts.every(Boolean) ? parts : null }
  });
}

/** The 2-year yield against the target-range midpoint — one definition for the policy axis and the chain's policy node. */
export function policyPricing(macro) {
  // Both bounds of one observation date (fed-target-range.js); a pair split across dates has no midpoint.
  const range = fedTargetRange(macro.fedTargetLower, macro.fedTargetUpper, macro._asOf_fedTargetLower, macro._asOf_fedTargetUpper);
  const upper = range?.upper ?? null;
  const lower = range?.lower ?? null;
  const mid = range?.mid ?? null;
  const twoYear = finite(macro.dgs2);
  return { upper, lower, mid, twoYear, pricing: mid != null && twoYear != null ? twoYear - mid : null };
}

const fmtNeutral = (value) => Number(value.toFixed(2)).toString();

function policyAxis({ macro, inflationState, growthState = null, neutralReal = P.neutralRealPct }) {
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
  // P1449: 2년물 − 기준금리 중간값은 정책 경로와 기간·위험 프리미엄을 분리하지 못한 대용 지표다 — the evidence row names the
  // gap's level only; the proxy caveat is the screen's method text, not a reason.
  const pricingText = pricing == null ? null : pricing >= P.pricedMovePp ? '기준금리보다 뚜렷이 높은' : pricing <= -P.pricedMovePp ? '기준금리보다 뚜렷이 낮은' : '기준금리 부근(동결에 가까운)';
  // where policy sits against neutral is the fact a rates desk leads with: a 2-year above the midpoint with a real policy
  // rate still under the neutral estimate is named beside the gap.
  const stance = realPolicy != null && realPolicy < neutralReal && corePce != null && corePce > I.targetPct
    ? ['policy.realBelowNeutral', `${realPolicy.toFixed(1)}%`, `중립 약 ${fmtNeutral(neutralReal)}%`] : null;
  const pricingSigned = pricing == null ? null : signed(pricing, 2, '%p');
  const reason = state === 'unknown' ? reasonRow(['missing'])
    : state === 'burden' ? (pricing != null && pricing >= P.pricedMovePp
      ? reasonRow(['policy.twoYearAbove', pricingSigned, `2년물 ${twoYear.toFixed(2)}%, 중간값 ${mid.toFixed(2)}%`], stance)
      : reasonRow(['policy.realTight', `${realPolicy.toFixed(1)}%`, `기준 ${P.restrictiveRealPct}%`, `중립 약 ${fmtNeutral(neutralReal)}%`]))
      : state === 'favorable' ? reasonRow(['policy.twoYearBelow', pricingSigned])
        : recessionCut ? reasonRow(['policy.recessionCut', pricingSigned])
          : pricing == null ? reasonRow(['policy.noTwoYear'])
            : reasonRow(['policy.nearMid', pricingSigned]);
  // The leg that decided a 부담: the 2-year gap first (the read's order), the real policy rate otherwise.
  const realBurden = state === 'burden' && (pricing == null || pricing < P.pricedMovePp) && realPolicy != null;
  return axis('policy', '통화정책', state, {
    gauge: realBurden ? gauge({ label: '실질 기준금리 (중간값 − 근원 PCE)', value: realPolicy, unit: '%', digits: 1, ...cuts(-2, 4, [P.restrictiveRealPct], ['neutral', 'burden'], [[neutralReal, `중립 약 ${fmtNeutral(neutralReal)}%`], [P.restrictiveRealPct, `${P.restrictiveRealPct}%`]]) }) : gauge({ label: '2년물 − 기준금리 중간값', value: pricing, unit: '%p', digits: 2, ...cuts(-1.5, 1.5, [-P.pricedMovePp, P.pricedMovePp], ['favorable', 'neutral', 'burden'], [[-P.pricedMovePp, `-${P.pricedMovePp}%p`], [P.pricedMovePp, `+${P.pricedMovePp}%p`]]) }),
    // Codex review 2026-10-05: the headline states the observed gap; the reading below says why it is not
    // a forecast of hikes (premia are not separated).
    // v60.18 (weekly audit D1 class): a 부담 decided by the real policy rate is headed by that rate, as its gauge already is —
    // '2년물이 기준금리 중간값과 비슷함' beside 부담 named the leg that did not fire.
    headline: realBurden ? `실질 기준금리 ${realPolicy.toFixed(1)}%` : pricing == null ? null : pricing >= P.pricedMovePp ? `2년물이 기준금리 중간값보다 ${pricing.toFixed(2)}%p 높음` : pricing <= -P.pricedMovePp ? `2년물이 기준금리 중간값보다 ${Math.abs(pricing).toFixed(2)}%p 낮음` : '2년물이 기준금리 중간값과 비슷함',
    evidence: [
      reason,
      // v58.63 (architecture audit M01): only the upper bound arriving threw on lower.toFixed and stopped the whole macro read.
      ['연준 목표 범위', upper == null || lower == null ? null : `${lower.toFixed(2)}~${upper.toFixed(2)}%`],
      ['2년물 − 기준금리 중간값', pricing == null ? null : `${signed(pricing, 2, '%p')} (${pricingText} 수준)`],
      ['실질 기준금리 (중간값 − 근원 PCE)', realPolicy == null ? null : `${realPolicy.toFixed(1)}% (중립 약 ${fmtNeutral(neutralReal)}%)`]
    ],
    flip: state === 'unknown' ? null : `2년물이 기준금리 중간값보다 ${P.pricedMovePp}%p 이상 높거나 실질 기준금리 ${P.restrictiveRealPct}% 이상이면 부담, ${P.pricedMovePp}%p 이상 낮고(인하 반영) 물가·성장이 부담이 아니면 양호`,
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
/**
 * v60.18 (weekly audit D1): one reading of the leg that decided the 금리 verdict (the 시장 상태 rates axis `decidedBy`), so the
 * factor headline, the chain node, the chain sentence and the legend say the same horizon, value and line. A 5-session
 * +29bp 부담 was headed '10년물 20거래일 +5bp' beside a legend that named only the 20-session ±25bp rule. Without a regime
 * (no decided leg) it reads the 20-session change, as before.
 */
export function ratesEvidence(decided, fallbackTnx20 = null) {
  const R = RULES.rates;
  const leg = decided?.leg || (fallbackTnx20 == null ? null : 'move20');
  const d20 = decided ? decided.d20 : fallbackTnx20;
  const bp = (value) => signed(value, 0, 'bp');
  // The span the deciding leg reads: five sessions for the speed and range legs, twenty otherwise.
  const five = leg === 'speed' || leg === 'range';
  const span = leg && `${leg === 'range' ? `1년 범위 ${Math.round(decided.position * 100)}%, ` : ''}${five ? `5거래일 ${bp(decided.d5)}` : `20거래일 ${bp(d20)}`}${decided?.held ? ', 판정 유지' : ''}`;
  const dir = five || leg === 'held' ? 'up' : d20 == null ? 'unknown' : d20 >= R.move20dBp ? 'up' : d20 <= -R.move20dBp ? 'down' : 'flat';
  return { leg, dir, node: span || '—', headline: span && `10년물 ${span}${leg === 'growthScare' ? ' · 주가 하락 동반(성장 걱정)' : ''}`,
    rise: dir === 'up' && span ? `10년물 ${span}${leg === 'speed' ? `(20거래일 ${bp(d20)})` : ''}` : null,
    legend: `10년물 20일 ±${R.move20dBp}bp${finite(decided?.shockAt) == null ? '' : ` 또는 5거래일 +${Math.round(decided.shockAt)}bp 이상`}` };
}

/**
 * The HY observation the 시장 상태 credit axis read (its `observation`); without a regime, the same one-observation
 * resolution (hyObservation) over macro-history and the macro snapshot. The gauge, the headline and the chain read only this.
 */
export function creditObservation({ regime = null, macro = {}, macroHistory = null } = {}) {
  const read = regime?.axes?.find((row) => row.id === 'credit')?.observation;
  if (read) return read;
  const hy = finite(macro?.hyOAS), d5 = finite(macro?.hyOASDelta5);
  return hyObservation({ macroHistory, credit: { hyBp: hy == null ? null : hy * 100, hyDelta5Bp: d5 == null ? null : d5 * 100, hyAsOf: macro?._asOf_hyOAS || null } });
}

function sharedGauges({ rateFx, regime, hyObs }) {
  const axisOf = (id) => regime?.axes?.find((row) => row.id === id) || null;
  const stateOf = (id) => axisOf(id)?.state || 'unknown';
  const decidedOf = (id) => axisOf(id)?.decidedBy || null;
  const creditDecided = decidedOf('credit');
  const hyBp = hyObs?.level ?? null;
  const hy5 = hyObs?.change5 ?? null;
  // Codex audit F06: the gauge follows the leg the verdict reported — a burden from the 20-session record is drawn on that change.
  const creditLeg = stateOf('credit') !== 'burden' ? null : creditDecided?.leg || creditCause({ hyBp, hy5, hy20Record: rateFx?.hy20Record || null }).primary;
  const creditByChange = creditLeg === 'fast5';
  const creditBy20 = creditLeg === 'wide20' && finite(rateFx?.hy20Record?.value) != null;
  // v57.50 (W1 request): a level under the tight cut is drawn favourable only when creditState() says so (5-day not
  // widening, no 20-session widening, no heavy hedging) — otherwise that band is neutral, as on the 시장 상태 axis.
  const creditVerdict = stateOf('credit') !== 'unknown' ? stateOf('credit') : creditState({ hyBp, hy5, hy20: hyObs?.change20 ?? null });
  const lowTone = creditVerdict === 'favorable' ? 'favorable' : 'neutral';
  const record20 = rateFx?.hy20Record;
  const credit = creditBy20
    ? gauge({ label: '하이일드 스프레드 20거래일 변화', value: record20.value, unit: 'bp', digits: 0, ...cuts(-50, Math.max(150, Math.ceil(record20.value / 50) * 50 + 50), [RULES.credit.widen20dBp, record20.enterBp], ['favorable', 'neutral', 'burden'], [[RULES.credit.widen20dBp, `+${RULES.credit.widen20dBp}`], [record20.enterBp, `+${Math.round(record20.enterBp)} 1년 상위`]]) })
    : creditByChange
    ? gauge({ label: '하이일드 스프레드 5거래일 변화', value: hy5, unit: 'bp', digits: 0, ...cuts(-50, 100, [0, RULES.credit.widen5dBp], ['favorable', 'neutral', 'burden'], [[0, '0'], [RULES.credit.widen5dBp, `+${RULES.credit.widen5dBp} 급확대`]]) })
    : gauge({ label: '하이일드 스프레드', value: hyBp, unit: 'bp', digits: 0, ...cuts(200, 700, [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], [lowTone, 'neutral', 'burden'], [[RULES.credit.tightBelowBp, `${RULES.credit.tightBelowBp}`], [RULES.credit.stressAtBp, `${RULES.credit.stressAtBp}`]]) });
  // v60.18 (weekly audit D1): the gauge and headline draw the leg the rates verdict reported (decidedBy), never a re-derived one.
  const ratesDecided = decidedOf('rates');
  const ratesRead = ratesEvidence(ratesDecided, rateFx?.tnx20 ?? null);
  const tnx20 = ratesDecided ? ratesDecided.d20 : rateFx?.tnx20 ?? null;
  const tnxPosition = ratesDecided ? ratesDecided.position : rateFx?.tnxPosition ?? null;
  const ratesBySpeed = ratesRead.leg === 'speed' && finite(ratesDecided.d5) != null;
  const ratesByRange = (ratesRead.leg === 'range' || ratesRead.leg === 'held') && tnxPosition != null;
  // v57.86 (live review): a 부담 held between the 80% exit and the 90% entry drew its pin in the neutral band — the cut is the exit line then.
  const ratesHeld = ratesRead.leg === 'held';
  const ratesCut = (ratesHeld ? RULES.rates.rangeExitAt : RULES.rates.rangeHighAt) * 100;
  const speedCut = ratesBySpeed ? ratesDecided.line : null;
  const rates = ratesBySpeed
    ? gauge({ label: '10년물 5거래일 변화', value: ratesDecided.d5, unit: 'bp', digits: 0, ...cuts(-40, Math.max(40, Math.ceil(ratesDecided.d5 / 10) * 10 + 10), [speedCut], ['neutral', 'burden'], [[speedCut, ratesDecided.held ? `유지 +${Math.round(speedCut)}` : `+${Math.round(speedCut)} 1년 상위`]]) })
    : ratesByRange
    ? gauge({ label: '10년물 1년 범위 내 위치', value: tnxPosition * 100, unit: '%', digits: 0, ...cuts(0, 100, [ratesCut], ['neutral', 'burden'], [[ratesCut, ratesHeld ? `유지 ${ratesCut}%` : `상단 ${ratesCut}%`]]) })
    : gauge({ label: '10년물 20일 변화', value: tnx20, unit: 'bp', digits: 0, ...cuts(-75, 75, [-RULES.rates.move20dBp, RULES.rates.move20dBp], ['favorable', 'neutral', 'burden'], [[-RULES.rates.move20dBp, `-${RULES.rates.move20dBp}`], [RULES.rates.move20dBp, `+${RULES.rates.move20dBp}`]]) });
  // v60.18: the values (and leg) the 시장 상태 verdict read override the macro screen's own closes.
  const commodityDecided = decidedOf('commodities');
  const { wti20 = null, wti5 = null, dxy20 = null, wtiPosition = null, dxyPosition = null } = { ...rateFx, ...commodityDecided };
  const dollarLine = dxyPosition != null && dxyPosition >= RULES.dollar.rangeHighAt ? RULES.dollar.rise20dPct : RULES.dollar.rise20dPct + RULES.dollar.bufferPct;
  // v60.18: the leg the commodities verdict reported; the re-derivation is only the no-regime fallback (it ignored a held Brent/WTI pair).
  const commodityTrigger = stateOf('commodities') !== 'burden' ? 'dollar'
    : commodityDecided?.leg || (rateFx?.wtiHigh ? 'oil-range' : wti20 != null && wti20 >= RULES.oil.rise20dPct ? 'oil-change' : 'dollar');
  const commodities = commodityTrigger === 'oil-range' && wtiPosition != null
    ? gauge({ label: 'WTI 1년 범위 내 위치', value: wtiPosition * 100, unit: '%', digits: 1, ...cuts(0, 100, [RULES.oil.rangeHighAt * 100], ['neutral', 'burden'], [[RULES.oil.rangeHighAt * 100, `${RULES.oil.rangeHighAt * 100}%`]]) })
    : commodityTrigger === 'oil-change'
      ? gauge({ label: 'WTI 20일 변화', value: wti20, unit: '%', digits: 1, ...cuts(-20, 20, [RULES.oil.fall20dPct, RULES.oil.rise20dPct], ['favorable', 'neutral', 'burden'], [[RULES.oil.fall20dPct, `${RULES.oil.fall20dPct}%`], [RULES.oil.rise20dPct, `+${RULES.oil.rise20dPct}%`]]) })
      // v57.84 (threshold consolidation): the burden band starts where dollarRiseBurden() does — rise20dPct + bufferPct, or
      // rise20dPct at the top of the dollar's one-year range — and the falling band is favourable only when the axis is (easing
      // needs oil falling too). DXY +2.2% read 중립 on the axis with the pin in the burden band.
      : gauge({ label: '달러 지수 20일 변화', value: dxy20, unit: '%', digits: 1, ...cuts(-5, 5, [0, dollarLine], [stateOf('commodities') === 'favorable' ? 'favorable' : 'neutral', 'neutral', 'burden'], [[dollarLine, `+${dollarLine}%`]]) });
  const koreaDecided = decidedOf('korea');
  const { krw20 = null, jpy20 = null } = { ...rateFx, ...koreaDecided };
  const yenLeg = koreaDecided ? koreaDecided.leg === 'yen' && jpy20 != null
    : stateOf('korea') === 'burden' && (krw20 == null || krw20 < RULES.fx.krwMove20dPct) && jpy20 != null && jpy20 <= -RULES.fx.yenRally20dPct;
  return {
    rates: { gauge: rates, headline: ratesRead.headline, evidence: ratesRead },
    // P1726: the 5-session WTI move is named when it runs against the 20-session direction; v60.18: a 부담 from the WTI range names it.
    commodities: { gauge: commodities, headline: wti20 == null ? null : `WTI ${commodityTrigger === 'oil-range' && wtiPosition != null ? `1년 범위 ${Math.round(wtiPosition * 100)}%, ` : ''}20거래일 ${signed(wti20, 1, '%')}${wti5 != null && Math.abs(wti5) >= RULES.oil.turn5dPct && Math.sign(wti5) !== Math.sign(wti20) ? `(최근 5일 ${signed(wti5, 1, '%')})` : ''}, 달러 ${signed(dxy20, 1, '%')}` },
    credit: { gauge: credit, headline: hyBp == null ? null : `하이일드 ${hyBp.toFixed(0)}bp${hy5 == null ? '' : ` (5거래일 ${signed(hy5, 0, 'bp')}${creditBy20 ? `, 20거래일 ${signed(record20.value, 0, 'bp')}` : ''})`}` },
    korea: yenLeg
      ? { gauge: gauge({ label: '엔화 20일 강세 폭 (엔/달러 하락률)', value: -jpy20, unit: '%', digits: 1, ...cuts(-5, 8, [RULES.fx.yenRally20dPct], ['neutral', 'burden'], [[RULES.fx.yenRally20dPct, `+${RULES.fx.yenRally20dPct}% 엔 급강세`]]) }), headline: `엔/달러 20거래일 ${signed(jpy20, 1, '%')}, 엔 강세` } /* v59.45 (P18-FX-01): the USD/JPY fall, not the yen's own return */
      // v57.86 (live review): a won past -2% held at 중립 (KOSPI contradicts, last-day turn, endpoint-only) drew its pin in the
      // favourable band — each outer band takes its tone only when the axis reached it, as the dollar gauge does.
      : { gauge: gauge({ label: '원/달러 20거래일 변화', value: krw20, unit: '%', digits: 1, ...cuts(-5, 5, [-RULES.fx.krwMove20dPct, RULES.fx.krwMove20dPct], [stateOf('korea') === 'favorable' ? 'favorable' : 'neutral', 'neutral', stateOf('korea') === 'burden' ? 'burden' : 'neutral'], [[-RULES.fx.krwMove20dPct, `-${RULES.fx.krwMove20dPct}%`], [RULES.fx.krwMove20dPct, `+${RULES.fx.krwMove20dPct}%`]]) }), headline: krw20 == null ? null : `원/달러 20일 ${signed(krw20, 1, '%')}` }
  };
}

// v57.50 D16/D17: a direction is set only by a signal past its cut. Within the dead band (growth: half the
// slowdown step around the cut; prices: |3-month pace − year| below the re-acceleration step) the direction is held,
// and "no slowdown signal" alone is no longer read as 견조 — 견조 needs the payroll level the growth axis calls solid.
export const REGIME_CRITERIA = `성장 방향: Sahm 지표 ${G.sahmWatchAt}%p 이상이거나 최근 3개월 일자리 증가가 그 전 3개월보다 ${G.payrollSlowdownK / 10}만 명 넘게 적으면 둔화, 둔화 신호가 없고 3개월 평균이 ${G.payrollSolidK / 10}만 명 이상이면 견조, 둘 다 아니면 확인 안 됨, 둔화 기준과의 차이가 ${(G.payrollSlowdownK / 2 * 1000).toLocaleString('en-US')}명 미만이면 근소(경계)로 보고 방향을 정하지 않음. 물가 방향: 근원 PCE와 근원 CPI 각각의 최근 3개월 속도(연율)와 전년 대비의 차이가 ${I.reaccelPp}%p 이상이면 그 쪽(빠르면 상승, 느리면 둔화), 두 지표가 같은 쪽이면 그 방향, 반대쪽이면 엇갈림, 한쪽이라도 ${I.reaccelPp}%p 미만이면 방향 보류(각 지표의 가장 최근 발표 기준). 두 방향이 모두 정해질 때만 사분면을 표시합니다.`;

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
  const splitShort = dirFlag?.state === 'mixed' ? [dirFlag.pce, dirFlag.cpi].map((row) => `${row.name}${row.month ? ` ${row.month}` : ''} ${row.dir === 'up' ? '재가속' : '둔화'}`).join(', ') : null;
  const flatNote = dirFlag?.state === 'flat' ? [dirFlag.pce, dirFlag.cpi].filter(Boolean).filter((row) => row.dir === 'flat').map((row) => `${row.name} 3개월 연율과 전년 대비의 차이 ${Math.abs(row.margin).toFixed(1)}%p(${I.reaccelPp}%p 미만)`).join(', ') : null;
  const near = {
    growth: growthMargin != null && Math.abs(growthMargin) < G.payrollSlowdownK / 2 ? `일자리 3개월 평균이 둔화 기준(직전 3개월 − ${peopleText(G.payrollSlowdownK)} = ${peopleText(g.payroll.prior3 - G.payrollSlowdownK)})과 ${peopleText(Math.abs(growthMargin))} 차이로, 기준 폭의 절반에 못 미칩니다` : null,
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
  const asOfNote = [g?.payroll ? `고용 ${periodLabel(g.payroll.date)}` : null, i?.pace ? `근원 PCE ${periodLabel(i.pace.date)}` : null, dirFlag?.cpi?.date ? `근원 CPI ${periodLabel(dirFlag.cpi.date)}` : null].filter(Boolean).join(', ');
  const timing = asOfNote ? `사분면은 ${asOfNote} 발표 기준입니다${gdpLast ? `(아래 실질 GDP 카드는 ${periodLabel(gdpLast.date, 'quarterly')} 기준이라 더 이릅니다)` : ''}.` : null;
  // v57.50 D18: the quadrant reads the 3-month SPEED of prices, so its label says "물가 속도 둔화" — beside an inflation
  // axis that can still read 부담 on the level. Regime readings describe what tended to happen, not where to allocate.
  const table = {
    'up/down': { id: 'goldilocks', label: '성장 견조, 물가 속도 둔화', tone: 'favorable', reading: '이익이 늘면서 금리 부담은 줄어드는 조합입니다. 과거 사례에서 주식이 강했던 경우가 있었지만 항상 그런 것은 아니며, 이 설명은 사례 기반이라 지금의 예측이 아닙니다.' },
    'up/up': { id: 'reflation', label: '성장 견조, 물가 상승', tone: 'neutral', reading: '이익은 늘지만 금리가 오르기 쉬운 조합입니다. 과거 이런 국면에서는 금리에 민감한 성장주의 변동이 컸던 경향이 있습니다. 사례 기반의 설명이며 지금의 예측이 아닙니다.' },
    'down/up': { id: 'stagflation', label: '성장 둔화, 물가 상승', tone: 'burden', reading: '이익은 줄고 연준은 금리를 내리기 어려운 조합으로, 주식과 채권이 함께 약했던 경우가 많습니다(1970년대, 2022년). 사례 기반의 설명이며 지금의 예측이 아닙니다.' },
    'down/down': { id: 'disinflation-slowdown', label: '성장 둔화, 물가 속도 둔화', tone: 'neutral', reading: '역사적으로 금리 인하 기대에 채권이 강해진 국면이었고, 주식은 경기 둔화의 깊이에 따라 엇갈렸습니다. 이 설명은 사례 기반의 역사적 경향이며, 지금 관측된 10년물 움직임과 별개입니다 — 금리의 현재 상태는 시장 상태 화면(금리 축)에서 확인합니다.' }
  };
  const key = growthDir && inflationDir ? `${growthDir}/${inflationDir}` : null;
  // Codex browser audit H14: the quadrant could not be reproduced from the screen. Each rule is listed with the
  // value it read, the threshold and the outcome, so the placement can be recomputed from these rows alone.
  const n = (value, digits = 1) => (value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits));
  const inputs = [
    g?.sahm ? ['Sahm 지표', `${n(g.sahm.value, 2)}%p`, `${G.sahmWatchAt}%p 이상이면 둔화`, g.sahm.value >= G.sahmWatchAt ? '둔화 신호' : '기준 미만'] : ['Sahm 지표', '—', `${G.sahmWatchAt}%p 이상이면 둔화`, '자료 없음'],
    g?.payroll ? ['일자리 증가 3개월 평균', `${peopleText(g.payroll.avg3)} (직전 3개월 ${peopleText(g.payroll.prior3)})`, `직전보다 ${peopleText(G.payrollSlowdownK)} 넘게 적으면 둔화, ${peopleText(G.payrollSolidK)} 이상이면 견조`, growthHeld ? (near.growth ? '경계, 방향 보류 (근소)' : `${growthHeld} — 방향 보류`) : g.sahm && g.sahm.value >= G.sahmWatchAt ? '판정은 Sahm 지표' : growthDir === 'down' ? '둔화 신호' : '견조'] : ['일자리 증가 3개월 평균', '—', '직전 3개월과 비교', '자료 없음'],
    ...(dirFlag ? [dirFlag.pce, dirFlag.cpi].filter(Boolean).map((row) => [`${row.name}${row.month ? ` (${row.month})` : ''}`, `최근 3개월 연율 ${n(row.pace)}%, 전년 대비 ${n(row.yoy)}%`, `차이 ${I.reaccelPp}%p 이상이면 그 방향(빠르면 상승, 느리면 둔화)`, row.dir === 'up' ? '상승 방향' : row.dir === 'down' ? '둔화 방향' : `방향 없음 (차이 ${n(Math.abs(row.margin))}%p)`])
      : [i?.pace && i.yoy != null ? ['근원 PCE', `최근 3개월 연율 ${n(i.pace.value)}%, 전년 대비 ${n(i.paceYoy ?? i.yoy)}%`, `차이 ${I.reaccelPp}%p 이상이면 그 방향(빠르면 상승, 느리면 둔화)`, inflationHeld ? `${inflationHeld} (차이 ${n(Math.abs(inflationMargin))}%p)` : inflationDir === 'up' ? '상승 방향' : '둔화 방향'] : ['근원 PCE', '—', '3개월 연율과 전년 대비 비교', '자료 없음']]),
    ...(dirFlag && !dirFlag.single ? [['물가 방향 (두 지표)', dirFlag.label, '두 지표가 같은 쪽이어야 방향, 반대면 엇갈림', inflationDir ? (inflationDir === 'up' ? '상승 방향' : '둔화 방향') : inflationHeld === '방향 보류' ? '방향 보류' : `${inflationHeld} — 방향 보류`]] : [])
  ];
  const picked = key ? table[key] : null;
  if (picked) return { ...picked, available: true, provisional, growthDir, inflationDir, criteria: REGIME_CRITERIA, inputs, near, held, timing, inflationSplit: null };
  // v57.50 D16/D17: say which direction is held and why, instead of a bare "판정 보류".
  const heldParts = [
    growthHeld ? `성장 방향 ${growthHeld}` : growthDir ? null : '성장 방향 자료 부족',
    inflationHeld ? `물가 방향 ${inflationHeld}${splitShort ? `(${splitShort})` : ''}` : inflationDir ? null : '물가 방향 자료 부족'
  ].filter(Boolean);
  const knownParts = [growthDir ? `성장 ${growthDir === 'up' ? '견조' : '둔화'}` : null, inflationDir ? `물가 속도 ${inflationDir === 'up' ? '상승' : '둔화'}` : null].filter(Boolean);
  const reading = `${heldParts.join(', ')} — 사분면을 확정하지 않습니다${knownParts.length ? ` — 정해진 쪽은 ${knownParts.join(', ')}입니다` : ''}. 기준과의 차이가 커지는 다음 발표에서 다시 판정합니다.`;
  // v58.74 (text audit C2): a held quadrant names what settles it — the cut each held input has to cross at the next release
  // (the payroll cuts move with the trailing 3 months once a new month arrives, so they are today's lines).
  const deciders = [
    // Feature audit 2026-11-02: both 3-month windows roll at the next report, so today's cut (prior3 − 1.5·step) was not
    // the line the next print has to cross. Restate it as the single new monthly print, on the rolled windows
    // (prior revisions ignored).
    !growthDir && nextPayrollCuts(g?.payroll, G) ? (({ down, up }) => `다음 고용보고서의 한 달 일자리 증가가 ${peopleText(down, { sign: true })} 이하면 '성장 둔화', ${peopleText(up, { sign: true })} 이상이면 '성장 견조'로 정해집니다(이전 달 수정치 제외).`)(nextPayrollCuts(g.payroll, G)) : null,
    !inflationDir && inflationHeld === '엇갈림' ? `근원 PCE와 근원 CPI의 3개월 속도가 같은 쪽으로 모이면(둘 다 전년 대비보다 ${I.reaccelPp}%p 이상 빠르거나 느림) 물가 방향이 정해집니다.` : null,
    !inflationDir && inflationHeld && inflationHeld !== '엇갈림' ? `근원 물가 3개월 연율이 전년 대비보다 ${I.reaccelPp}%p 이상 빠르면 '물가 속도 상승', 그만큼 느리면 '물가 속도 둔화'로 정해집니다.` : null
  ].filter(Boolean);
  const decider = deciders.length ? deciders.join(' ') : null;
  return { available: false, label: '국면 판정 보류', tone: 'unknown', reading, decider, provisional: true, growthDir, inflationDir, criteria: REGIME_CRITERIA, inputs, near, held, timing, inflationSplit: splitShort };
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

// v57.50 I04: where the 매크로 / 금리 · 환율 reading continues. Links follow the axis states and name why; sectors are
// pointed to through the observed rotation (테마 · 섹터), never through an assumed macro beta per industry.
export function macroNextSteps(read) {
  const byId = Object.fromEntries((read?.axes || []).map((row) => [row.id, row]));
  const state = (id) => byId[id]?.state || 'unknown';
  const label = (id) => byId[id]?.stateLabel || '판정 보류';
  const next = [];
  if (state('rates') === 'burden' || state('rates') === 'neutral') next.push({ route: 'fxbond', label: '금리와 환율', why: `금리, 할인율 ${label('rates')} — 수익률 곡선·실질금리 중 어디에서 오는지` });
  const SHORT = { inflation: '물가', rates: '금리', commodities: '유가·달러' };
  const pressure = ['inflation', 'rates', 'commodities'].filter((id) => state(id) === 'burden').map((id) => SHORT[id]);
  next.push({ route: 'themes', label: '테마와 섹터', why: pressure.length
    ? `${pressure.join(', ')} 부담 속에서 실제로 시장보다 강한 섹터가 어디인지(섹터 회전 관측)`
    : '지금의 매크로 국면에서 실제로 시장보다 강한 섹터가 어디인지(섹터 회전 관측)' });
  next.push({ route: 'signal', label: '시장 상태', why: `금리·유가와 달러·신용은 시장 상태와 같은 판정 — 추세·시장 폭까지 합친 6개 지표 전체(신용 ${label('credit')})` });
  next.push({ route: 'briefing', label: '브리핑', why: '다음 7일 고용·물가·연준 발표 일정과 오늘 종가 해석' });
  return next;
}

export function ratesNextSteps({ read = null, carry = null } = {}) {
  const byId = Object.fromEntries((read?.axes || []).map((row) => [row.id, row]));
  const label = (id) => byId[id]?.stateLabel || '판정 보류';
  const next = [{ route: 'macro', label: '매크로', why: `물가 ${label('inflation')}, 통화정책 ${label('policy')} — 금리 경로를 움직이는 쪽` }];
  next.push({ route: 'signal', label: '시장 상태', why: `금리(${label('rates')})와 추세·시장 폭을 합친 판정${carry?.available ? ` (환율은 참고로 따로 표시, 엔/달러 20거래일 ${signed(-carry.yenStrength, 1, '%')})` : ''}` });
  if (byId.rates?.state === 'burden' || byId.rates?.state === 'favorable') next.push({ route: 'themes', label: '테마와 섹터', why: `금리 ${label('rates')} 국면에서 섹터 회전(선도·후행)이 어떻게 나타나는지` });
  next.push({ route: 'briefing', label: '브리핑', why: '다음 7일 국채·물가·연준 일정과 오늘 금리·달러 움직임 해석' });
  return next;
}

export function buildMacroRead({ macro = null, macroHistory = null, regime = null, rateFx = null, history = null } = {}) {
  if (!rateFx && Array.isArray(history)) rateFx = closeChanges(history);
  const m = macro && typeof macro === 'object' ? macro : {};
  const mh = macroHistory?.schemaVersion === 'macro-history.v1' ? macroHistory : null;
  const gauges = sharedGauges({ rateFx: { ...(rateFx || {}), hy20Record: mh ? hyWidening20Record(mh) : null }, regime, hyObs: creditObservation({ regime, macro: m, macroHistory: mh }) });
  const oil = brentWtiCheck(macroHistory, Array.isArray(history) ? history : []);
  const growth = growthAxis({ macro: m, mh });
  const inflation = inflationAxis({ macro: m, mh });
  // v59.59 (logic refactor, feature audit 11-02): one neutral real rate — the FOMC SEP longer-run median − 2% the Taylor
  // rule uses (1.0% fixed here vs 1.2% there on the same screen); the fixed 1% only when no current SEP value is collected.
  const sep = mh ? sepNeutral(mh) : null;
  const policy = policyAxis({ macro: m, inflationState: inflation.state, growthState: growth.state, neutralReal: sep && !sep.old && !sep.stale ? sep.rStar : P.neutralRealPct });
  const axes = [
    growth, inflation, policy,
    // a growth-scare hold names itself on the tile (ratesEvidence: '10년물 20거래일 -38bp' alone read as relief marked 중립).
    reuse(regime, 'rates', '금리, 할인율', '10년물 금리는 주식 가치를 계산하는 할인율의 기준입니다. 빠르게 오르면 PER이 높은 성장주부터 부담을 받습니다.', gauges.rates),
    { ...reuse(regime, 'commodities', '유가, 달러', '유가는 물가(에너지는 CPI의 약 7%)와 소비 여력에, 달러는 해외 매출 환산과 신흥국 자금 흐름에 영향을 줍니다.', gauges.commodities), caveat: oilDivergence(oil).held ? '두 유가(브렌트·WTI)의 같은 날 비교는 WTI 원유 차트 설명에 있습니다.' : null },
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
    oil,
    // The market regime's leadership-break test, so the scenario gates read the same AI-leadership verdict (aibust).
    leadership: regime?.leadership || null,
    sharedGauges: gauges,
    labels: { monthDay, monthLabel }
  };
}
