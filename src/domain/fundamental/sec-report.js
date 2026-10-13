import { finiteFact, sameFiscalPeriod, isPriorAnnualPeriod } from './period.js';

export const SEC_REPORT_MODEL_VERSION = 'sec-report.v3';
export const SEC_FRESHNESS_POLICY = Object.freeze({
  currentMaxAgeDays: 400,
  agedMaxAgeDays: 730,
  futureSkewDays: 2
});

function finite(value) {
  return finiteFact(value);
}

const METRIC_DEFINITIONS = Object.freeze([
  // P1591: Korean labels; ROE is shown once, in the fiscal reading (average equity, the standard basis) —
  // a second end-of-year ROE beside it read as a conflicting number (S07).
  ['revenue', '매출', 'currency'],
  ['netIncome', '순이익', 'currency'],
  ['equity', '자기자본(기말)', 'currency'],
  ['sharesOutstanding', '발행주식 수', 'shares'],
  ['revGrowth', '매출 성장률', 'percent'],
  ['margin', '순이익률', 'percent'],
  ['pe', 'P/E', 'multiple'],
  ['pb', 'P/B', 'multiple']
]);

function classifyFreshness(observedAt, now = Date.now()) {
  const observedMs = observedAt ? Date.parse(String(observedAt)) : NaN;
  if (!Number.isFinite(observedMs)) return Object.freeze({ state: 'unknown', ageDays: null, decisionEligible: false });
  const ageDays = Math.floor((now - observedMs) / 86400000);
  if (ageDays < -SEC_FRESHNESS_POLICY.futureSkewDays) return Object.freeze({ state: 'unknown', ageDays: null, decisionEligible: false });
  if (ageDays <= SEC_FRESHNESS_POLICY.currentMaxAgeDays) return Object.freeze({ state: 'current', ageDays: Math.max(0, ageDays), decisionEligible: true });
  if (ageDays <= SEC_FRESHNESS_POLICY.agedMaxAgeDays) return Object.freeze({ state: 'aged', ageDays, decisionEligible: false });
  return Object.freeze({ state: 'historical', ageDays, decisionEligible: false });
}

function detectAnomalies(input, metrics) {
  const anomalies = [];
  metrics.forEach(metric => {
    // Losses and negative equity are valid reported financial facts.
    if (['revenue', 'sharesOutstanding'].includes(metric.key) && metric.value < 0) anomalies.push(`${metric.key}:negative`);
    if (['margin', 'roe'].includes(metric.key) && Math.abs(metric.value) > 1000) anomalies.push(`${metric.key}:outlier`);
    if (metric.key === 'revGrowth' && metric.value < -100) anomalies.push('revGrowth:below-minus-100');
  });
  if (input.anomaly === true) anomalies.push('producer-flagged-anomaly');
  if (Array.isArray(input.anomalies)) anomalies.push(...input.anomalies.map((value) => String(value || '').trim()).filter(Boolean));
  return [...new Set(anomalies)];
}

function observationEffectiveAt(row) {
  return row?.acceptedAt || row?.effectiveAt || row?.filedAt || null;
}

// P1402: for the same period and filing, parent-company equity outranks the NCI-inclusive total.
const CONCEPT_RANK = Object.freeze({ StockholdersEquity: 0, StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest: 1 });
const conceptRank = (row) => CONCEPT_RANK[row?.concept] ?? 0;

function selectObservationAsOf(rows, asOfMs, period = null) {
  const eligible = (Array.isArray(rows) ? rows : []).filter((row) => {
    const effectiveMs = Date.parse(observationEffectiveAt(row) || '');
    const periodMs = Date.parse(row?.periodEnd || '');
    return Number.isFinite(effectiveMs) && effectiveMs <= asOfMs && Number.isFinite(periodMs) && periodMs <= asOfMs && finite(row?.value) != null && (!period || sameFiscalPeriod(row, period));
  });
  eligible.sort((a, b) => String(b.periodEnd || '').localeCompare(String(a.periodEnd || '')) || Date.parse(observationEffectiveAt(b)) - Date.parse(observationEffectiveAt(a)) || conceptRank(a) - conceptRank(b));
  return eligible[0] || null;
}

