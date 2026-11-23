import { FX_LEG_MAX_AGE_MS, convertWithDeclaredRates, holdingListingKey, listingCurrency } from './fx.js';
import { convertCashBalances } from './cash.js';
import { readNumber as finite } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';
import { FRESHNESS_POLICY } from '../shared/freshness-policy.js';

export const PORTFOLIO_SURFACE_MODEL_VERSION = 'portfolio-surface.v3';

export const PORTFOLIO_READ_STATES = Object.freeze(['loading', 'locked', 'ready', 'failed']);
export const PORTFOLIO_VALUATION_STATES = Object.freeze(['empty', 'cash-only', 'complete', 'partial', 'unavailable']);

function firstFinite(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number != null) return number;
  }
  return null;
}

function firstPositive(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number != null && number > 0) return number;
  }
  return null;
}

const LIVE_QUOTE_MAX_AGE_MS = FRESHNESS_POLICY.liveQuoteMs;
const DELAYED_QUOTE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

function explicitDecisionUse(value) {
  return value === true || (typeof value === 'string' && /^(decision|trading)$/i.test(value.trim()));
}

function parseObservedMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value < 100000000000 ? value * 1000 : value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function canonicalSourceTier(value) {
  const key = String(value ?? '').trim().toUpperCase();
  const aliases = {
    T1_OFFICIAL: 'T1_OFFICIAL',
    'OFFICIAL-REGULATOR': 'T1_OFFICIAL',
    'OFFICIAL-GOVERNMENT': 'T1_OFFICIAL',
    'OFFICIAL-EXCHANGE': 'T1_OFFICIAL',
    T2_LICENSED: 'T2_LICENSED',
    LICENSED: 'T2_LICENSED',
    LICENSED_API: 'T2_LICENSED',
    LICENSED_QUOTE_PROVIDER: 'T2_LICENSED'
  };
  return aliases[key] || null;
}

function validRightsId(value) {
  const id = String(value ?? '').trim();
  return !!id && !/^(unknown|unspecified|null|none|review_required|denied|blocked|revoked)$/i.test(id);
}

function qualityReady(quality, { now, observedMs, maxAgeMs }) {
  if (!quality || typeof quality !== 'object') return false;
  const status = String(quality.status || '').trim().toLowerCase();
  const freshness = String(quality.freshness || '').trim().toLowerCase();
  const declaredUse = quality.allowedUse ?? quality.decisionUse;
  if (declaredUse === false || /^(none|blocked|reference|reference-only)$/i.test(String(declaredUse ?? ''))) return false;
  if (quality.stale === true || quality.hardStale === true || quality.blocked === true
    || /^(blocked|missing|unavailable|reference|reference_only|failed)$/i.test(status)) return false;
  if (!(/^(live|delayed|fresh|current)$/i.test(freshness) || /^(live|fresh|current|verified_current)$/i.test(status))) return false;
  const qualityTs = parseObservedMs(quality.observedAt ?? quality.timestamp ?? quality.ts);
  if (quality.timestampValid !== true && qualityTs == null) return false;
  const freshnessMs = Number(quality.freshnessMs ?? quality.maxAgeMs);
  if (!Number.isFinite(freshnessMs) || freshnessMs <= 0) return false;
  const ageMs = quality.ageMs == null ? (qualityTs == null ? null : Number(now) - qualityTs) : Number(quality.ageMs);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= Math.min(maxAgeMs, freshnessMs) && observedMs != null;
}

