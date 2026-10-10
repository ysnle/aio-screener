// P1471–P1480 (knowledge review 2026-10-04, 1차·2차; reading standard 2026-10-05): executable negative controls for the learning
// overhaul — typed relations, corrected definitions, one concept source, unified search, analysis frames
// in a professional register, direct sources, refresh cadence and the masters style comparison.
import { readFileSync } from 'node:fs';
import { DOMAIN_RELATIONS, RELATION_TYPES, nodeCategory, typedRelations } from '../src/domain/knowledge/atlas-relations.js';
import { CONCEPT_CORE, conceptAliasIndex } from '../src/domain/knowledge/concept-core.js';
import { COLUMN_FRAME, KEY_ISSUES, LESSONS, PATHS, lessonById } from '../src/domain/knowledge/learning-core.js';
import { mergeConceptCore, searchKnowledgeIndex } from '../src/ui/knowledge/glossary-bridge.js';
import { KNOWLEDGE_CADENCE, isOverdue } from '../src/domain/knowledge/knowledge-cadence.js';
import { STYLE_FRAMES, groupManagersByStyle } from '../src/domain/masters/style-frames.js';

const fail = (message) => { throw new Error(`[knowledge-review] ${message}`); };
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// P1471: list order is not a supply chain.
const taxonomy = json('public-data/atlas/taxonomy-node-coverage.json');
const ids = new Set(taxonomy.nodes.map((node) => node.nodeId));
if (DOMAIN_RELATIONS.some((edge) => !ids.has(edge.from) || !ids.has(edge.to) || !RELATION_TYPES[edge.type])) fail('P1471 a typed relation points at an unknown node or type');
const neighbours = typedRelations(taxonomy, (id) => id);
const asic = neighbours.get('compute-asic') || [];
if (!asic.some((item) => item.id === 'compute-gpu' && item.type === 'substitute') || asic.some((item) => item.type === 'next-step' || item.type === 'supplies')) fail('P1471 GPU/ASIC/NPU must be alternatives, not production stages');
for (const [a, b] of [['resources-copper', 'resources-lithium'], ['resources-lithium', 'resources-rare-earths'], ['application-healthcare', 'application-manufacturing'], ['application-automotive', 'application-finance']]) {
  if ((neighbours.get(a) || []).some((item) => item.id === b)) fail(`P1471 parallel members ${a} and ${b} must not be linked`);
}
// P1593 (F67/F88/F90): a part names the whole it goes into; the whole lists its parts; a technology basis is not a part.
const label = (node, other) => (neighbours.get(node) || []).find((item) => item.id === other)?.label;
if (label('memory-nand', 'memory-enterprise-ssd') !== '이것이 들어가는 곳' || label('memory-enterprise-ssd', 'memory-nand') !== '구성 요소'
  || label('package-2-5d', 'package-interposer') !== '구성 요소' || label('compute-gpu', 'compute-precision') !== '성능 속성'
  || (neighbours.get('network-optical-module') || []).some((item) => item.id === 'network-silicon-photonics' && item.type === 'component')) fail('P1593 relation direction/type: part→whole labels or technology-basis typing regressed');
