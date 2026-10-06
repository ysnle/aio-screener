// P1425 (owner review 2026-10-03, 거시 screen rebuild): the 금리 · 환율 tab reads the official
// Treasury par-yield cut, FRED real yield / breakeven / HY spread, and the dollar, won and yen on
// the same completed-close basis as 시장 상태. It replaces fixed level verdicts (DXY >= 107 or
// 10Y >= 5% = '높은 수준', 10Y >= 4.7% = '주식 압박') and the four-axis bull/bear count with the
// observed level, its change and its date. The only rule shown is the one 시장 상태 already uses:
// a yen rally of 3% or more in 20 sessions marks the FX axis as a burden.
import { buildCloseSeries, closeBasis } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';

export const YEN_RALLY_RULE = RULES.fx.yenRally20dPct; // % in 20 sessions — the 시장 상태 FX-axis rule (P1428 registry)
const CHART_SESSIONS = 126; // about six months of completed sessions

export const TREASURY_TENORS = Object.freeze([
  Object.freeze({ id: 'dgs2', label: '2년' }),
  Object.freeze({ id: 'dgs5', label: '5년' }),
  Object.freeze({ id: 'dgs10', label: '10년' }),
  Object.freeze({ id: 'dgs20', label: '20년' }),
  Object.freeze({ id: 'dgs30', label: '30년' })
]);

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
  return { yields, asOf: dates.length === 1 ? dates[0] : dates.sort().pop() || null, sameCut, curve, fact, reading, source: '미 재무부 공식 수익률 곡선' };
}

function fredLevel(macro, key, label, { toBp = false, note }) {
  const value = finite(macro[key]);
  const week = finite(macro[`${key}Delta5`]);
  return {
    id: key,
    label,
    value,
    valueText: value == null ? '—' : toBp ? `${bp(value)}bp` : `${value.toFixed(2)}%`,
    weekText: week == null ? null : toBp ? `1주 ${signed(bp(week), 0, 'bp')}` : `1주 ${signed(week, 2, '%p')}`,
    asOf: isoDate(macro[`_asOf_${key}`]),
    stale: macro[`_freshness_${key}`] != null && macro[`_freshness_${key}`] !== 'observed',
    note
  };
}

function fxCard(history, basis, spec) {
  const series = buildCloseSeries(history, spec.id, { through: basis });
  if (!series.length) return { ...spec, available: false, series: [] };
  const last = series[series.length - 1];
  const prior = series.length > 1 ? series[series.length - 2] : null;
  const back20 = series.length > 20 ? series[series.length - 21] : null;
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

export function buildRatesFx({ macro = null, history = [] } = {}) {
  const m = macro && typeof macro === 'object' ? macro : {};
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
      text: `엔화 20일 ${signed(yenStrength, 1, '%')} (${yenStrength >= 0 ? '엔 강세' : '엔 약세'}) — 3% 이상 강세면 시장 상태 환율 축이 '부담'으로 바뀝니다.`
    };
  const tnx = buildCloseSeries(history, 'tnx', { through: basis }).slice(-CHART_SESSIONS);
  return {
    basis,
    treasury: treasury(m),
    real: [
      fredLevel(m, 'realYield10', '10년 실질금리 (TIPS)', { note: '물가를 뺀 금리입니다. 높을수록 미래 이익의 현재 가치가 낮아집니다.' }),
      fredLevel(m, 'breakeven10', '10년 기대인플레이션', { note: '국채와 물가연동채 금리 차이로 본 시장의 물가 예상입니다.' })
    ],
    credit: fredLevel(m, 'hyOAS', '하이일드 스프레드', { toBp: true, note: '투기등급 회사채가 국채보다 더 받는 금리입니다. 넓어질수록 신용 위험을 크게 봅니다.' }),
    tnx,
    fx,
    carry
  };
}