// Reconstructs only what the SEC artifact says was public by `asOf`. Price-based
// ratios are emitted only when the caller supplies a contemporaneous price;
// current prices are never projected backward into a historical filing cut.
export function selectSecFundamentalsAsOf(record = {}, asOf, { priceAsOf = null } = {}) {
  const asOfMs = Date.parse(asOf || '');
  const observations = record?.pit?.observations || {};
  if (!Number.isFinite(asOfMs) || !observations || typeof observations !== 'object') return null;
  const revenue = selectObservationAsOf(observations.revenue, asOfMs);
  if (!revenue) return null;
  const netIncome = selectObservationAsOf(observations.netIncome, asOfMs, revenue);
  const equity = selectObservationAsOf(observations.equity, asOfMs, revenue);
  // 2026-10-13 F03: the fallback share count must belong to the same fiscal year (within 400 days of its end).
  const fallbackShares = selectObservationAsOf(observations.sharesOutstanding, asOfMs);
  const shares = selectObservationAsOf(observations.sharesOutstanding, asOfMs, revenue)
    || (fallbackShares && shareGapDays(fallbackShares.periodEnd, revenue.periodEnd) <= SEC_SHARES_MAX_GAP_DAYS ? fallbackShares : null);
  const priorRevenue = (Array.isArray(observations.revenue) ? observations.revenue : [])
    .filter((row) => isPriorAnnualPeriod(revenue, row) && Date.parse(observationEffectiveAt(row) || '') <= asOfMs && finite(row.value) != null)
    .sort((a, b) => String(b.periodEnd).localeCompare(String(a.periodEnd)) || Date.parse(observationEffectiveAt(b)) - Date.parse(observationEffectiveAt(a)))[0] || null;
  const result = {
    symbol: record.symbol || null,
    cik: record.cik || null,
    entityName: record.entityName || null,
    source: record.source || 'SEC EDGAR companyfacts',
    sourceTier: record.sourceTier || 'official-regulator',
    model: 'sec-pit-asof-v1',
    periodType: 'FY',
    observedAt: revenue.periodEnd,
    filedAt: revenue.filedAt || null,
    acceptedAt: revenue.acceptedAt || null,
    effectiveAt: observationEffectiveAt(revenue),
    asOf: new Date(asOfMs).toISOString(),
    form: revenue.form || null,
    accession: revenue.accession || null,
    revenue: finite(revenue.value),
    netIncome: finite(netIncome?.value),
    equity: finite(equity?.value),
    sharesOutstanding: finite(shares?.value),
    sharesObservedAt: shares?.periodEnd || null,
    coverage: ['revenue', ...(netIncome ? ['netIncome'] : [])],
    pointInTimeStatus: revenue.acceptedAt ? 'accepted-time' : 'filed-date-only'
  };
  if (priorRevenue && finite(priorRevenue.value) > 0) result.revGrowth = Math.round((result.revenue / finite(priorRevenue.value) - 1) * 1000) / 10;
  if (result.netIncome != null && result.revenue !== 0) result.margin = Math.round(result.netIncome / result.revenue * 1000) / 10;
  if (result.netIncome != null && result.equity > 0) result.roe = Math.round(result.netIncome / result.equity * 1000) / 10;
  const price = finite(priceAsOf);
  const marketCap = price > 0 && result.sharesOutstanding > 0 ? price * result.sharesOutstanding : null;
  if (marketCap && result.netIncome > 0) result.pe = Math.round(marketCap / result.netIncome * 100) / 100;
  if (marketCap && result.equity > 0) result.pb = Math.round(marketCap / result.equity * 100) / 100;
  ['equity', 'sharesOutstanding', 'revGrowth', 'margin', 'roe', 'pe', 'pb'].forEach((key) => {
    if (finite(result[key]) != null) result.coverage.push(key);
  });
  result.coverage = Object.freeze(result.coverage);
  return Object.freeze(result);
}

// P1402: an artifact written before the concept order changed carries the NCI-inclusive total.
// Use the same filing's parent-company equity (the ROE/P-B denominator, consistent with
// NetIncomeLoss) and re-derive ROE and P/B from it; a non-positive parent equity leaves both empty.
export function reconcileSecEquity(record) {
  if (!record || typeof record !== 'object') return record;
  const rows = Array.isArray(record.pit?.observations?.equity) ? record.pit.observations.equity : [];
  const sameFiling = (row) => row.periodEnd === record.observedAt && (!record.accession || row.accession === record.accession);
  const parent = rows.find((row) => sameFiling(row) && row.concept === 'StockholdersEquity' && finite(row.value) != null);
  const total = finite(record.equity);
  if (!parent || finite(parent.value) === total) return record;
  const parentValue = finite(parent.value);
  const corrected = { ...record, equity: parentValue, equityConcept: 'StockholdersEquity' };
  if (total != null && Math.abs(total - parentValue) > Math.abs(parentValue) * 0.5) corrected.equityConceptConflict = { reported: total, parent: parentValue };
  delete corrected.roe;
  delete corrected.pb;
  const netIncome = finite(record.netIncome);
  if (netIncome != null && parentValue > 0) corrected.roe = Math.round(netIncome / parentValue * 1000) / 10;
  // P/B = market cap / equity, so the stored ratio rescales exactly by the equity change.
  if (finite(record.pb) != null && total > 0 && parentValue > 0) corrected.pb = Math.round(finite(record.pb) * total / parentValue * 100) / 100;
  const coverage = new Set((Array.isArray(record.coverage) ? record.coverage : []).filter((key) => key !== 'roe' && key !== 'pb'));
  coverage.add('equity');
  if (corrected.roe != null) coverage.add('roe');
  if (corrected.pb != null) coverage.add('pb');
  corrected.coverage = [...coverage];
  return corrected;
}

