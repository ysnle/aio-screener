// v57.81: the SEC companyfacts → annual-record normalizer, moved here from scripts/fetch-sec-fundamentals.mjs so
// the browser can read an out-of-universe issuer's filing with the same functions (the producer imports and
// re-exports them). Pure: companyfacts/submissions JSON in, one annual record out; no I/O.
import { finiteFact, sameFiscalPeriod, isPriorAnnualPeriod, FUNDAMENTAL_MAX_PERIOD_AGE_DAYS } from './period.js';
import { reconcileSecEquity, reconcileSecRevenueShares, bestRevenueRowsByPeriod, shareGapDays, SEC_SHARES_MAX_GAP_DAYS, SEC_MARGIN_HOLD_ABOVE_PCT, SEC_PRIMARY_REVENUE_CONCEPTS, SEC_FALLBACK_REVENUE_CONCEPTS, SEC_BANK_NET_REVENUE_CONCEPT } from './sec-report.js';

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function tickerKey(symbol) {
  return String(symbol || '').toUpperCase().replace(/\./g, '-');
}

function durationDays(row) {
  if (!row || !row.start || !row.end) return null;
  return Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 86400000);
}

function factRows(companyFacts, taxonomy, concepts, unit) {
  const facts = companyFacts && companyFacts.facts && companyFacts.facts[taxonomy];
  if (!facts) return [];
  const collected = [];
  for (const concept of concepts) {
    const conceptRows = facts[concept] && facts[concept].units && facts[concept].units[unit];
    if (Array.isArray(conceptRows) && conceptRows.length) conceptRows.forEach(row => collected.push({ ...row, concept }));
  }
  return collected;
}

// v5 (2026-10-16): bank net revenue = net interest income + noninterest income, paired within one filing (same
// accession, period and form) so a restated comparative never mixes with the original. Rows without both operands
// are not derived. InterestRevenueExpenseNet is the newer name some filers use for the same net interest income.
const BANK_NET_INTEREST_CONCEPTS = ['InterestIncomeExpenseNet', 'InterestRevenueExpenseNet'];
function bankNetRevenueRows(companyFacts) {
  const key = (row) => `${row.accn || ''}|${row.start || ''}|${row.end || ''}|${row.form || ''}|${row.fp || ''}`;
  const nonInterest = new Map(factRows(companyFacts, 'us-gaap', ['NoninterestIncome'], 'USD').map((row) => [key(row), row]));
  if (!nonInterest.size) return [];
  const netInterest = new Map();
  factRows(companyFacts, 'us-gaap', BANK_NET_INTEREST_CONCEPTS, 'USD').forEach((row) => { if (!netInterest.has(key(row))) netInterest.set(key(row), row); });
  const rows = [];
  for (const [k, nii] of netInterest) {
    const other = nonInterest.get(k);
    const a = finiteFact(nii.val);
    const b = finiteFact(other?.val);
    if (a == null || b == null) continue;
    rows.push({ ...nii, val: a + b, concept: SEC_BANK_NET_REVENUE_CONCEPT });
  }
  return rows;
}

function revenueFactRows(companyFacts) {
  return [...factRows(companyFacts, 'us-gaap', [...SEC_PRIMARY_REVENUE_CONCEPTS, ...SEC_FALLBACK_REVENUE_CONCEPTS], 'USD'), ...bankNetRevenueRows(companyFacts)];
}

function dedupeLatestFiled(rows) {
  const byPeriod = new Map();
  rows.forEach(row => {
    const key = `${row.start || ''}|${row.end || ''}|${row.form || ''}|${row.fp || ''}`;
    const prev = byPeriod.get(key);
    if (!prev || String(row.filed || '') > String(prev.filed || '')) byPeriod.set(key, row);
  });
  return [...byPeriod.values()].sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')) || String(b.filed || '').localeCompare(String(a.filed || '')));
}

function annualDurationRows(companyFacts, concepts) {
  const rows = factRows(companyFacts, 'us-gaap', concepts, 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && finiteFact(row.val) != null;
  });
  return dedupeLatestFiled(rows);
}

function instantRows(companyFacts, taxonomy, concepts, unit) {
  return dedupeLatestFiled(factRows(companyFacts, taxonomy, concepts, unit).filter(row =>
    /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && finiteFact(row.val) != null
  ));
}

