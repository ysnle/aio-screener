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

function changeOver(series, sessions) {
  if (series.length <= sessions) return null;
  return series[series.length - 1].value - series[series.length - 1 - sessions].value;
}

function axis(id, title, state, { evidence = [], read, flip, link, asOf, detail = null }) {
  return { id, title, state, stateLabel: STATE_LABELS[state], evidence: evidence.filter(([, value]) => value != null && value !== '—'), read, flip, link, asOf, detail };
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
  else if ((sahm && sahm.value >= 0.5) || (payroll && payroll.avg3 < 0) || (!payroll && nfp != null && nfp < 0)) state = 'burden';
  else if (sahm && sahm.value < 0.3 && payroll && payroll.avg3 >= 100) state = 'favorable';
  const partial = !sahm || !payroll ? ' 3개월 추세와 Sahm 지표는 월별 기록이 쌓이면 반영됩니다.' : '';
  const read = state === 'burden'
    ? (sahm && sahm.value >= 0.5 ? `실업률 3개월 평균이 1년 저점보다 ${sahm.value.toFixed(2)}%p 높아 Sahm 경기침체 신호(0.5%p)를 넘었습니다.` : '일자리가 줄고 있습니다 — 경기 둔화가 고용으로 번졌습니다.')
    : state === 'favorable' ? '고용이 꾸준히 늘고 실업률이 안정적입니다 — 기업 이익의 바탕이 되는 소비가 버티는 환경입니다.'
      : state === 'unknown' ? '고용 자료를 기다리는 중입니다.'
        : `고용 증가가 느려졌거나 실업률이 조금씩 오르는 중간 구간입니다.${partial}`;
  return axis('growth', '성장 (고용 · 소비)', state, {
    evidence: [
      ['실업률', unrate == null ? null : `${unrate.toFixed(1)}%${finite(macro.unemploymentDelta) != null ? ` (전월 ${signed(finite(macro.unemploymentDelta), 1, '%p')})` : ''}`],
      ['Sahm 지표', sahm ? `${sahm.value.toFixed(2)}%p (0.5 이상이면 침체 신호)` : null],
      [payroll ? '일자리 3개월 평균' : '일자리 (최근 1개월)', payroll ? `${signed(payroll.avg3, 0)}천 명 (그 전 3개월 ${signed(payroll.prior3, 0)}천 명)` : nfp == null ? null : `${signed(nfp, 0)}천 명`],
      ['신규 실업수당 청구 (4주 평균)', claims ? `${(claims.avg4 / 10000).toFixed(1)}만 건 (1년 저점 대비 ${signed(claims.aboveLow, 0, '%')})` : null],
      ['소매판매 (전년 대비)', retailYoy ? `${signed(retailYoy.value, 1, '%')}` : finite(macro.retailSales) == null ? null : `전월 대비 ${signed(finite(macro.retailSales), 1, '%')}`]
    ],
    read,
    flip: state === 'unknown' ? null : 'Sahm 지표 0.5%p 이상 또는 일자리 3개월 평균 감소면 부담 · Sahm 0.3%p 미만이면서 3개월 평균 10만 명 이상이면 우호 (10만 명은 노동력 증가를 흡수하는 수준으로 흔히 쓰는 기준)',
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
  const accelerating = pace ? pace.value >= (yoy ?? Infinity) + 0.5 : null;
  let state = 'neutral';
  if (yoy == null) state = 'unknown';
  else if (yoy >= 3 || (accelerating && yoy >= 2.5)) state = 'burden';
  else if (yoy <= 2.5 && (pace ? pace.value <= yoy : delta != null && delta <= 0)) state = 'favorable';
  const gap = yoy == null ? null : yoy - 2;
  const read = state === 'burden'
    ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 연준 목표(2%)보다 ${gap.toFixed(1)}%p 높습니다${accelerating ? ` — 최근 3개월 속도(연율 ${pace.value.toFixed(1)}%)가 더 빨라 다시 오르는 중입니다` : ''}. 연준이 금리를 내리기 어려운 조건입니다.`
    : state === 'favorable' ? `근원 PCE 물가가 ${yoy.toFixed(1)}%로 목표에 가깝고 오르는 속도가 줄고 있습니다 — 금리 인하 여지가 생기는 조건입니다.`
      : state === 'unknown' ? '물가 자료를 기다리는 중입니다.'
        : `근원 PCE 물가 ${yoy.toFixed(1)}% — 목표보다 높지만 다시 빨라지는 신호는 뚜렷하지 않습니다.${pace ? '' : ' 3개월 속도는 월별 기록이 쌓이면 반영됩니다.'}`;
  return axis('inflation', '물가', state, {
    evidence: [
      ['근원 PCE (전년 대비)', yoy == null ? null : `${yoy.toFixed(1)}% (목표 2% 대비 ${signed(gap, 1, '%p')})`],
      ['근원 PCE 3개월 속도 (연율)', pace ? `${pace.value.toFixed(1)}% ${pace.value > yoy ? '— 1년 평균보다 빠름' : '— 1년 평균보다 느림'}` : null],
      ['근원 CPI 3개월 속도 (연율)', coreCpiPace ? `${coreCpiPace.value.toFixed(1)}%` : null],
      ['6개월 전 근원 PCE', sixMonthsAgo == null ? null : `${sixMonthsAgo.toFixed(1)}%`],
      ['헤드라인 CPI · PCE', finite(macro.cpi) == null ? null : `${finite(macro.cpi).toFixed(1)}% · ${finite(macro.pce)?.toFixed(1) ?? '—'}%`],
      ['10년 기대인플레이션', breakeven == null ? null : `${breakeven.toFixed(2)}%`]
    ],
    read,
    flip: state === 'unknown' ? null : '근원 PCE 3.0% 이상, 또는 2.5% 이상에서 3개월 속도가 1년치보다 0.5%p 이상 빠르면 부담 · 2.5% 이하이면서 3개월 속도가 1년치 이하면 우호',
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
  else if ((pricing != null && pricing >= 0.25) || (realPolicy != null && realPolicy >= 2)) state = 'burden';
  else if (pricing != null && pricing <= -0.25 && inflationState !== 'burden') state = 'favorable';
  const pricingText = pricing == null ? null : pricing >= 0.25 ? '추가 인상 가능성을 반영' : pricing <= -0.25 ? '금리 인하를 반영' : '동결에 가까운 경로를 반영';
  const read = state === 'burden'
    ? (pricing != null && pricing >= 0.25 ? `2년물(${twoYear.toFixed(2)}%)이 기준금리 중간값(${mid.toFixed(2)}%)보다 ${pricing.toFixed(2)}%p 높습니다 — 시장이 금리를 더 올릴 수 있다고 보고 있습니다.` : `물가를 뺀 실질 기준금리가 ${realPolicy.toFixed(1)}%로 중립 수준(약 1%)보다 훨씬 높은 긴축 상태입니다.`)
    : state === 'favorable' ? `2년물이 기준금리보다 ${Math.abs(pricing).toFixed(2)}%p 낮습니다 — 시장이 금리 인하를 내다보고 있습니다.`
      : state === 'unknown' ? '정책금리나 2년물 자료를 기다리는 중입니다.'
        : `시장은 당분간 ${pricingText || '큰 변화 없는 경로'}하고 있습니다.`;
  return axis('policy', '통화정책', state, {
    evidence: [
      ['연준 목표 범위', upper == null ? null : `${lower.toFixed(2)}–${upper.toFixed(2)}%`],
      ['2년물 − 기준금리 중간값', pricing == null ? null : `${signed(pricing, 2, '%p')} (${pricingText})`],
      ['실질 기준금리 (중간값 − 근원 PCE)', realPolicy == null ? null : `${realPolicy.toFixed(1)}% (중립 약 1%)`]
    ],
    read,
    flip: state === 'unknown' ? null : '2년물이 기준금리 중간값보다 0.25%p 이상 높거나 실질 기준금리 2% 이상이면 부담 · 0.25%p 이상 낮고(인하 반영) 물가가 부담이 아니면 우호',
    link: '2년물 금리는 시장이 예상하는 앞으로 1~2년의 기준금리입니다. 인상 쪽으로 기울면 달러 강세와 높은 할인율이 함께 오고, 인하 쪽이면 반대입니다. 단, 경기 악화 때문에 인하를 반영하는 경우는 주식에 좋은 신호가 아닙니다.',
    asOf: macro._asOf_dgs2 || null,
    detail: { mid, pricing, realPolicy }
  });
}

function reuse(regime, id, title, link) {
  const row = regime?.axes?.find((item) => item.id === id);
  if (!row) return axis(id, title, 'unknown', { read: '종가 기록을 불러오는 중입니다.', link });
  return { ...row, title, link, shared: true };
}

/** Growth × inflation direction — the classic four-regime frame, with its historical tendency as 해석. */
function buildRegime(growth, inflation) {
  const g = growth.detail;
  const i = inflation.detail;
  const growthDir = g?.payroll && g?.sahm ? (g.sahm.value >= 0.3 || g.payroll.avg3 < g.payroll.prior3 - 25 ? 'down' : 'up')
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
    ? { ...picked, available: true, provisional, growthDir, inflationDir }
    : { available: false, label: '국면 판정 보류', tone: 'unknown', reading: '성장과 물가의 방향을 모두 확인한 뒤 국면을 표시합니다.', provisional: true, growthDir, inflationDir };
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
    { id: 'oil', label: '유가 (WTI)', value: wti20 == null ? '—' : `20일 ${signed(wti20, 1, '%')}`, dir: dir(wti20, 5, -5) },
    { id: 'breakeven', label: '기대인플레이션', value: bei5 == null ? '—' : `1주 ${signed(bei5 * 100, 0, 'bp')}`, dir: dir(bei5 == null ? null : bei5 * 100, 5, -5) },
    { id: 'policy', label: '연준 경로 (2년물)', value: pricing == null ? '—' : pricing >= 0.25 ? '인상 반영' : pricing <= -0.25 ? '인하 반영' : '동결 반영', dir: dir(pricing, 0.25, -0.25) },
    { id: 'rates', label: '장기금리 (10년물)', value: tnx20 == null ? '—' : `20일 ${signed(tnx20, 0, 'bp')}`, dir: dir(tnx20, 15, -15) },
    { id: 'valuation', label: '주식 밸류에이션', value: axisById.rates ? `금리 축 ${axisById.rates.stateLabel}` : '—', dir: axisById.rates?.state === 'burden' ? 'down' : axisById.rates?.state === 'favorable' ? 'up' : 'flat' }
  ];
  const links = [];
  if (nodes[0].dir !== 'unknown' && nodes[0].dir !== 'flat' && nodes[0].dir === nodes[1].dir) links.push(`유가와 기대인플레이션이 함께 ${nodes[0].dir === 'up' ? '오르고' : '내리고'} 있습니다 — 유가가 물가 예상으로 옮겨 가는 경로가 작동 중입니다.`);
  if (nodes[2].dir === 'up') links.push('2년물이 기준금리보다 높아 시장이 추가 인상 가능성을 가격에 넣고 있습니다.');
  if (nodes[2].dir === 'down') links.push('2년물이 기준금리보다 낮아 시장이 금리 인하를 가격에 넣고 있습니다.');
  if (nodes[3].dir === 'up') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 올랐습니다${real5 != null && bei5 != null && real5 > bei5 && real5 > 0 ? ' — 상승 대부분이 실질금리라 성장주 밸류에이션에 더 직접적입니다' : ''}.`);
  if (nodes[3].dir === 'down') links.push(`10년물이 20일 동안 ${signed(tnx20, 0, 'bp')} 내려 할인율 부담이 줄고 있습니다.`);
  const branches = [
    { id: 'dollar', label: '달러', value: dxy20 == null ? '—' : `20일 ${signed(dxy20, 1, '%')}`, dir: dir(dxy20, 1, -1), effect: dxy20 == null ? null : dxy20 >= 1 ? '달러 강세 → 미국 다국적 기업의 해외 매출 환산 감소, 신흥국·원화 약세(외국인 순매도 압력)' : dxy20 <= -1 ? '달러 약세 → 해외 매출 환산 증가, 신흥국·원화에 우호적' : '달러는 큰 방향 없이 움직이고 있습니다' },
    { id: 'credit', label: '신용 스프레드', value: hy5 == null ? '—' : `1주 ${signed(hy5 * 100, 0, 'bp')}`, dir: dir(hy5 == null ? null : hy5 * 100, 15, -15), effect: hy5 == null ? null : hy5 * 100 >= 15 ? '스프레드 확대 → 기업 자금 조달 비용 상승, 주식 위험 프리미엄 상승' : hy5 * 100 <= -15 ? '스프레드 축소 → 자금 조달 여건 개선' : '신용 시장은 안정적입니다' }
  ];
  // Colour by effect on stocks: every node rising is a headwind except valuation, where a fall is.
  const impact = (node) => node.dir === 'unknown' || node.dir === 'flat' ? node.dir : (node.id === 'valuation' ? node.dir === 'down' : node.dir === 'up') ? 'burden' : 'favorable';
  return { nodes: nodes.map((node) => ({ ...node, impact: impact(node) })), links, branches: branches.map((node) => ({ ...node, impact: impact(node) })) };
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
  return { basis, wti20: change('wti'), dxy20: change('dxy'), tnx20: change('tnx', 'bp'), gold20: change('gold') };
}

export function buildMacroRead({ macro = null, macroHistory = null, regime = null, rateFx = null, history = null } = {}) {
  if (!rateFx && Array.isArray(history)) rateFx = closeChanges(history);
  const m = macro && typeof macro === 'object' ? macro : {};
  const mh = macroHistory?.schemaVersion === 'macro-history.v1' ? macroHistory : null;
  const growth = growthAxis({ macro: m, mh });
  const inflation = inflationAxis({ macro: m, mh });
  const policy = policyAxis({ macro: m, inflationState: inflation.state });
  const axes = [
    growth, inflation, policy,
    reuse(regime, 'rates', '금리 · 할인율', '10년물 금리는 주식 가치를 계산하는 할인율의 기준입니다. 빠르게 오르면 PER이 높은 성장주부터 부담을 받습니다.'),
    reuse(regime, 'commodities', '유가 · 달러', '유가는 물가(에너지는 CPI의 약 7%)와 소비 여력에, 달러는 해외 매출 환산과 신흥국 자금 흐름에 영향을 줍니다.'),
    reuse(regime, 'credit', '신용', '하이일드 스프레드가 넓어지면 기업 자금 조달이 어려워지고, 주식 하락이 신용 위험으로 번지고 있다는 신호가 됩니다.')
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
    labels: { monthDay, monthLabel }
  };
}
