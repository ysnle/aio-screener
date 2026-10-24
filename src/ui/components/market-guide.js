// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): the 오늘 guide card — the shared market-guide model (situation, the
// choices counted across the live scenarios with the opportunity cost if the reading is wrong, what to lean toward and
// avoid) and the concept layer: the principles today's data touches, each opening its lesson in the principles library,
// with the full set of principles folded below. Reads the guide stage of the shared interpretation.
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { ALL_LESSONS, LESSON_KINDS } from '../../domain/guide/lessons.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { el } from './dom.js';
import { refreshScenarioArtifacts } from './macro-crossroads.js';

function conceptButton(doc, root, lesson) {
  const button = el(doc, 'button', '개념 배우기 →', 'mg-concept-link');
  button.type = 'button';
  button.dataset.aioConceptLesson = lesson.concept;
  button.setAttribute('aria-label', `${lesson.title} — 리서치 라이브러리에서 개념 배우기`);
  button.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'principles', params: { lesson: lesson.concept } }));
  return button;
}

export function lessonItem(doc, root, lesson, { withReason = true } = {}) {
  const item = el(doc, 'li', null, 'mg-lesson');
  item.dataset.kind = lesson.kind;
  item.dataset.lessonId = lesson.id;
  const head = el(doc, 'div', null, 'mg-lesson-head');
  head.append(el(doc, 'span', LESSON_KINDS[lesson.kind], 'mg-kind'), el(doc, 'strong', lesson.title, 'mg-lesson-title'));
  item.append(head, el(doc, 'p', lesson.principle, 'mg-lesson-principle'));
  // Today's reason when the data touches the lesson; otherwise the mechanism behind it.
  item.append(withReason && lesson.reason ? el(doc, 'p', `근거: ${lesson.reason}`, 'mg-lesson-reason') : el(doc, 'p', `왜: ${lesson.why}`, 'mg-lesson-why'));
  item.append(conceptButton(doc, root, lesson));
  return item;
}

function choiceTable(doc, direction) {
  const table = el(doc, 'table', null, 'mg-choices');
  table.append(el(doc, 'caption', '선택지별 집계 — 핵심 조건을 갖춘 시나리오마다 적힌 비용 비교를 센 것(확률 아님)', 'mg-caption'));
  const head = el(doc, 'tr');
  for (const label of ['선택지', '상대적으로 유리', '비용이 큼']) { const th = el(doc, 'th', label); th.scope = 'col'; head.append(th); }
  const thead = el(doc, 'thead'); thead.append(head);
  const body = el(doc, 'tbody');
  for (const row of direction.tally) {
    const tr = el(doc, 'tr');
    if (row.key === direction.robust) tr.dataset.robust = 'true';
    const name = el(doc, 'th', row.label); name.scope = 'row';
    const list = (names) => (names.length ? `${names.length}, ${names.map((n) => `'${n}'`).join(' ')}` : '0');
    tr.append(name, el(doc, 'td', list(row.favoredIn)), el(doc, 'td', list(row.costlyIn)));
    body.append(tr);
  }
  table.append(thead, body);
  return table;
}

/** Renders (or hides) #home-guide after `anchor`; returns the model so callers and tests can read it. */
export function renderHomeGuide({ documentRef: doc, root, store = null, anchor = null, nowMs = Date.now() } = {}) {
  if (!doc || !anchor) return null;
  const guide = marketInterpretation(root, { store, nowMs }).guide || { available: false };
  let box = doc.getElementById('home-guide');
  if (!box) { box = el(doc, 'section', null, 'xr-section mg-guide'); box.id = 'home-guide'; box.setAttribute('aria-labelledby', 'home-guide-title'); }
  if (box.previousElementSibling !== anchor && typeof anchor.insertAdjacentElement === 'function') anchor.insertAdjacentElement('afterend', box);
  box.hidden = !guide.available;
  // The long-history outcomes and the per-refresh state can land after first paint; the guide is rebuilt with them.
  if (!box.dataset.aioScenarioLoad) { box.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderHomeGuide({ documentRef: doc, root, store, anchor, nowMs: Date.now() })); }
  if (!guide.available) return guide;
  const title = el(doc, 'h2', '오늘의 가이드 — 상황, 시나리오, 대응, 배울 것', 'xr-h3'); title.id = 'home-guide-title';
  const situation = el(doc, 'dl', null, 'mg-situation');
  for (const row of guide.situation) situation.append(el(doc, 'dt', row.label), el(doc, 'dd', row.text));
  const d = guide.direction;
  const costs = d.costIfWrong.length ? el(doc, 'ul', null, 'mg-costs') : null;
  for (const cost of d.costIfWrong) costs.append(el(doc, 'li', `'${cost.short}'(${cost.fit}) 쪽으로 가면 — ${cost.text}${cost.trigger ? ` 확인: ${cost.trigger}` : ''}`));
  const stance = el(doc, 'div', null, 'mg-stance');
  for (const [label, list, kind] of [['지향할 것', guide.stance.pursue, 'pursue'], ['지양할 것', guide.stance.avoid, 'avoid']]) {
    if (!list.length) continue;
    const col = el(doc, 'div', null, 'mg-stance-col'); col.dataset.kind = kind;
    const ul = el(doc, 'ul'); list.forEach((text) => ul.append(el(doc, 'li', text)));
    col.append(el(doc, 'h3', label, 'xr-h4'), ul);
    stance.append(col);
  }
  const lessons = el(doc, 'ul', null, 'mg-lessons');
  guide.lessons.forEach((lesson) => lessons.append(lessonItem(doc, root, lesson)));
  const library = el(doc, 'details', null, 'mg-library');
  library.append(el(doc, 'summary', `시장에 참여하는 원칙 전체 (${ALL_LESSONS.length}개) — 태도, 전략, 속지 말 것, 믿을 것`, 'mg-library-summary'));
  for (const kind of Object.keys(LESSON_KINDS)) {
    const group = el(doc, 'ul', null, 'mg-lessons is-library');
    ALL_LESSONS.filter((lesson) => lesson.kind === kind).forEach((lesson) => group.append(lessonItem(doc, root, lesson, { withReason: false })));
    library.append(el(doc, 'h4', LESSON_KINDS[kind], 'xr-h4'), group);
  }
  box.replaceChildren(
    title, el(doc, 'p', guide.headline, 'xr-lead'),
    ...(guide.pastConflicts || []).map((text) => el(doc, 'p', `과거 표본과 어긋남: ${text}`, 'xr-reading mg-past-conflict')),
    situation,
    el(doc, 'h3', '여러 시나리오를 함께 놓고 보면', 'xr-h4'), choiceTable(doc, d), el(doc, 'p', d.text, 'xr-reading'),
    ...(costs ? [el(doc, 'p', '이 판단이 빗나갈 때의 기회비용', 'mg-costs-label'), costs] : []),
    stance,
    el(doc, 'h3', '오늘 해당하는 원칙', 'xr-h4'), lessons, library,
    el(doc, 'p', `${guide.note} 세부 종목 선택은 차트·기업·테마·스크리너에서 직접 합니다.`, 'xr-scope-note')
  );
  box.dataset.aioMarketGuide = guide.version;
  return guide;
}
