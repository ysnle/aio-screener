/**
 * Portfolio monthly backtest engine.
 *
 * Native ESM owner for the reference-only adjusted-close research calculation.
 * The app bootstrap installs the classic-shell compatibility binding.
 */
import { convertWithDeclaredRates, FX_LEG_MAX_AGE_MS } from './fx.js';

function _cleanCurrencyCode(value) {
  const text = String(value == null ? '' : value).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
}

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

// ── 22:PFR05 (E4) sample-stability verification ──────────────────────────────
// VaR/CVaR may be trusted only when the sample is stable and the estimate is
// insensitive to the estimator chosen. The bootstrap derives its seed from the
// sample itself, so the same input replays the same band (R630) without a clock
// or Math.random. Sensitivity re-estimates on the same sample with other rules.
// The thresholds travel with the result — a certification without a declared
// threshold is the same unbacked claim the hold replaced.
function _btFnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

function _btMulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _btTailRisk(values, quantile) {
  const sorted = values.slice().sort((a, b) => a - b);
  const cut = _quantileR7(sorted, quantile);
  const tail = sorted.filter((value) => value <= cut);
  return {
    var: Math.max(0, -cut),
    cvar: tail.length ? Math.max(0, -_statMean(tail)) : null,
    tailN: tail.length,
    cut
  };
}

// P1243: the `recent-half` sensitivity variant reads the sample's second half *in the order given*, so
// it is only meaningful for a time-ordered sample. P1203 fixed the caller that passed a sorted sample,
// but the function still assumed that contract instead of verifying it. A dated sample is now checked
// for non-decreasing observation time; otherwise the caller must declare `order: 'chronological'`. An
// unverified order withholds the variant and holds certification, so the assumption cannot silently
// return.
function _btVarOrderAudit(values, order, observedAt) {
  const stamps = Array.isArray(observedAt)
    ? observedAt.map((value) => (Number.isFinite(Number(value)) ? Number(value) : null))
    : null;
  if (stamps && stamps.length === values.length && stamps.every((value) => value != null)) {
    for (let i = 1; i < stamps.length; i += 1) if (stamps[i] < stamps[i - 1]) return { state: 'violated', usable: false };
    return { state: 'verified', usable: true };
  }
  return order === 'chronological' ? { state: 'declared', usable: true } : { state: 'undeclared', usable: false };
}

