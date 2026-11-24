#!/usr/bin/env node
// scripts/ci-capital-flows-contract-check.mjs — 산업 지도 › AI 지도 자본순환
//
// public-data/atlas/capital-flows.json (ai-capital-flows.v1) carries dated deals between AI companies — equity, debt,
// guarantees, purchase and cloud commitments, supply, leases — with their amounts. It is a file of its own beside the
// atlas reference set: the atlas files are role references with no current claim (RULES R433, ci-atlas-contract-check),
// this one is dated facts, so it answers to its own contract:
//   - schemaVersion ai-capital-flows.v1, reviewedAt a date, a boundary sentence, nodes and edges arrays;
//   - a listed node's id is exactly a symbol of public-data/us-listings.json or public-data/company-profiles/index.json
//     (no guessed ticker); an unlisted one starts with '@'; ids are unique;
//   - every edge names two nodes, a kind of equity|debt|guarantee|purchase|cloud-commit|supply|lease, a sourceKind of
//     filing|company|report, an announced date, and at least one source with an https url, a publisher and a date;
//   - an edge that is not filing or company (reports only) has status '보도';
//   - an amount carries its unit and amountBasis;
//   - no rating or trading word (수혜, 매수, 매도, 추천 …) in any reader-facing text;
//   - a reviewedAt older than 180 days is not a failure: the map then shows 기준일 지남, which this gate proves on the
//     domain view and the renderer;
//   - the focus view puts a deal on the payee's side (a guarantee also on its obligor's), sorts dollars by size with a bar
//     and GW without one, and names the counterparties on both sides; a value-chain layer lists every higher layer it supplies.
// No file passes (reported as absent); the map is then left out of the screen. The domain rules live in
// src/domain/knowledge/ai-map.js, shared with the screen, so the screen and this gate cannot disagree on an edge.
//
//   node scripts/ci-capital-flows-contract-check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPITAL_FLOWS_SCHEMA, CAPITAL_STALE_DAYS, capitalBannedWordHits, capitalCompanies, capitalEdgeProblems, capitalFlowsStale, capitalFlowsView, capitalFocus, layerUpwardSupply
} from '../src/domain/knowledge/ai-map.js';
import { isIsoDay } from '../src/domain/shared/session-date.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'public-data/atlas/capital-flows.json';
const read = (file) => readFileSync(join(root, file), 'utf8');

/** Every problem with one capital-flows document. `isListed(id)` answers whether a symbol is in the listing registry. */
export function capitalFlowsProblems(doc, isListed) {
  const problems = [];
  if (!doc || typeof doc !== 'object') return ['not a JSON object'];
  if (doc.schemaVersion !== CAPITAL_FLOWS_SCHEMA) problems.push(`schemaVersion '${doc.schemaVersion}' is not ${CAPITAL_FLOWS_SCHEMA}`);
  if (!isIsoDay(String(doc.reviewedAt || '').slice(0, 10))) problems.push('reviewedAt is not a date');
  if (!String(doc.boundary || '').trim()) problems.push('boundary is empty');
  if (!Array.isArray(doc.nodes)) problems.push('nodes is not an array');
  if (!Array.isArray(doc.edges)) problems.push('edges is not an array');
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
  const seen = new Set();
  for (const node of nodes) {
    const id = String(node?.id || '');
    if (!id) { problems.push('node without id'); continue; }
    if (seen.has(id)) problems.push(`node ${id}: duplicate id`);
    seen.add(id);
    if (!String(node.name || '').trim()) problems.push(`node ${id}: no name`);
    if (typeof node.listed !== 'boolean') problems.push(`node ${id}: listed is not true/false`);
    if (id.startsWith('@')) { if (node.listed === true) problems.push(`node ${id}: an '@' id is unlisted, but listed is true`); }
    else if (node.listed !== true) problems.push(`node ${id}: an unlisted company takes an '@' id`);
    else if (!isListed(id)) problems.push(`node ${id}: not a symbol in us-listings.json or company-profiles/index.json (exact match, no guessed ticker)`);
  }
  const edgeIds = new Set();
  for (const edge of Array.isArray(doc.edges) ? doc.edges : []) {
    if (edge?.id && edgeIds.has(edge.id)) problems.push(`${edge.id}: duplicate edge id`);
    if (edge?.id) edgeIds.add(edge.id);
    problems.push(...capitalEdgeProblems(edge, seen));
  }
  problems.push(...capitalBannedWordHits(doc).map((hit) => `rating or trading word ${hit}`));
  return problems;
}

