import { SUPPLIED_MATERIALS_REFERENCE } from '../../domain/research/supplied-materials.js';

function element(documentRef, tag, className, text = '') {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function appendLabelValue(documentRef, parent, label, value) {
  const line = element(documentRef, 'p', 'aio-reference-bridge-meta');
  line.append(element(documentRef, 'strong', '', `${label}: `), element(documentRef, 'span', '', value || '—'));
  parent.appendChild(line);
}

function renderAudit(documentRef, parent) {
  const audits = SUPPLIED_MATERIALS_REFERENCE.sourceAudit || [];
  const current = audits.find((item) => item.id === 'packet-2026-09-12') || audits.find((item) => item.id === 'packet-2026-09-11') || audits.find((item) => item.id === 'packet-2026-09-05') || audits.find((item) => item.id === 'packet-2026-08-30');
  const audit = element(documentRef, 'details', 'aio-reference-bridge-audit');
  audit.appendChild(element(documentRef, 'summary', '', `자료 감사 · ${current?.label || 'source packet'} · 확인 ${current?.readableCount ?? '—'} · 미확인/차단 ${current?.blockedCount ?? '—'}`));
  audits.forEach((item) => {
    const row = element(documentRef, 'div', 'aio-reference-bridge-audit-row');
    appendLabelValue(documentRef, row, item.label, `${item.status} · ${item.note}`);
    audit.appendChild(row);
  });
  parent.appendChild(audit);
}

function renderSourceTimeline(documentRef, parent) {
  const observations = SUPPLIED_MATERIALS_REFERENCE.sourceObservations || [];
  if (!observations.length) return;
  const details = element(documentRef, 'details', 'aio-reference-bridge-source-timeline');
  details.appendChild(element(documentRef, 'summary', '', `게시 시각·출처 타임라인 · ${observations.length}개 직접 확인`));
  const grid = element(documentRef, 'div', 'aio-reference-bridge-source-timeline-grid');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px;margin-top:9px;';
  observations.forEach((item) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-source-timeline-card');
    card.dataset.sourceObservationId = item.id;
    card.dataset.sourceKind = item.sourceKind || 'REFERENCE';
    card.style.cssText = 'padding:9px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    const link = element(documentRef, 'a', '', item.author || item.id);
    link.href = item.sourceUrl || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(
      link,
      element(documentRef, 'p', '', `${item.publishedAtKst || item.publishedAt || '시각 미확인'} KST`),
      element(documentRef, 'p', '', item.quotedPublishedAtKst ? `인용 원문: ${item.quotedPublishedAtKst} KST` : ''),
      element(documentRef, 'p', '', item.summary || '—')
    );
    grid.appendChild(card);
  });
  details.appendChild(grid);
  parent.appendChild(details);
}

function renderMediaAudit(documentRef, parent) {
  const media = SUPPLIED_MATERIALS_REFERENCE.mediaAudit || [];
  if (!media.length) return;
  const details = element(documentRef, 'details', 'aio-reference-bridge-media-audit');
  details.appendChild(element(documentRef, 'summary', '', `이미지·미디어 감사 · ${media.length}개 항목`));
  media.forEach((item) => {
    const row = element(documentRef, 'div', 'aio-reference-bridge-media-row');
    appendLabelValue(documentRef, row, item.label || item.id, `${item.status} · ${item.note}${item.count ? ` · ${item.count}개` : ''}`);
    if (item.sourceRef) row.dataset.sourceRef = item.sourceRef;
    details.appendChild(row);
  });
  parent.appendChild(details);
}