export function deriveVarStability({ returns = [], iterations = 400, quantile = 0.05, thresholds = {}, order = 'unspecified', observedAt = null } = {}) {
  const clean = (Array.isArray(returns) ? returns : []).filter((value) => typeof value === 'number' && isFinite(value));
  const declared = {
    minSampleN: Number.isFinite(thresholds.minSampleN) ? thresholds.minSampleN : 36,
    minTailN: Number.isFinite(thresholds.minTailN) ? thresholds.minTailN : 3,
    maxRelativeBand: Number.isFinite(thresholds.maxRelativeBand) ? thresholds.maxRelativeBand : 0.75,
    maxRelativeSensitivity: Number.isFinite(thresholds.maxRelativeSensitivity) ? thresholds.maxRelativeSensitivity : 0.5
  };
  if (clean.length < 2) {
    return { status: 'unavailable', reason: 'insufficient-sample', sampleN: clean.length, thresholds: declared, certification: 'held', certificationReasons: ['sample-below-declared-minimum'] };
  }
  const point = _btTailRisk(clean, quantile);

  const random = _btMulberry32(_btFnv1a(clean.map((value) => Number(value).toFixed(8)).join(',')));
  const varSamples = [];
  const draws = Math.max(1, Math.floor(iterations));
  for (let i = 0; i < draws; i += 1) {
    const resample = new Array(clean.length);
    for (let j = 0; j < clean.length; j += 1) resample[j] = clean[Math.floor(random() * clean.length)];
    varSamples.push(_btTailRisk(resample, quantile).var);
  }
  const sortedVars = varSamples.slice().sort((a, b) => a - b);
  const band = { p05: _quantileR7(sortedVars, 0.05), median: _quantileR7(sortedVars, 0.5), p95: _quantileR7(sortedVars, 0.95) };
  const relativeBand = point.var > 0 ? (band.p95 - band.p05) / point.var : null;

  const orderAudit = _btVarOrderAudit(clean, order, observedAt);
  const ascending = clean.slice().sort((a, b) => a - b);
  const nearestIndex = Math.max(0, Math.min(ascending.length - 1, Math.ceil(quantile * ascending.length) - 1));
  const variants = [
    { id: 'nearest-rank', var: Math.max(0, -ascending[nearestIndex]) },
    { id: 'leave-one-worst-out', var: ascending.length > 2 ? _btTailRisk(ascending.slice(1), quantile).var : null },
    { id: 'recent-half', var: orderAudit.usable && clean.length >= 4 ? _btTailRisk(clean.slice(Math.floor(clean.length / 2)), quantile).var : null }
  ].filter((entry) => entry.var != null && isFinite(entry.var))
    .map((entry) => ({ id: entry.id, var: entry.var, deviation: entry.var - point.var }));
  const maxAbsDeviation = variants.length ? Math.max.apply(null, variants.map((entry) => Math.abs(entry.deviation))) : null;
  const relativeSensitivity = point.var > 0 && maxAbsDeviation != null ? maxAbsDeviation / point.var : null;

  const reasons = [];
  if (clean.length < declared.minSampleN) reasons.push('sample-below-declared-minimum');
  if (point.tailN < declared.minTailN) reasons.push('tail-below-declared-minimum');
  if (relativeBand == null || relativeBand > declared.maxRelativeBand) reasons.push('bootstrap-band-exceeds-declared-maximum');
  if (relativeSensitivity == null || relativeSensitivity > declared.maxRelativeSensitivity) reasons.push('estimator-sensitivity-exceeds-declared-maximum');
  if (!orderAudit.usable) reasons.push(`recent-half-order-${orderAudit.state}`);

  return {
    status: 'ready',
    quantile,
    sampleN: clean.length,
    tailN: point.tailN,
    point: { var: point.var, cvar: point.cvar },
    bootstrap: { iterations: draws, seed: 'sample-derived-fnv1a', band, relativeBand },
    sensitivity: { variants, maxAbsDeviation, relativeSensitivity, recentHalfOrder: orderAudit.state },
    thresholds: declared,
    certification: reasons.length ? 'held' : 'certified',
    certificationReasons: reasons
  };
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

// ── P1259 (QA-FX-SERIES): 기준 통화 수익률 — 월말 관측 FX 시계열 ─────────────────────────────────
// 현지 통화 수익률과는 **다른 결과**다. 월말 정렬 계약: 월 키(YYYY-MM)의 마지막 관측이 그 달의
// 월말 관측이고, 관측이 없는 달 경계는 미관측이다. 미관측·미보유 통화쌍은 추정하지 않고 해당 월을
// 보류한다(0 채우기·보간·삼각 환산 금지 — P1194/P1247과 같은 규칙).
function _aioBtFxMonthEndSeries(fxSeries) {
  var raw = fxSeries && fxSeries.usdkrw;
  if (!raw) return null;
  var byMonth = {};
  var push = function(ts, value) {
    var v = _aioBtFinite(value);
    var key = _aioBtMonthKeyFromTs(ts);
    var ms = _aioBtTimestampMs(ts);
    if (!key || ms == null || v == null || v <= 0) return;
    var prev = byMonth[key];
    if (!prev || ms > prev.observedMs) {
      byMonth[key] = { value: v, observedMs: ms, observedAt: new Date(ms).toISOString().slice(0, 10) };
    }
  };
  if (Array.isArray(raw.timestamps) && Array.isArray(raw.closes)) {
    for (var i = 0; i < Math.min(raw.timestamps.length, raw.closes.length); i++) push(raw.timestamps[i], raw.closes[i]);
  } else if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach(function(date) { push(date, raw[date]); });
  }
  return Object.keys(byMonth).length ? byMonth : null;
}

