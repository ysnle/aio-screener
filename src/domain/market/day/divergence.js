// Cross-asset divergences of one session, from the day ledger (public-data/market-day.json): two figures of the same
// session date that went the way a reader would not expect from the other — a hot inflation print with the 10-year
// lower, stocks down with high-yield spreads no wider, the dollar and gold down together, oil up with energy stocks
// down. A rule fires only when both figures exist for that date and each passed its own line; it states the two
// figures and the word 엇갈림, never the reason (that is the AI reading's, which receives the line).
import { claim, say } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { DAY_READ_WORDS } from '../../content/day-read-words.js';

const W = DAY_READ_WORDS.divergence;

// A leg reads one figure of the session from the ledger: { value, unit, label, subject, measure } or null.
const price = (asset) => (day, date) => {
  const fact = (day.facts || []).find((row) => row?.kind === 'price' && row.asset === asset && row.date === date && Number.isFinite(row.change));
  return fact ? { value: fact.change, unit: fact.changeUnit === 'bp' || fact.unit === 'bp' ? 'bp' : 'pct', label: W.names[asset], subject: asset, measure: 'change1d' } : null;
};
// The S&P 500 energy names' weighted one-session return (indexSplit, the ledger's split of the index by sector).
const sector = (name, key) => (day, date) => {
  const row = day.indexSplit?.date === date ? (day.indexSplit.sectors || []).find((item) => item?.sector === name) : null;
  return row && Number.isFinite(row.change) ? { value: row.change, unit: 'pct', label: W.names[key], subject: `sector:${name}`, measure: 'sectorChange1d' } : null;
};
// The session's inflation release that printed above its forecast (the ledger's release facts carry actual and forecast).
const hotInflation = (day, date) => {
  const fact = (day.facts || []).find((row) => row?.kind === 'release' && row.date === date && (row.topics || []).includes('inflation')
    && Number.isFinite(row.actual) && Number.isFinite(row.forecast) && row.actual > row.forecast);
  return fact ? { release: fact, value: fact.actual, forecast: fact.forecast, label: fact.label, subject: fact.id, measure: 'release' } : null;
};

/**
 * The rules, one row each: `a` and `b` read the two legs, `fires(a, b)` holds each leg to its own line. Lines are sized so
 * an ordinary session does not trip them: 3bp on the 10-year, 1% on the S&P 500, 0.3% on the dollar, 1% on gold, 2% on
 * WTI, 0.5% on the energy sector; spreads "no wider" is at most +1bp.
 */
export const DIVERGENCE_RULES = Object.freeze([
  Object.freeze({ id: 'hot-inflation-yields-down', a: hotInflation, b: price('tnx'), fires: (a, b) => b.value <= -3 }),
  Object.freeze({ id: 'stocks-down-credit-calm', a: price('spx'), b: price('hyOas'), fires: (a, b) => a.value <= -1 && b.value <= 1 }),
  Object.freeze({ id: 'dollar-down-gold-down', a: price('dxy'), b: price('gold'), fires: (a, b) => a.value <= -0.3 && b.value <= -1 }),
  Object.freeze({ id: 'oil-up-energy-down', a: price('wti'), b: sector('Energy', 'energy'), fires: (a, b) => a.value >= 2 && b.value <= -0.5 })
]);

function legSaid(leg, date) {
  if (leg.release) {
    const unit = leg.release.unit === '%' ? 'rate' : 'level';
    const figure = (value, label) => ({ value, unit, digits: Number.isInteger(value) ? 0 : 1, basis: 'release', label });
    const c = claim({ subject: leg.subject, measure: 'release', asOf: date, figures: [figure(leg.value, leg.label), figure(leg.forecast, '예상')] });
    return say(W.release, { name: leg.label, actual: c, forecast: say('{c.1}', { c }) });
  }
  return say('{c.label} {c}', { c: claim({ subject: leg.subject, measure: leg.measure, asOf: date, figures: [{ value: leg.value, unit: leg.unit, basis: leg.measure, label: leg.label }] }) });
}

/**
 * @param {object|null} day market-day.json
 * @param {string} asOf the basis US session
 * @returns {Array<{id: string, date: string, said: {text: string, claims: object[]}}>}
 */
export function sessionDivergences(day, asOf) {
  if (!asOf || day?.sessions?.us !== asOf || !Array.isArray(day.facts)) return [];
  const out = [];
  for (const rule of DIVERGENCE_RULES) {
    const a = rule.a(day, asOf), b = rule.b(day, asOf);
    if (!a || !b || !rule.fires(a, b)) continue;
    const said = say(W.said, { d: shortDate(asOf), a: legSaid(a, asOf), b: legSaid(b, asOf) });
    if (said.text) out.push({ id: rule.id, date: asOf, said });
  }
  return out;
}

