// SEC fiscal-year anchor cases (companyfacts-shaped). Each case takes a normalizeSecCompanyFacts implementation,
// so the contract gate runs them on the current normalizer and the same cases can be pointed at an older one.
// (a) net income newer than revenue: the year is the income year, revenue/margin/growth empty.
// (b) LHX FY2025 shape: the 10-K tags the full-year revenue on a quarter span; it is the annual revenue, not a quarter.
// (c) an ordinary filer with a real fourth quarter in its 10-K is unchanged.
const fy = (val, accn, start, end, filed, form = '10-K', fp = 'FY') => ({ val, accn, start, end, filed, form, fp });
const usd = (...rows) => ({ units: { USD: rows } });
const instant = (val, accn, end, filed) => ({ val, accn, end, filed, form: '10-K', fp: 'FY' });
const cover = (val, accn, end, filed) => ({ dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ val, accn, end, filed, form: '10-K', fp: 'FY' }] } } } });

export function incomeNewerCase(normalize) {
  const facts = { cik: 11, facts: { ...cover(1e9, 'k25', '2026-01-31', '2026-02-20'), 'us-gaap': {
    Revenues: usd(fy(9e9, 'k24', '2023-01-01', '2023-12-31', '2025-02-20'), fy(10e9, 'k24', '2024-01-01', '2024-12-31', '2025-02-20'), fy(10e9, 'k25', '2024-01-01', '2024-12-31', '2026-02-20')),
    NetIncomeLoss: usd(fy(1e9, 'k24', '2024-01-01', '2024-12-31', '2025-02-20'), fy(1e9, 'k25', '2024-01-01', '2024-12-31', '2026-02-20'), fy(1.2e9, 'k25', '2025-01-01', '2025-12-31', '2026-02-20')),
    StockholdersEquity: usd(instant(11e9, 'k25', '2024-12-31', '2026-02-20'), instant(12e9, 'k25', '2025-12-31', '2026-02-20'))
  } } };
  const row = normalize('INC', facts, 30, null);
  const ok = row?.fiscalPeriodEnd === '2025-12-31' && row.periodAnchor === 'net-income' && row.revenue === null && row.netIncome === 1.2e9
    && row.margin === undefined && row.revGrowth === undefined && !(row.coverage || []).includes('revGrowth') && row.equity === 12e9 && Number.isFinite(row.roe) && row.pe === 25;
  return { ok, detail: JSON.stringify(row && { end: row.fiscalPeriodEnd, anchor: row.periodAnchor, rev: row.revenue, ni: row.netIncome, m: row.margin, g: row.revGrowth, roe: row.roe, pe: row.pe }) };
}