function runtimeQuoteEvidence(row, { now = Date.now(), maxAgeMs = null } = {}) {
  const raw = row && typeof row === 'object' ? row : {};
  const hasEnvelope = raw.quoteEnvelope && typeof raw.quoteEnvelope === 'object';
  const envelope = hasEnvelope ? raw.quoteEnvelope : raw;
  const rawPrice = firstPositive(raw.price, raw.regularMarketPrice);
  const envelopePrice = firstPositive(envelope.price, envelope.value, envelope.regularMarketPrice);
  if (hasEnvelope && rawPrice != null && envelopePrice != null && rawPrice !== envelopePrice) return null;
  const price = envelopePrice;
  const observedAt = envelope.observedAt || null;
  const observedMs = parseObservedMs(observedAt);
  const rawObservedMs = parseObservedMs(raw.observedAt);
  if (hasEnvelope && rawObservedMs != null && observedMs != null && rawObservedMs !== observedMs) return null;
  const source = String(envelope.source || '').trim();
  const sourceKind = String(envelope.sourceKind || '').trim().toLowerCase();
  const status = String(envelope.status || '').trim().toLowerCase();
  const allowedUseRaw = envelope.allowedUse ?? envelope.decisionUse ?? null;
  const allowedUse = String(allowedUseRaw ?? '').trim().toLowerCase();
  const allowedUseCeiling = String(envelope.allowedUseCeiling ?? '').trim().toLowerCase();
  const quality = envelope.quality || envelope.qualityEnvelope || null;
  const explicitUse = explicitDecisionUse(allowedUseRaw);
  const explicitCeiling = explicitDecisionUse(envelope.allowedUseCeiling);
  const sourceTier = canonicalSourceTier(envelope.sourceTier || envelope.sourceKind);
  const decisionTier = sourceTier === 'T1_OFFICIAL' || sourceTier === 'T2_LICENSED';
  const rightsOk = validRightsId(envelope.rightsId);
  const revisionOk = !!String(envelope.revisionId ?? envelope.revision ?? '').trim();
  const effectiveMaxAgeMs = maxAgeMs != null && Number.isFinite(Number(maxAgeMs))
    ? Number(maxAgeMs)
    : sourceKind === 'delayed' ? DELAYED_QUOTE_MAX_AGE_MS : LIVE_QUOTE_MAX_AGE_MS;
  const sourceBlocked = !source || /^(unknown|unavailable)$/i.test(source)
    || /snapshot|last[-_ ]known[-_ ]good|fallback/i.test(source)
    || !/^(live|delayed)$/.test(sourceKind);
  const stateBlocked = ['stale', 'failed', 'missing', 'reference', 'snapshot', 'unavailable'].includes(status)
    || ['none', 'blocked', 'reference', 'reference-only'].includes(allowedUse)
    || !explicitUse || !explicitCeiling || allowedUseCeiling !== 'decision' && allowedUseCeiling !== 'trading'
    || !decisionTier || !rightsOk || !revisionOk;
  const currentTime = Number(now);
  const ageMs = currentTime - observedMs;
  const timeCurrent = Number.isFinite(currentTime) && Number.isFinite(observedMs)
    && ageMs >= 0 && ageMs <= effectiveMaxAgeMs;
  if (price == null || sourceBlocked || stateBlocked || !timeCurrent
    || !qualityReady(quality, { now: currentTime, observedMs, maxAgeMs: effectiveMaxAgeMs })) return null;
  const dailyPct = firstFinite(envelope.dailyPct, envelope.regularMarketChangePercent);
  const changeBasis = String(envelope.changeBasis || envelope.valueBasis || '').trim();
  return Object.freeze({
    price, observedAt: new Date(observedMs).toISOString(), source, sourceKind, sourceTier,
    rightsId: String(envelope.rightsId).trim(), revisionId: String(envelope.revisionId ?? envelope.revision).trim(),
    maxAgeMs: effectiveMaxAgeMs, allowedUse: 'decision', dailyPct,
    dailyPctEligible: dailyPct != null && !!changeBasis, changeBasis
  });
}

function delayedReferenceQuote(live, { now = Date.now() } = {}) {
  const envelope = live?.quoteEnvelope && typeof live.quoteEnvelope === 'object' ? live.quoteEnvelope : live || {};
  const price = firstPositive(envelope.price, envelope.regularMarketPrice);
  const observedMs = parseObservedMs(envelope.observedAt);
  const source = String(envelope.source || envelope._source || '').trim();
  if (price == null || observedMs == null || !/^live:/i.test(source) || /snapshot|fallback|last[-_ ]known/i.test(source)) return null;
  const ageMs = Number(now) - observedMs;
  return ageMs >= 0 && ageMs <= DELAYED_QUOTE_MAX_AGE_MS ? { price, observedAt: envelope.observedAt } : null;
}

