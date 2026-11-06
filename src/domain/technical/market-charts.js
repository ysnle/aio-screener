// v59.64 (owner 2026-11-03: "기술적 분석에서는 차트 분석으로 지수와 대표 핵심 종목들 분석해주고, 설명해주고"): the 기술적
// 분석 screen's readings. Indexes are read from the published closes (history.json, one close per session); core stocks
// from the screener's derived fields. Every word is a rule over those numbers — the trend from where the close sits
// against its 50- and 200-day averages and which way the 50-day is going, momentum from the 14-day RSI (Wilder),
// support and resistance from swing points (a close that is the lowest/highest of five sessions on each side), the
// double top and the six-month support from index-levels.js. Breadth enters only where it changes the reading of a
// trend (owner: "시장 폭만 본다고 해서 의미가 없듯이"). No target, entry or stop is ever named.
import { readNumber } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { sessionCloses, indexLevel } from '../market/index-levels.js';
import { withTopicParticle } from '../content/korean-particle.js';

export const CHART_INDEXES = Object.freeze([['ndx', '나스닥100'], ['spx', 'S&P 500'], ['soxx', '반도체(SOXX)'], ['rut', '러셀2000'], ['kospi', '코스피'], ['kosdaq', '코스닥']]);
export const TREND_WORDS = Object.freeze({ up: '상승 추세', pullback: '단기 조정', breakdown: '추세 이탈', rebound: '하락 속 반등', recovery: '회복 시도', down: '하락 추세', unknown: '판단 보류' });
const SWING_SPAN = 5;

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const signed = (value, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
const num = (value) => Math.round(value).toLocaleString('en-US');

export function movingAverage(closes, n) {
  const out = [];
  let sum = 0;
  closes.forEach((row, i) => {
    sum += row.value;
    if (i >= n) sum -= closes[i - n].value;
    if (i >= n - 1) out.push({ date: row.date, value: sum / n });
  });
  return out;
}

/** Wilder's 14-day RSI on closes. */
export function rsiOf(closes, period = 14) {
  if (closes.length <= period) return null;
  let gain = 0; let loss = 0;
  for (let i = 1; i <= period; i += 1) { const d = closes[i].value - closes[i - 1].value; if (d > 0) gain += d; else loss -= d; }
  gain /= period; loss /= period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const d = closes[i].value - closes[i - 1].value;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/** Swing highs and lows of the last year: a close higher (lower) than the five sessions on each side. */
export function swingPointsOf(closes, span = SWING_SPAN) {
  const recent = closes.slice(-252);
  const highs = []; const lows = [];
  for (let i = span; i < recent.length - span; i += 1) {
    const around = recent.slice(i - span, i + span + 1).map((row) => row.value);
    if (recent[i].value === Math.max(...around)) highs.push(recent[i]);
    if (recent[i].value === Math.min(...around)) lows.push(recent[i]);
  }
  return { highs, lows };
}

export function trendOf({ close, ma50, ma200, ma50Before }) {
  if (![close, ma50, ma200].every(Number.isFinite)) return 'unknown';
  const rising = Number.isFinite(ma50Before) ? ma50 > ma50Before : null;
  if (close > ma50 && ma50 > ma200 && rising !== false) return 'up';
  if (close < ma50 && ma50 < ma200 && rising !== true) return 'down';
  if (close < ma50 && close >= ma200) return 'pullback'; // under the 50-day, still above the 200-day
  if (close < ma50 && close < ma200) return 'breakdown'; // under both while the 50-day is still above the 200-day
  if (close >= ma50 && close < ma200) return 'rebound'; // back above the 50-day inside a long downtrend
  return 'recovery'; // above both lines while the 50-day is still under the 200-day
}

const TREND_READ = Object.freeze({
  up: '종가가 50일선과 200일선 위에 있고 50일선도 오르고 있어, 추세가 위를 향합니다.',
  pullback: '200일선 위에서 50일선 아래로 내려온 단기 조정입니다. 장기 추세는 아직 살아 있고, 200일선을 지키는지가 다음 확인점입니다.',
  breakdown: '50일선과 200일선을 모두 내줘 추세가 꺾이는 중입니다. 50일선이 200일선 아래로 내려가면(데드크로스) 하락 추세로 굳습니다. 200일선을 다시 되찾는지가 확인점입니다.',
  rebound: '200일선 아래의 하락 추세 안에서 50일선을 되찾은 반등입니다. 200일선까지 회복하는지가 추세 전환의 확인점입니다.',
  recovery: '종가가 두 이동평균 위로 올라왔지만 50일선이 아직 200일선 아래라, 추세 전환은 50일선이 200일선 위로 올라설 때(골든크로스) 확인됩니다.',
  down: '종가가 50일선과 200일선 아래에 있고 50일선도 내려가, 추세가 아래를 향합니다.',
  unknown: '이동평균을 계산할 종가가 부족합니다.'
});

/**
 * One index's chart reading.
 * @returns {null | { field, label, asOf, close, trend, trendWord, rsi, ma50, ma200, high, support, resistance, doubleTop,
 *   series, ma50Series, conclusion, read, numbers, breadth }}
 */
export function indexChartReading(history, field, label, { breadth = null } = {}) {
  const closes = sessionCloses(history, field);
  if (closes.length < 60) return null;
  const level = indexLevel(history, field);
  const ma50Series = movingAverage(closes, 50);
  const ma50 = ma50Series.at(-1)?.value ?? null;
  const ma50Before = ma50Series.at(-21)?.value ?? null;
  const ma200 = closes.length >= 200 ? movingAverage(closes, 200).at(-1).value : null;
  const close = closes.at(-1).value;
  const trend = trendOf({ close, ma50, ma200, ma50Before });
  const rsi = rsiOf(closes);
  const { highs, lows } = swingPointsOf(closes);
  const resistance = highs.filter((row) => row.value > close * 1.005).sort((a, b) => a.value - b.value)[0] || null;
  const support = lows.filter((row) => row.value < close * 0.995).sort((a, b) => b.value - a.value)[0] || null;
  const momentum = rsi === null ? '' : rsi <= 30 ? ` RSI ${rsi.toFixed(0)}로 과매도권이라, 단기 반등이 자주 나오는 자리지만 추세가 바뀌었다는 뜻은 아닙니다.`
    : rsi >= 70 ? ` RSI ${rsi.toFixed(0)}로 과열권이라 숨 고르기가 나오기 쉽습니다.` : '';
  const levels = [support ? `아래 지지 후보는 ${md(support.date)} 저점 ${num(support.value)}(${signed((support.value / close - 1) * 100)})` : null,
    resistance ? `위 저항 후보는 ${md(resistance.date)} 고점 ${num(resistance.value)}(${signed((resistance.value / close - 1) * 100)})` : null].filter(Boolean);
  const top = level?.doubleTop;
  const pattern = !top ? '' : top.state === 'broken'
    ? ` ${md(top.first.date)}·${md(top.second.date)} 두 고점 사이 저점(${num(top.neck.value)}) 아래로 내려와 쌍봉이 완성된 모양입니다.`
    : ` ${md(top.first.date)}·${md(top.second.date)} 두 고점 사이 저점(${num(top.neck.value)}) 근처라, 이 저점을 지키는지가 쌍봉 완성 여부를 가릅니다.`;
  // Breadth only where it changes the reading: an index above its 50-day line with most members below it is carried by a
  // few names; an index under it with most members still above is a shallower, broad pullback.
  let breadthRead = '';
  if (breadth && Number.isFinite(breadth.above50) && Number.isFinite(ma50)) {
    if (close > ma50 && breadth.above50 < 45) breadthRead = ` 다만 구성 종목 중 50일선 위는 ${breadth.above50.toFixed(0)}%뿐이라 소수 대형주가 지수를 받치고 있습니다.`;
    else if (close < ma50 && breadth.above50 >= 55) breadthRead = ` 구성 종목의 ${breadth.above50.toFixed(0)}%는 아직 50일선 위라, 지수보다 시장 전체는 덜 무너졌습니다.`;
    else if (close < ma50 && breadth.above50 < 35) breadthRead = ` 구성 종목 중 50일선 위가 ${breadth.above50.toFixed(0)}%로 줄어 하락이 넓게 퍼졌습니다.`;
  }
  const conclusion = `${withTopicParticle(label)} ${TREND_WORDS[trend]}${level ? `, 고점 대비 ${signed(level.fromHighPct)}` : ''}${Number.isFinite(ma50) ? `, 50일선 ${signed((close / ma50 - 1) * 100)}` : ''}${Number.isFinite(ma200) ? `, 200일선 ${signed((close / ma200 - 1) * 100)}` : ''}.`;
  return {
    field, label, asOf: closes.at(-1).date, close, trend, trendWord: TREND_WORDS[trend], rsi, ma50, ma200, high: level?.high || null, support, resistance, doubleTop: top || null,
    series: closes.slice(-252), ma50Series: ma50Series.slice(-252), conclusion,
    read: `${TREND_READ[trend]}${breadthRead}${momentum}${levels.length ? ` ${levels.join(', ')}입니다.` : ''}${pattern}`,
    numbers: [['종가', num(close)], ['50일선', Number.isFinite(ma50) ? num(ma50) : '—'], ['200일선', Number.isFinite(ma200) ? num(ma200) : '—'],
      ['1년 최고 종가', level ? `${num(level.high.value)} (${md(level.high.date)})` : '—'], ['RSI(14)', rsi === null ? '—' : rsi.toFixed(0)], ['6개월 최저 종가', level?.support ? `${num(level.support.value)} (${md(level.support.date)})` : '—']]
  };
}

/** The latest S&P 500 breadth (share of members above their 50/200-day lines) from history.json. */
export function latestBreadth(history) {
  for (let i = (history?.length || 0) - 1; i >= 0; i -= 1) {
    const above50 = readNumber(history[i]?.breadth50); const above200 = readNumber(history[i]?.breadth200);
    if (above50 !== null) return { date: history[i].date, above50, above200 };
  }
  return null;
}

export function indexChartReadings(history) {
  const breadth = latestBreadth(history);
  return CHART_INDEXES.map(([field, label]) => indexChartReading(history, field, label, { breadth: field === 'spx' ? breadth : null })).filter(Boolean);
}

/**
 * Core stocks: the ten largest S&P 500 weights, then the day's material stock moves (market-day.json, rank lead/major),
 * each read from the screener's own fields. A row the screener has no 50-day distance for is left out.
 */
export function coreStockRows({ screener = null, indexWeights = [], day = null, universe = [] } = {}) {
  const names = new Map((Array.isArray(universe) ? universe : []).map((item) => [item.sym, item.name]));
  const top = (Array.isArray(indexWeights) ? indexWeights : []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 10).map((row) => String(row.sym).replace('.', '-'));
  const movers = (day?.facts || []).filter((fact) => fact.kind === 'stock-move' && ['lead', 'major'].includes(fact.rank)).map((fact) => fact.subjects[0]);
  const rows = [];
  for (const sym of [...new Set([...top, ...movers])]) {
    const row = screener?.data?.[sym];
    const vs50 = readRowNumber(row, 'pctSma50'); const vs200 = readRowNumber(row, 'pctSma200');
    if (vs50 === null) continue;
    // The screener carries distances, not the averages: on a close of 1 the lines are 1/(1+d), which also orders the
    // 50-day against the 200-day, so a stock gets the same trend words as an index (its 50-day slope is not known).
    const trend = vs200 === null ? 'unknown' : trendOf({ close: 1, ma50: 1 / (1 + vs50 / 100), ma200: 1 / (1 + vs200 / 100), ma50Before: null });
    rows.push({ sym, name: names.get(sym) || sym, group: top.includes(sym) ? 'weight' : 'mover', ret1d: readRowNumber(row, 'ret1d'), vs50, vs200,
      fromHigh: readRowNumber(row, 'pctFromCloseHigh52w'), rsi: readRowNumber(row, 'rsi'), rvol: readRowNumber(row, 'rvol20'), trend, trendWord: TREND_WORDS[trend] });
  }
  return rows;
}

/** The screen's opening line: how many of the indexes are in each trend, the weakest one named. */
export function chartsConclusion(readings) {
  if (!readings.length) return '';
  const counts = Object.fromEntries(Object.keys(TREND_WORDS).map((key) => [key, readings.filter((r) => r.trend === key).length]));
  const weakest = readings.slice().sort((a, b) => (a.close / a.ma50) - (b.close / b.ma50))[0];
  const parts = ['up', 'recovery', 'pullback', 'rebound', 'breakdown', 'down'].filter((key) => counts[key]).map((key) => `${TREND_WORDS[key]} ${counts[key]}개`);
  return `지수 ${readings.length}개 중 ${parts.join(', ')}. 가장 약한 곳은 ${withTopicParticle(weakest.label).replace(/[은는]$/, '')}(50일선 ${signed((weakest.close / weakest.ma50 - 1) * 100)})입니다.`;
}
