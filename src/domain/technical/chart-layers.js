// v59.74 (owner 2026-11-07, chart redesign): the daily chart's layers in two tiers. The base tier is drawn for every
// stock — price action, volume, the 21·50·200 moving averages, the volume profile (매물대) and the up/down trend drawn
// as shaded areas, not lines. Every other study (RSI, MACD, divergence, Fibonacci, VCP, Bollinger squeeze/expansion,
// event signals, the RS line, the price-level map) is opt-in, so the default chart stays readable.
// Pure functions on completed daily bars (the same bars chart-analysis.js reads): no DOM, no globals, no network.
// Nothing here is an entry, stop or target (R724): each layer is a published, named calculation shown as a fact.
import { emaSeries, rsiSeriesWilder, smaSeries } from './definitions.js';
import { swingPoints } from './price-levels.js';
import { buildVolumeByPrice, profilePosition } from './chart-scenarios.js';
import { RULES } from '../rules/thresholds.js';
import { trendStateSeries } from './trend-state.js';

export const CHART_LAYERS_VERSION = 'chart-layers.v1';

/**
 * The layer registry the chart renders and the toggle row lists. `base` layers start on (and can be hidden);
 * `extra` layers start off. `pane` layers take their own band under the price.
 */
export const CHART_LAYERS = Object.freeze([
  { id: 'ma', tier: 'base', label: '이동평균', title: '5·10·20·50·100·200 단순 이동평균. 단기는 5·10·20(굵게), 중장기는 20·50·200(굵게)을 봅니다. 5 > 10 > 20, 20 > 50 > 200 순서면 정배열, 반대면 역배열입니다' },
  { id: 'profile', tier: 'base', label: '매물대', title: '최근 130봉 거래량을 가격대 24칸으로 나눈 막대(오른쪽), 가장 많이 거래된 칸(POC, 실선)과 거래의 70%가 몰린 가치 영역(띠). 각 봉 거래량을 그 봉의 저가~고가에 고르게 나눈 추정이며 실제 체결 분포가 아닙니다' },
  { id: 'trend', tier: 'base', label: '추세 구간', title: '종목 화면·스크리너와 같은 추세 판정(종가와 50·200선의 위치, 50선과 200선의 순서, 일평균 변동폭 기준 50선 부근·단기 급락)이 3봉 이상 이어진 구간을 칠합니다. 상승 추세·회복 시도는 상승색, 하락 추세·추세 이탈은 하락색이고 조정·반등·부근은 칠하지 않습니다' },
  { id: 'ema821', tier: 'ma', label: 'EMA 8·21', title: '8·21 지수 이동평균(추가 이평선). 스윙·모멘텀 매매에서 가장 널리 쓰는 짧은 추세선 쌍으로, 최근 가격에 더 큰 가중치를 둬 기본 5·10·20 단순 이평보다 전환을 빨리 반영합니다' },
  { id: 'rsi', tier: 'extra', pane: true, label: 'RSI', title: 'Wilder RSI 14. 70 이상은 과열, 30 이하는 과매도 기준이지만 강한 추세에서는 그 영역에 오래 머물기도 합니다' },
  { id: 'macd', tier: 'extra', pane: true, label: 'MACD', title: 'MACD(12, 26, 9): 12 EMA − 26 EMA(선), 그 9 EMA(시그널), 둘의 차이(막대). 막대가 0 위로 커지면 단기 추세가 장기보다 빠르게 오르는 중입니다' },
  { id: 'divergence', tier: 'extra', label: '다이버전스', title: '가격은 더 낮은 저점인데 RSI는 더 높은 저점(강세), 가격은 더 높은 고점인데 RSI는 더 낮은 고점(약세)인 최근 스윙 쌍. 추세가 약해졌다는 관찰이지 반전 확정이 아닙니다' },
  { id: 'fib', tier: 'extra', label: '피보나치', title: '최근 252봉 최고가와 최저가 사이의 되돌림 비율(23.6·38.2·50·61.8·78.6%). 나중에 나온 극점에서 거꾸로 잽니다. 관찰할 가격대이며 지지·저항을 보장하지 않습니다' },
  { id: 'bands', tier: 'extra', label: '수렴·확산', title: '볼린저 밴드(20, 2표준편차) 면과, 밴드 폭이 직전 125봉 최저 수준까지 좁아진 수렴 구간. 수렴 뒤에는 어느 방향이든 변동성이 커지는 경우가 많습니다' },
  { id: 'vcp', tier: 'extra', daily: true, label: 'VCP', title: '변동성 수축 패턴(Minervini): 고점→저점 하락 폭이 차례로 줄어드는 수축 구간의 저점과 마지막 수축 고점(피벗). 일봉 기준' },
  { id: 'signals', tier: 'extra', daily: true, label: '신호', title: '8일 EMA 이탈·회복, 거래량 동반 갭, 변동성 압축, 과열 표시. 사건 기록이며 매매 신호가 아닙니다. 일봉 기준' },
  { id: 'rs', tier: 'extra', daily: true, pane: true, label: '상대강도', title: '종목 ÷ 시장 지수 종가를 첫 비교일 100으로 맞춘 선과 1년 신고가 점. 일봉 기준' },
  { id: 'levels', tier: 'extra', daily: true, label: '가격 레벨', title: '전일 고가·저가와 가격 레벨 지도의 가까운 위·아래 레벨(자세히의 \'가격 레벨과 내 계획\'). 일봉 기준' }
]);
export const BASE_MA = Object.freeze([5, 10, 20, 50, 100, 200]);
export const LAYER_IDS = Object.freeze(CHART_LAYERS.map((layer) => layer.id));
export const DEFAULT_LAYERS = Object.freeze(Object.fromEntries(CHART_LAYERS.map((layer) => [layer.id, layer.tier === 'base'])));