const CLOSE_STALE_DAYS = 7;
function closeDateMs(close) {
  const date = String(close?.date || '');
  return hasLeadingIsoDay(date) ? Date.parse(`${date.slice(0, 10)}T00:00:00Z`) : null;
}

function holdingValue(holding, live, options, close = null) {
  const sharesRaw = finite(holding?.shares);
  const shares = sharesRaw != null && sharesRaw >= 0 ? sharesRaw : null;
  const liveQuote = runtimeQuoteEvidence(live, options);
  const livePrice = liveQuote?.price ?? null;
  const closeMs = closeDateMs(close);
  const closePrice = livePrice == null ? firstPositive(close?.price) : null;
  const closeStale = closePrice != null && closeMs != null && Number(options?.now ?? Date.now()) - closeMs > (CLOSE_STALE_DAYS + 1) * 86400000;
  const delayed = livePrice == null && closePrice == null ? delayedReferenceQuote(live, options) : null;
  const price = firstPositive(livePrice, closePrice, delayed?.price, holding?.price);
  const explicitValue = firstPositive(holding?.value);
  if (shares != null && price != null && price > 0) return {
    value: shares * price,
    price,
    sourceKind: livePrice != null ? 'live-quote' : closePrice != null ? 'completed-close' : delayed ? 'delayed-reference-quote' : 'portfolio-state',
    closeDate: livePrice == null && closePrice != null ? close?.date || null : null,
    // The valuing close's own session change (that close against the one before), dated by closeDate. It is not today's
    // move, so dailyPct and the hero's 오늘 stay on live quotes.
    closeChangePct: livePrice == null && closePrice != null ? finite(close?.changePct) : null,
    closeStale,
    observedAt: liveQuote?.observedAt || (closePrice != null ? close?.date || null : null) || delayed?.observedAt || holding?.quoteObservedAt || null,
    quoteAllowedUse: liveQuote?.allowedUse || 'reference-only',
    fallbackUsed: livePrice == null,
    dailyPct: liveQuote?.dailyPct ?? finite(holding?.dailyPct),
    dailyPctEligible: liveQuote?.dailyPctEligible === true && liveQuote?.changeBasis ? true : false,
    changeBasis: liveQuote?.changeBasis || (closePrice != null ? 'completed-close' : null) || holding?.changeBasis || holding?.valueBasis || null
  };
  if (explicitValue != null) return {
    value: explicitValue,
    price,
    sourceKind: 'portfolio-state',
    observedAt: holding?.quoteObservedAt || null,
    quoteAllowedUse: 'reference-only',
    fallbackUsed: true,
    dailyPct: finite(holding?.dailyPct),
    dailyPctEligible: false,
    changeBasis: holding?.changeBasis || holding?.valueBasis || null
  };
  return { value: null, price, sourceKind: 'unavailable', observedAt: null, quoteAllowedUse: 'none', fallbackUsed: false, dailyPct: null, dailyPctEligible: false, changeBasis: null };
}

/**
 * Derives the deterministic, non-chart portion of the portfolio surface.
 * Missing canonical inputs remain null so the UI cannot turn unavailable data into a zero.
 * Read state never becomes a valuation: only an explicit read distinguishes empty/cash-only.
 */
