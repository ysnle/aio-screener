// Expertise review 2026-10-19: the site read every stock's consensus revisions but never the index's. A strategist reads
// the S&P 500 as a whole first: are analysts raising or cutting next-year earnings (revision breadth leads the index EPS
// trend), what forward multiple the index trades on, and how its earnings yield compares with the 10-year real yield
// (the equity risk premium — the extra return stocks offer over an inflation-protected Treasury).
// Inputs are artifacts the site already publishes: member weights (screener metadata.indexWeights, IVV holdings),
// next-four-quarter consensus EPS with 4-week up/down revision counts (consensus-estimates.json), each member's completed
// close (screener row valuationPrice) and FRED DFII10. Nothing here is a forecast or a grade.

import { dataStateText } from '../content/data-state.js';
import { CONSENSUS_MAX_AGE_DAYS, CONSENSUS_PRICE_MAX_AGE_DAYS } from '../fundamental/consensus-read.js';
import { readNumber as finite } from '../shared/number.js';

// A whole-index figure needs most of the index behind it; below this share of index weight it is withheld.
const DAY_MS = 86400000;
export const INDEX_EARNINGS_MIN_WEIGHT_PCT = 80;
// A sector line needs enough members that one company cannot set its sign.
export const SECTOR_MIN_MEMBERS = 8;
// Dual share classes are one issuer: their weights add, their estimate revisions are counted once.
const SHARE_CLASS_OF = Object.freeze({ GOOG: 'GOOGL', FOX: 'FOXA', NWS: 'NWSA' });


function weightRows(weights) {
  const rows = Array.isArray(weights?.rows) ? weights.rows : [];
  // v59.45 (P17-EARNINGS-01): the weight is summed as the number it was checked as (a string weight concatenated).
  return rows.map((row) => (Array.isArray(row) ? { sym: row[0], sector: row[1], weight: row[2] } : row))
    .filter((row) => row?.sym && finite(row.weight) > 0)
    .map((row) => ({ ...row, weight: finite(row.weight) }));
}

const priceOf = (row) => finite(row?._valuationPrice ?? row?.valuationPrice ?? row?._valuationPePrice ?? row?.pePrice);

function revisionOf(stats) {
  const total = stats.up + stats.down;
  return total > 0 ? (stats.up - stats.down) / total : null;
}

