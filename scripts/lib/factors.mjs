// Price-factor, factor-backtest and VCP/setup-screen math split out of scripts/fetch-data.mjs (v57.62).
// Pure functions over arrays: unit-testable without importing the producer. fetch-data.mjs imports and
// re-exports them, so existing importers (backtest-factors-longrun, data gates) keep working unchanged.
import { percentileRank01, spearman } from './rank-statistics.mjs';
import { round } from './producer-math.mjs';
import { computeFactorRanks } from '../../src/domain/screener/factor-ranks.js';
import { MODEL_DEFAULT_WEIGHTS } from '../../src/domain/screener/factor-weights.js';
import { buildScreenerModelFingerprint } from '../../src/domain/screener/model-fingerprint.js';

const BACKTEST_DEFAULT_TRANSACTION_COST_BPS = 20;
const BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS = 20;
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

// Historical liquidity is an observation, not a tradability guarantee. Keep the
// native quote currency and the number of usable bars so a cross-sectional
// backtest cannot silently compare KRW notionals with USD notionals or treat a
// sparse volume series as liquid. Execution impact/borrow/spread are deliberately
// outside this helper; the backtest reports the coverage and applies only its
// explicitly-labelled transaction-cost scenario.
function _historicalLiquidity(stock, endIndex, window) {
  const closes = Array.isArray(stock?.closes) ? stock.closes : [];
  const volumes = Array.isArray(stock?.volumes) ? stock.volumes : [];
  if (closes.length !== volumes.length || !Number.isInteger(endIndex) || endIndex < 0) return null;
  const lookback = Math.max(1, Number(window) || BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS);
  const start = Math.max(0, endIndex - lookback + 1);
  const values = [];
  for (let index = start; index <= endIndex; index += 1) {
    const close = Number(closes[index]);
    const volume = Number(volumes[index]);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(volume) && volume > 0) values.push(close * volume);
  }
  if (values.length < Math.min(BACKTEST_MIN_LIQUIDITY_OBSERVATIONS, lookback)) return null;
  return {
    averageNotional: _mean(values),
    observationCount: values.length,
    windowDays: lookback,
    currency: stock?.currency || (/\.(KS|KQ)$/i.test(String(stock?.sym || '')) ? 'KRW' : 'USD')
  };
}

function _normaliseBacktestDate(value) {
  const date = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function _hasCompleteAdjustedSeries(stock, dateCount) {
  const adjusted = Array.isArray(stock?.adjCloses) ? stock.adjCloses : null;
  const expected = Number.isInteger(dateCount) && dateCount > 0 ? dateCount : null;
  if (!adjusted || (expected != null && adjusted.length !== expected) || !adjusted.length) return false;
  return adjusted.every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
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
    pctFromCloseHigh52w: closes.length >= 250 ? (() => { const high = Math.max(...closes.slice(-252)); return high > 0 ? round((price / high - 1) * 100, 2) : null; })() : null,
    kalmanVel:    kalman ? kalman.vel     : null,
    kalmanPt:     kalman ? kalman.pt      : null,
    kalmanInnovZ: kalman ? kalman.innovZ  : null,
    kalmanVelConf:kalman ? kalman.velConf : null,
    kalmanScale:  kalman ? kalman.scale   : null,
  };
}

