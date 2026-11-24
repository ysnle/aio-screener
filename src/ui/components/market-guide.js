import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { ALL_LESSONS, LESSON_KINDS } from '../../domain/guide/lessons.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { el } from './dom.js';
import { kindFold } from './indicator-face.js';
import { refreshScenarioArtifacts } from './macro-crossroads.js';
import { CHOICE_WORDS } from '../../domain/content/choice-words.js';
import { withRebound } from '../../domain/guide/market-guide.js';

// A principle today's data touches: its title, which opens it in 리서치 라이브러리 › 참여 원칙 (the principle and its
// mechanism are written there); today's reason is the link's hover.
function lessonItem(doc, root, lesson) {
  const item = el(doc, 'li', null, 'mg-lesson-line');
  item.dataset.kind = lesson.kind;
  item.dataset.lessonId = lesson.id;
  const button = el(doc, 'button', `${lesson.title} →`, 'flow-next-link');
  button.type = 'button';
  button.title = `${LESSON_KINDS[lesson.kind]}. 근거: ${lesson.reason}`;
  button.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'rules', node: lesson.id } }));
  item.append(button);
  return item;
}

function stance(doc, stanceModel, note) {
  if (!stanceModel?.pursue?.length && !stanceModel?.avoid?.length) return null;
  const box = el(doc, 'div', null, 'mg-stance');
  for (const [title, rows, cls] of [['기울일 쪽', stanceModel.pursue || [], 'is-pursue'], ['피할 쪽', stanceModel.avoid || [], 'is-avoid']]) {
    if (!rows.length) continue;
    const col = el(doc, 'div', null, `mg-stance__col ${cls}`);
    const h = el(doc, 'h4', title, 'mg-stance__title');
    if (note) h.title = note;
    const list = el(doc, 'ul');
    for (const text of rows) list.append(el(doc, 'li', text));
    col.append(h, list);
    box.append(col);
  }
  return box;
}

function choiceTable(doc, direction) {
  const table = el(doc, 'table', null, 'mg-choices');
  table.append(el(doc, 'caption', '선택지별 집계 — 선두와 조건이 절반 이상 맞는 시나리오마다 적힌 비용 비교를 센 것(확률 아님)', 'mg-caption'));
  const head = el(doc, 'tr');
  for (const label of ['선택지', CHOICE_WORDS.favoredState, CHOICE_WORDS.costlyState]) { const th = el(doc, 'th', label); th.scope = 'col'; head.append(th); }
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

// The rebound's stance first: its state word, then what each stance costs (rebound.js).
function reboundLine(doc, rebound) {
  const p = el(doc, 'p', null, 'xr-reading mg-rebound');
  p.append(el(doc, 'b', rebound.word), doc.createTextNode(` — ${rebound.text}`));
  return p;
}

/** Renders (or hides) #home-guide after `anchor`; returns the model so callers and tests can read it. */
// `rebound`: the opening's rebound (market-story.js), handed in once the closes are read; a repaint without it keeps the last.
export function renderHomeGuide({ documentRef: doc, root, store = null, anchor = null, nowMs = Date.now(), rebound } = {}) {
  if (!doc || !anchor) return null;
  let box = doc.getElementById('home-guide');
  if (!box) { box = el(doc, 'section', null, 'xr-section mg-guide'); box.id = 'home-guide'; box.setAttribute('aria-labelledby', 'home-guide-title'); }
  if (rebound !== undefined) box.__aioRebound = rebound;
  const guide = withRebound(marketInterpretation(root, { store, nowMs }).guide || { available: false }, box.__aioRebound);
  if (box.previousElementSibling !== anchor && typeof anchor.insertAdjacentElement === 'function') anchor.insertAdjacentElement('afterend', box);
  box.hidden = !guide.available;
  // The long-history outcomes and the per-refresh state can land after first paint; the guide is rebuilt with them.
  if (!box.dataset.aioScenarioLoad) { box.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderHomeGuide({ documentRef: doc, root, store, anchor, nowMs: Date.now() })); }
  if (!guide.available) return guide;
  const title = el(doc, 'h2', '오늘의 가이드', 'xr-h3'); title.id = 'home-guide-title';
  const d = guide.direction;
  const costs = d.costIfWrong.length ? el(doc, 'ul', null, 'mg-costs') : null;
  for (const cost of d.costIfWrong) costs.append(el(doc, 'li', `'${cost.short}'(${cost.fit}) 쪽으로 가면 — ${cost.text}${cost.trigger ? ` 확인: ${cost.trigger}` : ''}`));
  const lean = stance(doc, guide.stance, guide.note);
  const today = guide.lessons.filter((lesson) => lesson.reason).slice(0, 3); // the rest are in the library list linked below
  const lessons = today.length ? el(doc, 'ul', null, 'mg-lessons') : null;
  today.forEach((lesson) => lessons.append(lessonItem(doc, root, lesson)));
  const library = el(doc, 'button', `참여 원칙 전체 ${ALL_LESSONS.length}개 → 리서치 라이브러리`, 'flow-next-link mg-library-link');
  library.type = 'button';
  library.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'rules' } }));
  const tallyOpen = !!box.querySelector('.mg-choices-fold')?.open;
  const tally = kindFold(doc, 'raw-table', '선택지별 집계', [choiceTable(doc, d)]);
  tally.className += ' mg-choices-fold';
  tally.open = tallyOpen;
  box.replaceChildren(
    title,
    ...(guide.pastConflicts || []).map((text) => el(doc, 'p', `과거 표본과 어긋남: ${text}`, 'xr-reading mg-past-conflict')),
    ...(guide.rebound ? [reboundLine(doc, guide.rebound)] : []),
    el(doc, 'h3', '여러 시나리오를 함께 놓고 보면', 'xr-h4'), el(doc, 'p', d.text, 'xr-reading'), tally,
    ...(costs ? [el(doc, 'p', '이 판단이 빗나갈 때의 기회비용', 'mg-costs-label'), costs] : []),
    ...(lean ? [lean] : []),
    ...(lessons ? [el(doc, 'h3', '오늘 해당하는 원칙', 'xr-h4'), lessons] : []), library,
    el(doc, 'p', `${guide.note} 세부 종목 선택은 차트·기업·테마·스크리너에서 직접 합니다.`, 'xr-scope-note')
  );
  box.dataset.aioMarketGuide = guide.version;
  return guide;
}
