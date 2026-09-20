/**
 * Portfolio monthly backtest engine.
 *
 * Native ESM owner for the reference-only adjusted-close research calculation.
 * The app bootstrap installs the classic-shell compatibility binding.
 */
function _statMean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

function _statStdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = _statMean(arr);
  const variance = arr.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function _calcDailyReturns(prices, timestamps) {
  if (!prices || prices.length < 2) return [];
  const returns = [];
  let previous = null;
  let previousTs = null;
  for (let i = 0; i < prices.length; i += 1) {
    const current = prices[i];
    const valid = current !== null && current !== undefined && !Number.isNaN(Number(current)) && Number(current) > 0;
    const currentTs = timestamps && timestamps[i] != null ? _aioBtTimestampMs(timestamps[i]) : null;
    if (!valid) {
      previous = null;
      previousTs = null;
      continue;
    }
    if (previous != null) {
      const adjacent = currentTs == null || previousTs == null
        ? true
        : currentTs > previousTs && currentTs - previousTs <= 3 * 24 * 60 * 60 * 1000;
      if (adjacent) returns.push((Number(current) - previous) / previous);
    }
    previous = Number(current);
    previousTs = currentTs;
  }
  return returns;
}

function _quantileR7(sorted, p) {
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function _calcSharpe(returns, rfRate) {
  if (!returns || returns.length < 10 || typeof rfRate !== 'number' || !isFinite(rfRate) || rfRate <= -1) return null;
  var clean = returns.filter(function(r) { return typeof r === 'number' && isFinite(r); });
  if (clean.length < 10) return null;
  var rfDaily = Math.pow(1 + rfRate, 1 / 252) - 1;
  var excess = clean.map(function(r) { return r - rfDaily; });
  var mean = _statMean(excess);
  var std = _statStdDev(excess);
  if (std < 1e-10) return null;  // v48.95 P1-9: near-zero std → null (division-by-zero 방지)
  return (mean / std) * Math.sqrt(252);
}

/**
 * 최대낙폭 (Max Drawdown) — 누적 수익률 고점 대비 최대 하락폭
 * @param {number[]} returns - 일별 수익률 배열
 * @returns {{mdd: number, peakIdx: number, troughIdx: number}|null}
 */
function _calcMaxDrawdown(returns) {
  if (!returns || returns.length < 2) return null;
  var cum = [1];
  for (var i = 0; i < returns.length; i++) {
    cum.push(cum[cum.length - 1] * (1 + returns[i]));
  }
  var maxMdd = 0, peak = cum[0], peakIdx = 0, troughIdx = 0, tempPeak = 0;
  for (var j = 1; j < cum.length; j++) {
    if (cum[j] > peak) { peak = cum[j]; tempPeak = j; }
    var dd = (peak - cum[j]) / peak;
    if (dd > maxMdd) { maxMdd = dd; peakIdx = tempPeak; troughIdx = j; }
  }
  return { mdd: maxMdd, peakIdx: peakIdx, troughIdx: troughIdx };
}

/**
 * Pearson 상관계수 (두 등길이 배열)
 */
function _pearsonCorr(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 2) return 0;
  var n = a.length;
  var mA = _statMean(a), mB = _statMean(b);
  var num = 0, denA = 0, denB = 0;
  for (var i = 0; i < n; i++) {
    var da = a[i] - mA, db = b[i] - mB;
    num += da * db; denA += da * da; denB += db * db;
  }
  if (denA < 1e-12 || denB < 1e-12) return 0;  // v48.95 P1-3: near-zero denom EPS → NaN 방지
  return num / Math.sqrt(denA * denB);
}

/**
 * 상관계수 매트릭스 (Pearson, n×n)
 * @param {Object} returnsMap - { ticker: number[] } 수익률 맵
 * @returns {{tickers: string[], matrix: number[][]}|null}
 */
function _calcCorrelationMatrix(returnsMap) {
  var tickers = Object.keys(returnsMap);
  if (tickers.length < 2) return null;
  var matrix = tickers.map(function(t1) {
    return tickers.map(function(t2) {
      if (t1 === t2) return 1;
      var r1 = returnsMap[t1], r2 = returnsMap[t2];
      var minLen = Math.min(r1.length, r2.length);
      return _pearsonCorr(r1.slice(r1.length - minLen), r2.slice(r2.length - minLen));
    });
  });
  return { tickers: tickers, matrix: matrix };
}

