// 리서치 라이브러리 · 개념·분석 프레임. Five kinds of document behind one table of contents:
// 분석 노트 (issue-led features), 칼럼 (the author's twelve-chapter essay), 개념 사전 (the canonical
// concepts, shared with the glossary), 원리 레슨 (A–O lessons) and 개념 지도 (the principle graph).
// Only the open group of the contents is expanded; the right column shows where the open document
// leads. No review-status, memo or source panels (owner direction 2026-10-05).
import { ROUTE_HUBS } from '../navigation/route-hubs.js';
import { LESSONS, PATHS, lessonById } from '../../domain/knowledge/learning-core.js';
import { CONCEPT_CORE } from '../../domain/knowledge/concept-core.js';
import { createResearchShell, navGroup, asideBlock, el } from './research-shell.js';
import { renderFrameArticle, renderFrameConnections, ensureFrameStyle, renderBasis } from './analysis-frames.js';

const conceptById = new Map(CONCEPT_CORE.map((concept) => [concept.id, concept]));
const CONCEPT_CATS = [...new Set(CONCEPT_CORE.map((concept) => concept.cat))];
const framesUsing = (conceptId) => LESSONS.filter((lesson) => (lesson.concepts || []).includes(conceptId));

export const CONCEPT_GROUPS = Object.freeze([
  { id: 'frames', title: '분석 노트' },
  { id: 'story', title: '칼럼 · 돈에서 주식시장까지' },
  { id: 'concept', title: '개념 사전' },
  { id: 'lesson', title: '원리 레슨' },
  { id: 'map', title: '개념 지도' }
]);

// A failed load ends in a stated failure with a retry, never an endless loading line.
function loadFailure(doc, text, key) {
  const box = el(doc, 'div', 'rl-note principles-capability-errors');
  box.setAttribute('role', 'alert');
  const retry = el(doc, 'button', 'rl-nav-item', '다시 불러오기');
  retry.type = 'button';
  retry.dataset.principlesAction = 'retry-capability';
  retry.dataset.principlesValue = key;
  box.append(el(doc, 'span', null, text), retry);
  return box;
}

function navButton(doc, label, { active = false, action, value, sub = false } = {}) {
  const node = el(doc, 'button', `rl-nav-item${sub ? ' rl-nav-sub' : ''}${active ? ' is-active' : ''}`, label);
  node.type = 'button';
  node.dataset.principlesAction = action;
  if (value != null) node.dataset.principlesValue = value;
  node.setAttribute('aria-pressed', active ? 'true' : 'false');
  return node;
}

function groupHeader(doc, group, open, count) {
  const head = navButton(doc, `${group.title}${count != null ? `  ${count}` : ''}`, { active: false, action: 'group', value: group.id });
  head.classList.add('rl-nav-group-head');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  head.removeAttribute('aria-pressed');
  return head;
}

