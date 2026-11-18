// v60.28 SEC long-term debt concept cases (companyfacts-shaped, synthetic). Each case takes the code under test —
// { normalize: normalizeSecCompanyFacts, fiscalHistory, fiscalDebtBasis } — so the contract gate runs them on the current
// normalizer and the same cases can be pointed at an older copy (fiscalDebtBasis may be absent there).
// (a) a filer that tags only LongTermDebtAndCapitalLeaseObligations (+Current): the series is noncurrent + current of one
//     filing, every year, on the lease-inclusive basis.
// (b) a filer that switched from LongTermDebt (FY2020-21) to the lease-inclusive lines (FY2022 10-K onward, with the FY2021
//     comparative): the series is anchored on the latest concept and the year only LongTermDebt reported stays empty.
// (c) a lease-inclusive total tagged below its own noncurrent part is a partial and does not anchor; instrument-level tags
//     (SeniorNotes, DebtInstrumentCarryingAmount) never become the debt figure, even as the filer's only debt tags.
const fy = (val, accn, start, end, filed, form = '10-K', fp = 'FY') => ({ val, accn, start, end, filed, form, fp });
const usd = (...rows) => ({ units: { USD: rows } });
const instant = (val, accn, end, filed) => ({ val, accn, end, filed, form: '10-K', fp: 'FY' });
const cover = (val, accn, end, filed) => ({ dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ val, accn, end, filed, form: '10-K', fp: 'FY' }] } } } });
const years = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const accnOf = (year) => `k${year}`;
const filedOf = (year) => `${year + 1}-02-20`;
// Revenue, net income and equity for each year, filed in that year's 10-K (with the prior year as comparative).
function income(from, to) {
  const revenue = [], net = [], equity = [];
  for (const year of years(from, to)) {
    for (const of of [year, year - 1].filter((y) => y >= from)) {
      revenue.push(fy(10e9 + (of - from) * 1e9, accnOf(year), `${of}-01-01`, `${of}-12-31`, filedOf(year)));
      net.push(fy(1e9, accnOf(year), `${of}-01-01`, `${of}-12-31`, filedOf(year)));
      equity.push(instant(20e9, accnOf(year), `${of}-12-31`, filedOf(year)));
    }
  }
  return { Revenues: usd(...revenue), NetIncomeLoss: usd(...net), StockholdersEquity: usd(...equity) };
}
// Balance rows for `concept` at each year end in [from, to], each filed in that year's 10-K and as the next 10-K's comparative.
function balances(concept, from, to, valueOf, lastFiling = to) {
  const rows = [];
  for (const year of years(from, to)) {
    for (const filing of [year, year + 1].filter((f) => f <= lastFiling)) rows.push(instant(valueOf(year), accnOf(filing), `${year}-12-31`, filedOf(filing)));
  }
  return { [concept]: usd(...rows) };
}
function debtColumn(history) {
  return Object.fromEntries(String(history || '').split(';').filter(Boolean).map((line) => { const cells = line.split(':'); return [cells[0].slice(0, 4), cells[6]]; }));
}
const run = (code, symbol, facts) => {
  const record = code.normalize(symbol, facts, 50, null);
  const observations = record?.pit?.observations || {};
  return { record, debt: debtColumn(code.fiscalHistory(observations)), basis: typeof code.fiscalDebtBasis === 'function' ? code.fiscalDebtBasis(observations) : undefined,
    current: typeof code.fiscalDebtCurrent === 'function' ? code.fiscalDebtCurrent(observations) : undefined };
};

// v60.30 (d) whether the debt column includes the part due within a year follows the anchored concept: a total (LongTermDebt,
// noncurrent + current derived, the lease-inclusive total) includes it; a noncurrent line tagged without its current portion
// leaves it out. Only the latter is in the sparse debtCurrent map.
export function currentCoverageCase(code) {
  const with2 = (...parts) => ({ cik: 25, facts: { ...cover(1e9, accnOf(2025), '2026-01-31', filedOf(2025)), 'us-gaap': { ...income(2024, 2025), ...Object.assign({}, ...parts) } } });
  const total = run(code, 'TOT', with2(balances('LongTermDebt', 2024, 2025, () => 10e9)));
  const derived = run(code, 'DER', with2(balances('LongTermDebtNoncurrent', 2024, 2025, () => 8e9), balances('LongTermDebtCurrent', 2024, 2025, () => 2e9)));
  const noncurrent = run(code, 'NONC', with2(balances('LongTermDebtNoncurrent', 2024, 2025, () => 8e9)));
  const leaseNoncurrent = run(code, 'LNC', with2(balances('LongTermDebtAndCapitalLeaseObligations', 2024, 2025, () => 8e9)));
  const leaseDerived = run(code, 'LDER', with2(balances('LongTermDebtAndCapitalLeaseObligations', 2024, 2025, () => 8e9), balances('LongTermDebtAndCapitalLeaseObligationsCurrent', 2024, 2025, () => 1e9)));
  const ok = total.current === null && total.debt['2025'] === '10000' && derived.current === null && derived.debt['2025'] === '10000'
    && noncurrent.current === 'excluded' && noncurrent.debt['2025'] === '8000' && leaseNoncurrent.current === 'excluded'
    && leaseDerived.current === null && leaseDerived.debt['2025'] === '9000';
  return { ok, detail: JSON.stringify({ total: total.current, derived: derived.current, noncurrent: noncurrent.current, leaseNoncurrent: leaseNoncurrent.current, leaseDerived: leaseDerived.current }) };
}

