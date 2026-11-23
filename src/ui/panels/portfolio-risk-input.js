import { createCompositionSnapshot, deriveRiskEstimate } from '../../domain/portfolio/risk.js';
import { convertWithDeclaredRates, listingCurrency } from '../../domain/portfolio/fx.js';
import { convertCashBalances, viaAppClose } from '../../domain/portfolio/cash.js';
import { finiteNumber as finite, readNumber } from '../../domain/shared/number.js';

export function holdingPriceCurrency(position, evidence = null) {
  const declared = String(position?.currency || position?.priceCurrency || evidence?.currency || '').trim().toUpperCase();
  return declared || listingCurrency(position?.listingSymbol || position?.ticker);
}

// The valuation screen's price sources that stand for today's value (surface.js holdingValue); a stored price does not.
const REFERENCE_VALUE_KINDS = ['live-quote', 'completed-close', 'delayed-reference-quote'];

export function assembleRiskEstimateInput({
  positions,
  priceEvidenceMap,
  historyMap,
  validTickers,
  commonDates,
  cashValue,
  cashBalances = null,
  cashFx = null,
  declarations,
  fxLegs = [],
  fxHistory = null,
  surface = null,
  nowIso
}) {
  const dates = Array.isArray(commonDates) ? commonDates : [];
  if (dates.length < 6) {
    return { ok: false, code: 'common-dates-insufficient' };
  }

  const currentValueMap = {};
  const qtyByTicker = {};
  const missingCurrent = [];
  const currencyByTicker = {};
  const valueCurrencyByTicker = {};
  const referenceByTicker = {};
  const surfaceUnit = surface && surface.currencyState !== 'mixed-without-conversion' ? String(surface.baseCurrency || surface.valuationCurrency || '').toUpperCase() : '';
  const surfaceValue = {};
  if (surfaceUnit) (surface.rows || []).forEach((row) => {
    const entry = surfaceValue[row.symbol] || (surfaceValue[row.symbol] = { value: 0, date: null, kind: null, ok: true });
    if (!(row.value > 0) || !REFERENCE_VALUE_KINDS.includes(row.sourceKind)) { entry.ok = false; return; }
    entry.value += row.value;
    entry.kind = row.sourceKind;
    const date = String(row.closeDate || row.observedAt || '').slice(0, 10);
    if (date && (!entry.date || date < entry.date)) entry.date = date;
  });
  (Array.isArray(positions) ? positions : []).forEach((p) => {
    const evidence = priceEvidenceMap ? priceEvidenceMap[p.ticker] : null;
    const price = evidence && evidence.allowedUse === true ? finite(evidence.value) : null;
    currencyByTicker[p.ticker] = holdingPriceCurrency(p, evidence);
    qtyByTicker[p.ticker] = (qtyByTicker[p.ticker] || 0) + Number(p.qty);
    if (price > 0) { currentValueMap[p.ticker] = (currentValueMap[p.ticker] || 0) + price * Number(p.qty); return; }
    const reference = surfaceValue[String(p.ticker || '').toUpperCase()];
    if (!reference || !reference.ok || !(reference.value > 0)) { missingCurrent.push(p.ticker); return; }
    currentValueMap[p.ticker] = reference.value; // every lot of the ticker, already summed and in the surface's unit
    valueCurrencyByTicker[p.ticker] = surfaceUnit;
    referenceByTicker[p.ticker] = reference;
  });
  if (missingCurrent.length) {
    return { ok: false, code: 'missing-current', tickers: missingCurrent };
  }
  const decl0 = declarations || {};
  const currencies = [...new Set(Object.values(currencyByTicker))];
  const baseCurrency = String(decl0.baseCurrency || '').trim().toUpperCase() || (currencies.length === 1 ? currencies[0] : null);
  if (!baseCurrency) return { ok: false, code: 'currency-mixed-no-base', currencies };
  const baseValueMap = {};
  const heldPairs = [];
  const asOfMs = Date.parse(nowIso || '') || Date.now();
  Object.entries(currentValueMap).forEach(([ticker, value]) => {
    const from = valueCurrencyByTicker[ticker] || currencyByTicker[ticker];
    if (from === baseCurrency) { baseValueMap[ticker] = value; return; }
    const converted = convertWithDeclaredRates({ value, from, to: baseCurrency, legs: Array.isArray(fxLegs) ? fxLegs : [], asOfMs });
    const app = converted.ok || !from ? null : viaAppClose(value, from, baseCurrency, cashFx);
    if (converted.ok) baseValueMap[ticker] = converted.value;
    else if (app != null) baseValueMap[ticker] = app;
    else if (!heldPairs.includes(`${from}/${baseCurrency}`)) heldPairs.push(`${from}/${baseCurrency}`);
  });
  if (heldPairs.length) return { ok: false, code: 'currency-unconverted', pairs: heldPairs, baseCurrency };
  Object.assign(currentValueMap, baseValueMap);
  const totalCurrentValue = Object.values(currentValueMap).reduce((s, value) => s + (value || 0), 0);
  if (!(totalCurrentValue > 0)) {
    return { ok: false, code: 'no-current-value' };
  }

  const minLen = dates.length - 1;
  const returnsMap = {};
  const fxByDate = new Map((Array.isArray(fxHistory) ? fxHistory : []).filter((row) => row?.date && finite(row.value) > 0).map((row) => [row.date, row.value]));
  const fxCovered = fxByDate.size > 0 && dates.every((day) => fxByDate.has(day));
  const fxFactor = (ticker, day) => {
    const from = currencyByTicker[ticker];
    if (from === baseCurrency) return 1;
    if (!fxCovered) return null;
    if (from === 'USD' && baseCurrency === 'KRW') return fxByDate.get(day);
    if (from === 'KRW' && baseCurrency === 'USD') return 1 / fxByDate.get(day);
    return null;
  };
  let fxApplied = false;
  let fxMissing = false;
  (Array.isArray(validTickers) ? validTickers : []).forEach((t) => {
    const factors = dates.map((day) => fxFactor(t, day));
    const convert = factors.every((factor) => factor != null);
    if (currencyByTicker[t] !== baseCurrency) { if (convert) fxApplied = true; else fxMissing = true; }
    const values = dates.map((day, i) => historyMap[t][day] * (convert ? factors[i] : 1));
    returnsMap[t] = values.slice(1).map((value, idx) => (value / values[idx]) - 1);
  });

  const decl = declarations || {};
  const cashConversion = Array.isArray(cashBalances)
    ? convertCashBalances({ balances: cashBalances, target: baseCurrency, legs: Array.isArray(fxLegs) ? fxLegs : [], appFx: cashFx, asOfMs })
    : null;
  const cashAmount = cashConversion
    ? (cashConversion.ok ? cashConversion.total : cashBalances.reduce((sum, row) => sum + Math.max(0, Number(row && row.amount) || 0), 0))
    : Math.max(0, Number(cashValue) || 0);
  const cashCurrency = cashConversion ? (cashConversion.ok ? baseCurrency : null) : (decl.cashCurrency != null ? String(decl.cashCurrency).toUpperCase() : null);
  const cashDeclarable = cashAmount === 0 || cashCurrency === baseCurrency;
  const snapshot = createCompositionSnapshot({
    members: (Array.isArray(positions) ? positions : []).map((p) => {
      const ev = priceEvidenceMap ? priceEvidenceMap[p.ticker] : null;
      return {
        ticker: p.ticker,
        qty: Number(p.qty),
        price: currentValueMap[p.ticker] != null && qtyByTicker[p.ticker] > 0 ? currentValueMap[p.ticker] / qtyByTicker[p.ticker] : null,
        priceCurrency: currencyByTicker[p.ticker],
        priceObservedAt: referenceByTicker[p.ticker] ? referenceByTicker[p.ticker].date : ev && ev.ts != null ? new Date(ev.ts).toISOString() : null,
        priceSource: referenceByTicker[p.ticker] ? referenceByTicker[p.ticker].kind : ev && ev.source != null ? String(ev.source) : null
      };
    }),
    cash: { amount: cashAmount, currency: cashCurrency },
    asOf: nowIso || new Date().toISOString(),
    weightBasis: cashDeclarable ? 'whole_account' : 'invested_sleeve',
    baseCurrency
  });

  const exposurePath = decl.exposurePath || 'current_composition_retrospective';
  const rebalancePolicy = decl.rebalancePolicy;
  let strategyTargetWeights;
  if (exposurePath === 'fixed_target_weight_strategy') {
    let declaredWeightSum = 0;
    let weightComplete = positions.length > 0;
    strategyTargetWeights = {};
    positions.forEach((p) => {
      const declaredWeight = readNumber(p.targetWeight);
      if (declaredWeight == null || declaredWeight < 0) { weightComplete = false; return; }
      strategyTargetWeights[p.ticker] = declaredWeight / 100;
      declaredWeightSum += declaredWeight;
    });
    if (!weightComplete || declaredWeightSum > 100 + 1e-6) strategyTargetWeights = {};
  }

  const estimate = snapshot ? deriveRiskEstimate({
    snapshot,
    returnsMap,
    cashReturn: decl.cashReturn != null ? { mode: 'explicit_assumption', annualRate: decl.cashReturn } : { mode: 'unresolved' },
    rfAnnual: decl.riskFreeRate,
    exposureHistoryMode: exposurePath,
    rebalancePolicy,
    targetWeights: strategyTargetWeights,
    sampleDates: dates.slice(1)
  }) : null;

  const hasForeign = currencies.some((currency) => currency !== baseCurrency);
  const references = Object.values(referenceByTicker);
  return {
    ok: true,
    valueCurrency: baseCurrency,
    // Holdings weighted from the valuation screen's close or delayed quote instead of a live quote, and the oldest date.
    referenceValued: references.length ? { count: references.length, total: Object.keys(currentValueMap).length, date: references.map((entry) => entry.date).filter(Boolean).sort()[0] || null } : null,
    returnCurrencyBasis: !hasForeign ? baseCurrency : fxMissing ? 'local-currency-per-holding' : fxApplied ? `${baseCurrency}-incl-fx` : baseCurrency,
    fxIncluded: !hasForeign ? null : !fxMissing,
    returnsMap,
    snapshot,
    estimate,
    minLen,
    strategyTargetWeights,
    exposurePath,
    rebalancePolicy,
    cashBasisLabel: cashConversion && cashConversion.ok ? cashConversion.basisLabel : null
  };
}
