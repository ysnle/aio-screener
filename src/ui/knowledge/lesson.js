function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function list(documentRef, values, className) {
  const ul = element(documentRef, 'ul', className);
  for (const value of values || []) ul.appendChild(element(documentRef, 'li', '', typeof value === 'string' ? value : JSON.stringify(value)));
  return ul;
}

export function renderKnowledgeLesson(documentRef, article, { className = 'knowledge-lesson' } = {}) {
  const root = element(documentRef, 'article', className);
  if (!article?.article) {
    root.appendChild(element(documentRef, 'p', 'knowledge-empty', '심층 원고를 아직 불러오지 못했습니다. 요약·근거 경계를 유지합니다.'));
    return root;
  }
  root.append(element(documentRef, 'h4', 'knowledge-lesson-title', article.title), element(documentRef, 'p', 'knowledge-lesson-boundary', '교육용 reference draft · 현재 주장·매매 지시 아님'));
  const fields = [
    ['직관', article.article.intuition], ['형식 모델 또는 정성적 근거', article.article.formalModelOrRationale?.text],
    ['실물경제 전달', article.article.realEconomyChannel], ['기업 전달', article.article.companyChannel],
    ['재무제표 전달', article.article.financialStatementChannel], ['밸류에이션 전달', article.article.valuationChannel],
    ['시장 전달', article.article.marketChannel], ['관찰 적용', article.article.tradingApplication], ['무효화 조건', article.article.invalidation]
  ];
  for (const [label, value] of fields) {
    const section = element(documentRef, 'section', 'knowledge-lesson-section');
    section.append(element(documentRef, 'h5', 'knowledge-lesson-section-title', label), element(documentRef, 'p', 'knowledge-lesson-copy', value || '확인 필요'));
    root.appendChild(section);
  }
  const example = article.article.workedExampleOrRationale;
  const exampleSection = element(documentRef, 'section', 'knowledge-lesson-section knowledge-worked-example');
  exampleSection.append(element(documentRef, 'h5', 'knowledge-lesson-section-title', 'Worked example / rationale'));
  for (const [label, value] of [['입력', example?.inputs], ['가정', example?.assumptions], ['단계', example?.steps], ['결과', example?.result], ['해석', example?.interpretation], ['실패 경계', example?.failureBoundary]]) {
    const block = element(documentRef, 'div', 'knowledge-example-block');
    block.appendChild(element(documentRef, 'strong', 'knowledge-example-label', label));
    if (Array.isArray(value)) block.appendChild(list(documentRef, value, 'knowledge-example-list'));
    else block.appendChild(element(documentRef, 'p', 'knowledge-lesson-copy', value || '확인 필요'));
    exampleSection.appendChild(block);
  }
  root.appendChild(exampleSection);
  const glossary = element(documentRef, 'section', 'knowledge-lesson-section');
  glossary.append(element(documentRef, 'h5', 'knowledge-lesson-section-title', '용어'), list(documentRef, article.article.glossary, 'knowledge-glossary-list'));
  root.appendChild(glossary);
  return root;
}
