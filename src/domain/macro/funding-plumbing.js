// 자금 배관: the short-term funding market read as three tanks and one pressure gauge. The gauge is SOFR − IORB on one date;
// the tanks are the overnight reverse repo (the buffer), the Treasury General Account and bank reserves. A Treasury-account
// build is read by where it was paid from — reserves (흡수) or the reverse repo (자리바꿈). Facts and fixed state words only.
import { seriesOf } from './macro-read.js';
import { NET_LIQUIDITY_FLAT_BN } from './liquidity-growth.js';
import { STATE_LABELS } from '../market/interpretation/concepts.js';

export const PLUMBING_RULES = Object.freeze({
  // 2032065889739448796: SOFR − IORB above 0bp held for days is 긴장, 5bp or more in a row is 스트레스. The post gives no day
  // count; two observations in a row is the least that is "held", and it keeps a one-day month-end print out
  // (1987829668813099258: a print that normalises at once is friction, not shortage).
  tensionAboveBp: 0, stressAtBp: 5, heldObservations: 2,
  // Same post: ON RRP under $10bn while the Treasury account rises more than $100bn in one week is a week of dense risk.
  rrpDepletedBn: 10, tgaWeekSurgeBn: 100,
  // 2042175804541718760: a four-week Treasury-account rise past the net-liquidity flat band is 흡수 when reserves fell more
  // than the reverse repo, 자리바꿈 when the reverse repo paid more of it (2023: TGA +501, RRP −505, reserves −39 $bn).
  sourceDays: 28, legLagDays: 7
});
export const PLUMBING_WORDS = Object.freeze({ calm: '안정', tension: '긴장', stress: '스트레스', unknown: STATE_LABELS.unknown });
export const TGA_SOURCE_WORDS = Object.freeze({ absorb: '준비금 흡수', swap: '역레포 자리바꿈' });

const DAY_MS = 86400000;
const BN_PER_UNIT = Object.freeze({ 'usd-millions': 1 / 1000, 'usd-billions': 1 });
const billions = (macroHistory, id) => {
  const per = BN_PER_UNIT[macroHistory?.series?.[id]?.unit];
  return per ? seriesOf(macroHistory, id).map((row) => ({ date: row.date, value: row.value * per })) : [];
};
const atOrBefore = (rows, date) => { let found = null; for (const row of rows) { if (row.date <= date) found = row; else break; } return found; };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const trailing = (rows, test) => { let n = 0; for (let i = rows.length - 1; i >= 0 && test(rows[i]); i -= 1) n += 1; return n; };

/** SOFR − IORB (bp) for every date both were published; never an IORB inferred from the target range. */
export function sofrIorbSpreads(macroHistory) {
  const iorb = new Map(seriesOf(macroHistory, 'iorb').map((row) => [row.date, row.value]));
  return seriesOf(macroHistory, 'sofr').filter((row) => iorb.has(row.date))
    .map((row) => ({ date: row.date, sofr: row.value, iorb: iorb.get(row.date), bp: Math.round((row.value - iorb.get(row.date)) * 1000) / 10 }));
}

/** Where a four-week Treasury-account change came from: each leg on or before the account's two dates (within a week). */
export function tgaSource(macroHistory) {
  const R = PLUMBING_RULES;
  const tga = billions(macroHistory, 'treasuryAccount');
  const end = tga.at(-1);
  if (!end) return null;
  const start = atOrBefore(tga, new Date(Date.parse(end.date) - R.sourceDays * DAY_MS).toISOString().slice(0, 10));
  if (!start) return null;
  const legOf = (rows) => {
    const [a, b] = [atOrBefore(rows, start.date), atOrBefore(rows, end.date)];
    return a && b && daysBetween(a.date, start.date) <= R.legLagDays && daysBetween(b.date, end.date) <= R.legLagDays ? b.value - a.value : null;
  };
  const tgaBn = end.value - start.value;
  const rrpBn = legOf(billions(macroHistory, 'reverseRepo'));
  const reservesBn = legOf(billions(macroHistory, 'reserves'));
  const kind = tgaBn >= NET_LIQUIDITY_FLAT_BN && rrpBn != null && reservesBn != null ? (-reservesBn >= -rrpBn ? 'absorb' : 'swap') : null;
  // TGA↑ = RRP↓ + reserves↓ + the rest (the Fed's own assets and other liabilities).
  const otherBn = rrpBn != null && reservesBn != null ? tgaBn + rrpBn + reservesBn : null;
  return { from: start.date, to: end.date, tgaBn, rrpBn, reservesBn, otherBn, kind, label: kind ? TGA_SOURCE_WORDS[kind] : null };
}

/**
 * The funding-plumbing judgement: 안정 / 긴장 / 스트레스 from the SOFR − IORB gauge (확인 불가 without a same-date IORB),
 * the risk-week flag, and each tank's latest dated level. Null when none of the series is published.
 */
export function plumbingRead(macroHistory) {
  const R = PLUMBING_RULES;
  const spreads = sofrIorbSpreads(macroHistory);
  const rrpRows = billions(macroHistory, 'reverseRepo');
  const tga = billions(macroHistory, 'treasuryAccount');
  const reserves = billions(macroHistory, 'reserves');
  const sofr = seriesOf(macroHistory, 'sofr').at(-1) || null;
  if (!spreads.length && !rrpRows.length && !tga.length && !sofr) return null;
  const heldAbove = trailing(spreads, (row) => row.bp > R.tensionAboveBp);
  const heldStress = trailing(spreads, (row) => row.bp >= R.stressAtBp);
  const state = !spreads.length ? 'unknown' : heldStress >= R.heldObservations ? 'stress' : heldAbove >= R.heldObservations ? 'tension' : 'calm';
  const [before, last] = tga.slice(-2);
  const tgaWeek = before && last && daysBetween(before.date, last.date) <= R.legLagDays ? { from: before.date, date: last.date, level: last.value, changeBn: last.value - before.value } : null;
  const weekRrp = tgaWeek ? rrpRows.filter((row) => row.date > tgaWeek.from && row.date <= tgaWeek.date) : [];
  const riskWeek = !!tgaWeek && tgaWeek.changeBn > R.tgaWeekSurgeBn && weekRrp.length > 0 && weekRrp.every((row) => row.value < R.rrpDepletedBn);
  return { state, label: PLUMBING_WORDS[state], spread: spreads.at(-1) || null, recent: spreads.slice(-10), heldAbove, heldStress, sofr,
    rrp: rrpRows.at(-1) || null, tga: tga.at(-1) || null, tgaWeek, riskWeek, reserves: reserves.at(-1) || null, source: tgaSource(macroHistory) };
}