if (nodeCategory('accelerator') !== '기술·부품' || nodeCategory('technical') === '제품·수익모델') fail('P1471 node categories must be one consistent classification');
const atlas = read('src/ui/pages/atlas.js');
if (/domainChains/.test(atlas.slice(atlas.indexOf('function mergeTaxonomyRelationships'), atlas.indexOf('function relationList'))) || /`상류: \$\{/.test(atlas)) fail('P1471 the atlas must not derive 상류/하류 from list order');

// P1472: corrected glossary definitions and one concept source.
const glossary = read('js/aio-glossary.js');
const mustNot = [/롱=매수\(수익 무한\)/, /외국인 매수=긍정적 신호/, /PER 낮음 \+ ROE 15%↑ \+ 배당 3%↑ = 저평가 우수 기업/, /확률보다 비율이 중요/, /시장에 풀린 돈의 양/, /시장이 예상하는 미래 물가상승률\.'/, /지지선 이탈=급락/, /만기까지 보유했을 때의 총 수익률\./, /0~100\)\. 75↑ 환경 우호/, /15% 이상=우수 기업/];
for (const pattern of mustNot) if (pattern.test(glossary)) fail(`P1472 a corrected glossary claim returned: ${pattern}`);
for (const marker of ['회귀분석으로 추정한 계수', '연율 할인율', '단일 종목 ETF는', '가중평균 보통주 수', '맥컬리 듀레이션', 'IV Percentile = 최근 1년 중', '유동성 위험에 대한 보상|위험 프리미엄', '연 4회 나옵니다']) {
  if (!new RegExp(marker).test(glossary)) fail(`P1472 corrected definition missing: ${marker}`);
}
const aliasIndex = conceptAliasIndex();
for (const term of ['hbm', '포토닉스', 'roic', 'nim', '합산비율', 'ffo', '신주', '기간 프리미엄']) if (!aliasIndex.has(term)) fail(`P1472 concept core lacks ${term}`);
const legacy = [{ term: '복리 효과(Compound Interest)', cat: '배경지식', def: 'old' }];
const merged = mergeConceptCore(legacy);
if (merged.replaced !== 1 || legacy[0].def === 'old' || legacy.length !== 1 + CONCEPT_CORE.length - 1) fail('P1472 concept core must replace a legacy entry of the same concept and add the rest');

// P1474: unified search finds the surfaces that explain a term.
const index = json('public-data/knowledge/search-index.json');
for (const [query, expected] of [['HBM', 'frame:memory-optics'], ['포토닉스', 'atlas:network-silicon-photonics'], ['ROIC', 'atlas:economics-roic'], ['합산비율', 'frame:insurance']]) {
  if (!searchKnowledgeIndex(index, query).some((entry) => entry.id === expected)) fail(`P1474 search for ${query} must reach ${expected}`);
}

// P1473: frames are complete and written as research notes.
for (const lesson of LESSONS) {
  if (!lesson.issue || !lesson.answer || !(lesson.mechanism?.length >= 2) || !lesson.reverse || !(lesson.indicators?.length) || !lesson.indicators.every((item) => item.route)) fail(`P1473 frame ${lesson.id} is incomplete`);
  if (/\?$|까\?|볼까|해보세요|퀴즈|시뮬레이션/.test(`${lesson.issue} ${lesson.answer}`)) fail(`P1473 frame ${lesson.id} uses quiz/course register`);
}
if (PATHS.some((path) => path.lessons.some((id) => !lessonById(id))) || KEY_ISSUES.some((id) => !lessonById(id))) fail('P1473 tracks reference a missing frame');
const capex = lessonById('capex-roic');
if (!capex.example.steps.some((step) => /ROIC = 80 ÷ 1,000 = 8%/.test(step))) fail('P1473 capex-roic worked calculation drifted');
if (COLUMN_FRAME.corrections.length !== 6 || COLUMN_FRAME.quotes.length !== 3) fail('P1473 column corrections drifted');
const principles = read('src/ui/pages/principles.js');
const conceptsView = read('src/ui/knowledge/concepts-view.js');
if (!/!sharedRoute\.mode \|\| sharedRoute\.mode === 'frames' \? 'frames'/.test(principles) || !/\{ id: 'frames', title: '분석 노트' \}/.test(conceptsView) || /15·30·45분|잠깐 멈춰 생각해 볼 질문|호기심을 따라가는|체크포인트/.test(principles + conceptsView) || /15분 ·|30분 ·|45분 ·/.test(atlas)) fail('P1473 the library must open on 분석 노트 without course-style labels');

// P1475: lessons carry topic-matched sources; chapter-wide facts no longer land on unrelated lessons.
const library = json('public-data/principles/lesson-library.json');
const n9 = library.lessons.find((lesson) => lesson.id === 'N9');
const n7 = library.lessons.find((lesson) => lesson.id === 'N7');
if (n9.sourceScope !== 'lesson' || n9.sourceIds.includes('PS-16') || !n9.sourceIds.includes('SRC-BIS-BASEL3') || !n7.sourceIds.includes('SRC-FDA-DRUG-DEV')) fail('P1475 finance/bio lessons must cite their own regulators, not NIST/Tesla/Rocket Lab');
const l6 = json('public-data/knowledge/articles/principles/L6.json');
if (l6.article.researchEvidence.some((fact) => fact.factId === 'fact:transformer:attention' || fact.factId === 'fact:doe:pue')) fail('P1475 semiconductor process must not cite the Transformer paper or PUE');
const o2 = library.lessons.find((lesson) => lesson.id === 'O2');
if (!/1\.10 ÷ 1\.10 − 1 = 0%/.test(o2.example) || !/추가 매수가 필요 없다/.test(library.lessons.find((lesson) => lesson.id === 'G7').example)) fail('P1475 O2/G7 corrections missing');
const observations = json('public-data/knowledge/current-observations.json');
if (observations.observations.some((item) => item.nodeIds?.includes('scarcity-choice'))) fail('P1476 scarcity must not be linked to an index level');
const nathan = json('public-data/knowledge/nathan-frameworks.json');
if (nathan.articles.some((article) => article.sources.some((source) => source.title === '직접 확인된 외부 연구자료'))) fail('P1478 Nathan sources must name the post they are');

// P1477: refresh cadence by kind.
if (KNOWLEDGE_CADENCE.principle.maxAgeDays !== null || isOverdue('company-role', new Date(Date.now() - 30 * 86400000).toISOString()) || !isOverdue('production-status', new Date(Date.now() - 120 * 86400000).toISOString())) fail('P1477 cadence rules drifted');

// P1479: masters style comparison covers the catalog.
const catalog = json('public-data/masters/manager-catalog.json');
const groups = groupManagersByStyle(catalog.managers);
if ([...groups.values()].flat().length !== catalog.managers.length || STYLE_FRAMES.some((frame) => !frame.blind)) fail('P1479 every catalog manager must map to a style that states what 13F cannot show');

// Guide consistency (P1476).
const html = read('index.html');
if (/SIGNAL 점수는 시장 환경/.test(html) || /기관급 스윙트레이딩/.test(html) || /source-aware 시세/.test(html) || /3개 독립 지표/.test(html) || /금리 결정 \+ 점도표\(향후 금리 전망\) 발표/.test(html)) fail('P1476 guide still carries retired or overstated copy');

// P1480: reading standard — every lesson, AI-foundation module, industry node, domain overview and dictionary
// page carries reading text within the block/length limits, with no question outside the opening scene.
const { PRINCIPLE_STORIES, storyProblems } = await import('./lib/principles-stories.mjs');
const { FOUNDATION_STORIES, FOUNDATION_HIDDEN_MODULES } = await import('../src/domain/knowledge/foundation-stories.js');
const { INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES } = await import('../src/domain/knowledge/industry-node-stories.js');
const { CONCEPT_STORIES } = await import('../src/domain/knowledge/concept-stories.js');
if (library.lessons.some((lesson) => !lesson.story) || Object.keys(PRINCIPLE_STORIES).length !== library.lessons.length) fail('P1480 every principles lesson needs reading text');
const foundationIds = json('public-data/atlas/foundation-lessons.json').lessons.map((lesson) => lesson.id).filter((id) => !FOUNDATION_HIDDEN_MODULES.includes(id));
if (foundationIds.some((id) => !FOUNDATION_STORIES[id])) fail('P1480 every listed AI-foundation module needs reading text');
const domains = json('public-data/atlas/source-packets.json').taxonomyDomains;
if (domains.some((domain) => !INDUSTRY_DOMAIN_STORIES[domain.id] || domain.nodes.some((node) => !INDUSTRY_NODE_STORIES[node.id]))) fail('P1480 every industry domain and node needs reading text');
const readingProblems = [PRINCIPLE_STORIES, FOUNDATION_STORIES, INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES].flatMap((map) => Object.entries(map).flatMap(([id, story]) => storyProblems(id, story)));
if (readingProblems.length) fail(`P1480 reading text outside the standard: ${readingProblems.slice(0, 5).join('; ')}`);
for (const concept of CONCEPT_CORE) {
  const story = CONCEPT_STORIES[concept.id];
  if (!story || ['lead', 'use', 'twist'].some((key) => !(story[key]?.length >= 60 && story[key].length <= 230)) || /[?？]/.test(story.use + story.twist)) fail(`P1480 dictionary page ${concept.id} is outside the reading standard`);
}
const allReading = JSON.stringify([PRINCIPLE_STORIES, FOUNDATION_STORIES, INDUSTRY_NODE_STORIES, INDUSTRY_DOMAIN_STORIES, CONCEPT_STORIES]);
if (/출처|검토 질문|퀴즈|해보세요|생각해 볼까/.test(allReading)) fail('P1480 reading text must not carry source notes, review questions or quiz register');

console.log(JSON.stringify({ ok: true, frames: LESSONS.length, concepts: CONCEPT_CORE.length, relations: DOMAIN_RELATIONS.length, searchEntries: index.entries.length }));