// 2026-10-13 screener data audit (F03/F04/F05/F06/F10/F16/F17): one SEC normalization policy shared by the
// producer (companyfacts rows: start/end/val/filed), the screener merge and the page projection (PIT rows:
// periodStart/periodEnd/value/filedAt), so a stored record is healed by the same rule a fresh fetch applies.
// A cover-page share count dated more than 400 days from the fiscal year end is a different year's count
// (V/MA/CMCSA carried 2009 shares and printed P/E 2-9).
export const SEC_SHARES_MAX_GAP_DAYS = 400;
// F05: a net margin above 100% means the revenue concept is a subtotal (ESS customer-contract revenue 9.4M
// against 1.89B total revenues), not a business fact; the margin is withheld.
export const SEC_MARGIN_HOLD_ABOVE_PCT = 100;
// Primary revenue concepts compete on size for the same fiscal period: a customer-contract subtotal never
// exceeds total revenues (REITs, insurers, banks report rent/premium/interest outside ASC 606). The
// assessed-tax-inclusive concept (XOM/VLO style) is used only when no primary concept reported the period.
export const SEC_PRIMARY_REVENUE_CONCEPTS = Object.freeze(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense']);
export const SEC_FALLBACK_REVENUE_CONCEPTS = Object.freeze(['RevenueFromContractWithCustomerIncludingAssessedTax']);
// Reference market-cap plausibility (P1318): a share basis whose implied daily turnover falls outside this band is
// a scale, ADR-ratio or share-class error, not a company size.
export const SEC_REFERENCE_TURNOVER_BOUNDS = Object.freeze({ min: 0.0005, max: 0.2 });

const rowStart = (row) => row?.periodStart ?? row?.start ?? null;
const rowEnd = (row) => row?.periodEnd ?? row?.end ?? null;
const rowValue = (row) => finite(row?.value ?? row?.val);
const rowFiled = (row) => String(row?.filedAt ?? row?.filed ?? '');

export function shareGapDays(sharesObservedAt, fiscalPeriodEnd) {
  const shares = Date.parse(String(sharesObservedAt || '').slice(0, 10));
  const fiscal = Date.parse(String(fiscalPeriodEnd || '').slice(0, 10));
  return Number.isFinite(shares) && Number.isFinite(fiscal) ? Math.abs(shares - fiscal) / 86400000 : null;
}

// One revenue row per fiscal period (start|end): the latest filing per concept, then the largest primary concept,
// else the assessed-tax-inclusive fallback. Sorted latest period first.
export function bestRevenueRowsByPeriod(rows = []) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || rowValue(row) == null || !rowEnd(row)) continue;
    const concept = String(row.concept || '');
    // A concept-less row (legacy PIT migration) competes as a primary row.
    if (concept && !SEC_PRIMARY_REVENUE_CONCEPTS.includes(concept) && !SEC_FALLBACK_REVENUE_CONCEPTS.includes(concept)) continue;
    const key = `${rowStart(row) || ''}|${rowEnd(row)}`;
    const byConcept = groups.get(key) || new Map();
    const prev = byConcept.get(concept);
    if (!prev || rowFiled(row) > rowFiled(prev)) byConcept.set(concept, row);
    groups.set(key, byConcept);
  }
  const chosen = [];
  for (const byConcept of groups.values()) {
    const candidates = [...byConcept.values()];
    const primary = candidates.filter((row) => !row.concept || SEC_PRIMARY_REVENUE_CONCEPTS.includes(row.concept));
    const pool = primary.length ? primary : candidates;
    pool.sort((a, b) => rowValue(b) - rowValue(a) || rowFiled(b).localeCompare(rowFiled(a)));
    chosen.push(pool[0]);
  }
  return chosen.sort((a, b) => String(rowEnd(b)).localeCompare(String(rowEnd(a))) || rowFiled(b).localeCompare(rowFiled(a)));
}

