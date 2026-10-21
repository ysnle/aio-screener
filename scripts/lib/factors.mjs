// Price-factor, factor-backtest and VCP/setup-screen math split out of scripts/fetch-data.mjs (v57.62).
// Pure functions over arrays: unit-testable without importing the producer. fetch-data.mjs imports and
// re-exports them, so existing importers (backtest-factors-longrun, data gates) keep working unchanged.
import { percentileRank01, spearman } from './rank-statistics.mjs';
import { round } from './producer-math.mjs';
import { computeFactorRanks } from '../../src/domain/screener/factor-ranks.js';
import { MODEL_DEFAULT_WEIGHTS } from '../../src/domain/screener/factor-weights.js';
import { buildScreenerModelFingerprint } from '../../src/domain/screener/model-fingerprint.js';
// v57.81: the per-symbol price-factor math lives in src/domain/screener/price-factors.js (shared with the browser's
// out-of-universe symbol read); re-exported here so fetch-data.mjs and the gates keep their imports.
import { _mean, closesToFactors } from '../../src/domain/screener/price-factors.js';
export { _mean, closesToFactors, _calcVCPServer, dailyNotionalAverage, fxRateOnOrBefore, _calcSetupScreenFields } from '../../src/domain/screener/price-factors.js';

const BACKTEST_DEFAULT_TRANSACTION_COST_BPS = 20;
const BACKTEST_DEFAULT_LIQUIDITY_WINDOW_DAYS = 20;
const BACKTEST_MIN_LIQUIDITY_OBSERVATIONS = 10;


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
  // (src/domain/screener/factor-ranks.js computeFactorRanks), whose marketState tilts are currently
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
  // v58.56 (#6): the per-rebalance values behind the averaged spread, so 사후 검증 can draw one top-minus-bottom bar per
  // date instead of only the mean. Every array below has one entry per date in spreadDates (same order).
  var spreadDates = [], spreadByDate = [], spreadNetByDate = [], topMeanByDate = [], bottomMeanByDate = [], costByDate = [];
  var icCompositeDates = [];
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
    if (isNum(icC)) { icS.composite += icC; icN.composite++; icByDate.composite.push(icC); icCompositeDates.push(rebalanceDate); }
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
      spreadDates.push(rebalanceDate);
      spreadByDate.push(round(grossSpread * 100, 2));
      spreadNetByDate.push(round(netSpread * 100, 2));
      topMeanByDate.push(round(topM * 100, 2));
      bottomMeanByDate.push(round(botM * 100, 2));
      costByDate.push(round(cost * 100, 3));
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
    // v58.56 (#6): per-date arrays aligned with spreadDates (percent; net = gross − modelled cost on that date's turnover).
    spreadDates: spreadDates,
    quantileSpreadByDate: spreadByDate,
    quantileSpreadNetByDate: spreadNetByDate,
    topQuintileMeanByDate: topMeanByDate,
    bottomQuintileMeanByDate: bottomMeanByDate,
    transactionCostByDate: costByDate,
    icCompositeDates: icCompositeDates,
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
