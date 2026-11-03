// v59.69 (owner 2026-11-03, "사용자가 어떻게 해석하고 판단해야 하는지 기준"): how to read each scheduled release —
// the value bands that are good, neutral, a burden or bad for stocks, and the latest value placed in its band.
// The cut points are the scenario triggers' own (macro-crossroads.js: softland core MoM <= 0.2, reheat >= 0.4,
// payrolls 7.5만~20만 softland, 5만~7.5만 cooling, < 5만 + 실업률 +0.2%p slowdown, >= 20만 hot, retail >= +0.5% hot),
// so the band a number lands in and the scenario it moves agree.
//
// "Bad news is good news" holds only while inflation is the constraint: with core PCE above 2.5% a hot jobs report
// delays cuts (a burden); once inflation is near target the same report is growth, read as good. Too cold is bad in
// both regimes — a cut that arrives because earnings are falling does not lift stocks.
import { seriesOf, yoySeries } from './macro-read.js';
import { releaseActuals } from '../market/macro-crossroads.js';

const INFLATION_FIRST_ABOVE = 2.5; // core PCE YoY, %

const PRICE_ZONES = [
  { below: 0.2, tone: 'good', label: '둔화', read: '금리 인하 여지가 커집니다' },
  { below: 0.3, tone: 'neutral', label: '조금 높음', read: '목표보다 조금 높아 금리 경로는 그대로입니다' },
  { below: 0.4, tone: 'burden', label: '끈적함', read: '인하 기대가 줄어듭니다' },
  { below: Infinity, tone: 'bad', label: '재가속', read: '금리가 다시 오를 수 있습니다' }
];

const JOB_ZONES = (inflationFirst) => [
  { below: 50, tone: 'bad', label: '급랭', read: '인하는 빨라져도 이익 걱정이 앞섭니다(경기 침체 경계)' },
  { below: 75, tone: 'neutral', label: '둔화', read: '인하 기대는 커지지만 둔화가 이어지는지 봐야 합니다' },
  { below: 200, tone: 'good', label: '완만', read: '물가 부담 없이 경기가 버티는 구간입니다' },
  inflationFirst
    ? { below: Infinity, tone: 'burden', label: '과열', read: '물가가 목표보다 높은 동안에는 인하가 늦어져 부담입니다' }
    : { below: Infinity, tone: 'good', label: '강함', read: '물가가 목표 부근이라 강한 고용은 성장으로 읽힙니다' }
];

const RETAIL_ZONES = [
  { below: -0.5, tone: 'bad', label: '소비 위축', read: '기업 매출 전망이 내려갑니다' },
  { below: 0, tone: 'neutral', label: '둔화', read: '한 달이면 잡음, 두 달 이어지면 둔화입니다' },
  { below: 0.5, tone: 'good', label: '견조', read: '소비가 이익을 받칩니다' },
  { below: Infinity, tone: 'burden', label: '과열', read: '수요 물가로 번지면 인하가 늦어집니다' }
];

const RELEASES = Object.freeze({
  'us-cpi': { name: '소비자물가(CPI)', measure: '근원 CPI 전월 대비', unit: '%', digits: 2, range: [-0.1, 0.6], value: (a) => a.coreMoM, zones: () => PRICE_ZONES },
  'us-pce': { name: 'PCE 물가', measure: '근원 PCE 전월 대비', unit: '%', digits: 2, range: [-0.1, 0.6], value: (a) => a.coreMoM, zones: () => PRICE_ZONES },
  'us-nfp': { name: '고용보고서', measure: '비농업 일자리 증감', unit: '천 명', digits: 0, range: [-50, 300], value: (a) => a.payroll, zones: JOB_ZONES },
  'us-retail': { name: '소매판매', measure: '소매판매 전월 대비', unit: '%', digits: 1, range: [-1.5, 1.5], value: (a) => a.mom, zones: () => RETAIL_ZONES }
});
export const RELEASE_ZONE_IDS = Object.freeze(Object.keys(RELEASES));

/** Core PCE year over year, and whether inflation is the constraint the market reads every release through. */
export function inflationRegime(macroHistory) {
  const yoy = yoySeries(seriesOf(macroHistory, 'corePceIndex'));
  const latest = yoy[yoy.length - 1] || null;
  if (!latest) return null;
  return { corePceYoY: latest.value, date: latest.date, inflationFirst: latest.value > INFLATION_FIRST_ABOVE };
}

const zoneOf = (zones, value) => zones.find((zone) => value < zone.below) || zones[zones.length - 1];

/**
 * One release's reading frame: its bands (with their numeric edges inside the drawn range), the latest value and the
 * band it fell in. A jobs report whose unemployment rate rose 0.2%p or more reads as 급랭 whatever the payroll number,
 * the slowdown trigger's second half.
 */
export function releaseZones(id, macroHistory, { actuals = null, regime = undefined } = {}) {
  const spec = RELEASES[id];
  if (!spec) return null;
  const frame = regime === undefined ? inflationRegime(macroHistory) : regime;
  const inflationFirst = frame ? frame.inflationFirst : true;
  const zones = spec.zones(inflationFirst);
  const [lo, hi] = spec.range;
  let from = lo;
  const bands = zones.map((zone) => {
    const to = Math.min(hi, zone.below);
    const band = { ...zone, from, to };
    from = to;
    return band;
  }).filter((band) => band.to > band.from);
  const actual = (actuals || releaseActuals(macroHistory))[id] || null;
  const raw = actual ? Number(spec.value(actual)) : NaN;
  const value = Number.isFinite(raw) ? raw : null;
  let now = value == null ? null : zoneOf(zones, value);
  if (id === 'us-nfp' && actual?.unempDelta != null && actual.unempDelta >= 0.2 - 1e-9) now = zones[0];
  return {
    id, name: spec.name, measure: spec.measure, unit: spec.unit, digits: spec.digits, range: spec.range, bands,
    latest: value == null ? null : { value, period: actual.period, tone: now.tone, label: now.label, read: now.read },
    regime: frame
  };
}
