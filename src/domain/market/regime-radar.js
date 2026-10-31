// P1637: where each regime axis sits inside its own one-year range, today against 5 and 20 sessions
// ago (owner reference 2026-10-12, a "regime radar"). Each point is a descriptive percentile of one
// observed series — 100 is the most supportive reading of the past year, 0 the least. There is no
// composite score: the AGENTS rule against uncalibrated n/100 composites applies, so the radar shows
// which axes moved, not a total.
import { alignInput, buildCloseSeries, isUsable, sessionPointBack } from './close-series.js';
import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite } from '../shared/number.js';
import { isoDay } from '../shared/session-date.js';


export const RADAR_AXES = Object.freeze([
  { id: 'trend', label: '추세', note: 'S&P 500의 200일선 대비 거리' },
  { id: 'breadth', label: '시장 폭', note: '50일선 위 종목 비율' },
  { id: 'volatility', label: '변동성', note: 'VIX가 낮을수록 바깥(양호)' },
  { id: 'rates', label: '금리', note: '미 10년물이 낮을수록 바깥' },
  { id: 'credit', label: '신용과 위험선호', note: 'HY OAS가 좁을수록 바깥' },
  { id: 'commodities', label: '달러와 원자재', note: '달러지수·WTI가 낮을수록 바깥' }
]);

