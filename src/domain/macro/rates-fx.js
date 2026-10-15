// P1425 (owner review 2026-10-03, 거시 screen rebuild): the 금리 · 환율 tab reads the official
// Treasury par-yield cut, FRED real yield / breakeven / HY spread, and the dollar, won and yen on
// the same completed-close basis as 시장 상태. It replaces fixed level verdicts (DXY >= 107 or
// 10Y >= 5% = '높은 수준', 10Y >= 4.7% = '주식 압박') and the four-axis bull/bear count with the
// observed level, its change and its date. The only rule shown is the one 시장 상태 already uses:
// a yen rally of 3% or more in 20 sessions marks the FX axis as a burden.
import { buildCloseSeries, closeBasis, sessionPointBack as closeSessionPointBack } from '../briefing/market-read.js';
import { resolveMarketCalendarSession } from '../market/market-calendar.js';
import { RULES } from '../rules/thresholds.js';

export const YEN_RALLY_RULE = RULES.fx.yenRally20dPct; // % in 20 sessions — the 시장 상태 FX-axis rule (P1428 registry)
const CHART_SESSIONS = 126; // about six months of completed sessions

export const TREASURY_TENORS = Object.freeze([
  Object.freeze({ id: 'dgs2', label: '2년', years: 2 }),
  Object.freeze({ id: 'dgs5', label: '5년', years: 5 }),
  Object.freeze({ id: 'dgs10', label: '10년', years: 10 }),
  Object.freeze({ id: 'dgs20', label: '20년', years: 20 }),
  Object.freeze({ id: 'dgs30', label: '30년', years: 30 })
]);

// v57.50 (W1 request): the completed-close series on this tab (FX cards, ^TNX) count sessions with the 시장 상태 helper
// `closeSessionPointBack` (market-read.js), so a "5일/20일" here is the same point as there — verified identical on every
// close field × 1/5/20/63 sessions × 60 cut-offs of public-data/history.json (1,920 cases, 0 differences). This local
// helper stays for series that are not completed-close rows (FRED daily observations, weekend-row inputs: on a Sunday
// row the market-read helper returns that row, this one the Friday — the M01 fixture).
// Expert review M01 (2026-10-13): a close series can carry a weekend row, so "20일" counted as 20 rows covered fewer
// sessions. A change span is counted in exchange sessions instead: the point is the last observation on or before
// the day that lies `sessions` open sessions before the latest observation (registered calendar; weekdays when unknown).
export function sessionPointBack(series, sessions, market = 'US') {
  const last = series?.[series.length - 1];
  if (!last || !(sessions > 0)) return null;
  let cursor = Date.parse(`${last.date}T12:00:00Z`);
  let left = sessions;
  for (let guard = 0; left > 0 && guard < sessions * 3 + 20; guard += 1) {
    cursor -= 86400000;
    const date = new Date(cursor).toISOString().slice(0, 10);
    const day = resolveMarketCalendarSession({ market, date });
    if (day.status === 'open' || (day.status === 'unknown' && ![0, 6].includes(new Date(cursor).getUTCDay()))) left -= 1;
  }
  if (left > 0) return null;
  const target = new Date(cursor).toISOString().slice(0, 10);
  let found = null;
  for (const row of series) { if (row.date <= target) found = row; else break; }
  return found;
}

// Expert review M22: no 3-month bill yield is collected, but T10Y3M (10-year minus 3-month, same H.15 constant-maturity
// basis) is. On a day the official curve and that spread share, 3-month = 10-year - spread; on any other day no point.
export function derivedThreeMonth(macroHistory, tenYear) {
  if (!tenYear?.asOf || tenYear.value == null) return null;
  const row = (macroHistory?.series?.t10y3m?.observations || []).find(([date]) => date === tenYear.asOf);
  const spread = row ? finite(row[1]) : null;
  return spread == null ? null : { id: 'dgs3mo', label: '3개월', years: 0.25, value: Math.round((tenYear.value - spread) * 100) / 100, day: null, week: null, asOf: tenYear.asOf, derived: true };
}

