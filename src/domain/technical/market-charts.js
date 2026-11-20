// v59.64 (owner 2026-11-03: "기술적 분석에서는 차트 분석으로 지수와 대표 핵심 종목들 분석해주고, 설명해주고"): the 기술적
// 분석 screen's readings. Indexes are read from the published closes (history.json, one close per session); core stocks
// from the screener's derived fields. Every word is a rule over those numbers — the trend from where the close sits
// against its 50- and 200-day averages and which way the 50-day is going, momentum from the 14-day RSI (Wilder),
// support and resistance from swing points (a close that is the lowest/highest of five sessions on each side), the
// double top and the six-month support from index-levels.js. Breadth enters only where it changes the reading of a
// trend (owner: "시장 폭만 본다고 해서 의미가 없듯이"). No target, entry or stop is ever named.
import { usThenKorea } from '../market/session/session-time.js';
import { readNumber, signedText } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { sessionCloses, indexLevel } from '../market/indices/index-levels.js';
import { trendOfBars } from './trend-state.js';
import { TREND_PHASE_LABELS, bufferedTrend, classifyTrend, trendKey } from './bands.js';
import { rallyAttemptRead } from '../market/regime/rally-attempt.js';
import { RULES } from '../rules/thresholds.js';
import { rsiWilder } from './definitions.js';
import { stampDay } from '../shared/session-date.js';
import { closeSessionMarket } from '../market/session/close-series.js';

// [field, label, the fund whose daily bars the card draws]. The Korean indexes have no fund here; their cards draw the
// published closes.
export const CHART_INDEXES = Object.freeze([['ndx', '나스닥100', 'QQQ'], ['spx', 'S&P 500', 'SPY'], ['soxx', '반도체(SOXX)', 'SOXX'], ['rut', '러셀2000', 'IWM'], ['kospi', '코스피', null], ['kosdaq', '코스닥', null]]);
// The index cards say the words the stock table under them, the 종목 page and the stock
// chart say for the same position (bands.js classifyTrend). '단기 조정' and '하락 속 반등' were this screen's own words for
// what every other screen calls 장기 추세 속 조정 and 장기 추세 아래 반등.
export const TREND_WORDS = Object.freeze({ up: '상승 추세', pullback: '장기 추세 속 조정', breakdown: TREND_PHASE_LABELS.breakdown, rebound: '장기 추세 아래 반등', recovery: TREND_PHASE_LABELS.recovery, down: '하락 추세', unknown: '판단 보류' });
const SWING_SPAN = 5;

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const signed = (value, digits = 1) => signedText(value, digits, '%');
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

