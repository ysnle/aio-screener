// v59.70 (X bookmarks 11/4 packet §4 #7): each AI supply-chain layer's median PER on last-four-quarter consensus EPS
// (trailing) and next-four-quarter consensus EPS (forward). Both multiples come from the same source and the same members
// — a member enters only with a positive trailing and forward EPS and a current close — so the line between the two
// points is the layer's expected earnings change, not a change of basis. SEC-filed PER is never mixed in.
import { AI_CHAIN_THEMES } from '../briefing/ai-chain-flow.js';
import { CONSENSUS_MAX_AGE_DAYS, CONSENSUS_PRICE_MAX_AGE_DAYS } from '../fundamental/consensus-read.js';
import { median } from './theme-medians.js';
import { readNumber as finite } from '../shared/number.js';

const DAY_MS = 86400000;
export const LAYER_PER_MIN_MEASURED = 3;
// A layer whose covered members are under half its US listings is not shown (its median would speak for the minority).
export const LAYER_PER_MIN_COVERAGE = 0.5;

const priceOf = (row) => finite(row?._valuationPrice ?? row?.valuationPrice ?? row?._valuationPePrice ?? row?.pePrice);
const oneDecimal = (value) => (value == null ? null : Math.round(value * 10) / 10);

/** { layers: [...shown, sorted by forward PER], hidden: [...under coverage], asOf } */
export function layerValuation({ themes = [], rows = [], consensus = null, now = Date.now() } = {}) {
  const nowMs = finite(now) ?? Date.now();
  const estimates = consensus?.rows && typeof consensus.rows === 'object' ? consensus.rows : null;
  if (!estimates) return { layers: [], hidden: [], asOf: null, available: false };
  const estimateCurrent = (asOf) => { const ms = Date.parse(asOf || ''); return Number.isFinite(ms) && nowMs - ms <= CONSENSUS_MAX_AGE_DAYS * DAY_MS && ms - nowMs <= DAY_MS; };
  const closeCurrent = (row) => { const ms = Date.parse(`${String(row?.factorSessionDate || '').slice(0, 10)}T00:00:00Z`); return Number.isFinite(ms) && ms <= nowMs && nowMs - ms <= CONSENSUS_PRICE_MAX_AGE_DAYS * DAY_MS; };
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const layers = [];
  const hidden = [];
  let asOf = null;
  for (const theme of Array.isArray(themes) ? themes : []) {
    if (!AI_CHAIN_THEMES.includes(theme?.id)) continue;
    for (const sub of theme.subThemes || []) {
      const listed = [...new Set((sub?.tickers || []).map((sym) => String(sym).toUpperCase()))].filter((sym) => !/\.K[SQ]$/.test(sym));
      const members = [];
      for (const sym of listed) {
        const est = estimates[sym];
        const row = bySym.get(sym);
        const price = row && closeCurrent(row) ? priceOf(row) : null;
        const trailingEps = finite(est?.trailing?.eps);
        const forwardEps = finite(est?.fwd?.eps);
        if (!est || !estimateCurrent(est.asOf) || !(price > 0) || !(trailingEps > 0) || !(forwardEps > 0)) continue;
        if (!asOf || est.asOf > asOf) asOf = est.asOf;
        members.push({ sym, trailingPe: oneDecimal(price / trailingEps), forwardPe: oneDecimal(price / forwardEps) });
      }
      const entry = { id: `${theme.id}:${sub.name}`, name: sub.name, listed: listed.length, measured: members.length };
      if (members.length < LAYER_PER_MIN_MEASURED || members.length < listed.length * LAYER_PER_MIN_COVERAGE) { hidden.push(entry); continue; }
      layers.push({ ...entry, trailingPe: oneDecimal(median(members.map((m) => m.trailingPe))), forwardPe: oneDecimal(median(members.map((m) => m.forwardPe))), members });
    }
  }
  layers.sort((a, b) => b.forwardPe - a.forwardPe);
  return { layers, hidden, asOf, available: true };
}
