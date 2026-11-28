// Sector evidence table (테마와 섹터): moving-average shares on three windows, both ends of the 52-week range, and the
// price × estimates cell — facts and fixed state words per sector on one session and one denominator.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export default async function run({ load, fail }) {
  const { buildSectorEvidence, priceEstimateCell, priceSideOf } = await load('src/domain/themes/sector-evidence.js');
  const { sectorNearHigh } = await load('src/domain/themes/near-high.js');
  const session = '2026-11-27';
  // 12 tech members (one on an older close), 4 real-estate members (below the ten-member floor).
  const tech = Array.from({ length: 12 }, (_, i) => ({
    sym: `T${i}`, factorSessionDate: i === 11 ? '2026-11-26' : session,
    pctSma20: i < 3 ? 1 : -1, pctSma50: i < 6 ? 2 : -2, pctSma200: i < 9 ? 3 : -3,
    // T0–T3 near the closing high, T4–T6 near the low, T7 on both (a narrow range) counts only as high.
    pctFromCloseHigh52w: i < 4 || i === 7 ? -2 : -30, pctFrom52wLow: (i >= 4 && i <= 7) ? 3 : 40
  }));
  const estate = Array.from({ length: 4 }, (_, i) => ({ sym: `R${i}`, factorSessionDate: session, pctSma20: 1, pctSma50: 1, pctSma200: 1, pctFromCloseHigh52w: 0, pctFrom52wLow: 50 }));
  const etfs = [['SPY', -5], ['XLK', -12], ['XLRE', 1]].map(([sym, ret1m]) => ({ sym, ret1m, factorSessionDate: session }));
  const weights = { rows: [...tech.map((row) => [row.sym, 'Information Technology', 1]), ...estate.map((row) => [row.sym, 'Real Estate', 1])] };
  const rows = [...tech, ...estate, ...etfs];
  const out = buildSectorEvidence({ weights, rows, session, quadrants: { XLK: 'Lagging' }, revisions: [{ sector: 'Information Technology', up: 80, down: 20, revision: 0.6 }] });
  const xlk = out.sectors.find((row) => row.symbol === 'XLK');
  const xlre = out.sectors.find((row) => row.symbol === 'XLRE');

  // Three windows side by side, each over the 11 members on the session (the older close is not measured).
  const sma = xlk?.sma || {};
  if (sma.pctSma20?.measured !== 11 || sma.pctSma20.hit !== 3 || sma.pctSma50?.hit !== 6 || sma.pctSma200?.hit !== 9 || sma.pctSma200.share !== 82) fail(`sector 20/50/200 shares on one session: ${JSON.stringify(sma)}`);
  if (xlre?.sma.pctSma50.share !== null || xlre.extremes.share !== null || xlre.extremes.lowShare !== null) fail(`a sector under ten measured members has no share: ${JSON.stringify(xlre)}`);

  // Both ends: near the high and near the low never overlap, and the sectors add up to the whole index.
  if (xlk.extremes.near !== 5 || xlk.extremes.low !== 3 || xlk.extremes.measured !== 11) fail(`near-high / near-low counts: ${JSON.stringify(xlk.extremes)}`);
  const all = sectorNearHigh({ weights, rows, session });
  const sum = (key) => Object.values(all.bySector).reduce((total, row) => total + row[key], 0);
  if (sum('near') !== all.total.near || sum('low') !== all.total.low || sum('measured') !== all.total.measured) fail(`sector counts add up to the index: ${JSON.stringify(all)}`);

  // Price × estimates: XLK behind SPY by 7%p with estimates raised → 추정만 강함; XLRE ahead with no sector revision row
  // (below the member floor) gets no cell — an absent revision is not a cut.
  if (xlk.priceSide !== 'behind' || xlk.revision?.tilt !== 'up' || xlk.cell !== 'estimates' || xlk.quadrant !== 'Lagging') fail(`price × estimates cell: ${JSON.stringify(xlk)}`);
  if (xlre.priceSide !== 'ahead' || xlre.revision !== null || xlre.cell !== null) fail(`no revision row, no cell: ${JSON.stringify(xlre)}`);
  if (priceEstimateCell('ahead', 'even') !== 'price' || priceEstimateCell('behind', 'down') !== 'neither' || priceEstimateCell('inline', 'up') !== null) fail('a stalled estimate sits on the not-raised side; a move with the index has no cell');
  if (priceSideOf(4) !== 'inline' || priceSideOf(4.5) !== 'ahead' || priceSideOf(null) !== null) fail('the price side uses the shared 1-month relative band');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (message) => { throw new Error(message); } });
  console.log('sector-evidence: ok');
}
