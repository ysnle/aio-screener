// P1586: self-computed market sentiment index from public official inputs, modelled on the seven
// components CNN publishes for its Fear & Greed Index. CNN's endpoint answers only browser-impersonating
// requests (honest client → HTTP 418), so this index is built to run beside it and replace it once the
// comparison holds. It is NOT CNN's number: each component is ranked against its own trailing year
// (percentile, greed = high). v57.50 D02: the ranks are shown side by side; no mean score or band is formed.
//
// Inputs are the published artifacts only: public-data/history.json rows (spx, vix, tlt, pcr,
// advanceRatio, breadthNewHighs/Lows) and public-data/macro-history.json (hyOas, igOas).

import { alignInput, buildCloseSeries, closeBasis, isUsable } from '../market/close-series.js';
import { readNumber as finite } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';

export const COMPOSITE_FEAR_GREED_VERSION = 'aio-sentiment-composite.v1';
const RANK_WINDOW = 252;
const MIN_RANK_SAMPLE = 60;
const MIN_COMPONENTS = 4;


// M03: one value per US trading session (buildCloseSeries) — weekend carry-forward rows are not observations.
function series(rows, field) {
  return buildCloseSeries(Array.isArray(rows) ? rows : [], field).map((row) => ({ date: row.date, value: finite(row.value) })).filter((row) => row.value != null);
}

function sma(values, end, length) {
  if (end + 1 < length) return null;
  let sum = 0;
  for (let i = end - length + 1; i <= end; i += 1) sum += values[i];
  return sum / length;
}

function emaSeries(values, length) {
  const k = 2 / (length + 1);
  const out = [];
  values.forEach((value, index) => out.push(index === 0 ? value : value * k + out[index - 1] * (1 - k)));
  return out;
}

// Percentile of the latest raw value within the trailing window (inclusive), 0..100.
function percentileRank(raw) {
  if (raw.length < MIN_RANK_SAMPLE) return null;
  const sample = raw.slice(-RANK_WINDOW);
  const latest = sample[sample.length - 1];
  const below = sample.filter((value) => value < latest).length;
  const equal = sample.filter((value) => value === latest).length;
  return Math.round(((below + 0.5 * equal) / sample.length) * 1000) / 10;
}

function component(id, label, rawSeries, { invert = false, basis }) {
  const values = rawSeries.map((row) => row.value);
  const rank = percentileRank(values);
  if (rank == null) return Object.freeze({ id, label, status: 'insufficient-history', observations: values.length, needed: MIN_RANK_SAMPLE, basis });
  const latest = rawSeries[rawSeries.length - 1];
  return Object.freeze({ id, label, status: 'ok', raw: Math.round(latest.value * 10000) / 10000, asOf: latest.date, score: invert ? Math.round((100 - rank) * 10) / 10 : rank, observations: values.length, basis });
}

function ratioToAverage(rows, field, length) {
  const points = series(rows, field);
  const values = points.map((row) => row.value);
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const average = sma(values, i, length);
    if (average) out.push({ date: points[i].date, value: values[i] / average - 1 });
  }
  return out;
}

function trailingReturns(points, length) {
  const out = new Map();
  for (let i = length; i < points.length; i += 1) out.set(points[i].date, points[i].value / points[i - length].value - 1);
  return out;
}