// v50.53 2B: 서버 팩터 백테스트 — 수집한 1년 일별 종가로 횡단면(cross-sectional) 검증.
//   끝(today)에서 N일 전 리밸 시점마다 전 종목을 팩터로 랭크 → forward 21일 수익률과의 Spearman IC,
//   종합 랭크 상-하위 분위 스프레드, 방향 적중률. 누적 대기 불요(enrich 시점 1패스 계산).
function _spearman(xs, ys) {
  return spearman(xs, ys);
}
// v52.50/WO-3: opts.offsets/opts.fwdDays는 선택적 override — 생략 시 기존 6개월 프로덕션
// 리밸런스 세트+21일 forward 그대로(호출부 무변화, 하위호환). scripts/backtest-factors-longrun.mjs가
// 수년치 데이터로 훨씬 많은 리밸런스 시점을 넘겨 이 동일 포뮬러를 재사용한다(로직 복제 방지).
export function backtestFactors(stockData, opts) {
  opts = opts || {};
  var OFFSETS = opts.offsets || [147, 126, 105, 84, 63, 42], FWD = opts.fwdDays || 21;     // 끝에서 N일 전 리밸 시점들
  var isNum = function(v){ return typeof v === 'number' && isFinite(v); };
  var transactionCostBps = isNum(Number(opts.transactionCostBps))
    ? Math.max(0, Number(opts.transactionCostBps))
    : BACKTEST_DEFAULT_TRANSACTION_COST_BPS;
  var liquidityWindowDays = Math.max(1, Number(opts.liquidityWindowDays) || BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS);
  var universeMeta = opts.universeMeta && typeof opts.universeMeta === 'object' ? opts.universeMeta : {};
  var rawStocks = Array.isArray(stockData) ? stockData.filter(function(s){ return s && typeof s === 'object'; }) : [];
  // A tail offset is not a market date. Different IPO histories, missing bars,
  // and exchange holidays otherwise put different real dates into one
  // cross-section. Keep only rows with a strictly increasing, date-aligned
  // series and derive the rebalance calendar from their date intersection.
  var datedStocks = [], excludedWithoutDates = 0;
  rawStocks.forEach(function(stock) {
    var rawDates = Array.isArray(stock.dates) ? stock.dates : null;
    var dates = rawDates ? rawDates.map(_normaliseBacktestDate) : null;
    var closes = Array.isArray(stock.closes) ? stock.closes : null;
    // Adjusted-close coverage is tracked separately below. A stock with a
    // valid date/price calendar but missing corporate-action data belongs in
    // the date-aligned universe and must be reported as adjusted-data
    // excluded, not misclassified as a missing-calendar row.
    var valid = !!(dates && dates.length && closes && dates.length === closes.length);
    if (valid) {
      for (var di = 0; di < dates.length; di++) {
        if (!dates[di] || (di > 0 && dates[di] <= dates[di - 1])) { valid = false; break; }
      }
    }
    if (!valid) { excludedWithoutDates++; return; }
    var dateIndex = new Map();
    dates.forEach(function(date, index){ dateIndex.set(date, index); });
    datedStocks.push({ stock: stock, dates: dates, dateIndex: dateIndex });
  });
  var dateAlignmentMode = !rawStocks.length || excludedWithoutDates === 0 ? 'aligned'
    : datedStocks.length ? 'minimum-coverage' : 'blocked';
  var commonDateSet = null;
  datedStocks.forEach(function(record) {
    var ownDates = new Set(record.dates);
    if (commonDateSet == null) commonDateSet = ownDates;
    else commonDateSet = new Set(Array.from(commonDateSet).filter(function(date){ return ownDates.has(date); }));
  });
  var commonDates = commonDateSet ? Array.from(commonDateSet).sort() : [];
  // The strict all-symbol intersection is retained as a diagnostic only. It
  // can collapse the sample when one symbol misses a holiday/bar. Rebalance
  // on observed market dates that meet a declared minimum symbol coverage,
  // and require each symbol to have both the exact rebalance and target date.
  var minDateCoverage = isNum(Number(opts.minDateCoverage))
    ? Math.max(0, Math.min(1, Number(opts.minDateCoverage))) : 0.8;
  var dateCounts = new Map();
  datedStocks.forEach(function(record) {
    record.dates.forEach(function(date) { dateCounts.set(date, (dateCounts.get(date) || 0) + 1); });
  });
  var suppliedCalendarDates = Array.isArray(opts.calendarDates)
    ? opts.calendarDates.map(_normaliseBacktestDate).filter(Boolean)
    : null;
  var calendarDates = suppliedCalendarDates && suppliedCalendarDates.length
    ? Array.from(new Set(suppliedCalendarDates)).sort()
    : Array.from(dateCounts.entries())
      .filter(function(entry) { return datedStocks.length > 0 && entry[1] / datedStocks.length >= minDateCoverage; })
      .map(function(entry) { return entry[0]; })
      .sort();
  var calendarDateSet = new Set(calendarDates);
  var calendarIndex = new Map(calendarDates.map(function(date, index) { return [date, index]; }));
  var requestedRebalanceDates = Array.isArray(opts.rebalanceDates)
    ? opts.rebalanceDates.map(_normaliseBacktestDate).filter(Boolean)
    : OFFSETS.map(function(offset) {
        var number = Number(offset);
        if (!Number.isInteger(number) || number < 0 || number >= calendarDates.length) return null;
        // Offset zero means the final completed minimum-coverage calendar date;
        // it is never a per-symbol tail lookup.
        return calendarDates[calendarDates.length - 1 - number];
      }).filter(Boolean);
  requestedRebalanceDates = Array.from(new Set(requestedRebalanceDates));
  var rebalanceDates = requestedRebalanceDates.filter(function(date){ return calendarDateSet.has(date); }).sort();
  var droppedRebalanceDates = requestedRebalanceDates.filter(function(date){ return rebalanceDates.indexOf(date) < 0; });
  var dateReadyRecords = datedStocks;
  // v51.91 P586/C2: this backtest validates a *fixed* 4-factor subset, not the live ranking model
  // (js/aio-data.js:_aioComputeFactorRanks), whose marketState tilts are currently
  // proposal-only; production ranks remain fixed at NEUTRAL until an explicit
  // promotion record proves live/backtest parity and receives human review. The UI
  // previously implied "종합 랭크가 검증 기반" (the live composite rank is what's validated) —
  // that was not accurate. What IS validated here: momentum/trend/lowvol/kalman at
  // the fixed NEUTRAL weights; proposal tilts are not validated or applied.
  //   size/value/quality are excluded — not because they don't matter, but because backtesting
  //   them here would either be infeasible or methodologically unsound with data this pipeline
  //   actually has: size needs historical shares-outstanding (not fetched anywhere — mcap is a
  //   hand-maintained static seed in SCREENER_DB, not a live time series); value/quality come from
  //   FMP as today-only TTM snapshots (fetch-data.mjs:enrichFundamentals), so scoring a rebalance
  //   147 days ago with today's P/E/ROE would be look-ahead bias — using information that wasn't
  //   actually available at that date. Do not add them without solving those two problems first.
  //   Weights below are the live NEUTRAL constant's momentum/trend/lowvol/kalman entries
  //   (.27/.20/.16/.10, subset sum .73), renormalized to sum to 1 over just this subset — a single
  //   source of truth instead of an independently hand-picked second weight set (see P584/C1 for
  //   why two independent copies of the same "thing" drift apart over time).
  var sectorOf = opts && typeof opts.sectorOf === 'function' ? opts.sectorOf : function() { return null; };
  var liveActiveFactorsSeen = [];
  // P1449: model identity — the canonical string the UI compares against its live model before
  // presenting stored rows as validation of the current ranking.
  var modelFingerprint = buildScreenerModelFingerprint({
    rebalanceOffsets: OFFSETS,
    fwdDays: FWD,
    transactionCostBps: transactionCostBps
  });
  var EXCLUDED_FACTORS = ['size', 'value', 'quality'];
  var EXCLUDED_FACTORS_REASON = 'size needs historical shares-outstanding data this pipeline does not fetch; value/quality are FMP today-only TTM snapshots with no historical time series, so backtesting them would use look-ahead information';
  var IC_FACTORS = ['momentum','trend','lowvol','kalman','composite'];
  var icS = {}, icN = {};
  // v52.50/WO-3: per-rebalance-date IC list (additive, existing icS/icN mean-only output unchanged) —
  // needed to compute ICIR (mean IC / stddev IC across dates) and its t-stat/CI, which Codex's WO-3
  // gate asks for explicitly and which a single averaged IC number cannot support.
  var icByDate = {};
  IC_FACTORS.forEach(function(k){ icS[k]=0; icN[k]=0; icByDate[k]=[]; });
  var spreadSum = 0, spreadNetSum = 0, costSum = 0, spreadN = 0, hit = 0, netHit = 0, hitN = 0;
  var turnoverValues = [], liquidityCoverageValues = [], liquidityObservedRows = 0, liquidityEligibleRows = 0;
  var previousPositions = null;
  var adjustedCloseEligible = dateReadyRecords.filter(function(record){ return _hasCompleteAdjustedSeries(record.stock, record.dates.length); }).length;
  var adjustedCloseExcluded = Math.max(0, dateReadyRecords.length - adjustedCloseEligible);
  var adjustedCloseEligibleRows = 0, adjustedCloseExcludedRows = 0;
  var missingRebalanceRows = 0, missingForwardRows = 0;
  var compositeWeightCoverageMin = 0.8;
  function rank01(vals) { // 값→0..1 percentile(null=0.5), 동점은 평균순위
    return percentileRank01(vals);
  }
  rebalanceDates.forEach(function(rebalanceDate) {
    var rows = [];
    dateReadyRecords.forEach(function(record) {
      var s = record.stock;
      // Return-based factor/backtest math is adjusted-close-only. Raw close is
      // retained for technical/OHLC consumers but is not a silent substitute:
      // without a complete aligned adjusted series, this symbol is excluded and
      // the output reports partial coverage instead of fabricating a result.
      var hasAdjusted = _hasCompleteAdjustedSeries(s, record.dates.length)
        && (!s.adjustedCloseStatus || s.adjustedCloseStatus === 'complete');
      if (!hasAdjusted) {
        adjustedCloseExcludedRows++;
        return;
      }
      adjustedCloseEligibleRows++;
      var c = s.adjCloses;
      var p = record.dateIndex.get(rebalanceDate);
      var rebalanceCalendarIndex = calendarIndex.get(rebalanceDate);
      var forwardDate = Number.isInteger(rebalanceCalendarIndex) ? calendarDates[rebalanceCalendarIndex + FWD] || null : null;
      var forwardIndex = forwardDate ? record.dateIndex.get(forwardDate) : null;
      if (!Number.isInteger(p)) { missingRebalanceRows++; return; }
      if (p < 63) { missingRebalanceRows++; return; }
      if (!Number.isInteger(forwardIndex) || forwardIndex <= p || forwardIndex > c.length - 1) { missingForwardRows++; return; }
      var f = closesToFactors(c.slice(0, p + 1)); if (!f) return;
      var fwd = (c[p] > 0) ? (c[forwardIndex] / c[p] - 1) : null; if (!isNum(fwd) || !forwardDate) return;
      // 모멘텀: 1M(40%)+3M(40%)+6M(20%) — 6M은 추세(trend)와 중복 크므로 가중 축소
      var momParts = [
        isNum(f.ret1m) ? { v: f.ret1m, w: 0.4 } : null,
        isNum(f.ret3m) ? { v: f.ret3m, w: 0.4 } : null,
        isNum(f.ret6m) ? { v: f.ret6m, w: 0.2 } : null,
      ].filter(Boolean);
      var momSum = momParts.reduce(function(s,p){return s+p.w;},0);
      var mom = momParts.length ? momParts.reduce(function(s,p){return s+p.v*p.w;},0)/momSum : null;
      // P1443: the same trend definition as the live model (50-day 60%, 200-day 40%).
      var trParts = [isNum(f.pctSma50) ? { v: f.pctSma50, w: 0.6 } : null, isNum(f.pctSma200) ? { v: f.pctSma200, w: 0.4 } : null].filter(Boolean);
      var trW = trParts.reduce(function(sum, p){ return sum + p.w; }, 0);
      var tr = trW > 0 ? trParts.reduce(function(sum, p){ return sum + p.v * p.w; }, 0) / trW : null;
      var kalman = isNum(f.kalmanVelConf) ? f.kalmanVelConf : (isNum(f.kalmanVel) ? f.kalmanVel : null);
      var liquidity = _historicalLiquidity(s, p, liquidityWindowDays);
      rows.push({
        sym: s.sym || s.symbol || null,
        rebalanceDate: rebalanceDate,
        forwardDate: forwardDate,
        mom: mom, trend: tr, lowvol: isNum(f.vol) ? -f.vol : null, kalman: kalman, fwd: fwd, f: f,
        liquidity: liquidity && isNum(liquidity.averageNotional) ? liquidity.averageNotional : null,
        liquidityObservations: liquidity ? liquidity.observationCount : 0,
        liquidityCurrency: liquidity ? liquidity.currency : (s.currency || (/\.(KS|KQ)$/i.test(String(s.sym || '')) ? 'KRW' : 'USD'))
      });
    });
    if (rows.length < 10) return;
    // 단일 팩터 Spearman IC
    [['mom','momentum'], ['trend','trend'], ['lowvol','lowvol'], ['kalman','kalman']].forEach(function(pair) {
      var ps = rows.filter(function(r){ return isNum(r[pair[0]]); });
      if (ps.length < 10) return;
      var ic = _spearman(ps.map(function(r){ return r[pair[0]]; }), ps.map(function(r){ return r.fwd; }));
      if (isNum(ic)) { icS[pair[1]] += ic; icN[pair[1]]++; icByDate[pair[1]].push(ic); }
    });
    // P1443/I P1449: the composite is the live model itself — computeFactorRanks with the
    // same raw definitions (trend 60/40 of the 50/200-day distances), sector-relative z-scores,
    // coverage gates and the live model default weights (factor-weights.js NEUTRAL, one
    // weights module) — run on the factor values known at the rebalance date. The former
    // percentile-weighted re-implementation (trend as a plain mean, universe percentiles) ranked a
    // different model, so its IC did not validate the ranking on screen; the weights are now
    // passed explicitly so the validation can never drift back to a second copy of the vector.
    var asOf = rebalanceDate + 'T21:00:00.000Z';
    var live = computeFactorRanks({
      weights: MODEL_DEFAULT_WEIGHTS,
      weightsPolicy: 'model-default',
      rows: rows.map(function(r) {
        return { sym: r.sym, sector: sectorOf(r.sym), ret1m: r.f.ret1m, ret3m: r.f.ret3m, ret6m: r.f.ret6m,
          pctSma50: r.f.pctSma50, pctSma200: r.f.pctSma200, vol: r.f.vol, kalmanVel: r.f.kalmanVel, kalmanVelConf: r.f.kalmanVelConf,
          adjustedCloseStatus: 'complete', observedAt: asOf, factorSourceKind: 'T3_PUBLIC_DELAYED',
          factorAllowedUse: 'research-relative-ranking-only', factorQuality: { status: 'CURRENT' } };
      }),
      now: Date.parse(asOf) + 3600000,
      inputVersion: 'backtest:' + rebalanceDate
    });
    var liveRank = new Map((live && Array.isArray(live.rows) ? live.rows : []).map(function(row) { return [row.sym, isNum(row.rank) ? row.rank / 100 : null]; }));
    if (live && live.activeFactors) liveActiveFactorsSeen.push(live.activeFactors.join('+'));
    rows.forEach(function(r){
      r.comp = r.sym && liveRank.has(String(r.sym).toUpperCase()) ? liveRank.get(String(r.sym).toUpperCase()) : null;
    });
    var icC = _spearman(rows.map(function(r){ return r.comp; }), rows.map(function(r){ return r.fwd; }));
    if (isNum(icC)) { icS.composite += icC; icN.composite++; icByDate.composite.push(icC); }
    // 상하위 20% 분위 스프레드 & 방향 적중률. Rows without any observed
    // composite are excluded from portfolio construction; they cannot become
    // a hidden neutral holding through rank01's display fallback.
    var rankedRows = rows.filter(function(r){ return isNum(r.comp); });
    if (rankedRows.length < 2) return;
    var sorted = rankedRows.slice().sort(function(a, b){ return a.comp - b.comp; });
    var q = Math.max(1, Math.floor(sorted.length / 5));
    var botM = _mean(sorted.slice(0, q).map(function(r){ return r.fwd; }));
    var topM = _mean(sorted.slice(-q).map(function(r){ return r.fwd; }));
    if (isNum(topM) && isNum(botM)) {
      var grossSpread = topM - botM;
      var positions = new Map();
      // P1443: the spread (top mean − bottom mean) is the return of $1 long plus $1 short, so the
      // positions — and therefore turnover and cost — use the same ±1 gross legs (was ±0.5).
      var longWeight = 1 / q, shortWeight = -1 / q;
      sorted.slice(-q).forEach(function(r){ if (r.sym) positions.set(r.sym, longWeight); });
      sorted.slice(0, q).forEach(function(r){ if (r.sym) positions.set(r.sym, shortWeight); });
      var turnover = previousPositions == null
        ? [...positions.values()].reduce(function(sum, value){ return sum + Math.abs(value); }, 0)
        : [...new Set([...previousPositions.keys(), ...positions.keys()])].reduce(function(sum, sym){
            return sum + Math.abs((positions.get(sym) || 0) - (previousPositions.get(sym) || 0));
          }, 0);
      var cost = turnover * transactionCostBps / 10000;
      var netSpread = grossSpread - cost;
      var selectedLiquidity = sorted.slice(0, q).concat(sorted.slice(-q));
      var selectedWithLiquidity = selectedLiquidity.filter(function(r){ return isNum(r.liquidity) && r.liquidityObservations >= BACKTEST_MIN_LIQUIDITY_OBSERVATIONS; }).length;
      var liquidityCoverage = selectedLiquidity.length ? selectedWithLiquidity / selectedLiquidity.length : null;
      var observedLiquidity = rankedRows.filter(function(r){ return isNum(r.liquidity); }).length;
      liquidityObservedRows += observedLiquidity;
      liquidityEligibleRows += rankedRows.length;
      if (liquidityCoverage != null) liquidityCoverageValues.push(liquidityCoverage);
      spreadSum += grossSpread;
      spreadNetSum += netSpread;
      costSum += cost;
      spreadN++;
      turnoverValues.push(turnover);
      hitN++;
      if (grossSpread > 0) hit++;
      if (netSpread > 0) netHit++;
      previousPositions = positions;
    }
  });
  var ic = {}; IC_FACTORS.forEach(function(k){ ic[k] = icN[k] ? round(icS[k] / icN[k], 3) : null; });
  var calculationStatus = !calendarDates.length || !rebalanceDates.length || !spreadN
    ? 'BLOCKED'
    : (adjustedCloseExcluded > 0 || missingRebalanceRows > 0 || missingForwardRows > 0 ? 'PARTIAL' : 'COMPLETE');
  var validationBlockers = [
    'historical-universe-point-in-time-not-available',
    'survivorship-bias-uncontrolled-current-membership',
    'corporate-action-event-audit-not-available',
    'execution-liquidity-filter-not-applied',
    'transaction-costs-scenario-only'
  ];
  if (adjustedCloseExcluded > 0) validationBlockers.push('adjusted-close-coverage-incomplete');
  if (!calendarDates.length || !rebalanceDates.length) validationBlockers.push('rebalance-calendar-insufficient');
  var validationReadiness = {
    status: 'BLOCKED',
    predictiveValidation: 'BLOCKED',
    tradingValidation: 'BLOCKED',
    allowedUse: 'research-reference-only',
    blockers: Array.from(new Set(validationBlockers)),
    reason: 'calculation output is descriptive research evidence; promotion requires PIT universe, corporate-action audit, execution liquidity and full cost model'
  };
  return {
    asOf: new Date().toISOString(), fwdDays: FWD, dates: spreadN,
    modelFingerprint: modelFingerprint,
    status: calculationStatus,
    calculationStatus: calculationStatus,
    readiness: validationReadiness,
    validationReadiness: validationReadiness,
    blockingReason: calculationStatus === 'BLOCKED' ? (!calendarDates.length ? 'rebalance-calendar-required' : 'insufficient-calculation-observations') : null,
    blockingReasons: validationReadiness.blockers,
    rebalanceDates: rebalanceDates,
    dateAlignment: {
      mode: dateAlignmentMode,
      contract: 'explicit-rebalance-dates-or-minimum-coverage-calendar-offsets',
      commonDateCount: commonDates.length,
      strictCommonDateCount: commonDates.length,
      calendarDateCount: calendarDates.length,
      calendarDates: calendarDates,
      calendarPolicy: suppliedCalendarDates && suppliedCalendarDates.length ? 'supplied-calendar' : 'minimum-coverage',
      minimumDateCoverage: minDateCoverage,
      dateCoverage: Object.fromEntries(calendarDates.map(function(date) { return [date, dateCounts.get(date) || 0]; })),
      requestedCount: requestedRebalanceDates.length,
      usedCount: rebalanceDates.length,
      droppedRequestedDates: droppedRebalanceDates,
      excludedStocksWithoutDateSeries: excludedWithoutDates,
      forwardMapping: 'common-calendar exact rebalance date plus T+n target date; symbols missing either date are excluded'
    },
    n: adjustedCloseEligible,
    priceBasis: 'adjusted-close-required',
      adjustedCloseStatus: adjustedCloseExcluded > 0 ? (adjustedCloseEligible > 0 ? 'partial' : 'unavailable') : (!calendarDates.length ? 'unavailable' : 'complete'),
    adjustedCloseEligible: adjustedCloseEligible,
    adjustedCloseExcluded: adjustedCloseExcluded,
    adjustedCloseEligibleRows: adjustedCloseEligibleRows,
      adjustedCloseExcludedRows: adjustedCloseExcludedRows,
    missingRebalanceRows: missingRebalanceRows,
    missingForwardRows: missingForwardRows,
    corporateActions: {
      priceBasis: 'adjusted-close-only',
      eventAudit: 'not-available',
      validationStatus: 'BLOCKED',
      blockedReasons: ['corporate-action-event-audit-not-available']
    },
    ic: ic,
    icByDate: icByDate,
    quantileSpread: spreadN ? round(spreadSum / spreadN * 100, 2) : null,
    quantileSpreadNet: spreadN ? round(spreadNetSum / spreadN * 100, 2) : null,
    transactionCostPct: spreadN ? round(costSum / spreadN * 100, 3) : null,
    hitRate: hitN ? round(hit / hitN * 100, 1) : null,
    netHitRate: hitN ? round(netHit / hitN * 100, 1) : null,
    // P1443: what the two rates actually count — not a per-stock direction accuracy.
    hitRateMeaning: 'share of rebalances where the top-quintile mean forward return exceeded the bottom quintile (gross / net of cost)',
    rebalancesCounted: hitN,
    modelParity: {
      composite: 'live computeFactorRanks (factor-ranks.js) on factor values known at each rebalance date',
      activeFactors: liveActiveFactorsSeen.length ? [...new Set(liveActiveFactorsSeen)] : [],
      notValidated: ['size (no historical shares outstanding)', 'value / quality (no point-in-time fundamentals)'],
      longShortGross: '±1 legs (spread and cost on the same exposure)'
    },
    turnover: {
      rebalanceCount: turnoverValues.length,
      average: turnoverValues.length ? round(_mean(turnoverValues), 4) : null,
      maximum: turnoverValues.length ? round(Math.max(...turnoverValues), 4) : null,
      unit: 'absolute portfolio-weight change; ±1 gross long/short equal-weight quintiles'
    },
    compositeWeightCoverageMin: compositeWeightCoverageMin,
    liquidity: {
      windowDays: liquidityWindowDays,
      minimumObservations: BACKTEST_MIN_LIQUIDITY_OBSERVATIONS,
      observedRows: liquidityObservedRows,
      eligibleRows: liquidityEligibleRows,
      coveragePct: liquidityEligibleRows ? round(liquidityObservedRows / liquidityEligibleRows * 100, 1) : null,
      selectedCoveragePct: liquidityCoverageValues.length ? round(_mean(liquidityCoverageValues) * 100, 1) : null,
      unitPolicy: 'native-close-times-volume; USD and KRW are not cross-converted',
      executionFilterApplied: false,
      validationStatus: 'BLOCKED',
      blockedReasons: ['execution-liquidity-filter-not-applied', 'fill-capacity-and-market-impact-not-modeled'],
      allowedUse: 'research-only; liquidity is diagnostic, not a fill guarantee'
    },
    executionModel: {
      rebalance: 'each supplied rebalance date; equal-weight long top quintile / short bottom quintile',
      transactionCostBps,
      costBasis: 'scenario one-way bps multiplied by absolute portfolio-weight turnover',
      excludedCosts: ['bid-ask spread', 'market impact', 'borrow fee/availability', 'taxes', 'FX conversion'],
      status: 'scenario-only-not-live-execution',
      validationStatus: 'BLOCKED',
      blockedReasons: ['transaction-costs-scenario-only', 'spread-impact-borrow-tax-and-fx-not-modeled']
    },
    universePolicy: {
      membership: 'current-configured-universe-applied-retrospectively',
      selectionAsOf: universeMeta.lastBulkUpdate || null,
      currentness: universeMeta.currentness || 'unknown',
      generatedFrom: universeMeta.generatedFrom || 'public-data/screener-universe.json',
      lookaheadBias: 'historical-membership-not-available',
      survivorshipBias: 'uncontrolled-current-membership-only',
      pointInTimeStatus: 'BLOCKED',
      validationStatus: 'BLOCKED',
      blockedReasons: ['historical-universe-point-in-time-not-available', 'survivorship-bias-uncontrolled-current-membership'],
      allowedUse: 'research-reference-not-predictive-validation'
    },
    compWeights: 'factor-weights.js NEUTRAL renormalized over the computable factors — the same live model default ranking uses (P1449 fingerprint below)', // P1443/I P1449: it was a hand copy of the same thing that drifted
    weightPolicy: 'fixed-neutral-until-explicit-promotion',
    weightRegime: 'NEUTRAL',
    excludedFactors: EXCLUDED_FACTORS,
    excludedFactorsReason: EXCLUDED_FACTORS_REASON,
    kalmanScale: 'log_pct_day',
  };
}

