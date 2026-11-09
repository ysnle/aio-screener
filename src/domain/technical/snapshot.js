// v59.88 (ADR-0003 S6): the daily technical snapshot — moved from js/aio-core.js calcTechnicalSnapshot and its _calc*
// helpers (MACD, Bollinger, RVOL, candle shape, recent levels, VCP, RSI divergence, Fibonacci, volume profile, weekly
// context) and calcExtensionHeat. SMA/EMA/RSI/ATR/ADR are technical/definitions.js, the MA stack is stage.js and the VCP
// is the screener producer's own _calcVCPServer, as the legacy wrappers already delegated. Behaviour is the legacy one,
// pinned by architecture/fixtures/technical-snapshot-golden.json (scripts/ci-domain-parity-check.mjs).
// The legacy names calcTechnicalSnapshot / calcExtensionHeat are installed from here by src/app/legacy-screen-bridges.js.
import { smaLast, emaSeries, rsiWilder, atrWilder, adrPctOf } from './definitions.js';
import { classifyMovingAverageStructure } from './stage.js';
import { _calcVCPServer } from '../screener/price-factors.js';

const cleanNums = (values) => (values || []).map((v) => { const n = Number(v); return Number.isFinite(n) ? n : null; });
const present = (values) => cleanNums(values).filter((v) => v !== null);
const positive = (values) => cleanNums(values).filter((v) => v !== null && v > 0);

/** OHLCV rows with a usable close; a missing open/high/low is filled from the close and the fill is marked (hlFilled). */
export function cleanOhlcv(ohlcv) {
  return (ohlcv || []).map((d) => {
    if (!d) return null;
    const close = Number(d.close);
    if (!Number.isFinite(close) || close <= 0) return null;
    let open = Number(d.open); if (!Number.isFinite(open) || open <= 0) open = close;
    let high = Number(d.high), low = Number(d.low);
    const hlFilled = !(Number.isFinite(high) && high > 0 && Number.isFinite(low) && low > 0); // v59.59: ADR/VCP skip a filled bar
    if (!Number.isFinite(high) || high <= 0) high = Math.max(open, close);
    if (!Number.isFinite(low) || low <= 0) low = Math.min(open, close);
    let volume = Number(d.volume); if (!Number.isFinite(volume) || volume < 0) volume = 0;
    return { time: d.time || d.datetime || d.date || null, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume, hlFilled };
  }).filter(Boolean);
}

export function sma(values, period = 20) {
  const nums = present(values);
  return nums.length < period || period <= 0 ? null : smaLast(nums, period);
}
export function emaFull(values, period = 20) {
  const nums = present(values);
  return nums.length < period || period <= 0 ? null : emaSeries(nums, period);
}
export function ema(values, period = 20) {
  const series = emaFull(values, period);
  return series ? series[series.length - 1] : null;
}
export function atr(ohlcv, period = 14) {
  const bars = cleanOhlcv(ohlcv);
  return bars.length < period + 1 ? null : atrWilder(bars, period);
}
export function rsiLast(closes, period = 14) {
  const nums = positive(closes);
  return nums.length < period + 1 ? null : rsiWilder(nums, period);
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const nums = positive(closes);
  if (nums.length < slow + signal) return null;
  const fastEma = emaFull(nums, fast);
  const slowEma = emaFull(nums, slow);
  if (!fastEma || !slowEma) return null;
  const line = nums.map((_, i) => (fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null));
  const cleanMacd = line.filter((v) => v !== null);
  const signalClean = emaFull(cleanMacd, signal);
  if (!signalClean) return null;
  const sig = signalClean[signalClean.length - 1];
  const last = cleanMacd[cleanMacd.length - 1];
  const prevMacd = cleanMacd.length > 1 ? cleanMacd[cleanMacd.length - 2] : last;
  const prevSig = signalClean.length > 1 ? signalClean[signalClean.length - 2] : sig;
  return {
    macd: last, signal: sig, hist: last - sig, prevHist: prevMacd - prevSig,
    macdLine: cleanMacd,
    signalLine: signalClean.filter((v) => v !== null),
    // v51.88 P579: the signal warm-up is null, and isFinite(null) is true — it is checked explicitly.
    histogram: cleanMacd.map((v, idx) => { const s = signalClean[idx - (cleanMacd.length - signalClean.length)]; return s !== null && Number.isFinite(s) ? v - s : null; }).filter((v) => v !== null)
  };
}

