/**
 * Portfolio risk / account-performance / composition-snapshot domain.
 *
 * 22 W22-I/W22-J (E4): the numbers a risk or performance surface publishes are
 * only meaningful together with the contract they were computed under. This
 * module owns that contract — which path was measured (exposureHistoryMode),
 * on which denominator (weightBasis), how cash and the risk-free rate were
 * treated, which immutable valuation snapshot the current weights came from,
 * and whether an account-performance claim may be made at all.
 *
 * The module stays pure (no window, no clock-derived identity): snapshot and
 * estimate ids derive from their actual inputs, and the app bootstrap is the
 * only place that binds these functions to the classic shell.
 */

const EXPOSURE_HISTORY_MODES = ['actual_account_history', 'current_composition_retrospective', 'fixed_target_weight_strategy'];

function _pfStableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map(_pfStableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ':' + _pfStableStringify(value[key]);
  }).join(',') + '}';
}

// Two-seed FNV-1a over the canonical payload — deterministic content id that
// changes when any actual input changes (R630), without a clock or random salt.
function _pfContentHash(text) {
  var seeds = [0x811c9dc5, 0x1b873593];
  return seeds.map(function(seed) {
    var h = seed;
    for (var i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return ('00000000' + h.toString(16)).slice(-8);
  }).join('');
}

/**
 * Freeze the current composition (quantity × price at one cut, plus declared
 * cash) into an immutable snapshot the weights are read from — never from a
 * price that happens to arrive later. 22:PFR10 / W22-J.
 *
 * members: [{ ticker, qty, price, priceObservedAt, priceSource }]
 * cash:    { amount, currency }  (currency may be null → declared-unresolved)
 */
export function createCompositionSnapshot(input) {
  input = input || {};
  var members = Array.isArray(input.members) ? input.members : [];
  var cashInput = input.cash || { amount: 0, currency: null };
  var asOf = input.asOf != null ? String(input.asOf) : null;
  var weightBasis = input.weightBasis === 'invested_sleeve' ? 'invested_sleeve' : 'whole_account';
  var baseCurrency = input.baseCurrency != null ? String(input.baseCurrency) : null;

  var payload = {
    members: members.map(function(member) {
      return {
        ticker: String(member && member.ticker || ''),
        qty: member && member.qty != null ? Number(member.qty) : null,
        price: member && member.price != null ? Number(member.price) : null,
        priceObservedAt: member && member.priceObservedAt != null ? String(member.priceObservedAt) : null,
        priceSource: member && member.priceSource != null ? String(member.priceSource) : null
      };
    }),
    cash: {
      amount: cashInput.amount != null ? Number(cashInput.amount) : null,
      currency: cashInput.currency != null ? String(cashInput.currency) : null
    },
    asOf: asOf,
    weightBasis: weightBasis,
    baseCurrency: baseCurrency
  };

  var snapshot = {
    compositionSnapshotId: 'pfcomp-' + _pfContentHash(_pfStableStringify(payload)),
    compositionAsOf: asOf,
    valuationCut: asOf,
    weightBasis: weightBasis,
    baseCurrency: baseCurrency,
    members: payload.members,
    cash: payload.cash,
    equityValue: null,
    cashDeclared: false,
    cashWeight: null,
    equityWeight: null,
    resolvedWeightDenominator: null,
    status: 'ready',
    issues: [],
    blocked: null
  };

  if (!payload.members.length) {
    snapshot.status = 'blocked';
    snapshot.blocked = { code: 'no-members', members: [] };
    return snapshot;
  }

  var missing = payload.members.filter(function(member) {
    return !(typeof member.qty === 'number' && isFinite(member.qty) && member.qty > 0
      && typeof member.price === 'number' && isFinite(member.price) && member.price > 0);
  }).map(function(member) { return member.ticker; });
  if (missing.length) {
    snapshot.status = 'blocked';
    snapshot.blocked = { code: 'member-price-missing', members: missing };
    return snapshot;
  }

  payload.members.forEach(function(member) { member.marketValue = member.qty * member.price; });
  var equityValue = payload.members.reduce(function(sum, member) { return sum + member.marketValue; }, 0);
  var cashAmount = typeof payload.cash.amount === 'number' && isFinite(payload.cash.amount) && payload.cash.amount >= 0
    ? payload.cash.amount : 0;
  // Cash joins a denominator only when its currency is declared against the
  // base currency — an unverifiable number is not silently summed (P1175 class).
  var cashDeclared = cashAmount === 0
    || (payload.cash.currency != null && baseCurrency != null && payload.cash.currency === baseCurrency);
  snapshot.equityValue = equityValue;
  snapshot.cashDeclared = cashDeclared;

  if (weightBasis === 'whole_account') {
    if (!cashDeclared) {
      snapshot.status = 'blocked';
      snapshot.blocked = { code: 'cash-declaration-unresolved', members: [], cash: payload.cash };
      return snapshot;
    }
    var denominator = equityValue + cashAmount;
    payload.members.forEach(function(member) { member.resolvedWeight = member.marketValue / denominator; });
    snapshot.resolvedWeightDenominator = denominator;
    snapshot.equityWeight = equityValue / denominator;
    snapshot.cashWeight = cashAmount / denominator;
    return snapshot;
  }

  payload.members.forEach(function(member) { member.resolvedWeight = member.marketValue / equityValue; });
  snapshot.resolvedWeightDenominator = equityValue;
  snapshot.equityWeight = 1;
  if (!cashDeclared) {
    snapshot.status = 'limited';
    snapshot.issues.push('cash-currency-unverified');
    snapshot.cashWeight = null;
  } else {
    snapshot.cashWeight = cashAmount > 0 ? cashAmount / (equityValue + cashAmount) : 0;
  }
  return snapshot;
}

function _pfCashDailyRate(cashReturn) {
  if (!cashReturn || typeof cashReturn !== 'object') return null;
  if (cashReturn.mode === 'explicit_assumption') {
    var rate = cashReturn.annualRate;
    if (typeof rate !== 'number' || !isFinite(rate) || rate <= -1 || rate > 1) return null;
    return { mode: 'explicit_assumption', annualRate: rate, dailyRate: Math.pow(1 + rate, 1 / 252) - 1 };
  }
  if (cashReturn.mode === 'observed_cash_series' && Array.isArray(cashReturn.series)) {
    return { mode: 'observed_cash_series', series: cashReturn.series.slice() };
  }
  return null;
}

const STRATEGY_REBALANCE_POLICIES = ['daily', 'monthly', 'quarterly', 'buy-and-hold'];

// Fixed weights applied to each bar's member returns — the retrospective sleeve.
function _pfWeightedSleeveReturns(memberSeries, weights) {
  var n = memberSeries[0].series.length;
  var out = [];
  for (var i = 0; i < n; i += 1) {
    var periodReturn = 0;
    for (var m = 0; m < memberSeries.length; m += 1) periodReturn += weights[m] * memberSeries[m].series[i];
    out.push(periodReturn);
  }
  return out;
}

// Target weights must cover exactly the snapshot members, each a fraction in
// [0,1], summing to 1 — a partial or over-allocated strategy is not a strategy.
function _pfResolveStrategyWeights(targetWeights, memberSeries) {
  if (!targetWeights || typeof targetWeights !== 'object' || Array.isArray(targetWeights)) return null;
  if (Object.keys(targetWeights).length !== memberSeries.length) return null;
  var weights = [];
  var declared = {};
  var sum = 0;
  for (var i = 0; i < memberSeries.length; i += 1) {
    var ticker = memberSeries[i].ticker;
    if (!Object.prototype.hasOwnProperty.call(targetWeights, ticker)) return null;
    var weight = Number(targetWeights[ticker]);
    if (!isFinite(weight) || weight < 0 || weight > 1) return null;
    weights.push(weight);
    declared[ticker] = weight;
    sum += weight;
  }
  // P1200: 목표비중 합이 1보다 작으면 그 차액은 **현금 목표비중**이다 — 선언이 계좌 범위를 말한
  // 것이므로 계좌 전체 보기를 만들 수 있다(현금 수익률이 선언됐을 때). 합이 1을 넘으면 선언이
  // 성립하지 않는다.
  if (sum > 1 + 1e-9) return null;
  return { weights: weights, targetWeights: declared, sum: sum, cashWeight: Math.max(0, 1 - sum) };
}

function _pfRebalanceKey(dateKey, policy) {
  if (dateKey == null) return null;
  var text = String(dateKey);
  if (policy === 'monthly') return text.slice(0, 7);
  if (policy === 'quarterly') return text.slice(0, 4) + '-Q' + (Math.floor((Number(text.slice(5, 7)) - 1) / 3) + 1);
  return text;
}

// The strategy return path: weights drift with each bar's returns and reset to
// the declared target at each rebalance boundary (every bar for 'daily', never
// for 'buy-and-hold'). This is a hypothetical strategy path, not account history.
function _pfStrategyPathReturns(memberSeries, targetWeights, rebalancePolicy, sampleDates) {
  var n = memberSeries[0].series.length;
  var out = [];
  var weights = targetWeights.slice();
  var previousKey = null;
  for (var i = 0; i < n; i += 1) {
    var key = sampleDates && sampleDates[i] != null ? _pfRebalanceKey(sampleDates[i], rebalancePolicy) : null;
    var rebalance = rebalancePolicy === 'daily'
      || (rebalancePolicy !== 'buy-and-hold' && key != null && key !== previousKey && i > 0);
    if (rebalance) weights = targetWeights.slice();
    previousKey = key;
    var periodReturn = 0;
    for (var m = 0; m < memberSeries.length; m += 1) periodReturn += weights[m] * memberSeries[m].series[i];
    out.push(periodReturn);
    var drift = 0;
    for (var d = 0; d < weights.length; d += 1) { weights[d] = weights[d] * (1 + memberSeries[d].series[i]); drift += weights[d]; }
    if (drift > 0) for (var z = 0; z < weights.length; z += 1) weights[z] = weights[z] / drift;
  }
  return out;
}

/**
 * Build the declared RiskEstimate for one frozen composition snapshot.
 *
 * The estimate publishes BOTH scopes whenever they are computable —
 * whole-account and invested-sleeve are different titles, never one number
 * shown twice — and holds the scope it cannot honestly produce. 22:PFR02,
 * 22:PFR03, 22:PFR09 (W22-I).
 */
export function deriveRiskEstimate(input) {
  input = input || {};
  var snapshot = input.snapshot;
  if (!snapshot || snapshot.status === 'blocked' || !snapshot.compositionSnapshotId) {
    return {
      status: 'blocked',
      code: (snapshot && snapshot.blocked && snapshot.blocked.code) || 'composition-snapshot-unavailable',
      estimateId: null,
      wholeAccountReturns: null,
      investedSleeveReturns: null,
      publishedReturns: null,
      publishedScope: null
    };
  }
  var exposureHistoryMode = input.exposureHistoryMode;
  if (EXPOSURE_HISTORY_MODES.indexOf(exposureHistoryMode) === -1) {
    return { status: 'blocked', code: 'exposure-history-mode-required', estimateId: null, publishedScope: null };
  }
  if (exposureHistoryMode === 'actual_account_history' && !(input.accountHistory && Array.isArray(input.accountHistory.transactions))) {
    // Holdings/cashflow history is the only route to an actual-path result.
    // Copying current quantities into the past is exactly what must not happen.
    return { status: 'blocked', code: 'account-history-unavailable', estimateId: null, publishedScope: null };
  }
  if (exposureHistoryMode !== 'current_composition_retrospective' && exposureHistoryMode !== 'fixed_target_weight_strategy') {
    return { status: 'blocked', code: 'exposure-path-not-wired', estimateId: null, publishedScope: null };
  }
  var strategyPath = exposureHistoryMode === 'fixed_target_weight_strategy';
  var rebalancePolicy = input.rebalancePolicy;
  // P1197: 리밸런싱 정책은 전략 경로에서만 소비된다. 현재 구성 소급 경로에서는 결과를 바꾸지 않으므로
  // (a) 없는 것을 요구해 막지 않고, (b) 정체성 해시에도 넣지 않는다 — 같은 입력이 정책 문자열 때문에
  // 다른 estimateId를 받으면 재현·비교가 깨진다. 선언 여부와 적용 여부를 각각 발행한다.
  var declaredRebalancePolicy = typeof rebalancePolicy === 'string' && rebalancePolicy ? rebalancePolicy : null;
  if (!declaredRebalancePolicy) {
    if (strategyPath) return { status: 'blocked', code: 'rebalance-policy-required', estimateId: null, publishedScope: null };
    rebalancePolicy = null;
  }
  var rebalancePolicyApplied = strategyPath;

  var returnsMap = input.returnsMap || {};
  var memberSeries = snapshot.members.map(function(member) {
    var series = returnsMap[member.ticker];
    if (!Array.isArray(series)) return { ticker: member.ticker, series: null };
    return { ticker: member.ticker, series: series, marketValue: member.marketValue, resolvedWeight: member.resolvedWeight };
  });
  var misaligned = memberSeries.filter(function(entry) { return !entry.series; }).map(function(entry) { return entry.ticker; });
  if (misaligned.length) {
    return { status: 'blocked', code: 'member-return-series-missing', members: misaligned, estimateId: null, publishedScope: null };
  }

  var sampleDates = Array.isArray(input.sampleDates) ? input.sampleDates.slice() : null;
  var n = memberSeries[0].series.length;
  if (sampleDates && sampleDates.length !== n) {
    return { status: 'blocked', code: 'sample-window-misaligned', estimateId: null, publishedScope: null };
  }
  var lengthMismatch = memberSeries.filter(function(entry) { return entry.series.length !== n; }).map(function(entry) { return entry.ticker; });
  if (lengthMismatch.length || n < 1) {
    return { status: 'blocked', code: lengthMismatch.length ? 'member-return-series-misaligned' : 'empty-sample', members: lengthMismatch, estimateId: null, publishedScope: null };
  }

  // Invested sleeve: retrospective uses the frozen current composition weights;
  // the fixed-target-weight strategy path uses declared target weights that are
  // rebalanced per policy. Cash never dilutes either silently.
  var sleeveWeights;
  var strategyDeclaration = null;
  var equityDenominator = snapshot.equityValue;
  if (strategyPath) {
    if (STRATEGY_REBALANCE_POLICIES.indexOf(rebalancePolicy) === -1) {
      return { status: 'blocked', code: 'strategy-rebalance-policy-unrecognized', estimateId: null, publishedScope: null };
    }
    var resolved = _pfResolveStrategyWeights(input.targetWeights, memberSeries);
    if (!resolved) {
      return { status: 'blocked', code: 'strategy-target-weights-invalid', estimateId: null, publishedScope: null };
    }
    if ((rebalancePolicy === 'monthly' || rebalancePolicy === 'quarterly') && !sampleDates) {
      return { status: 'blocked', code: 'strategy-rebalance-window-required', estimateId: null, publishedScope: null };
    }
    sleeveWeights = resolved.weights;
    strategyDeclaration = { targetWeights: resolved.targetWeights, targetWeightSum: resolved.sum, cashWeight: resolved.cashWeight };
  } else {
    sleeveWeights = memberSeries.map(function(entry) { return entry.marketValue / snapshot.equityValue; });
  }
  var investedSleeveReturns = strategyPath
    ? _pfStrategyPathReturns(memberSeries, sleeveWeights, rebalancePolicy, sampleDates)
    : _pfWeightedSleeveReturns(memberSeries, sleeveWeights);

  var cashAmount = snapshot.cash && typeof snapshot.cash.amount === 'number' && isFinite(snapshot.cash.amount) && snapshot.cash.amount >= 0
    ? snapshot.cash.amount : 0;
  var cashResolved = _pfCashDailyRate(input.cashReturn);
  var wholeAccountReturns = null;
  var wholeAccountHold = null;
  var cashTreatment = null;
  if (strategyPath && strategyDeclaration.cashWeight > 0) {
    // P1200: 목표비중이 현금을 포함해 선언됐다면 계좌 범위도 선언된 것이다 — 현금 수익률이
    // 있어야만 그 몫을 채운다(없으면 계좌 보기를 보류하고 sleeve만 게시).
    if (!cashResolved) {
      cashTreatment = 'excluded_by_scope';
      wholeAccountHold = 'cash-return-unresolved';
    } else {
      cashTreatment = 'declared_strategy_cash_weight';
      var declaredCashWeight = strategyDeclaration.cashWeight;
      wholeAccountReturns = [];
      for (var ws = 0; ws < n; ws += 1) {
        var sleeveReturn = 0;
        for (var ms = 0; ms < memberSeries.length; ms += 1) {
          sleeveReturn += sleeveWeights[ms] * memberSeries[ms].series[ws];
        }
        var declaredCashReturn = cashResolved.mode === 'explicit_assumption' ? cashResolved.dailyRate : cashResolved.series[ws];
        wholeAccountReturns[ws] = sleeveReturn + declaredCashWeight * declaredCashReturn;
      }
    }
  } else if (strategyPath) {
    // A hypothetical strategy declares its sleeve allocation, not the account's
    // cash plan — publish the sleeve path and hold the account view explicitly.
    cashTreatment = 'strategy-path-sleeve-only';
    wholeAccountHold = 'strategy-account-scope-not-declared';
  } else if (cashAmount === 0) {
    cashTreatment = 'zero-cash';
    wholeAccountReturns = investedSleeveReturns.slice();
  } else if (!snapshot.cashDeclared) {
    cashTreatment = 'excluded_by_scope';
    wholeAccountHold = 'cash-declaration-unresolved';
  } else if (!cashResolved) {
    cashTreatment = 'excluded_by_scope';
    wholeAccountHold = 'cash-return-unresolved';
  } else {
    cashTreatment = cashResolved.mode === 'explicit_assumption' ? 'explicit_assumption' : 'observed_cash_series';
    var denominator = snapshot.resolvedWeightDenominator != null && snapshot.weightBasis === 'whole_account'
      ? snapshot.resolvedWeightDenominator : equityDenominator + cashAmount;
    var cashWeight = cashAmount / denominator;
    wholeAccountReturns = [];
    for (var w = 0; w < n; w += 1) {
      var total = 0;
      for (var q = 0; q < memberSeries.length; q += 1) {
        total += (memberSeries[q].marketValue / denominator) * memberSeries[q].series[w];
      }
      var cashComponent = cashResolved.mode === 'explicit_assumption'
        ? cashWeight * cashResolved.dailyRate
        : cashWeight * cashResolved.series[w];
      wholeAccountReturns[w] = total + cashComponent;
    }
  }

  var rfProvided = input.rfAnnual != null;
  var rfAccepted = typeof input.rfAnnual === 'number' && isFinite(input.rfAnnual) && input.rfAnnual > -1 && input.rfAnnual <= 1;
  var rf = {
    status: rfProvided && !rfAccepted ? 'invalid-rejected' : !rfProvided ? 'not-supplied' : 'accepted',
    annualRate: rfAccepted ? input.rfAnnual : null,
    unit: 'decimal'
  };

  var publishedScope = wholeAccountReturns ? 'whole_account' : 'invested_sleeve';
  var publishedReturns = publishedScope === 'whole_account' ? wholeAccountReturns : investedSleeveReturns;

  var identityPayload = {
    compositionSnapshotId: snapshot.compositionSnapshotId,
    exposureHistoryMode: exposureHistoryMode,
    // P1197: 소비되지 않는 선언은 정체성에 넣지 않는다 — 결과를 바꾸지 않는 입력이 id를 바꾸면
    // 재현·비교가 깨진다.
    rebalancePolicy: rebalancePolicyApplied ? rebalancePolicy : null,
    publishedScope: publishedScope,
    cashTreatment: cashTreatment,
    wholeAccountHold: wholeAccountHold,
    rf: rf,
    sampleDates: sampleDates,
    n: n,
    strategy: strategyDeclaration,
    returns: snapshot.members.map(function(member) { return [member.ticker, returnsMap[member.ticker]]; })
  };

  var warnings = [];
  if (exposureHistoryMode === 'current_composition_retrospective') {
    warnings.push('현재 구성을 과거 시장 경로에 적용한 가상 분석입니다 — 계좌의 실제 과거 성과·위험이 아닙니다.');
  }
  if (strategyPath) {
    warnings.push('고정 목표비중 전략 경로(가상)입니다 — 목표비중을 ' + rebalancePolicy + ' 정책으로 리밸런싱했다고 가정한 결과이며 실제 계좌 성과가 아닙니다.');
  } else if (declaredRebalancePolicy) {
    warnings.push('선언된 리밸런싱 정책(' + declaredRebalancePolicy + ')은 현재 구성 소급 경로에서 쓰이지 않습니다 — 결과에 영향이 없습니다.');
  }
  if (wholeAccountHold === 'cash-declaration-unresolved') {
    warnings.push('현금 통화가 선언되지 않아 계좌 전체 위험을 계산하지 않습니다 — 주식 부분(invested sleeve) 결과만 게시합니다.');
  } else if (wholeAccountHold === 'cash-return-unresolved') {
    warnings.push('현금 수익률이 입력되지 않아 계좌 전체 위험을 보류합니다 — 주식 부분(invested sleeve) 결과만 게시합니다.');
  } else if (wholeAccountHold === 'strategy-account-scope-not-declared') {
    warnings.push('전략 경로는 계좌 전체 현금 계획을 선언하지 않았으므로 계좌 범위를 게시하지 않습니다 — 주식 부분(invested sleeve) 결과만 게시합니다.');
  }

  return {
    status: 'ready',
    estimateId: 'pfre-' + _pfContentHash(_pfStableStringify(identityPayload)),
    model: 'AIO_PORTFOLIO_RISK_ESTIMATE_V1',
    compositionSnapshotId: snapshot.compositionSnapshotId,
    compositionAsOf: snapshot.compositionAsOf,
    valuationCut: snapshot.valuationCut,
    exposureHistoryMode: exposureHistoryMode,
    // P1197: `rebalancePolicy`는 **적용된** 값이다(회고 경로는 null) — 무엇이 선언됐고 무엇이 쓰였는지를
    // 따로 발행해야 소비자가 "선언했는데 결과가 그대로"인 상태를 구분할 수 있다.
    rebalancePolicy: rebalancePolicyApplied ? rebalancePolicy : null,
    rebalancePolicyDeclared: declaredRebalancePolicy,
    rebalancePolicyApplied: rebalancePolicyApplied,
    pathLineage: strategyPath ? 'fixed-target-weight-strategy' : exposureHistoryMode === 'current_composition_retrospective' ? 'legacy-risk-path' : null,
    strategy: strategyDeclaration,
    publishedScope: publishedScope,
    wholeAccountReturns: wholeAccountReturns,
    investedSleeveReturns: investedSleeveReturns,
    publishedReturns: publishedReturns,
    cashTreatment: cashTreatment,
    wholeAccountHold: wholeAccountHold,
    scope: {
      equityValue: snapshot.equityValue,
      cashAmount: cashAmount,
      equityWeight: snapshot.equityWeight,
      cashWeight: snapshot.cashWeight
    },
    rf: rf,
    sample: {
      n: n,
      start: sampleDates && sampleDates.length ? sampleDates[0] : null,
      end: sampleDates && sampleDates.length ? sampleDates[sampleDates.length - 1] : null
    },
    warnings: warnings
  };
}

const ACCOUNT_LEDGER_INPUTS = ['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts'];
const ACCOUNT_LEDGER_KINDS = ['deposit', 'withdrawal', 'trade', 'dividend', 'fee', 'tax', 'split', 'fx'];

// Bisection over the money-weighted discount rate: NPV(r) = Σ CF_k / (1+r)^y_k.
// Deposits are money the investor paid in (negative), withdrawals and the
// terminal value positive. A bracketing failure is a hold, never a fabricated 0.
function _pfIrr(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  if (!cashflows.some(function(cf) { return cf.amount > 0; }) || !cashflows.some(function(cf) { return cf.amount < 0; })) return null;
  function npv(rate) {
    var total = 0;
    for (var i = 0; i < cashflows.length; i += 1) total += cashflows[i].amount / Math.pow(1 + rate, cashflows[i].years);
    return total;
  }
  var low = -0.9999;
  var high = 10;
  var lowValue = npv(low);
  var highValue = npv(high);
  if (!isFinite(lowValue) || !isFinite(highValue)) return null;
  if (lowValue === 0) return low;
  if (highValue === 0) return high;
  if (lowValue * highValue > 0) return null;
  for (var iteration = 0; iteration < 200; iteration += 1) {
    var mid = (low + high) / 2;
    var midValue = npv(mid);
    if (!isFinite(midValue)) return null;
    if (lowValue * midValue <= 0) { high = mid; highValue = midValue; } else { low = mid; lowValue = midValue; }
  }
  return (low + high) / 2;
}

/**
 * Account performance (TWR/MWR) is a ledger claim, not a portfolio-shape
 * claim: without period trades, cashflows, corporate actions and valuation
 * cuts there is nothing to link returns around. 22 Account performance, E4
 * acceptance "실제 원장 없으면 account TWR/MWR 보류".
 *
 * A ledger with transactions but no declared coverage/conventions/marks cannot
 * be turned into a return either — each missing input is its own hold.  A flow
 * at a valuation boundary belongs to the period ENDING there under
 * 'end-of-period' and to the period STARTING there under 'start-of-period',
 * so the timing is a declared input rather than an assumption.
 */
export function assessAccountPerformance(input) {
  var ledger = input && input.ledger;
  var requiredInputs = ACCOUNT_LEDGER_INPUTS.slice();
  var blocked = function(code, message) {
    return { status: 'blocked', code: code, twr: null, mwr: null, irr: null, requiredInputs: requiredInputs, message: message };
  };
  if (!ledger || !Array.isArray(ledger.transactions) || !ledger.transactions.length) {
    return blocked('ledger-not-available', '실제 계좌 성과(TWR/MWR)는 거래·입출금 원장 없이 계산하지 않습니다.');
  }
  var coverage = ledger.coverage && typeof ledger.coverage === 'object' ? ledger.coverage : {};
  var missingInputs = requiredInputs.filter(function(name) { return coverage[name] !== true; });
  if (missingInputs.length) return blocked('account-input-incomplete', '원장이 필수 입력을 선언하지 않았습니다: ' + missingInputs.join(', '));

  var currency = ledger.currency != null ? String(ledger.currency) : null;
  var dayCount = ledger.dayCount != null ? String(ledger.dayCount) : null;
  var flowTiming = ledger.flowTiming;
  if (!currency || dayCount !== 'actual-365' || (flowTiming !== 'start-of-period' && flowTiming !== 'end-of-period')) {
    return blocked('account-convention-required', '계좌 성과는 통화·dayCount(actual-365)·현금흐름 시점(start-of-period|end-of-period)을 선언해야 계산합니다.');
  }

  var valuations = (Array.isArray(ledger.valuations) ? ledger.valuations : [])
    .map(function(mark) { return { date: mark && mark.date != null ? String(mark.date) : null, amount: mark && mark.amount != null ? Number(mark.amount) : null }; })
    .filter(function(mark) { return mark.date != null && isFinite(mark.amount); });
  if (valuations.length < 2) return blocked('account-valuation-marks-required', '기간 평가액(valuation marks)이 2개 미만이라 TWR/MWR를 계산하지 않습니다.');
  if (!valuations.every(function(mark, index) { return index === 0 || valuations[index - 1].date < mark.date; })) {
    return blocked('account-valuation-marks-unordered', '기간 평가액 날짜가 오름차순이 아니어서 기간 수익률을 연결하지 않습니다.');
  }
  if (valuations.some(function(mark) { return !(mark.amount > 0); })) return blocked('account-valuation-nonpositive', '0 이하 평가액이 있어 기간 수익률이 정의되지 않습니다.');

  var transactions = Array.isArray(ledger.transactions) ? ledger.transactions : [];
  var unknownKinds = [];
  transactions.forEach(function(tx) {
    var kind = tx && tx.kind != null ? String(tx.kind) : null;
    if (kind == null || ACCOUNT_LEDGER_KINDS.indexOf(kind) === -1) unknownKinds.push(String(kind));
  });
  if (unknownKinds.length) return blocked('account-ledger-kind-unrecognized', '원장에 인식되지 않는 거래 종류가 있습니다: ' + Array.from(new Set(unknownKinds)).join(', '));

  var flows = transactions
    .map(function(tx) { return { date: tx && tx.date != null ? String(tx.date) : null, kind: tx && tx.kind != null ? String(tx.kind) : null, amount: tx && tx.amount != null ? Number(tx.amount) : null }; })
    .filter(function(tx) { return tx.date != null && isFinite(tx.amount) && tx.amount >= 0 && (tx.kind === 'deposit' || tx.kind === 'withdrawal') });
  var netFlowIn = function(period) {
    var total = 0;
    flows.forEach(function(tx) {
      var inWindow = flowTiming === 'start-of-period'
        ? (tx.date >= period.from && tx.date < period.to)
        : (tx.date > period.from && tx.date <= period.to);
      if (inWindow) total += tx.kind === 'deposit' ? tx.amount : -tx.amount;
    });
    return total;
  };

  var periods = [];
  var growth = 1;
  for (var i = 1; i < valuations.length; i += 1) {
    var previous = valuations[i - 1];
    var current = valuations[i];
    var netFlow = netFlowIn({ from: previous.date, to: current.date });
    var denominator = flowTiming === 'start-of-period' ? previous.amount + netFlow : previous.amount;
    var numerator = flowTiming === 'start-of-period' ? current.amount : current.amount - netFlow;
    if (!(denominator > 0)) return blocked('account-period-return-undefined', '한 기간의 시작 자본이 0 이하라 기간 수익률이 정의되지 않습니다.');
    var periodReturn = numerator / denominator - 1;
    if (!isFinite(periodReturn)) return blocked('account-period-return-undefined', '기간 수익률이 정의되지 않아 TWR을 연결하지 않습니다.');
    growth *= (1 + periodReturn);
    periods.push({ start: previous.date, end: current.date, startValue: previous.amount, endValue: current.amount, netFlow: netFlow, periodReturn: periodReturn });
  }
  var twr = growth - 1;

  var firstDate = valuations[0].date;
  var lastDate = valuations[valuations.length - 1].date;
  var startMs = Date.parse(firstDate + 'T00:00:00Z');
  var endMs = Date.parse(lastDate + 'T00:00:00Z');
  if (!isFinite(startMs) || !isFinite(endMs)) return blocked('account-valuation-date-unparseable', '평가액 날짜를 해석할 수 없어 기간 길이를 계산하지 않습니다.');
  var yearFraction = function(date) {
    var point = Date.parse(String(date) + 'T00:00:00Z');
    if (!isFinite(point)) return null;
    return (point - startMs) / (365 * 24 * 60 * 60 * 1000);
  };
  var terminalYears = yearFraction(lastDate);
  var cashflows = [{ years: 0, amount: -valuations[0].amount }];
  var flowResolvable = true;
  flows.forEach(function(tx) {
    if (tx.date <= firstDate || tx.date > lastDate) return;
    var years = yearFraction(tx.date);
    if (years == null) { flowResolvable = false; return; }
    cashflows.push({ years: years, amount: tx.kind === 'deposit' ? -tx.amount : tx.amount });
  });
  cashflows.push({ years: terminalYears, amount: valuations[valuations.length - 1].amount });
  if (!flowResolvable || terminalYears == null) return blocked('account-flow-date-unparseable', '원장 거래 날짜를 해석할 수 없어 MWR를 계산하지 않습니다.');
  var mwr = _pfIrr(cashflows);

  var warnings = [];
  if (mwr == null) warnings.push('MWR(금액가중수익률)은 구간 내 부호 변화가 없어 계산하지 않았습니다 — TWR만 게시합니다.');

  return {
    status: 'ready',
    model: 'AIO_PORTFOLIO_ACCOUNT_PERFORMANCE_V1',
    twr: twr,
    mwr: mwr,
    irr: mwr,
    mwrHold: mwr == null ? 'account-irr-not-bracketed' : null,
    currency: currency,
    dayCount: dayCount,
    flowTiming: flowTiming,
    periods: periods,
    sample: { from: firstDate, to: lastDate, periods: periods.length, years: terminalYears },
    conventions: { returnBasis: 'time-weighted-subperiod-chain', flowTiming: flowTiming, annualization: 'actual-365', irrMethod: 'bisection' },
    requiredInputs: requiredInputs,
    warnings: warnings
  };
}

export { _pfStableStringify, _pfContentHash };
