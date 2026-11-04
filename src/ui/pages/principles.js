import { renderConceptsPage } from '../knowledge/concepts-view.js';
import { createResourceBag } from '../../app/lifecycle.js';
import { createKnowledgeCapabilityBatchLoader } from '../knowledge/capability-loader.js';
import { navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, pushKnowledgeRouteState, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { createAppKnowledgeLearningState } from '../../app/knowledge-learning-state.js';
import { createCurrentObservationBlock, validateCurrentObservationsArtifact } from '../../ui/knowledge/current-observations.js';
import { createKnowledgeLearningControls } from '../../ui/knowledge/learning-controls.js';
import { createReferenceCurriculum } from '../../ui/knowledge/reference-curriculum.js';
import { renderKnowledgeLesson } from '../../ui/knowledge/lesson.js';
import { applySafeExternalLink } from '../../ui/knowledge/safe-external-link.js';
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
import { createSuppliedMaterialBridge } from '../../ui/knowledge/supplied-material-bridge.js';
import { createIntegratedFrameworkSpine } from '../../ui/knowledge/integrated-framework-spine.js';

const REVIEWED_AT = '2026-08-18';
const RESEARCH_URL = './public-data/atlas/source-packets.json';
const CHAPTERS_URL = './public-data/principles/chapters.json';
const LESSON_LIBRARY_URL = './public-data/principles/lesson-library.json';
const NARRATIVE_URL = './public-data/principles/narrative-journey.json';
const NODE_GUIDES_URL = './public-data/principles/node-guides.json';
const KNOWLEDGE_CONCEPTS_URL = './public-data/knowledge/concepts.json';
const KNOWLEDGE_ALIASES_URL = './public-data/knowledge/aliases.json';
const CURRENT_OBSERVATIONS_URL = './public-data/knowledge/current-observations.json';
const ROUTE_TARGETS_URL = './public-data/knowledge/route-targets.json';
const KNOWLEDGE_STATUS_URL = './public-data/knowledge/status-summary.json';
const REFERENCE_CURRICULUM_URL = './public-data/principles/reference-curriculum.json';


const CATALOG_URL = './public-data/principles/catalog.json';
const CONCEPT_STORIES_URL = './public-data/principles/concept-stories.json';

// S17 (D8): the concept-map catalog (nodes, edges, lessons, paths) is educational reference copy. Its source is
// content/research/principles/catalog.json; scripts/build-research-content.mjs composes it into CATALOG_URL and the
// page fetches it before mounting, so the route no longer carries the copy in its JavaScript.
let CATALOG = Object.freeze({ nodes: [], edges: [], lessons: [], paths: [] });
let NODE_BY_ID = new Map();
let catalogLoad = null;
export function loadPrinciplesCatalog(root = globalThis, { signal } = {}) {
  catalogLoad ||= loadJsonArtifact(stableFetcher(root), CATALOG_URL, { signal }).then((catalog) => {
    if (!Array.isArray(catalog?.nodes) || !Array.isArray(catalog?.edges)) throw new Error('PRINCIPLES_CATALOG_INVALID');
    CATALOG = catalog;
    NODE_BY_ID = new Map(catalog.nodes.map((node) => [node.id, node]));
    return catalog;
  }).catch((error) => { catalogLoad = null; throw error; });
  return catalogLoad;
}

const GRAPH_OVERVIEW_IDS = Object.freeze([
  'scarcity-choice', 'productivity-wealth', 'money-purchasing-power', 'credit-banks-debt',
  'interest-central-bank', 'company-stock-valuation', 'industry-value-chain', 'ai-era',
  'ai-workload', 'compute', 'memory-hbm', 'power-cooling', 'ai-capex', 'evaluation'
]);

function nodesWithinHops(startId, depth) {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    const currentDistance = distances.get(current) || 0;
    if (currentDistance >= depth) continue;
    CATALOG.edges.forEach((edge) => {
      const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (neighbor && !distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      }
    });
  }
  return distances;
}

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(documentRef, className, text, action, value) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.dataset.principlesAction = action;
  if (value) node.dataset.principlesValue = value;
  return node;
}




function lessonForNode(nodeId) {
  return CATALOG.lessons.find((lesson) => (lesson.nodeIds || []).includes(nodeId)) || null;
}

const NODE_SEARCH_EXTRA = new Map();
const LESSON_SEARCH_EXTRA = new Map();

function nodeMatches(node, query) {
  if (!query) return true;
  return [node.title, node.summary, node.layer, node.type, NODE_SEARCH_EXTRA.get(node.id)].join(' ').toLowerCase().includes(query);
}














const ARRIVAL_CHAPTERS = Object.freeze({
  'institutional-position-change': 'market-expectations-prices',
  'free-cash-flow': 'company-economic-machine',
  'valuation-expectations': 'valuation-expectations'
});