// ── self-test: the rules catch each broken form and pass a well-formed file ──────────────────────────────────────────
const LISTED = new Set(['NVDA', 'MSFT', 'ORCL', '005930.KS']);
const listed = (id) => LISTED.has(id);
const good = () => ({
  schemaVersion: CAPITAL_FLOWS_SCHEMA, reviewedAt: '2026-11-19', boundary: '공시·회사 발표·보도로 확인한 거래만 싣는다.',
  nodes: [{ id: 'NVDA', name: 'NVIDIA', listed: true, role: '가속기 설계' }, { id: '@OpenAI', name: 'OpenAI', listed: false, role: '모델 개발' }, { id: 'ORCL', name: 'Oracle', listed: true, role: '클라우드' }],
  edges: [
    { id: 'e1', from: 'NVDA', to: '@OpenAI', kind: 'equity', what: '지분 투자 약정', amount: 100, unit: 'USD bn', amountBasis: '최대 약정액', announced: '2026-09-22', status: '약정', sourceKind: 'company', sources: [{ publisher: 'NVIDIA', title: 'press', url: 'https://example.com/a', date: '2026-09-22' }] },
    { id: 'e2', from: '@OpenAI', to: 'ORCL', kind: 'cloud-commit', what: '클라우드 용량 계약', announced: '2026-09-10', status: '보도', sourceKind: 'report', sources: [{ publisher: 'Paper', title: 'report', url: 'https://example.com/b', date: '2026-09-10' }] }
  ]
});
const mutate = (fn) => { const doc = good(); fn(doc); return doc; };
const cases = [
  ['well-formed passes', capitalFlowsProblems(good(), listed).length === 0],
  ['wrong schema', capitalFlowsProblems(mutate((d) => { d.schemaVersion = 'x'; }), listed).length === 1],
  ['source without https', capitalFlowsProblems(mutate((d) => { d.edges[0].sources[0].url = 'http://example.com/a'; }), listed).some((p) => /https/.test(p))],
  ['source without date', capitalFlowsProblems(mutate((d) => { delete d.edges[0].sources[0].date; }), listed).some((p) => /no date/.test(p))],
  ['edge without source', capitalFlowsProblems(mutate((d) => { d.edges[0].sources = []; }), listed).some((p) => /no source/.test(p))],
  ['guessed ticker', capitalFlowsProblems(mutate((d) => { d.nodes[0].id = 'NVDAX'; d.edges[0].from = 'NVDAX'; }), listed).some((p) => /not a symbol/.test(p))],
  ['unlisted without @', capitalFlowsProblems(mutate((d) => { d.nodes[1].id = 'OpenAI'; d.edges.forEach((e) => { if (e.from === '@OpenAI') e.from = 'OpenAI'; if (e.to === '@OpenAI') e.to = 'OpenAI'; }); }), listed).some((p) => /'@' id/.test(p))],
  ['report not marked 보도', capitalFlowsProblems(mutate((d) => { d.edges[1].status = '계약'; }), listed).some((p) => /보도/.test(p))],
  ['amount without unit', capitalFlowsProblems(mutate((d) => { delete d.edges[0].unit; }), listed).some((p) => /unit/.test(p))],
  ['amount without basis', capitalFlowsProblems(mutate((d) => { delete d.edges[0].amountBasis; }), listed).some((p) => /amountBasis/.test(p))],
  ['unknown kind', capitalFlowsProblems(mutate((d) => { d.edges[0].kind = 'investment'; }), listed).some((p) => /kind/.test(p))],
  ['rating word', capitalFlowsProblems(mutate((d) => { d.nodes[0].role = '최대 수혜 기업'; }), listed).some((p) => /rating/.test(p))],
  ['trading word', capitalFlowsProblems(mutate((d) => { d.edges[0].what = '매수 기회'; }), listed).some((p) => /rating/.test(p))],
  ['edge to a missing node', capitalFlowsProblems(mutate((d) => { d.edges[0].to = '@Nobody'; }), listed).some((p) => /not a node/.test(p))],
  ['stale is shown, not failed', capitalFlowsProblems(mutate((d) => { d.reviewedAt = '2026-01-01'; }), listed).length === 0 && capitalFlowsView(mutate((d) => { d.reviewedAt = '2026-01-01'; }), { today: '2026-11-19' })?.stale === true],
  ['fresh is not stale', capitalFlowsView(good(), { today: '2026-11-19' })?.stale === false && capitalFlowsStale('2026-05-24', '2026-11-19') === false && capitalFlowsStale('2026-05-22', '2026-11-19') === true],
  ['no edges → no map', capitalFlowsView(mutate((d) => { d.edges = []; }), { today: '2026-11-19' }) === null && capitalFlowsView(null) === null]
];
// The focus view (capitalFocus) and the value chain's upward supply per layer (layerUpwardSupply): sides, order, bars, both sides.
const deal = (id, from, to, kind, amount, unit, extra = {}) => ({ id, from, to, kind, what: id, amount, unit, amountBasis: '약정액', announced: '2026-01-01', status: '계약 체결', sourceKind: 'filing', sources: [{ publisher: 'SEC', url: `https://example.com/${id}`, date: '2026-01-01' }], ...extra });
const ring = {
  ...good(),
  nodes: [...good().nodes, { id: 'MSFT', name: 'Microsoft', listed: true, role: 'cloud' }],
  edges: [
    deal('a', 'NVDA', '@OpenAI', 'equity', 100, 'usd-bn'), deal('b', '@OpenAI', 'NVDA', 'purchase', 10, 'gw'),
    deal('c', '@OpenAI', 'ORCL', 'cloud-commit', 300, 'usd-bn'), deal('d', '@OpenAI', 'MSFT', 'cloud-commit', 30, 'usd-bn'),
    deal('e', 'MSFT', 'ORCL', 'guarantee', 5, 'usd-bn', { onBehalfOf: '@OpenAI' })
  ]
};
const ringView = capitalFlowsView(ring, { today: '2026-11-19' });
const openai = capitalFocus(ringView, null);
const oracle = capitalFocus(ringView, 'ORCL');
const ids = (rows) => rows.map((row) => row.edge.id).join(',');
const flows = layerUpwardSupply({ links: [{ id: '1-2', from: 1, to: 2, count: 3, pairs: [] }, { id: '1-5', from: 1, to: 5, count: 7, pairs: [] }, { id: '3-2', from: 3, to: 2, count: 1, pairs: [] }] });
cases.push(
  ['focus defaults to the company in most deals', openai?.focus.id === '@OpenAI' && capitalCompanies(ringView)[0].id === '@OpenAI'],
  ['a guarantee counts for its obligor, seen from both ends', ids(openai.incoming) === 'a,e' && openai.incoming[1].other?.role === 'beneficiary' && openai.incoming[1].other.node.id === 'ORCL' && ids(oracle.incoming) === 'c,e' && oracle.incoming[1].other?.role === 'obligor' && oracle.incoming[1].other.node.id === '@OpenAI'],
  ['dollars by size, GW after, bar only for dollars', ids(openai.outgoing) === 'c,d,b' && openai.outgoing.map((row) => row.share).join(',') === '1,0.1,'],
  ['both sides are the counterparties on each side', openai.bothSides.map((node) => node.id).sort().join(',') === 'MSFT,NVDA' && openai.outgoing.find((row) => row.edge.id === 'c').bothSides === false && openai.incoming[0].bothSides === true],
  ['value chain: each layer supplies every higher layer, most first; downward apart', (flows.up.get(1) || []).map((link) => link.id).join(',') === '1-5,1-2' && !flows.up.has(3) && flows.down.map((link) => link.id).join(',') === '3-2']
);
const failures = cases.filter(([, ok]) => !ok).map(([name]) => `self-test: ${name}`);