// v51.68: VCP (Volatility Contraction Pattern) 서버 사이드 계산 — aio-core.js _calcVCP 대응
export function _calcVCPServer(closes, highs, lows, volumes) {
  const n = closes.length;
  if (n < 60) return null;
  function sma(arr, p) {
    if (arr.length < p) return null;
    let s = 0; for (let i = arr.length - p; i < arr.length; i++) s += arr[i]; return s / p;
  }
  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  const price = closes[n - 1];
  const s50 = sma(closes, 50), s150 = sma(closes, 150), s200 = sma(closes, 200);
  const lk52 = Math.min(252, n);
  const h52 = highs.slice(n - lk52).reduce((m, v) => v > m ? v : m, 0);
  const pct52 = h52 > 0 ? (price - h52) / h52 * 100 : null;
  const stage2 = !!(s50 && s150 && s200 && price > s150 && s150 > s200 && price > s50 && pct52 !== null && pct52 >= -30);
  const bLen = Math.min(65, n - 10);
  const bH = highs.slice(n - bLen), bL = lows.slice(n - bLen), bV = volumes.slice(n - bLen);
  const N = 4; const swH = [], swL = [];
  for (let i = N; i < bH.length - N; i++) {
    let h = true, l = true;
    for (let j = i - N; j <= i + N; j++) {
      if (j === i) continue;
      if (bH[j] >= bH[i]) h = false;
      if (bL[j] <= bL[i]) l = false;
    }
    if (h) swH.push({ idx: i, p: bH[i] });
    if (l) swL.push({ idx: i, p: bL[i] });
  }
  const ctrs = [];
  for (let hi = 0; hi < swH.length; hi++) {
    let nl = null;
    for (let li = 0; li < swL.length; li++) { if (swL[li].idx > swH[hi].idx) { nl = swL[li]; break; } }
    if (!nl) continue;
    const d = (swH[hi].p - nl.p) / swH[hi].p * 100;
    if (d >= 1 && d <= 45) ctrs.push({ depth: Math.round(d * 10) / 10 });
  }
  const cnt = ctrs.length;
  const shrink = cnt >= 2 && ctrs.every((c, i) => i === 0 || ctrs[i].depth < ctrs[i - 1].depth);
  let volDry = false;
  if (bV.length >= 20) {
    const half = Math.floor(bV.length / 2);
    const fv = bV.slice(0, half).filter(v => v > 0);
    const sv = bV.slice(half).filter(v => v > 0);
    const fa = avg(fv), sa = avg(sv);
    volDry = fa > 0 && sa > 0 && sa < fa * 0.85;
  }
  let pivot = null;
  const recSH = swH.filter(sh => sh.idx >= bH.length - 25);
  if (recSH.length) pivot = recSH[recSH.length - 1].p;
  else if (swH.length) pivot = swH[swH.length - 1].p;
  const nearPivot = !!(pivot && price >= pivot * 0.97 && price <= pivot * 1.03);
  const lv = volumes[n - 1];
  const vs = volumes.slice(-21, -1).filter(v => v > 0);
  const rvol = (vs.length >= 10 && lv > 0) ? lv / avg(vs) : null;
  const brk = !!(pivot && price > pivot && rvol !== null && rvol > 1.4);
  let score = 0;
  if (stage2)    score += 25;
  if (cnt >= 2)  score += Math.min(20, cnt * 7);
  if (shrink)    score += 20;
  if (volDry)    score += 15;
  if (nearPivot) score += 10;
  if (brk)       score += 10;
  score = Math.min(100, Math.round(score));
  const vcpStage = !stage2 ? 'not_stage2' : brk ? 'breakout' : nearPivot ? 'near_pivot' : (cnt >= 2 && shrink) ? 'contracting' : cnt >= 1 ? 'basing' : 'stage2_only';
  // 2026-10-14: the latest contraction against the one before it (isShrinking requires every step to shrink).
  const latestShrinking = cnt >= 2 ? ctrs[cnt - 1].depth < ctrs[cnt - 2].depth : null;
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
  const ema = (arr, period) => {
    if (arr.length < period) return null;
    let value = avg(arr.slice(0, period));
    if (value == null) return null;
    const alpha = 2 / (period + 1);
    for (let i = period; i < arr.length; i++) value = arr[i] * alpha + value * (1 - alpha);
    return value;
  };
  const price = closes[n - 1];
  const lowWindow = tail(lows, Math.min(252, n)).filter(v => v > 0);
  const highWindow = tail(highs, Math.min(252, n)).filter(v => v > 0);
  const low52 = lowWindow.length ? Math.min(...lowWindow) : null;
  const high52 = highWindow.length ? Math.max(...highWindow) : null;
  const adrWindow = Math.min(20, n);
  const adrPct = price > 0 ? avg(tail(highs, adrWindow).map((h, i) => {
    const idx = n - adrWindow + i;
    const lo = lows[idx];
    const base = closes[idx];
    return h > 0 && lo >= 0 && base > 0 ? (h - lo) / base * 100 : null;
  }).filter(v => v != null)) : null;
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