function _aioBtFinite(v) {
  var n = Number(v);
  return isFinite(n) ? n : null;
}

function _aioBtMonthKeyFromTs(ts) {
  var numeric = typeof ts === 'number' || (typeof ts === 'string' && /^\d+(?:\.\d+)?$/.test(ts)) ? Number(ts) : NaN;
  var epochMs = Number.isFinite(numeric) ? (numeric < 100000000000 ? numeric * 1000 : numeric) : Date.parse(String(ts || ''));
  var d = new Date(epochMs);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function _aioBtTimestampMs(ts) {
  var numeric = typeof ts === 'number' || (typeof ts === 'string' && /^\d+(?:\.\d+)?$/.test(ts)) ? Number(ts) : NaN;
  var epochMs = Number.isFinite(numeric) ? (numeric < 100000000000 ? numeric * 1000 : numeric) : Date.parse(String(ts || ''));
  return Number.isFinite(epochMs) ? epochMs : null;
}

function _aioBtMonthDiff(a, b) {
  if (!a || !b) return null;
  var ap = String(a).split('-'), bp = String(b).split('-');
  return (Number(bp[0]) - Number(ap[0])) * 12 + (Number(bp[1]) - Number(ap[1]));
}

function _aioBtMonthEnds(series) {
  var out = {};
  var ts = series && series.timestamps || [];
  // The portfolio lab is total-return research.  Raw closes and ambiguous
  // aliases are intentionally excluded; the producer must provide the
  // explicit adjustedCloses field alongside the observation timestamps.
  var closes = series && Array.isArray(series.adjustedCloses) ? series.adjustedCloses : [];
  for (var i = 0; i < Math.min(ts.length, closes.length); i++) {
    var close = _aioBtFinite(closes[i]);
    if (close === null || close <= 0) continue;
    var key = _aioBtMonthKeyFromTs(ts[i]);
    if (!key) continue;
    out[key] = { value: close, tsMs: _aioBtTimestampMs(ts[i]) };
  }
  return out;
}

function _aioBtCompound(returns) {
  return (returns || []).reduce(function(v, r) { return v * (1 + r); }, 1) - 1;
}

function _aioBtSortino(returns, rfAnnual) {
  var clean = (returns || []).filter(function(v) { return typeof v === 'number' && isFinite(v); });
  if (clean.length < 10 || typeof rfAnnual !== 'number' || !isFinite(rfAnnual) || rfAnnual <= -1) return null;
  var rfMonthly = Math.pow(1 + rfAnnual, 1 / 12) - 1;
  var excess = clean.map(function(r) { return r - rfMonthly; });
  var downside = excess.filter(function(r) { return r < 0; });
  if (downside.length < 2) return null;  // 하방 관측이 최소 2개는 있어야 의미
  // v51.86 P574/R265: downside deviation 의 분모를 "하방 관측 수(n_neg-1)" 가 아니라
  //   "전체 관측 수(N)" 로 사용한다 — Sortino & Price(1994) 및 Portfolio Visualizer 표준.
  //   기존 분모(n_neg-1)는 하방편차를 과대평가해 Sortino 를 표준 대비 ~46% 과소평가시켰다
  //   (실측: 동일 24개월 시계열에서 0.83 vs 표준 1.54). 이 백테스트는 CLAUDE.md 에서
  //   "Portfolio Visualizer 식" 이라 표방하므로 그 정의와 일치해야 한다. 분자는 하방 관측만
  //   제곱합(=Σ min(0, excess)^2)으로 이미 동일하고, 분모만 excess.length(=N)로 정정.
  var dd = Math.sqrt(downside.reduce(function(s, r) { return s + r * r; }, 0) / excess.length);
  if (dd < 1e-10) return null;
  return (_statMean(excess) / dd) * Math.sqrt(12);
}

function _aioBtWorstDrawdowns(rows, startMonth, startBalance) {
  var events = [];
  var peak = startBalance || 1;
  var peakMonth = startMonth || '';
  var active = null;
  (rows || []).forEach(function(r) {
    var bal = Number(r.balance);
    if (!isFinite(bal) || bal <= 0) return;
    if (bal >= peak) {
      if (active) {
        active.recoveryBy = r.month;
        active.recoveryMonths = Math.max(0, _aioBtMonthDiff(active.troughMonth, r.month) || 0);
        active.underwaterMonths = Math.max(0, _aioBtMonthDiff(active.start, r.month) || 0);
        events.push(active);
        active = null;
      }
      peak = bal;
      peakMonth = r.month;
      return;
    }
    var dd = (peak - bal) / peak;
    if (!active) {
      active = { start: peakMonth, end: r.month, troughMonth: r.month, drawdown: dd, recoveryBy: null, recoveryMonths: null, underwaterMonths: null };
    } else if (dd > active.drawdown) {
      active.end = r.month;
      active.troughMonth = r.month;
      active.drawdown = dd;
    }
  });
  if (active) {
    active.recoveryBy = 'Unrecovered';
    active.recoveryMonths = null;
    active.underwaterMonths = _aioBtMonthDiff(active.start, (rows[rows.length - 1] || {}).month) || null;
    events.push(active);
  }
  return events.sort(function(a, b) { return (b.drawdown || 0) - (a.drawdown || 0); }).slice(0, 10);
}

function _aioBtCovariance(a, b) {
  var n = Math.min((a || []).length, (b || []).length);
  if (n < 2) return 0;
  var aa = a.slice(a.length - n), bb = b.slice(b.length - n);
  var ma = _statMean(aa), mb = _statMean(bb);
  var s = 0;
  for (var i = 0; i < n; i++) s += (aa[i] - ma) * (bb[i] - mb);
  return s / (n - 1);
}

function _aioBtShouldRebalance(type, monthKey) {
  var m = Number(String(monthKey || '').slice(5, 7));
  if (type === 'monthly') return true;
  if (type === 'quarterly') return m === 3 || m === 6 || m === 9 || m === 12;
  if (type === 'annual') return m === 12;
  return false;
}

export function buildPortfolioBacktestLab(priceMap, positions, options) {
  options = options || {};
  var initialAmount = Math.max(1, Number(options.initialAmount) || 10000);
  var rfProvided = options.rfAnnual != null;
  var rfAnnual = (typeof options.rfAnnual === 'number' && isFinite(options.rfAnnual)
    && options.rfAnnual > -1 && options.rfAnnual <= 1) ? options.rfAnnual : null;
  var rfInvalid = rfProvided && rfAnnual == null;
  var benchmarkSymbol = String(options.benchmarkSymbol || 'SPY').trim().toUpperCase() || 'SPY';
  var rebalanceType = String(options.rebalanceType || 'annual').toLowerCase();
  var maxAlignmentGapDays = Number.isFinite(Number(options.maxAlignmentGapDays)) && Number(options.maxAlignmentGapDays) >= 0
    ? Number(options.maxAlignmentGapDays) : 3;
  var startYear = Number(options.startYear) || 2017;
  var endYear = Number(options.endYear) || 2099;
  var raw = (positions || []).filter(function(p) {
    return p && p.ticker && Number(p.qty) > 0 && Number(p.cost) > 0;
  }).map(function(p) {
    return {
      ticker: String(p.ticker).trim().toUpperCase(), value: Number(p.qty) * Number(p.cost), qty: Number(p.qty),
      targetWeight: typeof p.targetWeight === 'number' && isFinite(p.targetWeight) && p.targetWeight >= 0 ? p.targetWeight : null
    };
  });
  var byTicker = {};
  var byTickerQty = {};
  var byTickerTargetWeight = {};
  raw.forEach(function(p) {
    byTicker[p.ticker] = (byTicker[p.ticker] || 0) + p.value;
    byTickerQty[p.ticker] = (byTickerQty[p.ticker] || 0) + p.qty;
    if (p.targetWeight != null) byTickerTargetWeight[p.ticker] = (byTickerTargetWeight[p.ticker] || 0) + p.targetWeight;
  });
  var tickers = Object.keys(byTicker).filter(function(t) { return priceMap && priceMap[t]; });
  var totalValue = tickers.reduce(function(s, t) { return s + byTicker[t]; }, 0);
  if (!tickers.length || totalValue <= 0) return { ok: false, reason: 'no valid portfolio price series', warnings: ['가격 이력이 있는 포지션이 없습니다.'] };
  if (!priceMap || !priceMap[benchmarkSymbol]) return { ok: false, reason: 'missing benchmark', warnings: [benchmarkSymbol + ' 벤치마크 가격 이력이 없습니다.'] };

  // Returns require a corporate-action-adjusted series.  A raw close is still
  // useful for charting, but silently substituting it here would understate
  // dividends/splits and present a non-comparable performance result.
  var requiredSeries = tickers.concat([benchmarkSymbol]);
  var missingAdjusted = requiredSeries.filter(function(t) {
    var series = priceMap[t] || {};
    var adjusted = series.adjustedCloses;
    return !Array.isArray(adjusted) || adjusted.length !== (series.timestamps || []).length
      || series.backtestEligible !== true
      || series.backtestPriceBasis !== 'adjusted-close';
  });
  if (missingAdjusted.length) {
    return {
      ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
      decisionEligible: false, promotionEligible: false,
      promotionBlockers: ['adjusted-close-required', 'current-composition-retrospective', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
      reason: 'adjusted-close series required',
      model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
      priceBasis: 'adjusted-close-required',
      compositionDisclosure: 'current-composition-retrospective',
      warnings: ['조정주가(adjusted close) 이력이 없어 성과 계산을 보류합니다: ' + missingAdjusted.join(', ') + '.', '원가·raw close를 조정주가 대신 사용하지 않습니다.', '거래비용·슬리피지·회전율을 모델링하지 않은 결과는 승격할 수 없습니다.']
    };
  }
  // Do not invent a risk-free rate. Gross return rows can still be shown,
  // while RF-dependent statistics remain unavailable. The input is a decimal
  // annual rate in (-1, 1]; values such as 4.3 are rejected as percent units.

  var monthEnds = {};
  tickers.concat([benchmarkSymbol]).forEach(function(t) { monthEnds[t] = _aioBtMonthEnds(priceMap[t]); });
  var common = Object.keys(monthEnds[benchmarkSymbol]).filter(function(k) {
    var y = Number(k.slice(0, 4));
    var benchmarkPoint = monthEnds[benchmarkSymbol][k];
    return y >= startYear && y <= endYear && benchmarkPoint && benchmarkPoint.tsMs != null
      && tickers.every(function(t) {
        var point = monthEnds[t][k];
        return point && point.tsMs != null
          && Math.abs(point.tsMs - benchmarkPoint.tsMs) <= maxAlignmentGapDays * 24 * 60 * 60 * 1000;
      });
  }).sort();
  if (common.length < 14) {
    return {
      ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
      decisionEligible: false, promotionEligible: false,
      promotionBlockers: ['synchronous-month-end-alignment-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
      reason: 'insufficient synchronously aligned monthly data', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
      priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
      warnings: ['동일 월 키라도 관측일 차이가 ' + maxAlignmentGapDays + '일을 넘는 자산은 결합하지 않습니다. 공통 동시 월말이 14개월 미만입니다.']
    };
  }

  // W07-E/P1146 (M06): a monthly performance model is only defined on a contiguous monthly
  // grid. Splicing a later month onto an earlier one as a single "month" return compresses two
  // months into one sample and inflates CAGR/anualization. Detect gaps and either fall back to
  // the longest contiguous window (recording what was excluded) or withhold monthly performance
  // entirely — never fill a gap or treat a multi-month change as one month.
  var monthOrdinal = function(key) { return Number(key.slice(0, 4)) * 12 + (Number(key.slice(5, 7)) - 1); };
  var gridGaps = [];
  for (var gapIndex = 1; gapIndex < common.length; gapIndex++) {
    var span = monthOrdinal(common[gapIndex]) - monthOrdinal(common[gapIndex - 1]);
    if (span !== 1) gridGaps.push({ from: common[gapIndex - 1], to: common[gapIndex], missingMonths: span - 1 });
  }
  var excludedMonths = [];
  if (gridGaps.length) {
    var runs = [];
    var runStart = 0;
    for (var runEnd = 1; runEnd <= common.length; runEnd++) {
      if (runEnd === common.length || monthOrdinal(common[runEnd]) - monthOrdinal(common[runEnd - 1]) !== 1) {
        runs.push({ start: runStart, end: runEnd - 1 });
        runStart = runEnd;
      }
    }
    runs.sort(function(a, b) { return (b.end - b.start) - (a.end - a.start) || b.start - a.start; });
    var chosenRun = runs[0];
    var chosenMonths = common.slice(chosenRun.start, chosenRun.end + 1);
    excludedMonths = common.filter(function(key) { return chosenMonths.indexOf(key) === -1; });
    if (chosenMonths.length < 14) {
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['contiguous-monthly-grid-required', 'synchronous-month-end-alignment-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'monthly grid has gaps and no contiguous window reaches 14 months',
        model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        gridGaps: gridGaps,
        warnings: ['월별 그리드에 결측 구간이 있어 연속 구간이 14개월 미만입니다.', '여러 달 수익률을 한 달 표본으로 압축하거나 결측을 채우지 않습니다.']
      };
    }
    common = chosenMonths;
  }


  var explicitTargetWeights = tickers.every(function(t) { return byTickerTargetWeight[t] != null; });
  var targetWeights = {};
  var targetWeightBasis = explicitTargetWeights ? 'explicit-target-weight' : 'terminal-adjusted-close-market-value';
  var targetWeightDenominator = 0;
  if (explicitTargetWeights) {
    tickers.forEach(function(t) { targetWeightDenominator += byTickerTargetWeight[t]; });
    if (!(targetWeightDenominator > 0)) explicitTargetWeights = false;
  }
  if (explicitTargetWeights) {
    tickers.forEach(function(t) { targetWeights[t] = byTickerTargetWeight[t] / targetWeightDenominator; });
  } else {
    tickers.forEach(function(t) {
      var terminalPoint = monthEnds[t][common[common.length - 1]];
      var marketValue = terminalPoint && terminalPoint.value > 0 ? byTickerQty[t] * terminalPoint.value : null;
      targetWeightDenominator += marketValue || 0;
      targetWeights[t] = marketValue;
    });
    if (!(targetWeightDenominator > 0) || tickers.some(function(t) { return !(targetWeights[t] > 0); })) {
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['target-weight-basis-unavailable', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'target weight basis unavailable', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        warnings: ['원가 비중을 목표비중으로 대체하지 않습니다. 명시적 targetWeight 또는 종점 조정주가×수량이 필요합니다.']
      };
    }
    tickers.forEach(function(t) { targetWeights[t] = targetWeights[t] / targetWeightDenominator; });
  }
  var assetBalances = {};
  tickers.forEach(function(t) { assetBalances[t] = initialAmount * targetWeights[t]; });
  var benchBalance = initialAmount;
  var monthlyRows = [];
  var assetReturnMap = {};
  var realizedWeightedReturnMap = {};
  var realizedWeightMap = {};
  var returnContributionMap = {};
  tickers.forEach(function(t) { assetReturnMap[t] = []; realizedWeightedReturnMap[t] = []; realizedWeightMap[t] = []; });
  tickers.forEach(function(t) { returnContributionMap[t] = 0; });

  for (var i = 1; i < common.length; i++) {
    var prevMonth = common[i - 1], month = common[i];
    var before = tickers.reduce(function(s, t) { return s + assetBalances[t]; }, 0);
    var assetReturns = {};
    var startWeights = {};
    tickers.forEach(function(t) {
      startWeights[t] = before > 0 ? assetBalances[t] / before : null;
      realizedWeightMap[t].push(startWeights[t]);
    });
    tickers.forEach(function(t) {
      var r = (monthEnds[t][month].value / monthEnds[t][prevMonth].value) - 1;
      assetReturns[t] = r;
      assetReturnMap[t].push(r);
      realizedWeightedReturnMap[t].push((startWeights[t] == null ? 0 : startWeights[t]) * r);
      // Arithmetic dollar contribution uses the holding balance at the start
      // of this interval.  It remains additive through rebalances and is not
      // mislabeled as initial-weight × standalone return.
      var delta = assetBalances[t] * r;
      returnContributionMap[t] += delta;
      assetBalances[t] += delta;
    });
    var balance = tickers.reduce(function(s, t) { return s + assetBalances[t]; }, 0);
    var pfRet = before > 0 ? (balance / before) - 1 : 0;
    var bRet = (monthEnds[benchmarkSymbol][month].value / monthEnds[benchmarkSymbol][prevMonth].value) - 1;
    benchBalance *= (1 + bRet);
    var rebalanced = _aioBtShouldRebalance(rebalanceType, month);
    var endWeights = {};
    tickers.forEach(function(t) { endWeights[t] = balance > 0 ? assetBalances[t] / balance : null; });
    var turnover = 0;
    if (rebalanced) {
      // Turnover is measured on the drifted end-of-period holdings that are
      // actually traded, after the interval return has been realized.
      turnover = tickers.reduce(function(sum, t) { return sum + Math.abs(targetWeights[t] - (endWeights[t] || 0)); }, 0) / 2;
    }
    var monthlyRow = {
      month: month, return: pfRet, balance: balance, benchmarkReturn: bRet, benchmarkBalance: benchBalance,
      assetReturns: assetReturns, realizedWeights: startWeights, endWeights: endWeights, turnover: turnover,
      rebalanced: rebalanced,
      returnContributionBasis: 'realized-beginning-weighted-arithmetic-return'
    };
    monthlyRows.push(monthlyRow);
    if (rebalanced) {
      tickers.forEach(function(t) { assetBalances[t] = balance * targetWeights[t]; });
    }
  }

  var monthlyReturns = monthlyRows.map(function(r) { return r.return; });
  var benchmarkReturns = monthlyRows.map(function(r) { return r.benchmarkReturn; });
  var years = {};
  monthlyRows.forEach(function(r) {
    var y = r.month.slice(0, 4);
    if (!years[y]) years[y] = { returns: [], benchmarkReturns: [], balance: null, benchmarkBalance: null };
    years[y].returns.push(r.return);
    years[y].benchmarkReturns.push(r.benchmarkReturn);
    years[y].balance = r.balance;
    years[y].benchmarkBalance = r.benchmarkBalance;
  });
  var annualRows = Object.keys(years).sort().map(function(y) {
    return {
      year: y,
      return: _aioBtCompound(years[y].returns),
      balance: years[y].balance,
      benchmarkReturn: _aioBtCompound(years[y].benchmarkReturns),
      benchmarkBalance: years[y].benchmarkBalance
    };
  });

  var nMonths = monthlyReturns.length;
  var endBalance = monthlyRows[monthlyRows.length - 1].balance;
  var benchEndBalance = monthlyRows[monthlyRows.length - 1].benchmarkBalance;
  var cagr = Math.pow(endBalance / initialAmount, 12 / nMonths) - 1;
  var benchCagr = Math.pow(benchEndBalance / initialAmount, 12 / nMonths) - 1;
  var stdev = _statStdDev(monthlyReturns) * Math.sqrt(12);
  var benchStdev = _statStdDev(benchmarkReturns) * Math.sqrt(12);
  var rfMonthly = rfAnnual != null && rfAnnual > -1 ? Math.pow(1 + rfAnnual, 1 / 12) - 1 : null;
  var excessMonthly = rfMonthly == null ? null : monthlyReturns.map(function(r) { return r - rfMonthly; });
  var excessStdev = excessMonthly ? _statStdDev(excessMonthly) : null;
  // Sharpe is the mean monthly arithmetic excess return divided by its
  // monthly sample deviation, annualized by sqrt(12). CAGR is geometric and
  // cannot be mixed into this denominator.
  var sharpe = excessMonthly && excessStdev > 1e-10 ? (_statMean(excessMonthly) / excessStdev) * Math.sqrt(12) : null;
  var sortino = rfAnnual != null ? _aioBtSortino(monthlyReturns, rfAnnual) : null;
  var activeMonthly = monthlyReturns.map(function(r, idx) { return r - benchmarkReturns[idx]; });
  var trackingError = _statStdDev(activeMonthly) * Math.sqrt(12);
  var infoRatio = trackingError > 1e-10 ? (_statMean(activeMonthly) / _statStdDev(activeMonthly)) * Math.sqrt(12) : null;
  var corr = _pearsonCorr(monthlyReturns, benchmarkReturns);
  var benchmarkVariance = Math.pow(_statStdDev(benchmarkReturns), 2);
  var beta = benchmarkVariance > 1e-12 ? _aioBtCovariance(monthlyReturns, benchmarkReturns) / benchmarkVariance : null;
  var benchmarkExcessMonthly = rfMonthly == null ? null : benchmarkReturns.map(function(r) { return r - rfMonthly; });
  // Jensen alpha is estimated in the same monthly arithmetic-return space as
  // beta and annualized by 12; it is not a CAGR-minus-CAGR hybrid.
  var alpha = rfMonthly != null && beta != null
    ? (_statMean(excessMonthly) - beta * _statMean(benchmarkExcessMonthly)) * 12 : null;
  var annualReturns = annualRows.map(function(r) { return r.return; });
  var cleanMonthly = monthlyReturns.slice().sort(function(a, b) { return a - b; });
  var var5 = cleanMonthly.length ? Math.max(0, -_quantileR7(cleanMonthly, 0.05)) : null;
  var tail = cleanMonthly.filter(function(r) { return r <= _quantileR7(cleanMonthly, 0.05); });
  var cvar5 = tail.length ? Math.max(0, -_statMean(tail)) : null;
  var upBench = [], upPf = [], downBench = [], downPf = [];
  benchmarkReturns.forEach(function(br, idx) {
    if (br >= 0) { upBench.push(br); upPf.push(monthlyReturns[idx]); }
    else { downBench.push(br); downPf.push(monthlyReturns[idx]); }
  });
  var upCapture = _statMean(upBench) !== 0 ? _statMean(upPf) / _statMean(upBench) : null;
  var downCapture = _statMean(downBench) !== 0 ? _statMean(downPf) / _statMean(downBench) : null;
  var mddRows = _aioBtWorstDrawdowns(monthlyRows, common[0], initialAmount);
  var mdd = mddRows.length ? mddRows[0].drawdown : 0;
  var portVar = Math.pow(_statStdDev(monthlyReturns), 2);
  var netGain = endBalance - initialAmount;
  var totalTurnover = monthlyRows.reduce(function(sum, row) { return sum + Number(row.turnover || 0); }, 0);
  var components = tickers.map(function(t) {
    var standalone = _aioBtCompound(assetReturnMap[t]);
    var contribution = returnContributionMap[t];
    var cov = _aioBtCovariance(realizedWeightedReturnMap[t], monthlyReturns);
    var realizedWeights = realizedWeightMap[t].filter(function(v) { return typeof v === 'number' && isFinite(v); });
    var averageRealizedWeight = realizedWeights.length ? _statMean(realizedWeights) : null;
    var riskContribution = portVar > 1e-12 ? cov / portVar : null;
    return {
      ticker: t, weight: targetWeights[t], targetWeight: targetWeights[t], averageRealizedWeight: averageRealizedWeight,
      standaloneReturn: standalone, returnContribution: contribution,
      returnContributionPct: netGain !== 0 ? contribution / netGain : null,
      contributionBasis: 'arithmetic-period-start-dollar',
      riskContribution: riskContribution,
      riskContributionBasis: 'realized-beginning-weighted-monthly-return'
    };
  }).sort(function(a, b) { return Math.abs(b.riskContribution || 0) - Math.abs(a.riskContribution || 0); });

  return {
    ok: true,
    sourceKind: 'DELAYED',
    status: 'PARTIAL',
    allowedUse: 'reference-only',
    decisionUse: false,
    decisionEligible: false,
    promotionEligible: false,
    promotion: 'trading-performance-prohibited',
    promotionBlockers: [
      'transaction-costs-not-modeled',
      'slippage-not-modeled',
      'turnover-not-modeled',
      'current-composition-retrospective',
      'survivorship-and-membership-history-unavailable'
    ],
    model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
    priceBasis: 'adjusted-close',
    compositionDisclosure: 'current-composition-retrospective',
    rfAnnualUnit: 'decimal',
    rfInputStatus: rfInvalid ? 'invalid-rejected' : rfAnnual == null ? 'not-supplied' : 'accepted',
    settings: {
      initialAmount: initialAmount, startMonth: common[0], endMonth: common[common.length - 1], months: nMonths,
      rebalanceType: rebalanceType, benchmarkSymbol: benchmarkSymbol, rfAnnual: rfAnnual,
      rfAnnualUnit: 'decimal', rfInputStatus: rfInvalid ? 'invalid-rejected' : rfAnnual == null ? 'not-supplied' : 'accepted',
      transactionCostBps: null, slippageBps: null, turnoverModeled: false,
      maxAlignmentGapDays: maxAlignmentGapDays, observedTargetTurnover: totalTurnover,
      turnoverBasis: 'half-sum-absolute-target-minus-realized-end-weight-at-rebalance',
      targetWeightBasis: targetWeightBasis,
      // W07-E/P1146: state the grid the monthly statistics were actually computed on.
      gridGaps: gridGaps, excludedMonths: excludedMonths,
      monthlyGridBasis: gridGaps.length ? 'longest-contiguous-window' : 'contiguous'
    },
    tickers: tickers,
    weights: targetWeights,
    monthlyRows: monthlyRows,
    annualRows: annualRows,
    drawdowns: mddRows,
    components: components,
    performance: {
      startBalance: initialAmount,
      endBalance: endBalance,
      benchmarkEndBalance: benchEndBalance,
      cagr: cagr,
      benchmarkCagr: benchCagr,
      returnBasis: 'geometric-compounded-monthly-adjusted-close',
      stdev: stdev,
      benchmarkStdev: benchStdev,
      bestYear: annualReturns.length ? Math.max.apply(null, annualReturns) : null,
      worstYear: annualReturns.length ? Math.min.apply(null, annualReturns) : null,
      maxDrawdown: mdd,
      sharpe: sharpe,
      sharpeBasis: rfAnnual == null ? 'unavailable-risk-free-rate-not-supplied' : 'monthly-arithmetic-excess-return-over-monthly-sample-stdev-annualized-sqrt12',
      sortino: sortino,
      activeReturn: cagr - benchCagr,
      activeReturnBasis: 'geometric-cagr-difference',
      trackingError: trackingError,
      informationRatio: infoRatio,
      informationRatioBasis: 'monthly-arithmetic-active-return-over-monthly-sample-tracking-error-annualized-sqrt12',
      benchmarkCorrelation: corr,
      beta: beta,
      alpha: alpha,
      alphaBasis: alpha == null ? 'unavailable-risk-free-rate-or-benchmark-variance' : 'monthly-arithmetic-jensen-alpha-annualized-12',
      historicalVar5: var5,
      conditionalVar5: cvar5,
      upsideCapture: upCapture,
      downsideCapture: downCapture
    },
    warnings: [
      '조정주가 기반 총수익률의 참고용 추정치입니다. 세금·수수료·거래비용·슬리피지·회전율을 모델링하지 않았으며 gross 성과입니다. 이 누락은 승격 차단 사유입니다.',
      '현재 보유 구성의 명시적 목표비중 또는 종점 조정주가×수량 비중을 과거에 소급한 current-composition retrospective이며 원가 비중을 시장가 비중으로 오인하지 않습니다. 생존편향·구성 변경·상장 전 구간은 교정하지 않습니다.',
      '월말 관측일이 자산 간 ' + maxAlignmentGapDays + '일을 초과하는 월은 비동시성 편향 방지를 위해 제외했습니다.',
      rfInvalid ? '무위험수익률(RF)은 연간 소수(decimal) 단위(-1, 1]만 허용합니다. 입력 단위가 잘못되어 Sharpe·Sortino·Alpha를 산출하지 않았습니다.' : rfAnnual == null ? '무위험수익률(RF)을 입력하지 않아 Sharpe·Sortino·Alpha를 산출하지 않았습니다.' : ('RF 가정: 연 소수 ' + rfAnnual.toFixed(6) + ' (' + (rfAnnual * 100).toFixed(2) + '%).'),
      '거래 가능한 실현 성과·매매 지시로 승격하지 않습니다.',
      '무료 Yahoo chart 데이터 범위와 각 종목 상장일에 따라 시작 월이 자동 제한됩니다.'
    ]
  };
};

export {
  _statMean,
  _statStdDev,
  _calcDailyReturns,
  _quantileR7,
  _calcSharpe,
  _calcMaxDrawdown,
  _pearsonCorr,
  _calcCorrelationMatrix
};