// The renderer, mounted on the offline document: the head names the review date, a stale file shows 기준일 지남, a
// reports-only deal carries the word 보도, and no publisher sits on a deal's figure line (providers are hover and the
// 데이터 출처 fold). The atlas page reads this file on its own, through the same view.
{
  const { createFakeDocument } = await import('./lib/fake-dom.mjs');
  const { renderAiMap } = await import('../src/ui/knowledge/ai-map-view.js');
  const mount = (doc, node = null) => renderAiMap(createFakeDocument(), { selection: { map: 'capital', node, layer: null, link: null }, data: { capital: capitalFlowsView(doc, { today: '2026-11-19' }) } });
  const staleDoc = mutate((d) => { d.reviewedAt = '2026-01-02'; });
  const fresh = mount(good(), '@OpenAI');
  const stale = mount(staleDoc, '@OpenAI');
  const text = (node) => String(node?.textContent || '');
  if (!text(fresh).includes('기준일 2026-11-19')) failures.push('ai-map-view.js: the capital map does not head with its reviewedAt');
  const staleChip = (node) => [...node.querySelectorAll('.nmap-stale')].some((chip) => text(chip) === '기준일 지남');
  if (staleChip(fresh) || !staleChip(stale)) failures.push('ai-map-view.js: 기준일 지남 does not follow the view\'s stale flag');
  if (!fresh.querySelectorAll('.nmap-report').length) failures.push('ai-map-view.js: a reports-only deal is not marked 보도');
  const publishers = good().edges.flatMap((edge) => edge.sources.map((source) => source.publisher));
  if ([...fresh.querySelectorAll('.nmap-flow-meta'), ...fresh.querySelectorAll('.nmap-flow-basis')].some((line) => publishers.some((name) => text(line).includes(name)))) failures.push('ai-map-view.js: a publisher name sits on a deal\'s figure line');
  const ringMap = mount(ring);
  if (!text(ringMap).includes('양쪽에 있는 회사 2곳') || ringMap.querySelectorAll('.nmap-both').length !== 4) failures.push('ai-map-view.js: the companies on both sides are not named above the columns and marked on their rows');
  const rowOf = (id) => [...ringMap.querySelectorAll('.nmap-flow')].find((row) => row.dataset.edgeId === id);
  if (!rowOf('c')?.querySelectorAll('.nmap-bar').length || rowOf('b')?.querySelectorAll('.nmap-bar').length || !text(rowOf('b')).includes('10GW')) failures.push('ai-map-view.js: a dollar deal has no bar, or a GW deal has a bar instead of its GW figure');
}

