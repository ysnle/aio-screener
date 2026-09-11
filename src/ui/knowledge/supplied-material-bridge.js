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
  const current = audits.find((item) => item.id === 'packet-2026-09-11') || audits.find((item) => item.id === 'packet-2026-09-05') || audits.find((item) => item.id === 'packet-2026-08-30');
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

export function createSuppliedMaterialBridge(documentRef, { routeId = '', sectionIds = null, timeSeriesIds = null, heading = '이번 연구자료에서 추가된 구조 브리지' } = {}) {
  const mapping = SUPPLIED_MATERIALS_REFERENCE.routeMappings?.[routeId] || {};
  const resolvedSectionIds = sectionIds == null ? mapping.sectionIds : sectionIds;
  const resolvedTimeSeriesIds = timeSeriesIds == null ? mapping.timeSeriesIds : timeSeriesIds;
  const section = element(documentRef, 'section', 'aio-reference-bridge');
  section.dataset.sourceKind = SUPPLIED_MATERIALS_REFERENCE.sourceKind;
  section.dataset.operationalUse = SUPPLIED_MATERIALS_REFERENCE.operationalUse;
  section.dataset.referenceId = SUPPLIED_MATERIALS_REFERENCE.id;
  if (routeId) section.dataset.aioSuppliedMaterialRoute = routeId;
  if (resolvedTimeSeriesIds?.length) section.dataset.aioSuppliedMaterialTimeseries = unique(resolvedTimeSeriesIds).join(',');
  section.style.cssText = 'margin:14px 0;padding:14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);';
  section.append(
    element(documentRef, 'div', 'aio-reference-bridge-eyebrow', 'SUPPLIED MATERIALS · REFERENCE ONLY'),
    element(documentRef, 'h2', 'aio-reference-bridge-title', heading),
    element(documentRef, 'p', 'aio-reference-bridge-boundary', SUPPLIED_MATERIALS_REFERENCE.boundary)
  );
  // Long reference packets are secondary to the route's current observations.
  // Native details keeps keyboard access and the complete source text intact.
  const details = element(documentRef, 'details', 'aio-reference-bridge-details');
  details.appendChild(element(documentRef, 'summary', '', `배경 자료와 확인 질문 보기 · ${unique(resolvedSectionIds).length}개 주제`));
  renderAudit(documentRef, details);
  renderSourceTimeline(documentRef, details);
  renderMediaAudit(documentRef, details);
  renderClaimLedger(documentRef, details);
  renderTimeSeries(documentRef, details, resolvedTimeSeriesIds);
  renderFrameworks(documentRef, details, resolvedSectionIds);
  section.appendChild(details);
  return section;
}
