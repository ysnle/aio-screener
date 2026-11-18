// The facts the sentence-claim checker (claim-validate.mjs) holds claims against, read from the stored inputs
// themselves — the close history, the FRED observations, the market-day ledger — never from a producer's output.
import { buildCloseSeries, closeBasis, closeSessionMarket, isCloseSessionDate, sessionPointBack } from '../../src/domain/market/session/close-series.js';
import { sessionStep, spanStepSd } from '../../src/domain/market/session/move-size.js';
import { priceMoveSize } from '../../src/domain/market/day/facts.js';
import { priceFamilyOf } from '../../src/domain/briefing/day-account.js';

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