// Heals a stored record (written before this policy) from its own PIT observations; idempotent. Revenue is
// re-selected for the record's period and its prior year, margin above 100% is withheld, and a share count
// more than 400 days from the fiscal year end is dropped with the price ratios that used it.
export function reconcileSecRevenueShares(record) {
  if (!record || typeof record !== 'object') return record;
  const observations = record.pit?.observations || {};
  let next = record;
  const edit = () => { if (next === record) next = { ...record, coverage: Array.isArray(record.coverage) ? [...record.coverage] : [] }; return next; };
  const dropCoverage = (...keys) => { edit(); next.coverage = next.coverage.filter((key) => !keys.includes(key)); };
  const annual = (Array.isArray(observations.revenue) ? observations.revenue : []).filter((row) => {
    const days = (Date.parse(rowEnd(row) || '') - Date.parse(rowStart(row) || '')) / 86400000;
    return row?.fiscalPeriod === 'FY' && days >= 300 && days <= 400;
  });
  const best = bestRevenueRowsByPeriod(annual);
  const current = best.find((row) => rowEnd(row) === record.observedAt) || null;
  const stored = finite(record.revenue);
  if (current && stored != null && rowValue(current) !== stored) {
    edit();
    next.revenue = rowValue(current);
    next.revenueConcept = current.concept || null;
    next.revenueHealedFrom = stored;
    const netIncome = finite(record.netIncome);
    delete next.margin;
    if (netIncome != null && next.revenue !== 0) next.margin = Math.round(netIncome / next.revenue * 1000) / 10;
    const prior = best.find((row) => isPriorAnnualPeriod(current, row));
    delete next.revGrowth;
    if (prior && rowValue(prior) > 0) next.revGrowth = Math.round((next.revenue / rowValue(prior) - 1) * 1000) / 10;
    dropCoverage('margin', 'revGrowth');
    if (next.margin != null) next.coverage.push('margin');
    if (next.revGrowth != null) next.coverage.push('revGrowth');
  }
  const margin = finite(next.margin);
  if (margin != null && margin > SEC_MARGIN_HOLD_ABOVE_PCT) {
    edit();
    next.marginHeld = { value: margin, reason: 'margin-above-100pct-revenue-subtotal' };
    delete next.margin;
    dropCoverage('margin');
  }
  const gap = shareGapDays(next.sharesObservedAt, next.observedAt);
  if (finite(next.sharesOutstanding) != null && gap != null && gap > SEC_SHARES_MAX_GAP_DAYS) {
    edit();
    next.sharesHeld = { value: finite(next.sharesOutstanding), observedAt: next.sharesObservedAt, reason: 'shares-period-mismatch' };
    next.sharesOutstanding = null;
    next.sharesCheck = 'stale-period';
    delete next.pe;
    delete next.pb;
    dropCoverage('sharesOutstanding', 'pe', 'pb');
  }
  return next;
}

export function reconcileSecRecord(record) {
  return reconcileSecEquity(reconcileSecRevenueShares(record));
}

// F04/F10: which share count may price a market cap. A count the producer matched to net income ÷ diluted EPS
// is used as is; an older record without that check (494 of 659 on 2026-10-09) or an unchecked one is used only
// when the implied daily turnover is plausible. A stale-period or scale-mismatched count is never used.
export function secSharesTrust(record, { price = null, dollarVolume30d = null } = {}) {
  const shares = finite(record?.sharesOutstanding);
  if (shares == null || shares <= 0) return { shares: null, check: null, reason: record?.sharesCheck === 'stale-period' ? 'stale-period' : 'shares-unavailable' };
  const gap = shareGapDays(record?.sharesObservedAt, record?.observedAt);
  if (gap != null && gap > SEC_SHARES_MAX_GAP_DAYS) return { shares: null, check: null, reason: 'stale-period' };
  if (record?.sharesCheck === 'scale-mismatch') return { shares: null, check: null, reason: 'scale-mismatch' };
  if (record?.sharesCheck === 'consistent') return { shares, check: 'eps-consistent', reason: null };
  const px = finite(price);
  const volume = finite(dollarVolume30d);
  const turnover = px > 0 && volume > 0 ? volume / (px * shares) : null;
  if (turnover != null && turnover >= SEC_REFERENCE_TURNOVER_BOUNDS.min && turnover <= SEC_REFERENCE_TURNOVER_BOUNDS.max) return { shares, check: 'turnover-plausible', reason: null };
  return { shares: null, check: null, reason: 'unverified-share-basis' };
}