/** A stored preference merged over the defaults; unknown keys and non-boolean values are ignored. */
export function resolveLayers(stored) {
  const out = { ...DEFAULT_LAYERS };
  if (stored && typeof stored === 'object') for (const id of LAYER_IDS) if (typeof stored[id] === 'boolean') out[id] = stored[id];
  return out;
}

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

// v59.87 (ADR-0003 S1): the per-bar Wilder RSI lives in definitions.js with rsiWilder; re-exported for the pane's importers.
export { rsiSeriesWilder };

/** MACD(fast, slow, signal) per bar: line = EMA(fast) − EMA(slow), signal = EMA(signal) of the line, hist = line − signal. */
export function macdSeries(closes, fast = 12, slow = 26, signal = 9) {
  const f = emaSeries(closes, fast), s = emaSeries(closes, slow);
  const line = closes.map((_, i) => (isNum(f[i]) && isNum(s[i]) ? f[i] - s[i] : null));
  const start = line.findIndex(isNum);
  const sig = closes.map(() => null);
  if (start >= 0) {
    const tail = emaSeries(line.slice(start), signal);
    tail.forEach((value, k) => { sig[start + k] = value; });
  }
  const hist = line.map((value, i) => (isNum(value) && isNum(sig[i]) ? value - sig[i] : null));
  return { line, signal: sig, hist, params: [fast, slow, signal] };
}

/** Bollinger bands (period, k population SD) and the band width ÷ middle. */
export function bollingerSeries(closes, period = 20, k = 2) {
  const mid = smaSeries(closes, period);
  const upper = [], lower = [], width = [];
  closes.forEach((_, i) => {
    if (!isNum(mid[i])) { upper.push(null); lower.push(null); width.push(null); return; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sum / period);
    upper.push(mid[i] + k * sd); lower.push(mid[i] - k * sd); width.push(mid[i] > 0 ? (2 * k * sd) / mid[i] : null);
  });
  return { mid, upper, lower, width, params: [period, k] };
}

/**
 * Squeeze spans: consecutive bars whose band width is at its lowest of the prior `lookback` bars (the same 6-month rule
 * as chart-analysis.js's 변동성 압축 event), and the expansion after each span (width back above its 6-month median).
 */
