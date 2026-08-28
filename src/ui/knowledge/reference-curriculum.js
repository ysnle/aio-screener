import { applySafeExternalLink } from './safe-external-link.js';

function element(documentRef, tag, className, text = '') {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function button(documentRef, className, text, onClick) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function appendList(documentRef, parent, items, className) {
  const list = element(documentRef, 'ul', className);
  (items || []).forEach((item) => list.appendChild(element(documentRef, 'li', '', item)));
  parent.appendChild(list);
}

function sourceLinks(documentRef, sourceNotes, sourceIds) {
  const wrap = element(documentRef, 'div', 'principles-reference-sources');
  (sourceIds || []).map((id) => sourceNotes.find((source) => source.id === id)).filter(Boolean).forEach((source) => {
    const link = element(documentRef, 'a', 'principles-reference-source', `${source.id} · ${source.title}`);
    applySafeExternalLink(link, source.url);
    wrap.appendChild(link);
  });
  return wrap;
}

export function createReferenceCurriculum(documentRef, artifact, { activeStageId, activeLessonId, onStageSelect = () => {}, onLessonSelect = () => {}, onNavigate = () => {} } = {}) {
  const section = element(documentRef, 'section', 'principles-reference-curriculum');
  section.dataset.principlesReferenceStatus = artifact?.status || 'unavailable';
  if (!artifact?.stages?.length) {
    section.append(
      element(documentRef, 'div', 'principles-eyebrow', '시장 학습 시스템'),
      element(documentRef, 'h2', 'principles-reference-title', '단계별 학습 루프를 불러오는 중'),
      element(documentRef, 'p', 'principles-reference-boundary', '원고 연결이 완료되면 0단계부터 10단계까지의 질문·증거·행동·무효화 구조가 표시됩니다.')
    );
    return section;
  }

  const stages = artifact.stages;
  const stage = stages.find((item) => item.id === activeStageId) || stages[0];
  const lesson = stage.lessons.find((item) => item.id === activeLessonId) || stage.lessons[0];
  const header = element(documentRef, 'header', 'principles-reference-header');
  header.append(
    element(documentRef, 'div', 'principles-eyebrow', '공개 아티클에서 추출한 재사용 프레임'),
    element(documentRef, 'h2', 'principles-reference-title', '10단계 시장 학습 루프'),
    element(documentRef, 'p', 'principles-reference-copy', '읽기에서 시작해 시장 구조·종목 선정·포지션 관리·복기로 이어지는 순환형 커리큘럼입니다. 원문 주장의 일시적 숫자나 특정 종목은 런타임 데이터로 복사하지 않고, 검증 가능한 질문과 경계만 연결했습니다.'),
    element(documentRef, 'p', 'principles-reference-boundary', artifact.boundary)
  );

  const loop = element(documentRef, 'ol', 'principles-reference-loop');
  (artifact.decisionLoop || []).forEach((item, index) => {
    const loopItem = element(documentRef, 'li', 'principles-reference-loop-item');
    loopItem.append(element(documentRef, 'span', 'principles-reference-loop-index', String(index + 1).padStart(2, '0')), element(documentRef, 'strong', '', item.label), element(documentRef, 'span', '', item.question));
    loop.appendChild(loopItem);
  });
  header.appendChild(loop);

  const stageNav = element(documentRef, 'div', 'principles-reference-stage-nav');
  stageNav.setAttribute('role', 'tablist');
  stageNav.setAttribute('aria-label', '단계별 시장 학습');
  stages.forEach((item) => {
    const tab = button(documentRef, `principles-reference-stage-tab${item.id === stage.id ? ' is-active' : ''}`, `${item.number}단계 · ${item.title}`, () => onStageSelect(item.id));
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', item.id === stage.id ? 'true' : 'false');
    tab.dataset.principlesReferenceStage = item.id;
    stageNav.appendChild(tab);
  });

  const body = element(documentRef, 'div', 'principles-reference-body');
  const stageIntro = element(documentRef, 'div', 'principles-reference-stage-intro');
  stageIntro.append(
    element(documentRef, 'div', 'principles-eyebrow', `${String(stage.number).padStart(2, '0')} · 단계 목표`),
    element(documentRef, 'h3', 'principles-reference-stage-title', stage.title),
    element(documentRef, 'p', 'principles-reference-stage-objective', stage.objective)
  );
  appendList(documentRef, stageIntro, stage.questions, 'principles-reference-questions');
  const lessonNav = element(documentRef, 'div', 'principles-reference-lesson-nav');
  stage.lessons.forEach((item) => {
    const lessonButton = button(documentRef, `principles-reference-lesson-tab${item.id === lesson.id ? ' is-active' : ''}`, item.title, () => onLessonSelect(stage.id, item.id));
    lessonButton.setAttribute('aria-pressed', item.id === lesson.id ? 'true' : 'false');
    lessonNav.appendChild(lessonButton);
  });
  stageIntro.appendChild(lessonNav);

  const detail = element(documentRef, 'article', 'principles-reference-detail');
  detail.append(
    element(documentRef, 'div', 'principles-eyebrow', '관측 → 해석 → 행동 → 무효화'),
    element(documentRef, 'h4', 'principles-reference-lesson-title', lesson.title),
    element(documentRef, 'p', 'principles-reference-framework', lesson.framework)
  );
  const mechanism = element(documentRef, 'div', 'principles-reference-mechanism');
  mechanism.append(element(documentRef, 'strong', '', '작동 구조'), element(documentRef, 'p', '', lesson.mechanism));
  const invalidation = element(documentRef, 'div', 'principles-reference-invalidation');
  invalidation.append(element(documentRef, 'strong', '', '무효화·주의'), element(documentRef, 'p', '', lesson.invalidation));
  detail.append(mechanism, invalidation, sourceLinks(documentRef, artifact.sourceNotes || [], lesson.sourceIds));
  if (lesson.routeTarget?.routeId) {
    detail.appendChild(button(documentRef, 'principles-reference-route', `${lesson.routeTarget.routeId} 화면에서 맥락 확인`, () => onNavigate(lesson.routeTarget)));
  }

  body.append(stageIntro, detail);
  const sourceProfile = element(documentRef, 'details', 'principles-reference-provenance');
  sourceProfile.appendChild(element(documentRef, 'summary', '', `${artifact.sourceProfile?.sourceName || '공개 자료'} · 원문 출처와 적용 경계`));
  const sourceBody = element(documentRef, 'div', 'principles-reference-provenance-body');
  sourceBody.append(element(documentRef, 'p', '', `${artifact.sourceProfile?.author || '출처 저자'} · 검토 ${artifact.revision || '기준일 확인 필요'} · ${artifact.sourceProfile?.sourceType || 'REFERENCE'}`));
  sourceBody.appendChild(sourceLinks(documentRef, artifact.sourceNotes || [], (artifact.sourceNotes || []).map((item) => item.id)));
  sourceProfile.appendChild(sourceBody);
  section.append(header, stageNav, body, sourceProfile);
  return section;
}