// v58.63 (architecture audit F-DELTA-01): the index stage read every member's consensus and close without the age limits
// the stock card applies (consensusView: estimates within 21 days, closes within 10), so an outage kept publishing "최근 4주"
// breadth and a forward PER on old inputs. The same limits apply per member; an expired member leaves the coverage.
export function buildIndexEarnings({ rows = [], weights = null, consensus = null, realYield10 = null, realYieldAsOf = null, now = Date.now() } = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const estimateCurrent = (asOf) => { const ms = Date.parse(asOf || ''); return Number.isFinite(ms) && nowMs - ms <= CONSENSUS_MAX_AGE_DAYS * DAY_MS && ms - nowMs <= DAY_MS; };
  // v59.45 (P17-EARNINGS-01): a close dated after now is not the latest close.
  const closeCurrent = (row) => { const day = String(row?.factorSessionDate || '').slice(0, 10); const ms = day ? Date.parse(`${day}T00:00:00Z`) : NaN; return Number.isFinite(ms) && ms <= nowMs && nowMs - ms <= CONSENSUS_PRICE_MAX_AGE_DAYS * DAY_MS; };
  const members = weightRows(weights);
  const estimates = consensus?.rows && typeof consensus.rows === 'object' ? consensus.rows : null;
  // v58.80 (first-users bundle 3): weights not loaded yet (null) is a load in progress, not "없습니다".
  if (!members.length || !estimates) return { available: false, reason: `${!members.length ? dataStateText(weights == null ? 'loading' : 'absent', '지수 구성 비중') : dataStateText('loading', '컨센서스 자료')}.` };
  const bySym = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), row]));
  const totalWeight = members.reduce((sum, row) => sum + row.weight, 0);
  const all = { up: 0, down: 0, netUp: 0, netDown: 0, members: 0, weight: 0 };
  const sectors = new Map();
  let yieldWeight = 0; let yieldSum = 0; let fwdSum = 0; let trailSum = 0; let growthWeight = 0;
  let latest = null; let oldest = null;
  for (const member of members) {
    const sym = String(member.sym).toUpperCase();
    const est = estimates[sym] || estimates[sym.replace('-', '.')] || estimates[sym.replace('.', '-')];
    const fwd = est?.fwd;
    if (!fwd || !estimateCurrent(est.asOf)) continue;
    if (est.asOf && (!latest || est.asOf > latest)) latest = est.asOf;
    if (est.asOf && (!oldest || est.asOf < oldest)) oldest = est.asOf;
    const secondClass = Object.hasOwn(SHARE_CLASS_OF, sym) && members.some((row) => String(row.sym).toUpperCase() === SHARE_CLASS_OF[sym]);
    const up = secondClass ? 0 : finite(fwd.up4w) ?? 0;
    const down = secondClass ? 0 : finite(fwd.down4w) ?? 0;
    const sector = member.sector || '기타';
    const bucket = sectors.get(sector) || { sector, up: 0, down: 0, members: 0, weight: 0 };
    for (const target of [all, bucket]) {
      target.up += up; target.down += down; target.members += secondClass ? 0 : 1; target.weight += member.weight;
    }
    if (up > down) all.netUp += 1; else if (down > up) all.netDown += 1;
    sectors.set(sector, bucket);
    const priceRow = bySym.get(sym);
    const price = closeCurrent(priceRow) ? priceOf(priceRow) : null;
    const eps = finite(fwd.eps);
    if (price > 0 && eps != null) {
      yieldWeight += member.weight;
      yieldSum += member.weight * eps / price;
      const trailing = finite(est.trailing?.eps);
      if (trailing != null) {
        growthWeight += member.weight;
        fwdSum += member.weight * eps / price;
        trailSum += member.weight * trailing / price;
      }
    }
  }
  if (!all.members) return { available: false, reason: '지수 구성 종목의 컨센서스가 없습니다.' };
  const coveragePct = totalWeight > 0 ? (all.weight / totalWeight) * 100 : null;
  const yieldCoveragePct = totalWeight > 0 ? (yieldWeight / totalWeight) * 100 : null;
  const breadth = coveragePct >= INDEX_EARNINGS_MIN_WEIGHT_PCT ? revisionOf(all) : null;
  // Weighted harmonic mean: the index's earnings yield is its members' earnings per dollar of price, weighted by index share.
  const earningsYield = yieldCoveragePct >= INDEX_EARNINGS_MIN_WEIGHT_PCT && yieldSum > 0 ? yieldSum / yieldWeight : null;
  const forwardPe = earningsYield > 0 ? 1 / earningsYield : null;
  // Earnings-weighted, so a near-zero trailing EPS cannot blow the average up.
  const growth = growthWeight / (totalWeight || 1) * 100 >= INDEX_EARNINGS_MIN_WEIGHT_PCT && trailSum > 0 ? fwdSum / trailSum - 1 : null;
  const real = finite(realYield10);
  const erp = earningsYield != null && real != null ? earningsYield * 100 - real : null;
  const sectorRows = [...sectors.values()]
    .filter((row) => row.members >= SECTOR_MIN_MEMBERS && row.up + row.down > 0)
    .map((row) => ({ ...row, revision: revisionOf(row) }))
    .sort((a, b) => b.revision - a.revision);
  return {
    available: true,
    asOf: latest ? String(latest).slice(0, 10) : null,
    oldestAsOf: oldest ? String(oldest).slice(0, 10) : null,
    weightsAsOf: weights?.asOf || null,
    members: all.members,
    memberTotal: members.length,
    coveragePct,
    up: all.up,
    down: all.down,
    netUp: all.netUp,
    netDown: all.netDown,
    breadth,
    earningsYield,
    forwardPe,
    growth,
    realYield10: real,
    realYieldAsOf: realYieldAsOf || null,
    erp,
    sectors: sectorRows
  };
}
