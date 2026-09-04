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
  const current = audits.find((item) => item.id === 'packet-2026-09-05') || audits.find((item) => item.id === 'packet-2026-08-30');
  const audit = element(documentRef, 'details', 'aio-reference-bridge-audit');
  audit.appendChild(element(documentRef, 'summary', '', `자료 감사 · ${current?.label || 'source packet'} · 확인 ${current?.readableCount ?? '—'} · 미확인/차단 ${current?.blockedCount ?? '—'}`));
  audits.forEach((item) => {
    const row = element(documentRef, 'div', 'aio-reference-bridge-audit-row');
    appendLabelValue(documentRef, row, item.label, `${item.status} · ${item.note}`);
    audit.appendChild(row);
  });
  parent.appendChild(audit);
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
  renderAudit(documentRef, section);
  renderMediaAudit(documentRef, section);
  renderTimeSeries(documentRef, section, resolvedTimeSeriesIds);
  renderFrameworks(documentRef, section, resolvedSectionIds);
  return section;
}