export function leaseOnlyCase(code) {
  const facts = { cik: 21, facts: { ...cover(1e9, accnOf(2025), '2026-01-31', filedOf(2025)), 'us-gaap': {
    ...income(2022, 2025),
    ...balances('LongTermDebtAndCapitalLeaseObligations', 2022, 2025, (year) => (30 - (year - 2022)) * 1e9),
    ...balances('LongTermDebtAndCapitalLeaseObligationsCurrent', 2022, 2025, () => 2e9)
  } } };
  const { debt, basis } = run(code, 'LEASE', facts);
  // noncurrent 30/29/28/27B + 2B current of the same filing
  const ok = debt['2025'] === '29000' && debt['2024'] === '30000' && debt['2023'] === '31000' && debt['2022'] === '32000' && basis === 'lease-inclusive';
  return { ok, detail: JSON.stringify({ debt, basis }) };
}

export function conceptSwitchCase(code) {
  const facts = { cik: 22, facts: { ...cover(1e9, accnOf(2025), '2026-01-31', filedOf(2025)), 'us-gaap': {
    ...income(2020, 2025),
    // FY2020-21 10-Ks tag the debt-only total; from the FY2022 10-K the lease-inclusive lines (FY2021 as comparative).
    ...balances('LongTermDebt', 2019, 2021, (year) => 40e9 - (year - 2019) * 1e9, 2021),
    LongTermDebtAndCapitalLeaseObligations: usd(...years(2021, 2025).flatMap((year) => [year, year + 1].filter((filing) => filing >= 2022 && filing <= 2025)
      .map((filing) => instant(36e9 - (year - 2021) * 1e9, accnOf(filing), `${year}-12-31`, filedOf(filing))))),
    LongTermDebtAndCapitalLeaseObligationsCurrent: usd(...years(2021, 2025).flatMap((year) => [year, year + 1].filter((filing) => filing >= 2022 && filing <= 2025)
      .map((filing) => instant(1e9, accnOf(filing), `${year}-12-31`, filedOf(filing)))))
  } } };
  const { debt, basis } = run(code, 'SWCH', facts);
  // 2021-2025 from the lease-inclusive total (37, 36, 35, 34, 33B); FY2020 reported only LongTermDebt and stays empty.
  const ok = debt['2025'] === '33000' && debt['2024'] === '34000' && debt['2021'] === '37000' && debt['2020'] === '' && basis === 'lease-inclusive';
  return { ok, detail: JSON.stringify({ debt, basis }) };
}

export function partialAndInstrumentCase(code) {
  const partialFacts = { cik: 23, facts: { ...cover(1e9, accnOf(2025), '2026-01-31', filedOf(2025)), 'us-gaap': {
    ...income(2024, 2025),
    ...balances('LongTermDebtAndCapitalLeaseObligations', 2024, 2025, () => 9e9),
    // a lease-inclusive "total" below its own noncurrent part on the same date (one facility, not the total)
    ...balances('LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities', 2024, 2025, () => 0.5e9),
    SeniorNotes: usd(instant(1.5e9, accnOf(2025), '2025-12-31', filedOf(2025)))
  } } };
  const instrumentFacts = { cik: 24, facts: { ...cover(1e9, accnOf(2025), '2026-01-31', filedOf(2025)), 'us-gaap': {
    ...income(2024, 2025),
    SeniorNotes: usd(instant(1.5e9, accnOf(2025), '2025-12-31', filedOf(2025)), instant(1.5e9, accnOf(2025), '2024-12-31', filedOf(2025))),
    DebtInstrumentCarryingAmount: usd(instant(1.5e9, accnOf(2025), '2025-12-31', filedOf(2025)))
  } } };
  const partial = run(code, 'PART', partialFacts);
  const instrument = run(code, 'INST', instrumentFacts);
  const ok = partial.debt['2025'] === '9000' && partial.debt['2024'] === '9000' && partial.basis === 'lease-inclusive'
    && instrument.debt['2025'] === '' && instrument.debt['2024'] === '' && (instrument.basis == null) && (instrument.record?.pit?.observations?.longTermDebt || []).length === 0;
  return { ok, detail: JSON.stringify({ partial: [partial.debt, partial.basis], instrument: [instrument.debt, instrument.basis] }) };
}