function renderClaimLedger(documentRef, parent) {
  const ledger = SUPPLIED_MATERIALS_REFERENCE.claimLedger;
  const claims = Array.isArray(ledger?.claims) ? ledger.claims : [];
  if (!claims.length) return;
  const details = element(documentRef, 'details', 'aio-reference-bridge-claim-ledger');
  details.dataset.claimLedgerVersion = ledger.schemaVersion || 'unknown';
  details.appendChild(element(documentRef, 'summary', '', `claim-level 분석 원장 · ${claims.length}개 요소 · ${ledger.schemaVersion || 'reference'}`));
  details.appendChild(element(documentRef, 'p', 'aio-reference-bridge-boundary', ledger.coverageBoundary || '현재 패킷의 claim 범위만 포함합니다.'));
  const grid = element(documentRef, 'div', 'aio-reference-bridge-claim-grid');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:9px;';
  claims.forEach((claim) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-claim-card');
    card.dataset.claimId = claim.id;
    card.dataset.claimType = claim.claimType || 'reference';
    card.dataset.status = claim.status || 'unverified';
    card.style.cssText = 'padding:11px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    card.append(
      element(documentRef, 'h3', 'aio-reference-bridge-card-title', claim.materialElement || claim.id),
      element(documentRef, 'p', 'aio-reference-bridge-card-sources', `분류: ${claim.claimType || 'reference'} · 상태: ${claim.status || 'unverified'} · 자료: ${(claim.sourceRefs || []).join(' · ')}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-thesis', `관찰: ${claim.observation || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-thesis', `논리/전환: ${claim.thesisLogic || '—'} / ${claim.paradigmShift || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `전달 경로: ${claim.mechanism || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `차트·전략: ${claim.chartTechnique || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `입력·시계열: ${(claim.indicatorInputs || []).join(' · ')} · ${claim.timeframe || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `확인: ${claim.confirmation || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `무효화: ${claim.invalidation || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `반대/한계: ${claim.counterclaim || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-sources', `소비 허용: ${(claim.allowedConsumers || []).join(' · ')} · 차단: ${(claim.blockedConsumers || []).join(' · ')}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `현재성 경계: ${claim.currentnessBoundary || '—'}`)
    );
    grid.appendChild(card);
  });
  details.appendChild(grid);
  parent.appendChild(details);
}

function renderTimeSeries(documentRef, parent, timeSeriesIds) {
  const selected = unique(timeSeriesIds);
  if (!selected.length) return;
  const series = SUPPLIED_MATERIALS_REFERENCE.timeSeries.filter((item) => selected.includes(item.id));
  if (!series.length) return;
  const details = element(documentRef, 'details', 'aio-reference-bridge-timeseries');
  details.dataset.aioSuppliedMaterialTimeseries = selected.join(',');
  details.appendChild(element(documentRef, 'summary', '', `시계열 정렬 · ${series.length}개 관측창`));
  const grid = element(documentRef, 'div', 'aio-reference-bridge-timeseries-grid');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:9px;';
  series.forEach((item) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-timeseries-card');
    card.dataset.timeSeriesId = item.id;
    card.dataset.sourceKind = item.sourceKind;
    card.dataset.operationalUse = item.operationalUse;
    card.style.cssText = 'padding:9px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    card.append(
      element(documentRef, 'strong', '', item.label),
      element(documentRef, 'p', '', `${item.window} · ${item.cadence}`),
      element(documentRef, 'p', '', `측정: ${item.metrics.join(' · ')}`),
      element(documentRef, 'p', '', `정렬: ${item.alignment}`)
    );
    grid.appendChild(card);
  });
  details.appendChild(grid);
  parent.appendChild(details);
}

function renderFrameworks(documentRef, parent, sectionIds) {
  const selected = unique(sectionIds);
  const sections = SUPPLIED_MATERIALS_REFERENCE.sections.filter((item) => selected.includes(item.id));
  const grid = element(documentRef, 'div', 'aio-reference-bridge-grid');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px;';
  sections.forEach((item) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-card');
    card.dataset.referenceSection = item.id;
    card.dataset.sourceKind = SUPPLIED_MATERIALS_REFERENCE.sourceKind;
    card.dataset.operationalUse = SUPPLIED_MATERIALS_REFERENCE.operationalUse;
    card.style.cssText = 'padding:11px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    card.append(
      element(documentRef, 'h3', 'aio-reference-bridge-card-title', item.title),
      element(documentRef, 'p', 'aio-reference-bridge-card-thesis', item.thesis),
      element(documentRef, 'strong', 'aio-reference-bridge-card-label', '전달 경로')
    );
    const list = element(documentRef, 'ol', 'aio-reference-bridge-card-steps');
    list.style.cssText = 'margin:7px 0 8px;padding-left:20px;';
    item.steps.forEach((step) => list.appendChild(element(documentRef, 'li', '', step)));
    card.appendChild(list);
    card.append(
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `관측: ${item.observe}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `보류 조건: ${item.invalidation}`)
    );
    if (item.sourceRefs?.length) card.appendChild(element(documentRef, 'p', 'aio-reference-bridge-card-sources', `자료 추적: ${item.sourceRefs.join(' · ')}`));
    grid.appendChild(card);
  });
  parent.appendChild(grid);
}

