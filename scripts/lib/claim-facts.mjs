// The facts the sentence-claim checker (claim-validate.mjs) holds claims against, read from the stored inputs
// themselves — the close history, the FRED observations, the market-day ledger — never from a producer's output.
import { buildCloseSeries, closeBasis, closeSessionMarket, isCloseSessionDate, sessionPointBack } from '../../src/domain/market/session/close-series.js';
import { sessionStep, spanStepSd } from '../../src/domain/market/session/move-size.js';
import { priceMoveSize } from '../../src/domain/market/day/facts.js';
import { priceFamilyOf } from '../../src/domain/briefing/day-account.js';
import { readNumber } from '../../src/domain/shared/number.js';
import { RULES } from '../../src/domain/rules/thresholds.js';
import { isIsoDay } from '../../src/domain/shared/session-date.js';
import { isQuarterGap } from '../../src/domain/fundamental/period.js';

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
  for (const n of [1, 2, 5, 20]) {
    const back = sessionPointBack(series, n, market);
    if (!back) continue;
    values[`change${n}d`] = sessionStep(unit, back.value, last.value);
    sd[`change${n}d`] = { sd: spanStepSd(series, n, unit), sessions: n };
    if (n === 20) asOfBy.base20d = back.date;
  }
  const year = series.filter((point) => Date.parse(point.date) >= Date.parse(last.date) - 365 * DAY_MS).map((point) => point.value);
  if (year.length) values.fromYearHigh = (last.value / Math.max(...year) - 1) * 100;
  // v60.50: the fall from the record's closing high (the opening read without the long-run tables).
  values.fromRecordHigh = (last.value / Math.max(...series.map((point) => point.value)) - 1) * 100;
  // The same fall said as a size ("고점에서 43% 내린", the opening lede): unsigned.
  values.fromRecordHighDepth = -values.fromRecordHigh;
  // The rebound read (market-story.js, rebound.js): the lowest close since that high, the close's bounce off it,
  // the 50/200-session averages, and each line's distance from the close (signed: a line over the close is +).
  const peakAt = series.reduce((best, point, i) => (point.value >= series[best].value ? i : best), 0);
  const low = Math.min(...series.slice(peakAt).map((point) => point.value));
  const mean = (n) => (series.length >= n ? series.slice(-n).reduce((sum, point) => sum + point.value, 0) / n : null);
  Object.assign(values, { episodeLow: low, fromEpisodeLow: (last.value / low - 1) * 100, toEpisodeLow: (low / last.value - 1) * 100 });
  // The low the last rebound (a close RULES.story.reboundPct over the running low) rose from: the 반등 실패 line's level.
  let running = Infinity, from = null;
  for (const point of series.slice(peakAt)) { if (point.value < running) running = point.value; else if ((point.value / running - 1) * 100 >= RULES.story.reboundPct) from = running; }
  if (from != null) Object.assign(values, { reboundFrom: from, toReboundFrom: (from / last.value - 1) * 100 });
  for (const n of [50, 200]) { const ma = mean(n); if (ma != null) Object.assign(values, { [`ma${n}`]: ma, [`toMa${n}`]: (ma / last.value - 1) * 100 }); }
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

/**
 * v60.50 facts for the opening read (market-story.js buildMarketOpening): the indexes' close facts, the KOSPI on its own
 * session, the HY spread, and the leader gap — the equal weight's fall from its record high less the Nasdaq-100's — read
 * from the closes here, not from the opening.
 */
export const OPENING_FACT_FIELDS = Object.freeze(['sox', 'ndx', 'spx', 'dow', 'rsp', 'breadth50']);
export function openingFacts(history, macroHistory) {
  const facts = closeFacts(history, macroHistory, OPENING_FACT_FIELDS);
  const kospi = closeSeriesFacts(history, 'kospi', null);
  if (kospi) facts.kospi = kospi;
  const ndx = facts.ndx?.values?.fromRecordHigh, rsp = facts.rsp?.values?.fromRecordHigh;
  if (Number.isFinite(ndx) && Number.isFinite(rsp)) facts['leader-gap'] = { asOf: facts.ndx.asOf, values: { gapPp: rsp - ndx } };
  return facts;
}

/**
 * v60.50 the record a day account ranks its leading index's move within (day-account rankSaid): for each US index price
 * on the ledger, `record:<asset>:change1d` with every earlier one-session close change of the history as a member (keyed
 * by date), read from the closes here.
 */
