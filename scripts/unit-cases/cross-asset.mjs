// Cross-asset verdicts: one module (src/domain/macro/cross-asset-relations.js) judges every relation between assets —
// cash dash vs real-rate market, rates × dollar, the kind of fall in the 10-year, the yen crosses and the bond response
// after a release. Facts in, fixed state word out; the sentences are the AI reading's.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ load, fail }) {
  const ok = (cond, msg) => { if (!cond) fail(msg); };
  const { resolveMarketCalendarSession } = await load('src/domain/market/session/market-calendar.js');
  const days = [];
  for (let t = Date.parse('2026-08-03T12:00:00Z'); days.length < 25; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') days.push(date);
  }
  // Each field holds `a` until 20 sessions before the last day, then moves linearly to `b`: the 20-session move is a→b.
  const at = (a, b, i) => (i <= 4 ? a : a + (b - a) * (i - 4) / 20);
  const history = (spec, { dropLast = [] } = {}) => days.map((date, i) => {
    const row = { date, fieldMeta: {} };
    for (const [field, [a, b]] of Object.entries(spec)) {
      if (i === days.length - 1 && dropLast.includes(field)) continue;
      row[field] = at(a, b, i);
      row.fieldMeta[field] = { sessionDate: date, observedAt: `${date}T20:00:00Z` };
    }
    return row;
  });
  const fred = (spec) => ({ schemaVersion: 'macro-history.v1', series: Object.fromEntries(Object.entries(spec).map(([key, [a, b]]) => [key, { observations: days.map((date, i) => [date, at(a, b, i)]) }])) });
  const { crossAssetVerdicts, buildCrossAssetRelations, eventRateResponse } = await load('src/domain/macro/cross-asset-relations.js');

  // Stocks, gold, long bonds down and only the dollar up: the real-yield leg decides cash dash vs real-rate market.
  const dash = { spx: [100, 95], gold: [100, 95], tlt: [100, 97], dxy: [100, 102], tnx: [4, 4.2] };
  ok(crossAssetVerdicts(history(dash), fred({ realYield10: [2, 2.02] })).cashOrRealRate.state === 'cash-dash', 'bundle with the real yield +2bp is the cash dash');
  ok(crossAssetVerdicts(history(dash), fred({ realYield10: [2, 2.2] })).cashOrRealRate.state === 'real-rate', 'bundle with the real yield +20bp (rate line) is the real-rate market');
  ok(crossAssetVerdicts(history({ ...dash, gold: [100, 103] }), fred({ realYield10: [2, 2.02] })).cashOrRealRate.state === null, 'gold rising with rates is not the cash dash');
  const noReal = crossAssetVerdicts(history(dash), null).cashOrRealRate;
  ok(noReal.bundle === true && noReal.state === null, 'without the real yield the bundle is named, the verdict is not');
  // The pair sentence no longer asserts which shock it was — that is the verdict's.
  const pair = buildCrossAssetRelations(history(dash)).breaks.find((item) => item.id === 'stocks-bonds-down');
  ok(pair && !/물가·금리 충격/.test(pair.text), 'stocks-bonds-down carries the fact, not the real-rate interpretation');

  // Rates × dollar.
  const rd = (tnx, dxy) => crossAssetVerdicts(history({ spx: [100, 100], tnx, dxy }), null).ratesDollar.state;
  ok(rd([4, 4.2], [100, 98]) === 'trust-loss', 'yields up + dollar down = trust loss');
  ok(rd([4.2, 4], [100, 98]) === 'joint-rally', 'yields down + dollar down = joint rally');
  ok(rd([4, 4.2], [100, 102]) === null, 'a dollar-up cell carries no named shape');

  // The kind of fall in the 10-year.
  const fall = (extra, hy) => crossAssetVerdicts(history({ spx: [100, 100], tnx: [4.2, 4], ...extra }), fred({ hyOas: hy })).rateFall.state;
  ok(fall({}, [3, 3.25]) === 'haven', 'HY +25bp (credit widen line) on a 10-year fall is the haven fall');
  ok(fall({ rut: [100, 97], rsp: [100, 97], vix: [15, 18] }, [3, 3.24]) === 'growth-scare', 'small caps and equal weight down, VIX +20%, HY +24bp = growth scare');
  ok(fall({ rut: [100, 102], rsp: [100, 102], vix: [15, 14] }, [3, 3.1]) === 'easing', 'small caps and equal weight up, VIX lower = easing');
  ok(fall({}, [3, 3.1]) === 'mixed', 'no leg passes: not split');
  ok(crossAssetVerdicts(history({ spx: [100, 100], tnx: [4, 4.05] }), null).rateFall.state === null, 'a 5bp move is not a fall');

  // Yen crosses: products of two closes on one date; a leg missing on the USD/JPY close date is missing.
  const yen = (spec, opts) => crossAssetVerdicts(history({ spx: [100, 100], tnx: [4, 4], usdjpy: [150, 144], ...spec }, opts), null).yen;
  ok(yen({ eurusd: [1.1, 1.12], audusd: [0.65, 0.65] }).state === 'dollar-weak', 'USD/JPY down with EUR/USD up = dollar weakness');
  const unwind = yen({ eurusd: [1.1, 1.09], audusd: [0.65, 0.65] });
  ok(unwind.state === 'carry-unwind', 'EUR/USD, EUR/JPY and AUD/JPY down = carry unwinding');
  ok(Math.abs(unwind.legs.eurjpy.value - ((1.09 * 144) / (1.1 * 150) - 1) * 100) < 1e-9, 'EUR/JPY is EUR/USD × USD/JPY on the same dates');
  ok(yen({ eurusd: [1.1, 1.09], audusd: [0.65, 0.68] }).state === 'yen-strong', 'AUD/JPY holding = yen strength not spreading to carry');
  const gap = yen({ eurusd: [1.1, 1.09], audusd: [0.65, 0.65] }, { dropLast: ['eurusd'] });
  ok(gap.legs.eurjpy === null && gap.legs.eurusd === null && gap.state === null, 'a missing EUR/USD on the anchor date leaves EUR/JPY and the verdict empty');

  // The bond response after a release, by sign as shown.
  ok(eventRateResponse({ dgs2: -10, dgs10: -5, breakeven10: -3, hyOas: -8, broad: 0.4 }).state === 'easing-accepted', 'all down + broad up = easing accepted');
  ok(eventRateResponse({ dgs2: -6, dgs10: 4, breakeven10: 2 }).state === 'trust-steepening', '2Y down, 10Y and BEI up = trust steepening');
  ok(eventRateResponse({ dgs2: 8, dgs10: 6, breakeven10: 2, realYield10: 4, dxy: 0.5 }).state === 'tightening-cycle', 'all up with the dollar = tightening cycle');
  ok(eventRateResponse({ dgs2: -10, dgs10: -5, breakeven10: -3, hyOas: null, broad: 0.4 }).state === null, 'a missing leg names no type');
  const { eventAftermath } = await load('src/domain/briefing/event-aftermath.js');
  const flows = history({ spx: [100, 100], ndx: [100, 100], xlp: [100, 100], xlu: [100, 100], xlv: [100, 100], rsp: [100, 101], rut: [100, 101], dxy: [100, 99] });
  const release = { publishedAt: `${days[20]}T18:00:00Z`, label: 'FOMC' };
  const plain = eventAftermath(flows, release);
  ok(plain && plain.rates === null, 'without the FRED history there is no rate response');
  const legsOn = (dates) => ({ schemaVersion: 'macro-history.v1', series: Object.fromEntries([['dgs2', [4, 3.9]], ['dgs10', [4.5, 4.45]], ['breakeven10', [2.3, 2.27]], ['hyOas', [3, 2.9]], ['realYield10', [2.2, 2.18]]].map(([key, [a, b]]) => [key, { observations: dates.map((date) => [date, date === plain.from ? a : b]) }])) });
  const full = eventAftermath(flows, release, { macroHistory: legsOn([plain.from, plain.to]) });
  ok(full.rates?.state === 'easing-accepted' && full.rates.legs.dgs2 === -10, `FRED legs on the base and end closes read easing accepted (${JSON.stringify(full.rates)})`);
  const lagged = eventAftermath(flows, release, { macroHistory: legsOn([plain.from, days[days.indexOf(plain.to) - 1]]) });
  ok(lagged.rates.legs.dgs2 === null && lagged.rates.state === null, 'a FRED leg not observed on the end close is not used');

  // The yen card's rule keeps its burden; the decomposition rides beside it and the dead sentence is gone.
  const { buildRatesFx } = await load('src/domain/macro/rates-fx.js');
  const carry = buildRatesFx({ history: history({ spx: [100, 100], usdjpy: [150, 144], eurusd: [1.1, 1.12], audusd: [0.65, 0.65] }) }).carry;
  ok(carry.burden === true && carry.decomposition?.state === 'dollar-weak' && !('text' in carry), 'carry: burden rule, decomposition verdict, no assembled sentence');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('unit-cases cross-asset: PASS');
}
