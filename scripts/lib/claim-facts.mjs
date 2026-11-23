// The facts the sentence-claim checker (claim-validate.mjs) holds claims against, read from the stored inputs
// themselves — the close history, the FRED observations, the market-day ledger — never from a producer's output.
import { buildCloseSeries, closeBasis, closeSessionMarket, isCloseSessionDate, sessionPointBack } from '../../src/domain/market/session/close-series.js';
import { sessionStep, spanStepSd } from '../../src/domain/market/session/move-size.js';
import { priceMoveSize } from '../../src/domain/market/day/facts.js';
import { priceFamilyOf } from '../../src/domain/briefing/day-account.js';
import { readNumber } from '../../src/domain/shared/number.js';
import { isIsoDay } from '../../src/domain/shared/session-date.js';

const DAY_MS = 86400000;
const BP_FIELDS = new Set(['tnx']);
const PERCENT_LEVEL = new Set(['advanceRatio']);

/** One close series' facts at `through`: its level, its 1/5/20-session changes, its year-high distance and their sds. */
function closeSeriesFacts(history, field, through) {
  const series = buildCloseSeries(history, field, { through });
  const last = series.at(-1);
  if (!last) return null;
  const market = closeSessionMarket(field) || 'US';
  const unit = BP_FIELDS.has(field) ? 'bp' : 'pct';
  const level = PERCENT_LEVEL.has(field) && last.value <= 1 ? last.value * 100 : last.value;
  const values = { level }, sd = {}, asOfBy = {};
  for (const n of [1, 5, 20]) {
    const back = sessionPointBack(series, n, market);
    if (!back) continue;
    values[`change${n}d`] = sessionStep(unit, back.value, last.value);
    sd[`change${n}d`] = { sd: spanStepSd(series, n, unit), sessions: n };
    if (n === 20) asOfBy.base20d = back.date;
  }
  const year = series.filter((point) => Date.parse(point.date) >= Date.parse(last.date) - 365 * DAY_MS).map((point) => point.value);
  if (year.length) values.fromYearHigh = (last.value / Math.max(...year) - 1) * 100;
  if (field === 'breadth50') values.above50 = level;
  if (field === 'advanceRatio') values.advancers = level;
  return { asOf: last.date, asOfBy, values, sd };
}

/** The HY OAS level and its five-session change in bp on US close sessions through `through` (macro-history.json). */
function creditFacts(macroHistory, through) {
  const series = (macroHistory?.series?.hyOas?.observations || [])
    .filter(([date, value]) => date <= through && Number.isFinite(value) && isCloseSessionDate(date, 'US')).map(([date, value]) => ({ date, value }));
  const last = series.at(-1);
  if (!last) return null;
  const back = sessionPointBack(series, 5, 'US');
  return { asOf: last.date, values: { level: last.value * 100, ...(back ? { change5d: (last.value - back.value) * 100 } : {}) } };
}

/** Facts for the market read at the S&P 500 close basis of `history`. */
export function closeFacts(history, macroHistory, fields = ['spx', 'nasdaq', 'rut', 'vix', 'vix3m', 'tnx', 'breadth50', 'advanceRatio']) {
  const through = closeBasis(history);
  const facts = {};
  if (!through) return facts;
  for (const field of fields) { const row = closeSeriesFacts(history, field, through); if (row) facts[field] = row; }
  const hy = creditFacts(macroHistory, through);
  if (hy) facts.hy = hy;
  return facts;
}

