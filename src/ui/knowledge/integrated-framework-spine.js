import {
  INTEGRATED_MARKET_AI_CROSS_PAGE_SPINE,
  INTEGRATED_MARKET_AI_FRAMEWORKS
} from '../../domain/knowledge/integrated-market-ai-framework-pack.js';

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function matches(framework, query) {
  const normalized = clean(query).toLocaleLowerCase('ko-KR');
  if (!normalized) return true;
  return [framework.id, framework.title, framework.definition, framework.mechanism, framework.question, ...(framework.aliases || []), ...(framework.linkedConceptIds || [])]
    .join(' ').toLocaleLowerCase('ko-KR').includes(normalized);
}

function createSpineFlow(documentRef) {
  const flow = element(documentRef, 'ol', 'integrated-framework-flow');
  INTEGRATED_MARKET_AI_CROSS_PAGE_SPINE.forEach((step, index) => {
    const item = element(documentRef, 'li', 'integrated-framework-flow-item');
    item.dataset.aioIntegratedSpineStep = step.id;
    item.append(
      element(documentRef, 'span', 'integrated-framework-flow-index', String(index + 1).padStart(2, '0')),
      element(documentRef, 'strong', 'integrated-framework-flow-title', step.title),
      element(documentRef, 'span', 'integrated-framework-flow-copy', step.copy)
    );
    flow.appendChild(item);
  });
  return flow;
}

function createFrameworkCard(documentRef, framework, page, onNavigate) {
  const card = element(documentRef, 'article', page === 'principles' ? 'principles-chapter-card' : 'atlas-node-card');
  card.dataset.aioIntegratedFramework = framework.id;
  card.dataset.aioIntegrationMode = 'synthesized-reference';
  card.append(
    element(documentRef, 'div', page === 'principles' ? 'principles-eyebrow' : 'atlas-card-meta', `${page === 'principles' ? '시장 원리 연결 렌즈' : 'AI 자본·물리 연결 렌즈'} · 구조 참고`),
    element(documentRef, 'h3', page === 'principles' ? 'principles-learning-card-title' : 'atlas-card-title', framework.title),
    element(documentRef, 'p', page === 'principles' ? 'principles-chapter-copy' : 'atlas-card-copy', `정의: ${framework.definition}`),
    element(documentRef, 'p', page === 'principles' ? 'principles-chapter-copy' : 'atlas-card-copy', `작동 경로: ${framework.mechanism}`),
    element(documentRef, 'p', page === 'principles' ? 'principles-chapter-copy' : 'atlas-card-copy', `확인할 자료: ${framework.observables.join(' · ')}`),
    element(documentRef, 'p', page === 'principles' ? 'principles-chapter-copy principles-chapter-counter' : 'atlas-governance-note', `무효화·반대 경로: ${framework.invalidation} ${framework.counterclaim}`),
    element(documentRef, 'p', page === 'principles' ? 'principles-chapter-copy' : 'atlas-card-copy', `핵심 질문: ${framework.question}`)
  );
  const links = element(documentRef, 'div', page === 'principles' ? 'principles-learning-steps' : 'atlas-route-links');
  (framework.linkedConceptIds || []).slice(0, 4).forEach((conceptId) => links.appendChild(element(documentRef, page === 'principles' ? 'span' : 'span', page === 'principles' ? 'principles-learning-step' : 'atlas-chip', conceptId)));
  const routeButton = element(documentRef, 'button', 'integrated-framework-route', page === 'principles' ? 'AI 시대 지식 지도에서 이어 읽기' : '시장 원리에서 이어 읽기');
  routeButton.type = 'button';
  routeButton.addEventListener('click', () => onNavigate?.(page === 'principles' ? 'atlas' : 'principles'));
  links.appendChild(routeButton);
  card.appendChild(links);
  return card;
}

export function createIntegratedFrameworkSpine(documentRef, { page = 'principles', query = '', compact = false, onNavigate } = {}) {
  const safePage = page === 'atlas' ? 'atlas' : 'principles';
  const frameworks = INTEGRATED_MARKET_AI_FRAMEWORKS.filter((framework) => framework.page === safePage && matches(framework, query));
  const total = INTEGRATED_MARKET_AI_FRAMEWORKS.filter((framework) => framework.page === safePage).length;
  const view = element(documentRef, 'section', safePage === 'principles' ? 'principles-integrated-framework-spine integrated-framework-spine' : 'atlas-integrated-framework-spine integrated-framework-spine');
  view.dataset.aioIntegratedFrameworkPage = safePage;
  view.dataset.aioIntegratedFrameworkCount = String(frameworks.length);
  view.append(
    element(documentRef, 'div', safePage === 'principles' ? 'principles-eyebrow' : 'atlas-eyebrow', '통합 분석 구조'),
    element(documentRef, 'h2', safePage === 'principles' ? 'principles-reference-title' : 'atlas-section-title', safePage === 'principles' ? '시장 원리에서 AI 자본 흐름까지' : '시장 조건에서 AI 산업의 현금흐름까지'),
    element(documentRef, safePage === 'principles' ? 'p' : 'p', safePage === 'principles' ? 'principles-reference-copy' : 'atlas-card-copy', safePage === 'principles'
      ? `돈·금리·유동성·기대가 기업의 자본비용과 가격을 거쳐 AI의 물리적 병목·CAPEX·수익화로 이어지는 연결 구조입니다. ${total}개 분석 렌즈는 현재 수치나 매매 신호가 아니라 기존 학습 지도를 해석하는 질문으로 사용합니다.`
      : `AI를 모델이나 종목 하나로 보지 않고, 금융 자본의 속도·물리 병목·공급 사이클·가동률·수익화·ROIC로 연결해 읽습니다. ${total}개 분석 렌즈는 현재 주장이나 랭킹을 만들지 않고 기존 산업 지도를 해석합니다.`)
  );
  view.appendChild(createSpineFlow(documentRef));
  if (!compact) {
    const grid = element(documentRef, 'div', safePage === 'principles' ? 'principles-chapter-grid' : 'atlas-node-grid');
    frameworks.forEach((framework) => grid.appendChild(createFrameworkCard(documentRef, framework, safePage, onNavigate)));
    if (!frameworks.length) grid.appendChild(element(documentRef, 'div', safePage === 'principles' ? 'principles-empty' : 'atlas-empty', '현재 검색어와 연결되는 통합 렌즈가 없습니다.'));
    view.appendChild(grid);
  }
  const boundary = element(documentRef, 'p', safePage === 'principles' ? 'principles-reference-boundary' : 'atlas-card-copy', '표시된 내용은 구조화한 교육용 참고 프레임입니다. 현재 가격·기업 성과·정책 사실·매매 판단은 별도의 기준일 있는 근거와 사람 검토가 필요합니다.');
  view.appendChild(boundary);
  if (compact) {
    const next = element(documentRef, 'button', 'integrated-framework-route', safePage === 'principles' ? 'AI 시대 지식 지도에서 전체 연결 보기' : '시장 원리에서 전체 연결 보기');
    next.type = 'button';
    next.addEventListener('click', () => onNavigate?.(safePage === 'principles' ? 'atlas' : 'principles'));
    view.appendChild(next);
  }
  return view;
}