export function bollinger(closes, period = 20, mult = 2) {
  const nums = positive(closes);
  if (nums.length < period) return null;
  const slice = nums.slice(-period);
  const mid = sma(nums, period);
  if (mid === null) return null;
  // R265: population variance (÷ period), Bollinger's own definition and TA-Lib/TradingView's.
  const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  const upper = mid + mult * sd, lower = mid - mult * sd, width = upper - lower;
  const close = nums[nums.length - 1];
  return { mid, middle: mid, upper, lower, width, pctB: width > 0 ? (close - lower) / width : 0.5 };
}

export function relativeVolume(volumes, period = 20) {
  const nums = cleanNums(volumes).filter((v) => v !== null && v >= 0);
  if (nums.length < 2) return null;
  const current = nums[nums.length - 1];
  const base = nums.slice(Math.max(0, nums.length - period - 1), nums.length - 1);
  if (!base.length) return null;
  const avg = base.reduce((s, v) => s + v, 0) / base.length;
  return avg > 0 ? current / avg : null;
}

export function closePosition(bar) {
  if (!bar) return null;
  const h = Number(bar.high), l = Number(bar.low), c = Number(bar.close);
  if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || h <= l) return 0.5;
  return Math.max(0, Math.min(1, (c - l) / (h - l)));
}

// v59.59: (high − low) ÷ that day's close, the screener's adrPct; a bar whose high/low was filled is not counted.
export function adrPercent(ohlcv, period = 20) {
  const bars = cleanOhlcv(ohlcv);
  if (bars.length < 2) return null;
  return adrPctOf(bars.map((b) => (b.hlFilled ? null : b.high)), bars.map((b) => (b.hlFilled ? null : b.low)), bars.map((b) => b.close), period || 20);
}

export function candleMetrics(bar, prevBar) {
  if (!bar) return { closePosition: null, upperWickPct: null, bodyPct: null, gapUpPct: null, dayPct: null };
  const open = Number(bar.open), high = Number(bar.high), low = Number(bar.low), close = Number(bar.close);
  const range = high - low;
  const prevClose = prevBar && Number(prevBar.close) > 0 ? Number(prevBar.close) : open;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  return {
    closePosition: closePosition(bar),
    upperWickPct: clamp(range > 0 ? (high - Math.max(open, close)) / range : 0),
    lowerWickPct: clamp(range > 0 ? (Math.min(open, close) - low) / range : 0),
    bodyPct: clamp(range > 0 ? Math.abs(close - open) / range : 1),
    gapUpPct: prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0,
    dayPct: prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0
  };
}

function recentLevel(values, lookback, fn) {
  const nums = present(values).slice(-(lookback || 20));
  return nums.length ? fn(...nums) : null;
}

// v51.68 → v59.59: the producer's own _calcVCPServer (Minervini contraction), bars with a filled high/low left out.
export function vcpOf(bars) {
  const none = { ok: false, vcpScore: 0, vcpStage: 'insufficient_data' };
  if (bars.length < 60) return none;
  const col = (key) => bars.map((b) => ((key === 'high' || key === 'low') && b.hlFilled ? null : b[key]));
  const v = _calcVCPServer(col('close'), col('high'), col('low'), col('volume'));
  return v ? { ok: true, ...v } : none;
}

// v51.69: the whole Wilder RSI series (divergence input); flat = 50 as rsiWilder (v59.59).
export function rsiSeries(closes, period = 14) {
  const n = closes.length;
  if (n < period + 2) return [];
  const gains = [], losses = [];
  for (let i = 1; i < n; i++) { const d = closes[i] - closes[i - 1]; gains.push(d > 0 ? d : 0); losses.push(d < 0 ? -d : 0); }
  let avgG = 0, avgL = 0;
  for (let k = 0; k < period; k++) { avgG += gains[k]; avgL += losses[k]; }
  avgG /= period; avgL /= period;
  const rsiOf = (g, l) => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l));
  const rsi = [rsiOf(avgG, avgL)];
  for (let m = period; m < gains.length; m++) {
    avgG = (avgG * (period - 1) + gains[m]) / period;
    avgL = (avgL * (period - 1) + losses[m]) / period;
    rsi.push(rsiOf(avgG, avgL));
  }
  return rsi;
}