export function squeezeSpans(width, lookback = 125) {
  const spans = [];
  let open = null;
  for (let i = lookback + 20; i < width.length; i++) {
    const past = width.slice(i - lookback, i).filter(isNum);
    const isLow = isNum(width[i]) && past.length > 60 && width[i] <= Math.min(...past) * 1.05;
    if (isLow && !open) open = { from: i, to: i };
    else if (isLow && open) open.to = i;
    else if (!isLow && open) { spans.push(open); open = null; }
  }
  if (open) spans.push(open);
  // Merge spans fewer than 5 bars apart into one squeeze.
  const merged = [];
  for (const span of spans) {
    const prev = merged.at(-1);
    if (prev && span.from - prev.to <= 5) prev.to = span.to; else merged.push({ ...span });
  }
  return merged;
}

/**
 * Trend areas and the trend chip: the canonical trend (trend-state.js over bands.js classifyTrend — the words the
 * 종목 page and the screener use: 상승 추세 · 회복 시도 · 50일선 부근 · 장기 추세 속 조정 · 장기 추세 아래 반등 · 추세 이탈 ·
 * 하락 추세), held with a 3-bar hysteresis. Up-side states shade up, down-side states shade down, the turning states stay
 * unshaded. `current` stays the up/down/none direction the areas use; `trend` is the full reading for the chip.
 */
export function trendRegimes(bars, { sma50 = null, confirm = 3 } = {}) {
  const series = trendStateSeries(bars, { confirm, sma50 });
  return { states: series.states, segments: series.segments, current: series.direction || (series.key ? 'none' : null), trend: series.current, key: series.key, held: series.held };
}

/**
 * Regular RSI divergences over the last `lookback` bars, from swing points confirmed by `span` bars each side:
 * bullish = price lower low with RSI higher low; bearish = price higher high with RSI lower high. Pairs farther apart
 * than `maxGap` bars, or with an RSI difference under `minRsiGap`, are skipped. The latest `max` of each kind are kept.
 */
export function rsiDivergences(bars, rsi, { lookback = 252, span = 5, maxGap = 60, minGap = 5, minRsiGap = 2, max = 2 } = {}) {
  if (!Array.isArray(bars) || bars.length < 40 || !Array.isArray(rsi)) return [];
  const { highs, lows } = swingPoints(bars, Math.max(0, bars.length - lookback), span);
  const found = [];
  const pairs = (points, kind) => {
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1], b = points[k];
      if (b - a > maxGap || b - a < minGap || !isNum(rsi[a]) || !isNum(rsi[b])) continue;
      if (kind === 'bullish' && bars[b].low < bars[a].low && rsi[b] > rsi[a] + minRsiGap) found.push({ kind, from: a, to: b, priceFrom: bars[a].low, priceTo: bars[b].low, rsiFrom: rsi[a], rsiTo: rsi[b] });
      if (kind === 'bearish' && bars[b].high > bars[a].high && rsi[b] < rsi[a] - minRsiGap) found.push({ kind, from: a, to: b, priceFrom: bars[a].high, priceTo: bars[b].high, rsiFrom: rsi[a], rsiTo: rsi[b] });
    }
  };
  pairs(lows, 'bullish');
  pairs(highs, 'bearish');
  const keep = (kind) => found.filter((d) => d.kind === kind).slice(-max);
  return [...keep('bullish'), ...keep('bearish')].sort((x, y) => x.to - y.to);
}

