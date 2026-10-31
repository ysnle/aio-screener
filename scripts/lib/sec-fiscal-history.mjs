// scripts/lib/sec-fiscal-history.mjs — the pure fiscal-history projection used by scripts/build-sec-runtime-projection.mjs.
//
// The builder reads the producer-only ledger and writes public-data at module top level, so a gate cannot import it.
// The pure series builders live here (moved verbatim, v59.48) so ci-fiscal-quality-fixture imports the code the builder
// runs instead of slicing the builder's source text.
import { bestRevenueRowsByPeriod } from '../../src/domain/fundamental/sec-report.js';
import { anchorConcept, anchorConceptRows, discreteQuarterSeries, SEC_FIELD_CONCEPT_PREFERENCE } from '../../src/domain/fundamental/sec-earnings.js';

// P1627: whole-million rounding turned small profits/losses into zero and made the
// fiscal timeline disagree with the exact annual receipt. Preserve USD thousands
// in compact USD-million fields (and 1,000 shares in million-share fields).
export function compactFiscalMillions(value) {
  return value == null || !Number.isFinite(value) ? '' : Math.round(value / 1e3) / 1e3;
}

// Codex review 2026-10-05 (분기 추이): the last eight fiscal quarters of revenue and net income. Discrete
// three-month facts are used as filed (latest filing wins per period end). A fourth quarter is derived
// only when the fiscal year total and exactly three discrete quarters inside it exist, and is flagged 'd'.
export const QUARTER_FORMAT = 'periodEnd:revenue:netIncome:basis (USD millions; basis r=reported, d=derived FY−Q1..Q3)';
export function quarterlyHistory(observations = {}) {
  const quarters = new Map();
  for (const [field, qField, fyField] of [['revenue', 'revenueQ', 'revenue'], ['netIncome', 'netIncomeQ', 'netIncome']]) {
    // 2026-10-13 F05: revenue rows are reduced to one per period by the shared concept rule first.
    // 2026-10-17 (logic audit D6): net income keeps the concept of its latest quarter (the derived fourth quarter
    // nets a fiscal year of that same concept); another concept fills only a quarter it never reported.
    const anchor = field === 'netIncome' ? anchorConcept(observations[qField], SEC_FIELD_CONCEPT_PREFERENCE.netIncome) : null;
    const pref = anchor ? [anchor, ...SEC_FIELD_CONCEPT_PREFERENCE.netIncome] : SEC_FIELD_CONCEPT_PREFERENCE.netIncome;
    const quarterRows = field === 'revenue' ? bestRevenueRowsByPeriod(observations[qField]) : anchorConceptRows(observations[qField], pref);
    const annualRows = field === 'revenue' ? bestRevenueRowsByPeriod(observations[fyField]) : anchorConceptRows(observations[fyField], pref);
    for (const row of discreteQuarterSeries(quarterRows, annualRows)) {
      const q = quarters.get(row.periodEnd) || { periodEnd: row.periodEnd, derived: false };
      q[field] = row.value;
      if (row.derived) q.derived = true;
      quarters.set(row.periodEnd, q);
    }
  }
  const m = compactFiscalMillions;
  const rows = [...quarters.values()].filter((q) => q.revenue != null || q.netIncome != null).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).slice(-8);
  return rows.length >= 2 ? rows.map((q) => [q.periodEnd, m(q.revenue), m(q.netIncome), q.derived ? 'd' : 'r'].join(':')).join(';') : null;
}

// P1436 (재무 공시 redesign): the page reads a trend, not one year. A compact fiscal-year series (at most
// six full years of revenue / net income from 10-K FY facts of about twelve months, one row per period end —
// the latest filing wins) is written as its own small artifact, sec-fiscal-history.json, loaded only by the
// 재무 공시 page; the 1 MiB runtime summary stays as it was. PIT observations stay producer-side.
// P1446: the series also carries the cash chain — operating cash flow, capital spending, long-term debt —
// and the share count reported on the cover page after each fiscal year end (buybacks / dilution).
// v58.55: two more columns — year-end total assets and annual R&D expense (DuPont, Sloan accruals, R&D ÷ revenue). They are
// written only for a record whose observations were read by the v58.55 normalizer (the arrays exist, even empty), so the
// page can tell "not yet collected" (8 columns) from "not reported" (10 columns, empty cell).
// v58.75 (persona review): seven more columns — gross profit, operating income, cash, short-term investments, stock-based
// compensation, buybacks and dividends (margin ladder, net cash, capital return). To keep the artifact well inside the
// client's 1 MiB read they are written on the latest CAPITAL_YEARS rows only, and only for a record read by the v58.75
// normalizer (the arrays exist), so 10 columns on a recent row means "not yet collected" and an empty cell "not reported".
const FY_FIELDS = ['revenue', 'netIncome', 'equity', 'operatingCashFlow', 'capex', 'longTermDebt', 'totalAssets', 'researchAndDevelopment',
  'grossProfit', 'operatingIncome', 'cash', 'shortTermInvestments', 'shareBasedCompensation', 'buybacks', 'dividends'];