// v51.69: regular and hidden RSI divergence on the last 50 bars (pivot span 4).
export function rsiDivergence(bars) {
  if (!bars || bars.length < 60) return null;
  const closes = bars.map((b) => b.close);
  const series = rsiSeries(closes, 14);
  if (series.length < 30) return null;
  const N = 4;
  // P1253: the RSI series is 14 bars shorter; both slices take the same length so price[i] and rsi[i] are one bar.
  const look = Math.min(Math.min(50, bars.length - 1), series.length, bars.length - 1);
  const cSlice = closes.slice(-look), rSlice = series.slice(-look);
  const pHighs = [], pLows = [], rHighs = [], rLows = [];
  for (let i = N; i < cSlice.length - N; i++) {
    let isPH = true, isPL = true, isRH = true, isRL = true;
    for (let j = i - N; j <= i + N; j++) {
      if (j === i) continue;
      if (cSlice[j] >= cSlice[i]) isPH = false;
      if (cSlice[j] <= cSlice[i]) isPL = false;
      if (rSlice[j] >= rSlice[i]) isRH = false;
      if (rSlice[j] <= rSlice[i]) isRL = false;
    }
    if (isPH) pHighs.push({ idx: i, v: cSlice[i] });
    if (isPL) pLows.push({ idx: i, v: cSlice[i] });
    if (isRH) rHighs.push({ idx: i, v: rSlice[i] });
    if (isRL) rLows.push({ idx: i, v: rSlice[i] });
  }
  const nearest = (arr, idx) => (arr.length ? arr.reduce((b, s) => (Math.abs(s.idx - idx) < Math.abs(b.idx - idx) ? s : b)) : null);
  let bullish = false, bearish = false, hiddenBull = false, hiddenBear = false;
  if (pHighs.length >= 2) {
    const ph1 = pHighs[pHighs.length - 2], ph2 = pHighs[pHighs.length - 1];
    const rh1 = nearest(rHighs, ph1.idx), rh2 = nearest(rHighs, ph2.idx);
    if (rh1 && rh2 && rh1 !== rh2) {
      if (ph2.v > ph1.v && rh2.v < rh1.v) bearish = true;
      if (ph2.v < ph1.v && rh2.v > rh1.v) hiddenBear = true;
    }
  }
  if (pLows.length >= 2) {
    const pl1 = pLows[pLows.length - 2], pl2 = pLows[pLows.length - 1];
    const rl1 = nearest(rLows, pl1.idx), rl2 = nearest(rLows, pl2.idx);
    if (rl1 && rl2 && rl1 !== rl2) {
      if (pl2.v < pl1.v && rl2.v > rl1.v) bullish = true;
      if (pl2.v > pl1.v && rl2.v < rl1.v) hiddenBull = true;
    }
  }
  const signal = bearish ? 'bearish' : bullish ? 'bullish' : hiddenBear ? 'hidden_bearish' : hiddenBull ? 'hidden_bullish' : 'none';
  return { bullish, bearish, hiddenBullish: hiddenBull, hiddenBearish: hiddenBear, signal };
}

const round2 = (v) => Math.round(v * 100) / 100;
const pct1 = (v) => Math.round(v * 1000) / 10;

// v51.69: Fibonacci retracement/extension from the swing high and low of the last 160 bars.
export function fibonacciLevels(bars) {
  if (!bars || bars.length < 60) return null;
  const slice = bars.slice(Math.max(0, bars.length - 160));
  const swH = slice.reduce((m, b) => (b.high > m ? b.high : m), 0);
  const swL = slice.reduce((m, b) => (b.low < m ? b.low : m), Infinity);
  if (swL === Infinity || !(swH > swL)) return null;
  const range = swH - swL;
  const current = bars[bars.length - 1].close;
  const distPct = (price) => (current > 0 ? Math.round((price - current) / current * 1000) / 10 : 0);
  const ret = [0.236, 0.382, 0.5, 0.618, 0.786].map((r) => { const price = round2(swH - range * r); return { ratio: r, label: `R${(r * 100).toFixed(1)}%`, price, distPct: distPct(price), type: 'retracement' }; });
  const ext = [1.0, 1.272, 1.618, 2.618].map((r) => { const price = round2(swL + range * r); return { ratio: r, label: `E${r.toFixed(3)}x`, price, distPct: distPct(price), type: 'extension' }; });
  const all = ret.concat(ext).sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct));
  return {
    swingHigh: round2(swH), swingLow: round2(swL), retracements: ret, extensions: ext,
    nearest: all[0] || null,
    nearestSupport: all.filter((l) => l.distPct < 0).sort((a, b) => b.distPct - a.distPct)[0] || null,
    nearestResistance: all.filter((l) => l.distPct > 0).sort((a, b) => a.distPct - b.distPct)[0] || null
  };
}