export function recordFacts(history, day) {
  const facts = {};
  for (const fact of Array.isArray(day?.facts) ? day.facts : []) {
    if (fact.kind !== 'price' || priceFamilyOf(fact.asset) !== 'us' || !fact.date) continue;
    const series = buildCloseSeries(history, fact.asset, { through: fact.date }).filter((point) => Number(point.value) > 0);
    if (series.at(-1)?.date !== fact.date) continue;
    const members = {};
    for (let i = 1; i < series.length - 1; i += 1) members[series[i].date] = (Number(series[i].value) / Number(series[i - 1].value) - 1) * 100;
    facts[`record:${fact.asset}:change1d`] = { asOf: fact.date, values: {}, members };
  }
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
      put(fact.subjects[0], fact.date, { change1d: fact.change, z1d: abs(fact.z), rvol20: fact.rvol, indexBp: fact.indexBp,
        // the pull printed as %p of the index move (day-account pullSaid), the same bp over 100.
        indexPp: Number.isFinite(fact.indexBp) ? fact.indexBp / 100 : undefined });
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
  const years = cells(annual).map(([end, revenue, netIncome, equity, operatingCashFlow, capex, longTermDebt, shares, totalAssets]) => ({ end,
    revenue: amount(revenue), netIncome: amount(netIncome), equity: amount(equity), operatingCashFlow: amount(operatingCashFlow), capex: amount(capex), longTermDebt: amount(longTermDebt), shares: amount(shares),
    totalAssets: amount(totalAssets) }));
  // The filing summary holds the latest fiscal year's exact amounts (the strings round to USD thousands), and the cover-page
  // share count observed within 150 days after that year's end.
  const exact = summary?.periodType === 'FY' && summary?.observedAt ? years.find((year) => year.end === summary.observedAt) : null;
  if (exact) for (const field of ['revenue', 'netIncome', 'equity', 'operatingCashFlow', 'capex', 'longTermDebt']) if (known(summary[field]) != null) exact[field] = summary[field];
  const coverDelay = exact ? DAYS(summary.sharesObservedAt || '', exact.end) : NaN;
  if (exact && known(summary.sharesOutstanding) != null && coverDelay >= 0 && coverDelay <= 150) exact.shares = summary.sharesOutstanding;
  years.forEach((year, i) => {
    const prior = i > 0 && DAYS(year.end, years[i - 1].end) >= 300 && DAYS(year.end, years[i - 1].end) <= 400 ? years[i - 1] : null;
    const fcf = year.operatingCashFlow != null && year.capex != null ? year.operatingCashFlow - year.capex : null;
    const accrual = year.netIncome != null && year.operatingCashFlow != null ? year.netIncome - year.operatingCashFlow : null;
    // Revenue growth is read among the years that report revenue (a row without revenue is not a year of that record).
    const revenueRows = years.filter((other) => other.revenue != null);
    const before = year.revenue != null ? revenueRows[revenueRows.indexOf(year) - 1] : null;
    const revenuePrior = before && DAYS(year.end, before.end) >= 300 && DAYS(year.end, before.end) <= 400 ? before : null;
    const avgAssets = revenuePrior && year.totalAssets != null && revenuePrior.totalAssets != null ? (year.totalAssets + revenuePrior.totalAssets) / 2 : null;
    periods[`FY:${year.end}`] = { ...year, margin: pctOf(year.netIncome, year.revenue), fcf, fcfMargin: pctOf(fcf, year.revenue),
      cashConversion: year.netIncome > 0 && year.operatingCashFlow > 0 ? pctOf(year.operatingCashFlow, year.netIncome) : null,
      cashRatio: year.netIncome > 0 && year.operatingCashFlow > 0 ? year.operatingCashFlow / year.netIncome : null,
      nonCashIncome: accrual,
      // Sloan (1996): (net income − operating cash flow) over average total assets, or the year-end assets alone.
      accrualAvg: accrual != null && avgAssets > 0 ? pctOf(accrual, avgAssets) : null,
      accrualEnd: accrual != null && year.totalAssets > 0 ? pctOf(accrual, year.totalAssets) : null,
      revenueGrowth: revenuePrior && revenuePrior.revenue > 0 ? (year === exact && known(summary.revGrowth) != null ? summary.revGrowth : (year.revenue / revenuePrior.revenue - 1) * 100) : null,
      netIncomeGrowth: prior && prior.netIncome > 0 && year.netIncome != null ? (year.netIncome / prior.netIncome - 1) * 100 : null,
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
  // The share count across the fiscal years that report revenue, each year-over-year step that looks like a stock split (a
  // near-integer ratio of 1.9 or more, either way) left out: the split-adjusted change over that span.
  const shareYears = years.filter((year) => year.revenue != null && year.shares > 0);
  if (shareYears.length >= 2) {
    const nearSplit = (x) => x >= 1.9 && Math.abs(x - Math.round(x)) / Math.round(x) < 0.06;
    const factor = shareYears.slice(1).reduce((product, year, k) => { const ratio = year.shares / shareYears[k].shares; return nearSplit(ratio) || nearSplit(1 / ratio) ? product : product * ratio; }, 1);
    const span = periods[`SPAN:${shareYears[0].end}~${shareYears.at(-1).end}`];
    if (span) span.sharesSplitAdjusted = (factor - 1) * 100;
  }
  const quarterRows = cells(quarters).map(([end, revenue, netIncome, , inventory, receivables]) => ({ end, revenue: amount(revenue), netIncome: amount(netIncome), inventory: amount(inventory), receivables: amount(receivables) }));
  for (const { end, ...values } of quarterRows) periods[`Q:${end}`] = values;
  // Four consecutive quarters (each end 75–125 days after the one before) ending at a quarter: their summed net income.
  const linked = (k, count) => k + 1 >= count && quarterRows.slice(k + 1 - count, k + 1).every((q, j, run) => q.netIncome != null && (j === 0 || isQuarterGap(DAYS(q.end, run[j - 1].end))));
  quarterRows.forEach((q, k) => {
    if (!linked(k, 4)) return;
    const sum = (from) => quarterRows.slice(from, from + 4).reduce((total, row) => total + row.netIncome, 0);
    periods[`TTM:${q.end}`] = { netIncome: sum(k - 3), ...(linked(k, 8) && sum(k - 7) > 0 ? { netIncomeGrowth: (sum(k - 3) / sum(k - 7) - 1) * 100 } : {}) };
  });
  // The row's PER on the earnings period it was priced on, and its six-month return to its price session.
  const pe = known(row?.pe);
  const peAt = row?.peEarningsBasis === 'ttm' ? `TTM:${String(row.peEarningsThrough || '').slice(0, 10)}` : `FY:${String(row?.fundamentalPeriodEnd || '').slice(0, 10)}`;
  if (pe != null && isIsoDay(peAt.slice(peAt.indexOf(':') + 1))) periods[peAt] = { ...(periods[peAt] || {}), pe };
  // PEG: a PER over the growth of the earnings it is priced on, when that growth is positive; a fiscal-year PER is also
  // re-read over every later four quarters (the same market value over their summed net income).
  const pegOf = (multiple, growth) => (multiple > 0 && growth > 0 ? multiple / growth : null);
  if (pe != null && peAt.startsWith('FY:') && periods[peAt]) {
    const fy = periods[peAt];
    fy.peg = pegOf(pe, fy.netIncomeGrowth);
    for (const [id, ttm] of Object.entries(periods)) {
      if (!id.startsWith('TTM:') || id.slice(4) <= peAt.slice(3) || !(ttm.netIncome > 0) || fy.netIncome == null) continue;
      ttm.peRepriced = pe * fy.netIncome / ttm.netIncome;
      ttm.peg = pegOf(ttm.peRepriced, ttm.netIncomeGrowth);
    }
  } else if (pe != null && periods[peAt]) periods[peAt].peg = pegOf(pe, periods[peAt].netIncomeGrowth);
  const session = String(row?.factorSessionDate || '').slice(0, 10);
  if (known(row?.ret6m) != null && session) periods[`M6:${session}`] = { ret6m: row.ret6m };
  // Whole months from the end of the period the PER is priced on to the price session.
  const earningsEnd = String(row?.fundamentalPeriodEnd || years.at(-1)?.end || '').slice(0, 10);
  if (isIsoDay(earningsEnd) && isIsoDay(session)) {
    const [y1, m1, d1] = earningsEnd.split('-').map(Number); const [y2, m2, d2] = session.split('-').map(Number);
    periods[`AT:${session}`] = { monthsSince: (y2 - y1) * 12 + m2 - m1 - (d2 < d1 ? 1 : 0) };
  }
  return { [`filer:${symbol}`]: { periods } };
}

/**
 * Where a filer stands among its same-sector filers on each 재무 공시 peer metric (peer-read PEER_METRICS), from the stored
 * strings: the median of the peers whose latest fiscal year ended within 12 months of the filer's, and the filer's band
 * (상위/하위, at least 1%). Merged into the filer's latest fiscal year. own: filerFacts of the filer (with its summary);
 * peers: [{ symbol, annual, held }] (`held`: a financial filer, out of the free-cash-flow comparison).
 */
export function addPeerFacts(own, symbol, { peers = [], minPeers = 5, ownHeld = false } = {}) {
  const latestOf = (facts) => { const fy = Object.entries(facts.periods).filter(([id, values]) => id.startsWith('FY:') && values.revenue > 0).sort(([a], [b]) => a.localeCompare(b)).at(-1); return fy ? { end: fy[0].slice(3), ...fy[1] } : null; };
  const mine = latestOf(own[`filer:${symbol}`]);
  if (!mine) return own;
  const monthsApart = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / (30.44 * DAY_MS);
  const others = peers.filter((peer) => peer.symbol !== symbol).map((peer) => ({ ...peer, latest: latestOf(filerFacts(peer.symbol, { annual: peer.annual })[`filer:${peer.symbol}`]) }))
    .filter((peer) => peer.latest && monthsApart(peer.latest.end, mine.end) <= 12);
  if (others.length < minPeers) return own;
  const target = own[`filer:${symbol}`].periods[`FY:${mine.end}`];
  for (const [id, basis] of [['growth', 'revenueGrowth'], ['margin', 'margin'], ['fcfMargin', 'fcfMargin'], ['roe', 'roeAvg']]) {
    if (id === 'fcfMargin' && ownHeld) continue;
    const values = others.filter((peer) => id !== 'fcfMargin' || !peer.held).map((peer) => peer.latest[basis]).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    const value = mine[basis];
    if (!Number.isFinite(value) || values.length < minPeers) continue;
    const mid = Math.floor(values.length / 2);
    const at = (values.filter((v) => v < value).length + values.filter((v) => v === value).length * 0.5) / values.length * 100;
    Object.assign(target, { [`${id}PeerMedian`]: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
      ...(at >= 50 ? { [`${id}PeerTop`]: Math.max(1, 100 - at) } : { [`${id}PeerBottom`]: Math.max(1, at) }) });
  }
  return own;
}

/**
 * A listing's consensus facts (public-data/consensus-estimates.json row and the expanded screener row), subject
 * `consensus:<symbol>`, dated by the estimate; the price-session figures carry the row's session date.
 */
export function consensusFacts(symbol, { estimate = null, row = null } = {}) {
  if (!estimate?.fwd || !estimate?.trailing) return {};
  // The close the screener provider carries for valuation (valuationPrice, else the PER's, else the PBR's price).
  const price = known(row?.valuationPrice) ?? known(row?.pePrice) ?? known(row?.pbPrice);
  const fwdEps = readNumber(estimate.fwd.eps), trailingEps = readNumber(estimate.trailing.eps);
  const session = String(row?.factorSessionDate || '').slice(0, 10) || null;
  const growth = trailingEps > 0 && fwdEps != null ? (fwdEps / trailingEps - 1) * 100 : null;
  const values = { price, fwdEps, trailingEps, fwdPe: price > 0 && fwdEps > 0 ? price / fwdEps : null, trailingPe: price > 0 && trailingEps > 0 ? price / trailingEps : null,
    growth, drop: growth == null ? null : -growth, ret1m: known(row?.ret1m), pctFrom52wHigh: known(row?.pctFrom52wHigh), reportedPe: known(row?.pe),
    // v60.50 이 주가가 반영하는 것 (priced-in.js): the close against its 52-week closing high, and the estimate cut that
    // brings the forward multiple up to today's trailing one.
    pctFromCloseHigh52w: known(row?.pctFromCloseHigh52w), cut: fwdEps > 0 && trailingEps > 0 && fwdEps > trailingEps ? (1 - trailingEps / fwdEps) * 100 : null,
    spread: readNumber(estimate.fwd.hi) != null && readNumber(estimate.fwd.lo) != null && fwdEps > 0 ? (estimate.fwd.hi - estimate.fwd.lo) / fwdEps * 100 : null };
  // Each reported quarter's actual EPS over its estimate at the time (hist "month:actual:estimate").
  for (const [month, actual, estimated] of String(estimate.hist || '').split(';').map((part) => part.split(':'))) {
    if (readNumber(estimated) > 0 && readNumber(actual) != null) values[`beat:${month}`] = readNumber(actual) / readNumber(estimated);
  }
  return { [`consensus:${symbol}`]: { asOf: String(estimate.asOf || '').slice(0, 10), asOfBy: { ret1m: session, pctFrom52wHigh: session, pctFromCloseHigh52w: session, reportedPe: session }, values } };
}