function _aioBtBaseCurrencyMonthlyReturns(input) {
  var monthlyRows = input.monthlyRows || [];
  var currencyByTicker = input.currencyByTicker || {};
  var baseCurrency = input.baseCurrency || null;
  var needsConversion = !!input.needsConversion;
  var startMonth = input.startMonth || (monthlyRows[0] && monthlyRows[0].month) || null;
  var basis = 'base-currency-month-end-fx';
  var label = '기준 통화 수익률(월말 FX 정렬)';
  var build = function(status, reason, months) {
    return {
      status: status, reason: reason || null,
      returnCurrencyBasis: basis,
      fxTranslation: needsConversion ? 'month-end-observed-series' : 'not-applicable',
      fxSeriesKey: needsConversion ? 'usdkrw' : null,
      fxAlignmentBasis: 'last-observation-within-calendar-month',
      baseCurrency: baseCurrency,
      label: label,
      months: months || [],
      disclosure: status === 'ready'
        ? label + ' — 현지 통화 수익률과 다른 결과입니다(같은 수로 읽지 마세요).'
        : label + ' 보류 — ' + (reason || 'fx-unavailable') + ' (추정하지 않음)'
    };
  };
  if (!needsConversion) {
    return build('ready', null, monthlyRows.map(function(r) { return { month: r.month, return: r.return, held: null, fxUsed: [] }; }));
  }
  if (!baseCurrency) return build('held', 'base-currency-undeclared');
  var fxByMonth = _aioBtFxMonthEndSeries(input.fxSeries);
  if (!fxByMonth) return build('held', 'fx-series-missing');
  var months = [];
  monthlyRows.forEach(function(row, idx) {
    var month = row.month;
    var prevMonth = idx === 0 ? startMonth : monthlyRows[idx - 1].month;
    var weighted = 0;
    var held = null;
    var fxUsed = [];
    Object.keys(row.assetReturns || {}).forEach(function(t) {
      if (held) return;
      var rLocal = Number(row.assetReturns[t]);
      if (!isFinite(rLocal)) { held = 'member-return-missing:' + t; return; }
      var w = row.realizedWeights && typeof row.realizedWeights[t] === 'number' ? row.realizedWeights[t] : 0;
      var pc = (currencyByTicker[t] && currencyByTicker[t].price) || null;
      if (!pc || pc === baseCurrency) { weighted += w * rLocal; return; }
      var isKrwUsd = (pc === 'KRW' && baseCurrency === 'USD') || (pc === 'USD' && baseCurrency === 'KRW');
      if (!isKrwUsd) { held = 'fx-series-missing:' + pc + '/' + baseCurrency; return; }
      var nowFx = fxByMonth[month], prevFx = fxByMonth[prevMonth];
      if (!nowFx || !prevFx) { held = 'fx-month-observation-missing:' + (!prevFx ? prevMonth : month); return; }
      var factor = pc === 'KRW' ? prevFx.value / nowFx.value : nowFx.value / prevFx.value;
      weighted += w * ((1 + rLocal) * factor - 1);
      fxUsed.push({ ticker: t, currency: pc, pair: pc + '/' + baseCurrency, observedAt: nowFx.observedAt, value: nowFx.value, startObservedAt: prevFx.observedAt, startValue: prevFx.value });
    });
    months.push({ month: month, return: held ? null : weighted, held: held, fxUsed: fxUsed });
  });
  return build('ready', null, months);
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
  // P1252 (BT-01): 원가(cost) 필터 제거 — 원가는 이 경로의 어떤 계산에도 쓰이지 않으므로 멤버
  // 집합을 가를 자격이 없다. qty>0·cost 미신고 보유(증여·스핀오프·이전 롯)를 조용히 빼고 비중을
  // 재분배하는 것은 22:PFR08의 "누락 데이터 = 커버리지 공백, 제외 아님" 계약을 우회한다.
  // 미신고 원가는 결과의 공개 필드(missingCostMembers)로만 남는다.
  var raw = (positions || []).filter(function(p) {
    return p && p.ticker && Number(p.qty) > 0;
  }).map(function(p) {
    return {
      ticker: String(p.ticker).trim().toUpperCase(), qty: Number(p.qty),
      targetWeight: typeof p.targetWeight === 'number' && isFinite(p.targetWeight) && p.targetWeight >= 0 ? p.targetWeight : null,
      // P1252 (BT-01): 원가 선언 여부는 공개용 — 계산 입력이 아니다.
      costDeclared: Number(p.cost) > 0,
      // E3/P1181 + E4/P1247: 원가 통화와 시세 통화는 다른 축이다. 랩은 두 축을 각각 환산해야 하므로
      // 표시용 이름 하나로 뭉개지 않고 둘 다 보존한다(surface.js가 같은 구분을 쓴다).
      costCurrency: _cleanCurrencyCode(p.costCurrency),
      priceCurrency: _cleanCurrencyCode(p.currency || p.priceCurrency)
    };
  });
  var byTicker = {};
  var byTickerQty = {};
  var byTickerTargetWeight = {};
  raw.forEach(function(p) {
    // P1247: 멤버 집합만 필요하다. 종전에는 `qty × cost`를 여기서 통화 구분 없이 누적했지만, 그 합계는
    // KRW 금액과 USD 금액을 1:1로 더한 값이라 실행 여부 판단에도 쓸 수 없다 — 그 용도는 아래에서
    // 기준 통화로 환산된 시작 시점 시장가치가 맡는다.
    byTicker[p.ticker] = true;
    byTickerQty[p.ticker] = (byTickerQty[p.ticker] || 0) + p.qty;
    if (p.targetWeight != null) byTickerTargetWeight[p.ticker] = (byTickerTargetWeight[p.ticker] || 0) + p.targetWeight;
  });
  var tickers = Object.keys(byTicker).filter(function(t) { return priceMap && priceMap[t]; });
  // 22:PFR08/R24-05 (E3): a held member whose price series is missing is a coverage gap, not an
  // exclusion. Dropping it above silently renormalized every remaining member (AAA 100% from a
  // 2-member intent), converting a provider miss into the user's exclusion decision.
  var intendedTickers = Object.keys(byTicker);
  // P1252 (BT-01): 미신고 원가 멤버는 제외하지 않고 공개만 한다.
  var missingCostMembers = intendedTickers.filter(function(t) {
    return !raw.some(function(p) { return p.ticker === t && p.costDeclared; });
  });
  var missingPriceMembers = intendedTickers.filter(function(t) { return !(priceMap && priceMap[t]); });
  if (missingPriceMembers.length) {
    return {
      ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
      decisionEligible: false, promotionEligible: false,
      promotionBlockers: ['member-price-coverage-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
      reason: 'member price series missing',
      model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
      priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
      allocationBlocked: { code: 'member-price-series-missing', members: missingPriceMembers.slice(), intended: intendedTickers.slice() },
      warnings: ['가격 이력이 없어 실행을 보류합니다: ' + missingPriceMembers.join(', ') + '.', '보유 멤버를 제외 의도로 간주해 재분배하지 않습니다 — 새 정의로 명시하거나 가격 이력을 채운 뒤 다시 실행하세요.']
    };
  }
  if (!tickers.length) return { ok: false, reason: 'no valid portfolio price series', warnings: ['가격 이력이 있는 포지션이 없습니다.'] };

  // ── P1247 (E3/E4): 통화축 ───────────────────────────────────────────────────────────────────
  // 구성은 환산 주장이다. `qty × 시작가`는 각 멤버의 **자기 통화**로 표시된 시장가치이므로 통화가 다르면
  // 1:1로 더할 수 없다 — 평가 화면(surface.js)이 이미 거부하는 "통화 없는 합산"이고, KRW와 USD 금액을
  // 그대로 더하면 원/달러 규모 차가 비중을 지배한다. 평가 경로와 **같은** `convertWithDeclaredRates`
  // 계약(선언된 관측 leg·컷 이후 관측·선언 창)만 쓰고, 환산할 수 없으면 추정하지 않고 보류한다.
  var baseCurrency = _cleanCurrencyCode(options.baseCurrency);
  var fxLegs = Array.isArray(options.fxLegs) ? options.fxLegs : [];
  var asOfMs = Number.isFinite(Number(options.asOfMs)) ? Number(options.asOfMs) : Date.now();
  var currencyByTicker = {};
  raw.forEach(function(p) {
    if (!currencyByTicker[p.ticker]) currencyByTicker[p.ticker] = { price: null, cost: null };
    if (p.priceCurrency && !currencyByTicker[p.ticker].price) currencyByTicker[p.ticker].price = p.priceCurrency;
    if (p.costCurrency && !currencyByTicker[p.ticker].cost) currencyByTicker[p.ticker].cost = p.costCurrency;
  });
  var memberCurrencies = tickers.reduce(function(acc, t) {
    var entry = currencyByTicker[t] || {};
    [entry.price, entry.cost].forEach(function(code) { if (code && acc.indexOf(code) < 0) acc.push(code); });
    return acc;
  }, []);
  var currencyAxis = {
    basis: memberCurrencies.length > 1 ? 'mixed' : memberCurrencies.length === 1 ? 'declared-single' : 'undeclared',
    baseCurrency: baseCurrency,
    memberCurrencies: memberCurrencies,
    asOfMs: new Date(asOfMs).toISOString(),
    maxAgeMs: FX_LEG_MAX_AGE_MS,
    applied: false,
    legs: [],
    held: []
  };
  // 통화를 선언하지 않은 단일 통화 포트폴리오는 종전과 같이 환산 없이 계산한다 — 그 가정은 축에 남는다.
  var needsConversion = memberCurrencies.length > 1
    || (baseCurrency != null && memberCurrencies.some(function(code) { return code !== baseCurrency; }));
  var toBaseCurrency = function(amount, currency, axisLabel) {
    if (amount == null) return amount;
    if (!needsConversion) return amount;
    // P1252 (BT-02): 미선언 통화를 `currency || baseCurrency`로 눕히지 않는다 — rate 1 암묵 통과는
    // "미확인 통화는 기준 통화라는 뜻이 아니다"라는 이 모듈의 불변식을 깬다. 추정하지 않고 보류한다.
    if (!currency) {
      if (!currencyAxis.held.some(function(entry) { return entry.reason === 'member-currency-undeclared' && entry.axis === axisLabel; })) {
        currencyAxis.held.push({ axis: axisLabel, currency: null, reason: 'member-currency-undeclared', pair: (baseCurrency || '?') + '(base)/?' });
      }
      return null;
    }
    var result = convertWithDeclaredRates({ value: amount, from: currency, to: baseCurrency, legs: fxLegs, asOfMs: asOfMs });
    if (!result.ok) {
      var pair = result.pair || ((currency || '?') + '/' + (baseCurrency || '?'));
      if (!currencyAxis.held.some(function(entry) { return entry.pair === pair && entry.reason === result.reason; })) {
        currencyAxis.held.push({ axis: axisLabel, currency: currency || null, reason: result.reason, pair: pair });
      }
      return null;
    }
    if (result.leg && !currencyAxis.legs.some(function(entry) {
      return entry.from === result.leg.from && entry.to === result.leg.to && entry.observedAt === result.leg.observedAt;
    })) {
      currencyAxis.legs.push({
        from: result.leg.from, to: result.leg.to, rate: result.leg.rate,
        observedAt: result.leg.observedAt, source: result.leg.source, inverted: result.inverted === true
      });
    }
    currencyAxis.applied = true;
    return result.value;
  };
  // 기준 통화·leg 부재는 **금액을 합치는 경로에서만** 치명적이다. 명시 목표비중은 단위 없는 비율이라
  // 환산 없이도 성립하므로, 필요하지 않은 곳에서 막지 않는다(과차단 금지). 그 경우에도 수익 기준이
  // 현지 통화 가중임은 계속 발행한다.
  var refuseCompositionConversion = function() {
    if (!needsConversion) return null;
    if (!baseCurrency) {
      currencyAxis.held = [{ axis: 'composition', currency: null, reason: 'base-currency-undeclared', pair: memberCurrencies.join('/') }];
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['currency-conversion-basis-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'base-currency-undeclared', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        currencyAxis: currencyAxis,
        allocationBlocked: { code: 'base-currency-undeclared', memberCurrencies: memberCurrencies.slice() },
        warnings: [
          '보유 멤버의 통화가 섞여 있어(' + memberCurrencies.join(', ') + ') 시작 시점 시장가치 비중에 기준 통화가 필요합니다.',
          '통화를 선언하지 않은 채 서로 다른 통화 금액을 1:1로 더하지 않았습니다 — 미확인 통화는 USD라는 뜻이 아닙니다.',
          '단위 없는 명시 목표비중을 입력하면 비중은 환산 없이도 성립합니다(수익률은 현지 통화 가중으로 표시).'
        ]
      };
    }
    if (!fxLegs.length) {
      currencyAxis.held = [{ axis: 'composition', currency: null, reason: 'rate-not-declared', pair: memberCurrencies.join('/') + '→' + baseCurrency }];
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['currency-conversion-basis-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'fx-rate-not-declared', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        currencyAxis: currencyAxis,
        allocationBlocked: { code: 'fx-rate-not-declared', baseCurrency: baseCurrency, memberCurrencies: memberCurrencies.slice() },
        warnings: [
          '기준 통화 ' + baseCurrency + '로 환산할 관측 rate leg가 선언되지 않았습니다.',
          'rate 없이 서로 다른 통화를 합산하지 않았습니다 — 포트폴리오 선언에서 FX leg(쌍·관측 rate·관측 시각)를 추가한 뒤 다시 실행하세요.'
        ]
      };
    }
    return null;
  };
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


  // 23:PFR07 (E3): allocation resolution owns its policy. The old path flipped "all specified"
  // to false on a sum of 0 WITHOUT updating the basis, then renormalized explicit exclusions
  // back in by market value while still reporting 'explicit-target-weight' — invalid input was
  // silently rewritten into a different policy with a lying provenance.
  //  - no weights at all: start-date market-value composition, honestly labeled. 22:PFR01 (E4)
  //    retires the period-END price fallback: a future terminal quote must never move the
  //    starting allocation, so the first common month's adjusted close seeds the weights.
  //  - any member unspecified (or all-specified sum ≠ 100): partial allocation → hold with
  //    member-level guidance; the remainder is never distributed implicitly.
  //  - sum 0: a cash-mode question, not a fallback trigger.
  var targetWeights = {};
  var targetWeightBasis = 'start-date-adjusted-close-market-value';
  // P1252 (BT-03): 원가 통화로 시세 값을 환산한 멤버 공개(명시 비중 경로에서는 비어 있다).
  var priceCurrencyInferredMembers = [];
  var specifiedTickers = tickers.filter(function(t) { return byTickerTargetWeight[t] != null; });
  var targetWeightDenominator = 0;
  if (!specifiedTickers.length) {
    var conversionRefusal = refuseCompositionConversion();
    if (conversionRefusal) return conversionRefusal;
    // P1252 (BT-02): 환산이 필요한데 멤버의 통화가 선언되지 않았으면(시세·원가 통화 모두 없음)
    // `currency || baseCurrency`의 rate 1 암묵 통과로 기준 통화로 눕히지 않는다 — 미확인 통화는
    // 기준 통화(USD 등)라는 뜻이 아니다. 추정 없이 시작 배분 전체를 보류한다.
    var undeclaredCurrencyMembers = needsConversion ? tickers.filter(function(t) {
      var entry = currencyByTicker[t] || {};
      return !entry.price && !entry.cost;
    }) : [];
    if (undeclaredCurrencyMembers.length) {
      currencyAxis.held = [{ axis: 'composition', currency: null, reason: 'member-currency-undeclared', pair: undeclaredCurrencyMembers.join(',') }];
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['currency-conversion-basis-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'member-currency-undeclared', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        currencyAxis: currencyAxis,
        allocationBlocked: { code: 'member-currency-undeclared', members: undeclaredCurrencyMembers.slice(), intended: intendedTickers.slice() },
        warnings: [
          '통화가 선언되지 않은 멤버: ' + undeclaredCurrencyMembers.join(', ') + ' — 미확인 통화는 기준 통화라는 뜻이 아닙니다.',
          '시작 시점 시장가치를 추정 환산하지 않고 시작 배분 전체를 보류합니다. 각 멤버의 시세·원가 통화를 선언한 뒤 다시 실행하세요.'
        ]
      };
    }
    var startMonth = common[0];
    // P1252 (BT-03): 분자는 **시세** 기준 시장가치다. 시세 통화가 없고 원가 통화만 있으면 원가
    // 통화로 시세 값을 환산하는 근거 추정이 된다 — 숨기지 않고 축에 공개한다(price-currency-inferred-
    // from-cost). 둘 다 없으면 위의 BT-02 보류가 이미 막는다.
    tickers.forEach(function(t) {
      var startPoint = monthEnds[t][startMonth];
      var marketValue = startPoint && startPoint.value > 0 ? byTickerQty[t] * startPoint.value : null;
      // P1247: 비중의 분자는 **기준 통화로 환산된** 시장가치다. 환산 실패를 0으로눕히지 않는다 —
      // 0은 "제외 의도"이고 여기서는 환산 근거가 없다는 뜻이므로 아래에서 실행을 보류한다.
      var entry = currencyByTicker[t] || {};
      if (!entry.price && entry.cost && priceCurrencyInferredMembers.indexOf(t) < 0) priceCurrencyInferredMembers.push(t);
      var marketValueBase = toBaseCurrency(marketValue, entry.price || entry.cost, 'price');
      targetWeightDenominator += marketValueBase || 0;
      targetWeights[t] = marketValueBase;
    });
    if (priceCurrencyInferredMembers.length) {
      currencyAxis.priceValueBasis = 'price-currency-inferred-from-cost';
      currencyAxis.priceCurrencyInferredMembers = priceCurrencyInferredMembers.slice();
    }
    if (currencyAxis.held.length) {
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['currency-conversion-basis-required', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'fx-conversion-unavailable', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        currencyAxis: currencyAxis,
        allocationBlocked: { code: 'fx-conversion-unavailable', held: currencyAxis.held.slice() },
        warnings: [
          '시작 시점 시장가치를 기준 통화로 환산하지 못해 비중을 만들지 않았습니다: ' + currencyAxis.held.map(function(entry) { return entry.pair + '(' + entry.reason + ')'; }).join(', ') + '.',
          '환산 실패를 0이나 제외로 바꾸지 않습니다 — 선언한 leg의 관측 시각·창을 확인하거나 통화쌍을 추가한 뒤 다시 실행하세요.'
        ]
      };
    }
    if (!(targetWeightDenominator > 0) || tickers.some(function(t) { return !(targetWeights[t] > 0); })) {
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['target-weight-basis-unavailable', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: 'target weight basis unavailable', model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        warnings: ['원가 비중을 목표비중으로 대체하지 않습니다. 명시적 targetWeight 또는 시작 시점 조정주가×수량이 필요합니다.']
      };
    }
    tickers.forEach(function(t) { targetWeights[t] = targetWeights[t] / targetWeightDenominator; });
  } else {
    var unspecifiedTickers = tickers.filter(function(t) { return byTickerTargetWeight[t] == null; });
    specifiedTickers.forEach(function(t) { targetWeightDenominator += byTickerTargetWeight[t]; });
    var allocationBlocked = null;
    var allocationWarnings = null;
    if (unspecifiedTickers.length) {
      allocationBlocked = { code: 'partial-allocation-unresolved', specified: specifiedTickers.slice(), unspecified: unspecifiedTickers.slice() };
      allocationWarnings = [
        '부분 배분은 보류입니다 — 미지정 멤버: ' + unspecifiedTickers.join(', ') + '.',
        '이건 제외가 아닙니다: 모든 멤버의 목표비중을 명시하거나 잔여비중 정책을 별도로 지정하세요. 잔여를 시장가치로 암묵 재분배하지 않습니다.'
      ];
    } else if (!(targetWeightDenominator > 0)) {
      allocationBlocked = { code: 'explicit-zero-allocation', members: tickers.slice(), sum: targetWeightDenominator };
      // P1252 (BT-08): 이 엔진은 전액투자 전략만 지원한다 — 목표비중 합계가 100%여야 하고 현금
      // 배분 모드는 없다. 존재하지 않는 "현금 100% 모드"를 안내하지 않는다.
      allocationWarnings = ['모든 목표비중이 0입니다 — 명시적 0은 제외 의도이며, 이 엔진은 전액투자 전략만 지원하므로(목표비중 합계가 100%여야 하며 현금 배분 모드는 제공하지 않습니다) 실행할 수 없습니다.', '제외된 종목을 시장가치로 되살리지 않습니다.'];
    } else if (targetWeightDenominator > 100 + 1e-9) {
      allocationBlocked = { code: 'invalid-allocation-sum', members: tickers.slice(), sum: targetWeightDenominator };
      allocationWarnings = ['목표비중 합계가 100을 넘습니다 (' + Math.round(targetWeightDenominator * 100) / 100 + ') — 비율로 눌러 정규화하지 않습니다.'];
    } else if (targetWeightDenominator < 100 - 1e-9) {
      allocationBlocked = { code: 'partial-allocation-unresolved', specified: specifiedTickers.slice(), unspecified: [], sum: targetWeightDenominator };
      // P1252 (BT-08): "현금 비중을 명시하세요"는 존재하지 않는 입력을 안내한다 — 이 엔진은
      // 전액투자 전략만 지원한다(목표비중 합계 100%, 현금 배분 모드 없음).
      allocationWarnings = ['목표비중 합계가 100보다 작습니다 (' + Math.round(targetWeightDenominator * 100) / 100 + ') — 잔여비중 정책 없이 잔여를 분배하지 않습니다. 이 엔진은 전액투자 전략만 지원합니다: 목표비중 합계가 100%여야 하며 현금 배분 모드는 제공하지 않습니다.'];
    } else {
      targetWeightBasis = 'explicit-target-weight';
      tickers.forEach(function(t) { targetWeights[t] = (byTickerTargetWeight[t] || 0) / targetWeightDenominator; });
    }
    if (allocationBlocked) {
      return {
        ok: false, status: 'PARTIAL', allowedUse: 'reference-only', decisionUse: false,
        decisionEligible: false, promotionEligible: false,
        promotionBlockers: ['allocation-resolution-blocked', 'transaction-costs-not-modeled', 'slippage-not-modeled', 'turnover-not-modeled'],
        reason: allocationBlocked.code, model: 'AIO_PORTFOLIO_BACKTEST_LAB_MONTHLY_V2',
        priceBasis: 'adjusted-close-required', compositionDisclosure: 'current-composition-retrospective',
        allocationBlocked: allocationBlocked,
        warnings: allocationWarnings
      };
    }
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
    // P1252 (BT-06): 연도 행의 복리 수익률은 그 해에 관측된 월 수만큼의 수익률이다. 창이 연중에
    // 시작/끝나면 그 해는 부분 연도다 — 개월 수를 발행하고 라벨에 병기하며, 전체 연도와 같은
    // 표에서 부분 연도임을 표시한다.
    var months = years[y].returns.length;
    var partialYear = months !== 12;
    return {
      year: y,
      label: partialYear ? y + ' (' + months + '개월)' : y,
      months: months,
      partialYear: partialYear,
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
  // P1252 (BT-06): 최고/최저 연도는 **전체 연도만** 후보로 삼는다 — 연중 시작한 창의 2개월 부분
  // 연도가 "최악의 해"로 발행되는 것을 막는다. 전체 연도가 없으면 best/worst는 null이다.
  var annualReturns = annualRows.filter(function(r) { return !r.partialYear; }).map(function(r) { return r.return; });
  var cleanMonthly = monthlyReturns.slice().sort(function(a, b) { return a - b; });
  var var5 = cleanMonthly.length ? Math.max(0, -_quantileR7(cleanMonthly, 0.05)) : null;
  var tail = cleanMonthly.filter(function(r) { return r <= _quantileR7(cleanMonthly, 0.05); });
  var cvar5 = tail.length ? Math.max(0, -_statMean(tail)) : null;
  // 22:PFR05 (E4): publish the sample facts behind VaR/CVaR and certify only the
  // sample that survives the declared stability/sensitivity thresholds. A CVaR
  // averaged over a single tail observation is one loss printed as a risk
  // estimate, and an estimate that moves with the estimator is not one either.
  // P1203: `deriveVarStability`의 `recent-half` 변형은 **시간 순서**를 가정한다 — 정렬된 표본을 넘기면
  // 그 변형이 '최근 절반'이 아니라 '상위 절반'이 되어 VaR가 0, 민감도 1이 되고, 현실적인(중앙값이 양수인)
  // 표본은 영원히 인증될 수 없었다. 꼬리·근사 순위 계산은 함수 안에서 정렬하므로 순서를 넘겨도 안전하다.
  // P1243: `monthlyReturns`는 월 버킷 순서(시간순)이므로 계약을 선언한다. 순서를 검증할 수 있는
  // 관측시각이 있으면 `observedAt`으로 올려 `verified`가 된다.
  var varStability = deriveVarStability({ returns: monthlyReturns, quantile: 0.05, order: 'chronological' });
  var varCertification = {
    confidence: 0.95,
    horizonMonths: 1,
    quantileMethod: 'R7-linear-interpolation',
    sampleN: cleanMonthly.length,
    tailN: tail.length,
    certification: varStability.certification === 'certified' ? 'certified' : 'held',
    certificationReasons: (tail.length < 2 ? ['tail-sample-single-observation'] : [])
      .concat(varStability.certification === 'certified' ? [] : varStability.certificationReasons),
    stability: varStability
  };
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
      // P1252 (BT-07): netGain ≤ 0(손실 구간)에서 contribution/netGain은 부호 의미를 뒤집는다 —
      // 손실 기여자가 양수 %로 발행된다. 달러 기여액과 Σ기여액 = netGain 항등식은 그대로 두고
      // 비율만 보류한다(사유 병기).
      returnContributionPct: netGain > 0 ? contribution / netGain : null,
      returnContributionPctReason: netGain > 0 ? null : 'loss-period-pct-withheld',
      contributionBasis: 'arithmetic-period-start-dollar',
      riskContribution: riskContribution,
      riskContributionBasis: 'realized-beginning-weighted-monthly-return'
    };
  }).sort(function(a, b) { return Math.abs(b.riskContribution || 0) - Math.abs(a.riskContribution || 0); });

  // P1259 (QA-FX-SERIES): 기준 통화 수익률(월말 FX 정렬) — 현지 통화 결과와 **다른 결과**로 함께
  // 발행한다. FX 시계열이 없으면 보류하고 추정하지 않는다.
  var baseCurrencyReturns = _aioBtBaseCurrencyMonthlyReturns({
    monthlyRows: monthlyRows,
    currencyByTicker: currencyByTicker,
    baseCurrency: baseCurrency,
    needsConversion: needsConversion,
    startMonth: common[0],
    fxSeries: options.fxSeries || null
  });

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
    // P1247 (E3/E4): 통화축. 비중은 선언된 leg로 기준 통화로 환산했지만, 월별 수익률은 각 자산의
    // **현지 통화** 가격 경로에서 계산된다 — 기준 통화 수익률은 관측 FX **시계열**이 있어야 하고,
    // 그건 이 결과가 아니다. 두 가지를 같은 것으로 읽지 않도록 축과 수익 기준을 함께 발행한다.
    currencyAxis: currencyAxis,
    returnCurrencyBasis: needsConversion ? 'local-currency-weighted' : 'single-currency',
    fxTranslation: needsConversion ? 'excluded-requires-fx-series' : 'not-applicable',
    baseCurrencyReturns: baseCurrencyReturns,
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
    // P1252 (BT-01): 의도 멤버 전체와 원가 공개 — 원가 미신고 멤버는 제외되지 않았고, 원가는
    // 어떤 계산에도 쓰이지 않았다(공개 필드 전용).
    intendedTickers: intendedTickers.slice(),
    costBasis: 'cost-not-used-for-allocation',
    missingCostMembers: missingCostMembers.slice(),
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
      varCertification: varCertification,
      upsideCapture: upCapture,
      downsideCapture: downCapture
    },
    warnings: [
      '조정주가 기반 총수익률의 참고용 추정치입니다. 세금·수수료·거래비용·슬리피지·회전율을 모델링하지 않았으며 gross 성과입니다. 이 누락은 승격 차단 사유입니다.',
      '명시적 목표비중 또는 시작 시점 조정주가×수량 비중을 과거에 소급한 current-composition retrospective이며 원가 비중을 시장가 비중으로 오인하지 않습니다. 생존편향·구성 변경·상장 전 구간은 교정하지 않습니다.',
      '월말 관측일이 자산 간 ' + maxAlignmentGapDays + '일을 초과하는 월은 비동시성 편향 방지를 위해 제외했습니다.',
      // P1252 (BT-05): 경고는 실제 판정을 말한다 — 인증된 표본에 고정 "인증 보류"를 붙이지 않고,
      // 보류면 실제 certificationReasons를 나열한다.
      varCertification.certification === 'certified'
        ? ('VaR/CVaR 표본 ' + varCertification.sampleN + '개·꼬리 ' + varCertification.tailN + '개 — 인증됨(표본 안정성 통과).')
        : ('VaR/CVaR 표본 ' + varCertification.sampleN + '개·꼬리 ' + varCertification.tailN + '개 — 인증 보류(' + (varCertification.certificationReasons || []).join(', ') + ').'),
      rfInvalid ? '무위험수익률(RF)은 연간 소수(decimal) 단위(-1, 1]만 허용합니다. 입력 단위가 잘못되어 Sharpe·Sortino·Alpha를 산출하지 않았습니다.' : rfAnnual == null ? '무위험수익률(RF)을 입력하지 않아 Sharpe·Sortino·Alpha를 산출하지 않았습니다.' : ('RF 가정: 연 소수 ' + rfAnnual.toFixed(6) + ' (' + (rfAnnual * 100).toFixed(2) + '%).'),
      '거래 가능한 실현 성과·매매 지시로 승격하지 않습니다.',
      '무료 Yahoo chart 데이터 범위와 각 종목 상장일에 따라 시작 월이 자동 제한됩니다.',
      // P1252 (BT-03): 원가 통화로 시세 값을 환산한 근거 추정은 공개한다 — 시세 통화 선언이
      // 원가 통화와 다르면 비중이 왜곡될 수 있다.
      priceCurrencyInferredMembers.length ? ('시세 통화가 선언되지 않은 멤버(' + priceCurrencyInferredMembers.join(', ') + ')는 원가 통화를 시세 값 환산의 통화로 사용했습니다(price-currency-inferred-from-cost) — 원가 통화가 실제 시세 통화와 다르면 시작 비중이 왜곡됩니다.') : null,
      needsConversion ? ('비중은 선언된 rate leg로 기준 통화(' + baseCurrency + ')로 환산했지만, 월별 수익률은 각 자산의 현지 통화 가격 경로에서 계산됩니다 — 기준 통화 수익률에는 관측 FX 시계열이 필요하며 이 결과에 포함되지 않았습니다.') : null
    ].filter(Boolean)
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