function renderNathanThreads(documentRef, parent, routeId) {
  if (routeId !== 'screener') return;
  const reference = SUPPLIED_MATERIALS_REFERENCE.nathanThreads;
  const threads = Array.isArray(reference?.threads) ? reference.threads : [];
  const frameworks = Array.isArray(reference?.frameworks) ? reference.frameworks : [];
  if (!threads.length && !frameworks.length) return;
  const details = element(documentRef, 'details', 'aio-reference-bridge-nathan-threads');
  details.dataset.nathanThreadsReferenceId = reference.id || 'unknown';
  details.appendChild(element(documentRef, 'summary', '', `Nathan's Previous Threads · X 링크 ${reference.catalog?.xLinkCount ?? threads.length}개 · 직접 확인 ${reference.catalog?.directReadCount ?? '—'}개 · 원문 부재 ${reference.catalog?.xNotFoundCount ?? '—'}개 · 로딩 미검증 ${reference.catalog?.xUnverifiedLoadingCount ?? '—'}개`));
  details.appendChild(element(documentRef, 'p', 'aio-reference-bridge-boundary', reference.boundary || '원문과 구조 프레임은 reference-only입니다.'));
  const contentAudit = reference.contentAudit;
  if (contentAudit) {
    details.appendChild(element(documentRef, 'p', 'aio-reference-bridge-card-observe', `원문 요소 감사: 직접 확인 ${contentAudit.directReadThreadCount ?? '—'}개 · 렌더된 게시물/답글 ${contentAudit.visibleThreadPostElements ?? '—'}개 · 링크 ${contentAudit.visibleLinkElements ?? '—'}개 · 미디어/이미지 ${contentAudit.visibleMediaAndImageElements ?? '—'}개 · 동작 요소 ${contentAudit.visibleActionElements ?? '—'}개. ${contentAudit.method || ''}`));
  }
  const audit = element(documentRef, 'div', 'aio-reference-bridge-nathan-audit');
  audit.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:9px;';
  (reference.sourceAudit || []).forEach((item) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-nathan-audit-card');
    card.style.cssText = 'padding:9px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    card.append(
      element(documentRef, 'strong', '', item.label),
      element(documentRef, 'p', '', `Notion ${item.notionPageCount}/${item.notionBadgeCount} 페이지 · X ${item.xLinkCount}개`),
      element(documentRef, 'p', '', `직접 확인 ${item.directReadCount} · 원문 부재/미확인 ${item.blockedCount} · X 링크 없음 ${item.noXLinkCount}`)
    );
    audit.appendChild(card);
  });
  details.appendChild(audit);

  const frameworkDetails = element(documentRef, 'details', 'aio-reference-bridge-nathan-frameworks');
  frameworkDetails.appendChild(element(documentRef, 'summary', '', `반복 구조에서 추출한 프레임워크 ${frameworks.length}개`));
  const frameworkGrid = element(documentRef, 'div', 'aio-reference-bridge-nathan-framework-grid');
  frameworkGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:9px;';
  frameworks.forEach((framework) => {
    const card = element(documentRef, 'article', 'aio-reference-bridge-nathan-framework-card');
    card.dataset.nathanFrameworkId = framework.id;
    card.dataset.sourceKind = 'REFERENCE';
    card.style.cssText = 'padding:11px;border:1px solid var(--border);border-radius:5px;background:var(--surface-1);';
    card.append(
      element(documentRef, 'h3', 'aio-reference-bridge-card-title', framework.title || framework.id),
      element(documentRef, 'p', 'aio-reference-bridge-card-thesis', `논지: ${framework.thesis || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `전달 구조: ${framework.mechanism || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `입력·창: ${(framework.inputs || []).join(' · ')} · ${framework.timeframe || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-observe', `확인: ${framework.confirmation || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `무효화·반대: ${[framework.invalidation, framework.counterclaim].filter(Boolean).join(' ') || '—'}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-sources', `자료 추적: ${(framework.sourceRefs || []).join(' · ')}`),
      element(documentRef, 'p', 'aio-reference-bridge-card-invalidation', `현재성 경계: ${framework.currentnessBoundary || 'reference-only'}`)
    );
    frameworkGrid.appendChild(card);
  });
  frameworkDetails.appendChild(frameworkGrid);
  details.appendChild(frameworkDetails);

  const linkDetails = element(documentRef, 'details', 'aio-reference-bridge-nathan-links');
  linkDetails.appendChild(element(documentRef, 'summary', '', `X 원문 링크 인덱스 ${threads.length}개`));
  const linkList = element(documentRef, 'ol', 'aio-reference-bridge-nathan-link-list');
  linkList.style.cssText = 'margin:9px 0 0;padding-left:23px;columns:2;column-gap:24px;';
  threads.forEach((thread) => {
    const row = element(documentRef, 'li', 'aio-reference-bridge-nathan-link-item');
    row.dataset.nathanThreadId = thread.id;
    row.dataset.accessStatus = thread.accessStatus;
    row.style.cssText = 'break-inside:avoid;margin:0 0 6px;';
    const accessLabel = thread.accessStatus === 'DIRECT_READ'
      ? '직접 확인'
      : thread.accessStatus === 'X_NOT_FOUND'
        ? 'X 원문 부재'
        : '원문 미검증';
    const link = element(documentRef, 'a', '', `${thread.title} · ${accessLabel}`);
    link.href = thread.xUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    row.append(link, element(documentRef, 'small', '', ` · ${thread.category} · Notion ${thread.notionDate}${thread.observedPostCount != null ? ` · 확인된 게시물 요소 ${thread.observedPostCount}개` : ''}`));
    linkList.appendChild(row);
  });
  linkDetails.appendChild(linkList);
  details.appendChild(linkDetails);
  parent.appendChild(details);
}

export function createSuppliedMaterialBridge(documentRef, { routeId = '', sectionIds = null, timeSeriesIds = null, heading = '' } = {}) {
  const mapping = SUPPLIED_MATERIALS_REFERENCE.routeMappings?.[routeId] || {};
  const resolvedSectionIds = unique(sectionIds == null ? mapping.sectionIds : sectionIds);
  const resolvedTimeSeriesIds = unique(timeSeriesIds == null ? mapping.timeSeriesIds : timeSeriesIds);
  const section = element(documentRef, 'aside', 'aio-integrated-analysis-context');
  // External material is consumed by the internal knowledge/protocol layer;
  // it is not a second user-facing research page or a raw-link index.
  section.hidden = true;
  section.setAttribute('aria-hidden', 'true');
  section.dataset.sourceKind = SUPPLIED_MATERIALS_REFERENCE.sourceKind;
  section.dataset.operationalUse = SUPPLIED_MATERIALS_REFERENCE.operationalUse;
  section.dataset.referenceId = SUPPLIED_MATERIALS_REFERENCE.id;
  section.dataset.integrationMode = 'internal-protocol-only';
  section.dataset.referenceFrameworkCount = String(mapping.nathanFrameworkIds?.length || 0);
  section.dataset.referenceSectionCount = String(resolvedSectionIds.length);
  section.dataset.referenceTimeSeriesCount = String(resolvedTimeSeriesIds.length);
  section.dataset.processingBoundary = 'current-observation-separated-from-structural-reference';
  if (routeId) section.dataset.aioSuppliedMaterialRoute = routeId;
  if (resolvedTimeSeriesIds.length) section.dataset.aioSuppliedMaterialTimeseries = resolvedTimeSeriesIds.join(',');
  section.textContent = `${heading || '구조 분석 프로토콜'}: 현재 데이터·구조적 참고·추론·행동 경계를 분리합니다.`;
  return section;
}
