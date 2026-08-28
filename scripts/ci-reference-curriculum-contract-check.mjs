import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const artifact = JSON.parse(read('public-data/principles/reference-curriculum.json'));
const routes = new Set(JSON.parse(read('architecture/golden-routes.json')).routes || []);
const renderer = read('src/ui/knowledge/reference-curriculum.js');
const page = read('src/ui/pages/principles.js');
const chat = read('js/aio-chat.js');
const glossary = read('js/aio-glossary.js');
const serviceWorker = read('sw.js');
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

check('schema/status/publication boundary', artifact.schemaVersion === 'market-learning-curriculum.v1' && artifact.status === 'REFERENCE_CONNECTED' && artifact.publication === 'EDUCATIONAL_REFERENCE_ONLY');
check('boundary excludes securities, prices, targets, forecasts and instructions', /특정 종목/.test(artifact.boundary) && /가격/.test(artifact.boundary) && /목표가/.test(artifact.boundary) && /전망/.test(artifact.boundary) && /매매 지시/.test(artifact.boundary));
check('six-step decision loop is stable', JSON.stringify((artifact.decisionLoop || []).map((item) => item.id)) === JSON.stringify(['claim', 'evidence', 'response', 'exposure', 'invalidation', 'journal']));
check('0~10 stage sequence is complete', artifact.stages?.length === 11 && artifact.stages.every((stage, index) => stage.number === index && stage.id === `stage-${String(index).padStart(2, '0')}`));

const sources = new Map((artifact.sourceNotes || []).map((source) => [source.id, source]));
check('nine unique public article sources', sources.size === 9 && [...sources.values()].every((source) => /^https:\/\/x\.com\/blazingbees\/status\/\d+$/.test(source.url)));
const lessons = (artifact.stages || []).flatMap((stage) => stage.lessons || []);
check('every stage has questions and lessons', artifact.stages?.every((stage) => stage.questions?.length >= 2 && stage.lessons?.length >= 1));
check('every lesson has observable framework/mechanism/invalidation', lessons.every((lesson) => lesson.id && lesson.title && lesson.framework && lesson.mechanism && lesson.invalidation));
check('every lesson source resolves', lessons.every((lesson) => lesson.sourceIds?.length && lesson.sourceIds.every((sourceId) => sources.has(sourceId))));
check('every route bridge resolves and carries metric/timeframe', lessons.every((lesson) => routes.has(lesson.routeTarget?.routeId) && lesson.routeTarget?.metric && lesson.routeTarget?.timeframe));

const forbiddenKeys = new Set(['price', 'targetPrice', 'forecast', 'brokerTiming', 'leverageThreshold', 'signal', 'ticker', 'symbol', 'recommendation']);
const keyStack = [artifact];
let forbiddenKey = null;
while (keyStack.length && !forbiddenKey) {
  const value = keyStack.pop();
  if (!value || typeof value !== 'object') continue;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) { forbiddenKey = key; break; }
    keyStack.push(child);
  }
}
check('artifact has no live/trade payload fields', forbiddenKey === null);

check('renderer uses safe text and external-link boundaries', /textContent/.test(renderer) && /applySafeExternalLink/.test(renderer) && !/innerHTML/.test(renderer));
check('renderer exposes tab and selection semantics', /role', 'tablist'/.test(renderer) && /role', 'tab'/.test(renderer) && /aria-selected/.test(renderer) && /aria-pressed/.test(renderer));
check('renderer route bridge delegates navigation', /onNavigate\(lesson\.routeTarget\)/.test(renderer));
check('page lazy-loads and reports curriculum capability', /REFERENCE_CURRICULUM_URL/.test(page) && /ensureLibraryCapabilities/.test(page) && /aioPrinciplesReferenceCurriculum/.test(page) && /activeReferenceStageId/.test(page));
check('service worker owns the renderer module', serviceWorker.includes("'./src/ui/knowledge/reference-curriculum.js'"));
check('chat context keeps the framework in REFERENCE lane', /AIO_MARKET_LEARNING_REFERENCE/.test(chat) && /sourceKind:\s*'REFERENCE'/.test(chat) && /가설 → 증거 → 시장 반응 → 포지션 크기 → 무효화 → 복기/.test(chat) && /never as live market data or a trade instruction/.test(chat));
check('glossary contains the integrated educational vocabulary', ['예측보다 대응', '논점 무효화', '주도주', '에코챔버', '지수 바스켓', '반대매매'].every((term) => glossary.includes(term)));

if (errors.length) {
  console.error('Reference curriculum contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, stages: artifact.stages.length, lessons: lessons.length, sources: sources.size, routes: new Set(lessons.map((lesson) => lesson.routeTarget.routeId)).size, publication: artifact.publication }));