export function derivePortfolioSurface({ state = {}, liveData = {}, vix = null, now = Date.now(), sectorOf = null, closeOf = null, cashFx = null } = {}) {
  const readState = PORTFOLIO_READ_STATES.includes(state?.readState) ? state.readState : (state?.status === 'locked' ? 'locked' : state?.status === 'loading' ? 'loading' : state?.status === 'failed' ? 'failed' : state?.status === 'unavailable' ? 'unavailable' : 'ready');
  const holdingsKnown = Array.isArray(state?.holdings) && (readState === 'ready' || state?.holdingsKnown === true);
  const holdings = holdingsKnown ? state.holdings : [];
  const totals = state?.totals && typeof state.totals === 'object' ? state.totals : {};
  const live = liveData && typeof liveData === 'object' ? liveData : {};
  const rows = holdings.map((holding) => {
    const symbol = String(holding?.symbol || holding?.ticker || '').toUpperCase();
    const listingSymbol = holdingListingKey(holding);
    const quote = holdingValue(holding, live[listingSymbol] || live[symbol] || {}, { now }, typeof closeOf === 'function' ? closeOf(listingSymbol) : null);
    const sharesValue = finite(holding?.shares);
    const shares = sharesValue != null && sharesValue >= 0 ? sharesValue : null;
    const avgCostValue = finite(holding?.avgCost);
    const avgCost = avgCostValue != null && avgCostValue >= 0 ? avgCostValue : null;
    const cost = shares != null && avgCost != null ? shares * avgCost : null;
    const dailyPct = quote.dailyPct;
    // Not frozen here: the currency block below may convert these amounts into the
    // declared base currency. Everything is frozen before it leaves the module.
    return {
      symbol,
      shares,
      avgCost,
      value: quote.value,
      price: quote.price,
      cost,
      sector: String((typeof sectorOf === 'function' ? sectorOf(listingSymbol) : null) || holding?.sector || 'Unclassified'),
      dailyPct,
      sourceKind: quote.sourceKind,
      closeDate: quote.closeDate || null,
      closeChangePct: quote.closeChangePct ?? null,
      closeStale: quote.closeStale === true,
      observedAt: quote.observedAt,
      quoteAllowedUse: quote.quoteAllowedUse,
      fallbackUsed: quote.fallbackUsed,
      dailyPctEligible: quote.dailyPctEligible,
      changeBasis: quote.changeBasis,
      currency: String(holding?.currency || holding?.priceCurrency || '').trim().toUpperCase() || null,
      listingSymbol,
      listingCurrency: symbol ? listingCurrency(listingSymbol) : null,
      costCurrency: String(holding?.costCurrency || '').trim().toUpperCase() || null
    };
  }).filter((row) => row.symbol);

  const declaredBaseCurrency = String(state?.baseCurrency || '').trim().toUpperCase() || null;
  const legacyCashValue = firstFinite(state?.cash, totals.cash);
  const cashRows = Array.isArray(state?.cashBalances)
    ? state.cashBalances.filter(Boolean).map((row) => ({ currency: String(row?.currency || '').trim().toUpperCase() || null, amount: finite(row?.amount) }))
    : [];
  const cashInvalidCount = cashRows.filter((row) => !(row.amount != null && row.amount >= 0)).length;
  const cashBalances = Array.isArray(state?.cashBalances)
    ? cashRows.filter((row) => row.amount != null && row.amount >= 0)
    : legacyCashValue != null && legacyCashValue >= 0 ? [{ currency: String(state?.cashCurrency || '').trim().toUpperCase() || null, amount: legacyCashValue }] : [];
  const cashCurrencies = [...new Set(cashBalances.map((row) => row.currency).filter(Boolean))];
  const declaredCashCurrency = cashCurrencies.length === 1 ? cashCurrencies[0] : null;
  // The holdings' unit decides whether holdings can be summed. Cash is converted on its own (below), so a won balance
  // beside dollar holdings no longer holds the whole total.
  const declaredCurrencies = [...new Set([
    ...rows.map((row) => row.currency),
    declaredBaseCurrency
  ].filter(Boolean))];
  const effectiveCurrencies = [...new Set([...rows.map((row) => row.currency || row.listingCurrency), declaredBaseCurrency].filter(Boolean))];
  const unknownUnitRows = rows.filter((row) => !row.currency && row.listingCurrency == null).length;
  const currencyBasis = declaredCurrencies.length > 1 || effectiveCurrencies.length > 1 || unknownUnitRows > 0 ? 'mixed' : declaredCurrencies.length === 1 ? 'declared-single' : 'undeclared';
  const cashKnown = readState === 'ready' && (state?.cashKnown === true || cashBalances.length > 0 || holdingsKnown);
  const cashEnteredZero = cashInvalidCount === 0 && cashBalances.length === 0 && (legacyCashValue === 0 || (Array.isArray(state?.cashBalances) && state?.cashKnown === true));

  const costBasisConflict = rows.some((row) => row.costCurrency && (row.currency || row.listingCurrency) && row.costCurrency !== (row.currency || row.listingCurrency));
  const costCurrencyOf = (row) => row.costCurrency || row.currency || row.listingCurrency || null;
  const costConversionNeeded = rows.some((row) => row.cost != null && (costCurrencyOf(row) || declaredBaseCurrency) !== declaredBaseCurrency);
  const fxLegs = Array.isArray(state?.fxLegs) ? state.fxLegs : [];
  const conversion = {
    basis: 'declared-observed-rates',
    baseCurrency: declaredBaseCurrency,
    asOf: new Date(now).toISOString(),
    maxAgeMs: FX_LEG_MAX_AGE_MS,
    applied: false,
    costApplied: false,
    legs: [],
    held: [],
    costHeld: []
  };
  let currencyCompatible = currencyBasis !== 'mixed';
  let costConversionApplied = false;
  const appLeg = (from, to) => cashFx && cashFx.rate > 0 && ((from === 'USD' && to === 'KRW') || (from === 'KRW' && to === 'USD'))
    ? { rate: from === 'USD' ? cashFx.rate : 1 / cashFx.rate, leg: { from: 'USD', to: 'KRW', rate: cashFx.rate, observedAt: cashFx.date, source: 'app-close', label: cashFx.label }, inverted: from === 'KRW' } : null;
  // The app close only covers USD/KRW: with any other currency in play (or no close) the declared legs alone decide, so
  // a JPY holding without a leg is held exactly as before instead of falling through as "converted".
  const appCovers = !!(cashFx && cashFx.rate > 0) && [...effectiveCurrencies, ...rows.map(costCurrencyOf)].filter(Boolean).every((c) => c === 'USD' || c === 'KRW');
  if (declaredBaseCurrency && (fxLegs.length || appCovers) && (currencyBasis === 'mixed' || costConversionNeeded)) {
    const usedLegs = [];
    const held = [];
    const costHeld = [];
    const convert = (amount, currency, sink) => {
      if (amount == null) return amount;
      let result = convertWithDeclaredRates({ value: amount, from: currency || declaredBaseCurrency, to: declaredBaseCurrency, legs: fxLegs, asOfMs: now });
      const fallback = !result.ok && result.reason !== 'value-missing' ? appLeg(currency || declaredBaseCurrency, declaredBaseCurrency) : null;
      if (fallback) result = { ok: true, value: Number(amount) * fallback.rate, rate: fallback.rate, leg: fallback.leg, inverted: fallback.inverted };
      if (!result.ok) {
        const pair = result.pair || `${currency || '?'}/${declaredBaseCurrency}`;
        if (!sink.some((entry) => entry.pair === pair && entry.reason === result.reason)) {
          sink.push({ currency: currency || null, reason: result.reason, pair });
        }
        return null;
      }
      // 같은 leg가 값과 원가에 두 번 쓰여도 근거는 하나다 — 중복 게시하지 않는다.
      if (result.leg) {
        const legKey = `${result.leg.from}->${result.leg.to}@${result.leg.observedAt}`;
        if (!usedLegs.some((entry) => `${entry.from}->${entry.to}@${entry.observedAt}` === legKey)) {
          usedLegs.push({ ...result.leg, inverted: result.inverted === true });
        }
      }
      return result.value;
    };
    const holdUnknownUnit = () => {
      if (!held.some((entry) => entry.reason === 'currency-undeclared')) held.push({ currency: null, reason: 'currency-undeclared', pair: `?/${declaredBaseCurrency}` });
      return null;
    };
    if (currencyBasis === 'mixed') {
      const convertedRows = rows.map((row) => ({
        ...row,
        value: row.currency || row.listingCurrency || row.value == null ? convert(row.value, row.currency || row.listingCurrency, held) : holdUnknownUnit(),
        convertedFrom: (row.currency || row.listingCurrency) && (row.currency || row.listingCurrency) !== declaredBaseCurrency ? (row.currency || row.listingCurrency) : null
      }));
      if (!held.length) {
        rows.splice(0, rows.length, ...convertedRows);
        currencyCompatible = true;
        conversion.applied = true;
      } else {
        conversion.held = held;
      }
    }
    // 원가 환산은 값 환산과 독립이다: 원가쌍이 없으면 P&L만 보류하고 합계는 그대로 둔다.
    if (costConversionNeeded) {
      const convertedCosts = rows.map((row) => {
        const costCurrency = costCurrencyOf(row);
        return {
          ...row,
          cost: convert(row.cost, costCurrency, costHeld),
          costConvertedFrom: costCurrency && costCurrency !== declaredBaseCurrency ? costCurrency : null
        };
      });
      if (!costHeld.length) {
        rows.splice(0, rows.length, ...convertedCosts);
        costConversionApplied = true;
        conversion.costApplied = true;
      } else {
        conversion.costHeld = costHeld;
      }
    }
    conversion.legs = usedLegs;
  }
  const holdingsUnit = conversion.applied ? declaredBaseCurrency
    : currencyBasis === 'declared-single' ? declaredCurrencies[0]
      : currencyBasis === 'undeclared' ? effectiveCurrencies[0] || null : null;
  const cashTarget = declaredBaseCurrency || holdingsUnit || (rows.length === 0 ? (cashCurrencies.length === 1 ? cashCurrencies[0] : 'USD') : null);
  const cashConversion = convertCashBalances({ balances: cashBalances, target: cashTarget, legs: fxLegs, appFx: cashFx, asOfMs: now });
  const cash = !cashKnown || cashInvalidCount ? null : cashBalances.length ? cashConversion.total : cashEnteredZero ? 0 : null;
  const cashHeld = (cashBalances.some((row) => row.amount > 0) || cashInvalidCount > 0) && cash == null;
  const currencyState = conversion.applied ? 'converted-with-declared-rates'
    : currencyBasis === 'mixed' ? 'mixed-without-conversion'
      : currencyBasis === 'undeclared' ? 'undeclared-single-basis-assumed' : 'declared-single';
  // The unit each row's value and cost are in after any conversion: a row's P&L is value − cost only when they match,
  // and it prints in that unit (a won holding in an unconverted mix is not a dollar amount).
  rows.forEach((row) => {
    row.valueUnit = conversion.applied ? declaredBaseCurrency : row.currency || row.listingCurrency || null;
    row.costUnit = costConversionApplied ? declaredBaseCurrency : costCurrencyOf(row);
    Object.freeze(row);
  });
  Object.freeze(rows);

  const allRowsValued = currencyCompatible && rows.length > 0 && rows.every((row) => row.value != null);
  const someRowsValued = currencyCompatible && rows.some((row) => row.value != null);
  const positionValue = readState === 'ready' && rows.length === 0 && holdingsKnown ? 0 : (rows.length ? (allRowsValued ? rows.reduce((sum, row) => sum + row.value, 0) : null) : null);
  const totalAssets = readState === 'ready' && positionValue != null && cash != null ? positionValue + cash : null;
  const costCurrencyState = costBasisConflict
    ? costConversionApplied ? 'cost-price-mismatch-converted' : 'cost-price-mismatch-held'
    : rows.some((row) => row.costCurrency) ? 'cost-declared' : 'cost-undeclared-assumed';
  const allRowsCosted = rows.length > 0 && rows.every((row) => row.cost != null) && currencyCompatible && (!costBasisConflict || costConversionApplied);
  const totalCost = allRowsCosted ? rows.reduce((sum, row) => sum + row.cost, 0) : null;
  const totalPnl = positionValue != null && totalCost != null
    ? positionValue - totalCost
    : null;
  const totalPnlPct = totalPnl != null && totalCost > 0 ? totalPnl / totalCost * 100 : null;
  const fxDayPct = (from) => {
    if (!from || from === declaredBaseCurrency) return 0;
    if (!(cashFx?.rate > 0 && cashFx?.prevRate > 0)) return null;
    if (from === 'USD' && declaredBaseCurrency === 'KRW') return (cashFx.rate / cashFx.prevRate - 1) * 100;
    if (from === 'KRW' && declaredBaseCurrency === 'USD') return (cashFx.prevRate / cashFx.rate - 1) * 100;
    return null;
  };
  const baseDailyPct = (row) => {
    const fx = fxDayPct(row.convertedFrom);
    return fx == null || row.dailyPct == null ? null : ((1 + row.dailyPct / 100) * (1 + fx / 100) - 1) * 100;
  };
  const allRowsDaily = rows.length > 0 && rows.every((row) => row.value != null && row.dailyPctEligible === true && row.dailyPct != null && row.dailyPct > -100 && baseDailyPct(row) != null);
  const dailyChange = allRowsDaily ? rows.reduce((sum, row) => sum + row.value - row.value / (1 + baseDailyPct(row) / 100), 0) : null;
  const previousAssets = dailyChange != null && totalAssets != null ? totalAssets - dailyChange : null;
  const dailyPct = previousAssets > 0 ? dailyChange / previousAssets * 100 : null;
  const exposurePct = totalAssets != null && totalAssets > 0 && positionValue != null ? positionValue / totalAssets * 100 : null;
  const vixQuote = runtimeQuoteEvidence(vix, { now });
  const vixValue = vixQuote?.price != null && vixQuote.price > 0 ? vixQuote.price : null;
  const sectors = new Map();
  const sectorBasis = totalAssets != null && totalAssets > 0 ? 'total-assets-including-cash' : allRowsValued && positionValue > 0 ? 'positions-only' : null;
  const sectorDenominator = sectorBasis === 'total-assets-including-cash' ? totalAssets : sectorBasis ? positionValue : null;
  for (const row of rows) {
    if (row.value == null || sectorDenominator == null) continue;
    const name = row.sector || 'Unclassified';
    sectors.set(name, (sectors.get(name) || 0) + row.value / sectorDenominator * 100);
  }
  if (cash != null && totalAssets != null && totalAssets > 0 && cash > 0) sectors.set('CASH', cash / totalAssets * 100);
  const sectorBreakdown = [...sectors.entries()]
    .map(([name, pct]) => Object.freeze({ name, pct, basis: sectorBasis }))
    .sort((a, b) => b.pct - a.pct);
  const sourceKind = rows.some((row) => row.sourceKind === 'live-quote') ? 'portfolio-state+live-quote' : rows.length ? 'portfolio-state' : cash != null ? 'portfolio-state:cash-only' : 'unavailable';
  // Every row had a price and the table showed its
  // P&L, but someRowsValued needs one unit, so the hero said "4종목 모두 가격 없음". A mix without a conversion is its own
  // state: each currency is totalled alone (never summed across units) and the hero names those subtotals.
  const unitOf = (row) => row.currency || row.listingCurrency || null;
  const currencySubtotals = currencyState === 'mixed-without-conversion' && rows.some((row) => row.value != null && unitOf(row))
    ? Object.freeze([...new Set(rows.map(unitOf).filter(Boolean))].map((currency) => {
      const own = rows.filter((row) => unitOf(row) === currency);
      const valued = own.filter((row) => row.value != null);
      return Object.freeze({ currency, holdingCount: own.length, valuedCount: valued.length,
        value: valued.length === own.length ? valued.reduce((sum, row) => sum + row.value, 0) : null });
    }))
    : null;
  const valuationState = readState !== 'ready' ? 'unavailable' : rows.length === 0 ? (cash != null ? (cash > 0 ? 'cash-only' : 'empty') : cashHeld ? 'cash-only' : 'empty') : allRowsValued ? 'complete' : someRowsValued ? 'partial' : currencySubtotals ? 'mixed-currency' : 'unavailable';
  const hasCanonicalValue = valuationState === 'cash-only' || valuationState === 'complete' || (valuationState === 'empty' && totalAssets === 0);
  const decisionReadyQuoteCount = rows.filter((row) => row.sourceKind === 'live-quote' && row.quoteAllowedUse === 'decision').length;
  const snapshotFallbackBlocked = true;
  const costFallbackBlocked = true;
  return Object.freeze({
    modelVersion: PORTFOLIO_SURFACE_MODEL_VERSION,
    readState,
    valuationState,
    currencyState,
    currencyBasis,
    costCurrencyState,
    baseCurrency: conversion.applied ? declaredBaseCurrency : (currencyBasis === 'declared-single' ? declaredCurrencies[0] : null),
    valuationCurrency: holdingsUnit,
    // Why a total is held: a currency mix a declared rate would convert, or a holding whose unit is unknown, which no rate fixes.
    currencyHeldReason: currencyState !== 'mixed-without-conversion' ? null
      : declaredCurrencies.length > 1 || effectiveCurrencies.length > 1 ? 'mixed' : 'unknown-unit',
    unknownCurrencyCount: unknownUnitRows,
    // A USD/KRW mix with no base currency chosen: choosing one is all it takes, because the app's own USD/KRW close then
    // converts it (no declared rate needed). The held sentences say that instead of asking for a rate declaration.
    baseChoiceConverts: currencyState === 'mixed-without-conversion' && !declaredBaseCurrency && appCovers && unknownUnitRows === 0,
    appFxDate: cashFx && cashFx.rate > 0 ? cashFx.date || null : null,
    declaredCurrencies: Object.freeze(declaredCurrencies),
    // The units the holdings are actually in (declared or the listing's), which a mix names; declaredCurrencies is
    // empty when only costs or listings carry the unit, and the mix note read "통화 혼합()".
    heldCurrencies: Object.freeze(effectiveCurrencies.slice()),
    currencySubtotals,
    declaredBaseCurrency: declaredBaseCurrency || null,
    declaredCashCurrency: declaredCashCurrency || null,
    conversion: Object.freeze({
      ...conversion,
      legs: Object.freeze(conversion.legs.map((leg) => Object.freeze({ ...leg }))),
      held: Object.freeze(conversion.held.map((entry) => Object.freeze({ ...entry })))
    }),
    holdingsKnown,
    cashKnown,
    valuedHoldingCount: rows.filter((row) => row.value != null).length,
    closeValuedCount: rows.filter((row) => row.value != null && row.sourceKind === 'completed-close').length,
    delayedValuedCount: rows.filter((row) => row.value != null && row.sourceKind === 'delayed-reference-quote').length,
    closeDate: rows.map((row) => row.closeDate).filter(Boolean).sort().at(-1) || null,
    oldestCloseDate: rows.map((row) => row.closeDate).filter(Boolean).sort()[0] || null,
    staleCloseCount: rows.filter((row) => row.value != null && row.closeStale).length,
    status: hasCanonicalValue ? 'current' : (state?.status || 'unavailable'),
    holdingCount: rows.length,
    rows: Object.freeze(rows),
    positionValue,
    totalAssets,
    totalCost,
    totalPnl,
    totalPnlPct,
    cash,
    cashEntered: cashCurrencies.length <= 1 && cashBalances.length ? cashBalances.reduce((sum, row) => sum + row.amount, 0) : null,
    cashBalances: Object.freeze(cashBalances.map((row) => Object.freeze({ ...row }))),
    cashHeld,
    cashInvalidCount,
    cashConversion: Object.freeze({ target: cashConversion.target, converted: cashConversion.converted, basisLabel: cashConversion.basisLabel, held: cashConversion.held,
      appRate: cashConversion.parts.some((part) => part.basis === 'app-close') ? cashConversion.appFx?.rate ?? null : null }),
    cashPct: cash != null && totalAssets != null && totalAssets > 0 ? cash / totalAssets * 100 : null,
    dailyChange,
    dailyPct,
    vix: vixValue,
    exposurePct,
    exposurePolicyStatus: 'reference-only',
    allowedUse: 'reference-only',
    decisionUse: false,
    decisionEligible: false,
    decisionReadyQuoteCount,
    snapshotFallbackBlocked,
    costFallbackBlocked,
    promotionBlocked: true,
    promotionBlockers: Object.freeze(['portfolio-surface-is-reference-only', 'snapshot-fallback-blocked', 'cost-fallback-blocked']),
    sectorBreakdown: Object.freeze(sectorBreakdown),
    sourceKind,
    sourceLabel: sourceKind === 'unavailable' ? 'portfolio-surface-unavailable' : 'native-portfolio-surface-reference-only',
    observedAt: rows.some((row) => row.sourceKind === 'live-quote')
      ? rows.map((row) => row.observedAt).filter(Boolean).sort()[0] || null
      : rows.some((row) => row.value != null && row.observedAt)
        ? rows.filter((row) => row.value != null).map((row) => row.observedAt || state?.updatedAt || null).filter(Boolean).sort()[0] || null
        : state?.updatedAt || null
  });
}