/** Facts for the day account from its market-day ledger: each fact's own figures, each group's members, each price family. */
export function ledgerFacts(day) {
  const facts = {};
  // One subject can carry facts of two dates (a stock's session move and its reported quarter): each measure keeps its own.
  const put = (subject, asOf, values) => {
    const row = (facts[subject] ||= { asOf, asOfBy: {}, values: {} });
    for (const [measure, value] of Object.entries(values)) { row.values[measure] = value; row.asOfBy[measure] = asOf; }
  };
  for (const fact of Array.isArray(day?.facts) ? day.facts : []) {
    const abs = (value) => (Number.isFinite(value) ? Math.abs(value) : undefined);
    if (fact.kind === 'price') {
      put(fact.asset, fact.date, { change1d: fact.change, week5d: fact.week, zWeek: abs(fact.zWeek), z1d: abs(fact.z), size: priceMoveSize(fact).size });
      const family = priceFamilyOf(fact.asset);
      if (family && fact.rank !== 'context') ((facts[`family:${family}`] ||= { values: {}, members: {} }).members[fact.asset] = priceMoveSize(fact).size);
    } else if (fact.kind === 'stock-move') {
      put(fact.subjects[0], fact.date, { change1d: fact.change, z1d: abs(fact.z), rvol20: fact.rvol, indexBp: fact.indexBp });
    } else if (fact.kind === 'group-move') {
      put(fact.group, fact.date, { change1d: fact.change, median: fact.change });
      facts[fact.group].members = Object.fromEntries((fact.leaders || []).map((lead) => [lead.sym, lead.change]));
    } else if (fact.kind === 'earnings') {
      put(fact.subjects[0], fact.date, { epsSurprise: fact.epsSurprise, revenueSurprise: fact.revenueSurprise });
    } else if (fact.kind === 'deal') {
      put(fact.subjects[0], fact.date, { dealValue: fact.valueUsd, dealPremium: fact.premiumPct });
    }
  }
  // A group's members with a move of their own on the ledger count beside its leaders.
  for (const fact of day?.facts || []) {
    if (fact.kind !== 'group-move') continue;
    for (const sym of fact.members || []) {
      const stock = facts[sym]?.values?.change1d;
      if (Number.isFinite(stock) && !(sym in facts[fact.group].members)) facts[fact.group].members[sym] = stock;
    }
  }
  // The account's date label is the US session of its price bars.
  const spx = (day?.facts || []).find((fact) => fact.kind === 'price' && fact.asset === 'spx');
  if (spx?.date) facts['us-session'] = { asOf: spx.date, values: {} };
  // The stock and group moves can sit one session behind the index bars; their label is checked against their own dates.
  const moverDates = (day?.facts || []).filter((fact) => fact.kind === 'stock-move' || fact.kind === 'group-move').map((fact) => fact.date).filter(Boolean).sort();
  if (moverDates.length) facts['us-movers'] = { asOf: moverDates[moverDates.length - 1], values: {} };
  return facts;
}

// v60.49 a filer's facts, per period (claim.js CLAIM_PERIODS), read from the stored SEC strings, the filing summary and the
// screener row themselves — never from the fundamental read. Amounts are USD; the strings are USD millions.
const MILLION = 1e6;
const cells = (text) => String(text || '').split(';').map((part) => part.split(':')).filter((row) => isIsoDay(row[0]));
const amount = (cell) => (readNumber(cell) == null ? null : readNumber(cell) * MILLION);
const known = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const pctOf = (part, whole) => (part != null && whole ? (part / whole) * 100 : null);
const DAYS = (later, earlier) => (Date.parse(later) - Date.parse(earlier)) / DAY_MS;
// Consecutive fiscal years of rising revenue ending at `year`, each a year (300–400 days) after the one before, among the
// years that report revenue (a row without revenue is not a year of the revenue record).
function runOf(years, year) {
  const rows = years.filter((row) => row.revenue != null);
  let run = 0;
  for (let k = rows.indexOf(year); k > 0 && DAYS(rows[k].end, rows[k - 1].end) >= 300 && DAYS(rows[k].end, rows[k - 1].end) <= 400 && rows[k].revenue > rows[k - 1].revenue; k -= 1) run += 1;
  return run;
}

/**
 * facts[`filer:<symbol>`] = { periods: { 'FY:<end>' | 'Q:<end>' | 'M6:<session>': { [basis]: value } } }.
 * annual: sec-fiscal-history.json `data[symbol]`; quarters: its `quarters[symbol]`; summary: the expanded
 * sec-fundamentals-summary record; row: the expanded screener.json row.
 */