// v51.69: volume profile over the last 160 bars in 24 bins — point of control and the 70% value area.
export function volumeProfile(bars) {
  if (!bars || bars.length < 30) return null;
  const BINS = 24, LOOK = 160;
  const rows = bars.slice(Math.max(0, bars.length - LOOK)).filter((b) => b.high > 0 && b.low > 0 && b.close > 0);
  if (rows.length < 20) return null;
  const minP = rows.reduce((m, b) => (b.low < m ? b.low : m), Infinity);
  const maxP = rows.reduce((m, b) => (b.high > m ? b.high : m), 0);
  const span = maxP - minP;
  if (!(span > 0)) return null;
  const step = span / BINS;
  const bins = Array.from({ length: BINS }, (_, bi) => ({ lo: minP + step * bi, hi: minP + step * (bi + 1), mid: minP + step * (bi + 0.5), vol: 0 }));
  rows.forEach((b) => {
    const price = (b.high + b.low + b.close) / 3;
    bins[Math.max(0, Math.min(BINS - 1, Math.floor((price - minP) / step)))].vol += b.volume || 1;
  });
  const totalVol = bins.reduce((s, b) => s + b.vol, 0) || 1;
  const sorted = bins.slice().sort((a, b) => b.vol - a.vol);
  const poc = sorted[0];
  let vaVol = 0;
  const vaBins = [];
  for (let vi = 0; vi < sorted.length && vaVol / totalVol < 0.70; vi++) { vaBins.push(sorted[vi]); vaVol += sorted[vi].vol; }
  const vaLo = vaBins.reduce((m, b) => (b.lo < m ? b.lo : m), Infinity);
  const vaHi = vaBins.reduce((m, b) => (b.hi > m ? b.hi : m), 0);
  const current = bars[bars.length - 1].close;
  const topZones = sorted.slice(0, 8).sort((a, b) => a.mid - b.mid);
  const sup = topZones.filter((z) => z.hi <= current * 0.998).sort((a, b) => b.mid - a.mid);
  const res = topZones.filter((z) => z.lo >= current * 1.002).sort((a, b) => a.mid - b.mid);
  const zone = (z) => (z ? { mid: round2(z.mid), volShare: pct1(z.vol / totalVol), distPct: Math.round((z.mid - current) / current * 1000) / 10 } : null);
  return {
    poc: poc ? { lo: round2(poc.lo), hi: round2(poc.hi), mid: round2(poc.mid), volShare: pct1(poc.vol / totalVol) } : null,
    valueArea: { lo: round2(vaLo), hi: round2(vaHi) },
    insideVA: current >= vaLo && current <= vaHi,
    nearestSupport: zone(sup[0]),
    nearestResistance: zone(res[0])
  };
}

// v51.69 → v51.88 P577/R267: daily bars grouped in fives from the newest bar back, so the last week always holds the
// latest session; a partial oldest chunk is dropped once four weeks exist.
export function weeklyContext(bars) {
  if (!bars || bars.length < 10) return null;
  const WEEK = 5;
  const weekBars = [];
  for (let end = bars.length; end > 0; end -= WEEK) {
    const slice = bars.slice(Math.max(0, end - WEEK), end);
    if (!slice.length) continue;
    const wHigh = slice.reduce((m, b) => (b.high > m ? b.high : m), 0);
    const wLow = slice.reduce((m, b) => (b.low < m ? b.low : m), Infinity);
    const wVol = slice.reduce((s, b) => s + b.volume, 0);
    const lastBar = slice[slice.length - 1];
    weekBars.unshift({ time: lastBar.time, open: slice[0].open, high: wHigh, low: wLow === Infinity ? lastBar.close : wLow, close: lastBar.close, volume: wVol, _n: slice.length });
  }
  if (weekBars.length > 4 && weekBars[0]._n < WEEK) weekBars.shift();
  if (weekBars.length < 4) return null;
  const wCloses = weekBars.map((b) => b.close);
  const wSma20 = wCloses.length >= 20 ? sma(wCloses, 20) : null; // P2262: no shorter stand-in
  const wSma50 = wCloses.length >= 50 ? sma(wCloses, 50) : null;
  const wRsi = rsiLast(wCloses, 14);
  const lastW = weekBars[weekBars.length - 1];
  const prevW = weekBars[weekBars.length - 2] || lastW;
  return {
    bars: weekBars.length, lastWeekClose: lastW.close, wClose: lastW.close, prevWeekClose: prevW.close,
    weekGainPct: prevW.close > 0 ? Math.round((lastW.close - prevW.close) / prevW.close * 1000) / 10 : null,
    wSma20, wSma50, wRsi, wRsi14: wRsi,
    aboveW20: wSma20 ? lastW.close >= wSma20 : null,
    aboveW50: wSma50 ? lastW.close >= wSma50 : null,
    wTrend: wSma20 && wSma50 ? (wSma20 > wSma50 ? 'bullish' : 'bearish') : null
  };
}