function closestEnd(rows, end) {
  return rows.find(row => row.end === end) || null;
}

function acceptedAtByAccession(submissions) {
  const recent = submissions?.filings?.recent || {};
  const accessions = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const accepted = Array.isArray(recent.acceptanceDateTime) ? recent.acceptanceDateTime : [];
  return new Map(accessions.map((accession, index) => [String(accession || ''), accepted[index] || null]));
}

// W09-A/P1148: a fiscal year older than this is not "current financials" however recently we
// fetched it. 2026-10-13 F15: the producer uses the project's single 456-day rule (15 months after the
// fiscal year end, period.js) instead of its own 550-day budget, so its quality label and the screener agree.
const REPORT_RECENCY_MAX_DAYS = FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
// Stored records written by an older normalizer are due to be read again (in addition to the publish-time heal).
// 2026-10-15 (P1798): class-dimensioned 10-K share counts for multi-class filers.
// 2026-10-16: bank net revenue (v5 concept set) — stored bank records with a fee-subtotal revenue are re-read.
export const SEC_NORMALIZER_VERSION = 'sec-normalizer.2026-10-16';

// The earliest instant a single operand could have been known: its accession acceptance time
// when available, otherwise the filing date (which is a date, not an intraday time).
function pitAvailability(row, acceptedMap) {
  if (!row) return null;
  return acceptedMap.get(String(row.accn || '')) || row.filed || null;
}

function latestIso(values) {
  const times = (values || []).map((value) => Date.parse(value || '')).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/**
 * SEC ticker membership is not a data-capability claim. Foreign issuers often
 * have a SEC ticker entry but publish IFRS facts (or no comparable annual
 * concepts), while this normalizer intentionally consumes a bounded US-GAAP
 * concept set. Classify that boundary before scheduling so terminally
 * unsupported issuers do not occupy every future retry batch.
 */
// P1374: concept-coverage failures are only terminal for the concept set that produced them.
// Bump when the annual revenue/income concept lists change so those rows are rechecked once.
// v3 (2026-10-13 F06): RevenueFromContractWithCustomerIncludingAssessedTax added (VLO; XOM rechecked).
// v4 (2026-10-14): utility revenue (RegulatedAndUnregulatedOperatingRevenue, ElectricUtilityRevenue) as primary,
// SalesRevenueGoodsNet as fallback; EPS-implied share count as the last share candidate.
// v5 (2026-10-16): bank net revenue = net interest income + noninterest income of one filing (sec-report.js).
export const SEC_CONCEPT_SET_VERSION = 'sec-annual-concepts.v5';

export function classifyIssuerCapability(companyFacts, submissions = null) {
  const taxonomies = Object.keys(companyFacts?.facts || {});
  const hasUsGaap = taxonomies.includes('us-gaap');
  const hasIfrs = taxonomies.includes('ifrs-full');
  const recentForms = Array.isArray(submissions?.filings?.recent?.form) ? submissions.filings.recent.form : [];
  const foreignForm = recentForms.some(form => /^(20-F|40-F)(\/A)?$/.test(String(form || '')));
  const domesticForm = recentForms.some(form => /^(10-K)(\/A)?$/.test(String(form || '')));
  if (!hasUsGaap && hasIfrs) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'ifrs-taxonomy-not-supported-by-us-gaap-normalizer', issuerTaxonomy: 'IFRS', filingForms: foreignForm ? ['20-F/40-F'] : [] };
  if (!hasUsGaap && foreignForm) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'foreign-issuer-without-us-gaap-taxonomy', issuerTaxonomy: 'FOREIGN_NON_US_GAAP', filingForms: ['20-F/40-F'] };
  if (!hasUsGaap) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'required-us-gaap-taxonomy-missing', issuerTaxonomy: foreignForm ? 'FOREIGN_UNKNOWN' : 'UNKNOWN', filingForms: foreignForm ? ['20-F/40-F'] : [] };
  return { status: 'SUPPORTED_US_GAAP', reasonCode: null, issuerTaxonomy: foreignForm && !domesticForm ? 'FOREIGN_US_GAAP' : 'US_GAAP', filingForms: [...new Set(recentForms.filter(form => /^(10-K|20-F|40-F)(\/A)?$/.test(String(form || ''))))] };
}