function createPrinciplesArrivalContext(documentRef, context, onReturn) {
  if (!context || context.routeId !== 'principles') return null;
  const fromInstitutionalDisclosure = context.knowledgeNode === 'institutional-position-change';
  const arrivalLabel = fromInstitutionalDisclosure ? '대가 보유 종목에서 이어 읽기' : '전문 화면에서 이어 읽기';
  const block = element(documentRef, 'aside', 'principles-arrival-context');
  block.setAttribute('aria-label', arrivalLabel);
  block.append(
    element(documentRef, 'span', 'principles-narrative-overline', arrivalLabel),
    element(documentRef, 'p', 'principles-exploration-copy', fromInstitutionalDisclosure
      ? '기관의 분기 보유 변화가 실제 매매의 전부는 아니라는 경계를 확인했습니다. 이제 그 흔적이 시장의 기대와 가격 형성에서 어떤 의미를 갖는지 다시 연결합니다.'
      : '전문 화면에서 확인한 숫자를 경제의 원인·전달 경로·반대 시나리오와 다시 연결합니다.')
  );
  if (context.returnContext?.route) {
    const back = button(documentRef, 'principles-route-button is-secondary', fromInstitutionalDisclosure ? '대가 보유 종목으로 돌아가기' : '보던 화면으로 돌아가기');
    back.addEventListener('click', onReturn);
    block.appendChild(back);
  }
  return block;
}






// P1591 (L01/E10): positions are computed from the visible subgraph instead of hand-set coordinates. Two node
// families (market principles and AI concepts) each carried their own x/y, so mixing them stacked boxes on
// the same spot. Columns = hop distance from the selected concept (unreached overview nodes in a last
// column), rows spread evenly inside a column, so no two boxes share a position and labels sit between columns.
export function layoutConceptGraph(selectedId, visibleNodes, visibleEdges) {
  const ids = visibleNodes.map((node) => node.id);
  const visible = new Set(ids);
  const distance = new Map([[selectedId, 0]]);
  const queue = [selectedId];
  while (queue.length) {
    const current = queue.shift();
    visibleEdges.forEach((edge) => {
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (next && visible.has(next) && !distance.has(next)) { distance.set(next, distance.get(current) + 1); queue.push(next); }
    });
  }
  const reached = Math.max(0, ...distance.values());
  const columnOf = (id) => (distance.has(id) ? distance.get(id) : reached + 1);
  const columns = new Map();
  visibleNodes.forEach((node) => { const c = columnOf(node.id); if (!columns.has(c)) columns.set(c, []); columns.get(c).push(node); });
  const order = [...columns.keys()].sort((a, b) => a - b);
  const positions = new Map();
  order.forEach((column, index) => {
    const nodes = columns.get(column).sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || String(a.title).localeCompare(String(b.title)));
    const x = order.length === 1 ? 50 : 12 + index * (76 / (order.length - 1));
    nodes.forEach((node, row) => positions.set(node.id, { x, y: ((row + 1) / (nodes.length + 1)) * 100 }));
  });
  const tallest = Math.max(1, ...[...columns.values()].map((list) => list.length));
  return { positions, minHeight: Math.max(420, tallest * 62 + 40) };
}

function createSvgGraph(documentRef, selectedId, visibleNodes, visibleEdges, depth = 1) {
  const graph = element(documentRef, 'div', 'principles-graph-canvas');
  const layout = layoutConceptGraph(selectedId, visibleNodes, visibleEdges);
  graph.style.minHeight = `${layout.minHeight}px`;
  const at = (id) => layout.positions.get(id) || { x: 50, y: 50 };
  const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none'); // lines in the same % space as the HTML nodes
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '개념 지도 관계 그래프. 노드 선택 버튼으로 상세를 확인할 수 있습니다.');
  const visible = new Set(visibleNodes.map((node) => node.id));
  const labels = [];
  visibleEdges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)).forEach((edge) => {
    const from = NODE_BY_ID.get(edge.from);
    const to = NODE_BY_ID.get(edge.to);
    const line = documentRef.createElementNS('http://www.w3.org/2000/svg', 'line');
    const a = at(edge.from);
    const b = at(edge.to);
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(b.x));
    line.setAttribute('y2', String(b.y));
    line.setAttribute('class', `principles-edge${edge.from === selectedId || edge.to === selectedId ? ' is-active' : ''}`);
    line.setAttribute('aria-label', `${from.title}에서 ${to.title}: ${edge.relation}`);
    svg.appendChild(line);
    // P1476: relation labels only on the selected node's edges — labels on every line overlapped the
    // lines and each other, hiding what a connection means. Other edges stay as lines (aria-label keeps the text).
    if (edge.from === selectedId || edge.to === selectedId) {
      // HTML label at the midpoint (between columns), so a non-uniform SVG scale never stretches the text.
      const relation = element(documentRef, 'span', 'principles-edge-label principles-edge-label-html', edge.relation);
      relation.style.left = `${(a.x + b.x) / 2}%`;
      relation.style.top = `${(a.y + b.y) / 2}%`;
      labels.push(relation);
    }
  });
  graph.appendChild(svg);
  labels.forEach((label) => graph.appendChild(label));
  visibleNodes.forEach((node) => {
    const item = element(documentRef, 'div', `principles-graph-node${node.id === selectedId ? ' is-selected' : ''}`);
    item.style.left = `${at(node.id).x}%`;
    item.style.top = `${at(node.id).y}%`;
    const nodeButton = button(documentRef, 'principles-graph-node-button', node.title, 'select-node', node.id);
    nodeButton.setAttribute('aria-pressed', node.id === selectedId ? 'true' : 'false');
    nodeButton.title = node.summary;
    item.appendChild(nodeButton);
    graph.appendChild(item);
  });
  return graph;
}



