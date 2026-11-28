// Holding state on 포트폴리오: one trend definition, the thesis read through priced-in, and each open buy's plan (stop
// price against the close, R multiple). Invented holdings only.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function run({ root, load, fail }) {
  const { lotPlan, holdingPlan, holdingThesis, holdingTrendState } = await load('src/domain/portfolio/holding-state.js');
  const { buildPricedInRead } = await load('src/domain/fundamental/priced-in.js');
  const { thesisRows } = await load('src/ui/components/portfolio-checklist.js');
  const { buildPortfolioRead } = await load('src/domain/portfolio/portfolio-read.js');
  const { CONSENSUS_KEY } = await load('src/data/consensus-estimates.js');

  // Plan: a close under the stop written at the buy is 계획 무효; R = (close − entry) ÷ (entry − stop).
  const lot = (extra) => ({ id: 'a', symbol: 'ZZZA', date: '2026-10-01', side: 'buy', qty: 10, price: 100, stop: 90, currency: 'USD', note: '', ...extra });
  const under = lotPlan(lot(), { price: 85, date: '2026-11-27', currency: 'USD' });
  if (under.state !== 'void') fail(`v60.69 a close under the stop is 계획 무효, got ${under.state}`);
  if (under.r.toFixed(1) !== '-1.5') fail(`v60.69 R is (close − entry) ÷ (entry − stop): want -1.5, got ${under.r}`);
  const over = lotPlan(lot(), { price: 123, date: '2026-11-27', currency: 'USD' });
  if (over.state !== 'held' || over.r.toFixed(1) !== '2.3') fail(`v60.69 a close above the stop is 손절 가격 위 with R 2.3, got ${over.state} ${over.r}`);
  if (lotPlan(lot({ stop: null }), { price: 85 }).state !== 'no-stop') fail('v60.69 a buy without a stop has no plan state, not 무효');
  if (lotPlan(lot({ currency: 'KRW' }), { price: 85, currency: 'USD' }).r != null) fail('v60.69 a close in another currency is not compared with the lot');
  const two = holdingPlan([lot({ id: 'b', date: '2026-09-01', note: '먼저 적은 조건' }), lot({ id: 'c', date: '2026-10-05', stop: 80, note: '데이터센터 매출 둔화면 다시 본다' })], { price: 85, currency: 'USD' });
  if (two.state !== 'void' || two.condition?.text !== '데이터센터 매출 둔화면 다시 본다' || two.condition.date !== '2026-10-05') fail(`v60.69 the holding plan is void when any lot is, and its condition is the newest note: ${JSON.stringify(two)}`);

  // Thesis: the priced-in state, read as 논지 유지 (fall, estimates not cut) or 논지 훼손 (estimates being cut).
  const now = Date.parse('2026-11-28T00:00:00Z');
  const row = { sym: 'ZZZA', valuationPrice: 50, factorSessionDate: '2026-11-27', pctFromCloseHigh52w: -40, pctSma50: -20, pctSma200: -25, adrPct: 3, ret5d: -2 };
  const estimate = (up4w, down4w) => ({ sym: 'ZZZA', asOf: '2026-11-27T00:00:00Z', fwd: { eps: 4, up4w, down4w }, trailing: { eps: 3 } });
  for (const [up, down, want] of [[3, 1, 'kept'], [1, 4, 'damaged'], [2, 3, null]]) {
    const read = holdingThesis(row, estimate(up, down), { now });
    const pricedIn = buildPricedInRead(row, estimate(up, down), { now })?.state;
    if (read?.state !== want || read?.pricedIn !== pricedIn) fail(`v60.69 thesis for up ${up} down ${down} must be ${want} from priced-in ${pricedIn}, got ${JSON.stringify(read)}`);
  }

  // One trend definition: a close inside the 50-day near-line band is 판정 보류 in the holding table as in the book read.
  const near = { sym: 'ZZZB', pctSma50: -0.3, pctSma200: 6, adrPct: 2, ret5d: 0.5, valuationPrice: 20, factorSessionDate: '2026-11-27' };
  const surface = { rows: [{ symbol: 'ZZZA', listingSymbol: 'ZZZA', value: 600, currency: 'USD' }, { symbol: 'ZZZB', listingSymbol: 'ZZZB', value: 400, currency: 'USD' }] };
  const bySymbol = new Map([['ZZZA', row], ['ZZZB', near]]);
  const appRoot = { [CONSENSUS_KEY]: { rows: { ZZZA: estimate(2, 3), ZZZB: estimate(3, 1) } } };
  const closeOf = (symbol) => ({ price: bySymbol.get(symbol)?.valuationPrice, date: '2026-11-27' });
  const rows = thesisRows({ surface, root: appRoot, bySymbol, closeOf, openLots: [lot({ symbol: 'ZZZA', note: '매출 성장 20% 아래면 다시 본다' })], nowMs: now });
  const [a, b] = rows;
  if (b.trend?.state !== 'near' || b.signals.some((signal) => /50일선|추세/.test(signal))) fail(`v60.69 0.3% under the 50-day line inside the band is not a break: ${JSON.stringify(b)}`);
  const read = buildPortfolioRead({ surface, rows: [row, near] });
  if (!read.trendMix.find((mix) => mix.state === 'near')?.pct || holdingTrendState(near) !== b.trend.state) fail('v60.69 the holding table and the book read share the trend state');
  // A one-count down lead is not estimate cuts: no thesis signal when priced-in does not say 'confirmed'.
  if (a.signals.some((signal) => /하향|훼손/.test(signal))) fail(`v60.69 down 3 vs up 2 is below the revision floor, got ${a.signals.join(', ')}`);
  if (a.trend?.state !== 'down' || !a.signals.includes('하락 추세')) fail(`v60.69 a holding under both lines past the band reads 하락 추세: ${JSON.stringify(a)}`);
  if (a.plan?.state !== 'void' || !a.signals.includes('계획 무효') || a.plan.lots[0].r.toFixed(1) !== '-5.0') fail(`v60.69 the open buy at 100 with stop 90 against close 50 is 계획 무효 at -5.0R: ${JSON.stringify(a.plan)}`);
  if (a.condition?.text !== '매출 성장 20% 아래면 다시 본다' || b.condition !== null) fail('v60.69 the condition is the buy note; a holding without one is 조건 미기록');
  if (rows.some((r) => r.unknown.includes('50일선'))) fail('v60.69 the trend check is named 추세, one definition');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (message) => { throw new Error(message); } });
  console.log('portfolio-plan: ok');
}