function macroSeries(macroHistory, key) {
  const observations = macroHistory?.series?.[key]?.observations;
  return (Array.isArray(observations) ? observations : [])
    .map((row) => (Array.isArray(row) ? { date: String(row[0]), value: finite(row[1]) } : { date: String(row?.date || ''), value: finite(row?.value) }))
    .filter((row) => isIsoDay(row.date) && row.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// v57.50 D02 (coordinator decision): no 0-100 average and no CNN-style band (극단적 공포~탐욕) on top of it. Averaging
// one-year ranks of components that disagree (e.g. 5 and 89) and banding the mean at CNN's 25/45/55/75 edges produced
// a grade with no validation behind it. The model now returns each component's rank side by side and the spread
// between the lowest and highest one; components without an observation stay listed as '자료 부족'.
export function compositeSpread(components = []) {
  const ready = components.filter((row) => row.status === 'ok' && Number.isFinite(row.score));
  if (ready.length < 2) return null;
  const sorted = [...ready].sort((a, b) => a.score - b.score);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  return Object.freeze({ low: Object.freeze({ id: low.id, label: low.label, score: low.score }), high: Object.freeze({ id: high.id, label: high.label, score: high.score }), gap: Math.round((high.score - low.score) * 10) / 10 });
}

export function computeCompositeFearGreed({ history = [], macroHistory = null } = {}) {
  const components = [];
  // 1. Market momentum: S&P 500 against its 125-day average.
  components.push(component('momentum', '시장 모멘텀', ratioToAverage(history, 'spx', 125), { basis: 'S&P 500 ÷ 125일 평균 − 1' }));
  // 2. Stock price strength: new highs minus new lows (screener universe, not NYSE-wide).
  const highs = new Map(series(history, 'breadthNewHighs').map((row) => [row.date, row.value]));
  const strength = series(history, 'breadthNewLows').filter((row) => highs.has(row.date)).map((row) => ({ date: row.date, value: highs.get(row.date) - row.value }));
  components.push(component('strength', '주가 강도', strength, { basis: '52주 신고가 − 신저가 (스크리너 유니버스)' }));
  // 3. Breadth: McClellan-style oscillator on the advancing share (counts, not volume).
  const advance = series(history, 'advanceRatio');
  const centered = advance.map((row) => row.value - 0.5);
  const fast = emaSeries(centered, 19);
  const slow = emaSeries(centered, 39);
  const breadth = advance.length >= 39 ? advance.slice(38).map((row, index) => ({ date: row.date, value: fast[index + 38] - slow[index + 38] })) : [];
  components.push(component('breadth', '상승 종목 흐름', breadth, { basis: '상승 종목 비율의 19/39일 EMA 차 (종목 수 기준)' }));
  // 4. Put/call: 5-day average of the Cboe total ratio (high = fear).
  const pcr = series(history, 'pcr');
  const pcrValues = pcr.map((row) => row.value);
  const pcr5 = pcr.map((row, index) => ({ date: row.date, value: sma(pcrValues, index, 5) })).filter((row) => row.value != null);
  components.push(component('putCall', '풋·콜 비율', pcr5, { invert: true, basis: 'Cboe 총 풋·콜 비율 5일 평균' }));
  // 5. Volatility: VIX against its 50-day average (high = fear).
  components.push(component('volatility', '변동성', ratioToAverage(history, 'vix', 50), { invert: true, basis: 'VIX ÷ 50일 평균 − 1' }));
  // 6. Safe-haven demand: 20-day S&P 500 return minus 20-day TLT return.
  const spxReturns = trailingReturns(series(history, 'spx'), 20);
  const tltReturns = trailingReturns(series(history, 'tlt'), 20);
  const safeHaven = [...spxReturns].filter(([date]) => tltReturns.has(date)).map(([date, value]) => ({ date, value: value - tltReturns.get(date) }));
  components.push(component('safeHaven', '안전자산 수요', safeHaven, { basis: 'S&P 500 20일 수익률 − TLT 20일 수익률' }));
  // 7. Junk-bond demand: high-yield minus investment-grade OAS (high = fear).
  // Until the investment-grade series has a ranking sample, the high-yield OAS level stands in and says so.
  const ig = new Map(macroSeries(macroHistory, 'igOas').map((row) => [row.date, row.value]));
  const hy = macroSeries(macroHistory, 'hyOas');
  const junkSpread = hy.filter((row) => ig.has(row.date)).map((row) => ({ date: row.date, value: row.value - ig.get(row.date) }));
  const junkUsesSpread = junkSpread.length >= MIN_RANK_SAMPLE;
  components.push(component('junkBond', '정크본드 수요', junkUsesSpread ? junkSpread : hy, { invert: true, basis: junkUsesSpread ? '하이일드 OAS − 투자등급 OAS (FRED)' : '하이일드 OAS 수준 (투자등급 이력 축적 전 대체)' }));

  // M03: a component counts only when its last observation belongs to the market's last completed close (at most
  // two sessions older, the market-read rule). Older ones are kept with their own date and marked stale.
  const basis = closeBasis(history);
  const checked = components.map((row) => row.status === 'ok' && basis && !isUsable(alignInput(row.asOf, basis))
    ? Object.freeze({ ...row, status: 'stale', score: null }) : row);
  components.splice(0, components.length, ...checked);
  const ready = components.filter((row) => row.status === 'ok');
  // D02: below MIN_COMPONENTS the side-by-side view is withheld too (two or three ranks are not a market picture).
  const shown = ready.length >= MIN_COMPONENTS;
  return Object.freeze({
    version: COMPOSITE_FEAR_GREED_VERSION,
    status: !shown ? 'withheld' : ready.length === components.length ? 'complete' : 'partial',
    componentsReady: ready.length,
    componentsTotal: components.length,
    asOf: shown ? basis : null,
    spread: shown ? compositeSpread(components) : null,
    components: Object.freeze(components),
    method: '구성 요소별 최근 1년 백분위(높을수록 낙관 쪽)를 나란히 보여 준다. 평균 점수나 공포·탐욕 구간을 만들지 않으며 CNN 지수와 같은 값이 아니다.'
  });
}
