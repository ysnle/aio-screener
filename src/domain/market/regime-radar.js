// P1637: where each regime axis sits inside its own one-year range, today against 5 and 20 sessions
// ago (owner reference 2026-10-12, a "regime radar"). Each point is a descriptive percentile of one
// observed series — 100 is the most supportive reading of the past year, 0 the least. There is no
// composite score: the AGENTS rule against uncalibrated n/100 composites applies, so the radar shows
// which axes moved, not a total.
import { alignInput, buildCloseSeries, isUsable } from '../briefing/market-read.js';

const subject = (word) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return `${word}${code >= 0 && code < 11172 && code % 28 ? '이' : '가'}`; };
const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;

export const RADAR_AXES = Object.freeze([
  { id: 'trend', label: '추세', note: 'S&P 500의 200일선 대비 거리' },
  { id: 'breadth', label: '시장 폭', note: '50일선 위 종목 비율' },
  { id: 'volatility', label: '변동성 안정', note: 'VIX가 낮을수록 바깥' },
  { id: 'rates', label: '금리 여유', note: '미 10년물이 낮을수록 바깥' },
  { id: 'credit', label: '신용 안정', note: 'HY OAS가 좁을수록 바깥' },
  { id: 'commodities', label: '달러·유가 여유', note: '달러지수·WTI가 낮을수록 바깥' }
]);

function macroSeries(macroHistory, key, factor = 1) {
  const byDate = new Map();
  for (const row of macroHistory?.series?.[key]?.observations || []) {
    const stamp = String(Array.isArray(row) ? row[0] : row?.date || '');
    const value = finite(Array.isArray(row) ? row[1] : row?.value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(stamp) && value != null) byDate.set(stamp, value * factor);
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
    return { ...axis, values, observed, sample: sample >= MIN_SAMPLE ? sample : null, now: values[0], change5: values[0] != null && values[1] != null ? values[0] - values[1] : null, change20: values[0] != null && values[2] != null ? values[0] - values[2] : null };
  });
  const moved = axes.filter((axis) => axis.change5 != null).sort((a, b) => Math.abs(b.change5) - Math.abs(a.change5));
  const up = moved.filter((axis) => axis.change5 >= 10).slice(0, 2);
  const down = moved.filter((axis) => axis.change5 <= -10).slice(0, 2);
  const lead = up.length || down.length
    ? `5거래일 전보다 ${[up.length ? `${up.map((axis) => `${axis.label}(+${axis.change5})`).join('·')} 쪽이 넓어졌고` : '', down.length ? `${down.map((axis) => `${axis.label}(${axis.change5})`).join('·')} 쪽이 좁아졌습니다` : '크게 좁아진 축은 없습니다'].filter(Boolean).join(' ')}.`
    : '5거래일 전과 비교해 10 이상 움직인 축이 없습니다.';
  const wide = axes.filter((axis) => axis.change20 != null && Math.abs(axis.change20) >= 25).sort((a, b) => Math.abs(b.change20) - Math.abs(a.change20))[0];
  const month = wide ? ` 20거래일 전과 비교하면 ${subject(wide.label)} ${wide.change20 > 0 ? '+' : ''}${wide.change20}로 가장 크게 ${wide.change20 > 0 ? '넓어졌습니다' : '좁아졌습니다'}.` : '';
  const missing = axes.filter((axis) => axis.now == null).map((axis) => axis.label);
  const missingText = missing.length ? ` ${missing.join('·')} 축은 최신 관측이 없어 비웠습니다.` : '';
  return { available: axes.filter((axis) => axis.now != null).length >= 3, asOf: dates[0], dates, offsets, axes, missing, lead: `${lead}${month}${missingText}` };
}