function buildNav(doc, state, data) {
  const nav = doc.createDocumentFragment();
  const chapters = data.chapters || [];
  for (const group of CONCEPT_GROUPS) {
    const open = state.openGroup === group.id;
    const box = el(doc, 'div', 'rl-nav-group');
    const count = group.id === 'frames' ? LESSONS.length : group.id === 'story' ? chapters.length || 12 : group.id === 'concept' ? CONCEPT_CORE.length : group.id === 'lesson' ? (data.lessons?.length || 112) : null;
    box.appendChild(groupHeader(doc, group, open, count));
    if (open && group.id === 'frames') {
      for (const path of PATHS) {
        box.appendChild(el(doc, 'p', 'rl-nav-title', path.title));
        for (const id of path.lessons) {
          const lesson = lessonById(id);
          if (!lesson) continue;
          box.appendChild(navButton(doc, lesson.model ? lesson.title : lesson.issue.split(' — ')[0], { active: state.view === 'frames' && state.frameId === id, action: 'frame', value: id, sub: true }));
        }
      }
    }
    if (open && group.id === 'story') {
      if (!chapters.length) box.appendChild(data.narrativeError ? loadFailure(doc, '칼럼 목록을 불러오지 못했습니다.', 'narrative') : el(doc, 'p', 'rl-note', '불러오는 중…'));
      chapters.forEach((chapter, index) => box.appendChild(navButton(doc, `${index + 1}. ${chapter.title}`, { active: state.view === 'story' && state.chapterId === chapter.id, action: 'story-chapter', value: chapter.id, sub: true })));
    }
    if (open && group.id === 'concept') {
      for (const cat of CONCEPT_CATS) {
        box.appendChild(el(doc, 'p', 'rl-nav-title', cat));
        CONCEPT_CORE.filter((concept) => concept.cat === cat).forEach((concept) => box.appendChild(navButton(doc, concept.term, { active: state.view === 'concept' && state.conceptId === concept.id, action: 'concept', value: concept.id, sub: true })));
      }
    }
    if (open && group.id === 'lesson') {
      if (!data.lessons) box.appendChild(data.lessonLibraryError ? loadFailure(doc, '레슨 목록을 불러오지 못했습니다.', 'lessonLibrary') : el(doc, 'p', 'rl-note', '불러오는 중…'));
      for (const chapter of data.lessonChapters || []) {
        box.appendChild(el(doc, 'p', 'rl-nav-title', `${chapter.id} · ${chapter.title}`));
        (data.lessons || []).filter((lesson) => lesson.chapterId === chapter.id).forEach((lesson) => box.appendChild(navButton(doc, `${lesson.id} ${lesson.title}`, { active: state.view === 'lesson' && state.lessonId === lesson.id, action: 'select-lesson', value: lesson.id, sub: true })));
      }
    }
    if (open && group.id === 'map') {
      box.appendChild(navButton(doc, '관계 지도 — 원리 사이의 연결', { active: state.view === 'map', action: 'mode', value: 'graph', sub: true }));
    }
    nav.appendChild(box);
  }
  const switcher = doc.createElement('div');
  switcher.className = 'rl-nav-switch';
  nav.querySelectorAll('.rl-nav-group-head').forEach((head) => switcher.appendChild(head));
  nav.insertBefore(switcher, nav.firstChild);
  return nav;
}

function renderStory(doc, data, state) {
  const chapters = data.chapters || [];
  const index = Math.max(0, chapters.findIndex((chapter) => chapter.id === state.chapterId));
  const chapter = chapters[index];
  const article = el(doc, 'article', 'rl-story principles-narrative');
  if (!chapter) { article.appendChild(data.narrativeError ? loadFailure(doc, '칼럼을 불러오지 못했습니다.', 'narrative') : el(doc, 'p', 'rl-copy', '칼럼을 불러오는 중입니다.')); return article; }
  article.dataset.narrativeChapter = chapter.id;
  article.dataset.narrativeChapterIndex = String(index + 1);
  const title = el(doc, 'h2', 'rl-doc-title principles-narrative-title', chapter.title);
  title.setAttribute('tabindex', '-1');
  article.append(el(doc, 'p', 'rl-doc-kicker', `칼럼 · 제${chapter.part.index}부 ${chapter.part.title} · ${index + 1}/${chapters.length}`), title);
  if (chapter.lead) article.appendChild(el(doc, 'p', 'rl-doc-lead', chapter.lead));
  const prose = el(doc, 'div', 'af-prose principles-narrative-prose');
  (chapter.paragraphs || []).forEach((paragraph) => prose.appendChild(el(doc, 'p', null, paragraph)));
  article.appendChild(prose);
  if (chapter.chain?.length) {
    const flow = el(doc, 'div', 'af-flow');
    chapter.chain.forEach((step, i) => { if (i) flow.appendChild(el(doc, 'span', 'af-flow-arrow', '→')); flow.appendChild(el(doc, 'span', 'af-flow-step', step)); });
    article.append(el(doc, 'h3', 'af-section', '이 장의 흐름'), flow);
  }
  if (chapter.marketBridge) article.append(el(doc, 'h3', 'af-section', '기업과 주식시장에서는'), el(doc, 'p', 'af-twist', chapter.marketBridge));
  const pager = el(doc, 'div', 'rl-pager');
  if (index > 0) pager.appendChild(navButton(doc, `← ${chapters[index - 1].title}`, { action: 'story-chapter', value: chapters[index - 1].id }));
  if (index < chapters.length - 1) pager.appendChild(navButton(doc, `${chapters[index + 1].title} →`, { action: 'story-chapter', value: chapters[index + 1].id }));
  article.appendChild(pager);
  return article;
}

