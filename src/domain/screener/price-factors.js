// v57.81: the producer's per-symbol price-factor math, moved here from scripts/lib/factors.mjs so the browser can
// compute an out-of-universe symbol's factors with the same functions (scripts/lib/factors.mjs imports and re-exports
// them; scripts/fetch-data.mjs re-exports from there). Pure functions over arrays; no I/O.
import { FACTOR_FRESHNESS_MS } from './factor-ranks.js';
import { RULES } from '../rules/thresholds.js';
// v57.84: the 52-week range, ADR, moving averages and EMAs are technical/definitions.js — the chart's own definitions.
import { smaLast, emaLast, adrPctOf, rangeExtremesOf, detectContractions } from '../technical/definitions.js';
import { listingMarketOfSymbol, sessionDateInMarket, timeZoneForMarket, timeZoneForSymbol } from '../market/session-time.js';
export const round = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
const BACKTEST_MIN_LIQUIDITY_OBSERVATIONS = 10;
export const _mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function _retPct(closes, n) {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n], b = closes[closes.length - 1];
  return (a > 0) ? round((b / a - 1) * 100, 2) : null;
}
function _annVol(closes, n) {
  if (closes.length < n + 1) return null;
  const seg = closes.slice(-(n + 1));
  const rets = [];
  for (let i = 1; i < seg.length; i++) if (seg[i - 1] > 0) rets.push(seg[i] / seg[i - 1] - 1);
  const mu = _mean(rets);
  if (mu == null || rets.length < 2) return null;
  const v = rets.reduce((s, r) => s + (r - mu) * (r - mu), 0) / (rets.length - 1);
  return round(Math.sqrt(v) * Math.sqrt(252) * 100, 2);   // 연율화 %
}
// v51.91 P584/R265/C1: switched from Cutler's RSI (simple average over only the last 14 bars,
// recomputed fresh each call) to Wilder's RSI (initial 14-bar average, then recursively smoothed
// over the full input history) — matching js/aio-core.js:_calcRSILast exactly. The two methods
// carried the same "RSI(14)" label but produced different numbers whenever there was a meaningful
// gain/loss regime earlier in the series, so screener.json's rsi and the client's own RSI display
// could diverge by several points. Wilder's method is what TradingView/TA-Lib/most brokers mean by
// "RSI" by default — the named-methodology-parity requirement from R265. Verified by extraction:
// scripts/ci-data-pipeline-contract-check.mjs runs both implementations against identical synthetic
// closes and asserts the outputs match within tolerance.
function _rsi14(closes) {
  const period = 14;
  const nums = closes.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  if (nums.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = nums[i] - nums[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let j = period + 1; j < nums.length; j++) {
    const diff = nums[j] - nums[j - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - (100 / (1 + rs)), 1);
}
// v51.32: 칼만 추세 필터 — 숨겨진 가격 레벨과 추세 속도(velocity)를 재귀 추정.
// 노이즈 측정에서 실제 추세 속도를 분리 (Rolling OLS보다 연속적이고 안정적).
// state=[level, velocity], F=[[1,1],[0,1]], H=[1,0], Q=diag(Ql,Qv), R=obs noise.
function _kalmanTrend(closes, vol) {
  if (!Array.isArray(closes) || closes.length < 10) return null;
  const series = closes
    .map(v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.log(v) : null)
    .filter(v => v !== null);
  if (series.length < 10) return null;
  const Ql = 1e-4, Qv = 1e-5;
  // R = daily observation noise. Use asset's own daily variance when available so
  // high-vol stocks (VIX 70+) don't over-trust the signal and low-vol names don't lag.
  const dailyVol = (typeof vol === 'number' && vol > 0) ? (vol / 100) / Math.sqrt(252) : null;
  const R = dailyVol ? Math.max(1e-4, dailyVol * dailyVol) : 1e-2;
  // 초기 속도: 첫 5일 선형 기울기로 시드 (s1=0 시작 시 20~30일 수렴 지연 제거)
  const initN = Math.min(5, series.length - 1);
  const s1Init = initN > 0 ? (series[initN] - series[0]) / initN : 0;
  let s0 = series[0], s1 = s1Init;
  let p00 = 1, p01 = 0, p10 = 0, p11 = 1;
  let lastE = 0, lastS = R;
  for (let i = 0; i < series.length; i++) {
    const y = series[i];
    const ps0 = s0 + s1, ps1 = s1;
    const pp00 = p00 + p01 + p10 + p11 + Ql;
    const pp01 = p01 + p11, pp10 = p10 + p11, pp11 = p11 + Qv;
    const e = y - ps0, S = pp00 + R;
    lastE = e; lastS = S;
    const k0 = pp00 / S, k1 = pp10 / S;
    s0 = ps0 + k0 * e; s1 = ps1 + k1 * e;
    p00 = (1 - k0) * pp00; p01 = (1 - k0) * pp01;
    p10 = -k1 * pp00 + pp10; p11 = -k1 * pp01 + pp11;
  }
  const vel = (Math.expm1(s1) * 100), pt = p00 + p11;
  const innovZ = lastS > 0 ? round(lastE / Math.sqrt(lastS), 4) : null;
  const velConf = round(vel / (1 + Math.sqrt(Math.max(pt, 0))), 6);
  return { vel: round(vel, 6), pt: round(pt, 6), innovZ, velConf, scale: 'log_pct_day' };
}
export function closesToFactors(closes) {
  if (!Array.isArray(closes) || closes.length < 30) return null;
  const price = closes[closes.length - 1];
  const sma50 = closes.length >= 50 ? _mean(closes.slice(-50)) : null;
  const sma200 = closes.length >= 200 ? _mean(closes.slice(-200)) : null;
  const vol60 = _annVol(closes, 60);
  const kalman = _kalmanTrend(closes.slice(-90), vol60);
  return {
    price: round(price, 2),
    // 2026-10-13 (owner: S&P 500 map): one- and five-session returns on the same completed close series, so the
    // sector map can colour a day or a week without republishing raw prices (P715 keeps prices out).
    ret1d: _retPct(closes, 1), ret5d: _retPct(closes, 5),
    ret1m: _retPct(closes, 21), ret3m: _retPct(closes, 63), ret6m: _retPct(closes, 126),
    vol: vol60, rsi: _rsi14(closes),
    pctSma50: (sma50 && sma50 > 0) ? round((price / sma50 - 1) * 100, 2) : null,
    pctSma200: (sma200 && sma200 > 0) ? round((price / sma200 - 1) * 100, 2) : null,
    // 2026-10-14 (owner: custom screener conditions): short averages and the 1-year closing high as distances on the
    // same series, so "5/10/20 정배열" and "52주 신고가" are read without publishing a raw price (P715).
    ...Object.fromEntries([5, 10, 20].map((n) => { const sma = _mean(closes.slice(-n)); return [`pctSma${n}`, sma > 0 ? round((price / sma - 1) * 100, 2) : null]; })),
    // v57.84: a 52-week closing high needs the full 252 sessions (it required 250 while reading a 252 window).
    pctFromCloseHigh52w: closes.length >= RULES.technical.fullYearSessions ? (() => { const high = Math.max(...closes.slice(-RULES.technical.rangeSessions)); return high > 0 ? round((price / high - 1) * 100, 2) : null; })() : null,
    kalmanVel:    kalman ? kalman.vel     : null,
    kalmanPt:     kalman ? kalman.pt      : null,
    kalmanInnovZ: kalman ? kalman.innovZ  : null,
    kalmanVelConf:kalman ? kalman.velConf : null,
    kalmanScale:  kalman ? kalman.scale   : null,
  };
}

// v57.81: sessions back in which a close at or below the pivot makes today's close above it a breakout.
export const VCP_BREAKOUT_LOOKBACK = 5;
// v51.68: VCP (Volatility Contraction Pattern) 서버 사이드 계산 — aio-core.js _calcVCP 대응
export function _calcVCPServer(closes, highs, lows, volumes) {
  const n = closes.length;
  if (n < 60) return null;
  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  const price = closes[n - 1];
  const s50 = smaLast(closes, 50), s150 = smaLast(closes, 150), s200 = smaLast(closes, 200);
  // v57.84: the 52-week high is definitions.rangeExtremesOf — below 252 sessions it is not a 52-week figure, so the gate's
  // "52주 고점 대비" check is unknown and the gate fails closed (it used to read 200 sessions of highs as a year).
  const range = rangeExtremesOf(highs, lows);
  const pct52 = range?.fullYear && range.high > 0 ? (price - range.high) / range.high * 100 : null;
  const stage2 = !!(s50 && s150 && s200 && price > s150 && s150 > s200 && price > s50 && pct52 !== null && pct52 >= -RULES.technical.stage2Gate.nearHighPct);
  // v57.84 (owner decision): contractions and the pivot come from the chart's detector (technical/definitions.js
  // detectContractions) — the 65-bar, 4-bar-swing pairing gave a second pivot for the same stock (the latest swing high in 25
  // bars, valid pattern or not). Bars with a missing high/low are left out, as on the chart. Only a valid contraction run
  // (≥ 2 successively shallower pullbacks, the last ≤ 12%, the first ≤ 40%) sets a pivot.
  const bars = [];
  for (let i = 0; i < n; i++) if (highs[i] > 0 && lows[i] > 0 && highs[i] >= lows[i]) bars.push({ high: highs[i], low: lows[i], close: closes[i] });
  const detected = detectContractions(bars);
  const ctrs = detected.contractions.map((row) => ({ depth: Math.round(row.depth * 10) / 10 }));
  const cnt = ctrs.length;
  const shrink = detected.valid;
  const bLen = Math.min(65, n - 10);
  const bV = volumes.slice(n - bLen);
  let volDry = false;
  if (bV.length >= 20) {
    const half = Math.floor(bV.length / 2);
    const fv = bV.slice(0, half).filter(v => v > 0);
    const sv = bV.slice(half).filter(v => v > 0);
    const fa = avg(fv), sa = avg(sv);
    volDry = fa > 0 && sa > 0 && sa < fa * 0.85;
  }
  const pivot = detected.valid ? detected.pivot : null;
  const nearPivot = !!(pivot && price >= pivot * 0.97 && price <= pivot * 1.03);
  const lv = volumes[n - 1];
  const vs = volumes.slice(-21, -1).filter(v => v > 0);
  const rvol = (vs.length >= 10 && lv > 0) ? lv / avg(vs) : null;
  // v57.81 (analysis audit 2026-10-15): 031980.KQ read "피벗 돌파" on a -12.5% day (rvol 1.65) because a close above the
  // pivot on heavy volume was enough. A breakout is a close through the pivot: some close in the last
  // VCP_BREAKOUT_LOOKBACK sessions was at or below it, and the day closed up (above the prior close, or in the upper half
  // of its range). A close above the pivot on heavy volume that fails the up-day test is 'pivot_down'.
  const candidate = !!(pivot && price > pivot && rvol !== null && rvol > RULES.technical.breakout.volumeMultiple);
  const prevClose = closes[n - 2];
  const dayHigh = highs[n - 1], dayLow = lows[n - 1];
  const upDay = (prevClose > 0 && price > prevClose) || (dayHigh > dayLow && (price - dayLow) / (dayHigh - dayLow) >= 0.5);
  const crossed = closes.slice(-1 - VCP_BREAKOUT_LOOKBACK, -1).some((value) => value <= pivot);
  const brk = candidate && upDay && crossed;
  const pivotDown = candidate && !upDay;
  let score = 0;
  if (stage2)    score += 25;
  if (cnt >= 2)  score += Math.min(20, cnt * 7);
  if (shrink)    score += 20;
  if (volDry)    score += 15;
  if (nearPivot) score += 10;
  if (brk)       score += 10;
  score = Math.min(100, Math.round(score));
  const vcpStage = !stage2 ? 'not_stage2' : brk ? 'breakout' : pivotDown ? 'pivot_down' : nearPivot ? 'near_pivot' : (cnt >= 2 && shrink) ? 'contracting' : cnt >= 1 ? 'basing' : 'stage2_only';
  // 2026-10-14: the latest contraction against the one before it (isShrinking requires every step to shrink).
  const latestShrinking = cnt >= 2 ? detected.contractions[cnt - 1].depth < detected.contractions[cnt - 2].depth : null;
  return { vcpScore: score, vcpStage, pivotLevel: pivot,
           contractionCount: cnt, isShrinking: shrink, latestShrinking, volumeDrying: volDry,
           pctFrom52wHigh: pct52 !== null ? Math.round(pct52 * 10) / 10 : null };
}

// Phase 1: 심볼 배열 → 1y 가격 이력 fetch + 팩터 계산. results 배열은 backtest에 재사용.
// v53.91: materialize the observable pieces of the TradingView "best winners"
// screen. These are evidence fields, not a buy score: missing source series
// stays null and the setup layer fails closed.
// Mean of daily close x volume over the last `window` sessions, the same rule as _historicalLiquidity
// (positive close and volume only, at least min(10, window) usable sessions). `divisors` converts each
// session at its own FX rate (native units per USD); a session without a rate is not counted.
export function dailyNotionalAverage(closes, volumes, { window = 30, divisors = null, minObservations = BACKTEST_MIN_LIQUIDITY_OBSERVATIONS } = {}) {
  const n = Math.min(Array.isArray(closes) ? closes.length : 0, Array.isArray(volumes) ? volumes.length : 0);
  const lookback = Math.max(1, Number(window) || 30);
  const values = [];
  for (let i = Math.max(0, n - lookback); i < n; i += 1) {
    const close = Number(closes[i]);
    const volume = Number(volumes[i]);
    const divisor = divisors ? Number(divisors[i]) : 1;
    if (Number.isFinite(close) && close > 0 && Number.isFinite(volume) && volume > 0 && Number.isFinite(divisor) && divisor > 0) values.push(close * volume / divisor);
  }
  if (!values.length || values.length < Math.min(minObservations, lookback)) return null;
  return { value: _mean(values), observations: values.length, windowSessions: lookback };
}

// FX close on or before a session date (at most `maxLagDays` earlier). `series` is date-sorted [{date, close}].
export function fxRateOnOrBefore(series, date, maxLagDays = 4) {
  if (!Array.isArray(series) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  let found = null;
  for (const point of series) { if (point.date <= date) found = point; else break; }
  if (!found || !(found.close > 0)) return null;
  const lagDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${found.date}T00:00:00Z`)) / 86400000;
  return lagDays <= maxLagDays ? found.close : null;
}

export function _calcSetupScreenFields(closes, adjCloses, highs, lows, volumes) {
  const n = Math.min(closes.length, adjCloses.length, highs.length, lows.length, volumes.length);
  if (n < 1) return null;
  const tail = (arr, p) => arr.slice(Math.max(0, arr.length - p));
  const avg = (arr) => {
    const vals = arr.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const ema = emaLast;
  const price = closes[n - 1];
  // v57.84: definitions.rangeExtremesOf / adrPctOf — the chart's own range and ADR. Below 252 sessions the range is not
  // 52 weeks, so pctFrom52wLow/High stay null instead of naming a shorter record "52주" (P1428).
  const range = rangeExtremesOf(highs.slice(0, n), lows.slice(0, n));
  const low52 = range?.fullYear ? range.low : null;
  const high52 = range?.fullYear ? range.high : null;
  const adrPct = price > 0 ? adrPctOf(highs.slice(0, n), lows.slice(0, n), closes.slice(0, n)) : null;
  const avgVolume30d = avg(tail(volumes, Math.min(30, n)));
  const latestVolume = typeof volumes[n - 1] === 'number' && Number.isFinite(volumes[n - 1]) && volumes[n - 1] > 0
    ? volumes[n - 1] : null;
  return {
    price: typeof price === 'number' && Number.isFinite(price) ? round(price, 4) : null,
    pctFrom52wLow: low52 > 0 ? round((price - low52) / low52 * 100, 1) : null,
    pctFrom52wHigh: high52 > 0 ? round((price - high52) / high52 * 100, 1) : null,
    adrPct: adrPct == null ? null : round(adrPct, 2),
    avgVolume30d: avgVolume30d == null ? null : Math.round(avgVolume30d),
    // 2026-10-13 F21: traded value is the mean of each session's close x volume (the backtest liquidity
    // definition), not today's close times the average volume, which moved the 30-day figure with one print.
    dollarVolume30d: (() => { const notional = dailyNotionalAverage(closes.slice(0, n), volumes.slice(0, n), { window: 30 }); return notional ? Math.round(notional.value) : null; })(),
    lastVolume: latestVolume == null ? null : Math.round(latestVolume),
    // v57.51 F11: 20-session relative volume — the last session's volume over the mean of the 20 sessions before it
    // (the chart's _calcRVOL definition). The '돌파 관찰' preset read this field while no producer wrote it.
    rvol20: (() => {
      if (latestVolume == null || n < 16) return null;
      const base = volumes.slice(Math.max(0, n - 21), n - 1).filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      const mean = base.length >= 15 ? avg(base) : null;
      return mean > 0 ? round(latestVolume / mean, 2) : null;
    })(),
    dollarVolume: price > 0 && latestVolume != null ? Math.round(price * latestVolume) : null,
    ema8: ema(closes, 8),
    ema21: ema(closes, 21),
    ema60: ema(closes, 60),
    // P1255 (07:M04 계열 잔여 D3): setup 비교(예: price > ema60)는 같은 계열 안에서만 성립한다.
    // EMA를 price와 같은 close 계열로 계산하고 기준을 선언한다 — 조정 EMA와 raw 가격을 직접
    // 비교하던 혼합 basis를 제거한다(조정 계열 수익률은 별도 ret* 필드가 소유).
    emaBasis: 'same-close-series-as-price'
  };
}

export function deriveFactorQuality({ observedAt, computedAt } = {}) {
  const observedMs = observedAt ? Date.parse(observedAt) : NaN;
  const computedMs = computedAt ? Date.parse(computedAt) : NaN;
  const ageMs = Number.isFinite(observedMs) && Number.isFinite(computedMs) ? computedMs - observedMs : NaN;
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= FACTOR_FRESHNESS_MS;
  return {
    status: !Number.isFinite(observedMs) ? 'MISSING' : fresh ? 'CURRENT' : 'STALE',
    stale: !fresh,
    ageMs: Number.isFinite(ageMs) ? ageMs : null,
    basis: 'bar-start-to-computedAt',
    decisionUse: false,
    allowedUse: 'reference'
  };
}

// P1399: a daily bar is a completed close only after its session ends. A run during the US
// session (or before the KR close) sees a partial bar for today; breadth built from it was
// stamped 'latest-completed-close' while the index inputs used the previous close.
// 2026-10-13 F07: Tokyo (close 15:30) and Taiwan (close 13:30) listings are judged on their own clock with
// the same 15-minute settlement margin; any other segment keeps the US rule.
const SESSION_CLOSE_RULES = Object.freeze({
  us: { zone: 'America/New_York', closeMinutes: 16 * 60 + 15 },
  kr: { zone: 'Asia/Seoul', closeMinutes: 15 * 60 + 45 },
  jp: { zone: 'Asia/Tokyo', closeMinutes: 15 * 60 + 45 },
  tw: { zone: 'Asia/Taipei', closeMinutes: 13 * 60 + 45 },
});

export function sessionSegmentOfSymbol(sym) {
  const text = String(sym || '').toUpperCase();
  if (/\.(KS|KQ)$/.test(text)) return 'kr';
  if (/\.T$/.test(text) && listingMarketOfSymbol(text) === 'INTL') return 'jp';
  if (/\.TWO?$/.test(text)) return 'tw';
  return 'us';
}

// Quote currency of a listing: the provider's declared currency first; the suffix rule only for US/KR.
// An overseas listing without a declared currency stays unknown rather than defaulting to USD.
export function listingCurrencyOf(sym, providerMeta = null) {
  const declared = String(providerMeta?.currency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(declared)) return declared;
  const market = listingMarketOfSymbol(sym);
  return market === 'KR' ? 'KRW' : market === 'US' ? 'USD' : null;
}

export function isSessionComplete(date, segment, nowMs = Date.now()) {
  const rule = SESSION_CLOSE_RULES[segment] || SESSION_CLOSE_RULES.us;
  const zone = rule.zone;
  const closeMinutes = rule.closeMinutes;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(nowMs)).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (date !== today) return date < today;
  return Number(parts.hour) * 60 + Number(parts.minute) >= closeMinutes;
}

// The provider's 1y daily chart (one chart.result entry) as dated rows, exactly as the producer's fetchHistory builds
// them: raw OHLC/volume, adjusted close kept separate, a missing value stays null, an empty close is a gap date.
export function dailyRowsFromYahooChart(res, { fetchedAt = new Date().toISOString() } = {}) {
  const ts = res?.timestamp;
  const q0 = res?.indicators?.quote?.[0];
  const closes = q0?.close;
  const adjArr = res?.indicators?.adjclose?.[0]?.adjclose;
  if (!Array.isArray(ts) || !Array.isArray(closes)) return Object.assign([], { nullCloseDates: [], meta: null });
  const out = [];
  // P1683: a session the provider lists with an empty close (KRX 2026-10-12 on Yahoo) is a gap, not a
  // non-session — remember its date so short-window returns across it are not labelled one session.
  out.nullCloseDates = [];
  // 2026-10-13 F07: the listing's own currency and exchange zone travel with the series so a Tokyo or
  // Taipei row is never published as USD on a New York session date.
  out.meta = { currency: res.meta?.currency || null, exchangeTimezoneName: res.meta?.exchangeTimezoneName || null, symbol: res.meta?.symbol || null };
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== 'number' || !isFinite(c)) { if (Number.isFinite(ts[i])) out.nullCloseDates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10)); continue; }
    const h = q0.high?.[i], l = q0.low?.[i], v = q0.volume?.[i];
    const a = Array.isArray(adjArr) ? adjArr[i] : undefined;
    out.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      observedAt: new Date(ts[i] * 1000).toISOString(),
      instrumentId: res.meta?.symbol || null,
      timeframe: res.meta?.dataGranularity || null,
      currency: res.meta?.currency || null,
       close: round(c, 2),
      // Missing adjusted-close evidence stays missing. A raw-close fallback
      // would silently turn a total-return backtest into a price-only test.
      adjClose: (typeof a === 'number' && isFinite(a) && a > 0) ? round(a, 2) : null,
       // Missing OHLC bars are unknown.  Falling back to close creates a
       // fabricated zero-range bar and can make ADR/VCP look complete.
       high:   typeof h === 'number' && isFinite(h) ? round(h, 2)    : null,
       low:    typeof l === 'number' && isFinite(l) ? round(l, 2)    : null,
       // Missing volume is unknown, not zero.  Zero is a real observation
       // for some instruments and would otherwise corrupt VCP/liquidity
       // factors while making a partial provider response look complete.
       volume: typeof v === 'number' && isFinite(v) ? Math.round(v)  : null,
       fetchedAt,
     });
  }
  return out;
}

// Only completed sessions enter any factor (P1442); the parallel arrays the factor row reads.
export function priceHistoryFromRows(sym, fetched, { providerMeta = null, nullCloseDates: providerNullCloseDates = [], closeReconciliation = null, market = sessionSegmentOfSymbol(sym), nowMs = Date.now() } = {}) {
  const rows = (fetched || []).filter((row) => !row?.date || isSessionComplete(row.date, market, nowMs));
  const partialSessionDropped = (fetched || []).length - rows.length;
  const nullCloseDates = (providerNullCloseDates || []).filter((date) => isSessionComplete(date, market, nowMs));
  if (closeReconciliation) {
    closeReconciliation.providerMissingSessions = nullCloseDates;
    closeReconciliation.filledDates = closeReconciliation.filledDates.filter((date) => isSessionComplete(date, market, nowMs));
    closeReconciliation.filledSessions = closeReconciliation.filledDates.length;
  }
  return {
    sym,
    partialSessionDropped,
    providerMeta,
    closeReconciliation,
    nullCloseDates,
    dates:     (rows || []).map(r => r.date),
    observedAts:(rows || []).map(r => r.observedAt || null),
    closes:    (rows || []).map(r => r.close),
    // Keep adjusted closes separate from raw OHLC. Return/factor/backtest
    // consumers must opt into this series explicitly; a missing adjusted value
    // remains null instead of silently becoming a raw close.
    adjCloses: (rows || []).map(r => (typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) ? r.adjClose : null)),
    highs:     (rows || []).map(r => (typeof r.high === 'number' && Number.isFinite(r.high) ? r.high : null)),
    lows:      (rows || []).map(r => (typeof r.low === 'number' && Number.isFinite(r.low) ? r.low : null)),
    // Preserve unknown volume as null; downstream factor helpers ignore
    // incomplete volume windows instead of treating missing data as zero.
    volumes:   (rows || []).map(r => (typeof r.volume === 'number' && Number.isFinite(r.volume) ? r.volume : null)),
    observedAt:(rows && rows.length && rows[rows.length - 1].observedAt) || null,
    adjustedCloseStatus: (rows || []).length > 0 && (rows || []).every(r => typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) && r.adjClose > 0)
      ? 'complete'
      : (rows || []).some(r => typeof r.adjClose === 'number' && Number.isFinite(r.adjClose) && r.adjClose > 0) ? 'partial' : 'unavailable',
  };
}

// One symbol's published price-factor row from its completed-session history (the producer's per-result block).
export function priceFactorRow(r, { computedAt = new Date().toISOString(), fxSeries = new Map() } = {}) {
  if (!r || r.__error || !r.closes) return null;
  const quoteCurrencyOf = (item) => listingCurrencyOf(item?.sym, item?.providerMeta);
  const hasCompleteAdjusted = r.adjustedCloseStatus === 'complete'
    && r.adjCloses && r.adjCloses.length === r.closes.length
    && r.adjCloses.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
  // The screener may still expose a raw-price technical snapshot when the
  // provider omits adjusted closes, but it is explicitly partial and never
  // enters the adjusted-close backtest below.
  const factorPriceSeries = hasCompleteAdjusted ? r.adjCloses : r.closes;
  const f = closesToFactors(factorPriceSeries);
  if (!f) return null;
  {
    // P1683: a completed session with an empty provider close inside the 1- or 5-session window makes that
    // return span an extra session — publish null (the map greys it) instead of a mislabelled move.
    const gaps = Array.isArray(r.nullCloseDates) ? r.nullCloseDates : [];
    const dates = Array.isArray(r.dates) ? r.dates : [];
    const gapInside = (n) => dates.length > n && gaps.some((date) => date > dates[dates.length - 1 - n] && date < dates[dates.length - 1]);
    if (gapInside(1)) f.ret1d = null;
    if (gapInside(5)) f.ret5d = null;
    // v51.68: VCP 패턴 인식 — OHLCV 60봉 이상일 때 계산 (raw close, 조정종가 아님 — 위 주석 참조)
    if (r.closes.length >= 60 && r.highs && r.lows && r.volumes) {
      const vcp = _calcVCPServer(r.closes, r.highs, r.lows, r.volumes);
      if (vcp) { f.vcpScore = vcp.vcpScore; f.vcpStage = vcp.vcpStage; f.vcpPivot = vcp.pivotLevel; f.vcpContractions = vcp.contractionCount; f.vcpShrinking = vcp.latestShrinking; }
    }
    const setupFields = _calcSetupScreenFields(
      r.closes,
      hasCompleteAdjusted ? r.adjCloses : r.closes,
      r.highs || [], r.lows || [], r.volumes || []
    );
    if (setupFields) Object.assign(f, setupFields);
    // Yahoo's KR suffix is part of the upstream instrument identifier. Persist
    // the quote currency with the derived price/liquidity fields so consumers
    // never have to infer that a numeric amount is USD.
    f.currency = quoteCurrencyOf(r);
    f.listingMarket = listingMarketOfSymbol(r.sym);
    f.dollarVolumeCurrency = f.currency;
    const nativeNotional = dailyNotionalAverage(r.closes, r.volumes, { window: 30 });
    f.tradedValue30d = nativeNotional ? Math.round(nativeNotional.value) : null;
    f.tradedValueCurrency = f.currency;
    f.tradedValueBasis = 'mean-session-close-x-volume-30-sessions';
    if (f.currency && f.currency !== 'USD') {
      const fx = fxSeries.get(f.currency) || null;
      const divisors = fx ? (r.dates || []).map((date) => fxRateOnOrBefore(fx, date)) : null;
      const lastDivisor = divisors && divisors.length ? divisors[divisors.length - 1] : null;
      if (divisors && lastDivisor > 0) {
        const usd = dailyNotionalAverage(r.closes, r.volumes, { window: 30, divisors });
        f.dollarVolume30d = usd ? Math.round(usd.value) : null;
        f.dollarVolume = f.dollarVolume != null ? Math.round(f.dollarVolume / lastDivisor) : null;
        f.dollarVolumeCurrency = 'USD';
        f.dollarVolumeFx = { symbol: `${f.currency}=X`, quote: `${f.currency} per USD`, basis: 'daily-close-on-or-before-session-date', maxLagDays: 4 };
      } else {
        // No rate: the native figure stays in tradedValue30d; the USD fields are not published.
        f.dollarVolume30d = null;
        f.dollarVolume = null;
      }
    }
    f.priceBasis = hasCompleteAdjusted ? 'adjusted-close' : 'raw-close-partial-no-adjusted-series';
    f.adjustedCloseStatus = r.adjustedCloseStatus;
    f.backtestEligible = hasCompleteAdjusted;
    f.observedAt = r.observedAt;
    f.source = hasCompleteAdjusted
      ? 'Yahoo chart 1y adjusted-close history'
      : 'Yahoo chart 1y raw-close history (adjusted-close unavailable)';
    f.sourceKind = 'T3_PUBLIC_DELAYED';
    f.allowedUse = 'research-relative-ranking-only';
    f.allowedUseCeiling = 'reference';
    f.rightsId = 'PUBLIC_REFERENCE';
    f.factorObservedAt = r.observedAt;
    // P1170 (15 D04): barStart와 그 세션 날짜를 분리해 남긴다. factorObservedAt은 호환 필드로
    // 유지하되 'bar-start' basis를 함께 발행해 관측시각으로 읽히지 않게 한다.
    f.factorBarStart = r.observedAt;
    // F07: the session date is read in the listing's exchange zone (provider zone first, suffix map second).
    const sessionZone = timeZoneForMarket(r.providerMeta?.exchangeTimezoneName || timeZoneForSymbol(r.sym));
    f.factorSessionDate = sessionDateInMarket(r.observedAt, sessionZone);
    f.factorSessionTimezone = sessionZone;
    if (r.closeReconciliation) f.closeReconciliation = r.closeReconciliation;
    else if (Array.isArray(r.nullCloseDates) && r.nullCloseDates.length) f.providerMissingSessions = r.nullCloseDates;
    f.factorTimeBasis = 'bar-start';
    f.factorComputedAt = computedAt;
    f.factorSourceKind = 'T3_PUBLIC_DELAYED';
    f.factorAllowedUse = 'research-relative-ranking-only';
    f.factorQuality = deriveFactorQuality({ observedAt: r.observedAt, computedAt });
    f.factorBarCompleteness = 'completed-sessions-only';
    if (r.partialSessionDropped) f.partialSessionDropped = r.partialSessionDropped;
  }
  return f;
}
