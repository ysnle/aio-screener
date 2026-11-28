// 매크로 chapter rules: the funding plumbing (SOFR − IORB, the Treasury account's source), the labour slowdown ladder and
// the unemployment-rate split, the inflation-expectations anchor, the credit spread's reach down the rating ladder and the
// oil-and-rates shock kind. Facts in, fixed state word out; the sentences are the AI reading's.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ load, fail }) {
  const ok = (cond, msg) => { if (!cond) fail(msg); };
  const { resolveMarketCalendarSession } = await load('src/domain/market/session/market-calendar.js');
  const sessions = (from, n) => {
    const out = [];
    for (let t = Date.parse(`${from}T12:00:00Z`); out.length < n; t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') out.push(date);
    }
    return out;
  };
  const mhOf = (series) => ({ schemaVersion: 'macro-history.v1', series });
  const obs = (dates, fn, unit = 'percent') => ({ unit, observations: dates.map((date, i) => [date, fn(i, dates.length - 1)]) });

  // ── Funding plumbing ──
  const { plumbingRead, tgaSource } = await load('src/domain/macro/funding-plumbing.js');
  const days = sessions('2026-09-01', 30);
  const gauge = (tail) => plumbingRead(mhOf({ sofr: obs(days, (i, last) => 3.9 + (tail[i - (last - tail.length + 1)] ?? 0) / 100), iorb: obs(days, () => 3.9) }));
  ok(gauge([1, 2]).state === 'tension', 'plumbing: SOFR above IORB two observations in a row is 긴장');
  ok(gauge([6, 6]).state === 'stress', 'plumbing: 5bp or more two observations in a row is 스트레스');
  ok(gauge([0, 6]).state === 'calm', 'plumbing: a one-day spike is not held (안정)');
  const noIorb = plumbingRead(mhOf({ sofr: obs(days, () => 4.05), fedTargetUpper: obs(days, () => 4), fedTargetLower: obs(days, () => 3.75) }));
  ok(noIorb.state === 'unknown' && noIorb.spread === null, 'plumbing: without a same-date IORB the gauge is 확인 불가, never inferred from the target range');
  const offDate = plumbingRead(mhOf({ sofr: obs(days, (i, last) => (i === last ? 4.2 : 3.9)), iorb: obs(days.slice(0, -1), () => 3.9) }));
  ok(offDate.spread.date === days.at(-2) && offDate.spread.bp === 0, 'plumbing: SOFR − IORB pairs only same-date observations');

  const weeks = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 8, 2) + i * 7 * 86400000).toISOString().slice(0, 10));
  const tank = (tga, rrp, reserves) => mhOf({ treasuryAccount: obs(weeks, (i, last) => (i === last ? tga : 800) * 1000, 'usd-millions'),
    reverseRepo: obs(weeks, (i, last) => (i === last ? rrp : 600), 'usd-billions'), reserves: obs(weeks, (i, last) => (i === last ? reserves : 3000) * 1000, 'usd-millions') });
  // 2023 refill (TGA +501, RRP −505, reserves −39 $bn) is a swap, not an absorption.
  ok(tgaSource(tank(1301, 95, 2961)).kind === 'swap', 'TGA source: a build paid by the reverse repo is 자리바꿈');
  ok(tgaSource(tank(1300, 590, 2550)).kind === 'absorb', 'TGA source: a build paid by reserves is 흡수');
  ok(tgaSource(tank(850, 590, 2950)).kind === null, 'TGA source: a build inside the net-liquidity flat band has no source word');
  const risk = (rrpLevel) => plumbingRead(mhOf({ treasuryAccount: obs(weeks, (i, last) => (i === last ? 950 : 800) * 1000, 'usd-millions'), reverseRepo: obs(sessions('2026-09-01', 40), () => rrpLevel, 'usd-billions') })).riskWeek;
  ok(risk(5) === true && risk(50) === false, 'plumbing: a $150bn Treasury-account week is a risk week only with the reverse repo under $10bn');

  // ── Labour ladder and unemployment split ──
  const { laborLadder, unemploymentSplit } = await load('src/domain/macro/labor-ladder.js');
  const months = Array.from({ length: 26 }, (_, i) => new Date(Date.UTC(2024, 8 + i, 1)).toISOString().slice(0, 10));
  const monthly = (fn) => ({ unit: 'thousands', observations: months.map((date, i) => [date, fn(i)]) });
  const base = { jobOpenings: monthly((i) => 8000 - i * 20), hourlyEarnings: monthly((i) => 30 * 1.004 ** Math.min(i, 13) * 1.002 ** Math.max(0, i - 13)), jobHires: monthly((i) => 5500 - i * 10), jobLayoffs: monthly(() => 1600) };
  ok(laborLadder(mhOf(base)).stage === 3, 'ladder: openings, hiring and wage growth down with layoffs flat is stage 3');
  ok(laborLadder(mhOf({ ...base, jobOpenings: monthly((i) => 7000 + i * 20) })).stage === 0, 'ladder: wage growth slowing while openings rise is before stage 1 (steps run in order)');
  ok(laborLadder(mhOf({ ...base, jobLayoffs: monthly((i) => 1500 + i * 15) })).stage === 5, 'ladder: JOLTS layoffs rising on the year is stage 5');
  ok(laborLadder(mhOf({})).state === 'unknown', 'ladder: no series, no stage');

  const pair = (a, b) => ({ observations: [[months.at(-2), a], [months.at(-1), b]] });
  const split = unemploymentSplit(mhOf({ unemployed: pair(7000, 7300), laborForce: pair(170000, 171500), unemployment: pair(4.1, 4.3), reentrants: pair(1500, 1600) }));
  const exact = (7300 / 171500 - 7000 / 170000) * 100;
  ok(Math.abs(split.numeratorPp + split.denominatorPp - exact) < 1e-9 && Math.abs(split.changePp - split.publishedPp) <= 0.1 + 1e-9, 'split: the two legs add up to the rate change of the same two months (published rates round to 0.1)');
  ok(split.kind === 'entry', 'split: a rise with the labour force and re-entrants up is 참여 늘며 상승');
  ok(unemploymentSplit(mhOf({ unemployed: pair(7300, 7000), laborForce: pair(171500, 170000) })).kind === 'exit', 'split: a fall with the labour force shrinking is 이탈하며 하락');
  ok(unemploymentSplit(mhOf({ unemployed: pair(7000, 7300), laborForce: { observations: [[months.at(-3), 170000], [months.at(-2), 171500]] } })) === null, 'split: legs of different months are not split');

  // ── Expectations anchor ──
  const { expectationsAnchor } = await load('src/domain/macro/expectations-anchor.js');
  const daily = sessions('2026-08-03', 30);
  const market = (b) => obs(daily, (i, last) => (i >= last - 20 ? 2.3 + (b / 100) * (i - (last - 20)) / 20 : 2.3));
  const surveyRows = (pre, before, now) => ({ observations: [['2017-06-01', pre], ['2026-07-01', before], ['2026-08-01', now]] });
  ok(expectationsAnchor(mhOf({ fiveYearForward: market(15), michInflation5y: surveyRows(2.6, 3.2, 3.4) })).state === 'watch', 'anchor: market and survey both rising is 탈앵커링 감시');
  ok(expectationsAnchor(mhOf({ fiveYearForward: market(15), michInflation5y: surveyRows(2.6, 3.4, 3.3) })).state === 'one', 'anchor: the market leg alone is not 감시');
  ok(expectationsAnchor(mhOf({ breakeven10: market(2), michInflation5y: surveyRows(2.6, 2.3, 2.5) })).state === 'anchored', 'anchor: a survey rise inside its pre-pandemic range does not count');
  ok(expectationsAnchor(mhOf({ fiveYearForward: market(15) })).state === 'unknown', 'anchor: without the survey there is no anchor state');

  // ── Credit reach down the ladder ──
  const { creditContagion } = await load('src/domain/briefing/credit-reading.js');
  const oas = sessions('2026-08-03', 30);
  const tier = (a, moveBp, dates = oas) => ({ observations: dates.map((date, i) => [date, i >= dates.length - 21 ? a + moveBp / 100 * (i - (dates.length - 21)) / 20 : a]) });
  const ladder = (moves, igDates) => creditContagion(mhOf({ igOas: tier(0.9, moves.ig, igDates), bbOas: tier(2, moves.bb), bOas: tier(3.2, moves.b), cccOas: tier(9, moves.ccc) }));
  ok(ladder({ ig: 0, bb: 0, b: 0, ccc: 120 }).state === 'selective', 'credit: CCC widening alone is 선별');
  ok(ladder({ ig: 0, bb: 20, b: 40, ccc: 120 }).state === 'contagion', 'credit: B and BB following is 전염');
  ok(ladder({ ig: 10, bb: 20, b: 40, ccc: 120 }).state === 'broad', 'credit: investment grade joining is 시장 전체');
  ok(ladder({ ig: 0, bb: 0, b: 0, ccc: 30 }).state === 'quiet', 'credit: CCC under its floor is 조용');
  ok(ladder({ ig: 0, bb: 0, b: 0, ccc: 120 }, oas.slice(0, -1)) === null, 'credit: a tier on another end date gives no state');

  // ── Oil and rates rising together ──
  const { oilShockKind, buildMacroChapters } = await load('src/domain/macro/macro-chapters.js');
  ok(oilShockKind({ oil20: 8, ten20Bp: 15, be20Bp: 2, coreUp: false, laborStage: 1 }) === 'supply', 'oil: core steady, breakeven fixed, labour slowing is 공급 충격');
  ok(oilShockKind({ oil20: 8, ten20Bp: 15, be20Bp: 12, laborStage: 1 }) === 'spread' && oilShockKind({ oil20: 8, ten20Bp: 15, be20Bp: 0, coreUp: true }) === 'spread', 'oil: breakeven past the line or core re-accelerating is 물가 확산');
  ok(oilShockKind({ oil20: 8, ten20Bp: 5, be20Bp: 0, laborStage: 3 }) === null, 'oil: the rule reads only oil and the 10-year rising together');

  // ── Structure: the liquidity cards are the 자금 배관 chapter; the ladder notes left the scenario reference text ──
  const { buildLiquidityGrowthGroups } = await load('src/domain/macro/liquidity-growth.js');
  const mh = mhOf({ sofr: obs(days, () => 3.95), reverseRepo: obs(days, () => 0.4, 'usd-billions'), fedBalanceSheet: obs(weeks, () => 6.7e6, 'usd-millions'), treasuryAccount: obs(weeks, () => 9e5, 'usd-millions') });
  const chapter = buildMacroChapters({ macroHistory: mh }).chapters.find((row) => row.id === 'plumbing');
  ok(chapter?.verdicts?.[0]?.label === '확인 불가' && !buildLiquidityGrowthGroups(mh).some((group) => group.id === 'liquidity'), 'structure: 자금 배관 chapter with a verdict replaces the liquidity card group');
  const { BRANCH_NOTES } = await load('src/domain/market/regime/macro-crossroads.js');
  ok(!BRANCH_NOTES.slowdown.checks.some((text) => /노동 둔화 단계|재진입자/.test(text)), 'structure: the ladder is a rule, not a scenario reference note');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('unit-cases macro-chapters: PASS');
}