/** Wilder's 14-day RSI on closes.the shared definition (definitions.rsiWilder) — one RSI on every screen. */
export function rsiOf(closes, period = 14) {
  return rsiWilder((closes || []).map((row) => row.value), period);
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

/**
 * The index card's trend key.the shared classifier (bands.js classifyTrend) on the close's distance to the 50- and
 * 200-day lines, position only — the published index levels have no high/low for the ADR buffers. The 50-day slope is a
 * number in the card's fold, not a condition: the old rule turned a close above both rising-then-flat lines into 회복 시도.
 */
export function trendOf({ close, ma50, ma200 }) {
  if (![close, ma50, ma200].every(Number.isFinite) || !(ma50 > 0) || !(ma200 > 0)) return 'unknown';
  return trendKey(classifyTrend({ s50: (close / ma50 - 1) * 100, s200: (close / ma200 - 1) * 100, positionOnly: true })) || 'unknown';
}

/** A card's tone from its trend: the classifier's own tone (favorable / neutral / burden). */
const TONE = Object.freeze({ favorable: 'up', burden: 'down' });
// v59.71 (owner 11/07 '가격 움직임과 거래량이 가장 근본'): what the volume said, from the history the producers already
// keep — the S&P 500's distribution days (a close down 0.2% or more on more volume than the session before, last 25
// sessions) and the Nasdaq Composite's rally attempt / follow-through day (a 1.25%+ gain on rising volume). Only the
// indexes whose daily volume the producers read carry a line; the others say nothing rather than guess.
export function indexVolumeRead(history, field) {
  if (field === 'spx') {
    for (let i = (history?.length || 0) - 1; i >= 0; i -= 1) {
      const count = readNumber(history[i]?.distributionDays);
      if (count === null) continue;
      const heavy = count >= RULES.leadership.distributionDaysAt;
      return { date: history[i].date, count, text: `거래량: 최근 25거래일 거래량 실린 하락(분배일) ${count}회${heavy ? ' — 매도 압력이 쌓인 편' : ''}` };
    }
    return null;
  }
  if (field === 'ndx') {
    const rally = rallyAttemptRead(history);
    return rally ? { phase: rally.phase, text: `거래량: 나스닥 종합 ${rally.state}${rally.phase === 'attempt' ? ' — 거래량 늘며 크게 오른 바닥 확인일은 아직' : ''}` } : null;
  }
  return null;
}

/**
 * A year of completed daily closes: the last 252, their highest and lowest close, the 200-day line, and the last close
 * against the high and that line. The one close basis of 기술적 분석's cards (barsChartReading) and the 종목 screen's year
 * line (ticker-year-line.js); null below 60 bars.
 * @returns {null | { series, ma200Series, high, low, close, asOf, fromHigh, ma200, s200 }}
 */
export function yearCloseRead(bars) {
  const closes = (Array.isArray(bars) ? bars : []).filter((bar) => Number.isFinite(bar?.close) && bar.close > 0).map((bar) => ({ date: bar.time, value: bar.close }));
  if (closes.length < 60) return null;
  const ma200Series = closes.length >= 200 ? movingAverage(closes, 200) : [];
  const ma200 = ma200Series.at(-1)?.value ?? null;
  const series = closes.slice(-252);
  const high = series.reduce((best, row) => (row.value > best.value ? row : best));
  const low = series.reduce((best, row) => (row.value < best.value ? row : best));
  const close = series.at(-1).value;
  return {
    series, ma200Series: ma200Series.slice(-252), high, low, close, asOf: series.at(-1).date,
    fromHigh: (close / high.value - 1) * 100, ma200, s200: Number.isFinite(ma200) && ma200 > 0 ? (close / ma200 - 1) * 100 : null
  };
}

/**
 * One index card's reading, from the bars the card draws (owner 2026-11-19: one verdict per index, from the function the
 * stock chart uses). A US card draws its fund's daily OHLC bars, so the trend passes the same ADR buffers the 종목 page and
 * the analysis slot read (trend-state.js trendOfBars); a Korean card, or a US card whose bars did not arrive, draws the
 * published closes, read position-only. `history` adds what only the index itself has — the S&P 500's distribution days
 * and breadth, the Nasdaq's rally attempt, and (on a card drawing the index's own closes) the double top and the six-month
 * low — as numbers in the raw table, never as a sentence.
 * @param {{ bars: Array<{time:string, close:number, open?:number, high?:number, low?:number, volume?:number}>, field: string,
 *   label: string, symbol?: string|null, positionOnly?: boolean, history?: Array, breadth?: object|null,
 *   money?: (value:number) => string }} input — `money` writes a bar price (a Korean stock in won); dollars by default
 * @returns {null | { field, label, symbol, source, asOf, close, trend, trendWord, tone, rsi, ma50, ma200, s50, s200,
 *   fromHigh, support, resistance, doubleTop, series, ma50Series, ma200Series, facts, volume, numbers }}
 */
export function barsChartReading({ bars, field, label, symbol = null, positionOnly = false, history = [], breadth = null, money: priceText = null } = {}) {
  const list = (Array.isArray(bars) ? bars : []).filter((bar) => Number.isFinite(bar?.close) && bar.close > 0);
  const year = yearCloseRead(list);
  if (!year) return null;
  const closes = list.map((bar) => ({ date: bar.time, value: bar.close }));
  const ma50Series = movingAverage(closes, 50);
  const ma50 = ma50Series.at(-1)?.value ?? null;
  const ma50Before = ma50Series.at(-21)?.value ?? null;
  const { ma200, close, high, fromHigh, s200 } = year;
  const current = trendOfBars(list, { positionOnly });
  const trend = trendKey(current) || 'unknown';
  const trendWord = current?.label || TREND_WORDS.unknown;
  const rsi = rsiOf(closes);
  const { highs, lows } = swingPointsOf(closes);
  const resistance = highs.filter((row) => row.value > close * 1.005).sort((a, b) => a.value - b.value)[0] || null;
  const support = lows.filter((row) => row.value < close * 0.995).sort((a, b) => b.value - a.value)[0] || null;
  const s50 = Number.isFinite(ma50) && ma50 > 0 ? (close / ma50 - 1) * 100 : null;
  // The index's own closes carry its double top and six-month low (index-levels.js); a fund's bars are another price scale.
  const level = positionOnly ? indexLevel(history, field) : null;
  const top = level?.doubleTop || null;
  const money = positionOnly ? num : priceText || ((value) => `$${value.toFixed(2)}`);
  const at = (row) => (row ? `${money(row.value)} (${md(row.date)}, ${signed((row.value / close - 1) * 100)})` : '—');
  // The index-and-breadth pair is 시장 상태's reading (cross-readings.js): one pair of lines, RULES.breadthCross. Here it is a
  // number and the side of each line it sits on, not a sentence about who carries the index.
  let breadthRow = null;
  if (breadth && Number.isFinite(breadth.above50)) {
    const { broadAbovePct, narrowBelowPct } = RULES.breadthCross;
    const band = breadth.above50 >= broadAbovePct ? `${broadAbovePct}% 이상` : breadth.above50 < narrowBelowPct ? `${narrowBelowPct}% 미만` : `${narrowBelowPct}~${broadAbovePct}%`;
    breadthRow = ['구성 종목 중 50일선 위', `${breadth.above50.toFixed(0)}% (${band})`];
  }
  const facts = [`고점 대비 ${signed(fromHigh)}`, s50 == null ? null : `50일선 ${signed(s50)}`, s200 == null ? null : `200일선 ${signed(s200)}`].filter(Boolean).join(' · ');
  const numbers = [['종가', money(close)], ['50일선', Number.isFinite(ma50) ? money(ma50) : '—'], ['200일선', Number.isFinite(ma200) ? money(ma200) : '—'],
    ['1년 최고 종가', `${money(high.value)} (${md(high.date)})`], ['RSI(14)', rsi === null ? '—' : rsi.toFixed(0)],
    ['50일선 20일 기울기', Number.isFinite(ma50Before) && ma50Before > 0 ? signed((ma50 / ma50Before - 1) * 100) : '—'],
    ['아래 스윙 저점', at(support)], ['위 스윙 고점', at(resistance)]];
  if (level?.support) numbers.push(['6개월 최저 종가', `${num(level.support.value)} (${md(level.support.date)})`]);
  if (top) numbers.push(['쌍봉 목선', `${num(top.neck.value)} (${md(top.first.date)}·${md(top.second.date)} 고점 사이, ${top.state === 'broken' ? '아래로 내려옴' : '근처'})`]);
  if (breadthRow) numbers.push(breadthRow);
  return {
    field, label, symbol, source: positionOnly ? 'closes' : 'bars', asOf: closes.at(-1).date, close, trend, trendWord, tone: TONE[current?.tone] || 'neutral',
    rsi, ma50, ma200, s50, s200, fromHigh, high, support, resistance, doubleTop: top,
    series: year.series, ma50Series: ma50Series.slice(-252), ma200Series: year.ma200Series,
    facts, volume: indexVolumeRead(history, field), numbers
  };
}

/** One index's reading from its published closes (history.json), position-only. */
export function indexChartReading(history, field, label, { breadth = null } = {}) {
  const bars = sessionCloses(history, field).map((row) => ({ time: row.date, close: row.value }));
  const symbol = CHART_INDEXES.find(([key]) => key === field)?.[2] || null;
  return barsChartReading({ bars, field, label, symbol, positionOnly: true, history, breadth });
}

/** The latest S&P 500 breadth (share of members above their 50/200-day lines) from history.json. */
export function latestBreadth(history) {
  for (let i = (history?.length || 0) - 1; i >= 0; i -= 1) {
    const above50 = readNumber(history[i]?.breadth50); const above200 = readNumber(history[i]?.breadth200);
    if (above50 !== null) return { date: history[i].date, above50, above200 };
  }
  return null;
}

/**
 * The page's close date: the latest completed bar the US index cards draw. The Korean cards close earlier in the day, so
 * during the US session their newer close (11/18) must not date the page while the US cards still draw 11/17; a card on
 * another date says its own. Without a US card, the latest drawn bar.
 */
export function chartsPageBasis(readings) {
  const dates = (list) => list.map((reading) => reading?.asOf).filter(Boolean).sort().at(-1) || null;
  const all = Array.isArray(readings) ? readings : [];
  return dates(all.filter((reading) => closeSessionMarket(reading?.field) === 'US')) || dates(all);
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
  // v59.70 (re-review N7): the same US → Korea order as 오늘's names, no third market.
  const movers = usThenKorea((day?.facts || []).filter((fact) => fact.kind === 'stock-move' && ['lead', 'major'].includes(fact.rank)), (fact) => String(fact.subjects?.[0] || '')).map((fact) => fact.subjects[0]);
  const rows = [];
  for (const sym of [...new Set([...top, ...movers])]) {
    const row = screener?.data?.[sym];
    const vs50 = readRowNumber(row, 'pctSma50'); const vs200 = readRowNumber(row, 'pctSma200');
    if (vs50 === null) continue;
    // v59.70 (lens audit, one trend per stock): a stock reads the 종목 page's buffered trend (bands.js, ADR bands and the
    // five-session drop), so the table and the stock page name the same state. The index cards above read the bars they draw
    // (barsChartReading, trend-state.js). NV −8.8% / −1.0% read '추세 이탈' here and '하락 추세' on 종목.
    const buffered = vs200 === null ? null : bufferedTrend(row);
    // v59.71: '고점 대비' is the 종목·스크리너·테마 field (pctFrom52wHigh, the 52-week intraday high), not the close high.
    const trend = trendKey(buffered) || 'unknown';
    rows.push({ sym, name: names.get(sym) || sym, group: top.includes(sym) ? 'weight' : 'mover', ret1d: readRowNumber(row, 'ret1d'), vs50, vs200,
      fromHigh: readRowNumber(row, 'pctFrom52wHigh'), rsi: readRowNumber(row, 'rsi'), rvol: readRowNumber(row, 'rvol20'), trend, trendWord: buffered?.label || TREND_WORDS.unknown,
      session: stampDay(row?.factorSessionDate) });
  }
  return rows;
}

/**
 * the US session the stock table's rows were computed on, when it is behind the page's
 * index close `asOf` (the header read "11/17 종가" over rows of 11/16); null when they match or nothing is dated.
 */
export function stockTableSessionBehind(rows, asOf) {
  const day = String(asOf || '').slice(0, 10);
  const latest = (Array.isArray(rows) ? rows : []).filter((row) => row?.session && !/\.K[SQ]$/i.test(String(row.sym || ''))).map((row) => row.session).sort().at(-1) || null;
  return latest && day && latest < day ? latest : null;
}

// The order the opening line counts the states in, strongest first; a word outside it (a buffered state such as 50일선 부근)
// follows in the order the cards show it.
const TREND_ORDER = Object.freeze(['up', 'up-shaken', 'recovery', 'near50', 'unconfirmed', 'pullback', 'rebound', 'breakdown', 'down']);

/** The screen's opening line: how many of the indexes are in each trend, the weakest one named. */
export function chartsConclusion(readings) {
  const list = (Array.isArray(readings) ? readings : []).filter(Boolean);
  if (!list.length) return '';
  const words = [];
  for (const key of [...TREND_ORDER, ...list.map((r) => r.trend)]) for (const r of list) if (r.trend === key && !words.includes(r.trendWord)) words.push(r.trendWord);
  const parts = words.map((word) => `${word} ${list.filter((r) => r.trendWord === word).length}개`);
  const weakest = list.filter((r) => Number.isFinite(r.s50)).sort((a, b) => a.s50 - b.s50)[0];
  return `지수 ${list.length}개 중 ${parts.join(', ')}.${weakest ? ` 가장 약한 곳은 ${weakest.label}, 50일선 대비 ${signed(weakest.s50)}입니다.` : ''}`; // v59.71: a label like 반도체(SOXX) took a second parenthesis
}
