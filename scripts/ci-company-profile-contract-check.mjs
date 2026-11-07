#!/usr/bin/env node
// v59.43: the researched company stories (public-data/company-profiles/) keep their contract: the index matches the
// files, every story has each step of the flow, every cited source id resolves to a dated https source, the AI layer
// is from the fixed list, the money flow has 3-6 hops, labelled cash uses, and no trade instruction or
// "전문가가 보는" label appears. The reader helpers are checked on fixed cases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_LAYERS, STORY_UNITS, moneyText, storyFreshness, isCompanyStory } from '../src/domain/entity/company-story.js';
import { debateIssues } from '../src/domain/entity/company-debate.js';
import { buildCompanyGraph, companyNeighbourhood, COMPANY_GRAPH_SCHEMA } from '../src/domain/entity/company-graph.js';
import { companiesNamedIn } from '../src/domain/entity/company-aliases.js';
import { existsSync } from 'node:fs';
import { LAYER_INDUSTRY, SYMBOL_INDUSTRY } from '../src/domain/entity/industry-links.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// v59.44: `--dir <folder>` checks researched stories in a staging folder (no index there) before they are synced in.
const dirArg = process.argv.indexOf('--dir');
const staging = dirArg > 0 ? resolve(process.argv[dirArg + 1] || '') : null;
const dir = staging || join(root, 'public-data', 'company-profiles');
const failures = [];
const fail = (message) => failures.push(message);

const LAYERS = new Set(AI_LAYERS.map(([id]) => id));
const STEPS = ['oneLine', 'moat', 'design', 'make', 'sell', 'moneyFlow', 'earnings', 'useOfCash', 'aiChain', 'competition', 'strategy', 'governance', 'guidance', 'watch', 'trading'];
// A price, size or timing order. '목표가' alone is usually 목표 + subject particle, so only a number after it counts.
const ORDER = /(매수하세요|매도하세요|사세요|파세요|진입가|손절가|손절\s*라인|목표\s*주가|목표가\s*[:：]?\s*\$?\d|비중을?\s*(늘리|줄이)세요|buy at|sell at|stop[- ]loss at|price target of)/i;

