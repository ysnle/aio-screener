// The cause model (src/domain/market/day/day-cause.js): a release is put on the move only when the same session's
// yields went its way; an opinion, a rumour, a variable cited both ways and a headline riding a held release are no
// catalyst and no face report; a flat theme with one sub-theme against the rest is that sub-theme's move.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';

const D = '2026-10-14';
const px = (asset, change, unit = 'pct', date = D, label = asset) => ({ id: `price:${asset}:${date}`, kind: 'price', asset, label, date, change, unit, changeUnit: unit, materiality: 40, rank: 'major' });
const head = (id, title, wordTopics, more = {}) => ({ id, kind: 'headline', title, titleKo: `제목 ${id}`, date: D, rank: 'lead', materiality: 60, subjects: [], wordTopics, ...more });
const cpi = { id: 'release:cpi', kind: 'release', label: 'CPI', date: D, actual: 0.4, forecast: 0.3, unit: '%', topics: ['macro', 'inflation'] };

function ledger({ tnx = -5, dgs2 = -4, dgs2Date = D, extra = [], links = [] } = {}) {
  const facts = [px('spx', -1.2, 'pct', D, 'S&P 500'), px('tnx', tnx, 'bp', D, '미국 10년 금리'), px('dgs2', dgs2, 'bp', dgs2Date, '미국 2년 금리'), cpi,
    { id: `stock:MU:${D}`, kind: 'stock-move', subjects: ['MU'], label: 'Micron', date: D, change: -6, indexBp: -4, materiality: 50, rank: 'lead' },
    { id: `stock:NVDA:${D}`, kind: 'stock-move', subjects: ['NVDA'], label: 'Nvidia', date: D, change: -3, indexBp: -22, materiality: 55, rank: 'lead' }, ...extra];
  return { sessions: { us: D }, facts, links, indexSplit: { date: D, coverage: 99, total: -1.2, sectors: [{ sector: 'Technology', weight: 33, contribution: -0.9, change: -2.7 }, { sector: 'Energy', weight: 3, contribution: 0.02, change: 0.6 }] } };
}
const toSpx = (id) => ({ from: id, to: `price:spx:${D}`, basis: 'topic' });