function compactPitRows(rows, field, acceptedMap, maxRows = 40) {
  const seen = new Set();
  return rows
    .filter(row => row && row.end && row.filed && finiteFact(row.val) != null)
    .sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)))
    .filter(row => {
      const key = `${row.start || ''}|${row.end}|${row.filed}|${row.accn || ''}|${row.val}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxRows)
    .map(row => ({
      field,
      value: Number(row.val),
      periodStart: row.start || null,
      periodEnd: row.end,
      filedAt: row.filed,
      acceptedAt: acceptedMap.get(String(row.accn || '')) || null,
      effectiveAt: acceptedMap.get(String(row.accn || '')) || row.filed,
      form: row.form || null,
      accession: row.accn || null,
      fiscalYear: row.fy ?? null,
      fiscalPeriod: row.fp || null,
      frame: row.frame || null,
      concept: row.concept || null
    }));
}

function buildPointInTimeFacts(companyFacts, submissions) {
  const acceptedMap = acceptedAtByAccession(submissions);
  // F05/F06: every revenue concept (and the v5 bank net revenue) is kept; consumers pick per period via bestRevenueRowsByPeriod.
  // Codex review 2026-10-05 (분기 추이): discrete-quarter facts (about three months) from 10-Q/10-K.
  // A fourth quarter is rarely tagged on its own; the projection derives it from FY minus Q1–Q3 and labels it.
  const quarterly = (row) => { const days = durationDays(row); return /^(10-Q|10-K)(\/A)?$/.test(row.form || '') && days != null && days >= 80 && days <= 100; };
  const revenueQRows = revenueFactRows(companyFacts).filter(quarterly);
  const incomeQRows = factRows(companyFacts, 'us-gaap', ['NetIncomeLoss', 'ProfitLoss'], 'USD').filter(quarterly);
  const revenueRows = revenueFactRows(companyFacts).filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  const incomeRows = factRows(companyFacts, 'us-gaap', ['NetIncomeLoss', 'ProfitLoss'], 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  // P1402: parent-company equity first (the ROE/P-B denominator, matching NetIncomeLoss); the
  // NCI-inclusive total is a fallback. Agilent's FY2025 10-K tagged the NCI-inclusive total with
  // its accumulated OCI (-$226M against $6,741M parent equity).
  const equityRows = factRows(companyFacts, 'us-gaap', [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ], 'USD').filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const shareRows = factRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares')
    .filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  // P1446 (review 2026-10-04): the 재무 공시 reading needs the cash chain — operating cash flow, capital
  // spending (→ free cash flow) and long-term debt — beside revenue and income. Annual 10-K facts only.
  const annualFy = (row) => { const days = durationDays(row); return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400; };
  const ocfRows = factRows(companyFacts, 'us-gaap', ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], 'USD').filter(annualFy);
  const capexRows = factRows(companyFacts, 'us-gaap', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], 'USD').filter(annualFy);
  const debtRows = factRows(companyFacts, 'us-gaap', ['LongTermDebtNoncurrent', 'LongTermDebt'], 'USD').filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const observations = {
    revenue: compactPitRows(revenueRows, 'revenue', acceptedMap),
    netIncome: compactPitRows(incomeRows, 'netIncome', acceptedMap),
    equity: compactPitRows(equityRows, 'equity', acceptedMap),
    sharesOutstanding: compactPitRows(shareRows, 'sharesOutstanding', acceptedMap),
    operatingCashFlow: compactPitRows(ocfRows, 'operatingCashFlow', acceptedMap),
    capex: compactPitRows(capexRows, 'capex', acceptedMap),
    longTermDebt: compactPitRows(debtRows, 'longTermDebt', acceptedMap),
    revenueQ: compactPitRows(revenueQRows, 'revenueQ', acceptedMap, 16),
    netIncomeQ: compactPitRows(incomeQRows, 'netIncomeQ', acceptedMap, 16)
  };
  const all = Object.values(observations).flat();
  return {
    schemaVersion: 'sec-pit-facts.v1',
    status: all.some(row => row.acceptedAt) ? 'accepted-time-partial' : 'filed-date-only',
    observationCount: all.length,
    acceptedTimeCount: all.filter(row => row.acceptedAt).length,
    observations
  };
}

// 2026-10-13 audit F03/F04/F16: the share count that prices P/E, P/B and the reference market cap. Candidates in
// order — the cover-page count (same 10-K first, else the nearest within 400 days of the fiscal year end), the
// same fiscal year's weighted diluted count, the year-end common shares outstanding. Before this, a missing
// current cover count fell back to the newest cover count of ANY year (V/MA/CMCSA/CHTR priced on 2009-2015
// shares, P/E 2-9) and multi-class filers (GOOGL/META) whose cover counts are only class-dimensioned — which
// companyfacts omits, so a per-class sum is not available here — had none. Each candidate is checked against
// net income ÷ diluted EPS (P1587); a scale mismatch moves on to the next candidate.
// 2026-10-14: when no reported count exists at all (multi-class filers whose dei counts are class-dimensioned),
// net income ÷ diluted EPS of the same fiscal year is the last candidate. It is not used after a reported
// count was rejected, so a P1587 scale mismatch is still withheld rather than repriced.
function selectShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow = null, classFacts = null, symbol = '') {
  const fiscalEnd = currentRevenue.end;
  const gap = (row) => shareGapDays(row.end, fiscalEnd);
  const withinYear = (rows) => rows.filter((row) => { const days = gap(row); return days != null && days <= SEC_SHARES_MAX_GAP_DAYS; });
  const dei = instantRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares');
  const deiNear = withinYear(dei);
  const cover = deiNear.find((row) => row.accn && row.accn === currentRevenue.accn) || deiNear.sort((a, b) => gap(a) - gap(b))[0] || null;
  const weighted = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares').filter((row) => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && sameFiscalPeriod(currentRevenue, row) && finiteFact(row.val) != null;
  }))[0] || null;
  const yearEnd = withinYear(instantRows(companyFacts, 'us-gaap', ['CommonStockSharesOutstanding'], 'shares')).sort((a, b) => gap(a) - gap(b))[0] || null;
  const implied = Number.isFinite(netIncome) && Number.isFinite(eps) && eps !== 0 && Math.sign(netIncome) === Math.sign(eps) ? netIncome / eps : null;
  const weightedValue = finiteFact(weighted?.val);
  const checkAgainst = (value, reference) => {
    const ratio = value > 0 && reference > 0 ? value / reference : null;
    return ratio == null ? null : ratio > 3 || ratio < 1 / 3 ? 'scale-mismatch' : 'consistent';
  };
  const candidates = [[cover, 'dei-cover'], [weighted, 'weighted-diluted'], [yearEnd, 'common-shares-outstanding']].filter(([row]) => row && finiteFact(row.val) > 0);
  let rejected = null;
  for (const [row, basis] of candidates) {
    const value = finiteFact(row.val);
    // Without EPS, a cover or year-end count is cross-checked against the weighted diluted count of the same year.
    const check = checkAgainst(value, implied) || (basis !== 'weighted-diluted' ? checkAgainst(value, weightedValue) : null) || 'unchecked';
    if (check === 'scale-mismatch') { rejected = rejected || { row, basis }; continue; }
    return { row, value, basis, check };
  }
  if (rejected) return { row: rejected.row, value: null, basis: rejected.basis, check: 'scale-mismatch' };
  const dilutedEps = finiteFact(dilutedEpsRow?.val);
  const impliedDiluted = Number.isFinite(netIncome) && Number.isFinite(dilutedEps) && dilutedEps !== 0 ? netIncome / dilutedEps : null;
  if (Number.isFinite(impliedDiluted) && impliedDiluted > 0) {
    const row = { val: impliedDiluted, end: dilutedEpsRow.end, filed: dilutedEpsRow.filed, accn: dilutedEpsRow.accn, form: dilutedEpsRow.form };
    return { row, value: impliedDiluted, basis: 'eps-implied', check: 'consistent' };
  }
  // P1798: filers whose EPS and share counts are all class-dimensioned (V, COKE, WMG) are read from the 10-K instance.
  const byClass = classFacts ? selectClassDimensionedShares(classFacts, symbol, netIncome, fiscalEnd) : null;
  if (byClass?.value > 0) {
    const row = { val: byClass.value, end: fiscalEnd, filed: currentRevenue.filed, accn: currentRevenue.accn, form: currentRevenue.form };
    return { row, value: byClass.value, basis: 'class-dimensioned-10k', check: 'consistent', classMembers: byClass.members, classMethod: byClass.method };
  }
  return { row: null, value: null, basis: null, check: dei.length ? 'stale-period' : 'unreported', classCheck: byClass?.reason || null };
}

// P1798 (2026-10-15): multi-class filers tag EPS, weighted share counts and cover counts only on
// StatementClassOfStockAxis, which companyfacts omits. The filing's own XBRL instance carries them. Only
// single-axis class contexts and undimensioned contexts are kept; values are reported counts, never derived.
const CLASS_FACT_CONCEPTS = ['TradingSymbol', 'EarningsPerShareDiluted', 'EarningsPerShareBasic', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'];
export function parseClassShareFacts(xml) {
  const text = String(xml || '');
  const contexts = new Map();
  for (const match of text.matchAll(/<(?:[\w-]+:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?context>/g)) {
    const body = match[2];
    const members = [...body.matchAll(/<(?:[\w-]+:)?explicitMember\b[^>]*\bdimension="([^"]+)"[^>]*>\s*([^<\s]+)\s*</g)];
    if (members.length > 1 || (members.length === 1 && !/:StatementClassOfStockAxis$/.test(members[0][1]))) continue;
    if (/<(?:[\w-]+:)?typedMember\b/.test(body)) continue;
    const date = (tag) => (body.match(new RegExp(`<(?:[\\w-]+:)?${tag}>\\s*([0-9-]{10})`)) || [])[1] || null;
    contexts.set(match[1], { member: members.length ? members[0][2].replace(/^[\w-]+:/, '') : null, start: date('startDate'), end: date('endDate') || date('instant') });
  }
  const facts = [];
  for (const match of text.matchAll(/<(?:dei|us-gaap):(\w+)\b([^>]*)>([^<]*)<\/(?:dei|us-gaap):\1>/g)) {
    if (!CLASS_FACT_CONCEPTS.includes(match[1])) continue;
    const context = contexts.get((match[2].match(/\bcontextRef="([^"]+)"/) || [])[1]);
    if (!context) continue;
    const raw = match[3].trim();
    if (match[1] === 'TradingSymbol') { if (raw) facts.push({ concept: match[1], ...context, value: raw }); continue; }
    const value = finiteFact(raw);
    if (value != null) facts.push({ concept: match[1], ...context, value });
  }
  return facts;
}

// The traded class (cover TradingSymbol on the class axis) is priced on its own reported count when net income ÷ its
// EPS matches that count (as-converted classes: V Class A 1,966M, COKE common 83.8M); otherwise, when every class
// earns the same EPS, on the sum of the class counts (WMG A+B). With no class-axis symbol, a class whose own count
// matches is used only when all classes earn the same EPS. Anything else — a traded class without its own EPS
// (BRK.B, whose EPS is tagged on an "equivalent class B" member) — is withheld.
export const CLASS_EPS_TOLERANCE = 0.03;
export function selectClassDimensionedShares(classFacts, symbol, netIncome, fiscalEnd) {
  if (!Array.isArray(classFacts) || !classFacts.length || !Number.isFinite(netIncome) || netIncome === 0) return { value: null, reason: 'class-facts-unavailable' };
  const annual = classFacts.filter((row) => row.member && row.end === fiscalEnd && row.start && shareGapDays(row.start, row.end) >= 300 && shareGapDays(row.start, row.end) <= 400);
  const classes = new Map();
  for (const row of annual) {
    const entry = classes.get(row.member) || {};
    if (entry[row.concept] == null) entry[row.concept] = row.value;
    classes.set(row.member, entry);
  }
  const perClass = [...classes.entries()].map(([member, row]) => {
    const diluted = row.EarningsPerShareDiluted != null && row.WeightedAverageNumberOfDilutedSharesOutstanding > 0;
    const eps = diluted ? row.EarningsPerShareDiluted : row.EarningsPerShareBasic;
    const count = diluted ? row.WeightedAverageNumberOfDilutedSharesOutstanding : row.WeightedAverageNumberOfSharesOutstandingBasic;
    return { member, eps, count };
  }).filter((row) => Number.isFinite(row.eps) && row.eps !== 0 && Math.sign(row.eps) === Math.sign(netIncome) && row.count > 0);
  if (!perClass.length) return { value: null, reason: 'class-facts-unavailable' };
  // EPS is published to the cent, so the tolerance carries half a cent on top of the relative band.
  const matches = (count, eps) => Math.abs(netIncome / count - eps) <= 0.005 + CLASS_EPS_TOLERANCE * Math.abs(eps);
  const sameEps = perClass.every((row) => Math.abs(row.eps - perClass[0].eps) <= 0.005 + CLASS_EPS_TOLERANCE * Math.abs(perClass[0].eps));
  const sum = perClass.reduce((total, row) => total + row.count, 0);
  const summed = () => sameEps && matches(sum, perClass[0].eps) ? { value: sum, members: perClass.map((row) => row.member).sort(), method: 'class-sum' } : null;
  const symbolRows = classFacts.filter((row) => row.concept === 'TradingSymbol');
  const traded = symbolRows.find((row) => row.member && tickerKey(row.value) === tickerKey(symbol));
  if (traded) {
    const own = perClass.find((row) => row.member === traded.member);
    if (!own) return { value: null, reason: 'class-member-unmatched' };
    if (matches(own.count, own.eps)) return { value: own.count, members: [own.member], method: 'traded-class' };
    return summed() || { value: null, reason: 'class-count-inconsistent' };
  }
  if (symbolRows.some((row) => row.member)) return { value: null, reason: 'class-member-unmatched' };
  if (!sameEps) return { value: null, reason: 'class-eps-differs' };
  const own = perClass.filter((row) => matches(row.count, row.eps));
  if (own.length === 1) return { value: own[0].count, members: [own[0].member], method: 'traded-class' };
  return summed() || { value: null, reason: 'class-count-inconsistent' };
}

// The 10-K instance document EDGAR extracts from an inline XBRL primary document (v-20250930.htm → v-20250930_htm.xml).
export function classInstanceUrl(cik, accession, submissions) {
  const recent = submissions?.filings?.recent || {};
  const index = (recent.accessionNumber || []).indexOf(accession);
  const doc = index >= 0 ? String(recent.primaryDocument?.[index] || '') : '';
  if (!/^\d{10}-\d{2}-\d{6}$/.test(String(accession || '')) || !/^[\w.-]+\.htm$/i.test(doc) || !(Number(cik) > 0)) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${doc.replace(/\.htm$/i, '_htm.xml')}`;
}

// N20 (2026-10-13): the issuer's own recent filings from the submissions document this job already reads —
// 8-K (with Item numbers), 10-Q, 10-K and their amendments within 30 days before the fetch, newest first, at most 5.
export const RECENT_FILING_WINDOW_DAYS = 30;
export const RECENT_FILING_MAX = 5;
export function recentFilingsFrom(submissions, nowMs = Date.now()) {
  const recent = submissions?.filings?.recent || {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const cutoff = nowMs - RECENT_FILING_WINDOW_DAYS * 86400000;
  const rows = [];
  forms.forEach((form, index) => {
    if (!/^(8-K|10-Q|10-K)(\/A)?$/.test(String(form || ''))) return;
    const filedAt = String(recent.filingDate?.[index] || '').slice(0, 10);
    const accession = String(recent.accessionNumber?.[index] || '');
    const filedMs = Date.parse(filedAt);
    if (!Number.isFinite(filedMs) || filedMs < cutoff || filedMs > nowMs + 86400000 || !/^\d{10}-\d{2}-\d{6}$/.test(accession)) return;
    const items = String(recent.items?.[index] || '').split(',').map((item) => item.trim()).filter((item) => /^\d\.\d{2}$/.test(item));
    rows.push({ form: String(form), filedAt, accession, ...(items.length ? { items } : {}), ...(recent.reportDate?.[index] ? { reportDate: String(recent.reportDate[index]).slice(0, 10) } : {}) });
  });
  return rows.sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.accession.localeCompare(a.accession)).slice(0, RECENT_FILING_MAX);
}

export function normalizeSecCompanyFacts(symbol, companyFacts, price, submissions = null, classFacts = null) {
  // F05/F06: every annual revenue concept is collected; bestRevenueRowsByPeriod picks one row per fiscal period
  // (largest primary concept, assessed-tax-inclusive only as a fallback). P1374 bank net revenue stays a
  // primary concept.
  // (annualDurationRows dedupes by period+form across concepts, so the per-concept rows are filtered here instead.)
  const revenues = bestRevenueRowsByPeriod(revenueFactRows(companyFacts).filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && finiteFact(row.val) != null;
  }));
  const incomes = annualDurationRows(companyFacts, ['NetIncomeLoss', 'ProfitLoss']);
  if (!revenues.length) return null;

  const currentRevenue = revenues[0];
  const priorRevenue = revenues.find(row => isPriorAnnualPeriod(currentRevenue, row));
  const currentIncome = incomes.find(row => sameFiscalPeriod(currentRevenue, row)) || null;
  const equities = instantRows(companyFacts, 'us-gaap', [
    'StockholdersEquity', // P1402: parent equity first; see buildPointInTimeFacts
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ], 'USD');
  const currentEquity = closestEnd(equities, currentRevenue.end) || null;
  const acceptedMap = acceptedAtByAccession(submissions);

  const revenue = Number(currentRevenue.val);
  const netIncome = finiteFact(currentIncome?.val);
  const equity = finiteFact(currentEquity?.val);
  // P1587: the share count is cross-checked against net income ÷ diluted EPS for the same fiscal year. PKG's
  // companyfacts carried 89,213,394,000 cover shares (1000x), which published P/E 26,500 and P/B 4,461.
  const epsRow = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')
    .filter((row) => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && row.end === currentRevenue.end && finiteFact(row.val) != null))[0] || null;
  const eps = finiteFact(epsRow?.val);
  const dilutedEpsRow = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['EarningsPerShareDiluted'], 'USD/shares')
    .filter((row) => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && row.end === currentRevenue.end && finiteFact(row.val) != null))[0] || null;
  const shareSelection = selectShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow, classFacts, symbol);
  const currentShares = shareSelection.row;
  const sharesCheck = shareSelection.check;
  const sharesOutstanding = shareSelection.value;
  const px = Number(price);
  const marketCap = px > 0 && sharesOutstanding > 0 ? px * sharesOutstanding : null;

  // W09-A/B/P1148 (F01/F02): transport freshness, report recency, and per-operand availability
  // are separate. A filing arriving today does not make an old fiscal year current, and a
  // derived ratio cannot have been reproducible before its LATEST operand was public.
  const operandAvailability = {
    revenue: pitAvailability(currentRevenue, acceptedMap),
    netIncome: pitAvailability(currentIncome, acceptedMap),
    equity: pitAvailability(currentEquity, acceptedMap),
    sharesOutstanding: pitAvailability(currentShares, acceptedMap),
    priorRevenue: pitAvailability(priorRevenue, acceptedMap)
  };
  const derivedAvailability = {
    revGrowth: latestIso([operandAvailability.revenue, operandAvailability.priorRevenue]),
    margin: latestIso([operandAvailability.revenue, operandAvailability.netIncome]),
    roe: latestIso([operandAvailability.netIncome, operandAvailability.equity]),
    pe: latestIso([operandAvailability.sharesOutstanding, operandAvailability.netIncome]),
    pb: latestIso([operandAvailability.sharesOutstanding, operandAvailability.equity])
  };
  const recordAvailableAt = latestIso(Object.values(operandAvailability));
  const reportAgeDays = Number.isFinite(Date.parse(currentRevenue.end || ''))
    ? Math.round((Date.now() - Date.parse(currentRevenue.end)) / 86400000)
    : null;
  const reportRecency = reportAgeDays != null && reportAgeDays <= REPORT_RECENCY_MAX_DAYS ? 'recent-fy' : 'stale-fy';
  const revenueAcceptedAt = acceptedMap.get(String(currentRevenue.accn || '')) || null;
  const qualityStatus = revenueAcceptedAt && reportRecency === 'recent-fy' ? 'CURRENT' : 'REFERENCE';

  const record = {
    symbol,
    cik: String(companyFacts.cik || '').padStart(10, '0'),
    // P1582: the submissions document names the registrant itself; companyfacts.entityName can carry
    // a co-registrant (CIK 70858 Bank of America → "BofA Finance LLC").
    entityName: submissions?.name || companyFacts.entityName || null,
    source: 'SEC EDGAR companyfacts',
    sourceTier: 'T1_OFFICIAL',
    sourceKind: 'T1_OFFICIAL',
    rightsId: 'PUBLIC_REFERENCE',
    // The v2 model id stays the artifact contract (allowlists and stored records key on it).
    // Availability semantics are versioned separately so this fix does not silently relabel
    // existing stored records.
    model: 'sec-fy-normalized-v2',
    availabilityModel: 'sec-pit-availability.v1',
    periodType: 'FY',
    fiscalPeriodEnd: currentRevenue.end || null,
    // The observation is the fiscal period end; the transport time is when we fetched it.
    observedAt: currentRevenue.end || null,
    filedAt: currentRevenue.filed || null,
    // The revenue accession's acceptance time, kept for compatibility. `availableAt` is the
    // earliest time the WHOLE record's operands were all public, which is never earlier.
    acceptedAt: revenueAcceptedAt,
    availableAt: recordAvailableAt,
    transportFetchedAt: new Date().toISOString(),
    reportAgeDays,
    reportRecency,
    accessionByField: { revenue: currentRevenue.accn || null, netIncome: currentIncome?.accn || null, equity: currentEquity?.accn || null, sharesOutstanding: currentShares?.accn || null },
    operandAvailability,
    derivedAvailability,
    allowedUse: 'research-relative-ranking-only',
    qualityStatus,
    quality: { status: qualityStatus, stale: reportRecency !== 'recent-fy', decisionUse: false, allowedUse: 'reference' },
    fetchedAt: new Date().toISOString(),
    form: currentRevenue.form || null,
    accession: currentRevenue.accn || null,
    revenue,
    netIncome,
    equity: Number.isFinite(equity) ? equity : null,
    // P1582: declare which equity concept fed ROE/P-B. The NCI-inclusive fallback does not match the
    // parent-only NetIncomeLoss numerator, so consumers can see when the ratio mixes bases.
    equityBasis: !Number.isFinite(equity) ? null : currentEquity?.concept === 'StockholdersEquity' ? 'parent' : 'including-noncontrolling-interest',
    sharesOutstanding: Number.isFinite(sharesOutstanding) ? sharesOutstanding : null,
    // P1587 + F03/F04: consistent | scale-mismatch (withheld) | unchecked | stale-period / unreported (no count
    // within 400 days of the fiscal year end — withheld, P/E·P/B·reference market cap stay empty)
    sharesCheck,
    sharesBasis: Number.isFinite(sharesOutstanding) ? shareSelection.basis : null, // dei-cover | weighted-diluted | common-shares-outstanding | eps-implied | class-dimensioned-10k
    // P1798: which class members fed a class-dimensioned count, or why the 10-K's class facts were withheld.
    ...(shareSelection.classMembers ? { sharesClassMembers: shareSelection.classMembers, sharesClassMethod: shareSelection.classMethod } : {}),
    ...(shareSelection.classCheck ? { sharesClassCheck: shareSelection.classCheck } : {}),
    sharesObservedAt: Number.isFinite(sharesOutstanding) ? currentShares?.end || null : null,
    normalizerVersion: SEC_NORMALIZER_VERSION,
    revenueConcept: currentRevenue.concept || null,
    // N20: recent 8-K/10-Q/10-K filings within 30 days before this read (`fetchedAt`): date, form, Item numbers,
    // accession only — no filing text.
    recentFilings: recentFilingsFrom(submissions),
    coverage: ['revenue', ...(netIncome != null ? ['netIncome'] : []), ...(equity != null ? ['equity'] : []), ...(sharesOutstanding != null ? ['sharesOutstanding'] : [])],
    pit: buildPointInTimeFacts(companyFacts, submissions)
  };

  if (priorRevenue && Number(priorRevenue.val) > 0) record.revGrowth = round((revenue / Number(priorRevenue.val) - 1) * 100, 1);
  if (netIncome != null && revenue !== 0) record.margin = round(netIncome / revenue * 100, 1);
  // F05: a margin above 100% means a revenue subtotal, not the business; withheld (value kept for audit).
  if (record.margin > SEC_MARGIN_HOLD_ABOVE_PCT) { record.marginHeld = { value: record.margin, reason: 'margin-above-100pct-revenue-subtotal' }; delete record.margin; }
  if (netIncome != null && equity > 0) record.roe = round(netIncome / equity * 100, 1);
  if (marketCap && netIncome > 0) record.pe = round(marketCap / netIncome, 2);
  if (marketCap && equity > 0) record.pb = round(marketCap / equity, 2);
  ['revGrowth', 'margin', 'roe', 'pe', 'pb'].forEach(key => {
    if (Number.isFinite(record[key])) record.coverage.push(key);
  });
  return record;
}