const index = staging ? null : JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const files = readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json' && name !== 'graph.json').sort();
if (index && index.schemaVersion !== 'company-profiles-index.v1') fail(`index schemaVersion ${index.schemaVersion}`);
const rows = [];
const stories = [];
for (const file of files) {
  const story = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  stories.push(story);
  const id = story.symbol;
  if (`${id}.json` !== file) fail(`${file}: symbol ${id} does not match the file name`);
  if (!isCompanyStory(story, id)) fail(`${file}: not a usable story (symbol, oneLine, sources)`);
  rows.push({ symbol: id, name: story.name, file, researchedAt: story.researchedAt || null, period: story.earnings?.period || null, layer: story.aiChain?.layer || null });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(story.researchedAt || '')) fail(`${file}: researchedAt is not a date`);
  const ids = new Set((story.sources || []).map((source) => source.id));
  for (const source of story.sources || []) if (!/^https:\/\//.test(source.url || '') || !/^\d{4}(-\d{2}){0,2}$/.test(source.date || '')) fail(`${file}: source ${source.id} lacks an https url or a date`);
  for (const key of STEPS) if (story[key] == null || story[key] === '') fail(`${file}: missing ${key}`);
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${path}[${i}]`));
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.src)) for (const ref of node.src) if (!ids.has(ref)) fail(`${file}: ${path} cites unknown source ${ref}`);
    // Every amount names a currency the reader formats (a TWD or EUR figure once read as dollars).
    if (typeof node.unit === 'string' && !STORY_UNITS.includes(node.unit)) fail(`${file}: ${path} unit ${node.unit} is not one of ${STORY_UNITS.join(', ')}`);
    for (const [key, value] of Object.entries(node)) if (key !== 'sources') walk(value, `${path}.${key}`);
  };
  walk(story, id);
  if (!LAYERS.has(story.aiChain?.layer)) fail(`${file}: aiChain.layer not in the list: ${story.aiChain?.layer}`);
  const hops = story.moneyFlow?.steps?.length || 0;
  if (hops < 3 || hops > 6) fail(`${file}: moneyFlow has ${hops} hops`);
  for (const item of story.useOfCash?.items || []) if (/other|customer financing/.test(item.use) && !item.label) fail(`${file}: useOfCash ${item.use} without a label`);
  const text = JSON.stringify(story);
  const order = text.match(ORDER);
  if (order) fail(`${file}: trade wording "${order[0]}"`);
  if (/전문가가 보는/.test(text)) fail(`${file}: labels "전문가가 보는"`);
  // v59.74: 쟁점과 이면 (optional per story) cite only the story's own sources (src/domain/entity/company-debate.js).
  for (const issue of debateIssues(story, ids)) fail(`${file}: ${issue}`);
}
// v59.74: the company graph is the one the stories build (scripts/sync-company-profiles.mjs writes it).
if (!staging) {
  const graphPath = join(dir, 'graph.json');
  const built = buildCompanyGraph(stories);
  const graph = existsSync(graphPath) ? JSON.parse(readFileSync(graphPath, 'utf8')) : null;
  if (!graph || graph.schemaVersion !== COMPANY_GRAPH_SCHEMA || JSON.stringify(graph.edges) !== JSON.stringify(built.edges) || JSON.stringify(graph.nodes) !== JSON.stringify(built.nodes)) fail('graph.json is out of date: run node scripts/sync-company-profiles.mjs');
}
const revision = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
if (index && (index.revision !== revision || index.count !== rows.length || JSON.stringify(index.profiles) !== JSON.stringify(rows))) fail('index.json is out of date: run node scripts/sync-company-profiles.mjs');

// Reader helpers on fixed cases.
for (const [value, unit, text] of [[215.9, 'USD bn', '2,159억 달러'], [1234, 'USD bn', '1.23조 달러'], [-1.68, 'USD bn', '-16.8억 달러'], [850, 'USD mn', '8.5억 달러'], [104.62, 'KRW tn', '104.62조 원'], [830, 'KRW bn', '8,300억 원'], [1494.24, 'TWD bn', '1.49조 대만달러'], [32.667, 'EUR bn', '327억 유로'], [5, 'XYZ bn', '5 XYZ bn'], [null, 'USD bn', null]]) {
  assert.equal(moneyText(value, unit), text, `v59.43 company story amount ${value} ${unit} reads ${text}`);
}
const story = { symbol: 'AAA', researchedAt: '2026-10-28' };
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-29', epsActual: null }], '2026-10-29'), { state: 'current', researchedAt: '2026-10-28', newReport: null }, 'v59.43 a report due today with no actuals has not been released');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-29', epsActual: 1.2 }], '2026-10-29'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-10-29' }, 'v59.43 actuals on the calendar mean the report is out');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-28' }], '2026-10-29'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-10-28' }, 'v59.43 a US report dated on the KST research day is not in the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-27' }], '2026-10-29'), { state: 'current', researchedAt: '2026-10-28', newReport: null }, 'v59.43 a report before the research day is in the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-11-05' }], '2026-11-04'), { state: 'current', researchedAt: '2026-10-28', newReport: null }, 'v59.43 a future report does not age the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-11-05' }, { symbol: 'BBB', date: '2026-11-01' }], '2026-11-06'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-11-05' }, 'v59.43 only reports for the story symbol age it');

// v59.74: every 산업 지도 domain and node a story links to exists in the library text.
{
  const atlas = JSON.parse(readFileSync(join(root, 'public-data', 'atlas', 'industry-stories.json'), 'utf8'));
  for (const [key, link] of Object.entries({ ...LAYER_INDUSTRY, ...SYMBOL_INDUSTRY })) {
    if (!atlas.domains?.[link.domain]) fail(`industry-links ${key}: unknown 산업 지도 domain ${link.domain}`);
    for (const node of link.nodes) if (!atlas.nodes?.[node]) fail(`industry-links ${key}: unknown 산업 지도 node ${node}`);
  }
}
// v59.74 company names: exact, whole word, longest name first; a ticker-shaped word is not a company.
assert.deepEqual(companiesNamedIn('Samsung SDI와 Samsung Electronics, 삼성전기'), ['006400.KS', '005930.KS', '009150.KS'], 'v59.74 the longest registered name wins');
assert.deepEqual(companiesNamedIn('Metal 가공, Armada, NOW 진행'), [], 'v59.74 a name inside a longer word or a ticker-shaped word links nothing');
assert.deepEqual(companiesNamedIn('하이퍼스케일러 (Microsoft Azure, Google Cloud, AWS)'), ['MSFT', 'GOOGL', 'AMZN'], 'v59.74 product names resolve to their company once');
const tiny = buildCompanyGraph([
  { symbol: 'TSM', name: 'TSMC', sell: { customers: ['NVIDIA - 최대 고객'] }, make: { partners: ['ASML - EUV 장비'] }, moneyFlow: { steps: [] } },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sell: { customers: ['Volta - NVIDIA GPU로 운영'] }, moneyFlow: { steps: [{ from: 'NVIDIA', to: 'TSMC', what: '웨이퍼 대금' }] }, competition: { arenas: [{ arena: 'GPU', rivals: ['AMD'] }] } },
  { symbol: 'ASML', name: 'ASML Holding N.V.' }, { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' }
]);
const near = companyNeighbourhood(tiny, 'NVDA');
assert.deepEqual(near.suppliers.map((r) => [r.symbol, r.both]), [['TSM', true]], 'v59.74 a payment both stories state is marked both');
assert.deepEqual(near.buyers, [], 'v59.74 a company named after the dash of a customer line is a product, not a buyer');
assert.deepEqual(companyNeighbourhood(tiny, 'TSM').partners.map((r) => r.symbol), ['ASML'], 'v59.74 a partner line is a partnership, not a payment');
assert.deepEqual(near.rivals.map((r) => r.symbol), ['AMD'], 'v59.74 rivals come from the competition arenas');
assert.equal(tiny.nodes.AMD.name, 'Advanced Micro Devices', 'v59.74 the short name drops the legal suffix');

if (failures.length) {
  console.error(`company profile contract FAIL (${failures.length}):\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`v59.43 company profile contract OK: ${rows.length} stories (${stories.filter((s) => s.debate).length} with 쟁점과 이면), index revision ${revision}`);