export default async function run({ load, fail }) {
  const { dayCause, sessionCatalysts, sessionDivergences } = await load('src/domain/market/day/day-cause.js');
  const { buildDayAccount } = await load('src/domain/briefing/day-account.js');

  // 1. A hot CPI with the 2- and 10-year both lower: held, and the sector that carried the fall is the other candidate.
  const heads = [head('h-cpi', 'Stocks fall after hotter-than-expected CPI', ['inflation']), head('h-oil-up', 'Stocks slide as oil prices rise', ['energy']),
    head('h-oil-down', 'Wall Street drops as crude slides', ['energy']), head('h-says', 'Nvidia CEO says AI demand is insatiable in interview', ['ai-semis'], { subjects: ['NVDA'] }),
    head('h-plain', 'Micron cuts memory outlook', ['earnings'], { subjects: ['MU'] })];
  const links = [...['h-cpi', 'h-oil-up', 'h-oil-down'].map(toSpx), { from: 'h-says', to: `stock:NVDA:${D}`, basis: 'subject' }, { from: 'h-plain', to: `stock:MU:${D}`, basis: 'subject' }];
  const cold = ledger({ extra: heads, links });
  const model = dayCause(cold, D);
  const release = model.candidates.find((row) => row.kind === 'release');
  if (release?.result !== 'held' || release.reason !== 'rates-against') fail(`hot CPI with both yields lower must be held as rates-against, got ${release?.result}/${release?.reason}`);
  if (release.checks[0].legs.map((leg) => leg.asset).join() !== 'tnx,dgs2') fail('the rates check reads the 10-year and the 2-year of the release session');
  if (release.alternative?.id !== 'sector:Technology') fail(`a held release names the sector that carried the fall, got ${release.alternative?.id}`);

  // 2. The catalysts (the 오늘 face line) drop the headline riding the held release, the variable cited both ways and the
  //    interview remark; the plain report stays.
  const picked = sessionCatalysts(cold, D, { max: 9 }).items.map((item) => item.id);
  if (picked.join() !== 'h-plain') fail(`catalysts must be only the attributed headline, got ${picked.join()}`);
  const byId = new Map(model.candidates.map((row) => [row.id, row]));
  const expect = { 'h-cpi': ['held', 'release-held'], 'h-oil-up': ['excluded', 'two-way'], 'h-oil-down': ['excluded', 'two-way'], 'h-says': ['held', 'opinion'], 'h-plain': ['attributed', 'reported'] };
  for (const [id, [result, reason]] of Object.entries(expect)) if (byId.get(id)?.result !== result || byId.get(id)?.reason !== reason) fail(`${id}: want ${result}/${reason}, got ${byId.get(id)?.result}/${byId.get(id)?.reason}`);

  // 3. The falsifier: yields up with the hot print attribute it; a 2-year of another day is no leg (no neighbour value).
  const hot = dayCause(ledger({ tnx: 6, dgs2: 5, dgs2Date: '2026-10-13' }), D).candidates.find((row) => row.kind === 'release');
  if (hot?.result !== 'attributed' || hot.checks[0].legs.length !== 1) fail('yields up on a hot print attribute the move, and the 2-year of another day is left out');
  if (!/^10\/14 CPI 0\.4%\(예상 0\.3%\), 미국 10년 금리 \+6bp$/.test(hot.said.text)) fail(`release figures with the 10-year only, got "${hot.said.text}"`);
  // One oil headline alone is one-way and stays a catalyst.
  const oneWay = ledger({ tnx: 6, extra: [head('h-oil-up', 'Stocks slide as oil prices rise', ['energy'])], links: [toSpx('h-oil-up')] });
  if (sessionCatalysts(oneWay, D).items[0]?.id !== 'h-oil-up') fail('a variable cited one way is still a catalyst');

  // 4. A flat chip theme with memory alone down is memory's move, not the theme's; same-sign parts are the theme's.
  const theme = (parts, change = -0.2) => ({ id: `group:theme:semiconductor:${D}`, kind: 'group-move', group: 'theme:semiconductor', label: '반도체', date: D, change, rank: 'minor', materiality: 20, members: [], leaders: [], parts });
  const lone = dayCause(ledger({ extra: [theme([{ name: '메모리', change: -3.1 }, { name: '비메모리', change: 0.8 }, { name: 'AI 수요처', change: 0.5 }])] }), D).candidates.find((row) => row.kind === 'group');
  if (lone?.reason !== 'part-only' || lone.checks[0].part !== '메모리') fail(`flat theme with one sub-theme against the rest is part-only, got ${lone?.reason}`);
  const spread = dayCause(ledger({ extra: [theme([{ name: '메모리', change: -3.1 }, { name: '비메모리', change: -0.8 }])] }), D).candidates.find((row) => row.kind === 'group');
  if (spread) fail('a minor theme whose parts all fell is no cause candidate');

  // 5. The divergence rows are the model's: the hot-print/10-year row still fires with both figures.
  if (sessionDivergences(cold, D).map((row) => row.id).join() !== 'hot-inflation-yields-down') fail('the divergence rows come from the cause model unchanged');

  // 6. A held headline is never a move's face report (브리핑·오늘 관련 보도).
  const face = ledger({ extra: [head('h-rumor', 'Nvidia shares fall on report it may be considering a deal', ['ai-semis'], { subjects: ['NVDA'], titleKo: '엔비디아 하락, 인수 검토 중인 것으로 알려졌다', at: `${D}T15:00:00Z` })],
    links: [{ from: 'h-rumor', to: `stock:NVDA:${D}`, basis: 'subject' }] });
  face.facts.find((fact) => fact.id === `stock:NVDA:${D}`).explainedBy = ['subject'];
  const story = buildDayAccount(face).stories.find((row) => row.id === `story:stock:NVDA:${D}`);
  if (!story) fail('the NVDA move is told as a story');
  if (story.report) fail(`an unconfirmed report is not the move's face report, got "${story.report.title}"`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  await run({ root, load: (rel) => import(pathToFileURL(resolve(root, rel)).href), fail: (msg) => { throw new Error(msg); } });
  console.log('day-cause: ok');
}