const CAPITAL_FIELDS = FY_FIELDS.slice(8);
export const CAPITAL_YEARS = 2;
const DURATION_FIELDS = new Set(['revenue', 'netIncome', 'operatingCashFlow', 'capex', 'researchAndDevelopment', 'grossProfit', 'operatingIncome', 'shareBasedCompensation', 'buybacks', 'dividends']);
export const FISCAL_HISTORY_FORMAT = 'periodEnd:revenue:netIncome:equity:operatingCashFlow:capex:longTermDebt:sharesMillions[:totalAssets:researchAndDevelopment[:grossProfit:operatingIncome:cash:shortTermInvestments:shareBasedCompensation:buybacks:dividends]] (USD millions; the first bracket is present once the issuer was read with total assets and R&D, the second on the latest two fiscal years once it was read with the capital items — absent = not yet collected, empty = not reported)';
export function fiscalHistory(observations = {}) {
  const byEnd = new Map();
  for (const field of FY_FIELDS) {
    // 2026-10-13 F05: one revenue row per period by the shared concept rule (a REIT's customer-contract subtotal
    // no longer wins a same-filing tie against total revenues).
    const fieldRows = (field === 'revenue' ? bestRevenueRowsByPeriod(observations.revenue) : Array.isArray(observations[field]) ? observations[field] : []).filter((row) => {
      // P1627: the source also collects annual foreign-issuer 20-F/40-F facts.
      // Dropping their form here left ARM/BABA/NBIS/MNDY on a one-year fallback.
      if (!/^(10-K|20-F|40-F)(\/A)?$/.test(String(row?.form || '')) || !Number.isFinite(row?.value) || !row.periodEnd) return false;
      if (!DURATION_FIELDS.has(field)) return true;
      const days = (Date.parse(row.periodEnd) - Date.parse(row.periodStart || '')) / 86400000;
      return row?.fiscalPeriod === 'FY' && days >= 330 && days <= 380;
    });
    // 2026-10-17 (logic audit D6): one concept per series — the concept of the latest year — so a year-over-year read
    // never compares LongTermDebt with LongTermDebtNoncurrent or NetIncomeLoss with ProfitLoss. Equity keeps its
    // parent-first rank (P1449) and revenue its per-period rule (F05).
    const anchored = SEC_FIELD_CONCEPT_PREFERENCE[field] ? anchorConceptRows(fieldRows, SEC_FIELD_CONCEPT_PREFERENCE[field]) : fieldRows;
    for (const row of anchored) {
      const entry = byEnd.get(row.periodEnd) || { periodEnd: row.periodEnd, filedAt: {}, conceptRank: {} };
      const rowRank = row.concept === 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest' ? 1 : 0;
      const storedFiledAt = entry.filedAt[field];
      const storedRank = entry.conceptRank[field];
      // P1449: the ROE / P-B denominators need a parent-company equity series. A later
      // filing can carry only the NCI-inclusive total for a period whose parent row was
      // already filed (Agilent FY2025 did this for FY2023/FY2024 with its AOCI value),
      // so parent equity must outrank the NCI tagging across filings, not just within
      // one filing; among equal ranks the latest filedAt wins.
      let take = !storedFiledAt;
      if (field === 'equity') {
        if (storedRank != null && rowRank < storedRank) take = true;
        else if (storedRank === rowRank && String(row.filedAt) > storedFiledAt) take = true;
      } else {
        take = take || String(row.filedAt) > storedFiledAt;
      }
      if (take) {
        entry[field] = row.value; entry.filedAt[field] = String(row.filedAt || ''); entry.conceptRank[field] = rowRank;
      }
      byEnd.set(row.periodEnd, entry);
    }
  }
  const shares = (Array.isArray(observations.sharesOutstanding) ? observations.sharesOutstanding : [])
    .filter((row) => Number.isFinite(row?.value) && row.periodEnd).sort((x, y) => String(x.periodEnd).localeCompare(String(y.periodEnd)));
  const sharesAfter = (end) => {
    const t = Date.parse(end);
    const hit = shares.find((row) => { const d = (Date.parse(row.periodEnd) - t) / 86400000; return d >= 0 && d <= 150; });
    return hit ? hit.value : null;
  };
  const m = compactFiscalMillions;
  const assetChain = Array.isArray(observations.totalAssets);
  const capitalChain = assetChain && Array.isArray(observations.grossProfit);
  const rows = [...byEnd.values()]
    .filter((entry) => entry.revenue != null || entry.netIncome != null)
    .sort((x, y) => x.periodEnd.localeCompare(y.periodEnd))
    .slice(-6);
  // One compact line per issuer (see FISCAL_HISTORY_FORMAT; empty = not reported).
  return rows.map((entry, index) => [entry.periodEnd, m(entry.revenue), m(entry.netIncome), m(entry.equity), m(entry.operatingCashFlow), m(entry.capex), m(entry.longTermDebt), m(sharesAfter(entry.periodEnd)),
    ...(assetChain ? [m(entry.totalAssets), m(entry.researchAndDevelopment)] : []),
    ...(capitalChain && index >= rows.length - CAPITAL_YEARS ? CAPITAL_FIELDS.map((field) => m(entry[field])) : [])].join(':'))
    .join(';');
}
