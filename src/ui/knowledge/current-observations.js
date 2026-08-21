function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatObservedAt(value) {
  if (!value) return '기준일 확인 필요';
  const normalized = String(value).replace('T', ' ').replace('Z', ' UTC');
  return normalized.length > 19 ? normalized.slice(0, 19) : normalized;
}

function currentObservationMatches(observation, page, context = {}) {
  if (!observation || !Array.isArray(observation.pageTargets) || !observation.pageTargets.includes(page)) return false;
  const requestedIds = [
    ...(Array.isArray(context.nodeIds) ? context.nodeIds : []),
    context.nodeId,
    context.lessonId
  ].filter(Boolean);
  if (!requestedIds.length) return !observation.nodeIds?.length;
  if (!observation.nodeIds?.length) return false;
  return requestedIds.some((id) => observation.nodeIds.includes(id));
}

export function createCurrentObservationBlock(documentRef, artifact, { page, nodeIds = [], nodeId = '', lessonId = '', title = '실제 관측값' } = {}) {
  const observations = (artifact?.observations || []).filter((item) => currentObservationMatches(item, page, { nodeIds, nodeId, lessonId }));
  const block = element(documentRef, 'section', 'knowledge-current-observations');
  block.dataset.knowledgeCurrentObservations = 'connected';
  block.dataset.knowledgeCurrentObservationCount = String(observations.length);
  block.append(
    element(documentRef, 'div', 'knowledge-current-observations-eyebrow', 'DATA SNAPSHOT · REFERENCE LAYER'),
    element(documentRef, 'h4', 'knowledge-current-observations-title', title),
    element(documentRef, 'p', 'knowledge-current-observations-boundary', observations.length
      ? '선택한 개념에 직접 연결된 기준일·출처·허용 용도의 참고값만 표시합니다. 현재 가격·목표가·매매 신호가 아닙니다.'
      : '이 개념에 직접 연결된 관측값은 아직 없습니다. 전체 시장 수치로 확대 해석하지 말고, 연결 그래프와 원문 출처를 따라가세요.')
  );
  const grid = element(documentRef, 'div', 'knowledge-current-observations-grid');
  observations.forEach((observation) => {
    const card = element(documentRef, 'article', 'knowledge-current-observation-card');
    card.dataset.knowledgeObservationId = observation.id;
    card.dataset.knowledgeObservationSourceKind = observation.sourceKind || '';
    card.dataset.knowledgeObservationAllowedUse = observation.allowedUse || '';
    const value = element(documentRef, 'strong', 'knowledge-current-observation-value', observation.displayValue ?? String(observation.value ?? '—'));
    const meta = element(documentRef, 'div', 'knowledge-current-observation-meta', `${observation.label} · ${observation.unit || '단위 미상'}`);
    const provenance = element(documentRef, 'p', 'knowledge-current-observation-provenance', `${observation.sourceKind || 'SOURCE'} · ${observation.allowedUse || 'reference-only'} · 관측 ${formatObservedAt(observation.observedAt)}`);
    const source = element(documentRef, 'a', 'knowledge-current-observation-source', observation.source || observation.sourceId || '출처 보기');
    source.href = observation.sourceUrl || '#';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.title = `${observation.sourceId || ''} · ${observation.source || ''}`;
    card.append(value, meta, provenance, source);
    grid.appendChild(card);
  });
  if (!observations.length) grid.appendChild(element(documentRef, 'p', 'knowledge-current-observations-empty', '이 개념에 직접 연결된 관측값이 아직 없습니다. 구조적 설명과 출처 원장을 먼저 확인하세요.'));
  block.appendChild(grid);
  return block;
}

export function validateCurrentObservationsArtifact(artifact) {
  const rows = Array.isArray(artifact?.observations) ? artifact.observations : [];
  return rows.every((row) => row.id && row.label && row.displayValue != null && row.unit && row.observedAt && row.sourceId && row.sourceKind && row.allowedUse && Array.isArray(row.pageTargets) && row.pageTargets.length);
}
