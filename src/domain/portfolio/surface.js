export const PORTFOLIO_SURFACE_MODEL_VERSION = 'portfolio-surface.v3';

export const PORTFOLIO_READ_STATES = Object.freeze(['loading', 'locked', 'ready', 'failed']);
export const PORTFOLIO_VALUATION_STATES = Object.freeze(['empty', 'cash-only', 'complete', 'partial', 'unavailable']);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

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

const LIVE_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
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

function holdingValue(holding, live, options) {
  const sharesRaw = finite(holding?.shares);
  const shares = sharesRaw != null && sharesRaw >= 0 ? sharesRaw : null;
  const liveQuote = runtimeQuoteEvidence(live, options);
  const livePrice = liveQuote?.price ?? null;
  const price = firstPositive(livePrice, holding?.price);
  const explicitValue = firstPositive(holding?.value);
  if (shares != null && price != null && price > 0) return {
    value: shares * price,
    price,
    sourceKind: livePrice != null ? 'live-quote' : 'portfolio-state',
    observedAt: liveQuote?.observedAt || holding?.quoteObservedAt || null,
    quoteAllowedUse: liveQuote?.allowedUse || 'reference-only',
    fallbackUsed: livePrice == null,
    dailyPct: liveQuote?.dailyPct ?? finite(holding?.dailyPct),
    dailyPctEligible: liveQuote?.dailyPctEligible === true && liveQuote?.changeBasis ? true : false,
    changeBasis: liveQuote?.changeBasis || holding?.changeBasis || holding?.valueBasis || null
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

function exposureCapForVix(vix) {
  if (vix == null || vix <= 0) return null;
  return vix < 15 ? 100 : vix < 20 ? 80 : vix < 25 ? 50 : vix < 30 ? 30 : 15;
}

/**
 * Derives the deterministic, non-chart portion of the portfolio surface.
 * Missing canonical inputs remain null so the UI cannot turn unavailable data into a zero.
 * Read state never becomes a valuation: only an explicit read distinguishes empty/cash-only.
 */
export function derivePortfolioSurface({ state = {}, liveData = {}, vix = null, now = Date.now() } = {}) {
  const readState = PORTFOLIO_READ_STATES.includes(state?.readState) ? state.readState : (state?.status === 'locked' ? 'locked' : state?.status === 'loading' ? 'loading' : state?.status === 'failed' ? 'failed' : state?.status === 'unavailable' ? 'unavailable' : 'ready');
  const holdingsKnown = Array.isArray(state?.holdings) && (readState === 'ready' || state?.holdingsKnown === true);
  const holdings = holdingsKnown ? state.holdings : [];
  const totals = state?.totals && typeof state.totals === 'object' ? state.totals : {};
  const live = liveData && typeof liveData === 'object' ? liveData : {};
  const rows = holdings.map((holding) => {
    const symbol = String(holding?.symbol || holding?.ticker || '').toUpperCase();
    const quote = holdingValue(holding, live[symbol] || {}, { now });
    const sharesValue = finite(holding?.shares);
    const shares = sharesValue != null && sharesValue >= 0 ? sharesValue : null;
    const avgCostValue = finite(holding?.avgCost);
    const avgCost = avgCostValue != null && avgCostValue >= 0 ? avgCostValue : null;
    const cost = shares != null && avgCost != null ? shares * avgCost : null;
    const dailyPct = quote.dailyPct;
    return Object.freeze({
      symbol,
      shares,
      avgCost,
      value: quote.value,
      price: quote.price,
      cost,
      sector: String(holding?.sector || 'Unclassified'),
      dailyPct,
      sourceKind: quote.sourceKind,
      observedAt: quote.observedAt,
      quoteAllowedUse: quote.quoteAllowedUse,
      fallbackUsed: quote.fallbackUsed,
      dailyPctEligible: quote.dailyPctEligible,
      changeBasis: quote.changeBasis
    });
  }).filter((row) => row.symbol);

  const allRowsValued = rows.length > 0 && rows.every((row) => row.value != null);
  const someRowsValued = rows.some((row) => row.value != null);
  const cashValue = firstFinite(state?.cash, totals.cash);
  const cashKnown = readState === 'ready' && (state?.cashKnown === true || cashValue != null || holdingsKnown);
  const cash = cashKnown && cashValue != null && cashValue >= 0 ? cashValue : (cashValue === 0 ? 0 : null);
  const positionValue = readState === 'ready' && rows.length === 0 && holdingsKnown ? 0 : (rows.length ? (allRowsValued ? rows.reduce((sum, row) => sum + row.value, 0) : null) : null);
  const totalAssets = readState === 'ready' && positionValue != null && cash != null ? positionValue + cash : null;
  const allRowsCosted = rows.length > 0 && rows.every((row) => row.cost != null);
  const totalCost = allRowsCosted ? rows.reduce((sum, row) => sum + row.cost, 0) : null;
  const totalPnl = positionValue != null && totalCost != null
    ? positionValue - totalCost
    : null;
  const totalPnlPct = totalPnl != null && totalCost > 0 ? totalPnl / totalCost * 100 : null;
  const allRowsDaily = rows.length > 0 && rows.every((row) => row.value != null && row.dailyPctEligible === true && row.dailyPct != null && row.dailyPct > -100);
  const dailyChange = allRowsDaily ? rows.reduce((sum, row) => sum + row.value - row.value / (1 + row.dailyPct / 100), 0) : null;
  const previousAssets = dailyChange != null && totalAssets != null ? totalAssets - dailyChange : null;
  const dailyPct = previousAssets > 0 ? dailyChange / previousAssets * 100 : null;
  const exposurePct = totalAssets != null && totalAssets > 0 && positionValue != null ? positionValue / totalAssets * 100 : null;
  const vixQuote = runtimeQuoteEvidence(vix, { now });
  const vixValue = vixQuote?.price ?? null;
  const exposureCap = exposureCapForVix(vixValue);
  const sectors = new Map();
  for (const row of rows) {
    if (row.value == null || totalAssets == null || totalAssets <= 0) continue;
    const name = row.sector || 'Unclassified';
    sectors.set(name, (sectors.get(name) || 0) + row.value / totalAssets * 100);
  }
  if (cash != null && totalAssets != null && totalAssets > 0 && cash > 0) sectors.set('CASH', cash / totalAssets * 100);
  const sectorBreakdown = [...sectors.entries()]
    .map(([name, pct]) => Object.freeze({ name, pct }))
    .sort((a, b) => b.pct - a.pct);
  const sourceKind = rows.some((row) => row.sourceKind === 'live-quote') ? 'portfolio-state+live-quote' : rows.length ? 'portfolio-state' : cash != null ? 'portfolio-state:cash-only' : 'unavailable';
  const valuationState = readState !== 'ready' ? 'unavailable' : rows.length === 0 ? (cash != null ? (cash > 0 ? 'cash-only' : 'empty') : 'empty') : allRowsValued ? 'complete' : someRowsValued ? 'partial' : 'unavailable';
  const hasCanonicalValue = valuationState === 'cash-only' || valuationState === 'complete' || (valuationState === 'empty' && totalAssets === 0);
  const decisionReadyQuoteCount = rows.filter((row) => row.sourceKind === 'live-quote' && row.quoteAllowedUse === 'decision').length;
  const snapshotFallbackBlocked = true;
  const costFallbackBlocked = true;
  return Object.freeze({
    modelVersion: PORTFOLIO_SURFACE_MODEL_VERSION,
    readState,
    valuationState,
    holdingsKnown,
    cashKnown,
    valuedHoldingCount: rows.filter((row) => row.value != null).length,
    status: hasCanonicalValue ? 'current' : (state?.status || 'unavailable'),
    holdingCount: rows.length,
    rows: Object.freeze(rows),
    positionValue,
    totalAssets,
    totalCost,
    totalPnl,
    totalPnlPct,
    cash,
    cashPct: cash != null && totalAssets != null && totalAssets > 0 ? cash / totalAssets * 100 : null,
    dailyChange,
    dailyPct,
    vix: exposureCap == null ? null : vixValue,
    exposurePct,
    exposureCap,
    exposureExceeded: exposurePct != null && exposureCap != null ? exposurePct > exposureCap : null,
    exposurePolicyStatus: 'reference-only',
    allowedUse: 'reference-only',
    decisionUse: false,
    decisionEligible: false,
    decisionReadyQuoteCount,
    snapshotFallbackBlocked,
    costFallbackBlocked,
    promotionBlocked: true,
    promotionBlockers: Object.freeze(['portfolio-surface-is-reference-only', 'snapshot-fallback-blocked', 'cost-fallback-blocked']),
    sectorBreakdown: Object.freeze(sectorBreakdown.map((row) => Object.freeze({ ...row, basis: row.name === 'CASH' ? 'total-assets-including-cash' : 'total-assets-including-cash' }))),
    sourceKind,
    sourceLabel: sourceKind === 'unavailable' ? 'portfolio-surface-unavailable' : 'native-portfolio-surface-reference-only',
    observedAt: rows.some((row) => row.sourceKind === 'live-quote')
      ? rows.map((row) => row.observedAt).filter(Boolean).sort()[0] || null
      : state?.updatedAt || null
  });
}
