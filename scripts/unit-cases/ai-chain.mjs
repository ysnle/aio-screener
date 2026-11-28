// The AI 공급망 card on 테마와 섹터: which fall it is (orders × funding), each layer's estimates against its price and
// its last-quarter beats, the hyperscalers' quarterly capex pace and free-cash-flow turn, and one owner for the AI capex
// split (산업 지도). Facts and rule words only — not the card's look or its wording.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NOW = Date.parse('2026-11-28T00:00:00Z');
const SESSION = '2026-11-27';

export default async function run({ root, load, fail }) {
  const check = (ok, message, detail = '') => { if (!ok) fail(`${message}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); };
  const { HYPERSCALERS } = await load('src/domain/fundamental/quarterly-cashflow.js');
  const { hyperscalerQuarters, capexPace, fcfTurn } = await load('src/domain/themes/ai-capex-quarters.js');
  const { aiDemandRead, drawdownKind, aiOrderRows } = await load('src/domain/briefing/ai-demand-read.js');
  const { aiFundingChain } = await load('src/domain/themes/ai-funding-chain.js');
  const { aiLayerRead } = await load('src/domain/themes/ai-layer-read.js');

  // ── which fall it is ──
  const flow = (down, total = 4) => ({ groups: Array.from({ length: total }, (_, i) => ({ name: `g${i}` })), down1m: down });
  const tw = (yoy) => ({ state: 'ok', month: '2026-10', totalYoy: yoy, reported: 3, tableDate: '2026-11-10' });
  const capex = (yoy) => ({ complete: true, members: [...HYPERSCALERS], capexYoyPct: yoy, capexToOcfPct: 50, yearAgo: { capexToOcfPct: 50 }, endRange: ['2026-08-31', '2026-09-30'] });
  const chain = (credit, rates) => ({ links: [{ id: 'credit', state: credit }, { id: 'rates', state: rates }] });
  const priceOnly = aiDemandRead({ flow: flow(4), tw: tw(62.3), capex: capex(93.5), session: SESSION });
  check(priceOnly.side === 'priceOnly', 'orders up on both figures with most layers down is a fall in price only', priceOnly.side);
  check(drawdownKind({ demand: priceOnly, chain: chain('tighter', 'easier') }).kind === 'funding', 'orders holding while credit tightens is a funding- and discount-rate-led fall');
  check(drawdownKind({ demand: priceOnly, chain: chain('flat', 'easier') }).kind === 'price', 'orders holding with no funding link tightening is a fall in price only');
  check(drawdownKind({ demand: priceOnly, chain: chain(null, null) }).judged.length === 0, 'a link without a rule-decided state (researched rows only) is not judged');
  const turned = aiDemandRead({ flow: flow(4), tw: tw(-3), capex: capex(20), session: SESSION });
  check(['tighter', 'flat', null].every((state) => drawdownKind({ demand: turned, chain: chain(state, state) }).kind === 'demand'), 'a falling order figure is a demand-led fall whatever the funding says');

  // ── the hyperscalers' quarters ──
  const ends = ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];
  const monthEarlier = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  const issuers = (ocf, cap, drop = null) => HYPERSCALERS.map((symbol) => ({ symbol, group: 'hyperscaler',
    quarters: ends.map((end, i) => ({ end: symbol === 'ORCL' ? monthEarlier(end) : end, ocf: ocf[i], capex: cap[i], fcf: ocf[i] - cap[i] })).filter((q, i) => !(drop && drop.symbol === symbol && drop.index === i)) }));
  const bottoming = issuers([10, 10, 10, 10, 10, 10, 10, 14], [5, 5, 5, 5, 8, 8, 9, 6]);
  const series = hyperscalerQuarters(bottoming);
  check(series.length === 8 && series.at(-1).fcf === 8 * HYPERSCALERS.length && series.at(-1).endRange[0] === '2026-08-31', 'a quarter ending a month earlier (ORCL) is the same calendar quarter, summed over every member', series.at(-1));
  const gap = hyperscalerQuarters(issuers([10, 10, 10, 10, 10, 10, 10, 14], [5, 5, 5, 5, 8, 8, 9, 6], { symbol: 'GOOGL', index: 7 }));
  check(gap.length === 7 && gap.at(-1).end === '2026-06-30', 'a quarter one member has not reported is not summed');
  const turn = fcfTurn(series);
  check(turn.state === 'turned' && turn.ocfYoy === 40 && turn.capexYoy === 20, 'operating cash growing faster than capex with free cash flow above the quarter before is the bottom passed', turn);
  check(fcfTurn(hyperscalerQuarters(issuers([10, 10, 10, 10, 10, 10, 10, 11], [5, 5, 5, 5, 8, 8, 9, 10]))).state === 'notYet', 'capex growing faster than operating cash is not the bottom');
  check(capexPace(series).state === 'slowing' && capexPace(series).priorYoy === 80, 'the newest quarter growing less than the quarter before is a slowing pace', capexPace(series));
  const orderRows = aiOrderRows({ tw: tw(62.3), pace: capexPace(series) });
  check(orderRows.length === 2 && orderRows[1].record === '증가율 둔화' && orderRows.every((row) => row.asOf), 'the order column carries Taiwan revenue and the quarterly capex pace, each dated', orderRows.map((row) => row.said.text));
  const cashflow = { hyperscalers: { complete: true, members: [...HYPERSCALERS], endRange: ['2026-08-31', '2026-09-30'], ocf: 1, capex: 1, fcf: 0, capexToOcfPct: 50, yearAgo: { ocf: 1, capex: 1, fcf: 0, capexToOcfPct: 50 }, capexYoyPct: 0 }, issuers: bottoming };
  const cash = aiFundingChain({ cashflow, nowMs: NOW, researchLoadState: 'failed' }).links.find((link) => link.id === 'cash');
  check(cash.rows[1]?.id === 'fcf-quarter-group' && cash.rows[1].record === '바닥 통과' && cash.face.some((row) => row.id === 'fcf-quarter-group'), 'the cash link faces the quarterly free cash flow and its bottom word', cash.rows.map((row) => row.id));

  // ── layers: estimates against price, beats ──
  const themes = [{ id: 'semiconductor', subThemes: [{ name: 'L1', tickers: ['A', 'B', 'C', 'D'] }, { name: 'L2', tickers: ['E', 'F', 'G'] }, { name: 'L3', tickers: ['H', 'I', 'J'] }, { name: 'L4', tickers: ['K', 'L', 'M'] }] }];
  const est = (up, down, hist) => ({ asOf: '2026-11-27T03:00:00Z', fwd: { eps: 5, up4w: up, down4w: down }, trailing: { eps: 4 }, hist });
  const consensus = { rows: {
    A: est(3, 0, '2026-10:1.2:1.0'), B: est(4, 1, '2026-09:1:1.1'), C: est(0, 0, '2026-10:2:1.5'), D: est(2, 0, '2026-06:1:0.5'),
    E: est(0, 3, '2026-09:1:1.2'), F: est(0, 2, '2026-09:1:1.2'), G: est(1, 0, '2026-09:2:1'),
    H: est(5, 0, '2026-09:2:1'), I: est(5, 0, '2026-09:2:1'),
    K: est(3, 0, '2026-09:1:1.2'), L: est(3, 0, '2026-09:1:1.2'), M: est(3, 0, '2026-09:2:1') } };
  const rows = 'ABCDEFGHIJKLM'.split('').map((sym) => ({ sym, valuationPrice: 100, factorSessionDate: SESSION, ret1d: 1, ret1m: -10 }));
  const layerFlow = { groups: [['L1', -12], ['L2', -8], ['L3', -20], ['L4', 6]].map(([name, ret1m]) => ({ id: `semiconductor:${name}`, name, ret1m, measured: 3 })) };
  const layers = Object.fromEntries(aiLayerRead({ themes, rows, consensus, flow: layerFlow, now: NOW }).layers.map((layer) => [layer.name, layer]));
  check(layers.L1.tag === 'compression' && layers.L2.tag === 'damage', 'a falling layer with estimates rising is multiple compression; with estimates falling, earnings damage', [layers.L1.tag, layers.L2.tag]);
  check(layers.L3.tag === null && layers.L3.revisions.measured === 2, 'a layer with fewer than three measured members has no tag', layers.L3.revisions);
  check(layers.L4.tag === null, 'a rising layer has no compression or damage tag');
  check(layers.L1.beats.measured === 3 && layers.L1.beats.beat === 2 && layers.L1.beatTag === 'confirmed', 'a member whose newest quarter is older than the season is out of the beat denominator; a majority is confirmed', layers.L1.beats);
  check(layers.L4.beatTag === 'expected' && layers.L2.beatTag === null, 'estimates rising without a beat majority run on expectation; a minority with estimates falling has no word', [layers.L4.beatTag, layers.L2.beatTag]);

  // ── the card ──
  const { createFakeDocument } = await load('scripts/lib/fake-dom.mjs');
  const { CONSENSUS_KEY } = await load('src/data/consensus-estimates.js');
  const registry = await load('src/data/artifact-registry.js');
  const cardModule = await load('src/ui/components/ai-chain-flow.js');
  const rest = Array.from({ length: 10 }, (_, i) => `R${i}`);
  const cardRows = [...rows, ...rest.map((sym) => ({ sym, valuationPrice: 100, factorSessionDate: SESSION, ret1d: 0, ret1m: 0 }))].map((row) => ({ ...row, pctFromCloseHigh52w: -10 }));
  const cardRoot = { THEME_MAP: [...themes, { id: 'software', subThemes: [{ name: 'S', tickers: rest }] }], fetch: () => Promise.reject(new Error('offline')),
    AIO_ARCH: { getScreenerState: (key) => (key === 'rows' ? cardRows : key === 'metadata.factorSessionDateByMarket' ? { US: SESSION } : null) },
    [CONSENSUS_KEY]: { rows: Object.fromEntries(Object.entries(consensus.rows).map(([sym, row]) => [sym, { ...row, asOf: new Date().toISOString() }])) },
    [registry.TW_MONTHLY_REVENUE.key]: { schemaVersion: 'tw-monthly-revenue.v1', status: 'ok', latestMonth: '2026-10', tableDate: '2026-11-10', groups: [{ id: 'g', name: 'G', codes: ['1'] }], companies: [{ code: '1', group: 'g', month: '2026-10', revenue: 120, yearAgo: 100, prevMonth: 110 }] },
    [registry.BIGTECH_CASHFLOW.key]: { generatedAt: new Date().toISOString(), hyperscalers: { ...cashflow.hyperscalers, capexYoyPct: 30 }, issuers: bottoming } };
  cardRows.forEach((row) => { row.factorSessionDate = new Date().toISOString().slice(0, 10); });
  cardRoot.AIO_ARCH.getScreenerState = (key) => (key === 'rows' ? cardRows : key === 'metadata.factorSessionDateByMarket' ? { US: cardRows[0].factorSessionDate } : null);
  const doc = createFakeDocument({ ids: ['themes-ai-chain'] });
  cardModule.paintThemesAiChain(doc, cardRoot);
  const host = doc.getElementById('themes-ai-chain');
  const all = (node, out = []) => { for (const child of node.children || []) { out.push(child); all(child, out); } return out; };
  const nodes = all(host);
  const cls = (name) => nodes.filter((node) => String(node.className || '').split(/\s+/).includes(name));
  const inFold = (node) => { for (let at = node.parentNode; at; at = at.parentNode) if (at.tagName?.toLowerCase?.() === 'details') return true; return false; };
  check(/가격만 하락|조달·할인율 주도 하락/.test(cls('ai-chain__verdict')[0]?.textContent || ''), 'the card opens with which fall it is', cls('ai-chain__verdict')[0]?.textContent);
  check(cls('ai-chain__col').map((col) => col.children[0]?.textContent).join() === '가격,주문,자금', 'the body is three columns: price, orders, funding');
  check(cls('fall-bars').length === 0, 'the leaders-against-the-rest bars open the summary tab and are not repeated in the AI card');
  const table = cls('ai-chain__layers')[0];
  check(table && !inFold(table) && /배 → /.test(table.textContent) && /배수 압축/.test(table.textContent), 'the layer table carries the estimate tags and the PER pair, outside any fold', table?.textContent?.slice(0, 200));
  check(typeof cardModule.paintThemesLeaderFalls === 'function', 'the summary tab opens with the leaders against the rest');

  // ── one owner for the AI capex split ──
  const files = (dir) => readdirSync(dir).flatMap((name) => { const full = path.join(dir, name); return statSync(full).isDirectory() ? files(full) : [full]; });
  const importers = files(path.join(root, 'src/ui')).filter((file) => file.endsWith('.js') && /ai-capex-flow\.js'/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file).replace(/\\/g, '/'));
  check(importers.join() === 'src/ui/pages/atlas.js', 'only 산업 지도 draws the AI capex split', importers);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  await run({ root, load: (rel) => import(pathToFileURL(path.join(root, rel)).href), fail: (message) => { throw new Error(message); } });
  console.log('[unit-cases/ai-chain] ok');
}