// v52.16 P5l/P619: the producer's _retPct(closes, n) — the n-bar return in percent.
function retPct(closes, n) {
  if (!Array.isArray(closes) || closes.length <= n) return null;
  const a = closes[closes.length - 1 - n], b = closes[closes.length - 1];
  return a > 0 ? Math.round((b / a - 1) * 100 * 100) / 100 : null;
}

/** The legacy calcTechnicalSnapshot result shape (the portfolio technical risk and js/aio-tests.js read it). */
export function technicalSnapshot(ohlcv) {
  const bars = cleanOhlcv(ohlcv);
  if (bars.length < 20) return { ok: false, reason: 'insufficient_ohlcv', bars: bars.length };
  const closes = bars.map((d) => d.close), highs = bars.map((d) => d.high), lows = bars.map((d) => d.low), volumes = bars.map((d) => d.volume);
  const last = bars[bars.length - 1], prev = bars[bars.length - 2] || last;
  const atr14 = atr(bars, 14);
  const sma5 = sma(closes, 5), sma10 = sma(closes, 10), sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma100 = sma(closes, 100), sma200 = sma(closes, 200);
  const ema10 = ema(closes, 10), ema21 = ema(closes, 21);
  const rsi14 = rsiLast(closes, 14);
  const macd12 = macd(closes, 12, 26, 9);
  const bb20 = bollinger(closes, 20, 2);
  const prevBB20 = closes.length > 20 ? bollinger(closes.slice(0, -1), 20, 2) : null;
  const dayGainPct = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const candle = candleMetrics(last, prev);
  const adr20Pct = adrPercent(bars, 20);
  const safeAtr = atr14 && atr14 > 0 ? atr14 : null;
  const distAtr = (line) => (safeAtr && line ? (last.close - line) / safeAtr : null);
  const dist20Atr = distAtr(sma20), dist50Atr = distAtr(sma50), dist21Atr = distAtr(ema21), dist10Atr = distAtr(ema10);
  const dist20Pct = sma20 ? ((last.close - sma20) / sma20) * 100 : null;
  const dist20Adr = adr20Pct && dist20Pct !== null ? dist20Pct / adr20Pct : null;
  const bbReentry = !!(prevBB20 && bb20 && prev.close > prevBB20.upper && last.close <= bb20.upper);
  const sma50Prior = closes.length >= 55 ? sma(closes.slice(0, -5), 50) : null;
  const maStructure = classifyMovingAverageStructure({ sma5, sma10, sma20, sma50, sma100, sma200, sma50Prior, lastClose: last.close });
  const rvol20 = relativeVolume(volumes, 20);
  const vcp = bars.length >= 60 ? vcpOf(bars) : { ok: false, vcpScore: 0, vcpStage: 'insufficient_data' };
  const prior20High = highs.length > 1 ? recentLevel(highs.slice(0, -1), 20, Math.max) : null;
  const failedRetest = !!(prior20High && last.close >= prior20High * 0.99 && last.close < prior20High && last.close < prev.close && rvol20 !== null && rvol20 >= 1.2);
  const fib = bars.length >= 60 ? fibonacciLevels(bars) : null;
  const volProfile = bars.length >= 30 ? volumeProfile(bars) : null;
  const rsiDiv = bars.length >= 60 ? rsiDivergence(bars) : null;
  const weeklyCtx = bars.length >= 10 ? weeklyContext(bars) : null;
  return {
    ok: true, bars: bars.length, time: last.time, price: last.close, prevClose: prev.close, dayGainPct,
    closePosition: closePosition(last), upperWickPct: candle.upperWickPct, lowerWickPct: candle.lowerWickPct, bodyPct: candle.bodyPct, gapUpPct: candle.gapUpPct,
    atr14, adr20Pct, rsi14, ret3m: retPct(closes, 63), macd: macd12, bb20, rvol20, failedRetest,
    sma5, sma10, sma20, sma50, sma100, sma200, ema10, ema21,
    dist10Atr, dist20Atr, dist21Atr, dist50Atr,
    dist10ATR: dist10Atr, dist20ATR: dist20Atr, dist21ATR: dist21Atr, dist50ATR: dist50Atr,
    dist20Pct, dist20Adr, dist20ADR: dist20Adr,
    dist50Pct: sma50 ? ((last.close - sma50) / sma50) * 100 : null,
    dist200Pct: sma200 ? ((last.close - sma200) / sma200) * 100 : null,
    dist21Pct: ema21 ? ((last.close - ema21) / ema21) * 100 : null,
    above10EMA: ema10 ? last.close >= ema10 : null, above21EMA: ema21 ? last.close >= ema21 : null,
    above50SMA: sma50 ? last.close >= sma50 : null, above200SMA: sma200 ? last.close >= sma200 : null,
    bbOutsideUpper: !!(bb20 && last.close > bb20.upper), bbReentry,
    recentHigh20: recentLevel(highs, 20, Math.max), recentLow20: recentLevel(lows, 20, Math.min),
    recentHigh50: recentLevel(highs, 50, Math.max), recentLow50: recentLevel(lows, 50, Math.min),
    prevLow: prev.low, prevHigh: prev.high,
    shortMAState: maStructure.shortMAState, longMAState: maStructure.longMAState, fullMAState: maStructure.fullMAState,
    sma50Rising: maStructure.sma50Rising, trendState: maStructure.trendState, stageEstimate: maStructure.stageEstimate,
    vcp, vcpScore: vcp.vcpScore, vcpStage: vcp.vcpStage, vcpPivot: vcp.pivotLevel || null,
    fib, fibNearest: fib && fib.nearest ? fib.nearest : null,
    volProfile, poc: volProfile && volProfile.poc ? volProfile.poc.mid : null,
    rsiDiv, rsiDivSignal: rsiDiv ? rsiDiv.signal : 'none',
    weeklyCtx, wTrend: weeklyCtx ? weeklyCtx.wTrend : null,
    lastBar: last, prevBar: prev, raw: bars
  };
}

