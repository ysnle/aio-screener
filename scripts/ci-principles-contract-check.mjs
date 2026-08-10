import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`[principles-contract] ${message}`); };

const index = read('index.html');
const routes = read('src/app/routes.js');
const verticalSlices = read('src/app/vertical-slices.js');
const bootstrap = read('src/app/bootstrap.js');
const page = read('src/ui/pages/principles.js');
const worker = read('sw.js');
const golden = JSON.parse(read('architecture/golden-routes.json'));
const research = JSON.parse(read('public-data/atlas/source-packets.json'));
const chapters = JSON.parse(read('public-data/principles/chapters.json'));
const lessonLibrary = JSON.parse(read('public-data/principles/lesson-library.json'));
const nodeGuides = JSON.parse(read('public-data/principles/node-guides.json'));

for (const [label, source, marker] of [
  ['route registry', routes, "'principles'"],
  ['vertical slice', verticalSlices, "vs11-principles"],
  ['bootstrap import', bootstrap, "../ui/pages/principles.js"],
  ['bootstrap mount', bootstrap, 'createPrinciplesPage({ root, documentRef })'],
  ['deep-link replay', bootstrap, 'source: \'initial-load\', directEntry: true'],
  ['page DOM', index, 'id="page-principles"'],
  ['navigation', index, 'data-arg="principles"'],
  ['service worker', worker, "'./src/ui/pages/principles.js'"],
  ['native page factory', page, 'export function createPrinciplesPage'],
  ['tree mode', page, "['tree', '지도 Tree', 'tree']"],
  ['graph mode', page, "['graph', '관계 Graph', 'graph']"],
  ['path mode', page, "['path', '학습 Path', 'path']"],
  ['reviewed content', page, 'reviewedAt: REVIEWED_AT']
]) if (!source.includes(marker)) fail(`${label} missing marker: ${marker}`);

