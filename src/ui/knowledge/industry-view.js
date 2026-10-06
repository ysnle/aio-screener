// 리서치 라이브러리 · 산업·밸류체인. Contents: 19 industry domains (open one to list its parts), the
// AI foundations in seven layers, and the relationship guides. The open part reads as one document —
// what it is, how value moves through it, what changes the numbers, the branches worth knowing and
// who plays which role — and the right column shows typed relations and related notes.
import { createResearchShell, asideBlock, el } from './research-shell.js';
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { conceptsForSurface } from '../../domain/knowledge/concept-surfaces.js';
import { LESSONS } from '../../domain/knowledge/learning-core.js';
import { ensureFrameStyle } from './analysis-frames.js';
import { FOUNDATION_HIDDEN_MODULES, foundationStory } from '../../domain/knowledge/foundation-stories.js';

const conceptById = new Map(CONCEPT_CORE.map((concept) => [concept.id, concept]));

function navButton(doc, label, { active = false, action, value, sub = false, meta = null } = {}) {
  const node = el(doc, 'button', `rl-nav-item${sub ? ' rl-nav-sub' : ''}${active ? ' is-active' : ''}`, label);
  node.type = 'button';
  node.dataset.atlasAction = action;
  if (value != null) node.dataset.atlasValue = value;
  node.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (meta) node.appendChild(el(doc, 'span', 'rl-nav-meta', meta));
  return node;
}

// A failed load ends in a stated failure with a retry, never an endless loading line.
function loadFailure(doc, text, section) {
  const box = el(doc, 'div', 'rl-note atlas-capability-errors');
  box.setAttribute('role', 'alert');
  const retry = el(doc, 'button', 'rl-nav-item', '다시 불러오기');
  retry.type = 'button';
  retry.dataset.atlasAction = 'retry-capability';
  retry.dataset.atlasValue = section;
  box.append(el(doc, 'span', null, text), retry);
  return box;
}

function groupHeader(doc, title, count, open, value) {
  const head = navButton(doc, `${title}  ${count}`, { action: 'section', value });
  head.classList.add('rl-nav-group-head');
  head.removeAttribute('aria-pressed');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  return head;
}

function buildNav(doc, state, data, labels) {
  const frag = doc.createDocumentFragment();
  const domains = data.research?.taxonomyDomains || [];
  const industry = el(doc, 'div', 'rl-nav-group');
  industry.appendChild(groupHeader(doc, '산업 지도', domains.length || 19, state.section === 'taxonomy', 'taxonomy'));
  if (state.section === 'taxonomy') {
    if (!domains.length) industry.appendChild(data.failed?.taxonomy ? loadFailure(doc, '산업 지도를 불러오지 못했습니다.', 'taxonomy') : el(doc, 'p', 'rl-note', '불러오는 중…'));
    for (const domain of domains) {
      const open = state.selectedDomainId === domain.id;
      industry.appendChild(navButton(doc, labels.domain(domain), { active: open && state.view === 'domain', action: 'domain', value: domain.id, sub: false }));
      if (open) (domain.nodes || []).forEach((node) => industry.appendChild(navButton(doc, labels.node(node), { active: state.view === 'node' && state.selectedDomainNodeId === node.id, action: 'domain-node', value: node.id, sub: true })));
    }
  }
  frag.appendChild(industry);
  const layers = data.foundations?.layers || [];
  const basics = el(doc, 'div', 'rl-nav-group');
  basics.appendChild(groupHeader(doc, 'AI 기초', layers.length || 7, state.section === 'foundations', 'foundations'));
  if (state.section === 'foundations') {
    if (!layers.length) basics.appendChild(data.failed?.foundations ? loadFailure(doc, 'AI 기초를 불러오지 못했습니다.', 'foundations') : el(doc, 'p', 'rl-note', '불러오는 중…'));
    const listed = new Set(FOUNDATION_HIDDEN_MODULES);
    for (const layer of layers) {
      const modules = (layer.modules || []).filter((moduleId) => !listed.has(moduleId));
      modules.forEach((moduleId) => listed.add(moduleId));
      if (!modules.length) continue;
      basics.appendChild(el(doc, 'p', 'rl-nav-title', labels.layer(layer)));
      modules.forEach((moduleId) => basics.appendChild(navButton(doc, labels.module(moduleId), { active: state.view === 'module' && state.selectedModuleId === moduleId, action: 'module', value: moduleId, sub: true })));
    }
  }
  frag.appendChild(basics);
  const guides = data.relationshipGuides?.guides || [];
  const rel = el(doc, 'div', 'rl-nav-group');
  rel.appendChild(groupHeader(doc, '관계 가이드', guides.length || 5, state.section === 'relationships', 'relationships'));
  if (state.section === 'relationships') guides.forEach((guide) => rel.appendChild(navButton(doc, guide.title, { active: state.view === 'guide' && state.selectedRelationshipGuideId === guide.id, action: 'relationship-guide', value: guide.id, sub: true })));
  frag.appendChild(rel);
  // Group headers sit together at the top; only the open group's items follow below them.
  const switcher = doc.createElement('div');
  switcher.className = 'rl-nav-switch';
  frag.querySelectorAll?.('.rl-nav-group-head').forEach((head) => switcher.appendChild(head));
  frag.insertBefore(switcher, frag.firstChild);
  return frag;
}

