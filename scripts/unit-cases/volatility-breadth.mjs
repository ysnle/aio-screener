// Volatility and breadth: one module (src/domain/market/sentiment/volatility-state.js) reads the volatility complex — term
// structure, the S&P 500 move against the range the previous VIX implied, a retest of the index low against its VIX spike —
// and 투자 심리, 매크로, 시장 상태 read it; the 4% movers are ratios (src/domain/market/breadth/movers.js); the fall
// distribution counts S&P 500 members only; the rebound checks add bitcoin and oil with the 10-year. Facts in, state out.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ load, fail }) {
  const ok = (cond, msg) => { if (!cond) fail(msg); };
  const { isCloseSessionDate } = await load('src/domain/market/session/close-series.js');
  const days = [];
  for (let t = Date.parse('2025-06-02T12:00:00Z'); days.length < 300; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (isCloseSessionDate(date, 'US')) days.push(date);
  }
  const rows = (fn, n = days.length) => days.slice(0, n).map((date, i) => ({ date, ...fn(i) }));
  const vs = await load('src/domain/market/sentiment/volatility-state.js');

  // 1. The range is the previous session's VIX ÷ √252: 1.5% after a VIX 16 close is past one sd (1.01%) though inside the
  // same day's VIX 32 (2.02%); 2.5% is past two.
  const jump = (move) => rows((i) => ({ spx: i < 99 ? 5000 : 5000 * (1 + move / 100), vix: i < 99 ? 16 : 32, vix3m: 20 }), 100);
  const beyond = vs.volatilityState(jump(1.5))?.range;
  ok(beyond?.priorDate === days[98] && beyond.priorVix === 16 && beyond.state === 'beyond', `range reads the previous session's VIX: ${JSON.stringify(beyond)}`);
  ok(vs.volatilityState(jump(2.5))?.range?.state === 'outside' && vs.volatilityState(jump(0.9))?.range?.state === 'inside', 'range: past 2 sd is 범위 밖, within 1 sd 범위 안');

  // 2. One term-structure word: VIX ÷ 3-month 0.98 (flat) with the 9-day over VIX is 앞쪽 역전 on 투자 심리, 매크로 and the
  // 시장 상태 pair alike.
  const front = rows((i) => ({ spx: 5000 + (i % 3), vix: 20, vix3m: 20.4, vix9d: 21, vvix: 90 + (i % 7), move: 80 + (i % 5) }), 200);
  const term = vs.volatilityState(front)?.term;
  ok(term?.state === 'front' && term.label === vs.TERM_WORDS.front.label, `9-day over VIX under a flat ratio is the front inversion: ${JSON.stringify(term)}`);
  const { buildSentimentModel } = await load('src/domain/market/sentiment/sentiment-model.js');
  const card = buildSentimentModel({ history: front }).cards.find((row) => row.id === 'term');
  const { volatilityChapter } = await load('src/domain/macro/volatility.js');
  const chapter = volatilityChapter(front, []);
  const { crossReadings } = await load('src/domain/market/regime/cross-readings.js');
  const pair = crossReadings({ history: front }).find((row) => row.id === 'volatility-sentiment');
  ok(card?.state?.label === term.label && chapter?.mean.includes(term.label) && pair?.text.includes(term.label),
    `투자 심리, 매크로 and the pair name one term state: ${JSON.stringify({ card: card?.state, mean: chapter?.mean, pair: pair?.text })}`);
  const { volatilityStructure } = await load('src/domain/market/regime/depth-readouts.js');
  ok(volatilityStructure(front)?.term?.state === 'front', 'the depth row reads the same term state');

  // 3. A retest: a new S&P 500 closing low 10 sessions after the first one, VIX under the first low's spike → 비확인, with the
  // spike's date; VIX over it → 확인; a second low two sessions after the first is a slide, not a retest.
  const path2 = (second, vixAt2) => rows((i) => {
    const spx = i < 150 ? 5200 - i : i === 150 ? 4500 : i < second ? 4700 : i === second ? 4450 : 4600;
    const vix = i === 150 ? 30 : i === second ? vixAt2 : 18;
    return { spx, vix, vix3m: 20 };
  }, 170);
  const unconfirmed = vs.volatilityState(path2(160, 25))?.retest;
  ok(unconfirmed?.state === 'unconfirmed' && unconfirmed.date === days[160] && unconfirmed.spikeHigh.date === days[150] && unconfirmed.spikeHigh.value === 30 && unconfirmed.priorLow.date === days[150],
    `retest under the spike is VIX 비확인, dated to the spike: ${JSON.stringify(unconfirmed)}`);
  ok(vs.volatilityState(path2(160, 31))?.retest?.state === 'confirmed', 'retest with VIX over the spike is VIX 확인');
  ok(vs.volatilityState(path2(152, 25))?.retest == null, 'a second low two sessions after the first is not a retest');

  // 4. 4% movers as ratios: the 5-session ratio is the sum of risers over the sum of fallers; fallers summing to 0 has no
  // ratio; 극단 약세 needs the day's fallers over 10× the risers and the 5-session ratio under 0.5; 추력 risers ≥ 2× fallers.
  const mv = await load('src/domain/market/breadth/movers.js');
  const counts = (list) => rows((i) => ({ spx: 5000, breadthUp4: list[i]?.[0] ?? 10, breadthDown4: list[i]?.[1] ?? 10 }), list.length);
  const crash = mv.moverRatios(counts([[10, 10], [10, 10], [4, 20], [3, 30], [2, 40], [1, 50], [1, 60]]));
  ok(Math.abs(crash.windows[0].value - (3 + 2 + 1 + 1 + 4) / (30 + 40 + 50 + 60 + 20)) < 1e-12 && crash.state === 'extreme', `5-session ratio and 극단 약세: ${JSON.stringify(crash.windows)} ${crash.state}`);
  ok(mv.moverRatios(counts([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])).windows[0].value === null, 'no fallers in the window → no ratio (no division by zero)');
  ok(mv.moverRatios(counts([[10, 10], [10, 10], [10, 10], [10, 10], [30, 15]])).state === 'thrust', '추력: risers at least twice the fallers on the day');
  const { buildBreadthCards } = await load('src/ui/components/breadth-board.js');
  const mvCard = buildBreadthCards(counts([[5, 10], [5, 10], [5, 10], [5, 10], [5, 10], [20, 10]])).find((row) => row.id === 'mv');
  ok(Math.abs(mvCard.series.at(-1).value - 40 / 50) < 1e-12 && mvCard.refLines.join() === '0.5,1,2', `시장 폭 4% card is the 5-session ratio: ${JSON.stringify(mvCard.series.slice(-2))}`);

  // 5. The fall distribution counts S&P 500 members with a close on the session only: a non-member's fall is outside the
  // denominator, and the depth shares nest (-10 ≥ -20 ≥ -30 ≥ -50).
  const { stockFalls } = await load('src/domain/market/breadth/stock-falls.js');
  const session = days[299];
  const history = rows((i) => ({ spx: i === 299 ? 4995 : 5000, rsp: 100 }));
  const falls = [-5, -12, -12, -25, -35, -60, -11, -15, -40, -9];
  const members = Array.from({ length: 40 }, (_, k) => ({ sym: `M${k}`, sector: k % 2 ? 'Information Technology' : 'Energy' }));
  const screener = [...members.map((row, k) => ({ sym: row.sym, market: 'US', factorSessionDate: session, pctFromCloseHigh52w: falls[k % 10] })),
    ...Array.from({ length: 30 }, (_, k) => ({ sym: `X${k}`, market: 'US', factorSessionDate: session, pctFromCloseHigh52w: -70 }))];
  const dist = stockFalls({ rows: screener, members, history, session });
  const shares = dist?.depths.map((row) => row.share);
  ok(dist?.measured === 40 && shares.join() === [80, 40, 30, 10].join() && shares.every((value, i) => !i || value <= shares[i - 1]),
    `S&P 500 members only, nested depth shares: ${JSON.stringify({ measured: dist?.measured, shares })}`);
  ok(dist.state === 'masked' && dist.word === '지수 속 약세장', 'index within 1% of its high with 80% of members past -10% is 지수 속 약세장');
  ok(stockFalls({ rows: screener, members: [], history, session }) === null, 'no member list, no distribution');

  // 6. The rebound's bitcoin check reads bitcoin's close on the low's session and the latest one, never a neighbour's.
  const { reboundQualityOf } = await load('src/domain/market/story/rebound-quality.js');
  const low = days[200], through = days[205];
  const q = (btc) => reboundQualityOf({ state: 'attempt', low: { date: low } }, { history: rows((i) => ({ spx: 5000, ...(btc(i) == null ? {} : { btc: btc(i) }), wti: i === 200 ? 90 : 80, tnx: i === 200 ? 4.5 : 4.2 }), 206), through });
  const up = q((i) => 60000 + i);
  ok(up?.checks.find((row) => row.id === 'crypto')?.met === true && up.checks.find((row) => row.id === 'crossAsset')?.met === true, 'bitcoin higher and oil with the 10-year lower confirm');
  ok(q((i) => (i === 200 ? null : 60000 + i))?.checks.find((row) => row.id === 'crypto')?.met === null, 'no bitcoin close on the low session → unknown, not filled');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('unit-cases volatility-breadth: PASS');
}