if (!golden.routes.includes('principles') || golden.routes.length !== 20) fail('golden route does not contain the 20-route principles topology');
if (!/data-principles-content/.test(index) || !/principles-graph-mobile-list/.test(index)) fail('page markup lacks renderer mount or mobile text fallback');
if (!/sourceUrl/.test(page) || !/status: 'PARTIAL'/.test(page) || !/status: 'REVIEWED_CANDIDATE'/.test(page)) fail('content packet must carry source URLs and review status badges');
if (!/RESEARCH_URL/.test(page) || !/CHAPTERS_URL/.test(page) || !/LESSON_LIBRARY_URL/.test(page) || !/NODE_GUIDES_URL/.test(page) || !/createChapterCurriculum/.test(page) || !/createLessonLibrary/.test(page) || !/createEvidenceBlock/.test(page) || !/createResearchAnalysis/.test(page) || !/aioPrinciplesResearch/.test(page) || !/aioPrinciplesChapters/.test(page) || !/aioPrinciplesLessonLibrary/.test(page) || !/aioPrinciplesNodeGuides/.test(page)) fail('principles page is not connected to the authored A~O curriculum, node knowledge base, and reconciled evidence registry');
if (!/normalizeKnowledgeEdges/.test(page) || !/loadKnowledgeCapabilities/.test(page) || /Promise\.all\(\[loadJson/.test(page)) fail('principles must use typed edge normalization and capability-level artifact loading');
if (!/principles-analysis-claim/.test(page) || !/principles-reading-frame/.test(page) || !/observations/.test(page)) fail('principles page must render claim summaries, observations, and node reading questions');
if (!/createNodeExplanation/.test(page) || !/NODE_EXPLANATIONS/.test(page) || !/LEARNING_TRACKS/.test(page) || !/15·30·45분/.test(page)) fail('principles page must render user-facing concept explanations and learning tracks');
if (!/MARKET_EXPANSION/.test(page) || !/SYSTEMS_EXPANSION/.test(page) || !/scarcity-choice/.test(page) || !/power-electricity-system/.test(page) || !/market-foundations/.test(page) || !/industry-and-korea/.test(page)) fail('market principles economic and systems spine is missing');
if (!/nodesWithinHops/.test(page) || !/principlesGraphNodeCount/.test(page)) fail('principles graph depth must be a real selected subgraph');
if (!/PATH_SOURCE_IDS_BY_NODE/.test(page)) fail('principles path source map missing');
if (!/createPathSourceBadge/.test(page)) fail('principles path source badge missing');
if (page.includes("sourceName: '학습 콘텐츠 검토 기록'") || page.includes("sourceName: '학습 콘텐츠 검토 기록', sourceUrl: 'https://www.sec.gov/edgar/search-and-access'")) fail('principles path must not expose a generic SEC search link');
if (!/principles-edge-label/.test(page) || !/toggle-group/.test(page) || !/자료실/.test(page)) fail('principles learner map must expose relation labels, nested groups, and a separate library view');
if (research.status !== 'REFERENCE_CONNECTED' || research.sources.length !== 23 || research.claims.length !== 14 || research.nodes.length !== 12) fail('principles evidence artifact counts or status drifted');
if (research.publication?.currentClaims !== 0 || research.publication?.allowedSurfaces?.includes('principles') !== true) fail('principles publication boundary drifted');
const catalogNodeIds = new Set([...page.matchAll(/id: '([^']+)'/g)].map((match) => match[1]));
const chapterIds = chapters.chapters.map((chapter) => chapter.id);
if (chapters.status !== 'REFERENCE_CONNECTED' || chapters.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || chapters.chapters.length !== 15 || chapterIds.join(',') !== 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O') fail('authored A~O chapter artifact counts or ordering drifted');
if (lessonLibrary.status !== 'REFERENCE_CONNECTED' || lessonLibrary.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || lessonLibrary.lessons.length !== 111 || lessonLibrary.counts?.sourceCoverage !== 111 || lessonLibrary.lessons.some((lesson) => ['definition', 'mechanism', 'example', 'counterScenario', 'verificationQuestion', 'diagram'].some((field) => !lesson[field]) || !lesson.sourceIds?.length)) fail('A~O lesson library coverage or required fields drifted');
if (nodeGuides.status !== 'AUTHORED_REFERENCE_CONNECTED' || nodeGuides.publication !== 'EDUCATIONAL_REFERENCE_ONLY' || nodeGuides.nodes.length !== 60 || new Set(nodeGuides.nodes.map((node) => node.id)).size !== 60 || nodeGuides.nodes.some((node) => ['definition', 'intuition', 'mechanism', 'kpi', 'connection', 'risk'].some((field) => !node[field]))) fail('node guide knowledge base must contain one complete authored guide per catalog node');
for (const field of ['definition', 'mechanism', 'example', 'counterScenario', 'verificationQuestion', 'diagram']) if (new Set(lessonLibrary.lessons.map((lesson) => lesson[field])).size !== 111) fail(`lesson library ${field} content is repeated or missing individual authorship`);
for (const chapter of chapters.chapters) {
  for (const field of ['title', 'question', 'coreIdea', 'mechanism', 'counterScenario', 'verificationQuestion', 'sourceName', 'sourceUrl']) if (typeof chapter[field] !== 'string' || !chapter[field].trim()) fail(`chapter ${chapter.id} missing ${field}`);
  for (const nodeId of chapter.nodeIds || []) if (!catalogNodeIds.has(nodeId)) fail(`chapter ${chapter.id} references unknown node ${nodeId}`);
}
if (/data-live-price|data-live-chg|targetPrice|target-price|BUY|SELL/.test(page)) fail('principles page must not promote live price, target, or trading claims');
if (!/aria-label.*그래프|aria-label.*graph/i.test(page)) fail('graph must expose an accessible name');
if (!/replaceChildren/.test(page) || /innerHTML/.test(page)) fail('principles renderer must use safe DOM construction');

console.log(JSON.stringify({ ok: true, route: 'principles', modes: ['tree', 'graph', 'path', 'library'], graphNodes: 60, lessons: 39, authoredLessonLibrary: lessonLibrary.lessons.length, authoredNodeGuides: nodeGuides.nodes.length, authoredChapters: chapters.chapters.length, paths: 8, evidenceSources: research.sources.length, evidenceClaims: research.claims.length, reviewedAt: '2026-08-02' }));