export function filerFacts(symbol, { annual = '', quarters = '', summary = null, row = null } = {}) {
  const periods = {};
  const years = cells(annual).map(([end, revenue, netIncome, equity, operatingCashFlow, capex, longTermDebt, shares]) => ({ end,
    revenue: amount(revenue), netIncome: amount(netIncome), equity: amount(equity), operatingCashFlow: amount(operatingCashFlow), capex: amount(capex), longTermDebt: amount(longTermDebt), shares: amount(shares) }));
  // The filing summary holds the latest fiscal year's exact amounts (the strings round to USD thousands).
  const exact = summary?.periodType === 'FY' && summary?.observedAt ? years.find((year) => year.end === summary.observedAt) : null;
  if (exact) for (const field of ['revenue', 'netIncome', 'equity', 'operatingCashFlow', 'capex', 'longTermDebt']) if (known(summary[field]) != null) exact[field] = summary[field];
  years.forEach((year, i) => {
    const prior = i > 0 && DAYS(year.end, years[i - 1].end) >= 300 && DAYS(year.end, years[i - 1].end) <= 400 ? years[i - 1] : null;
    const fcf = year.operatingCashFlow != null && year.capex != null ? year.operatingCashFlow - year.capex : null;
    periods[`FY:${year.end}`] = { ...year, margin: pctOf(year.netIncome, year.revenue), fcf, fcfMargin: pctOf(fcf, year.revenue),
      cashConversion: year.netIncome > 0 && year.operatingCashFlow > 0 ? pctOf(year.operatingCashFlow, year.netIncome) : null,
      debtToEquity: year.equity > 0 ? pctOf(year.longTermDebt, year.equity) : null,
      roeAvg: prior && year.equity > 0 && prior.equity > 0 && year.netIncome != null ? pctOf(year.netIncome, (year.equity + prior.equity) / 2) : null,
      growthRun: year.revenue == null ? null : runOf(years, year),
      ...(year === exact ? { roeEnd: known(summary.roe), revGrowth: known(summary.revGrowth),
        // The filing's own year-over-year revenue change, computed on exact amounts the strings no longer carry.
        ...(prior && known(summary.revGrowth) != null ? { changes: { revenue: { against: `FY:${prior.end}`, value: summary.revGrowth } } } : {}) } : {}) };
    // Every span of fiscal years ending here: its length in whole years and its revenue growth rate per year.
    for (const start of years.slice(0, i)) {
      const span = DAYS(year.end, start.end) / 365.25;
      periods[`SPAN:${start.end}~${year.end}`] = { spanYears: Math.round(span),
        revenueCagr: start.revenue > 0 && year.revenue > 0 ? ((year.revenue / start.revenue) ** (1 / span) - 1) * 100 : null };
    }
  });
  for (const [end, revenue, netIncome, , inventory, receivables] of cells(quarters)) {
    periods[`Q:${end}`] = { revenue: amount(revenue), netIncome: amount(netIncome), inventory: amount(inventory), receivables: amount(receivables) };
  }
  // The row's PER on the earnings period it was priced on, and its six-month return to its price session.
  const pe = known(row?.pe);
  const peAt = row?.peEarningsBasis === 'ttm' ? `TTM:${String(row.peEarningsThrough || '').slice(0, 10)}` : `FY:${String(row?.fundamentalPeriodEnd || '').slice(0, 10)}`;
  if (pe != null && isIsoDay(peAt.slice(peAt.indexOf(':') + 1))) periods[peAt] = { ...(periods[peAt] || {}), pe };
  if (known(row?.ret6m) != null && row?.factorSessionDate) periods[`M6:${String(row.factorSessionDate).slice(0, 10)}`] = { ret6m: row.ret6m };
  return { [`filer:${symbol}`]: { periods } };
}