function prose(doc, paragraphs) {
  const box = el(doc, 'div', 'af-prose');
  paragraphs.filter(Boolean).forEach((text) => box.appendChild(el(doc, 'p', null, text)));
  return box;
}

function flow(doc, text) {
  const box = el(doc, 'div', 'af-flow');
  String(text || '').split('→').map((step) => step.trim()).filter(Boolean).forEach((step, index) => { if (index) box.appendChild(el(doc, 'span', 'af-flow-arrow', '→')); box.appendChild(el(doc, 'span', 'af-flow-step', step)); });
  return box;
}

function rolesBlock(doc, node, registry) {
  const players = (registry?.players || []).filter((player) => player.taxonomyNodeIds?.includes(node.id));
  const products = (registry?.products || []).filter((product) => product.taxonomyNodeIds?.includes(node.id));
  if (!players.length && !products.length) return null;
  const wrap = el(doc, 'div', 'rl-roles');
  wrap.appendChild(el(doc, 'h3', 'af-section', '누가 어떤 자리에 있나'));
  const list = el(doc, 'ul', 'rl-role-list');
  const ownerOf = new Map((registry?.players || []).map((player) => [player.playerId, player.name]));
  players.forEach((player) => {
    const li = el(doc, 'li');
    li.dataset.atlasPlayerId = player.playerId;
    li.append(el(doc, 'strong', null, player.name), doc.createTextNode(` — ${(player.roleIds || []).map((role) => String(role).replaceAll('-', ' ')).join(' · ')}`));
    list.appendChild(li);
  });
  products.forEach((product) => {
    const li = el(doc, 'li');
    li.dataset.atlasProductId = product.productId;
    li.append(el(doc, 'strong', null, `${ownerOf.get(product.playerId) ? `${ownerOf.get(product.playerId)} · ` : ''}${String(product.category || '제품').replaceAll('-', ' ')}`), doc.createTextNode(product.problemSolved ? ` — ${product.problemSolved}` : ''));
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

function relatedNotes(doc, surfaceId, block, onFrame, onConcept) {
  const blocks = [];
  const concepts = conceptsForSurface(surfaceId).map((id) => conceptById.get(id)).filter(Boolean);
  if (concepts.length) {
    const box = block('이 영역의 개념');
    concepts.forEach((concept) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.append(el(doc, 'strong', null, concept.term), el(doc, 'span', null, concept.def.length > 70 ? `${concept.def.slice(0, 70)}…` : concept.def)); b.addEventListener('click', () => onConcept(concept.id)); box.appendChild(b); });
    blocks.push(box);
  }
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const frames = LESSONS.filter((lesson) => (lesson.concepts || []).some((id) => conceptIds.has(id)));
  if (frames.length) {
    const box = block('관련 분석 노트');
    frames.slice(0, 5).forEach((lesson) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.append(el(doc, 'strong', null, lesson.issue)); b.addEventListener('click', () => onFrame(lesson.id)); box.appendChild(b); });
    blocks.push(box);
  }
  return blocks;
}


const CRITICALITY_LABEL = Object.freeze({ structural: '구조', conditional: '조건부', claim: '회사 주장' });

// One relationship guide as a document: the stages as a flow of concept buttons, the open concept explained in
// full, and every typed link spelled out in words. The status line, source fold and duplicated guide list of the
// old embedded view are gone; the guides themselves are listed once, in the contents column.
function renderRelationshipGuide(doc, guide, selectedNodeId, failed = false) {
  const article = el(doc, 'article', 'af-article');
  if (!guide) { article.appendChild(failed ? loadFailure(doc, '관계 가이드를 불러오지 못했습니다.', 'relationships') : el(doc, 'p', 'rl-copy', '관계 가이드를 불러오는 중입니다.')); return article; }
  article.dataset.atlasRelationshipGuide = guide.id;
  article.append(el(doc, 'p', 'af-kicker', `관계 가이드 · ${guide.eyebrow || ''}`.replace(/ · $/, '')), el(doc, 'h2', 'af-issue', guide.title), el(doc, 'p', 'af-lead', guide.summary));
  const nodeById = new Map((guide.nodes || []).map((node) => [node.id, node]));
  const selected = nodeById.get(selectedNodeId) || guide.nodes?.[0] || null;
  const stages = el(doc, 'div', 'af-stages');
  for (const group of guide.groups || []) {
    const stage = el(doc, 'div', 'af-stage');
    stage.appendChild(el(doc, 'p', 'af-stage-title', group.label));
    (guide.nodes || []).filter((node) => node.group === group.id).forEach((node) => {
      const b = el(doc, 'button', `af-stage-node${selected?.id === node.id ? ' is-active' : ''}`, node.label);
      b.type = 'button';
      b.dataset.atlasAction = 'relationship-node';
      b.dataset.atlasValue = node.id;
      b.setAttribute('aria-pressed', selected?.id === node.id ? 'true' : 'false');
      stage.appendChild(b);
    });
    stages.appendChild(stage);
  }
  article.append(el(doc, 'h3', 'af-section', '단계별로 보면'), stages);
  if (selected) {
    article.appendChild(el(doc, 'h3', 'af-section', selected.label));
    article.appendChild(prose(doc, [selected.definition, selected.importance, selected.mechanism]));
    if (selected.metrics?.length) article.appendChild(el(doc, 'p', 'rl-copy', `숫자로는 ${selected.metrics.join(', ')}을 본다.`));
    if (selected.invalidation) article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', selected.invalidation));
  }
  const links = (guide.edges || []).filter((edge) => !selected || edge.from === selected.id || edge.to === selected.id);
  if (links.length) {
    article.appendChild(el(doc, 'h3', 'af-section', '이 개념의 연결'));
    const list = el(doc, 'ul', 'af-links');
    links.forEach((edge) => {
      const item = el(doc, 'li');
      item.append(el(doc, 'strong', null, nodeById.get(edge.from)?.label || edge.from), doc.createTextNode(` — ${edge.label} → `), el(doc, 'strong', null, nodeById.get(edge.to)?.label || edge.to), el(doc, 'span', 'af-tag', CRITICALITY_LABEL[edge.criticality] || ''));
      list.appendChild(item);
    });
    article.appendChild(list);
  }
  return article;
}

export function renderIndustryPage(doc, { root, state, data, labels, parts, onLocal, onFrame, onConcept }) {
  ensureFrameStyle(doc);
  const { shell, nav, main, aside } = createResearchShell(doc, { root, route: 'atlas', onLocal });
  shell.dataset.atlasView = state.view;
  nav.appendChild(buildNav(doc, state, data, labels));
  const block = (title) => asideBlock(doc, title);
  const domains = data.research?.taxonomyDomains || [];
  const domain = domains.find((item) => item.id === state.selectedDomainId) || domains[0] || null;
  if (state.view === 'node' || state.view === 'domain') {
    if (!domain) { main.appendChild(data.failed?.taxonomy ? loadFailure(doc, '산업 지도를 불러오지 못했습니다.', 'taxonomy') : el(doc, 'p', 'rl-copy', '산업 지도를 불러오는 중입니다.')); return shell; }
    if (state.view === 'domain') {
      const article = el(doc, 'article', 'af-article');
      article.dataset.atlasDomain = domain.id;
      article.append(el(doc, 'p', 'af-kicker', '산업 지도'), el(doc, 'h2', 'af-issue', labels.domain(domain)));
      const text = parts.domainText?.(domain) || null;
      if (text) {
        article.appendChild(el(doc, 'p', 'af-lead', text.lead));
        article.appendChild(prose(doc, text.body));
        article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', text.twist));
      } else {
        const guide = parts.domainStory(domain);
        if (guide) article.appendChild(guide);
      }
      main.appendChild(article);
      const box = block('이 분야의 세부 영역');
      (domain.nodes || []).forEach((node) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.atlasAction = 'domain-node'; b.dataset.atlasValue = node.id; b.append(el(doc, 'strong', null, labels.node(node)), el(doc, 'span', null, labels.category(node.kind))); box.appendChild(b); });
      aside.appendChild(box);
      return shell;
    }
    const node = (domain.nodes || []).find((item) => item.id === state.selectedDomainNodeId) || domain.nodes?.[0];
    if (!node) return shell;
    const guide = parts.guide(node);
    const article = el(doc, 'article', 'af-article');
    article.dataset.atlasNode = node.id;
    article.append(el(doc, 'p', 'af-kicker', `${labels.domain(domain)} · ${labels.category(node.kind)}`), el(doc, 'h2', 'af-issue', labels.node(node)));
    const story = parts.story?.(node) || null;
    if (story) {
      article.appendChild(el(doc, 'p', 'af-lead', story.lead));
      if (guide?.chain) article.append(el(doc, 'h3', 'af-section', '가치가 흘러가는 길'), flow(doc, guide.chain));
      article.appendChild(prose(doc, story.body));
      article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', story.twist));
    } else if (guide) {
      article.appendChild(el(doc, 'p', 'af-lead', guide.definition));
      if (guide.chain) article.append(el(doc, 'h3', 'af-section', '가치가 흘러가는 길'), flow(doc, guide.chain));
    }
    const deep = parts.deep(node);
    if (deep) article.appendChild(deep);
    const roles = rolesBlock(doc, node, data.registry);
    if (roles) article.appendChild(roles);
    main.appendChild(article);
    const relations = parts.relations(node.id);
    if (relations) { const box = block('연결'); box.appendChild(relations); aside.appendChild(box); }
    relatedNotes(doc, `atlas:${node.id}`, block, onFrame, onConcept).forEach((b) => aside.appendChild(b));
  } else if (state.view === 'module') {
    const lesson = data.foundationLessons?.lessons?.find((item) => item.id === state.selectedModuleId) || null;
    const article = el(doc, 'article', 'af-article');
    article.dataset.atlasModule = state.selectedModuleId || '';
    article.append(el(doc, 'p', 'af-kicker', 'AI 기초'), el(doc, 'h2', 'af-issue', labels.module(state.selectedModuleId)));
    const story = foundationStory(state.selectedModuleId);
    if (!story && !lesson) article.appendChild(data.failed?.foundations ? loadFailure(doc, 'AI 기초를 불러오지 못했습니다.', 'foundations') : el(doc, 'p', 'rl-copy', '불러오는 중입니다.'));
    else {
      article.appendChild(el(doc, 'p', 'af-lead', story?.lead || lesson.definition));
      article.appendChild(prose(doc, story?.body || [lesson.mechanism, lesson.example]));
      if (lesson?.visualization) article.append(el(doc, 'h3', 'af-section', '흐름으로 보면'), flow(doc, lesson.visualization));
      const twist = story?.twist || lesson?.limit;
      if (twist) article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', twist));
    }
    main.appendChild(article);
    const related = (lesson?.relatedAtlasNodeIds || []);
    if (related.length) {
      const box = block('산업 지도에서 이어 보기');
      related.forEach((id) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.append(el(doc, 'strong', null, labels.nodeId(id))); b.addEventListener('click', () => onLocal({ node: id })); box.appendChild(b); });
      aside.appendChild(box);
    }
  } else if (state.view === 'guide') {
    const guide = (data.relationshipGuides?.guides || []).find((item) => item.id === state.selectedRelationshipGuideId) || data.relationshipGuides?.guides?.[0] || null;
    main.appendChild(renderRelationshipGuide(doc, guide, state.selectedRelationshipNodeId, Boolean(data.failed?.relationships)));
  }
  return shell;
}