export const FIB_RATIOS = Object.freeze([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);

/**
 * Fibonacci retracement of the last `lookback` bars' range. The anchor is the highest high and lowest low; when the high
 * came later the move is up and the levels are measured down from the high (and the mirror when the low came later).
 */
export function fibonacciLevels(bars, { lookback = 252 } = {}) {
  if (!Array.isArray(bars) || bars.length < 60) return { available: false };
  const from = Math.max(0, bars.length - lookback);
  let hi = from, lo = from;
  for (let i = from; i < bars.length; i++) { if (bars[i].high > bars[hi].high) hi = i; if (bars[i].low < bars[lo].low) lo = i; }
  const high = bars[hi].high, low = bars[lo].low;
  if (!(high > low)) return { available: false };
  const direction = hi > lo ? 'up' : 'down';
  const levels = FIB_RATIOS.map((ratio) => ({ ratio, price: direction === 'up' ? high - (high - low) * ratio : low + (high - low) * ratio }));
  return { available: true, direction, high, low, highIndex: hi, lowIndex: lo, levels };
}

/**
 * The volume profile the base tier draws: the one profile chart-scenarios.js owns (24 rows, POC and 70% value area over the
 * last 130 bars — the window the chart opens on), so the chart, the 거래 집중 가격대 table and the price-level map agree.
 * v59.74 (no stock left out): an intraday feed often leaves a bar's volume empty; those bars are left out (E08) and the
 * profile is drawn when at least 90% of the window has volume.
 */
export function chartVolumeProfile(bars, lookback = 130) {
  return buildVolumeByPrice(bars, { lookback });
}

/**
 * Relative volume (RVOL) for the last bar. Daily and longer bars: volume ÷ the average of the previous 50 bars
 * (IBD/MarketSmith's 50-day average volume line). Intraday bars: volume ÷ the average volume of the same clock slot over
 * the previous 10 sessions (TradingView "RVOL at time") — a 09:30 bar is never compared with a lunchtime bar. Null when
 * the last bar or too few comparison bars carry volume.
 */
export function relativeVolume(bars, { dailyLookback = 50, intradaySessions = 10 } = {}) {
  const last = bars?.at?.(-1);
  if (!last || !isNum(last.volume) || !(last.volume > 0)) return null;
  const intraday = typeof last.time === 'number';
  let pool;
  if (intraday) {
    const slot = (time) => { const d = new Date(time * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
    const day = (time) => Math.floor(time / 86400);
    const want = slot(last.time), today = day(last.time);
    const seen = new Set();
    pool = [];
    for (let i = bars.length - 2; i >= 0 && seen.size < intradaySessions; i--) {
      const bar = bars[i];
      if (day(bar.time) === today || slot(bar.time) !== want || seen.has(day(bar.time))) continue;
      seen.add(day(bar.time));
      if (isNum(bar.volume) && bar.volume > 0) pool.push(bar.volume);
    }
    // The 5-minute chart asks for five sessions (four before today), so three same-slot bars are enough.
    if (pool.length < 3) return null;
  } else {
    pool = bars.slice(-1 - dailyLookback, -1).map((bar) => bar.volume).filter((v) => isNum(v) && v > 0);
    if (pool.length < Math.min(20, dailyLookback)) return null;
  }
  const average = pool.reduce((sum, v) => sum + v, 0) / pool.length;
  return { ratio: last.volume / average, average, basis: intraday ? 'time-of-day' : 'average', sample: pool.length };
}

/** The volume average line drawn on the volume histogram (50 bars; intraday 20), null where the window is short. */
export function volumeAverageSeries(bars, period = typeof bars?.[0]?.time === 'number' ? 20 : 50) {
  const out = bars.map(() => null);
  let sum = 0, count = 0;
  const vols = bars.map((bar) => (isNum(bar.volume) && bar.volume >= 0 ? bar.volume : null));
  for (let i = 0; i < vols.length; i++) {
    if (vols[i] != null) { sum += vols[i]; count++; }
    const drop = i - period;
    if (drop >= 0 && vols[drop] != null) { sum -= vols[drop]; count--; }
    if (i >= period - 1 && count >= period * 0.9) out[i] = sum / count;
  }
  return { values: out, period };
}

const ORDER_WORD = Object.freeze({ up: '정배열', down: '역배열', mixed: '혼조' });
function orderOf(values) {
  if (values.some((value) => !isNum(value))) return null;
  const steps = values.slice(1).map((value, index) => values[index] - value);
  return steps.every((step) => step > 0) ? 'up' : steps.every((step) => step < 0) ? 'down' : 'mixed';
}

/**
 * Moving-average alignment on the last bar: short = 5 > 10 > 20 (정배열) or 5 < 10 < 20 (역배열), mid/long =
 * 20 > 50 > 200, plus whether the close sits above the 5 (short) and the 20 (long) line and whether 100 also fits.
 */
export function maAlignment(ma, close) {
  const at = (n) => ma?.[n]?.at(-1) ?? null;
  const short = orderOf([at(5), at(10), at(20)]);
  const long = orderOf([at(20), at(50), at(200)]);
  const full = orderOf([at(20), at(50), at(100), at(200)]);
  return {
    short, long, full,
    shortLabel: short ? ORDER_WORD[short] : null,
    longLabel: long ? ORDER_WORD[long] : null,
    closeAbove5: isNum(at(5)) && isNum(close) ? close > at(5) : null,
    closeAbove20: isNum(at(20)) && isNum(close) ? close > at(20) : null,
    text: [
      short ? `단기 5·10·20 ${ORDER_WORD[short]}${isNum(at(5)) && isNum(close) ? `(종가 5선 ${close > at(5) ? '위' : '아래'})` : ''}` : '단기 5·10·20 계산 불가',
      long ? `중장기 20·50·200 ${ORDER_WORD[long]}${full && full === long && long !== 'mixed' ? '(100선 포함)' : ''}` : '중장기 20·50·200 기록 부족'
    ].join(' · ')
  };
}

/** Every series the layers draw, computed once per chart, on any bar interval (minute, hour, day, week). */
export function buildChartLayers(input) {
  const bars = (Array.isArray(input) ? input : input?.bars || []).filter((bar) => [bar?.open, bar?.high, bar?.low, bar?.close].every((v) => isNum(v) && v > 0));
  if (bars.length < 2) return { available: false };
  const closes = bars.map((bar) => bar.close);
  const ma = Object.fromEntries(BASE_MA.map((p) => [p, smaSeries(closes, p)]));
  const rsi = rsiSeriesWilder(closes, 14);
  const bands = bollingerSeries(closes, 20, 2);
  return {
    available: true,
    version: CHART_LAYERS_VERSION,
    bars,
    ma,
    ema8: emaSeries(closes, 8),
    ema21: emaSeries(closes, 21),
    alignment: maAlignment(ma, closes.at(-1)),
    trend: trendRegimes(bars, { sma50: ma[50] }),
    profile: chartVolumeProfile(bars),
    rvol: relativeVolume(bars),
    volumeAverage: volumeAverageSeries(bars),
    rsi,
    rsiBands: RULES.technical.rsi,
    macd: macdSeries(closes),
    bands,
    squeezes: squeezeSpans(bands.width),
    divergences: rsiDivergences(bars, rsi),
    fib: fibonacciLevels(bars)
  };
}

const shortTime = (time) => (typeof time === 'number' ? new Date(time * 1000).toISOString().slice(5, 16).replace('T', ' ').replace('-', '/') : String(time).slice(5).replace('-', '/'));

/**
 * The read under the chart as short chips (owner 2026-11-07: the chart carries the picture; text only states the core
 * facts). Each chip: { id, text, tone: 'up'|'down'|'neutral', title } — `title` holds the detail for the hover.
 */
export function layerFacts(layers, active, bars, price = (v) => v.toFixed(2)) {
  if (!layers?.available) return [];
  const n = bars.length - 1;
  const close = bars[n].close;
  const chips = [];
  const tone = (order) => (order === 'up' ? 'up' : order === 'down' ? 'down' : 'neutral');
  const push = (id, text, t = 'neutral', title = '') => chips.push({ id, text, tone: t, title });
  if (active.ma && layers.alignment) {
    const a = layers.alignment;
    push('ma-short', `단기 ${a.shortLabel || '—'}`, tone(a.short), `5·10·20 이동평균 순서${a.closeAbove5 == null ? '' : `, 종가는 5선 ${a.closeAbove5 ? '위' : '아래'}`}`);
    push('ma-long', `중장기 ${a.longLabel || '—'}`, tone(a.long), `20·50·200 이동평균 순서${a.full && a.full === a.long && a.long !== 'mixed' ? ', 100선까지 같은 순서' : ''}`);
  }
  if (active.trend) {
    const t = layers.trend.trend;
    const tone = { favorable: 'up', burden: 'down' }[t?.tone] || 'neutral';
    if (t) push('trend', `${t.label}${layers.trend.held >= 2 ? ` ${layers.trend.held}봉` : ''}`, tone, t.text);
    else push('trend', '추세 판단 보류', 'neutral', '50·200봉 이동평균을 계산할 기록이 부족합니다');
  }
  if (active.profile && layers.profile.available) {
    // Where the close sits against the value area (70% of the window's volume) and its POC, the standard read.
    const p = layers.profile, where = profilePosition(p, close);
    const word = { poc: '최대 매물대(POC)', above: '매물대 위', below: '매물대 아래', inside: '매물대 안' }[where];
    if (word) push('profile', word, where === 'above' ? 'up' : where === 'below' ? 'down' : 'neutral',
      `POC ${price(p.poc.low)}~${price(p.poc.high)}(거래의 ${p.poc.share.toFixed(0)}%), 가치 영역 ${price(p.valueArea.low)}~${price(p.valueArea.high)}(${p.valueArea.share.toFixed(0)}%), 최근 ${p.sessions}봉`);
  }
  if (layers.rvol && layers.rvol.ratio >= 1.5) {
    // Volume only speaks when it is unusual — 1.5× its own average or more (the breakout rule's multiple).
    push('rvol', `거래량 ${layers.rvol.ratio.toFixed(1)}배`, bars[n].close >= bars[n].open ? 'up' : 'down',
      layers.rvol.basis === 'time-of-day' ? `같은 시각 봉의 최근 ${layers.rvol.sample}거래일 평균 대비` : `직전 ${layers.rvol.sample}봉 평균 거래량 대비`);
  }
  if (active.rsi && isNum(layers.rsi[n])) {
    const r = layers.rsi[n], { overbought, oversold } = layers.rsiBands;
    push('rsi', `RSI ${r.toFixed(0)}`, r >= overbought ? 'down' : r <= oversold ? 'up' : 'neutral', r >= overbought ? `과열 기준 ${overbought} 이상` : r <= oversold ? `과매도 기준 ${oversold} 이하` : `${oversold}~${overbought} 사이`);
  }
  if (active.macd && isNum(layers.macd.hist[n])) {
    const h = layers.macd.hist[n], prev = layers.macd.hist[n - 1];
    push('macd', `MACD ${h >= 0 ? '0 위' : '0 아래'}${isNum(prev) ? (Math.abs(h) > Math.abs(prev) ? '·확대' : '·축소') : ''}`, h >= 0 ? 'up' : 'down', '막대 = MACD선 − 시그널선');
  }
  if (active.divergence) {
    const last = layers.divergences.at(-1);
    if (last) push('divergence', `${last.kind === 'bullish' ? '강세' : '약세'} 다이버전스 ${shortTime(bars[last.to].time)}`, last.kind === 'bullish' ? 'up' : 'down', `RSI ${last.rsiFrom.toFixed(0)}→${last.rsiTo.toFixed(0)}, 가격 ${price(last.priceFrom)}→${price(last.priceTo)}`);
    else push('divergence', '다이버전스 없음', 'neutral', '최근 252봉 스윙 기준');
  }
  if (active.fib && layers.fib.available) {
    const nearest = [...layers.fib.levels].sort((a, b) => Math.abs(a.price - close) - Math.abs(b.price - close))[0];
    push('fib', `피보 ${(nearest.ratio * 100).toFixed(1)}% 근처`, 'neutral', `${price(nearest.price)}, ${layers.fib.direction === 'up' ? '상승폭' : '하락폭'}(${price(layers.fib.low)}~${price(layers.fib.high)}) 기준`);
  }
  if (active.bands) {
    const sq = layers.squeezes.at(-1);
    push('bands', sq && sq.to >= n - 1 ? '밴드 수렴 중' : '밴드 확산', 'neutral', sq ? `마지막 수렴 ${shortTime(bars[sq.from].time)}~${shortTime(bars[sq.to].time)}` : '최근 수렴 구간 없음');
  }
  return chips;
}