export const FX_SERIES = Object.freeze([
  Object.freeze({ id: 'dxy', label: '달러 인덱스 (DXY)', digits: 2, unit: '' }),
  Object.freeze({ id: 'usdkrw', label: '원/달러', digits: 1, unit: '원' }),
  Object.freeze({ id: 'usdjpy', label: '엔/달러', digits: 2, unit: '엔' })
]);

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const text = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function signed(value, digits = 2, suffix = '') {
  if (value == null) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${suffix}`;
}

function bp(value) {
  return value == null ? null : Math.round(value * 100);
}

// Codex review 2026-10-05: a Treasury level can be newer than the FRED change published beside it
// (10/2 level with the 10/1−9/30 change). A change is used only when the producer stamped it with the
// level's own date, or when level and change both come from FRED.
export function alignedRateDelta(macro, key, suffix = 'Delta') {
  const value = finite(macro?.[`${key}${suffix}`]);
  if (value == null) return null;
  if (macro?.[`_source_${key}`] !== 'us-treasury-official-primary') return value;
  return isoDate(macro?.[`_deltaAsOf_${key}`]) && isoDate(macro[`_deltaAsOf_${key}`]) === isoDate(macro[`_asOf_${key}`]) ? value : null;
}

function treasury(macro) {
  const yields = TREASURY_TENORS.map((tenor) => ({
    ...tenor,
    value: finite(macro[tenor.id]),
    day: alignedRateDelta(macro, tenor.id, 'Delta'),
    week: alignedRateDelta(macro, tenor.id, 'Delta5'),
    asOf: isoDate(macro[`_asOf_${tenor.id}`])
  }));
  const dates = [...new Set(yields.map((row) => row.asOf).filter(Boolean))];
  const sameCut = dates.length === 1 && yields.every((row) => row.value != null);
  const by = Object.fromEntries(yields.map((row) => [row.id, row]));
  const official2s10s = finite(macro.t10y2y);
  const spread2s10s = official2s10s ?? (sameCut ? by.dgs10.value - by.dgs2.value : null);
  const spread5s30s = sameCut ? by.dgs30.value - by.dgs5.value : null;
  const curve = [
    { id: '2s10s', label: '2년–10년', value: spread2s10s, legs: '10년 − 2년' },
    { id: '5s30s', label: '5년–30년', value: spread5s30s, legs: '30년 − 5년' }
  ];
  const inverted = spread2s10s != null && spread2s10s < 0;
  const fact = spread2s10s == null
    ? '같은 날짜의 2년·10년 금리가 아직 없습니다.'
    : inverted
      ? `2년물이 10년물보다 ${Math.abs(spread2s10s).toFixed(2)}%p 높습니다 (역전).`
      : `10년물이 2년물보다 ${spread2s10s.toFixed(2)}%p 높습니다 (양의 기울기).`;
  // The New York Fed's term-spread research: inversions preceded most U.S. recessions since the
  // 1960s, with a variable lead. It is a hypothesis about the economy, not a market timing rule.
  const reading = inverted ? '과거 미국 경기침체 대부분에 앞서 장단기 금리 역전이 나타났습니다(뉴욕 연준 연구). 다만 시차가 일정하지 않아 시점 판단에는 쓰지 않습니다.' : null;
  const asOf = dates.length === 1 ? dates[0] : dates.sort().pop() || null;
  // v57.50 C10: the curve's levels and 1-day/1-week changes are the Treasury's official cut on its own date, which can be
  // a session or more behind the ^TNX close the 시장 상태 10-year "5일" change reads. The label carries the source and date.
  const [, month, day] = String(asOf || '').split('-').map(Number);
  const basisLabel = asOf ? `재무부 공식 곡선 · ${month}/${day} 기준` : null;
  return { yields, asOf, sameCut, curve, fact, reading, basisLabel, source: '미 재무부 공식 수익률 곡선' };
}

function fredLevel(macro, key, label, { toBp = false, note }) {
  const value = finite(macro[key]);
  const week = finite(macro[`${key}Delta5`]);
  return {
    id: key,
    label,
    value,
    valueText: value == null ? '—' : toBp ? `${bp(value)}bp` : `${value.toFixed(2)}%`,
    weekText: week == null ? null : toBp ? `5거래일 ${signed(bp(week), 0, 'bp')}` : `5거래일 ${signed(week, 2, '%p')}`,
    asOf: isoDate(macro[`_asOf_${key}`]),
    stale: macro[`_freshness_${key}`] != null && macro[`_freshness_${key}`] !== 'observed',
    note
  };
}

function fxCard(history, basis, spec) {
  const series = buildCloseSeries(history, spec.id, { through: basis });
  if (!series.length) return { ...spec, available: false, series: [] };
  const last = series[series.length - 1];
  const prior = closeSessionPointBack(series, 1);
  const back20 = closeSessionPointBack(series, 20);
  const change20 = back20 ? (last.value / back20.value - 1) * 100 : null;
  return {
    ...spec,
    available: true,
    value: last.value,
    asOf: last.date,
    valueText: `${last.value.toLocaleString('en-US', { minimumFractionDigits: spec.digits, maximumFractionDigits: spec.digits })}${spec.unit}`,
    day: prior ? (last.value / prior.value - 1) * 100 : null,
    change20,
    series: series.slice(-CHART_SESSIONS)
  };
}

export function buildRatesFx({ macro = null, history = [], macroHistory = null } = {}) {
  const m = macro && typeof macro === 'object' ? macro : {};
  const curve = treasury(m);
  const threeMonth = derivedThreeMonth(macroHistory, curve.yields.find((row) => row.id === 'dgs10'));
  if (threeMonth) {
    curve.yields = [threeMonth, ...curve.yields];
    curve.fact = `${curve.fact} 3개월물은 같은 날 10년물에서 10년–3개월 금리차를 빼서 구한 값입니다.`;
  }
  const basis = closeBasis(history);
  const fx = FX_SERIES.map((spec) => fxCard(history, basis, spec));
  const yen = fx.find((card) => card.id === 'usdjpy');
  // A falling USD/JPY is a stronger yen.
  const yenStrength = yen?.change20 == null ? null : -yen.change20;
  const carry = yenStrength == null
    ? { available: false, text: '엔/달러 20거래일 기록이 쌓이면 표시합니다.' }
    : {
      available: true,
      yenStrength,
      burden: yenStrength >= YEN_RALLY_RULE,
      // v57.70 (2026-10-15 audit): "20거래일 +1.5%" (USD/JPY) above "엔화 20일 −1.5%" read as a sign error; the second is the
      // yen's own value, and that is now said.
      text: `엔화 가치 기준 20일 ${signed(yenStrength, 1, '%')} (${yenStrength >= 0 ? '엔 강세' : '엔 약세'} — 위 엔/달러 환율과 부호가 반대) — 엔화 가치가 3% 이상 오르면 시장 상태 환율 축이 '부담'으로 바뀝니다.`
    };
  const tnxAll = buildCloseSeries(history, 'tnx', { through: basis });
  const tnx = tnxAll.slice(-CHART_SESSIONS);
  // v57.50 C10: the 10-year "5일/20일" change on this tab is the ^TNX completed-close series — the same series and session
  // count as the 시장 상태 rates axis — so the two screens print the same number for the same day.
  const tnxLast = tnxAll[tnxAll.length - 1] || null;
  const tnxBack5 = closeSessionPointBack(tnxAll, 5);
  const tnxBack20 = closeSessionPointBack(tnxAll, 20);
  const tnxChange = {
    date: tnxLast?.date || null,
    d5Bp: tnxLast && tnxBack5 ? Math.round((tnxLast.value - tnxBack5.value) * 10000) / 100 : null,
    d20Bp: tnxLast && tnxBack20 ? Math.round((tnxLast.value - tnxBack20.value) * 10000) / 100 : null
  };
  // Codex browser audit H17: TIPS read 10/5 while the breakeven and nominal yields read 10/6, and the cards sat
  // side by side as if "명목 = 실질 + 기대물가" held on one date. A date mismatch is stated on both cards.
  const real = [
    fredLevel(m, 'realYield10', '10년 실질금리 (TIPS)', { note: '물가를 뺀 금리입니다. 높을수록 미래 이익의 현재 가치가 낮아집니다.' }),
    fredLevel(m, 'breakeven10', '10년 기대인플레이션', { note: '국채와 물가연동채 금리 차이로 본 시장의 물가 예상입니다.' })
  ];
  const [realCard, beiCard] = real;
  if (realCard?.asOf && beiCard?.asOf && realCard.asOf !== beiCard.asOf) {
    const gap = ` 실질금리(${realCard.asOf})와 기대인플레이션(${beiCard.asOf})의 기준일이 달라, 두 값을 더해 같은 날의 명목금리로 맞춰 보지 않습니다.`;
    // P1599 (A08): the full sentence once (on the second card); the first card carries a short pointer.
    realCard.note = `${realCard.note || ''} 기준일 ${realCard.asOf} — 옆 카드와 날짜가 다릅니다.`;
    beiCard.note = `${beiCard.note || ''}${gap}`;
  }
  return {
    basis,
    treasury: curve,
    real,
    credit: fredLevel(m, 'hyOAS', '하이일드 스프레드', { toBp: true, note: '투기등급 회사채가 국채보다 더 받는 금리입니다. 넓어질수록 신용 위험을 크게 봅니다.' }),
    tnx,
    tnxChange,
    fx,
    carry
  };
}
