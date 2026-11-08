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
import { AI_LAYERS, STORY_UNITS, moneyText, storyFreshness, storyPeriodEnd, withConfirmedReport, isCompanyStory } from '../src/domain/entity/company-story.js';
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
  // v59.85 (company analysis review 2026-11-08): the AI-chain lists lead with the Korean layer name, never the slug
  // ('semicap-foundry (TSMC …)' reached the page in 199 stories), and the guidance table's item is Korean ('revenue',
  // 'gross margin' in 910 rows); an acronym or a product name may stay (EPS, EBITDA, ARR, Azure).
  for (const key of ['dependsOn', 'sellsTo']) for (const line of story.aiChain?.[key] || []) {
    const lead = String(line).split(/\s[(\-—]/)[0];
    if (AI_LAYERS.some(([slug]) => new RegExp(`(^|[^A-Za-z-])${slug}($|[^A-Za-z-])`).test(lead))) fail(`${file}: aiChain.${key} leads with a layer slug: ${line.slice(0, 60)}`);
  }
  for (const row of story.guidance?.latest || []) if (!/[가-힣]/.test(row?.metric || '') && /\b[a-z]{4,}\b/.test(row?.metric || '')) fail(`${file}: guidance metric in English: ${row.metric}`);
  // v59.85: the face's four numbers are the latest reported quarter. A quarter is reported within about two months of
  // its end, so a period ending more than 150 days before the research day is a fiscal year (or an older quarter) shown
  // as current — 57 stories read 4-12 months back (NVDA FY2026 ended 2026-01-25 on 2026-10-28). A half-year filer
  // (basis 'half-year') reports twice a year.
  const e = story.earnings || {};
  if (e.periodEnd != null && !/^\d{4}-\d{2}-\d{2}$/.test(e.periodEnd)) fail(`${file}: earnings.periodEnd is not a date`);
  if (e.basis != null && !['quarter', 'half-year', 'year-to-date'].includes(e.basis)) fail(`${file}: earnings.basis ${e.basis} is not quarter, half-year or year-to-date`);
  const periodEnd = storyPeriodEnd(story);
  const ageDays = periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(story.researchedAt || '') ? (Date.parse(story.researchedAt) - Date.parse(periodEnd)) / 86400000 : null;
  if (ageDays != null && ageDays > (e.basis === 'half-year' ? 240 : 150)) fail(`${file}: earnings period ended ${periodEnd}, ${Math.round(ageDays)} days before the research day — re-base onto the latest reported quarter`);
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
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-29', epsActual: null }], '2026-10-29'), { state: 'current', researchedAt: '2026-10-28', newReport: null, newQuarterEnd: null }, 'v59.43 a report due today with no actuals has not been released');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-29', epsActual: 1.2 }], '2026-10-29'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-10-29', newQuarterEnd: null }, 'v59.43 actuals on the calendar mean the report is out');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-28' }], '2026-10-29'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-10-28', newQuarterEnd: null }, 'v59.43 a US report dated on the KST research day is not in the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-10-27' }], '2026-10-29'), { state: 'current', researchedAt: '2026-10-28', newReport: null, newQuarterEnd: null }, 'v59.43 a report before the research day is in the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-11-05' }], '2026-11-04'), { state: 'current', researchedAt: '2026-10-28', newReport: null, newQuarterEnd: null }, 'v59.43 a future report does not age the story');
assert.deepEqual(storyFreshness(story, [{ symbol: 'AAA', date: '2026-11-05' }, { symbol: 'BBB', date: '2026-11-01' }], '2026-11-06'), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-11-05', newQuarterEnd: null }, 'v59.43 only reports for the story symbol age it');
// v59.85: a report the coming-week calendar no longer holds still ages the story — an earnings brief read from the filing,
// or an SEC quarter ending after the story's own period.
assert.deepEqual(storyFreshness(story, [], '2026-11-08', { briefs: [{ kind: 'earnings', symbol: 'AAA', eventDate: '2026-11-04' }, { kind: 'fomc', symbol: 'AAA', eventDate: '2026-11-05' }] }), { state: 'stale', researchedAt: '2026-10-28', newReport: '2026-11-04', newQuarterEnd: null }, 'v59.85 an earnings brief after the research day ages the story');
const annual = { symbol: 'AAA', researchedAt: '2026-10-28', earnings: { period: 'FY2026 (ended 2026-01-25)' } };
assert.equal(storyPeriodEnd(annual), '2026-01-25', 'v59.85 the period end is read from the period text');
assert.equal(storyPeriodEnd({ earnings: { period: 'FY2026 (ended 2026-01-25)', periodEnd: '2026-07-26' } }), '2026-07-26', 'v59.85 an explicit periodEnd wins');
assert.equal(storyPeriodEnd({ earnings: { period: 'FY2026 (ended 2026-06-30, preliminary; 10-K filed 2026-08-31)' } }), '2026-06-30', 'v59.85 a filing day after the period end is not the period end');
assert.equal(storyPeriodEnd({ earnings: { period: 'H1 2026 (2026-01-01 ~ 2026-06-30)' } }), '2026-06-30', 'v59.85 a range ends after its tilde');
assert.deepEqual(storyFreshness(annual, [], '2026-11-08', { quarters: '2026-01-25:68127:42960:d;2026-04-26:81615:58321:r;2026-07-26:96221:59688:r' }), { state: 'stale', researchedAt: '2026-10-28', newReport: null, newQuarterEnd: '2026-07-26' }, 'v59.85 an SEC quarter after the story period means newer numbers exist');
assert.equal(storyFreshness({ ...annual, earnings: { period: 'Q2 FY2027', periodEnd: '2026-07-26' } }, [], '2026-11-08', { quarters: '2026-07-26:96221:59688:r;2026-07-28:1:1:r' }).state, 'current', 'v59.85 a quarter ending within two weeks of the story period is the same quarter');
// v59.85: the earnings calendar's confirmed day re-dates the company's own next-report line and leaves peers' reports,
// recurring lines and later quarters as written.
{
  const items = [
    { date: '2026-12 중순 (추정)', event: 'Q1 FY2027 실적과 Q2 가이던스' },
    { date: '매 분기', event: '삼성전자·SK hynix 실적과 메모리 가격' },
    { date: '수시', event: 'Q1 FY2027 실적 관련 발언' },
    { date: '2027-03 (추정)', event: 'Q2 FY2027 실적' },
  ];
  const out = withConfirmedReport(items, 'MU', { date: '2026-12-15', hour: '장 마감 후' });
  assert.deepEqual(out.map((x) => x.date), ['2026-12-15', '매 분기', '수시', '2027-03 (추정)'], 'v59.85 only the own next report takes the confirmed day');
  assert.equal(out[0].event, 'Q1 FY2027 실적과 Q2 가이던스 (장 마감 후, 실적 달력 기준)', 'v59.85 the re-dated line keeps its description');
  const peerOnly = withConfirmedReport([{ date: '2026-11-20', event: 'NVIDIA 실적' }], 'MU', { date: '2026-12-15', hour: null });
  assert.deepEqual(peerOnly.map((x) => x.event), ['실적 발표 (실적 달력 기준)', 'NVIDIA 실적'], 'v59.85 a peer report is not the company report');
}

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