let report = 'absent';
if (existsSync(join(root, FILE))) {
  let doc = null;
  try { doc = JSON.parse(read(FILE)); } catch (error) { failures.push(`${FILE}: not JSON (${error.message})`); }
  if (doc) {
    const symbols = new Set([
      ...(JSON.parse(read('public-data/us-listings.json')).columns?.sym || []),
      ...(JSON.parse(read('public-data/company-profiles/index.json')).profiles || []).map((row) => row.symbol)
    ]);
    failures.push(...capitalFlowsProblems(doc, (id) => symbols.has(id)).map((problem) => `${FILE}: ${problem}`));
    const today = new Date().toISOString().slice(0, 10);
    const stale = capitalFlowsStale(doc.reviewedAt, today);
    const shown = capitalFlowsView(doc, { today });
    if (stale && shown && shown.stale !== true) failures.push(`${FILE}: reviewedAt ${doc.reviewedAt} is past ${CAPITAL_STALE_DAYS} days but the view is not marked stale`);
    report = `${(doc.nodes || []).length} nodes, ${(doc.edges || []).length} edges (${(doc.edges || []).filter((edge) => edge?.sourceKind === 'report').length} 보도), reviewedAt ${doc.reviewedAt}${stale ? ` — past ${CAPITAL_STALE_DAYS} days, the map shows 기준일 지남` : ''}${shown ? '' : ', nothing to draw (map left out)'}`;
  }
}

if (failures.length) {
  console.error(`[capital-flows] FAIL ${failures.length}:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`[capital-flows] PASS: ${FILE} ${report}; self-test ${cases.length} cases.`);