function renderConcept(doc, concept, story = null) {
  const article = el(doc, 'article', 'af-article');
  article.dataset.conceptDoc = concept.id;
  article.append(el(doc, 'p', 'af-kicker', `개념 사전 · ${concept.cat}`), el(doc, 'h2', 'af-issue', concept.term));
  if (story) {
    article.appendChild(el(doc, 'p', 'af-lead', story.lead));
    const definition = el(doc, 'div', 'af-definition');
    definition.append(el(doc, 'strong', null, '정의'), el(doc, 'p', null, concept.def));
    article.appendChild(definition);
    const prose = el(doc, 'div', 'af-prose');
    prose.appendChild(el(doc, 'p', null, story.use));
    article.appendChild(prose);
    if (story.table) article.appendChild(storyTable(doc, story.table));
    article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', story.twist));
  } else {
    article.appendChild(el(doc, 'p', 'af-lead', concept.def));
  }
  const terms = conceptTermList(doc, concept);
  if (terms) article.appendChild(terms);
  const basis = renderBasis(doc, { sources: concept.sources || [], assumptions: story?.table ? ['표의 숫자는 개념을 보여 주기 위한 가상 예시다.'] : [] });
  if (basis) article.appendChild(basis);
  return article;
}

// A worked table under the story (e.g. the 2×2 behind a signal's hit rate). Hypothetical numbers say so in the caption.
function storyTable(doc, spec) {
  const wrap = el(doc, 'figure', 'af-table');
  const table = el(doc, 'table');
  if (spec.caption) table.appendChild(el(doc, 'caption', null, spec.caption));
  const head = el(doc, 'tr');
  spec.head.forEach((cell) => head.appendChild(el(doc, 'th', null, cell)));
  const thead = el(doc, 'thead');
  thead.appendChild(head);
  const tbody = el(doc, 'tbody');
  spec.rows.forEach((row) => { const tr = el(doc, 'tr'); row.forEach((cell, i) => tr.appendChild(el(doc, i ? 'td' : 'th', null, cell))); tbody.appendChild(tr); });
  table.append(thead, tbody);
  wrap.appendChild(table);
  if (spec.notes?.length) { const list = el(doc, 'ul', 'af-links'); spec.notes.forEach((note) => list.appendChild(el(doc, 'li', null, note))); wrap.appendChild(list); }
  return wrap;
}