function macroSeries(macroHistory, key, factor = 1) {
  const byDate = new Map();
  for (const row of macroHistory?.series?.[key]?.observations || []) {
    const stamp = String(Array.isArray(row) ? row[0] : row?.date || '');
    const value = finite(Array.isArray(row) ? row[1] : row?.value);
    if (isoDay(stamp) && value != null) byDate.set(stamp, value * factor);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

function trendDistance(spx) {
  const out = [];
  for (let i = 199; i < spx.length; i += 1) {
    const mean = spx.slice(i - 199, i + 1).reduce((sum, point) => sum + point.value, 0) / 200;
    out.push({ date: spx[i].date, value: (spx[i].value / mean - 1) * 100 });
  }
  return out;
}

const MIN_SAMPLE = 60;
const endIndex = (series, date) => { for (let i = series.length - 1; i >= 0; i -= 1) if (series[i].date <= date) return i; return -1; };

// Percentile of the value on `date` within the `window` observations ending on that date. M04: the value must be
// the date's own observation or at most two sessions older (the market-read alignment rule) — an older value is
// not "today". M08: all three dates use the same window length, so they compare like with like.
function positionAt(series, date, invert, window) {
  const end = endIndex(series, date);
  if (end < 0 || !isUsable(alignInput(series[end].date, date))) return null;
  const slice = series.slice(end - window + 1, end + 1);
  if (end - window + 1 < 0 || slice.length < MIN_SAMPLE) return null;
  const current = slice.at(-1).value;
  const below = slice.filter((point) => point.value < current).length;
  const equal = slice.filter((point) => point.value === current).length;
  const rank = (below + (equal - 1) / 2) / Math.max(1, slice.length - 1) * 100;
  return { value: Math.round(invert ? 100 - rank : rank), date: series[end].date };
}

export function buildRegimeRadar(input = {}, { macroHistory = null, offsets = [0, 5, 20] } = {}) {
  const history = input.history || [];
  const spx = buildCloseSeries(history, 'spx');
  if (spx.length < 260) return { available: false, reason: 'S&P 500 종가가 1년 이상 쌓이지 않았습니다.', axes: [] };
  const sources = {
    trend: [{ series: trendDistance(spx), invert: false }],
    breadth: [{ series: buildCloseSeries(history, 'breadth50'), invert: false }],
    volatility: [{ series: buildCloseSeries(history, 'vix'), invert: true }],
    rates: [{ series: buildCloseSeries(history, 'tnx'), invert: true }],
    credit: [{ series: macroSeries(macroHistory, 'hyOas', 100), invert: true }],
    commodities: [{ series: buildCloseSeries(history, 'dxy'), invert: true }, { series: buildCloseSeries(history, 'wti'), invert: true }]
  };
  const dates = offsets.map((offset) => spx[spx.length - 1 - offset]?.date || null);
  const oldest = dates.filter(Boolean).at(-1);
  const axes = RADAR_AXES.map((axis) => {
    // One window per series: as long as the oldest compared date allows, at most 252 observations.
    const windows = sources[axis.id].map(({ series }) => Math.min(252, endIndex(series, oldest) + 1));
    const sample = Math.min(...windows);
    const observed = [];
    const values = dates.map((date, slot) => {
      if (!date || sample < MIN_SAMPLE) return null;
      const parts = sources[axis.id].map(({ series, invert }, i) => positionAt(series, date, invert, windows[i]));
      // M04: an axis built from two series (달러·유가) needs both; averaging the one left would rename the axis.
      if (parts.some((part) => part == null)) return null;
      observed[slot] = parts.map((part) => part.date).sort()[0];
      return Math.round(parts.reduce((sum, part) => sum + part.value, 0) / parts.length);
    });
    // v58.80 (first-users bundle 1): "추세 1/100" beside a 52-week range position of 87% read as a contradiction — the axis
    // ranks the 200-day distance, not the price. Today's measured value travels with the rank so the basis can say so.
    const single = sources[axis.id].length === 1 ? sources[axis.id][0].series : null;
    const at = single && dates[0] ? endIndex(single, dates[0]) : -1;
    const raw = values[0] != null && at >= 0 ? single[at].value : null;
    return { ...axis, values, observed, raw, sample: sample >= MIN_SAMPLE ? sample : null, now: values[0], change5: values[0] != null && values[1] != null ? values[0] - values[1] : null, change20: values[0] != null && values[2] != null ? values[0] - values[2] : null };
  });
  const moved = axes.filter((axis) => axis.change5 != null).sort((a, b) => Math.abs(b.change5) - Math.abs(a.change5));
  const up = moved.filter((axis) => axis.change5 >= 10).slice(0, 2);
  const down = moved.filter((axis) => axis.change5 <= -10).slice(0, 2);
  const lead = up.length || down.length
    ? `5거래일 전보다 ${[up.length ? `${up.map((axis) => `${axis.label}(+${axis.change5})`).join(', ')}의 위치가 좋아졌고` : '', down.length ? `${down.map((axis) => `${axis.label}(${axis.change5})`).join(', ')}의 위치가 나빠졌습니다` : '크게 나빠진 지표는 없습니다'].filter(Boolean).join(' ')}.`
    : '5거래일 전과 비교해 10 이상 움직인 지표가 없습니다.';
  const wide = axes.filter((axis) => axis.change20 != null && Math.abs(axis.change20) >= 25).sort((a, b) => Math.abs(b.change20) - Math.abs(a.change20))[0];
  const month = wide ? ` 20거래일 전과 비교하면 ${wide.label} 위치가 ${Math.abs(wide.change20)}포인트 ${wide.change20 > 0 ? '올라 가장 크게 좋아졌습니다' : '내려 가장 크게 나빠졌습니다'}.` : '';
  // v58.74 (text audit 시장 상태 C6): a volatility move names the VIX behind it and where it sits against the 부담 line.
  const vixSeries = buildCloseSeries(history, 'vix');
  const vixNow = vixSeries.at(-1)?.value, vixThen = sessionPointBack(vixSeries, 20)?.value ?? null; // v59.45 (R1-01): sessions, not rows
  const volNote = wide?.id === 'volatility' && Number.isFinite(vixNow) && Number.isFinite(vixThen)
    ? ` VIX가 20거래일 전 ${vixThen.toFixed(1)}에서 ${vixNow.toFixed(1)}로 ${(vixNow > vixThen) === (vixNow >= RULES.volatility.stressAt) ? (vixNow > vixThen ? '올라' : '내려') : (vixNow > vixThen ? '올랐지만' : '내렸지만')} ${vixNow >= RULES.volatility.stressAt ? `부담 기준(${RULES.volatility.stressAt}) 위입니다` : `부담 기준(${RULES.volatility.stressAt})에는 못 미칩니다`}.` : '';
  const missing = axes.filter((axis) => axis.now == null).map((axis) => axis.label);
  const missingText = missing.length ? ` ${missing.join('·')} 지표는 최신 관측이 없어 비웠습니다.` : '';
  // v59.43 (X bookmark 2114267194930663745): a lower 10-year yield is the supportive side only when credit is not
  // widening with it. A 5-session yield drop while HY OAS widens by the watch amount is a flight to safety; the axis
  // keeps its percentile and the reading names the pairing instead of calling it an improvement.
  const defensive = defensiveYieldDrop(sources.rates[0].series, sources.credit[0].series, dates[0], dates[1]);
  const rates = axes.find((axis) => axis.id === 'rates');
  if (rates) rates.defensive = defensive;
  const defensiveText = defensive ? ` 다만 10년물 금리가 5거래일 ${Math.abs(defensive.yieldBp)}bp 내리는 동안 하이일드 스프레드가 +${defensive.oasBp}bp 벌어져, 이번 금리 하락은 경기·신용 우려 속 피난성일 수 있습니다. 금리 위치가 좋아진 것을 그대로 우호 신호로 읽지 않습니다.` : '';
  return { available: axes.filter((axis) => axis.now != null).length >= 3, asOf: dates[0], dates, offsets, axes, missing, lead: `${lead}${month}${volNote}${defensiveText}${missingText}` };
}

/** 10-year yield change (bp) and HY OAS change (bp) between two dates, when the yield fell and the spread widened. */
export function defensiveYieldDrop(tnx, hyOasBp, date, before) {
  if (!date || !before) return null;
  const at = (series, d) => { const i = endIndex(series, d); return i >= 0 && isUsable(alignInput(series[i].date, d)) ? series[i].value : null; };
  const y0 = at(tnx, before), y1 = at(tnx, date), s0 = at(hyOasBp, before), s1 = at(hyOasBp, date);
  if ([y0, y1, s0, s1].some((value) => value == null)) return null;
  const yieldBp = Math.round((y1 - y0) * 100), oasBp = Math.round(s1 - s0);
  return yieldBp < 0 && oasBp >= RULES.credit.widenWatch5dBp ? { yieldBp, oasBp } : null;
}