function narrativeChapters(artifact) {
  return (artifact?.parts || []).flatMap((part) => (part.chapters || []).map((chapter) => ({ ...chapter, part })));
}


export function createPrinciplesPage({ root = globalThis, documentRef = root.document } = {}) {
  const pageApi = {
    route: 'principles',
    // The catalog arrives as JSON; the body mounts once it is in, and a failed load leaves a retryable notice.
    mount({ scope } = {}) {
      let dispose = null;
      let closed = false;
      const page = documentRef?.getElementById('page-principles');
      const content = page?.querySelector('[data-principles-content]');
      const start = () => loadPrinciplesCatalog(root, { signal: scope?.signal }).then(() => {
        if (!closed && !scope?.disposed) dispose = pageApi.mountLoaded({ scope });
      }).catch(() => {
        if (closed || !content) return;
        const notice = documentRef.createElement('p');
        notice.className = 'principles-catalog-failure';
        notice.textContent = '개념 지도를 불러오지 못했습니다. ';
        const retry = documentRef.createElement('button');
        retry.type = 'button';
        retry.textContent = '다시 불러오기';
        retry.addEventListener('click', () => { notice.remove(); start(); });
        notice.appendChild(retry);
        content.replaceChildren(notice);
      });
      start();
      return () => { closed = true; dispose?.(); };
    },
    mountLoaded({ scope } = {}) {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-principles');
      if (!page) return () => bag.dispose();
      const content = page.querySelector('[data-principles-content]');
      if (!content) return () => bag.dispose();
      const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
        routeId: 'principles',
        heading: '시장 원리·13F·AI를 같은 증거 흐름으로 연결하기'
      });
      page.appendChild(suppliedMaterialBridge);
      bag.add(() => suppliedMaterialBridge.remove());
       const isAlive = () => !scope?.disposed && (typeof scope?.isCurrent !== 'function' || scope.isCurrent());
       const sharedRoute = parseKnowledgeRouteState(root?.location);
       const arrivalContext = parseKnowledgeTargetContext({ root, locationLike: root?.location });
       const arrivalChapter = arrivalContext?.routeId === 'principles' ? ARRIVAL_CHAPTERS[arrivalContext.knowledgeNode] : null;
       const initialMode = ['tree', 'graph', 'path'].includes(sharedRoute.mode) ? sharedRoute.mode : 'tree';
       const initialNode = NODE_BY_ID.has(sharedRoute.node) ? sharedRoute.node : 'scarcity-choice';
       const initialPath = CATALOG.paths.some((item) => item.id === sharedRoute.path) ? sharedRoute.path : 'beginner';
       const initialLesson = /^[A-O]\d{1,2}$/.test(sharedRoute.lesson || '') ? sharedRoute.lesson : null;
       const learning = createAppKnowledgeLearningState(root);
       // P1473: the hub opens on 분석 프레임 unless the link asks for the column (story), a lesson or a map mode.
       const initialView = arrivalChapter ? 'story' : initialLesson ? 'lesson' : !sharedRoute.mode || sharedRoute.mode === 'frames' ? 'frames' : sharedRoute.mode === 'story' ? 'story' : sharedRoute.mode === 'concept' ? 'concept' : 'map';
        const state = { openGroup: initialView === 'map' ? 'map' : initialView, conceptId: sharedRoute.mode === 'concept' ? sharedRoute.node : null, lessonId: initialLesson, chapterId: arrivalChapter || sharedRoute.chapter || 'money-is-choice', frameId: sharedRoute.mode === 'frames' && sharedRoute.node ? sharedRoute.node : null, mode: initialMode, view: initialView, query: '', arrivalContext: arrivalChapter ? arrivalContext : null, selectedId: initialNode, selectedNarrativeChapterId: arrivalChapter || sharedRoute.chapter || 'money-is-choice', pathId: initialPath, step: sharedRoute.step ?? 0, depth: 1, activeLessonId: initialLesson, lessonPage: 1, lessonPanelOpen: Boolean(initialLesson), activeReferenceStageId: 'stage-00', activeReferenceLessonId: 'bb-learning-contract', expandedSections: new Set(['scarcity']), expandedGroups: new Set(['scarcity-choice-path']), narrative: null, research: null, chapters: null, lessonLibrary: null, nodeGuides: null, knowledgeConcepts: null, knowledgeAliases: null, knowledgeArticles: { articles: [] }, routeTargets: null, currentObservations: null, knowledgeStatus: null, referenceCurriculum: null, narrativeError: false, researchError: false, chaptersError: false, lessonLibraryError: false, nodeGuidesError: false, knowledgeConceptsError: false, knowledgeAliasesError: false, knowledgeArticlesError: false, routeTargetsError: false, currentObservationsError: false, knowledgeStatusError: false, referenceCurriculumError: false, loadingArticleIds: new Set(), articleErrors: new Set() };
      page.dataset.aioArchitectureRoute = 'principles';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;
      page.dataset.aioKnowledgeLearningState = 'local-persistent';

      const route = (routeId) => {
        if (typeof root?.showPage === 'function') root.showPage(routeId);
      };
      const navigateTarget = (target) => {
        if (!target?.routeId) return;
        navigateKnowledgeTarget({ root, target: { ...target, returnContext: target.returnContext || { route: 'principles' } } });
      };

      const syncSharedState = ({ push = false } = {}) => (push ? pushKnowledgeRouteState : replaceKnowledgeRouteState)({ root, state: { mode: state.view === 'map' ? 'graph' : state.view === 'lesson' ? null : state.view, node: state.view === 'map' ? state.selectedId : state.view === 'frames' ? state.frameId : state.view === 'concept' ? state.conceptId : null, chapter: state.view === 'story' ? state.chapterId : null, lesson: state.view === 'lesson' ? state.lessonId : null } });
      syncSharedState();

      const focusDetail = () => {
        const heading = page.querySelector('.principles-detail-title');
        if (!heading) return;
        heading.scrollIntoView({ block: 'start', behavior: 'auto' });
        heading.focus({ preventScroll: true });
      };

      const selectNode = (nodeId) => {
        state.selectedId = nodeId;
        const lesson = lessonForNode(nodeId);
        learning.markViewed(lesson ? `principles:${lesson.id}` : `principles-node:${nodeId}`);
        syncSharedState();
        render();
        queueMicrotask(focusDetail);
      };

      function visibleGraphNodes() {
        // KG-05: show a readable overview plus the selected node's real hop
        // neighborhood. Depth changes the neighborhood, not the underlying graph.
        const distances = nodesWithinHops(state.selectedId, state.depth);
        const overview = new Set(GRAPH_OVERVIEW_IDS);
        distances.forEach((_distance, id) => overview.add(id));
        const scoped = CATALOG.nodes.filter((node) => overview.has(node.id));
        if (!state.query) return scoped;
        return scoped.filter((node) => nodeMatches(node, state.query) || node.id === state.selectedId);
      }

      // 2026-10-05 리서치 라이브러리 redesign: one shell (목차 · 본문 · 연결); the open document decides
      // the right column. renderMap keeps the principle graph as the 개념 지도 document.
      function renderMap() {
        const wrap = element(documentRef, 'div', 'rl-map principles-graph-workspace');
        const nodes = visibleGraphNodes();
        const visibleIds = new Set(nodes.map((node) => node.id));
        const edges = CATALOG.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
        wrap.dataset.principlesGraphNodeCount = String(nodes.length);
        wrap.dataset.principlesGraphEdgeCount = String(edges.length);
        const node = NODE_BY_ID.get(state.selectedId);
        wrap.append(element(documentRef, 'p', 'af-kicker', '개념 연결 지도'), element(documentRef, 'h2', 'af-issue', node?.title || '관계 지도'));
        if (node?.summary) wrap.appendChild(element(documentRef, 'p', 'af-lead', node.summary));
        const depth = element(documentRef, 'div', 'principles-depth-toggle');
        [1, 2].forEach((value) => depth.appendChild(button(documentRef, `principles-depth-button${state.depth === value ? ' is-active' : ''}`, value === 1 ? '바로 연결된 개념' : '두 단계까지', 'depth', String(value))));
        wrap.append(depth, createSvgGraph(documentRef, state.selectedId, nodes, edges, state.depth));
        // Screen-reader text alternative for the graph: the same visible nodes as buttons.
        const list = element(documentRef, 'div', 'principles-graph-node-list principles-sr-only');
        list.setAttribute('aria-label', '그래프 노드 텍스트 목록');
        nodes.forEach((item) => list.appendChild(button(documentRef, 'principles-graph-node-button', item.title, 'select-node', item.id)));
        wrap.appendChild(list);
        return wrap;
      }

      function mapAside(block) {
        const node = NODE_BY_ID.get(state.selectedId);
        if (!node) return [];
        const blocks = [];
        const relations = CATALOG.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
        if (relations.length) {
          const box = block('연결된 개념');
          relations.slice(0, 12).forEach((edge) => {
            const otherId = edge.from === node.id ? edge.to : edge.from;
            const other = NODE_BY_ID.get(otherId);
            if (!other) return;
            const link = button(documentRef, 'af-route', '', 'select-node', otherId);
            link.append(element(documentRef, 'strong', null, other.title), element(documentRef, 'span', null, `${edge.from === node.id ? '→' : '←'} ${edge.relation || ''}`.trim()));
            box.appendChild(link);
          });
          blocks.push(box);
        }
        // E12: dated observations tied to this concept (market rows follow the latest closes, P1636).
        if (state.currentObservations) {
          const observed = createCurrentObservationBlock(documentRef, state.currentObservations, { page: 'principles', nodeId: node.id, title: '이 개념의 지금 수치' });
          if (observed.dataset.knowledgeCurrentObservationCount !== '0') { const box = block('지금 값'); box.appendChild(observed); blocks.push(box); }
        }
        const lesson = lessonForNode(node.id);
        if (lesson?.route) {
          const box = block('이어서 볼 곳');
          const link = element(documentRef, 'button', 'af-route');
          link.type = 'button';
          link.append(element(documentRef, 'strong', null, lesson.routeLabel || '연결 화면'), element(documentRef, 'span', null, lesson.title || ''));
          link.addEventListener('click', () => route(lesson.route));
          box.appendChild(link);
          blocks.push(box);
        }
        return blocks;
      }

      function conceptsData() {
        const lessonChapters = (state.chapters?.chapters || []).map((chapter) => ({ id: chapter.id, title: chapter.title || chapter.name || chapter.id }));
        return { chapters: narrativeChapters(state.narrative), narrativeError: state.narrativeError, lessonLibraryError: state.lessonLibraryError || state.chaptersError, lessons: state.lessonLibrary?.lessons || null, lessonSources: state.lessonLibrary?.sources || [], lessonChapters, conceptStories: state.conceptStories || null };
      }

      const selectLocal = (params = {}, { push = true } = {}) => {
        if (params.mode === 'concept' && params.node) { state.view = 'concept'; state.conceptId = params.node; state.openGroup = 'concept'; }
        else if (params.mode === 'frames' && params.node) { state.view = 'frames'; state.frameId = params.node; state.openGroup = 'frames'; }
        else if (params.lesson) { state.view = 'lesson'; state.lessonId = params.lesson; state.openGroup = 'lesson'; ensureLibraryCapabilities(); }
        // E14: a column (story chapter) opened from the shelf or search on this same page.
        else if (params.mode === 'story') { state.view = 'story'; state.openGroup = 'story'; if (params.chapter) { state.chapterId = params.chapter; state.selectedNarrativeChapterId = params.chapter; } }
        else if (params.mode === 'tree' || params.mode === 'graph') { state.view = 'map'; state.openGroup = 'map'; if (params.node && NODE_BY_ID.has(params.node)) state.selectedId = params.node; }
        else if (params.mode === 'frames' || !params.mode) { state.view = 'frames'; state.frameId = null; state.openGroup = 'frames'; }
        syncSharedState({ push });
        render();
        queueMicrotask(() => {
          const main = page.querySelector('.rl-main');
          main?.scrollIntoView({ block: 'start', behavior: 'auto' });
          main?.focus({ preventScroll: true });
        });
      };

      function render() {
        if (!isAlive()) return;
        // v59.53: asynchronous content hydration must preserve the reader's current place and keyboard context.
        const active = documentRef.activeElement;
        const readingFocused = active === content.querySelector('.rl-main');
        const action = content.contains(active) ? active?.closest?.('[data-principles-action]') : null;
        const focusAction = action?.dataset.principlesAction;
        const focusValue = action?.dataset.principlesValue;
        if (state.view === 'concept' && !state.conceptStories && !state.conceptStoriesLoading) {
          state.conceptStoriesLoading = true;
          loadJsonArtifact(stableFetcher(root), CONCEPT_STORIES_URL, { signal: scope?.signal }).then((artifact) => { state.conceptStories = artifact.stories; render(); }).catch(() => {});
        }
        const shell = renderConceptsPage(documentRef, {
          root,
          state,
          data: conceptsData(),
          renderMap,
          mapAside,
          onLocal: selectLocal,
          onNavigate: navigateTarget,
          onConcept: (id) => selectLocal({ mode: 'concept', node: id })
        });
        const arrival = createPrinciplesArrivalContext(documentRef, state.arrivalContext, () => {
          if (typeof root?.history?.back === 'function') root.history.back();
          else if (state.arrivalContext?.returnContext?.route && typeof root?.showPage === 'function') root.showPage(state.arrivalContext.returnContext.route);
        });
        if (arrival) shell.querySelector('.rl-main')?.prepend(arrival);
        markLessonAuthoring(shell);
        content.replaceChildren(shell);
        if (readingFocused) shell.querySelector('.rl-main')?.focus({ preventScroll: true });
        else if (focusAction) [...shell.querySelectorAll('[data-principles-action]')]
          .find((node) => node.dataset.principlesAction === focusAction && node.dataset.principlesValue === focusValue)?.focus({ preventScroll: true });
      }

      // v57.48 expert review #21: each lesson states its own document's authoring status and review date
      // (articles.json authoringStatus/reviewedAt) — a draft reads "초안 · 검토일 YYYY-MM-DD"; no catalog-wide date.
      function markLessonAuthoring(shell) {
        const node = shell.querySelector?.('article[data-principles-lesson-id]');
        const lessonId = node?.dataset.principlesLessonId;
        if (!lessonId) return;
        const doc = state.knowledgeArticles?.articles?.find((item) => item.surface === 'principles' && item.lessonId === lessonId) || null;
        if (!doc && !state.loadingArticleIds.has(lessonId) && !state.articleErrors.has(lessonId)) queueMicrotask(() => loadKnowledgeArticle(lessonId));
        const lesson = (state.lessonLibrary?.lessons || []).find((item) => item.id === lessonId) || null;
        const status = doc?.authoringStatus || (lesson?.deepStatus === 'RECONSTRUCTION_REQUIRED' ? 'RECONSTRUCTION_REQUIRED' : lesson?.status) || '';
        const reviewedAt = doc?.reviewedAt || lesson?.reviewedAt || null;
        const draft = /DRAFT|UNREVIEWED|REQUIRED|CANDIDATE/i.test(status);
        const kicker = node.querySelector('.af-kicker');
        if (!kicker || (!draft && !reviewedAt)) return;
        const mark = documentRef.createElement('span');
        mark.className = 'af-authoring-status';
        mark.dataset.authoringStatus = status || 'UNKNOWN';
        mark.textContent = `, ${draft ? '초안, ' : ''}${reviewedAt ? `검토일 ${reviewedAt}` : '검토일 미기재'}`;
        kicker.appendChild(mark);
      }

      let ensureSearchCapabilities = () => {};
      let ensureMapCapabilities = () => {};
      let ensurePathCapabilities = () => {};
      let ensureLibraryCapabilities = () => {};
      let loadKnowledgeArticle = () => {};
      let retryCapability = () => {};
      const onClick = (event) => {
        const target = event.target.closest?.('[data-principles-action]');
        if (!target || !page.contains(target)) return;
         const action = target.dataset.principlesAction;
         const value = target.dataset.principlesValue;
        if (action === 'group') {
          const opening = state.openGroup !== value;
          state.openGroup = opening ? value : null;
          state.navListOpen = opening; // v59.51: picking a kind asks for its titles, so its closed 목차 opens
          // Codex browser audit H53: switching the kind tab kept the previous document in the body, so a
          // reader under "개념 사전" was still reading a lesson. Opening a kind now opens that kind's
          // last-read document (or its first one); closing the open tab only folds the contents.
          if (opening) {
            state.view = value;
            if (value === 'lesson') { state.lessonId = state.lessonId || state.activeLessonId || 'A1'; state.activeLessonId = state.lessonId; }
          }
          if (value === 'lesson') ensureLibraryCapabilities();
        }
        if (action === 'frame') { state.view = 'frames'; state.frameId = value; state.openGroup = 'frames'; learning.markViewed(`principles-frame:${value}`); }
        if (action === 'concept') { state.view = 'concept'; state.conceptId = value; state.openGroup = 'concept'; }
        if (action === 'story-chapter') { state.view = 'story'; state.chapterId = value; state.selectedNarrativeChapterId = value; state.openGroup = 'story'; }
        if (action === 'view' && value === 'story') { state.view = 'story'; state.openGroup = 'story'; }
        if (action === 'view' && value === 'frames') { state.view = 'frames'; state.openGroup = 'frames'; }
        if (action === 'select-lesson') { state.view = 'lesson'; state.lessonId = value; state.activeLessonId = value; state.openGroup = 'lesson'; ensureLibraryCapabilities(); }
        if (action === 'mode') { state.mode = value; state.view = 'map'; state.openGroup = 'map'; }
        if (action === 'depth') state.depth = Number(value) || 1;
        if (action === 'select-node') { state.selectedId = value; learning.markViewed(`principles-node:${value}`); }
        if (action === 'retry-capability') retryCapability(value);
        if (action !== 'route') {
          event.preventDefault();
          syncSharedState({ push: ['frame', 'concept', 'story-chapter', 'select-lesson', 'select-node'].includes(action) });
          render();
          if (['frame', 'concept', 'story-chapter', 'select-lesson'].includes(action)) queueMicrotask(() => {
            const main = page.querySelector('.rl-main');
            main?.scrollIntoView({ block: 'start', behavior: 'auto' });
            main?.focus({ preventScroll: true });
          });
        }
      };
      page.addEventListener('click', onClick);
      bag.add(() => page.removeEventListener('click', onClick));
      // Back and Forward between documents of this page: the URL names the document, so the page re-reads it.
      const onPop = () => {
        if (!isAlive() || !/^#principles(?:$|[?&])/.test(String(root?.location?.hash || ''))) return;
        selectLocal(parseKnowledgeRouteState(root.location), { push: false });
      };
      root?.addEventListener?.('popstate', onPop);
      bag.add(() => root?.removeEventListener?.('popstate', onPop));
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === 'principles') delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
         delete page.dataset.aioContentKind;
         delete page.dataset.aioReviewedAt;
         delete page.dataset.aioPrinciplesResearch;
          delete page.dataset.aioPrinciplesNarrative;
          delete page.dataset.aioPrinciplesChapters;
          delete page.dataset.aioPrinciplesLessonLibrary;
            delete page.dataset.aioPrinciplesNodeGuides;
           delete page.dataset.aioPrinciplesKnowledgeArticles;
          delete page.dataset.aioPrinciplesKnowledgeConcepts;
          delete page.dataset.aioPrinciplesKnowledgeAliases;
          delete page.dataset.aioPrinciplesKnowledgeSources;
           delete page.dataset.aioPrinciplesKnowledgeClaims;
           delete page.dataset.aioPrinciplesKnowledgeCoverage;
           delete page.dataset.aioPrinciplesKnowledgeResearchDossiers;
             delete page.dataset.aioPrinciplesCurrentObservations;
             delete page.dataset.aioPrinciplesRouteTargets;
            delete page.dataset.aioPrinciplesKnowledgeStatus;
           delete page.dataset.aioPrinciplesReferenceCurriculum;
          delete page.dataset.aioKnowledgeLearningState;
          content.replaceChildren();
        });
        render();
        const fetchFn = root?.fetch || globalThis.fetch;
        if (typeof fetchFn === 'function') {
           const datasetMap = { narrative: 'aioPrinciplesNarrative', research: 'aioPrinciplesResearch', chapters: 'aioPrinciplesChapters', lessonLibrary: 'aioPrinciplesLessonLibrary', nodeGuides: 'aioPrinciplesNodeGuides', knowledgeConcepts: 'aioPrinciplesKnowledgeConcepts', knowledgeAliases: 'aioPrinciplesKnowledgeAliases', knowledgeSources: 'aioPrinciplesKnowledgeSources', knowledgeClaims: 'aioPrinciplesKnowledgeClaims', knowledgeCoverage: 'aioPrinciplesKnowledgeCoverage', knowledgeResearchDossiers: 'aioPrinciplesKnowledgeResearchDossiers', knowledgeArticles: 'aioPrinciplesKnowledgeArticles', routeTargets: 'aioPrinciplesRouteTargets', currentObservations: 'aioPrinciplesCurrentObservations', knowledgeStatus: 'aioPrinciplesKnowledgeStatus', referenceCurriculum: 'aioPrinciplesReferenceCurriculum' };
          const definitionByKey = new Map([
            ['narrative', NARRATIVE_URL],
            ['research', RESEARCH_URL], ['chapters', CHAPTERS_URL], ['lessonLibrary', LESSON_LIBRARY_URL], ['nodeGuides', NODE_GUIDES_URL],
            ['knowledgeConcepts', KNOWLEDGE_CONCEPTS_URL], ['knowledgeAliases', KNOWLEDGE_ALIASES_URL], ['currentObservations', CURRENT_OBSERVATIONS_URL],
            ['routeTargets', ROUTE_TARGETS_URL], ['knowledgeStatus', KNOWLEDGE_STATUS_URL], ['referenceCurriculum', REFERENCE_CURRICULUM_URL]
          ]);
          const updateSearchIndex = () => {
            NODE_SEARCH_EXTRA.clear();
            LESSON_SEARCH_EXTRA.clear();
            (state.knowledgeConcepts?.concepts || []).filter((item) => item.surface === 'principles').forEach((item) => NODE_SEARCH_EXTRA.set(item.legacyId, `${NODE_SEARCH_EXTRA.get(item.legacyId) || ''} ${item.canonicalId} ${item.title}`));
            (state.knowledgeAliases?.aliases || []).forEach((item) => (item.targets || []).filter((target) => target.startsWith('principles:')).forEach((target) => {
              const id = target.slice('principles:'.length);
              NODE_SEARCH_EXTRA.set(id, `${NODE_SEARCH_EXTRA.get(id) || ''} ${item.alias}`);
            }));
            (state.lessonLibrary?.lessons || []).forEach((lesson) => {
              const article = state.knowledgeArticles?.articles?.find((item) => item.surface === 'principles' && item.lessonId === lesson.id);
              const extra = `${JSON.stringify(lesson)} ${article ? JSON.stringify(article) : ''}`.toLowerCase();
              LESSON_SEARCH_EXTRA.set(lesson.id, extra);
              (lesson.nodeIds || []).forEach((nodeId) => NODE_SEARCH_EXTRA.set(nodeId, `${NODE_SEARCH_EXTRA.get(nodeId) || ''} ${extra}`));
            });
          };
          const capabilityLoader = createKnowledgeCapabilityBatchLoader({
            fetchFn: stableFetcher(root),
            state,
            dataset: page.dataset,
            datasetMap,
            signal: scope?.signal,
            isActive: isAlive,
            validators: { currentObservations: validateCurrentObservationsArtifact }
          });
          const loadGroup = async (definitions) => {
            if (!await capabilityLoader.load(definitions)) return;
            updateSearchIndex();
              page.dataset.aioReviewedAt = [state.knowledgeArticles?.generatedAt, state.knowledgeArticles?.articles?.map((article) => article.reviewedAt).sort().at(-1), state.chapters?.reviewedAt, state.lessonLibrary?.reviewedAt, state.nodeGuides?.reviewedAt, state.referenceCurriculum?.revision, REVIEWED_AT].filter(Boolean).sort().at(-1) || REVIEWED_AT;
             if (state.lessonLibrary && state.activeLessonId) {
               const lessonIndex = state.lessonLibrary.lessons?.findIndex((lesson) => lesson.id === state.activeLessonId) ?? -1;
               if (lessonIndex >= 0) {
                 state.lessonPage = Math.floor(lessonIndex / 20) + 1;
                 state.lessonPanelOpen = true;
                 if (state.view === 'library' && !state.knowledgeArticles.articles.some((article) => article.lessonId === state.activeLessonId) && !state.loadingArticleIds.has(state.activeLessonId)) queueMicrotask(() => loadKnowledgeArticle(state.activeLessonId));
               } else {
                 state.activeLessonId = null;
                 syncSharedState();
               }
             }
             render();
          };
          const searchDefinitions = [{ key: 'lessonLibrary', url: LESSON_LIBRARY_URL }, { key: 'routeTargets', url: ROUTE_TARGETS_URL }];
          const mapDefinitions = [{ key: 'research', url: RESEARCH_URL }, { key: 'nodeGuides', url: NODE_GUIDES_URL }, { key: 'knowledgeConcepts', url: KNOWLEDGE_CONCEPTS_URL }, { key: 'knowledgeAliases', url: KNOWLEDGE_ALIASES_URL }, { key: 'currentObservations', url: CURRENT_OBSERVATIONS_URL, validate: validateCurrentObservationsArtifact }, { key: 'knowledgeStatus', url: KNOWLEDGE_STATUS_URL }];
          ensureSearchCapabilities = () => { if (state.query) loadGroup(searchDefinitions); };
          ensureMapCapabilities = () => loadGroup(mapDefinitions);
          ensurePathCapabilities = () => loadGroup([{ key: 'lessonLibrary', url: LESSON_LIBRARY_URL }]);
           ensureLibraryCapabilities = () => loadGroup([{ key: 'chapters', url: CHAPTERS_URL }, { key: 'lessonLibrary', url: LESSON_LIBRARY_URL }]);
          retryCapability = (key) => {
            const url = definitionByKey.get(key);
            if (!url) return;
            state[`${key}Error`] = false;
            state[key] = null;
            page.dataset[datasetMap[key]] = 'loading';
            render();
            loadGroup([{ key, url }]);
          };
          loadKnowledgeArticle = async (lessonId) => {
            if (!lessonId || state.loadingArticleIds.has(lessonId) || state.knowledgeArticles.articles.some((article) => article.lessonId === lessonId)) return;
            state.articleErrors.delete(lessonId);
            state.loadingArticleIds.add(lessonId);
            render();
            try {
              const article = await loadJsonArtifact(stableFetcher(root), `./public-data/knowledge/articles/principles/${encodeURIComponent(lessonId)}.json`, { signal: scope?.signal });
              if (article?.articleId !== `principles:${lessonId}` || article?.surface !== 'principles' || article?.lessonId !== lessonId) throw new Error(`article identity mismatch: ${lessonId}`);
              if (!isAlive()) return;
              state.knowledgeArticles = { articles: [...state.knowledgeArticles.articles, article] };
              state.knowledgeArticlesError = false;
              state.articleErrors.delete(lessonId);
              page.dataset.aioPrinciplesKnowledgeArticles = 'connected';
              updateSearchIndex();
            } catch (error) {
              if (error?.name !== 'AbortError') {
                state.knowledgeArticlesError = true;
                state.articleErrors.add(lessonId);
                page.dataset.aioPrinciplesKnowledgeArticles = 'unavailable';
              }
            } finally {
              state.loadingArticleIds.delete(lessonId);
              if (isAlive()) render();
            }
          };
          loadGroup([{ key: 'narrative', url: NARRATIVE_URL }]);
          if (state.view === 'lesson' || state.openGroup === 'lesson') ensureLibraryCapabilities();
       }
       return () => bag.dispose();
    }
  };
  return pageApi;
}

export { CATALOG_URL, CONCEPT_STORIES_URL, NARRATIVE_URL, RESEARCH_URL, CHAPTERS_URL, LESSON_LIBRARY_URL, NODE_GUIDES_URL, KNOWLEDGE_CONCEPTS_URL, KNOWLEDGE_ALIASES_URL, ROUTE_TARGETS_URL, CURRENT_OBSERVATIONS_URL, KNOWLEDGE_STATUS_URL, REFERENCE_CURRICULUM_URL };