export function misSpannedFullYearCase(normalize) {
  const facts = { cik: 202058, facts: { ...cover(187e6, 'k26', '2026-01-30', '2026-02-12'), 'us-gaap': {
    RevenueFromContractWithCustomerExcludingAssessedTax: usd(
      fy(19.419e9, 'k25', '2022-12-31', '2023-12-29', '2025-02-14'),
      fy(21.325e9, 'k25', '2023-12-30', '2025-01-03', '2025-02-14'),
      // FY2024 quarters (10-Q) and the 10-K's quarter-span comparative carrying the full-year value
      fy(5.211e9, 'q241', '2023-12-30', '2024-03-29', '2024-04-26', '10-Q', 'Q1'),
      fy(5.286e9, 'q242', '2024-03-30', '2024-06-28', '2024-07-26', '10-Q', 'Q2'),
      fy(5.292e9, 'q243', '2024-06-29', '2024-09-27', '2024-10-25', '10-Q', 'Q3'),
      fy(21.325e9, 'k26', '2024-09-28', '2025-01-03', '2026-02-12'),
      // FY2025: three 10-Q quarters, then the 10-K's full year on a quarter span (no ~1-year row)
      fy(5.132e9, 'q251', '2025-01-04', '2025-03-28', '2025-04-24', '10-Q', 'Q1'),
      fy(5.426e9, 'q252', '2025-03-29', '2025-06-27', '2025-07-24', '10-Q', 'Q2'),
      fy(5.659e9, 'q253', '2025-06-28', '2025-10-03', '2025-10-30', '10-Q', 'Q3'),
      fy(21.865e9, 'k26', '2025-10-04', '2026-01-02', '2026-02-12'),
      fy(5.744e9, 'q261', '2026-01-03', '2026-04-03', '2026-04-30', '10-Q', 'Q1')),
    NetIncomeLoss: usd(fy(1.502e9, 'k26', '2023-12-30', '2025-01-03', '2026-02-12'), fy(1.606e9, 'k26', '2025-01-04', '2026-01-02', '2026-02-12')),
    StockholdersEquity: usd(instant(19.514e9, 'k26', '2025-01-03', '2026-02-12'), instant(19.635e9, 'k26', '2026-01-02', '2026-02-12'))
  } } };
  const row = normalize('LHXF', facts, 280, null);
  const quarterValues = (row?.pit?.observations?.revenueQ || []).map((obs) => obs.value);
  const annual = (row?.pit?.observations?.revenue || []).find((obs) => obs.periodEnd === '2026-01-02');
  const ok = row?.fiscalPeriodEnd === '2026-01-02' && row.revenue === 21.865e9 && row.netIncome === 1.606e9 && row.margin === 7.3 && row.revGrowth === 2.5
    && row.periodAnchor === undefined && row.revenueReportedPeriodStart === '2025-10-04'
    && !quarterValues.some((value) => value >= 21e9) && quarterValues.includes(5.659e9) && quarterValues.includes(5.744e9)
    && annual?.value === 21.865e9 && annual.periodStart === '2025-01-04' && annual.reportedPeriodStart === '2025-10-04';
  return { ok, detail: JSON.stringify(row && { end: row.fiscalPeriodEnd, rev: row.revenue, m: row.margin, g: row.revGrowth, anchor: row.periodAnchor, reported: row.revenueReportedPeriodStart, bigQuarters: quarterValues.filter((value) => value >= 21e9), annual: annual && [annual.periodStart, annual.value] }) };
}

export function ordinaryFilerCase(normalize) {
  const facts = { cik: 13, facts: { ...cover(500e6, 'k25', '2026-01-31', '2026-02-20'), 'us-gaap': {
    Revenues: usd(
      fy(9e9, 'k25', '2024-01-01', '2024-12-31', '2026-02-20'), fy(10e9, 'k25', '2025-01-01', '2025-12-31', '2026-02-20'),
      fy(2.2e9, 'q1', '2025-01-01', '2025-03-31', '2025-05-01', '10-Q', 'Q1'), fy(2.4e9, 'q2', '2025-04-01', '2025-06-30', '2025-08-01', '10-Q', 'Q2'),
      fy(2.4e9, 'q3', '2025-07-01', '2025-09-30', '2025-11-01', '10-Q', 'Q3'),
      // a real fourth quarter tagged in the 10-K (fp=FY, quarter span, below Q1..Q3) stays a quarter
      fy(3.0e9, 'k25', '2025-10-01', '2025-12-31', '2026-02-20')),
    NetIncomeLoss: usd(fy(0.9e9, 'k25', '2024-01-01', '2024-12-31', '2026-02-20'), fy(1.0e9, 'k25', '2025-01-01', '2025-12-31', '2026-02-20')),
    StockholdersEquity: usd(instant(8e9, 'k25', '2025-12-31', '2026-02-20'))
  } } };
  const row = normalize('ORD', facts, 40, null);
  const quarterValues = (row?.pit?.observations?.revenueQ || []).map((obs) => obs.value);
  const ok = row?.fiscalPeriodEnd === '2025-12-31' && row.revenue === 10e9 && row.margin === 10 && row.revGrowth === 11.1 && row.roe === 12.5 && row.pe === 20
    && row.periodAnchor === undefined && row.revenueReportedPeriodStart === undefined && quarterValues.includes(3.0e9)
    && (row.pit.observations.revenue || []).every((obs) => obs.reportedPeriodStart === undefined);
  return { ok, detail: JSON.stringify(row && { end: row.fiscalPeriodEnd, rev: row.revenue, m: row.margin, g: row.revGrowth, roe: row.roe, pe: row.pe, q: quarterValues }) };
}