// F17/F18: extreme annual ratios are kept for display with a reading flag. Ranking already bounds them — the value
// factor ignores P/E at or above 200 and the quality factor clamps ROE (-30..60), margin (-20..40) and revenue
// growth (-30..60) — so a flagged value cannot dominate a rank.
export function fundamentalValueFlags(row = {}) {
  const flags = [];
  const pe = finite(row?.pe);
  const roe = finite(row?.roe);
  const growth = finite(row?.revGrowth);
  const margin = finite(row?.margin);
  if (pe != null && pe > 1000) flags.push({ field: 'pe', code: 'low-meaning', label: '의미 낮음 — 이익이 시가총액에 비해 매우 작음' });
  if (roe != null && Math.abs(roe) > 200) flags.push({ field: 'roe', code: 'low-meaning', label: '의미 낮음 — 자기자본이 매우 작거나 음수에 가까움' });
  if (growth != null && growth > 1000) flags.push({ field: 'revGrowth', code: 'one-off-possible', label: '일회성 가능 — 전년 매출이 매우 작은 기저 효과' });
  if (margin != null && margin < -1000) flags.push({ field: 'margin', code: 'low-meaning', label: '의미 낮음 — 매출이 매우 작음' });
  return flags;
}

export function secFilingUrl(cik, accession) {
  const company = String(cik || '');
  const filing = String(accession || '');
  if (!/^\d{1,10}$/.test(company) || Number(company) <= 0 || !/^\d{10}-\d{2}-\d{6}$/.test(filing)) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(company)}/${filing.replaceAll('-', '')}/${filing}-index.html`;
}

export function deriveSecReport(fundamentals = null) {
  const input = reconcileSecRecord(fundamentals && typeof fundamentals === 'object' ? fundamentals : {});
  const knownMetrics = new Set(METRIC_DEFINITIONS.map(([key]) => key));
  const coverage = Array.isArray(input.coverage) ? input.coverage.filter((field) => typeof field === 'string' && knownMetrics.has(field)) : [];
  const metrics = METRIC_DEFINITIONS
    .filter(([key]) => coverage.includes(key) && finite(input[key]) != null)
    .map(([key, label, unit]) => Object.freeze({ key, label, unit, value: finite(input[key]) }));
  const anomalies = detectAnomalies(input, metrics);
  const notApplicable = input.notApplicable === true || input.applicability === 'not-applicable';
  const classification = notApplicable ? 'not-applicable' : metrics.length > 0 ? 'current' : 'missing';
  const status = notApplicable ? 'not-applicable' : anomalies.length ? 'quarantined' : metrics.length > 0 ? 'current' : 'unavailable';
  const observedAt = input.observedAt || null;
  const freshness = classifyFreshness(observedAt);
  const pit = input?.pit && typeof input.pit === 'object' ? input.pit : null;
  return Object.freeze({
    modelVersion: SEC_REPORT_MODEL_VERSION,
    status,
    classification,
    anomalyStatus: anomalies.length ? 'quarantined' : 'none',
    anomalies: Object.freeze(anomalies),
    symbol: input.symbol ? String(input.symbol).toUpperCase() : null,
    entityName: input.entityName ? String(input.entityName) : null,
    form: input.form ? String(input.form) : null,
    cik: input.cik ? String(input.cik) : null,
    accession: input.accession ? String(input.accession) : null,
    filingUrl: secFilingUrl(input.cik, input.accession),
    periodType: input.periodType ? String(input.periodType) : null,
    observedAt,
    filedAt: input.filedAt || null,
    fetchedAt: input.fetchedAt || null,
    filingMetadata: Object.freeze({ form: input.form || null, cik: input.cik || null, accession: input.accession || null, filedAt: input.filedAt || null, acceptedAt: input.acceptedAt || null }),
    pointInTime: Object.freeze({
      status: pit?.status || 'unavailable',
      observationCount: Math.max(0, finite(pit?.observationCount) || 0),
      acceptedTimeCount: Math.max(0, finite(pit?.acceptedTimeCount) || 0)
    }),
    source: input.source || 'SEC EDGAR companyfacts',
    sourceKind: input.sourceTier || 'official-regulator',
    allowedUse: input.allowedUse || 'research/reference',
    freshness,
    decisionEligible: status === 'current' && freshness.decisionEligible === true && input.allowedUse === 'decision',
    coverage: Object.freeze([...new Set(coverage)]),
    metrics: Object.freeze(anomalies.length ? [] : metrics),
    quarantinedMetrics: Object.freeze(anomalies.length ? metrics : [])
  });
}