/** Distance above the 20/21/50 lines in ATR and ADR units, as one 0–100 extension reading (the legacy calcExtensionHeat). */
export function extensionHeat(snapshot) {
  snapshot = snapshot || {};
  if (!snapshot.ok) return { state: 'DATA_INSUFFICIENT', score: 0, flags: ['DATA_INSUFFICIENT'], snapshot };
  let score = 0;
  const flags = [];
  const add = (points, flag) => { score += points; flags.push(flag); };
  const d20 = snapshot.dist20Atr, d50 = snapshot.dist50Atr, d21 = snapshot.dist21Atr, adr = snapshot.dist20Adr;
  if (d20 !== null && d20 >= 3) add(18, '20MA_PLUS_3ATR_WARNING');
  if (d20 !== null && d20 >= 4) add(18, '20MA_PLUS_4ATR_TRIM_ZONE');
  if (d20 !== null && d20 >= 6) add(24, '20MA_PLUS_6ATR_BLOWOFF_RISK');
  if (adr !== null && adr >= 4) add(12, '20MA_PLUS_4ADR_EXTENDED');
  if (adr !== null && adr >= 6) add(16, '20MA_PLUS_6ADR_EXTREME');
  if (d21 !== null && d21 >= 2.5) add(10, '21EMA_PLUS_2_5ATR_SHORT_EXTENSION');
  if (d50 !== null && d50 >= 6) add(12, '50SMA_PLUS_6ATR_MANIA_CONTEXT');
  score = Math.max(0, Math.min(100, Math.round(score)));
  const state = score >= 75 ? 'BLOW_OFF_RISK' : score >= 50 ? 'EXTREME_EXTENSION' : score >= 25 ? 'EXTENDED' : 'NORMAL';
  return { state, score, flags: flags.length ? flags : ['EXTENSION_NORMAL'], snapshot, dist20Atr: d20, dist20Adr: adr, dist50Atr: d50 };
}