// Codex review 2026-10-05: one "same word" list mixed synonyms with components, related and opposite
// concepts. Three labelled rows instead; a name that is itself a dictionary concept opens it.
const conceptByName = new Map();
for (const item of CONCEPT_CORE) for (const name of [item.term, item.term.replace(/\s*\(.*$/, ''), ...item.aliases, ...(item.covers || [])]) if (!conceptByName.has(name)) conceptByName.set(name, item);
function conceptTermList(doc, concept) {
  const rows = [['같은 뜻', concept.aliases], ['이 글에서 다루는 용어', concept.covers], ['관련 개념', concept.related], ['헷갈리기 쉬운 개념', concept.contrast]].filter(([, list]) => list?.length);
  if (!rows.length) return null;
  const dl = el(doc, 'dl', 'af-terms');
  for (const [label, list] of rows) {
    const dd = el(doc, 'dd');
    list.forEach((name, i) => {
      if (i) dd.appendChild(doc.createTextNode(' · '));
      const target = label === '같은 뜻' || label === '이 글에서 다루는 용어' ? null : conceptByName.get(name.replace(/\s*\(.*$/, '')) || conceptByName.get(name);
      if (target && target.id !== concept.id) {
        const link = el(doc, 'button', 'af-term-link', name);
        link.type = 'button';
        link.dataset.principlesAction = 'concept';
        link.dataset.principlesValue = target.id;
        dd.appendChild(link);
      } else dd.appendChild(doc.createTextNode(name));
    });
    dl.append(el(doc, 'dt', null, label), dd);
  }
  return dl;
}

function renderLesson(doc, lesson, failed = false, sources = []) {
  const article = el(doc, 'article', 'af-article');
  if (!lesson) { article.appendChild(failed ? loadFailure(doc, '레슨을 불러오지 못했습니다.', 'lessonLibrary') : el(doc, 'p', 'rl-copy', '레슨을 불러오는 중입니다.')); return article; }
  article.dataset.principlesLessonId = lesson.id;
  const story = lesson.story || null;
  article.append(el(doc, 'p', 'af-kicker', `원리 레슨 · ${lesson.id}`), el(doc, 'h2', 'af-issue', lesson.title), el(doc, 'p', 'af-lead', story?.lead || lesson.definition));
  const prose = el(doc, 'div', 'af-prose');
  (story?.body || [lesson.mechanism, lesson.example]).filter(Boolean).forEach((text) => prose.appendChild(el(doc, 'p', null, text)));
  article.appendChild(prose);
  if (lesson.diagram) {
    const flow = el(doc, 'div', 'af-flow');
    String(lesson.diagram).split('→').map((step) => step.trim()).filter(Boolean).forEach((step, i) => { if (i) flow.appendChild(el(doc, 'span', 'af-flow-arrow', '→')); flow.appendChild(el(doc, 'span', 'af-flow-step', step)); });
    article.append(el(doc, 'h3', 'af-section', '흐름으로 보면'), flow);
  }
  const twist = story?.twist || lesson.counterScenario;
  if (twist) article.append(el(doc, 'h3', 'af-section', '자주 빗나가는 해석'), el(doc, 'p', 'af-twist', twist));
  const byId = new Map(sources.map((source) => [source.id, source]));
  const lessonSources = (lesson.sourceIds || []).map((id) => byId.get(id)).filter(Boolean).map((source) => ({ label: source.label || source.title, url: source.url, supports: lesson.sourceScope === 'chapter-background' ? '이 장 전체의 배경 자료' : '이 레슨의 주제 자료' }));
  const basis = renderBasis(doc, { sources: lessonSources, asOf: lesson.reviewedAt || null });
  if (basis) article.appendChild(basis);
  return article;
}

// Concepts a lesson leans on, found by their names in the lesson text — the reader's "먼저 알아둘 개념".
function conceptsInLesson(lesson) {
  const text = [lesson.title, lesson.definition, lesson.mechanism, ...(lesson.story?.body || []), lesson.story?.lead].filter(Boolean).join(' ');
  return CONCEPT_CORE.filter((concept) => [concept.term.replace(/\s*\(.*$/, ''), ...concept.aliases, ...(concept.covers || [])].some((name) => name.length >= 2 && !/^[a-z]/.test(name) && text.includes(name))).slice(0, 5);
}

export function renderConceptsPage(doc, { root, state, data, renderMap, mapAside, onLocal, onNavigate, onConcept }) {
  ensureFrameStyle(doc);
  const { shell, nav, main, aside } = createResearchShell(doc, { root, route: 'principles', onLocal });
  shell.dataset.principlesView = state.view;
  nav.appendChild(buildNav(doc, state, data));
  const block = (title) => asideBlock(doc, title);
  if (state.view === 'frames') {
    const lesson = lessonById(state.frameId) || LESSONS[0];
    main.appendChild(renderFrameArticle(doc, lesson));
    renderFrameConnections(doc, lesson, { onNavigate, onConcept, block }).forEach((node) => aside.appendChild(node));
  } else if (state.view === 'story') {
    main.appendChild(renderStory(doc, data, state));
    const chapter = (data.chapters || []).find((item) => item.id === state.chapterId);
    if (chapter?.routeTarget?.routeId) {
      const next = block('이어서 볼 화면');
      const link = el(doc, 'button', 'af-route');
      link.type = 'button';
      const hub = ROUTE_HUBS.find((item) => item.routes.some((r) => r.id === chapter.routeTarget.routeId));
      const routeName = hub?.routes.find((r) => r.id === chapter.routeTarget.routeId)?.label || '';
      link.append(el(doc, 'strong', null, chapter.routeTarget.label || chapter.routeTarget.routeLabel || routeName), el(doc, 'span', null, [hub?.label, routeName].filter((name, i, all) => name && all.indexOf(name) === i).join(' · ')));
      link.addEventListener('click', () => onNavigate?.({ ...chapter.routeTarget, returnContext: { route: 'principles', mode: 'story', chapter: chapter.id } }));
      next.appendChild(link);
      aside.appendChild(next);
    }
    const related = LESSONS.filter((lesson) => lesson.columnNote).slice(0, 4);
    const notes = block('관련 분석 노트');
    related.forEach((lesson) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'frame'; b.dataset.principlesValue = lesson.id; b.append(el(doc, 'strong', null, lesson.issue)); notes.appendChild(b); });
    aside.appendChild(notes);
  } else if (state.view === 'concept') {
    const concept = conceptById.get(state.conceptId) || CONCEPT_CORE[0];
    main.appendChild(renderConcept(doc, concept, data.conceptStories?.[concept.id] || null));
    const frames = framesUsing(concept.id);
    if (frames.length) {
      const box = block('이 개념이 쓰이는 분석 노트');
      frames.forEach((lesson) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'frame'; b.dataset.principlesValue = lesson.id; b.append(el(doc, 'strong', null, lesson.issue)); box.appendChild(b); });
      aside.appendChild(box);
    }
    const near = CONCEPT_CORE.filter((item) => item.cat === concept.cat && item.id !== concept.id).slice(0, 6);
    if (near.length) {
      const box = block(`같은 분야 · ${concept.cat}`);
      near.forEach((item) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'concept'; b.dataset.principlesValue = item.id; b.append(el(doc, 'strong', null, item.term)); box.appendChild(b); });
      aside.appendChild(box);
    }
  } else if (state.view === 'lesson') {
    const lesson = (data.lessons || []).find((item) => item.id === state.lessonId) || null;
    main.appendChild(renderLesson(doc, lesson, Boolean(data.lessonLibraryError), data.lessonSources || []));
    if (lesson) {
      // Codex review 2026-10-05: the column listed the whole chapter including the open lesson. It now
      // answers what to read before, what comes next, which concepts the lesson uses and where to test it.
      const lessonButton = (item) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'select-lesson'; b.dataset.principlesValue = item.id; b.append(el(doc, 'strong', null, `${item.id} ${item.title}`)); return b; };
      const siblings = (data.lessons || []).filter((item) => item.chapterId === lesson.chapterId);
      const at = siblings.findIndex((item) => item.id === lesson.id);
      // Codex browser audit H86: the previous lesson in the contents was labelled "먼저 읽을 레슨" (O5 tax costs
      // → O4 Korean power policy). Order and prerequisite are separate: declared prerequisites first, then the
      // neighbouring lessons named as contents order.
      const prereqIds = (lesson.prerequisites || lesson.metadata?.prerequisites || []).map((item) => String(item).split(' ')[0]).filter((id) => /^[A-O]d{1,2}$/.test(id));
      const prereqs = prereqIds.map((id) => (data.lessons || []).find((item) => item.id === id)).filter(Boolean);
      if (prereqs.length) { const box = block('먼저 알아둘 레슨'); prereqs.forEach((item) => box.appendChild(lessonButton(item))); aside.appendChild(box); }
      if (at > 0 || (at >= 0 && at < siblings.length - 1)) {
        const box = block('목차 순서');
        if (at > 0) box.appendChild(lessonButton(siblings[at - 1]));
        if (at >= 0 && at < siblings.length - 1) box.appendChild(lessonButton(siblings[at + 1]));
        aside.appendChild(box);
      }
      const concepts = conceptsInLesson(lesson);
      if (concepts.length) {
        const box = block('먼저 알아둘 개념');
        concepts.forEach((item) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'concept'; b.dataset.principlesValue = item.id; b.append(el(doc, 'strong', null, item.term)); box.appendChild(b); });
        aside.appendChild(box);
      }
      const notes = LESSONS.filter((frame) => concepts.some((concept) => (frame.concepts || []).includes(concept.id))).slice(0, 3);
      if (notes.length) {
        const box = block('이 원리를 적용한 분석 노트');
        notes.forEach((frame) => { const b = el(doc, 'button', 'af-route'); b.type = 'button'; b.dataset.principlesAction = 'frame'; b.dataset.principlesValue = frame.id; b.append(el(doc, 'strong', null, frame.model ? frame.title : frame.issue.split(' — ')[0])); box.appendChild(b); });
        aside.appendChild(box);
      }
      const others = siblings.filter((item) => item.id !== lesson.id);
      if (others.length > 2) {
        const box = block('같은 장의 다른 레슨');
        others.forEach((item) => box.appendChild(lessonButton(item)));
        aside.appendChild(box);
      }
    }
  } else if (state.view === 'map') {
    main.appendChild(renderMap());
    (mapAside?.(block) || []).forEach((node) => aside.appendChild(node));
  }
  return shell;
}
