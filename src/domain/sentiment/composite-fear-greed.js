// P1586: self-computed market sentiment index from public official inputs, modelled on the seven
// components CNN publishes for its Fear & Greed Index. CNN's endpoint answers only browser-impersonating
// requests (honest client → HTTP 418), so this index is built to run beside it and replace it once the
// comparison holds. It is NOT CNN's number: each component is ranked against its own trailing year
// (percentile, greed = high) and the score is the mean of the available component ranks.
//
// Inputs are the published artifacts only: public-data/history.json rows (spx, vix, tlt, pcr,
// advanceRatio, breadthNewHighs/Lows) and public-data/macro-history.json (hyOas, igOas).

export const COMPOSITE_FEAR_GREED_VERSION = 'aio-sentiment-composite.v1';
const RANK_WINDOW = 252;
const MIN_RANK_SAMPLE = 60;
const MIN_COMPONENTS = 4;

const finite = (value) => (value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

function series(rows, field) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && finite(row[field]) != null)
    .map((row) => ({ date: row.date, value: finite(row[field]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function bandForCompositeScore(score) {
  if (score == null) return '판정 보류';
  if (score < 25) return '극단적 공포';
  if (score < 45) return '공포';
  if (score <= 55) return '중립';
  if (score <= 75) return '탐욕';
  return '극단적 탐욕';
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
  components.push(component('breadth', '시장 폭', breadth, { basis: '상승 종목 비율의 19/39일 EMA 차 (종목 수 기준)' }));
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

  const ready = components.filter((row) => row.status === 'ok');
  const score = ready.length >= MIN_COMPONENTS ? Math.round(ready.reduce((sum, row) => sum + row.score, 0) / ready.length) : null;
  const asOf = ready.length ? ready.map((row) => row.asOf).sort().slice(-1)[0] : null;
  return Object.freeze({
    version: COMPOSITE_FEAR_GREED_VERSION,
    score,
    band: bandForCompositeScore(score),
    status: score == null ? 'withheld' : ready.length === components.length ? 'complete' : 'partial',
    componentsReady: ready.length,
    componentsTotal: components.length,
    asOf,
    components: Object.freeze(components),
    method: '구성 요소별 최근 1년 백분위(높을수록 탐욕)의 평균. CNN 지수와 같은 값이 아니다.'
  });
}
