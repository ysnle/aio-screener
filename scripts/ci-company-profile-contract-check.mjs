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
import { AI_LAYERS, STORY_UNITS, moneyText, storyFreshness, storyPeriodEnd, isCompanyStory } from '../src/domain/entity/company-story.js';
import { debateIssues } from '../src/domain/entity/company-debate.js';
import { buildCompanyGraph, companyNeighbourhood, counterpartiesNamedIn, COMPANY_GRAPH_SCHEMA } from '../src/domain/entity/company-graph.js';
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
// v60.31: every 산업 지도 domain 종목 개요 links to exists in the library text.
{
  const atlas = JSON.parse(readFileSync(join(root, 'public-data', 'atlas', 'industry-stories.json'), 'utf8'));
  for (const [key, link] of Object.entries({ ...LAYER_INDUSTRY, ...SYMBOL_INDUSTRY })) {
    if (!atlas.domains?.[link.domain]) fail(`v60.31 industry-links ${key}: unknown 산업 지도 domain ${link.domain}`);
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
// v60.28: names inside a parenthetical that qualifies a named subject are that subject's relationships, not edges of the
// story's company; a bracketed member list under a category head still links its members.
{
  const marvell = 'Marvell (AWS Trainium·Microsoft Maia 협력으로 보도)';
  const graph = buildCompanyGraph([
    { symbol: 'AVGO', name: 'Broadcom Inc.', competition: { arenas: [{ arena: '맞춤형 AI 가속기 설계 파트너 (XPU/ASIC)', rivals: [marvell, 'MediaTek'] }] },
      aiChain: { sellsTo: ['클라우드 (Google, Meta)'], dependsOn: ['장비·파운드리 (TSMC 첨단 웨이퍼, ASE·Amkor·SPIL 패키징)'] },
      make: { partners: ['TSMC - 웨이퍼 생산 (파운드리)', 'Jabil (Microsoft 협력 조립)'] }, sell: { customers: ['Fluidstack(Google 보증) - 임대', '네오클라우드(이름 미공개, AMD 신용 보증)'] } },
    ...['MRVL', 'AMZN', 'MSFT', 'GOOGL', 'META', 'TSM', 'ASX', 'AMKR', 'AMD', 'JBL'].map((symbol) => ({ symbol, name: symbol }))
  ]);
  const near = companyNeighbourhood(graph, 'AVGO');
  assert.deepEqual(near.rivals.map((r) => r.symbol), ['MRVL'], 'v60.28 a rival line links its subject (Marvell), not the partners in its parenthetical (AWS, Microsoft)');
  assert.deepEqual(near.buyers.map((r) => r.symbol).sort(), ['GOOGL', 'META'], 'v60.28 a category head links its bracketed members; a guarantor in brackets (보증) is not a customer');
  assert.deepEqual(near.partners.map((r) => r.symbol).sort(), ['AMKR', 'ASX', 'JBL', 'TSM'], 'v60.28 a partner line with a named subject ignores the bracketed company');
  assert.deepEqual(counterpartiesNamedIn(marvell, 'AVGO'), ['MRVL'], 'v60.28 the competitor subject is the name before the parenthetical');
  assert.deepEqual(counterpartiesNamedIn('AMD (Instinct MI450·Helios, OpenAI 6GW 계약)', 'NVDA'), ['AMD'], 'v60.28 a rival’s customer contract does not make the customer a rival');
  assert.deepEqual(counterpartiesNamedIn('케이블 MVNO (Comcast, Charter', 'VZ'), ['CMCSA'], 'v60.28 an unclosed bracket still lists its members');
}
// v60.46 (Codex residual, 삼성전자 사 주는 곳): a money-flow link keeps what the money pays for, so a foundry order and an
// ad-inventory payment under one heading read apart. A customer line's tail is a figure, not a kind: it carries none.
{
  assert.equal(near.suppliers[0].said.find((s) => s.field === 'moneyFlow')?.what, '웨이퍼 대금', 'v60.46 a money-flow link keeps the hop\'s own words for what is paid');
  assert.ok(near.suppliers[0].said.filter((s) => s.field !== 'moneyFlow').every((s) => !('what' in s)), 'v60.46 a customer line carries no payment phrase');
  const { companyPlace } = await import('../src/domain/entity/company-overview.js');
  if (!staging) {
    const published = JSON.parse(readFileSync(join(dir, 'graph.json'), 'utf8'));
    const buyers = companyPlace({ symbol: '005930.KS', graph: published }).customers;
    const what = Object.fromEntries(buyers.map((row) => [row.symbol, row.what]));
    if (!/광고/.test(what.TTD || '') || !/칩/.test(what.TSLA || '') || !/웨이퍼/.test(what.QCOM || '')) fail(`v60.46 삼성전자 buyers say what each pays for: ${JSON.stringify(what)}`);
  }
  assert.equal(companyPlace({ symbol: 'NVDA', graph: { nodes: { NVDA: { name: 'NVIDIA' }, TSM: { name: 'TSMC' } }, edges: [{ kind: 'supply', from: 'NVDA', to: 'TSM', said: [{ by: 'NVDA', field: 'moneyFlow', text: 'NVIDIA → TSMC: 웨이퍼 대금' }] }] } }).suppliers[0].what, null,
    'v60.46 a graph written before the payment phrase existed reads without one');
}

if (failures.length) {
  console.error(`company profile contract FAIL (${failures.length}):\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(`v59.43 company profile contract OK: ${rows.length} stories (${stories.filter((s) => s.debate).length} with 쟁점과 이면), index revision ${revision}`);
